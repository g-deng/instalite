package instalite.wahoo.jobs;

import instalite.wahoo.config.Config;
import instalite.wahoo.config.ConfigSingleton;
import instalite.wahoo.jobs.SocialRankJob;
import instalite.wahoo.jobs.utils.SerializablePair;

import instalite.wahoo.jobs.utils.FlexibleLogger;
import instalite.wahoo.spark.SparkJob;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileOutputStream;
import java.io.PrintStream;
import java.util.*;

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

        try (PrintStream out = new PrintStream(new FileOutputStream("socialrank-local.csv"))) {
            for (SerializablePair<String, Double> item : topK) {
                out.println(item.getLeft() + "," + item.getRight());
                logger.info(item.getLeft() + " " + item.getRight());
            }
        } catch (Exception e) {
            logger.error("Error writing to file: " + e.getMessage());
        }
    }

}