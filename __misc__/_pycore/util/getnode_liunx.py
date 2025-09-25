import os
import shutil
from pycore.base.base import Base

class GetNodeLinux(Base):
    def __init__(self):
        self.node_dir_base = "/usr/lang_compiler/node"
        self.temp_dir = "/tmp/nodejs"
        self.binaries = ["pm2", "pnpm", "cnpm", "yarn", ]
        self.binaries_bins = ["npm", "corepack", "npx", "pm2", "pm2-dev", "pm2-docker", "pm2-runtime", "pnpm", "vsce",
                              "yarn", "yarnpkg"]
        self.node_versions = {
            18: "v18.20.4",
            20: "v20.15.1",
            22: "v22.5.1"
        }
        self.node_default_version = 20
        self.node_default_full_version = self.node_versions[self.node_default_version]
        self.node_default_version_full = f"node-{self.node_default_full_version}-linux-x64"
        self.node_default_dir = os.path.join(self.node_dir_base, self.node_default_version_full)
        self.node_default_bin_dir = os.path.join(self.node_default_dir, "bin")
        self.node_default_nbin_dir = os.path.join(self.node_default_dir, "nbin")
        self.sys_local_bin_base = "/usr/local/bin"
        self.sys_bin_base = "/usr/bin"
        self.skip_print_bins = ["npx", "pnpx", "electron"]

        self.prepare_directories()

    def prepare_directories(self):
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(self.node_dir_base, exist_ok=True)

    def link_default_bins(self, dir_path):
        self.info(f"-> Setting default binaries from: {dir_path}")
        for binarypath in os.listdir(dir_path):
            binarypath = os.path.join(dir_path, binarypath)
            binary = os.path.basename(binarypath)

            for bin_base in [self.sys_bin_base, self.sys_local_bin_base]:
                target_path = os.path.join(bin_base, binary)
                if os.path.exists(target_path) or os.path.islink(target_path):
                    os.unlink(target_path)

                os.symlink(binarypath, target_path)
                os.chmod(target_path, 0o755)
                self.success(f"-> Removed old binary: {binary} from {bin_base} -> Created symlink -> Set permissions.")
                self.info(f"-> Binary name: {binary}")
                self.info(f"-> Binary path: {binarypath}")

            if binary in ["node", "npm", "yarn"]:
                version = self.exec_cmd([os.path.join(self.sys_bin_base, binary), '--version'])
                self.info(f"-> Current system default {binary} version: {version}")

    def download_and_extract(self, url):
        filename = os.path.basename(url)
        output_path = os.path.join(self.temp_dir, filename)

        if os.path.exists(output_path):
            os.unlink(output_path)

        self.info(f"Downloading Node.js from: {url}")
        self.exec_cmd(['wget', '-q', '--show-progress', url, '-P', self.temp_dir])

        self.info(f"Downloaded Node.js to: {output_path}")
        self.extract_xz(output_path, self.node_dir_base)

    def extract_xz(self, xz_file, extract_dir):
        self.info(f"Extracting {xz_file} to {extract_dir}")
        self.exec_cmd(['sudo', 'tar', '-Jxf', str(xz_file), '-C', str(extract_dir)])

    def configure_npm(self, node_path, node_version_bin_dir):
        not_found = []
        npmpath = os.path.join(node_version_bin_dir, "npm")
        node_parent_dir = os.path.dirname(os.path.dirname(node_path))
        self.info(f"{node_path} {npmpath} config set prefix {node_parent_dir}")
        self.info(f"{node_path} {npmpath} config set registry https://mirrors.huaweicloud.com/repository/npm/")
        self.exec_cmd([node_path, npmpath, "config", "set", "prefix", node_parent_dir])
        self.info(f"   -> npm prefix {node_parent_dir}")
        self.exec_cmd(
            [node_path, npmpath, "config", "set", "registry", "https://mirrors.huaweicloud.com/repository/npm/"])
        self.info(f"   -> npm registry configured to https://mirrors.huaweicloud.com/repository/npm/.")

        for binary in self.binaries:
            binary_path = os.path.join(node_version_bin_dir, binary)
            self.info(f"Binary {binary} path: {binary_path}")
            if not os.path.exists(binary_path):
                not_found.append(binary)
        if not_found:
            self.warn(f"Not found, Installing binaries: {' '.join(not_found)}")
            self.exec_cmd([node_path, npmpath, "install", "-g"] + not_found)

    def create_symlink_binfile(self, nodepath, exepath, binpath, binname):
        if not os.path.exists(nodepath):
            self.warn(f"Error: File '{nodepath}' not found.")
            return 1

        if not os.path.exists(exepath):
            self.warn(f"Error: File '{exepath}' not found.")
            return 1

        with open(binpath, 'w') as f:
            f.write(f"#!/bin/bash\n")
            f.write(f"{nodepath} {exepath} \"$@\"\n")

        if os.path.exists(os.path.join("/usr/local/bin", binname)):
            self.info(f"   -> Removing existing /usr/local/bin/{binname}")
            os.unlink(os.path.join("/usr/local/bin", binname))

        self.info(f"   -> Creating symlink: /usr/local/bin/{binname} -> {binpath}")
        os.symlink(binpath, os.path.join("/usr/local/bin", binname))
        os.chmod(os.path.join("/usr/local/bin", binname), 0o755)
        self.success(f"   -> Script written to {binpath}")

    def setup_custom_binaries(self, node_version_bin_dir, nodepath, nodeitem, node_version_main_dir):
        self.info(f"Scanning directory: {node_version_bin_dir}")
        for birary in os.listdir(node_version_bin_dir):
            birary = os.path.join(node_version_bin_dir, birary)
            filename = os.path.basename(birary)
            if filename == "node":
                self.info(f"   -> Skipping file: {filename}")
                continue

            nbinpath = os.path.join(node_version_main_dir, "nbin")
            nbiname = f"{nodeitem}{filename}"
            nbinname_path = os.path.join(nbinpath, nbiname)

            if not os.path.exists(nbinpath):
                os.makedirs(nbinpath)

            self.create_symlink_binfile(nodepath, birary, nbinname_path, nbiname)

    def install_global_package_with_yarn(self, node_version, package_name):
        yarn_path = self.get_nbin_file(node_version, "yarn")
        if yarn_path:
            self.info(f"Using yarn at: {yarn_path} to install package: {package_name}")
            self.exec_cmd([yarn_path, "global", "add", package_name])
            self.set_bin_permissions_and_sync(node_version)
        else:
            self.warn(f"Yarn binary not found for Node.js version {node_version}")

    def set_bin_permissions_and_sync(self, node_version):
        bin_path = self.get_bin_path(node_version)
        nbin_path = os.path.join(self.node_dir_base, f"node-{self.node_versions[node_version]}-linux-x64", "nbin")

        self.info(f"Setting execute permissions for all files in: {bin_path}")
        for f in os.listdir(bin_path):
            file_path = os.path.join(bin_path, f)
            os.chmod(file_path, 0o755)

            # if not os.path.exists(os.path.join(nbin_path, f)):
            #     self.create_symlink_binfile(bin_path, bin_path, os.path.join(nbin_path, f), f)

    def print_versions(self, node_version_bin_dir, nodepath, nodeitem):
        self.info("--------------------------------------------------")
        self.info(f"-----------------Node.js {nodeitem}------------------------")
        self.info("--------------------------------------------------")
        self.info(f"Scanning directory: {node_version_bin_dir}")
        for birary in os.listdir(node_version_bin_dir):
            birary = os.path.join(node_version_bin_dir, birary)
            filename = os.path.basename(birary)
            if filename == "node":
                command = [birary, '--version']
            elif filename == "electron":
                command = [birary, '--version', '--no-sandbox']
            elif filename in self.skip_print_bins or filename.endswith(('.cmd', '.exe', '.ps1')):
                self.info(f"Skip {filename}")
                continue
            else:
                command = [nodepath, birary, '--version']
            version = self.exec_cmd(command)
            self.success(f"   -> {filename}: {version}.")

    def get_bin_path(self, node_version):
        node_version_full = f"node-{self.node_versions[node_version]}-linux-x64"
        return os.path.join(self.node_dir_base, node_version_full, "bin")

    def get_nbin_path(self, node_version, binary):
        node_version_full = f"node-{self.node_versions[node_version]}-linux-x64"
        return os.path.join(self.node_dir_base, node_version_full, "nbin", f"{node_version}{binary}")

    def get_bin_file(self, node_version, binary_name):
        bin_path = self.get_bin_path(node_version)
        binary_file = os.path.join(bin_path, binary_name)
        if os.path.exists(binary_file) and os.access(binary_file, os.X_OK):
            return binary_file
        else:
            self.warn(f"Binary file '{binary_name}' not found or not executable in bin path: {bin_path}")
            return None

    def get_nbin_file(self, node_version, binary_name):
        nbin_path = self.get_nbin_path(node_version, binary_name)
        if os.path.exists(nbin_path) and os.access(nbin_path, os.X_OK):
            return nbin_path
        else:
            self.warn(f"Binary file '{binary_name}' not found or not executable in nbin path: {nbin_path}")
            return None
    def main(self):
        for nodeitem, node_version in self.node_versions.items():
            node_version_full = f"node-{node_version}-linux-x64"
            node_version_main_dir = os.path.join(self.node_dir_base, node_version_full)
            node_version_bin_dir = os.path.join(node_version_main_dir, "bin")
            node_path = os.path.join(node_version_bin_dir, "node")

            self.info(f"Selected NODE_VERSION: {node_version}")
            self.info(f"NODE_VERSION_FULL: {node_version_full}")
            self.info(f"NODE_DIR: {node_version_main_dir}")

            if not os.path.exists(node_path):
                self.warn(f"Node executable not found at {node_path}. Downloading and extracting...")

                if os.path.exists(node_version_main_dir):
                    shutil.rmtree(node_version_main_dir)

                node_tar_url = f"https://nodejs.org/dist/{node_version}/{node_version_full}.tar.xz"
                self.info(f"NODE_TAR_URL: {node_tar_url}")

                self.download_and_extract(node_tar_url)

            self.configure_npm(node_path, node_version_bin_dir)
            self.setup_custom_binaries(node_version_bin_dir, node_path, nodeitem, node_version_main_dir)

            self.info("Set execute binary permissions")
            for f in os.listdir(node_version_bin_dir):
                os.chmod(os.path.join(node_version_bin_dir, f), 0o755)

            self.info("--------------------------------")
            self.print_versions(node_version_bin_dir, node_path, nodeitem)

        self.info(f"   -> Default Node.js Version: {self.node_default_full_version}")
        self.info(f"   -> Default Node.js Directory: {self.node_default_dir}")
        self.info(f"   -> Default nbin Directory: {self.node_default_nbin_dir}")

        self.link_default_bins(self.node_default_bin_dir)
        self.link_default_bins(self.node_default_nbin_dir)
