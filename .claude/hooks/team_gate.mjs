import fs from "node:fs";
import path from "node:path";

const SESSION_ENV = "CLAUDE_AGENTS_SESSION";
const CATALOG_PARTS = ["config", "claude_team_roles.json"];
const DEFAULT_AGENTS_DIR = ".claude/agents";
const AGENT_FILE_EXTENSION = ".md";
const FRONTMATTER_FENCE = "---";
const FRONTMATTER_NAME_KEY = "name";
const TASK_TAG_PATTERN = /^\[([a-z0-9-]+)\]\s+\S/;

let payload = {};
let projectDir = "";

function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return fallback;
    }
}

function block(message) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
}

function frontmatterName(filePath) {
    let lines = [];
    try {
        lines = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    } catch {
        return "";
    }
    if (lines.length === 0 || lines[0].trim() !== FRONTMATTER_FENCE) {
        return "";
    }
    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === FRONTMATTER_FENCE) {
            break;
        }
        const separator = line.indexOf(":");
        if (separator > 0 && !/^\s/.test(line) && line.slice(0, separator).trim() === FRONTMATTER_NAME_KEY) {
            return line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
        }
    }
    return "";
}

// Valid role tags: the frontmatter names of the agent definitions (the official
// role registry); a catalog row with "enabled": false excludes its role.
function roleIds() {
    const catalog = readJson(path.join(projectDir, ...CATALOG_PARTS), { roles: [] });
    const agentsDir = path.join(projectDir, catalog.agents_dir || DEFAULT_AGENTS_DIR);
    const disabled = new Set((catalog.roles || []).filter((role) => role.enabled === false).map((role) => role.name));
    let files = [];
    try {
        files = fs.readdirSync(agentsDir).filter((file) => file.endsWith(AGENT_FILE_EXTENSION)).sort();
    } catch {
        files = [];
    }
    return [...new Set(files.map((file) => frontmatterName(path.join(agentsDir, file))).filter(Boolean))]
        .filter((name) => !disabled.has(name));
}

function taskRole(subject) {
    const match = TASK_TAG_PATTERN.exec(String(subject || ""));
    return match ? match[1] : "";
}

function onTaskCreated() {
    const roles = roleIds();
    const role = taskRole(payload.task_subject);
    if (!roles.includes(role)) {
        block(`Task subject must start with the owning role tag, e.g. "[pycore] Add delivery outbox". `
            + `Valid roles: ${roles.join(", ")}. One task = one owner role and its write scope.`);
    }
}

payload = readJson(0, {});
if (process.env[SESSION_ENV] !== "1") {
    process.exit(0);
}
projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();

if (payload.hook_event_name === "TaskCreated") {
    onTaskCreated();
}
process.exit(0);
