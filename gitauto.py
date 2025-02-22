import os
import subprocess
from datetime import datetime

class DirectoryScanner:
    def __init__(self):
        self.scanned_dirs = []
        self.root_directory = os.getcwd()
        self.commmit_root_directory = False

    def print_error(self, text):
        print("\033[91m{}\033[00m".format(text))  # Print text in red color

    def print_info(self, text):
        print("\033[92m{}\033[00m".format(text))  # Print text in green color

    def print_warn(self, text):
        print("\033[94m{}\033[00m".format(text))  # Print text in blue color

    def git_commit_and_push(self, directory):
        # Execute Git operations
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        subprocess.run(["git", "add", "."])
        subprocess.run(["git", "commit", "-m", timestamp])
        push_process = subprocess.run(["git", "push", "--set-upstream", "origin", "master"], capture_output=True)
        print(push_process)
        # Print commit details
        self.print_info(f"Committed-Dir\t: {directory}, {timestamp}\n\n\n\n")

        # Check if there's any error during the push operation
        if push_process.returncode != 0:
            self.print_error("An error occurred during the push operation.")
            self.print_error(push_process.stderr.decode())
            # Open the directory with Explorer
            os.startfile(directory)

    def get_put_cmd_by_win(self):
        return """@echo off
setlocal
REM YYYY-MM-DD HH:MM:SS
for /f "delims=" %%a in ('wmic OS Get localdatetime ^| find "."') do set datetime=%%a
set "year=%datetime:~0,4%"
set "month=%datetime:~4,2%"
set "day=%datetime:~6,2%"
set "hour=%datetime:~8,2%"
set "minute=%datetime:~10,2%"
set "second=%datetime:~12,2%"
set "timestamp=%year%-%month%-%day% %hour%:%minute%:%second%"
REM git
git add .
git commit -m "%timestamp%"
git push --set-upstream origin master
endlocal
        """

    def get_put_cmd_by_linux(self):
        return """#!/bin/bash
timestamp=$(date +"%Y-%m-%d %H:%M:%S")
git add .
git commit -m "$timestamp"
git push --set-upstream origin master
        """

    def get_pull_cmd_by_win(self):
        return """@echo off
REM Git pull
git pull origin master
git diff --name-only --diff-filter=U
        """
    def get_pull_cmd_by_linux(self):
        return """#!/bin/bash
# Git pull
git pull origin master
git diff --name-only --diff-filter=U
        """
    def overwrite_if_different(self, source_file, destination_file):
        if os.path.isfile(source_file):
            with open(source_file, 'r', encoding='utf-8') as source:
                source_content = source.read()
        else:
            source_content = source_file

        if os.path.exists(destination_file):
            with open(destination_file, 'r', encoding='utf-8') as dest:
                dest_content = dest.read()
            if dest_content != source_content:
                self.print_warn("The content of destination file is different from source file. Overwriting...")
                # If contents are different, overwrite destination file with source content
                with open(destination_file, 'w', encoding='utf-8') as dest:
                    dest.write(source_content)
        else:
            self.print_warn("Destination file does not exist. Creating a new file...")
            # If destination file does not exist, create a new file with source content
            with open(destination_file, 'w', encoding='utf-8') as dest:
                dest.write(source_content)
                self.print_info("New file created and content copied successfully.")

    def delete_scripts(self, directory):
        files_to_check = [
            "gitauto.py",
            "gitput.sh",
            "gitput.bat",
            ".gitautopull.bat",
            ".gitautopull.sh"
        ]
        for file_name in files_to_check:
            file_path = os.path.join(directory, file_name)
            if os.path.exists(file_path):
                self.print_info(f" file_path: {file_path}")
                os.remove(file_path)
                self.print_info(f"Deleted file: {file_name}")

    def generate_scripts(self, directory):
        # Check if gitput.bat exists
        self.overwrite_if_different(__file__,os.path.join(directory, "gitauto.py"))
        self.overwrite_if_different(self.get_put_cmd_by_win(),os.path.join(directory, "gitput.bat"))
        self.overwrite_if_different(self.get_put_cmd_by_linux(),os.path.join(directory, "gitput.sh"))
        self.overwrite_if_different(self.get_pull_cmd_by_win(),os.path.join(directory, ".gitautopull.bat"))
        self.overwrite_if_different(self.get_pull_cmd_by_linux(),os.path.join(directory, ".gitautopull.sh"))

    def scan_directory(self,root_directory=None, skip_dirs={}):
        if root_directory==None:
            root_directory = self.root_directory

        def not_skip(directory):
            if directory in skip_dirs.get('skip_whole', []):
                return False
            for skip_dir in skip_dirs.get('skip_start', []):
                if directory.startswith(skip_dir):
                    return False
            for skip_dir in skip_dirs.get('skip_end', []):
                if directory.endswith(skip_dir):
                    return False
            return True
        if not self.commmit_root_directory:
            self.commmit_root_directory = True
            self.git_commmit_directory(self.root_directory)

        for item in os.listdir(root_directory):
            item_path = os.path.join(root_directory, item)
            if os.path.isdir(item_path):
                git_dir = os.path.join(item_path, '.git')
                if not_skip(item):
                    if os.path.isdir(git_dir):
                        self.print_info(f"Git-Dir\t\t: {git_dir}")
                        self.git_commmit_directory(item_path)
                    self.scan_directory(item_path,skip_dirs)
                
                if not os.path.isdir(git_dir):
                    self.delete_scripts(item_path)
            else:
                pass
        
    def git_commmit_directory(self, directory):
        self.print_info(f"Git-Directory\t: {directory}")
        self.generate_scripts(directory)
        os.chdir(directory)
        self.git_commit_and_push(directory)
        os.chdir(self.root_directory)

# Specify directories to skip
skip_dirs = {
    'skip_whole': ['node_modules', '.git'],
    'skip_start': ['.'],
    'skip_end': []
}

scanner = DirectoryScanner()

# Perform the scan
scanner.scan_directory( None,skip_dirs)
