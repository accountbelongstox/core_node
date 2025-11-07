"""
AI Collaboration MCP Server (SQLite Version)
Multi-AI collaboration service with cross-client data sharing
"""

import sys
import asyncio
import time
from pathlib import Path
from typing import Any, Dict, Optional

# Add current directory to path for standalone execution
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Try relative import first, fall back to absolute import
try:
    from .constants import AICollaborationConstants as Constants
    from .storage_sqlite import SQLiteStorageManager
except ImportError:
    from constants import AICollaborationConstants as Constants
    from storage_sqlite import SQLiteStorageManager


class AICollaborationServer:
    """MCP Server for AI Collaboration using SQLite"""

    _instance = None
    _initialized = False

    def __new__(cls):
        """Singleton pattern - ensure single instance"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def reset_singleton(cls):
        """Reset singleton instance for restart"""
        cls._instance = None
        cls._initialized = False
        print("Singleton instance reset", file=sys.stderr)

    def __init__(self):
        """Initialize server components (only once)"""
        if self._initialized:
            return

        Constants.ensure_directories()

        # Initialize SQLite storage
        self.storage = SQLiteStorageManager(
            db_path=Constants.DB_FILE,
            max_retries=5,
            retry_delay=0.1
        )

        # Create or get current startup namespace
        self.namespace_id = self.storage.get_current_namespace()
        if not self.namespace_id:
            self.namespace_id = self.storage.create_startup_namespace({
                'service_name': Constants.SERVICE_NAME,
                'version': Constants.SERVICE_VERSION,
                'platform': Constants.SYSTEM_NAME
            })

        self.server = Server(Constants.SERVICE_NAME)
        self._register_tools()

        self._initialized = True

        print(f"AI Collaboration MCP Server initialized (SQLite)", file=sys.stderr)
        print(f"Database: {Constants.DB_FILE}", file=sys.stderr)
        print(f"Namespace: {self.namespace_id}", file=sys.stderr)

    def _register_tools(self):
        """Register all MCP tools"""

        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            """List all available tools"""
            return [
                Tool(
                    name="register_role",
                    description="Register an AI with a specific role in the current startup namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "session_id": {
                                "type": "string",
                                "description": "Unique session identifier for this AI instance"
                            },
                            "role_name": {
                                "type": "string",
                                "description": f"Role name (options: {', '.join(Constants.PREDEFINED_ROLES)})"
                            },
                            "ai_name": {
                                "type": "string",
                                "description": "Optional friendly name for this AI instance"
                            },
                            "metadata": {
                                "type": "object",
                                "description": "Optional metadata about this AI instance"
                            }
                        },
                        "required": ["session_id", "role_name"]
                    }
                ),
                Tool(
                    name="get_role_list",
                    description="Get list of all registered AI roles in the current namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "include_inactive": {
                                "type": "boolean",
                                "description": "Include roles inactive for >1 hour (default: false)"
                            }
                        }
                    }
                ),
                Tool(
                    name="write_log",
                    description="Write a work log entry to your role's namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "session_id": {
                                "type": "string",
                                "description": "Your session identifier"
                            },
                            "role_name": {
                                "type": "string",
                                "description": "Your role name"
                            },
                            "message": {
                                "type": "object",
                                "description": "The log message content (any JSON-serializable object)"
                            },
                            "metadata": {
                                "type": "object",
                                "description": "Optional metadata for this log entry"
                            }
                        },
                        "required": ["session_id", "role_name", "message"]
                    }
                ),
                Tool(
                    name="read_logs",
                    description="Read work logs from the current namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "role_name": {
                                "type": "string",
                                "description": "Filter by role name (optional)"
                            },
                            "session_id": {
                                "type": "string",
                                "description": "Filter by specific session ID (optional)"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of logs to return (default: 100)"
                            },
                            "offset": {
                                "type": "number",
                                "description": "Number of logs to skip (default: 0)"
                            }
                        }
                    }
                ),
                Tool(
                    name="ask_question",
                    description="Ask a question to another AI role in the namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "from_role": {
                                "type": "string",
                                "description": "Your role name"
                            },
                            "from_session_id": {
                                "type": "string",
                                "description": "Your session identifier"
                            },
                            "to_role": {
                                "type": "string",
                                "description": "Target role name to ask"
                            },
                            "question": {
                                "type": "string",
                                "description": "The question text"
                            },
                            "context": {
                                "type": "object",
                                "description": "Optional context information"
                            },
                            "priority": {
                                "type": "string",
                                "description": "Question priority: low, normal, high, urgent (default: normal)"
                            }
                        },
                        "required": ["from_role", "from_session_id", "to_role", "question"]
                    }
                ),
                Tool(
                    name="answer_question",
                    description="Answer a pending question from another AI",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "question_id": {
                                "type": "string",
                                "description": "ID of the question to answer"
                            },
                            "answer": {
                                "type": "string",
                                "description": "The answer text"
                            },
                            "answering_session_id": {
                                "type": "string",
                                "description": "Your session identifier"
                            },
                            "metadata": {
                                "type": "object",
                                "description": "Optional metadata about the answer"
                            }
                        },
                        "required": ["question_id", "answer", "answering_session_id"]
                    }
                ),
                Tool(
                    name="get_pending_questions",
                    description="Get pending questions addressed to your role",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "role_name": {
                                "type": "string",
                                "description": "Your role name"
                            },
                            "session_id": {
                                "type": "string",
                                "description": "Optional session ID to filter by"
                            },
                            "priority_filter": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Optional list of priorities to include"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of questions (default: 50)"
                            }
                        },
                        "required": ["role_name"]
                    }
                ),
                Tool(
                    name="health_check",
                    description="Check server health and get system information",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="get_namespace_info",
                    description="Get information about the current startup namespace",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="list_all_namespaces",
                    description="List all startup namespaces (current and historical)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "include_inactive": {
                                "type": "boolean",
                                "description": "Include inactive namespaces (default: false)"
                            }
                        }
                    }
                ),
                Tool(
                    name="get_storage_stats",
                    description="Get storage statistics",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="search_logs",
                    description="Search work logs by keyword",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "keyword": {
                                "type": "string",
                                "description": "Keyword to search for"
                            },
                            "role_name": {
                                "type": "string",
                                "description": "Optional role name to filter by"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of results (default: 50)"
                            }
                        },
                        "required": ["keyword"]
                    }
                ),
                Tool(
                    name="get_question_history",
                    description="Get question history",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "role_name": {
                                "type": "string",
                                "description": "Filter by role name"
                            },
                            "session_id": {
                                "type": "string",
                                "description": "Filter by session ID"
                            },
                            "status": {
                                "type": "string",
                                "description": "Filter by status: pending or answered"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of questions (default: 100)"
                            }
                        }
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Any) -> list[TextContent]:
            """Handle tool invocations"""
            try:
                result = await self._handle_tool_call(name, arguments or {})

                import json
                return [TextContent(
                    type="text",
                    text=json.dumps(result, indent=2, ensure_ascii=False)
                )]

            except Exception as e:
                import json
                error_result = {
                    'success': False,
                    'error': str(e),
                    'tool': name
                }
                return [TextContent(
                    type="text",
                    text=json.dumps(error_result, indent=2, ensure_ascii=False)
                )]

    async def _handle_tool_call(self, name: str, arguments: Dict) -> Dict:
        """Route tool calls to appropriate handlers"""

        if name == "register_role":
            role_name = arguments['role_name']
            if role_name not in Constants.PREDEFINED_ROLES:
                return {
                    'success': False,
                    'error': f'Unknown role: {role_name}',
                    'available_roles': Constants.PREDEFINED_ROLES
                }

            result = self.storage.register_role(
                namespace_id=self.namespace_id,
                session_id=arguments['session_id'],
                role_name=role_name,
                ai_name=arguments.get('ai_name'),
                metadata=arguments.get('metadata')
            )

            # Update activity
            self.storage.update_role_activity(
                namespace_id=self.namespace_id,
                session_id=arguments['session_id'],
                role_name=role_name
            )

            # Get total role count
            all_roles = self.storage.get_roles(self.namespace_id, include_inactive=False)

            result.update({
                'total_active_roles': len(all_roles),
                'namespace_id': self.namespace_id,
                'message': 'Role registered successfully - Service is running, other AIs can join anytime'
            })

            return result

        elif name == "get_role_list":
            roles = self.storage.get_roles(
                namespace_id=self.namespace_id,
                include_inactive=arguments.get('include_inactive', False)
            )

            return {
                'success': True,
                'namespace_id': self.namespace_id,
                'roles': roles
            }

        elif name == "write_log":
            # Update activity first
            self.storage.update_role_activity(
                namespace_id=self.namespace_id,
                session_id=arguments['session_id'],
                role_name=arguments['role_name']
            )

            result = self.storage.write_log(
                namespace_id=self.namespace_id,
                session_id=arguments['session_id'],
                role_name=arguments['role_name'],
                message=arguments['message'],
                metadata=arguments.get('metadata')
            )

            return result

        elif name == "read_logs":
            logs = self.storage.read_logs(
                namespace_id=self.namespace_id,
                role_name=arguments.get('role_name'),
                session_id=arguments.get('session_id'),
                limit=arguments.get('limit', 100),
                offset=arguments.get('offset', 0)
            )

            return {
                'success': True,
                'namespace_id': self.namespace_id,
                'logs': logs,
                'count': len(logs)
            }

        elif name == "ask_question":
            # Update activity
            self.storage.update_role_activity(
                namespace_id=self.namespace_id,
                session_id=arguments['from_session_id'],
                role_name=arguments['from_role']
            )

            result = self.storage.ask_question(
                namespace_id=self.namespace_id,
                from_role=arguments['from_role'],
                from_session_id=arguments['from_session_id'],
                to_role=arguments['to_role'],
                question=arguments['question'],
                context=arguments.get('context'),
                priority=arguments.get('priority', 'normal')
            )

            return result

        elif name == "answer_question":
            result = self.storage.answer_question(
                question_id=arguments['question_id'],
                answer=arguments['answer'],
                answering_session_id=arguments['answering_session_id'],
                metadata=arguments.get('metadata')
            )

            return result

        elif name == "get_pending_questions":
            questions = self.storage.get_pending_questions(
                namespace_id=self.namespace_id,
                to_role=arguments['role_name'],
                session_id=arguments.get('session_id'),
                priority_filter=arguments.get('priority_filter'),
                limit=arguments.get('limit', 50)
            )

            return {
                'success': True,
                'namespace_id': self.namespace_id,
                'questions': questions,
                'count': len(questions)
            }

        elif name == "health_check":
            stats = self.storage.get_stats(namespace_id=self.namespace_id)
            return {
                'success': True,
                'status': 'healthy',
                'service': Constants.SERVICE_NAME,
                'version': Constants.SERVICE_VERSION,
                'storage_type': 'SQLite',
                'uptime': time.time(),
                'namespace_id': self.namespace_id,
                'predefined_roles': Constants.PREDEFINED_ROLES,
                'stats': stats
            }

        elif name == "get_namespace_info":
            namespaces = self.storage.list_startup_namespaces(include_inactive=False)
            current = next((ns for ns in namespaces if ns['namespace_id'] == self.namespace_id), None)

            stats = self.storage.get_stats(namespace_id=self.namespace_id)

            return {
                'success': True,
                'current_namespace': current,
                'stats': stats
            }

        elif name == "list_all_namespaces":
            namespaces = self.storage.list_startup_namespaces(
                include_inactive=arguments.get('include_inactive', False)
            )

            return {
                'success': True,
                'namespaces': namespaces,
                'current_namespace_id': self.namespace_id
            }

        elif name == "get_storage_stats":
            global_stats = self.storage.get_stats()
            namespace_stats = self.storage.get_stats(namespace_id=self.namespace_id)

            return {
                'success': True,
                'global': global_stats,
                'current_namespace': namespace_stats
            }

        elif name == "search_logs":
            logs = self.storage.search_logs(
                namespace_id=self.namespace_id,
                keyword=arguments['keyword'],
                role_name=arguments.get('role_name'),
                limit=arguments.get('limit', 50)
            )

            return {
                'success': True,
                'namespace_id': self.namespace_id,
                'logs': logs,
                'count': len(logs)
            }

        elif name == "get_question_history":
            questions = self.storage.get_question_history(
                namespace_id=self.namespace_id,
                role_name=arguments.get('role_name'),
                session_id=arguments.get('session_id'),
                status=arguments.get('status'),
                limit=arguments.get('limit', 100)
            )

            return {
                'success': True,
                'namespace_id': self.namespace_id,
                'questions': questions,
                'count': len(questions)
            }

        else:
            return {
                'success': False,
                'error': f'Unknown tool: {name}'
            }

    async def run(self):
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            print(f"AI Collaboration MCP Server running (SQLite mode)", file=sys.stderr)
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )

    def __del__(self):
        """Cleanup on destruction"""
        if hasattr(self, 'storage'):
            self.storage.close()


def main():
    """Entry point for the MCP server"""
    try:
        server = AICollaborationServer()
        asyncio.run(server.run())
    except KeyboardInterrupt:
        print("\nServer stopped by user", file=sys.stderr)
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
