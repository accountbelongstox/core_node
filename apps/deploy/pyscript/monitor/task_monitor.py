import threading
import time
from apps.deploy.pyscript.monitor.safe_shutdown import safe_shutdown
from apps.deploy.pyscript.monitor.anti_virus import anti_virus
from pycore.practicals_linux import docker
from pycore.base.base import Base


class TaskMonitor(Base):
    def __init__(self, check_shutdown_interval=30, anti_virus_interval=1):
        self.task_thread = None
        self.is_running = False
        self.default_check_time = 1
        self.check_shutdown_interval = check_shutdown_interval
        self.anti_virus_interval = anti_virus_interval
        self.counter = 0

    def task_list(self):
        while self.is_running:
            print("Running periodic task...")
            self.counter += 1

            if self.counter % self.check_shutdown_interval == 0:
                check_shutdown_interval = safe_shutdown.check_shutdown()
                if not isinstance(check_shutdown_interval, int):
                    check_shutdown_interval = self.default_check_time
                self.check_shutdown_interval = check_shutdown_interval
                if self.check_shutdown_interval >= 30:
                    docker.start_stopped_containers()
            if self.counter % self.anti_virus_interval == 0:
                anti_virus.tick()
            time.sleep(self.default_check_time)

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.task_thread = threading.Thread(target=self.task_list)
            self.task_thread.start()
        else:
            print('TaskRunner is already running.')

task_monitor = TaskMonitor()