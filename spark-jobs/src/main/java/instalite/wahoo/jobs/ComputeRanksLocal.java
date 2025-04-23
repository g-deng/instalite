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

        // POST RANKING
        logger.info("*** Starting post ranking! ***");
        PostRankJob postRankJob = new PostRankJob(d_max, i_max, spark, true, debug, rankLogger, config);
        List<SerializablePair<String, Double>> postRanks = postRankJob.mainLogic();
        sendPostRanksToDB(postRanks);
        logger.info("*** Finished sending post ranks to DB! ***");

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
            PreparedStatement insertStmt = conn.prepareStatement(
                "REPLACE INTO post_weights (post_id, user_id, weight) VALUES (?, ?, ?)"
            )
        ) {
            // Clear the table
            clearStmt.executeUpdate("DELETE FROM post_weights");

            // Insert new ranks
            for (SerializablePair<String, Double> item : postRanks) {
                String[] parts = item.getLeft().split(",");
                String[] post = parts[0].split("");
                String[] user = parts[1].split("");
                logger.info(parts[0] + " " + parts[1] + " " + item.getRight());
                if (post[0].equals("p") && user[0].equals("u")) {
                    int postId = Integer.parseInt(post[1]);
                    int userId = Integer.parseInt(user[1]);
                    double weight = item.getRight();
    
                    insertStmt.setInt(1, postId);
                    insertStmt.setInt(2, userId);
                    insertStmt.setDouble(3, weight);
                    insertStmt.addBatch();
                }
            }

            insertStmt.executeBatch();
            logger.info("Refreshed post_weights table with new entries.");

        } catch (Exception e) {
            logger.error("Error writing to post_weights: " + e.getMessage(), e);
        }
    }
}