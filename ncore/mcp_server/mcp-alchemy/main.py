#!/usr/bin/env python3
"""
MCP Alchemy - Enhanced Database Operations MCP Server
Main entry point for the service following project standards.
"""

import os
import sys
import json
import logging
import uuid
import time
from pathlib import Path
from filelock import FileLock
from datetime import datetime

# Path handling according to project standards
SERVICE_ROOT = Path(__file__).parent.absolute()
PROJECT_ROOT = SERVICE_ROOT.parent.parent.parent

# Add service to Python path
sys.path.insert(0, str(SERVICE_ROOT))

# Configuration paths
CONFIG_PATH = SERVICE_ROOT / 'config.json'
DATA_DIR = SERVICE_ROOT / 'data'
LOG_DIR = SERVICE_ROOT / 'logs'
SESSIONS_DIR = SERVICE_ROOT / 'tmp_sessions'
LOCK_FILE = SERVICE_ROOT / 'tmp_.service.lock'

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)
SESSIONS_DIR.mkdir(exist_ok=True)

# Global shared service instance
shared_service = None

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
            print(f"Failed to save sessions: {e}")

    def negotiate_identity(self):
        """Negotiate AI client identity"""
        # Try to detect from environment variables
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

        # Default to programming master if no specific client detected
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
            'databases': {},  # Track databases used by this session
            'project_name': project_name  # Optional project association
        }

        self.sessions[session_key] = session_info
        self.save_sessions()

        # Generate AI identity display
        client_name = session_info['client_name']
        session_id = session_key.split('_')[-1].upper()

        # Create formatted AI identity
        ai_identity_name = client_name.split(' - ')[0] if ' - ' in client_name else client_name
        ai_description = client_name.split(' - ')[1] if ' - ' in client_name else 'General Purpose Assistant'

        print(f"[SESSION] Created session for {client_name.split(' - ')[0]} ({client_id})")
        print(f"   Namespace: {namespace}")
        print(f"   Session Key: {session_key}")
        print(f"   AI Identity: {ai_identity_name} - {ai_description} #{session_id}")
        print(f"   Namespace Requirement: All AI interactions must include namespace prefix")
        if project_name:
            print(f"   Project: {project_name}")

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
            print(f"[CLEANUP] Cleaned up old session: {session_key}")

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
            self.lock.acquire(timeout=0.1)  # Very short timeout

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

            print(f"[PRIMARY] Started as PRIMARY instance (PID: {os.getpid()})")
            print(f"   Session: {session_info['client_name']} ({session_key})")
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
                    print(f"[SHARED] Connected to EXISTING service (Primary PID: {status.get('pid', 'unknown')})")
                    print(f"   Service started at: {status.get('started_at', 'unknown')}")
                    print(f"   My session: {session_info['client_name']} ({session_key})")
                    return True
                except Exception:
                    pass

            print(f"[SHARED] Connected to SHARED service instance")
            print(f"   My session: {session_info['client_name']} ({session_key})")
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
                print("[CLEANUP] Primary instance released service lock")
            except Exception:
                pass

class ConfigManager:
    """Configuration management for the service"""
    
    def __init__(self):
        self.config_path = CONFIG_PATH
        self.default_config = {
            "debug": False,
            "max_connections": 10,
            "timeout": 30000,
            "execute_query_max_chars": 4000,
            "supported_databases": [
                "sqlite", "postgresql", "mysql", "mariadb", 
                "mssql", "oracle", "cratedb", "vertica"
            ],
            "auto_create_databases": True,
            "connection_pool": {
                "pool_size": 1,
                "max_overflow": 2,
                "pool_recycle": 3600,
                "pool_pre_ping": True,
                "isolation_level": "AUTOCOMMIT"
            }
        }
        self.load_config()
    
    def load_config(self):
        """Load configuration from file or create default"""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    user_config = json.load(f)
                self.config = {**self.default_config, **user_config}
            else:
                self.config = self.default_config.copy()
                self.save_config()
        except Exception as e:
            print(f"Failed to load config: {e}")
            self.config = self.default_config.copy()
    
    def save_config(self):
        """Save current configuration to file"""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Failed to save config: {e}")
    
    def get(self, key, default=None):
        """Get configuration value"""
        return self.config.get(key, default)

class Logger:
    """Logging management for the service"""
    
    def __init__(self, service_root):
        self.log_dir = service_root / 'logs'
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging configuration"""
        # Create formatters
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Setup file handlers with UTF-8 encoding
        info_handler = logging.FileHandler(self.log_dir / 'info.log', encoding='utf-8')
        info_handler.setLevel(logging.INFO)
        info_handler.setFormatter(formatter)

        error_handler = logging.FileHandler(self.log_dir / 'error.log', encoding='utf-8')
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)

        # Setup console handler with UTF-8 encoding
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)

        # Set console encoding for Windows
        import sys
        if hasattr(sys.stdout, 'reconfigure'):
            try:
                sys.stdout.reconfigure(encoding='utf-8')
                sys.stderr.reconfigure(encoding='utf-8')
            except:
                pass
        
        # Configure root logger
        logging.basicConfig(
            level=logging.INFO,
            handlers=[info_handler, error_handler, console_handler]
        )

def setup_environment():
    """Setup environment variables and configuration"""
    config = ConfigManager()

    # Remove any fixed DB_URL from environment to allow dynamic database paths
    # The service will accept database paths through tool parameters instead
    if 'DB_URL' in os.environ:
        del os.environ['DB_URL']

    if not os.environ.get('EXECUTE_QUERY_MAX_CHARS'):
        os.environ['EXECUTE_QUERY_MAX_CHARS'] = str(config.get('execute_query_max_chars'))

    # Set service root for the MCP server
    os.environ['SERVICE_ROOT'] = str(SERVICE_ROOT)

    return config

def main():
    """Main entry point for the MCP Alchemy service"""
    global shared_service

    # Setup shared service pattern for multi-AI access
    shared_service = SharedService()
    if not shared_service.check_or_start_service():
        print("[ERROR] Failed to connect to service")
        sys.exit(1)

    try:
        # Setup logging
        logger_manager = Logger(SERVICE_ROOT)
        logger = logging.getLogger(__name__)

        if shared_service.is_primary:
            logger.info("[PRIMARY] Starting MCP Alchemy Enhanced Database Service")
        else:
            logger.info("[SHARED] Connected to MCP Alchemy Enhanced Database Service")

        logger.info(f"Service root: {SERVICE_ROOT}")
        logger.info(f"Project root: {PROJECT_ROOT}")

        # Setup environment and configuration
        config = setup_environment()
        logger.info("[CONFIG] Dynamic database access enabled - no fixed DB_URL")
        logger.info("[INFO] AI can specify any database path through tool parameters")

        # Import and start the MCP server
        from mcp_alchemy.server import main as server_main

        if shared_service.is_primary:
            logger.info("[SERVER] Starting MCP server as primary instance...")
        else:
            logger.info("[SERVER] Connecting to shared MCP server...")

        server_main()

    except KeyboardInterrupt:
        logging.getLogger(__name__).info("[STOP] Service stopped by user")
    except Exception as e:
        logging.getLogger(__name__).error(f"[ERROR] Service error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        shared_service.release_lock()

if __name__ == "__main__":
    main()
