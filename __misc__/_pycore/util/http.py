import re
import socket
# import os
import requests
import urllib
from urllib.parse import *
from pycore.base.base import Base
import http.cookiejar
# import time
# from queue import Queue
threadQueue = None
webdownQueue = None

class Http(Base):
    __header = {
        "accept-language": "zh-CN,zh,en;q=0.9",
        "sec-ch-ua": "Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
        "sec-fetch-dest": "empty",
        "Connection": "close",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36"
    }

    def __init__(self):
        requests.adapters.DEFAULT_RETRIES = 5
        pass

    def open_url(self, url, decode="utf-8"):
        cookie = http.cookiejar.CookieJar()
        handler = urllib.request.HTTPCookieProcessor(cookie)
        header = [
            ("accept-language", "zh-CN,zh,en;q=0.9"),
            ("sec-ch-ua", "Not A;Brand\";v=\"99\", \"Chromium\";v=\"102\", \"Google Chrome\";v=\"102"),
            ("sec-ch-ua-mobile", "?0"),
            ("sec-ch-ua-platform", "Windows"),
            ("sec-fetch-dest", "empty"),
            ("sec-fetch-mode", "cors"),
            ("sec-fetch-site", "same-origin"),
            ("user-agent",
             "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36")
        ]
        opener = urllib.request.build_opener(handler)
        opener.addheaders = header
        text = opener.open(url, verify=False)
        content = text.read()
        if type(decode) == str:
            content = content.decode(decode)
        return content

    def get(self, url, data=None, headers=None, text='binary'):
        proxy = {"http": None, "https": None}
        session = requests.Session()
        # session.keep_alive = False
        session.trust_env = False
        headers = self.set_header(headers)
        if type(data) == dict:
            url = url.strip()
            url = url.strip("?")
            url_query = []
            for key, value in data.items():
                url_query.append(f"{key}={value}")
            url_query = "&".join(url_query)
            if url.find("?") == -1:
                url_query = "?" + url_query
            url = url + url_query
        try:
            response = session.get(url, verify=False, proxies=proxy, headers=headers)
        except Exception as e:
            return ''
        content = ''
        if response.status_code == 200:
            if text == 'text':
                content = response.text
            else:
                content = response.content
        return content

    def post(self, url, data={}, json=False, headers=None):
        proxy = {"http": None, "https": None}
        session = requests.Session()
        session.trust_env = False
        headers = self.set_header(headers)
        content = None
        try:
            information = session.post(url, data, verify=False, proxies=proxy, headers=headers)
            information.raise_for_status()
            if information.status_code == 200:
                if json:
                    content = information.json()
                else:
                    content = information.content
                if isinstance(content, bytes):
                    content = content.decode("utf-8")
            return content
        except requests.exceptions.RequestException as e:
            self.warn(f"Error occurred during POST request: {e}")
            if json:
                return {}
            return content

    def set_header(self, headers):
        if type(headers) == dict:
            for key, value in headers.items():
                self.__header[key] = value
        return self.__header

    def post_as_json(self, url, data={}):
        return self.post(url, data, json=True)

    def urlparse(self, url):
        return urlparse(url)

    def is_url(self, url):
        url_parse = urlsplit(url)
        if url_parse.scheme == '':
            return False
        return True

    def extract_url(self, url):
        url_parse = urlsplit(url)
        return url_parse

    def plain_url(self, url):
        url = re.sub(re.compile(r'^.+?\/\/'), '', re.sub(re.compile(r'\s+'), '', url))
        return url

    def get_url_protocol(self, url):
        if '://' in url:
            protocol = url.split('://')[0] + '://'
        else:
            protocol = 'http://'
        return protocol

    def get_url_body(self, url):
        if '://' in url:
            domain = url.split('://')[1]
        else:
            domain = url

        return domain

    def simple_url(self, url):
        if '://' in url:
            hostname = url.split('://')[1].split('/')[0]
        else:
            hostname = url
        if hostname.startswith('www.'):
            hostname = hostname[4:]
        tld_parts = hostname.split('.')[-2:]
        tld = '.'.join(tld_parts)
        return tld

    def test_url(self, url, timeout=3,print_results=False):
        try:
            response = requests.head(url, timeout=timeout)
            is_reachable= response.status_code == 200
        except requests.exceptions.RequestException:
            is_reachable= False
        if print_results:
            print(f"Test URL {url}: {'Success' if is_reachable else 'Failure'}")
        return is_reachable

    def test_urls(self, urls, timeout=3, print_results=False):
        reachable = []
        unreachable = []
        for url in urls:
            is_reachable = self.test_url(url, timeout, print_results)
            if is_reachable:
                reachable.append(url)
            else:
                unreachable.append(url)
        return reachable,unreachable

    def ping_test(self, target, timeout=1):
        try:
            host = socket.gethostbyname(target)
            socket.setdefaulttimeout(timeout)
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((host, 80))
            s.close()
            return True
        except socket.gaierror:
            return False
        except socket.error:
            return False
        except Exception as e:
            self.warn(f"Error occurred during ping test: {e}")
            return False

    def ping_subnet(self, subnet, timeout=0.01, info=False, addips=[]):
        results = {}
        base_ip = '.'.join(subnet.split('.')[:3])
        local_ip = self.get_local_ip()

        # Combine range of IPs and additional IPs
        all_ips = [f"{base_ip}.{i}" for i in range(1, 256)] + addips

        for ip in all_ips:
            if ip == local_ip:
                continue
            try:
                result = self.ping_test(ip, timeout)
                results[ip] = result
                if info:
                    print(f"Ping {ip}: {'Success' if result else 'Failure'}")
            except Exception as e:
                self.warn(f"Error pinging {ip}: {e}")
                results[ip] = False
        return results

    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception as e:
            self.warn(f"Error occurred while getting local IP address: {e}")
            return None