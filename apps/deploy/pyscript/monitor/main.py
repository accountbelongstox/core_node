# main.py

import time
from pycore.threads import FlaskThread
from apps.deploy.pyscript.flask.flask_config import flask_couter
from apps.deploy.pyscript.flask.flask_router import FlaskRouter
from apps.deploy.pyscript.monitor.task_monitor import task_monitor  # Import TaskRunner class

class Monitor:
    def __init__(self):
        self.is_running = False

    def start(self):
        if not self.is_running:
            self.is_running = True
            flask = FlaskThread(config=flask_couter, router=FlaskRouter)
            flask.start()
            time.sleep(10)
            task_monitor.start()
        else:
            print('Monitor is already running.')

monitor = Monitor()
