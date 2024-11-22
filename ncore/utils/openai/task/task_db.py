import os
import json
import time
from pycore.base.base import Base
from pycore.globalvers import outdir

class TaskDB(Base):
    def __init__(self):
        super().__init__()
        self.tasks_file_path = os.path.join(outdir, "out/.tasks/tasks.json")
        self._ensure_tasks_file()

    def _ensure_tasks_file(self):
        """Ensure the tasks file and its directory exist."""
        if not os.path.exists(os.path.dirname(self.tasks_file_path)):
            os.makedirs(os.path.dirname(self.tasks_file_path))
        if not os.path.exists(self.tasks_file_path):
            with open(self.tasks_file_path, 'w') as f:
                json.dump({"tasks": []}, f)

    def _load_tasks(self):
        """Load tasks from the tasks file."""
        with open(self.tasks_file_path, 'r') as f:
            return json.load(f)["tasks"]

    def _save_tasks(self, tasks):
        """Save tasks to the tasks file."""
        with open(self.tasks_file_path, 'w') as f:
            json.dump({"tasks": tasks}, f, indent=4)

    def initialize_tasks(self):
        """Initialize tasks.json."""
        self._ensure_tasks_file()
        self.success("Initialized tasks.json.")

    def add_task(self, task):
        """Add a task, replacing any existing task with the same id or project_dir."""
        tasks = self._load_tasks()
        tasks = [t for t in tasks if t["id"] != task["id"] and t["project_dir"] != task["project_dir"]]
        tasks.append(task)
        self._save_tasks(tasks)
        self.success(f"Task added: {task}")

    def append_task(self, task):
        """Append a task without removing any existing task."""
        tasks = self._load_tasks()
        tasks.append(task)
        self._save_tasks(tasks)
        self.success(f"Task appended: {task}")

    def delete_task(self, identifier):
        """Delete a task by id or project_dir."""
        tasks = self._load_tasks()
        tasks = [t for t in tasks if t["id"] != identifier and t["project_dir"] != identifier]
        self._save_tasks(tasks)
        self.success(f"Task deleted: {identifier}")

    def find_task(self, identifier):
        """Find a task by id or project_dir."""
        tasks = self._load_tasks()
        for task in tasks:
            if task["id"] == identifier or task["project_dir"] == identifier:
                self.info(f"Task found: {task}")
                return task
        self.warn(f"Task not found: {identifier}")
        return None

    def has_task(self, identifier):
        """Check if a task exists by id or project_dir."""
        return self.find_task(identifier) is not None

    def clear_tasks(self):
        """Clear all tasks."""
        self._save_tasks([])
        self.success("All tasks cleared.")

# 导出类实例
task_db = TaskDB()
