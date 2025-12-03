import { GoogleGenAI, Type } from "@google/genai";
import { FortuneResponse } from '../types';

// In React Native, use a config file or environment variable
// For now, using a placeholder - you should set this via environment variables
const API_KEY = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateFortune = async (
  sign: string,
  question: string
): Promise<FortuneResponse> => {
  try {
    const prompt = `
      You are a mystical, benevolent AI oracle.
      Generate a daily fortune for the Zodiac sign: ${sign}.
      
      ${question ? `The user also asks specifically: "${question}". Address this in the horoscope.` : ''}

      Please maintain a tone that is ethereal, uplifting, and insightful.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            horoscope: {
              type: Type.STRING,
              description: "The main fortune telling text, around 50-80 words."
            },
            luckyColor: {
              type: Type.STRING,
              description: "A color representing the mood."
            },
            luckyNumber: {
              type: Type.STRING,
              description: "A single lucky number."
            },
            mood: {
              type: Type.STRING,
              description: "One word describing the vibe (e.g., Energetic, Calm)."
            }
          },
          required: ["horoscope", "luckyColor", "luckyNumber", "mood"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from Oracle");
    }

    return JSON.parse(response.text) as FortuneResponse;
  } catch (error) {
    console.error("Oracle Error:", error);
    throw error;
  }
};