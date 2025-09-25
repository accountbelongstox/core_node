import os
import re
import json
from pycore.base.base import Base

class PromptParse(Base):
    def __init__(self):
        pass

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

prompt_parse = PromptParse()
