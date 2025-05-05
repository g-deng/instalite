package instalite.wahoo.jobs;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.ArrayList;

import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.RowFactory;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructType;

import instalite.wahoo.config.AppConfig;
import instalite.wahoo.jobs.utils.FlexibleLogger;
import instalite.wahoo.jobs.utils.SerializablePair;
import instalite.wahoo.spark.SparkJob;
import scala.Tuple2;

public class FollowersOfFollowersJob
        extends SparkJob<List<SerializablePair<String, Integer>>> {

    private static final long serialVersionUID = 1L;

    public FollowersOfFollowersJob(SparkSession spark,
                                      boolean      isLocal,
                                      boolean      debug,
                                      FlexibleLogger logger) {
        super(logger, spark, isLocal, debug);
    }

    protected Dataset<Row> queryMySQL(String query) {
        return spark.read()
            .format("jdbc")
            .option("url",      appConfig.dbUrl)
            .option("driver",   "com.mysql.cj.jdbc.Driver")
            .option("dbtable",  "(" + query + ") AS q")
            .option("user",     appConfig.dbUser)
            .option("password", appConfig.dbPassword)
            .load();
    }

    protected JavaPairRDD<String,String> getFollowerEdges() {
        logger.debug("getFollowerEdges started");

        Dataset<Row> df = queryMySQL(
                "SELECT followed , follower "
              + "FROM friends "
              + "WHERE followed IS NOT NULL "
              + "  AND follower IS NOT NULL");

        JavaPairRDD<String,String> edges = df
            .select("followed","follower")
            .javaRDD()
            .mapToPair(r -> new Tuple2<>(
                    "u" + r.getInt(0),   
                    "u" + r.getInt(1)));

        logger.debug("getFollowerEdges completed");
        return edges;
    }

    protected JavaPairRDD<Tuple2<String,String>,Integer>
    followerOfFollowerRecommendations(JavaPairRDD<String,String> network) {

        JavaPairRDD<String,String> byFollower = network.mapToPair(
                t -> new Tuple2<>(t._2(), t._1()));

        JavaPairRDD<String, Iterable<String>> follows =
                byFollower.groupByKey().cache();

        java.util.Map<String, Iterable<String>> followsMap =
                follows.collectAsMap();

        JavaPairRDD<Tuple2<String,String>,Integer> recsWithUnitStrength =
            follows.flatMapToPair(entry -> {
                String user      = entry._1();
                java.util.Set<String> already = new java.util.HashSet<>();
                entry._2().forEach(already::add);

                java.util.List<Tuple2<Tuple2<String,String>,Integer>> out
                        = new java.util.ArrayList<>();

                for (String mid : entry._2()) {
                    Iterable<String> midsFollows =
                            followsMap.getOrDefault(mid, Collections.emptyList());
                    for (String candidate : midsFollows) {
                        if (!candidate.equals(user) && !already.contains(candidate)) {
                            out.add(new Tuple2<>(
                                    new Tuple2<>(user, candidate), 1));
                        }
                    }
                }
                return out.iterator();
            });

        return recsWithUnitStrength.reduceByKey(Integer::sum);
    }

    public List<SerializablePair<String,Integer>> run(boolean debug)
            throws IOException, InterruptedException {

        logger.info("Running FoF recommendations");

		if (appConfig == null) {
            appConfig = new AppConfig(envVars);
        }

        JavaPairRDD<String,String> followerEdges = getFollowerEdges();

        JavaPairRDD<Tuple2<String,String>,Integer> recs =
                followerOfFollowerRecommendations(followerEdges);

        JavaPairRDD<String, Integer> formattedRecs = recs.mapToPair(t -> {
            String src = t._1()._1().substring(1);  
            String dst = t._1()._2().substring(1); 
            return new Tuple2<>(src + "," + dst, t._2());
        });

        writeOutputToMySQL(formattedRecs, spark);

        return new ArrayList<>();
    }
    @Override
    public List<SerializablePair<String,Integer>> call(JobContext arg0)
            throws Exception {
        initialize();          
        return run(false);
    }

    public void writeOutputToMySQL(JavaPairRDD<String, Integer> rdd, SparkSession spark) {
		JavaRDD<Row> rowRDD = rdd.map(pair -> {
            String[] ids = pair._1.split(",");
            int user = Integer.parseInt(ids[0]);
            int recommendation  = Integer.parseInt(ids[1]);
			Integer strength = pair._2;
			return RowFactory.create(user, recommendation, strength);
		});

		StructType schema = new StructType()
			.add("user", DataTypes.IntegerType, false)
			.add("recommendation", DataTypes.IntegerType, false)
            .add("strength", DataTypes.IntegerType, false);

		Dataset<Row> df = spark.createDataFrame(rowRDD, schema);

		df.write()
			.mode(SaveMode.Overwrite)
			.format("jdbc")
			.option("url", appConfig.dbUrl)
			.option("dbtable", "friend_recs")
			.option("user", appConfig.dbUser)
			.option("password", appConfig.dbPassword)
			.save();
	}

}
