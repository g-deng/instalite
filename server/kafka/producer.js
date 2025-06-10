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

const USE_KAFKA = process.env.USE_KAFKA === 'true';

let kafka = null;
let producer = null;

if (USE_KAFKA) {
    kafka = new Kafka({
        clientId: 'my-app',
        brokers: config.bootstrapServers
    });

    producer = kafka.producer({ 
        bootstrapServers: config.bootstrapServers
    });
}

const connectProducer = async () => {
    if (!USE_KAFKA || !producer) {
        console.log('Kafka producer disabled.');
        return;
    }
    await producer.connect();
};

const sendPostToKafka = async (post) => {
    if (!USE_KAFKA || !producer) {
        console.log('Kafka producer disabled. Not sending post.');
        return;
    }
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