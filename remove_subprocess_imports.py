import re
import sys

files = """__main__.py
pyfoundations/device/scrcpy_device.py
pyfoundations/secret_manager.py
pyfoundations/system_paths.py
pyfoundations/third_party.py
pyfoundations/third_partyCopy.py
pyutils/adb/adb_manager.py
pyutils/app_launcher.py
pyutils/click_handler.py
pyutils/clipboard/clipboard_manager.py
pyutils/device/adb_manager.py
pyutils/device/scrcpy_device.py
pyutils/device_sync/_legacy/network_cache.py
pyutils/device_sync/check_status.py
pyutils/device_sync/core/logging.py
pyutils/device_sync/daemon.py
pyutils/device_sync/diagnose.py
pyutils/device_sync/logging_config.py
pyutils/device_sync/network_cache.py
pyutils/device_sync/utils/daemon.py
pyutils/device_sync/utils/status.py
pyutils/edge_tts/edge_tts_client.py
pyutils/flutter_dev_tools/api/folder_opener.py
pyutils/flutter_dev_tools/utils/port_manager.py
pyutils/frontend_launcher/nuxt_launcher.py
pyutils/frontend_launcher/output_capturer.py
pyutils/frontend_launcher/universal_launcher.py
pyutils/hotkey_listener.py
pyutils/launcher/device_sync/_legacy/network_cache.py
pyutils/launcher/device_sync/check_status.py
pyutils/launcher/device_sync/core/logging.py
pyutils/launcher/device_sync/daemon.py
pyutils/launcher/device_sync/diagnose.py
pyutils/launcher/device_sync/logging_config.py
pyutils/launcher/device_sync/network_cache.py
pyutils/launcher/device_sync/utils/daemon.py
pyutils/launcher/device_sync/utils/status.py
pyutils/launcher/explorer_executor.py
pyutils/mcp_bridge_with_laravel/cnocr_engine.py
pyutils/mcp_bridge_with_laravel/main.py
pyutils/media_compressor.py
pyutils/native_ui/step2_port_url/server_manager.py
pyutils/native_ui/step9_frontend/frontend_thread.py
pyutils/ocr_cnocr_engine.py
pyutils/paddle_ocr.py
pyutils/process_manager.py
pyutils/pybrowser/utils/browser_finder.py
pyutils/ultralytics/device_manager.py
pyutils/ultralytics/unified_gpu_manager.py
pyutils/ultralytics/unified_trainer.py
pyutils/whisper_stt/audio_utils.py
pyutils/window_ops.py
pyutils/zip_task_queue.py""".strip().split('\n')

base_path = "D:/programing/core_node/pycore"
count = 0

for file_rel in files:
    file_path = f"{base_path}/{file_rel}"
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove "import subprocess" line
        new_content = re.sub(r'^import subprocess\s*\n', '', content, flags=re.MULTILINE)

        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += 1
            print(f"[OK] {file_rel}")
        else:
            print(f"[--] {file_rel} (no change)")
    except Exception as e:
        print(f"[ERR] {file_rel}: {e}")

print(f"\n{count} files updated")
