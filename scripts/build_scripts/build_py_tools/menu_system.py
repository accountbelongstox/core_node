#!/usr/bin/env python3

import curses
import json
from keys_center import KeysCenter
from file_var_handler import FileVarHandler
from framework_configs import FrameworkConfigs

class MenuSystem:
    def __init__(self):
        self.var_handler = FileVarHandler()
        self.projects = []
        self.selected_project_index = 0
        self.selected_action_index = 0
        self.selected_platform_index = 0
        self.load_projects()
        self.load_cache()

    def load_projects(self):
        scan_results = self.var_handler.get_var(KeysCenter.KEY_SCAN_RESULTS, "")
        if not scan_results:
            print("No scan results found. Please run project detector first.")
            exit(1)

        for line in scan_results.strip().split("\n"):
            if line.strip():
                try:
                    project = json.loads(line)
                    self.projects.append(project)
                except json.JSONDecodeError as e:
                    print(f"Error parsing project data: {e}")

        if not self.projects:
            print("No projects found in scan results.")
            exit(1)

    def load_cache(self):
        cached_project = self.var_handler.get_var(KeysCenter.KEY_SELECTED_PROJECT_INDEX, "0")
        cached_action = self.var_handler.get_var(KeysCenter.KEY_SELECTED_ACTION_INDEX, "0")
        cached_platform = self.var_handler.get_var(KeysCenter.KEY_SELECTED_PLATFORM_INDEX, "0")

        try:
            self.selected_project_index = int(cached_project)
            if self.selected_project_index >= len(self.projects):
                self.selected_project_index = 0
        except ValueError:
            self.selected_project_index = 0

        try:
            self.selected_action_index = int(cached_action)
        except ValueError:
            self.selected_action_index = 0

        try:
            self.selected_platform_index = int(cached_platform)
        except ValueError:
            self.selected_platform_index = 0

    def save_cache(self):
        self.var_handler.set_var(KeysCenter.KEY_SELECTED_PROJECT_INDEX, str(self.selected_project_index))
        self.var_handler.set_var(KeysCenter.KEY_SELECTED_ACTION_INDEX, str(self.selected_action_index))
        self.var_handler.set_var(KeysCenter.KEY_SELECTED_PLATFORM_INDEX, str(self.selected_platform_index))

    def save_selection(self):
        project = self.projects[self.selected_project_index]
        project_type = project[KeysCenter.KEY_PROJECT_TYPE]

        actions = FrameworkConfigs.get_actions(project_type)
        platforms = FrameworkConfigs.get_platforms(project_type)

        if self.selected_action_index >= len(actions):
            self.selected_action_index = 0
        if self.selected_platform_index >= len(platforms):
            self.selected_platform_index = 0

        selected_action = actions[self.selected_action_index]
        selected_platform = platforms[self.selected_platform_index]

        self.var_handler.set_var(KeysCenter.KEY_SELECTED_PROJECT_NAME, project[KeysCenter.KEY_PROJECT_NAME])
        self.var_handler.set_var(KeysCenter.KEY_PROJECT_PATH, project[KeysCenter.KEY_PROJECT_PATH])
        self.var_handler.set_var(KeysCenter.KEY_PROJECT_TYPE, project_type)
        self.var_handler.set_var(KeysCenter.KEY_PROJECT_PORT, str(project[KeysCenter.KEY_PROJECT_PORT]))
        self.var_handler.set_var(KeysCenter.KEY_SELECTED_ACTION_NAME, selected_action)
        self.var_handler.set_var(KeysCenter.KEY_SELECTED_PLATFORM_NAME, selected_platform)

        self.save_cache()

    def run(self, stdscr):
        curses.curs_set(0)
        stdscr.clear()

        while True:
            stdscr.clear()
            height, width = stdscr.getmaxyx()

            title = "=== Poly Apps Manager ==="
            stdscr.addstr(0, max(0, (width - len(title)) // 2), title, curses.A_BOLD)

            help_text = "Arrow Keys: Up/Down=App, Left/Right=Action/Platform | Enter=Execute | q=Quit"
            stdscr.addstr(2, max(0, (width - len(help_text)) // 2), help_text)

            stdscr.addstr(3, 0, "-" * min(width - 1, 80))

            y_offset = 5

            current_project_type = self.projects[self.selected_project_index][KeysCenter.KEY_PROJECT_TYPE]
            current_actions = FrameworkConfigs.get_actions(current_project_type)
            current_platforms = FrameworkConfigs.get_platforms(current_project_type)

            if self.selected_action_index >= len(current_actions):
                self.selected_action_index = 0
            if self.selected_platform_index >= len(current_platforms):
                self.selected_platform_index = 0

            for idx, project in enumerate(self.projects):
                project_name = project[KeysCenter.KEY_PROJECT_NAME]
                project_type = project[KeysCenter.KEY_PROJECT_TYPE]
                project_port = project[KeysCenter.KEY_PROJECT_PORT]

                line = f"  {project_name} [{project_type}] (Port {project_port})"

                if idx == self.selected_project_index:
                    action_display = FrameworkConfigs.get_action_display_name(current_actions[self.selected_action_index])
                    platform_display = FrameworkConfigs.get_platform_display_name(current_platforms[self.selected_platform_index])
                    line += f" => [{action_display}] | [{platform_display}]"
                    if y_offset < height - 2:
                        stdscr.addstr(y_offset, 0, line[:width - 1], curses.A_REVERSE)
                else:
                    if y_offset < height - 2:
                        stdscr.addstr(y_offset, 0, line[:width - 1])

                y_offset += 1

            if y_offset < height - 2:
                y_offset += 1
                project = self.projects[self.selected_project_index]

                action_display = FrameworkConfigs.get_action_display_name(current_actions[self.selected_action_index])
                platform_display = FrameworkConfigs.get_platform_display_name(current_platforms[self.selected_platform_index])

                info_line = f"Selected: {project[KeysCenter.KEY_PROJECT_NAME]} | Action: {action_display} | Platform: {platform_display}"
                stdscr.addstr(y_offset, 0, info_line[:width - 1], curses.A_BOLD)

            stdscr.refresh()

            key = stdscr.getch()

            if key == ord('q') or key == ord('Q'):
                break
            elif key == curses.KEY_UP:
                self.selected_project_index = (self.selected_project_index - 1) % len(self.projects)
                new_project_type = self.projects[self.selected_project_index][KeysCenter.KEY_PROJECT_TYPE]
                new_actions = FrameworkConfigs.get_actions(new_project_type)
                new_platforms = FrameworkConfigs.get_platforms(new_project_type)
                if self.selected_action_index >= len(new_actions):
                    self.selected_action_index = 0
                if self.selected_platform_index >= len(new_platforms):
                    self.selected_platform_index = 0
            elif key == curses.KEY_DOWN:
                self.selected_project_index = (self.selected_project_index + 1) % len(self.projects)
                new_project_type = self.projects[self.selected_project_index][KeysCenter.KEY_PROJECT_TYPE]
                new_actions = FrameworkConfigs.get_actions(new_project_type)
                new_platforms = FrameworkConfigs.get_platforms(new_project_type)
                if self.selected_action_index >= len(new_actions):
                    self.selected_action_index = 0
                if self.selected_platform_index >= len(new_platforms):
                    self.selected_platform_index = 0
            elif key == curses.KEY_LEFT:
                self.selected_action_index = (self.selected_action_index - 1) % len(current_actions)
            elif key == curses.KEY_RIGHT:
                self.selected_platform_index = (self.selected_platform_index + 1) % len(current_platforms)
            elif key == curses.KEY_ENTER or key == 10 or key == 13:
                self.save_selection()
                break

if __name__ == "__main__":
    menu = MenuSystem()
    curses.wrapper(menu.run)
    print("\nSelection saved. Returning to shell script...")
