import os
from pycore.base.base import Base

class Fpath(Base):
    sources_name = "public"
    def join(self, *args):
        joined_path = os.path.join(*args)
        return joined_path

    def get_source(self, filename, path=None):
        root_dir = self.getcwd()
        source_dir = os.path.join(root_dir, self.sources_name)
        if path is not None:
            absolute_path = os.path.join(source_dir, path, filename)
        else:
            absolute_path = os.path.join(source_dir, filename)
        return os.path.abspath(absolute_path)

    def get_sources(self, path=None):
        root_dir = self.getcwd()
        source_dir = os.path.join(root_dir,  self.sources_name)
        if path is not None:
            absolute_path = os.path.join(source_dir, path)
        else:
            absolute_path = root_dir

        sources = os.listdir(absolute_path)
        full_paths = [os.path.abspath(os.path.join(absolute_path, source)) for source in sources]

        return full_paths