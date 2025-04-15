/////////////////////////
// Routes for feed management
// intend to move some routes from routes.js to here to keep things organized
// for now just temporary light versions for the demo
////////////////////////

import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';

// Database connection setup
const db = get_db_connection();

var helper = new RouteHelper();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}


// POST /createPost
async function createPost(req, res) {
    // TODO: add post to database
    var title = req.body.title;
    var content = req.body.content;
    var parent_id = req.body.parent_id;
    if (title.trim().length == 0 || content.trim().length == 0) {
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'});
    } else if (!helper.isLoggedIn(req, req.params.username)) {
        console.log(req.session);
        res.status(403).send({error: 'Not logged in.'});
    } else {
        try {
            const query = `
            INSERT INTO posts (parent_post, title, content, author_id) VALUES (?, ?, ?, ?)
            `;
            const params = [parent_id, title, content, req.session.user_id];
            await queryDatabase(query, params);
            res.status(201).send({message: 'Post created.'});  
        } catch (error) {
            res.status(500).send({error: 'Error querying database'});
        }
    }
}

// GET /feed
async function getFeed(req, res) {
    // TODO: query for posts from self or followed
    if (!helper.isLoggedIn(req, req.session.user_id)) {
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
        } catch (error) {
            res.status(500).send({error: 'Error querying database'});
        }
    }
}

export {
    createPost,
    getFeed
};