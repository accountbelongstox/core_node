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

import base64

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()

from common.Define import RAW_IMG_SEND_TYPE, BINARY_IMG_SEND_TYPE, CV2_EN_DECODE_IMG_SEND_TYPE, \
    BASE_64_DECODE_IMG_SEND_TYPE


def ImgDecode(imgData, sendType):
    """
    decode img data based on sendType
    :param imgData: img data(bytes)
    :param sendType: send type enum:
                                    RAW_IMG_SEND_TYPE
                                    BINARY_IMG_SEND_TYPE
                                    CV2_EN_DECODE_IMG_SEND_TYPE
                                    BASE_64_DECODE_IMG_SEND_TYPE
    :return:
    """
    img = imgData
    if sendType == RAW_IMG_SEND_TYPE:
        pass
    elif sendType == BINARY_IMG_SEND_TYPE:
        try:
            nparr = np.asarray(bytearray(imgData), dtype=np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except RuntimeError as err:
            ColorPrint.red('img decode err:%s' % (err,))
            ColorPrint.red('sendType:%s' % (sendType,))
            img = None
    elif sendType == CV2_EN_DECODE_IMG_SEND_TYPE:
        try:
            nparr = np.frombuffer(imgData, dtype=np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except RuntimeError as err:
            ColorPrint.red('img decode err:%s' % (err,))
            ColorPrint.red('sendType:%s' % (sendType,))
            img = None
    elif sendType == BASE_64_DECODE_IMG_SEND_TYPE:
        try:
            imgByte = base64.b64decode(imgData)
            nparr = np.frombuffer(imgByte, dtype=np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except RuntimeError as err:
            ColorPrint.red('img decode err:%s' % (err,))
            ColorPrint.red('sendType:%s' % (sendType,))
            img = None
    return img
