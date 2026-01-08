# Unified Service Information Display

## Overview

Created unified `print_service_info()` function in `unified_manager_linux.sh` to provide consistent service information display across all service creation options (B, C, P, BP).

## Function Signature

```bash
print_service_info <service_name> <app_name> <port> <domain_list>
```

**Parameters:**
- `service_name`: SystemD service name (e.g., `webapp-appfactory-master-dashboard-build`)
- `app_name`: Application name (e.g., `appfactory-master-dashboard`)
- `port`: Service port number (e.g., `10000`)
- `domain_list`: Space-separated domains for proxy (optional, use `""` if none)

## Output Sections

### 1. Service Registration Status
- ✓ Service is running: [service_name]
- ✗ Service failed to start (with logs command)

### 2. Service Management Commands
```
Start:    sudo systemctl start [service_name]
Stop:     sudo systemctl stop [service_name]
Restart:  sudo systemctl restart [service_name]
Status:   sudo systemctl status [service_name]
Logs:     sudo journalctl -u [service_name] -f
Disable:  sudo systemctl disable [service_name]
```

### 3. Network Access URLs
All available IP addresses for easy copy-paste:
```
📍 Localhost:  http://localhost:[port]
📍 Loopback:   http://127.0.0.1:[port]
📍 Network:    http://[actual_ip]:[port]
```

Uses `hostname -I` to detect all network interfaces automatically.

### 4. Domain Access (if proxy configured)
```
🌐 https://[domain] (if SSL available)
🌐 http://[domain]
```

### 5. Service File Content
Complete service file displayed with indentation for easy reading.

### 6. Service Details
```
App Name: [app_name]
Service Name: [service_name]
Port: [port]
Status: [active/inactive]
```

## Integration Points

### Option B: Build & Create Service
```bash
# In BUILD_SERVICE_CREATE handler
print_service_info "$build_service_name" "$app_name" "$port" ""
```

### Option C: Create Service
```bash
# In SERVICE_CREATE handler
# Determine service_name based on framework_type
case "$framework_type" in
    "reactStart"|"vueStart") service_name="webapp-$app_name" ;;
    "nuxtStart") service_name="nuxt-$app_name" ;;
    "laravelStart") service_name="laravel-$app_name" ;;
    "flutterStart") service_name="flutter-$app_name" ;;
    *) service_name="app-$app_name" ;;
esac

print_service_info "$service_name" "$app_name" "$port" ""
```

### Option P: Create Service with Proxy
```bash
# In PROXY_CREATE handler
# Same service_name determination as Option C
print_service_info "$service_name" "$app_name" "$port" "$domains_string"
```

### Option BP: Build & Create with Proxy
```bash
# In BUILD_PROXY_CREATE handler
local build_service_name="webapp-$app_name$BUILD_SERVICE_SUFFIX"
print_service_info "$build_service_name" "$app_name" "$port" "$domains_string"
```

## Benefits

1. **Consistency**: All service creation options show identical information format
2. **Complete Information**: Users get all necessary details in one place
3. **Easy Access**: All IP addresses displayed for easy copy-paste
4. **Maintainability**: Single function to update instead of 4 separate blocks
5. **Transparency**: Service file content visible for verification
6. **Actionable**: All management commands provided upfront

## Python vs Shell Responsibilities

### Python Layer (unified_core.py)
- Menu display and user interaction
- Application scanning and detection
- Build process execution (BuildManager)
- Service file content generation (ServiceFileGenerator)
- Writing data to global variables

### Shell Layer (unified_manager_linux.sh)
- Reading from global variables
- Writing files to system directories (`/etc/systemd/system/`)
- Executing systemctl commands
- Network information gathering (`hostname -I`)
- **Unified information display (print_service_info)**

## Testing

Test script: `/tmp/test_print_service_info.sh`

Validates output format for all four options (B, C, P, BP) with and without domains.

## Files Modified

- `scripts/unified_manager/unified_manager_linux.sh`
  - Added `print_service_info()` function (lines 81-174)
  - Updated BUILD_SERVICE_CREATE handler (line 379)
  - Updated BUILD_PROXY_CREATE handler (line 641)
  - Updated PROXY_CREATE handler (line 876)
  - Updated SERVICE_CREATE handler (line 339)

## Example Output

```
=== Service Registration Complete ===

✓ Service is running: webapp-appfactory-master-dashboard-build

=== Service Management Commands ===

  Start:    sudo systemctl start webapp-appfactory-master-dashboard-build
  Stop:     sudo systemctl stop webapp-appfactory-master-dashboard-build
  Restart:  sudo systemctl restart webapp-appfactory-master-dashboard-build
  Status:   sudo systemctl status webapp-appfactory-master-dashboard-build
  Logs:     sudo journalctl -u webapp-appfactory-master-dashboard-build -f
  Disable:  sudo systemctl disable webapp-appfactory-master-dashboard-build

=== Network Access URLs ===

  📍 Localhost:  http://localhost:10000
  📍 Loopback:   http://127.0.0.1:10000
  📍 Network:    http://192.168.50.3:10000

=== Service File Content ===

File: /etc/systemd/system/webapp-appfactory-master-dashboard-build.service

  [Unit]
  Description=appfactory-master-dashboard-build (reactStart) - Auto-generated
  After=network.target
  ...

=== Service Details ===

App Name: appfactory-master-dashboard
Service Name: webapp-appfactory-master-dashboard-build
Port: 10000
Status: active
```

---

**Last Updated**: 2025-01-09
**Author**: Claude Code
**Related**: unified_manager_linux.sh, network_utils.sh
