import os
import sys
from pycore.utils_linux import strtool, ip, file,plattools,settings
from pycore.practicals_linux import select,linux
from apps.deploy.pyscript.tools.server_info import server_info
from apps.deploy.pyscript.tools.disk import disk
from apps.deploy.pyscript.tools.docker import docker
from apps.deploy.pyscript.tools.migrate import migrate
from apps.deploy.pyscript.provider.deployenv import *
from apps.deploy.pyscript.provider.docker_info import docker_info
from apps.deploy.pyscript.operations.ssh import ssh
from apps.deploy.pyscript.tools.choice import choice
from pycore.base.base import Base

class installChoice(Base):
    relative_settings = {}

    def __init__(self):
        pass

    def show_envs(self):
        self.init_env(show=True)

    def get_envs(self):
        return self.collection_settings()

    def install(self):
        self.success("The debian12 starts installation using python3")
        self.success("Initialize environment variables")
        self.set_envs()
        self.success("Configure the ssh service to allow remote login and root account login")
        linux.allow_ssh_root_login()
        # disk.create_main_dir()
        self.success("Mount the Docker runtime environment")
        root_dir, daemon_file, snap, sock_file, docker_infos = docker_info.get_docker_snap_and_daemon()
        # docker.mount_docker()
        docker.update_docker(daemon_file)
        # self.success("Copy nginx configuration")
        # migrate.copy_nginx_template()
        self.success("Generate docker-compose configuration and compile")
        docker.gen_docker_compose()

    def init_info(self,show=False):
        main_ip = ip.get_local_ip()
        ensure_path=[]
        snap_docker = server_info.check_docker_snap()
        docker_sock = server_info.get_docker_sock()

        show_settings = [
            ["SNAP_DOCKER", snap_docker],
            ["DOCKER_SOCK", docker_sock],
        ]
        choice.set_and_collection_envs(show_settings, "debian12.information", show=True)

        docker_root_dir = docker_info.get_docker_dir()
        docker_data_dir = docker_info.get_docker_data_dir()

        prompt_settings = [
            ["SERVICE_DIR", SERVICE_DIR],
            ["DOCKER_DIR", docker_root_dir],
            ["DOCKER_DATA", docker_data_dir],
        ]
        ensure_path.append(SERVICE_DIR)
        ensure_path.append(docker_root_dir)
        ensure_path.append(docker_data_dir)
        choice.set_and_collection_envs(prompt_settings, "Docker.information", True)

        prompt_settings = [
            ["MAIN_IP", main_ip],
            ["MAIN_DIR", MAIN_DIR],
            ["WEB_DIR", WWWROOT_DIR],
            ["PROGRAMING_DIR", PROGRAMING_DIR],
        ]
        ensure_path.append(MAIN_DIR)
        ensure_path.append(WWWROOT_DIR)
        ensure_path.append(PROGRAMING_DIR)
        choice.set_and_collection_envs(prompt_settings, "SERVICE.Main-Info", True)

        prompt_settings = [
            ["SCRIPT_DIR", SCRIPT_DIR],
            ["APPS_DIR", APPS_DIR],
            ["DEPLOY_DIR", DEPLOY_DIR],
            ["SHELLS_DIR", SHELLS_DIR],
        ]
        choice.set_and_collection_envs(prompt_settings, "SCRIPT-Info", True)

        prompt_settings = [
            ["TMP_INFO_DIR", gdir.get_tmp_info_dir()],
            ["PYTHON_EXECUTABLE", PYTHON_EXECUTABLE],
            ["PYTHON_MAIN_SCRIPT", PYTHON_MAIN_SCRIPT],
            ["LSB_RELEASE", LSB_RELEASE],
        ]
        file.ensure_dir(ensure_path)
        choice.set_and_collection_envs(prompt_settings, "System-Info", True)

    def init_env(self,show=False):
        # self.init_info()
        # compose_list = docker_info.get_compose_list()
        # valid_compose_list = self.init_docker_compose(compose_list)
        main_ip = ip.get_local_ip()
        # self.success("-The docker-compose you need to configure is:")
        # self.success(valid_compose_list)

        snap_docker = server_info.check_docker_snap()
        docker_sock = server_info.get_docker_sock()

        show_settings = [
            ["SNAP_DOCKER", snap_docker],
            ["DOCKER_SOCK", docker_sock],
        ]
        set_name = "debian12.information"
        choice.set_and_collection_envs(show_settings, setting_name=set_name, show=True)

        set_name = "SERVICE.information"
        prompt_settings = [
            ["SERVICE_DIR", SERVICE_DIR],
        ]
        choice.set_and_collection_envs(prompt_settings, set_name, True)

        set_name = "SERVICE.Share-Dir"
        prompt_settings = [
            ["SHARE_Enable", "y"],
        ]
        choice.set_and_collection_envs(prompt_settings, set_name, True)
        docker_root_dir = docker_info.get_docker_dir()
        docker_data_dir = docker_info.get_docker_data_dir()

        set_name = "global-setting"
        prompt_settings = [
            ["MAIN_IP", main_ip],
            ["MAIN_DIR", MAIN_DIR],
            ["WEB_DIR", WWWROOT_DIR],
            ["DOCKER_DIR", docker_root_dir],
            ["DOCKER_DATA", docker_data_dir],
        ]
        choice.set_and_collection_envs(prompt_settings, set_name, show)

        set_name = "server-settings"
        SERVER_WEB_ADMIN_PASSWORD = env.get_env("SERVER_WEB_ADMIN_PASSWORD")
        SERVER_WEB_PORT = env.get_env("SERVER_WEB_PORT")
        prompt_settings = [
            ["SERVER_WEB_ADMIN_PASSWORD", SERVER_WEB_ADMIN_PASSWORD],
            ["SERVER_WEB_PORT", SERVER_WEB_PORT],
        ]
        choice.set_and_collection_envs(prompt_settings, set_name, show)

    def compiler_docker(self):
        self.success("Initialize environment variables")
        self.init_docker_env()
        docker.gen_docker_compose()


    def init_docker_compose(self,compose_list=None):
        compose_name = "default"
        DOCKER_COMPOSE_SELECT = "DOCKER_COMPOSE_SELECT"
        compose_list = compose_list or docker_info.get_compose_list()
        main_ip = ip.get_local_ip()
        all_compose_list = " ".join(compose_list)
        print("---------------------------------------------")
        self.info("All available docker configurations:")
        self.info(all_compose_list)
        env_compose_list = docker_info.get_compose_list_by_env(compose_name)
        env_selected_compose_str = settings.get_to_tmp_settings(DOCKER_COMPOSE_SELECT,APP_NAME)
        env_compose_str = env_selected_compose_str if env_selected_compose_str else " ".join(env_compose_list)
        select_env_compose_str = select.edit_str(env_compose_str, "Select docker to edit the image")
        settings.save_to_tmp_settings("DOCKER_COMPOSE_SELECT",select_env_compose_str,APP_NAME)
        select_env_compose_list = select_env_compose_str.split()
        valid_compose_list = []
        invalid_compose_list = []

        for value in select_env_compose_list:
            value = value.strip()
            if value in compose_list:
                valid_compose_list.append(value)
            else:
                self.error(f"invalid image: {value}")
                invalid_compose_list.append(value)

        if invalid_compose_list:
            invalid_compose = " ".join(invalid_compose_list)
            self.warn(
                f"Invalid option, the current option {invalid_compose} does not exist in the docker-compose template")
        docker_info.set_compose_list_to_env(valid_compose_list, compose_name)
        # select_compose_list = docker_info.get_compose_list_by_env(compose_name)
        self.success("---------------------------------------------")
        self.success("Select the docker image that needs to be installed")
        self.success(" ".join(valid_compose_list))
        # self.success("-The docker-compose you need to configure is:")
        # self.success(valid_compose_list)
        return valid_compose_list

    def init_docker_env(self, show=False):
        compose_list = docker_info.get_compose_list()
        valid_compose_list = self.init_docker_compose(compose_list)
        open_ports=[]
        for value in valid_compose_list:
            if value == "portainer":
                PORTAINER_PORT = env.get_env("PORTAINER_PORT")
                prompt_settings = [
                    ["PORTAINER_PORT",PORTAINER_PORT],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(PORTAINER_PORT)
            if value == "nginx-proxy-manager":
                self.success(f"""\tEmail:\tadmin@example.com\n\tPassword:\tchangeme""")
                NPM_MANAGER_PORT = env.get_env("NPM_MANAGER_PORT")
                NPM_MANAGER_HTTP_PORT = env.get_env("NPM_MANAGER_HTTP_PORT")
                NPM_MANAGER_HTTPS_PORT = env.get_env("NPM_MANAGER_HTTPS_PORT")
                prompt_settings = [
                    ["NPM_MANAGER_PORT",NPM_MANAGER_PORT],
                    ["NPM_MANAGER_HTTP_PORT",NPM_MANAGER_HTTP_PORT],
                    ["NPM_MANAGER_HTTPS_PORT",NPM_MANAGER_HTTPS_PORT],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(NPM_MANAGER_PORT)
                open_ports.append(NPM_MANAGER_HTTP_PORT)
                open_ports.append(NPM_MANAGER_HTTPS_PORT)
            elif value == "samba":
                prompt_settings = [
                    ["SAMBA_USER", "root"],
                    ["SAMBA_PWD", ],
                ]
                open_ports.append(139)
                open_ports.append(445)
                choice.set_and_collection_envs(prompt_settings, value, show)
            elif value == "mysql":
                MYSQL_PORT = env.get_env("MYSQL_PORT")
                prompt_settings = [
                    ["MYSQL_ROOT_USER", "root"],
                    ["MYSQL_ROOT_PASSWORD", ],
                    ["MYSQL_USER", "user"],
                    ["MYSQL_PASSWORD", ],
                    ["MYSQL_PORT", MYSQL_PORT],
                ]
                open_ports.append(MYSQL_PORT)
                choice.set_and_collection_envs(prompt_settings, value, show)
            elif value == "nginx":
                prompt_settings = [
                    ["MIGRATE_NGINX", True, ],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
            elif value == "ztncui":
                prompt_settings = [
                    ["ZEROTIER_MYADDR", env.get_env("MAIN_IP")],
                    ["ZEROTIER_DOMIAN", ],
                    ["ZTNCUI_PASSWORD", ],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
            elif value == "webnut":
                WEBNUT_PORT = env.get_env("WEBNUT_PORT")
                UPS_USER = env.get_env("UPS_USER")
                UPS_PASSWORD = env.get_env("UPS_PASSWORD")
                prompt_settings = [
                    ["WEBNUT_PORT", WEBNUT_PORT],
                    ["UPS_USER", UPS_USER],
                    ["UPS_PASSWORD", UPS_PASSWORD],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(WEBNUT_PORT)
            elif value == "nut-upsd":
                # plattools.exec_cmd("lsusb")
                UPS_PORT = env.get_env("UPS_PORT")
                UPS_API_PORT = env.get_env("UPS_API_PORT")
                UPS_DEVICES = env.get_env("UPS_DEVICES")
                UPS_API_USER = env.get_env("UPS_API_USER")
                UPS_API_PASSWORD = env.get_env("UPS_API_PASSWORD")
                UPS_ADMIN_PASSWORD = env.get_env("UPS_ADMIN_PASSWORD")
                linux.show_usb_devices()
                prompt_settings = [
                    ["UPS_PORT", UPS_PORT],
                    ["UPS_API_PORT", UPS_API_PORT],
                    ["UPS_DEVICES", UPS_DEVICES],
                    ["UPS_API_USER", UPS_API_USER],
                    ["UPS_API_PASSWORD", UPS_API_PASSWORD],
                    ["UPS_ADMIN_PASSWORD", UPS_ADMIN_PASSWORD],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(UPS_API_PORT)
                open_ports.append(UPS_PORT)
            elif value == "lobe-chat":
                LOBE_CHAT_PORT = env.get_env("LOBE_CHAT_PORT")
                LOBE_CHAT_OPENAI_API_KEY = env.get_env("LOBE_CHAT_OPENAI_API_KEY")
                LOBE_CHAT_OPENAI_PROXY_URL = env.get_env("LOBE_CHAT_OPENAI_PROXY_URL")
                LOBE_CHAT_ACCESS_CODE = env.get_env("LOBE_CHAT_ACCESS_CODE")
                prompt_settings = [
                    ["LOBE_CHAT_PORT", LOBE_CHAT_PORT],
                    ["LOBE_CHAT_OPENAI_API_KEY", LOBE_CHAT_OPENAI_API_KEY],
                    ["LOBE_CHAT_OPENAI_PROXY_URL", LOBE_CHAT_OPENAI_PROXY_URL],
                    ["LOBE_CHAT_ACCESS_CODE", LOBE_CHAT_ACCESS_CODE],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(LOBE_CHAT_PORT)
            elif value == "code-server":
                linux.get_user_info()
                CODE_SERVER_PORT = env.get_env("CODE_SERVER_PORT")
                # CODE_SERVER_PUID = env.get_env("CODE_SERVER_PUID")
                # CODE_SERVER_PGID = env.get_env("CODE_SERVER_PGID")
                # CODE_SERVER_TZ = env.get_env("CODE_SERVER_TZ")
                # CODE_SERVER_PASSWORD = env.get_env("CODE_SERVER_PASSWORD")
                # CODE_SERVER_HASHED_PASSWORD = env.get_env("CODE_SERVER_HASHED_PASSWORD")
                # CODE_SERVER_SUDO_PASSWORD = env.get_env("CODE_SERVER_SUDO_PASSWORD")
                # CODE_SERVER_SUDO_PASSWORD_HASH = env.get_env("CODE_SERVER_SUDO_PASSWORD_HASH")
                # CODE_SERVER_PROXY_DOMAIN = env.get_env("CODE_SERVER_PROXY_DOMAIN")
                # CODE_SERVER_DEFAULT_WORKSPACE = env.get_env("CODE_SERVER_DEFAULT_WORKSPACE")
                prompt_settings = [
                    ["CODE_SERVER_PORT", CODE_SERVER_PORT],
                    # ["CODE_SERVER_PUID", CODE_SERVER_PUID],
                    # ["CODE_SERVER_PGID", CODE_SERVER_PGID],
                    # ["CODE_SERVER_TZ", CODE_SERVER_TZ],
                    # ["CODE_SERVER_PASSWORD", CODE_SERVER_PASSWORD],
                    # ["CODE_SERVER_HASHED_PASSWORD", CODE_SERVER_HASHED_PASSWORD],
                    # ["CODE_SERVER_SUDO_PASSWORD", CODE_SERVER_SUDO_PASSWORD],
                    # ["CODE_SERVER_SUDO_PASSWORD_HASH", CODE_SERVER_SUDO_PASSWORD_HASH],
                    # ["CODE_SERVER_PROXY_DOMAIN", CODE_SERVER_PROXY_DOMAIN],
                    # ["CODE_SERVER_DEFAULT_WORKSPACE", CODE_SERVER_DEFAULT_WORKSPACE],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(CODE_SERVER_PORT)
            elif value == "registry":
                REGISTRY_PORT = env.get_env("REGISTRY_PORT")

                prompt_settings = [
                    ["REGISTRY_PORT", REGISTRY_PORT],
                ]

                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(REGISTRY_PORT)
            elif value == "registry-web":
                REGISTRY_WEB_PORT = env.get_env("REGISTRY_WEB_PORT")

                prompt_settings = [
                    ["REGISTRY_WEB_PORT", REGISTRY_WEB_PORT],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(REGISTRY_WEB_PORT)
            elif value == "it-tools":
                IT_TOOLS_PORT = env.get_env("IT_TOOLS_PORT")

                prompt_settings = [
                    ["IT_TOOLS_PORT", IT_TOOLS_PORT],
                ]
                choice.set_and_collection_envs(prompt_settings, value, show)
                open_ports.append(IT_TOOLS_PORT)


        if open_ports:
            port_count = len(open_ports)
            self.info(f"Total {port_count} ports need to be opened:")
            for port in open_ports:
                self.info(f"- Port: {port}")
        # linux.open_port(open_ports)
        linux.open_all_ports()


    def set_envs(self, show=False):
        self.init_env(show=show)
        self.init_docker_env(show=show)


    def collection_settings(self, settings=None, setting_name=""):
        if settings:
            self.relative_settings[setting_name] = settings



install_choice = installChoice()
