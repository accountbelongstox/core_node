---
type: "always_apply"
---

- 1. During any process, task, or conversation, whether asking, responding, or completing stage tasks, must call MCP &quot;mcp-feedback-enhanced&quot;.
- 2. When receiving user feedback, if feedback content is not empty, must call MCP mcp-feedback-enhanced again and adjust behavior based on feedback.
- 3. Only when user explicitly indicates &quot;end&quot; or &quot;no more interaction needed&quot; can you stop calling MCP mcp-feedback-enhanced, then the process is complete.
- 4. Unless receiving end command, all steps must repeatedly call MCP mcp-feedback-enhanced.
- 5. After creating any task list or planning checklist, must get user confirmation of task correctness and completeness through MCP.
- 6. Only after user confirms the task list is correct can specific implementation steps begin.

如果代需要文档，请根据你的需要查阅
- `$PROJECT_ROOT_DIR/DEVELOPMENT_GUIDE_THIS_FILE_NO_AI_EDIT.md`、$PROJECT_ROOT_DIR = 项目根目录。
