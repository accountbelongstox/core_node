#!/bin/bash
# Git pull
git pull origin master
git diff --name-only --diff-filter=U
        