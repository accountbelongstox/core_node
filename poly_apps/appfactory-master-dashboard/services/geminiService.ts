
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY ?? '' });

interface MarketingCopy {
  slogan: string;
  benefits: string[];
}

/**
 * 生成应用营销文案
 * 
 * catch 代码必要性：必须保留
 * 原因：外部 API 调用可能失败（网络错误、API 限制、服务不可用等）
 * 需要捕获错误并返回 null，避免应用崩溃
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
