// embedding.js
import axios from "axios";

export async function generateEmbedding(text) {
  const url = "https://api.openai.com/v1/embeddings";
  const model = "text-embedding-ada-002";
  
  const response = await axios.post(
    url,
    { input: text, model },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Ensure your key is set in env variables
      },
    }
  );
  
  // The API returns an embeddings array; here, we return the first one.
  return response.data.data[0].embedding;
}
