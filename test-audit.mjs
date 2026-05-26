import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyBpPMhkpRhr0GwHMN8MG-ddUzxoBy-xY7c";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

const systemPrompt = "Act en tant que Smart-Comptable...";
const userPrompt = "Voici les données...";

async function run() {
  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    const response = await result.response;
    console.log("Success:", response.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
