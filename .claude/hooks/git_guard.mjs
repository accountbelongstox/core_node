import fs from "node:fs";
import path from "node:path";

const GUARD_ENV = "CLAUDE_AGENTS_SESSION";
const GIT_GRANT_TTL_MINUTES = 120;
const SHARED_DIR_PARTS = [".claude", "agents_shared"];
const GRANT_FILE_NAME = "git_grant.json";
const REVOKE_PATTERN = /(禁止\s*git|deny-git)/i;
const GRANT_PATTERN = /(允许\s*git|allow-git|(^|[^A-Za-z0-9_.-])(git|gh)([^A-Za-z0-9_-]|$)|提交代码|推送代码|创建分支|合并分支)/i;
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const SEGMENT_SPLIT = /[;&|()`\n]+/;
const TOOL_TOKEN = /^(?:.*[\\/])?(git|gh)(?:\.exe)?$/i;
const GIT_READ_ONLY = new Set([
    "status", "diff", "log", "show", "blame", "annotate", "rev-parse", "rev-list", "ls-files", "ls-tree",
    "ls-remote", "cat-file", "describe", "shortlog", "grep", "merge-base", "name-rev", "whatchanged",
    "show-ref", "show-branch", "for-each-ref", "count-objects", "check-ignore", "check-attr", "var", "help", "version",
]);
const GIT_LIST_FLAGS = {
    branch: new Set(["-a", "-r", "-v", "-vv", "--all", "--remotes", "--list", "-l", "--show-current", "--contains", "--merged", "--no-merged"]),
    tag: new Set(["-l", "--list", "-n", "--contains", "--points-at", "--merged", "--no-merged"]),
    remote: new Set(["-v", "--verbose", "show", "get-url"]),
    stash: new Set(["list", "show"]),
    config: new Set(["--get", "--get-all", "--get-regexp", "--list", "-l", "--show-origin", "--show-scope"]),
    reflog: new Set(["show"]),
    worktree: new Set(["list"]),
    submodule: new Set(["status"]),
};
const GIT_WRITE_FLAGS = [/^--output(=|$)/, /^--ext-diff$/, /^--exec(=|$)/, /^--upload-pack(=|$)/];
const GIT_GLOBAL_WITH_VALUE = new Set(["-C", "--git-dir", "--work-tree", "--namespace"]);
const GH_READ_ONLY = new Set([
    "pr view", "pr list", "pr diff", "pr status", "pr checks", "issue view", "issue list", "issue status",
    "repo view", "run view", "run list", "release view", "release list", "search", "status", "browse", "help", "version",
]);

let payload = {};
let projectDir = "";
let grantPath = "";

function readPayload() {
    try {
        return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    } catch {
        return {};
    }
}

function writeGrant(prompt) {
    fs.mkdirSync(path.dirname(grantPath), { recursive: true });
    fs.writeFileSync(grantPath, JSON.stringify({
        granted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + GIT_GRANT_TTL_MINUTES * 60000).toISOString(),
        session_id: payload.session_id || "",
        prompt_excerpt: String(prompt).slice(0, 200),
    }, null, 2));
}

function grantActive() {
    try {
        const grant = JSON.parse(fs.readFileSync(grantPath, "utf8"));
        return Date.parse(grant.expires_at) > Date.now();
    } catch {
        return false;
    }
}

function tokens(segment) {
    return (segment.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((token) => token.replace(/^["']|["']$/g, ""));
}

function gitArgsReadOnly(args) {
    let index = 0;
    while (index < args.length && args[index].startsWith("-")) {
        if (args[index] === "-c" || args[index].startsWith("--config-env")) {
            return false;
        }
        index += GIT_GLOBAL_WITH_VALUE.has(args[index]) ? 2 : 1;
    }
    const sub = args[index] || "";
    const rest = args.slice(index + 1);
    if (!sub) {
        return true;
    }
    if (rest.some((arg) => GIT_WRITE_FLAGS.some((pattern) => pattern.test(arg)))) {
        return false;
    }
    if (GIT_READ_ONLY.has(sub)) {
        return true;
    }
    if (GIT_LIST_FLAGS[sub]) {
        const listFlags = GIT_LIST_FLAGS[sub];
        const first = rest[0];
        if (sub === "branch" || sub === "tag") {
            return rest.every((arg) => listFlags.has(arg) || (!arg.startsWith("-") && rest.some((flag) => ["--contains", "--points-at", "--merged", "--no-merged", "-l", "--list"].includes(flag))));
        }
        return first === undefined ? sub !== "stash" && sub !== "config" : listFlags.has(first);
    }
    return false;
}

function ghArgsReadOnly(args) {
    const pair = `${args[0] || ""} ${args[1] || ""}`.trim();
    if (args[0] === "api") {
        return !args.some((arg) => /^(-X|--method|-f|-F|--field|--raw-field|--input)$/.test(arg) || /^--method=/.test(arg));
    }
    return GH_READ_ONLY.has(pair) || GH_READ_ONLY.has(args[0] || "");
}

function commandNeedsGrant(command) {
    for (const segment of command.split(SEGMENT_SPLIT)) {
        const words = tokens(segment).filter((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
        const toolIndex = words.findIndex((word) => TOOL_TOKEN.test(word));
        if (toolIndex < 0) {
            continue;
        }
        const tool = TOOL_TOKEN.exec(words[toolIndex])[1].toLowerCase();
        const args = words.slice(toolIndex + 1);
        const readOnly = tool === "git" ? gitArgsReadOnly(args) : ghArgsReadOnly(args);
        if (!readOnly) {
            return true;
        }
    }
    return false;
}

payload = readPayload();
if (process.env[GUARD_ENV] !== "1") {
    process.exit(0);
}
projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
grantPath = path.join(projectDir, ...SHARED_DIR_PARTS, GRANT_FILE_NAME);

if (payload.hook_event_name === "UserPromptSubmit") {
    const prompt = String(payload.prompt || "");
    if (REVOKE_PATTERN.test(prompt)) {
        fs.rmSync(grantPath, { force: true });
    } else if (GRANT_PATTERN.test(prompt)) {
        writeGrant(prompt);
    }
    process.exit(0);
}

if (payload.hook_event_name === "PreToolUse" && SHELL_TOOLS.has(payload.tool_name)) {
    const command = String((payload.tool_input && payload.tool_input.command) || "");
    if (commandNeedsGrant(command) && !grantActive()) {
        process.stderr.write(
            "This git/gh command changes state and needs the user's request. Read-only forms (status, diff, log, show, "
            + "blame, branch/tag/remote listing, gh pr view/list, ...) are always allowed. A user prompt that asks for "
            + "git work grants all git/gh commands for 120 min. Ask the user; do not retry or work around this block.\n",
        );
        process.exit(2);
    }
}
process.exit(0);
