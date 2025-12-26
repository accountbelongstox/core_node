# QT Scrcpy TC Development

## Overview

`poly_apps/qtscrcpy_tc` - Carefully view code, call MCP to view QT related code, upgrade to QT latest version, then write a `scripts` compilation script.

## Code Modification

Start modifying code to all English. QT upgrade to 6.10. Read MCP documentation, check differences, then write compilation script.

## Name Replacement

Replace all names in code with "星灿传媒云矩阵" (Xingcan Media Cloud Matrix). Can adapt according to system. Call MCP to view SCRCPY documentation, upgrade to 3.3 latest version. Check how code handles it, whether it's automatic installation.

## Compilation Script

Then write a `./scripts/start.ps1/sh` compilation script. Menu has startup, compilation (can select platform), automatic environment processing.

## Multi-language Support

According to code situation, check if multi-language is in memory at startup. When switching, switch UI interface in real-time.

## Script Consolidation

All scripts merge into one `start.ps1`. Display menu. Can reference other scripts.

## Management End Display

In `http://192.168.50.3:10000/` management end, display a trajectory. Display each APP's promotion path, such as what time posted a small advertisement at XXX location. Trajectory is a list record, and display who posted the advertisement, and whether it's effective. At the same time, can publish APP in technical end. Currently first display mock data, that is, technical end sent APP, promotion personnel go to post small advertisements for promotion. Management end and technical end can both view. Currently all 3 ends' login users are set to username `123`, password `123`. And have central database support.

## QT Upgrade

Old version upgrade to QT 6.10, then fully check differences. Call MCP to view documentation.

## Customer Service Management

Customer service personnel list - management end can modify and delete, clicking any one will pop up details. Give each customer service a nickname. When adding, can also fill in. If not filled, automatically generate, starting with small character, such as "小雨" (Xiaoyu).

## Terminology

Not called "推广包" (promotion package), but called "推广集合" (promotion collection). You choose an appropriate name.

