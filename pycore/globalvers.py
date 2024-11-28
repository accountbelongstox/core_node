import os
from pycore.globalvar.env import Env
from pycore.globalvar.src import src
from pycore.util.sysarg import sysarg
from pycore.globalvar.gdir import gdir
DockerComposeDir = gdir.getDockerComposeDir()
baseServer="192.168.100.10"
env = Env()
rootdir = env.getcwd()
logdir = env.get_log_dir()
outdir = env.get_out_dir()
appname_arg = sysarg.get_arg(0)
appname_env = env.get_env("APP_NAME")
appname = appname_arg if appname_arg else appname_env
appdir = os.path.join(rootdir, 'apps', appname)
appenv = Env(appdir)
sysid = src.get_system_id()
systoken = src.get_system_token()

