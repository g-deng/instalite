package instalite.wahoo.config;
import java.util.Map;
import java.io.Serializable;

public class AppConfig implements Serializable {
    public final String dbUrl;
    public final String dbUser;
    public final String dbPassword;
    public final String sparkAppName;
    public final String sparkMaster;
    public final String jar;
    public final String livyUrl;
    public final String accessKeyId;
    public final String secretAccessKey;
    public final String sessionToken;

    public AppConfig(Map<String, String> env) {
        String dbServer = require(env, "DATABASE_SERVER");
        String dbName = require(env, "DATABASE_NAME");
        this.dbUrl = "jdbc:mysql://" + dbServer + ":3306/" + dbName;
        this.dbUser = require(env, "DATABASE_USER");
        this.dbPassword = require(env, "DATABASE_PASSWORD");

        this.sparkAppName = "IMDBRelations";
        this.sparkMaster = env.getOrDefault("SPARK_MASTER", "local[*]");
        this.jar = env.getOrDefault("JAR_PATH", "target/framework.jar");
        this.livyUrl = "http://" + require(env, "LIVY_HOST") + ":8998";

        this.accessKeyId = require(env, "ACCESS_KEY_ID");
        this.secretAccessKey = require(env, "SECRET_ACCESS_KEY");
        this.sessionToken = require(env, "SESSION_TOKEN");
    }

    private static String require(Map<String, String> env, String key) {
        String val = env.get(key);
        if (val == null) throw new IllegalArgumentException("Missing required config: " + key);
        return val;
    }
}

