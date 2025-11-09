"""ADB related exception definitions"""


class ADBException(Exception):
    """ADB operation base exception"""
    pass


class DeviceNotFoundException(ADBException):
    """Device not found exception"""
    def __init__(self, serial: str):
        super().__init__(f"Device not found: {serial}")
        self.serial = serial


class ADBCommandFailedException(ADBException):
    """ADB command execution failed exception"""
    def __init__(self, command: str, return_code: int, stderr: str):
        super().__init__(
            f"ADB command failed: {command}\n"
            f"Return code: {return_code}\n"
            f"Error: {stderr}"
        )
        self.command = command
        self.return_code = return_code
        self.stderr = stderr
