#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Type Converter - 数据库类型转换中间层

设计原则：
1. 数据库中禁止直接存储 datetime/date/time 类型
2. 统一使用字符串（ISO格式）或数字（timestamp）存储
3. 在写入数据库前：Python对象 → 数据库兼容类型
4. 从数据库读取后：数据库类型 → Python对象

这样可以避免JSON序列化问题，保持数据层的纯净性。
"""

from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Union, Optional
from pathlib import Path


class DatabaseTypeConverter:
    """
    数据库类型转换器

    负责在数据库操作前后进行类型转换，确保：
    1. 写入数据库的数据都是基本类型（str, int, float, bool, None）
    2. 从数据库读取的数据转换为合适的Python类型
    """

    # 配置：datetime类型的存储格式
    # 'iso' - ISO 8601字符串 (推荐)
    # 'timestamp' - Unix时间戳（秒）
    DATETIME_STORAGE_FORMAT = 'iso'

    # 配置：date类型的存储格式
    # 'iso' - ISO 8601字符串 (推荐)
    # 'integer' - YYYYMMDD整数格式
    DATE_STORAGE_FORMAT = 'iso'

    # 配置：time类型的存储格式
    # 'iso' - ISO 8601字符串 (推荐)
    # 'seconds' - 当天的秒数
    TIME_STORAGE_FORMAT = 'iso'

    @classmethod
    def prepare_value_for_db(cls, value: Any) -> Any:
        """
        准备数据写入数据库（Python类型 → 数据库类型）

        转换规则：
        - datetime → ISO字符串或timestamp
        - date → ISO字符串或YYYYMMDD整数
        - time → ISO字符串或秒数
        - timedelta → 总秒数
        - Decimal → float
        - Path → 字符串
        - bytes → base64字符串
        - None, str, int, float, bool → 保持不变

        Args:
            value: 要写入数据库的值

        Returns:
            数据库兼容的值（基本类型）
        """
        if value is None:
            return None

        # datetime类型 → 字符串或timestamp
        if isinstance(value, datetime):
            if cls.DATETIME_STORAGE_FORMAT == 'iso':
                return value.isoformat()
            elif cls.DATETIME_STORAGE_FORMAT == 'timestamp':
                return value.timestamp()
            else:
                return value.isoformat()

        # date类型 → 字符串或整数
        elif isinstance(value, date):
            if cls.DATE_STORAGE_FORMAT == 'iso':
                return value.isoformat()
            elif cls.DATE_STORAGE_FORMAT == 'integer':
                return int(value.strftime('%Y%m%d'))
            else:
                return value.isoformat()

        # time类型 → 字符串或秒数
        elif isinstance(value, time):
            if cls.TIME_STORAGE_FORMAT == 'iso':
                return value.isoformat()
            elif cls.TIME_STORAGE_FORMAT == 'seconds':
                return value.hour * 3600 + value.minute * 60 + value.second
            else:
                return value.isoformat()

        # timedelta → 总秒数
        elif isinstance(value, timedelta):
            return value.total_seconds()

        # Decimal → float
        elif isinstance(value, Decimal):
            return float(value)

        # Path → 字符串
        elif isinstance(value, Path):
            return str(value)

        # bytes → base64字符串
        elif isinstance(value, bytes):
            import base64
            return base64.b64encode(value).decode('utf-8')

        # set/frozenset → list
        elif isinstance(value, (set, frozenset)):
            return list(value)

        # 基本类型保持不变
        elif isinstance(value, (str, int, float, bool)):
            return value

        # 其他类型转为字符串
        else:
            return str(value)

    @classmethod
    def prepare_data_for_db(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        准备整个数据字典写入数据库

        Args:
            data: 要写入的数据字典

        Returns:
            转换后的数据字典（所有值都是数据库兼容类型）
        """
        if not data:
            return data

        converted = {}
        for key, value in data.items():
            converted[key] = cls.prepare_value_for_db(value)

        return converted

    @classmethod
    def restore_value_from_db(cls, value: Any, value_type: Optional[str] = None) -> Any:
        """
        从数据库恢复值到Python类型（数据库类型 → Python类型）

        Args:
            value: 从数据库读取的值
            value_type: 值的类型提示（'datetime', 'date', 'time', 'timedelta'等）

        Returns:
            Python类型的值
        """
        if value is None:
            return None

        # 根据类型提示进行转换
        if value_type == 'datetime':
            if isinstance(value, str):
                return datetime.fromisoformat(value)
            elif isinstance(value, (int, float)):
                return datetime.fromtimestamp(value)
            else:
                return value

        elif value_type == 'date':
            if isinstance(value, str):
                return date.fromisoformat(value)
            elif isinstance(value, int):
                # YYYYMMDD格式
                date_str = str(value)
                year = int(date_str[:4])
                month = int(date_str[4:6])
                day = int(date_str[6:8])
                return date(year, month, day)
            else:
                return value

        elif value_type == 'time':
            if isinstance(value, str):
                return time.fromisoformat(value)
            elif isinstance(value, (int, float)):
                # 秒数转time
                hours = int(value // 3600)
                minutes = int((value % 3600) // 60)
                seconds = int(value % 60)
                return time(hours, minutes, seconds)
            else:
                return value

        elif value_type == 'timedelta':
            if isinstance(value, (int, float)):
                return timedelta(seconds=value)
            else:
                return value

        # 没有类型提示，返回原值
        else:
            return value

    @classmethod
    def restore_row_from_db(cls, row: Dict[str, Any], type_hints: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        从数据库恢复整行数据

        Args:
            row: 从数据库读取的行数据
            type_hints: 字段类型提示字典 {'field_name': 'type'}

        Returns:
            转换后的行数据
        """
        if not row:
            return row

        if not type_hints:
            return row

        restored = {}
        for key, value in row.items():
            value_type = type_hints.get(key)
            restored[key] = cls.restore_value_from_db(value, value_type)

        return restored


# 快捷函数

def to_db(value: Any) -> Any:
    """转换单个值为数据库兼容类型"""
    return DatabaseTypeConverter.prepare_value_for_db(value)


def to_db_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """转换数据字典为数据库兼容类型"""
    return DatabaseTypeConverter.prepare_data_for_db(data)


def from_db(value: Any, value_type: Optional[str] = None) -> Any:
    """从数据库恢复单个值"""
    return DatabaseTypeConverter.restore_value_from_db(value, value_type)


def from_db_dict(row: Dict[str, Any], type_hints: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """从数据库恢复整行数据"""
    return DatabaseTypeConverter.restore_row_from_db(row, type_hints)


__all__ = [
    'DatabaseTypeConverter',
    'to_db',
    'to_db_dict',
    'from_db',
    'from_db_dict',
]
