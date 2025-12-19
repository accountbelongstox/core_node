# -*- coding: utf-8 -*-
"""
Web UI Routes

Serves static HTML pages and assets for UI components.
"""

from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from pycore import ColorPrint

router = APIRouter(tags=["web"])

# Mount static directory for desktop UI assets (CSS, JS)
DESKTOP_UI_DIR = Path(__file__).parent.parent.parent / "pyctl" / "desktop" / "ui"
if DESKTOP_UI_DIR.exists():
    # This will be mounted by the server setup
    pass

# Favicon path
FAVICON_PATH = Path(__file__).parent.parent.parent / "static" / "favicon.ico"


@router.get("/")
async def homepage():
    """
    Homepage - Display API service information

    Returns:
        JSONResponse: Available API services and endpoints
    """
    return JSONResponse({
        "service": "Pycore RPC Server",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "meta": {
                "GET /": {
                    "description": "API service information (this page)",
                    "parameters": {}
                },
                "GET /api/info": {
                    "description": "Detailed API info with system information",
                    "parameters": {}
                }
            },
            "mcp": {
                "POST /mcp/backend_info": {
                    "description": "Get MCP backend information",
                    "parameters": {}
                },
                "POST /mcp/get_file_info": {
                    "description": "Extract file info with OCR/document parsing",
                    "parameters": {
                        "file_path": {"type": "string", "required": True, "description": "Path to file"},
                        "use_cache": {"type": "boolean", "required": False, "default": True},
                        "include_pixel_matrix": {"type": "boolean", "required": False, "default": False},
                        "ocr_model_type": {"type": "string", "required": False, "default": "general"},
                        "num_colors": {"type": "integer", "required": False, "default": 10},
                        "extract_images": {"type": "boolean", "required": False, "default": True},
                        "extract_tables": {"type": "boolean", "required": False, "default": True},
                        "extract_hyperlinks": {"type": "boolean", "required": False, "default": True}
                    }
                },
                "POST /mcp/database_execute_query": {
                    "description": "Execute database query",
                    "parameters": {
                        "database_name": {"type": "string", "required": True},
                        "query": {"type": "string", "required": True},
                        "params": {"type": "object", "required": False}
                    }
                },
                "POST /mcp/codebase_search_content": {
                    "description": "Search content in codebase",
                    "parameters": {
                        "root_path": {"type": "string", "required": True},
                        "pattern": {"type": "string", "required": True},
                        "file_extensions": {"type": "array", "required": False},
                        "max_results": {"type": "integer", "required": False, "default": 100}
                    }
                }
            },
            "ocr": {
                "POST /ocr/recognize": {
                    "description": "OCR image recognition",
                    "parameters": {
                        "image_path": {"type": "string", "required": True},
                        "model_type": {"type": "string", "required": False, "default": "general", "options": ["general", "scene", "doc", "number", "english"]},
                        "use_cache": {"type": "boolean", "required": False, "default": True}
                    }
                },
                "GET /ocr/models": {
                    "description": "List available OCR models",
                    "parameters": {}
                }
            },
            "translator": {
                "POST /translator/translate": {
                    "description": "Translate text",
                    "parameters": {
                        "text": {"type": "string", "required": True},
                        "source_lang": {"type": "string", "required": False, "default": "auto"},
                        "target_lang": {"type": "string", "required": True},
                        "use_cache": {"type": "boolean", "required": False, "default": True}
                    }
                },
                "POST /translator/romanize": {
                    "description": "Romanize text (convert to Latin script)",
                    "parameters": {
                        "text": {"type": "string", "required": True},
                        "source_lang": {"type": "string", "required": True}
                    }
                }
            },
            "voice_subtitle": {
                "GET /voice-subtitle/queue": {
                    "description": "Get voice subtitle queue status",
                    "parameters": {}
                },
                "POST /voice-subtitle/process-text": {
                    "description": "Process text for voice subtitle",
                    "parameters": {
                        "text": {"type": "string", "required": True},
                        "language": {"type": "string", "required": False, "default": "auto"}
                    }
                }
            },
            "rpc": {
                "POST /rpc/{route}": {
                    "description": "RPC method call",
                    "parameters": {
                        "route": {"type": "string", "required": True, "description": "Route name"},
                        "params": {"type": "object", "required": False, "description": "Method parameters"}
                    }
                },
                "GET /rpc/query/{request_id}": {
                    "description": "Query RPC request result",
                    "parameters": {
                        "request_id": {"type": "string", "required": True}
                    }
                },
                "GET /rpc/routes": {
                    "description": "List all available RPC routes",
                    "parameters": {}
                },
                "WS /rpc/ws": {
                    "description": "WebSocket connection for real-time communication",
                    "parameters": {}
                }
            },
            "web": {
                "GET /desktop/index.html": {
                    "description": "Desktop Manager UI",
                    "parameters": {}
                },
                "GET /web": {
                    "description": "Redirect to Desktop Manager",
                    "parameters": {}
                },
                "GET /web/subtitle": {
                    "description": "Voice subtitle UI (redirects to desktop)",
                    "parameters": {}
                }
            },
            "code_sync": {
                "GET /code-sync/ping": {
                    "description": "Ping endpoint for server discovery",
                    "parameters": {}
                },
                "POST /code-sync/register": {
                    "description": "Register a client connection",
                    "parameters": {
                        "client_id": {"type": "string", "required": True}
                    }
                },
                "POST /code-sync/initial-sync": {
                    "description": "Get all files for initial sync",
                    "parameters": {
                        "client_id": {"type": "string", "required": True}
                    }
                },
                "POST /code-sync/changes": {
                    "description": "Get changed files for incremental sync",
                    "parameters": {
                        "client_id": {"type": "string", "required": True},
                        "received_count": {"type": "integer", "required": False, "default": 0},
                        "skipped_count": {"type": "integer", "required": False, "default": 0}
                    }
                },
                "GET /code-sync/status": {
                    "description": "Get code sync status",
                    "parameters": {}
                },
                "POST /code-sync/set-server": {
                    "description": "Switch to server mode",
                    "parameters": {}
                },
                "POST /code-sync/set-client": {
                    "description": "Switch to client mode",
                    "parameters": {}
                },
                "POST /code-sync/stop": {
                    "description": "Stop code sync (both server and client)",
                    "parameters": {}
                },
                "POST /code-sync/download": {
                    "description": "Download file content from server",
                    "parameters": {
                        "client_id": {"type": "string", "required": True},
                        "file_path": {"type": "string", "required": True}
                    }
                },
                "POST /code-sync/toggle-backup": {
                    "description": "Toggle backup setting for client",
                    "parameters": {
                        "enabled": {"type": "boolean", "required": False, "default": True}
                    }
                }
            }
        },
        "documentation": {
            "swagger_ui": "/docs",
            "redoc": "/redoc",
            "note": "FastAPI auto-generated documentation with interactive testing"
        },
        "mcp_tools_count": 19,
        "features": [
            "MCP Backend (File, Database, Codebase tools)",
            "OCR (Optical Character Recognition)",
            "Translation (Google Translate API)",
            "Voice Subtitle Processing",
            "RPC (HTTP + WebSocket)",
            "Desktop UI Manager"
        ]
    })


@router.get("/api/info")
async def get_api_info():
    """
    Get detailed API service information

    Returns:
        JSONResponse: Detailed service information
    """
    import platform
    import sys

    return JSONResponse({
        "service": {
            "name": "Pycore RPC Server",
            "version": "2.0.0",
            "status": "running"
        },
        "system": {
            "platform": platform.system(),
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "architecture": platform.machine()
        },
        "endpoints": {
            "rpc": {
                "POST /rpc/{route}": "Call RPC method",
                "GET /rpc/query/{request_id}": "Query request result",
                "GET /rpc/routes": "List all RPC routes",
                "WS /rpc/ws": "WebSocket connection"
            },
            "web": {
                "GET /": "API service information",
                "GET /api/info": "Detailed API info",
                "GET /desktop/index.html": "Desktop Manager UI",
                "GET /web/subtitle": "Voice subtitle UI (redirects to desktop)"
            }
        },
        "features": [
            "HTTP RPC calls",
            "WebSocket real-time communication",
            "Async/sync method support",
            "Request queuing and result caching",
            "Desktop UI manager"
        ]
    })


@router.get("/web")
async def get_desktop_ui():
    """
    Redirect to desktop manager

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


@router.get("/web/subtitle")
async def get_subtitle_ui():
    """
    Redirect to desktop manager (backward compatibility)

    Returns:
        RedirectResponse: Redirect to /desktop/index.html
    """
    ColorPrint.green(f"[WebRouter] Redirecting to desktop manager at /desktop/index.html")
    return RedirectResponse(url="/desktop/index.html", status_code=302)


@router.get("/favicon.ico")
async def get_favicon():
    """
    Serve favicon.ico

    Returns:
        FileResponse: Favicon file
    """
    if FAVICON_PATH.exists():
        return FileResponse(
            path=str(FAVICON_PATH),
            media_type="image/x-icon",
            headers={"Cache-Control": "public, max-age=31536000"}
        )
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Favicon not found")


