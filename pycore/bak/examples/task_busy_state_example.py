#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Busy State Example - How to use THREAD_BUS busy state in tasks

This example demonstrates how to properly set busy state when processing tasks,
ensuring the application won't shutdown during critical operations.

Key Concepts:
1. Set busy state BEFORE starting critical work
2. Clear busy state AFTER work completes (even on error)
3. Use try-finally to ensure busy state is always cleared

Usage in your task classes:
    from pycore import THREAD_BUS

    class MyTaskProcessor:
        def process_important_task(self, data):
            # Set busy state
            THREAD_BUS.set_busy(True, "Processing important task")

            try:
                # Do important work...
                self._do_work(data)

            finally:
                # Always clear busy state
                THREAD_BUS.set_busy(False)
"""

import time
from pycore import THREAD_BUS, ColorPrint


# ============================================================
# Example 1: Simple Task with Busy State
# ============================================================

class SimpleTaskProcessor:
    """
    Simple task processor with busy state management

    Shows basic pattern for single-task processing.
    """

    def process_task(self, task_data: dict) -> dict:
        """
        Process a task with busy state protection

        Args:
            task_data: Task data to process

        Returns:
            Processing result
        """
        ColorPrint.blue(f"[Task] Starting: {task_data.get('name')}")

        # Set busy state BEFORE starting work
        THREAD_BUS.set_busy(True, f"Processing task: {task_data.get('name')}")

        try:
            # Simulate work
            time.sleep(2)

            result = {
                "success": True,
                "task": task_data.get('name'),
                "result": "Completed successfully"
            }

            ColorPrint.green(f"[Task] Completed: {task_data.get('name')}")
            return result

        except Exception as e:
            ColorPrint.red(f"[Task] Error: {e}")
            return {
                "success": False,
                "task": task_data.get('name'),
                "error": str(e)
            }

        finally:
            # ALWAYS clear busy state
            THREAD_BUS.set_busy(False)
            ColorPrint.blue("[Task] Busy state cleared")


# ============================================================
# Example 2: Batch Task Processor
# ============================================================

class BatchTaskProcessor:
    """
    Batch task processor with busy state management

    Shows pattern for processing multiple tasks while maintaining
    busy state throughout the batch.
    """

    def process_batch(self, tasks: list) -> dict:
        """
        Process multiple tasks with busy state protection

        Args:
            tasks: List of tasks to process

        Returns:
            Batch processing result
        """
        ColorPrint.blue(f"[Batch] Starting batch of {len(tasks)} tasks")

        # Set busy state for entire batch
        THREAD_BUS.set_busy(True, f"Processing batch of {len(tasks)} tasks")

        try:
            results = []

            for i, task in enumerate(tasks, 1):
                ColorPrint.blue(f"[Batch] Processing task {i}/{len(tasks)}")

                # Update busy reason for current task
                THREAD_BUS.set_busy(
                    True,
                    f"Processing batch task {i}/{len(tasks)}: {task.get('name')}"
                )

                # Process task
                time.sleep(1)  # Simulate work
                results.append({
                    "task": task.get('name'),
                    "status": "completed"
                })

            ColorPrint.green(f"[Batch] Completed {len(results)}/{len(tasks)} tasks")

            return {
                "success": True,
                "total": len(tasks),
                "completed": len(results),
                "results": results
            }

        except Exception as e:
            ColorPrint.red(f"[Batch] Error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

        finally:
            # Clear busy state after batch completes
            THREAD_BUS.set_busy(False)
            ColorPrint.blue("[Batch] Busy state cleared")


# ============================================================
# Example 3: Database Transaction Processor
# ============================================================

class DatabaseTransactionProcessor:
    """
    Database transaction processor with busy state

    Critical operations that should not be interrupted.
    """

    def execute_critical_transaction(self, operations: list) -> dict:
        """
        Execute critical database transaction

        Args:
            operations: List of database operations

        Returns:
            Transaction result
        """
        ColorPrint.blue(f"[DB] Starting transaction with {len(operations)} operations")

        # Set busy state - CRITICAL OPERATION
        THREAD_BUS.set_busy(
            True,
            f"Executing critical database transaction ({len(operations)} ops)"
        )

        try:
            # Begin transaction
            ColorPrint.blue("[DB] BEGIN TRANSACTION")
            time.sleep(0.5)

            # Execute operations
            for i, op in enumerate(operations, 1):
                ColorPrint.blue(f"[DB] Executing operation {i}/{len(operations)}: {op}")
                time.sleep(0.5)  # Simulate SQL execution

            # Commit transaction
            ColorPrint.blue("[DB] COMMIT")
            time.sleep(0.5)

            ColorPrint.green("[DB] Transaction completed successfully")

            return {
                "success": True,
                "operations": len(operations),
                "status": "committed"
            }

        except Exception as e:
            ColorPrint.red(f"[DB] ROLLBACK - Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "status": "rolled_back"
            }

        finally:
            # Clear busy state after transaction completes (commit or rollback)
            THREAD_BUS.set_busy(False)
            ColorPrint.blue("[DB] Transaction busy state cleared")


# ============================================================
# Example 4: File Upload Processor
# ============================================================

class FileUploadProcessor:
    """
    File upload processor with busy state

    Shows pattern for long-running file operations.
    """

    def upload_large_file(self, file_path: str, destination: str) -> dict:
        """
        Upload large file with busy state protection

        Args:
            file_path: Source file path
            destination: Destination URL

        Returns:
            Upload result
        """
        ColorPrint.blue(f"[Upload] Starting upload: {file_path}")

        # Set busy state for file upload
        THREAD_BUS.set_busy(
            True,
            f"Uploading file: {file_path}"
        )

        try:
            # Simulate file upload with progress
            total_chunks = 10

            for chunk in range(1, total_chunks + 1):
                # Update busy reason with progress
                progress = (chunk / total_chunks) * 100
                THREAD_BUS.set_busy(
                    True,
                    f"Uploading {file_path}: {progress:.0f}% ({chunk}/{total_chunks})"
                )

                ColorPrint.blue(f"[Upload] Progress: {progress:.0f}%")
                time.sleep(0.5)  # Simulate chunk upload

            ColorPrint.green("[Upload] Upload completed successfully")

            return {
                "success": True,
                "file": file_path,
                "destination": destination,
                "status": "uploaded"
            }

        except Exception as e:
            ColorPrint.red(f"[Upload] Error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

        finally:
            # Clear busy state after upload completes (success or error)
            THREAD_BUS.set_busy(False)
            ColorPrint.blue("[Upload] Upload busy state cleared")


# ============================================================
# Example 5: API Request Handler with Busy State
# ============================================================

class APIRequestHandler:
    """
    API request handler with conditional busy state

    Shows when to use busy state (critical requests) vs not (simple queries).
    """

    def handle_critical_request(self, request_data: dict) -> dict:
        """
        Handle critical API request (use busy state)

        Args:
            request_data: Request data

        Returns:
            Response data
        """
        ColorPrint.blue("[API] Handling CRITICAL request")

        # Set busy state for critical requests
        THREAD_BUS.set_busy(True, f"Processing critical API request: {request_data.get('type')}")

        try:
            # Process critical request
            time.sleep(2)

            return {
                "success": True,
                "type": "critical",
                "result": "Processed"
            }

        finally:
            THREAD_BUS.set_busy(False)

    def handle_simple_query(self, query: str) -> dict:
        """
        Handle simple query (NO busy state needed)

        Args:
            query: Query string

        Returns:
            Query result

        Note:
            Simple queries don't need busy state protection.
            Only use busy state for critical operations that
            should not be interrupted.
        """
        ColorPrint.blue("[API] Handling simple query (no busy state)")

        # No busy state for simple operations
        time.sleep(0.1)

        return {
            "success": True,
            "type": "query",
            "result": "Query result"
        }


# ============================================================
# Test Functions
# ============================================================

def test_simple_task():
    """Test simple task processor"""
    ColorPrint.green("\n=== Test 1: Simple Task ===")

    processor = SimpleTaskProcessor()
    result = processor.process_task({"name": "Important Task"})

    ColorPrint.blue(f"Result: {result}")


def test_batch_tasks():
    """Test batch task processor"""
    ColorPrint.green("\n=== Test 2: Batch Tasks ===")

    processor = BatchTaskProcessor()
    tasks = [
        {"name": "Task 1"},
        {"name": "Task 2"},
        {"name": "Task 3"}
    ]

    result = processor.process_batch(tasks)
    ColorPrint.blue(f"Result: {result}")


def test_database_transaction():
    """Test database transaction"""
    ColorPrint.green("\n=== Test 3: Database Transaction ===")

    processor = DatabaseTransactionProcessor()
    operations = ["INSERT", "UPDATE", "DELETE"]

    result = processor.execute_critical_transaction(operations)
    ColorPrint.blue(f"Result: {result}")


def test_file_upload():
    """Test file upload"""
    ColorPrint.green("\n=== Test 4: File Upload ===")

    processor = FileUploadProcessor()
    result = processor.upload_large_file("large_file.dat", "http://example.com/upload")

    ColorPrint.blue(f"Result: {result}")


def test_api_requests():
    """Test API request handler"""
    ColorPrint.green("\n=== Test 5: API Requests ===")

    handler = APIRequestHandler()

    # Critical request (uses busy state)
    ColorPrint.blue("\nCritical Request:")
    result1 = handler.handle_critical_request({"type": "payment"})
    ColorPrint.blue(f"Result: {result1}")

    # Simple query (no busy state)
    ColorPrint.blue("\nSimple Query:")
    result2 = handler.handle_simple_query("SELECT * FROM users LIMIT 10")
    ColorPrint.blue(f"Result: {result2}")


def main():
    """Run all tests"""
    ColorPrint.green("=" * 70)
    ColorPrint.green(" Task Busy State Examples")
    ColorPrint.green("=" * 70)

    # Run tests
    test_simple_task()
    test_batch_tasks()
    test_database_transaction()
    test_file_upload()
    test_api_requests()

    ColorPrint.green("\n" + "=" * 70)
    ColorPrint.green(" All Tests Completed")
    ColorPrint.green("=" * 70)

    # Final busy state check
    is_busy = THREAD_BUS.is_busy()
    ColorPrint.blue(f"\nFinal busy state: {is_busy}")

    if is_busy:
        ColorPrint.yellow(f"Warning: Busy state still set: {THREAD_BUS.get_busy_reason()}")


if __name__ == "__main__":
    main()
