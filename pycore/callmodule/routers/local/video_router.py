# -*- coding: utf-8 -*-
"""Video Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.local_processing import VideoController
from ...models.local_processing.video_models import VideoProcessRequest, VideoProcessResponse

router = fastapi.APIRouter(prefix="/api/local/video", tags=["Local Processing - Video"])
controller = VideoController()

@router.post("/process", response_model=VideoProcessResponse)
async def process_video(request: VideoProcessRequest):
    """Process video (extract audio, generate subtitle, compress)"""
    return controller.process(request)
