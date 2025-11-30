"""ADB 相关异常定义"""


class ADBException(Exception):
    """ADB 操作基础异常"""
    pass


class DeviceNotFoundException(ADBException):
    """设备未找到异常"""
    def __init__(self, serial: str):
        super().__init__(f"Device not found: {serial}")
        self.serial = serial


class ADBCommandFailedException(ADBException):
    """ADB 命令执行失败异常"""
    def __init__(self, command: str, return_code: int, stderr: str):
        super().__init__(
            f"ADB command failed: {command}\n"
            f"Return code: {return_code}\n"
            f"Error: {stderr}"
        )
        self.command = command
        self.return_code = return_code
        self.stderr = stderr
