import json
import re
import pyperclip
from pycore.base.base import Base

class ChatParse(Base):
    def __init__(self):
        super().__init__()

    def format(self, data):
        if isinstance(data, str):
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                self.warn("Provided data is not valid JSON")
                return None
        return data

    def extract_chat(self, data):
        formatted_data = self.format(data)
        if formatted_data is None:
            return ""
        try:
            content = formatted_data['choices'][0]['delta'].get('content', '')
            return content
        except (KeyError, TypeError):
            self.warn("Invalid data structure for extracting chat content")
            return ""

    def extract_code(self, data):
        chat_content = self.extract_chat(data)
        if chat_content == "":
            return []
        code_snippets = re.findall(r'```([a-zA-Z]*)\n(.*?)```', chat_content, re.DOTALL)
        return [snippet[1].strip() for snippet in code_snippets]

    def write_to_clipboard(self, text):
        pyperclip.copy(text)

    def code_array_to_text(self, code_array):
        return '\n\n'.join(code_array)


    def extra_tasks(self, data):
        pass

chat_parse = ChatParse()
