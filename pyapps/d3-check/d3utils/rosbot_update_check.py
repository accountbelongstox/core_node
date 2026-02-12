# -*- coding: utf-8 -*-
"""
ROSBOT 更新检查：向后兼容的函数接口层。

本模块保留原有的函数接口以保持向后兼容性，内部实现委托给 RosbotUpdateManager 类库。
新代码应直接使用 d3utils.rosbot_update_manager.get_rosbot_update_manager()。
"""
from typing import List, Optional, Tuple, Any

from d3utils.rosbot_update_manager import get_rosbot_update_manager, ROSBOT_FINAL_DIR_NAME

# 向后兼容：保留常量导出（从 rosbot_update_manager 重新导出）
__all__ = [
    "get_battlenet_region",
    "get_downloads_dir",
    "get_current_ros_dir_ctime_version",
    "find_rosbot_zips_in_downloads",
    "get_best_newer_zip",
    "apply_rosbot_update",
    "run_rosbot_update_check",
    "ask_yes_no_on_main_thread",
    "ROSBOT_FINAL_DIR_NAME",
]

# 获取更新管理器实例（单例）
_update_manager = None


def _get_update_manager():
    """获取更新管理器实例（延迟加载）"""
    global _update_manager
    if _update_manager is None:
        _update_manager = get_rosbot_update_manager()
    return _update_manager


def get_battlenet_region() -> Optional[str]:
    """战网已探测区域：asia | cn | None。未探测到则 None，此时不执行更新检查。"""
    return _get_update_manager().get_battlenet_region()


def get_downloads_dir() -> str:
    """下载目录：配置或 ~/Downloads。"""
    return _get_update_manager().get_downloads_dir()


def get_current_ros_dir_ctime_version() -> Tuple[Optional[str], float, Optional[Tuple[int, int]]]:
    """当前 ROS 目录、目录创建时间、路径中的版本号(若有)。"""
    return _get_update_manager().get_current_ros_dir_info()


def find_rosbot_zips_in_downloads(region: str) -> List[Tuple[str, int, Optional[Tuple[int, int]]]]:
    """Downloads 下 20–50MB、匹配区服(亚服/国服)的 zip。返回 [(path, size, version), ...] 按版本降序。"""
    return _get_update_manager().find_rosbot_zips_in_downloads(region)


def get_best_newer_zip(region: str) -> Tuple[Optional[str], bool, Optional[str]]:
    """
    根据已探测区服找比当前更新的最佳 zip。返回 (zip_path or None, is_newer, version_str 如 '36.0129')。
    未探测到区服或当前无更新则 is_newer=False。
    """
    return _get_update_manager().get_best_newer_zip(region)


def apply_rosbot_update(zip_path: str, region: str, version_str: Optional[str] = None) -> bool:
    """
    1) 在 GameTools 下创建目录：英文区服_版本号（Asia_36.0129 或 CN_36.0129）
    2) 解压 zip 到该目录
    3) 递归查找 RoS-BoT.exe，将 exe 所在目录重命名并移动到 GameTools\\{区服}_版本号\\RosBot\\
    4) 复制旧 RoS-BoT.ini（若有），更新 CONFIG ros_directory
    """
    return _get_update_manager().apply_update(zip_path, region, version_str)


def run_rosbot_update_check() -> Tuple[Optional[str], bool, Optional[str], Optional[str]]:
    """
    执行更新检查。仅当战网已探测为亚服/国服时检查；否则跳过。
    返回 (best_zip_path or None, is_newer, version_str or None, region or None)。
    """
    return _get_update_manager().check_update()


def ask_yes_no_on_main_thread(panel: Any, title: str, message: str) -> bool:
    """在主线程弹出 Yes/No 对话框，阻塞当前线程直到用户选择。返回 True=Yes。"""
    return _get_update_manager().ask_yes_no_on_main_thread(panel, title, message)
