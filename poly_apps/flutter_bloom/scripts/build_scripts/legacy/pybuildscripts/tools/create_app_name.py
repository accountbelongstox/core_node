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

import random
import string

def generate_flutter_app_id(
    app_name: str = None,
    prefix: str = None,
    domain: str = 'com',
    rand_len: int = 6
) -> str:
    app_name = app_name if app_name else ''.join(random.choices(string.ascii_lowercase, k=6))
    app_name = app_name.strip().replace(' ', '').lower()
    prefix = prefix if prefix else ''.join(random.choices(string.ascii_lowercase, k=3))
    rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=rand_len))
    return f"{prefix}.{app_name}{rand_str}.{domain}"

def generate_flutter_app_name(
    app_name: str = None,
    length: int = 8
) -> str:
    app_name = app_name if app_name else ''.join(random.choices(string.ascii_lowercase, k=length))
    app_name = app_name.strip().replace(' ', '').lower()
    return app_name

def generate_macos_app_name():
    appname = generate_flutter_app_name()
    return f"{appname}.app"

if __name__ == "__main__":
    print(generate_flutter_app_id())  # e.g., xx.xjzqwe4k2q1.com
    print(generate_flutter_app_id('bloom'))  # e.g., xx.bloomk9x2q1.com
    print(generate_flutter_app_id('qy', prefix='my', domain='cn'))  # e.g., my.qy4f7k2.cn
