#!/usr/bin/env python3
"""
RustDesk OSS Dashboard: web UI to view client IDs. Password-protected.
Config and cache under /var/_core_node/rustdesk_dashboard/.
"""
import hashlib
import json
import os
import secrets
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DATA_ROOT = "/var/_core_node/rustdesk_dashboard"
CONFIG_PATH = os.path.join(DATA_ROOT, "config.json")
CACHE_DIR = os.path.join(DATA_ROOT, "cache")
CACHE_PATH = os.path.join(CACHE_DIR, "client_ids.json")
SESSIONS_PATH = os.path.join(DATA_ROOT, "sessions.json")
DEFAULT_PORT = 21120
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LIST_CLIENTS_SCRIPT = os.path.normpath(os.path.join(SCRIPT_DIR, "../../debian/server_manager/rustdesk_list_clients.sh"))
RUSTDESK_SERVER_CONFIG = "/var/_core_node/rustdesk_server/server.conf"
RUSTDESK_SERVER_KEY_BACKUP = "/var/_core_node/rustdesk_server/id_ed25519.pub"

sessions = {}
config = {}
server_port = DEFAULT_PORT


def ensure_data_dir():
    os.makedirs(DATA_ROOT, mode=0o755, exist_ok=True)
    os.makedirs(CACHE_DIR, mode=0o755, exist_ok=True)


def load_config():
    global config
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
        except (json.JSONDecodeError, OSError):
            config = {}
    else:
        config = {}
    if "password_hash" not in config:
        salt = secrets.token_hex(16)
        default_pwd = "rustdesk"
        config = {"salt": salt, "password_hash": hash_password(default_pwd, salt), "port": DEFAULT_PORT}
        save_config()
    return config


def save_config():
    ensure_data_dir()
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_PATH, 0o600)


def hash_password(password, salt):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def verify_password(password):
    s = config.get("salt", "")
    h = config.get("password_hash", "")
    return h and h == hash_password(password, s)


def load_sessions():
    global sessions
    if os.path.isfile(SESSIONS_PATH):
        try:
            with open(SESSIONS_PATH, "r", encoding="utf-8") as f:
                sessions = json.load(f)
        except (json.JSONDecodeError, OSError):
            sessions = {}
    else:
        sessions = {}


def save_sessions():
    ensure_data_dir()
    try:
        with open(SESSIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(sessions, f)
        os.chmod(SESSIONS_PATH, 0o600)
    except OSError:
        pass


def get_session_token(headers):
    cookie = headers.get("Cookie") or ""
    for part in cookie.split(";"):
        part = part.strip()
        if part.startswith("session="):
            return part.split("=", 1)[1].strip()
    return None


def is_authenticated(headers):
    token = get_session_token(headers)
    return token and token in sessions


def run_list_clients():
    if not os.path.isfile(LIST_CLIENTS_SCRIPT):
        return []
    try:
        out = subprocess.run(
            ["bash", LIST_CLIENTS_SCRIPT, "--since", "30 days ago"],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(LIST_CLIENTS_SCRIPT),
        )
        if out.returncode == 0 and out.stdout:
            ids = [x.strip() for x in out.stdout.strip().splitlines() if x.strip().isdigit()]
            return sorted(set(ids), key=int)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return []


def load_server_config():
    """Read RustDesk server config from 128 script saved file. Returns dict or empty dict."""
    out = {}
    if not os.path.isfile(RUSTDESK_SERVER_CONFIG):
        return out
    try:
        with open(RUSTDESK_SERVER_CONFIG, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    out[k.strip()] = v.strip()
    except (OSError, PermissionError):
        return out
    if out.get("PUBLIC_KEY"):
        return out
    if os.path.isfile(RUSTDESK_SERVER_KEY_BACKUP):
        try:
            with open(RUSTDESK_SERVER_KEY_BACKUP, "r", encoding="utf-8") as f:
                out["PUBLIC_KEY"] = f.read().strip()
        except (OSError, PermissionError):
            pass
    data_dir = out.get("DATA_DIR", "")
    if not out.get("PUBLIC_KEY") and data_dir:
        key_path = os.path.join(data_dir, "id_ed25519.pub")
        if os.path.isfile(key_path):
            try:
                with open(key_path, "r", encoding="utf-8") as f:
                    out["PUBLIC_KEY"] = f.read().strip()
            except (OSError, PermissionError):
                pass
    return out


def get_service_status():
    """Return hbbs/hbbr systemd status. Runs systemctl is-active (no sudo if caller is root)."""
    result = {"hbbs": "unknown", "hbbr": "unknown"}
    for unit in ("rustdesk-hbbs", "rustdesk-hbbr"):
        key = "hbbr" if unit == "rustdesk-hbbr" else "hbbs"
        try:
            out = subprocess.run(
                ["systemctl", "is-active", unit],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if out.returncode == 0 and out.stdout:
                result[key] = out.stdout.strip() or "unknown"
            else:
                result[key] = "inactive"
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            result[key] = "unknown"
    return result


def get_server_info():
    """Build server_info for client config and availability. Matches official: ID Server = hbbs host, Relay = hbbr (21117), Key."""
    cfg = load_server_config()
    status = get_service_status()
    public_ip = cfg.get("PUBLIC_IP", "")
    local_ips = (cfg.get("LOCAL_IPS") or "").strip()
    key = (cfg.get("PUBLIC_KEY") or "").strip()
    hbbs_port = cfg.get("HBBS_PORT", "21115")
    hbbs_nat_port = cfg.get("HBBS_NAT_PORT", "21116")
    hbbr_port = cfg.get("HBBR_PORT", "21117")
    relay_port = cfg.get("RELAY_PORT", "21119")
    server_version = cfg.get("SERVER_VERSION", "")

    id_server = public_ip or (local_ips.split(",")[0].strip() if local_ips else "")
    relay_server = (public_ip or "") if public_ip else ""
    if relay_server:
        relay_server = "%s:%s" % (relay_server, hbbr_port)

    client_config = {
        "id_server": id_server,
        "relay_server": relay_server,
        "api_server": "",
        "key": key,
        "public_ip": public_ip,
        "local_ips": [x.strip() for x in local_ips.split(",") if x.strip()] if local_ips else [],
        "ports": {
            "hbbs": hbbs_port,
            "hbbs_nat": hbbs_nat_port,
            "hbbr": hbbr_port,
            "relay": relay_port,
        },
        "server_version": server_version,
    }

    hbbs_ok = status.get("hbbs") == "active"
    hbbr_ok = status.get("hbbr") == "active"
    if hbbs_ok and hbbr_ok:
        availability = "ok"
    elif hbbs_ok or hbbr_ok:
        availability = "degraded"
    else:
        availability = "unavailable"

    server_status = {
        "hbbs": status.get("hbbs", "unknown"),
        "hbbr": status.get("hbbr", "unknown"),
        "availability": availability,
    }

    return {
        "client_config": client_config,
        "server_status": server_status,
        "availability": availability,
    }
    if not os.path.isfile(LIST_CLIENTS_SCRIPT):
        return []
    try:
        out = subprocess.run(
            ["bash", LIST_CLIENTS_SCRIPT, "--since", "30 days ago"],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(LIST_CLIENTS_SCRIPT),
        )
        if out.returncode == 0 and out.stdout:
            ids = [x.strip() for x in out.stdout.strip().splitlines() if x.strip().isdigit()]
            return sorted(set(ids), key=int)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return []


def get_client_ids(force_refresh=False):
    if not force_refresh and os.path.isfile(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("ids", []), data.get("updated", "")
        except (json.JSONDecodeError, OSError):
            pass
    ids = run_list_clients()
    updated = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    ensure_data_dir()
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump({"ids": ids, "updated": updated}, f)
    except OSError:
        pass
    return ids, updated


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, path, status=200):
        full = os.path.normpath(os.path.join(SCRIPT_DIR, "templates", path))
        if not full.startswith(os.path.join(SCRIPT_DIR, "templates")):
            self.send_error(404)
            return
        if not os.path.isfile(full):
            self.send_error(404)
            return
        with open(full, "r", encoding="utf-8") as f:
            body = f.read().encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_static(self, path):
        full = os.path.normpath(os.path.join(SCRIPT_DIR, "static", path))
        if not full.startswith(os.path.join(SCRIPT_DIR, "static")) or not os.path.isfile(full):
            self.send_error(404)
            return
        ext = os.path.splitext(path)[1].lower()
        ctype = {"": "application/octet-stream", ".css": "text/css", ".js": "application/javascript"}.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path.startswith("/static/"):
            self.send_static(path[len("/static/"):])
            return

        if path == "/api/client_ids":
            if not is_authenticated(self.headers):
                self.send_json({"error": "unauthorized"}, 401)
                return
            force = "refresh" in query
            ids, updated = get_client_ids(force_refresh=force)
            self.send_json({"ids": ids, "updated": updated})
            return

        if path == "/api/server_info":
            if not is_authenticated(self.headers):
                self.send_json({"error": "unauthorized"}, 401)
                return
            try:
                info = get_server_info()
                self.send_json(info)
            except Exception:
                self.send_json({"client_config": {}, "server_status": {"hbbs": "unknown", "hbbr": "unknown", "availability": "unavailable"}, "availability": "unavailable"}, 200)
            return

        if path == "/" or path == "/index.html":
            if not is_authenticated(self.headers):
                self.send_html("login.html")
                return
            self.send_html("index.html")
            return

        self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/login":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                data = json.loads(raw) if raw else {}
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "bad request"}, 400)
                return
            pwd = data.get("password") or ""
            if not verify_password(pwd):
                self.send_json({"error": "invalid password"})
                return
            token = secrets.token_urlsafe(32)
            sessions[token] = True
            save_sessions()
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", "session=%s; Path=/; HttpOnly; SameSite=Strict" % token)
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/logout":
            token = get_session_token(self.headers)
            if token and token in sessions:
                del sessions[token]
                save_sessions()
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Set-Cookie", "session=; Path=/; HttpOnly; Max-Age=0")
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/change_password":
            if not is_authenticated(self.headers):
                self.send_json({"error": "unauthorized"}, 401)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                data = json.loads(raw) if raw else {}
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "bad request"}, 400)
                return
            cur = data.get("current_password") or ""
            new1 = data.get("new_password") or ""
            if not verify_password(cur):
                self.send_json({"error": "current password wrong"})
                return
            if len(new1) < 4:
                self.send_json({"error": "new password too short"})
                return
            salt = config.get("salt", secrets.token_hex(16))
            config["salt"] = salt
            config["password_hash"] = hash_password(new1, salt)
            save_config()
            self.send_json({"ok": True})
            return

        self.send_error(404)


def main():
    global server_port
    ensure_data_dir()
    load_config()
    load_sessions()
    server_port = int(config.get("port", DEFAULT_PORT))
    host = "0.0.0.0"
    server = HTTPServer((host, server_port), Handler)
    sys.stderr.write("RustDesk dashboard listening on %s:%d (data: %s)\n" % (host, server_port, DATA_ROOT))
    server.serve_forever()


if __name__ == "__main__":
    main()
