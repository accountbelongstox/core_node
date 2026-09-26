import fs from "node:fs";
import path from "node:path";

const GUARD_ENV = "CLAUDE_AGENTS_GIT_GUARD";
const GIT_GRANT_TTL_MINUTES = 120;
const SHARED_DIR_PARTS = [".claude", "agents_shared"];
const GRANT_FILE_NAME = "git_grant.json";
const GRANT_PATTERN = /(允许\s*git|allow-git)/i;
const REVOKE_PATTERN = /(禁止\s*git|deny-git)/i;
const GIT_COMMAND_PATTERN = /(^|[\s;&|(){}`'"$])(?:[\w.:~\\/-]*[\\/])?(git|gh)(?:\.exe)?(?=$|[\s;&|)}'"`])/i;
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);

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
    if (GIT_COMMAND_PATTERN.test(command) && !grantActive()) {
        process.stderr.write(
            "git/gh is blocked for team roles. Ask the user; the user grants it by including "
            + "'allow-git' (or '允许git') in a prompt. Do not retry or work around this block.\n",
        );
        process.exit(2);
    }
}
process.exit(0);
