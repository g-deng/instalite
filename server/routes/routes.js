import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { OpenAIEmbeddings } from "@langchain/openai";
import { formatDocumentsAsString } from "langchain/util/document";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import S3KeyValueStore from '../models/s3.js';
import FaceEmbed from '../algorithms/face_embed.js';

import { get_db_connection } from '../models/rdbms.js';
import RouteHelper from '../routes/route_helper.js';

import bcrypt from 'bcrypt';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

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
    res.status(200).send({message: "Hello, world!"});
}


async function getVectorStore() {
    if (vectorStore == null) {
        vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
            collectionName: "indexedData", //imdb_reviews2
            url: "http://localhost:8000", // Optional, will default to this value
            });
    } else
        console.log('Vector store already initialized');
    return vectorStore;
}

// GET for online users
async function getOnlineUsers(req, res) {
    try {
        const [rows] = await queryDatabase('SELECT user_id FROM online_users');
        const users = rows.map(r => r.user_id);
        res.json({ results: users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'could not fetch online users' });
    }
};

// POST /register 
async function postRegister(req, res) {
    const linked_nconst = req.body.linked_nconst;
    const user = req.body.username;
    const raw_pass = req.body.password;
    const first_name = req.body.first_name;
    const last_name = req.body.last_name;
    const birthday = req.body.birthday;
    const email = req.body.email;
    const affiliation = req.body.affiliation;
    if (linked_nconst.trim().length == 0 || 
        user.trim().length == 0 || 
        raw_pass.trim().length == 0 ||
        first_name.trim().length == 0 ||
        last_name.trim().length == 0 ||
        birthday.trim().length == 0 ||
        email.trim().length == 0 ||
        affiliation.trim().length == 0 || 
        !helper.isOK(user)) {
        console.log('Invalid values in the request');
        res.status(400).send({error: "One or more of the fields you entered was empty or invalid, please try again."}); 
    } else {
        console.debug('Checking if user exists');

        // TODO: check if user exists
        // IF NOT: encrypt password, store in database, set session
        try {
            const exist_query = 'SELECT * FROM users WHERE username = ?';
            const exist_params = [user];
            const result = await queryDatabase(exist_query, exist_params);
            if (result[0].length > 0) {
                console.log(result[0]);
                res.status(409).send({error: "An account with this username already exists, please try again."});
            } else {
                console.log('Creating user');
                const password = await helper.encryptPassword(raw_pass);
                const query = 'INSERT INTO users (username, hashed_password, linked_nconst, first_name, last_name, birthday, email, affiliation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                const params = [user, password, linked_nconst, first_name, last_name, birthday, email, affiliation];
                const result = await queryDatabase(query, params);
                console.log(result);
                const user_id_query = 'SELECT user_id FROM users WHERE username = ?';
                const user_id_params = [user];
                const user_id_result = await queryDatabase(user_id_query, user_id_params);
                req.session.username = user;
                req.session.user_id = user_id_result[0][0].user_id;
                console.log('User registered successfully');
                console.log(req.session);
                res.status(200).send({message: `{username: '${user}', user_id: '${user_id_result[0][0].user_id}'}`});
            }
        } catch (error) {
            res.status(500).send({error: 'An error occurred while registering the user, please try again.'});
        }
    }
};


// POST /login
async function postLogin(req, res) {
    console.log(req.body);
    var username = req.body.username;
    var plain_password = req.body.password;
    console.log('Logging in user: ' + username);

    // TODO: check if user exists
    // then match password. If appropriate, set session
    if (username.trim().length == 0 || 
        plain_password.trim().length == 0 || 
        !helper.isOK(username)) {
        console.log('Invalid values in the request');
        res.status(400).send({error: 'One or more of the fields you entered was empty, please try again.'}); 
    } else {
        try {
            const query = 'SELECT * FROM users WHERE username = ?';
            const params = [username];
            console.log("hi");
            const result = await queryDatabase(query, params);
            console.log(result);
            if (result[0].length > 0) {
                const user = result[0][0];
                const match = await bcrypt.compare(plain_password, user.hashed_password);
                if (!match) {
                    res.status(401).send({error: 'Username and/or password are invalid.'});
                } else {
                    req.session.username = username;
                    req.session.user_id = user.user_id;
                    res.status(200).send({message: `{username: '${username}', user_id: '${user.user_id}'}`});
                }
            } else {
                res.status(401).send({error: 'Username and/or password are invalid.'});
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({error: 'Error querying database'});
        }
    }
};


// GET /logout
function postLogout(req, res) {
  req.session.user_id = null;
  res.status(200).send({message: "You were successfully logged out."});
};


async function getMovie(req, res) {
    console.log('Getting movie database');
    const vs = await getVectorStore();
    console.log('Connected...');
    const retriever = vs.asRetriever();
    console.log('Ready to run RAG chain...');

    const prompt =
    PromptTemplate.fromTemplate(`Answer the question. Context: ${context}. Question: ${question}`);
    const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });

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
    res.status(200).send({message:result});
}

async function uploadImage(req, res) {
    const bucketName = 'nets2120-chroma-' + process.env.USER_ID;

    const s3_user = new S3KeyValueStore(bucketName, "user");

    try {
        // Check if a file is provided
        if (!req.file) {
            return res.status(400).send({ error: "No file uploaded." });
        }

        const file = req.file;

        // Generate a unique file name
        const filePath = file.path;
        const keyPrefix = 'uploads/';

        // Upload the file to S3
        const key = await s3_user.uploadFile(filePath, bucketName, keyPrefix);
        if (!key) {
            return res.status(500).send({ error: "Failed to upload file to S3." });
        }

        console.log(`Image uploaded to S3: ${filePath}`);

        const file_obj = await s3_user.convertFileToBinary(filePath, bucketName, keyPrefix);
        const embeddings = await face.getEmbeddingsFromBuffer(file_obj);
        const embedding = embeddings[0];

        res.status(200).send({
            message: `Image uploaded successfully to ${filePath}`,
            embedding: embedding,
            key: key
        });
    } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).send({ error: "An error occurred while uploading the image." });
    }
}

async function selectPhoto(req, res) {
    const user_id = req.session.user_id;
    const image_path = req.body.image_path;

    const sql_command = 'UPDATE users SET profile_photo = ? WHERE user_id = ?';
    const sql_params = [image_path, user_id];
    try {
        const result = await queryDatabase(sql_command, sql_params);
        if (result[0].affectedRows == 0) {
            return res.status(404).send({ error: "User not found." });
        } else {
            res.status(200).send({message: `Image selected successfully`});
        }
    } catch (error) {
        console.error("Error selecting image:", error);
        res.status(500).send({ error: "An error occurred while selecting the image." });
    }
}

async function saveUserSelfie(req, res) {
    // Get the user ID from the session
    const user_id = req.session.user_id;
    if (!user_id) {
        return res.status(403).send({ error: "Not logged in." });
    }

    const image_path = req.body.image_path;
    if (!image_path) {
        return res.status(400).send({ error: "Image path is required." });
    }

    const sql_command = 'UPDATE users SET selfie_photo = ? WHERE user_id = ?';
    const sql_params = [image_path, user_id];
    
    try {
        const result = await queryDatabase(sql_command, sql_params);
        if (result[0].affectedRows == 0) {
            return res.status(404).send({ error: "User not found." });
        } else {
            res.status(200).send({ message: "Image saved successfully" });
        }
    } catch (error) {
        console.error("Error saving image:", error);
        res.status(500).send({ error: "An error occurred while saving the image." });
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
};

