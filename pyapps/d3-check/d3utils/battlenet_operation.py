# -*- coding: utf-8 -*-
"""
Battle.net operation: public factory and re-exports.
Singleton per (path, region) via get_battlenet_operation(); returns BattlenetOperationAsia or BattlenetOperationCN.
Use get_battlenet_operation() / get_battlenet_asia_ops(); do not instantiate classes directly.
"""
from pathlib import Path
from typing import Optional, Dict, Tuple, Union

from share.game_interface_data import get_game_interface_data
from providor.providor_index import get_config_value_safe

from d3utils.battlenet_operation_base import BattlenetOperationBase
from d3utils.battlenet_operation_asia import BattlenetOperationAsia
from d3utils.battlenet_operation_cn import BattlenetOperationCN
from d3utils.battlenet_asia_ops import BattlenetAsiaOps

# Public type: either region-specific class
BattlenetOperation = Union[BattlenetOperationAsia, BattlenetOperationCN]

_battlenet_operation_cache: Dict[Tuple[Optional[Path], Optional[str]], BattlenetOperation] = {}
_battlenet_asia_ops_cache: Dict[Tuple[Optional[Path], Optional[str]], BattlenetAsiaOps] = {}


def _resolve_battlenet_region() -> Optional[str]:
    """Resolve current Battle.net region: game_interface_data first, then config cache."""
    try:
        r = get_game_interface_data().get_battlenet_region()
        if r is not None:
            return r
        cached = get_config_value_safe("ros_settings.battlenet_region_cache")
        return cached if cached in ("asia", "cn") else None
    except Exception:
        return None


def get_battlenet_operation(
    elements_json_path: Optional[Path] = None,
    region: Optional[str] = None,
) -> BattlenetOperation:
    """Return Battle.net operation for the given region (Asia or CN). Singleton per (path, region)."""
    resolved = region if region in ("asia", "cn") else _resolve_battlenet_region()
    key = (elements_json_path, resolved)
    if key not in _battlenet_operation_cache:
        if resolved == "cn":
            _battlenet_operation_cache[key] = BattlenetOperationCN(elements_json_path)
        else:
            _battlenet_operation_cache[key] = BattlenetOperationAsia(elements_json_path)
    return _battlenet_operation_cache[key]


def get_battlenet_asia_ops(
    elements_json_path: Optional[Path] = None,
    region: Optional[str] = None,
) -> BattlenetAsiaOps:
    """Return BattlenetAsiaOps for the same key as get_battlenet_operation (singleton per path+region)."""
    resolved = region if region in ("asia", "cn") else _resolve_battlenet_region()
    key = (elements_json_path, resolved)
    if key not in _battlenet_asia_ops_cache:
        op = get_battlenet_operation(elements_json_path, region)
        if isinstance(op, BattlenetOperationAsia):
            _battlenet_asia_ops_cache[key] = op._asia_ops
        else:
            _battlenet_asia_ops_cache[key] = BattlenetAsiaOps(op)
    return _battlenet_asia_ops_cache[key]
