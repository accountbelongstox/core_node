import os
import time
import json
import fnmatch
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pycore.base.base import Base
from pycore.practical.openai.task.task_parse import task_parse
from pycore.practical.openai.task.task_waiting_queue import task_waiting_queue

class WatchHandler(FileSystemEventHandler, Base):
    def __init__(self, watch):
        super().__init__()
        self.watch = watch

    def on_modified(self, event):
        if not event.is_directory:
            self.watch.check_file(event.src_path)

    def on_created(self, event):
        self.watch.check_file(event.src_path)
        if event.is_directory:
            self.success(f"Directory created: {event.src_path}")
        else:
            self.success(f"File created: {event.src_path}")

class Watch(Base):
    def __init__(self):
        super().__init__()
        self.file_changes = {}
        self.is_monitoring = False
        self.observer = Observer()
        self.total_files = 0
        self.total_dirs = 0
        self.excluded_files = 0
        self.excluded_dirs = 0
        self.excluded_paths = []
        self.recently_processed_files = set()
        self.file_extensions = set()
        self.monitored_extensions = []

    def load_config(self, config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
        self.ignored_extensions = config.get('ignored_extensions', [])
        self.ignored_directories = config.get('ignored_directories', [])
        self.exclude_patterns = config.get('exclude_patterns', [])
        self.monitored_extensions = config.get('monitored_extensions', [])

    def start(self, project_dirs, config_path='ignore.json', scan_interval_seconds=5, additional_filters=None):
        self.project_dirs = project_dirs
        self.scan_interval_seconds = scan_interval_seconds
        if not os.path.isabs(config_path):
            config_path = os.path.join(os.path.dirname(__file__), config_path)
        self.load_config(config_path)
        if additional_filters:
            self.extend_filters(additional_filters)

        # Initial scan and print exclusions
        self.initial_scan_and_print_exclusions()

        self.is_monitoring = True
        event_handler = WatchHandler(self)
        for project_dir in self.project_dirs:
            task_waiting_queue.init(project_dir)
            self.observer.schedule(event_handler, project_dir, recursive=True)
        self.observer.start()
        try:
            while self.is_monitoring:
                self.print_status()
                time.sleep(self.scan_interval_seconds)
        except KeyboardInterrupt:
            self.stop()
        self.observer.join()

    def initial_scan_and_print_exclusions(self):
        printed_paths = set()
        self.excluded_files = 0
        self.excluded_dirs = 0
        for project_dir in self.project_dirs:
            for root, dirs, files in os.walk(project_dir):
                current_level = root.replace(project_dir, '').count(os.sep)
                for dir in dirs:
                    dir_path = os.path.join(root, dir)
                    if self.should_exclude(dir_path, check_only=True):
                        if dir_path not in printed_paths and current_level < 3:
                            self.excluded_paths.append(dir_path)
                            # self.warn(f"Excluded directory: {dir_path}")
                            printed_paths.add(dir_path)
                            self.excluded_dirs += 1
                for file in files:
                    file_path = os.path.join(root, file)
                    if self.should_exclude(file_path, check_only=True):
                        self.excluded_paths.append(file_path)
                        self.excluded_files += 1
                    else:
                        self.process_file(file_path, project_dir)

    def process_file(self, file_path, project_dir):
        _, extension = os.path.splitext(file_path)
        if extension:
            self.file_extensions.add(extension)

        try:
            file_content = self.read_text(file_path)
            if task_parse.check_from_content(file_content):
                file_info = {
                    "filepath": file_path,
                    "project_dir": project_dir,
                    "filedir": os.path.dirname(file_path),
                    "filename": os.path.basename(file_path),
                    "filecontent": file_content,
                    "last_modified": time.ctime(os.path.getmtime(file_path))
                }
                task_waiting_queue.add_file_to_queue(file_info)
                self.success(f"File matched pattern: {file_path}")
            else:
                self.info(f"File skipped (no pattern match): {file_path}")
        except Exception as e:
            self.error(f"Failed to read file {file_path}. Error: {str(e)}")

    def stop(self):
        self.is_monitoring = False
        self.observer.stop()
        self.observer.join()

    def extend_filters(self, additional_filters):
        self.ignored_extensions.extend(additional_filters.get('ignored_extensions', []))
        self.ignored_directories.extend(additional_filters.get('ignored_directories', []))
        self.exclude_patterns.extend(additional_filters.get('exclude_patterns', []))

    def check_file(self, file_path):
        if self.should_exclude(file_path):
            return
        try:
            modification_time = os.path.getmtime(file_path)
            self.file_changes[file_path] = modification_time
            project_dir = next((dir for dir in self.project_dirs if file_path.startswith(dir)), None)
            if project_dir:
                self.process_file(file_path, project_dir)
                self.success(f"File modified: {file_path}")
        except Exception as e:
            self.warn(f"Failed to read modification time for file {file_path}. Error: {str(e)}")

    def should_exclude(self, path, check_only=False):
        basename = os.path.basename(path)
        if self.monitored_extensions:
            if not any(path.endswith(ext) for ext in self.monitored_extensions):
                if not check_only:
                    self.excluded_files += 1
                return True
        else:
            if any(path.endswith(ext) for ext in self.ignored_extensions):
                if not check_only:
                    self.excluded_files += 1
                return True
        if any(basename == dir or basename.startswith('.') for dir in self.ignored_directories):
            if not check_only:
                self.excluded_dirs += 1
            return True
        if any(fnmatch.fnmatch(path, pattern) for pattern in self.exclude_patterns):
            if not check_only:
                self.excluded_files += 1
            return True
        return False

    def print_status(self):
        self.total_files, self.total_dirs = self.count_files_and_dirs()
        self.success(
            f"Currently monitoring {self.total_dirs} directories and {self.total_files} files. Extensions: {list(self.file_extensions)}")
        self.success(f"Excluded {self.excluded_dirs} directories and {self.excluded_files} files.")
        if self.monitored_extensions:
            pass
            # self.info(f"Monitored extensions: {self.monitored_extensions}")
        else:
            self.info(f"Ignored extensions: {self.ignored_extensions}")

    def count_files_and_dirs(self):
        total_files = 0
        total_dirs = 0
        for project_dir in self.project_dirs:
            for root, dirs, files in os.walk(project_dir):
                total_files += len(files)
                total_dirs += len(dirs)
        return total_files, total_dirs

watch = Watch()

# Example usage
if __name__ == "__main__":
    project_dirs = [r'D:\programing\core_node']
    additional_filters = {
        'ignored_extensions': ['.example'],
        'ignored_directories': ['example_dir'],
        'exclude_patterns': ['example_pattern/**']
    }
    watch.start(project_dirs, 'ignore.json', scan_interval_seconds=5, additional_filters=additional_filters)

