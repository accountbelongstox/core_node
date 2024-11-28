
import subprocess
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

from pycore.base.base import Base
import sys
import tempfile
import re

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
import shutil
import json
import random
import string
import sys
import time
file_codings = [
        "utf-8",
        "utf-16",
        "utf-16le",
        "utf-16BE",
        "gbk",
        "gb2312",
        "us-ascii",
        "ascii",
        "IBM037",
        "IBM437",
        "IBM500",
        "ASMO-708",
        "DOS-720",
        "ibm737",
        "ibm775",
        "ibm850",
        "ibm852",
        "IBM855",
        "ibm857",
        "IBM00858",
        "IBM860",
        "ibm861",
        "DOS-862",
        "IBM863",
        "IBM864",
        "IBM865",
        "cp866",
        "ibm869",
        "IBM870",
        "windows-874",
        "cp875",
        "shift_jis",
        "ks_c_5601-1987",
        "big5",
        "IBM1026",
        "IBM01047",
        "IBM01140",
        "IBM01141",
        "IBM01142",
        "IBM01143",
        "IBM01144",
        "IBM01145",
        "IBM01146",
        "IBM01147",
        "IBM01148",
        "IBM01149",
        "windows-1250",
        "windows-1251",
        "Windows-1252",
        "windows-1253",
        "windows-1254",
        "windows-1255",
        "windows-1256",
        "windows-1257",
        "windows-1258",
        "Johab",
        "macintosh",
        "x-mac-japanese",
        "x-mac-chinesetrad",
        "x-mac-korean",
        "x-mac-arabic",
        "x-mac-hebrew",
        "x-mac-greek",
        "x-mac-cyrillic",
        "x-mac-chinesesimp",
        "x-mac-romanian",
        "x-mac-ukrainian",
        "x-mac-thai",
        "x-mac-ce",
        "x-mac-icelandic",
        "x-mac-turkish",
        "x-mac-croatian",
        "utf-32",
        "utf-32BE",
        "x-Chinese-CNS",
        "x-cp20001",
        "x-Chinese-Eten",
        "x-cp20003",
        "x-cp20004",
        "x-cp20005",
        "x-IA5",
        "x-IA5-German",
        "x-IA5-Swedish",
        "x-IA5-Norwegian",
        "x-cp20261",
        "x-cp20269",
        "IBM273",
        "IBM277",
        "IBM278",
        "IBM280",
        "IBM284",
        "IBM285",
        "IBM290",
        "IBM297",
        "IBM420",
        "IBM423",
        "IBM424",
        "x-EBCDIC-KoreanExtended",
        "IBM-Thai",
        "koi8-r",
        "IBM871",
        "IBM880",
        "IBM905",
        "IBM00924",
        "EUC-JP",
        "x-cp20936",
        "x-cp20949",
        "cp1025",
        "koi8-u",
        "iso-8859-1",
        "iso-8859-2",
        "iso-8859-3",
        "iso-8859-4",
        "iso-8859-5",
        "iso-8859-6",
        "iso-8859-7",
        "iso-8859-8",
        "iso-8859-9",
        "iso-8859-13",
        "iso-8859-15",
        "x-Europa",
        "iso-8859-8-i",
        "iso-2022-jp",
        "csISO2022JP",
        "iso-2022-jp",
        "iso-2022-kr",
        "x-cp50227",
        "euc-jp",
        "EUC-CN",
        "euc-kr",
        "hz-gb-2312",
        "GB18030",
        "x-iscii-de",
        "x-iscii-be",
        "x-iscii-ta",
        "x-iscii-te",
        "x-iscii-as",
        "x-iscii-or",
        "x-iscii-ka",
        "x-iscii-ma",
        "x-iscii-gu",
        "x-iscii-pa",
        "utf-7",
    ]

class Base(Log):

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

    def getcwd(self, file=None, suffix=""):
        if file == None:
            main_file_path = os.path.abspath(sys.argv[0])
            cwd = os.path.dirname(main_file_path)
        else:
            cwd = os.path.dirname(file)
        if suffix != "":
            cwd = os.path.join(cwd, suffix)
        return cwd
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

    def exec_cmd(self, command, info=True):
        if isinstance(command, list):
            command = " ".join(command)
        if info:
            self.info(f"exec_cmd: {command}")
        os.system(command)
        if platform.system() == "Linux":
            result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    executable="/bin/bash")
        else:
            result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, )
        if result.returncode == 0:
            if info:
                self.info(self.byte_to_str(result.stdout))
                self.warn(self.byte_to_str(result.stderr))
            return self.byte_to_str(result.stdout)
        else:
            if info:
                self.warn(self.byte_to_str(result.stderr))
            return self.byte_to_str(result.stderr)

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
            command = " ".join(command)
        else:
            executable = command.split(' ')[0]

        if info:
            self.info(f"exec_cmd: {command}")

        if platform.system() == "Linux":
            result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    executable="/bin/bash")
        else:
            if os.path.isabs(executable):
                result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        executable=executable)
            else:
                result = subprocess.run(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                        executable=shutil.which(executable))

        if result.returncode == 0:
            if info:
                self.info(self.byte_to_str(result.stdout))
                self.warn(self.byte_to_str(result.stderr))
            return self.byte_to_str(result.stdout)
        else:
            if info:
                self.warn(self.byte_to_str(result.stderr))
            return self.byte_to_str(result.stderr)

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


    def easy_log(self, log_text, log_type="info", max_total_size_mb=500, log_filename=None, max_file=5, cwd=None):
        if not cwd:
            cwd = self.get_cwd()
        self.write_log(log_text, log_type, max_total_size_mb, log_filename, max_file, cwd)

    def get_env(self, key):
        env_arr = self.read_env()
        for subarr in env_arr:
            if subarr[0] == key:
                return subarr[1]
        return ""

    def warn(self, *args, show=True):
        yellow_color = '\033[93m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(yellow_color, msg)
            else:
                self.easy_log(msg, "warn")

    def error(self, *args, show=True):
        red_color = '\033[91m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            self._print_formatted(red_color, msg)
            self.easy_log(msg, "error")

    def success(self, *args, show=True):
        green_color = '\033[92m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(green_color, msg)
            else:
                self.easy_log(msg, "success")

    def info(self, *args, show=True):
        blue_color = '\033[94m'
        no_print_value = self.get_env("NO_PRINT")
        if no_print_value and no_print_value.lower() == "true":
            show = False
        for msg in args:
            if show:
                self._print_formatted(blue_color, msg)
            else:
                self.easy_log(msg, "info")

    def pprint(self, data):
        blue_color = '\033[94m'
        self._print_formatted(blue_color, data)

    def _print_formatted(self, color_code, msg):
        end_color = '\033[0m'
        if isinstance(msg, (list, dict, tuple)):
            pprint(msg)
        else:
            print(f"{color_code}{msg}{end_color}")

    def info_log(self, *args):
        blue_color = '\033[94m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(blue_color, msg)
            else:
                self.easy_log(msg, "info")

    def success_log(self, *args):
        green_color = '\033[92m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(green_color, msg)
            else:
                self.easy_log(msg, "success")

    def warn_log(self, *args):
        yellow_color = '\033[93m'
        show = self.should_print()
        for msg in args:
            if show:
                self._print_formatted(yellow_color, msg)
            else:
                self.easy_log(msg, "warn")

    def error_log(self, *args):
        red_color = '\033[91m'
        show = self.should_print()
        for msg in args:
            self._print_formatted(red_color, msg)
            self.easy_log(msg, "error")

    def should_print(self):
        no_print_value = self.get_env("NO_PRINT")
        return not (no_print_value and no_print_value.lower() == "true")


class Env(Base):
    main_env_file = None
    local_env_file = None
    root_dir = ""
    annotation_symbol = "#"
    example_env_file = ""
    command_line_args = sys.argv[1:]


    def __init__(self, root_dir=None, env_name=".env", delimiter="="):
        if root_dir == None:
            root_dir = self.get_root_dir()
        else:
            root_dir = self.resolve_path(root_dir)
        self.set_root_dir(root_dir, env_name, delimiter=delimiter)

    def get_root_dir(self):
        main_file_path = os.path.abspath(sys.argv[0])
        root_path = os.path.dirname(main_file_path)
        return root_path

    def resolve_path(self, path, relative_path=None, resolve=True):
        if resolve == False:
            return path
        if not os.path.isabs(path):
            if os.path.exists(path):
                return os.path.abspath(path)
            root_path = self.get_root_dir()
            if relative_path != None:
                root_path = os.path.join(root_path, relative_path)
            path = os.path.join(root_path, path)
        return path
    def set_delimiter(self, delimiter="="):
        self.delimiter = delimiter

    def example_to(self, example_path):
        env_file = example_path.replace("-example", "")
        env_file = env_file.replace("_example", "")
        env_file = env_file.replace(".example", "")
        self.merge_env(env_file, example_path)

    def is_file(self, path):
        if not isinstance(path, str):
            return False
        return self.isfile(path)


    def save_key_to_tmp(self, key, val, force=False):
        tmp_dir = self.get_local_dir()
        filename = os.path.join(tmp_dir, f".{key}")
        if not force and os.path.exists(filename):
            return
        try:
            with open(filename, 'w') as file:
                file.write(val)
        except Exception as e:
            self.warn(f"save_key_to_tmp: {e}")
            return

    def get_local_dir(self):
        basedir = self.get_basedir(self.root_dir)
        tmp_dir = "/usr/.tmp_dir"
        return tmp_dir

    def get_basedir(self, root_dir):
        return os.path.basename(root_dir)

    def set_root_dir(self, root_dir, env_name=".env", delimiter="="):
        self.set_delimiter(delimiter)
        self.root_dir = root_dir
        self.local_env_file = os.path.join(self.root_dir, env_name)
        example_env_file = os.path.join(self.root_dir, env_name + '_example')
        if not self.isfile(example_env_file):
            example_env_file = os.path.join(self.root_dir, env_name + '-example')
        if not self.isfile(example_env_file):
            example_env_file = os.path.join(self.root_dir, env_name + '.example')
        self.example_env_file = example_env_file
        self.get_local_env_file()

    def load(self, root_dir, env_name=".env", delimiter="="):
        return Env(root_dir=root_dir, env_name=env_name, delimiter=delimiter)

    def get_local_env_file(self):
        if not self.isfile(self.local_env_file):
            self.save(self.local_env_file, "")
        self.merge_env(self.local_env_file, self.example_env_file)
        return self.local_env_file

    def get_env_file(self):
        return self.local_env_file

    def arr_to_dict(self, array):
        result = {}
        for item in array:
            if isinstance(item, list) and len(item) > 1:
                key, val = item[0], item[1]
                result[key] = val
        return result

    def dict_to_arr(self, dictionary):
        result = []
        for key, value in dictionary.items():
            result.append([key, value])
        return result

    def merge_env(self, env_file, example_env_file):
        if self.isfile(example_env_file) == False:
            return
        example_arr = self.read_env(example_env_file)
        local_arr = self.read_env(env_file)
        added_keys = []
        example_dict = self.arr_to_dict(example_arr)
        local_dict = self.arr_to_dict(local_arr)
        for key, value in example_dict.items():
            self.save_key_to_tmp(key, value,False)
            if key not in local_dict:
                local_dict[key] = value
                added_keys.append(key)
        if len(added_keys) > 0:
            self.success(f"Env-Update env: {env_file}")
            local_arr = self.dict_to_arr(local_dict)
            self.save_env(local_arr, env_file)
        for added_key in added_keys:
            self.success(f"Env-Added key: {added_key}")

    def read_key(self, key):
        with open(self.main_env_file, 'r') as file:
            for line in file:
                k, v = line.partition(self.delimiter)[::2]
                if k.strip() == key:
                    return v.strip()
        return None

    def replace_or_add_key(self, key, val):
        updated = False
        lines = []
        with open(self.main_env_file, 'r') as file:
            for line in file:
                k, v = line.partition(self.delimiter)[::2]
                if k.strip() == key:
                    line = f"{key}{self.delimiter}{val}\n"
                    updated = True
                lines.append(line)

        if not updated:
            lines.append(f"{key}{self.delimiter}{val}\n")
        content = "\n".join(lines)
        self.save(self.main_env_file, content, overwrite=True)

    def read(self, file_name, encoding="utf-8", info=False, readLine=False):
        file_name = self.resolve_path(file_name)
        if not self.isfile(file_name):
            self.warn(f"File '{file_name}' does not exist.")
            return None
        file_object = self.try_file_encode(file_name, encoding=encoding, info=info, readLines=readLine)
        if file_object == None:
            self.warn(f"Unable to read file '{file_name}' with {encoding} encoding.")
        return file_object

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

    def read_lines(self, file_name, encoding="utf-8", info=False):
        file_object = self.read(file_name, encoding=encoding, info=info, readLine=True)
        lines = None
        if file_object != None:
            lines = file_object.get("content")
        return lines

    def read_env(self, file_path=None):
        if file_path is None:
            file_path = self.local_env_file
        result = []
        lines = self.read_lines(file_path)
        for line in lines:
            line_values = [value.strip() for value in line.split(self.delimiter)]
            result.append(line_values)
        return result

    def get_envs(self, file_path=None):
        return self.read_env(file_path=file_path)

    def save_env(self, env_arr, file_path=None):
        if file_path == None:
            file_path = self.local_env_file
        filtered_env_arr = [subarr for subarr in env_arr if len(subarr) == 2]
        formatted_lines = [f'{subarr[0]}{self.delimiter}{subarr[1]}' for subarr in filtered_env_arr]
        result_string = '\n'.join(formatted_lines)
        self.save(file_path, result_string, overwrite=True)

    def set_env(self, key, value, file_path=None):
        if file_path is None:
            file_path = self.local_env_file
        env_arr = self.read_env(file_path=file_path)
        key_exists = False
        for subarr in env_arr:
            if subarr[0] == key:
                subarr[1] = value
                key_exists = True
                break
        if not key_exists:
            env_arr.append([key, value])

        self.save_key_to_tmp(key, value, True)
        self.save_env(env_arr, file_path)

    def get_arg(self, name):
        if isinstance(name, int):
            name = name + 1
            if len(sys.argv) > name:
                return sys.argv[name]
            else:
                return None
        for i, arg in enumerate(self.command_line_args):
            if re.match(r"^[\-]*" + re.escape(name) + r"($|=|-|:)", arg):
                if f"{name}:" in arg:
                    return arg.split(":")[1]
                elif arg == f"--{name}" or arg == f"-{name}" or re.match(r"^-{0,1}\*{1}" + re.escape(name), arg):
                    if i + 1 < len(self.command_line_args):
                        return self.command_line_args[i + 1]
                    else:
                        return None
                elif arg == name:
                    if i + 1 < len(self.command_line_args) and not self.command_line_args[i + 1].startswith("-"):
                        return self.command_line_args[i + 1]
                    else:
                        return ""
        return None

    def is_arg(self, name):
        return self.get_arg(name) != None


    def is_env(self, key, file_path=None):
        is_arg = self.is_arg("is_env")
        val = self.get_env(key=key, file_path=file_path)
        if val == "":
            if is_arg == True:
                print("False")
            return False
        if is_arg == True:
            print("True")
        return True

    def get_env(self, key, default_val=""):
        env_arr = self.read_env()
        tmp_dir = self.get_local_dir()
        env_arr_tmp = self.read_tmp_env(tmp_dir)
        env_arr.extend(env_arr_tmp)

        val = ""

        for subarr in env_arr:
            if subarr[0] == key:
                val = subarr[1]
                break
        if val is None or val == "":
            val = default_val
        self.save_key_to_tmp(key, val, True)
        return val

    def read_tmp_env(self, tmp_dir):
        keys = [f for f in os.listdir(tmp_dir) if os.path.isfile(os.path.join(tmp_dir, f)) and f.startswith('.')]
        env_arr_tmp = []
        for key in keys:
            filename = os.path.join(tmp_dir, key)
            with open(filename, 'r') as file:
                value = file.read()
            env_arr_tmp.append([key.lstrip('.'), value])
        return env_arr_tmp

    def get_args(self):
        return self.command_line_args

env = Env()
