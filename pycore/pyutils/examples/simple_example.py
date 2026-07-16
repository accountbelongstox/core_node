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

import sys
import os
import json

import platform


project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
sys.path.insert(0, project_root)

from pycore.pyutils.nodejs_bridge import bridge_function


@bridge_function
def process_message(message: str, count: int = 1) -> dict:
    """
    Simple example function that processes a message
    """
    result = {
        'original_message': message,
        'processed': message.upper(),
        'length': len(message),
        'repeated': message * count,
        'reversed': message[::-1]
    }
    return result


@bridge_function
def calculate_sum(numbers: list) -> dict:
    """
    Calculate sum and average of numbers
    """
    if not numbers:
        return {'sum': 0, 'average': 0, 'count': 0}

    total = sum(numbers)
    avg = total / len(numbers)

    return {
        'sum': total,
        'average': avg,
        'count': len(numbers),
        'min': min(numbers),
        'max': max(numbers)
    }


@bridge_function
def get_system_info() -> dict:
    """
    Get system information
    """

    return {
        'system': platform.system(),
        'release': platform.release(),
        'version': platform.version(),
        'machine': platform.machine(),
        'processor': platform.processor(),
        'python_version': platform.python_version()
    }


if __name__ == '__main__':
    try:
        params = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}

        if 'message' in params:
            result = process_message(**params)
        elif 'numbers' in params:
            result = calculate_sum(**params)
        else:
            result = get_system_info()

        output = {
            'success': True,
            'result': result,
            'error': None
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))

    except Exception as e:
        import traceback
        output = {
            'success': False,
            'result': None,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        sys.exit(1)
