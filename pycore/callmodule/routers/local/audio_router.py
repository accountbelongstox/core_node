# -*- coding: utf-8 -*-
"""Audio Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.local_processing import AudioController
from ...models.local_processing.audio_models import AudioTranscribeRequest, AudioTranscribeResponse

router = fastapi.APIRouter(prefix="/api/local/audio", tags=["Local Processing - Audio"])
controller = AudioController()

@router.post("/transcribe", response_model=AudioTranscribeResponse)
async def transcribe_audio(request: AudioTranscribeRequest):
    """Transcribe audio file with optional subtitle generation"""
    return controller.transcribe(request)
