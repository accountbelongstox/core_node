import requests
import time
from pycore.practicals_linux import linux
from pycore.globalvers import baseServer
from pycore.base.base import Base

class SafeShutdown(Base):
    def __init__(self):
        super().__init__()
        self.check_net_url = f"http://{baseServer}:3000/net_status"
        self.ups_url = f"http://{baseServer}:3000/ups_status"
        self.shutdown_timeout = 3
        self.power_outage_duration = 0  # Initialize power outage duration counter

    def check_ups_status(self):
        try:
            headers = {'Accept': 'text/plain'}  # Specify text/plain if needed
            response = requests.get(self.ups_url, headers=headers, timeout=self.shutdown_timeout)
            response.raise_for_status()
            text = response.content.decode('utf-8').strip()
            print(f"text: {text}")
            return text
        except Exception as e:
            error_msg = f"Failed to connect to UPS: {e}"
            self.warn(error_msg)
            self.warn_log(error_msg, log_filename="safe_shutdown_log")
            return None

    def check_shutdown(self):
        status = self.check_ups_status()

        if status:
            parts = status.split()
            if len(parts) == 2:
                status_text = parts[0].strip()
                try:
                    battery_percent = int(parts[1].strip())
                    info_msg = f"Status: {status_text}, Battery Percent: {battery_percent}%"
                    self.info(info_msg)
                    self.info_log(info_msg, log_filename="safe_shutdown_log")
                except ValueError:
                    error_msg = f"Invalid battery percentage format: {parts[1].strip()}"
                    self.warn(error_msg)
                    self.warn_log(error_msg, log_filename="safe_shutdown_log")
                    return 30  # Default urgency level

                if status_text == "OFF" or battery_percent < 100:
                    if battery_percent < 80:
                        warn_msg = "Battery percent is critically low. Initiating shutdown process."
                        self.warn(warn_msg)
                        self.warn_log(warn_msg, log_filename="safe_shutdown_log")
                        linux.shutdown_system()
                        return 2
                    elif battery_percent < 90:
                        warn_msg = "Battery percent is low. Preparing to shutdown if necessary."
                        self.warn(warn_msg)
                        self.warn_log(warn_msg, log_filename="safe_shutdown_log")
                        return 5
                    else:
                        info_msg = "Battery percent is moderate. Monitoring situation."
                        self.info(info_msg)
                        self.info_log(info_msg, log_filename="safe_shutdown_log")
                        return 10  # Medium urgency level
                else:
                    success_msg = "UPS is ON. Current network status is normal, no shutdown needed."
                    self.success(success_msg)
                    self.success_log(success_msg, log_filename="safe_shutdown_log")
                    return 30
            else:
                error_msg = f"Unexpected status format: {status}"
                self.warn(error_msg)
                self.warn_log(error_msg, log_filename="safe_shutdown_log")
                return 30  # Default urgency level for unexpected format
        else:
            error_msg = "No status returned from check_ups_status."
            self.warn(error_msg)
            self.warn_log(error_msg, log_filename="safe_shutdown_log")
        return 30  # Default urgency level in case status is empty or None

    def read_log(self, read_mode="text", start_time=None, end_time=None, max_lines=1000):
        return super().read_log(log_filename="safe_shutdown_log", read_mode=read_mode, start_time=start_time, end_time=end_time, max_lines=max_lines)

safe_shutdown = SafeShutdown()
