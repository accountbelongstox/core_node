# -*- coding: utf-8 -*-
"""File Router"""
from pycore.pyfoundations.third_party import get_third_package_fastapi
fastapi = get_third_package_fastapi()
from ...controllers.local_processing import FileController
from ...models.local_processing.file_models import FileAnalyzeRequest, FileAnalyzeResponse

router = fastapi.APIRouter(prefix="/api/local/file", tags=["Local Processing - File"])
controller = FileController()

@router.post("/analyze", response_model=FileAnalyzeResponse)
async def analyze_file(request: FileAnalyzeRequest):
    """Analyze file and extract content (PDF, DOCX, XLSX, etc.)"""
    return controller.analyze(request)
