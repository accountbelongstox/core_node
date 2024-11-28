import base64
import datetime
import json
import os
import platform
import random
import re
import shutil
import string
import sys
import tempfile
import time
from pycore.base.base import Base

class File(Base):
    def __init__(self):
        pass

    def b64encode(self, data_file):
        if self.isfile(data_file):
            extent_file = os.path.splitext(data_file)[1]
            extent_file = extent_file.replace(".", "")
            suffix = "data:image/{};base64,".format(extent_file)
            data = self.open(data_file, 'b')
        else:
            suffix = ""
            data = data_file
        data = base64.b64encode(data)
        data = self.com_string.byte_to_str(data)
        data = suffix + data
        return data

    def rename_remove_space(self, filename):
        space_pattern = re.compile(r"\s+")
        file_space = re.findall(space_pattern, filename)
        if (len(file_space) > 0):
            new_file_name = os.path.basename(filename)
            new_file_name = re.sub(space_pattern, "", new_file_name)
            file_basedir = os.path.dirname(filename)
            new_file = os.path.join(file_basedir, new_file_name)
            self.cut(filename, new_file)
            filename = new_file
        return filename

    def rename(self, filename, new_file):
        new_file = self.normal_path(new_file)
        if not self.is_absolute_path(new_file):
            dirname = os.path.dirname(filename)
            new_file = os.path.join(dirname, new_file)
        try:
            os.rename(filename, new_file)
            filename = new_file
        except OSError as e:
            self.warn(f"Unable to modify file name：{e}")
        return filename

    def read(self, file_name, encoding="utf-8", info=False, readLine=False):
        return super().read(file_name, encoding, info, readLine)

    def read_text(self, file_name, encoding="utf-8", info=False):
        return super().read_text(file_name, encoding, info)

    def read_lines(self, file_name, encoding="utf-8", info=False):
        return super().read_lines(file_name, encoding, info)

    def read_line(self, file_name, encoding="utf-8", info=False):
        return super().read_line(file_name, encoding, info)

    def read_json(self, file_name, encoding="utf-8", info=False):
        return super().read_json(file_name, encoding, info)

    def save(self,  file_name=None, content=None, encoding="utf-8", overwrite=False):
        return super().save(file_name, content, encoding,overwrite)

    def save_json(self, file_name=None, data={}, encoding="utf-8"):
        try:
            file_name = file_name or self.create_file_name()
            # json_content = json.dumps(data, indent=2, ensure_ascii=False)
            json_content = json.dumps(data, indent=2, ensure_ascii=False)
            self.save(file_name, content=json_content, encoding=encoding, overwrite=True)
            # self.success(f"JSON data saved to '{file_name}'.")
            return file_name
        except Exception as e:
            self.warn(f"Failed to save JSON data to file '{file_name}'. Error: {e}")
            return None

    def is_empty(self, file_path):
        if not os.path.exists(file_path):
            return True
        if os.path.isfile(file_path):
            return os.path.getsize(file_path) == 0
        elif os.path.isdir(file_path):
            return self.is_empty_dir(file_path)
        return True

    def is_empty_dir(self, directory_path):
        contents = os.listdir(directory_path)
        return not contents

    def read_bytes(self, file_name):
        file_name = self.resolve_path(file_name)
        if self.isfile(file_name):
            with open(file_name, "rb") as f:
                data = f.read()
            return data
        else:
            return None

    def file_extract(self, filename):
        extract_dir = os.path.dirname(filename)
        return self.zip_extractall(filename, extract_dir)

    def remove(self, top_path):
        print("delete : ", top_path)
        for root, dirs, files in os.walk(top_path, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))
        if os.path.isdir(top_path):
            os.rmdir(top_path)
        elif os.path.isfile(top_path):
            os.remove(top_path)

    def mkdir(self, dir):
        if os.path.exists(dir) and os.path.isdir(dir):
            return False
        else:
            try:
                os.makedirs(dir, exist_ok=True)
            except Exception as e:
                self.warn(e)
            return True

    def mkbasedir(self, dir):
        return super().mkbasedir(dir)


    def isfile(self, path):
        return super().isfile(path)

    def is_dir(self, path):
        return self.isdir(path)

    def isdir(self, path):
        if type(path) is not str:
            return False
        if os.path.exists(path) and os.path.isdir(path):
            return True
        else:
            return False

    def copy(self, src, dst, skip_dirs=None, skip_files=None, info=True):
        if skip_dirs is None:
            skip_dirs = []
        if skip_files is None:
            skip_files = []

        if self.is_empty(dst):
            self.delete(dst)

        if os.path.isfile(src):
            if self.isdir(dst):
                s_file = os.path.basename(src)
                dst = os.path.join(dst, s_file)
            if os.path.exists(dst):
                return
            self.mkbasedir(dst)
            shutil.copy(src, dst)
            if info:
                self.info(f'Copied: {src} to {dst}')
        elif os.path.isdir(src):
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns(*skip_dirs, *skip_files))
            if info:
                self.info(f'Copied: {src} to {dst}')
        else:
            if info:
                self.warn(f"Error: Source '{src}' is neither a file nor a directory.")

    def copy_dir(self, src_dir, dest_dir, overwrite=True, skip_dirs=None, skip_files=None, info=True):
        skip_dirs = skip_dirs or []
        skip_files = skip_files or []

        if not os.path.exists(src_dir):
            self.error(f"Source directory '{src_dir}' does not exist.")
            return

        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        for item in os.listdir(src_dir):
            src_item = os.path.join(src_dir, item)
            dest_item = os.path.join(dest_dir, item)

            if os.path.basename(item) in skip_files or item in skip_dirs:
                if info:
                    self.info(f"Skipping {src_item}")
                continue

            if os.path.isdir(src_item):
                if info:
                    self.info(f"Copying-Dir {src_item} to {dest_item}")
                self.copy_dir(src_item, dest_item, overwrite, skip_dirs, skip_files, info)
            else:
                if not os.path.exists(dest_item) or overwrite:
                    if info:
                        self.info(f"Copying {src_item} to {dest_item}")
                    shutil.copy2(src_item, dest_item)
                elif info:
                    self.info(f"Skipping existing file {dest_item}")

    def cut(self, src, dst):
        if self.isfile(src) and self.isfile(dst):
            # self.warn(f"file cut error: file exists {dst}")
            os.remove(src)
            # os.remove(dst)
            return
        if self.isfile(src):
            dst_basedir = os.path.dirname(dst)
            self.mkdir(dst_basedir)
            shutil.copyfile(src, dst)
            os.remove(src)
        else:
            self.warn(f"file cut error(src no exists):\n src:{src}\n dst:{dst}")

    def wait_cut(self, src, dst, wait=0):
        if wait > 30:
            self.warn(f"down file {src} fail, file cut.")
        else:
            wait += 1
            if not self.isfile(src):
                time.sleep(1)
                return self.wait_cut(src, dst, wait)
            else:
                self.com_util.print_info(f"down cut success: {src}")
                dst_basedir = os.path.dirname(dst)
                self.mkdir(dst_basedir)
                shutil.copyfile(src, dst)
                os.remove(src)

    def rmtree(self, dir):
        shutil.rmtree(dir)


    def dir_normal(self, filename, linux=False):
        filename = re.sub(re.compile(r"[\\\/]+"), "/", filename)
        if self.is_windows() and linux == False:
            # pattern = re.compile(r"[\/]+")
            filename = filename.replace("//", "/")
            filename = filename.replace("/", "\\")
        else:
            filename = filename.replace("//", "/")
        return filename

    def normal_path(self, path):
        return os.path.normpath(path)

    def file_to(self, filename, encoding="utf-8"):
        file_object = self.try_file_encode(filename)
        if file_object == None:
            return False
        file_encode = file_object.get('encoding')
        if file_encode != encoding:
            content = self.read(filename)
            # content = content.encode(encoding)
            os.remove(filename)
            self.save(filename, content, encoding=encoding)
        return True

    def dir_to(self, filedir, encoding="utf-8"):
        files = os.listdir(filedir)
        for file in files:
            file = os.path.join(filedir, file)
            self.file_to(file, encoding)

    def file_suffix(self, file_path, suffix):
        file_path = file_path.split('.')[0:-1]
        suffix = suffix.replace('.', "")
        file_path.append(suffix)
        file_path = ".".join(file_path)
        return file_path

    def get_suffix(self, file_path):
        file_type = os.path.splitext(file_path)[-1]
        suffix = file_type.replace('.', "")
        return suffix

    def get_template_dir(self, filename=None, fulllink=False, absolute=True):
        control_dir = self.load_module.get_control_dir()
        if filename == None:
            filename = ""
        elif filename and fulllink == True:
            top_symbol = re.compile(r'^\/')
            filename = re.sub(top_symbol, '', filename)
        template_folder = self.com_config.get_global("flask_template_folder")
        template_folder = os.path.join(control_dir, template_folder)
        template_folder = self.dir_normal(template_folder)
        filename = os.path.join(template_folder, filename)
        filename = self.dir_normal(filename)
        if absolute == False:
            filename = filename.replace(template_folder, "")
        return filename

    def get_static_dir(self, filename=None, fulllink=False, absolute=True):
        control_dir = self.load_module.get_control_dir()
        if filename == None:
            filename = ""
        elif filename and fulllink == True:
            top_symbol = re.compile(r'^\/')
            filename = re.sub(top_symbol, '', filename)
        template_folder = self.com_config.get_global("flask_static_folder")
        template_folder = os.path.join(control_dir, template_folder)
        template_folder = self.dir_normal(template_folder)
        filename = os.path.join(template_folder, filename)
        filename = self.dir_normal(filename)
        if absolute == False:
            filename = filename.replace(template_folder, "")
        return filename

    def ext(self, file, ext=None):
        file_ext = os.path.splitext(file)[1]
        if ext != None:
            return ext == file_ext
        else:
            return file_ext

    def change_ext(self, file, ext=None):
        if ext == None:
            return file
        else:
            if ext.startswith(".") == False:
                ext = "." + ext
            filedir = str(os.path.splitext(file)[0])
            file = filedir + ext
            return file

    def copy_totmp(self, src_path):
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        shutil.copy(src_path, temp_file.name)
        return temp_file

    def delete_tmp(self, temp_file):
        file_path = temp_file.name
        temp_file.close()
        os.remove(file_path)

    def delete(self, src):
        if not os.path.exists(src):
            return True
        if os.path.isfile(src):
            self.delete_file(src)
        elif os.path.isdir(src):
            self.delete_dir(src)
        else:
            self.warn(f"delete: Source '{src}' is neither curses.pyc file nor curses.pyc directory.")

    def delete_file(self, file_path):
        try:
            os.remove(file_path)
        except OSError as e:
            self.warn(e)

    def delete_dir(self, folder_path):
        self.delete_folder(folder_path)

    def delete_folder(self, folder_path):
        try:
            shutil.rmtree(folder_path)
        except OSError as e:
            self.warn(e)

    def remove_old_subdirs(self, dir_path, pre_fix="", out_time=None, not_include=None, include=None):
        now = datetime.datetime.now()
        for subdir in os.listdir(dir_path):
            subdir_fullname = os.path.join(dir_path, subdir)
            if pre_fix != None:
                if subdir.startswith(pre_fix) == False:
                    continue
            if out_time != None:
                create_time = os.path.getctime(subdir_fullname)
                create_time = datetime.datetime.fromtimestamp(create_time).seconds
                diff_time = now - create_time
                if diff_time < out_time:
                    continue
            if not_include != None:
                not_include = str(not_include)
                if subdir.find(not_include) != -1:
                    continue
            if include != None:
                include = str(include)
                if subdir.find(include) == -1:
                    continue
            try:
                shutil.rmtree(subdir_fullname)
            except Exception as e:
                self.warn(f"remove_old_subdirs {e}")

    def search_file(self, start_path, target_file_name):
        for dirpath, dirnames, filenames in os.walk(start_path):
            for filename in filenames:
                if filename == target_file_name:
                    return os.path.join(dirpath, filename)
        return None

    def is_abs(self, file_path):
        return self.is_absolute_path(file_path)


    def merge_paths(self, base_path, sub_path):
        return os.path.relpath(sub_path, base_path)

    def dir_include(self, dir, prefix):
        file_names = os.listdir(dir)
        # 判断每个文件名是否以指定字符前缀开头
        for file_name in file_names:
            if file_name.startswith(prefix):
                return True
        return False

    def dir_find(self, dir, prefix):
        file_names = os.listdir(dir)
        # 判断每个文件名是否以指定字符前缀开头
        for file_name in file_names:
            if file_name.startswith(prefix):
                return file_name
        return None

    def sanitize_filename(self, filename):
        filename = self.com_string.decode(filename)
        pattern = r'[^curses.pyc-zA-Z0-9_\.]+'
        replaced_string = re.sub(pattern, '_', filename)
        return replaced_string

    def get_ext(self, filename):
        _, ext = os.path.splitext(filename)
        return ext if ext else ''

    def get_not_dot_ext(self, filename):
        _, ext = os.path.splitext(filename)
        return ext[1:] if ext else ''

    def url_tofile(self, url):
        file_name = url.split('/')[-1]
        sanitize_filename = self.sanitize_filename(file_name)
        return sanitize_filename

    def replace_ext(self, path, new_extension, resolve=False):
        base_path, old_extension = os.path.splitext(path)
        new_path = f"{base_path}.{new_extension.strip('.')}"
        new_path = self.resolve_path(new_path, resolve=resolve)
        return new_path

    def file_increment(self, file_path):
        dirname, filename = os.path.split(file_path)
        main_filename, old_extension = os.path.splitext(filename)
        parts = main_filename.split('_')
        if parts[-1].isdigit():
            parts[-1] = str(int(parts[-1]) + 1)
        else:
            parts.append("0")
        new_main_filename = '_'.join(parts)
        new_file_path = os.path.join(dirname, f"{new_main_filename}{old_extension}")
        return new_file_path

    def add_timestamp(self, dir_path):
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        base_name, extension = os.path.splitext(os.path.basename(dir_path))
        new_dir_name = f"{base_name}_{timestamp}{extension}"
        new_dir_path = os.path.join(os.path.dirname(dir_path), new_dir_name)
        return new_dir_path

    def file_add(self, file_path, additional_string="", delimiter="_", resolve=True):
        directory, file_with_extension = os.path.split(file_path)
        base_name, extension = os.path.splitext(file_with_extension)
        new_base_name = f"{base_name}{delimiter}{additional_string}"
        new_file_path = os.path.join(directory, f"{new_base_name}{extension}")
        new_file_path = self.resolve_path(new_file_path, resolve=resolve)
        return new_file_path

    def remove_path(self, base_path, target_path):
        try:
            relative_path = os.path.relpath(target_path, base_path)
            return relative_path if not relative_path.startswith("..") else target_path
        except ValueError:
            # Handle the case where the paths are not compatible
            return target_path

    def get_bin(self, path=''):
        root_dir = self.getcwd()
        bindir = os.path.join(root_dir, "pycore/bin")
        binpath = os.path.join(bindir, path)
        return binpath

    def platform_path(self, drive_letter, folder_path):
        if os.name == 'nt':
            return f"{drive_letter.upper()}:/{os.path.normpath(folder_path)}"
        else:
            return f"/mnt/{drive_letter.lower()}/{os.path.normpath(folder_path)}"

    def get_size(self, file_path, unit='k'):
        if not self.isfile(file_path):
            return 0

        file_size = os.path.getsize(file_path)
        unit = unit.lower()

        if unit in ['m', 'mb']:
            return file_size / (1024 ** 2)
        elif unit in ['g', 'gb']:
            return file_size / (1024 ** 3)
        elif unit in ['t', 'tb']:
            return file_size / (1024 ** 4)
        else:
            return file_size / 1024

    def ensure_base_dir(self,path):
        parent_dir = os.path.dirname(path)
        if not os.path.exists(parent_dir):
            os.makedirs(parent_dir)

    def ensure_dir(self, paths):
        if isinstance(paths, str):
            paths = [paths]
        created_paths = []
        for path in paths:
            if not self.is_absolute_path(path):
                path = self.resolve_path(path)

            if not self.isfile(path) and not self.isdir(path):  # Neither file nor directory exists
                self.mkbasedir(path)  # Ensure parent directories exist
                created_paths.append(path)
            elif self.isfile(path):  # Exists as a file
                self.mkbasedir(path)  # Ensure parent directories exist
            elif not self.isfile(path) and path.endswith(os.path.sep):  # Does not exist and is a directory
                self.mkdir(path)  # Ensure directory exists
                created_paths.append(path)

        return created_paths