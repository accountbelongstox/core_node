import os
import shutil
import errno
import http.client
from pycore.base.base import Base
import platform

class Gdir(Base):
    intranetIPAddress = "http://192.168.100.5/"
    localStaticHttpsApiUrl = "https://static.local.12gm.com:905/"
    localStaticHttpApiUrl = "http://static.local.12gm.com:805/"
    testAccessibleApi = None
    tmp_dir = "/tmp/"

    def __init__(self):
        super().__init__()

    def _mkdir(self,dir):
        if os.path.exists(dir) and os.path.isdir(dir):
            return False
        else:
            try:
                os.makedirs(dir, exist_ok=True)
            except Exception as e:
                self.warn(e)
            return True

    def _mkbasedir(self, dir):
        basedir = os.path.dirname(dir)
        if not os.path.exists(basedir):
            os.makedirs(basedir)

    def getDesktopFile(self, param=None):
        desktopPath = os.path.join(os.path.expanduser("~"), 'Desktop')
        return os.path.join(desktopPath, param) if param else desktopPath

    def getCustomTempDir(self, subDir=None):
        unixStylePath = os.path.abspath(__file__).replace('\\', '/')
        Driver = unixStylePath[0] + ":/"
        temp = os.path.join(Driver, '.tmp')
        fullPath = os.path.join(temp, subDir) if subDir else temp
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getRelationRootDir(self, subDir=None):
        cwd = os.path.abspath(os.path.join(__file__, '../../../'))
        fullPath = os.path.join(cwd, subDir) if subDir else cwd
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getUserProfileDir(self, subDir=None):
        os_name = platform.system()
        if os_name == 'Linux':
            userProfileDir = '/usr/local/'
        else:
            userProfileDir = os.path.expanduser("~")
        fullPath = os.path.join(userProfileDir, subDir) if subDir else userProfileDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getRelationRootFile(self, subDir=None):
        fullPath = self.getRelationRootDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def getRootDir(self, subDir=None):
        cwd = self.getArg('root')
        if not cwd:
            cwd = self.getRelationRootDir()
        fullPath = os.path.join(cwd, subDir) if subDir else cwd
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getRootFile(self, subDir=None):
        fullPath = self.getRootDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def testLocalApiUrls(self):
        try:
            self.testUrl(self.intranetIPAddress)
            return self.intranetIPAddress
        except Exception as e:
            return self.localStaticHttpApiUrl

    def testUrl(self, url):
        conn = http.client.HTTPConnection(url)
        conn.request("GET", "/")
        res = conn.getresponse()
        if res.status >= 200 and res.status < 300:
            return
        else:
            raise Exception(f"Failed to access URL {url}. Status code: {res.status}")

    def getLocalStaticApiUrl(self, upath=None):
        return self.localStaticHttpApiUrl + upath if upath else self.localStaticHttpApiUrl

    def getLocalStaticApiTestUrl(self, upath=None):
        if not self.testAccessibleApi:
            self.testAccessibleApi = self.testLocalApiUrls()
        return self.testAccessibleApi + upath if upath else self.testAccessibleApi

    def getLocalDir(self, subDir=None):
        homeDir = self.getUserProfileDir('.pcore_local')
        fullPath = os.path.join(homeDir, subDir) if subDir else homeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getLocalInfoDir(self, subDir=None):
        homeDir = self.getLocalDir('.info')
        fullPath = os.path.join(homeDir, subDir) if subDir else homeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getLocalInfoFile(self, subDir=None):
        homeDir = self.getLocalInfoDir()
        fullPath = os.path.join(homeDir, subDir) if subDir else homeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getLocalFile(self, subDir=None):
        dir = self.getHomeDir('.desktop_by_node')
        fullPath = os.path.join(dir, subDir) if subDir else dir
        self.mkbasedir(fullPath)
        return fullPath

    def getHomeDir(self, subDir=None):
        os_name = platform.system()
        if os_name == 'Linux':
            homeDir = '/home'
        else:
            homeDir = os.path.expanduser("~")
        fullPath = os.path.join(homeDir, subDir) if subDir else homeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getHomeFile(self, subDir=None):
        homeDir = self.getHomeDir()
        fullPath = os.path.join(homeDir, subDir) if subDir else homeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getTempDir(self, subDir=None):
        os_name = platform.system()
        if os_name == 'Linux':
            base_dir = '/tmp'
        elif os_name == 'Windows':
            base_dir = os.environ.get('TEMP', '')
        else:
            return ""

        if subDir is not None:
            base_dir = os.path.join(base_dir, subDir)
        os.makedirs(base_dir, exist_ok=True)
        return base_dir

    def getTempFile(self, subDir=None):
        tempDir = self.getTempDir()
        fullPath = os.path.join(tempDir, subDir) if subDir else tempDir
        self._mkbasedir(fullPath)
        return fullPath

    def getAppDataDir(self, subDir=None):
        homeDir = os.path.expanduser("~")
        fullPath = os.path.join(homeDir, 'AppData', subDir) if subDir else os.path.join(homeDir, 'AppData')
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getAppDataFile(self, subDir=None):
        appDataDir = self.getAppDataDir()
        fullPath = os.path.join(appDataDir, subDir) if subDir else appDataDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getDownloadDir(self, subDir=None):
        homeDir = os.path.expanduser("~")
        fullPath = os.path.join(homeDir, 'Downloads', subDir) if subDir else os.path.join(homeDir, 'Downloads')
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getDownloadFile(self, subDir=None):
        appDataDir = self.getDownloadDir()
        fullPath = os.path.join(appDataDir, subDir) if subDir else appDataDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getPublicDir(self, subDir=None):
        publicDir = self.getRootDir('public')
        fullPath = os.path.join(publicDir, subDir) if subDir else publicDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath

    def getPublicFile(self, subDir=None):
        fullPath = self.getPublicDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def getLibraryRootDir(self, subDir=None):
        cwd = os.path.abspath(os.path.join(__file__, '../../'))
        fullPath = os.path.join(cwd, f'base/library/{subDir or ""}')
        return fullPath

    def getLibraryDir(self, subDir=None):
        platform = os.name
        if platform != 'nt':
            return self.getLibraryByLinuxDir(subDir)
        else:
            return self.getLibraryByWin32Dir(subDir)

    def getLibraryByLinuxDir(self, subDir=None):
        cwd = os.path.abspath(os.path.join(__file__, '../../'))
        fullPath = os.path.join(cwd, f'base/library/linux/{subDir or ""}')
        return fullPath

    def getLibraryByWin32Dir(self, subDir=None):
        cwd = os.path.abspath(os.path.join(__file__, '../../'))
        fullPath = os.path.join(cwd, rf'base/library/win32/{subDir or ""}')
        return fullPath

    def getStaticDir(self, subDir=None):
        return self.getPublicDir(f'static/{subDir or ""}')

    def getStaticFile(self, subDir=None):
        fullPath = self.getStaticDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def getCoreDir(self, subDir=None):
        return self.getPublicDir(f'core/{subDir or ""}')

    def getCoreFile(self, subDir=None):
        fullPath = self.getCoreDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def getSrcDir(self, subDir=None):
        return self.getPublicDir(f'src/{subDir or ""}')

    def getSrcFile(self, subDir=None):
        fullPath = self.getSrcDir(subDir)
        self.mkbasedir(fullPath)
        return fullPath

    def mkbasedir(self, directoryPath):
        directoryPath = os.path.dirname(directoryPath)
        os.makedirs(directoryPath, exist_ok=True)

    def mkdir(self, dirPath):
        os.makedirs(dirPath, exist_ok=True)

    def getArg(self, name):
        if isinstance(name, int):
            name += 1
            if len(os.sys.argv) > name:
                return os.sys.argv[name]
            else:
                return None
        for i, arg in enumerate(os.sys.argv):
            regex = "^[-]*" + name + "(\$|=|-|:)"
            if arg == name:
                if i + 1 < len(os.sys.argv) and not os.sys.argv[i + 1].startswith("-"):
                    return os.sys.argv[i + 1]
                else:
                    return ""
            if arg.startswith(f"{name}:"):
                return arg.split(":")[1]
            if arg.startswith(f"{name}="):
                return arg.split("=")[1]
            if arg in [f"--{name}", f"-{name}"]:
                if i + 1 < len(os.sys.argv):
                    return os.sys.argv[i + 1]
                else:
                    return None
            if arg.startswith(f"*{name}"):
                if i + 1 < len(os.sys.argv):
                    return os.sys.argv[i + 1]
                else:
                    return None
        return None
    def get_tmp_info_dir(self, app_name=""):
        return self.getLocalDir(app_name)

    def getDockerComposeDir(self, subDir=None):
        dockerComposeDir = self.getRootDir('conf/docker_compose')
        fullPath = os.path.join(dockerComposeDir, subDir) if subDir else dockerComposeDir
        os.makedirs(fullPath, exist_ok=True)
        return fullPath


gdir = Gdir()

