import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { OpenAIEmbeddings } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import {
    RunnableSequence,
    RunnablePassthrough,
} from '@langchain/core/runnables';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import S3KeyValueStore from '../models/s3.js';
import FaceEmbed from '../algorithms/face_embed.js';

import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';

import bcrypt from 'bcrypt';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { sendPostToKafka } from '../kafka/producer.js';

// Database connection setup
const db = get_db_connection();

const face = new FaceEmbed();
await face.loadModel();

var helper = new RouteHelper();

var vectorStore = null;

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

function getHelloWorld(req, res) {
    res.status(200).send({ message: 'Hello, world!' });
}

async function getVectorStore() {
    if (vectorStore == null) {
        vectorStore = await Chroma.fromExistingCollection(
            new OpenAIEmbeddings(),
            {
                collectionName: 'indexedData', //imdb_reviews2
                url: 'http://localhost:8000', // Optional, will default to this value
            }
        );
    } else console.log('Vector store already initialized');
    return vectorStore;
}

// GET for online users
async function getOnlineUsers(req, res) {
    try {
        const [rows] = await queryDatabase('SELECT user_id FROM online_users');
        const users = rows.map((r) => r.user_id);
        res.json({ results: users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'could not fetch online users' });
    }
}

// POST /register
async function postRegister(req, res) {
    const user = req.body.username;
    const raw_pass = req.body.password;
    const first_name = req.body.first_name || '';
    const last_name = req.body.last_name || '';
    const birthday = req.body.birthday || '';
    const email = req.body.email || '';
    const affiliation = req.body.affiliation || '';
    const hashtags = req.body.hashtags || '';

    if (
        !user ||
        user.trim().length == 0 ||
        !raw_pass ||
        raw_pass.trim().length == 0
    ) {
        console.log('Invalid values in the request');
        res.status(400).send({
            error: 'One or more of the required fields (username, password) was empty or invalid.',
        });
    } else {
        console.debug('Checking if user exists');

        try {
            const exist_query = 'SELECT * FROM users WHERE username = ?';
            const exist_params = [user];
            const result = await queryDatabase(exist_query, exist_params);
            if (result[0].length > 0) {
                console.log(result[0]);
                res.status(409).send({
                    error: 'An account with this username already exists, please try again.',
                });
            } else {
                console.log('Creating user');
                const password = await helper.encryptPassword(raw_pass);
                const query =
                    'INSERT INTO users (username, hashed_password, first_name, last_name, birthday, email, affiliation, hashtags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                const params = [
                    user,
                    password,
                    first_name,
                    last_name,
                    birthday,
                    email,
                    affiliation,
                    hashtags,
                ];
                const result = await queryDatabase(query, params);
                console.log(result);
                const user_id_query =
                    'SELECT user_id FROM users WHERE username = ?';
                const user_id_params = [user];
                const user_id_result = await queryDatabase(
                    user_id_query,
                    user_id_params
                );
                req.session.username = user;
                req.session.user_id = user_id_result[0][0].user_id;
                console.log('User registered successfully');
                console.log(req.session);
                res.status(200).send({
                    message: `{username: '${user}', user_id: '${user_id_result[0][0].user_id}'}`,
                });
            }
        } catch (error) {
            res.status(500).send({
                error: 'An error occurred while registering the user, please try again.',
            });
        }
    }
}

// POST /login
async function postLogin(req, res) {
    console.log(req.body);
    var username = req.body.username;
    var plain_password = req.body.password;
    console.log('Logging in user: ' + username);

    // TODO: check if user exists
    // then match password. If appropriate, set session
    if (
        username.trim().length == 0 ||
        plain_password.trim().length == 0 ||
        !helper.isOK(username)
    ) {
        console.log('Invalid values in the request');
        res.status(400).send({
            error: 'One or more of the fields you entered was empty, please try again.',
        });
    } else {
        try {
            const query = 'SELECT * FROM users WHERE username = ?';
            const params = [username];
            console.log('hi');
            const result = await queryDatabase(query, params);
            console.log(result);
            if (result[0].length > 0) {
                const user = result[0][0];
                const match = await bcrypt.compare(
                    plain_password,
                    user.hashed_password
                );
                if (!match) {
                    res.status(401).send({
                        error: 'Username and/or password are invalid.',
                    });
                } else {
                    req.session.username = username;
                    req.session.user_id = user.user_id;
                    res.status(200).send({
                        message: `{username: '${username}', user_id: '${user.user_id}'}`,
                    });
                }
            } else {
                res.status(401).send({
                    error: 'Username and/or password are invalid.',
                });
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: 'Error querying database' });
        }
    }
}

// GET /logout
function postLogout(req, res) {
    req.session.user_id = null;
    res.status(200).send({ message: 'You were successfully logged out.' });
}

async function getMovie(req, res) {
    console.log('Getting movie database');
    const vs = await getVectorStore();
    console.log('Connected...');
    const retriever = vs.asRetriever();
    console.log('Ready to run RAG chain...');

    const prompt = PromptTemplate.fromTemplate(
        `Answer the question based on the following context: {context}\n\nQuestion: {question}`
    );
    const llm = new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0 });

    const ragChain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
        },
        prompt,
        llm,
        new StringOutputParser(),
    ]);

    console.log(req.body.question);

    const result = await ragChain.invoke(req.body.question);
    console.log(result);
    res.status(200).send({ message: result });
}

async function uploadImage(req, res) {
    const bucketName = 'nets2120-chroma-' + process.env.USER_ID;
    const s3_user = new S3KeyValueStore(bucketName, 'user');

    try {
        // Check if a file is provided
        if (!req.file) {
            return res.status(400).send({ error: 'No file uploaded.' });
        }

        const file = req.file;

        // Generate a unique file name
        const filePath = file.path;
        const keyPrefix = 'uploads/';

        // Upload the file to S3
        const key = await s3_user.uploadFile(filePath, bucketName, keyPrefix);
        if (!key) {
            return res
                .status(500)
                .send({ error: 'Failed to upload file to S3.' });
        }

        console.log(`Image uploaded to S3: ${filePath}`);

        const file_obj = await s3_user.convertFileToBinary(
            filePath,
            bucketName,
            keyPrefix
        );
        const embeddings = await face.getEmbeddingsFromBuffer(file_obj);
        const embedding = embeddings[0];

        res.status(200).send({
            message: `Image uploaded successfully to ${filePath}`,
            embedding: embedding,
            key: key,
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).send({
            error: 'An error occurred while uploading the image.',
        });
    }
}

async function selectPhoto(req, res) {
    const user_id = req.session.user_id;
    const username = req.session.username;
    const image_path = req.body.image_path;
    const actor_name = req.body.actor_name;
    const actor_nconst = req.body.actor_nconst;

    const sql_command = 'UPDATE users SET profile_photo = ?, linked_nconst = ? WHERE user_id = ?';
    const sql_params = [image_path, actor_nconst, user_id];
    try {
        const result = await queryDatabase(sql_command, sql_params);
        if (result[0].affectedRows == 0) {
            return res.status(404).send({ error: 'User not found.' });
        } else {
            // create a status post about actor change
            if (actor_name) {
                const text_content = `${username} is now linked to ${actor_name}`;

                // insert post into the database
                const postQuery = `INSERT INTO posts (user_id, text_content) VALUES (?, ?)`;
                const postParams = [user_id, text_content];
                const postResult = await queryDatabase(postQuery, postParams);
                const post_id = postResult[0].insertId;

                // prepare post for Kafka
                const post_json = {
                    username: username,
                    post_text: text_content,
                    post_uuid_within_site: post_id,
                    content_type: 'text/html',
                    source_site: 'instalite-wahoo',
                };

                // send to Kafka
                await sendPostToKafka({ post_json: post_json });
                console.log('Status post sent to Kafka:', post_json);
            }

            res.status(200).send({ message: `Image selected successfully` });
        }
    } catch (error) {
        console.error('Error selecting image:', error);
        res.status(500).send({
            error: 'An error occurred while selecting the image.',
        });
    }
}

async function saveUserSelfie(req, res) {
    // Get the user ID from the session
    const user_id = req.session.user_id;
    if (!user_id) {
        return res.status(403).send({ error: 'Not logged in.' });
    }

    const image_path = req.body.image_path;
    if (!image_path) {
        return res.status(400).send({ error: 'Image path is required.' });
    }

    const sql_command = 'UPDATE users SET selfie_photo = ? WHERE user_id = ?';
    const sql_params = [image_path, user_id];

    try {
        const result = await queryDatabase(sql_command, sql_params);
        if (result[0].affectedRows == 0) {
            return res.status(404).send({ error: 'User not found.' });
        } else {
            res.status(200).send({ message: 'Image saved successfully' });
        }
    } catch (error) {
        console.error('Error saving image:', error);
        res.status(500).send({
            error: 'An error occurred while saving the image.',
        });
    }
}

async function getEmbeddingFromSelfieKey(req, res) {
    const key = req.body.key;
    if (!key) {
        return res.status(400).send({ error: 'Image key is required.' });
    }

    const bucketName = 'nets2120-chroma-' + process.env.USER_ID;
    const s3_user = new S3KeyValueStore(bucketName, 'user');

    try {
        const file_obj = await s3_user.fetchFileBinary(key);
        const embeddings = await face.getEmbeddingsFromBuffer(file_obj);
        const embedding = embeddings[0];

        res.status(200).send({
            embedding: embedding,
        });
    } catch (error) {
        console.error('Error getting embedding:', error);
        res.status(500).send({
            error: 'An error occurred while getting the embedding.',
        });
    }
}

async function getPopularHashtags(req, res) {
    try {
        const query = `
            SELECT hashtags
            FROM posts
            WHERE hashtags IS NOT NULL AND hashtags <> ''
        `;

        const result = await queryDatabase(query);

        // process hashtags
        const hashtags = {};
        result[0].forEach((row) => {
            if (row.hashtags) {
                const tagsArray = row.hashtags.split(',');
                tagsArray.forEach((tag) => {
                    const trimmedTag = tag.trim();
                    if (trimmedTag) {
                        hashtags[trimmedTag] = (hashtags[trimmedTag] || 0) + 1;
                    }
                });
            }
        });

        // convert to array and sort by popularity
        const sortedHashtags = Object.entries(hashtags)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // get top 15

        res.status(200).json({ hashtags: sortedHashtags });
    } catch (error) {
        console.error('Error fetching popular hashtags:', error);
        res.status(500).json({ error: 'Failed to get popular hashtags' });
    }
}

async function updateHashtags(req, res) {
    const user_id = req.session.user_id;
    const hashtags = req.body.hashtags;

    if (!user_id) {
        return res.status(403).send({ error: 'Not logged in.' });
    }

    try {
        const sql_command = 'UPDATE users SET hashtags = ? WHERE user_id = ?';
        const sql_params = [hashtags, user_id];

        const result = await queryDatabase(sql_command, sql_params);

        if (result[0].affectedRows == 0) {
            return res.status(404).send({ error: 'User not found.' });
        } else {
            res.status(200).send({ message: 'Hashtags updated successfully' });
        }
    } catch (error) {
        console.error('Error updating hashtags:', error);
        res.status(500).send({
            error: 'An error occurred while updating hashtags.',
        });
    }
}

async function updateEmail(req, res) {
    const user_id = req.session.user_id;
    const email = req.body.email;

    if (!user_id) {
        return res.status(403).send({ error: 'Not logged in.' });
    }

    if (!email || email.trim().length === 0) {
        return res.status(400).send({ error: 'Email cannot be empty.' });
    }

    try {
        const sql_command = 'UPDATE users SET email = ? WHERE user_id = ?';
        const sql_params = [email, user_id];

        const result = await queryDatabase(sql_command, sql_params);

        if (result[0].affectedRows === 0) {
            return res.status(404).send({ error: 'User not found.' });
        } else {
            res.status(200).send({ message: 'Email updated successfully' });
        }
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).send({
            error: 'An error occurred while updating email.',
        });
    }
}

async function updatePassword(req, res) {
    const user_id = req.session.user_id;
    const currentPassword = req.body.current_password;
    const newPassword = req.body.new_password;

    if (!user_id) {
        return res.status(403).send({ error: 'Not logged in.' });
    }

    if (
        !currentPassword ||
        currentPassword.trim().length === 0 ||
        !newPassword ||
        newPassword.trim().length === 0
    ) {
        return res
            .status(400)
            .send({
                error: 'Current password and new password cannot be empty.',
            });
    }

    try {
        // get current hashed password
        const userQuery = 'SELECT hashed_password FROM users WHERE user_id = ?';
        const userParams = [user_id];
        const userResult = await queryDatabase(userQuery, userParams);

        if (userResult[0].length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }

        const storedHash = userResult[0][0].hashed_password;

        // check current password
        const match = await bcrypt.compare(currentPassword, storedHash);
        if (!match) {
            return res
                .status(401)
                .send({ error: 'Current password is incorrect.' });
        }

        const newPasswordHash = await helper.encryptPassword(newPassword);
        const updateQuery =
            'UPDATE users SET hashed_password = ? WHERE user_id = ?';
        const updateParams = [newPasswordHash, user_id];
        const updateResult = await queryDatabase(updateQuery, updateParams);

        if (updateResult[0].affectedRows === 0) {
            return res
                .status(500)
                .send({ error: 'Failed to update password.' });
        } else {
            res.status(200).send({ message: 'Password updated successfully' });
        }
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).send({
            error: 'An error occurred while updating password.',
        });
    }
}

/* Here we construct an object that contains a field for each route
   we've defined, so we can call the routes from app.js. */

export {
    getHelloWorld,
    postLogin,
    postRegister,
    postLogout,
    getMovie,
    uploadImage,
    getOnlineUsers,
    selectPhoto,
    saveUserSelfie,
    getEmbeddingFromSelfieKey,
    getPopularHashtags,
    updateHashtags,
    updateEmail,
    updatePassword,
};
