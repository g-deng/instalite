///////////////
// Adapted from NETS 2120 Sample Kafka Client
///////////////
import pkg from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';
import fs from 'fs';
import dotenv from 'dotenv';
import RouteHelper from '../routes/route_helper.js';
import { get_db_connection } from '../models/rdbms.js';

// Set-up
const { Kafka, CompressionTypes, CompressionCodecs } = pkg;
// Add snappy codec to the CompressionCodecs.
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
const configFile = fs.readFileSync('server/kafka/config.json', 'utf8');
dotenv.config();
const config = JSON.parse(configFile);
console.log(`Config: ${JSON.stringify(config)}`);
const helper = new RouteHelper();

// Open connection to Kafka
const kafka = new Kafka({
    clientId: 'my-app',
    brokers: config.bootstrapServers
});

const consumer = kafka.consumer({ 
    groupId: config.groupId, 
    bootstrapServers: config.bootstrapServers
});


const run = async () => {
    // Consuming
    await consumer.connect();

    // Subscribing
    console.log("Subscribing to topics");
    await consumer.subscribe({ topics: ['FederatedPosts', 'Bluesky-Kafka'], fromBeginning: true, compression: CompressionTypes.Snappy });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            let parsedData = null;
            if (topic === 'Bluesky-Kafka') {
                let post;
                try {
                    post = JSON.parse(message.value.toString());
                } catch {
                    console.error('Error parsing message:', message.value.toString());
                    return;
                }
                // Process post
                if (post.username && post.post_text && post.content_type && post.source_site && post.author?.displayName
                    // && helper.isOK(post.username + post.post_text + post.content_type + post.source_site + post.author.displayName)
                ) {
                    console.log('Reading post from Bluesky...');
                    parsedData = {
                        title: `${post.author.displayName} on BlueSky`, 
                        content: post.post_text, 
                        username: post.author.displayName,
                        source_site: post.source_site,
                        topic: 'BlueSky'
                    };
                    console.log(parsedData);
                }

            } else if (topic === 'FederatedPosts') {
                // Process post
                const post = JSON.parse(message.value);
                const postData = post.post_json;
                if (!postData) return;
                
                if (postData.username && postData.post_text && postData.content_type && postData.source_site
                    // && helper.isOK(post.username) && helper.isOK(post.text) && helper.isOK(post.content_type) && helper.isOK(post.source_site)
                ) {
                    console.log('Reading post from FederatedPosts...');
                    parsedData = {
                        title: `${postData.username} on ${postData.source_site}`, 
                        content: postData.post_text, 
                        username: postData.username,
                        source_site: postData.source_site,
                        topic: topic
                    };
                    console.log(parsedData);
                } 
            } 

            try {
                if (parsedData) {
                    await addKafkaPostToDB(parsedData);
                }
                console.log('Post added to DB');
            } catch (error) {
                console.error('Error posting to app:', error);
            } 
        },
    });
};

const db = get_db_connection();

async function queryDatabase(query, params = []) {
    await db.connect();
    return db.send_sql(query, params);
}

const registerKafkaUser = async (name) => {
    const query = `
        SELECT user_id, username
        FROM users
        WHERE username = ?
    `;
    let user_id;
    const result = await queryDatabase(query, [name]);
    if (result[0].length > 0) {
        console.log('User already exists');
        user_id = result[0][0].user_id;
    } else {
        const insertQuery = `
            INSERT INTO users (username, linked_nconst)
            VALUES (?, ?)
        `;
        const insertParams = [name, 'nm9119523'];
        const result = await queryDatabase(insertQuery, insertParams);
        console.log(`User ${name} registered`);
        user_id = result[0].insertId;
        
    }
    return user_id;
}

const addKafkaPostToDB = async (post) => {
    const title = `from ${post.username} on ${post.source_site}`;
    const content = post.content;
    const source = post.topic;

    if (!title || !content || title.trim().length == 0 || content.trim().length == 0) {
        return;
    } else {
        try {
            const author_id = await registerKafkaUser(source);
            const query = `
                INSERT INTO posts (parent_post, title, content, author_id) VALUES (?, ?, ?, ?)
            `;
            const params = [null, title, content, author_id];
            const result = await queryDatabase(query, params);
            const post_id = result[0].insertId;
            console.log(`Kafka post added to local DB with ID: ${post_id}`);
        } catch (error) {
            console.error('Error inserting post into database:', error);
        }
    }
}

run().catch(console.error);