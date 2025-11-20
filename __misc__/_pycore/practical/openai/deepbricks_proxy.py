import requests
from pycore.globalvers import env
from pycore.base.base import Base
from pycore.practical.openai.util.increment_print import increment_print
from pycore.practical.openai.chat.chat_parse import chat_parse


class DeepbricksProxy(Base):
    def __init__(self):
        self.api_key = env.get_env("OPENAI_API_KEY")
        self.url = "https://api.deepbricks.ai/v1/chat/completions"

    def get_headers(self):
        """Return the headers for the API request."""
        return {
            "Authorization": f"Bearer {self.api_key}"
        }

    def get_body(self, message_content):
        """Return the body of the request."""
        return {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": message_content
                }
            ],
            "stream": True
        }

    def send_request(self, message_content):
        """Send a POST request to the API and return the response."""
        body = self.get_body(message_content)
        response = requests.post(self.url, headers=self.get_headers(), json=body, stream=True)
        return response

    def print_response(self, message_content):
        """Print the API response in a chat-like manner."""
        response = self.send_request(message_content)
        increment_print.initialize_screen()
        for chunk in response.iter_lines():
            if chunk:
                decoded_chunk = chunk.decode('utf-8')
                if decoded_chunk.startswith("data: "):
                    data = decoded_chunk[6:]
                    if data == "[DONE]":
                        break
                    chat = chat_parse.extract_chat(data)
                    increment_print.add_string(chat)

        final_content = increment_print.get_printed_content()
        print("\nFinal response:", final_content)
        code_snippets = chat_parse.extract_code(final_content)
        code_text = chat_parse.code_array_to_text(code_snippets)
        chat_parse.write_to_clipboard(code_text)
        print("Code snippets have been written to the clipboard.")


# Example usage
if __name__ == "__main__":
    deepbricks_proxy = DeepbricksProxy()
    deepbricks_proxy.print_response("Hello!")
