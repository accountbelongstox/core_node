import os
import sys
from datetime import datetime


class Log:
    def __init__(self, default_log_filename="application"):
        self.default_log_filename = default_log_filename

    def getcwd(self, suffix=""):
        cwd = os.path.dirname(os.path.abspath(__file__))
        if suffix != "":
            cwd = os.path.join(cwd, suffix)
        return cwd

    def get_log_dir(self, cwd=None):
        if not cwd:
            cwd = self.getcwd()
        log_dir = os.path.join(cwd, ".logs")
        os.makedirs(log_dir, exist_ok=True)
        return os.path.abspath(log_dir)

    def write_log(self, log_text, log_type="info", max_total_size_mb=500, log_filename=None, max_file=5, cwd="."):
        try:
            max_size = max_total_size_mb * 1024 * 1024
            log_dir = self.get_log_dir(cwd)
            print("Absolute log_dir:", log_dir)
            log_filename = f"{log_type}_{log_filename or self.default_log_filename}"
            log_obj = self.generate_log_file(log_filename, log_dir, max_size)
            log_filename = log_obj["logfile"]
            if log_obj["logcount"] > max_file:
                self.reduce_logs(log_dir, max_size)
            log_entry = f"[{datetime.utcnow().isoformat()}] [{log_type.upper()}] {log_text}\n"
            with open(log_filename, "a", encoding="utf-8") as log_file:
                log_file.write(log_entry)
            print(f"Log successfully written to {log_filename}")
        except Exception as e:
            print(f"Failed to write log: {e}")

    def count_log_lines(self, log_file, log_dir):
        log_files = self.get_logs(log_file, log_dir)
        total_lines = 0
        for log_file_path in log_files:
            with open(os.path.join(log_dir, log_file_path), "r", encoding="utf-8") as file:
                total_lines += sum(1 for _ in file)
        return total_lines

    def get_logs(self, log_file, log_dir):
        return [file for file in os.listdir(log_dir) if file.startswith(f"{log_file}_") and file.endswith(".log")]

    def get_last_logfile(self, log_file, log_dir):
        log_files = self.get_logs(log_file, log_dir)
        log_count = len(log_files)
        if log_count > 0:
            log_files.sort(key=lambda x: int(x.split('_')[-1].split('.')[0]), reverse=True)
            last_log_file = os.path.join(log_dir, log_files[0])
            last_log_size = os.path.getsize(last_log_file)
            return {"path": last_log_file, "size": last_log_size, "logcount": log_count}
        else:
            return None

    def generate_log_file(self, log_file, log_dir, max_size):
        last_log = self.get_last_logfile(log_file, log_dir)
        log_count = last_log["logcount"] if last_log else 0
        if last_log:
            last_log_file = last_log["path"]
            if last_log["size"] > max_size:
                new_index = int(last_log_file.split('_')[-1].split('.')[0]) + 1
                new_log_file = os.path.join(log_dir, f"{log_file}_{new_index}.log")
                open(new_log_file, "w").close()  # Create an empty log file
                log_file = new_log_file
            else:
                log_file = last_log_file
        else:
            initial_log_file = os.path.join(log_dir, f"{log_file}_1.log")
            open(initial_log_file, "w").close()  # Create an initial log file
            log_file = initial_log_file
        return {"logfile": log_file, "logcount": log_count}

    def reduce_logs(self, log_dir, max_size):
        log_files = [file for file in os.listdir(log_dir) if file.endswith(".log")]
        for log_file in log_files:
            file_path = os.path.join(log_dir, log_file)
            file_size = os.path.getsize(file_path)
            if os.path.isfile(file_path) and file_size > max_size:
                self.trim_log_file(file_path)

    def trim_log_file(self, file_path):
        output_file_path = f"{file_path}_trimmed.log"
        with open(file_path, "r", encoding="utf-8") as read_stream, open(output_file_path, "w",
                                                                         encoding="utf-8") as write_stream:
            lines = read_stream.readlines()
            half_index = len(lines) // 2
            second_half = "".join(lines[half_index:])
            write_stream.write(second_half)
        os.remove(file_path)
        os.rename(output_file_path, file_path)
        print(f"Trimmed {file_path}. Kept the second half of lines.")

    def should_print(self):
        # This method should return whether to print the logs or not
        return True

    def _print_formatted(self, color, msg):
        print(f"{color}{msg}\033[0m")

    def easy_log(self, msg, log_type, log_filename=None):
        self.write_log(msg, log_type=log_type, log_filename=log_filename or self.default_log_filename)

    def info_log(self, *args, log_filename=None):
        blue_color = '\033[94m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(blue_color, msg)
            self.easy_log(msg, "info", log_filename)

    def success_log(self, *args, log_filename=None):
        green_color = '\033[92m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(green_color, msg)
            self.easy_log(msg, "success", log_filename)

    def warn_log(self, *args, log_filename=None):
        yellow_color = '\033[93m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(yellow_color, msg)
            self.easy_log(msg, "warn", log_filename)

    def error_log(self, *args, log_filename=None):
        red_color = '\033[91m'
        show = self.should_print()
        for msg in args:
            self._print_formatted(red_color, msg)
            self.easy_log(msg, "error", log_filename)

    def read_log(self, log_filename=None, read_mode="text", start_time=None, end_time=None, max_lines=1000):
        log_filename = log_filename or self.default_log_filename
        log_dir = self.get_log_dir()

        log_files = self.get_logs(log_filename, log_dir)
        if not log_files:
            return "" if read_mode == "text" else []

        if start_time:
            start_time = datetime.fromisoformat(start_time)
        if end_time:
            end_time = datetime.fromisoformat(end_time)

        logs = []
        for log_file in sorted(log_files, key=lambda x: int(x.split('_')[-1].split('.')[0])):
            log_file_path = os.path.join(log_dir, log_file)
            with open(log_file_path, "r", encoding="utf-8") as file:
                for line in file:
                    timestamp = line.split('] [')[0].strip('[')
                    log_time = datetime.fromisoformat(timestamp)
                    if ((not start_time or log_time >= start_time) and
                            (not end_time or log_time <= end_time)):
                        logs.append(line)
                    if len(logs) > max_lines:
                        logs = logs[-max_lines:]

        return "".join(logs) if read_mode == "text" else logs

log = Log()