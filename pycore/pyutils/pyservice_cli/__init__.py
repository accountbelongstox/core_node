# -*- coding: utf-8 -*-
"""
pyservice_cli - headless command-line configuration for pycore.

Lets a server with no UI configure system settings and code-sync (role, peers,
distribute, skip-update) from the terminal. Invoked via the pyservice launcher:

    pyservice.sh config ...      ->  python -m pycore.pyutils.pyservice_cli config ...

See __main__.py for the command tree.
"""
