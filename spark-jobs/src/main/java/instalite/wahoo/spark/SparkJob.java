package instalite.wahoo.spark;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.concurrent.ExecutionException;
import java.util.Map;

import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import instalite.wahoo.config.AppConfig;
import instalite.wahoo.jobs.utils.FlexibleLogger;

/**
 * A basic Spark job with session info, initialize, shutdown, and run methods
 */
public abstract class SparkJob<T> implements Job<T> {
    private static final long serialVersionUID = 1L;
    /**
     * The basic logger
     */
    // static Logger logger = LogManager.getLogger(SparkJob.class);

    protected FlexibleLogger logger;

    /**
     * Connection to Apache Spark
     */
    protected SparkSession spark;
    protected transient JavaSparkContext context;
    protected boolean isLocal = true;
    protected Map<String, String> envVars;
    protected AppConfig appConfig;
    boolean run_with_debug = false;

    public SparkJob(FlexibleLogger logger, SparkSession spark, boolean isLocal, boolean debug) {
        System.setProperty("file.encoding", "UTF-8");
        this.isLocal = isLocal;
        if (isLocal) {
            this.spark = spark;
        }   

        this.run_with_debug = debug;
        this.logger = logger;
    }

    public void setParams(Map<String, String> envVars) {
        this.envVars = envVars;
    }

    /**
     * Initialize the connection to Spark
     *
     * @throws IOException
     * @throws InterruptedException
     */
    public void initialize() throws IOException, InterruptedException {
        logger.info("Connecting to Spark...");
        if (appConfig == null) appConfig = new AppConfig(envVars);

        spark = SparkConnector.getSparkConnection(
            appConfig.sparkAppName,
            appConfig.sparkMaster,
            appConfig.accessKeyId,
            appConfig.secretAccessKey,
            appConfig.sessionToken
        );
        context = SparkConnector.getSparkContext(spark);

        logger.debug("Connected!");
    }

    /**
     * Main functionality in the program: read and process the social network
     *
     * @throws IOException          File read, network, and other errors
     * @throws InterruptedException User presses Ctrl-C
     */
    public abstract T run(boolean debug) throws Exception;

    /**
     * Graceful shutdown
     */
    public void shutdown() {
        logger.info("Shutting down");

        if (isLocal && spark != null)
            spark.close();
    }

    /**
     * Initialize - run loop that catches errors and shuts down
     */
    public T mainLogic() {
        if (!isLocal)
            throw new RuntimeException("mainLogic() should not be called on a Livy Job");
    
        try {
            if (spark == null)
                initialize();
    
            return run(run_with_debug);
        } catch (final IOException ie) {
            logger.error("I/O error: ");
            ie.printStackTrace();
            return null;
        } catch (final Exception e) {
            e.printStackTrace();
            return null;
        }
        // finally {
        //     if (spark != null && isLocal)
        //         shutdown();
        // }
    }
    

    @Override
    public T call(JobContext arg0) throws Exception {
        initialize();
        return run(run_with_debug);
    }

    /**
     * Gets the URL for Livy, in most cases from the environment.
     *
     * @param optArgs -- optional command-line args from main()
     * @return URL
     */
    public static String getLivyUrl(String[] optArgs) {
        String livy = "http://localhost:8998";

        if (optArgs.length > 0) {
            livy = optArgs[0];
        } else if (System.getenv("host") != null) {
            livy = System.getenv("LIVY_HOST");
        }

        if (!livy.startsWith("http://"))
            livy = "http://" + livy;

        if (!livy.endsWith(":8998"))
            livy = livy + ":8998";

        return livy;
    }

    /**
     * Static method to run a SparkJob remotely at a Livy URL.
     * Will create the Livy client, upload the JAR, and run the job.
     *
     * @param <T>
     * @param livyUrl
     * @param job
     * @return
     * @throws IOException
     * @throws URISyntaxException
     * @throws InterruptedException
     * @throws ExecutionException
     */
    public static <T> T runJob(String livyUrl, String jarPath, SparkJob<T> job) throws IOException, URISyntaxException, InterruptedException, ExecutionException {

        LivyClient client = new LivyClientBuilder()
                .setURI(new URI(livyUrl))
                .build();

        try {

            System.out.printf("Uploading %s to the Spark context...\n", jarPath);
            //client.uploadJar(new File(jarPath)).get();
            client.addJar(new URI("s3://nets2120-livyjars-wahoo/framework.jar"));

            System.out.printf("Running job...\n");
            T result = client.submit(job).get();

            return result;
        } finally {
            client.stop(true);
        }
    }
}