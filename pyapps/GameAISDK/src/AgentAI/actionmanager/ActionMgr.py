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
for _ in range(12):
    if os.path.isdir(os.path.join(_dir, "pycore")):
        if _dir not in sys.path:
            sys.path.insert(0, _dir)
        break
    _dir = os.path.dirname(_dir)

import json

try:
    from pycore.pyfoundations.third_party import get_third_package_msgpack
    msgpack = get_third_package_msgpack()
except ImportError:
    import msgpack
import msgpack_numpy as mn
from connect.BusConnect import BusConnect

from protocol import common_pb2
from pycore.pyfoundations.color_print import ColorPrint

MSG_ID_AI_ACTION = 2000

class ActionMgr(object):
    """
    ActionMgr implement for remote action
    """
    def __init__(self):
        self.__initialized = False
        self.__connect = BusConnect()

    def Initialize(self):
        """
        Initialize this module, init bus connection
        :return:
        """
        self.__initialized = True
        return self.__connect.Connect()

    def Finish(self):
        """
        Finish this module, tbus disconnect
        :return:
        """
        if self.__initialized:
            ColorPrint.blue('Close connection...')
            self.__connect.Close()
            self.__initialized = False

    def SendAction(self, actionID, actionData, frameSeq=-1):
        """
        Send action to remote(client)
        :param actionID: the self-defined action ID
        :param actionData: the context data of the action ID
        :param frameSeq: the frame sequence, default is -1
        :return:
        """
        if not self.__initialized:
            ColorPrint.yellow('Call Initialize first!')
            return False

        actionData['msg_id'] = MSG_ID_AI_ACTION
        actionData['action_id'] = actionID
        actionBuff = msgpack.packb(actionData, default=mn.encode, use_bin_type=True)

        msg = common_pb2.tagMessage()
        msg.eMsgID = common_pb2.MSG_AI_ACTION
        msg.stAIAction.nFrameSeq = frameSeq
        msg.stAIAction.byAIActionBuff = actionBuff
        #msgBuff = msg.SerializeToString()

        actionStr = json.dumps(actionData)
        ColorPrint.gray('{}||action||{}'.format(frameSeq, actionStr))

        self.__connect.SendMsg(msg, BusConnect.PEER_NODE_SDKTOOL)

        ret = self.__connect.SendMsg(msg, BusConnect.PEER_NODE_MC)
        if ret != 0:
            ColorPrint.yellow('TBus Send To MC return code[{0}]'.format(ret))
            return False
        return True
