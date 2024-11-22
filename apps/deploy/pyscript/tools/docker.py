import os
from pycore.utils_linux import plattools, file,http
from pycore.base.base import Base
from apps.deploy.pyscript.provider.docker_info import docker_info
from apps.deploy.pyscript.provider.deployenv import *
from pycore.practicals_linux import yml
from apps.deploy.pyscript.tools.server_info import server_info

class Docker(Base):
    def __init__(self):
        self.snap_docker = server_info.check_docker_snap()


    def mount_docker(self):
        root_dir, daemon_file, snap, sock_file, docker_infos = docker_info.get_docker_snap_and_daemon()
        update_docker_token = False
        docker_dir = docker_info.get_docker_dir()
        if snap:
            fstabinfo = plattools.exec_cmd(["cat", "/etc/fstab"], info=False)
            if root_dir not in fstabinfo:
                update_docker_token = True
        else:
            if not file.isdir(docker_dir):
                update_docker_token = True
            elif root_dir != docker_dir:
                update_docker_token = True
        # if update_docker_token:
        #     self.update_docker(daemon_file)

    def gen_docker_compose(self, compose_name="default"):
        compose_list_by_env = docker_info.get_compose_list_by_env(compose_name)

        docker_info.get_docker_compose_template()
        compose_dict = self.get_docker_compose_select(compose_list_by_env, compose_name)

        main_dir = ENV.get_env("MAIN_DIR")
        service_dir = os.path.join(main_dir, 'service')

        compose_dir = os.path.join(service_dir, 'compose')
        self.clear_docker_compose_dir(compose_dir)
        docker_compose_file = os.path.join(compose_dir, 'docker-compose.yml')
        if file.isfile(docker_compose_file):
            file.delete_file(docker_compose_file)
        yml.save(docker_compose_file, compose_dict)
        ENV.set_env("DOCKER_COMPOSE_FILE", docker_compose_file)
        self.copy_dockerFiles(compose_dir)

    def docker_compose_build_up(self, docker_compose_file):
        build_command = f"sudo docker-compose -f {docker_compose_file} build"
        up_command = f"sudo docker-compose -f {docker_compose_file} up -d"

    def clear_docker_compose_dir(self, compose_dir):
        if file.isdir(compose_dir):
            file.delete_dir(compose_dir)
        os.makedirs(compose_dir, exist_ok=True)

    def copy_dockerFiles(self, compose_dir, info=False):
        compose_template_dir = docker_info.get_docker_compose_template_dir()
        self.info(f"Dockerfiles-Copy {compose_template_dir} to {compose_dir}")
        file.copy_dir(compose_template_dir,
                      compose_dir,
                      skip_files=["docker-compose-template.yml"], info=info)
        env_file = env.get_env_file()
        compose_dir = os.path.join(compose_dir, ".env")
        file.copy(env_file, compose_dir, info=info)

    def get_docker_compose_select(self, selected_services=[], compose_name="default"):
        if not selected_services:
            selected_services = docker_info.get_compose_list_by_env(compose_name)
        compose_config = docker_info.get_docker_compose_template()
        services = compose_config.get_val("services")
        filtered_services = {name: details for name, details in services.items() if name in selected_services}
        compose_dict = compose_config.get_config()
        compose_dict['services'] = filtered_services
        return compose_dict

    def update_docker(self, daemon_file=None):
        if not daemon_file:
            root_dir, daemon_file, snap, sock_file, docker_infos = docker_info.get_docker_snap_and_daemon()

        daemon_json = file.read_json(daemon_file)
        if "registry-mirrors" not in daemon_json:
            daemon_json["registry-mirrors"] = []

        private_mirrors = docker_info.get_private_mirrors()
        private_reachable, private_unreachable = http.test_urls(private_mirrors, timeout=3, print_results=True)

        if private_reachable:
            self.success("Private mirror is available. Using it for registry mirrors.")
            daemon_json["registry-mirrors"] = private_reachable
        else:
            self.warn("Private mirror is not available. Using default mirrors.")
            registry_mirrors = docker_info.get_mirrors()
            reachable, unreachable = http.test_urls(registry_mirrors, timeout=3, print_results=True)
            daemon_json["registry-mirrors"] = reachable

        docker_dir = docker_info.get_docker_dir()

        data_root_changed = daemon_json.get("data-root") != docker_dir

        if not data_root_changed and not private_reachable:
            self.success("No changes detected in data-root or using default mirrors. Skipping Docker restart.")
            return

        # if data_root_changed:
        #     old_dir = daemon_json.get("data-root")
        #     daemon_json["data-root"] = docker_dir
        #     self.success(f"Changed data-root from {old_dir} to {docker_dir}")

        # Print success details
        self.success("Updated registry mirrors:")
        for mirror in daemon_json["registry-mirrors"]:
            self.success(f"Mirror {mirror}: Reachable")

        self.stop_docker()
        file.save_json(daemon_file, daemon_json)
        self.start_docker()
        plattools.reload_systemctl()


    def check_migrate_dir(self, directory_path):
        if not os.path.exists(directory_path) or not os.listdir(directory_path):
            if not os.path.exists(directory_path):
                os.makedirs(directory_path)
            return True
        else:
            return False

    def migrate_docker(self, old_root_dir, new_root_dir, ):
        if self.check_migrate_dir(new_root_dir) == True:
            os.system(f"rsync -aP {old_root_dir}/ {new_root_dir}/")

    def migrate_docker_data_docker_command(self, old_root_dir, new_root_dir):
        os.system(
            f"docker run --rm -v {old_root_dir}:/backup busybox tar cvf /backup/docker-data-backup.tar /{old_root_dir}")
        os.system(f"docker daemon --data-root {new_root_dir}")
        os.system(f"docker run --rm -v {new_root_dir}:/target busybox tar xvf /backup/docker-data-backup.tar -C /target")

    def stop_docker(self):
        if self.snap_docker == "1":
            plattools.exec_cmd(["sudo", "snap", "stop", "docker"], info=False)
        else:
            plattools.exec_cmd(["sudo", "service", "stop", "docker"], info=False)
        self.warn("Stopped Docker")
 
    def start_docker(self):
        if self.snap_docker == "1":
            plattools.exec_cmd(["sudo", "snap", "docker", "start"], info=False)
        # elif self.snap_docker == "2":
        #     plattools.exec_cmd(["sudo", "systemctl", "start", "docker"], info=False)
        else:
            plattools.exec_cmd(["sudo", "service", "docker", "start"], info=False)
        print("Started Docker")

    def setup_environment(self):
        result = plattools.exec_cmd(["sudo", "docker", "info"], info=False)
        if result.returncode == 0:
            print("Docker is already installed.")
        else:
            print("Docker is not installed. Installing Docker...")
            plattools.exec_cmd(["sudo", "apt", "update"])
            plattools.exec_cmd(["sudo", "apt", "init", "-y", "docker.io"])
            plattools.exec_cmd(["sudo", "systemctl", "start", "docker"])
            plattools.exec_cmd(["sudo", "systemctl", "enable", "docker"])
            print("Docker installed and started.")


    def run_migration_rsync(self):
        print("Running Docker data migration using rsync...")
        plattools.exec_cmd(
            ["sudo", "rsync", "-a", "--info=progress2", self.old_docker_root_dir + "/", self.docker_dir])
        print("Docker data migration completed.")



docker = Docker()
