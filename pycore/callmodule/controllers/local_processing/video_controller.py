# -*- coding: utf-8 -*-
"""Video Controller"""
from pycore.callmodule.services.processors.video_processor import VideoProcessor
from ...models.local_processing.video_models import VideoProcessRequest, VideoProcessResponse

class VideoController:
    def __init__(self):
        self.processor = VideoProcessor()
    
    def process(self, request: VideoProcessRequest) -> VideoProcessResponse:
        video_path = request.video_path or request.video_url
        config = {
            "extract_audio": request.extract_audio,
            "audio_format": request.audio_format,
            "generate_subtitle": request.generate_subtitle,
            "subtitle_format": request.subtitle_format,
            "transcribe_language": request.transcribe_language,
            "compress_video": request.compress_video,
            "compress_crf": request.compress_crf
        }
        result = self.processor.process_video(video_path, config)
        return VideoProcessResponse(
            success=result.get("success", False),
            message=result.get("message", "Video processing completed"),
            video_metadata=result.get("video_metadata"),
            extracted_audio_path=result.get("extracted_audio_path"),
            extracted_audio_format=result.get("extracted_audio_format"),
            subtitle_path=result.get("subtitle_path"),
            subtitle_format=result.get("subtitle_format"),
            compressed_video_path=result.get("compressed_video_path"),
            transcription_text=result.get("transcription_text"),
            execution_time=result.get("execution_time", 0.0),
            error=result.get("error")
        )
