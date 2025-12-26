#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Command Executor (Commander)
Provides unified command execution with real-time output and result collection
"""

import os
import sys
import platform
import shutil
import re
from typing import Optional, Union, List, Tuple
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.safe_subprocess import subprocess


class CommandResult:
    """Command execution result container"""
    
    def __init__(self, return_code: int, stdout: str = "", stderr: str = "", combined: str = ""):
        self.return_code = return_code
        self.stdout = stdout
        self.stderr = stderr
        self.combined = combined
        self.success = return_code == 0
    
    def __bool__(self) -> bool:
        """Return True if command succeeded"""
        return self.success
    
    def __str__(self) -> str:
        """Return combined output"""
        return self.combined
    
    def has_output(self) -> bool:
        """Check if there is any output"""
        return bool(self.stdout or self.stderr or self.combined)
    
    def get_output(self) -> str:
        """Get combined output (recommended for checking results)"""
        return self.combined


class Commander:
    """
    Global command executor with real-time output and result collection
    
    Features:
    - Real-time output display
    - Automatic output collection (stdout, stderr, combined)
    - Platform-aware execution
    - Return code tracking
    - Recommended: Use returned string for result checking instead of return code
    """
    
    @staticmethod
    def _byte_to_str(data: Union[str, bytes]) -> str:
        """Convert bytes to string, handling various encodings"""
        if isinstance(data, str):
            return data
        
        try:
            return data.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return data.decode('gbk')
            except UnicodeDecodeError:
                return str(data)
    
    @staticmethod
    def _get_executable(command: Union[str, List]) -> Optional[str]:
        """Get executable path from command"""
        if isinstance(command, list):
            executable = command[0]
        else:
            executable = command.split(' ')[0] if command else None
        
        if not executable:
            return None
        
        if os.path.isabs(executable):
            return executable
        
        return shutil.which(executable)
    
    @staticmethod
    def _prepare_command(command: Union[str, List]) -> Tuple[str, Optional[str]]:
        """Prepare command string and executable"""
        if isinstance(command, list):
            executable = command[0]
            command_str = " ".join(str(cmd) for cmd in command)
        else:
            command_str = str(command)
            executable = command_str.split(' ')[0] if command_str else None
        
        return command_str, executable
    
    @staticmethod
    def _create_process(command: str, executable: Optional[str] = None, cwd: Optional[str] = None) -> subprocess.Popen:
        """Create subprocess with platform-specific settings"""
        system = platform.system()

        if system == "Linux":
            return subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                executable="/bin/bash",
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                errors='replace',
                cwd=cwd
            )
        else:
            # Windows or other platforms
            # Do NOT set executable parameter on Windows when shell=True
            # Setting executable replaces the shell (cmd.exe) with the specified program
            # which causes issues when the command contains paths with special characters
            return subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                errors='replace',
                cwd=cwd
            )
    
    @staticmethod
    def exec_realtime(
        command: Union[str, List],
        info: bool = True,
        cwd: Optional[str] = None,
        show_output: bool = True
    ) -> CommandResult:
        """
        Execute command with real-time output and collect results
        
        This method:
        - Displays output in real-time (if show_output=True)
        - Collects all output (stdout, stderr, combined)
        - Returns CommandResult with all collected data
        
        Recommended: Use returned CommandResult.get_output() or str(result) for checking results
        instead of relying on return_code alone.
        
        Args:
            command: Command to execute (string or list)
            info: Show command info message
            cwd: Working directory for command execution
            show_output: Whether to display output in real-time
        
        Returns:
            CommandResult object with return_code, stdout, stderr, and combined output
        """
        command_str, executable = Commander._prepare_command(command)
        
        if info:
            ColorPrint.success(f"Executing command: {command_str}")
        
        try:
            process = Commander._create_process(command_str, executable, cwd)
            
            stdout_lines = []
            stderr_lines = []
            
            # Read stdout in real-time
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    line = output.strip()
                    stdout_lines.append(line)
                    if show_output and info:
                        ColorPrint.info(line)
            
            # Read stderr
            stderr_output = process.stderr.read()
            if stderr_output:
                stderr_lines = [line.strip() for line in stderr_output.strip().split('\n') if line.strip()]
                if show_output and info:
                    for line in stderr_lines:
                        ColorPrint.warn(line)
            
            return_code = process.poll()
            
            # Combine outputs
            stdout_text = "\n".join(stdout_lines)
            stderr_text = "\n".join(stderr_lines)
            
            # Create combined output
            combined_parts = []
            if stdout_text:
                combined_parts.append(stdout_text)
            if stderr_text:
                combined_parts.append(stderr_text)
            combined_text = "\n".join(combined_parts)
            
            # Convert to string format
            stdout_text = Commander._byte_to_str(stdout_text)
            stderr_text = Commander._byte_to_str(stderr_text)
            combined_text = Commander._byte_to_str(combined_text)
            
            return CommandResult(
                return_code=return_code or 0,
                stdout=stdout_text,
                stderr=stderr_text,
                combined=combined_text
            )
            
        except Exception as e:
            error_msg = f"Command execution failed: {str(e)}"
            ColorPrint.error(error_msg)
            return CommandResult(
                return_code=-1,
                stdout="",
                stderr=error_msg,
                combined=error_msg
            )
    
    @staticmethod
    def exec_capture(
        command: Union[str, List],
        info: bool = True,
        cwd: Optional[str] = None,
        show_output: bool = True
    ) -> CommandResult:
        """
        Execute command with real-time output display and capture all results
        
        This method:
        - Shows real-time output (default behavior)
        - Captures stdout, stderr separately
        - Returns CommandResult with all collected data
        
        Recommended: Use returned CommandResult.get_output() or str(result) for checking results
        instead of relying on return_code alone.
        
        Args:
            command: Command to execute (string or list)
            info: Show command info message
            cwd: Working directory for command execution
            show_output: Whether to display output in real-time (default: True)
        
        Returns:
            CommandResult object with return_code, stdout, stderr, and combined output
        """
        # This is essentially the same as exec_realtime, but with explicit naming
        # to indicate it captures output while showing real-time display
        return Commander.exec_realtime(command, info, cwd, show_output)
    
    @staticmethod
    def exec_silent(
        command: Union[str, List],
        info: bool = False,
        cwd: Optional[str] = None,
        **kwargs  # Accept additional subprocess-compatible arguments (e.g., capture_output, text, timeout)
    ) -> CommandResult:
        """
        Execute command silently (no output display) but still collect results

        This method:
        - Does NOT display output in real-time
        - Still collects all output (stdout, stderr, combined)
        - Returns CommandResult with all collected data

        Recommended: Use returned CommandResult.get_output() or str(result) for checking results
        instead of relying on return_code alone.

        Args:
            command: Command to execute (string or list)
            info: Show command info message (default: False for silent mode)
            cwd: Working directory for command execution
            **kwargs: Additional arguments (e.g., capture_output, text, timeout) are accepted for
                     compatibility with subprocess.run() but may be ignored since exec_silent
                     already captures output by default

        Returns:
            CommandResult object with return_code, stdout, stderr, and combined output
        """
        # Note: kwargs like capture_output, text are ignored since exec_silent already captures output
        # timeout is also handled internally by subprocess operations
        return Commander.exec_realtime(command, info, cwd, show_output=False)


# Global instance for convenience
commander = Commander()

# Convenience functions
def exec_realtime(command: Union[str, List], info: bool = True, cwd: Optional[str] = None, show_output: bool = True) -> CommandResult:
    """Execute command with real-time output and collect results"""
    return Commander.exec_realtime(command, info, cwd, show_output)


def exec_capture(command: Union[str, List], info: bool = True, cwd: Optional[str] = None, show_output: bool = True) -> CommandResult:
    """Execute command with real-time output display and capture all results"""
    return Commander.exec_capture(command, info, cwd, show_output)


def exec_silent(command: Union[str, List], info: bool = False, cwd: Optional[str] = None, **kwargs) -> CommandResult:
    """Execute command silently but still collect results

    Args:
        command: Command to execute (string or list)
        info: Show command info message (default: False)
        cwd: Working directory for command execution
        **kwargs: Additional arguments (e.g., capture_output, text, timeout) are accepted for
                 compatibility with subprocess.run() but may be ignored

    Returns:
        CommandResult object with all collected data
    """
    return Commander.exec_silent(command, info, cwd, **kwargs)


def exec_check(command: Union[str, List], cwd: Optional[str] = None) -> str:
    """
    Execute command and return stdout if successful, raise exception if failed

    Args:
        command: Command to execute
        cwd: Working directory

    Returns:
        stdout as string

    Raises:
        RuntimeError: If command fails
    """
    result = Commander.exec_silent(command, info=False, cwd=cwd)
    if not result.success:
        raise RuntimeError(f"Command failed with code {result.return_code}: {result.stderr}")
    return result.stdout


def command_exists(command: str) -> bool:
    """
    Check if a command exists in PATH

    Args:
        command: Command name to check

    Returns:
        True if command exists
    """
    executable = Commander._get_executable(command)
    return executable is not None


def get_command_output(command: Union[str, List], cwd: Optional[str] = None) -> str:
    """
    Execute command and return stdout (silent mode)

    Args:
        command: Command to execute
        cwd: Working directory

    Returns:
        stdout as string
    """
    result = Commander.exec_silent(command, info=False, cwd=cwd)
    return result.stdout


def run_background(
    command: Union[str, List],
    cwd: Optional[str] = None,
    env: Optional[dict] = None,
    log_file: Optional[str] = None,
    detached: bool = True
) -> subprocess.Popen:
    """
    Run command in background (detached process)

    Args:
        command: Command to execute
        cwd: Working directory
        env: Environment variables (if None, inherits from current process)
        log_file: Path to log file for stdout/stderr (if None, uses DEVNULL)
        detached: Whether to fully detach process (default: True)
                  On Windows: uses DETACHED_PROCESS and CREATE_NEW_PROCESS_GROUP
                  On Linux: uses start_new_session=True

    Returns:
        Popen process object
    """
    command_str, executable = Commander._prepare_command(command)

    # Determine stdout/stderr
    if log_file:
        log_handle = open(log_file, 'w', encoding='utf-8')
        stdout_target = log_handle
        stderr_target = log_handle
    else:
        stdout_target = subprocess.DEVNULL
        stderr_target = subprocess.DEVNULL

    # Platform-specific process creation
    system = platform.system()

    if system == "Windows" and detached:
        # Windows: Use detached process flags
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200

        return subprocess.Popen(
            command_str,
            shell=True,
            cwd=cwd,
            env=env,
            creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=stdout_target,
            stderr=stderr_target
        )
    elif system == "Linux" and detached:
        # Linux: Use start_new_session for proper detachment
        return subprocess.Popen(
            command_str,
            shell=True,
            cwd=cwd,
            env=env,
            start_new_session=True,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=stdout_target,
            stderr=stderr_target
        )
    else:
        # Other platforms or non-detached
        return subprocess.Popen(
            command_str,
            shell=True,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=stdout_target,
            stderr=stderr_target
        )

