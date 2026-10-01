# -*- coding: utf-8 -*-
"""
App build_config.ini reader for installers:

    python -m pycore.bootstrap.build_config <app_dir> [field]
"""

import sys

import pycore.pyutils.common.build_config_parser as build_config_parser

raise SystemExit(build_config_parser.run_cli(sys.argv[1:]))
