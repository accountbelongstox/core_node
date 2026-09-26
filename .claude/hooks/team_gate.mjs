import fs from "node:fs";
import path from "node:path";

const SESSION_ENV = "CLAUDE_AGENTS_SESSION";
const CATALOG_PARTS = ["config", "claude_team_roles.json"];
const SHARED_DIR_PARTS = [".claude", "agents_shared"];
const REVIEWS_DIR = "reviews";
const REPORTS_DIR = "reports";
const GATE_STATE_FILE = ".team_gate_state.json";
const REVIEW_EXEMPT_ROLES = new Set(["orchestrator", "reviewer"]);
const APPROVED_VERDICT = "approved";
const REPORT_MAX_AGE_MINUTES = 30;
const IDLE_BLOCK_LIMIT = 2;
const TASK_TAG_PATTERN = /^\[([a-z0-9-]+)\]\s+\S/;

let payload = {};
let projectDir = "";
let sharedDir = "";

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

function roleIds() {
    const catalog = readJson(path.join(projectDir, ...CATALOG_PARTS), { roles: [] });
    return (catalog.roles || []).filter((role) => role.enabled !== false).map((role) => role.name);
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

function onTaskCompleted() {
    const role = taskRole(payload.task_subject);
    const completer = String(payload.teammate_name || "");
    const verdictPath = path.join(sharedDir, REVIEWS_DIR, `${payload.task_id}.json`);
    const verdict = readJson(verdictPath, null);
    if (REVIEW_EXEMPT_ROLES.has(role) || REVIEW_EXEMPT_ROLES.has(completer)) {
        return;
    }
    if (verdict && verdict.verdict === APPROVED_VERDICT) {
        return;
    }
    const notes = verdict && verdict.notes ? ` Reviewer notes: ${verdict.notes}` : "";
    block(`Task ${payload.task_id} "${payload.task_subject}" needs reviewer approval before it can be completed. `
        + `Leave it in progress and message the reviewer with the changed files; the reviewer writes `
        + `${verdictPath} as {"verdict": "approved"|"changes_requested", "notes": "..."}.${notes}`);
}

function onTeammateIdle() {
    const teammate = String(payload.teammate_name || "");
    const reportPath = path.join(sharedDir, REPORTS_DIR, `${teammate}.md`);
    const statePath = path.join(sharedDir, GATE_STATE_FILE);
    const state = readJson(statePath, {});
    const idleBlocks = state[teammate] || 0;
    let reportFresh = false;
    try {
        reportFresh = (Date.now() - fs.statSync(reportPath).mtimeMs) <= REPORT_MAX_AGE_MINUTES * 60000;
    } catch {
        reportFresh = false;
    }
    if (reportFresh || idleBlocks >= IDLE_BLOCK_LIMIT || !teammate) {
        state[teammate] = 0;
        fs.mkdirSync(sharedDir, { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        return;
    }
    state[teammate] = idleBlocks + 1;
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    block(`Before going idle, write your handoff report to ${reportPath}: task ids, changed files, `
        + `status, blockers, and who must act next. Other roles read it instead of your transcript.`);
}

payload = readJson(0, {});
if (process.env[SESSION_ENV] !== "1") {
    process.exit(0);
}
projectDir = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
sharedDir = path.join(projectDir, ...SHARED_DIR_PARTS);

if (payload.hook_event_name === "TaskCreated") {
    onTaskCreated();
} else if (payload.hook_event_name === "TaskCompleted") {
    onTaskCompleted();
} else if (payload.hook_event_name === "TeammateIdle") {
    onTeammateIdle();
}
process.exit(0);
