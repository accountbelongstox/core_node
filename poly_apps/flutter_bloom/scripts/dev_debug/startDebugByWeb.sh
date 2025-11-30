#!/bin/bash

echo "========================================"
echo "Flutter Bloom Web Debug Launcher"
echo "========================================"
echo "[INFO] App: app_qy"
echo "[INFO] Entry File: lib/apps/app_qy/main_app_qy.dart"
echo "[INFO] Debug Port: 10005"
echo "[INFO] Platform: Web"
echo "========================================"
cd "/www/programing/core_node/poly_apps/flutter_bloom" || exit 1
echo "[INFO] Executing: flutter run -d web-server --web-port 10005 --web-hostname 0.0.0.0 -t "lib/apps/app_qy/main_app_qy.dart""
echo "[INFO] Web server will be available at: http://localhost:10005"
echo "[INFO] Press Ctrl+C to stop the debug server"
flutter run -d web-server --web-port 10005 --web-hostname 0.0.0.0 -t "lib/apps/app_qy/main_app_qy.dart"
echo "[INFO] Flutter command completed"