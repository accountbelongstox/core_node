"""
OCR Result Data Class

Standardized result format for all OCR operations.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class OCRResult:
    """Standardized OCR result format"""

    success: bool = False
    text: str = ""
    confidence: float = 0.0
    words: List[Dict[str, Any]] = field(default_factory=list)
    provider: str = ""
    processing_time: float = 0.0
    error: Optional[str] = None
    raw_response: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            "success": self.success,
            "text": self.text,
            "confidence": self.confidence,
            "words": self.words,
            "provider": self.provider,
            "processing_time": self.processing_time,
            "error": self.error,
            "raw_response": self.raw_response
        }

    def to_json_safe_dict(self) -> Dict[str, Any]:
        """Convert result to JSON-safe dictionary (without raw_response)"""
        result = self.to_dict()
        result.pop("raw_response", None)
        return result


__all__ = ['OCRResult']
