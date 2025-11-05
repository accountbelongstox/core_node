"""
PyMatrix WebView 启动器

使用 webview 在窗口中显示 Nuxt 前端
"""

import subprocess
import time
import requests
import threading
from pathlib import Path
from typing import Optional

try:
    import webview
    WEBVIEW_AVAILABLE = True
except ImportError:
    WEBVIEW_AVAILABLE = False
    print("Warning: pywebview not installed. Will use browser fallback.")

from ..config import Config


class PyMatrixLauncher:
    """
    PyMatrix 启动器

    功能：
    1. 启动 Python FastAPI 后端
    2. 启动 Nuxt 前端 (pnpm dev)
    3. 在 webview 窗口中显示前端
    """

    def __init__(self):
        self.backend_process: Optional[subprocess.Popen] = None
        self.frontend_process: Optional[subprocess.Popen] = None
        self.window = None

    def start_backend(self) -> bool:
        """
        启动 FastAPI 后端

        Returns:
            是否成功启动
        """
        try:
            print("正在启动 Python 后端...")

            # 启动 FastAPI 服务
            main_py = Path(__file__).parent.parent / "main.py"

            self.backend_process = subprocess.Popen(
                ["python", str(main_py), "--no-launcher"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # 等待后端启动
            for i in range(30):
                try:
                    response = requests.get(
                        f"http://{Config.WEB_HOST}:{Config.WEB_PORT}/health",
                        timeout=1
                    )
                    if response.status_code == 200:
                        print(f"✓ 后端启动成功: http://{Config.WEB_HOST}:{Config.WEB_PORT}")
                        return True
                except:
                    pass
                time.sleep(1)

            print("✗ 后端启动超时")
            return False

        except Exception as e:
            print(f"✗ 后端启动失败: {e}")
            return False

    def start_frontend(self) -> bool:
        """
        启动 Nuxt 前端

        Returns:
            是否成功启动
        """
        try:
            print("正在启动 Nuxt 前端...")

            frontend_dir = Config.FRONTEND_DIR

            if not frontend_dir.exists():
                print(f"✗ 前端目录不存在: {frontend_dir}")
                return False

            # 设置环境变量
            import os
            env = os.environ.copy()
            env["APP_ENTRY"] = "pymatrix"

            # 启动 pnpm dev
            self.frontend_process = subprocess.Popen(
                ["pnpm", "dev"],
                cwd=str(frontend_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=True  # Windows需要shell=True
            )

            # 等待前端启动
            print("等待前端启动...")
            for i in range(60):  # 最多等待60秒
                try:
                    response = requests.get(Config.FRONTEND_URL, timeout=1)
                    if response.status_code in [200, 304]:
                        print(f"✓ 前端启动成功: {Config.FRONTEND_URL}")
                        return True
                except:
                    pass
                time.sleep(1)

            print("✗ 前端启动超时")
            return False

        except Exception as e:
            print(f"✗ 前端启动失败: {e}")
            return False

    def open_webview(self):
        """在 webview 窗口中打开前端"""
        if not WEBVIEW_AVAILABLE:
            print("pywebview 未安装，使用浏览器打开...")
            import webbrowser
            webbrowser.open(Config.FRONTEND_URL)
            return

        try:
            print("正在打开 WebView 窗口...")

            # 创建 webview 窗口
            self.window = webview.create_window(
                title="pyMatrix - Device Control",
                url=Config.FRONTEND_URL,
                width=1400,
                height=900,
                resizable=True,
                fullscreen=False,
                min_size=(1200, 800)
            )

            # 启动 webview（阻塞直到窗口关闭）
            webview.start()

        except Exception as e:
            print(f"WebView 启动失败: {e}")
            print("回退到浏览器...")
            import webbrowser
            webbrowser.open(Config.FRONTEND_URL)

    def stop(self):
        """停止所有进程"""
        print("\n正在停止服务...")

        if self.frontend_process:
            print("停止前端进程...")
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except:
                self.frontend_process.kill()

        if self.backend_process:
            print("停止后端进程...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except:
                self.backend_process.kill()

        print("✓ 所有服务已停止")

    def run(self):
        """
        运行启动器

        流程：
        1. 启动后端
        2. 启动前端
        3. 打开 webview
        4. 等待窗口关闭
        5. 停止所有服务
        """
        try:
            # 1. 启动后端
            if not self.start_backend():
                print("后端启动失败，退出...")
                return

            # 2. 启动前端
            if not self.start_frontend():
                print("前端启动失败，退出...")
                self.stop()
                return

            # 3. 打开 webview
            self.open_webview()

            # webview.start() 是阻塞的，窗口关闭后会继续执行

        except KeyboardInterrupt:
            print("\n收到中断信号...")

        finally:
            # 4. 停止所有服务
            self.stop()


def main():
    """启动器入口"""
    launcher = PyMatrixLauncher()
    launcher.run()


if __name__ == '__main__':
    main()
