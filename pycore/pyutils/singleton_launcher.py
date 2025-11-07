# -*- coding: utf-8 -*-
"""
单例启动类示例 (Singleton Launcher Example)

⚠️ 重要说明 / IMPORTANT NOTICE:
==========================================
这是一个示例类库，无须直接引入到项目中使用。
请将此代码复制到您的项目中，并根据实际需求进行修改和实现。

This is an example library and should NOT be imported directly.
Please copy this code to your project and modify it according to your needs.

功能说明 / Features:
==========================================
1. 单例模式：确保应用程序只启动一个后端实例
2. 双线程架构：
   - 客户端通信线程：处理与客户端的通信
   - 后端主线程：运行主要业务逻辑
3. 智能检测：自动检测是否已有实例运行
4. 资源共享：多个客户端共享同一个后端实例

技术要求 / Requirements:
==========================================
仅使用Python官方标准库，无第三方依赖
Only uses Python standard library, no third-party dependencies

实现方式 / Implementation:
==========================================
使用socket端口检测来实现单例模式
Uses socket port detection to implement singleton pattern
"""

import socket
import threading
import json
import time
import sys
from typing import Optional, Callable, Dict, Any


class SingletonLauncher:
    """
    单例启动器基类

    使用说明：
    1. 复制此类到您的项目中
    2. 继承此类并实现 run_backend() 和 run_client_communication() 方法
    3. 在主程序入口调用 start() 方法

    Example:
        class MyLauncher(SingletonLauncher):
            def run_backend(self):
                # 实现后端逻辑
                pass

            def run_client_communication(self):
                # 实现客户端通信逻辑
                pass

        launcher = MyLauncher(host='localhost', port=9999)
        launcher.start()
    """

    # 硬编码配置 / Hardcoded Configuration
    DEFAULT_HOST = 'localhost'
    DEFAULT_PORT = 19999  # 默认单例检测端口
    DEFAULT_TIMEOUT = 2   # 检测超时时间（秒）

    # 通信协议常量 / Communication Protocol Constants
    SIGNAL_CHECK = 'INSTANCE_CHECK'      # 实例检测信号
    SIGNAL_ALIVE = 'INSTANCE_ALIVE'      # 实例存活响应
    SIGNAL_SHUTDOWN = 'SHUTDOWN'         # 关闭信号

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = DEFAULT_TIMEOUT,
        debug: bool = False
    ):
        """
        初始化单例启动器

        Args:
            host: 监听地址（默认: localhost）
            port: 监听端口（默认: 19999）
            timeout: 检测超时时间（默认: 2秒）
            debug: 是否开启调试输出
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.debug = debug

        # 运行状态
        self._running = False
        self._is_primary_instance = False

        # 线程对象
        self._backend_thread: Optional[threading.Thread] = None
        self._communication_thread: Optional[threading.Thread] = None

        # 服务器socket（仅主实例使用）
        self._server_socket: Optional[socket.socket] = None

        # 事件回调
        self._on_primary_started: Optional[Callable] = None
        self._on_secondary_started: Optional[Callable] = None
        self._on_shutdown: Optional[Callable] = None

    def _log(self, message: str, level: str = 'INFO'):
        """输出日志"""
        if self.debug or level in ['ERROR', 'WARNING']:
            print(f"[{level}] SingletonLauncher: {message}")

    def _check_instance_exists(self) -> bool:
        """
        检测是否已有实例运行

        Returns:
            True: 已有实例运行
            False: 无实例运行
        """
        try:
            # 尝试连接到指定端口
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.settimeout(self.timeout)

            self._log(f"检测实例: {self.host}:{self.port}")
            client_socket.connect((self.host, self.port))

            # 发送检测信号
            message = json.dumps({
                'type': self.SIGNAL_CHECK,
                'timestamp': time.time()
            }).encode('utf-8')

            client_socket.sendall(message + b'\n')

            # 等待响应
            response = client_socket.recv(1024).decode('utf-8')
            response_data = json.loads(response.strip())

            client_socket.close()

            # 检查是否收到存活响应
            if response_data.get('type') == self.SIGNAL_ALIVE:
                self._log("检测到已有实例运行", 'WARNING')
                return True

            return False

        except (socket.timeout, socket.error, ConnectionRefusedError) as e:
            self._log(f"未检测到实例: {e}")
            return False
        except Exception as e:
            self._log(f"检测过程出错: {e}", 'ERROR')
            return False

    def _start_server_socket(self) -> bool:
        """
        启动服务器socket（单例检测用）

        Returns:
            True: 启动成功
            False: 启动失败（端口被占用）
        """
        try:
            self._server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_socket.bind((self.host, self.port))
            self._server_socket.listen(5)
            self._server_socket.settimeout(1.0)  # 设置超时以便可以响应关闭

            self._log(f"服务器socket启动成功: {self.host}:{self.port}")
            return True

        except OSError as e:
            self._log(f"服务器socket启动失败: {e}", 'ERROR')
            return False

    def _handle_client_connection(self, client_socket: socket.socket, address):
        """
        处理客户端连接（单例检测）

        Args:
            client_socket: 客户端socket
            address: 客户端地址
        """
        try:
            data = client_socket.recv(1024).decode('utf-8')
            if not data:
                return

            message = json.loads(data.strip())
            msg_type = message.get('type')

            self._log(f"收到来自 {address} 的消息: {msg_type}")

            # 响应实例检测
            if msg_type == self.SIGNAL_CHECK:
                response = json.dumps({
                    'type': self.SIGNAL_ALIVE,
                    'timestamp': time.time(),
                    'pid': sys.platform
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

            # 处理关闭信号
            elif msg_type == self.SIGNAL_SHUTDOWN:
                self._log("收到关闭信号", 'WARNING')
                self._running = False
                response = json.dumps({
                    'type': 'SHUTDOWN_ACK',
                    'timestamp': time.time()
                }).encode('utf-8')
                client_socket.sendall(response + b'\n')

        except Exception as e:
            self._log(f"处理客户端连接出错: {e}", 'ERROR')

        finally:
            client_socket.close()

    def _server_socket_loop(self):
        """服务器socket监听循环（主实例）"""
        self._log("服务器socket监听循环启动")

        while self._running:
            try:
                client_socket, address = self._server_socket.accept()
                # 使用新线程处理连接
                threading.Thread(
                    target=self._handle_client_connection,
                    args=(client_socket, address),
                    daemon=True
                ).start()

            except socket.timeout:
                continue  # 超时继续循环

            except Exception as e:
                if self._running:
                    self._log(f"服务器socket错误: {e}", 'ERROR')
                break

        self._log("服务器socket监听循环结束")

    def _backend_thread_entry(self):
        """后端线程入口"""
        self._log("后端线程启动")

        try:
            # 先启动服务器socket（单例检测）
            self._server_socket_loop()

            # 运行用户定义的后端逻辑
            self.run_backend()

        except Exception as e:
            self._log(f"后端线程异常: {e}", 'ERROR')

        finally:
            self._log("后端线程结束")

    def _communication_thread_entry(self):
        """客户端通信线程入口"""
        self._log("客户端通信线程启动")

        try:
            self.run_client_communication()

        except Exception as e:
            self._log(f"客户端通信线程异常: {e}", 'ERROR')

        finally:
            self._log("客户端通信线程结束")

    # ============================================
    # 用户需要实现的方法 / Methods to be implemented
    # ============================================

    def run_backend(self):
        """
        运行后端主逻辑（需要子类实现）

        此方法在后端主线程中运行，实现您的核心业务逻辑。
        仅在主实例（第一个启动的实例）中运行。

        Example:
            def run_backend(self):
                while self._running:
                    # 执行后端任务
                    time.sleep(1)
        """
        raise NotImplementedError("请实现 run_backend() 方法")

    def run_client_communication(self):
        """
        运行客户端通信逻辑（需要子类实现）

        此方法在客户端通信线程中运行，处理与客户端的通信。
        在所有实例（主实例和次要实例）中都会运行。

        Example:
            def run_client_communication(self):
                while self._running:
                    # 处理客户端通信
                    time.sleep(1)
        """
        raise NotImplementedError("请实现 run_client_communication() 方法")

    # ============================================
    # 公共接口 / Public Interface
    # ============================================

    def start(self) -> bool:
        """
        启动应用程序

        Returns:
            True: 启动成功（作为主实例或次要实例）
            False: 启动失败
        """
        if self._running:
            self._log("应用程序已在运行", 'WARNING')
            return False

        self._log("=== 单例启动器开始启动 ===")

        # 检测是否已有实例运行
        instance_exists = self._check_instance_exists()

        if instance_exists:
            # 已有实例运行，作为次要实例启动
            self._log("检测到主实例，作为次要实例启动", 'WARNING')
            self._is_primary_instance = False

            # 触发次要实例启动回调
            if self._on_secondary_started:
                self._on_secondary_started()

        else:
            # 无实例运行，作为主实例启动
            self._log("未检测到主实例，作为主实例启动")
            self._is_primary_instance = True

            # 启动服务器socket
            if not self._start_server_socket():
                self._log("无法启动服务器socket，启动失败", 'ERROR')
                return False

            # 启动后端线程
            self._backend_thread = threading.Thread(
                target=self._backend_thread_entry,
                name="BackendThread",
                daemon=False
            )

            # 触发主实例启动回调
            if self._on_primary_started:
                self._on_primary_started()

        # 启动客户端通信线程（所有实例都需要）
        self._communication_thread = threading.Thread(
            target=self._communication_thread_entry,
            name="ClientCommunicationThread",
            daemon=False
        )

        # 设置运行标志
        self._running = True

        # 启动线程
        if self._is_primary_instance and self._backend_thread:
            self._backend_thread.start()

        self._communication_thread.start()

        self._log(f"=== 启动完成 (主实例: {self._is_primary_instance}) ===")
        return True

    def stop(self):
        """停止应用程序"""
        if not self._running:
            return

        self._log("=== 开始停止应用程序 ===")

        self._running = False

        # 触发关闭回调
        if self._on_shutdown:
            self._on_shutdown()

        # 等待线程结束
        if self._communication_thread:
            self._communication_thread.join(timeout=5)

        if self._backend_thread:
            self._backend_thread.join(timeout=5)

        # 关闭服务器socket
        if self._server_socket:
            try:
                self._server_socket.close()
            except:
                pass

        self._log("=== 应用程序已停止 ===")

    def is_running(self) -> bool:
        """检查是否正在运行"""
        return self._running

    def is_primary_instance(self) -> bool:
        """检查是否为主实例"""
        return self._is_primary_instance

    # ============================================
    # 事件回调设置 / Event Callback Setters
    # ============================================

    def on_primary_started(self, callback: Callable):
        """设置主实例启动回调"""
        self._on_primary_started = callback
        return self

    def on_secondary_started(self, callback: Callable):
        """设置次要实例启动回调"""
        self._on_secondary_started = callback
        return self

    def on_shutdown(self, callback: Callable):
        """设置关闭回调"""
        self._on_shutdown = callback
        return self


# ============================================
# 使用示例 / Usage Example
# ============================================

class ExampleLauncher(SingletonLauncher):
    """示例实现"""

    def run_backend(self):
        """后端逻辑示例"""
        print("后端线程开始运行...")
        counter = 0
        while self._running:
            counter += 1
            print(f"后端任务执行中... (计数: {counter})")
            time.sleep(2)
        print("后端线程结束")

    def run_client_communication(self):
        """客户端通信逻辑示例"""
        print("客户端通信线程开始运行...")
        counter = 0
        while self._running:
            counter += 1
            print(f"客户端通信处理中... (计数: {counter})")
            time.sleep(3)
        print("客户端通信线程结束")


def main():
    """示例主函数"""
    print("=== SingletonLauncher 使用示例 ===\n")

    # 创建启动器实例
    launcher = ExampleLauncher(
        host='localhost',
        port=19999,
        debug=True
    )

    # 设置回调
    launcher.on_primary_started(lambda: print("✓ 作为主实例启动"))
    launcher.on_secondary_started(lambda: print("✓ 作为次要实例启动"))
    launcher.on_shutdown(lambda: print("✓ 应用程序即将关闭"))

    # 启动
    if launcher.start():
        try:
            # 保持主线程运行
            print("\n应用程序运行中，按 Ctrl+C 停止...\n")
            while launcher.is_running():
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n收到中断信号")

        finally:
            launcher.stop()
    else:
        print("启动失败！")


if __name__ == '__main__':
    main()
