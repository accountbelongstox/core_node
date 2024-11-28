import os
from pprint import pprint
# from pprint import PrettyPrinter
# import datetime
import sys
from pycore.base.log import Log
# from glob import glob
global_modes = {}
import hashlib
import platform
import uuid
import subprocess
import shutil
import json
import random
import sys
import re
import time
from pycore.base.types import file_codings
from pycore.globalvar.encyclopedia import encyclopedia
from pycore.base.log import log
# from pycore.globalvar.gdir import gdir

class Base():

    def __setattr__(self, key, value):
        self.__dict__[key] = value

    def __set__(self, instance, value):
        self.__dict__[instance] = value

    def __get__(self, item):
        return self.__dict__.get(item)

    def __getattr__(self, key):
        global global_modes
        if key in global_modes:
            return global_modes[key]
        elif '_' in key:
            mode, method_name = key.split('_', 1)
            if mode in global_modes and method_name in global_modes[mode]:
                return global_modes[mode][method_name]
        return self.__dict__.get(key)

    def random_string(self, n=64, upper=False):
        if type(n) == str:
            n = len(n)
        m = random.randint(1, n)
        a = "".join([str(random.randint(0, 9)) for _ in range(m)])
        b = "".join([random.choice(string.ascii_letters) for _ in range(n - m)])
        s = ''.join(random.sample(list(a + b), n))
        if upper == True:
            s = s.upper()
        else:
            s = s.lower()
        return s

    def create_file_name(self, suffix="", prefix=''):
        filename = self.random_string(16)
        save_time = self.create_time()
        if prefix != '':
            prefix = f"{prefix}_"
        filename = f"{prefix}{save_time}_{filename}{suffix}"
        filename = os.path.join(self.getcwd(), "out/tmp/" + filename)
        return filename

    def create_time(self, ):
        t = time.strftime("%Y_%m_%d_%H_%M_%S", time.localtime())
        return t

    def md5(self, value):
        hash = hashlib.md5()
        hash.update(value.encode())
        return hash.hexdigest()

    def md5id(self,srcvalue):
        msd5str = self.md5(srcvalue)
        return f"id_{msd5str}"

    def gen_id(self):
        return str(uuid.uuid4())

    def is_windows(self):
        return platform.system() == 'Windows'

    def is_linux(self):
        return platform.system() == 'Linux'

    def get_system_name(self):
        return platform.system()

    def mkdir(self,dir_path):
        try:
            os.makedirs(dir_path, exist_ok=True)
            return True
        except Exception as error:
            print(f'Error creating directory Base Class "{dir_path}": {error}')
            return False

    def getcwd(self, suffix=""):
        current_file_path = os.path.abspath(__file__)
        up_up_dir = os.path.dirname(os.path.dirname(current_file_path))
        if suffix:
            up_up_dir = os.path.join(up_up_dir, suffix)
        return up_up_dir

    def read(self, file_name, encoding="utf-8", info=False, readLine=False):
        file_name = self.resolve_path(file_name)
        if not self.isfile(file_name):
            self.warn(f"File '{file_name}' does not exist.")
            return None
        file_object = self.try_file_encode(file_name, encoding=encoding, info=info, readLines=readLine)
        if file_object == None:
            self.warn(f"Unable to read file '{file_name}' with {encoding} encoding.")
        return file_object

    def read_text(self, file_name, encoding="utf-8", info=False):
        file_object = self.read(file_name, encoding=encoding, info=info)
        content = None
        if file_object != None:
            content = file_object.get("content")
        return content

    def read_lines(self, file_name, encoding="utf-8", info=False):
        file_object = self.read(file_name, encoding=encoding, info=info, readLine=True)
        lines = None
        if file_object != None:
            lines = file_object.get("content")
        return lines

    def read_line(self, file_name, encoding="utf-8", info=False):
        file_object = self.read(file_name, encoding=encoding, info=info, readLine=True)
        line = ""
        if file_object is not None:
            content = file_object.get("content", [])
            if content:
                line = content[0]  # Get the first line
        return line

    def read_json(self, file_name, encoding="utf-8", info=False):
        file_object = self.read(file_name, encoding=encoding, info=info)
        if file_object is not None:
            try:
                content = file_object.get("content")
                json_data = json.loads(content)
                return json_data
            except json.JSONDecodeError as e:
                self.warn(f"Failed to parse JSON from file '{file_name}'. Error: {e}")
                return {}
        return {}

    def save(self, file_name=None, content=None, encoding="utf-8", overwrite=False):
        if file_name is None:
            file_name = self.create_file_name()
        if content is None:
            return None
        if isinstance(content, list):
            content = "\n".join(content)
        if not self.is_absolute_path(file_name) and not self.isfile(file_name):
            tmp_dir = tempfile.gettempdir()
            file_name = os.path.join(tmp_dir, file_name)
        self.mkbasedir(file_name)
        if overwrite:
            mode = "wb"
        else:
            mode = "ab"
        try:
            with open(file_name, mode) as file:
                if encoding == "binary":
                    if isinstance(content, bytes):
                        file.write(content)
                    else:
                        file.write(content.encode('utf-8'))
                else:
                    file.write(content.encode(encoding))
        except Exception as e:
            self.warn(f"save: {e}")
            return None
        return file_name


    def isfile(self, path):
        if type(path) is not str:
            return False
        path = self.resolve_path(path)
        if os.path.exists(path) and os.path.isfile(path):
            return True
        else:
            return False

    def mkbasedir(self, dir):
        dir = os.path.dirname(dir)
        return self.mkdir(dir)

    def is_absolute_path(self, file_path):
        return os.path.isabs(file_path)

    def resolve_path(self, path, relative_path=None, resolve=True):
        if resolve == False:
            return path
        if not os.path.isabs(path):
            if os.path.exists(path):
                return os.path.abspath(path)
            root_path = self.getcwd()
            if relative_path != None:
                root_path = os.path.join(root_path, relative_path)
            path = os.path.join(root_path, path)
        return path

    def try_file_encode(self, file_name, encoding=None, info=False, readLines=False):
        if encoding != None:
            codings = [encoding] + file_codings
        else:
            codings = file_codings
        index = 0
        while index < len(codings):
            encoding = codings[index]
            try:
                f = open(file_name, f"r+", encoding=encoding)
                if readLines == False:
                    content = f.read()
                else:
                    content = f.readlines()
                if info == True:
                    self.success(f"Successfully mode {encoding} to {file_name}")
                f.close()
                result = {
                    "encoding": encoding,
                    "content": content,
                }
                return result
            except Exception as e:
                self.error(e, file_name)
                index += 1
        return None


    def run_exe(self, command, info=True):
        command = "start " + command if self.is_windows() else command
        try:
            result = subprocess.run(command, capture_output=True, text=True, shell=True, check=True)
            if info:
                self.info(f"Run-Exe-command : {command}")
                self.info(result.stdout)
                if result.stderr:
                    self.warn(result.stderr)
            return result.stdout + result.stderr

        except subprocess.CalledProcessError as e:
            print("Error run_exe:", command)
            print("Error run_exe:", e)
            return ""

    def exec_cmd(self, command, info=True):
        if isinstance(command, list):
            executable = command[0]
            command = " ".join(str(cmd) for cmd in command)
        else:
            executable = command.split(' ')[0]

        if info:
            self.success(f"Executing command: {command}")

        if platform.system() == "Linux":
            process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       executable="/bin/bash", bufsize=1, universal_newlines=True)
        else:
            if os.path.isabs(executable):
                process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                           executable=executable, bufsize=1, universal_newlines=True)
            else:
                process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                           executable=shutil.which(executable), bufsize=1, universal_newlines=True)

        stdout_lines = []
        stderr_lines = []

        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                stdout_lines.append(output.strip())
                if info:
                    self.info(output.strip())

        stderr_output = process.stderr.read()
        if stderr_output:
            stderr_lines.append(stderr_output.strip())
            if info:
                self.warn(stderr_output.strip())

        return_code = process.poll()

        std = ''
        err = ''
        if return_code == 0:
            std= "\n".join(stdout_lines)
            std = self.byte_to_str(std)
        else:
            err= "\n".join(stderr_lines)
            err = self.byte_to_str(err)
        return std + "\n" + err

    def byte_to_str(self, astr):
        try:
            astr = astr.decode('utf-8')
            return astr
        except:
            astr = str(astr)
            is_byte = re.compile('^b\'{0,1}')
            if re.search(is_byte, astr) is not None:
                astr = re.sub(re.compile('^b\'{0,1}'), '', astr)
                astr = re.sub(re.compile('\'{0,1}$'), '', astr)
            return astr

    def get_env_file(self):
        return os.path.join(self.getcwd(), ".env")

    def read_env(self):
        file_path = self.get_env_file()
        lines = []
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as file:
                lines = file.readlines()
        result = []
        for line in lines:
            line_values = [value.strip() for value in line.split('=')]
            result.append(line_values)
        return result

    def save_env(self, env_arr):
        filtered_env_arr = [subarr for subarr in env_arr if len(subarr) == 2]
        formatted_lines = [f'{subarr[0]}={subarr[1]}' for subarr in filtered_env_arr]
        result_string = '\n'.join(formatted_lines)
        env_file_path = self.get_env_file()
        try:
            with open(env_file_path, 'w', encoding='utf-8') as file:
                file.write(result_string)
        except Exception as e:
            print(f"Base-Class: Error saving environment variables: {str(e)}")

    def set_env(self, key, value):
        env_arr = self.read_env()
        key_exists = False
        for subarr in env_arr:
            if subarr[0] == key:
                subarr[1] = value
                key_exists = True
                break
        if not key_exists:
            env_arr.append([key, value])
        self.save_env(env_arr)

    def is_env(self, key):
        val = self.get_env(key=key, )
        if val == "":
            return False
        return True

    def getcwd(self,file=None,suffix=""):
        if file == None:
            cwd = __file__.split('pycore')[0]
        else:
            cwd = os.path.dirname(file)
        cwd = os.path.join(cwd,suffix)
        return cwd

    def get_cwd(self,file=None,suffix=""):
        return self.getcwd(file=file,suffix=suffix)

    def get_log_dir(self):
        return log.get_log_dir()

    def get_out_dir(self):
        return self.getcwd(suffix="out")

    def warn(self, *args, show=True, log_filename="default_log"):
        yellow_color = '\033[93m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(yellow_color, msg)
            else:
                log.easy_log(msg, "warn", log_filename)

    def error(self, *args, show=True, log_filename="default_log"):
        red_color = '\033[91m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            self._print_formatted(red_color, msg)
            log.easy_log(msg, "error", log_filename)

    def success(self, *args, show=True, log_filename="default_log"):
        green_color = '\033[92m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(green_color, msg)
            else:
                log.easy_log(msg, "success", log_filename)

    def info(self, *args, show=True, log_filename="default_log"):
        blue_color = '\033[94m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(blue_color, msg)
            else:
                log.easy_log(msg, "info", log_filename)

    def info_log(self, *args, log_filename="default_log"):
        for msg in args:
            if self.should_print():
                self._print_formatted('\033[94m', msg)
            log.easy_log(msg, "info", log_filename)

    def success_log(self, *args, log_filename="default_log"):
        for msg in args:
            if self.should_print():
                self._print_formatted('\033[92m', msg)
            log.easy_log(msg, "success", log_filename)

    def warn_log(self, *args, log_filename="default_log"):
        for msg in args:
            if self.should_print():
                self._print_formatted('\033[93m', msg)
            log.easy_log(msg, "warn", log_filename)

    def error_log(self, *args, log_filename="default_log"):
        for msg in args:
            self._print_formatted('\033[91m', msg)
            log.easy_log(msg, "error", log_filename)

    def read_log(self, log_filename=None, read_mode="text", start_time=None, end_time=None, max_lines=1000):
        return log.read_log(log_filename=log_filename, read_mode=read_mode, start_time=start_time, end_time=end_time, max_lines=max_lines)
            
    def get_env(self, key):
        env_arr = self.read_env()
        for subarr in env_arr:
            if subarr[0] == key:
                return subarr[1]
        return ""

    def pprint(self, data):
        blue_color = '\033[94m'
        self._print_formatted(blue_color, data)

    def _print_formatted(self, color_code, msg):
        end_color = '\033[0m'
        if isinstance(msg, (list, dict, tuple)):
            pprint(msg)
        else:
            print(f"{color_code}{msg}{end_color}")


    def should_print(self):
        # no_print_value = self.get_env("NO_PRINT")
        # return not (no_print_value and no_print_value.lower() == "true")
        return True