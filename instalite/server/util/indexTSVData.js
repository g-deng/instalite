import path from "path";
import { parseTSVFile } from "./parseTSV.js";
import { generateEmbedding } from "./embedding.js";
import ChromaDB from './chromaClient.js';
import { get_db_connection } from '../models/rdbms.js';

import * as fs from 'fs';
const db = get_db_connection();

async function queryDatabase(query, params = []) {
    await db.connect();

    return db.send_sql(query, params);
}

/**
 * Reads a TSV file, generates embeddings for each record, and indexes them in ChromaDB.
 *
 * @param {string} filePath - The path to the TSV file.
 * @param {string} collectionName - The name of the collection in ChromaDB.
 */
export async function indexTSVData(filePath, collectionName = "indexedData") {
  const records = parseTSVFile(filePath);
  
  const chroma = ChromaDB();
  var coll = await chroma.create_table(collectionName);
  // generate embedding for each record
  for (const record of records) {
    const id = record.id || record.ID || record.title || `${Math.random()}`;
    const content = record.content || record.Description || Object.values(record).join(" ");
    const metadata = { ...record };
    
    try {
      console.log(`Indexing record id: ${id}`);
      const embedding = await generateEmbedding(content);
      await chroma.put_item_into_table(collectionName, id, content, embedding, metadata );
      console.log(`Successfully indexed record: ${id}`);
    } catch (e) {
      console.error(`Error indexing record ${id}: ${e.message}`);
    }
  }
}

// create TSV from posts first
const [rows] = await queryDatabase('SELECT * FROM posts');

const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

const tsvData = [
  headers.join('\t'),
  ...rows.map(row => headers.map(header => row[header]).join('\t'))
].join('\n');

fs.writeFileSync('server/util/datasets/posts.tsv', tsvData);


// index all data
const data = ["names.tsv", "principals.tsv", "ratings.tsv", "posts.tsv"];

for (const fileName of data) {
  const tsvFilePath = path.join(process.cwd(), "server", "util", "datasets", fileName); 
  indexTSVData(tsvFilePath)
    .then(() => console.log("All records have been indexed successfully."))
    .catch((err) => console.error("Error indexing TSV data: ", err));
}
