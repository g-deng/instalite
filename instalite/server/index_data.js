import ChromaDB from './models/vector.js';
import DynamoDB from './models/kvs.js';
import S3KeyValueStore from './models/s3.js';
import FaceEmbed from './algorithms/face_embed.js';
import fs from 'fs';
import dotenv from 'dotenv';

const configFile = fs.readFileSync('server/config.json', 'utf8');
const config = JSON.parse(configFile);

dotenv.config()

const userid = process.env.USER_ID;

if (!userid) {
  console.error("Please set your user ID in the USER_ID environment variable in .env");
  process.exit(1);
}

const chroma = ChromaDB();
const ddb = DynamoDB("user");
const s3 = new S3KeyValueStore('nets2120-images', "default");
const s3_user = new S3KeyValueStore('nets2120-chroma-' + process.env.USER_ID, "user");
const ddb_main = DynamoDB("default");

const face = new FaceEmbed();

/**
 * This is an important helper function: it takes the path to a file on S3,
 * downloads it, and returns its embedding as a vector (array).
 * 
 * @param {*} id 
 * @param {*} fileName 
 * @returns 
 */
async function getEmbedding(id, fileName) {
  if (fileName.startsWith('imdb_crop/')) {
    fileName = fileName.replace('imdb_crop/', '');
  }
  const file_obj = await s3.fetchFileBinary(fileName);
  
  const embeddings = await face.getEmbeddingsFromBuffer(file_obj);
  return embeddings[0];
}

// TODO: open merged_imdb_data.csv and read the data
//       for each row, create a record in two databases, each
//       letting us look up the other.  In ChromaDB, use
//         config.chromaDbName as the table name.  Include:
//         the row ID from the source, embedding, and the entire row as the item.
//       In DynamoDB, use config.dynamoDbTableName as the table name.  Include
//         the nconst field as the hash key, the id field as the range key,
//         and the name, birthYear, and deathYear fields as attributes.
async function add_rows_to_vector_store(MAX) {
  // await clear_chroma();
  const data = fs.readFileSync('merged_imdb_data.csv', 'utf8');
  const rows = data.split('\n');
  let count = 0;
  let idx = 0;
  for (const row of rows.slice(1)) {
    count++;

    if (count > MAX)
      break;

    const [_, nconst, name, birthYear, deathYear, path] = row.split(',');
    // if (!id || !nconst || !name || !birthYear || !deathYear || !path) {
    //   console.log('Skipping malformed row:', row);
    //   continue;
    // }
    // if (count === 1) {
    //   console.log('Adding row', id, nconst, name, birthYear, deathYear, path.replace('imdb_crop/', ''));
    // }

    const embedding = await getEmbedding(count, path);
    if (embedding === null || embedding === undefined) {
      console.log('Skipping row');
      continue;
    }

    const chromaItem = {
      nconst: nconst,
      id: idx.toString(),
      // embedding: embedding,
      name: name,
      birthYear: (birthYear && birthYear !== '""') ? birthYear.toString() : null,
      deathYear: (deathYear && deathYear !== '""') ? deathYear.toString() : null,
      path: path.replace('imdb_crop/', '')
    }

    await chroma.put_item_into_table(config.chromaDbName, idx.toString(), embedding, chromaItem);

    const dynamoItem = {
      nconst: { S: nconst },
      id: { N: idx.toString() },
      name: { S: name },
      birthYear: (birthYear && birthYear !== '""') ? { N: birthYear.toString() } : { NULL: true },
      deathYear: (deathYear && deathYear !== '""') ? { N: deathYear.toString() } : { NULL: true }
    }

    await ddb.put_item_into_table(config.dynamoDbTableName, dynamoItem);
    idx++;
  }
  console.log('finished adding rows to vector store');
  // await s3_user.uploadDirectory('chroma_db', 'nets2120-chroma-' + process.env.USER_ID, 'chroma_db');
  return count;
}

async function clear_chroma() {
  console.log(`Clearing all items from ChromaDB table: ${config.chromaDbName}`);

  await chroma.clear_table(config.chromaDbName);

  console.log('Finished clearing ChromaDB table.');
}


/////////////////////////////////////////////////////////////////////////////////////
//// Main program starts here
//

// Create the tables if they don't exist, in ChromaDB and DynamoDB

var coll = await chroma.create_table(config.chromaDbName);

try {
  var tab = await ddb.create_table(config.dynamoDbTableName, [
    { AttributeName: 'nconst', KeyType: 'HASH' },
    { AttributeName: 'id', KeyType: 'RANGE' }
  ], [
    { AttributeName: 'nconst', AttributeType: 'S' },
    { AttributeName: 'id', AttributeType: 'N' }
  ], {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  });
} catch (err) {
  if (err.name === 'ResourceInUseException') {
    console.log('Table already exists.');
  } else {
    console.error('Error creating table:', err);
    throw err;
  }
} 

await face.loadModel();
await add_rows_to_vector_store(config.max);

await s3_user.uploadDirectory('chromadb', 'nets2120-chroma-' + process.env.USER_ID, 'chroma_db');