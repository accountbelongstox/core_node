import os
from pycore.base.base import Base
from pycore.globalvar.gdir import gdir


class Settings(Base):
    def save_to_tmp_settings(self, key, val,appname=""):
        env_file_path = os.path.join(gdir.getLocalDir(appname), f".{key}")
        self.save(env_file_path, val, "utf-8", True)

    def get_to_tmp_settings(self, key,appname=""):
        env_file_path = os.path.join(gdir.getLocalDir(appname), f".{key}")
        line = self.read_line(env_file_path)
        return line