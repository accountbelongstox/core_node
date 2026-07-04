#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared AI provider registry — single source of truth for provider identity.

ai_probe / ai_chat / ai_gateway / UI all read THIS module only.
Adding a provider = one entry here + probe handler + chat handler.

Per provider:
  key_base      : secret base name (indexed _1.._5 then bare)
  key_base_fallbacks : extra indexed bases tried after key_base (e.g. reuse an
                  R2 token under CLOUDFLARE_R2_API_TOKEN when no Workers AI token)
  key_names     : legacy explicit precedence
  default_model : fallback when caller passes no model
  free_models   : known free-tier model ids (catalog + probe/chat fallback)
  limits        : human-readable free-tier limits (from provider docs)
  tier          : free | balance | paid (gateway dispatch order)
  client        : openai_compat | cloudflare | spark | (omit = bespoke client module)
  base_url_default / base_url_key : OpenAI-compatible endpoint
  vision / image / image_model : gateway capability flags
"""

from typing import Dict, Any, Tuple, List, Optional, FrozenSet

from pycore.pyfoundations.secret_manager import (
    get_secret_key, get_secret_key_indexed, get_all_secret_keys_indexed,
)
from pycore.pyctl.ai import ai_key_rotation

# Free OpenRouter models (subset; full list: openrouter.ai/models?q=free)
_OPENROUTER_FREE = (
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-3-27b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-r1t2-chimera:free",
)

PROVIDERS: Dict[str, Dict[str, Any]] = {
    "openrouter": {
        "key_base": "OPENROUTER_API_KEY",
        "key_names": ("OPENROUTER_API_KEY_1", "OPENROUTER_API_KEY_2", "OPENROUTER_API_KEY"),
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
        "free_models": _OPENROUTER_FREE,
        "limits": "20 req/min; 50 req/day (<$10 lifetime topup) or 1000/day; shared :free quota",
        "tier": "free",
        "vision": True,
        "image": True,
        # OpenRouter generates images through chat completions with
        # modalities:["image","text"]; this model returns an inline data-URI.
        # (Requires the account to have access to an image-output model.)
        "image_model": "google/gemini-2.5-flash-image",
    },
    "gemini": {
        "key_base": "GOOGLE_API_KEY",
        "key_names": ("GOOGLE_API_KEY_1", "GOOGLE_API_KEY_2", "GOOGLE_API_KEY"),
        "default_model": "gemini-2.5-flash",
        "free_models": (
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemma-3-27b-it",
            "gemma-3-12b-it",
        ),
        "limits": "Free tier: per-model RPM/RPD (e.g. Flash 5 RPM / 20 RPD); no quota API",
        "tier": "free",
        "vision": True,
        "image": True,
        "image_model": "gemini-2.5-flash-image",
    },
    "groq": {
        "key_base": "GROQ_API_KEY",
        "key_names": ("GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY"),
        # llama-3.3-70b-versatile is being retired (Groq shutdown 2026-08-16);
        # default to the current flagship gpt-oss-120b (already in free_models).
        "default_model": "openai/gpt-oss-120b",
        "free_models": (
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "llama-3.1-8b-instant",
            "qwen/qwen3-32b",
        ),
        "limits": "Per-model free limits (e.g. Llama 3.3 70B: 1000 RPD / 12k TPM)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "cerebras": {
        "key_base": "CEREBRAS_API_KEY",
        "key_names": ("CEREBRAS_API_KEY_1", "CEREBRAS_API_KEY_2", "CEREBRAS_API_KEY"),
        # llama-3.3-70b deprecated on Cerebras; default to current gpt-oss-120b.
        "default_model": "gpt-oss-120b",
        "free_models": (
            "gpt-oss-120b",
            "llama3.1-8b",
            "llama-3.3-70b",
        ),
        "limits": "gpt-oss-120b: 30 RPM / 1M TPD; Llama 3.1 8B: 30 RPM / 1M TPD",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "mistral": {
        "key_base": "MISTRAL_API_KEY",
        "key_names": ("MISTRAL_API_KEY_1", "MISTRAL_API_KEY_2", "MISTRAL_API_KEY"),
        "default_model": "mistral-small-latest",
        "free_models": (
            "mistral-small-latest",
            "mistral-large-latest",
            "open-mistral-nemo",
        ),
        "limits": "Experiment plan: 1 req/s, 500k TPM, 1B TPM/month (data training opt-in)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "cohere": {
        "key_base": "COHERE_API_KEY",
        "key_names": ("COHERE_API_KEY_1", "COHERE_API_KEY_2", "COHERE_API_KEY"),
        "default_model": "command-r-plus-08-2024",
        "free_models": (
            "command-r-plus-08-2024",
            "command-r-08-2024",
            "command-r7b-12-2024",
            "c4ai-aya-expanse-32b",
        ),
        "limits": "20 req/min; 1000 req/month (shared monthly quota)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "nvidia": {
        "key_base": "NVIDIA_API_KEY",
        "key_names": ("NVIDIA_API_KEY_1", "NVIDIA_API_KEY_2", "NVIDIA_API_KEY"),
        "default_model": "meta/llama-3.1-8b-instruct",
        "free_models": (
            "meta/llama-3.1-8b-instruct",
            "meta/llama-3.1-70b-instruct",
            "nvidia/nemotron-4-340b-instruct",
        ),
        "limits": "40 req/min; phone verification required on build.nvidia.com",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "huggingface": {
        "key_base": "HF_TOKEN",
        "key_names": ("HF_TOKEN_1", "HF_TOKEN_2", "HF_TOKEN"),
        "default_model": "meta-llama/Llama-3.1-8B-Instruct",
        "free_models": (
            "meta-llama/Llama-3.1-8B-Instruct",
            "meta-llama/Llama-3.1-70B-Instruct",
            "Qwen/Qwen2.5-7B-Instruct",
        ),
        "limits": "$0.10/month serverless credits (models <10GB)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "github": {
        "key_base": "GITHUB_MODELS_TOKEN",
        "key_names": ("GITHUB_MODELS_TOKEN_1", "GITHUB_MODELS_TOKEN_2", "GITHUB_MODELS_TOKEN"),
        "default_model": "openai/gpt-4.1",
        "free_models": (
            "openai/gpt-4.1",
            "openai/gpt-4o-mini",
            "meta-llama/Llama-3.3-70B-Instruct",
            "meta-llama/Llama-3.1-8B-Instruct",
        ),
        "limits": "Low tier (Copilot Free): 15 RPM · 150 RPD · 8000 in / 4000 out tokens; High tier: 10 RPM · 50 RPD",
        "tier": "free",
        "vision": True,
        "image": False,
        "image_model": "",
    },
    "zhipuai": {
        "key_base": "ZHIPUAI_API_KEY",
        "key_names": ("ZHIPUAI_API_KEY_1", "ZHIPUAI_API_KEY_2", "ZHIPUAI_API_KEY"),
        "default_model": "glm-4.7-flash",
        "free_models": (
            "glm-4.7-flash",
            "glm-4-flash-250414",
            "glm-4v-flash",
        ),
        "limits": "Free tier RPM limits; no public quota API (cooldown on 429). "
                  "Image: cogview-3-flash is FREE (concurrency-capped; 429 on burst)",
        "tier": "free",
        "vision": True,
        "image": True,
        # CogView-3-Flash is the free text-to-image model (returns an image URL,
        # POST /api/paas/v4/images/generations on open.bigmodel.cn).
        "image_model": "cogview-3-flash",
    },
    "deepseek": {
        "key_base": "DEEPSEEK_API_KEY",
        "key_names": ("DEEPSEEK_API_KEY_1", "DEEPSEEK_API_KEY"),
        "default_model": "deepseek-chat",
        "free_models": ("deepseek-chat", "deepseek-reasoner"),
        "limits": "No free API tier — prepaid balance only (deepseek-chat / deepseek-reasoner); trial credits may apply for new accounts",
        "tier": "balance",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "openai": {
        "key_base": "OPENAI_API_KEY",
        "key_names": ("OPENAI_API_KEY_1", "OPENAI_API_KEY_2", "OPENAI_API_KEY"),
        "default_model": "gpt-4o-mini",
        "free_models": ("gpt-4o-mini", "gpt-4o"),
        "limits": "Paid API; no free tier quota API (cooldown on 429)",
        "tier": "paid",
        "vision": True,
        "image": True,
        # OpenAI Images API (POST /v1/images/generations). dall-e-3 reliably
        # returns b64_json; gpt-image-1 needs org verification (kept as fallback).
        "image_model": "dall-e-3",
    },
    "anthropic": {
        "key_base": "ANTHROPIC_API_KEY",
        "key_names": ("ANTHROPIC_API_KEY_1", "ANTHROPIC_API_KEY_2", "ANTHROPIC_API_KEY"),
        "default_model": "claude-3-5-haiku-latest",
        "free_models": ("claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"),
        "limits": "Paid API; no balance endpoint (cooldown on 429)",
        "tier": "paid",
        "vision": True,
        "image": False,
        "image_model": "",
    },
    # ---- CN free-tier (OpenAI-compatible unless noted) --------------------
    "cloudflare": {
        "key_base": "CLOUDFLARE_API_TOKEN",
        "key_names": ("CLOUDFLARE_API_TOKEN_1", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_TOKEN"),
        # Reuse the R2 credential set when no dedicated Workers AI token is stored:
        # the R2 API token (cfat_...) and the account id embedded in the R2 S3
        # endpoint are saved under CLOUDFLARE_R2_*; see _cloudflare_account_id().
        # NOTE: an R2-scoped token only authenticates Workers AI if it was issued
        # with the "Workers AI" permission — otherwise the run call returns 403.
        "key_base_fallbacks": ("CLOUDFLARE_R2_API_TOKEN",),
        "extra_secret": "CLOUDFLARE_ACCOUNT_ID",
        "client": "cloudflare",
        "default_model": "@cf/meta/llama-3-8b-instruct",
        "free_models": ("@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3.1-8b-instruct"),
        "limits": "Workers AI free daily neurons allocation (varies by plan). "
                  "Image: SDXL (@cf/stabilityai/...) within the free neuron budget",
        "tier": "free",
        "vision": False,
        "image": True,
        # Cloudflare Workers AI text-to-image (free neurons). POST .../ai/run/{model}
        # with {prompt} -> raw PNG bytes. Needs CLOUDFLARE_API_TOKEN + ACCOUNT_ID.
        "image_model": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    },
    "siliconflow": {
        "key_base": "SILICONFLOW_API_KEY",
        "key_names": ("SILICONFLOW_API_KEY_1", "SILICONFLOW_API_KEY", "SILICONFLOW_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "SILICONFLOW_BASE_URL",
        "base_url_default": "https://api.siliconflow.cn/v1",
        "default_model": "Qwen/Qwen2.5-7B-Instruct",
        "free_models": ("Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V2.5"),
        "limits": "Selected models free (e.g. Qwen2.5-7B); paid models per token. "
                  "Image: Kolors / FLUX / SDXL via /images/generations (very low cost)",
        "tier": "free",
        "vision": False,
        "image": True,
        # SiliconFlow aggregates open-source image models (FLUX/SDXL/Kolors).
        # OpenAI-style POST {base}/images/generations -> {images:[{url}]}.
        # FLUX.1-schnell (Apache-2.0) is the cheapest/free-tier option — kept in
        # sync with the Laravel registry (AiProviderRegistry) for cross-stack parity.
        "image_model": "black-forest-labs/FLUX.1-schnell",
    },
    "dashscope": {
        "key_base": "DASHSCOPE_API_KEY",
        "key_names": ("DASHSCOPE_API_KEY_1", "DASHSCOPE_API_KEY", "DASHSCOPE_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "DASHSCOPE_BASE_URL",
        "base_url_default": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-turbo",
        "free_models": ("qwen-turbo", "qwen-plus", "qwen-max"),
        "limits": "Free quota for qwen-turbo (RPM/RPD per Bailian console). "
                  "Image: wanx (Tongyi Wanxiang) free-trial quota; ASYNC task+poll",
        "tier": "free",
        "vision": True,
        "image": True,
        # Tongyi Wanxiang text-to-image. ASYNC: POST .../text2image/image-synthesis
        # (X-DashScope-Async) -> task_id -> poll /tasks/{id} -> result URL.
        "image_model": "wanx2.1-t2i-turbo",
    },
    "hunyuan": {
        "key_base": "HUNYUAN_API_KEY",
        "key_names": ("HUNYUAN_API_KEY_1", "HUNYUAN_API_KEY", "HUNYUAN_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "HUNYUAN_BASE_URL",
        "base_url_default": "https://api.hunyuan.cloud.tencent.com/v1",
        "default_model": "hunyuan-lite",
        "free_models": ("hunyuan-lite", "hunyuan-standard"),
        "limits": "hunyuan-lite free tier RPM limits (Tencent console)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "qianfan": {
        "key_base": "QIANFAN_API_KEY",
        "key_names": ("QIANFAN_API_KEY_1", "QIANFAN_API_KEY", "QIANFAN_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "QIANFAN_BASE_URL",
        "base_url_default": "https://qianfan.baidubce.com/v2",
        "default_model": "ernie-speed-128k",
        "free_models": ("ernie-speed-128k", "ernie-lite-8k", "ernie-3.5-8k"),
        "limits": "ERNIE speed/lite tiers free RPM (Baidu console). "
                  "Image: ERNIE iRAG (irag-1.0), bearer /v2/images/generations -> URL",
        "tier": "free",
        "vision": False,
        "image": True,
        # Baidu ERNIE iRAG text-to-image (the ERNIE-ViLG successor). Bearer key
        # (bce-v3/ALTAK-.../...); POST {base}/images/generations -> data[].url.
        "image_model": "irag-1.0",
    },
    "spark": {
        "key_base": "SPARK_API_PASSWORD",
        "key_names": ("SPARK_API_PASSWORD_1", "SPARK_API_PASSWORD", "SPARK_API_PASSWORD"),
        "client": "spark",
        "default_model": "lite",
        "free_models": ("lite",),
        "limits": "Spark Lite free tier (iFlytek console RPM). Image: tti v2.1 "
                  "(5000 free points); needs SPARK_APP_ID/SPARK_API_KEY/SPARK_API_SECRET",
        "tier": "free",
        "vision": False,
        "image": True,
        # iFlytek Spark text-to-image (HMAC host/date/request-line signed v2.1/tti;
        # base64 image in payload.choices.text). Uses the APP_ID/API_KEY/API_SECRET
        # triple (NOT the chat api_password) — see _generate_image_with_spark.
        "image_model": "spark-tti-v2.1",
    },
    # ---- prepaid / paid (gateway uses last) -----------------------------
    "volcano": {
        "key_base": "ARK_API_KEY",
        "key_names": ("ARK_API_KEY_1", "ARK_API_KEY", "ARK_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "ARK_BASE_URL",
        "base_url_default": "https://ark.cn-beijing.volces.com/api/v3",
        "default_model": "doubao-1-5-pro-32k",
        "free_models": ("doubao-1-5-lite-32k", "doubao-1-5-pro-32k"),
        "limits": "Volcano Ark prepaid; some lite models have free trial quota. "
                  "Image: Doubao Seedream (photoreal) via /images/generations",
        "tier": "paid",
        "vision": True,
        "image": True,
        # ByteDance Doubao Seedream text-to-image via Volcano Ark (OpenAI-style
        # /images/generations, bearer ARK_API_KEY) -> data[].url.
        "image_model": "doubao-seedream-3-0-t2i-250415",
    },
    "moonshot": {
        "key_base": "MOONSHOT_API_KEY",
        "key_names": ("MOONSHOT_API_KEY_1", "MOONSHOT_API_KEY", "MOONSHOT_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "MOONSHOT_BASE_URL",
        "base_url_default": "https://api.moonshot.cn/v1",
        "default_model": "moonshot-v1-8k",
        "free_models": ("moonshot-v1-8k", "moonshot-v1-32k"),
        "limits": "Prepaid balance; trial credits for new accounts",
        "tier": "paid",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "minimax": {
        "key_base": "MINIMAX_API_KEY",
        "key_names": ("MINIMAX_API_KEY_1", "MINIMAX_API_KEY", "MINIMAX_API_KEY"),
        "client": "openai_compat",
        "base_url_default": "https://api.minimax.chat/v1",
        "default_model": "abab6.5s-chat",
        "free_models": ("abab6.5s-chat",),
        "limits": "Prepaid / package billing (MiniMax console)",
        "tier": "paid",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "stepfun": {
        "key_base": "STEPFUN_API_KEY",
        "key_names": ("STEPFUN_API_KEY_1", "STEPFUN_API_KEY", "STEPFUN_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "STEPFUN_BASE_URL",
        "base_url_default": "https://api.stepfun.com/v1",
        "default_model": "step-1-8k",
        "free_models": ("step-1-8k", "step-2-mini"),
        "limits": "Prepaid balance (StepFun console). Image: step-1x-medium (paid, "
                  "OpenAI-compatible /images/generations) — last-resort backup",
        "tier": "paid",
        "vision": False,
        "image": True,
        # OpenAI-compatible images endpoint (paid; tried only after free backends).
        "image_model": "step-1x-medium",
    },
    "yi": {
        "key_base": "YI_API_KEY",
        "key_names": ("YI_API_KEY_1", "YI_API_KEY", "YI_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "YI_BASE_URL",
        "base_url_default": "https://api.lingyiwanwu.com/v1",
        "default_model": "yi-light",
        "free_models": ("yi-light", "yi-medium"),
        "limits": "Prepaid balance (01.AI console)",
        "tier": "paid",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "xai": {
        "key_base": "XAI_API_KEY",
        "key_names": ("XAI_API_KEY_1", "XAI_API_KEY", "XAI_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "XAI_BASE_URL",
        "base_url_default": "https://api.x.ai/v1",
        "default_model": "grok-2-latest",
        "free_models": ("grok-2-latest", "grok-beta"),
        "limits": "Prepaid credits ($25 free promo may apply for new accounts)",
        "tier": "paid",
        "vision": True,
        "image": False,
        "image_model": "",
    },
    "together": {
        "key_base": "TOGETHER_API_KEY",
        "key_names": ("TOGETHER_API_KEY_1", "TOGETHER_API_KEY", "TOGETHER_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "TOGETHER_BASE_URL",
        "base_url_default": "https://api.together.xyz/v1",
        "default_model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "free_models": (
            "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "mistralai/Mistral-Small-24B-Instruct-2501",
        ),
        "limits": "No free trial — $5 minimum prepaid (docs.together.ai/credits, verified 2026-06-13)",
        "tier": "paid",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    # ---- image-only providers (no chat; image_only excludes from text dispatch) -
    "pollinations": {
        # Public, NO API KEY. GET image.pollinations.ai/prompt/{text} -> image bytes.
        "key_base": "",
        "keyless": True,
        "image_only": True,
        "default_model": "flux",
        "free_models": ("flux", "turbo"),
        "limits": "Free & open, no API key (best-effort public service)",
        "tier": "free",
        "vision": False,
        "image": True,
        "image_model": "flux",
    },
    "imagen": {
        # Google Imagen via the Gemini API key (generativelanguage :predict).
        # Shares GOOGLE_API_KEY; add GOOGLE_API_KEY_IMAGE to isolate its budget.
        "key_base": "GOOGLE_API_KEY",
        "key_names": ("GOOGLE_API_KEY_1", "GOOGLE_API_KEY_2", "GOOGLE_API_KEY"),
        "image_only": True,
        # Imagen 3 was shut down on the Gemini API (404); use Imagen 4 (GA).
        "default_model": "imagen-4.0-generate-001",
        "free_models": ("imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"),
        "limits": "Imagen 4 via Gemini API (billed; Vertex $300 trial / paid tier)",
        "tier": "paid",
        "vision": False,
        "image": True,
        "image_model": "imagen-4.0-generate-001",
    },
    "azure": {
        # Azure OpenAI DALL-E 3. Needs AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT
        # (+ optional AZURE_OPENAI_IMAGE_DEPLOYMENT, default 'dall-e-3').
        "key_base": "AZURE_OPENAI_API_KEY",
        "key_names": ("AZURE_OPENAI_API_KEY_1", "AZURE_OPENAI_API_KEY_2", "AZURE_OPENAI_API_KEY"),
        "extra_required": ("AZURE_OPENAI_ENDPOINT",),
        "image_only": True,
        "default_model": "dall-e-3",
        "free_models": ("dall-e-3",),
        "limits": "Azure OpenAI DALL-E 3 ($200 new-account credit; paid after)",
        "tier": "paid",
        "vision": False,
        "image": True,
        "image_model": "dall-e-3",
    },
    "bedrock": {
        # AWS Bedrock Titan Image Generator (SigV4-signed). Needs
        # AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ optional AWS_REGION).
        "key_base": "AWS_ACCESS_KEY_ID",
        "key_names": ("AWS_ACCESS_KEY_ID_1", "AWS_ACCESS_KEY_ID"),
        "extra_required": ("AWS_SECRET_ACCESS_KEY",),
        "image_only": True,
        "default_model": "amazon.titan-image-generator-v1",
        "free_models": ("amazon.titan-image-generator-v1",),
        "limits": "AWS Bedrock Titan Image G1 (photoreal; paid, new-account credits)",
        "tier": "paid",
        "vision": False,
        "image": True,
        "image_model": "amazon.titan-image-generator-v1",
    },
    "vertex": {
        # Google Vertex AI Imagen via SERVICE-ACCOUNT OAuth (RS256 JWT -> token,
        # via google-auth). Secrets: GOOGLE_VERTEX_SA_JSON (the FULL service-account
        # JSON) + VERTEX_PROJECT_ID (+ optional VERTEX_REGION, default us-central1).
        "key_base": "GOOGLE_VERTEX_SA_JSON",
        "extra_required": ("VERTEX_PROJECT_ID",),
        "image_only": True,
        "default_model": "imagen-4.0-generate-001",
        "free_models": ("imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"),
        "limits": "Vertex AI Imagen ($300 new-account credit; service-account OAuth)",
        "tier": "paid",
        "vision": False,
        "image": True,
        "image_model": "imagen-4.0-generate-001",
    },
}

# Dispatch order: free → balance → paid; within tier = list order.
# ``together`` is deliberately last (cheapest paid fallback after all free/balance).
PROVIDER_ORDER: Tuple[str, ...] = (
    "openrouter", "gemini", "groq", "cerebras", "mistral", "cohere",
    "nvidia", "huggingface", "github", "cloudflare",
    "siliconflow", "dashscope", "hunyuan", "qianfan", "spark", "zhipuai",
    "deepseek",
    "volcano", "moonshot", "minimax", "stepfun", "yi",
    "openai", "anthropic", "xai",
    "together",
    # image-only providers (listed after chat providers)
    "pollinations", "imagen", "azure", "bedrock", "vertex",
)

OPENAI_COMPAT_PROVIDERS: FrozenSet[str] = frozenset(
    n for n, m in PROVIDERS.items() if m.get("client") == "openai_compat"
)


def all_secrets(provider: str) -> List[str]:
    """ALL keys for the provider in rotation order (indexed variants then bare,
    then any explicit ``key_names``), de-duplicated — the rotation pool. Keyless
    providers (no API key needed) return a single placeholder slot."""
    meta = PROVIDERS.get(provider, {})
    if meta.get("keyless"):
        return [""]  # one slot so rotation/counters work; the helper needs no key
    keys: List[str] = []
    seen = set()
    base = meta.get("key_base")
    if base:
        for v in get_all_secret_keys_indexed(base):
            if v not in seen:
                seen.add(v)
                keys.append(v)
    for fallback_base in meta.get("key_base_fallbacks", ()):
        for v in get_all_secret_keys_indexed(fallback_base):
            if v not in seen:
                seen.add(v)
                keys.append(v)
    for name in meta.get("key_names", ()):
        v = get_secret_key(name)
        if v and v not in seen:
            seen.add(v)
            keys.append(v)
    return keys


def active_secret(provider: str) -> Tuple[int, str]:
    """(slot_index, key) for the active (non-cooled) key — the rotation picks the
    first key not on cooldown. (-1, '') when the provider has no key."""
    return ai_key_rotation.select_active(provider, all_secrets(provider))


def first_secret(provider: str) -> str:
    """Active (non-cooled) key for the provider (or ''). Now rotation-aware: when
    the current key is cooling down after a 429/quota hit, this returns the NEXT
    key automatically, so every call site rotates with no extra plumbing."""
    return active_secret(provider)[1]


def all_image_secrets(provider: str) -> List[str]:
    """Image rotation pool: dedicated image keys (``{BASE}_IMAGE``...) if any,
    else the provider's normal key list. Keyless providers return one slot."""
    meta = PROVIDERS.get(provider, {})
    if meta.get("keyless"):
        return [""]
    base = meta.get("key_base")
    img = get_all_secret_keys_indexed(f"{base}_IMAGE") if base else []
    return img if img else all_secrets(provider)


def active_image_secret(provider: str) -> Tuple[int, str]:
    """(slot_index, key) for the active IMAGE key. Image rotation state is kept
    under a separate ``{provider}#image`` namespace so image cooldowns never
    block text and vice-versa (independent budgets)."""
    return ai_key_rotation.select_active(f"{provider}#image", all_image_secrets(provider))


def image_first_secret(provider: str) -> str:
    """Active (non-cooled) IMAGE key, preferring a DEDICATED image key so the
    image budget is isolated from heavy text usage. Add e.g.
    ``GOOGLE_API_KEY_IMAGE`` / ``ZHIPUAI_API_KEY_IMAGE`` (indexed ``_IMAGE_1..5``)
    to give image its own provider-side quota."""
    return active_image_secret(provider)[1]


def has_image_key(provider: str) -> bool:
    """True when the provider can generate images now: keyless, or at least one
    image-usable key exists (dedicated or normal)."""
    if PROVIDERS.get(provider, {}).get("keyless"):
        return True
    return any(all_image_secrets(provider))


# -------------------- rotation cooldown / status helpers --------------------

def mark_text_key_cooldown(provider: str, secs: Optional[float] = None,
                           error: Optional[str] = None) -> None:
    """Cool down the provider's CURRENT text key after a 429/quota hit so the
    next call rotates to the next key."""
    idx, _ = active_secret(provider)
    ai_key_rotation.mark_cooldown(
        provider, idx, secs if secs is not None else ai_key_rotation.DEFAULT_KEY_COOLDOWN_S, error)


def mark_image_key_cooldown(provider: str, idx: int, secs: Optional[float] = None,
                            error: Optional[str] = None) -> None:
    """Cool down a specific IMAGE key slot (the gateway threads the slot it used)."""
    ai_key_rotation.mark_cooldown(
        f"{provider}#image", idx,
        secs if secs is not None else ai_key_rotation.DEFAULT_KEY_COOLDOWN_S, error)


def record_image_key(provider: str, idx: int, ok: bool, error: Optional[str] = None) -> None:
    """Count one image attempt against a key slot (UI stats + per-key rate)."""
    ai_key_rotation.record(f"{provider}#image", idx, ok, error)


def record_text_key(provider: str, idx: int, ok: bool, error: Optional[str] = None) -> None:
    """Count one TEXT attempt against a key slot (UI stats + per-key rate)."""
    ai_key_rotation.record(provider, idx, ok, error)


def text_key_rate_ok(provider: str, idx: int,
                     rpm: Optional[int] = None, rpd: Optional[int] = None) -> bool:
    """True when the active TEXT key is within its own per-key minute/day budget."""
    return ai_key_rotation.rate_ok(provider, idx, rpm, rpd)


def image_key_rate_ok(provider: str, idx: int,
                      rpm: Optional[int] = None, rpd: Optional[int] = None) -> bool:
    """True when the active IMAGE key is within its own per-key minute/day budget."""
    return ai_key_rotation.rate_ok(f"{provider}#image", idx, rpm, rpd)


def image_ready_now(provider: str) -> bool:
    """True when the provider has an image key that is NOT on cooldown right now —
    used to SKIP dead/blocked/rate-limited providers in the image dispatch chain."""
    return ai_key_rotation.has_ready_key(f"{provider}#image", all_image_secrets(provider))


def reset_text_key_cooldown(provider: str, idx: Optional[int] = None) -> int:
    """Manually clear the text-key cooldown for one slot or all (UI override)."""
    return ai_key_rotation.reset_cooldown(provider, idx)


def reset_image_key_cooldown(provider: str, idx: Optional[int] = None) -> int:
    """Manually clear the image-key cooldown for one slot or all (UI override)."""
    return ai_key_rotation.reset_cooldown(f"{provider}#image", idx)


def key_status(provider: str) -> List[Dict[str, Any]]:
    """Per-key text rotation status (index / masked / cooldown_s / counters)."""
    return ai_key_rotation.status(provider, all_secrets(provider))


def image_key_status(provider: str) -> List[Dict[str, Any]]:
    """Per-key IMAGE rotation status."""
    return ai_key_rotation.status(f"{provider}#image", all_image_secrets(provider))


def key_count(provider: str) -> int:
    """Number of keys configured for the provider (rotation pool size)."""
    return len(all_secrets(provider))


def _cloudflare_account_id() -> str:
    """Cloudflare account id for Workers AI. Prefer an explicit CLOUDFLARE_ACCOUNT_ID,
    then a bare CLOUDFLARE_R2_ACCOUNT_ID, else derive it from the R2 S3 endpoint
    (https://<account_id>.r2.cloudflarestorage.com) that ships with the R2 keys."""
    acct = get_secret_key_indexed("CLOUDFLARE_ACCOUNT_ID") or get_secret_key("CLOUDFLARE_ACCOUNT_ID")
    if acct:
        return acct
    acct = get_secret_key_indexed("CLOUDFLARE_R2_ACCOUNT_ID") or get_secret_key("CLOUDFLARE_R2_ACCOUNT_ID")
    if acct:
        return acct
    endpoint = get_secret_key_indexed("CLOUDFLARE_R2_S3_ENDPOINT") or get_secret_key("CLOUDFLARE_R2_S3_ENDPOINT")
    if endpoint:
        host = endpoint.split("://", 1)[-1].split("/", 1)[0]
        sub = host.split(".", 1)[0]
        if sub and "r2.cloudflarestorage.com" in host:
            return sub
    return ""


def extra_secret(provider: str, key_name: Optional[str] = None) -> str:
    """Secondary secret (e.g. CLOUDFLARE_ACCOUNT_ID)."""
    meta = PROVIDERS.get(provider, {})
    name = key_name or meta.get("extra_secret")
    if name:
        val = get_secret_key_indexed(name) or get_secret_key(name)
        if val:
            return val
    # Cloudflare: fall back to the account id carried by the R2 credential set.
    if provider == "cloudflare" and (key_name is None or key_name == meta.get("extra_secret")):
        return _cloudflare_account_id()
    return ""


def base_url(provider: str) -> str:
    """Resolved API base URL for OpenAI-compatible providers."""
    meta = PROVIDERS.get(provider, {})
    url_key = meta.get("base_url_key")
    if url_key:
        val = get_secret_key(url_key) or get_secret_key_indexed(url_key)
        if val:
            return str(val).strip().rstrip("/")
    return str(meta.get("base_url_default", "")).strip().rstrip("/")


def is_configured(provider: str) -> bool:
    """True when required secrets are present."""
    meta = PROVIDERS.get(provider, {})
    if meta.get("keyless"):
        return True  # public, no-key provider (e.g. Pollinations)
    if not first_secret(provider):
        return False
    # Providers needing a secondary secret to actually work.
    for extra in meta.get("extra_required", ()):
        if not extra_secret(provider, extra):
            return False
    if provider == "cloudflare" and not extra_secret("cloudflare"):
        return False
    return True


def is_image_only(provider: str) -> bool:
    """True for providers that ONLY generate images (no chat) — excluded from the
    text dispatch chain."""
    return bool(PROVIDERS.get(provider, {}).get("image_only"))


def default_model(provider: str) -> str:
    return PROVIDERS.get(provider, {}).get("default_model", "")


def image_model(provider: str) -> str:
    return PROVIDERS.get(provider, {}).get("image_model", "")


def free_models(provider: str) -> Tuple[str, ...]:
    return tuple(PROVIDERS.get(provider, {}).get("free_models", ()))


def limits_note(provider: str) -> str:
    return str(PROVIDERS.get(provider, {}).get("limits", ""))


def catalog_models(provider: str, max_count: int = 5) -> List[str]:
    """Registry model catalog (free-tier ids) for probe/chat when live list is empty."""
    return list(free_models(provider))[:max_count]


__all__ = [
    "PROVIDERS", "PROVIDER_ORDER", "OPENAI_COMPAT_PROVIDERS",
    "first_secret", "image_first_secret", "has_image_key",
    "all_secrets", "all_image_secrets", "active_secret", "active_image_secret",
    "mark_text_key_cooldown", "mark_image_key_cooldown",
    "record_image_key", "record_text_key", "text_key_rate_ok", "image_key_rate_ok",
    "image_ready_now", "reset_text_key_cooldown", "reset_image_key_cooldown",
    "key_status", "image_key_status", "key_count",
    "extra_secret", "base_url", "is_configured", "is_image_only",
    "default_model", "image_model",
    "free_models", "limits_note", "catalog_models",
]
