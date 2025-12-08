# Pycore Module Caller 边缘计算架构设计方案

## 📋 背景与目标

### 当前架构问题
- `pycore_module_caller.py` 只是简单的RPC转发，无本地处理能力
- 所有数据直接发送到服务器，服务器负担重
- 没有边缘计算能力，无法利用本机硬件资源

### 新架构核心理念
**🎯 本机作为智能边缘节点，预处理数据后上传，减轻服务器负担**

1. **边缘计算优先** - 本机处理截图、OCR、音频、字幕
2. **智能上传** - 只上传处理结果，不上传原始大文件
3. **双模式支持** - 本地处理模式 + 远程转发模式
4. **三层UI** - 管理UI、本地处理UI、远程客户端UI

---

## 🏗️ 边缘计算架构设计

### 架构层次图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Management Layer (管理层)                      │
│              管理 Module Caller + 本地处理能力                     │
├──────────────────────────────────────────────────────────────────┤
│  系统管理:                                                         │
│    - GET /manage/status         (系统状态)                        │
│    - GET /manage/config         (配置管理)                        │
│    - POST /manage/control/{action} (控制操作)                     │
│    - GET /manage/logs           (日志查询)                        │
│                                                                   │
│  本地处理管理:                                                     │
│    - GET /manage/local/capabilities  (本地处理能力查询)           │
│    - POST /manage/local/config       (本地处理配置)              │
│    - GET /manage/local/stats         (本地处理统计)              │
│    - POST /manage/local/test         (测试本地处理)              │
│                                                                   │
│  管理端UI:                                                        │
│    - /manage/ui/                (管理界面)                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│              Local Processing Layer (本地处理层)                  │
│           利用本机硬件资源进行边缘计算                             │
├──────────────────────────────────────────────────────────────────┤
│  1. 截图处理:                                                      │
│     - POST /local/screenshot/capture     (截取屏幕)               │
│     - POST /local/screenshot/ocr         (截图+OCR)               │
│     - POST /local/screenshot/upload      (截图+上传)              │
│                                                                   │
│  2. 图片处理:                                                      │
│     - POST /local/image/ocr              (本地OCR识别)            │
│     - POST /local/image/compress         (图片压缩)               │
│     - POST /local/image/process-upload   (处理后上传)             │
│                                                                   │
│  3. 音频处理:                                                      │
│     - POST /local/audio/transcribe       (音频转文字)             │
│     - POST /local/audio/generate-subtitle (生成字幕)             │
│     - POST /local/audio/process-upload   (处理后上传)             │
│                                                                   │
│  4. 文件处理:                                                      │
│     - POST /local/file/analyze           (文件分析)               │
│     - POST /local/file/extract-text      (提取文字)               │
│     - POST /local/file/process-upload    (处理后上传)             │
│                                                                   │
│  5. 视频处理:                                                      │
│     - POST /local/video/extract-audio    (提取音频)               │
│     - POST /local/video/generate-subtitle (生成字幕)              │
│     - POST /local/video/process-upload   (处理后上传)             │
│                                                                   │
│  本地处理UI:                                                       │
│     - /local/ui/                        (本地处理界面)            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  Upload Layer (上传层)                            │
│              将本地处理结果上传到远程服务器                         │
├──────────────────────────────────────────────────────────────────┤
│  - POST /upload/result           (上传处理结果)                    │
│  - POST /upload/batch            (批量上传)                       │
│  - GET /upload/progress/{id}     (上传进度)                       │
│  - DELETE /upload/cancel/{id}    (取消上传)                       │
│  - GET /upload/history           (上传历史)                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│               Remote Client Layer (远程客户端层)                  │
│          作为远程客户端，转发到其他服务器（无本地处理）            │
├──────────────────────────────────────────────────────────────────┤
│  - POST /client/forward          (直接转发请求)                   │
│  - POST /client/encode-request   (URL编码)                        │
│  - GET /client/server-config     (服务器配置)                     │
│  - GET /client/connection-status (连接状态)                       │
│  - /client/ui/                   (客户端UI)                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                Remote Servers (远程服务器)                         │
│               接收本地处理结果或直接处理请求                        │
├──────────────────────────────────────────────────────────────────┤
│  Main Storage Server (Port: 59100)      - 主存储服务器            │
│  Backup Server (Port: 59101)            - 备份服务器              │
│  Analytics Server (Port: 59102)         - 分析服务器              │
│  Cloud Gateway (Port: 59103)            - 云端网关                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 路由详细设计

### 1. 管理层路由 (Management Layer)

**前缀**: `/manage`

#### 1.1 系统管理

```python
# ========== 系统状态 ==========
GET /manage/status
Response: {
    "system": {
        "status": "running",
        "uptime": 3600,
        "version": "2.0.0",
        "pid": 12345,
        "cpu_usage": 25.5,
        "memory_usage": 512.3,  # MB
        "disk_usage": {
            "total": 500.0,  # GB
            "used": 250.0,
            "free": 250.0
        }
    },
    "services": {
        "rpc_v2": "running",
        "heartbeat": "running",
        "ui": "running",
        "tray": "running",
        "local_processor": "running"
    },
    "local_processing": {
        "enabled": true,
        "capabilities": {
            "screenshot": true,
            "ocr": true,
            "audio_transcribe": true,
            "video_process": false  # 依赖GPU
        },
        "statistics": {
            "total_processed": 1234,
            "today_processed": 56,
            "failed": 3,
            "average_time": 1.23  # 秒
        }
    }
}

# ========== 配置管理 ==========
GET /manage/config
Response: {
    "system": {
        "debug": true,
        "log_level": "DEBUG",
        "max_connections": 100
    },
    "local_processing": {
        "screenshot": {
            "enabled": true,
            "format": "png",
            "quality": 95,
            "auto_ocr": false
        },
        "ocr": {
            "enabled": true,
            "engine": "paddleocr",
            "language": "zh-CN",
            "confidence_threshold": 0.6
        },
        "audio": {
            "enabled": true,
            "engine": "whisper",
            "model": "medium",
            "language": "zh"
        },
        "upload": {
            "auto_upload": true,
            "server_url": "http://example.com:59100",
            "compress_before_upload": true,
            "retry_times": 3
        }
    }
}

POST /manage/config
Body: {
    "local_processing": {
        "screenshot": {"enabled": false},
        "upload": {"auto_upload": true}
    }
}
Response: {"success": true, "message": "Config updated"}

# ========== 控制操作 ==========
POST /manage/control/restart
# 重启 Module Caller

POST /manage/control/stop
# 停止 Module Caller

POST /manage/control/reload-config
# 重新加载配置

POST /manage/control/clear-cache
# 清理本地缓存

# ========== 日志查询 ==========
GET /manage/logs?lines=100&level=ERROR&category=local_processing
Response: {
    "logs": [
        {
            "timestamp": "2025-12-07T10:00:00",
            "level": "ERROR",
            "category": "local_processing",
            "message": "OCR failed: model not loaded",
            "details": {...}
        }
    ],
    "total": 100,
    "has_more": true
}
```

#### 1.2 本地处理管理

```python
# ========== 本地处理能力查询 ==========
GET /manage/local/capabilities
Response: {
    "hardware": {
        "cpu": {
            "model": "Intel Core i7-10700K",
            "cores": 8,
            "threads": 16,
            "available": true
        },
        "gpu": {
            "model": "NVIDIA RTX 3070",
            "memory": 8192,  # MB
            "available": true,
            "cuda_version": "11.8"
        },
        "memory": {
            "total": 32768,  # MB
            "available": 28000
        }
    },
    "capabilities": {
        "screenshot": {
            "available": true,
            "supported_formats": ["png", "jpg", "bmp"],
            "max_resolution": "3840x2160"
        },
        "ocr": {
            "available": true,
            "engines": ["paddleocr", "easyocr", "tesseract"],
            "languages": ["zh-CN", "en", "ja", "ko"]
        },
        "audio": {
            "available": true,
            "engines": ["whisper", "vosk"],
            "models": ["tiny", "base", "small", "medium", "large"],
            "supported_formats": ["wav", "mp3", "flac", "m4a"]
        },
        "video": {
            "available": false,  # 需要GPU
            "reason": "GPU not detected",
            "supported_formats": ["mp4", "avi", "mkv"]
        }
    }
}

# ========== 本地处理配置 ==========
POST /manage/local/config
Body: {
    "ocr": {
        "engine": "paddleocr",
        "confidence_threshold": 0.7
    },
    "audio": {
        "engine": "whisper",
        "model": "medium"
    }
}
Response: {"success": true, "message": "Local processing config updated"}

# ========== 本地处理统计 ==========
GET /manage/local/stats?period=today
Response: {
    "period": "today",
    "summary": {
        "total_tasks": 156,
        "completed": 150,
        "failed": 6,
        "average_time": 2.34,  # 秒
        "total_data_processed": 1234.5  # MB
    },
    "by_type": {
        "screenshot": {
            "count": 45,
            "success_rate": 100.0,
            "average_time": 0.5
        },
        "ocr": {
            "count": 60,
            "success_rate": 95.0,
            "average_time": 1.2
        },
        "audio": {
            "count": 30,
            "success_rate": 96.7,
            "average_time": 8.5
        },
        "video": {
            "count": 21,
            "success_rate": 90.5,
            "average_time": 45.2
        }
    },
    "upload_stats": {
        "total_uploaded": 120,
        "upload_size": 567.8,  # MB
        "failed": 2,
        "average_speed": 12.5  # MB/s
    }
}

# ========== 测试本地处理 ==========
POST /manage/local/test
Body: {
    "test_type": "ocr",  # screenshot, ocr, audio, video
    "test_data": "base64_encoded_test_image"
}
Response: {
    "success": true,
    "test_type": "ocr",
    "result": {"text": "测试文字", "confidence": 0.95},
    "execution_time": 1.23,
    "hardware_used": {
        "cpu": true,
        "gpu": false
    }
}
```

---

### 2. 本地处理层路由 (Local Processing Layer)

**前缀**: `/local`

#### 2.1 截图处理

```python
# ========== 截取屏幕 ==========
POST /local/screenshot/capture
Body: {
    "mode": "fullscreen",  # fullscreen, window, region
    "window_name": "Chrome",  # mode=window时指定
    "region": {"x": 0, "y": 0, "width": 800, "height": 600},  # mode=region时指定
    "format": "png",  # png, jpg, bmp
    "quality": 95  # jpg quality
}
Response: {
    "success": true,
    "screenshot_id": "scr_12345",
    "image_data": "base64_encoded_image",
    "metadata": {
        "width": 1920,
        "height": 1080,
        "format": "png",
        "size": 234567,  # bytes
        "timestamp": "2025-12-07T10:00:00"
    },
    "execution_time": 0.23
}

# ========== 截图 + OCR ==========
POST /local/screenshot/ocr
Body: {
    "mode": "fullscreen",
    "ocr_config": {
        "language": "zh-CN",
        "confidence_threshold": 0.6
    }
}
Response: {
    "success": true,
    "screenshot_id": "scr_12345",
    "image_data": "base64_encoded_image",
    "ocr_result": {
        "text": "识别的文字内容",
        "confidence": 0.87,
        "words": [
            {"text": "识别", "confidence": 0.95, "bbox": [10, 20, 50, 40]},
            {"text": "的", "confidence": 0.85, "bbox": [55, 20, 70, 40]},
            {"text": "文字", "confidence": 0.90, "bbox": [75, 20, 110, 40]}
        ],
        "language": "zh-CN"
    },
    "execution_time": 1.45
}

# ========== 截图 + 上传 ==========
POST /local/screenshot/upload
Body: {
    "mode": "fullscreen",
    "upload_config": {
        "server_url": "http://example.com:59100",
        "compress": true,
        "metadata": {
            "user_id": "user123",
            "tags": ["work", "screenshot"]
        }
    }
}
Response: {
    "success": true,
    "screenshot_id": "scr_12345",
    "upload_result": {
        "uploaded": true,
        "server_url": "http://example.com:59100/files/scr_12345.png",
        "upload_time": 0.78,
        "file_size": 234567,
        "compressed_size": 123456
    },
    "execution_time": 1.56
}
```

#### 2.2 图片处理

```python
# ========== 本地OCR识别 ==========
POST /local/image/ocr
Body: {
    "image_source": "base64",  # base64, url, file_path
    "image_data": "base64_encoded_image",
    "ocr_config": {
        "engine": "paddleocr",  # paddleocr, easyocr, tesseract
        "language": "zh-CN",
        "confidence_threshold": 0.6,
        "detect_orientation": true
    }
}
Response: {
    "success": true,
    "ocr_result": {
        "text": "识别的完整文字",
        "confidence": 0.87,
        "words": [...],
        "lines": [...],
        "paragraphs": [...]
    },
    "metadata": {
        "image_width": 1920,
        "image_height": 1080,
        "orientation": 0,
        "language": "zh-CN"
    },
    "execution_time": 1.23
}

# ========== 图片压缩 ==========
POST /local/image/compress
Body: {
    "image_data": "base64_encoded_image",
    "compress_config": {
        "format": "jpg",  # jpg, webp, png
        "quality": 85,
        "max_width": 1920,
        "max_height": 1080
    }
}
Response: {
    "success": true,
    "compressed_data": "base64_encoded_compressed_image",
    "metadata": {
        "original_size": 2345678,  # bytes
        "compressed_size": 456789,
        "compression_ratio": 0.195,  # 19.5%
        "width": 1920,
        "height": 1080
    },
    "execution_time": 0.45
}

# ========== 图片处理 + 上传 ==========
POST /local/image/process-upload
Body: {
    "image_data": "base64_encoded_image",
    "processing": {
        "ocr": true,
        "compress": true,
        "compress_config": {"quality": 85}
    },
    "upload_config": {
        "server_url": "http://example.com:59100",
        "include_ocr_result": true
    }
}
Response: {
    "success": true,
    "processing_result": {
        "ocr": {"text": "识别文字", "confidence": 0.87},
        "compressed": true,
        "compressed_size": 456789
    },
    "upload_result": {
        "uploaded": true,
        "server_url": "http://example.com:59100/files/img_12345.jpg",
        "upload_time": 0.78
    },
    "execution_time": 2.34
}
```

#### 2.3 音频处理

```python
# ========== 音频转文字 ==========
POST /local/audio/transcribe
Body: {
    "audio_source": "base64",  # base64, url, file_path
    "audio_data": "base64_encoded_audio",
    "transcribe_config": {
        "engine": "whisper",  # whisper, vosk
        "model": "medium",  # tiny, base, small, medium, large
        "language": "zh",
        "task": "transcribe",  # transcribe, translate
        "initial_prompt": ""
    }
}
Response: {
    "success": true,
    "transcription": {
        "text": "转录的完整文字",
        "language": "zh",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 3.5,
                "text": "这是第一段",
                "confidence": 0.95
            },
            {
                "id": 1,
                "start": 3.5,
                "end": 7.2,
                "text": "这是第二段",
                "confidence": 0.92
            }
        ]
    },
    "metadata": {
        "duration": 45.6,  # 秒
        "audio_format": "wav",
        "sample_rate": 16000,
        "model_used": "whisper-medium"
    },
    "execution_time": 8.34
}

# ========== 生成字幕 ==========
POST /local/audio/generate-subtitle
Body: {
    "audio_data": "base64_encoded_audio",
    "subtitle_config": {
        "format": "srt",  # srt, vtt, ass
        "language": "zh",
        "max_line_length": 42,
        "max_words_per_line": 7
    }
}
Response: {
    "success": true,
    "subtitle": {
        "format": "srt",
        "content": "1\n00:00:00,000 --> 00:00:03,500\n这是第一段\n\n2\n00:00:03,500 --> 00:00:07,200\n这是第二段\n",
        "segments_count": 12
    },
    "transcription": {
        "text": "完整转录文字",
        "segments": [...]
    },
    "execution_time": 9.12
}

# ========== 音频处理 + 上传 ==========
POST /local/audio/process-upload
Body: {
    "audio_data": "base64_encoded_audio",
    "processing": {
        "transcribe": true,
        "generate_subtitle": true,
        "subtitle_format": "srt"
    },
    "upload_config": {
        "server_url": "http://example.com:59100",
        "include_transcription": true,
        "include_subtitle": true
    }
}
Response: {
    "success": true,
    "processing_result": {
        "transcription": {"text": "...", "confidence": 0.87},
        "subtitle": {"format": "srt", "segments_count": 12}
    },
    "upload_result": {
        "uploaded": true,
        "files": {
            "audio": "http://example.com:59100/files/audio_12345.wav",
            "transcription": "http://example.com:59100/files/audio_12345_transcription.txt",
            "subtitle": "http://example.com:59100/files/audio_12345_subtitle.srt"
        },
        "upload_time": 1.23
    },
    "execution_time": 10.67
}
```

#### 2.4 文件处理

```python
# ========== 文件分析 ==========
POST /local/file/analyze
Body: {
    "file_source": "base64",  # base64, file_path
    "file_data": "base64_encoded_file",
    "file_name": "document.pdf"
}
Response: {
    "success": true,
    "analysis": {
        "file_type": "pdf",
        "mime_type": "application/pdf",
        "size": 1234567,
        "pages": 10,
        "has_text": true,
        "has_images": true,
        "extractable": true
    },
    "execution_time": 0.45
}

# ========== 提取文字 ==========
POST /local/file/extract-text
Body: {
    "file_data": "base64_encoded_pdf",
    "file_name": "document.pdf",
    "extract_config": {
        "include_images": true,
        "ocr_images": true,
        "preserve_layout": true
    }
}
Response: {
    "success": true,
    "extracted_text": "提取的完整文字",
    "pages": [
        {
            "page_number": 1,
            "text": "第一页文字",
            "images": [{"text": "图片中的文字", "confidence": 0.85}]
        }
    ],
    "metadata": {
        "total_pages": 10,
        "total_characters": 12345,
        "images_processed": 5
    },
    "execution_time": 12.34
}

# ========== 文件处理 + 上传 ==========
POST /local/file/process-upload
Body: {
    "file_data": "base64_encoded_file",
    "file_name": "document.pdf",
    "processing": {
        "extract_text": true,
        "extract_images": true,
        "ocr_images": true
    },
    "upload_config": {
        "server_url": "http://example.com:59100",
        "include_extracted_content": true
    }
}
Response: {
    "success": true,
    "processing_result": {
        "text_extracted": true,
        "images_extracted": 5,
        "total_characters": 12345
    },
    "upload_result": {
        "uploaded": true,
        "files": {
            "original": "http://example.com:59100/files/doc_12345.pdf",
            "extracted_text": "http://example.com:59100/files/doc_12345_text.txt",
            "images": [
                "http://example.com:59100/files/doc_12345_img1.jpg",
                "http://example.com:59100/files/doc_12345_img2.jpg"
            ]
        },
        "upload_time": 2.34
    },
    "execution_time": 15.67
}
```

#### 2.5 视频处理

```python
# ========== 提取音频 ==========
POST /local/video/extract-audio
Body: {
    "video_source": "file_path",  # base64, file_path, url
    "video_path": "/path/to/video.mp4",
    "extract_config": {
        "format": "wav",  # wav, mp3, flac
        "sample_rate": 16000,
        "channels": 1
    }
}
Response: {
    "success": true,
    "audio_data": "base64_encoded_audio",
    "metadata": {
        "duration": 120.5,
        "format": "wav",
        "sample_rate": 16000,
        "size": 3845678
    },
    "execution_time": 5.67
}

# ========== 生成字幕 ==========
POST /local/video/generate-subtitle
Body: {
    "video_path": "/path/to/video.mp4",
    "subtitle_config": {
        "format": "srt",
        "language": "zh",
        "whisper_model": "medium",
        "burn_into_video": false  # 是否烧录到视频
    }
}
Response: {
    "success": true,
    "subtitle": {
        "format": "srt",
        "content": "1\n00:00:00,000 --> 00:00:03,500\n字幕内容\n",
        "segments_count": 45
    },
    "transcription": {
        "text": "完整转录文字"
    },
    "execution_time": 45.23
}

# ========== 视频处理 + 上传 ==========
POST /local/video/process-upload
Body: {
    "video_path": "/path/to/video.mp4",
    "processing": {
        "extract_audio": true,
        "generate_subtitle": true,
        "subtitle_format": "srt",
        "compress_video": true,
        "compress_config": {
            "codec": "h264",
            "crf": 23,
            "max_width": 1920
        }
    },
    "upload_config": {
        "server_url": "http://example.com:59100",
        "include_audio": true,
        "include_subtitle": true
    }
}
Response: {
    "success": true,
    "processing_result": {
        "audio_extracted": true,
        "subtitle_generated": true,
        "video_compressed": true,
        "original_size": 123456789,
        "compressed_size": 45678901,
        "compression_ratio": 0.37
    },
    "upload_result": {
        "uploaded": true,
        "files": {
            "video": "http://example.com:59100/files/video_12345.mp4",
            "audio": "http://example.com:59100/files/video_12345_audio.wav",
            "subtitle": "http://example.com:59100/files/video_12345_subtitle.srt"
        },
        "upload_time": 23.45
    },
    "execution_time": 78.90
}
```

---

### 3. 上传层路由 (Upload Layer)

**前缀**: `/upload`

```python
# ========== 上传处理结果 ==========
POST /upload/result
Body: {
    "result_type": "ocr",  # ocr, audio, video, file, screenshot
    "result_data": {
        "text": "处理结果",
        "metadata": {...}
    },
    "files": [
        {
            "name": "result.txt",
            "data": "base64_encoded_file",
            "mime_type": "text/plain"
        }
    ],
    "server_url": "http://example.com:59100",
    "metadata": {
        "user_id": "user123",
        "tags": ["work", "ocr"]
    }
}
Response: {
    "success": true,
    "upload_id": "upload_12345",
    "uploaded_files": [
        {"name": "result.txt", "url": "http://example.com:59100/files/result.txt"}
    ],
    "upload_time": 1.23
}

# ========== 批量上传 ==========
POST /upload/batch
Body: {
    "items": [
        {
            "result_type": "ocr",
            "result_data": {...},
            "files": [...]
        },
        {
            "result_type": "audio",
            "result_data": {...},
            "files": [...]
        }
    ],
    "server_url": "http://example.com:59100"
}
Response: {
    "success": true,
    "batch_id": "batch_12345",
    "total_items": 2,
    "completed": 2,
    "failed": 0,
    "results": [...]
}

# ========== 上传进度 ==========
GET /upload/progress/{upload_id}
Response: {
    "upload_id": "upload_12345",
    "status": "uploading",  # pending, uploading, completed, failed
    "progress": 65.5,  # 百分比
    "uploaded_bytes": 1234567,
    "total_bytes": 1884567,
    "speed": 12.5,  # MB/s
    "estimated_time": 5.6  # 秒
}

# ========== 取消上传 ==========
DELETE /upload/cancel/{upload_id}
Response: {"success": true, "message": "Upload cancelled"}

# ========== 上传历史 ==========
GET /upload/history?limit=50&offset=0
Response: {
    "total": 234,
    "items": [
        {
            "upload_id": "upload_12345",
            "result_type": "ocr",
            "status": "completed",
            "uploaded_at": "2025-12-07T10:00:00",
            "file_count": 3,
            "total_size": 1234567
        }
    ]
}
```

---

### 4. 远程客户端层路由 (Remote Client Layer)

**前缀**: `/client`

```python
# ========== 直接转发请求（无本地处理）==========
POST /client/forward
Body: {
    "service": "remote_ocr_server",
    "method": "recognize",
    "params": {"image": "base64_data"},
    "timeout": 30
}
Response: {
    "success": true,
    "request_id": "req_12345",
    "result": {...},
    "server_response_time": 1.23
}

# ========== URL编码（预览）==========
POST /client/encode-request
Body: {
    "service": "remote_ocr",
    "method": "recognize",
    "params": {"image": "base64_data"}
}
Response: {
    "encoded_url": "http://remote-server:59002/api/recognize?...",
    "curl_command": "curl -X POST '...' -H '...' -d '...'",
    "method": "POST",
    "headers": {"Content-Type": "application/json"}
}

# ========== 服务器配置 ==========
GET /client/server-config
Response: {
    "servers": [
        {
            "name": "main_storage",
            "url": "http://example.com:59100",
            "status": "online",
            "health_check": "/health",
            "last_check": "2025-12-07T10:00:00"
        }
    ]
}

POST /client/server-config
Body: {
    "name": "backup_server",
    "url": "http://backup.example.com:59101",
    "health_check": "/health",
    "timeout": 30
}
Response: {"success": true, "message": "Server added"}

# ========== 连接状态 ==========
GET /client/connection-status
Response: {
    "total_servers": 4,
    "online": 3,
    "offline": 1,
    "servers": [
        {"name": "main_storage", "status": "online", "latency": 5},
        {"name": "backup_server", "status": "offline", "error": "Connection refused"}
    ]
}
```

---

## 🔄 完整数据流示例

### 场景1: 截图 + OCR + 上传（边缘计算）

```
1. 用户点击"截图并识别"
   ↓
2. 调用本地截图API
   POST /local/screenshot/ocr
   Body: {"mode": "fullscreen", "ocr_config": {...}}
   ↓
3. 本机执行:
   a. 截取屏幕 (0.2秒)
   b. 本地OCR识别 (1.2秒)
   ↓
4. 返回结果给用户
   Response: {
     "screenshot_id": "scr_12345",
     "image_data": "...",
     "ocr_result": {"text": "识别文字", "confidence": 0.87}
   }
   ↓
5. 用户确认后上传
   POST /upload/result
   Body: {
     "result_type": "screenshot_ocr",
     "result_data": {"text": "识别文字"},
     "files": [{"name": "scr_12345.png", "data": "..."}]
   }
   ↓
6. 上传到远程服务器
   Server: http://example.com:59100
   ↓
7. 返回上传结果
   Response: {
     "upload_id": "upload_12345",
     "uploaded_files": ["http://example.com:59100/files/scr_12345.png"]
   }

总耗时: ~3秒 (本地处理1.4秒 + 上传1.6秒)
优势: 服务器只需存储，不需要OCR计算
```

### 场景2: 音频转字幕 + 上传

```
1. 用户上传音频文件
   ↓
2. 调用本地音频处理API
   POST /local/audio/process-upload
   Body: {
     "audio_data": "base64_audio",
     "processing": {
       "transcribe": true,
       "generate_subtitle": true,
       "subtitle_format": "srt"
     },
     "upload_config": {
       "server_url": "http://example.com:59100",
       "include_transcription": true,
       "include_subtitle": true
     }
   }
   ↓
3. 本机执行:
   a. 音频转文字 (Whisper, 8秒)
   b. 生成字幕文件 (0.5秒)
   c. 上传音频 + 转录 + 字幕 (2秒)
   ↓
4. 返回完整结果
   Response: {
     "processing_result": {
       "transcription": {"text": "...", "confidence": 0.87},
       "subtitle": {"format": "srt", "segments_count": 12}
     },
     "upload_result": {
       "files": {
         "audio": "http://example.com:59100/files/audio_12345.wav",
         "transcription": "http://example.com:59100/files/audio_12345_transcription.txt",
         "subtitle": "http://example.com:59100/files/audio_12345_subtitle.srt"
       }
     }
   }

总耗时: ~10.5秒 (本地处理8.5秒 + 上传2秒)
优势: 服务器只需存储结果，不需要运行Whisper模型
```

### 场景3: 远程转发模式（无本地处理）

```
1. 用户请求远程服务
   ↓
2. 调用远程客户端API
   POST /client/forward
   Body: {
     "service": "remote_ocr_server",
     "method": "recognize",
     "params": {"image": "base64_data"}
   }
   ↓
3. Module Caller转发请求
   → http://remote-server:59002/api/recognize
   ↓
4. 远程服务器处理 (5秒)
   ↓
5. 返回结果
   Response: {
     "result": {"text": "识别文字"},
     "server_response_time": 5.2
   }

总耗时: ~5.2秒 (全部在远程服务器处理)
场景: 本机硬件不足或需要使用特定远程服务
```

---

## 📂 文件结构

```
pycore/callmodule/
├── routers/
│   ├── management/                    # 管理层路由
│   │   ├── __init__.py
│   │   ├── status_router.py           # 系统状态
│   │   ├── config_router.py           # 配置管理
│   │   ├── control_router.py          # 控制操作
│   │   ├── logs_router.py             # 日志查询
│   │   ├── local_capabilities_router.py  # 本地能力查询
│   │   ├── local_config_router.py     # 本地处理配置
│   │   └── local_stats_router.py      # 本地处理统计
│   │
│   ├── local_processing/              # 本地处理路由
│   │   ├── __init__.py
│   │   ├── screenshot_router.py       # 截图处理
│   │   ├── image_router.py            # 图片处理
│   │   ├── audio_router.py            # 音频处理
│   │   ├── file_router.py             # 文件处理
│   │   └── video_router.py            # 视频处理
│   │
│   ├── upload/                        # 上传层路由
│   │   ├── __init__.py
│   │   ├── result_router.py           # 结果上传
│   │   ├── batch_router.py            # 批量上传
│   │   ├── progress_router.py         # 上传进度
│   │   └── history_router.py          # 上传历史
│   │
│   └── client/                        # 远程客户端路由
│       ├── __init__.py
│       ├── forward_router.py          # 请求转发
│       ├── encoder_router.py          # URL编码
│       ├── server_config_router.py    # 服务器配置
│       └── connection_router.py       # 连接状态
│
├── processors/                        # 本地处理器
│   ├── __init__.py
│   ├── screenshot_processor.py        # 截图处理器
│   ├── ocr_processor.py               # OCR处理器
│   ├── audio_processor.py             # 音频处理器
│   ├── file_processor.py              # 文件处理器
│   └── video_processor.py             # 视频处理器
│
├── uploaders/                         # 上传管理器
│   ├── __init__.py
│   ├── result_uploader.py             # 结果上传器
│   ├── batch_uploader.py              # 批量上传器
│   └── progress_tracker.py            # 进度追踪器
│
├── static/
│   ├── manage_ui/                     # 管理端UI
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   │
│   ├── local_ui/                      # 本地处理UI
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   │
│   └── client_ui/                     # 远程客户端UI
│       ├── index.html
│       ├── css/
│       └── js/
│
└── config/
    ├── local_processing_config.yaml   # 本地处理配置
    ├── upload_config.yaml             # 上传配置
    └── remote_servers_config.yaml     # 远程服务器配置
```

---

## ⚙️ 配置文件示例

### local_processing_config.yaml
```yaml
screenshot:
  enabled: true
  format: png
  quality: 95
  auto_ocr: false
  hotkey: "Ctrl+Alt+S"

ocr:
  enabled: true
  engine: paddleocr  # paddleocr, easyocr, tesseract
  language: zh-CN
  confidence_threshold: 0.6
  gpu_enabled: true

audio:
  enabled: true
  engine: whisper  # whisper, vosk
  model: medium  # tiny, base, small, medium, large
  language: zh
  device: cuda  # cuda, cpu

video:
  enabled: true
  extract_audio_format: wav
  subtitle_format: srt
  compress_before_upload: true
  compress_crf: 23

upload:
  auto_upload: true
  server_url: http://example.com:59100
  compress_before_upload: true
  retry_times: 3
  retry_delay: 5  # 秒
```

### upload_config.yaml
```yaml
default_server: main_storage

servers:
  main_storage:
    url: http://example.com:59100
    api_key: your_api_key_here
    enabled: true
    priority: 1

  backup_storage:
    url: http://backup.example.com:59101
    api_key: your_api_key_here
    enabled: true
    priority: 2

upload_settings:
  chunk_size: 10485760  # 10MB
  max_concurrent: 3
  timeout: 300  # 秒
  verify_upload: true
```

### remote_servers_config.yaml
```yaml
servers:
  - name: remote_ocr_server
    url: http://ocr-server.example.com:59002
    type: ocr
    enabled: false  # 优先使用本地处理

  - name: remote_audio_server
    url: http://audio-server.example.com:59003
    type: audio
    enabled: false

  - name: cloud_gateway
    url: http://cloud.example.com:59103
    type: gateway
    enabled: true
```

---

## 🚀 实施计划

### 阶段1: 管理层 + 本地处理基础 (3-4天)
1. 创建管理层路由框架
2. 实现系统状态查询
3. 实现本地能力检测
4. 创建管理端UI

### 阶段2: 截图 + OCR本地处理 (2-3天)
1. 实现截图处理器
2. 集成OCR引擎 (PaddleOCR)
3. 实现截图路由
4. 实现图片OCR路由
5. 创建本地处理UI

### 阶段3: 音频 + 字幕本地处理 (3-4天)
1. 集成Whisper模型
2. 实现音频转文字
3. 实现字幕生成
4. 实现音频处理路由

### 阶段4: 文件 + 视频处理 (3-4天)
1. 实现文件分析器
2. 实现PDF文字提取
3. 实现视频音频提取
4. 实现视频字幕生成

### 阶段5: 上传层实现 (2-3天)
1. 实现结果上传器
2. 实现批量上传
3. 实现进度追踪
4. 实现上传历史

### 阶段6: 远程客户端层 (2天)
1. 实现请求转发
2. 实现服务器配置
3. 创建客户端UI

### 阶段7: 集成测试 + 优化 (2-3天)
1. 端到端测试
2. 性能优化
3. 错误处理
4. 文档完善

---

## ✅ 核心优势

### 边缘计算优势
1. **减轻服务器负担** - 本地预处理，只上传结果
2. **降低网络传输** - 原始文件不上传，只传处理结果
3. **提高响应速度** - 本地处理更快，无网络延迟
4. **隐私保护** - 敏感数据本地处理，不必上传原文件

### 架构优势
1. **灵活切换模式** - 本地处理 + 远程转发双模式
2. **硬件利用最大化** - 充分利用本机CPU/GPU
3. **可扩展性强** - 新增处理器不影响现有代码
4. **降低成本** - 减少服务器计算资源需求

### 功能优势
1. **截图OCR** - 快速截图识别，无需上传
2. **音频字幕** - 本地Whisper处理，服务器只存储
3. **文件处理** - PDF/Office文档本地提取文字
4. **视频字幕** - 本地生成字幕，减少服务器压力

---

## 📊 性能对比

| 场景 | 传统模式 | 边缘计算模式 | 优势 |
|-----|---------|------------|-----|
| 截图OCR | 上传图片(2MB) → 服务器OCR → 返回结果<br>耗时: ~5秒 | 本地截图 → 本地OCR → 返回结果<br>耗时: ~1.5秒 | **提速70%** |
| 音频转字幕 | 上传音频(50MB) → 服务器Whisper → 返回字幕<br>耗时: ~30秒 | 本地Whisper → 上传结果(0.5MB)<br>耗时: ~10秒 | **提速67%** |
| PDF提取 | 上传PDF(10MB) → 服务器提取 → 返回文字<br>耗时: ~15秒 | 本地提取 → 上传结果(0.1MB)<br>耗时: ~5秒 | **提速67%** |
| 视频字幕 | 上传视频(500MB) → 服务器处理 → 返回字幕<br>耗时: ~5分钟 | 本地处理 → 上传结果(0.5MB)<br>耗时: ~1分钟 | **提速80%** |

---

## 🎯 下一步

请确认以下问题：

1. **架构设计是否满足需求？**
2. **端口分配: 59000 (Module Caller), 59100-59103 (远程服务器)**
3. **本地处理优先级: 截图OCR > 音频字幕 > 文件处理 > 视频处理**
4. **需要支持哪些OCR引擎？** (PaddleOCR, EasyOCR, Tesseract)
5. **需要支持哪些Whisper模型？** (tiny, base, small, medium, large)
6. **从哪个阶段开始实施？** 建议顺序:
   - ✅ 阶段1: 管理层框架
   - ✅ 阶段2: 截图+OCR (最常用)
   - ✅ 阶段3: 音频+字幕
   - ✅ 阶段5: 上传层
   - 其他阶段按需实施

确认后我将开始编写代码！🚀
