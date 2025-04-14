///////////////
// Adapted from NETS 2120 Sample Kafka Client
///////////////

import express from 'express';
import pkg from 'kafkajs';
const { Kafka, CompressionTypes, CompressionCodecs } = pkg;
import SnappyCodec from 'kafkajs-snappy';

// Add snappy codec to the CompressionCodecs.
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

import fs from 'fs';
const configFile = fs.readFileSync('server/kafka/config.json', 'utf8');
import dotenv from 'dotenv';
dotenv.config();
const config = JSON.parse(configFile);
console.log(`Config: ${JSON.stringify(config)}`);
const app = express();
const kafka = new Kafka({
    clientId: 'my-app',
    brokers: config.bootstrapServers
});

const consumer = kafka.consumer({ 
    groupId: config.groupId, 
    bootstrapServers: config.bootstrapServers});

var kafka_messages = [];

app.get('/', (req, res) => {
    res.send(JSON.stringify(kafka_messages));
});

const run = async () => {
    // Consuming
    await consumer.connect();
    console.log(`Following topic ${config.topic}`);
    await consumer.subscribe({ topic: config.topic, fromBeginning: true,
        compression: CompressionTypes.Snappy });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            kafka_messages.push({
                value: message.value.toString(),
            });
            console.log({
                value: message.value.toString(),
            });
        },
    });
};

run().catch(console.error);

app.listen(config.port, () => {
    console.log(`App is listening on port ${config.port} -- you can GET the Kafka messages`);
});