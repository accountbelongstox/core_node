"""
AI Collaboration MCP Server Constants
Defines configuration for multi-AI collaboration service
"""

import platform
from pathlib import Path

class AICollaborationConstants:
    SERVICE_NAME = "ai_collaboration"
    SERVICE_VERSION = "1.0.0"
    SERVICE_DESCRIPTION = "Multi-AI Collaboration Service with role management and message queue"

    _CURRENT_DIR = Path(__file__).parent
    PROJECT_ROOT = _CURRENT_DIR.parent.parent.parent
    SERVICE_ROOT = _CURRENT_DIR

    TMP_DIR = SERVICE_ROOT / "tmp_sessions"
    LOG_FILE = TMP_DIR / "ai_collaboration.log"

    SYSTEM_NAME = platform.system()
    IS_WINDOWS = SYSTEM_NAME == 'Windows'
    IS_LINUX = SYSTEM_NAME == 'Linux'

    if IS_WINDOWS:
        USER_HOME = Path.home()
        DATA_ROOT = USER_HOME / ".core_node" / "mcp_server" / SERVICE_NAME
    else:
        DATA_ROOT = Path("/var/_core_node/mcp_server") / SERVICE_NAME

    # SQLite database for cross-client sharing
    DB_FILE = DATA_ROOT / "ai_collaboration.db"

    # Legacy file paths (kept for backward compatibility)
    ROLES_FILE = DATA_ROOT / "roles.json"
    MESSAGES_DIR = DATA_ROOT / "messages"
    QA_FILE = DATA_ROOT / "qa_history.json"
    LOCK_FILE = DATA_ROOT / "service.lock"

    MAX_QUEUE_LENGTH = 1000
    MAX_STORAGE_MB = 50
    MAX_MESSAGE_AGE_DAYS = 30

    REQUIRED_PACKAGES = ["mcp"]

    ENV_VARS = {
        "MCP_ALLOW_ALL_PATHS": "true"
    }

    PREDEFINED_ROLES = [
        "frontend_designer",
        "backend_developer",
        "database_architect",
        "devops_engineer",
        "qa_tester",
        "product_manager",
        "ui_ux_designer",
        "security_specialist",
        "technical_writer",
        "general_assistant"
    ]

    TOOL_CAPABILITIES = [
        "register_role",
        "get_role_list",
        "write_log",
        "read_logs",
        "ask_question",
        "answer_question",
        "get_pending_questions",
        "health_check",
        "restart_service",
        "get_storage_stats",
        "get_log_summary",
        "get_qa_statistics",
        "get_question_history",
        "search_logs"
    ]

    AUTO_APPROVE_TOOLS = [
        "register_role",
        "get_role_list",
        "write_log",
        "read_logs",
        "ask_question",
        "answer_question",
        "get_pending_questions",
        "health_check",
        "restart_service",
        "get_storage_stats"
    ]

    @classmethod
    def ensure_directories(cls):
        """Ensure all required directories exist"""
        cls.TMP_DIR.mkdir(parents=True, exist_ok=True)
        cls.DATA_ROOT.mkdir(parents=True, exist_ok=True)
        cls.MESSAGES_DIR.mkdir(parents=True, exist_ok=True)
