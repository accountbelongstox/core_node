from pycore.base.base import Base
from pycore.practical.openai.util.shortcuts import shortcuts
from pycore.practical.openai.task import task_main

class Main(Base):
    def start(self):
        folder_paths = [r'D:\programing\core_node']
        additional_filters = {
            'ignored_extensions': ['.example'],
            'ignored_directories': ['example_dir'],
            'exclude_patterns': ['example_pattern/**']
        }
        # watch.start(folder_paths, scan_interval_seconds=5, additional_filters=additional_filters)
        shortcuts.start_listening()

    shortcuts.add_shortcut('ctrl+alt+shift+a', lambda: print('Shortcut A activated'))
    shortcuts.add_shortcut('ctrl+alt+shift+s', lambda: print('Shortcut S activated 3 times'), press_count=3,
                           time_window=3, invalid_time=3)

main = Main()

if __name__ == "__main__":
    main_instance = Main()
    main_instance.start()
