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

from tools.images_tool import is_image_fully_transparent, get_image_size

def should_ignore_image(path):
    """
    Return True if the image is fully transparent or width/height is 1px, else False.
    """
    try:
        if is_image_fully_transparent(path):
            return True
        width, height = get_image_size(path)
        if width == 1 or height == 1:
            return True
    except Exception:
        pass
    return False
