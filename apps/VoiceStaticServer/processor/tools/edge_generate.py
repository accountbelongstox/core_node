import http.server
import socketserver
import json
import os
from urllib.parse import parse_qs, urlparse
import edge_tts
import asyncio

DEFAULT_TEXT = "hello"
DEFAULT_VOICE = "en-GB-SoniaNeural"
DEFAULT_OUTPUT = "/tme/hello.mp3"

class TTSRequestHandler(http.server.BaseHTTPRequestHandler):
    def handle_tts_request(self, params):
        try:
            # Get parameters with defaults
            text = params.get('TEXT', DEFAULT_TEXT)
            voice = params.get('VOICE', DEFAULT_VOICE)
            output_file = params.get('OUTPUT_FILE', DEFAULT_OUTPUT)

            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_file), exist_ok=True)

            # Generate TTS
            async def generate():
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(output_file)

            # Run TTS generation
            
            asyncio.run(generate())

            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'success': True,
                'message': 'Audio file generated successfully',
                'file': output_file,
                'text': text,
                'voice': voice
            }
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {
                'success': False,
                'error': str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            params = json.loads(post_data.decode('utf-8'))
            self.handle_tts_request(params)
        except Exception as e:
            # If POST fails, fall back to defaults
            self.handle_tts_request({})

    def do_GET(self):
        try:
            # Parse URL parameters
            parsed_url = urlparse(self.path)
            params = parse_qs(parsed_url.query)
            
            # Convert params from lists to single values
            processed_params = {
                'TEXT': params.get('TEXT', [DEFAULT_TEXT])[0],
                'VOICE': params.get('VOICE', [DEFAULT_VOICE])[0],
                'OUTPUT_FILE': params.get('OUTPUT_FILE', [DEFAULT_OUTPUT])[0]
            }
            
            self.handle_tts_request(processed_params)
        except Exception as e:
            # If GET fails, fall back to defaults
            self.handle_tts_request({})

def run_server(port=8765):
    with socketserver.TCPServer(("", port), TTSRequestHandler) as httpd:
        print(f"Serving at port {port}")
        print(f"Default values:")
        print(f"  TEXT: {DEFAULT_TEXT}")
        print(f"  VOICE: {DEFAULT_VOICE}")
        print(f"  OUTPUT_FILE: {DEFAULT_OUTPUT}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()