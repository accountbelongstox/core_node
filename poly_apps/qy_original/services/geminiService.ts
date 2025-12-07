import { GoogleGenerativeAI } from "@google/generative-ai";
import { TEXT_MODEL, IMAGE_GEN_MODEL, VISION_MODEL, CHAT_SYSTEM_INSTRUCTION } from "../constants";

// Initialize the client
const getAiClient = () => {
  return new GoogleGenerativeAI(process.env.API_KEY || process.env.GEMINI_API_KEY || '');
};

/**
 * Generates text response for the Chat mode
 */
export const generateChatResponse = async (
  message: string, 
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    const genAI = getAiClient();
    const model = genAI.getGenerativeModel({ 
      model: TEXT_MODEL,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION
    });

    // Convert history format to the format expected by the SDK
    const chatHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: h.parts.map((p: any) => ({ text: p.text }))
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text() || "No response generated.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    throw new Error(error.message || "Failed to generate chat response");
  }
};

/**
 * Generates creative text based on a prompt (for MuseView)
 */
export const generateCreativeText = async (prompt: string): Promise<string> => {
  try {
    const genAI = getAiClient();
    const model = genAI.getGenerativeModel({ 
      model: TEXT_MODEL,
      systemInstruction: "You are Lumina, a creative muse. You are poetic, imaginative, and concise."
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "I am at a loss for words.";
  } catch (error: any) {
    console.error("Creative Text Error:", error);
    throw new Error(error.message || "Failed to generate creative text");
  }
};

/**
 * Generates an image using gemini-2.5-flash-image
 * Returns a base64 data URL
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const genAI = getAiClient();
    const model = genAI.getGenerativeModel({ model: IMAGE_GEN_MODEL });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check for image data in the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if ('inlineData' in part && part.inlineData) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64Data}`;
        }
      }
    }

    throw new Error("No image data found in response. The model might have refused the request.");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    throw new Error(error.message || "Failed to generate image");
  }
};

/**
 * Alias/Wrapper for creative image generation (for CanvasView)
 */
export const generateCreativeImage = async (prompt: string): Promise<string> => {
  return generateImage(prompt);
};

/**
 * Analyzes an uploaded image
 */
export const analyzeImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
  try {
    const genAI = getAiClient();
    const model = genAI.getGenerativeModel({ model: VISION_MODEL });
    
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      prompt
    ]);
    
    const response = await result.response;
    return response.text() || "Analysis complete, but no text returned.";
  } catch (error: any) {
    console.error("Vision Error:", error);
    throw new Error(error.message || "Failed to analyze image");
  }
};
