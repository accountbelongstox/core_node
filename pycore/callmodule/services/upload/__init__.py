# -*- coding: utf-8 -*-
<<<<<<< HEAD
"""
Upload Service - 上传任务管理服务

功能：
- 管理上传任务队列
- 追踪上传进度
- 管理上传服务器配置
- 记录上传历史
"""

import asyncio
import time
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import json


class UploadTask:
    """上传任务"""
    def __init__(self, task_id: str, result_type: str, files: List[str], server_url: str):
        self.task_id = task_id
        self.result_type = result_type
        self.files = files
        self.server_url = server_url
        self.status = "pending"  # pending, uploading, completed, failed
        self.progress = 0.0
        self.speed = 0.0  # MB/s
        self.created_at = datetime.now().isoformat()
        self.started_at = None
        self.completed_at = None
        self.error = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "upload_id": self.task_id,
            "result_type": self.result_type,
            "status": self.status,
            "progress": self.progress,
            "speed": self.speed,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "file_count": len(self.files),
            "server_url": self.server_url,
            "error": self.error
        }


class UploadService:
    """上传服务"""

    def __init__(self):
        self.tasks: Dict[str, UploadTask] = {}
        self.history: List[Dict[str, Any]] = []
        self.servers: List[Dict[str, Any]] = self._load_default_servers()
        self.config_file = Path("./config/upload_config.json")
        self._ensure_config_dir()
        self._load_config()

    def _ensure_config_dir(self):
        """确保配置目录存在"""
        self.config_file.parent.mkdir(parents=True, exist_ok=True)

    def _load_default_servers(self) -> List[Dict[str, Any]]:
        """加载默认服务器配置"""
        return [
            {
                "name": "本地测试服务器",
                "url": "http://localhost:8080/upload",
                "status": "unknown",
                "enabled": True,
                "priority": 1
            }
        ]

    def _load_config(self):
        """从文件加载配置"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.servers = config.get('servers', self.servers)
                    # 加载历史记录（最多保留100条）
                    self.history = config.get('history', [])[-100:]
        except Exception as e:
            print(f"[UploadService] Failed to load config: {e}")

    def _save_config(self):
        """保存配置到文件"""
        try:
            config = {
                'servers': self.servers,
                'history': self.history[-100:]  # 只保留最近100条
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[UploadService] Failed to save config: {e}")

    def get_tasks(self, status: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """
        获取上传任务列表

        Args:
            status: 任务状态过滤 (pending, uploading, completed, failed)
            limit: 返回数量限制

        Returns:
            包含任务列表的字典
        """
        tasks = list(self.tasks.values())

        # 状态过滤
        if status:
            tasks = [t for t in tasks if t.status == status]

        # 限制数量
        tasks = tasks[:limit]

        return {
            "success": True,
            "total": len(tasks),
            "tasks": [t.to_dict() for t in tasks]
        }

    def get_servers(self) -> Dict[str, Any]:
        """获取服务器配置列表"""
        return {
            "success": True,
            "servers": self.servers
        }

    def add_server(self, server: Dict[str, Any]) -> Dict[str, Any]:
        """添加服务器配置"""
        try:
            # 验证必需字段
            if not server.get('name') or not server.get('url'):
                return {
                    "success": False,
                    "error": "Missing required fields: name, url"
                }

            # 检查重名
            if any(s['name'] == server['name'] for s in self.servers):
                return {
                    "success": False,
                    "error": f"Server '{server['name']}' already exists"
                }

            # 添加默认字段
            server.setdefault('status', 'unknown')
            server.setdefault('enabled', True)
            server.setdefault('priority', len(self.servers) + 1)

            self.servers.append(server)
            self._save_config()

            return {
                "success": True,
                "message": "Server added successfully",
                "server": server
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def update_server(self, name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新服务器配置"""
        try:
            for server in self.servers:
                if server['name'] == name:
                    server.update(updates)
                    self._save_config()
                    return {
                        "success": True,
                        "message": "Server updated successfully",
                        "server": server
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def delete_server(self, name: str) -> Dict[str, Any]:
        """删除服务器配置"""
        try:
            for i, server in enumerate(self.servers):
                if server['name'] == name:
                    del self.servers[i]
                    self._save_config()
                    return {
                        "success": True,
                        "message": f"Server '{name}' deleted successfully"
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def test_server(self, name: str) -> Dict[str, Any]:
        """测试服务器连接"""
        try:
            for server in self.servers:
                if server['name'] == name:
                    # TODO: 实现实际的连接测试
                    # 目前返回模拟结果
                    server['status'] = 'online'
                    self._save_config()

                    return {
                        "success": True,
                        "message": f"Server '{name}' is reachable",
                        "latency": 50,  # ms
                        "status": "online"
                    }

            return {
                "success": False,
                "error": f"Server '{name}' not found"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def create_upload_task(self, result_type: str, files: List[str],
                          server_url: Optional[str] = None) -> Dict[str, Any]:
        """
        创建上传任务

        Args:
            result_type: 结果类型 (screenshot, ocr, audio, etc.)
            files: 文件路径列表
            server_url: 目标服务器URL (可选，默认使用第一个可用服务器)

        Returns:
            包含任务ID的字典
        """
        try:
            # 选择服务器
            if not server_url:
                enabled_servers = [s for s in self.servers if s.get('enabled', True)]
                if not enabled_servers:
                    return {
                        "success": False,
                        "error": "No enabled upload servers available"
                    }
                server_url = enabled_servers[0]['url']

            # 创建任务
            task_id = f"upload_{uuid.uuid4().hex[:8]}"
            task = UploadTask(task_id, result_type, files, server_url)
            self.tasks[task_id] = task

            return {
                "success": True,
                "upload_id": task_id,
                "message": "Upload task created",
                "task": task.to_dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_progress(self, upload_id: str) -> Dict[str, Any]:
        """获取上传进度"""
        task = self.tasks.get(upload_id)
        if not task:
            return {
                "success": False,
                "error": f"Upload task '{upload_id}' not found"
            }

        return {
            "success": True,
            "upload_id": upload_id,
            "status": task.status,
            "progress": task.progress,
            "speed": task.speed
        }

    def cancel_task(self, upload_id: str) -> Dict[str, Any]:
        """取消上传任务"""
        task = self.tasks.get(upload_id)
        if not task:
            return {
                "success": False,
                "error": f"Upload task '{upload_id}' not found"
            }

        if task.status in ("completed", "failed"):
            return {
                "success": False,
                "error": f"Cannot cancel task with status: {task.status}"
            }

        task.status = "cancelled"
        task.completed_at = datetime.now().isoformat()

        # 移动到历史
        self._move_to_history(task)

        return {
            "success": True,
            "message": f"Upload task '{upload_id}' cancelled"
        }

    def _move_to_history(self, task: UploadTask):
        """将任务移动到历史记录"""
        history_entry = task.to_dict()
        self.history.append(history_entry)

        # 从活动任务中移除
        if task.task_id in self.tasks:
            del self.tasks[task.task_id]

        # 保存历史记录
        self._save_config()

    def get_history(self, limit: int = 50) -> Dict[str, Any]:
        """获取上传历史"""
        return {
            "success": True,
            "total": len(self.history),
            "history": self.history[-limit:][::-1]  # 最近的在前
        }

    def get_stats(self) -> Dict[str, Any]:
        """获取上传统计"""
        total_uploads = len(self.history)
        completed = sum(1 for h in self.history if h.get('status') == 'completed')
        failed = sum(1 for h in self.history if h.get('status') == 'failed')

        # 计算总大小（模拟）
        total_size = len(self.history) * 2.5  # MB (模拟值)

        return {
            "success": True,
            "stats": {
                "total_uploads": total_uploads,
                "completed": completed,
                "failed": failed,
                "success_rate": (completed / total_uploads * 100) if total_uploads > 0 else 0,
                "total_size_mb": total_size,
                "active_tasks": len(self.tasks)
            }
        }
=======
"""Upload Service"""
class UploadService:
    def get_tasks(self):
        return {"success": True, "total": 0, "tasks": []}
    def get_servers(self):
        return {"success": True, "servers": []}
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
