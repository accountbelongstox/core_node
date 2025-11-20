# AI Collaboration MCP Server

Multi-AI collaboration service that enables multiple AI instances to work together through role-based communication, work logging, and Q&A.

## Features

- **Singleton Pattern**: Single instance across all apps/windows
- **Role Management**: 10 predefined roles for AI collaboration
- **Work Logs**: Role-specific namespace logging
- **Q&A System**: Asynchronous question/answer between AIs
- **Data Persistence**: Platform-specific storage with automatic cleanup
- **Storage Management**: 50MB limit with automatic old file removal

## Predefined Roles

1. `frontend_designer` - Frontend development and UI implementation
2. `backend_developer` - Backend services and API development
3. `database_architect` - Database design and optimization
4. `devops_engineer` - Deployment and infrastructure
5. `qa_tester` - Quality assurance and testing
6. `product_manager` - Requirements and planning
7. `ui_ux_designer` - User interface and experience design
8. `security_specialist` - Security analysis and hardening
9. `technical_writer` - Documentation and guides
10. `general_assistant` - General purpose assistance

## Data Storage Locations

- **Windows**: `C:\Users\<username>\.core_node\mcp_server\ai_collaboration`
- **Linux**: `/var/_core_node/mcp_server/ai_collaboration`

## Available Tools

### Role Management

**register_role** - Register AI with a specific role
```json
{
  "session_id": "unique-session-id",
  "role_name": "frontend_designer",
  "ai_name": "Claude Frontend Dev",
  "metadata": {}
}
```

**get_role_list** - Get list of all registered AI roles
```json
{
  "include_inactive": false
}
```

### Work Logging

**write_log** - Write work log to your role's namespace
```json
{
  "session_id": "unique-session-id",
  "role_name": "frontend_designer",
  "message": {
    "action": "created_component",
    "details": "Built responsive header component"
  }
}
```

**read_logs** - Read logs from another AI's namespace
```json
{
  "role_name": "backend_developer",
  "session_id": "optional-session-id",
  "limit": 100,
  "offset": 0
}
```

**search_logs** - Search logs by keyword
```json
{
  "keyword": "authentication",
  "role_name": "backend_developer",
  "limit": 50
}
```

**get_log_summary** - Get summary of all work logs
```json
{}
```

### Q&A System

**ask_question** - Ask question to another AI role
```json
{
  "from_role": "frontend_designer",
  "from_session_id": "unique-session-id",
  "to_role": "backend_developer",
  "question": "What's the API endpoint for user authentication?",
  "priority": "normal",
  "context": {}
}
```

**get_pending_questions** - Get questions for your role
```json
{
  "role_name": "backend_developer",
  "limit": 50
}
```

**answer_question** - Answer a pending question
```json
{
  "question_id": "uuid-of-question",
  "answer": "The auth endpoint is POST /api/v1/auth/login",
  "answering_session_id": "unique-session-id"
}
```

**get_question_history** - Get question history
```json
{
  "role_name": "backend_developer",
  "status": "answered",
  "limit": 100
}
```

**get_qa_statistics** - Get Q&A statistics
```json
{}
```

### System Tools

**health_check** - Check server health
```json
{}
```

**get_storage_stats** - Get storage statistics
```json
{}
```

## Usage Example

### Typical Workflow for Multiple AIs

**AI #1 (Frontend Designer):**
```
1. Register role: frontend_designer
2. Get role list to see other collaborators
3. Write log: "Started building login page UI"
4. Ask question to backend_developer: "What fields are required for login?"
5. Read logs from ui_ux_designer for design guidelines
```

**AI #2 (Backend Developer):**
```
1. Register role: backend_developer
2. Write log: "Created authentication API endpoints"
3. Check pending questions
4. Answer question from frontend_designer
5. Read logs from database_architect for schema info
```

**AI #3 (Database Architect):**
```
1. Register role: database_architect
2. Write log: "Designed user authentication tables"
3. Read logs from backend_developer to understand API needs
4. Ask question to security_specialist about encryption
```

## Configuration

The service is configured through `constants.py`:

- `MAX_QUEUE_LENGTH`: 1000 (max messages per log file)
- `MAX_STORAGE_MB`: 50 (max total storage size)
- `MAX_MESSAGE_AGE_DAYS`: 30 (auto-cleanup age)

## Running the Server

### Standalone
```bash
python main.py
```

### Via MCP Configuration
The server is automatically configured in:
- `mcpWindowsTemplate.json`
- `mcpLinuxTemplate.json`
- `mcpUbuntoDesktopTemplate.json`
- `mcpWSLTemplate.json`

All tools are auto-approved for seamless collaboration.

## Thread Safety

All operations are thread-safe using Python's `threading.Lock`:
- Role registration and updates
- Log writing and reading
- Question asking and answering
- Storage operations

## Automatic Cleanup

The service automatically manages storage:
- Removes old log files when storage exceeds 50MB
- Cleans up answered questions older than 30 days
- Removes inactive roles after 24 hours
- Maintains max 1000 messages per log file

## Architecture

```
AICollaborationServer (Singleton)
├── StorageManager (Atomic file operations)
├── RoleManager (Role registration & tracking)
├── MessageQueue (Work log management)
└── QASystem (Asynchronous Q&A)
```

## Version

Current version: 1.0.0
