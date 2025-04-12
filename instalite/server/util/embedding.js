import axios from "axios";

import dotenv from 'dotenv';
dotenv.config()

export async function generateEmbedding(text) {
  const url = "https://api.openai.com/v1/embeddings";
  const model = "text-embedding-ada-002";
  console.log("API Key:", process.env.OPENAI_API_KEY);
  const response = await axios.post(
    url,
    { input: text, model },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 
      },
    }
  );
  
  return response.data.data[0].embedding;
}
