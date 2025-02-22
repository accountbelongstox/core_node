@echo off
REM Git pull
git pull origin master
git diff --name-only --diff-filter=U
        