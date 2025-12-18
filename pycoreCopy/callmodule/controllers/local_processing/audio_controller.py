# -*- coding: utf-8 -*-
"""Audio Controller"""
from ...services.processors import AudioProcessor
from ...models.local_processing.audio_models import AudioTranscribeRequest, AudioTranscribeResponse

class AudioController:
    def __init__(self):
        self.processor = AudioProcessor()
    
    def transcribe(self, request: AudioTranscribeRequest) -> AudioTranscribeResponse:
        audio_path = request.audio_path or request.audio_url
        config = {
            "engine": request.engine,
            "model": request.model,
            "language": request.language,
            "generate_subtitle": request.generate_subtitle,
            "subtitle_format": request.subtitle_format
        }
        result = self.processor.transcribe(audio_path, config)
        return AudioTranscribeResponse(
            success=result.get("success", False),
            message=result.get("message", "Transcription completed"),
            full_text=result.get("full_text"),
            segments=result.get("segments"),
            language=result.get("language"),
            engine_used=result.get("engine_used"),
            model_used=result.get("model_used"),
            subtitle_path=result.get("subtitle_path"),
            audio_duration=result.get("audio_duration"),
            execution_time=result.get("execution_time", 0.0),
            error=result.get("error")
        )
