# -*- coding: utf-8 -*-
"""
AdbTool: wrap adb command for Windows host.
Compatible with GameAISDK Android/WeTest path; uses system adb when available.
"""
import subprocess
import sys
import os


class AdbTool(object):
    def __init__(self, serial=None):
        self._serial = serial

    def cmd(self, *args):
        """Run adb with given args; return object with .communicate() -> (stdout, stderr)."""
        cmd_list = ['adb']
        if self._serial:
            cmd_list.extend(['-s', self._serial])
        cmd_list.extend([str(a) for a in args])
        try:
            proc = subprocess.Popen(
                cmd_list,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                cwd=os.getcwd()
            )
            return proc
        except Exception as e:
            return _FakePopen(e)


class _FakePopen(object):
    """When adb is not available, communicate() returns (None, error)."""
    def __init__(self, err):
        self._err = err

    def communicate(self, input=None, timeout=None):
        return (None, getattr(self._err, 'message', str(self._err)) if self._err else None)
