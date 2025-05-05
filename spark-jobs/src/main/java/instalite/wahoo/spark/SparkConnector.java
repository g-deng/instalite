package instalite.wahoo.spark;

import java.io.File;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

public class SparkConnector {
    private static final Logger logger = LogManager.getLogger(SparkConnector.class);

    private static SparkSession spark = null;
    private static JavaSparkContext context = null;

    // For testing: override injected SparkSession
    public static void setSparkSession(SparkSession s) {
        spark = s;
    }

    public static void setSparkContext(JavaSparkContext c) {
        context = c;
    }

    public static synchronized SparkSession getSparkConnection(
        String appName,
        String master,
        String accessKey,
        String secretKey,
        String sessionToken
    ) {
        if (spark == null) {
            // Ensure Hadoop native libraries are set if needed
            if (System.getenv("HADOOP_HOME") == null) {
                File workaround = new File(".");
                System.setProperty("hadoop.home.dir", workaround.getAbsolutePath() + "/native-libs");
            }

            SparkSession.Builder builder = SparkSession.builder()
                .appName(appName)
                .master(master);

            if (accessKey != null && secretKey != null) {
                logger.info("Using explicit AWS credentials");
                builder.config("spark.hadoop.fs.s3a.access.key", accessKey)
                       .config("spark.hadoop.fs.s3a.secret.key", secretKey)
                       .config("spark.hadoop.fs.s3a.endpoint", "s3.us-east-1.amazonaws.com");

                if (sessionToken != null) {
                    builder.config("spark.hadoop.fs.s3a.session.token", sessionToken);
                }
            } else {
                logger.info("Using AWS profile credentials");
                builder.config("spark.hadoop.fs.s3a.aws.credentials.provider",
                               "com.amazonaws.auth.profile.ProfileCredentialsProvider")
                       .config("spark.hadoop.fs.s3a.aws.credentials.profile.name", "default");
            }

            spark = builder.getOrCreate();
        }

        return spark;
    }

    public static synchronized JavaSparkContext getSparkContext(SparkSession sparkSession) {
        if (context == null)
            context = new JavaSparkContext(sparkSession.sparkContext());
        return context;
    }
}
