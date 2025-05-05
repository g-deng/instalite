package instalite.wahoo.jobs;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintStream;
import java.net.URISyntaxException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import instalite.wahoo.jobs.utils.FlexibleLogger;

import instalite.wahoo.spark.SparkJob;
import io.github.cdimascio.dotenv.Dotenv;
import instalite.wahoo.jobs.SocialRankJob;
import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.config.AppConfig;

/**
 * The `ComputeRanksLivy` class is responsible for running a social network ranking job using Apache Livy.
 * It takes command line arguments to configure the job parameters and performs the following tasks:
 * 1. Runs a SocialRankJob with backlinks set to true and writes the output to a file named "socialrank-livy-backlinks.csv".
 * 2. Runs a SocialRankJob with backlinks set to false and writes the output to a file named "socialrank-livy-nobacklinks.csv".
 * 3. Compares the top-10 results from both runs and writes the comparison to a file named "socialrank-livy-results.txt".
 * <p>
 * The class uses the Apache Livy library to submit and execute the jobs on a Livy server.
 * It also uses the SparkJob class to run the SocialRankJob and obtain the results.
 * <p>
 * To run the job, the `LIVY_HOST` environment variable must be set. If not set, the program will exit with an error message.
 */
public class ComputeRanksLivy {
    static Logger logger = LogManager.getLogger(ComputeRanksLivy.class);


    public static void main(String[] args)
            throws IOException, URISyntaxException, InterruptedException, ExecutionException {
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
            d_max = 30;
            i_max = 25;
            debug = false;
        }

        
        FlexibleLogger logger = new FlexibleLogger(null, false, debug);

        // Set up serializable config
        Dotenv dotenv = Dotenv.configure().load();

        Map<String, String> envVars = new HashMap<>();
        for (String key : new String[] {
            "DATABASE_SERVER", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD",
            "SPARK_MASTER", "LIVY_HOST",
            "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "SESSION_TOKEN"
        }) {
            String val = dotenv.get(key);
            if (val == null) throw new RuntimeException("Missing: " + key);
            envVars.put(key, val);
        }
        AppConfig appConfig = new AppConfig(envVars);

        SocialRankJob job = new SocialRankJob(d_max, i_max, null, false, false, debug, logger);
        job.setParams(envVars);
        List<SerializablePair<String, Double>> noBacklinksResult = SparkJob.runJob(appConfig.livyUrl, appConfig.jar, job);

        System.out.println("Without backlinks: " + noBacklinksResult);
        try (PrintStream out = new PrintStream(new FileOutputStream("socialrank-livy-nobacklinks.csv"))) {
            for (SerializablePair<String, Double> item : noBacklinksResult) {
                out.println(item.getLeft() + "," + item.getRight());
            }
        } catch (Exception e) {
            logger.error("Error writing to file: " + e.getMessage());
        }

        logger.info("*** Finished social network ranking via Livy! ***");

    }
    

}   
