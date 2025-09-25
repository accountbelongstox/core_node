import os
import time
import json
import re
import pyperclip
from pycore.base.base import Base
from task_parse import task_parse
from task_waiting_queue import task_waiting_queue
from task_extra import task_extra
from task_db import task_db
from pycore.globalvers import outdir

class TaskPublish(Base):
    def publish_task(self, identifier):
        # Get and clear the waiting queue
        waiting_queue = task_waiting_queue.get_and_clear_waiting_queue(identifier)

        tasks = []

        for file_path in waiting_queue:
            try:
                file_content = self.read_text(file_path)
                extra_result = task_extra.extra_from_content(file_content)
                task_info = {
                    "filename": os.path.basename(file_path),
                    "filepath": file_path,
                    "publish_time": time.ctime(os.path.getmtime(file_path)),
                    "prompt_length": len(extra_result),
                    "prompt": extra_result,
                    "id": task_waiting_queue.get_task_id(identifier),
                    "project_dir": task_waiting_queue.tasks[task_waiting_queue.get_task_id(identifier)]["project_dir"]
                }
                tasks.append(task_info)
            except Exception as e:
                self.error(f"Failed to process file {file_path}. Error: {str(e)}")

        # Append tasks to the task database
        for task in tasks:
            task_db.append_task(task)

        self.success("Tasks published successfully.")

task_publish = TaskPublish()
