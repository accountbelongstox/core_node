
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getPlanRecommendation = async (userPrompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User asks: "${userPrompt}". 
      Based on our plans:
      - Free: 50k tokens, basic usage.
      - Pro ($29): 5M tokens, API access, priority.
      - Ultimate ($99): Unlimited tokens, dedicated compute.
      Recommend a plan and explain why briefly. Keep it professional and helpful.`,
      config: {
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    });
    return response.text || "I'm sorry, I couldn't generate a recommendation right now.";
  } catch (error) {
    console.error("Gemini recommendation failed:", error);
    return "Our system is currently busy. Please check our plans page for more details!";
  }
};
