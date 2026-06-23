
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY ?? '' });

interface MarketingCopy {
  slogan: string;
  benefits: string[];
}

/**
 * Generate application marketing copy
 * 
 * Error handling is necessary and must be kept
 * Reason: External API calls may fail (network errors, API limits, service unavailable, etc.)
 * Need to catch errors and return null to prevent application crash
 */
export const generateAppMarketingCopy = async (appName: string, description: string): Promise<MarketingCopy | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a high-converting marketing slogan and 3 key benefits for a mobile app named "${appName}" with the following description: "${description}". Format as JSON with "slogan" and "benefits" keys.`,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text ?? '{}') as MarketingCopy;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
