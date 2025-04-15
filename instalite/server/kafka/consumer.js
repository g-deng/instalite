///////////////
// Adapted from NETS 2120 Sample Kafka Client
///////////////
import axios from 'axios';
import pkg from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';
import fs from 'fs';
import dotenv from 'dotenv';
import RouteHelper from '../routes/route_helper.js';
import { createPost } from '../routes/feed_routes.js';

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

var bluesky_posts = [];
var federated_posts = [];

const run = async () => {
    // Consuming
    await consumer.connect();

    // Subscribing
    console.log("Subscribing to topics");
    await consumer.subscribe({ topics: ['FederatedPosts', 'Bluesky-Kafka'], fromBeginning: true, compression: CompressionTypes.Snappy });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (topic === 'Bluesky-Kafka') {
                bluesky_posts.push({
                    value: message.value.toString(),
                });
            } else if (topic === 'FederatedPosts') {
                federated_posts.push({
                    value: message.value.toString(),
                });

                // TODO: when the post database structure is updated, fix the input
                // Process post
                const post = JSON.parse(message.value);
                if (post.username && post.post_text && post.content_type && post.source_site
                    // && helper.isOK(post.username) 
                    // && helper.isOK(post.text) 
                    // && helper.isOK(post.content_type)
                    // && helper.isOK(post.source_site)
                ) {
                    console.log('Posting to app');
                    console.log(post);
                    // Upload post to app
                    const postBody = {title: `${post.username} on site ${post.source_site}`, content: post.post_text, parent_id: null};
                    // TODO: figure out kafka poster (not charlesdickens)
                    try {
                        createPost({
                            body: postBody,
                            session: {
                                user_id: 3, // TODO: fix this
                                username: 'charlesdickens',
                            },
                            params: {
                                username: 'charlesdickens',
                            }
                        }, {
                            status: (code) => ({
                                send: (response) => console.log(`Response code: ${code}, Response: ${JSON.stringify(response)}`),
                            }),
                        })
                        // await axios.post(`${config.serverRootURL}/charlesdickens/createPost`, postBody);
                        console.log(postBody);
                    } catch (error) {
                        console.error('Error posting to app:', error);
                    } 
                }
            } else {
                console.log(`Unknown topic: ${topic}`);
            }
        },
    });
};

run().catch(console.error);