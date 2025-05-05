package instalite.wahoo.jobs;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;

import instalite.wahoo.config.AppConfig;
import instalite.wahoo.jobs.utils.FlexibleLogger;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.RowFactory;
import org.apache.spark.sql.SaveMode;
import org.apache.spark.sql.types.DataTypes;
import org.apache.spark.sql.types.StructType;

import instalite.wahoo.jobs.utils.SerializablePair;
import instalite.wahoo.spark.SparkJob;

import scala.Tuple2;

public class SocialRankJob extends SparkJob<List<SerializablePair<String, Double>>> {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	boolean useBacklinks;
	// Convergence condition variables
	double d_max; // largest change in a node's rank from iteration i to iteration i+1
	int i_max; // max number of iterations
	

	public SocialRankJob(double d_max, int i_max, SparkSession spark, boolean useBacklinks, boolean isLocal, boolean debug, FlexibleLogger logger) {
		super(logger, spark, isLocal, debug); 
        this.useBacklinks = useBacklinks;
        this.d_max = d_max;
        this.i_max = i_max;
    }

	/**
 * Fetch the social network from MySQL via JDBC, and create a (followed, follower) edge graph
 * 
 * @return JavaPairRDD: (followed: String, follower: String)
 */
protected JavaPairRDD<String, String> getSocialNetworkFromMySQL() {
    logger.debug("getSocialNetworkFromMySQL started");
    Dataset<Row> df = spark.read()
        .format("jdbc")
        .option("url", appConfig.dbUrl)
        .option("driver", "com.mysql.cj.jdbc.Driver")
        .option("dbtable", "friends")
        .option("user", appConfig.dbUser)
        .option("password", appConfig.dbPassword)
        .load();


    // Assuming table schema: followed, follower
    JavaRDD<Row> rowRDD = df.select("user1_id", "user2_id").javaRDD();

    JavaPairRDD<String, String> network = rowRDD.mapToPair(row -> {
        String followed = Integer.toString(row.getInt(0));
        String follower = Integer.toString(row.getInt(1));
        return new Tuple2<>(followed, follower);
    }).distinct();

    logger.debug("getSocialNetworkFromMySQL completed");
    return network;
}

	/**
	 * Retrieves the sinks from the given network.
	 *
	 * @param network the input network represented as a JavaPairRDD
	 * @return a JavaRDD containing the nodes with no outgoing edges (sinks)
	 */
	protected JavaRDD<String> getSinks(JavaPairRDD<String, String> network) {
        // find nodes that are destinations but not sources, i.e., they are sinks
		// (followed, follower)
		logger.debug("lemon getting sinks");
		JavaRDD<String> followeds = network.keys().distinct();
		JavaRDD<String> followers = network.values().distinct();
		return followeds.subtract(followers);
	}

	/**
	 * 
	 * Main functionality in the program: read and process the social network
	 * Runs the SocialRankJob and returns a list of the top 10 nodes with the highest SocialRank values.
	 *
	 * @param debug a boolean indicating whether to enable debug mode
	 * @return a list of SerializablePair objects representing the top 10 nodes with their corresponding SocialRank values
	 * @throws IOException if there is an error reading the social network file
	 * @throws InterruptedException if the execution is interrupted
	 */
	public List<SerializablePair<String, Double>> run(boolean debug) throws IOException, InterruptedException {
		logger.info("Running");
		
		if (appConfig == null) appConfig = new AppConfig(envVars);

		// Load the social network, aka. the edges (followed, follower)
		JavaPairRDD<String, String> edgeRDD = getSocialNetworkFromMySQL();
		
		// Find the sinks in edgeRDD as an RDD
		JavaRDD<String> sinks = getSinks(edgeRDD);
		logger.info("There are " + sinks.count() + " sinks");

		JavaPairRDD<String, Double> nodeRDD = edgeRDD.keys().union(edgeRDD.values()).distinct().mapToPair((s) -> new Tuple2<>(s, 0.0));
		long nodes = nodeRDD.count();
		long edges = edgeRDD.distinct().count();
		logger.info("This graph contains " + nodes + " nodes and " + edges + " edges.");

		if (this.useBacklinks) {
			JavaPairRDD<String, String> sinksPair = sinks.mapToPair((s) -> new Tuple2<>(s, null));
			JavaPairRDD<String, String> backlinkRDD = edgeRDD.join(sinksPair).mapToPair((pair) -> new Tuple2<>(pair._2._1, pair._1));
			edgeRDD = edgeRDD.union(backlinkRDD);
			logger.info("Added " + backlinkRDD.count() + " backlinks");
			logger.debug(backlinkRDD.collect().toString());
			logger.debug(edgeRDD.collect().toString());
		}

		// sum all following relationships for each node
		JavaPairRDD<String, Integer> numFollowedRDD = edgeRDD.mapToPair((edge) -> new Tuple2<>(edge._2, 1)).reduceByKey((v1, v2) -> v1 + v2);
		// (follower, followed)
		JavaPairRDD<String, String> followerFollowedRDD = edgeRDD.mapToPair((edge) -> new Tuple2<>(edge._2, edge._1));

		JavaPairRDD<String, Double> socialRankRDD = nodeRDD.mapToPair((pair) -> new Tuple2<>(pair._1, 1.0));
		double decay = 0.15;
		double d = d_max;
		int i = 0; // completed rounds
		logger.info("Starting socialRank iterations");
		while (i <= i_max && d >= d_max) {
			i += 1; // current round

			// rank sent by each node to (followed, amt) not considering decay
			// after joins: (follower, ((followed, numFollowed), followerRank)) 
			// goal: amt = followerRank / numFollowed
			JavaPairRDD<String, Double> sentRankRDD = followerFollowedRDD.join(numFollowedRDD).join(socialRankRDD)
				.mapToPair((pair) -> new Tuple2<>(pair._2._1._1, pair._2._2 / pair._2._1._2));

			// rank received by each node in total not considering decay
			JavaPairRDD<String, Double> totalSentRankRDD = sentRankRDD.reduceByKey((v1, v2) -> v1 + v2);

			// final rank considering decay
			JavaPairRDD<String, Double> nextSocialRankRDD = totalSentRankRDD
				.mapToPair((pair) -> new Tuple2<>(pair._1, decay + (1 - decay) * pair._2));
			nextSocialRankRDD = nodeRDD.leftOuterJoin(nextSocialRankRDD).mapToPair(pair -> new Tuple2<>(pair._1, pair._2._2.orElse(0.0)));

			// after join: (node, (socialRank, nextSocialRank)
			// goal: (node, |socialRank - nextSocialRank|)	
			JavaPairRDD<String, Double> differencesRDD = socialRankRDD.join(nextSocialRankRDD)
			 .mapToPair((pair) -> new Tuple2<>(pair._1, Math.abs(pair._2._1 - pair._2._2)));
			
			socialRankRDD = nextSocialRankRDD;
			d = differencesRDD.values().reduce(Math::max);
			if (debug) {
				logger.debug("*** Social network ranking ***");
				for (Tuple2<String, Double> pair : socialRankRDD.collect()) {
					logger.debug(pair._1 + " " + pair._2);
				}
			}
			logger.info("iteration: " + (i) + ", max diff this iteration: " + d);
		}

		logger.info("socialRank interative calculations complete.");
		writeOutputToMySQL(socialRankRDD, spark);
		List<Tuple2<String, Double>> top10 = socialRankRDD.mapToPair(x->x.swap()).sortByKey(false).mapToPair(x->x.swap()).take(10);
		List<SerializablePair<String, Double>> out = new LinkedList<>();
		for (Tuple2<String, Double> entry : top10) {
			out.add(new SerializablePair<>(entry._1, entry._2));
		}

		logger.info("SocialRankJob run complete");
		return out;
	}

	@Override
	public List<SerializablePair<String, Double>> call(JobContext arg0) throws Exception {
		initialize();
		return run(false);
	}

	public void writeOutputToMySQL(JavaPairRDD<String, Double> rdd, SparkSession spark) {
		JavaRDD<Row> rowRDD = rdd.map(pair -> {
			int userId = Integer.parseInt(pair._1());
			double rank = pair._2();
			return RowFactory.create(userId, rank);
		});

		StructType schema = new StructType()
			.add("user_id", DataTypes.IntegerType, false)
			.add("social_rank", DataTypes.DoubleType, false);

		Dataset<Row> df = spark.createDataFrame(rowRDD, schema);

		df.write()
			.mode(SaveMode.Overwrite)
			.format("jdbc")
			.option("url", appConfig.dbUrl)
			.option("dbtable", "social_rank")
			.option("user", appConfig.dbUser)
			.option("password", appConfig.dbPassword)
			.save();
	}


}