import html
import json
import base64
import random
import string
import secrets
import re
import time
import hashlib
import zlib
from datetime import datetime, date, time as datatime_time
from string import Template
import platform

class Strtool():

    def __init__(self):
        pass

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

    def isnull(self, data):
        if isinstance(data, bool):
            return data
        if isinstance(data, str):
            data = data.strip()
        if data in [None, "", 'Null', 'null', 'false', 0, "0", "0.0", 0.0]:
            return True
        elif self.is_number(data):
            if int(data) <= 0:
                return True
        elif isinstance(data, dict):
            if len(data.keys()) == 0:
                return True
        elif isinstance(data, (list, tuple)):
            if len(data) == 0:
                return True
        return False

    def to_value(self, s):
        if isinstance(s, str):
            s_lower = s.lower()
            if s_lower == "null" or s_lower == "none":
                return None
            elif s_lower == "true":
                return True
            elif s_lower == "false":
                return False
            elif self.is_number(s_lower):
                return int(s_lower)
            elif self.is_float(s_lower):
                return float(s_lower)
            date_string = self.is_timestring(s_lower)
            if date_string != None:
                return self.to_datetime(s_lower)
            s = self.to_json(s)
        return s

    def is_notnull(self, obj):
        not_null = not self.isnull(obj)
        return not_null

    def to_unicode(self, a):
        sum = b''
        for x in a:
            if x == 'u':
                sum += b'\u'
            else:
                sum += x.encode()
        return sum

    def create_string_id(self, s_):
        symbol = '-'
        s_ = s_.split(symbol)
        ids = []
        for s in s_:
            tmp_s = self.random_string(s, str.isupper(s))
            ids.append(tmp_s)
        return symbol.join(ids)

    def create_string(self, length=10):
        letters = string.ascii_lowercase
        result = ''.join(random.choice(letters) for i in range(length))
        return result


    def json_str(self, s):
        class MyEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                else:
                    return super().default(obj)

        s = json.dumps(s, cls=MyEncoder)
        return s

    def parse_timetokenstring(self, time_string):
        time_string = time_string.strip()
        add = time_string[0]
        if add in ["+", "-"]:
            time_string = time_string[1:]
        else:
            add = '-'
        time_dict = {'add': add, 'h': 0, 'm': 0, 's': 0}
        time_regex = re.compile(r"(-?\d+)([hms])")
        matches = time_regex.findall(time_string)
        seconds = 0
        for match in matches:
            amount = int(match[0])
            unit = match[1]
            time_dict[unit] = amount
            if unit == "s":
                seconds += amount
            if unit == "m":
                seconds += amount * 60
            if unit == "h":
                seconds += amount * 60 * 60
        time_dict["seconds"] = seconds
        return time_dict

    def parse_exec_time(self, exec_time):
        time_parts = exec_time.split(':')
        hour, minute, second = 0, 0, 0

        if len(time_parts) == 1:  # "s"
            second = int(time_parts[0])
        elif len(time_parts) == 2:  # "m:s"
            minute, second = int(time_parts[0]), int(time_parts[1])
        elif len(time_parts) == 3:  # "h:m:s"
            hour, minute, second = int(time_parts[0]), int(time_parts[1]), int(time_parts[2])

        return hour, minute, second

    def string_to_regex_pattern(self, s):
        # Escape any regex special characters
        escaped_str = re.escape(s)
        # Replace the escaped wildcard character (*) with the regex equivalent (.*)
        regex_pattern = escaped_str.replace("\\*", ".*")
        return regex_pattern

    def find_separate_value(self, segments, key, default_value=None, separator="-", key_value_separator=":"):
        if key_value_separator != None:
            segments = segments.split(key_value_separator)
        if isinstance(segments, str):
            segments = [segments]
        for segment in segments:
            if segment.startswith(key + separator):
                return segment[len(key) + 1:]
        return default_value

    def secondary_division_string(self, s, separator=":", add_separator="->"):
        first_split = s.split(separator)
        if len(first_split) == 2:
            second_split = first_split[1].split(add_separator)
            return second_split
        return ""

    def scale_number(self, number, percentage):
        if isinstance(number, str):
            number = float(number)
        # 将百分比字符串转换为小数
        scale_factor = float(percentage.strip('%')) / 100

        # 按比例缩放数字
        scaled_number = number * scale_factor

        return scaled_number

    def create_fernetkey(self):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()
        return key

    def encrypt(self, s, key):
        return s

    def decrypt(self, s, key):
        return s

    def convert_to_string(self, value):
        if isinstance(value, str) or isinstance(value, int) or isinstance(value, float):
            return value
        if not isinstance(value, str):
            if hasattr(value, "__html__"):
                value = value.__html__()
            else:
                try:
                    value = html.escape(json.dumps(value))
                except:
                    return value
        else:
            return value
        return value

    def reverse_html_escape(self, value):
        if isinstance(value, str):
            value = html.unescape(value)
        elif isinstance(value, (list, tuple)):
            # 对列表或元组中的每个元素递归调用本方法
            value = [self.reverse_html_escape(x) for x in value]
        elif isinstance(value, dict):
            # 对字典中的每个值递归调用本方法
            value = {k: self.reverse_html_escape(v) for k, v in value.items()}
        return value

    def to_int(self, data):
        if isinstance(data, int):
            return data
        elif data in [None, "", "null", False]:
            return 0
        elif isinstance(data, float):
            return int(data)
        elif isinstance(data, str):
            data = "".join(filter(str.isdigit, data))
            if self.is_number(data):
                return int(data)
            else:
                return 0
        elif data is True:
            return 1
        else:
            return 0

    def to_float(self, data):
        if isinstance(data, float):
            return data
        elif data in [None, "", "null", False]:
            return 0.0
        elif isinstance(data, int):
            return float(data)
        elif isinstance(data, str):
            digits = "".join(filter(lambda c: c.isdigit() or c == ".", data))
            if self.is_number(digits):
                return float(digits) if digits else 0.0
            else:
                return 0.0
        elif data is True:
            return 1.0
        else:
            self._warn(f"to_float")
            self._warn(data)
            return 0.0

    def to_date(self, data):
        if isinstance(data, date):
            return data
        elif isinstance(data, datetime):
            return data.date()
        elif data in [None, "", "null", False]:
            return date.fromtimestamp(100000)
        elif isinstance(data, str):
            dataformat = self.is_timestring(data)
            if dataformat:
                data = datetime.strptime(data, dataformat)
                return data.date()
            else:
                return date.fromtimestamp(100000)
        else:
            self._warn(f"to_date")
            self._warn(data)
            return date.fromtimestamp(100000)

    def to_datetime(self, data):
        if isinstance(data, datetime):
            return data
        elif isinstance(data, date):
            return datetime.combine(data, datatime_time.min)
        elif data in [None, "", "null", False]:
            return datetime.fromtimestamp(100000)
        elif isinstance(data, str):
            dataformat = self.is_timestring(data)
            if dataformat:
                return datetime.strptime(data, dataformat)
            else:
                return datetime.fromtimestamp(100000)
        else:
            self._warn(f"to_datetime")
            self._warn(data)
            return datetime.fromtimestamp(100000)

    def to_str(self, data):
        if isinstance(data, str):
            data = data
        elif data in [None, 'Null', 'null', 0, 0.0, False]:
            data = ""
        elif isinstance(data, bytes):
            data = self.byte_to_str(data)
        else:
            data = self.json_tostring(data)
            if not isinstance(data, str):
                data = str(data)
            data = self.convert_to_string(data)
        return data

    def to_bytes(self, data):
        if isinstance(data, bytes):
            return data
        elif isinstance(data, str):
            return data.encode('utf-8')
        else:
            return str(data).encode('utf-8')

    def to_bool(self, data):
        return not self.isnull(data)

    def is_realNone(self, s):
        if s in [None, ""]:
            return True
        return False

    def is_realNones(self, s):
        for item in s:
            if self.is_realNone(item) == False:
                return False
        return True

    def is_wordbetween(self, string1, include_str):
        before = "^[curses.pyc-zA-Z]{1,}("
        after = ')[curses.pyc-zA-Z]{1,}$'
        pattern = re.compile(before + include_str + after)
        match = pattern.match(string1)
        return match is not None

    def replace_map(self, input_string, replacement_map):
        for original_str, replacement_str in replacement_map.items():
            input_string = input_string.replace(original_str, replacement_str)
        return input_string

    def replace_template(self, input_string, replacement_map):
        for original_str, replacement_str in replacement_map.items():
            input_string = input_string.replace("{" + original_str + "}", replacement_str)
        return input_string

    def _warn(self, msg):
        print(f"\033[91mWarning: {msg}\033[0m")

    def _success(self, msg):
        print(f"\033[92mSuccess: {msg}\033[0m")

    def to_red(self, text):
        return f'\033[91m{text}\033[0m'  # Red

    def to_yellow(self, text):
        return f'\033[93m{text}\033[0m'  # Yellow

    def to_blue(self, text):
        return f'\033[94m{text}\033[0m'  # Blue

    def to_green(self, text):
        return f'\033[92m{text}\033[0m'  # Green

    def extend(self, input_str, target_length=20):
        padding_length = max(0, target_length - len(input_str))
        padded_str = input_str + ' ' * padding_length
        return padded_str

    def extract_template_keys(self, input_string):
        pattern = r'\$\{(.*?)\}'
        matches = re.findall(pattern, input_string)
        return matches

    def replace_template(self, _str, template_replace_obj={}):
        template_str = Template(_str)
        template_str = template_str.substitute(template_replace_obj)
        return template_str

    def get_number(self, input_string):
        pattern = r'[-+]?\d*\.\d+|\d+'
        match = re.search(pattern, input_string)
        if match:
            return float(match.group())
        else:
            return 0

    def get_letter(self, input_string):
        pattern = r'[a-zA-Z]+'
        match = re.search(pattern, input_string)
        if match:
            return match.group()
        else:
            return ""
    def generate_id(self):
        system_info = f"{platform.system()}-{platform.release()}-{platform.machine()}"
        hashed_value = hashlib.sha1(system_info.encode()).hexdigest()[:16]
        return hashed_value