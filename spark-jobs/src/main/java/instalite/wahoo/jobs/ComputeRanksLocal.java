package instalite.wahoo.jobs;

import instalite.wahoo.config.Config;
import instalite.wahoo.config.ConfigSingleton;
import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.jobs.utils.FlexibleLogger;
import instalite.wahoo.spark.SparkJob;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.sql.SparkSession;

import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Connection;
import java.util.List;

public class ComputeRanksLocal {
    static Logger logger = LogManager.getLogger(ComputeRanksLocal.class);

    public static void main(String[] args) {
        boolean debug;

        Config config = ConfigSingleton.getInstance();

        double d_max;
        int i_max;

        // Process command line arguments if given
        if (args.length == 1) {
            d_max = Double.parseDouble(args[0]);
            i_max = 25;
            debug = false;
        } else if (args.length == 2) {
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug = false;
        } else if (args.length == 3) {
            d_max = Double.parseDouble(args[0]);
            i_max = Integer.parseInt(args[1]);
            debug = true;
        } else {
            d_max = 0.1;
            i_max = 15;
            debug = false;
        }
        SparkSession spark = SparkSession.builder()
            .appName("Ranking Job")
            .master("local[*]")
            .getOrCreate();

        FlexibleLogger rankLogger = new FlexibleLogger(LogManager.getLogger(SparkJob.class), true, debug);
        
        // SOCIAL RANKING
        logger.info("*** Starting social network ranking! ***");
        SocialRankJob socialRankJob = new SocialRankJob(d_max, i_max, spark, false, true, debug, rankLogger, config);
        List<SerializablePair<String, Double>> socialRanks = socialRankJob.mainLogic();
        sendSocialRanksToDB(socialRanks);
        logger.info("*** Finished sending social ranks to DB! ***");

        // POST RANKING & FRIEND RANKING
        logger.info("*** Starting post ranking! ***");
        PostRankJob postRankJob = new PostRankJob(d_max, i_max, spark, true, debug, rankLogger, config);
        List<SerializablePair<String, Double>> postRanks = postRankJob.mainLogic();
        sendPostRanksToDB(postRanks);
        logger.info("*** Finished sending post ranks to DB! ***");

        // FOLLOWER OF FOLLOWERS
        logger.info("*** Followers of Followers starting ***");
        FollowersOfFollowersJob fofJob = new FollowersOfFollowersJob(spark, true, debug, rankLogger, config);
        List<SerializablePair<String, Integer>> fofRecs = fofJob.mainLogic();
        sendFofRecsToDB(fofRecs);
        logger.info("*** Followers of Followers complete ***"); 


        // Close the Spark session
        spark.stop();
    }

    public static void sendSocialRanksToDB(List<SerializablePair<String, Double>> socialRanks) {
        try (
            Connection conn = DriverManager.getConnection(
                Config.DATABASE_CONNECTION, Config.DATABASE_USERNAME, Config.DATABASE_PASSWORD
            );
            Statement clearStmt = conn.createStatement();
            PreparedStatement insertStmt = conn.prepareStatement(
                "REPLACE INTO social_rank (user_id, social_rank) VALUES (?, ?)"
            )
        ) {
            // Clear the table
            clearStmt.executeUpdate("DELETE FROM social_rank");

            // Insert new ranks
            for (SerializablePair<String, Double> item : socialRanks) {
                int userId = Integer.parseInt(item.getLeft());
                double rank = item.getRight();

                insertStmt.setInt(1, userId);
                insertStmt.setDouble(2, rank);
                insertStmt.addBatch();
            }

            insertStmt.executeBatch();
            logger.info("Refreshed social_rank table with new entries.");

        } catch (Exception e) {
            logger.error("Error writing to social_rank: " + e.getMessage(), e);
        }
    }

    public static void sendPostRanksToDB(List<SerializablePair<String, Double>> postRanks) {
        logger.info("Sending post ranks to DB post_weights...");
        if (postRanks == null || postRanks.isEmpty()) {
            logger.warn("No post ranks to send to DB.");
            return;
        }

        try (
            Connection conn = DriverManager.getConnection(
                Config.DATABASE_CONNECTION, Config.DATABASE_USERNAME, Config.DATABASE_PASSWORD
            );
            Statement clearStmt = conn.createStatement();
            PreparedStatement insertStmtPost = conn.prepareStatement(
                "REPLACE INTO post_weights (post_id, user_id, weight) VALUES (?, ?, ?)"
            );
            PreparedStatement insertStmtFriend = conn.prepareStatement(
                "REPLACE INTO friend_recs (user, recommendation, strength) VALUES (?, ?, ?)"
            );
        ) {
            // Clear the table
            clearStmt.executeUpdate("DELETE FROM post_weights");
            clearStmt.executeUpdate("DELETE FROM friend_recs");

            // Insert new ranks
            for (SerializablePair<String, Double> item : postRanks) {
                String[] parts = item.getLeft().split(",");
                char nodeType = parts[0].charAt(0);
                String nodeIdStr = parts[0].substring(1);
                char userType = parts[1].charAt(0);
                String userIdStr = parts[1].substring(1);
                double weight = item.getRight();
                logger.info(parts[0] + " " + parts[1] + " " + item.getRight());
                if (nodeType == 'p' && userType == 'u' && weight != 0) {
                    // post ranking
                    int postId = Integer.parseInt(nodeIdStr);
                    int userId = Integer.parseInt(userIdStr);
    
                    insertStmtPost.setInt(1, postId);
                    insertStmtPost.setInt(2, userId);
                    insertStmtPost.setDouble(3, weight);
                    insertStmtPost.addBatch();
                } 
            }

            insertStmtPost.executeBatch();
            insertStmtFriend.executeBatch();
            logger.info("Refreshed post_weights table with new entries.");

        } catch (Exception e) {
            logger.error("Error writing to post_weights: " + e.getMessage(), e);
        }
    }
    
    private static void sendFofRecsToDB(List<SerializablePair<String, Integer>> recs) {
        if (recs == null || recs.isEmpty()) {
            logger.warn("No follow recommendations to persist");
            return;
        }
        try (Connection conn = DriverManager.getConnection(Config.DATABASE_CONNECTION,
                                                           Config.DATABASE_USERNAME,
                                                           Config.DATABASE_PASSWORD);
             Statement wipe = conn.createStatement();
             PreparedStatement ins = conn.prepareStatement(
                     "REPLACE INTO friend_recs (user, recommendation, strength) VALUES (?, ?, ?)") ) {

            wipe.executeUpdate("DELETE FROM friend_recs");
            for (SerializablePair<String, Integer> p : recs) {
                String[] ids = p.getLeft().split(",");
                int userId = Integer.parseInt(ids[0]);
                int recId  = Integer.parseInt(ids[1]);
                ins.setInt(1, userId);
                ins.setInt(2, recId);
                ins.setInt(3, p.getRight());
                ins.addBatch();
            }
            ins.executeBatch();
            logger.info("friend_recs refreshed");
        } catch (Exception e) {
            logger.error("Error writing friend_recs", e);
        }
    }
}