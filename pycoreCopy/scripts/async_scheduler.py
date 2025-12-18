from pathlib import Path
import asyncio
from ncore.pyutils.common.window_finder import WindowFinder
from ncore.pyutils.image.image_comparator import ImageComparator
from ncore.pyutils.image.image_crop import ImageCropper
from ncore.pyutils.image.image_matcher import ImageMatcher
from ncore.pyutils.process.process_manager import ProcessManager
from ncore.pyutils.tray.tray_clicker import TrayClicker
from ncore.pyutils.window.window_ops import WindowOps

async def async_task_scheduler():
    # Initialize services
    await WindowFinder.initialize()
    await ImageComparator.initialize()
    await ProcessManager.initialize()
    await WindowOps.initialize()
    await ImageCropper.initialize()
    await ImageMatcher.initialize()
    await TrayClicker.initialize()
    await WindowOps.initialize()

    # Create task queue
    task_queue = asyncio.Queue()

    # Start task processing coroutine
    asyncio.create_task(handle_tasks(task_queue))

    # Example task addition
    task_queue.put("window_finder")
    task_queue.put("image_comparator")
    task_queue.put("image_matcher")

async def handle_tasks(task_queue):
    while True:
        task = await task_queue.get()
        if task is None:
            break

        if task == "window_finder":
            await WindowFinder.find_windows()
        elif task == "image_comparator":
            await ImageComparator.compare_images()
        elif task == "image_matcher":
            await ImageComparator.match_images()
        elif task == "process_manager":
            await ProcessManager.manage_processes()
        elif task == "tray_clicker":
            await TrayClicker.click_tray()
        elif task == "window_ops":
            await WindowOps.operate_windows()

        task_queue.task_done()

# Start scheduler
if __name__ == "__main__":
    asyncio.run(async_task_scheduler())