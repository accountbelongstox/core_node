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
import json
import functools
import traceback
from typing import Any, Callable, Dict, Optional


class BridgeWrapper:
    """
    Wrapper class for Python functions to be called from Node.js
    """

    def __init__(self, encoding='utf-8'):
        self.encoding = encoding

    def wrap_function(self, func: Callable) -> Callable:
        """
        Wraps a Python function to handle Node.js input and output
        """
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                if len(sys.argv) > 1:
                    params = json.loads(sys.argv[1])
                    if isinstance(params, dict):
                        kwargs.update(params)
                    elif isinstance(params, list):
                        args = tuple(params)

                result = func(*args, **kwargs)

                output = {
                    'success': True,
                    'result': self._serialize(result),
                    'error': None
                }

                print(json.dumps(output, ensure_ascii=False, indent=2))
                return result

            except Exception as e:
                output = {
                    'success': False,
                    'result': None,
                    'error': str(e),
                    'traceback': traceback.format_exc()
                }
                print(json.dumps(output, ensure_ascii=False, indent=2))
                sys.exit(1)

        return wrapper

    def _serialize(self, obj: Any) -> Any:
        """
        Serializes Python objects to JSON-compatible format
        """
        if obj is None:
            return None

        if isinstance(obj, (str, int, float, bool)):
            return obj

        if isinstance(obj, (list, tuple)):
            return [self._serialize(item) for item in obj]

        if isinstance(obj, dict):
            return {k: self._serialize(v) for k, v in obj.items()}

        if hasattr(obj, '__dict__'):
            return self._serialize(obj.__dict__)

        return str(obj)

    @staticmethod
    def get_params_from_stdin() -> Dict[str, Any]:
        """
        Gets parameters from stdin (alternative to sys.argv)
        """
        try:
            if len(sys.argv) > 1:
                return json.loads(sys.argv[1])
            return {}
        except Exception as e:
            return {}

    @staticmethod
    def send_result(result: Any, success: bool = True, error: Optional[str] = None):
        """
        Sends result back to Node.js in standardized format
        """
        output = {
            'success': success,
            'result': result,
            'error': error
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))

    @staticmethod
    def send_error(error: str, traceback_str: Optional[str] = None):
        """
        Sends error back to Node.js
        """
        output = {
            'success': False,
            'result': None,
            'error': error,
            'traceback': traceback_str or traceback.format_exc()
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        sys.exit(1)


def bridge_function(func: Callable) -> Callable:
    """
    Decorator to wrap a function for Node.js bridge
    """
    wrapper = BridgeWrapper()
    return wrapper.wrap_function(func)


def bridge_class(cls):
    """
    Decorator to wrap all methods of a class for Node.js bridge
    """
    wrapper = BridgeWrapper()

    for attr_name in dir(cls):
        if not attr_name.startswith('_'):
            attr = getattr(cls, attr_name)
            if callable(attr):
                setattr(cls, attr_name, wrapper.wrap_function(attr))

    return cls


def main_wrapper(main_func: Callable):
    """
    Wrapper for main entry point
    """
    try:
        wrapper = BridgeWrapper()
        params = wrapper.get_params_from_stdin()

        result = main_func(**params) if params else main_func()

        wrapper.send_result(result)

    except Exception as e:
        BridgeWrapper.send_error(str(e))


if __name__ == '__main__':
    print("BridgeWrapper module - Use as decorator or import in your scripts")
