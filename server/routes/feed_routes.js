/////////////////////////
// Routes for feed management
// intend to move some routes from routes.js to here to keep things organized
// for now just temporary light versions for the demo
////////////////////////

import { get_db_connection } from '../models/rdbms.js';
import { sendPostToKafka, connectProducer } from '../kafka/producer.js';
import { runKafkaConsumer } from '../kafka/consumer.js';
import RouteHelper from '../routes/route_helper.js';
import S3KeyValueStore from '../models/s3.js';

// Database connection setup
const db = get_db_connection();
// Connect to Kafka producer and run the consumer
await connectProducer();
await runKafkaConsumer();

var helper = new RouteHelper();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

async function getKafkaDemo(req, res) {
    const topic = req.params.topic;
    console.log(`Topic: ${topic}`);
    try {
        const idQuery = `SELECT user_id FROM users WHERE username = ?`;
        const result = await queryDatabase(idQuery, [topic]);
        const user_id = result[0][0].user_id;
        console.log(`User ID: ${user_id}`);
        const query1 = `
            SELECT posts.post_id, users.username, posts.parent_post, posts.title, posts.content 
            FROM posts
            JOIN users ON posts.author_id = users.user_id
            WHERE users.user_id = ?
            ORDER BY posts.post_id DESC
            LIMIT 1000
        `;
        const postsResult = await queryDatabase(query1, [user_id]);
        const posts = postsResult[0];
        console.log(posts.length);
        const fixed_result = posts.map(row => ({
            username: row.username,
            parent_post: row.parent_post,
            title: row.title,
            content: row.content
        }));
        return res.status(200).send({results: fixed_result});
    } catch {
        return res.status(500).send({error: 'Error querying database'});
    }
}

// POST /createPost
async function createPost(req, res) {
    var file = req.file;
    var s3_key = req.body.s3_image_path;
    var text_content = req.body.text_content;
    var hashtags = req.body.hashtags; //  a comma seperated string
    var content_type = 'text/html';

    if (!helper.isLoggedIn(req, req.params.username)) {
        console.log(req.session);
        return res.status(403).send({error: 'Not logged in.'});
    } else if (!text_content || text_content.trim().length == 0 || !helper.isOK(text_content)) {
        return res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else {
        try {
            let image_url = null;
            if (file || s3_key) {
                const bucketName = `nets2120-chroma-${process.env.USER_ID}`;
                // Construct the public URL
                image_url = `https://${bucketName}.s3.amazonaws.com/${s3_key}`;
                content_type = file.mimetype;
            }
            console.log('Inserting post into database with image_url:', image_url);
            const query = `
                INSERT INTO posts (user_id, image_url, text_content, hashtags) 
                VALUES (?, ?, ?, ?)
            `;
            const params = [req.session.user_id, image_url, text_content, hashtags];
            const result = await queryDatabase(query, params);

            console.log(result);
            const post_id = result[0].insertId;
            console.log(`Post created with ID: ${post_id}`);

            // TODO: attachments 
            /* 
            const kafkaPost = {
                post_json: {
                    username: req.session.username,
                    post_text: text_content,
                    post_uuid_within_site: post_id,
                    content_type: content_type,
                    source_site: 'instalite-wahoo',
                }
            }; */

            const post_json = {
                username: req.session.username,
                post_text: text_content,
                post_uuid_within_site: post_id,
                content_type: content_type,
                source_site: 'instalite-wahoo',
            };

            if (image_url) {
                post_json.attach = { url: image_url, content_type: content_type };
                console.log('Added attach to postJson:', post_json.attach);
            }

            await sendPostToKafka({post_json: post_json});
            console.log('sent to Kafka');
            console.log(post_json);
            return res.status(201).send({message: 'Post created.'});  
        } catch {
            return res.status(500).send({error: 'Error querying database'});
        }
    }
}

// POST /createComment
async function createComment(req, res) {
    var post_id = req.body.post_id;
    var parent_id = req.body.parent_id;
    var text_content = req.body.text_content;

    if (!post_id || !text_content || text_content.trim().length == 0) {
        return res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else if (!helper.isLoggedIn(req, req.params.username)) {
        console.log(req.session);
        return res.status(403).send({error: 'Not logged in.'});
    } else {
        console.log(post_id, parent_id, text_content);
        try {
            const query = `
                INSERT INTO comments (post_id, parent_id, user_id, text_content) 
                VALUES (?, ?, ?, ?)
            `;
            const params = [post_id, parent_id, req.session.user_id, text_content];
            const result = await queryDatabase(query, params);
            console.log(result);
            return res.status(201).send({message: 'Comment created.'});  
        } catch (err) {
            console.error("ERROR:", err);
            return res.status(500).send({error: 'Error querying database'});
        }
    }

}

// POST /createLike
async function createLike(req, res) {
    if (!helper.isLoggedIn(req, req.params.username)) {
        return res.status(403).send({error: 'Not logged in.'});
    } else if (!req?.body?.post_id) {
        return res.status(400).send({error: 'Post ID is required.'});
    } else {
        try {
            const checkIfLiked = `
                SELECT * FROM likes
                WHERE user_id = ? AND post_id = ?
            `;
            const params = [req.session.user_id, req.body.post_id];
            const checkResult = await queryDatabase(checkIfLiked, params);
            console.log(checkResult);
            if (checkResult[0].length > 0) {
                const deleteLikeQuery = `
                    DELETE FROM likes
                    WHERE user_id = ? AND post_id = ?
                `;
                await queryDatabase(deleteLikeQuery, params);
            } else {
                const createLikeQuery = `
                    INSERT INTO likes (user_id, post_id) 
                    VALUES (?, ?)
                `;
                console.log('creating like');
                await queryDatabase(createLikeQuery, params);
                console.log('like created');
            }
            return res.status(201).send({message: 'Like created.'});  
        } catch {
            return res.status(500).send({error: 'Error querying database'});
        }
    }
}

// GET /feed
async function getFeed(req, res) {
    // TODO: query for posts from self or followed
    if (!helper.isLoggedIn(req, req.params.username)) {
        return res.status(403).send({error: 'Not logged in.'});
    } else {
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = parseInt(req.query.offset, 10) || 0;
        try {
            console.log('getting feed');
            const query = `
                WITH post_comments AS (
                    SELECT posts.post_id, GROUP_CONCAT(CONCAT(c_users.username, ':', comments.comment_id, ':', comments.parent_id, ':', comments.text_content) SEPARATOR ',') AS comments
                    FROM posts
                    LEFT JOIN comments
                    ON posts.post_id = comments.post_id
                    LEFT JOIN users AS c_users
                    ON comments.user_id = c_users.user_id
                    GROUP BY posts.post_id
                )
                SELECT ANY_VALUE(users.username) AS username, ANY_VALUE(posts.image_url) AS image_url, ANY_VALUE(posts.text_content) AS text_content, ANY_VALUE(posts.hashtags) AS hashtags, posts.source,
                    COUNT(likes.user_id) AS likes, 
                    ANY_VALUE(post_comments.comments) AS comments,
                    ANY_VALUE(post_weights.weight) AS weight, posts.post_id
                FROM post_weights
                    JOIN posts 
                    ON post_weights.post_id = posts.post_id
                    JOIN users
                    ON posts.user_id = users.user_id
                    JOIN users AS cu ON cu.user_id = ? 
                    LEFT JOIN friends
                        ON friends.follower = cu.user_id AND friends.followed = users.user_id
                    LEFT JOIN likes
                    ON posts.post_id = likes.post_id
                    LEFT JOIN post_comments
                    ON posts.post_id = post_comments.post_id
                WHERE (
                    users.user_id = cu.user_id OR friends.followed IS NOT NULL OR (
                        cu.hashtags IS NOT NULL
                        AND posts.hashtags IS NOT NULL
                        AND posts.hashtags REGEXP CONCAT(
                            '(^|,)',
                            REPLACE(cu.hashtags, ',', '($|,)|(^|,)'),
                            '($|,)'
                        )
                    ) OR posts.source = 'FederatedPosts'
                )
                GROUP BY posts.post_id
                ORDER BY weight DESC
                LIMIT ? OFFSET ?;
            `;

            const params = [req.session.user_id, limit, offset];
            const result = await queryDatabase(query, params);
            console.log(result);
            // TODO: decide on what to do with empty queries
            if (result[0].length == 0) {
                return res.status(200).send({results: []});
            }
            const parsed_result = result[0].map(row => ({
                username: row.username,
                image_url: row.image_url,
                text_content: row.text_content,
                hashtags: row.hashtags,
                likes: row.likes,
                comments: row.comments ? row.comments.split(',').map(comment => {
                    const [username, comment_id, parent_id, text_content] = comment.split(':');
                    return {username, comment_id:  Number(comment_id), parent_id: Number(parent_id), text_content};
                }) : [],
                weight: row.weight,
                post_id: row.post_id,
            }));
            return res.status(200).send({results: parsed_result, hasMore: result[0].length === limit});
        } catch (err) {
            console.error(err);
            return res.status(500).send({error: 'Error querying database'});
        }
    }
}

export {
    createPost,
    createComment,
    createLike,
    getFeed,
    getKafkaDemo
};