# -*- coding: utf-8 -*-
"""
ROSBOT UI structure: hardcoded from docs/rosbot_ui_structure.json.
All selectors for find_control_in_window / operate_by_spec. No file load at runtime.

From rosbot_ui_structure.json: only the following ids have non-empty automation_id (match by ID only):
  1→btnGambling 2→lnkVersion 3→grpSequence 4→label5 5→btnConfigSequence 6→cmbSequence
  9→profileTab 10→masterProfilePage 11→grpMasterProfile 12→linkExport 14→linkImport
  16→copyProfile 18→deleteProfile 20→cmbMasterProfile 23→CreateProfile 25→label2 26→EditProfile
  30→btnGlobalSettings 31→btnStart 32→menuStrip1 41→MenuBar
All other ids have automation_id ""; use name_candidates for those.
"""
from typing import Dict, Any, List

# ---- Root (id 0) ----
# WindowControl automation_id present but root; not used for lookup

# ---- Level 1, JSON has automation_id ----
# id 1
BTN_GAMBLING: Dict[str, Any] = {"type": "ButtonControl", "automation_id": "btnGambling"}

# id 2
TEXT_VERSION: Dict[str, Any] = {"type": "TextControl", "automation_id": "lnkVersion"}
# id 3
GRP_SEQUENCE: Dict[str, Any] = {"type": "GroupControl", "automation_id": "grpSequence"}
# id 9
TAB_PROFILE: Dict[str, Any] = {"type": "TabControl", "automation_id": "profileTab"}
# id 10
PANE_MAIN_PROFILE: Dict[str, Any] = {"type": "PaneControl", "automation_id": "masterProfilePage"}
# id 30
BTN_GLOBAL_SETTINGS: Dict[str, Any] = {"type": "ButtonControl", "automation_id": "btnGlobalSettings"}
# id 31
BTN_START: Dict[str, Any] = {"type": "ButtonControl", "automation_id": "btnStart"}
# id 32
MENUBAR_MAIN: Dict[str, Any] = {"type": "MenuBarControl", "automation_id": "menuStrip1"}

# id 40 JSON automation_id="", type only
TITLEBAR: Dict[str, Any] = {"type": "TitleBarControl"}

# ---- Level 2 (under 3), JSON has automation_id ----
# id 4
TEXT_LABEL5: Dict[str, Any] = {"type": "TextControl", "automation_id": "label5"}
# id 5
BTN_CONFIG_SEQUENCE: Dict[str, Any] = {"type": "ButtonControl", "automation_id": "btnConfigSequence"}
# id 6 mode dropdown
CMB_SEQUENCE: Dict[str, Any] = {"type": "ComboBoxControl", "automation_id": "cmbSequence"}

# List item when dropdown expanded: rift mode (no automation_id; match by name, localized)
LIST_ITEM_RIFT_MODE: Dict[str, Any] = {"type": "ListItemControl", "name_contains": ["大小秘境", "秘境", "Rift"]}

# id 28 29 JSON automation_id=""
TAB_ITEM_LOCAL: Dict[str, Any] = {"type": "TabItemControl", "name_candidates": ["本地档案", "本地檔案", "Local", "Local Profile"]}
TAB_ITEM_MAIN: Dict[str, Any] = {"type": "TabItemControl", "name_candidates": ["主档案", "主檔案", "Main Profile"]}

# ---- Level 2 (under 32)，id 33 38 JSON automation_id="" ----
MENU_TOOLS: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["Tools", "工具"]}
MENU_EXTENSION: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["扩展功能", "Extension"]}

# ---- Level 2 (under 40), id 41 JSON has MenuBar ----
MENUBAR_SYSTEM: Dict[str, Any] = {"type": "MenuBarControl", "automation_id": "MenuBar"}
# id 43 44 45 JSON automation_id=""
BTN_MINIMIZE: Dict[str, Any] = {"type": "ButtonControl", "name_candidates": ["Minimize", "最小化"]}
BTN_MAXIMIZE: Dict[str, Any] = {"type": "ButtonControl", "name_candidates": ["Maximize", "最大化"]}
BTN_CLOSE: Dict[str, Any] = {"type": "ButtonControl", "name_candidates": ["Close", "关闭"]}

# ---- Level 3 (under 33)，id 34 35 36 37 JSON automation_id="" ----
MENU_CLEAR_CACHE: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["Clear Cache", "清除缓存"]}
MENU_EXTRACT_SCENES: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["Extract scenes", "提取场景"]}
MENU_DEBUG: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["Debug", "调试"]}
MENU_SKILL_DEV: Dict[str, Any] = {"type": "MenuItemControl", "name_candidates": ["Skill Dev", "技能开发"]}

# ---- Level 3 (under 10), id 11 JSON has grpMasterProfile ----
GRP_MASTER_PROFILE: Dict[str, Any] = {"type": "GroupControl", "automation_id": "grpMasterProfile"}

# ---- Level 4 (under 11), JSON has automation_id ----
# id 12 14 16 18 20 23 25 26
LINK_EXPORT: Dict[str, Any] = {"type": "PaneControl", "automation_id": "linkExport"}
LINK_IMPORT: Dict[str, Any] = {"type": "PaneControl", "automation_id": "linkImport"}
TEXT_COPY_PROFILE: Dict[str, Any] = {"type": "TextControl", "automation_id": "copyProfile"}
TEXT_DELETE_PROFILE: Dict[str, Any] = {"type": "TextControl", "automation_id": "deleteProfile"}
CMB_MASTER_PROFILE: Dict[str, Any] = {"type": "ComboBoxControl", "automation_id": "cmbMasterProfile"}
TEXT_CREATE_PROFILE: Dict[str, Any] = {"type": "TextControl", "automation_id": "CreateProfile"}
TEXT_LABEL2: Dict[str, Any] = {"type": "TextControl", "automation_id": "label2"}
TEXT_EDIT_PROFILE: Dict[str, Any] = {"type": "TextControl", "automation_id": "EditProfile"}

# ---- Hyperlinks id 13 15 17 19 24 27 JSON automation_id="" ----
LINK_EXPORT_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["导出主档案", "Export Master Profile"]}
LINK_IMPORT_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["导入主档案", "Import Master Profile"]}
LINK_COPY_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["复制", "Copy"]}
LINK_DELETE_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["删除", "Delete"]}
LINK_CREATE_PROFILE_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["新建主档案", "Create Master Profile"]}
LINK_EDIT_HYPERLINK: Dict[str, Any] = {"type": "HyperlinkControl", "name_candidates": ["编辑", "Edit"]}

# ---- Default resume sequence (built-in, no file) ----
def get_resume_sequence() -> List[Dict[str, Any]]:
    """Built-in sequence: select main profile tab, invoke start button."""
    return [
        {"action": "select", "target": TAB_ITEM_MAIN},
        {"action": "invoke", "target": BTN_START},
    ]


# ---- All elements list for iteration ----
ALL_SELECTORS: List[tuple] = [
    ("BTN_GAMBLING", BTN_GAMBLING),
    ("TEXT_VERSION", TEXT_VERSION),
    ("GRP_SEQUENCE", GRP_SEQUENCE),
    ("TAB_PROFILE", TAB_PROFILE),
    ("PANE_MAIN_PROFILE", PANE_MAIN_PROFILE),
    ("BTN_GLOBAL_SETTINGS", BTN_GLOBAL_SETTINGS),
    ("BTN_START", BTN_START),
    ("MENUBAR_MAIN", MENUBAR_MAIN),
    ("TITLEBAR", TITLEBAR),
    ("TEXT_LABEL5", TEXT_LABEL5),
    ("BTN_CONFIG_SEQUENCE", BTN_CONFIG_SEQUENCE),
    ("CMB_SEQUENCE", CMB_SEQUENCE),
    ("LIST_ITEM_RIFT_MODE", LIST_ITEM_RIFT_MODE),
    ("TAB_ITEM_LOCAL", TAB_ITEM_LOCAL),
    ("TAB_ITEM_MAIN", TAB_ITEM_MAIN),
    ("MENU_TOOLS", MENU_TOOLS),
    ("MENU_EXTENSION", MENU_EXTENSION),
    ("MENUBAR_SYSTEM", MENUBAR_SYSTEM),
    ("BTN_MINIMIZE", BTN_MINIMIZE),
    ("BTN_MAXIMIZE", BTN_MAXIMIZE),
    ("BTN_CLOSE", BTN_CLOSE),
    ("MENU_CLEAR_CACHE", MENU_CLEAR_CACHE),
    ("MENU_EXTRACT_SCENES", MENU_EXTRACT_SCENES),
    ("MENU_DEBUG", MENU_DEBUG),
    ("MENU_SKILL_DEV", MENU_SKILL_DEV),
    ("GRP_MASTER_PROFILE", GRP_MASTER_PROFILE),
    ("LINK_EXPORT", LINK_EXPORT),
    ("LINK_IMPORT", LINK_IMPORT),
    ("TEXT_COPY_PROFILE", TEXT_COPY_PROFILE),
    ("TEXT_DELETE_PROFILE", TEXT_DELETE_PROFILE),
    ("CMB_MASTER_PROFILE", CMB_MASTER_PROFILE),
    ("TEXT_CREATE_PROFILE", TEXT_CREATE_PROFILE),
    ("TEXT_LABEL2", TEXT_LABEL2),
    ("TEXT_EDIT_PROFILE", TEXT_EDIT_PROFILE),
    ("LINK_EXPORT_HYPERLINK", LINK_EXPORT_HYPERLINK),
    ("LINK_IMPORT_HYPERLINK", LINK_IMPORT_HYPERLINK),
    ("LINK_COPY_HYPERLINK", LINK_COPY_HYPERLINK),
    ("LINK_DELETE_HYPERLINK", LINK_DELETE_HYPERLINK),
    ("LINK_CREATE_PROFILE_HYPERLINK", LINK_CREATE_PROFILE_HYPERLINK),
    ("LINK_EDIT_HYPERLINK", LINK_EDIT_HYPERLINK),
]
