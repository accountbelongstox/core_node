# -*- coding: utf-8 -*-
"""
Isolated-runtime policy CLI for TTS installers:

    python -m pycore.bootstrap.runtime_policy <engine-spec|compatibility|base-compatibility|fingerprint|health-probe|cuda-tier|cpu-supported> ...
"""

import sys

import pycore.pyutils.common.python_env.runtime_policy as runtime_policy

raise SystemExit(runtime_policy.run_cli(sys.argv[1:]))
