#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared AI provider registry — single source of truth for provider identity.

ai_probe / ai_chat / ai_gateway / UI all read THIS module only.
Adding a provider = one entry here + probe handler + chat handler.

Per provider:
  key_base      : secret base name (indexed _1.._5 then bare)
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

from pycore.pyfoundations.secret_manager import get_secret_key, get_secret_key_indexed

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
        "default_model": "llama-3.3-70b-versatile",
        "free_models": (
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
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
        "default_model": "llama-3.3-70b",
        "free_models": (
            "llama-3.3-70b",
            "llama3.1-8b",
            "gpt-oss-120b",
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
        "default_model": "glm-4-flash",
        "free_models": (
            "glm-4-flash",
            "glm-4",
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
        "extra_secret": "CLOUDFLARE_ACCOUNT_ID",
        "client": "cloudflare",
        "default_model": "@cf/meta/llama-3-8b-instruct",
        "free_models": ("@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3.1-8b-instruct"),
        "limits": "Workers AI free daily neurons allocation (varies by plan)",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
    },
    "siliconflow": {
        "key_base": "SILICONFLOW_API_KEY",
        "key_names": ("SILICONFLOW_API_KEY_1", "SILICONFLOW_API_KEY", "SILICONFLOW_API_KEY"),
        "client": "openai_compat",
        "base_url_key": "SILICONFLOW_BASE_URL",
        "base_url_default": "https://api.siliconflow.cn/v1",
        "default_model": "Qwen/Qwen2.5-7B-Instruct",
        "free_models": ("Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V2.5"),
        "limits": "Selected models free (e.g. Qwen2.5-7B); paid models per token",
        "tier": "free",
        "vision": False,
        "image": False,
        "image_model": "",
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
        "limits": "Volcano Ark prepaid; some lite models have free trial quota",
        "tier": "paid",
        "vision": True,
        "image": False,
        "image_model": "",
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
)

OPENAI_COMPAT_PROVIDERS: FrozenSet[str] = frozenset(
    n for n, m in PROVIDERS.items() if m.get("client") == "openai_compat"
)


def first_secret(provider: str) -> str:
    """First non-empty secret for the provider (or '')."""
    meta = PROVIDERS.get(provider, {})
    base = meta.get("key_base")
    if base:
        val = get_secret_key_indexed(base)
        if val:
            return val
    for name in meta.get("key_names", ()):
        val = get_secret_key(name)
        if val:
            return val
    return ""


def image_first_secret(provider: str) -> str:
    """Key for IMAGE generation, preferring a DEDICATED image key so the image
    budget is isolated from heavy text usage.

    Tries ``{key_base}_IMAGE`` (indexed ``_IMAGE_1..5`` then bare ``_IMAGE``)
    first, then falls back to the provider's normal key. Add e.g.
    ``GOOGLE_API_KEY_IMAGE`` / ``ZHIPUAI_API_KEY_IMAGE`` to give image its own
    provider-side quota (text usage on the normal key can't exhaust it).
    """
    meta = PROVIDERS.get(provider, {})
    base = meta.get("key_base")
    if base:
        val = get_secret_key_indexed(f"{base}_IMAGE")
        if val:
            return val
    return first_secret(provider)


def has_image_key(provider: str) -> bool:
    """True when an image-usable key exists (dedicated image key OR normal key)."""
    return bool(image_first_secret(provider))


def extra_secret(provider: str, key_name: Optional[str] = None) -> str:
    """Secondary secret (e.g. CLOUDFLARE_ACCOUNT_ID)."""
    meta = PROVIDERS.get(provider, {})
    name = key_name or meta.get("extra_secret")
    if not name:
        return ""
    val = get_secret_key_indexed(name)
    if val:
        return val
    return get_secret_key(name) or ""


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
    if not first_secret(provider):
        return False
    if provider == "cloudflare" and not extra_secret("cloudflare"):
        return False
    return True


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
    "extra_secret", "base_url", "is_configured",
    "default_model", "image_model",
    "free_models", "limits_note", "catalog_models",
]
