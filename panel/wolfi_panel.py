#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import sys
import subprocess
import urllib.parse
import re
import base64

PORT = 4000
PANEL_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(PANEL_DIR, "static")

CONFIG_DIR = "/root/wolfi-core" if os.name != 'nt' else os.path.join(os.path.dirname(PANEL_DIR), "configs")
SERVICE_DIR = "/etc/systemd/system" if os.name != 'nt' else os.path.join(os.path.dirname(PANEL_DIR), "services")
AUTH_FILE = os.path.join(CONFIG_DIR, "panel_auth.json")

os.makedirs(CONFIG_DIR, exist_ok=True)
os.makedirs(SERVICE_DIR, exist_ok=True)

class WolfiAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def check_auth(self):
        if not os.path.exists(AUTH_FILE):
            return True # Auth disabled if file does not exist yet

        try:
            with open(AUTH_FILE, "r") as f:
                auth_data = json.load(f)
                valid_user = auth_data.get("username", "admin")
                valid_pass = auth_data.get("password", "")

            if not valid_pass:
                return True

            auth_header = self.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Basic '):
                return False

            auth_decoded = base64.b64decode(auth_header[6:]).decode('utf-8')
            username, password = auth_decoded.split(':', 1)

            return (username == valid_user and password == valid_pass)
        except Exception:
            return True

    def require_auth(self):
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm="WOLFI Web Panel"')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "error", "message": "Authentication Required"}).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if not self.check_auth():
            return self.require_auth()

        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/status":
            self.handle_get_status()
        elif path == "/api/tunnels":
            self.handle_get_tunnels()
        elif path == "/api/tunnels/logs":
            query = urllib.parse.parse_qs(parsed_url.query)
            service_name = query.get("name", [""])[0]
            self.handle_get_logs(service_name)
        else:
            if path == "/":
                self.path = "/index.html"
            return super().do_GET()

    def do_POST(self):
        if not self.check_auth():
            return self.require_auth()

        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            body = json.loads(post_data) if post_data else {}
        except Exception:
            body = {}

        if path == "/api/tunnels/create":
            self.handle_create_tunnel(body)
        elif path == "/api/tunnels/action":
            self.handle_tunnel_action(body)
        elif path == "/api/auth/change_password":
            self.handle_change_password(body)
        else:
            self.send_error(404, "API Endpoint Not Found")

    def handle_change_password(self, body):
        new_pass = body.get("password")
        if not new_pass:
            self.send_json_response({"status": "error", "message": "Password cannot be empty"}, code=400)
            return

        auth_data = {"username": "admin", "password": new_pass}
        with open(AUTH_FILE, "w") as f:
            json.dump(auth_data, f)

        self.send_json_response({"status": "success", "message": "Password updated successfully"})

    def handle_get_status(self):
        ip_addr = "127.0.0.1"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_addr = s.getsockname()[0]
            s.close()
        except Exception:
            pass

        tunnels_count = len([f for f in os.listdir(CONFIG_DIR) if f.endswith(".toml")])

        data = {
            "status": "success",
            "server_ip": ip_addr,
            "core_version": "v1.0.0 Premium",
            "active_tunnels": tunnels_count,
            "os": os.name,
            "panel_port": PORT,
            "auth_enabled": os.path.exists(AUTH_FILE)
        }
        self.send_json_response(data)

    def handle_get_tunnels(self):
        tunnels = []
        if os.path.exists(CONFIG_DIR):
            for fname in os.listdir(CONFIG_DIR):
                if fname.endswith(".toml"):
                    path = os.path.join(CONFIG_DIR, fname)
                    m = re.match(r"^(iran|kharej)([0-9]+)\.toml$", fname)
                    mode = m.group(1) if m else "unknown"
                    port = m.group(2) if m else "N/A"
                    
                    service_name = f"wolfi-{fname[:-5]}"
                    status = "stopped"
                    if os.name != 'nt':
                        res = subprocess.run(["systemctl", "is-active", f"{service_name}.service"], capture_output=True, text=True)
                        if res.stdout.strip() == "active":
                            status = "running"
                    else:
                        status = "running"

                    transport = "tcp"
                    try:
                        with open(path, 'r') as f:
                            content = f.read()
                            t_match = re.search(r'type\s*=\s*"([^"]+)"', content)
                            if t_match:
                                transport = t_match.group(1)
                    except Exception:
                        pass

                    tunnels.append({
                        "id": fname[:-5],
                        "file": fname,
                        "mode": mode.upper(),
                        "port": port,
                        "transport": transport,
                        "status": status,
                        "service_name": service_name
                    })

        self.send_json_response({"status": "success", "tunnels": tunnels})

    def handle_create_tunnel(self, body):
        mode = body.get("mode", "server")
        transport = body.get("transport", "tcp")
        port = body.get("port", "8443")
        token = body.get("token", "your_token")
        remote_addr = body.get("remote_addr", "")
        forward_ports = body.get("ports_mapping", "443")

        filename = f"{'iran' if mode == 'server' else 'kharej'}{port}.toml"
        filepath = os.path.join(CONFIG_DIR, filename)

        lines = []
        if mode == "server":
            lines.append("[listener]")
            lines.append(f'bind_addr = ":{port}"\n')
        else:
            lines.append("[dialer]")
            lines.append(f'remote_addr = "{remote_addr}"')
            lines.append('dial_timeout = 10')
            lines.append('retry_interval = 3\n')

        lines.append("[transport]")
        lines.append(f'type = "{transport}"')
        lines.append('nodelay = true')
        lines.append('heartbeat_interval = 10')
        lines.append('heartbeat_timeout = 25\n')

        lines.append("[security]")
        lines.append(f'token = "{token}"\n')

        lines.append("[tuning]")
        lines.append('auto_tuning = true')
        lines.append('tuning_profile = "balanced"')
        lines.append('workers = 0\n')

        lines.append("[logging]")
        lines.append('log_level = "info"\n')

        if mode == "server":
            lines.append("[ports]")
            lines.append('mapping = [')
            for p in forward_ports.split(","):
                p_clean = p.strip()
                if p_clean:
                    lines.append(f'    "{p_clean}",')
            lines.append(']\n')

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        service_name = f"wolfi-{'iran' if mode == 'server' else 'kharej'}{port}"
        if os.name != 'nt':
            service_content = f"""[Unit]
Description=WOLFI {'Iran' if mode == 'server' else 'Kharej'} Port {port}
After=network.target

[Service]
Type=simple
User=root
ExecStart=/root/wolfi-core/wolfi_premium -c {filepath}
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
"""
            service_path = f"/etc/systemd/system/{service_name}.service"
            with open(service_path, "w") as f:
                f.write(service_content)

            subprocess.run(["systemctl", "daemon-reload"])
            subprocess.run(["systemctl", "enable", "--now", f"{service_name}.service"])

        self.send_json_response({"status": "success", "message": f"Tunnel {service_name} created successfully!"})

    def handle_tunnel_action(self, body):
        tunnel_id = body.get("id")
        action = body.get("action")

        if not tunnel_id:
            self.send_json_response({"status": "error", "message": "Tunnel ID missing"}, code=400)
            return

        filename = f"{tunnel_id}.toml"
        filepath = os.path.join(CONFIG_DIR, filename)
        service_name = f"wolfi-{tunnel_id}.service"

        if action in ["start", "stop", "restart"]:
            if os.name != 'nt':
                subprocess.run(["systemctl", action, service_name])
            msg = f"Action {action} performed on {service_name}"
        elif action == "delete":
            if os.name != 'nt':
                subprocess.run(["systemctl", "disable", "--now", service_name])
                service_file = f"/etc/systemd/system/{service_name}"
                if os.path.exists(service_file):
                    os.remove(service_file)
                subprocess.run(["systemctl", "daemon-reload"])
            if os.path.exists(filepath):
                os.remove(filepath)
            msg = f"Tunnel {tunnel_id} deleted successfully"
        else:
            msg = "Invalid action"

        self.send_json_response({"status": "success", "message": msg})

    def handle_get_logs(self, service_name):
        logs = []
        if os.name != 'nt' and service_name:
            res = subprocess.run(["journalctl", "-u", f"{service_name}.service", "-n", "50", "--no-pager"], capture_output=True, text=True)
            logs = res.stdout.splitlines()
        else:
            logs = [
                f"[INFO] WOLFI Service {service_name} operational",
                "[INFO] Connection pool established (8 workers)",
                "[INFO] Heartbeat ping ok (10s interval)",
                "[INFO] Traffic encryption active (AES-256-GCM)"
            ]
        self.send_json_response({"status": "success", "logs": logs})

    def send_json_response(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

def run():
    print("==================================================")
    print(f"[+] WOLFI Web Panel Server running on port {PORT}")
    print(f"[+] Access URL: http://localhost:{PORT}")
    print("==================================================")
    with socketserver.TCPServer(("0.0.0.0", PORT), WolfiAPIHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down WOLFI Panel Server.")
            httpd.server_close()

if __name__ == "__main__":
    run()
