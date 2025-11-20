import os
import sys
import subprocess
import shutil
import tempfile
import re
import platform
from pycore.base.base import Base
from pycore.globalvar.gdir import gdir
import uuid
import os
import hashlib


class Source(Base):

    def getDefaultImageFile(self):
        icon = Util.file.get_stylesheet('img/default_app.png')
        return icon

    def getBrowserPath(self, browser):
        browserRegs = {
            'IE': 'SOFTWARE\\Clients\\StartMenuInternet\\IEXPLORE.EXE\\DefaultIcon',
            'chrome': 'SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\DefaultIcon',
            'edge': 'SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\DefaultIcon',
            'firefox': 'SOFTWARE\\Clients\\StartMenuInternet\\FIREFOX.EXE\\DefaultIcon',
            '360': 'SOFTWARE\\Clients\\StartMenuInternet\\360Chrome\\DefaultIcon',
        }

        if self.is_windows():
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, browserRegs[browser])
                value, _ = winreg.QueryValueEx(key, '')
                return value.split(',')[0]
            except Exception as e:
                print(e)
                return None
        else:
            # Get browser path in non-Windows systems
            pass

        return None

    def getBrowserDriverPath(self, driverType):
        if driverType == 'chrome':
            return self.getChromePath()
        else:
            return self.getEdgeInstallPath()

    def getEdgeInstallPath(self):
        possiblePaths = [
            os.path.join(os.getenv('ProgramFiles'), 'Microsoft', 'Edge', 'Application'),
            os.path.join(os.getenv('ProgramFiles(x86)'), 'Microsoft', 'Edge', 'Application'),
        ]
        for path in possiblePaths:
            msedgeExe = os.path.join(path, 'msedge.exe')
            if os.path.exists(msedgeExe):
                return msedgeExe

        return None

    def getEdgeVersion(self, edgeExePath):
        try:
            output = subprocess.check_output(f'"{edgeExePath}" --version', shell=True, encoding='utf-8')
            return output.strip()
        except Exception as e:
            print(f'Error while getting Edge version: {e}')
            return None

    def getChromePath(self):
        chromePath = self.config.get('chrome_path')

        if not os.path.isabs(chromePath):
            chromePath = os.path.join(os.getcwd(), chromePath)

        if not os.path.isfile(chromePath):
            chromePath = self.getBrowserPath('chrome')
            if not chromePath:
                chromePath = self.downloadChromeBinary()

        if chromePath:
            self.config['chrome_path'] = chromePath

        return chromePath

    def getChromeVersion(self):
        versionRe = re.compile(r'\d+\.\d+\.\d+\.\d+')

        if self.is_windows():
            chromePath = self.getChromePath()
            visualElementsManifest = os.path.join(os.path.dirname(chromePath), 'chrome.VisualElementsManifest.xml')
            visualElementsManifestTmp = tempfile.NamedTemporaryFile(delete=False)
            shutil.copy(visualElementsManifest, visualElementsManifestTmp.name)
            with open(visualElementsManifestTmp.name, 'r') as f:
                content = f.read()
                versionMatches = versionRe.findall(content)
                if versionMatches:
                    return versionMatches[0]
                try:
                    key = self.getWindowsRegistryValue('Software\\Google\\Chrome\\BLBeacon', 'version')
                    registryVersion = versionRe.findall(key)
                    return registryVersion[0] if registryVersion else self.config.get('chrome_version')
                except Exception as e:
                    print(e)
                    print('Error getting Chrome version, falling back to config version.')
                    return self.config.get('chrome_version')
            os.unlink(visualElementsManifestTmp.name)
        else:
            try:
                output = subprocess.check_output('google-chrome --version', shell=True, encoding='utf-8')
                versionMatches = versionRe.findall(output)
                return versionMatches[0] if versionMatches else self.config.get('chrome_version')
            except Exception as e:
                print(e)
                print('Error getting Chrome version, falling back to config version.')
                return self.config.get('chrome_version')

    def get_git_executable(self):
        git_executable = "git"  # Default to "git" which works on both Windows and Linux

        return self.find_bin("git",[
                "D:\\applications\\Git\\cmd",
                "C:\\Program Files\\Git\\cmd",
                "C:\\Program Files (x86)\\Git\\cmd"
            ])

    def get_php_executable(self):
        return self.find_bin("php")

    def get_7z_executable(self):
        if self.is_windows():
            executable_path = gdir.getLibraryByWin32Dir("7za.exe")
        else:
            executable_path = gdir.getLibraryByLinuxDir("7z")
        return executable_path


    def find_bin(self, executable, additional_dirs=[]):
        # Check cache first, if not found, search and then store in cache
        default_deep = 10
        find_dirs = [os.path.dirname(os.path.dirname(sys.executable))]
        possible_paths = [
            "/usr/bin/",
            "/usr/local/bin/",
            "/opt/local/bin/",
            "/usr/lib/git-core/",
            "/bin/"
        ] + additional_dirs

        executable_path = None
        if self.is_windows():
            find_dirs += ["D:\\lang_compiler", "D:\\applications\\"]
            windows_possible_paths = [
                "C:\\Program Files\\",
                "C:\\Program Files (x86)\\",
                "C:\\Windows\\System32\\",
                "C:\\Windows\\",
            ] + additional_dirs

            # Add .exe extension if not present
            if not executable.endswith(".exe"):
                executable += ".exe"

            for path in windows_possible_paths:
                full_path = os.path.join(path, executable)
                if os.path.exists(full_path):
                    executable_path = full_path
                    break

            if not executable_path:
                try:
                    result = subprocess.run(["where", executable], capture_output=True, text=True, check=True)
                    if result.stdout:
                        executable_path = result.stdout.splitlines()[0]
                except subprocess.CalledProcessError:
                    pass
        else:
            # Remove .exe extension if present
            if executable.endswith(".exe"):
                executable = executable[:-4]

            for path in possible_paths:
                full_path = os.path.join(path, executable)
                if os.path.exists(full_path):
                    executable_path = full_path
                    break

            if not executable_path:
                try:
                    result = subprocess.run(["which", executable], capture_output=True, text=True, check=True)
                    if result.stdout:
                        executable_path = result.stdout.strip()
                except subprocess.CalledProcessError:
                    pass

        if not executable_path:
            current_dir = os.path.dirname(os.path.abspath(sys.executable))
            executable_path = os.path.join(current_dir, executable)
            if not os.path.exists(executable_path):
                executable_path = None

        if executable_path and not self.is_windows():
            executable_path = executable_path.rstrip(".exe")

        if not executable_path:
            executable_path = self.recursive_search(find_dirs, executable, default_deep)

        return executable_path

    def recursive_search(self, dirs, executable, depth):
        if depth == 0:
            return None

        for dir in dirs:
            for root, _, files in os.walk(dir):
                if executable in files:
                    return os.path.join(root, executable)
                # Stop searching deeper than the specified depth
                if root.count(os.sep) - dir.count(os.sep) >= depth:
                    break

        return None


    def get_system_token(self):
        system_platform = platform.system()
        release = platform.release()
        version = platform.version()
        machine = platform.machine()
        node = platform.node()
        processor = platform.processor()
        mac = uuid.UUID(int=uuid.getnode()).hex[-12:]
        filesystem_info = os.stat('/').st_dev
        unique_string = f"{system_platform}-{release}-{version}-{machine}-{node}-{processor}-{mac}-{filesystem_info}"
        return unique_string
    def get_system_id(self):
        unique_string = self.get_system_token()
        unique_id = hashlib.sha256(unique_string.encode()).hexdigest()
        return unique_id

src = Source()