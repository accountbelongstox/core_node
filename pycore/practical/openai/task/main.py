
import json
import re
import pyperclip
from pycore.base.base import Base
from task_parse import task_parse
from task_waiting_queue import task_waiting_queue
from task_extra import task_extra
from task_db import task_db
from pycore.globalvers import outdir

class TaskMain(Base):


    def publish_task(self):
    调用 “”“添加方法：根据一个  project_dir或 id，获取  等待队列（也即是  file_path） 同时清空 等待队列”“” ，便利并读取文件使用Base.read_text读取，调用   task_extra.extra_from_content,得到一个tasks[{
    filename,filepath,发布时间，提示词长度，提示词，id,project_dir
}]
    调用task_db的追加方法
        pass



    def get_task_id(self, project_dir):
        project_dir = os.path.abspath(project_dir).rstrip('/')
        return md5(project_dir.encode()).hexdigest()

    def check_from_content(self, content):
        return self.regex_pattern.search(content) is not None


task_main = TaskMain()