# -*- coding: utf-8 -*-
"""
Action groups: extensible one-step-per-tick sequences (e.g. map teleport).
See docs/ACTION_GROUPS_DESIGN.md. Directory: one file can define one or more groups.
During an action group, tick runs only one step of the group then skips other events.
"""
from typing import Callable, Dict, List, Optional

# Step result: "ok" = advance to next step next tick; "done" = group finished success; "fail" = abort
ActionStepResult = str
ACTION_OK = "ok"
ACTION_DONE = "done"
ACTION_FAIL = "fail"

# Step: callable(ctx) -> ActionStepResult. ctx is payload/context dict for the group.
ActionStep = Callable[[Dict], ActionStepResult]


class ActionGroupDef:
    """One action group: id and ordered list of steps. Each tick runs one step."""
    __slots__ = ("id", "steps")

    def __init__(self, id: str, steps: List[ActionStep]):
        self.id = id
        self.steps = steps

    def run_step(self, step_index: int, context: Dict) -> ActionStepResult:
        if step_index < 0 or step_index >= len(self.steps):
            return ACTION_FAIL
        return self.steps[step_index](context)


_REGISTRY: Dict[str, ActionGroupDef] = {}


def register(group: ActionGroupDef) -> None:
    _REGISTRY[group.id] = group


def get(group_id: str) -> Optional[ActionGroupDef]:
    return _REGISTRY.get(group_id)


def get_registry() -> Dict[str, ActionGroupDef]:
    return _REGISTRY.copy()


# Import modules that register groups (so they are loaded)
from d3utils.rosbot_flow.action_groups import map_teleport  # noqa: E402, F401
