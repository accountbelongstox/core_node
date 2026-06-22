# -*- coding: utf-8 -*-
"""
Tencent is pleased to support the open source community by making GameAISDK available.

This source code file is licensed under the GNU General Public License Version 3.
For full details, please refer to the file "LICENSE.txt" which is provided as part of this source code package.

Copyright (C) 2020 THL A29 Limited, a Tencent company.  All rights reserved.
"""
import sys
import os
_dir = os.path.dirname(os.path.abspath(__file__))
while _dir and not os.path.isdir(os.path.join(_dir, "pycore")):
    _dir = os.path.dirname(_dir)
if _dir and _dir not in sys.path:
    sys.path.insert(0, _dir)

import os
import sys
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_cv2

cv2 = get_third_package_cv2()

cur_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(cur_dir)

from .wrappedDeviceConfig import Platform, DeviceType, LOG_DIR, SAVE_PIC
from .deviceAPI.pcDevice.windows.windowsDevice import WindowsDevice


def _get_android_device(platform):
    from .deviceAPI.mobileDevice.android.androidDevice import AndroidDevice
    return AndroidDevice(platform)


def _get_ios_device(platform):
    from .deviceAPI.mobileDevice.ios.iOSDevice import IOSDevice
    return IOSDevice(platform)


class DeviceAdapter(object):
    def __init__(self, device_type, platform=Platform.Local.value):
        """
        :param device_type: 'Android'|'IOS'|'Windows'
        :param platform: 'Local'|'WeTest'
        """
        self.device_type = device_type
        self.platform = platform
        self.log_dir = None
        self.picDir = None
        self.__device = None
        if self.device_type == DeviceType.Android.value:
            self.__device = _get_android_device(platform)
        elif self.device_type == DeviceType.IOS.value:
            self.__device = _get_ios_device(platform)
        elif self.device_type == DeviceType.Windows.value:
            self.__device = WindowsDevice(platform)
        else:
            raise Exception("Unknown device type: {}".format(self.device_type))

    def initialize(self, log_dir=LOG_DIR, **kwargs):
        """
        Initialize device.
        :param log_dir: str, log directory path
        :param kwargs: see self.__device.initialize for implementation
        :return: True/False
        """
        self.log_dir = os.path.join(log_dir, self.device_type)
        self.picDir = os.path.join(self.log_dir, "pic")
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
        if not os.path.exists(self.picDir):
            os.makedirs(self.picDir)

        try:
            return self.__device.initialize(self.log_dir, **kwargs)
        except Exception as err:
            raise Exception(err)

    def deInitialize(self):
        """
        Release device resources.
        :return: True/False
        """
        try:
            return self.__device.deInitialize()
        except Exception as err:
            raise Exception(err)

    def getScreen(self, **kwargs):
        """
        获取当前图像帧
        :return: Mat类型的图像/None
        """
        try:
            return self.__device.getScreen(**kwargs)
        except Exception as err:
            raise Exception(err)

    def doAction(self, **kwargs):
        """
        操作设备
        :param kwargs: 格式{"aType": "xxx", "param1": _, "param2":, _}, self.__device.doAction查看对应实现;
        :return: True/False
        """
        if 'aType' not in kwargs:
            raise Exception("got an action without aType: {}".format(kwargs))
        else:
            filename = datetime.now().strftime('%m-%d_%H-%M-%S_%f.jpg')
            filepath = os.path.join(self.picDir, filename)
            if SAVE_PIC:
                while True:
                    img_data = self.getScreen()
                    if img_data is not None:
                        cv2.imwrite(filepath, img_data)
                        break
            return self.__device.doAction(**kwargs)
