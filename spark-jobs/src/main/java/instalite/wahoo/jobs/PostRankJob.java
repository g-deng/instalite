package instalite.wahoo.jobs;

import java.io.IOException;
import java.util.List;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Objects;

import instalite.wahoo.jobs.utils.FlexibleLogger;
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
import instalite.wahoo.jobs.utils.SerializablePair;
import instalite.wahoo.spark.SparkJob;

import scala.Tuple2;

public class PostRankJob extends SparkJob<List<SerializablePair<String, Double>>> {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;
    
	// Convergence condition variables
	double d_max; // largest change in a node's rank from iteration i to iteration i+1
	int i_max; // max number of iterations

	public PostRankJob(double d_max, int i_max, SparkSession spark, boolean isLocal, boolean debug, FlexibleLogger logger) {
		super(logger, spark, isLocal, debug);
		this.d_max = d_max;
		this.i_max = i_max;
	}

	protected Dataset<Row> queryMySQL(String query) {
		logger.debug("queryMySQL started");
		
		Dataset<Row> df = spark.read()
			.format("jdbc")
			.option("url", appConfig.dbUrl)
			.option("driver", "com.mysql.cj.jdbc.Driver")
			.option("dbtable", "(" + query + ") AS query")
			.option("user", appConfig.dbUser)
			.option("password", appConfig.dbPassword)
			.load();

		logger.debug("queryMySQL completed");
		return df;
	}

	/**
	 * Fetch the nodes of the social network from MySQL via JDBC
	 * u1, u2, ..., un for users
	 * p1, p2, ..., pm for posts
	 * h1, h2, ..., hk for hashtags
	 */
	protected JavaPairRDD<String, Tuple2<String, Double>> getNodes() {
		logger.debug("getNodes started");

		Dataset<Row> user_df = queryMySQL("SELECT user_id FROM users WHERE user_id IS NOT NULL");
		JavaRDD<String> userRDD = user_df.select("user_id").javaRDD().map(row -> "u" + Integer.toString(row.getInt(0)));

		Dataset<Row> hashtags_df = queryMySQL("SELECT hashtags FROM users WHERE hashtags IS NOT NULL");
		JavaRDD<Row> hashtaglistsRDD = hashtags_df.select("hashtags").javaRDD();
		JavaRDD<String> hashtagRDD = hashtaglistsRDD.flatMap(row -> {
			String[] tags = row.getString(0).split(",");
			return Arrays.asList(tags).iterator();
		}).map(tag -> "h"+tag.trim().toLowerCase()).distinct();

		Dataset<Row> posts_df = queryMySQL("SELECT post_id FROM posts WHERE post_id IS NOT NULL");
		JavaRDD<String> postRDD = posts_df.select("post_id").javaRDD().map(row -> "p" + Integer.toString(row.getInt(0)));

		JavaRDD<String> nodesRDD = userRDD.union(postRDD).union(hashtagRDD).distinct();

		JavaPairRDD<String, Tuple2<String, Double>> labelRDD = nodesRDD.cartesian(userRDD)
			.mapToPair(pair -> {
				String v = pair._1(); // node
				String u = pair._2(); // user
				double weight = v.equals(u) ? 1.0 : 0.0;
				return new Tuple2<>(v, new Tuple2<>(u, weight));
			});

		logger.debug("getNodes completed");
		return labelRDD;
	}

	public JavaPairRDD<String, Tuple2<String,Double>> assignEqualWeights(
		JavaPairRDD<String, String> edges, double totalWeightPerSource
	) {
		// Count number of outgoing edges for each source
		JavaPairRDD<String, Integer> outDegree = edges
			.mapToPair(t -> new Tuple2<>(t._1(), 1))
			.reduceByKey(Integer::sum);
		
		// Join edges with their out-degree
		JavaPairRDD<String, Tuple2<String, Integer>> joined = edges.join(outDegree);
		// Result: (source, (target, outDeg))

		// Convert to ((source, target), weight)
		return joined.mapToPair(pair -> {
			String src = pair._1();
			String dst = pair._2()._1();
			int outDeg = pair._2()._2();
			double weight = totalWeightPerSource / outDeg;
			return new Tuple2<>(src, new Tuple2<>(dst, weight));
		});
	}


	/**
	 * Fetch the edges of the social network from MySQL via JDBC
	 * 
	 */
	protected JavaPairRDD<String, Tuple2<String,Double>> getEdges() {
		logger.debug("getSocialNetworkFromMySQL started");

		Dataset<Row> uh_df = queryMySQL("SELECT user_id, hashtags FROM users WHERE user_id IS NOT NULL AND hashtags IS NOT NULL");
		JavaPairRDD<String,String> uhRDD = uh_df
			.select("user_id", "hashtags")
			.javaRDD()
			.flatMapToPair(row -> {
				int userId = row.getInt(0);
				String hashtags = row.getString(1);
				if (hashtags == null || hashtags.isEmpty()) return Collections.emptyIterator();
				String[] tags = hashtags.split(",");
				List<Tuple2<String, String>> pairs = new ArrayList<>();
				for (String tag : tags) {
					pairs.add(new Tuple2<>("u" + userId, "h" + tag.trim()));
				}
				return pairs.iterator();
			});	
		
		Dataset<Row> ph_df = queryMySQL("SELECT post_id, hashtags FROM posts WHERE post_id IS NOT NULL AND hashtags IS NOT NULL");
		JavaPairRDD<String,String> phRDD = ph_df
			.select("post_id", "hashtags")
			.javaRDD()
			.flatMapToPair(row -> {
				int postId = row.getInt(0);
				String[] tags = row.getString(1).split(",");
				List<Tuple2<String, String>> pairs = new ArrayList<>();
				for (String tag : tags) {
					pairs.add(new Tuple2<>("p" + postId, "h" + tag.trim()));
				}
				return pairs.iterator();
			});

		String up_query = "(SELECT user_id, post_id FROM likes WHERE user_id IS NOT NULL AND post_id IS NOT NULL) UNION (SELECT user_id, post_id FROM posts WHERE user_id IS NOT NULL AND post_id IS NOT NULL)";
		Dataset<Row> up_df = queryMySQL(up_query);
		JavaPairRDD<String,String> upRDD = up_df
			.select("user_id", "post_id")
			.javaRDD()
			.flatMapToPair(row -> {
				int userId = row.getInt(0);
				int postId = row.getInt(1);
				return Arrays.asList(new Tuple2<>("u" + userId, "p" + postId)).iterator();
			});

		Dataset<Row> uu_df = queryMySQL("SELECT followed, follower FROM friends WHERE followed IS NOT NULL AND follower IS NOT NULL");
		JavaPairRDD<String,String> uuRDD = uu_df
			.select("followed", "follower")
			.javaRDD()
			.flatMapToPair(row -> {
				int followedId = row.getInt(0);
				int followerId = row.getInt(1);
				return Arrays.asList(new Tuple2<>("u" + followedId, "u" + followerId), new Tuple2<>("u" + followerId, "u" + followedId)).iterator();
			});

		// Weight outgoing edges from users
		JavaPairRDD<String, Tuple2<String,Double>> uh_weightedRDD = assignEqualWeights(uhRDD, 0.3);
		JavaPairRDD<String, Tuple2<String,Double>> up_weightedRDD = assignEqualWeights(upRDD, 0.4);
		JavaPairRDD<String, Tuple2<String,Double>> uu_weightedRDD = assignEqualWeights(uuRDD, 0.3);

		// Weight outgoing edges from hashtags
		JavaPairRDD<String,String> h_outRDD = uhRDD.union(phRDD).mapToPair(Tuple2::swap);
		JavaPairRDD<String, Tuple2<String,Double>> h_weightedRDD = assignEqualWeights(h_outRDD, 1);
		
		// Weight outgoing edges from posts
		JavaPairRDD<String,String> p_outRDD = upRDD.mapToPair(Tuple2::swap).union(phRDD);
		JavaPairRDD<String, Tuple2<String,Double>> p_weightedRDD = assignEqualWeights(p_outRDD, 1);

		logger.debug("getEdges completed");
		return uh_weightedRDD
			.union(up_weightedRDD)
			.union(uu_weightedRDD)
			.union(h_weightedRDD)
			.union(p_weightedRDD);
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
		// (u, (v, weight))
		JavaPairRDD<String, Tuple2<String, Double>> edgeRDD = getEdges();

		// (u, (v, weight))
		// u: node, v: user
		JavaPairRDD<String, Tuple2<String, Double>> labelRDD = getNodes();


		// long labels = labelRDD.count();
		// long edges = edgeRDD.distinct().count();
		// logger.info("This graph contains " + labels + " labels and " + edges + " edges.");

		double d = d_max;
		int i = 0; // completed rounds
		logger.info("Starting postRank iterations");
		while (i <= i_max && d >= d_max) {
			i += 1; // current round

			// L(u, v) = weight of label v on node u
			// L(u, v) = sum for each x -> u: w(x, u) * L(x, v)
			JavaPairRDD<String, Tuple2<String, Double>> newLabelRDD = edgeRDD.join(labelRDD) // (x, ((u, w), (v, L))
				.mapToPair(pair -> {
					String u = pair._2()._1()._1();
					double w = pair._2()._1()._2();
					String v = pair._2()._2()._1();
					double L = pair._2()._2()._2();
					return new Tuple2<>(new Tuple2<>(u, v), w * L);
				}) // ((u, v), w * L)
				.reduceByKey((v1, v2) -> v1 + v2) // ((u, v), L(u, v))
				.mapToPair(pair -> {
					String u = pair._1()._1();
					String v = pair._1()._2();
					double L = pair._2();
					return new Tuple2<>(u, new Tuple2<>(v, L));
				}); // (u, (v, L(u, v)))

			
			// calculate L1 norms
			JavaPairRDD<String, Double> l1Norms = newLabelRDD
				.mapToPair(entry -> new Tuple2<>(entry._1, entry._2._2))
				.reduceByKey(Double::sum);
			
			// normalize
			newLabelRDD = newLabelRDD
				.join(l1Norms) // (u, ((v, L(u, v)), L1(u)))
				.mapToPair(pair -> {
					String u = pair._1();
					String v = pair._2()._1()._1();
					double L = pair._2()._1()._2();
					double L1 = pair._2()._2();
					if (u.charAt(0) == 'u') {
						int uid = Integer.parseInt(u.substring(1));
						int vid = Integer.parseInt(v.substring(1));
						if (v.charAt(0) == 'u' && uid == vid) {
							return new Tuple2<>(u, new Tuple2<>(v, 1.0));
						} else {
							return new Tuple2<>(u, new Tuple2<>(v, 0.0));
						}
					}
					if (L1 > 0) return new Tuple2<>(u, new Tuple2<>(v, L / L1));
					else return new Tuple2<>(u, new Tuple2<>(v, L));
				});
			
			double d_new = newLabelRDD
				.join(labelRDD) // (u, ((v, L(u, v)), (v, L(u, v))))
				.filter(pair -> pair._2()._1()._1().equals(pair._2()._2()._1()))
				.mapToPair(pair -> {
					String u = pair._1();
					double L_new = pair._2()._1()._2();
					double L_old = pair._2()._2()._2();
					return new Tuple2<>(u, Math.abs(L_new - L_old));
				})
				.aggregate(0.0, (agg, pair) -> Math.max(agg, pair._2()), (agg1, agg2) -> Math.max(agg1, agg2));
			
			d = d_new;
			logger.info("Iteration " + i + " completed with d = " + d);
			labelRDD = newLabelRDD;
		}

		logger.info("postRank interative calculations complete.");

		// Filter out labels with 0 weight
		labelRDD = labelRDD.filter(pair -> pair._2()._2() != 0.0).distinct();

		writeOutputToMySQL(labelRDD);

		// SOMEHOW NOT SERIALIZABLE BUT ITS OKAY BECAUSE WE WRITE DIRECTLY TO RDS
		// List<SerializablePair<String, Double>> out = labelRDD
		// 	.map(pair -> new SerializablePair<>(pair._1() + " " + pair._2()._1(), pair._2()._2()))
		// 	.take(10);

		logger.info("PostRankJob run complete");

		return new ArrayList<>();
	}

	@Override
	public List<SerializablePair<String, Double>> call(JobContext arg0) throws Exception {
		initialize();
		return run(false);
	}

	public void writeOutputToMySQL(JavaPairRDD<String, Tuple2<String,Double>> outputRDD) {
        // Split into post_weights and friend_recs entries
        JavaRDD<Row> postRows = outputRDD.map(tuple -> {
			String node = tuple._1;
			String user = tuple._2._1;
            char nodeType = node.charAt(0);
            char userType = user.charAt(0);
            if (nodeType != 'p' || userType != 'u') return null;

            int postId = Integer.parseInt(node.substring(1));
            int userId = Integer.parseInt(user.substring(1));
            double weight = tuple._2._2;
            return RowFactory.create(postId, userId, weight);

        }).filter(Objects::nonNull);

        JavaRDD<Row> friendRows = outputRDD.map(tuple -> {
			String node = tuple._1;
			String user = tuple._2._1;

            char nodeType = node.charAt(0);
            char userType = user.charAt(0);
            if (nodeType != 'u' || userType != 'u') return null;

            int userId = Integer.parseInt(node.substring(1));
            int recId = Integer.parseInt(user.substring(1));
            if (userId == recId) return null; // skip self-recs
            double strength = tuple._2._2;
            return RowFactory.create(userId, recId, strength);
        }).filter(Objects::nonNull);

        // Schemas
        StructType postSchema = new StructType()
            .add("post_id", DataTypes.IntegerType)
            .add("user_id", DataTypes.IntegerType)
            .add("weight", DataTypes.DoubleType);

        StructType friendSchema = new StructType()
            .add("user", DataTypes.IntegerType)
            .add("recommendation", DataTypes.IntegerType)
            .add("strength", DataTypes.DoubleType);

        // Create DataFrames
        Dataset<Row> postDF = spark.createDataFrame(postRows, postSchema);
        Dataset<Row> friendDF = spark.createDataFrame(friendRows, friendSchema);

        // Clear the target tables
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                appConfig.dbUrl, appConfig.dbUser, appConfig.dbPassword);
             java.sql.Statement stmt = conn.createStatement()
        ) {
            stmt.executeUpdate("DELETE FROM post_weights");
            stmt.executeUpdate("DELETE FROM friend_recs");
        } catch (Exception e) {
            System.err.println("Failed to clear MySQL tables: " + e.getMessage());
        }

        // Write DataFrames to MySQL via JDBC
        postDF.write()
            .mode(SaveMode.Overwrite)
            .format("jdbc")
            .option("url", appConfig.dbUrl)
            .option("dbtable", "post_weights")
            .option("user", appConfig.dbUser)
            .option("password", appConfig.dbPassword)
            .save();

        friendDF.write()
            .mode(SaveMode.Overwrite)
            .format("jdbc")
            .option("url", appConfig.dbUrl)
            .option("dbtable", "friend_recs")
            .option("user", appConfig.dbUser)
            .option("password", appConfig.dbPassword)
            .save();
    }

}