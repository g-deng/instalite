package instalite.wahoo.jobs;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.*;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import instalite.wahoo.jobs.utils.FlexibleLogger;

import instalite.wahoo.spark.SparkJob;
import io.github.cdimascio.dotenv.Dotenv;
import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.config.AppConfig;

public class ComputeRanksLivy {
    static Logger logger = LogManager.getLogger(ComputeRanksLivy.class);

    public static void main(String[] args) throws InterruptedException, ExecutionException {
        boolean debug;
        double d_max;
        int i_max;

        // Parse CLI args
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

        FlexibleLogger flogger = new FlexibleLogger(null, false, debug);

        // Load env vars
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
        AppConfig appConfig = new AppConfig(envVars);

        // Start parallel job execution
        ExecutorService executor = Executors.newFixedThreadPool(3);

        Future<List<SerializablePair<String, Double>>> futureSocialRank = executor.submit(() -> {
            SocialRankJob socialRankJob = new SocialRankJob(d_max, i_max, null, false, false, debug, flogger);
            socialRankJob.setParams(envVars);
            return SparkJob.runJob(appConfig.livyUrl, appConfig.jar, socialRankJob);
        });

        Future<Void> futurePostRank = executor.submit(() -> {
            PostRankJob postRankJob = new PostRankJob(d_max, i_max, null, false, debug, flogger);
            postRankJob.setParams(envVars);
            SparkJob.runJob(appConfig.livyUrl, appConfig.jar, postRankJob);
            return null;
        });

        Future<List<SerializablePair<String, Integer>>> futureFOF = executor.submit(() -> {
            FollowersOfFollowersJob fofJob = new FollowersOfFollowersJob(null, true, debug, flogger);
            fofJob.setParams(envVars);
            return SparkJob.runJob(appConfig.livyUrl, appConfig.jar, fofJob);
        });

        // Wait for results
        List<SerializablePair<String, Double>> socialRankResult = futureSocialRank.get();
        List<SerializablePair<String, Integer>> fofResult = futureFOF.get();
        futurePostRank.get();  // ensure completion even if no output

        flogger.info("*** Finished social network ranking via Livy! ***");
        for (SerializablePair<String, Double> result : socialRankResult) {
            flogger.info(result.getLeft() + " " + result.getRight());
        }

        flogger.info("*** Followers of Followers complete ***");
        flogger.info("Preview:");
        for (SerializablePair<String, Integer> result : fofResult) {
            flogger.info(result.getLeft() + " " + result.getRight());
        }

        executor.shutdown();
    }
}
