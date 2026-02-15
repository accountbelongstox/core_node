# Laravel Octane Low-Privilege Reload

## Current Situation

### Environment
- **Octane run user**: root (systemd service)
- **Dev user**: ubuntu
- **Issue**: Cannot reload Octane to pick up code changes after editing

### What Does Not Work
```bash
# ❌ Method 1: artisan reload - insufficient permission
php artisan octane:reload
# Error: Operation not permitted

# ❌ Method 2: systemctl restart - requires password
sudo systemctl restart ncore-laravel_main
# Error: sudo requires password

# ❌ Method 3: kill process - insufficient permission
kill -TERM 2228379
# Error: Operation not permitted
```

---

## Solutions

### Option 1: Sudo NOPASSWD (Recommended) ⭐

**Setup**:
```bash
# 1. Create sudoers config
sudo visudo -f /etc/sudoers.d/octane-reload

# 2. Add (allow ubuntu to restart Octane without password)
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl stop ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl start ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl status ncore-laravel_main

# 3. Save and exit (Ctrl+X, Y, Enter)

# 4. Test passwordless restart
sudo systemctl restart ncore-laravel_main
```

**Usage**:
```bash
# Restart Octane
sudo systemctl restart ncore-laravel_main

# Or use script
cd /www/programing/core_node/scripts/shells/linux/debian/install_shells
./restart_octane.sh  # No password needed
```

**Pros**:
✅ Secure (only specific commands allowed)
✅ Simple (configure once, works forever)
✅ Standard practice (Linux best practice)

---

### Option 2: Signal File Trigger

**Idea**: A watcher service restarts Octane when a signal file appears.

**Steps**:

1. **Watcher script**:
```bash
# /var/_core_node/scripts/octane-watcher.sh
#!/bin/bash

SIGNAL_FILE="/tmp/octane-reload.signal"
CHECK_INTERVAL=1

while true; do
    if [ -f "$SIGNAL_FILE" ]; then
        echo "[$(date)] Reload signal detected, restarting Octane..."
        rm -f "$SIGNAL_FILE"
        systemctl restart ncore-laravel_main
        echo "[$(date)] Octane restarted"
    fi
    sleep $CHECK_INTERVAL
done
```

2. **systemd service**:
```ini
# /etc/systemd/system/octane-watcher.service
[Unit]
Description=Octane Reload Watcher
After=network.target

[Service]
Type=simple
User=root
ExecStart=/var/_core_node/scripts/octane-watcher.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

3. **Enable service**:
```bash
sudo chmod +x /var/_core_node/scripts/octane-watcher.sh
sudo systemctl daemon-reload
sudo systemctl enable octane-watcher
sudo systemctl start octane-watcher
```

4. **Usage** (no sudo):
```bash
# Trigger reload
touch /tmp/octane-reload.signal

# Wait ~1s; Octane restarts automatically
```

**Pros**:
✅ No sudo needed
✅ Can hook into IDE/editor save
✅ Automation-friendly

**Cons**:
⚠️ Extra background service
⚠️ ~1s delay

---

### Option 3: HTTP API Trigger

**Idea**: A protected API endpoint triggers reload via HTTP.

**Steps**:

1. **Controller**:
```php
// app/Http/Controllers/Admin/OctaneController.php
namespace App\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class OctaneController extends Controller
{
    public function reload(Request $request): JsonResponse
    {
        $apiKey = $request->header('X-Reload-Key');
        if ($apiKey !== env('OCTANE_RELOAD_KEY')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        file_put_contents('/tmp/octane-reload.signal', time());

        return response()->json([
            'success' => true,
            'message' => 'Reload signal sent'
        ]);
    }
}
```

2. **Route**:
```php
// routes/api.php
Route::post('/admin/octane/reload', [OctaneController::class, 'reload']);
```

3. **API key**:
```bash
# .env
OCTANE_RELOAD_KEY=your-secret-key-here
```

4. **Usage**:
```bash
curl -X POST http://localhost:9000/api/admin/octane/reload \
  -H "X-Reload-Key: your-secret-key-here"
```

**Pros**:
✅ Remote trigger
✅ CI/CD integration
✅ Auth protected

**Cons**:
⚠️ Needs Option 2 watcher
⚠️ API key to manage

---

### Option 4: Run Octane as ubuntu User

**Idea**: Run Octane as ubuntu so `php artisan octane:reload` works directly.

**Steps**:

1. **Edit systemd service**:
```bash
sudo vim /etc/systemd/system/ncore-laravel_main.service

# Change User=root to:
User=ubuntu
Group=ubuntu
```

2. **Fix directory ownership**:
```bash
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/storage
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main/bootstrap/cache
```

3. **Restart service**:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ncore-laravel_main
```

4. **Usage** (no sudo):
```bash
cd /www/programing/core_node/poly_apps/laravel_main
php artisan octane:reload  # Works directly
```

**Pros**:
✅ Easiest to use
✅ Least privilege
✅ Best dev experience

**Cons**:
⚠️ May lack permission for some system resources
⚠️ Must set file permissions correctly

---

## Comparison

| Option              | Complexity | Security | Ease of use | Use case                |
|---------------------|-----------|----------|-------------|--------------------------|
| **Option 1: sudo**  | ⭐ Low     | ⭐⭐⭐ High | ⭐⭐⭐ High    | **Prod/Dev** ✅ Recommended |
| Option 2: signal    | ⭐⭐ Medium | ⭐⭐ Medium | ⭐⭐⭐ High    | Automated deploy         |
| Option 3: HTTP API | ⭐⭐⭐ High  | ⭐⭐ Medium | ⭐⭐ Medium   | Remote / CI/CD           |
| Option 4: ubuntu user | ⭐ Low   | ⭐⭐ Medium | ⭐⭐⭐⭐ Highest | **Dev only** ✅ Recommended |

---

## Quick Setup

### Dev (Option 4)

```bash
# 1. Stop service
sudo systemctl stop ncore-laravel_main

# 2. Change service user
sudo sed -i 's/User=root/User=ubuntu/' /etc/systemd/system/ncore-laravel_main.service
sudo sed -i '/User=ubuntu/a Group=ubuntu' /etc/systemd/system/ncore-laravel_main.service

# 3. Fix ownership
sudo chown -R ubuntu:ubuntu /www/programing/core_node/poly_apps/laravel_main

# 4. Start service
sudo systemctl daemon-reload
sudo systemctl start ncore-laravel_main

# 5. Test (no sudo)
cd /www/programing/core_node/poly_apps/laravel_main
php artisan octane:reload
```

### Prod (Option 1)

```bash
# 1. Sudo NOPASSWD
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main" | \
  sudo tee /etc/sudoers.d/octane-reload

echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main" | \
  sudo tee -a /etc/sudoers.d/octane-reload

sudo chmod 0440 /etc/sudoers.d/octane-reload

# 2. Test
sudo systemctl restart ncore-laravel_main
```

---

## One-Off Fix (Option 1)

```bash
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl stop ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl start ncore-laravel_main
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl status ncore-laravel_main" | \
sudo tee /etc/sudoers.d/octane-reload

sudo chmod 0440 /etc/sudoers.d/octane-reload

sudo systemctl restart ncore-laravel_main
```

**Verify**:
```bash
sleep 5
curl http://192.168.50.3:9000/api/servermanager/v1/ssl/certificates
# Expect 200 JSON, not 500 HTML
```

---

**Created**: 2025-12-18 19:35  
**Recommendation**: Option 1 (sudo) or Option 4 (change user)  
**Status**: Pending
