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


const runKafkaConsumer = async () => {
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
                    console.log(post);
                    parsedData = {
                        text_content: `${post.author.displayName} on BlueSky: ${post.post_text}`, 
                        username: post.author.displayName,
                        source_site: post.source_site,
                        topic: 'BlueSky',
                        image_url: post.uri
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
                    console.log(postData);
                    parsedData = {
                        text_content: `${postData.username} on ${postData.source_site}: ${postData.post_text}`, 
                        username: postData.username,
                        source_site: postData.source_site,
                        topic: topic,
                        image_url: postData.attach
                    };
                    console.log(parsedData);
                } 
            } 

            try {
                if (parsedData) {
                    await addKafkaPostToDB(parsedData);
                }
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
    const text_content = post.text_content;
    const hashtags = post.hashtags || null;
    const source = post.topic;
    const image_url = post.image_url || null;

    if (source == 'local') {
        console.log('Post is from local source, not adding to DB');
        console.log({username, content, source_site, source})
        return;
    }



    if (!text_content || text_content.trim().length == 0 || text_content.includes("instalite-wahoo")) {
        return;
    } else {
        try {
            const user_id = await registerKafkaUser(source);
            const query = `
                INSERT INTO posts (user_id, image_url, text_content, hashtags, source) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const params = [user_id, image_url, text_content, hashtags, source];
            const result = await queryDatabase(query, params);
            const post_id = result[0].insertId;
            console.log(`Kafka post added to local DB with ID: ${post_id}`);
        } catch (error) {
            console.error('Error inserting post into database:', error);
        }
    }
}

const closeKafkaConsumer = async () => { 
    await consumer.disconnect();
    console.log('Kafka consumer disconnected');
}

export {
    runKafkaConsumer,
    closeKafkaConsumer,
    addKafkaPostToDB,
    registerKafkaUser
}