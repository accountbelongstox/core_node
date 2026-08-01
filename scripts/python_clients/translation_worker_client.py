#!/usr/bin/env python3
"""
Translation Worker Client for GlobalTask System
Connects to Laravel backend via HTTP + WebSocket, processes translation tasks
"""

import asyncio
import httpx
import json
import sys
import signal
from datetime import datetime

class TranslationWorkerClient:
    def __init__(self, api_base_url, worker_id, worker_name):
        self.api_base_url = api_base_url
        self.worker_id = worker_id
        self.worker_name = worker_name
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.running = True

    def parse_json_response(self, response):
        """Parse JSON response, handling multiple UTF-8 BOMs"""
        # Decode using utf-8-sig which removes first BOM
        content = response.content.decode('utf-8-sig')
        # Remove any additional BOMs that might be present
        while content.startswith('\ufeff'):
            content = content[1:]
        return json.loads(content)

    async def register(self):
        """Register worker with backend"""
        try:
            response = await self.http_client.post(
                f"{self.api_base_url}/api/worker/register",
                json={
                    "worker_id": self.worker_id,
                    "worker_name": self.worker_name,
                    "processor_types": ["remote_client"],
                    "metadata": {
                        "version": "1.0.0",
                        "capabilities": ["translation", "batch_processing"]
                    }
                }
            )
            result = self.parse_json_response(response)
            print(f"[{self.timestamp()}] Worker registered: {result}")
            return result
        except Exception as e:
            print(f"[{self.timestamp()}] Registration error: {e}")
            return None

    async def heartbeat_loop(self):
        """Send periodic heartbeats"""
        while self.running:
            try:
                response = await self.http_client.post(
                    f"{self.api_base_url}/api/worker/heartbeat",
                    json={"worker_id": self.worker_id}
                )
                if response.status_code == 200:
                    print(f"[{self.timestamp()}] Heartbeat sent")
                await asyncio.sleep(30)
            except Exception as e:
                print(f"[{self.timestamp()}] Heartbeat error: {e}")
                await asyncio.sleep(5)

    async def poll_tasks_loop(self):
        """Poll for available tasks (HTTP polling fallback)"""
        print(f"[{self.timestamp()}] Starting task polling loop...")

        while self.running:
            try:
                # Pull tasks from server
                response = await self.http_client.get(
                    f"{self.api_base_url}/api/worker/tasks/word_translation/pull",
                    params={
                        "worker_id": self.worker_id,
                        "limit": 1
                    }
                )

                if response.status_code == 200:
                    result = self.parse_json_response(response)
                    tasks = result.get('data', {}).get('tasks', [])

                    if tasks:
                        for task in tasks:
                            await self.handle_task(task)
                    else:
                        # No tasks available
                        await asyncio.sleep(5)
                else:
                    print(f"[{self.timestamp()}] Task pull failed: {response.status_code}")
                    await asyncio.sleep(10)

            except Exception as e:
                print(f"[{self.timestamp()}] Polling error: {e}")
                await asyncio.sleep(10)

    async def handle_task(self, task_data):
        """Handle a translation task"""
        task_id = task_data.get("task_id")
        task_type = task_data.get("task_type")
        payload = task_data.get("payload", {})

        print(f"\n[{self.timestamp()}] ========================================")
        print(f"[{self.timestamp()}] Received task: {task_id}")
        print(f"[{self.timestamp()}] Type: {task_type}")
        print(f"[{self.timestamp()}] Payload: {json.dumps(payload, indent=2)}")
        print(f"[{self.timestamp()}] ========================================\n")

        # Accept task
        try:
            response = await self.http_client.post(
                f"{self.api_base_url}/api/worker/tasks/word_translation/accept",
                json={
                    "task_id": task_id,
                    "worker_id": self.worker_id
                }
            )

            if response.status_code != 200:
                print(f"[{self.timestamp()}] Failed to accept task: {response.status_code}")
                return

            print(f"[{self.timestamp()}] Task accepted successfully")

        except Exception as e:
            print(f"[{self.timestamp()}] Accept task error: {e}")
            return

        # Process task
        try:
            if task_type in ["dictionary_explanation", "dictionary_explanation_demo", "batch_translation", "translation_demo"]:
                await self.process_translation_task(task_id, payload)
            else:
                print(f"[{self.timestamp()}] Unknown task type: {task_type}")
                await self.report_failure(task_id, f"Unknown task type: {task_type}")

        except Exception as e:
            print(f"[{self.timestamp()}] Task processing error: {e}")
            await self.report_failure(task_id, str(e))

    async def process_translation_task(self, task_id, payload):
        """Process a dictionary explanation task"""
        words = payload.get("words", [])
        language = payload.get("language", "english")
        is_demo_mode = payload.get("is_demo_mode", False)

        print(f"[{self.timestamp()}] Processing {len(words)} words for dictionary explanations...")
        print(f"[{self.timestamp()}] Language: {language}")
        print(f"[{self.timestamp()}] Demo mode: {is_demo_mode}")

        explanations = []
        total = len(words)

        for idx, word_data in enumerate(words):
            # Generate explanation for word
            explanation = await self.explain_word(word_data, language)
            explanations.append(explanation)

            # Report progress every 20%
            progress = ((idx + 1) / total) * 100
            if int(progress) % 20 == 0 or idx == total - 1:
                await self.report_progress(task_id, progress, explanations[:idx+1])

            # Small delay to simulate processing
            await asyncio.sleep(0.1)

        # Submit final result
        await self.report_completion(task_id, {
            "explanations": explanations,
            "processed_count": len(explanations),
            "language": language,
            "is_demo_mode": is_demo_mode
        })

    async def explain_word(self, word_data, language):
        """Generate word explanation (DEMO IMPLEMENTATION)"""
        # In real implementation, call dictionary API or AI service
        # For demo, generate mock explanations
        word = word_data.get("word", "")
        md5 = word_data.get("md5", "")

        demo_explanations = {
            "hello": {
                "explanation": "A greeting used to express welcome or acknowledge presence",
                "phonetic": "həˈləʊ",
                "us_phonetic": "həˈloʊ",
                "uk_phonetic": "həˈləʊ"
            },
            "world": {
                "explanation": "The earth with all its countries and peoples",
                "phonetic": "wɜːld",
                "us_phonetic": "wɝːld",
                "uk_phonetic": "wɜːld"
            },
            "task": {
                "explanation": "A piece of work to be done or undertaken",
                "phonetic": "tɑːsk",
                "us_phonetic": "tæsk",
                "uk_phonetic": "tɑːsk"
            },
        }

        word_lower = word.lower()
        explanation_data = demo_explanations.get(word_lower, {
            "explanation": f"Definition and explanation for the word '{word}' (demo)",
            "phonetic": f"/{word_lower}/",
            "us_phonetic": f"/{word_lower}/",
            "uk_phonetic": f"/{word_lower}/"
        })

        return {
            "word": word,
            "md5": md5,
            "explanation": explanation_data["explanation"],
            "phonetic": explanation_data["phonetic"],
            "us_phonetic": explanation_data.get("us_phonetic"),
            "uk_phonetic": explanation_data.get("uk_phonetic"),
            "provider": "demo_dictionary"
        }

    async def report_progress(self, task_id, progress, partial_result=None):
        """Report task progress"""
        try:
            response = await self.http_client.post(
                f"{self.api_base_url}/api/worker/tasks/word_translation/result",
                json={
                    "task_id": task_id,
                    "worker_id": self.worker_id,
                    "status": "processing",
                    "progress": progress,
                    "result": {"partial_translations": partial_result} if partial_result else None
                }
            )

            if response.status_code == 200:
                print(f"[{self.timestamp()}] Progress reported: {progress:.1f}%")
            else:
                print(f"[{self.timestamp()}] Progress report failed: {response.status_code}")

        except Exception as e:
            print(f"[{self.timestamp()}] Progress report error: {e}")

    async def report_completion(self, task_id, result):
        """Report task completion"""
        try:
            response = await self.http_client.post(
                f"{self.api_base_url}/api/worker/tasks/word_translation/result",
                json={
                    "task_id": task_id,
                    "worker_id": self.worker_id,
                    "status": "completed",
                    "progress": 100.0,
                    "result": result
                }
            )

            if response.status_code == 200:
                print(f"\n[{self.timestamp()}] ========================================")
                print(f"[{self.timestamp()}] Task {task_id} COMPLETED")
                print(f"[{self.timestamp()}] Processed: {result.get('processed_count', 0)} words")
                print(f"[{self.timestamp()}] ========================================\n")
            else:
                print(f"[{self.timestamp()}] Completion report failed: {response.status_code}")

        except Exception as e:
            print(f"[{self.timestamp()}] Completion report error: {e}")

    async def report_failure(self, task_id, error):
        """Report task failure"""
        try:
            response = await self.http_client.post(
                f"{self.api_base_url}/api/worker/tasks/word_translation/result",
                json={
                    "task_id": task_id,
                    "worker_id": self.worker_id,
                    "status": "failed",
                    "error": error
                }
            )

            if response.status_code == 200:
                print(f"[{self.timestamp()}] Task {task_id} marked as FAILED")
            else:
                print(f"[{self.timestamp()}] Failure report failed: {response.status_code}")

        except Exception as e:
            print(f"[{self.timestamp()}] Failure report error: {e}")

    def timestamp(self):
        """Get current timestamp"""
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    async def shutdown(self):
        """Graceful shutdown"""
        print(f"\n[{self.timestamp()}] Shutting down worker...")
        self.running = False
        await self.http_client.aclose()

    async def run(self):
        """Start worker"""
        print(f"[{self.timestamp()}] ========================================")
        print(f"[{self.timestamp()}] Translation Worker Client Starting")
        print(f"[{self.timestamp()}] Worker ID: {self.worker_id}")
        print(f"[{self.timestamp()}] API Base: {self.api_base_url}")
        print(f"[{self.timestamp()}] ========================================\n")

        # Register worker
        await self.register()

        # Start background tasks
        await asyncio.gather(
            self.heartbeat_loop(),
            self.poll_tasks_loop()
        )


async def main():
    # Configuration
    API_BASE_URL = "http://localhost:9000"
    WORKER_ID = f"translation-worker-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    WORKER_NAME = "Translation Worker (Python Demo)"

    worker = TranslationWorkerClient(API_BASE_URL, WORKER_ID, WORKER_NAME)

    # Handle shutdown signals
    def signal_handler(sig, frame):
        print(f"\nReceived signal {sig}, shutting down...")
        asyncio.create_task(worker.shutdown())

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await worker.run()
    except KeyboardInterrupt:
        print("\nKeyboard interrupt received")
    finally:
        await worker.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
