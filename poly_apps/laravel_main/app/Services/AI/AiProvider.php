<?php

namespace App\Services\AI;

enum AiProvider: string
{
    case Anthropic = 'anthropic';
    case ClaudeCode = 'claude-code';
    case Cohere = 'cohere';
    case DeepSeek = 'deepseek';
    case Gemini = 'gemini';
    case OpenAI = 'openai';
    case OpenRouter = 'openrouter';
    case OpenRouterFree = 'openrouter-free';
    case Qwen = 'qwen';
    case Volcano = 'volcano';
}
