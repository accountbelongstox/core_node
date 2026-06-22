import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { TEXT_MODEL, IMAGE_GEN_MODEL, VISION_MODEL, CHAT_SYSTEM_INSTRUCTION } from "../constants";

// Initialize the client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Generates text response for the Chat mode
 */
export const generateChatResponse = async (
  message: string, 
  history: { role: string; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    const ai = getAiClient();
    // We create a chat session to maintain context
    // Note: In a real persistence scenario, we would reconstruct history fully.
    // For this demo, we'll start a fresh chat or use the provided history structure if the SDK supported strictly stateless history injection easily.
    // However, to keep it simple and robust per instructions:
    
    const chat = ai.chats.create({
      model: TEXT_MODEL,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    const response: GenerateContentResponse = await chat.sendMessage({ message });
    return response.text || "No response generated.";
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
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are Lumina, a creative muse. You are poetic, imaginative, and concise.",
      }
    });
    return response.text || "I am at a loss for words.";
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
    const ai = getAiClient();
    
    // Per guidelines: "Generate images using gemini-2.5-flash-image by default"
    // The output response may contain both image and text parts.
    const response = await ai.models.generateContent({
      model: IMAGE_GEN_MODEL,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        // Optional config if we wanted to enforce aspect ratio, but adhering to defaults for Flash Image
      }
    });

    // Iterate to find the image part
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          // Usually returns PNG or JPEG, assume PNG if mimeType is generic or missing, but SDK provides it.
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64EncodeString}`;
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
    const ai = getAiClient();
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: VISION_MODEL, // Using 2.5 flash for multimodal input
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text || "Analysis complete, but no text returned.";
  } catch (error: any) {
    console.error("Vision Error:", error);
    throw new Error(error.message || "Failed to analyze image");
  }
};
