import fs from 'fs';

import { ChromaClient } from 'chromadb';
var vectorStore = null;

const configFile = fs.readFileSync('server/config.json', 'utf8');
const config = JSON.parse(configFile);

import dotenv from 'dotenv';
dotenv.config()


/**
 * Get a connection to the DynamoDB database or a mock object
 * 
 * @returns An instance of the DynamoDBClient
 */
function get_db_connection_singleton() {
  if (vectorStore) {
      return vectorStore;
  }

  console.log('Creating a new connection to the database');

  vectorStore = {
    client: null,

    get_client: async function() {
      if (this.client != null) {
        return this.client;
      }
      var host = config.chroma.host;
      var port = config.chroma.port;

      if (process.env.CHROMA_HOST) {
        host = process.env.CHROMA_HOST;
        port = process.env.CHROMA_PORT;
      }
      console.log("ChromaDB at http://" + host + ":" + port);
      this.client = new ChromaClient({ path: "http://" + host + ":" + port });

      return this.client;
    },

    create_table: async function (tableName) {
      return this.client.getOrCreateCollection({ name: tableName });
    },

    put_item_into_table: async function (tableName, key, content, embedding, metadata) {
      var collection = await this.client.getCollection({ name: tableName });
      console.log(collection);
      console.log('*****');
      console.log(key);
      console.log(embedding);
      console.log(content);
      console.log("about to add");
      return collection.add(
        {
          ids: [key],
          documents: [content],
          embeddings: [embedding],
          metadatas: [metadata],
        }
      );
    },

    get_item_from_table: async function (tableName, key) {
      var collection = await this.client.getCollection({ name: tableName });
      var data = await collection.get({
        ids: [key],
        include: ["embeddings", "documents", "metadatas"]
      })

      data.documents = [JSON.parse(data.documents[0])];
      return data;
    },

    get_items_from_table: async function (tableName, embedding, n_results) {
      var collection = await this.client.getCollection({ name: tableName });
      return collection.query({
        queryEmbeddings: [embedding],
        nResults: n_results
      })
    }
    
  };

  vectorStore.get_client().then((res) => {
    console.log("Connected to ChromaDB");
  }).catch((err) => {
    console.error(err);
    throw err;
  });

  return vectorStore;
}


export {
  get_db_connection_singleton
}

export default get_db_connection_singleton;

