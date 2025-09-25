
import os
import re
import json
import time
import importlib.util
from pycore.base.base import Base
from hashlib import md5

class PromptInit(Base):
    def __init__(self):
        super().__init__()
        self.regex_pattern = re.compile(r"#TASK")

    def create(self, project_dir):
        project_dir = os.path.abspath(project_dir).rstrip('/')
        id = md5(project_dir.encode()).hexdigest()
        create_time = time.ctime()

        task = {
            "task_path": project_dir,
            "id": id,
            "create_time": create_time,
            "queue": []
        }

        prompt_dir = os.path.join(project_dir, '.prompt')
        if not os.path.exists(prompt_dir):
            os.makedirs(prompt_dir)

        main_prompt = self.load_prompts_from_directory(prompt_dir)
        additional_prompt_dir = os.path.join(os.path.dirname(__file__), '.prompt')
        additional_prompt = self.load_prompts_from_directory(additional_prompt_dir)

        self.merge_prompts(main_prompt, additional_prompt)
        task['main_prompt'] = main_prompt
        task['additional_prompt'] = additional_prompt

        # self.tasks[id] = task
        return task

    def load_prompts_from_directory(self, prompt_dir):
        prompt = self.load_prompt(os.path.join(prompt_dir, 'prompt.json'))
        prompt_config = self.load_prompt_config(os.path.join(prompt_dir, 'prompt.config.py'))
        self.merge_prompts(prompt_config, prompt)
        return prompt

    def load_prompt(self, path):
        if os.path.exists(path):
            with open(path, 'r') as f:
                return json.load(f)
        self.warn(f"Prompt file not found at {path}")
        return {}

    def load_prompt_config(self, path):
        if os.path.exists(path):
            spec = importlib.util.spec_from_file_location("prompt_config", path)
            prompt_config = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(prompt_config)
            return getattr(prompt_config, 'prompt', {})
        self.warn(f"Prompt config file not found at {path}")
        return {}


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


prompt_init = PromptInit()
