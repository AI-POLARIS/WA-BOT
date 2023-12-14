import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { EXAMPLE_MESSAGES } from "./bot-config";

const MODEL_NAME = "gemini-pro";
const API_KEY =
  process.env.GCP_API_KEY || "AIzaSyDHh_AhrcU7bWmDQrObNsyfJ3KoDbh5iEE";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// const chat = model.startChat({
//   generationConfig,
//   safetySettings,
//   history: EXAMPLE_MESSAGES.map((message) => [
//     {
//       role: "user",
//       parts: [{ text: message.input.content }],
//     },
//     {
//       role: "model",
//       parts: [{ text: message.output.content }],
//     },
//   ]).flat(1),
// });

export default model;
export { generationConfig, safetySettings };
