#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Example: Batch Media Compression with Thread Pool
Demonstrates multi-threaded compression with task and queue callbacks
"""

from pathlib import Path
from pycore.pyutils import MediaCompressor, CompressionTask, CompressionStats, QueueStats


def task_callback(task_id: str, success: bool, stats: CompressionStats):
    """
    Called when each individual task completes

    Args:
        task_id: Unique task identifier
        success: Whether the task succeeded
        stats: Compression statistics (None if failed)
    """
    if success and stats:
        ratio = stats.compression_ratio
        gpu_status = "GPU" if stats.used_gpu else "CPU"
        print(f"  ✓ Task '{task_id}' completed ({gpu_status}): {ratio:.1f}% compression")
    else:
        print(f"  ✗ Task '{task_id}' failed")


def queue_callback(queue_stats: QueueStats):
    """
    Called when entire queue completes

    Args:
        queue_stats: Final statistics for the entire queue
    """
    total_time = queue_stats.end_time - queue_stats.start_time
    total_saved = queue_stats.total_original_size - queue_stats.total_compressed_size

    print(f"\n{'='*60}")
    print("QUEUE PROCESSING SUMMARY")
    print(f"{'='*60}")
    print(f"Total tasks: {queue_stats.total_tasks}")
    print(f"Completed: {queue_stats.completed_tasks}")
    print(f"Failed: {queue_stats.failed_tasks}")
    print(f"Processing time: {total_time:.2f}s")
    print(f"Total space saved: {total_saved / (1024*1024):.1f} MB")
    print(f"{'='*60}\n")


def progress_callback(completed: int, total: int):
    """
    Called after each task for progress tracking

    Args:
        completed: Number of completed tasks
        total: Total number of tasks
    """
    percentage = (completed / total) * 100
    print(f"Progress: {completed}/{total} ({percentage:.1f}%)")


def main():
    """Main example demonstrating batch compression"""

    # Initialize compressor (auto-detects GPU)
    compressor = MediaCompressor(verbose=True)

    # Print compressor status
    print("\n" + "="*60)
    print("COMPRESSOR STATUS")
    print("="*60)
    status = compressor.get_status_info()
    for key, value in status.items():
        print(f"{key}: {value}")
    print("="*60 + "\n")

    # Example 1: Create batch tasks programmatically
    tasks = []

    # Add image compression tasks
    image_files = [
        ('image1.jpg', 'output1.jpg'),
        ('image2.png', 'output2.jpg'),
        ('image3.jpg', 'output3.jpg'),
    ]

    for idx, (input_file, output_file) in enumerate(image_files, 1):
        task = CompressionTask(
            task_id=f'image_{idx}',
            input_path=Path(input_file),
            output_path=Path(output_file),
            task_type='image',
            options={'quality': 85, 'use_gpu': True},
            callback=task_callback
        )
        tasks.append(task)

    # Add video compression tasks
    video_files = [
        ('video1.mp4', 'output1.mp4'),
        ('video2.mp4', 'output2.mp4'),
    ]

    for idx, (input_file, output_file) in enumerate(video_files, 1):
        task = CompressionTask(
            task_id=f'video_{idx}',
            input_path=Path(input_file),
            output_path=Path(output_file),
            task_type='video',
            options={'crf': 23, 'preset': 'medium', 'use_gpu': True},
            callback=task_callback
        )
        tasks.append(task)

    print(f"\nCreated {len(tasks)} compression tasks")
    print("Starting batch processing with callbacks...\n")

    # Process batch with all callbacks
    final_stats = compressor.process_batch(
        tasks=tasks,
        queue_callback=queue_callback,
        progress_callback=progress_callback
    )

    print("\nBatch processing complete!")
    print(f"Success rate: {final_stats.completed_tasks}/{final_stats.total_tasks}")


if __name__ == '__main__':
    # Note: This example requires actual media files to work
    # Uncomment the line below to run with real files
    # main()

    print("Example script for batch media compression")
    print("To run: Uncomment the main() call and provide actual media files")
    print("\nFeatures demonstrated:")
    print("  - Multi-threaded batch processing")
    print("  - GPU auto-detection and load balancing")
    print("  - Task-level callbacks for each compression")
    print("  - Queue-level callback for batch completion")
    print("  - Progress callbacks for real-time updates")
