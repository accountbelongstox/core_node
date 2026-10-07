#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Command Executor (Commander)
Provides unified command execution with real-time output and result collection.

Base API for external commands: Commander.run_command(cmd, capture_output=..., timeout=..., cwd=...).
- Stream mode (capture_output=False): inherited stdout/stderr, real-time progress bar.
- Capture mode (capture_output=True): subprocess.run(capture_output=True), returns CompletedProcess.
third_party.run_third_party_command delegates here for all pip/third-party subprocess execution.
"""

import os
import sys
import platform
import shutil
import shlex
import re
import subprocess
from typing import Optional, Union, List, Tuple

# Intra-pybasecommon import (allowed: both live in the stdlib-only kernel and
# color_print imports nothing from pycore, so there is no cycle). Commander
# routes its live output through ColorPrint so subprocess lines reach the SAME
# shared callback registry (the observer pipeline) as colored logs.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

TIMEOUT_RETURN_CODE = 124
LINUX_SHELL = "/bin/bash"


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
        
        errors = []
        for encoding in ('utf-8', 'gbk'):
            try:
                return data.decode(encoding)
            except UnicodeDecodeError as exc:
                errors.append(f"{encoding}: {exc}")
        ColorPrint.gray(f"[Commander] undecodable output ({'; '.join(errors)}); using repr")
        return str(data)
    
    @staticmethod
    def run_command(
        cmd: List,
        capture_output: bool = False,
        timeout: Optional[int] = None,
        cwd: Optional[str] = None,
        env: Optional[dict] = None,
    ) -> Optional[subprocess.CompletedProcess]:
        """
        Base command execution for pycore. All subprocess runs that need stream or capture
        should go through this or third_party.run_third_party_command (which delegates here).
        - capture_output=False: Popen(cmd, stdout=None, stderr=None) so output and progress bar
          are real-time (inherited streams). wait(); returns None.
        - capture_output=True: subprocess.run(cmd, capture_output=True, timeout=..., encoding=utf-8);
          returns CompletedProcess. Use for pip show etc.
        cmd must be a list (no shell). Ref: https://docs.python.org/3/library/subprocess.html
        """
        if capture_output:
            return subprocess.run(
                cmd,
                capture_output=True,
                timeout=timeout if timeout is not None else 10,
                encoding="utf-8",
                errors="replace",
                cwd=cwd,
                env=env,
            )
        proc = subprocess.Popen(
            cmd,
            stdout=None,
            stderr=None,
            cwd=cwd,
            env=env,
        )
        proc.wait()
        return None

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
    def _prepare_command(command: Union[str, List]) -> Tuple[Union[str, List[str]], bool, str]:
        """Popen arguments, shell flag and display string.

        A list is an argv and runs WITHOUT a shell (no quoting or injection
        issues); only an explicit string command goes through the shell.
        """
        if isinstance(command, (list, tuple)):
            args = [str(item) for item in command]
            display = subprocess.list2cmdline(args) if os.name == "nt" else shlex.join(args)
            return args, False, display
        command_str = str(command)
        return command_str, True, command_str

    @staticmethod
    def _create_process(
        args: Union[str, List[str]],
        shell: bool,
        cwd: Optional[str] = None,
        merge_stderr: bool = False,
        stdin_pipe: bool = False,
    ) -> subprocess.Popen:
        """Create the subprocess; ``merge_stderr`` folds stderr into stdout so a
        streaming reader can never block on a full stderr pipe, and
        ``stdin_pipe`` opens stdin for ``communicate(input=...)``."""
        options = {
            "shell": shell,
            "stdin": subprocess.PIPE if stdin_pipe else None,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT if merge_stderr else subprocess.PIPE,
            "bufsize": 1,
            "universal_newlines": True,
            "encoding": "utf-8",
            "errors": "replace",
            "cwd": cwd,
        }
        # Windows: never set executable with shell=True (it would replace cmd.exe).
        if shell and platform.system() == "Linux":
            options["executable"] = LINUX_SHELL
        return subprocess.Popen(args, **options)
    
    @staticmethod
    def exec_realtime(
        command: Union[str, List],
        info: bool = True,
        cwd: Optional[str] = None,
        show_output: bool = True,
        timeout: Optional[float] = None,
        input_text: Optional[str] = None,
    ) -> CommandResult:
        """
        Execute command with real-time output and collect results
        
        This method:
        - Displays output in real-time (if show_output=True); stderr is merged
          into the streamed output so neither pipe can fill up and block
        - Otherwise collects stdout and stderr separately and concurrently
          (communicate), honoring ``timeout`` (return code 124 on expiry)
        - Returns CommandResult with all collected data
        
        Recommended: Use returned CommandResult.get_output() or str(result) for checking results
        instead of relying on return_code alone.
        
        Args:
            command: Command to execute (list = argv without a shell; string = shell command)
            info: Show command info message
            cwd: Working directory for command execution
            show_output: Whether to display output in real-time
            timeout: Seconds before a non-streaming command is killed
            input_text: Text written to stdin of a non-streaming command (secrets
                go here, never into the argv)
        
        Returns:
            CommandResult object with return_code, stdout, stderr, and combined output
        """
        args, shell, command_str = Commander._prepare_command(command)

        if info:
            ColorPrint.stream(f"Executing command: {command_str}", color="blue", log_level="INFO")

        try:
            stdout_lines = []
            stderr_lines = []
            return_code = 0

            if show_output:
                process = Commander._create_process(args, shell, cwd, merge_stderr=True)
                for output in process.stdout:
                    line = output.strip()
                    stdout_lines.append(line)
                    if info:
                        ColorPrint.stream(line, color="gray", log_level="DEBUG")
                return_code = process.wait()
            else:
                process = Commander._create_process(args, shell, cwd, stdin_pipe=input_text is not None)
                try:
                    stdout_output, stderr_output = process.communicate(input=input_text, timeout=timeout)
                    return_code = process.returncode
                except subprocess.TimeoutExpired:
                    ColorPrint.yellow(f"[Commander] timeout after {timeout}s, killing: {command_str}")
                    process.kill()
                    stdout_output, stderr_output = process.communicate()
                    return_code = TIMEOUT_RETURN_CODE
                    stderr_output = f"{stderr_output or ''}\ntimeout after {timeout}s: {command_str}"
                stdout_lines = [line.strip() for line in (stdout_output or "").splitlines()]
                stderr_lines = [line.strip() for line in (stderr_output or "").strip().split('\n') if line.strip()]
            
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
            
        except (OSError, ValueError, subprocess.SubprocessError) as e:
            error_msg = f"Command execution failed: {command_str}: {e}"
            ColorPrint.stream(error_msg, color="red", log_level="ERROR")
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
            **kwargs: ``timeout`` (seconds) kills the command on expiry (return code 124);
                     ``input`` (text) is written to the command's stdin;
                     other subprocess.run()-style arguments (capture_output, text, ...) are
                     accepted for compatibility and ignored, since output is always captured

        Returns:
            CommandResult object with return_code, stdout, stderr, and combined output
        """
        return Commander.exec_realtime(
            command, info, cwd, show_output=False, timeout=kwargs.get("timeout"),
            input_text=kwargs.get("input"),
        )


    @staticmethod
    def run_args(
        command: List[str],
        input_text: Optional[str] = None,
        timeout: float = 10,
        detach_output: bool = False,
    ) -> CommandResult:
        """
        Run an argv list without a shell, optionally feeding stdin.

        detach_output=True sends stdout/stderr to DEVNULL; required for tools
        that fork a background owner (xclip, wl-copy) and keep inherited pipes open.
        """
        executable = shutil.which(command[0]) if command else None
        if executable is None:
            return CommandResult(127, stderr=f"command not found: {command[0] if command else ''}")
        output_target = subprocess.DEVNULL if detach_output else subprocess.PIPE
        try:
            completed = subprocess.run(
                [executable, *command[1:]],
                input=input_text,
                stdout=output_target,
                stderr=output_target,
                timeout=timeout,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
        except subprocess.TimeoutExpired:
            ColorPrint.yellow(f"[Commander] timeout after {timeout}s: {command[0]}")
            return CommandResult(124, stderr=f"timeout after {timeout}s: {command[0]}")
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
        return CommandResult(completed.returncode, stdout, stderr, stdout + stderr)

    @staticmethod
    def run_args_bytes(
        command: List[str],
        input_bytes: Optional[bytes] = None,
        timeout: float = 10,
        detach_output: bool = False,
    ) -> Tuple[bool, bytes]:
        """Binary variant of run_args: feed raw stdin, return (success, raw stdout)."""
        executable = shutil.which(command[0]) if command else None
        if executable is None:
            return False, b""
        output_target = subprocess.DEVNULL if detach_output else subprocess.PIPE
        try:
            completed = subprocess.run(
                [executable, *command[1:]],
                input=input_bytes,
                stdout=output_target,
                stderr=subprocess.DEVNULL,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            ColorPrint.yellow(f"[Commander] timeout after {timeout}s: {command[0]}")
            return False, b""
        return completed.returncode == 0, completed.stdout or b""


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


def run_args(
    command: List[str],
    input_text: Optional[str] = None,
    timeout: float = 10,
    detach_output: bool = False,
) -> CommandResult:
    """Run an argv list without a shell; see Commander.run_args."""
    return Commander.run_args(command, input_text, timeout, detach_output)


def run_args_bytes(
    command: List[str],
    input_bytes: Optional[bytes] = None,
    timeout: float = 10,
    detach_output: bool = False,
) -> Tuple[bool, bytes]:
    """Run an argv list with binary stdin/stdout; see Commander.run_args_bytes."""
    return Commander.run_args_bytes(command, input_bytes, timeout, detach_output)


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
    args, shell, _command_str = Commander._prepare_command(command)

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
            args,
            shell=shell,
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
            args,
            shell=shell,
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
            args,
            shell=shell,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=stdout_target,
            stderr=stderr_target
        )

