import fs from 'fs';
const configFile = fs.readFileSync('server/config.json', 'utf8');
const config = JSON.parse(configFile);

import ChromaDB from '../models/vector.js';
import DynamoDB from '../models/kvs.js';


// Dotenv reads the .env file and makes the environment variables available
import dotenv from 'dotenv';
dotenv.config()

// Create instances of the ChromaDB and DynamoDB classes

const chroma = ChromaDB();

// This is DynamoDB on the user side, where we can create and update tables
const ddb = DynamoDB("user");
// This is DynamoDB as part of the course-provided side
const ddb_main = DynamoDB("default");
// TODO: Route Handler for Query Operation

async function get_embedding(req, res) {
    console.log(req);
    if (!req || !req.params) {
        res.status(400).json({error: 'Request parameters are required.'});
        return;
    }
    const actor = req.params.name;
    if (!actor) {
        res.status(400).json({error: 'Name is required.'});
        return;
    }

    const actorResults = await ddb_main.query_table_secondary_index("imdb_actors", "primaryName-nconst-index", "primaryName", actor);
    if (!actorResults || actorResults.length == 0) {
        res.status(404).json({error: 'Actor not found.'});
        return;
    }
    const nconst = actorResults[0].nconst.S;

    const user_results = await ddb.query_table_by_key(config.dynamoDbTableName, "nconst", nconst);
    console.log(user_results);
    if (!user_results || user_results.length == 0) {
        res.status(404).json({error: 'Actor was found, but no face image was found.'});
        return;
    }
    const id = user_results[0].id.N;

    const embedding = await chroma.get_item_from_table(config.chromaDbName, id);
    if (!embedding) {
        res.status(500).json({error: "Error querying databases."});
        return;
    }

    res.json(embedding.embeddings[0]);
}

// TODO: Route Handler for finding top-5 face matches
async function get_topk(req, res) {
  if (!req || !req.body) {
    res.status(400).json({error: 'Request body is required.'});
    return;
  }
  const embedding = req.body.embedding;
  if (!embedding) {
    res.status(400).json({error: 'Embedding is required.'});
    return;
  }

  const results = await chroma.get_items_from_table(config.chromaDbName, embedding, 5);
  if (results === null || results.length == 0) {
    res.json([]);
  } else {
    const paths = results.documents[0].map((doc) => {
      // console.log(doc);
      const obj = JSON.parse(doc);

      console.log(obj);
      // console.log(obj.path);
      return {
        nconst: obj.nconst,
        path: obj.path,
        name: obj.name,
        birthYear: obj.birthYear ? obj.birthYear : '',
        deathYear: obj.deathYear ? obj.deathYear : ''
      };
    });
    res.json(paths);
  }
}

export { 
  get_embedding,
  get_topk
};