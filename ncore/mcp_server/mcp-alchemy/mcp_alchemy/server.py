import os, json, hashlib, logging, uuid
from datetime import datetime, date
from pathlib import Path
from urllib.parse import urlparse
from contextlib import contextmanager
from filelock import FileLock

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.utilities.logging import get_logger

from sqlalchemy import create_engine, inspect, text, MetaData, Table, Column, Integer, String, DateTime, Boolean
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from sqlalchemy.sql import select, insert, update, delete
from sqlalchemy.schema import CreateTable, DropTable, CreateIndex, DropIndex

### Helpers ###

def tests_set_global(k, v):
    globals()[k] = v

### Service Infrastructure ###

VERSION = "2.0.0"  # MCP Alchemy version

logger = get_logger(__name__)

# Service paths - automatically derived from file location
SERVICE_ROOT = Path(__file__).parent.parent.resolve()  # Auto-derived, not from environment
PROJECT_ROOT = SERVICE_ROOT.parent.parent.parent  # Derived, not from environment
DATA_DIR = SERVICE_ROOT / 'data'
LOG_DIR = SERVICE_ROOT / 'logs'
SESSIONS_DIR = SERVICE_ROOT / 'tmp_sessions'
LOCK_FILE = SERVICE_ROOT / 'tmp_.service.lock'

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)
SESSIONS_DIR.mkdir(exist_ok=True)

class SessionManager:
    """Multi-AI session management with identity negotiation"""

    KNOWN_AI_CLIENTS = {
        'cursor': 'mcp-alchemy-codemaster - Advanced IDE Assistant',
        'augment': 'mcp-alchemy-devexpert - Code Enhancement Specialist',
        'claude': 'mcp-alchemy-assistant - General Purpose Helper',
        'gemini': 'mcp-alchemy-codegenius - Smart Development Partner',
        'vscode': 'mcp-alchemy-devhelper - Visual Studio Code Assistant',
        'copilot': 'mcp-alchemy-copilot - GitHub Code Assistant',
        'codeium': 'mcp-alchemy-codewizard - Intelligent Code Completion',
        'tabnine': 'mcp-alchemy-tabmaster - Predictive Code Assistant',
        'intellij': 'mcp-alchemy-intellibot - JetBrains IDE Helper',
        'pycharm': 'mcp-alchemy-pymaster - Python Development Expert',
        'webstorm': 'mcp-alchemy-webdev - JavaScript Development Assistant',
        'programming_master': 'mcp-alchemy-programmingmaster - Expert Code Assistant & Project Maintainer',
        'code_architect': 'mcp-alchemy-codearchitect - System Design & Architecture Expert',
        'debug_specialist': 'mcp-alchemy-debugmaster - Error Detection & Resolution Expert',
        'database_expert': 'AI DatabasePro - Data Management & Query Optimization Expert',
        'api_designer': 'mcp-alchemy-apidesigner - RESTful Service & Integration Specialist',
        'security_analyst': 'mcp-alchemy-secguard - Security Analysis & Vulnerability Assessment Expert',
        'performance_optimizer': 'mcp-alchemy-speedboost - Performance Analysis & Optimization Expert',
        'test_engineer': 'mcp-alchemy-testmaster - Quality Assurance & Testing Automation Expert',
        'devops_specialist': 'mcp-alchemy-devopsguru - CI/CD & Infrastructure Management Expert',
        'frontend_expert': 'mcp-alchemy-uiexpert - Frontend Development & User Experience Specialist'
    }

    def __init__(self):
        self.sessions_file = SESSIONS_DIR / 'active_sessions.json'
        self.sessions = self.load_sessions()

    def load_sessions(self):
        """Load active sessions from file"""
        try:
            if self.sessions_file.exists():
                with open(self.sessions_file, 'r') as f:
                    return json.load(f)
            return {}
        except Exception:
            return {}

    def save_sessions(self):
        """Save active sessions to file"""
        try:
            with open(self.sessions_file, 'w') as f:
                json.dump(self.sessions, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions: {e}")

    def negotiate_identity(self):
        """Negotiate AI client identity"""
        detected_client = None

        # Check common environment variables
        env_indicators = {
            'CURSOR_SESSION': 'cursor',
            'AUGMENT_SESSION': 'augment',
            'CLAUDE_DESKTOP': 'claude',
            'VSCODE_PID': 'vscode',
            'JETBRAINS_IDE': 'intellij',
            'AI_PROGRAMMING_MASTER': 'programming_master',
            'AI_CODE_ARCHITECT': 'code_architect',
            'AI_DEBUG_SPECIALIST': 'debug_specialist',
            'AI_DATABASE_GURU': 'database_guru',
            'AI_API_DESIGNER': 'api_designer',
            'AI_SECURITY_ANALYST': 'security_analyst',
            'AI_PERFORMANCE_OPTIMIZER': 'performance_optimizer',
            'AI_TEST_ENGINEER': 'test_engineer',
            'AI_DEVOPS_SPECIALIST': 'devops_specialist',
            'AI_FRONTEND_EXPERT': 'frontend_expert'
        }

        for env_var, client_id in env_indicators.items():
            if os.environ.get(env_var):
                detected_client = client_id
                break

        # Check process name or command line
        if not detected_client:
            try:
                import psutil
                parent = psutil.Process().parent()
                if parent:
                    parent_name = parent.name().lower()
                    for client_id in self.KNOWN_AI_CLIENTS:
                        if client_id in parent_name:
                            detected_client = client_id
                            break
            except:
                pass

        # Default to alchemy master if no specific client detected
        if not detected_client:
            detected_client = 'alchemy_master'

        return detected_client

    def create_session(self, client_id=None):
        """Create a new session for an AI client with auto-generated namespace"""
        if not client_id:
            client_id = self.negotiate_identity()

        session_id = str(uuid.uuid4())[:8]
        session_key = f"{client_id}_{session_id}"
        namespace = f"{client_id}_{session_id}"

        return self._create_session_internal(session_key, client_id, namespace)

    def create_custom_session(self, custom_namespace):
        """Create a session with custom namespace"""
        client_id = self.negotiate_identity()

        # Check if custom namespace already exists
        for existing_key, existing_info in self.sessions.items():
            if existing_info.get('namespace') == custom_namespace:
                raise ValueError(f"Namespace '{custom_namespace}' already exists in session {existing_key}")

        session_key = f"{client_id}_{custom_namespace}"
        return self._create_session_internal(session_key, client_id, custom_namespace)

    def create_project_session(self, project_name):
        """Create a session with project-based namespace"""
        client_id = self.negotiate_identity()

        # Sanitize project name
        safe_project = project_name.replace(" ", "_").replace("-", "_").lower()
        safe_project = ''.join(c for c in safe_project if c.isalnum() or c == '_')

        # Create namespace with project prefix
        namespace = f"project_{safe_project}_{client_id}"
        session_key = f"{client_id}_{safe_project}_{str(uuid.uuid4())[:6]}"

        return self._create_session_internal(session_key, client_id, namespace, project_name)

    def _create_session_internal(self, session_key, client_id, namespace, project_name=None):
        """Internal method to create session with specified parameters"""
        # Create session workspace
        session_workspace = SESSIONS_DIR / session_key
        session_workspace.mkdir(exist_ok=True)

        session_info = {
            'session_id': session_key.split('_')[-1],
            'session_key': session_key,
            'client_id': client_id,
            'namespace': namespace,
            'client_name': self.KNOWN_AI_CLIENTS.get(client_id, f'Unknown Client ({client_id})'),
            'workspace': str(session_workspace),
            'created_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat(),
            'databases': {},
            'project_name': project_name
        }

        self.sessions[session_key] = session_info
        self.save_sessions()

        logger.info(f"[SESSION] Created session for {session_info['client_name'].split(' - ')[0]} ({client_id})")
        logger.info(f"   Namespace: {namespace}")
        logger.info(f"   Session Key: {session_key}")
        if project_name:
            logger.info(f"   Project: {project_name}")

        return session_key, session_info

    def get_session(self, session_key):
        """Get session information"""
        return self.sessions.get(session_key)

    def update_session_activity(self, session_key):
        """Update session last activity time"""
        if session_key in self.sessions:
            self.sessions[session_key]['last_active'] = datetime.now().isoformat()
            self.save_sessions()

    def cleanup_old_sessions(self, max_age_hours=24):
        """Clean up old inactive sessions"""
        current_time = datetime.now()
        to_remove = []

        for session_key, session_info in self.sessions.items():
            try:
                last_active = datetime.fromisoformat(session_info['last_active'])
                age_hours = (current_time - last_active).total_seconds() / 3600

                if age_hours > max_age_hours:
                    to_remove.append(session_key)
                    # Clean up session workspace
                    workspace = Path(session_info['workspace'])
                    if workspace.exists():
                        import shutil
                        shutil.rmtree(workspace, ignore_errors=True)
            except:
                to_remove.append(session_key)

        for session_key in to_remove:
            del self.sessions[session_key]
            logger.info(f"[CLEANUP] Cleaned up old session: {session_key}")

        if to_remove:
            self.save_sessions()

class SharedService:
    """Shared service pattern for multi-AI access"""

    def __init__(self):
        self.lock_file = LOCK_FILE
        self.status_file = SERVICE_ROOT / 'tmp_.service.status'
        self.lock = None
        self.is_primary = False
        self.session_manager = SessionManager()
        self.current_session = None

    def check_or_start_service(self):
        """Check if service is running, or mark this instance as primary"""
        try:
            # Try to acquire lock to become primary instance
            self.lock = FileLock(str(self.lock_file))
            self.lock.acquire(timeout=0.1)

            # If we get here, we're the primary instance
            self.is_primary = True

            # Clean up old sessions
            self.session_manager.cleanup_old_sessions()

            # Create session for this AI client
            session_key, session_info = self.session_manager.create_session()
            self.current_session = session_key

            # Write status information
            status_info = {
                'pid': os.getpid(),
                'started_at': datetime.now().isoformat(),
                'service_root': str(SERVICE_ROOT),
                'status': 'running',
                'primary_session': session_key,
                'active_sessions': len(self.session_manager.sessions)
            }

            with open(self.status_file, 'w') as f:
                json.dump(status_info, f, indent=2)

            logger.info(f"[PRIMARY] Started as PRIMARY instance (PID: {os.getpid()})")
            logger.info(f"   Session: {session_info['client_name']} ({session_key})")
            return True

        except Exception:
            # Another instance is primary, we'll be a client
            self.is_primary = False

            # Create session for this AI client (shared mode)
            session_key, session_info = self.session_manager.create_session()
            self.current_session = session_key

            # Check if primary is actually running
            if self.status_file.exists():
                try:
                    with open(self.status_file, 'r') as f:
                        status = json.load(f)
                    logger.info(f"[SHARED] Connected to EXISTING service (Primary PID: {status.get('pid', 'unknown')})")
                    logger.info(f"   Service started at: {status.get('started_at', 'unknown')}")
                    logger.info(f"   My session: {session_info['client_name']} ({session_key})")
                    return True
                except Exception:
                    pass

            logger.info(f"[SHARED] Connected to SHARED service instance")
            logger.info(f"   My session: {session_info['client_name']} ({session_key})")
            return True

    def release_lock(self):
        """Release the lock if we're the primary instance"""
        if self.is_primary and self.lock:
            try:
                self.lock.release()
                if self.lock_file.exists():
                    self.lock_file.unlink()
                if self.status_file.exists():
                    self.status_file.unlink()
                logger.info("[CLEANUP] Primary instance released service lock")
            except Exception:
                pass

# Global shared service instance - initialized at startup
shared_service = None

### Database ###

class DatabaseManager:
    """Dynamic database manager supporting multiple databases with session isolation"""

    def __init__(self):
        self.engines = {}  # Cache engines by database path
        self.session_databases = {}  # Track databases per session: {session_key: {db_alias: db_path}}
        self.current_session = None
        self.current_db_url = None

    def set_session(self, session_key):
        """Set current session for database operations"""
        self.current_session = session_key
        if session_key not in self.session_databases:
            self.session_databases[session_key] = {}

    def register_database(self, db_path_or_url, db_alias=None):
        """Register a database for the current session"""
        if not self.current_session:
            raise ValueError("No active session. Call set_session() first.")

        if not db_alias:
            # Generate alias from path
            if db_path_or_url.startswith(('sqlite://', 'postgresql://', 'mysql://')):
                db_alias = Path(db_path_or_url.split('///')[-1]).stem if '///' in db_path_or_url else 'main'
            else:
                db_alias = Path(db_path_or_url).stem

        self.session_databases[self.current_session][db_alias] = db_path_or_url
        logger.info(f"Registered database '{db_alias}' for session {self.current_session}")
        return db_alias

    def get_session_databases(self, session_key=None):
        """Get all databases for a session"""
        session_key = session_key or self.current_session
        return self.session_databases.get(session_key, {})

    def resolve_database_path(self, db_identifier):
        """Resolve database identifier to actual path"""
        if not self.current_session:
            # If no session, treat as direct path
            return db_identifier

        session_dbs = self.session_databases.get(self.current_session, {})

        # Check if it's an alias
        if db_identifier in session_dbs:
            return session_dbs[db_identifier]

        # Check if it's a direct path
        return db_identifier

    def create_engine_for_path(self, db_path_or_url):
        """Create engine for a specific database path or URL"""
        # Convert file path to SQLite URL if needed
        if not db_path_or_url.startswith(('sqlite://', 'postgresql://', 'mysql://', 'mssql://', 'oracle://')):
            # Treat as file path for SQLite
            db_path = Path(db_path_or_url).resolve()

            # Auto-create directory if needed
            db_path.parent.mkdir(parents=True, exist_ok=True)

            db_url = f'sqlite:///{db_path}'
            logger.info(f"Creating SQLite database: {db_path}")
        else:
            db_url = db_path_or_url

        # Check cache first
        if db_url in self.engines:
            return self.engines[db_url]

        # Get engine options
        db_engine_options = os.environ.get('DB_ENGINE_OPTIONS')
        user_options = json.loads(db_engine_options) if db_engine_options else {}

        # MCP-optimized defaults with improved connection pooling
        options = {
            'isolation_level': 'AUTOCOMMIT',
            'pool_pre_ping': True,
            'pool_size': 3,  # Increased for better concurrency
            'max_overflow': 5,  # Increased for burst capacity
            'pool_recycle': 3600,
            'pool_timeout': 30,  # Connection timeout
            'echo': False,  # Set to True for SQL debugging
            **user_options
        }

        engine = create_engine(db_url, **options)
        self.engines[db_url] = engine

        logger.info(f"Created engine for: {db_url}")
        return engine

    def get_connection(self, db_identifier=None, session_key=None):
        """Get connection to specified database with session isolation"""
        # Set session if provided
        if session_key:
            self.set_session(session_key)

        # Resolve database path
        if db_identifier:
            resolved_path = self.resolve_database_path(db_identifier)
            # Register database if it's a new path for this session
            if self.current_session and db_identifier not in self.get_session_databases():
                self.register_database(resolved_path, db_identifier)
            self.current_db_url = resolved_path
            engine = self.create_engine_for_path(resolved_path)
        elif self.current_db_url:
            engine = self.create_engine_for_path(self.current_db_url)
        else:
            # Default to session-specific database
            if self.current_session:
                session_dir = SERVICE_ROOT / 'tmp_sessions' / self.current_session
                session_dir.mkdir(parents=True, exist_ok=True)
                default_db = session_dir / 'default.db'
            else:
                default_db = SERVICE_ROOT / 'data' / 'default.db'
                default_db.parent.mkdir(parents=True, exist_ok=True)

            self.current_db_url = str(default_db)
            engine = self.create_engine_for_path(self.current_db_url)

        connection = engine.connect()

        # Set version and session variables for databases that support it
        try:
            connection.execute(text(f"SET @mcp_alchemy_version = '{VERSION}'"))
            if self.current_session:
                connection.execute(text(f"SET @mcp_session = '{self.current_session}'"))
        except Exception:
            pass

        return connection

# Global database manager
db_manager = DatabaseManager()

def get_connection(db_identifier=None, session_key=None):
    """Get database connection with optional database identifier and session"""
    try:
        return db_manager.get_connection(db_identifier, session_key)
    except Exception as e:
        logger.exception(f"Failed to get database connection: {e}")
        raise

def set_current_session(session_key):
    """Set current session for database operations"""
    db_manager.set_session(session_key)

@contextmanager
def get_transaction_connection(db_identifier=None, session_key=None):
    """Context manager for database transactions with proper connection handling"""
    engine = None
    connection = None
    transaction = None
    try:
        # Get a fresh engine and connection for transaction
        if db_identifier:
            resolved_path = db_manager.resolve_database_path(db_identifier)
            engine = db_manager.create_engine_for_path(resolved_path)
        else:
            # Use default database
            if db_manager.current_session:
                session_dir = SERVICE_ROOT / 'tmp_sessions' / db_manager.current_session
                session_dir.mkdir(parents=True, exist_ok=True)
                default_db = session_dir / 'default.db'
            else:
                default_db = SERVICE_ROOT / 'data' / 'default.db'
                default_db.parent.mkdir(parents=True, exist_ok=True)
            engine = db_manager.create_engine_for_path(str(default_db))

        connection = engine.connect()
        transaction = connection.begin()

        # Set version and session variables
        try:
            connection.execute(text(f"SET @mcp_alchemy_version = '{VERSION}'"))
            if db_manager.current_session:
                connection.execute(text(f"SET @mcp_session = '{db_manager.current_session}'"))
        except Exception:
            pass

        yield connection
        transaction.commit()
    except Exception as e:
        if transaction:
            try:
                transaction.rollback()
            except Exception:
                pass
        raise e
    finally:
        if connection:
            try:
                connection.close()
            except Exception:
                pass

@contextmanager
def get_safe_connection(db_identifier=None, session_key=None):
    """Context manager for safe database connections"""
    engine = None
    connection = None
    try:
        # Get a fresh engine and connection
        if db_identifier:
            resolved_path = db_manager.resolve_database_path(db_identifier)
            engine = db_manager.create_engine_for_path(resolved_path)
        else:
            # Use default database
            if db_manager.current_session:
                session_dir = SERVICE_ROOT / 'tmp_sessions' / db_manager.current_session
                session_dir.mkdir(parents=True, exist_ok=True)
                default_db = session_dir / 'default.db'
            else:
                default_db = SERVICE_ROOT / 'data' / 'default.db'
                default_db.parent.mkdir(parents=True, exist_ok=True)
            engine = db_manager.create_engine_for_path(str(default_db))

        connection = engine.connect()

        # Set version and session variables
        try:
            connection.execute(text(f"SET @mcp_alchemy_version = '{VERSION}'"))
            if db_manager.current_session:
                connection.execute(text(f"SET @mcp_session = '{db_manager.current_session}'"))
        except Exception:
            pass

        yield connection
    except Exception as e:
        raise e
    finally:
        if connection:
            try:
                connection.close()
            except Exception:
                pass

def get_db_info(db_path_or_url=None):
    with get_connection(db_path_or_url) as conn:
        engine = conn.engine
        url = engine.url
        result = [
            f"Connected to {engine.dialect.name}",
            f"version {'.'.join(str(x) for x in engine.dialect.server_version_info)}",
            f"database {url.database}",
        ]

        if url.host:
            result.append(f"on {url.host}")

        if url.username:
            result.append(f"as user {url.username}")

        return " ".join(result) + "."

### Constants ###
DB_INFO = "Dynamic database access - specify database_path parameter"
EXECUTE_QUERY_MAX_CHARS = int(os.environ.get('EXECUTE_QUERY_MAX_CHARS', 4000))
CLAUDE_LOCAL_FILES_PATH = os.environ.get('CLAUDE_LOCAL_FILES_PATH')

### MCP ###

mcp = FastMCP("MCP Alchemy")
get_logger(__name__).info(f"Starting MCP Alchemy version {VERSION}")

# Session management tools
@mcp.tool(description="Start namespace negotiation. Returns detected client info and asks for confirmation.")
def start_namespace_negotiation() -> str:
    """Start the namespace negotiation process"""
    try:
        # Access global shared_service instance
        if not shared_service or not shared_service.session_manager:
            return json.dumps({
                "status": "error",
                "message": "Error: Session manager not initialized. Service may not have started correctly."
            }, indent=2)

        session_manager = shared_service.session_manager

        # Detect client type
        detected_client = session_manager.negotiate_identity()
        client_name = session_manager.KNOWN_AI_CLIENTS.get(detected_client, f'Unknown Client ({detected_client})')

        # Check existing sessions of same type
        existing_sessions = []
        for session_key, session_info in session_manager.sessions.items():
            if session_info['client_id'] == detected_client:
                existing_sessions.append({
                    'session_key': session_key,
                    'created_at': session_info['created_at']
                })

        response = {
            "status": "negotiation_required",
            "detected_client": detected_client,
            "client_name": client_name,
            "existing_sessions": len(existing_sessions),
            "message": f"[DETECTED] AI Client: {client_name}",
            "instructions": {
                "step1": "MCP detected your AI client type automatically",
                "step2": "Choose your namespace strategy:",
                "options": {
                    "auto": "Let MCP assign automatic namespace (recommended)",
                    "custom": "Provide your own namespace ID",
                    "project": "Use project-based namespace"
                },
                "next_action": "Call confirm_namespace() with your choice"
            }
        }

        if existing_sessions:
            response["warning"] = f"[WARNING] Found {len(existing_sessions)} existing {client_name} session(s)"
            response["instructions"]["note"] = "Multiple instances of same AI type detected. Namespace isolation will prevent conflicts."

        return json.dumps(response, indent=2)

    except Exception as e:
        logger.exception("Error in start_namespace_negotiation")
        return json.dumps({
            "status": "error",
            "message": f"Error starting negotiation: {str(e)}"
        }, indent=2)

@mcp.tool(description="Confirm namespace choice and create session. Options: 'auto', 'custom:your_id', 'project:project_name'")
def confirm_namespace(choice: str, custom_id: str = None) -> str:
    """Confirm namespace choice and create the session"""
    try:
        # Access global shared_service instance
        if not shared_service or not shared_service.session_manager:
            return json.dumps({
                "status": "error",
                "message": "Error: Session manager not initialized. Service may not have started correctly."
            }, indent=2)

        session_manager = shared_service.session_manager

        # Parse choice
        if choice == "auto":
            # Auto-assign namespace
            session_key, session_info = session_manager.create_session()
        elif choice.startswith("custom:") or custom_id:
            # Custom namespace ID
            custom_namespace = choice.split(":", 1)[1] if ":" in choice else custom_id
            if not custom_namespace:
                return json.dumps({
                    "status": "error",
                    "message": "Custom namespace ID is required. Use format 'custom:your_id' or provide custom_id parameter"
                }, indent=2)

            # Validate custom ID
            if not custom_namespace.replace("_", "").replace("-", "").isalnum():
                return json.dumps({
                    "status": "error",
                    "message": "Custom namespace ID must contain only letters, numbers, hyphens, and underscores"
                }, indent=2)

            session_key, session_info = session_manager.create_custom_session(custom_namespace)

        elif choice.startswith("project:"):
            # Project-based namespace
            project_name = choice.split(":", 1)[1]
            if not project_name:
                return json.dumps({
                    "status": "error",
                    "message": "Project name is required. Use format 'project:project_name'"
                }, indent=2)

            session_key, session_info = session_manager.create_project_session(project_name)
        else:
            return json.dumps({
                "status": "error",
                "message": "Invalid choice. Use 'auto', 'custom:your_id', or 'project:project_name'"
            }, indent=2)

        # Set current session
        shared_service.current_session = session_key
        set_current_session(session_key)

        return json.dumps({
            "status": "success",
            "session_key": session_key,
            "namespace": session_info['namespace'],
            "client_name": session_info['client_name'],
            "client_id": session_info['client_id'],
            "workspace": session_info['workspace'],
            "message": f"[SUCCESS] Namespace '{session_info['namespace']}' created for {session_info['client_name']}",
            "next_steps": [
                "Use register_database() to add databases to your namespace",
                "All database operations will be isolated to your namespace",
                "Use list_session_databases() to see your registered databases"
            ]
        }, indent=2)

    except Exception as e:
        logger.exception("Error in confirm_namespace")
        return json.dumps({
            "status": "error",
            "message": f"Error confirming namespace: {str(e)}"
        }, indent=2)

@mcp.tool(description="Get complete namespace negotiation guide and current status")
def get_namespace_guide() -> str:
    """Get comprehensive guide for namespace negotiation"""
    try:
        import sys
        main_module = sys.modules.get('__main__')
        current_session = None
        active_sessions = 0

        if hasattr(main_module, 'shared_service') and main_module.shared_service:
            current_session = main_module.shared_service.current_session
            session_manager = main_module.shared_service.session_manager
            active_sessions = len(session_manager.sessions)

        guide = {
            "namespace_negotiation_guide": {
                "overview": "MCP Alchemy uses namespace isolation to allow multiple AI clients to work simultaneously without conflicts",
                "current_status": {
                    "your_session": current_session if current_session else "No active session",
                    "total_active_sessions": active_sessions,
                    "session_required": current_session is None
                },
                "step_by_step_process": {
                    "step_1": {
                        "action": "Call start_namespace_negotiation()",
                        "purpose": "MCP will detect your AI client type and show options",
                        "example": "start_namespace_negotiation()"
                    },
                    "step_2": {
                        "action": "Choose your namespace strategy",
                        "options": {
                            "auto": {
                                "description": "Let MCP assign automatic namespace (recommended for most users)",
                                "example": "confirm_namespace('auto')",
                                "result": "Gets namespace like 'claude_a1b2c3d4'"
                            },
                            "custom": {
                                "description": "Provide your own namespace ID (for specific naming needs)",
                                "example": "confirm_namespace('custom:my_project_v1')",
                                "result": "Gets namespace 'my_project_v1'",
                                "rules": "Only letters, numbers, hyphens, underscores allowed"
                            },
                            "project": {
                                "description": "Use project-based namespace (for team collaboration)",
                                "example": "confirm_namespace('project:ecommerce_backend')",
                                "result": "Gets namespace 'project_ecommerce_backend_claude'",
                                "benefit": "Multiple AIs can share same project namespace"
                            }
                        }
                    },
                    "step_3": {
                        "action": "Register databases in your namespace",
                        "example": "register_database('/path/to/database.db', 'main')",
                        "note": "Each namespace has isolated database aliases"
                    }
                },
                "multi_ai_scenarios": {
                    "scenario_1": {
                        "case": "Two Claude instances working on different projects",
                        "solution": "Each uses different custom namespace: 'project_a' and 'project_b'"
                    },
                    "scenario_2": {
                        "case": "Team with Claude and Cursor on same project",
                        "solution": "Both use same project namespace: 'project:team_dashboard'"
                    },
                    "scenario_3": {
                        "case": "Personal use with multiple AI tools",
                        "solution": "Use auto namespaces - MCP handles isolation automatically"
                    }
                },
                "namespace_benefits": [
                    "[ISOLATION] Complete database isolation between AI clients",
                    "[ALIASES] Friendly aliases for databases (e.g., 'main', 'analytics')",
                    "[WORKSPACE] Organized workspace directories per namespace",
                    "[PERSISTENCE] Session persistence across reconnections",
                    "[CLEANUP] Automatic cleanup of old sessions"
                ],
                "troubleshooting": {
                    "error_namespace_exists": "Choose different custom namespace or use auto mode",
                    "error_invalid_characters": "Use only letters, numbers, hyphens, underscores in custom namespace",
                    "error_no_session": "Call start_namespace_negotiation() first",
                    "multiple_same_ai": "This is normal - each gets isolated namespace automatically"
                }
            }
        }

        return json.dumps(guide, indent=2)

    except Exception as e:
        return f"Error getting namespace guide: {str(e)}"

@mcp.tool(description="List all databases registered for the current session")
def list_session_databases() -> str:
    """List all databases registered for the current session"""
    try:
        session_dbs = db_manager.get_session_databases()
        if not session_dbs:
            return "No databases registered for current session"

        result = []
        for alias, path in session_dbs.items():
            result.append(f"- {alias}: {path}")

        return "Registered databases:\n" + "\n".join(result)

    except Exception as e:
        return f"Error listing databases: {str(e)}"

@mcp.tool(description="Register a database path with an alias for the current session")
def register_database(database_path: str, alias: str = None) -> str:
    """Register a database path with an alias for easy access"""
    try:
        if not database_path:
            return "Error: database_path is required"

        db_alias = db_manager.register_database(database_path, alias)
        return f"Database registered as '{db_alias}': {database_path}"

    except Exception as e:
        return f"Error registering database: {str(e)}"

@mcp.tool(description=f"Return all table names in the database separated by comma. {DB_INFO}")
def all_table_names(database_path: str = None) -> str:
    """Get all table names from the specified database or current database"""
    with get_connection(database_path) as conn:
        inspector = inspect(conn)
        return ", ".join(inspector.get_table_names())

@mcp.tool(
    description=f"Return all table names in the database containing the substring 'q' separated by comma. {DB_INFO}"
)
def filter_table_names(q: str, database_path: str = None) -> str:
    """Filter table names containing the specified substring"""
    with get_connection(database_path) as conn:
        inspector = inspect(conn)
        return ", ".join(x for x in inspector.get_table_names() if q in x)

@mcp.tool(description=f"Returns schema and relation information for the given tables. {DB_INFO}")
def schema_definitions(table_names: list[str], database_path: str = None) -> str:
    def format(inspector, table_name):
        columns = inspector.get_columns(table_name)
        foreign_keys = inspector.get_foreign_keys(table_name)
        primary_keys = set(inspector.get_pk_constraint(table_name)["constrained_columns"])
        result = [f"{table_name}:"]

        # Process columns
        show_key_only = {"nullable", "autoincrement"}
        for column in columns:
            if "comment" in column:
                del column["comment"]
            name = column.pop("name")
            column_parts = (["primary key"] if name in primary_keys else []) + [str(
                column.pop("type"))] + [k if k in show_key_only else f"{k}={v}" for k, v in column.items() if v]
            result.append(f"    {name}: " + ", ".join(column_parts))

        # Process relationships
        if foreign_keys:
            result.extend(["", "    Relationships:"])
            for fk in foreign_keys:
                constrained_columns = ", ".join(fk['constrained_columns'])
                referred_table = fk['referred_table']
                referred_columns = ", ".join(fk['referred_columns'])
                result.append(f"      {constrained_columns} -> {referred_table}.{referred_columns}")

        return "\n".join(result)

    with get_connection() as conn:
        inspector = inspect(conn)
        return "\n".join(format(inspector, table_name) for table_name in table_names)

def execute_query_description():
    parts = [
        f"Execute a SQL query and return results in a readable format. Results will be truncated after {EXECUTE_QUERY_MAX_CHARS} characters."
    ]
    if CLAUDE_LOCAL_FILES_PATH:
        parts.append("Claude Desktop may fetch the full result set via an url for analysis and artifacts.")
    parts.append(
        "IMPORTANT: You MUST use the params parameter for query parameter substitution (e.g. 'WHERE id = :id' with "
        "params={'id': 123}) to prevent SQL injection. Direct string concatenation is a serious security risk.")
    parts.append(DB_INFO)
    return " ".join(parts)

@mcp.tool(description=execute_query_description())
def execute_query(query: str, params: dict = {}) -> str:
    def format_value(val):
        """Format a value for display, handling None and datetime types"""
        if val is None:
            return "NULL"
        if isinstance(val, (datetime, date)):
            return val.isoformat()
        return str(val)

    def format_result(cursor_result):
        """Format rows in a clean vertical format"""
        result, full_results = [], []
        size, i, did_truncate = 0, 0, False

        i = 0
        while row := cursor_result.fetchone():
            i += 1
            if CLAUDE_LOCAL_FILES_PATH:
                full_results.append(row)
            if did_truncate:
                continue

            sub_result = []
            sub_result.append(f"{i}. row")
            for col, val in zip(cursor_result.keys(), row):
                sub_result.append(f"{col}: {format_value(val)}")

            sub_result.append("")

            size += sum(len(x) + 1 for x in sub_result)  # +1 is for line endings

            if size > EXECUTE_QUERY_MAX_CHARS:
                did_truncate = True
                if not CLAUDE_LOCAL_FILES_PATH:
                    break
            else:
                result.extend(sub_result)

        if i == 0:
            return ["No rows returned"], full_results
        elif did_truncate:
            if CLAUDE_LOCAL_FILES_PATH:
                result.append(f"Result: {i} rows (output truncated)")
            else:
                result.append(f"Result: showing first {i-1} rows (output truncated)")
            return result, full_results
        else:
            result.append(f"Result: {i} rows")
            return result, full_results

    def save_full_results(full_results):
        """Save complete result set for Claude if configured"""
        if not CLAUDE_LOCAL_FILES_PATH:
            return None

        def serialize_row(row):
            return [format_value(val) for val in row]

        data = [serialize_row(row) for row in full_results]
        file_hash = hashlib.sha256(json.dumps(data).encode()).hexdigest()
        file_name = f"{file_hash}.json"

        with open(os.path.join(CLAUDE_LOCAL_FILES_PATH, file_name), 'w') as f:
            json.dump(data, f)

        return (
            f"Full result set url: https://cdn.jsdelivr.net/pyodide/claude-local-files/{file_name}"
            " (format: [[row1_value1, row1_value2, ...], [row2_value1, row2_value2, ...], ...]])"
            " (ALWAYS prefer fetching this url in artifacts instead of hardcoding the values if at all possible)")

    try:
        with get_connection() as connection:
            cursor_result = connection.execute(text(query), params)

            if not cursor_result.returns_rows:
                return f"Success: {cursor_result.rowcount} rows affected"

            output, full_results = format_result(cursor_result)

            if full_results_message := save_full_results(full_results):
                output.append(full_results_message)

            return "\n".join(output)
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool(description=f"Create a new database (SQLite only). For other databases, use execute_query with CREATE DATABASE. {DB_INFO}")
def create_database(database_path: str) -> str:
    """Create a new SQLite database file"""
    try:
        if not database_path.endswith('.db') and not database_path.endswith('.sqlite'):
            database_path += '.db'

        # Ensure directory exists
        os.makedirs(os.path.dirname(database_path), exist_ok=True)

        # Create new engine for the new database
        new_db_url = f"sqlite:///{database_path}"
        engine = create_engine(new_db_url)

        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        return f"Successfully created SQLite database: {database_path}"
    except Exception as e:
        return f"Error creating database: {str(e)}"

@mcp.tool(description=f"Create a new table with specified columns. {DB_INFO}")
def create_table(table_name: str, columns: list[dict], database_path: str = None) -> str:
    """
    Create a new table with specified columns.
    table_name: name of the table to create
    columns: list of column definitions
    database_path: database identifier or path (optional)

    Column format: {
        "name": "column_name",
        "type": "column_type",
        "primary_key": bool (optional),
        "nullable": bool (optional, default True),
        "unique": bool (optional),
        "default": value (optional),
        "foreign_key": {"table": "ref_table", "column": "ref_column"} (optional)
    }
    """
    try:
        if not table_name or not columns:
            return "[ERROR] Table name and columns are required"

        # Validate column definitions
        for i, col in enumerate(columns):
            if not isinstance(col, dict) or 'name' not in col or 'type' not in col:
                return f"[ERROR] Column {i+1} must have 'name' and 'type' fields"

        with get_safe_connection(database_path) as conn:
            # Check if table already exists
            inspector = inspect(conn)
            if table_name in inspector.get_table_names():
                return f"[ERROR] Table '{table_name}' already exists"

            # Build CREATE TABLE statement
            column_defs = []
            foreign_keys = []

            for col in columns:
                col_def = f"{col['name']} {col['type']}"

                # Add constraints
                if col.get('primary_key', False):
                    col_def += " PRIMARY KEY"
                if not col.get('nullable', True):
                    col_def += " NOT NULL"
                if col.get('unique', False):
                    col_def += " UNIQUE"
                if 'default' in col:
                    default_val = col['default']
                    if isinstance(default_val, str):
                        col_def += f" DEFAULT '{default_val}'"
                    else:
                        col_def += f" DEFAULT {default_val}"

                column_defs.append(col_def)

                # Handle foreign keys
                if 'foreign_key' in col:
                    fk = col['foreign_key']
                    if isinstance(fk, dict) and 'table' in fk and 'column' in fk:
                        foreign_keys.append(f"FOREIGN KEY ({col['name']}) REFERENCES {fk['table']}({fk['column']})")

            # Combine column definitions and foreign keys
            all_defs = column_defs + foreign_keys
            create_sql = f"CREATE TABLE {table_name} ({', '.join(all_defs)})"

            conn.execute(text(create_sql))
            return f"[SUCCESS] Table '{table_name}' created successfully with {len(columns)} columns"

    except SQLAlchemyError as e:
        return f"[ERROR] Database error creating table: {str(e)}"
    except Exception as e:
        return f"[ERROR] Error creating table: {str(e)}"

@mcp.tool(description=f"Drop (delete) a table from the database. {DB_INFO}")
def drop_table(table_name: str) -> str:
    """Drop a table from the database"""
    try:
        with get_connection() as conn:
            conn.execute(text(f"DROP TABLE {table_name}"))
            return f"Successfully dropped table: {table_name}"
    except Exception as e:
        return f"Error dropping table: {str(e)}"

@mcp.tool(description=f"Insert data into a table. {DB_INFO}")
def insert_data(table_name: str, data: dict) -> str:
    """
    Insert data into a table.
    data format: {"column1": "value1", "column2": "value2"}
    """
    try:
        with get_connection() as conn:
            columns = list(data.keys())
            values = list(data.values())
            placeholders = [f":{col}" for col in columns]

            insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            result = conn.execute(text(insert_sql), data)

            return f"Successfully inserted 1 row into {table_name}"
    except Exception as e:
        return f"Error inserting data: {str(e)}"

@mcp.tool(description=f"Update data in a table with WHERE condition. {DB_INFO}")
def update_data(table_name: str, set_data: dict, where_condition: str, where_params: dict = {}) -> str:
    """
    Update data in a table.
    set_data format: {"column1": "new_value1", "column2": "new_value2"}
    where_condition: SQL WHERE clause (e.g., "id = :id")
    where_params: parameters for WHERE clause (e.g., {"id": 123})
    """
    try:
        with get_connection() as conn:
            set_clauses = [f"{col} = :{col}" for col in set_data.keys()]
            update_sql = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE {where_condition}"

            # Combine set_data and where_params
            all_params = {**set_data, **where_params}

            result = conn.execute(text(update_sql), all_params)

            return f"Successfully updated {result.rowcount} row(s) in {table_name}"
    except Exception as e:
        return f"Error updating data: {str(e)}"

@mcp.tool(description=f"Delete data from a table with WHERE condition. {DB_INFO}")
def delete_data(table_name: str, where_condition: str, where_params: dict = {}) -> str:
    """
    Delete data from a table.
    where_condition: SQL WHERE clause (e.g., "id = :id")
    where_params: parameters for WHERE clause (e.g., {"id": 123})
    """
    try:
        with get_connection() as conn:
            delete_sql = f"DELETE FROM {table_name} WHERE {where_condition}"
            result = conn.execute(text(delete_sql), where_params)

            return f"Successfully deleted {result.rowcount} row(s) from {table_name}"
    except Exception as e:
        return f"Error deleting data: {str(e)}"

@mcp.tool(description=f"Create an index on a table column for better query performance. {DB_INFO}")
def create_index(table_name: str, column_name: str, index_name: str = None) -> str:
    """Create an index on a table column"""
    try:
        if not index_name:
            index_name = f"idx_{table_name}_{column_name}"

        with get_connection() as conn:
            create_index_sql = f"CREATE INDEX {index_name} ON {table_name} ({column_name})"
            conn.execute(text(create_index_sql))

            return f"Successfully created index {index_name} on {table_name}.{column_name}"
    except Exception as e:
        return f"Error creating index: {str(e)}"

@mcp.tool(description=f"Drop an index from the database. {DB_INFO}")
def drop_index(index_name: str) -> str:
    """Drop an index from the database"""
    try:
        with get_connection() as conn:
            conn.execute(text(f"DROP INDEX {index_name}"))
            return f"Successfully dropped index: {index_name}"
    except Exception as e:
        return f"Error dropping index: {str(e)}"

@mcp.tool(description=f"Get detailed information about database structure including tables, views, indexes. {DB_INFO}")
def get_database_info() -> str:
    """Get comprehensive database information"""
    try:
        with get_connection() as conn:
            inspector = inspect(conn)

            info = []
            info.append(f"Database Information:")
            info.append(f"Engine: {conn.engine.dialect.name}")
            info.append(f"Version: {'.'.join(str(x) for x in conn.engine.dialect.server_version_info)}")
            info.append("")

            # Tables
            tables = inspector.get_table_names()
            info.append(f"Tables ({len(tables)}):")
            for table in tables:
                columns = inspector.get_columns(table)
                info.append(f"  {table} ({len(columns)} columns)")

            info.append("")

            # Views
            try:
                views = inspector.get_view_names()
                info.append(f"Views ({len(views)}):")
                for view in views:
                    info.append(f"  {view}")
                info.append("")
            except:
                pass

            # Indexes
            info.append("Indexes:")
            for table in tables:
                try:
                    indexes = inspector.get_indexes(table)
                    for idx in indexes:
                        info.append(f"  {idx['name']} on {table} ({', '.join(idx['column_names'])})")
                except:
                    pass

            return "\n".join(info)
    except Exception as e:
        return f"Error getting database info: {str(e)}"

@mcp.tool(description=f"Execute multiple SQL statements in a transaction with improved connection management. {DB_INFO}")
def execute_transaction(queries: list[str], params_list: list[dict] = None, database_path: str = None) -> str:
    """
    Execute multiple SQL statements in a transaction.
    queries: list of SQL statements
    params_list: list of parameter dictionaries for each query (optional)
    database_path: database identifier or path (optional)
    """
    try:
        if not queries:
            return "[ERROR] No queries provided for transaction"

        if params_list is None:
            params_list = [{}] * len(queries)

        if len(queries) != len(params_list):
            return "[ERROR] Number of queries must match number of parameter sets"

        # Use transaction context manager for proper handling
        with get_transaction_connection(database_path) as connection:
            results = []
            for i, (query, params) in enumerate(zip(queries, params_list)):
                try:
                    result = connection.execute(text(query), params)
                    if result.returns_rows:
                        rows = result.fetchall()
                        results.append(f"Query {i+1}: {len(rows)} rows returned")
                    else:
                        results.append(f"Query {i+1}: {result.rowcount} rows affected")
                except Exception as query_error:
                    return f"[ERROR] Query {i+1} failed: {str(query_error)}"

            return "[SUCCESS] Transaction completed successfully:\n" + "\n".join(results)

    except Exception as e:
        return f"[ERROR] Error executing transaction: {str(e)}"

@mcp.tool(description=f"Batch insert multiple records into a table. {DB_INFO}")
def batch_insert(table_name: str, records: list[dict], database_path: str = None) -> str:
    """
    Insert multiple records into a table in a single transaction.
    table_name: name of the target table
    records: list of dictionaries containing record data
    database_path: database identifier or path (optional)
    """
    try:
        if not records:
            return "[ERROR] No records provided for batch insert"

        if not table_name:
            return "[ERROR] Table name is required"

        # Validate all records have same keys
        first_keys = set(records[0].keys())
        for i, record in enumerate(records[1:], 1):
            if set(record.keys()) != first_keys:
                return f"[ERROR] Record {i+1} has different keys than first record"

        # Build INSERT statement
        columns = list(first_keys)
        placeholders = ', '.join([f':{col}' for col in columns])
        insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"

        with get_transaction_connection(database_path) as connection:
            result = connection.execute(text(insert_sql), records)
            return f"[SUCCESS] Batch insert completed: {result.rowcount} records inserted into {table_name}"
    except Exception as e:
        return f"[ERROR] Error in batch insert: {str(e)}"

@mcp.tool(description=f"Batch update multiple records in a table. {DB_INFO}")
def batch_update(table_name: str, updates: list[dict], where_column: str, database_path: str = None) -> str:
    """
    Update multiple records in a table based on a where condition.
    table_name: name of the target table
    updates: list of dictionaries containing update data (must include where_column value)
    where_column: column name to use in WHERE clause
    database_path: database identifier or path (optional)
    """
    try:
        if not updates:
            return "[ERROR] No updates provided for batch update"

        if not table_name or not where_column:
            return "[ERROR] Table name and where column are required"

        # Validate all updates have the where column
        for i, update in enumerate(updates):
            if where_column not in update:
                return f"[ERROR] Update {i+1} missing where column '{where_column}'"

        with get_transaction_connection(database_path) as connection:
            total_affected = 0
            for update in updates:
                # Separate where value from update data
                where_value = update[where_column]
                update_data = {k: v for k, v in update.items() if k != where_column}

                if not update_data:
                    continue  # Skip if no data to update

                # Build UPDATE statement
                set_clause = ', '.join([f"{col} = :{col}" for col in update_data.keys()])
                update_sql = f"UPDATE {table_name} SET {set_clause} WHERE {where_column} = :where_value"

                # Execute update
                params = {**update_data, 'where_value': where_value}
                result = connection.execute(text(update_sql), params)
                total_affected += result.rowcount

            return f"[SUCCESS] Batch update completed: {total_affected} records updated in {table_name}"
    except Exception as e:
        return f"[ERROR] Error in batch update: {str(e)}"

@mcp.tool(description=f"Batch delete multiple records from a table. {DB_INFO}")
def batch_delete(table_name: str, where_conditions: list[dict], database_path: str = None) -> str:
    """
    Delete multiple records from a table based on where conditions.
    table_name: name of the target table
    where_conditions: list of dictionaries containing where conditions
    database_path: database identifier or path (optional)
    """
    try:
        if not where_conditions:
            return "[ERROR] No where conditions provided for batch delete"

        if not table_name:
            return "[ERROR] Table name is required"

        with get_transaction_connection(database_path) as connection:
            total_deleted = 0
            for i, condition in enumerate(where_conditions):
                if not condition:
                    continue  # Skip empty conditions

                # Build WHERE clause
                where_parts = []
                params = {}
                for j, (col, val) in enumerate(condition.items()):
                    param_name = f"param_{i}_{j}"
                    where_parts.append(f"{col} = :{param_name}")
                    params[param_name] = val

                where_clause = " AND ".join(where_parts)
                delete_sql = f"DELETE FROM {table_name} WHERE {where_clause}"

                result = connection.execute(text(delete_sql), params)
                total_deleted += result.rowcount

            return f"[SUCCESS] Batch delete completed: {total_deleted} records deleted from {table_name}"
    except Exception as e:
        return f"[ERROR] Error in batch delete: {str(e)}"

@mcp.tool(description=f"Upsert (INSERT or UPDATE) multiple records in a table. {DB_INFO}")
def batch_upsert(table_name: str, records: list[dict], conflict_columns: list[str], database_path: str = None) -> str:
    """
    Insert or update multiple records (upsert operation).
    table_name: name of the target table
    records: list of dictionaries containing record data
    conflict_columns: list of column names that define uniqueness
    database_path: database identifier or path (optional)
    """
    try:
        if not records:
            return "[ERROR] No records provided for batch upsert"

        if not table_name or not conflict_columns:
            return "[ERROR] Table name and conflict columns are required"

        # Validate all records have same keys
        first_keys = set(records[0].keys())
        for i, record in enumerate(records[1:], 1):
            if set(record.keys()) != first_keys:
                return f"[ERROR] Record {i+1} has different keys than first record"

        # Validate conflict columns exist in records
        for col in conflict_columns:
            if col not in first_keys:
                return f"[ERROR] Conflict column '{col}' not found in record data"

        with get_transaction_connection(database_path) as connection:
            inserted = 0
            updated = 0

            for record in records:
                # Check if record exists
                where_parts = []
                where_params = {}
                for col in conflict_columns:
                    where_parts.append(f"{col} = :{col}")
                    where_params[col] = record[col]

                where_clause = " AND ".join(where_parts)
                check_sql = f"SELECT COUNT(*) as count FROM {table_name} WHERE {where_clause}"

                result = connection.execute(text(check_sql), where_params)
                exists = result.fetchone()[0] > 0

                if exists:
                    # Update existing record
                    update_data = {k: v for k, v in record.items() if k not in conflict_columns}
                    if update_data:  # Only update if there's data to update
                        set_clause = ', '.join([f"{col} = :{col}" for col in update_data.keys()])
                        update_sql = f"UPDATE {table_name} SET {set_clause} WHERE {where_clause}"

                        params = {**update_data, **where_params}
                        connection.execute(text(update_sql), params)
                        updated += 1
                else:
                    # Insert new record
                    columns = list(record.keys())
                    placeholders = ', '.join([f':{col}' for col in columns])
                    insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"

                    connection.execute(text(insert_sql), record)
                    inserted += 1

            return f"[SUCCESS] Batch upsert completed: {inserted} records inserted, {updated} records updated in {table_name}"
    except Exception as e:
        return f"[ERROR] Error in batch upsert: {str(e)}"

@mcp.tool(description=f"Execute a batch of SELECT queries and return combined results. {DB_INFO}")
def batch_select(queries: list[str], params_list: list[dict] = None, database_path: str = None) -> str:
    """
    Execute multiple SELECT queries and return combined results.
    queries: list of SELECT SQL statements
    params_list: list of parameter dictionaries for each query (optional)
    database_path: database identifier or path (optional)
    """
    try:
        if not queries:
            return "[ERROR] No queries provided for batch select"

        if params_list is None:
            params_list = [{}] * len(queries)

        if len(queries) != len(params_list):
            return "[ERROR] Number of queries must match number of parameter sets"

        connection = get_connection(database_path)
        try:
            results = []
            for i, (query, params) in enumerate(zip(queries, params_list)):
                # Validate it's a SELECT query
                if not query.strip().upper().startswith('SELECT'):
                    return f"[ERROR] Query {i+1} is not a SELECT statement"

                result = connection.execute(text(query), params)
                rows = result.fetchall()

                if rows:
                    columns = list(result.keys())
                    query_result = {
                        'query_index': i + 1,
                        'columns': columns,
                        'row_count': len(rows),
                        'data': [dict(zip(columns, row)) for row in rows]
                    }
                else:
                    query_result = {
                        'query_index': i + 1,
                        'columns': [],
                        'row_count': 0,
                        'data': []
                    }

                results.append(query_result)

            return f"[SUCCESS] Batch select completed:\n{json.dumps(results, indent=2, default=str)}"
        finally:
            connection.close()
    except Exception as e:
        return f"[ERROR] Error in batch select: {str(e)}"

@mcp.tool(description=f"Analyze table performance and suggest optimizations. {DB_INFO}")
def analyze_table_performance(table_name: str, database_path: str = None) -> str:
    """
    Analyze table performance and provide optimization suggestions.
    table_name: name of the table to analyze
    database_path: database identifier or path (optional)
    """
    try:
        if not table_name:
            return "[ERROR] Table name is required"

        connection = get_connection(database_path)
        try:
            analysis = {
                'table_name': table_name,
                'row_count': 0,
                'indexes': [],
                'columns': [],
                'suggestions': []
            }

            # Get row count
            count_result = connection.execute(text(f"SELECT COUNT(*) as count FROM {table_name}"))
            analysis['row_count'] = count_result.fetchone()[0]

            # Get table schema
            inspector = inspect(connection)
            columns = inspector.get_columns(table_name)
            analysis['columns'] = [
                {
                    'name': col['name'],
                    'type': str(col['type']),
                    'nullable': col['nullable'],
                    'primary_key': col.get('primary_key', False)
                }
                for col in columns
            ]

            # Get indexes
            indexes = inspector.get_indexes(table_name)
            analysis['indexes'] = [
                {
                    'name': idx['name'],
                    'columns': idx['column_names'],
                    'unique': idx['unique']
                }
                for idx in indexes
            ]

            # Performance suggestions
            if analysis['row_count'] > 10000:
                analysis['suggestions'].append("Large table detected - consider partitioning for better performance")

            if len(analysis['indexes']) == 0:
                analysis['suggestions'].append("No indexes found - consider adding indexes on frequently queried columns")

            # Check for text columns without indexes
            text_columns = [col['name'] for col in analysis['columns'] if 'TEXT' in str(col['type']).upper()]
            indexed_columns = set()
            for idx in analysis['indexes']:
                indexed_columns.update(idx['columns'])

            unindexed_text = [col for col in text_columns if col not in indexed_columns]
            if unindexed_text:
                analysis['suggestions'].append(f"Text columns without indexes: {', '.join(unindexed_text)} - consider adding indexes if used in WHERE clauses")

            if not analysis['suggestions']:
                analysis['suggestions'].append("Table appears to be well optimized")

            return f"[SUCCESS] Table performance analysis:\n{json.dumps(analysis, indent=2, default=str)}"
        finally:
            connection.close()
    except Exception as e:
        return f"[ERROR] Error analyzing table performance: {str(e)}"

@mcp.tool(description=f"Create optimized indexes for better query performance. {DB_INFO}")
def create_optimized_index(table_name: str, columns: list[str], index_name: str = None, unique: bool = False, database_path: str = None) -> str:
    """
    Create an optimized index on specified columns.
    table_name: name of the target table
    columns: list of column names to include in the index
    index_name: custom name for the index (optional, will be auto-generated)
    unique: whether the index should enforce uniqueness
    database_path: database identifier or path (optional)
    """
    try:
        if not table_name or not columns:
            return "[ERROR] Table name and columns are required"

        if not index_name:
            index_name = f"idx_{table_name}_{'_'.join(columns)}"

        connection = get_connection(database_path)
        try:
            # Check if index already exists
            inspector = inspect(connection)
            existing_indexes = inspector.get_indexes(table_name)

            for idx in existing_indexes:
                if idx['name'] == index_name:
                    return f"[WARNING] Index '{index_name}' already exists on table '{table_name}'"

            # Create index
            unique_clause = "UNIQUE " if unique else ""
            columns_clause = ", ".join(columns)
            create_index_sql = f"CREATE {unique_clause}INDEX {index_name} ON {table_name} ({columns_clause})"

            connection.execute(text(create_index_sql))
            return f"[SUCCESS] Index '{index_name}' created successfully on table '{table_name}' for columns: {', '.join(columns)}"
        finally:
            connection.close()
    except Exception as e:
        return f"[ERROR] Error creating index: {str(e)}"

@mcp.tool(description=f"Get database performance statistics and connection info. {DB_INFO}")
def get_database_stats(database_path: str = None) -> str:
    """
    Get comprehensive database performance statistics.
    database_path: database identifier or path (optional)
    """
    try:
        connection = get_connection(database_path)
        try:
            stats = {
                'connection_info': {},
                'table_stats': [],
                'index_stats': [],
                'performance_metrics': {}
            }

            # Connection info
            stats['connection_info'] = {
                'database_url': str(connection.engine.url).replace(connection.engine.url.password or '', '***'),
                'pool_size': connection.engine.pool.size(),
                'checked_out_connections': connection.engine.pool.checkedout(),
                'overflow_connections': connection.engine.pool.overflow(),
                'checked_in_connections': connection.engine.pool.checkedin()
            }

            # Get all tables
            inspector = inspect(connection)
            table_names = inspector.get_table_names()

            total_rows = 0
            for table_name in table_names:
                try:
                    # Get row count
                    count_result = connection.execute(text(f"SELECT COUNT(*) as count FROM {table_name}"))
                    row_count = count_result.fetchone()[0]
                    total_rows += row_count

                    # Get indexes for this table
                    indexes = inspector.get_indexes(table_name)

                    stats['table_stats'].append({
                        'table_name': table_name,
                        'row_count': row_count,
                        'index_count': len(indexes)
                    })

                    # Add index details
                    for idx in indexes:
                        stats['index_stats'].append({
                            'table_name': table_name,
                            'index_name': idx['name'],
                            'columns': idx['column_names'],
                            'unique': idx['unique']
                        })
                except Exception:
                    # Skip tables that can't be counted
                    continue

            stats['performance_metrics'] = {
                'total_tables': len(table_names),
                'total_rows': total_rows,
                'total_indexes': len(stats['index_stats']),
                'avg_rows_per_table': total_rows / len(table_names) if table_names else 0
            }

            return f"[SUCCESS] Database statistics:\n{json.dumps(stats, indent=2, default=str)}"
        finally:
            connection.close()
    except Exception as e:
        return f"[ERROR] Error getting database stats: {str(e)}"

@mcp.tool(description=f"Backup database to SQL file (SQLite only). {DB_INFO}")
def backup_database(backup_path: str, database_path: str = None) -> str:
    """
    Backup SQLite database to SQL file
    backup_path: path where backup file will be saved
    database_path: database identifier or path (optional)
    """
    try:
        if not backup_path:
            return "[ERROR] Backup path is required"

        # Validate backup path
        backup_file = Path(backup_path)
        backup_file.parent.mkdir(parents=True, exist_ok=True)

        with get_safe_connection(database_path) as conn:
            # Check if it's SQLite
            db_url = str(conn.engine.url)
            if not db_url.startswith('sqlite'):
                return "[ERROR] Backup is only supported for SQLite databases"

            # Get all table creation statements
            inspector = inspect(conn)
            tables = inspector.get_table_names()

            if not tables:
                return "[WARNING] No tables found in database"

            backup_sql = []
            backup_sql.append("-- Database backup generated by MCP Alchemy")
            backup_sql.append(f"-- Generated on: {datetime.now().isoformat()}")
            backup_sql.append(f"-- Source database: {db_url}")
            backup_sql.append("")
            backup_sql.append("PRAGMA foreign_keys = OFF;")
            backup_sql.append("BEGIN TRANSACTION;")
            backup_sql.append("")

            total_rows = 0
            for table in tables:
                try:
                    # Get table schema
                    result = conn.execute(text(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'"))
                    schema_row = result.fetchone()
                    if schema_row:
                        create_sql = schema_row[0]
                        backup_sql.append(f"-- Table: {table}")
                        backup_sql.append(f"DROP TABLE IF EXISTS {table};")
                        backup_sql.append(create_sql + ";")
                        backup_sql.append("")

                        # Get table data
                        result = conn.execute(text(f"SELECT * FROM {table}"))
                        rows = result.fetchall()
                        if rows:
                            columns = list(result.keys())
                            backup_sql.append(f"-- Data for table: {table}")

                            for row in rows:
                                values = []
                                for val in row:
                                    if val is None:
                                        values.append("NULL")
                                    elif isinstance(val, str):
                                        # Escape single quotes properly
                                        escaped_val = val.replace("'", "''")
                                        values.append(f"'{escaped_val}'")
                                    elif isinstance(val, (datetime, date)):
                                        values.append(f"'{val.isoformat()}'")
                                    else:
                                        values.append(str(val))

                                insert_sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join(values)});"
                                backup_sql.append(insert_sql)

                            total_rows += len(rows)
                            backup_sql.append("")
                        else:
                            backup_sql.append(f"-- No data in table: {table}")
                            backup_sql.append("")

                except Exception as table_error:
                    backup_sql.append(f"-- ERROR backing up table {table}: {str(table_error)}")
                    backup_sql.append("")

            backup_sql.append("COMMIT;")
            backup_sql.append("PRAGMA foreign_keys = ON;")
            backup_sql.append("")
            backup_sql.append(f"-- Backup completed: {len(tables)} tables, {total_rows} total rows")

            # Write backup file
            with open(backup_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(backup_sql))

            return f"[SUCCESS] Database backed up successfully to: {backup_path}\n  Tables: {len(tables)}, Rows: {total_rows}"

    except Exception as e:
        return f"[ERROR] Error backing up database: {str(e)}"

def main():
    """Main entry point - initializes service and starts MCP server"""
    global shared_service

    try:
        # Initialize shared service
        logger.info("Initializing MCP Alchemy service...")
        shared_service = SharedService()
        shared_service.check_or_start_service()

        # Initialize database session if shared service has one
        if shared_service.current_session:
            set_current_session(shared_service.current_session)
            logger.info(f"Initialized with session: {shared_service.current_session}")

        # Start MCP server
        logger.info("Starting FastMCP server...")
        mcp.run()

    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
    finally:
        # Cleanup
        if shared_service:
            shared_service.release_lock()
        logger.info("Service shutdown complete")

if __name__ == "__main__":
    main()
