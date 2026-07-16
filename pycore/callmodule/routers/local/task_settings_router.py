# -*- coding: utf-8 -*-
"""
Task capability chains — per task-type fallback order (shared user_data).

GET  /api/local/task-settings/chains
POST /api/local/task-settings/chains  { task_type, priority: [...] }
"""

import fastapi
from pydantic import BaseModel
from typing import List, Optional

from pycore.callmodule.services.task_capability_chains import get_chains, save_chain

router = fastapi.APIRouter(prefix="/api/local/task-settings", tags=["Local Processing - Task Settings"])


class ChainPatch(BaseModel):
    task_type: str
    priority: List[str]


@router.get("/chains")
def chains():
    return {"success": True, "chains": get_chains()}


@router.post("/chains")
def update_chain(req: ChainPatch):
    result = save_chain(req.task_type, req.priority)
    if not result.get("ok"):
        return {"success": False, **result}
    return {"success": True, **result}
