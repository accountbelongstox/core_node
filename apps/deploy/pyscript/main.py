from pycore.utils_linux import file, sysarg
from pycore.practicals_linux import yml,linux
from apps.deploy.pyscript.monitor.main import monitor
from apps.deploy.pyscript.init.main import install_choice
from apps.deploy.pyscript.init.local_main import install_local_choice
from apps.deploy.pyscript.provider.deployenv import *
from pycore.base.base import Base
import sys,os

# import website

class DeplyMainScript(Base):
    def __init__(self):
        pass

    def test(self):
        from pycore.practicals_linux import env as _env
        print("deploy-test")

    def main(self):
        param_type = sysarg.get_arg(1)
        param_func = sysarg.get_arg(2)

        if param_type is None:
            print("Missing argument: Please provide the parameter type (yml, env, web).")
            return

        if param_type == 'yml':
            if param_func in dir(yml):
                getattr(yml, param_func)(*sys.argv[3:])
            else:
                print(f"'yml' parameter type does not support the function: {param_func}")
            return

        if param_type == 'init':
            install_choice.install()
            return

        if param_type == 'install':
            install_choice.install()
            return

        if param_type == 'init_info':
            install_choice.init_info()
            self.success("The system environment is initialized successfully")
            return
        
        if param_type == 'local_install':
            install_local_choice.local_install()
            return
        

        if param_type == 'compiler_docker':
            install_choice.compiler_docker()
            return

        if param_type == 'set_pip_source':
            linux.set_pip_source()
            return

        if param_type == 'tool':
            if param_func in dir(self.tool):
                getattr(self.tool, param_func)(*sys.argv[3:])
            else:
                print(f"'env' parameter type does not support the function: {param_func}")
            return

        if param_type == 'docker':
            if param_func in dir(self.tool):
                getattr(self.tool, param_func)(*sys.argv[3:])
            else:
                print(f"'env' parameter type does not support the function: {param_func}")
            return

        if param_type == 'monitor':
            monitor.start()
            return

        if param_type == 'set_autostart':
            script_path = sysarg.get_arg(3)
            linux.open_port(3000)
            linux.set_autostart_script(script_path)
            return

        if param_type == 'create_service':
            args = sysarg.get_args()
            script_path = sysarg.get_arg(2)
            linux.create_service(script_path,)
            return


        if param_type == 'install_ssh':
            from apps.deploy.pyscript.operations.ssh import ssh
            ssh.modify_ssh_config()
            return

        # elif param_type == 'web':
        #     if param_func in dir(self.web):
        #         getattr(self.web, param_func)(*sys.argv[3:])
        #     else:
        #         print(f"'web' parameter type does not support the function: {param_func}")

        print(f"Invalid parameter type: {param_type}. Please use 'yml', 'env', or 'web'.")


deploy = DeplyMainScript()
