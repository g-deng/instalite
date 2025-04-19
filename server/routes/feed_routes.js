/////////////////////////
// Routes for feed management
// intend to move some routes from routes.js to here to keep things organized
// for now just temporary light versions for the demo
////////////////////////

import { get_db_connection } from '../models/rdbms.js';
import { sendPostToKafka, connectProducer } from '../kafka/producer.js';
import { runKafkaConsumer } from '../kafka/consumer.js';
import RouteHelper from '../routes/route_helper.js';

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
        res.status(200).send({results: fixed_result});
    } catch {
        res.status(500).send({error: 'Error querying database'});
    }
}

// POST /createPost
async function createPost(req, res) {
    var image_url = req.body.image_url;
    var text_content = req.body.text_content;
    var hashtags = req.body.hashtags;
    if (title.trim().length == 0 || text_content.trim().length == 0) {
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else if (!helper.isLoggedIn(req, req.params.username)) {
        console.log(req.session);
        res.status(403).send({error: 'Not logged in.'});
    } else {
        try {
            const query = `
                INSERT INTO posts (user_id, image_url, text_content, hashtags) 
                VALUES (?, ?, ?, ?)
            `;
            const params = [req.session.user_id, image_url, text_content, hashtags];
            const result = await queryDatabase(query, params);

            console.log(result);
            const post_id = result[0].insertId;
            console.log(`Post created with ID: ${post_id}`);
            const kafkaPost = {
                post_json: {
                    username: req.session.username,
                    post_text: content,
                    post_uuid_within_site: post_id,
                    content_type: 'text/html',
                    source_site: 'instalite-wahoo',
                }
            };

            await sendPostToKafka(kafkaPost);
            console.log('sent to Kafka');
            console.log(kafkaPost);
            res.status(201).send({message: 'Post created.'});  
        } catch {
            res.status(500).send({error: 'Error querying database'});
        }
    }
}

// POST /createComment
async function createComment(req, res) {
    var post_id = req.body.post_id;
    var text_content = req.body.text_content;

    if (!post_id || !text_content || text_content.trim().length == 0 || post_id.trim().length == 0) {
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else if (!helper.isLoggedIn(req, req.params.username)) {
        console.log(req.session);
        res.status(403).send({error: 'Not logged in.'});
    } else {
        try {
            const query = `
                INSERT INTO comments (post_id, user_id, text_content) 
                VALUES (?, ?, ?)
            `;
            const params = [post_id, req.session.user_id, text_content];
            const result = await queryDatabase(query, params);
            console.log(result);
            res.status(201).send({message: 'Comment created.'});  
        } catch {
            res.status(500).send({error: 'Error querying database'});
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
            const query = `
                INSERT INTO likes (user_id, post_id) 
                VALUES (?, ?)
            `;
            const params = [req.session.user_id, req.body.post_id];
            const result = await queryDatabase(query, params);
            console.log(result);
            res.status(201).send({message: 'Like created.'});  
        } catch {
            return res.status(500).send({error: 'Error querying database'});
        }
    }
}

// GET /feed
async function getFeed(req, res) {
    // TODO: query for posts from self or followed
    if (!helper.isLoggedIn(req, req.params.username)) {
        res.status(403).send({error: 'Not logged in.'});
    } else {
        try {
            console.log('getting feed');
            const query1 = `
            SELECT posts.post_id, users.username, posts.parent_post, posts.title, posts.content 
            FROM posts
            JOIN users ON posts.author_id = users.user_id
            WHERE users.user_id = ?
            `;
            const params1 = [req.session.user_id];
            const result1 = await queryDatabase(query1, params1);

            const query2 = `
            SELECT posts.post_id, u2.username, posts.parent_post, posts.title, posts.content FROM followers
            JOIN users AS u1 ON u1.linked_nconst = followers.follower
            JOIN users AS u2 on u2.linked_nconst = followers.followed
            JOIN posts ON posts.author_id = u2.user_id
            WHERE u1.user_id = ?
            `;
            const params2 = [req.session.user_id];
            const result2 = await queryDatabase(query2, params2);
            const result = [...result1[0], ...result2[0]];
            const fixed_result = result.map(row => ({
                username: row.username,
                parent_post: row.parent_post,
                title: row.title,
                content: row.content
            }));
            res.status(200).send({results: fixed_result});
        } catch {
            res.status(500).send({error: 'Error querying database'});
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