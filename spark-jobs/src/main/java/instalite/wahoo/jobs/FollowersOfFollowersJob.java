// package instalite.wahoo.jobs;

// import java.io.IOException;
// import java.util.ArrayList;
// import java.util.Collections;
// import java.util.List;

// import org.apache.livy.JobContext;
// import org.apache.spark.api.java.JavaPairRDD;
// import org.apache.spark.api.java.JavaRDD;
// import org.apache.spark.sql.Dataset;
// import org.apache.spark.sql.Row;
// import org.apache.spark.sql.SparkSession;

// import instalite.wahoo.config.Config;
// import instalite.wahoo.jobs.utils.SerializablePair;
// import instalite.wahoo.spark.SparkJob;
// import instalite.wahoo.jobs.utils.FlexibleLogger;   

// import scala.Tuple2;

// public class FollowersOfFollowersJob
//         extends SparkJob<List<SerializablePair<String, Integer>>> {

//     private static final long serialVersionUID = 1L;

//     public FollowersOfFollowersJob(SparkSession spark,
//                                       boolean      isLocal,
//                                       boolean      debug,
//                                       FlexibleLogger logger,
//                                       Config       config) {
//         super(logger, config, spark, isLocal, debug);
//     }

//     protected Dataset<Row> queryMySQL(String query) {
//         return spark.read()
//             .format("jdbc")
//             .option("url",      Config.DATABASE_CONNECTION)
//             .option("driver",   "com.mysql.cj.jdbc.Driver")
//             .option("dbtable",  "(" + query + ") AS q")
//             .option("user",     Config.DATABASE_USERNAME)
//             .option("password", Config.DATABASE_PASSWORD)
//             .load();
//     }

//     protected JavaPairRDD<String,String> getFollowerEdges() {
//         logger.debug("getFollowerEdges started");

//         Dataset<Row> df = queryMySQL(
//                 "SELECT followed , follower "
//               + "FROM friends "
//               + "WHERE followed IS NOT NULL "
//               + "  AND follower IS NOT NULL");

//         JavaPairRDD<String,String> edges = df
//             .select("followed","follower")
//             .javaRDD()
//             .mapToPair(r -> new Tuple2<>(
//                     "u" + r.getInt(0),   
//                     "u" + r.getInt(1)));

//         logger.debug("getFollowerEdges completed");
//         return edges;
//     }

//     protected JavaPairRDD<Tuple2<String,String>,Integer>
//     followerOfFollowerRecommendations(JavaPairRDD<String,String> network) {

//         JavaPairRDD<String,String> byFollower = network.mapToPair(
//                 t -> new Tuple2<>(t._2(), t._1()));

//         JavaPairRDD<String, Iterable<String>> follows =
//                 byFollower.groupByKey().cache();

//         java.util.Map<String, Iterable<String>> followsMap =
//                 follows.collectAsMap();

//         JavaPairRDD<Tuple2<String,String>,Integer> recsWithUnitStrength =
//             follows.flatMapToPair(entry -> {
//                 String user      = entry._1();
//                 java.util.Set<String> already = new java.util.HashSet<>();
//                 entry._2().forEach(already::add);

//                 java.util.List<Tuple2<Tuple2<String,String>,Integer>> out
//                         = new java.util.ArrayList<>();

//                 for (String mid : entry._2()) {
//                     Iterable<String> midsFollows =
//                             followsMap.getOrDefault(mid, Collections.emptyList());
//                     for (String candidate : midsFollows) {
//                         if (!candidate.equals(user) && !already.contains(candidate)) {
//                             out.add(new Tuple2<>(
//                                     new Tuple2<>(user, candidate), 1));
//                         }
//                     }
//                 }
//                 return out.iterator();
//             });

//         return recsWithUnitStrength.reduceByKey(Integer::sum);
//     }

//     public List<SerializablePair<String,Integer>> run(boolean debug)
//             throws IOException, InterruptedException {

//         logger.info("Running FoF recommendations");

//         JavaPairRDD<String,String> followerEdges = getFollowerEdges();

//         JavaPairRDD<Tuple2<String,String>,Integer> recs =
//                 followerOfFollowerRecommendations(followerEdges);


//         return recs.map(t -> {
//             String src = t._1()._1().substring(1);  
//             String dst = t._1()._2().substring(1);  
//             return new SerializablePair<>(src + "," + dst, t._2());
//         })
//         .collect();
//     }
//     @Override
//     public List<SerializablePair<String,Integer>> call(JobContext arg0)
//             throws Exception {
//         initialize();          
//         return run(false);
//     }
// }
