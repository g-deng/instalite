import pkg from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';
import fs from 'fs';
import dotenv from 'dotenv';
import RouteHelper from '../routes/route_helper.js';

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

const producer = kafka.producer({ 
    bootstrapServers: config.bootstrapServers
});

const connectProducer = async () => {
    await producer.connect();
};

const sendPostToKafka = async (post) => {
    await producer.send({
        topic: 'FederatedPosts',
        messages: [
            {
                value: JSON.stringify(post),
            },
        ],
        compression: CompressionTypes.Snappy,
    });
};

export {
    connectProducer,
    sendPostToKafka
}