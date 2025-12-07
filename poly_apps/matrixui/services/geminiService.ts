import { GoogleGenAI, Type } from "@google/genai";
import { Unit, AICommandResponse } from "../types";

// Initialize the client. API_KEY is expected to be in process.env
// Note: In a production frontend app, be careful exposing API keys. 
// For this demo, we assume the environment variable is injected safely.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash';

export const analyzeCommand = async (
  command: string,
  units: Unit[]
): Promise<AICommandResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found. Please set process.env.API_KEY.");
  }

  // We send a simplified version of units to save tokens, 
  // keeping essential data for decision making.
  const unitSummary = units.map(u => ({
    id: u.id,
    type: u.type,
    status: u.status,
    battery: u.battery,
    temp: u.temperature,
    cpu: u.cpuLoad
  }));

  const prompt = `
    You are the Central AI Core of the Nexus Fleet Command system.
    Current System State (Simplified): ${JSON.stringify(unitSummary)}
    
    User Command: "${command}"
    
    Analyze the command and the system state. 
    1. Identify which units match the user's intent (by status, type, ID, or low battery/high temp conditions).
    2. Determine the appropriate action to take.
    3. Provide a brief analysis string explaining your decision.
    
    Valid Actions: 'REBOOT', 'SHUTDOWN', 'ACTIVATE', 'OPTIMIZE' (reduces load), 'DIAGNOSE', 'UPDATE_FIRMWARE', 'NONE'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are a precise and efficient fleet management AI. Respond only in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            targetUnitIds: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            action: { 
              type: Type.STRING, 
              enum: ['REBOOT', 'SHUTDOWN', 'ACTIVATE', 'OPTIMIZE', 'DIAGNOSE', 'UPDATE_FIRMWARE', 'NONE']
            }
          },
          required: ['analysis', 'targetUnitIds', 'action']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AICommandResponse;
    }
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      analysis: "Failed to process command due to neural link error.",
      targetUnitIds: [],
      action: 'NONE'
    };
  }
};
