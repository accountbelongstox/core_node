import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Blocks only version rollback (history rewind, old-version restore, forced
// ref moves, forced pushes); every other git/gh command runs freely.
const GUARD_ENV = "CLAUDE_AGENTS_SESSION";
const ROLLBACK_GRANT_TTL_MINUTES = 120;
const GRANT_DIR_NAME = "core_node_claude_git_guard";
const GRANT_KEY_LENGTH = 16;
const REVOKE_PATTERN = /(禁止\s*回退|deny-rollback)/i;
const GRANT_PATTERN = /(允许\s*回退|allow-rollback)/i;
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const SEGMENT_SPLIT = /[;&|()`\n]+/;
const GIT_TOKEN = /^(?:.*[\\/])?git(?:\.exe)?$/i;
const GIT_GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"]);
const COMMITISH_NAMES = new Set(["ORIG_HEAD", "FETCH_HEAD", "MERGE_HEAD"]);
const FORCE_PUSH_FLAGS = /^(-f|--force|--force-with-lease(=.*)?|--force-if-includes)$/;

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
        expires_at: new Date(Date.now() + ROLLBACK_GRANT_TTL_MINUTES * 60000).toISOString(),
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

// A commit reference that points at a specific (possibly older) version,
// as opposed to a branch name or a path.
function isCommitish(value) {
    return /^[0-9a-f]{7,40}$/i.test(value) || /[~^]/.test(value) || value.includes("@{") || COMMITISH_NAMES.has(value);
}

// Subcommand plus its arguments after git's global options.
function gitSubcommand(args) {
    let index = 0;
    while (index < args.length && args[index].startsWith("-")) {
        index += GIT_GLOBAL_WITH_VALUE.has(args[index]) ? 2 : 1;
    }
    return { sub: args[index] || "", rest: args.slice(index + 1) };
}

function isRollback(sub, rest) {
    const positional = rest.filter((arg) => !arg.startsWith("-"));
    const separator = rest.indexOf("--");
    const beforeSeparator = separator >= 0 ? rest.slice(0, separator) : rest;
    switch (sub) {
        case "reset":
            return rest.includes("--hard") || positional.some(isCommitish);
        case "revert":
        case "update-ref":
            return true;
        case "checkout":
            return beforeSeparator.filter((arg) => !arg.startsWith("-")).some(isCommitish) || rest.includes("--detach");
        case "switch":
            return rest.includes("--detach") || rest.includes("-d") || positional.some(isCommitish);
        case "restore":
            return rest.some((arg) => /^(--source=|-s)(?!$)/.test(arg) && !/^(--source=|-s)HEAD$/.test(arg))
                || rest.some((arg, i) => (arg === "--source" || arg === "-s") && rest[i + 1] && rest[i + 1] !== "HEAD");
        case "push":
            return rest.some((arg) => FORCE_PUSH_FLAGS.test(arg)) || positional.some((arg) => arg.startsWith("+"));
        case "branch":
            return rest.some((arg) => arg === "-f" || arg === "--force" || arg === "-C");
        default:
            return false;
    }
}

function commandIsRollback(command) {
    for (const segment of command.split(SEGMENT_SPLIT)) {
        const words = tokens(segment).filter((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
        const toolIndex = words.findIndex((word) => GIT_TOKEN.test(word));
        if (toolIndex < 0) {
            continue;
        }
        const { sub, rest } = gitSubcommand(words.slice(toolIndex + 1));
        if (isRollback(sub, rest)) {
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
grantPath = path.join(
    os.tmpdir(),
    GRANT_DIR_NAME,
    `${crypto.createHash("sha256").update(path.resolve(projectDir)).digest("hex").slice(0, GRANT_KEY_LENGTH)}.json`,
);

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
    if (commandIsRollback(command) && !grantActive()) {
        process.stderr.write(
            "This git command rolls back a version (reset --hard / reset <commit>, revert, checkout or restore of an "
            + "older commit, forced push or ref move). Every other git/gh command is allowed. A user prompt containing "
            + "'允许回退' or 'allow-rollback' grants rollback for 120 min. Ask the user; do not retry or work around this block.\n",
        );
        process.exit(2);
    }
}
process.exit(0);
