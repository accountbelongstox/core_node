# -*- coding: utf-8 -*-
"""
Translator Router - Static routes for Google Translator

Provides hardcoded routes for translator functions to avoid repeated module loading.
"""

from typing import Optional
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
APIRouter = fastapi.APIRouter
HTTPException = fastapi.HTTPException

from pydantic import BaseModel

# Pre-load translator module (singleton pattern)
_translator_instance = None


def get_translator():
    """Get or create translator singleton instance"""
    global _translator_instance
    if _translator_instance is None:
        from pycore.pyutils.translator import GoogleTranslator
        _translator_instance = GoogleTranslator()
    return _translator_instance


# Request/Response models
class TranslateSingleRequest(BaseModel):
    text: str
    src: str = "auto"
    dest: str = "en"
    use_cache: bool = True


class DetectLanguageRequest(BaseModel):
    text: str


class TranslateBatchRequest(BaseModel):
    texts: list[str]
    src: str = "auto"
    dest: str = "en"
    use_cache: bool = True


# Create router
translator_router = APIRouter(prefix="/translator", tags=["translator"])


@translator_router.post("/translate_single")
async def translate_single(req: TranslateSingleRequest):
    """
    Translate single text
    
    Args:
        text: Text to translate
        src: Source language code (default: "auto")
        dest: Destination language code (default: "en")
        use_cache: Use cache if available (default: True)
    
    Returns:
        Translation result with original text, translated text, language codes
    """
    try:
        translator = get_translator()
        
        async with translator as trans:
            result = await trans.translate_single(
                text=req.text,
                src=req.src,
                dest=req.dest,
                use_cache=req.use_cache
            )
        
        return {
            "success": True,
            "result": {
                "original_text": result.original_text,
                "translated_text": result.translated_text,
                "src_lang": result.src_lang,
                "dest_lang": result.dest_lang,
                "from_cache": result.from_cache
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@translator_router.post("/detect_language")
async def detect_language(req: DetectLanguageRequest):
    """
    Detect language of text
    
    Args:
        text: Text to detect language
    
    Returns:
        Detected language code and confidence
    """
    try:
        translator = get_translator()
        
        async with translator as trans:
            result = await trans.detect_language(text=req.text)
        
        return {
            "success": True,
            "result": {
                "lang": result["lang"],
                "confidence": result.get("confidence", 1.0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@translator_router.post("/translate_batch")
async def translate_batch(req: TranslateBatchRequest):
    """
    Batch translate multiple texts
    
    Args:
        texts: List of texts to translate
        src: Source language code (default: "auto")
        dest: Destination language code (default: "en")
        use_cache: Use cache if available (default: True)
    
    Returns:
        List of translation results
    """
    try:
        translator = get_translator()
        
        async with translator as trans:
            results = await trans.translate_batch(
                texts=req.texts,
                src=req.src,
                dest=req.dest,
                use_cache=req.use_cache
            )
        
        return {
            "success": True,
            "results": [
                {
                    "original_text": r.original_text,
                    "translated_text": r.translated_text,
                    "src_lang": r.src_lang,
                    "dest_lang": r.dest_lang,
                    "from_cache": r.from_cache
                }
                for r in results
            ],
            "total": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


__all__ = ["translator_router"]
