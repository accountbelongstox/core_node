import re

files_need_subprocess = """pyfoundations/device/scrcpy_device.py
pyutils/device/adb_manager.py
pyutils/device/scrcpy_device.py
pyutils/flutter_dev_tools/api/folder_opener.py
pyutils/frontend_launcher/nuxt_launcher.py
pyutils/frontend_launcher/output_capturer.py
pyutils/frontend_launcher/universal_launcher.py
pyutils/launcher/device_sync/utils/daemon.py
pyutils/launcher/explorer_executor.py
pyutils/launcher/launcher.py
pyutils/mcp_bridge_with_laravel/main.py
pyutils/media_compressor.py
pyutils/native_ui/step2_port_url/server_manager.py
pyutils/native_ui/step9_frontend/frontend_thread.py
pyutils/ocr_cnocr_engine.py
pyutils/paddle_ocr.py
pyutils/ultralytics/unified_trainer.py
pyutils/web/universal_gui_launcher.py
pyutils/window_ops.py
pyutils/zip_task_queue.py""".strip().split('\n')

base_path = "D:/programing/core_node/pycore"
count = 0

for file_rel in files_need_subprocess:
    file_path = f"{base_path}/{file_rel}"
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if subprocess import already exists
        if re.search(r'^import subprocess\s*$', content, re.MULTILINE):
            print(f"[SKIP] {file_rel} (already has import)")
            continue

        # Check if file uses subprocess.Popen or subprocess.PIPE/STDOUT
        if not re.search(r'subprocess\.(Popen|PIPE|STDOUT|DEVNULL)', content):
            print(f"[SKIP] {file_rel} (no subprocess usage)")
            continue

        # Find where to insert import - after other imports but before code
        lines = content.split('\n')
        insert_pos = 0

        # Find the last import line
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                insert_pos = i + 1
            elif insert_pos > 0 and line and not line.startswith('#'):
                # Found first non-import, non-comment line
                break

        # Insert subprocess import
        lines.insert(insert_pos, 'import subprocess')
        new_content = '\n'.join(lines)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        count += 1
        print(f"[OK] {file_rel}")
    except Exception as e:
        print(f"[ERR] {file_rel}: {e}")

print(f"\n{count} files updated")
