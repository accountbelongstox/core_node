#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import json
import argparse
import torch
from transformers import AutoModelForCausalLM
from deepseek_vl.models import VLChatProcessor, MultiModalityCausalLM

class DeepSeekServer:
    def __init__(self, model_path, model_dir=None):
        self.model_path = model_path
        self.model_dir = model_dir
        self.vl_chat_processor = None
        self.tokenizer = None
        self.vl_gpt = None

        sys.stderr.write(f"Initializing DeepSeek model: {model_path}\n")
        sys.stderr.flush()

        self.load_model()

    def load_model(self):
        try:
            if self.model_dir:
                sys.path.insert(0, self.model_dir)

            sys.stderr.write("Loading VL Chat Processor...\n")
            sys.stderr.flush()

            self.vl_chat_processor = VLChatProcessor.from_pretrained(self.model_path)
            self.tokenizer = self.vl_chat_processor.tokenizer

            sys.stderr.write("Loading VL Model...\n")
            sys.stderr.flush()

            self.vl_gpt = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                trust_remote_code=True
            )

            if torch.cuda.is_available():
                sys.stderr.write("CUDA available, moving model to GPU...\n")
                sys.stderr.flush()
                self.vl_gpt = self.vl_gpt.to(torch.bfloat16).cuda().eval()
            else:
                sys.stderr.write("CUDA not available, using CPU...\n")
                sys.stderr.flush()
                self.vl_gpt = self.vl_gpt.eval()

            sys.stderr.write("Model loaded successfully\n")
            sys.stderr.flush()

            print("READY", flush=True)

        except Exception as e:
            sys.stderr.write(f"Error loading model: {str(e)}\n")
            sys.stderr.flush()
            sys.exit(1)

    def translate(self, text, target_language="Chinese"):
        try:
            prompt = f"Translate the following text to {target_language}:\n\n{text}\n\nTranslation:"

            conversation = [
                {
                    "role": "User",
                    "content": prompt,
                    "images": [],
                },
                {"role": "Assistant", "content": ""},
            ]

            prepare_inputs = self.vl_chat_processor(
                conversations=conversation,
                images=[],
                force_batchify=True
            ).to(self.vl_gpt.device)

            inputs_embeds = self.vl_gpt.prepare_inputs_embeds(**prepare_inputs)

            outputs = self.vl_gpt.language_model.generate(
                inputs_embeds=inputs_embeds,
                attention_mask=prepare_inputs.attention_mask,
                pad_token_id=self.tokenizer.eos_token_id,
                bos_token_id=self.tokenizer.bos_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
                max_new_tokens=512,
                do_sample=False,
                use_cache=True
            )

            answer = self.tokenizer.decode(outputs[0].cpu().tolist(), skip_special_tokens=True)

            answer = answer.strip()
            if answer.startswith(prompt):
                answer = answer[len(prompt):].strip()

            return answer

        except Exception as e:
            sys.stderr.write(f"Translation error: {str(e)}\n")
            sys.stderr.flush()
            return text

    def run(self):
        sys.stderr.write("Server ready, waiting for requests...\n")
        sys.stderr.flush()

        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                request = json.loads(line.strip())
                request_id = request.get('id', 0)
                text = request.get('text', '')
                target_language = request.get('target_language', 'Chinese')

                if not text:
                    response = {
                        'id': request_id,
                        'error': 'No text provided'
                    }
                else:
                    translation = self.translate(text, target_language)
                    response = {
                        'id': request_id,
                        'translation': translation,
                        'original': text
                    }

                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                sys.stderr.write(f"JSON decode error: {str(e)}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"Server error: {str(e)}\n")
                sys.stderr.flush()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DeepSeek VL Translation Server')
    parser.add_argument('--model_path', type=str, required=True, help='Model path or Hugging Face model ID')
    parser.add_argument('--model_dir', type=str, help='DeepSeek-VL repository directory')

    args = parser.parse_args()

    server = DeepSeekServer(args.model_path, args.model_dir)
    server.run()
