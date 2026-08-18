# -*- coding: utf-8 -*-
"""Package entry point so the launcher can be run headless as a module:

    python -m pycore.pyutils.launcher --mode windows --no-pause

Used by the cross-platform autostart managers to start the multi-terminal grid
layout at boot/login without the interactive menu.
"""

from pycore.pyutils.launcher.launcher import main

if __name__ == "__main__":
    main()
