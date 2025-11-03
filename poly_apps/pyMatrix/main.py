"""
pyMatrix 主入口

FastAPI 后端服务
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import argparse
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configuration - use absolute import
from poly_apps.pyMatrix.config import Config

# API Routes - use absolute import
from poly_apps.pyMatrix.api import config_router, device_router, health_router, ws_router, recording_router, screen_router, group_router, file_router

# Middleware
from poly_apps.pyMatrix.middleware import APILoggingMiddleware, PerformanceMonitoringMiddleware

# Initialize FastAPI application
app = FastAPI(
    title="pyMatrix API",
    description="Android Device Mirroring and Group Control System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ALLOW_ORIGINS,
    allow_credentials=Config.CORS_ALLOW_CREDENTIALS,
    allow_methods=Config.CORS_ALLOW_METHODS,
    allow_headers=Config.CORS_ALLOW_HEADERS,
)

# Add logging and performance monitoring middleware
app.add_middleware(APILoggingMiddleware)
app.add_middleware(PerformanceMonitoringMiddleware)

# Register routes
app.include_router(health_router, prefix=Config.API_PREFIX)
app.include_router(config_router, prefix=Config.API_PREFIX)
app.include_router(device_router, prefix=Config.API_PREFIX)
app.include_router(recording_router, prefix=Config.API_PREFIX)
app.include_router(screen_router, prefix=Config.API_PREFIX)
app.include_router(group_router, prefix=Config.API_PREFIX)
app.include_router(file_router, prefix=Config.API_PREFIX)
app.include_router(ws_router)  # WebSocket routes (no prefix)


@app.on_event("startup")
async def startup_event():
    """启动时初始化"""
    print("=" * 60)
    print(" pyMatrix API Server - Starting")
    print("=" * 60)
    print(f"  Mode: {Config.MODE}")
    print(f"  Host: {Config.WEB_HOST}:{Config.WEB_PORT}")
    print(f"  API Docs: http://{Config.WEB_HOST}:{Config.WEB_PORT}/docs")
    print(f"  Frontend: {Config.FRONTEND_URL}")
    print("=" * 60)

    # 检查 ADB
    from pycore.pyutils.adb import ADBManager

    adb_path = Config.get_adb_path()
    try:
        devices = ADBManager.list_devices(adb_path)
        print(f"✓ ADB 可用: {adb_path}")
        print(f"✓ 发现 {len(devices)} 个设备")
    except Exception as e:
        print(f"✗ ADB 检查失败: {e}")

    print("✓ pyMatrix API Server 启动完成")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """关闭时清理"""
    print("\n正在关闭 pyMatrix API Server...")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="pyMatrix - Android Device Control")
    parser.add_argument(
        "--host",
        default=Config.WEB_HOST,
        help="服务器地址"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=Config.WEB_PORT,
        help="服务器端口"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="开发模式（自动重载）"
    )
    parser.add_argument(
        "--no-launcher",
        action="store_true",
        help="不启动 UI 启动器（仅启动 API 服务）"
    )

    args = parser.parse_args()

    if args.no_launcher:
        # 仅启动 API 服务
        uvicorn.run(
            "poly_apps.pyMatrix.main:app",
            host=args.host,
            port=args.port,
            reload=args.reload
        )
    else:
        # Start frontend launcher, then start API service
        import asyncio
        import platform
        from poly_apps.pyMatrix.frontend_launcher import launch_frontend_with_wait

        print("\n" + "=" * 60)
        print(" pyMatrix - Full Stack Launcher")
        print("=" * 60)
        print()

        # ============================================================
        # IMPORTANT: DO NOT MODIFY THIS PLATFORM-SPECIFIC LOGIC
        #
        # On Windows: Use temporary script + subprocess (no threading)
        # On Linux:   Use threading to run backend and frontend concurrently
        #
        # This is intentionally designed for different behaviors:
        # - Windows: Frontend runs in separate console via temp .bat script
        # - Linux:   Frontend runs in background thread with output capture
        # ============================================================

        if platform.system() == 'Windows':
            # Windows: Launch frontend in separate console, then run backend in main thread
            print("[Windows Mode] Starting frontend in separate console window...")

            # Launch frontend first (in separate console via temp script)
            async def launch():
                frontend_url = "http://localhost:3007"
                await launch_frontend_with_wait(
                    project_root=project_root,
                    frontend_url=frontend_url,
                    timeout=120
                )

            asyncio.run(launch())

            # Now run backend in main thread (blocking)
            print("\n[Windows Mode] Starting backend in main thread...")
            uvicorn.run(
                "poly_apps.pyMatrix.main:app",
                host=args.host,
                port=args.port,
                reload=args.reload
            )
        else:
            # Linux/Other: Use threading (original behavior)
            import threading

            print("[Linux Mode] Using threading for backend and frontend...")

            # Start backend server in a separate thread
            def start_backend():
                uvicorn.run(
                    "poly_apps.pyMatrix.main:app",
                    host=args.host,
                    port=args.port,
                    reload=args.reload
                )

            backend_thread = threading.Thread(target=start_backend, daemon=False)
            backend_thread.start()

            # Give backend a moment to start
            import time
            time.sleep(2)

            # Launch frontend and wait for connection
            async def launch():
                frontend_url = "http://localhost:3007"
                await launch_frontend_with_wait(
                    project_root=project_root,
                    frontend_url=frontend_url,
                    timeout=120
                )

            asyncio.run(launch())

            # Keep backend running
            backend_thread.join()


if __name__ == '__main__':
    main()
