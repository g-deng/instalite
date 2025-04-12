// indexTSVData.js
import path from "path";
import { parseTSVFile } from "./parseTSV.js";
import { generateEmbedding } from "./embedding.js";
import { ChromaClient } from "./chromaClient.js";

/**
 * Reads a TSV file, generates embeddings for each record, and indexes them in ChromaDB.
 *
 * @param {string} filePath - The path to the TSV file.
 * @param {string} collectionName - The name of the collection in ChromaDB.
 */
export async function indexTSVData(filePath, collectionName = "tsv_collection") {
  const records = parseTSVFile(filePath);
  console.log(`Found ${records.length} records in TSV file.`);
  
  const client = new ChromaClient();
  
  // Try to retrieve the collection, create it if it doesn't exist.
  try {
    await client.getCollection(collectionName);
    console.log(`Using existing collection: ${collectionName}`);
  } catch (err) {
    console.log(`Collection ${collectionName} does not exist. Creating it...`);
    await client.createCollection(collectionName, { description: "Data from TSV file" });
  }
  
  // Process each record: generate an embedding and index it.
  for (const record of records) {
    // Define a unique id and content string.
    // Adjust these fields based on your TSV headers.
    const id = record.id || record.ID || record.title || `${Math.random()}`;
    // Use a specific column as the text content to embed.
    // If there isn’t a dedicated column, you can concatenate other fields.
    const content = record.content || record.Description || Object.values(record).join(" ");
    
    // Use the entire record as metadata if needed.
    const metadata = { ...record };
    
    try {
      console.log(`Indexing record id: ${id}`);
      const embedding = await generateEmbedding(content);
      await client.addDocument(collectionName, { id, content, embedding, metadata });
      console.log(`Successfully indexed record: ${id}`);
    } catch (e) {
      console.error(`Error indexing record ${id}: ${e.message}`);
    }
  }
}

// If you want to run this script directly from Node
const tsvFilePath = path.join(process.cwd(), "data.tsv"); // Adjust the path if necessary
indexTSVData(tsvFilePath)
  .then(() => console.log("All records have been indexed successfully."))
  .catch((err) => console.error("Error indexing TSV data: ", err));
