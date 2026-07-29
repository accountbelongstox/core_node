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

import json
import logging
import traceback
from collections import OrderedDict
import os

from pycore.pyfoundations.third_party.api import get_third_package_cv2

cv2 = get_third_package_cv2()

from ....config_manager.ai.ai_manager import AIManager
from ....ui.tree.project_data_manager import ProjectDataManager
from ....common.define import RECORD_CONFIG_FILE, ACTION_SAMPLE_CFG_PATH, BASE_ACTION_CFG_PATH, \
    AI_ACTION_TYPES, ACTION_SAMPLE_GAME_ACTION_CFG_PATH, RECORD_CONFIG_KEYS_ORDER
from ...dialog.tip_dialog import show_warning_tips

logger = logging.getLogger("sdktool")


class TrainData(object):
    def __init__(self):
        self.__record_param = None  # in-memory record params for config panel

    def load_record_data(self):
        if self.__record_param is None:
            return self.new_record_data()
        return self.__record_param

    def new_record_data(self):
        raw = None
        if os.path.exists(ACTION_SAMPLE_CFG_PATH):
            try:
                with open(ACTION_SAMPLE_CFG_PATH, encoding='utf-8') as f:
                    raw = json.load(f, object_pairs_hook=OrderedDict)
            except (OSError, IOError, ValueError):
                raw = None
        if raw is None:
            try:
                with open(RECORD_CONFIG_FILE, encoding='utf-8') as f:
                    raw = json.load(f, object_pairs_hook=OrderedDict)
            except (OSError, IOError, ValueError) as err:
                logger.error("load record config failed: %s", err)
                traceback.print_exc()
                return self.__record_param if self.__record_param is not None else OrderedDict()
        self.__record_param = OrderedDict()
        for k in RECORD_CONFIG_KEYS_ORDER:
            if k in raw:
                self.__record_param[k] = raw[k]
        for k, v in raw.items():
            if k not in self.__record_param:
                self.__record_param[k] = v
        return self.__record_param

    def save_record_data(self, in_param=None):
        """Persist record config into project cfg. Merges in_param and network size into cfg/cfg.json."""
        if in_param is None:
            in_param = OrderedDict()

        cfg_path = ACTION_SAMPLE_CFG_PATH if os.path.exists(ACTION_SAMPLE_CFG_PATH) else RECORD_CONFIG_FILE
        try:
            with open(cfg_path, encoding='utf-8') as f:
                action_sample_param = json.load(f, object_pairs_hook=OrderedDict)
        except (OSError, IOError, ValueError) as err:
            logger.error("save_record_data: read failed %s", err)
            return

        for key, value in in_param.items():
            self.__record_param[key] = value
            action_sample_param[key] = value

        if 'FrameHeight' not in action_sample_param:
            action_sample_param['FrameHeight'] = 360
            action_sample_param['FrameWidth'] = 640
        ai_mgr = AIManager()
        imitation = ai_mgr.get_ai_parameter(ai_mgr.get_ai_type())
        im_configure = imitation.get_config()
        if im_configure:
            network = im_configure['network']
            action_sample_param['FrameHeight'] = network['inputHeight']
            action_sample_param['FrameWidth'] = network['inputWidth']
        action_sample_param["GameName"] = 'output'
        self._save_project_data(action_sample_param)
        try:
            with open(ACTION_SAMPLE_CFG_PATH, "w", encoding='utf-8') as f:
                json.dump(action_sample_param, f, indent=4, separators=(',', ':'))
        except (OSError, IOError) as err:
            logger.error("save_record_data: write failed %s", err)

    @staticmethod
    def _save_project_data(param):
        """Set SavePath and ActionCfgFile on param from current project."""
        data_mgr = ProjectDataManager()
        project_path = data_mgr.get_project_path()
        abs_path = "{}/{}/".format(os.getcwd(), project_path)
        param["SavePath"] = abs_path
        param["ActionCfgFile"] = BASE_ACTION_CFG_PATH

    @staticmethod
    def _change_joystick_action(action_region, sample_action,
                                image_width, image_height, screen_width, screen_height):
        sample_action['QuantizedNumber'] = action_region['quantizeNumber']
        center_x_ratio = action_region['center']['x'] * 1.0 / image_width
        center_y_ratio = action_region['center']['y'] * 1.0 / image_height
        sample_action['centerx'] = int(center_x_ratio * screen_width)
        sample_action['centery'] = int(center_y_ratio * screen_height)
        inner_w_ratio = action_region['inner']['w'] * 1.0 / image_width
        inner_h_ratio = action_region['inner']['h'] * 1.0 / image_height

        sample_action['rangeInner'] = int((inner_w_ratio * screen_width +
                                           inner_h_ratio * screen_height) / 4)
        outer = action_region['outer']
        outer_w_ratio = outer['w'] * 1.0 / image_width
        outer_h_ratio = outer['h'] * 1.0 / image_height

        sample_action['rangeOuter'] = int((outer_w_ratio * screen_width +
                                           outer_h_ratio * screen_height) / 4)

    @staticmethod
    def _change_swipe_action(action_region, sample_action,
                             image_width, image_height, screen_width, screen_height):
        start_x = action_region['startPoint']['x']
        x_ratio = start_x * 1.0 / image_width
        start_y = action_region['startPoint']['y']
        y_ratio = start_y * 1.0 / image_height
        sample_action['startX'] = int(x_ratio * screen_width)
        sample_action['startY'] = int(y_ratio * screen_height)

        end_x = action_region['endPoint']['x']
        x_ratio = end_x * 1.0 / image_width
        end_y = action_region['endPoint']['y']
        y_ratio = end_y * 1.0 / image_height

        sample_action['endX'] = int(x_ratio * screen_width)
        sample_action['endY'] = int(y_ratio * screen_height)

        start_rect_x = action_region['startRect']['x']
        x_ratio = start_rect_x * 1.0 / image_width
        start_rect_y = action_region['startRect']['y']
        y_ratio = start_rect_y * 1.0 / image_height
        start_rect_width = action_region['startRect']['w']
        w_ratio = start_rect_width * 1.0 / image_width
        start_rect_height = action_region['startRect']['h']
        h_ratio = start_rect_height * 1.0 / image_height

        sample_action['startRectx'] = int(x_ratio * screen_width)
        sample_action['startRecty'] = int(y_ratio * screen_height)
        sample_action['startRectWidth'] = int(w_ratio * screen_width)
        sample_action['startRectHeight'] = int(h_ratio * screen_height)

        end_rect_x = action_region['endRect']['x']
        x_ratio = end_rect_x * 1.0 / image_width
        end_rect_y = action_region['endRect']['y']
        y_ratio = end_rect_y * 1.0 / image_height
        end_rect_w = action_region['endRect']['w']
        w_ratio = end_rect_w * 1.0 / image_width
        end_rect_h = action_region['endRect']['h']
        h_ratio = end_rect_h * 1.0 / image_height

        sample_action['endRectx'] = int(x_ratio * screen_width)
        sample_action['endRecty'] = int(y_ratio * screen_height)
        sample_action['endRectWidth'] = int(w_ratio * screen_width)
        sample_action['endRectHeight'] = int(h_ratio * screen_height)

    @staticmethod
    def _change_common_action(action_region, sample_action,
                              image_width, image_height, screen_width, screen_height):
        region = action_region['region']
        region_x = region['x']
        region_y = region['y']
        region_w = region['w']
        region_h = region['h']
        ratio_x = region_x * 1.0 / image_width
        ratio_y = region_y * 1.0 / image_height
        ratio_w = region_w * 1.0 / image_width
        ratio_h = region_h * 1.0 / image_height

        sample_action['startRectx'] = int(ratio_x * screen_width)
        sample_action['startRecty'] = int(ratio_y * screen_height)
        sample_action['width'] = int(ratio_w * screen_width)
        sample_action['height'] = int(ratio_h * screen_height)

    @staticmethod
    def _change_key_action(action_region, sample_action,
                           image_width, image_height, screen_width, screen_height):
        TrainData._change_common_action(action_region, sample_action, image_width, image_height,
                                        screen_width, screen_height)
        sample_action['alphabet'] = action_region.get('alphabet', '')
        sample_action['actionType'] = action_region.get('actionType', '')

    def save_sample_action(self):
        """ 保存样本动作的配置参数

        :return:
        """
        if not os.path.exists(ACTION_SAMPLE_CFG_PATH):
            raise Exception('please set record configurations first')

        frame_width = 640
        frame_height = 360
        with open(ACTION_SAMPLE_CFG_PATH) as f:
            action_sample_param = json.load(f, object_pairs_hook=OrderedDict)
            if 'FrameHeight' not in action_sample_param:
                raise Exception('FrameHeight is not config')
            frame_height = action_sample_param['FrameHeight']
            frame_width = action_sample_param['FrameWidth']

        out_config = OrderedDict()
        out_config['actions'] = []

        # 从配置文件中读取game action
        ai_mgr = AIManager()
        game_action = ai_mgr.get_game_action(ai_mgr.get_ai_type())

        actions = game_action.get_all()
        action_portrait_count = 0
        action_count = len(actions)
        for action in actions:
            action_id, _ = action
            in_param = game_action.get(action_id)
            action_region = in_param.get('actionRegion')

            width, height = 0, 0
            if action_region:
                # 判断参考文件是否存在
                image_path = action_region.get('path')
                project_path = ProjectDataManager().get_project_path()
                image_path = os.path.join(project_path, image_path)
                if not os.path.exists(image_path):
                    logger.error("file %s not exist", image_path)
                    continue

                image = cv2.imread(image_path)
                if image is None:
                    logger.error("read image %s failed", image_path)
                    continue

                width = image.shape[1]
                height = image.shape[0]

            sample_action = OrderedDict()
            sample_action['id'] = in_param['id']
            sample_action['name'] = in_param['name']
            action_type = in_param['type']
            if action_type == 'none':
                sample_action['type'] = 0
                action_count = action_count - 1
            else:
                sample_action['type'] = AI_ACTION_TYPES.index(action_type) + 1
                if width == 0:
                    raise Exception('path of game action configurations is not config!')

                if width > height:  # 横屏
                    action_portrait_count = action_portrait_count + 0
                    screen_width = max(frame_height, frame_width)
                    screen_height = min(frame_height, frame_width)
                else:
                    action_portrait_count = action_portrait_count + 1
                    screen_width = min(frame_height, frame_width)
                    screen_height = max(frame_height, frame_width)

                # 其他动作需处理
                if action_type == 'joystick':
                    self._change_joystick_action(action_region, sample_action, width, height,
                                                 screen_width, screen_height)

                elif action_type in ['down', 'up', 'click']:
                    self._change_common_action(action_region, sample_action, width, height, screen_width, screen_height)

                elif action_type == 'swipe':
                    self._change_swipe_action(action_region, sample_action, width, height, screen_width, screen_height)

                elif action_type == 'key':
                    self._change_key_action(action_region, sample_action, width, height, screen_width, screen_height)

            out_config['actions'].append(sample_action)

        if action_portrait_count == 0 or action_portrait_count == action_count:
            # 如果都是横屏，或者竖屏个数与动作个数（去掉none动作）一致
            long_edge = max(frame_height, frame_width)
            short_edge = min(frame_height, frame_width)
            if action_portrait_count == 0:
                out_config['screenWidth'] = long_edge
                out_config['screenHeight'] = short_edge
            else:
                out_config['screenWidth'] = short_edge
                out_config['screenHeight'] = long_edge
        else:
            show_warning_tips('所有动作的横竖屏不一致')

        with open(ACTION_SAMPLE_GAME_ACTION_CFG_PATH, "w") as f:
            json.dump(out_config, f, indent=4, separators=(',', ':'))

    @staticmethod
    def get_network_parameter():
        ai_mgr = AIManager()
        imitation = ai_mgr.get_ai_parameter(ai_mgr.get_ai_type())
        im_configure = imitation.get_config()
        if im_configure is not None:
            return im_configure.get('network')
        return None
