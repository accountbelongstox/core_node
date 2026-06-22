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

try:
    from pycore.pyfoundations.third_party import get_third_package_msgpack
    msgpack = get_third_package_msgpack()
except ImportError:
    import msgpack

try:
    from pycore.pyfoundations.third_party import get_third_package_zmq
    zmq = get_third_package_zmq()
except ImportError:
    import zmq

from common.CommonContext import IO_SERVICE_CONTEXT
from pycore.pyfoundations.color_print import ColorPrint


class ZMQSocket(object):
    """
    Socket implementation based on ZMQ
    """
    def __init__(self, port, pattern, ip='*', sendLastMsg=False):
        self.__context = zmq.Context()
        self.__zmqSocket = self.__context.socket(pattern)
        if sendLastMsg:
            self.__zmqSocket.setsockopt(zmq.CONFLATE, 1)
        self.__port = port
        self.__ip = ip

    def Initialize(self, isServer=True):
        """
        Initialize this socket
        :param isServer: whether run as a Server
        :return: True or false
        """
        try:
            if isServer:
                addr = 'tcp://%s:%d' % (self.__ip, self.__port)
                ColorPrint.blue('ZMQSocket bind [{0}]'.format(addr))
                self.__zmqSocket.bind(addr)
            else:
                self.__zmqSocket.setsockopt(zmq.IDENTITY,
                                            msgpack.packb(IO_SERVICE_CONTEXT['source_server_id']))
                addr = 'tcp://%s:%d' % (self.__ip, self.__port)
                ColorPrint.blue('ZMQSocket connect [{0}]'.format(addr))
                self.__zmqSocket.connect(addr)
            return True
        except Exception as e:
            ColorPrint.red('ZMQ Error [{0}]'.format(e))
            return False

    def Recv(self):
        """
        Recv data on this socket
        :return: the received data
        """
        try:
            data = self.__zmqSocket.recv()
        except Exception as err:
            ColorPrint.red('Recv data exception in zmq:{}'.format(err))
            return None

        if data is None:
            ColorPrint.red('Recv data is None in zmq')
        return data

    def Send(self, data=None):
        """
        Send data on this socket
        :param data: the data to be sent
        :return: True or false
        """
        if data is None:
            ColorPrint.red('Send data is None')
            return False
        try:
            self.__zmqSocket.send(data)
        except Exception as err:
            ColorPrint.red('Send data exception in zmq:{}'.format(err))
            return False

        return True

    def Finish(self):
        """
        Finish this socket and terminate the context.
        """
        self.__zmqSocket.close()
        self.__context.term()
