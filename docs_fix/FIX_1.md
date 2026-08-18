1：修正qwen的BUG，并查看qwen和pycore pycore UI中的 Agent History 和任务中心的构架及逻辑一致对齐。
[tts +0.49s] stopped foreign qwen3tts server (pid=29580) on port 57210
[qwen3tts +0.01s] synth failed: [WinError 10054] An existing connection was forcibly closed by the remote host
[qwen3tts +0.69s] batch synth failed: [WinError 10061] No connection could be made because the target machine actively refused it

2：Agent History ，pycore ui / pycore 查看类库的问题，以及RPC V2 为什么会卡住，提取本地文件这种应该是立即 响应。找出系统 BUG。
Gemini: sources found but no prompts parsed
Claude Code: RPC timeout after 30000ms: ui.agent_history.test_extract
Agent: RPC timeout after 30000ms: ui.agent_history.test_extract
Kimi: RPC timeout after 30000ms: ui.agent_history.test_extract