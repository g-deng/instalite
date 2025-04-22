package instalite.wahoo.jobs;

import instalite.wahoo.config.Config;
import instalite.wahoo.config.ConfigSingleton;
import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.jobs.utils.FlexibleLogger;
import instalite.wahoo.spark.SparkJob;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Connection;
import java.util.List;

import javax.security.auth.login.ConfigurationSpi;

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
            d_max = 30;
            i_max = 25;
            debug = false;
        }

        FlexibleLogger rankLogger = new FlexibleLogger(LogManager.getLogger(SparkJob.class), true, debug);
        // No backlinks
        SocialRankJob job = new SocialRankJob(d_max, i_max, Config.FIRST_N_ROWS, false, true, debug, rankLogger, config);

        List<SerializablePair<String, Double>> topK = job.mainLogic();
        logger.info("*** Finished social network ranking! ***");
        
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
            for (SerializablePair<String, Double> item : topK) {
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

}