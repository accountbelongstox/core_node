/**
 * Ambient type declarations for "@google/genai".
 *
 * The package is loaded at runtime via the importmap CDN entry in index.html
 * (https://aistudiocdn.com/@google/genai). It is not installed in node_modules,
 * so TypeScript needs this ambient declaration to type-check the existing
 * runtime usage in services/geminiService.ts. This file adds types only and
 * does not affect runtime behavior.
 */
declare module '@google/genai' {
  export interface GenAIPart {
    text?: string;
    inlineData?: {
      mimeType?: string;
      data: string;
    };
  }

  export interface GenAIContent {
    role?: string;
    parts: GenAIPart[];
  }

  export interface GenerateContentResponse {
    text?: string;
    candidates?: Array<{
      content: {
        parts: GenAIPart[];
      };
    }>;
  }

  export interface Chat {
    sendMessage(params: { message: string }): Promise<GenerateContentResponse>;
  }

  export interface ChatCreateParams {
    model: string;
    config?: {
      systemInstruction?: string;
      [key: string]: any;
    };
    history?: Array<{ role: string; parts: { text: string }[] }>;
  }

  export interface GenerateContentParams {
    model: string;
    contents: string | { parts: GenAIPart[] };
    config?: {
      systemInstruction?: string;
      [key: string]: any;
    };
  }

  export class GoogleGenAI {
    constructor(options: { apiKey?: string });
    chats: {
      create(params: ChatCreateParams): Chat;
    };
    models: {
      generateContent(params: GenerateContentParams): Promise<GenerateContentResponse>;
    };
  }
}
