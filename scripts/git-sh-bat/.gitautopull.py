import os
import subprocess

class DirectoryScanner:
    def __init__(self):
        self.scanned_dirs = []
        self.root_directory = os.getcwd()

    def print_error(self, text):
        print("\033[91m{}\033[00m".format(text))  # Print text in red color

    def print_info(self, text):
        print("\033[92m{}\033[00m".format(text))  # Print text in green color

    def print_warn(self, text):
        print("\033[94m{}\033[00m".format(text))  # Print text in blue color

    def git_auto_pull(self,directory):
        err=False
        push_process = subprocess.run(["git", "pull", "origin", "master"], capture_output=True)
        if push_process.returncode != 0:
            self.print_error("An error occurred during the push operation.")
            self.print_error(push_process.stderr.decode())
            err = True
        push_process = subprocess.run(["git", "diff", "--name-only", "--diff-filter=U"], capture_output=True)
        if push_process.returncode != 0:
            self.print_error("An error occurred during the push operation.")
            self.print_error(push_process.stderr.decode())
            err = True
        if err:
            os.startfile(directory)

    def scan_directory(self,root_directory=None, skip_dirs={}):
        if root_directory==None:
            root_directory = self.root_directory

        def not_skip(directory):
            if directory in skip_dirs.get('skip_whole', []):
                return False
            for skip_dir in skip_dirs.get('skip_start', []):
                if directory.startswith(os.path.join(root_directory, skip_dir)):
                    return False
            for skip_dir in skip_dirs.get('skip_end', []):
                if directory.endswith(skip_dir):
                    return False
            return True
        
        for item in os.listdir(root_directory):
            item_path = os.path.join(root_directory, item)
            if os.path.isdir(item_path):
                if not_skip(item):
                    git_dir = os.path.join(item_path, '.git')
                    if os.path.isdir(git_dir):
                        self.git_commmit_directory(item_path)
                    self.scan_directory(item_path,skip_dirs)
            else:
                pass
        
    def git_commmit_directory(self, directory):
        self.print_info(f"Git-Directory: {directory}")
        os.chdir(directory)
        self.git_auto_pull(directory)
        os.chdir(self.root_directory)

# Specify directories to skip
skip_dirs = {
    'skip_whole': ['node_modules', '.git'],
    'skip_start': ['.'],
    'skip_end': []
}

scanner = DirectoryScanner()

scanner.scan_directory( None,skip_dirs)
