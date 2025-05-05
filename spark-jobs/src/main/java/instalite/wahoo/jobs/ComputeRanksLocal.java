package instalite.wahoo.jobs;

import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.jobs.utils.FlexibleLogger;
import instalite.wahoo.spark.SparkJob;
import io.github.cdimascio.dotenv.Dotenv;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.sql.SparkSession;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ComputeRanksLocal {
    static Logger logger = LogManager.getLogger(ComputeRanksLocal.class);

    public static void main(String[] args) {
        boolean debug;
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
       
        // Set up serializable config
        Dotenv dotenv = Dotenv.configure().load();

        Map<String, String> envVars = new HashMap<>();
        for (String key : new String[] {
            "DATABASE_SERVER", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD",
            "SPARK_MASTER", "LIVY_HOST",
            "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "SESSION_TOKEN"
        }) {
            String val = dotenv.get(key);
            if (val == null) throw new IllegalStateException("Missing: " + key);
            envVars.put(key, val);
        }

        envVars.put("DATABASE_SERVER", "localhost");
        
        // SOCIAL RANKING
        SocialRankJob socialRankJob = new SocialRankJob(d_max, i_max, spark, false, true, debug, rankLogger);
        socialRankJob.setParams(envVars);
        List<SerializablePair<String, Double>> socialRanks = socialRankJob.mainLogic();
        logger.info("*** Finished post ranking via local Spark! ***");

        for (SerializablePair<String, Double> result : socialRanks) {
            logger.info(result.getLeft() + " " + result.getRight());
        }

        // POST RANKING & FRIEND RANKING
        PostRankJob postRankJob = new PostRankJob(d_max, i_max, spark, true, debug, rankLogger);
        postRankJob.setParams(envVars);
        List<SerializablePair<String, Double>> postRanks = postRankJob.mainLogic();
        logger.info("*** Finished post ranking via local Spark! ***");
        logger.info("Preview:");
        for (SerializablePair<String, Double> result : postRanks) {
            logger.info(result.getLeft() + " " + result.getRight());
        }

        // Close the Spark session
        spark.stop();
    }
}