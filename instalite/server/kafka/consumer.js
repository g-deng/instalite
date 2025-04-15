///////////////
// Adapted from NETS 2120 Sample Kafka Client
///////////////
import axios from 'axios';
import pkg from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';
import fs from 'fs';
import dotenv from 'dotenv';

// Set-up
const { Kafka, CompressionTypes, CompressionCodecs } = pkg;
// Add snappy codec to the CompressionCodecs.
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
const configFile = fs.readFileSync('server/kafka/config.json', 'utf8');
dotenv.config();
const config = JSON.parse(configFile);
console.log(`Config: ${JSON.stringify(config)}`);

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
    await producer.connect();

    // Subscribing
    console.log("Following topic Bluesky-Kafka");
    await consumer.subscribe({ topic: 'Bluesky-Kafka', fromBeginning: true, compression: CompressionTypes.Snappy });
    
    console.log("Following topic FederatedPosts");
    await consumer.subscribe({ topic: 'FederatedPosts', fromBeginning: true, compression: CompressionTypes.Snappy });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (topic === 'Bluesky-Kafka') {
                bluesky_posts.push({
                    value: message.value.toString(),
                });
                console.log('Bluesky post');
            } else if (topic === 'FederatedPosts') {
                federated_posts.push({
                    value: message.value.toString(),
                });
                console.log(`Federated post: ${message.value.toString()}`);
            } else {
                console.log(`Unknown topic: ${topic}`);
            }

            // Upload post to app
            // await axios.post(`${config.serverRootURL}/federatedPost`, {
                
            // });
        },
    });
};

run().catch(console.error);