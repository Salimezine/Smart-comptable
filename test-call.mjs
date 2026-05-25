import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyBpPMhkpRhr0GwHMN8MG-ddUzxoBy-xY7c";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("Success! Output:", result.response.text());
  } catch (e) {
    console.error("Error calling gemini-3.5-flash:", e.message);
  }
}

run();
