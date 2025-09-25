# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

from typing import List, Tuple
from pathlib import Path
import sys

from pydantic import BaseModel
from pydantic_settings_yaml import YamlBaseSettings
from pydantic_settings import SettingsConfigDict, BaseSettings

from . import config_template

class Group(BaseModel):
    name: str
    type: str
    rule: bool = True
    manual: bool = False
    prior: str = None
    regex: str = None

class Config(YamlBaseSettings):
    HEAD: dict
    TEST_URL: str = "http://www.gstatic.com/generate_204"
    RULESET: List[Tuple[str, str]]
    CUSTOM_PROXY_GROUP: List[Group]

    model_config = SettingsConfigDict(
        secrets_dir=".",
        yaml_file="config.yaml"
    )


try:
    if Path("config.yaml").exists():
        with open("config.yaml", "r", encoding="utf-8") as f:
            if f.read() == "":
                raise FileNotFoundError
    configInstance = Config("config.yaml")
except FileNotFoundError:
    print(f"config.yaml not found or empty, please run {sys.argv[0]} -h to see how to generate a default config file")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
