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

import hashlib

def get_md5(s: str, extra: str = None) -> str:
    """
    Return the md5 hash of the string s. If extra is provided, concatenate it to s before hashing.
    :param s: The input string
    :param extra: Optional extra string to concatenate
    :return: md5 hex digest string
    """
    md5 = hashlib.md5()
    md5.update(s.encode('utf-8'))
    md5_str = md5.hexdigest()
    if extra is not None:
        md5_str = md5_str + extra
    return md5_str


def print_string_chars_with_explanation(input_string: str):
    """
    Prints each character of a string, showing special characters like \\n, \\t, \\r
    with their escape sequence representation, and provides a line-by-line explanation.

    Args:
        input_string: The string to process.
    """
    if not isinstance(input_string, str):
        print("Invalid input: Please provide a string.")
        return

    print(f"Processing string: '{input_string}'\n")

    for i, char in enumerate(input_string):
        display_char = repr(char).strip("'") # Use repr() to get the escape sequence, then strip quotes
        
        # Handle cases where repr might include quotes unnecessarily for simple chars
        if len(display_char) == 3 and display_char.startswith('\\') and display_char[1] in ['n', 't', 'r', 'f', 'b', 'a', 'v']:
            # This is already an escape sequence, keep it as is
            pass
        elif len(display_char) == 1 and display_char != char:
             # If repr() gives a single character that's different from the original, it's likely an escape.
             # This is a bit of a heuristic, but covers common cases like \x00
             pass
        elif display_char == char:
            # If repr() didn't change it, and it's a whitespace char, specifically map it.
            # This is to ensure \n shows as \n, not just a newline if repr sometimes prints it directly.
            if char == '\n':
                display_char = '\\n'
            elif char == '\t':
                display_char = '\\t'
            elif char == '\r':
                display_char = '\\r'


        print(f"Character {i + 1}: '{display_char}' - This is the character at index {i}.")
