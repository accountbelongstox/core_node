"""健康检查路由"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "ok",
        "service": "pyMatrix",
        "version": "1.0.0"
    }


@router.get("/")
async def root():
    """根路径"""
    return {
        "message": "pyMatrix API Server",
        "version": "1.0.0",
        "docs": "/docs"
    }
