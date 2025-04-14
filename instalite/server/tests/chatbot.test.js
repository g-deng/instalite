import { generateEmbedding } from '../util/embedding.js';

import axios from 'axios';
import https from 'https';

const agent = new https.Agent({ keepAlive: true });
axios.defaults.httpsAgent = agent;


describe('TSV Indexing Pipeline', () => {
  beforeAll(async () => {
    console.log('Starting TSV Indexing Pipeline tests');
  });

  test('Should parse TSV content correctly', async () => {
    const { parseTSVFile } = await import('../util/parseTSV.js');
    const records = parseTSVFile("server/tests/test.tsv");
    expect(records).toEqual([
      { id: "1", description: "Test description" },
    ]);
    console.log('Passed TSV parsing test');
  });

  test('Should generate embedding of 1536 dimensions', async () => {
    const text = "Test description";
    const embedding = await generateEmbedding(text);
    expect(embedding).toHaveLength(1536);
    embedding.forEach((value) => expect(typeof value).toBe('number'));
    console.log('Passed embedding generation test');
  });

  afterAll(async () => {
    console.log('TSV Indexing Pipeline tests completed.');
    agent.destroy();
  });

});
