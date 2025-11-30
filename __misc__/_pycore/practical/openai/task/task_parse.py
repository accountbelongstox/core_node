import os
import re
import json
import time
import importlib.util
from pycore.base.base import Base
from hashlib import md5

class TaskParse(Base):
    def __init__(self):
        super().__init__()


    def get_task_id(self, project_dir):
        project_dir = os.path.abspath(project_dir).rstrip('/')
        return md5(project_dir.encode()).hexdigest()

    def check_from_content(self, content):
        return self.regex_pattern.search(content) is not None

    def merge_prompts(self, main_prompt, additional_prompt):
        for key, val in additional_prompt.items():
            if key in main_prompt:
                if isinstance(val, dict) and isinstance(main_prompt[key], dict):
                    self.merge_prompts(main_prompt[key], val)
                elif isinstance(val, list) and isinstance(main_prompt[key], list):
                    main_prompt[key].extend(val)
                elif isinstance(val, str) and isinstance(main_prompt[key], str):
                    main_prompt[key] = val
            else:
                main_prompt[key] = val

    def extra(self, file_info):
        project_dir = file_info["project_dir"]
        task_id = self.get_task_id(project_dir)
        if task_id in self.tasks:
            task = self.tasks[task_id]
            if 'main_prompt' in task:
                task['queue'].append(file_info)
                self.success(f"Task updated for project_dir: {project_dir}")
            else:
                self.warn(f"Prompt files missing for task ID: {task_id}")
        else:
            self.warn(f"No task found for project_dir: {project_dir}")

task_parse = TaskParse()
