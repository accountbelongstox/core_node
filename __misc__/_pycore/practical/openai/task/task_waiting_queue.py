import os
import json
import time
from pycore.base.base import Base
# from task_parse import task_parse
from pycore.practical.openai.prompt.prompt_init import prompt_init

class TaskWaitingQueue(Base):
    def __init__(self):
        super().__init__()
        self.tasks = {}

    def init(self, project_dir):
        task_obj = prompt_init.create(project_dir)
        self.tasks[task_obj.get('id')] = task_obj

    def add_file_to_queue(self, file_info):
        task_id = self.get_task_id(file_info["project_dir"])
        if task_id in self.tasks:
            file_path = file_info["filepath"]
            if "waiting_queue" not in self.tasks[task_id]:
                self.tasks[task_id]["waiting_queue"] = set()
            if file_path not in self.tasks[task_id]["waiting_queue"]:
                self.tasks[task_id]["waiting_queue"].add(file_path)
                self.info(f"File added to waiting queue: {file_path}")
            else:
                self.warn(f"File already in waiting queue: {file_path}")
        else:
            self.warn(f"No task found for project_dir: {file_info['project_dir']}")

    def get_waiting_queue(self, identifier):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks and "waiting_queue" in self.tasks[task_id]:
            return list(self.tasks[task_id]["waiting_queue"])
        self.warn(f"No waiting queue found for identifier: {identifier}")
        return []

    def get_and_clear_waiting_queue(self, identifier):
        waiting_queue = self.get_waiting_queue(identifier)
        self.clear_waiting_queue(identifier)
        return waiting_queue

    def clear_waiting_queue(self, identifier):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks and "waiting_queue" in self.tasks[task_id]:
            self.tasks[task_id]["waiting_queue"].clear()
            self.info(f"Waiting queue cleared for identifier: {identifier}")
        else:
            self.warn(f"No waiting queue to clear for identifier: {identifier}")

    def add_task(self, task_obj):
        self.tasks[task_obj["id"]] = task_obj
        self.info(f"Task added: {task_obj['id']}")

    def delete_task(self, identifier):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks:
            del self.tasks[task_id]
            self.info(f"Task deleted: {task_id}")
        else:
            self.warn(f"No task found to delete for identifier: {identifier}")

    def get_task(self, identifier):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks:
            return self.tasks[task_id]
        self.warn(f"No task found for identifier: {identifier}")
        return None

    def update_task(self, identifier, task_obj):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks:
            self.tasks[task_id].update(task_obj)
            self.info(f"Task updated: {task_id}")
        else:
            self.warn(f"No task found to update for identifier: {identifier}")

    def has_task(self, identifier):
        return self.get_task(identifier) is not None

    def add_to_task_queue(self, identifier, file_info):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks:
            self.add_file_to_queue(file_info)
        else:
            self.warn(f"No task found for identifier: {identifier}")

    def remove_from_task_queue(self, identifier, file_path):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks and "waiting_queue" in self.tasks[task_id]:
            self.tasks[task_id]["waiting_queue"].discard(file_path)
            self.info(f"File removed from waiting queue: {file_path}")
        else:
            self.warn(f"No task or waiting queue found for identifier: {identifier}")

    def update_task_queue(self, identifier, old_file_path, new_file_path):
        task_id = self.get_task_id(identifier)
        if task_id in self.tasks and "waiting_queue" in self.tasks[task_id]:
            if old_file_path in self.tasks[task_id]["waiting_queue"]:
                self.tasks[task_id]["waiting_queue"].remove(old_file_path)
                self.tasks[task_id]["waiting_queue"].add(new_file_path)
                self.info(f"File path updated in waiting queue from {old_file_path} to {new_file_path}")
            else:
                self.warn(f"Old file path not found in waiting queue: {old_file_path}")
        else:
            self.warn(f"No task or waiting queue found for identifier: {identifier}")

    def get_task_id(self, identifier):
        """Get task ID by project_dir or id."""
        for task_id, task in self.tasks.items():
            if task_id == identifier or task["project_dir"] == identifier:
                return task_id
        return identifier

    def clear_all_tasks(self):
        self.tasks.clear()
        self.info("All tasks cleared.")

task_waiting_queue = TaskWaitingQueue()
