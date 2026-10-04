#!/bin/bash

# =============================================================================
# desktop_shortcut_manager.sh - Reusable cross-desktop-environment shortcut
# (freedesktop ".desktop") create / edit / remove library for ALL install scripts.
#
# Source it, then call (idempotent, safe to re-run):
#   create_desktop_shortcut_from_desktop_shortcut_manager \
#       --id <stem> --name <Name> --exec <command> \
#       [--icon <name|path>] [--comment <text>] [--generic <text>] \
#       [--categories 'Network;System;'] [--keywords 'a;b;'] [--terminal] \
#       [--no-menu] [--desktop all|all-users|<username>]
#   edit_desktop_shortcut_from_desktop_shortcut_manager  --id <stem> --key <K> --value <V> [--desktop <who>]
#   remove_desktop_shortcut_from_desktop_shortcut_manager --id <stem> [--menu] [--desktop <who>]
#   organize_desktop_icons_from_desktop_shortcut_manager organize|preview|undo [manifest]
# Direct run: bash desktop_shortcut_manager.sh organize|preview|undo [manifest]
#
# Mechanisms (per the freedesktop Desktop Entry Specification + XDG Base Directory
# / user-dirs specs - https://specifications.freedesktop.org/desktop-entry-spec/
# and https://specifications.freedesktop.org/menu-spec/):
#   * Application-menu entry: <id>.desktop in /usr/share/applications -> shown by
#     EVERY compliant DE (GNOME/KDE/XFCE/MATE/Cinnamon/LXQt/LXDE/Budgie/Deepin).
#   * Desktop icon: <id>.desktop in each target user's XDG Desktop dir, written as
#     that user, made executable + (GNOME/Nautilus) marked trusted via
#     `gio set <file> metadata::trusted true` so it shows and launches.
#
# Targets (--desktop): "all"/"all-users" = every real login user (uid>=1000) + root;
# or a single <username>. Works regardless of which user runs the installer: when
# run as root it resolves each user's home + Desktop dir and writes there as that user.
#
# Desktop organizer (Windows parity: DesktopIconManager.ps1): every regular Desktop
# launcher moves into <icons dir>/<Category>/ (OtherApps when nothing matches) with one
# <Category> folder link on the Desktop, except the first stable Google Chrome launcher,
# which is copied into Browsers and stays; loose files (not folders) move into the
# user's Documents folder; each change goes into an undo manifest.
# A launcher already filed there is updated in place by create/edit/remove. A root run
# covers every login user's Desktop, each one as that user.
#
# IDEMPOTENT: identical content overwrites in place; permissions/trust re-applied
# each run; nothing is duplicated. Supports Debian 11-13, Ubuntu 18.04-26.x, Kali
# (all apt-based desktops). NON-FATAL: a missing tool just degrades that step.
# =============================================================================

# Variable declarations (all at top)
DSM_APPLICATIONS_DIR="/usr/share/applications"
DSM_TAB="$(printf '\t')"
DSM_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSM_LIB_FILE="$DSM_LIB_DIR/${BASH_SOURCE[0]##*/}"
DSM_EXEC_PROGRAM=""

# Organizer settings. CORE_NODE_DESKTOP_ICONS_DIR and XDG_STATE_HOME apply to the
# invoking user's own home only; other users get the defaults under their home.
DSM_ORG_ENABLED="${DSM_ORG_ENABLED:-true}"
DSM_ORG_ICONS_SUBDIR=".local/share/core_node/desktopIcons"
DSM_ORG_STATE_SUBDIR="core_node/desktop_icons"
DSM_ORG_MENU_PATH="dd.sh > Linux Management > Linux System Tools > Management & Backup > Organize Desktop Icons"
# Launchers filed in a fixed category whatever their Name/Exec say (launcher id -> category).
declare -gA DSM_ORG_FIXED_CATEGORIES=(
    ["window-launcher"]="DevelopmentTools"
)
# Only the first stable Google Chrome launcher on the Desktop (Exec program in the first list, no Name
# token of the second) is copied into Browsers and stays; every other browser launcher is moved.
DSM_ORG_KEEP_BROWSER_TARGETS="google-chrome google-chrome-stable chrome"
DSM_ORG_KEEP_EXCLUDED_CHANNELS="beta dev canary unstable sxs"
DSM_ORG_BROWSERS_CATEGORY="Browsers"
# Category for launchers no keyword matches (no keywords; refiled when a real category starts matching).
DSM_ORG_FALLBACK_CATEGORY="OtherApps"
# Desktop entries that are shortcuts (never moved to Documents) and the Documents folder key.
DSM_ORG_SHORTCUT_EXTENSIONS=" desktop lnk url "
DSM_ORG_DOCUMENTS_DIR_KEY="XDG_DOCUMENTS_DIR"
DSM_ORG_DOCUMENTS_CATEGORY="Documents"
# Exec hosts whose name says nothing about the application behind the launcher.
DSM_ORG_GENERIC_EXEC_HOSTS=" env sh bash dash zsh python python3 pythonw java javaw node electron flatpak snap wine xdg-open gtk-launch gio pkexec sudo x-terminal-emulator gnome-terminal kgx ptyxis konsole xterm xfce4-terminal "
DSM_ORG_SHORT_KEYWORD_LENGTH=3
# linux_applications_list.sh groups whose categories rank above the keyword lists below.
DSM_ORG_APP_GROUPS="BASE DEV APP AI MCP"
declare -gA DSM_ORG_APP_CATEGORY_ALIASES=(
    ["Communication"]="SocialMedia"
    ["System Utilities"]="SystemTools"
    ["AI Tools"]="AICLITools"
    ["MCP Services"]="AICLITools"
    ["Gaming"]="Games"
)
# Category order and keywords, line for line from DesktopIconManager.ps1
# $Global:DESKTOP_ORGANIZATION_CATEGORIES ("<Category>|<keyword>|..."; \uXXXX kept escaped).
DSM_ORG_CATEGORY_KEYWORDS=(
    "NetworkAccelerators|QuickFox|MalusNet|\u5FEB\u5E06|\u7A7F\u68AD|VPN|Accelerator|Proxy|Teleport"
    "NetworkAccelerators|\u84DD\u706F|\u8FC5\u96F7\u52A0\u901F\u5668|\u7F51\u6613UU|\u8FC5\u6E38\u52A0\u901F\u5668"
    "NetworkAccelerators|\u817E\u8BAF\u7F51\u6E38\u52A0\u901F\u5668|\u5947\u6E38\u52A0\u901F\u5668|\u7F51\u6613UU\u52A0\u901F\u5668"
    "NetworkAccelerators|UU\u52A0\u901F\u5668|\u7F51\u6613UU\u6E38\u620F\u52A0\u901F\u5668|UU\u6E38\u620F\u52A0\u901F\u5668|NetEase UU"
    "NetworkAccelerators|ExpressVPN|NordVPN|Surfshark|CyberGhost|ProtonVPN|Windscribe|TunnelBear"
    "NetworkAccelerators|Hotspot Shield|IPVanish|Private Internet Access|PIA|StrongVPN|VyprVPN"
    "NetworkAccelerators|\u5C0F\u706B\u7BAD|\u84DD\u706F\u4E13\u4E1A\u7248|\u5947\u6E38\u624B\u6E38\u52A0\u901F\u5668"
    "NetworkAccelerators|\u817E\u8BAF\u624B\u6E38\u52A0\u901F\u5668|\u7F51\u6613\u624B\u6E38\u52A0\u901F\u5668"
    "NetworkAccelerators|\u9C9C\u725B|XianNiu|\u52A0\u901F\u5668|Watt Toolkit"
    "NetworkAccelerators|Clash for Windows|Clash Verge|Clash Nyanpasu|Clash Meta|Mihomo|FlClash"
    "NetworkAccelerators|v2rayN|V2Ray|Qv2ray|Nekoray|Hiddify|sing-box|Shadowsocks|ShadowsocksR"
    "APITools|Postman|Insomnia|HTTPie|Swagger|SoapUI|Hoppscotch|Bruno|Apifox"
    "APITools|Apipost|Paw|RapidAPI|JMeter"
    "DevelopmentTools|Visual Studio|IntelliJ|Eclipse|Android Studio|Xcode|Git|Docker"
    "DevelopmentTools|PyCharm|WebStorm|PhpStorm|CLion|DataGrip|GoLand|RubyMine"
    "DevelopmentTools|Rider|AppCode|Fleet|Code|VSCode|Windsurf|Devin|Cursor|VSCodium|Sublime Text|Atom|Brackets"
    "DevelopmentTools|NetBeans|BlueJ|Dev-C++|Code::Blocks|Qt Creator|Delphi|Lazarus"
    "DevelopmentTools|Unity|Unreal Engine|Godot|GameMaker|Construct|RPG Maker"
    "DevelopmentTools|Fiddler|Charles|Wireshark"
    "DevelopmentTools|GitHub Desktop|GitKraken|SourceTree|TortoiseGit|SmartGit|Fork"
    "DevelopmentTools|Docker Desktop|Kubernetes|Vagrant|VirtualBox|VMware|Hyper-V"
    "DevelopmentTools|Node.js|npm|yarn|pnpm|Python|Java|Go|Rust|Ruby|PHP"
    "DevelopmentTools|MySQL Workbench|pgAdmin|MongoDB Compass|Redis Desktop Manager|DBeaver"
    "DevelopmentTools|HeidiSQL|Navicat|DataGrip|TablePlus|Sequel Pro|phpMyAdmin"
    "DevelopmentTools|\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177|\u652F\u4ED8\u5B9D\u5F00\u653E\u5E73\u53F0"
    "DevelopmentTools|\u817E\u8BAF\u4E91|\u963F\u91CC\u4E91|\u767E\u5EA6\u4E91|\u534E\u4E3A\u4E91"
    "TextEditors|Notepad|Sublime|Atom|Vim|gVim|Emacs|TextEdit|Notepad++|UltraEdit|WordPad"
    "TextEditors|EditPlus|EmEditor|Scrivener|WriteMonkey|FocusWriter|Q10|yWriter"
    "TextEditors|Typora|Mark Text|Zettlr|Obsidian|Notion|Roam Research|RemNote"
    "TextEditors|Joplin|Standard Notes|Bear|Ulysses|iA Writer|Drafts|Day One"
    "TextEditors|\u8BB0\u4E8B\u672C|\u6709\u9053\u4E91\u7B14\u8BB0|\u5370\u8C61\u7B14\u8BB0"
    "TextEditors|\u4E3A\u77E5\u7B14\u8BB0|\u8BED\u96C0|\u77F3\u58A8\u6587\u6863|\u817E\u8BAF\u6587\u6863"
    "TextEditors|\u91D1\u5C71\u6587\u6863"
    "DesignTools|Figma|Sketch|Canva|Affinity|Affinity Designer|Inkscape|Draw.io|DrawIO"
    "DesignTools|diagrams.net|Lucidchart|Creately|Excalidraw|XMind|Axure|Balsamiq|Penpot"
    "DesignTools|Pixso|MasterGo|Lunacy|ProcessOn|\u5373\u65F6\u8BBE\u8BA1|\u58A8\u5200"
    "MediaTools|Photoshop|GIMP|VLC|Media Player|Audacity|OBS|Adobe|Premiere"
    "MediaTools|After Effects|Illustrator|InDesign|Lightroom|Acrobat|Animate|Audition"
    "MediaTools|Adobe Creative Cloud|Adobe CC|Adobe Bridge|Adobe Camera Raw|Adobe Dimension"
    "MediaTools|Adobe Dreamweaver|Adobe Fresco|Adobe XD|Adobe Spark|Adobe Stock|Adobe Fonts"
    "MediaTools|Adobe Character Animator|Adobe Media Encoder|Adobe Prelude|Adobe Rush|Adobe Captivate"
    "MediaTools|Adobe FrameMaker|Adobe InCopy|Adobe Substance 3D|Adobe Aero|Adobe Comp CC"
    "MediaTools|CorelDRAW|PaintShop|Paint.NET"
    "MediaTools|Krita|Blender|Cinema 4D|Maya|3ds Max|ZBrush|Substance"
    "MediaTools|DaVinci Resolve|Final Cut Pro|Avid|Vegas Pro|Camtasia|ScreenFlow"
    "MediaTools|Bandicam|Fraps|Action!|XSplit|Streamlabs|OBS Studio|Wirecast"
    "MediaTools|iTunes|Spotify|Apple Music|Tidal|Deezer|Amazon Music|YouTube Music"
    "MediaTools|Foobar2000|Winamp|AIMP|MusicBee|MediaMonkey|JRiver|Plex"
    "MediaTools|Kodi|Emby|Jellyfin|HandBrake|MakeMKV|DVDFab|AnyDVD"
    "MediaTools|\u7231\u5947\u827A|\u817E\u8BAF\u89C6\u9891|\u4F18\u9177|\u54D4\u54E9\u54D4\u54E9"
    "MediaTools|\u82B1\u74E3\u76F4\u64AD|\u6597\u9C7C|\u864E\u7259|\u5FEB\u624B|\u6296\u97F3"
    "MediaTools|\u7F51\u6613\u4E91\u97F3\u4E50|QQ\u97F3\u4E50|\u9177\u72D7\u97F3\u4E50|\u5343\u5343\u97F3\u4E50"
    "MediaTools|\u5168\u6C11K\u6B4C|\u5531\u5427|K\u6B4C\u8FBE\u4EBA|\u9177\u6211\u97F3\u4E50"
    "MediaTools|\u7F8E\u56FE\u79C0\u79C0|\u5149\u5F71\u9B54\u672F\u624B|\u4F1A\u58F0\u4F1A\u5F71"
    "MediaTools|\u5267\u5F71\u5927\u5168|\u8FC5\u96F7\u5F71\u97F3|PotPlayer|KMPlayer|GOM Player"
    "OfficeTools|Microsoft Office|LibreOffice|WPS|WPS Office|OpenOffice|FreeOffice|OnlyOffice"
    "OfficeTools|Excel|Word|PowerPoint|Outlook|OneNote"
    "OfficeTools|Microsoft Access|Publisher|Microsoft Project|Visio|Teams|SharePoint|OneDrive"
    "OfficeTools|Google Workspace|Google Docs|Google Sheets|Google Slides|Google Drive"
    "OfficeTools|Dropbox|Box|iCloud|Mega|pCloud|Sync.com|SpiderOak"
    "OfficeTools|Slack|Discord|Zoom|Skype|WebEx|GoToMeeting|BlueJeans"
    "OfficeTools|Trello|Asana|Monday.com|Basecamp|Jira|Confluence|Notion"
    "OfficeTools|Evernote|OneNote|Bear|Simplenote|Google Keep|Apple Notes"
    "OfficeTools|PDF Creator|PDFtk|Foxit|Nitro|Bluebeam|PDF-XChange"
    "OfficeTools|\u91D1\u5C71\u529E\u516C|\u6C38\u4E2D\u96C6\u6210Office|\u4E2D\u6807\u666E\u534E"
    "OfficeTools|\u817E\u8BAF\u4F1A\u8BAE|\u9489\u9489|\u4F01\u4E1A\u5FAE\u4FE1|\u98DE\u4E66"
    "OfficeTools|\u77F3\u58A8\u6587\u6863|\u817E\u8BAF\u6587\u6863|\u91D1\u5C71\u6587\u6863|\u8BED\u96C0"
    "OfficeTools|\u5370\u8C61\u7B14\u8BB0|\u6709\u9053\u4E91\u7B14\u8BB0|\u4E3A\u77E5\u7B14\u8BB0"
    "OfficeTools|\u767E\u5EA6\u7F51\u76D8|\u963F\u91CC\u4E91\u76D8|\u817E\u8BAF\u5FAE\u4E91"
    "OfficeTools|\u5929\u7FFC\u4E91\u76D8|\u548C\u5F69\u4E91|115\u7F51\u76D8|\u8FC5\u96F7\u4E91\u76D8|123\u4E91\u76D8|123pan"
    "SocialMedia|WeChat|\u5FAE\u4FE1|QQ|Telegram|Discord|Skype|WhatsApp|Signal"
    "SocialMedia|Viber|Line|KakaoTalk|Snapchat|Instagram|Facebook|Twitter|TikTok"
    "SocialMedia|YouTube|LinkedIn|Pinterest|Reddit|Tumblr|Flickr|Vimeo"
    "SocialMedia|Clubhouse|Spaces|Mastodon|BeReal|Threads|Bluesky|Parler"
    "SocialMedia|\u9489\u9489|\u4F01\u4E1A\u5FAE\u4FE1|\u98DE\u4E66|\u817E\u8BAF\u4F1A\u8BAE"
    "SocialMedia|\u94C9\u94C9|\u9047\u89C1|\u9646\u9646|\u63A2\u63A2|\u4E16\u7EAA\u4F73\u7F18"
    "SocialMedia|\u73CD\u7231\u7F51|\u767E\u5408\u7F51|\u6709\u7F18\u7F51|\u5A5A\u793C\u7EAA"
    "SocialMedia|\u5FAE\u535A|\u77E5\u4E4E|\u8C46\u74E3|\u5C0F\u7EA2\u4E66|\u5373\u523B"
    "SocialMedia|\u4ECA\u65E5\u5934\u6761|\u8D23\u4EFB\u7F16\u8F91|\u4E00\u70B9\u8D44\u8BAF|\u641C\u72D0\u65B0\u95FB"
    "SocialMedia|\u7F51\u6613\u65B0\u95FB|\u817E\u8BAF\u65B0\u95FB|\u65B0\u6D6A\u5FAE\u535A|\u65B0\u6D6A\u65B0\u95FB"
    "SocialMedia|YY\u8BED\u97F3|\u5343\u5343\u97F3\u4E50|\u5168\u6C11K\u6B4C|\u5531\u5427"
    "SocialMedia|\u6620\u5BA2|\u5168\u6C11\u5C0F\u89C6\u9891|\u897F\u74DC\u89C6\u9891|\u706B\u5C71\u5C0F\u89C6\u9891"
    "CompressionTools|WinRAR|7-Zip|Bandizip|PeaZip|Archive|WinZip|IZArc|HaoZip"
    "CompressionTools|360\u538B\u7F29|\u597D\u538B|\u5FEB\u538B|2345\u597D\u538B|\u9177\u538B"
    "CompressionTools|PowerArchiver|Ashampoo ZIP|Express Zip|Universal Extractor|Zipware"
    "CompressionTools|jZip|Hamster ZIP|TUGZip|FreeArc|KGB Archiver|UltimateZip"
    "CompressionTools|\u538B\u7F29\u5305|\u89E3\u538B\u7F29|\u6587\u4EF6\u538B\u7F29|\u6587\u4EF6\u89E3\u538B"
    "DatabaseTools|MySQL|PostgreSQL|MongoDB|SQLite|Database|DBeaver|HeidiSQL"
    "DatabaseTools|Navicat|DataGrip|TablePlus|Sequel Pro|phpMyAdmin|Adminer"
    "DatabaseTools|MySQL Workbench|pgAdmin|MongoDB Compass|Redis Desktop Manager|Robo 3T"
    "DatabaseTools|Studio 3T|Oracle SQL Developer|SQL Server Management Studio|SSMS"
    "DatabaseTools|Azure Data Studio|DbVisualizer|SQuirreL SQL|Toad|ERwin|PowerDesigner"
    "DatabaseTools|Visual Paradigm|Enterprise Architect"
    "DatabaseTools|\u6570\u636E\u5E93|\u6570\u636E\u5E93\u7BA1\u7406|SQL\u5DE5\u5177|\u6570\u636E\u5EFA\u6A21"
    "Browsers|Chrome|Edge|Firefox|Safari|Opera|Brave|Vivaldi|Browser"
    "Browsers|Google Chrome|Chrome Beta|Chrome Canary|Microsoft Edge|Thorium|Floorp|LibreWolf|Zen Browser"
    "Browsers|Internet Explorer|IE|Chromium|Tor Browser|DuckDuckGo|Waterfox"
    "Browsers|Pale Moon|SeaMonkey|Maxthon|UC Browser|Yandex Browser|Cent Browser"
    "Browsers|SRWare Iron|Comodo Dragon|Slimjet|Torch Browser|Avant Browser"
    "Browsers|\u8C37\u6B4C\u6D4F\u89C8\u5668|\u706B\u72D0\u6D4F\u89C8\u5668|\u6B27\u670B\u6D4F\u89C8\u5668"
    "Browsers|360\u6D4F\u89C8\u5668|360\u6781\u901F\u6D4F\u89C8\u5668|QQ\u6D4F\u89C8\u5668|\u641C\u72D7\u6D4F\u89C8\u5668"
    "Browsers|\u767E\u5EA6\u6D4F\u89C8\u5668|UC\u6D4F\u89C8\u5668|\u9177\u72D7\u6D4F\u89C8\u5668|\u4E16\u754C\u4E4B\u7A97"
    "Browsers|\u7EFF\u8272\u6D4F\u89C8\u5668|\u795E\u7BAD\u624B|\u5F69\u8679\u6D4F\u89C8\u5668|\u5FC5\u5E94\u6D4F\u89C8\u5668"
    "Browsers|\u6C34\u72D0\u6D4F\u89C8\u5668|\u7231\u597D\u8005\u6D4F\u89C8\u5668|\u5C0F\u767D\u6D4F\u89C8\u5668|\u5343\u5F71\u6D4F\u89C8\u5668"
    "Browsers|\u65D7\u9C7C\u6D4F\u89C8\u5668|\u661F\u613F\u6D4F\u89C8\u5668|\u95EA\u6E38\u6D4F\u89C8\u5668|\u6D77\u8C5A\u6D4F\u89C8\u5668"
    "Games|Steam|Epic Games|Origin|Uplay|Battle.net|GOG Galaxy|Xbox|PlayStation"
    "Games|Minecraft|Roblox|Fortnite|League of Legends|Dota 2|Counter-Strike"
    "Games|World of Warcraft|Overwatch|Apex Legends|Valorant|PUBG|Among Us"
    "Games|Fall Guys|Rocket League|Grand Theft Auto|Call of Duty|FIFA|NBA 2K"
    "Games|\u738B\u8005\u8363\u8000|\u548C\u5E73\u7CBE\u82F1|\u7EDD\u5730\u6C42\u751F|\u82F1\u96C4\u8054\u76DF"
    "Games|\u5B88\u671B\u5148\u950B|\u7089\u77F3\u4F20\u8BF4|\u9B54\u517D\u4E16\u754C|\u5251\u7075"
    "Games|\u68A6\u5E7B\u897F\u6E38|\u5927\u8BDD\u897F\u6E38|\u5929\u9F99\u516B\u90E8|\u4ED9\u5251\u5947\u4FA0\u4F20"
    "Games|\u4E09\u56FD\u6740|\u6597\u5730\u4E3B|\u9EBB\u5C06|\u8C61\u68CB|\u56F4\u68CB"
    "Games|\u6E38\u620F\u5E73\u53F0|\u6E38\u620F\u542F\u52A8\u5668|\u6E38\u620F\u52A0\u901F\u5668|\u6E38\u620F\u5DE5\u5177"
    "Games|WeGame|\u817E\u8BAF\u6E38\u620F\u5E73\u53F0|\u7F51\u6613\u6E38\u620F|\u5B8C\u7F8E\u4E16\u754C"
    "Games|\u5DE8\u4EBA\u7F51\u7EDC|\u76DB\u5927\u6E38\u620F|\u897F\u5C71\u5C45\u6E38\u620F|\u4E5D\u57CE\u6E38\u620F"
    "SecurityTools|Antivirus|McAfee|Norton|Kaspersky|Avast|AVG|Bitdefender|ESET"
    "SecurityTools|Malwarebytes|Windows Defender|Avira|Trend Micro|F-Secure|Sophos"
    "SecurityTools|360\u5B89\u5168\u536B\u58EB|\u817E\u8BAF\u7535\u8111\u7BA1\u5BB6|\u91D1\u5C71\u6BD2\u9738"
    "SecurityTools|\u745E\u661F\u6740\u6BD2|\u6C5F\u6C11\u79D1\u6280|\u5927\u8718\u86DB|\u706B\u7ED2"
    "SecurityTools|\u5B89\u5168\u536B\u58EB|\u6740\u6BD2\u8F6F\u4EF6|\u9632\u706B\u5899|\u7CFB\u7EDF\u4FEE\u590D"
    "SecurityTools|VPN|Proxy|Tor|Firewall|Password Manager|1Password|LastPass"
    "SecurityTools|Bitwarden|Dashlane|KeePass|RoboForm|Sticky Password|True Key"
    "SecurityTools|\u5BC6\u7801\u7BA1\u7406|\u52A0\u5BC6\u8F6F\u4EF6|\u9690\u79C1\u4FDD\u62A4|\u6570\u636E\u52A0\u5BC6"
    "SystemTools|CCleaner|Advanced SystemCare|Driver Booster|Uninstaller|Registry Cleaner"
    "SystemTools|Disk Cleanup|Defraggler|CrystalDiskInfo|HWiNFO|CPU-Z|GPU-Z"
    "SystemTools|MSI Afterburner|Core Temp|SpeedFan|FurMark|Prime95|MemTest86"
    "SystemTools|Process Monitor|Process Explorer|Autoruns|Sysinternals|Task Manager"
    "SystemTools|\u9C81\u5927\u5E08|\u9A71\u52A8\u7CBE\u7075|\u9A71\u52A8\u4EBA\u751F|360\u9A71\u52A8\u5927\u5E08"
    "SystemTools|\u8F6F\u4EF6\u7BA1\u5BB6|\u7CFB\u7EDF\u4F18\u5316|\u6E05\u7406\u5927\u5E08|\u78C1\u76D8\u6574\u7406"
    "SystemTools|\u6CE8\u518C\u8868\u6E05\u7406|\u7CFB\u7EDF\u76D1\u63A7|\u786C\u4EF6\u68C0\u6D4B|\u6E29\u5EA6\u76D1\u63A7"
    "SystemTools|Wise Care 365|IObit Uninstaller|Revo Uninstaller|Geek Uninstaller"
    "SystemTools|TreeSize|WinDirStat|SpaceSniffer|Disk Usage Analyzer|Everything"
    "SystemTools|PowerToys|Sysinternals Suite|Windows Terminal|Command Prompt|PowerShell"
    "DownloadTools|IDM|Internet Download Manager|Free Download Manager|EagleGet|JDownloader"
    "DownloadTools|uTorrent|BitTorrent|qBittorrent|Transmission|Deluge|Vuze|BitComet"
    "DownloadTools|Thunder|\u8FC5\u96F7|\u65CB\u98CE|\u7F51\u9645\u5FEB\u8F66|\u8FC5\u96F7\u6781\u901F\u7248"
    "DownloadTools|\u767E\u5EA6\u7F51\u76D8|\u963F\u91CC\u4E91\u76D8|\u817E\u8BAF\u5FAE\u4E91|\u5929\u7FFC\u4E91\u76D8"
    "DownloadTools|115\u7F51\u76D8|\u548C\u5F69\u4E91|\u5FEB\u76D8|\u8FC5\u96F7\u4E91\u76D8|\u5F71\u68AD\u4E91"
    "DownloadTools|Aria2|Wget|Curl|DownThemAll|Video DownloadHelper|4K Video Downloader"
    "DownloadTools|YouTube-dl|yt-dlp|ClipGrab|Freemake Video Downloader|Any Video Converter"
    "DownloadTools|\u4E0B\u8F7D\u5DE5\u5177|\u4E0B\u8F7D\u5668|\u4E0B\u8F7D\u52A0\u901F|\u79CD\u5B50\u4E0B\u8F7D"
    "DownloadTools|\u78C1\u529B\u94FE\u63A5|BT\u4E0B\u8F7D|\u7F51\u76D8\u4E0B\u8F7D|\u89C6\u9891\u4E0B\u8F7D"
    "Education|Khan Academy|Coursera|edX|Udemy|Skillshare|MasterClass|Pluralsight"
    "Education|LinkedIn Learning|Codecademy|FreeCodeCamp|Duolingo|Babbel|Rosetta Stone"
    "Education|Anki|Quizlet|Memrise|StudyBlue|Evernote|Notion|Obsidian"
    "Education|\u5B66\u800C\u601D\u7F51\u6821|\u65B0\u4E1C\u65B9\u5728\u7EBF|\u597D\u672A\u6765|\u4F5C\u4E1A\u5E2E"
    "Education|\u5C0F\u7334\u641C\u9898|\u4E00\u8D77\u4F5C\u4E1A|\u4F5C\u4E1A\u76D2\u5B50|\u5B66\u4E60\u5F3A\u56FD"
    "Education|\u667A\u5B66\u7F51|\u8D85\u661F\u5B66\u4E60|\u7F51\u6613\u4E91\u8BFE\u5802|\u817E\u8BAF\u8BFE\u5802"
    "Education|\u6709\u9053\u7CBE\u54C1\u8BFE|\u6C99\u62C9\u82F1\u8BED|\u767E\u8BCD\u65A9|\u6247\u8D1D\u5355\u8BCD"
    "Education|\u4E0D\u80CC\u5355\u8BCD|\u6D41\u5229\u8BF4|\u82F1\u8BED\u6D41\u5229\u8BF4|\u53EF\u53EF\u82F1\u8BED"
    "Education|Mathematica|MATLAB|R Studio|SPSS|SAS|Stata|Origin|GraphPad Prism"
    "Education|ChemDraw|AutoCAD|SolidWorks|CATIA|Inventor|Fusion 360|SketchUp"
    "Education|\u5B66\u4E60\u8F6F\u4EF6|\u6559\u80B2\u5E73\u53F0|\u5728\u7EBF\u5B66\u4E60|\u8BED\u8A00\u5B66\u4E60"
    "Finance|QuickBooks|Mint|YNAB|Personal Capital|Quicken|TurboTax|H&R Block"
    "Finance|PayPal|Venmo|Cash App|Zelle|Apple Pay|Google Pay|Samsung Pay"
    "Finance|\u652F\u4ED8\u5B9D|\u5FAE\u4FE1\u652F\u4ED8|\u4E91\u95EA\u4ED8|\u4EAC\u4E1C\u652F\u4ED8"
    "Finance|\u62DB\u5546\u94F6\u884C|\u5DE5\u5546\u94F6\u884C|\u5EFA\u8BBE\u94F6\u884C|\u4E2D\u56FD\u94F6\u884C"
    "Finance|\u519C\u4E1A\u94F6\u884C|\u4EA4\u901A\u94F6\u884C|\u4E2D\u4FE1\u94F6\u884C|\u5E73\u5B89\u94F6\u884C"
    "Finance|\u540C\u82B1\u987A|\u4E1C\u65B9\u8D22\u5BCC|\u5927\u667A\u6167|\u901A\u8FBE\u4FE1"
    "Finance|\u96EA\u7403|\u5BCC\u9014|\u5929\u5929\u57FA\u91D1|\u8682\u8681\u8D22\u5BCC"
    "Finance|\u4EAC\u4E1C\u91D1\u878D|\u5EA6\u5C0F\u6EE1|\u62CD\u62CD\u8D37|\u501F\u5457"
    "Finance|Bitcoin|Ethereum|Coinbase|Binance|Kraken|Robinhood|E*TRADE"
    "Finance|\u8D22\u52A1\u8F6F\u4EF6|\u8BB0\u8D26\u8F6F\u4EF6|\u6295\u8D44\u7406\u8D22|\u94F6\u884C\u5BA2\u6237\u7AEF"
    "Shopping|Amazon|eBay|Walmart|Target|Best Buy|Costco|Home Depot|Lowe's"
    "Shopping|\u6DD8\u5B9D|\u5929\u732B|\u4EAC\u4E1C|\u62FC\u591A\u591A|\u82CF\u5B81\u6613\u8D2D"
    "Shopping|\u552F\u54C1\u4F1A|\u5C0F\u7EA2\u4E66|\u5F97\u7269|\u7F51\u6613\u4E25\u9009|\u8003\u62C9"
    "Shopping|\u4E2D\u56FD\u4E9A\u9A6C\u900A|\u5F53\u5F53|\u56FD\u7F8E|\u5BB6\u4E50\u798F|\u6C38\u8F89"
    "Shopping|\u7F8E\u56E2|\u997F\u4E86\u4E48|\u53E3\u7891|\u5927\u4F17\u70B9\u8BC4|\u7F8E\u56E2\u5916\u5356"
    "Shopping|\u95F2\u9C7C|\u8F6C\u8F6C|\u7231\u56DE\u6536|\u591A\u6297\u7C73|\u5C0F\u9E7F\u8336"
    "Shopping|Shopify|WooCommerce|Magento|BigCommerce|Squarespace|Wix|Etsy"
    "Shopping|\u8D2D\u7269\u8F6F\u4EF6|\u7535\u5546\u5E73\u53F0|\u5728\u7EBF\u8D2D\u7269|\u624B\u673A\u8D2D\u7269"
    "NetworkTools|RustDesk|TeamViewer|AnyDesk|VNC|Remote Desktop|SSH|Telnet"
    "NetworkTools|PuTTY|WinSCP|FileZilla|MobaXterm|Wireshark|Fiddler|Charles"
    "NetworkTools|API|REST|GraphQL|WebSocket"
    "NetworkTools|NetBird|Tailscale|ZeroTier|WireGuard|OpenVPN|EasyTier|Headscale|Radmin VPN"
    "NetworkTools|Hamachi|Sunlogin|\u5411\u65E5\u8475|ToDesk|Parsec|frp|n2n"
    "NetworkTools|Termius|Xshell|Xftp|SecureCRT|mRemoteNG|Remote Desktop Manager"
    "NetworkTools|FTP|SFTP|HTTP|HTTPS|TCP|UDP|DNS|DHCP|VPN"
    "NetworkTools|Proxy|Firewall|Router|Switch|Gateway|Load Balancer"
    "NetworkTools|Network Monitor|Bandwidth Monitor|Packet Analyzer|Network Scanner"
    "NetworkTools|Ping|Traceroute|Netstat|Ipconfig|Nslookup|Dig"
    "NetworkTools|\u8FDC\u7A0B\u63A7\u5236|\u8FDC\u7A0B\u8BBF\u95EE|\u7F51\u7EDC\u5DE5\u5177"
    "NetworkTools|\u7F51\u7EDC\u68C0\u6D4B|\u7F51\u7EDC\u76D1\u63A7|\u7F51\u7EDC\u5206\u6790"
    "NetworkTools|\u7F51\u7EDC\u5B89\u5168|\u7F51\u7EDC\u4F18\u5316|\u7F51\u7EDC\u7BA1\u7406"
    "AICLITools|ACLI|Atlassian CLI|OpenAI CLI|Claude CLI|Anthropic CLI|GitHub CLI|gh"
    "AICLITools|Azure CLI|AWS CLI|Google Cloud CLI|gcloud|kubectl|helm|docker"
    "AICLITools|Terraform|Ansible|Chef|Puppet|Salt|Jenkins CLI|CircleCI CLI"
    "AICLITools|GitLab CLI|Bitbucket CLI|Jira CLI|Confluence CLI|Slack CLI"
    "AICLITools|Discord CLI|Telegram CLI|WhatsApp CLI|WeChat CLI|QQ CLI"
    "AICLITools|ChatGPT CLI|Bard CLI|Copilot CLI|Codeium CLI|Tabnine CLI"
    "AICLITools|Hugging Face CLI|Transformers CLI|PyTorch CLI|TensorFlow CLI"
    "AICLITools|LangChain CLI|LlamaIndex CLI|AutoGPT CLI|BabyAGI CLI"
    "AICLITools|Stable Diffusion CLI|Midjourney CLI|DALL-E CLI|Firefly CLI"
    "AICLITools|AI Assistant|AI Chat|AI Code|AI Generate|AI Model|AI Tool"
    "AICLITools|Machine Learning CLI|ML CLI|Deep Learning CLI|Neural Network CLI"
    "AICLITools|AI Development|AI Framework|AI Library|AI Platform|AI Service"
    "AICLITools|Natural Language Processing|NLP CLI|Computer Vision CLI|CV CLI"
    "AICLITools|AI Testing|AI Debugging|AI Monitoring|AI Analytics|AI Reporting"
    "AICLITools|Claude|ChatGPT|OpenAI|Gemini|Copilot|DeepSeek|Kimi|Qwen|Doubao|Grok"
    "AICLITools|Perplexity|Ollama|LM Studio|Cherry Studio|Codex|Manus"
    "AICLITools|\u8C46\u5305|\u901A\u4E49\u5343\u95EE|\u6587\u5FC3\u4E00\u8A00|\u817E\u8BAF\u5143\u5B9D|\u667A\u8C31\u6E05\u8A00"
)
# Undo manifest line formats (written by _dsm_org_write_manifest only).
DSM_ORG_JSON_STRING_RE='"(([^"\\]|\\.)*)"'
DSM_ORG_ENTRY_RE="^[[:space:]]*\\{\"Action\": ${DSM_ORG_JSON_STRING_RE}, \"Source\": ${DSM_ORG_JSON_STRING_RE}, \"Destination\": ${DSM_ORG_JSON_STRING_RE}, \"Category\": ${DSM_ORG_JSON_STRING_RE}, \"Reason\": ${DSM_ORG_JSON_STRING_RE}, \"Time\": ${DSM_ORG_JSON_STRING_RE}\\},?\$"
DSM_ORG_RUN_ID_RE='^[[:space:]]*"RunId": "([^"]*)"'
DSM_ORG_UNDONE_AT_RE='^[[:space:]]*"UndoneAt": "([^"]*)"'
DSM_ORG_UNDONE_AT_EMPTY='"UndoneAt": "",'
# Output labels; a root run collects the manifests of its per-user runs from these lines.
DSM_ORG_MANIFEST_LABEL="[dsm] Undo manifest: "
DSM_ORG_UNDONE_LABEL="[dsm] Marked undone: "

# Organizer run state (reset per run and per user).
DSM_ORG_CATEGORIES=()
DSM_ORG_APP_SIGNALS=""
DSM_ORG_RUN_ID=""
DSM_ORG_MANIFESTS=()
DSM_ORG_JSON=""
DSM_ORG_UNJSON=""
DSM_ORG_ENTRY_NAME=""
DSM_ORG_ENTRY_EXEC=""
DSM_ORG_ENTRY_TYPE=""
DSM_ORG_DECISION=""
DSM_ORG_DECISION_REASON=""
DSM_ORG_DISPLACED=""
DSM_ORG_CHANGES=0
DSM_ORG_R_PATH=()
DSM_ORG_R_ORIGIN=()
DSM_ORG_R_STATE=()
DSM_ORG_R_NAME=()
DSM_ORG_R_TARGET=()
DSM_ORG_R_CAT=()
DSM_ORG_R_REASON=()
DSM_ORG_R_SUPPORTED=()
DSM_ORG_R_KEEPCOPY=()
DSM_ORG_I_REC=()
DSM_ORG_I_CAT=()
DSM_ORG_I_MODE=()
DSM_ORG_M_ACTION=()
DSM_ORG_M_SOURCE=()
DSM_ORG_M_DEST=()
DSM_ORG_M_CAT=()
DSM_ORG_M_REASON=()
DSM_ORG_M_TIME=()
DSM_ORG_BROKEN=()
DSM_ORG_LOOSE=()
declare -gA DSM_ORG_CLAIMED=()
DSM_ORG_UNIQUE=""
DSM_ORG_CONFLICT_PATH=()
DSM_ORG_CONFLICT_REASON=()
DSM_ORG_DONE=()
DSM_ORG_FAILED=()

# Privilege prefix: honor a caller-set USE_SUDO (from gvar_common); else derive it
# (root -> none; non-root with sudo -> "sudo"; otherwise empty / best-effort).
_dsm_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then printf '%s' "$USE_SUDO"; return 0; fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then printf 'sudo'; fi
}

# Run a command as <user>, so a path inside that user's home (a planted symlink, say)
# never acts with root rights: root drops with runuser, another invoker goes through sudo -u.
_dsm_as_user() {
    local user="$1" sudo=""
    shift
    if [ "$user" = "$(id -un)" ]; then
        "$@"
    elif [ "$EUID" -eq 0 ]; then
        runuser -u "$user" -- "$@"
    else
        sudo="$(_dsm_sudo)"
        if [ -n "$sudo" ]; then $sudo -u "$user" -- "$@"; else "$@"; fi
    fi
}

# Sanitize an id/name into a safe .desktop filename stem (lowercase, [a-z0-9._-]).
_dsm_id() {
    printf '%s' "$1" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9._-'
}

# Echo "user<TAB>home" for every real login user: root + uid in [1000,65534).
_dsm_login_users() {
    awk -F: -v OFS="$DSM_TAB" '($3>=1000 && $3<65534) || $3==0 {print $1, $6}' /etc/passwd 2>/dev/null
}

# Resolve a user's XDG directory: the localized <key> from the user's
# ~/.config/user-dirs.dirs when present (parsed literally and $HOME-substituted, NOT
# sourced - sourcing as root would wrongly expand $HOME to /root), else ~/<fallback>.
_dsm_xdg_user_dir() {
    local home="$1" key="$2" fallback="$3" d="" v=""
    d="$home/$fallback"
    if [ -r "$home/.config/user-dirs.dirs" ]; then
        v="$(grep -E "^[[:space:]]*$key=" "$home/.config/user-dirs.dirs" 2>/dev/null | head -1 | cut -d= -f2-)"
        v="${v%\"}"; v="${v#\"}"
        [ -n "$v" ] && d="${v/\$HOME/$home}"
    fi
    printf '%s' "$d"
}

_dsm_desktop_dir() {
    _dsm_xdg_user_dir "$2" XDG_DESKTOP_DIR Desktop
}

# Build the .desktop content.
# Args: name exec icon comment categories keywords terminal generic extra
# `extra` is a newline-separated set of raw additional Desktop Entry lines
# (e.g. "StartupWMClass=Foo", "MimeType=...", "NoDisplay=true").
_dsm_build() {
    local name="$1" exec="$2" icon="$3" comment="$4" cats="$5" kw="$6" term="$7" generic="$8" extra="$9" notify="${10}"
    printf '[Desktop Entry]\n'
    printf 'Version=1.0\n'
    printf 'Type=Application\n'
    printf 'Name=%s\n' "$name"
    [ -n "$generic" ] && printf 'GenericName=%s\n' "$generic"
    [ -n "$comment" ] && printf 'Comment=%s\n' "$comment"
    printf 'Exec=%s\n' "$exec"
    printf 'Icon=%s\n' "${icon:-application-x-executable}"
    printf 'Terminal=%s\n' "${term:-false}"
    printf 'Categories=%s\n' "${cats:-Utility;}"
    [ -n "$kw" ] && printf 'Keywords=%s\n' "$kw"
    # StartupNotify is emitted EXACTLY ONCE (no duplicate-key, which is spec-invalid).
    printf 'StartupNotify=%s\n' "${notify:-false}"
    [ -n "$extra" ] && printf '%s\n' "$extra"
    return 0
}

# Write the system-wide menu entry (/usr/share/applications) and refresh the cache.
_dsm_write_menu() {
    local id="$1" content="$2" sudo file
    sudo="$(_dsm_sudo)"
    file="$DSM_APPLICATIONS_DIR/$id.desktop"
    $sudo mkdir -p "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    printf '%s\n' "$content" | $sudo tee "$file" >/dev/null 2>&1 || return 1
    $sudo chmod 0644 "$file" 2>/dev/null || true
    command -v update-desktop-database >/dev/null 2>&1 \
        && $sudo update-desktop-database "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    return 0
}

# GNOME/Nautilus 42+: mark a launcher trusted, AS the user against their session bus.
_dsm_trust_launcher() {
    local user="$1" file="$2" uid=""
    command -v gio >/dev/null 2>&1 || return 0
    uid="$(id -u "$user" 2>/dev/null)"
    [ -n "$uid" ] || return 0
    if [ "$EUID" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
        runuser -u "$user" -- env DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" \
            gio set "$file" metadata::trusted true 2>/dev/null || true
    else
        gio set "$file" metadata::trusted true 2>/dev/null || true
    fi
    return 0
}

# Print <icons dir>/<Category>/<id>.desktop for every category that already files this launcher.
_dsm_filed_launchers() {
    local user="$1" home="$2" id="$3" base="" category=""
    base="$(_dsm_org_base_dir "$user" "$home")"
    _dsm_org_load_categories
    for category in "${DSM_ORG_CATEGORIES[@]}"; do
        [ -f "$base/$category/$id.desktop" ] && printf '%s\n' "$base/$category/$id.desktop"
    done
    return 0
}

# Print every copy of a user's launcher: the Desktop file, then the filed copies.
_dsm_user_launcher_files() {
    local user="$1" home="$2" id="$3"
    printf '%s\n' "$(_dsm_desktop_dir "$user" "$home")/$id.desktop"
    _dsm_filed_launchers "$user" "$home" "$id"
}

# Drop a desktop icon into ONE user's Desktop dir: executable + owned by the user +
# GNOME-trusted (Nautilus only shows/launches a desktop .desktop when trusted).
# A launcher the organizer filed into a category folder is updated there instead,
# so installers do not bring it back onto the Desktop. Every write runs as the user.
_dsm_write_desktop_icon() {
    local user="$1" home="$2" id="$3" content="$4" dir file target
    local targets=()
    [ -n "$user" ] && [ -n "$home" ] && [ -d "$home" ] || return 0
    dir="$(_dsm_desktop_dir "$user" "$home")"
    file="$dir/$id.desktop"
    mapfile -t targets < <(_dsm_filed_launchers "$user" "$home" "$id")
    if [ -e "$file" ] || [ "${#targets[@]}" -eq 0 ]; then
        [ -d "$dir" ] || _dsm_as_user "$user" mkdir -p -- "$dir" 2>/dev/null || true
        targets+=("$file")
    fi
    for target in "${targets[@]}"; do
        printf '%s\n' "$content" | _dsm_as_user "$user" tee -- "$target" >/dev/null 2>&1 || return 1
        # Executable: KDE/XFCE/MATE/Cinnamon/LXQt/LXDE require +x to launch without a warning.
        _dsm_as_user "$user" chmod 0755 -- "$target" 2>/dev/null || true
        _dsm_trust_launcher "$user" "$target"
    done
    return 0
}

# Apply an action across the requested desktop target(s). $1=action fn, $2=who, $3=id, $4=content
_dsm_for_desktops() {
    local fn="$1" who="$2" id="$3" content="$4" u h
    case "$who" in
        ""|none) return 0 ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$u" ] || continue
                "$fn" "$u" "$h" "$id" "$content"
            done < <(_dsm_login_users)
            ;;
        *)
            h="$(getent passwd "$who" 2>/dev/null | cut -d: -f6)"
            "$fn" "$who" "$h" "$id" "$content"
            ;;
    esac
    return 0
}

# ---- public API -------------------------------------------------------------

# Create (or idempotently update) a shortcut. See file header for options.
create_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" name="" exec="" icon="" comment="" cats="" kw="" term="false" generic=""
    local do_menu=1 desktop_who="" content="" extra="" el notify="false"
    local extra_lines=()
    local NL
    NL=$'\n'
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)              id="$(_dsm_id "$2")"; shift 2 ;;
            --name)            name="$2"; shift 2 ;;
            --exec)            exec="$2"; shift 2 ;;
            --icon)            icon="$2"; shift 2 ;;
            --comment)         comment="$2"; shift 2 ;;
            --generic)         generic="$2"; shift 2 ;;
            --categories)      cats="$2"; shift 2 ;;
            --keywords)        kw="$2"; shift 2 ;;
            --terminal)        term="true"; shift ;;
            --no-menu)         do_menu=0; shift ;;
            --desktop)         desktop_who="$2"; shift 2 ;;
            --startup-notify)  notify="$2"; shift 2 ;;
            --extra)           extra_lines+=("$2"); shift 2 ;;            # raw "KEY=VALUE"
            --startup-wmclass) extra_lines+=("StartupWMClass=$2"); shift 2 ;;
            --mimetype)        extra_lines+=("MimeType=$2"); shift 2 ;;
            --no-display)      extra_lines+=("NoDisplay=true"); shift ;;
            *) shift ;;
        esac
    done
    if [ -z "$id" ] || [ -z "$name" ] || [ -z "$exec" ]; then
        echo "[dsm] create: --id, --name and --exec are required" >&2
        return 1
    fi
    # Fold any StartupNotify passed via --extra into the single notify slot so it is
    # never emitted twice (keeps backward compatibility with --extra StartupNotify=...).
    for el in "${extra_lines[@]:-}"; do
        [ -n "$el" ] || continue
        case "$el" in
            StartupNotify=*) notify="${el#StartupNotify=}" ;;
            *) extra="${extra:+$extra$NL}$el" ;;
        esac
    done
    content="$(_dsm_build "$name" "$exec" "$icon" "$comment" "$cats" "$kw" "$term" "$generic" "$extra" "$notify")"
    if [ "$do_menu" -eq 1 ]; then
        _dsm_write_menu "$id" "$content" \
            && echo "[dsm] menu entry: $DSM_APPLICATIONS_DIR/$id.desktop (all desktop environments)"
    fi
    _dsm_for_desktops _dsm_write_desktop_icon "$desktop_who" "$id" "$content"
    [ -n "$desktop_who" ] && [ "$desktop_who" != "none" ] && echo "[dsm] desktop icon written for: $desktop_who"
    return 0
}

# Remove a shortcut. Default (no flags) removes from the menu AND every desktop.
remove_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" do_menu=0 desktop_who="" any=0 sudo u h file
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)      id="$(_dsm_id "$2")"; shift 2 ;;
            --menu)    do_menu=1; any=1; shift ;;
            --desktop) desktop_who="$2"; any=1; shift 2 ;;
            *) shift ;;
        esac
    done
    [ -n "$id" ] || { echo "[dsm] remove: --id required" >&2; return 1; }
    if [ "$any" -eq 0 ]; then do_menu=1; desktop_who="all"; fi
    sudo="$(_dsm_sudo)"
    [ "$do_menu" -eq 1 ] && { $sudo rm -f "$DSM_APPLICATIONS_DIR/$id.desktop" 2>/dev/null || true; }
    case "$desktop_who" in
        ""|none) : ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$h" ] || continue
                while IFS= read -r file; do
                    $sudo rm -f "$file" 2>/dev/null || true
                done < <(_dsm_user_launcher_files "$u" "$h" "$id")
            done < <(_dsm_login_users)
            ;;
        *)
            h="$(getent passwd "$desktop_who" 2>/dev/null | cut -d: -f6)"
            while IFS= read -r file; do
                $sudo rm -f "$file" 2>/dev/null || true
            done < <(_dsm_user_launcher_files "$desktop_who" "$h" "$id")
            ;;
    esac
    command -v update-desktop-database >/dev/null 2>&1 \
        && $sudo update-desktop-database "$DSM_APPLICATIONS_DIR" 2>/dev/null || true
    echo "[dsm] removed shortcut: $id"
    return 0
}

# Edit a single key in an existing shortcut (menu + the chosen desktops). For
# anything more than a one-key tweak, call create again (it upserts idempotently).
edit_desktop_shortcut_from_desktop_shortcut_manager() {
    local id="" key="" value="" desktop_who="all" sudo u h file
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)      id="$(_dsm_id "$2")"; shift 2 ;;
            --key)     key="$2"; shift 2 ;;
            --value)   value="$2"; shift 2 ;;
            --desktop) desktop_who="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    if [ -z "$id" ] || [ -z "$key" ]; then echo "[dsm] edit: --id and --key required" >&2; return 1; fi
    sudo="$(_dsm_sudo)"
    # $2: the owning user (user launchers are edited as that user), empty for the menu entry.
    _dsm_set_key() {
        local file="$1" owner="$2"
        [ -f "$file" ] || return 0
        if [ -n "$owner" ]; then set -- _dsm_as_user "$owner"; else set -- $sudo; fi
        if grep -q "^$key=" "$file" 2>/dev/null; then
            "$@" sed -i "s|^$key=.*|$key=$value|" "$file" 2>/dev/null || true
        else
            [ -z "$(tail -c 1 "$file" 2>/dev/null)" ] || printf '\n' | "$@" tee -a "$file" >/dev/null 2>&1
            printf '%s=%s\n' "$key" "$value" | "$@" tee -a "$file" >/dev/null 2>&1 || true
        fi
    }
    _dsm_set_key "$DSM_APPLICATIONS_DIR/$id.desktop" ""
    case "$desktop_who" in
        none|"") : ;;
        all|all-users|true)
            while IFS="$DSM_TAB" read -r u h; do
                [ -n "$h" ] || continue
                while IFS= read -r file; do
                    _dsm_set_key "$file" "$u"
                done < <(_dsm_user_launcher_files "$u" "$h" "$id")
            done < <(_dsm_login_users) ;;
        *)
            h="$(getent passwd "$desktop_who" 2>/dev/null | cut -d: -f6)"
            while IFS= read -r file; do
                _dsm_set_key "$file" "$desktop_who"
            done < <(_dsm_user_launcher_files "$desktop_who" "$h" "$id") ;;
    esac
    echo "[dsm] edited shortcut: $id ($key)"
    return 0
}

# ---- desktop organizer ------------------------------------------------------

# Category folder base and undo state dir for one user.
_dsm_org_base_dir() {
    local user="$1" home="$2"
    if [ "$home" = "$HOME" ] && [ -n "${CORE_NODE_DESKTOP_ICONS_DIR:-}" ]; then
        printf '%s' "$CORE_NODE_DESKTOP_ICONS_DIR"
    else
        printf '%s' "$home/$DSM_ORG_ICONS_SUBDIR"
    fi
}

_dsm_org_state_dir() {
    local user="$1" home="$2"
    if [ "$home" = "$HOME" ] && [ -n "${XDG_STATE_HOME:-}" ]; then
        printf '%s' "$XDG_STATE_HOME/$DSM_ORG_STATE_SUBDIR"
    else
        printf '%s' "$home/.local/state/$DSM_ORG_STATE_SUBDIR"
    fi
}

# Users whose Desktop is organized: every login user as root, else the invoking user.
_dsm_org_targets() {
    if [ "$EUID" -eq 0 ]; then
        _dsm_login_users
    else
        printf '%s\t%s\n' "$(id -un)" "$HOME"
    fi
}

_dsm_org_load_categories() {
    local line="" category="" seen=" "
    [ "${#DSM_ORG_CATEGORIES[@]}" -gt 0 ] && return 0
    for line in "${DSM_ORG_CATEGORY_KEYWORDS[@]}"; do
        category="${line%%|*}"
        case "$seen" in *" $category "*) continue ;; esac
        seen="$seen$category "
        DSM_ORG_CATEGORIES+=("$category")
    done
    DSM_ORG_CATEGORIES+=("$DSM_ORG_FALLBACK_CATEGORY")
    return 0
}

# App list signals, highest rank: key and Name match names and Exec targets, Exec matches targets only.
_dsm_org_app_signals() {
    local group="" app="" name="" exec="" category=""
    for group in $DSM_ORG_APP_GROUPS; do
        for app in $(get_apps_by_package_group "$group"); do
            category="$(get_app_property "$app" category)"
            category="${DSM_ORG_APP_CATEGORY_ALIASES[$category]:-${category// /}}"
            [ -n "$category" ] || continue
            name="$(get_app_property "$app" name)"
            exec="$(get_app_property "$app" exec)"
            printf 'K\t%s\t%s\t1\t1\n' "$category" "$app"
            [ -n "$name" ] && printf 'K\t%s\t%s\t1\t1\n' "$category" "$name"
            [ -n "$exec" ] && printf 'K\t%s\t%s\t0\t1\n' "$category" "${exec##*/}"
        done
    done
    return 0
}

_dsm_org_init() {
    _dsm_org_load_categories
    if ! declare -F get_apps_by_package_group >/dev/null 2>&1 && [ -r "$DSM_LIB_DIR/linux_applications_list.sh" ]; then
        source "$DSM_LIB_DIR/linux_applications_list.sh"
    fi
    if [ -z "$DSM_ORG_APP_SIGNALS" ] && declare -F get_apps_by_package_group >/dev/null 2>&1; then
        DSM_ORG_APP_SIGNALS="$(_dsm_org_app_signals)"
    fi
    return 0
}

# First program of an Exec= value (env and its VAR=value/-options skipped, quotes removed) -> DSM_EXEC_PROGRAM.
_dsm_exec_program() {
    local rest="$1" token="" after_env=0
    DSM_EXEC_PROGRAM=""
    while [ -n "$rest" ]; do
        rest="${rest#"${rest%%[![:space:]]*}"}"
        [ -n "$rest" ] || break
        if [ "${rest:0:1}" = '"' ]; then
            rest="${rest:1}"
            token="${rest%%\"*}"
            rest="${rest:${#token}}"
            rest="${rest:1}"
        else
            token="${rest%%[[:space:]]*}"
            rest="${rest:${#token}}"
        fi
        if [ "$after_env" -eq 0 ] && { [ "$token" = "env" ] || [ "$token" = "/usr/bin/env" ]; }; then
            after_env=1
            continue
        fi
        if [ "$after_env" -eq 1 ] && { [[ "$token" == -* ]] || [[ "$token" == *=* ]]; }; then
            continue
        fi
        DSM_EXEC_PROGRAM="$token"
        break
    done
    return 0
}

# Print the program a launcher runs (shared with 154_repair_desktop_icons.sh).
_dsm_entry_exec_target() {
    local entry="$1" line=""
    line="$(grep -m1 '^Exec=' "$entry" 2>/dev/null)"
    _dsm_exec_program "${line#Exec=}"
    printf '%s' "$DSM_EXEC_PROGRAM"
}

# True when a launcher program resolves: an existing absolute path, a PATH command or ~/.local/bin/<cmd>.
_dsm_exec_program_exists() {
    local program="$1" home="$2"
    case "$program" in
        "") return 1 ;;
        /*) [ -e "$program" ] ;;
        *) command -v "$program" >/dev/null 2>&1 || [ -x "/snap/bin/$program" ] \
               || { [ -n "$home" ] && [ -x "$home/.local/bin/$program" ]; } ;;
    esac
}

# Read Name/Exec/Type of the [Desktop Entry] group -> DSM_ORG_ENTRY_NAME/EXEC/TYPE.
_dsm_org_read_entry() {
    local file="$1" line="" in_main=0
    DSM_ORG_ENTRY_NAME=""
    DSM_ORG_ENTRY_EXEC=""
    DSM_ORG_ENTRY_TYPE=""
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        case "$line" in
            "[Desktop Entry]") in_main=1 ;;
            "["*) [ "$in_main" -eq 1 ] && break ;;
            Name=*) [ "$in_main" -eq 1 ] && [ -z "$DSM_ORG_ENTRY_NAME" ] && DSM_ORG_ENTRY_NAME="${line#Name=}" ;;
            Exec=*) [ "$in_main" -eq 1 ] && [ -z "$DSM_ORG_ENTRY_EXEC" ] && DSM_ORG_ENTRY_EXEC="${line#Exec=}" ;;
            Type=*) [ "$in_main" -eq 1 ] && [ -z "$DSM_ORG_ENTRY_TYPE" ] && DSM_ORG_ENTRY_TYPE="${line#Type=}" ;;
        esac
    done < "$file"
    return 0
}

# Regular, visible *.desktop files only (no symlinks, no control characters in the path).
_dsm_org_is_launcher() {
    [ -f "$1" ] && [ ! -L "$1" ] && [[ "$1" != *[[:cntrl:]]* ]]
}

_dsm_org_dir_empty() {
    local entry=""
    for entry in "$1"/* "$1"/.[!.]* "$1"/..?*; do
        if [ -e "$entry" ] || [ -L "$entry" ]; then
            return 1
        fi
    done
    return 0
}

_dsm_org_mkdir() {
    [ -d "$1" ] || mkdir -p -- "$1" 2>/dev/null
}

# A root run organizes, previews or undoes another user's Desktop as that user (runuser), so
# the files, symlinks and manifests in that home never act with root rights, and whatever the
# run creates belongs to the user. The library goes in on stdin (the repo may be unreadable
# to the user); the manifest lines of the output fill DSM_ORG_MANIFESTS.
_dsm_org_run_as_user() {
    local user="$1" home="$2" uid="" line=""
    shift 2
    uid="$(id -u "$user" 2>/dev/null)"
    [ -n "$uid" ] || return 0
    if ! command -v runuser >/dev/null 2>&1; then
        echo "[dsm] Skipped the Desktop of $user: runuser (util-linux) not found"
        return 0
    fi
    while IFS= read -r line; do
        printf '%s\n' "$line"
        case "$line" in
            "$DSM_ORG_MANIFEST_LABEL"*) DSM_ORG_MANIFESTS+=("${line#"$DSM_ORG_MANIFEST_LABEL"}") ;;
            "$DSM_ORG_UNDONE_LABEL"*) DSM_ORG_MANIFESTS+=("${line#"$DSM_ORG_UNDONE_LABEL"}") ;;
        esac
    done < <(
        {
            cat -- "$DSM_LIB_FILE"
            declare -p DSM_ORG_APP_SIGNALS DSM_ORG_ENABLED
            printf 'organize_desktop_icons_from_desktop_shortcut_manager'
            printf ' %q' "$@"
            printf ' </dev/null\n'
        } | (cd / && runuser -u "$user" -- env -u CORE_NODE_DESKTOP_ICONS_DIR -u XDG_STATE_HOME -u USE_SUDO -u SUDO_USER \
                HOME="$home" USER="$user" LOGNAME="$user" XDG_RUNTIME_DIR="/run/user/$uid" \
                DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" bash -s 2>&1)
    )
    return 0
}

_dsm_org_json() {
    local value="$1" backslash='\' quote='"'
    value="${value//"$backslash"/"$backslash$backslash"}"
    value="${value//"$quote"/"$backslash$quote"}"
    DSM_ORG_JSON="\"$value\""
}

_dsm_org_unjson() {
    local value="$1" backslash='\' quote='"' marker=$'\001'
    value="${value//"$backslash$backslash"/"$marker"}"
    value="${value//"$backslash$quote"/"$quote"}"
    DSM_ORG_UNJSON="${value//"$marker"/"$backslash"}"
}

_dsm_org_now() {
    printf -v "$1" '%(%Y-%m-%dT%H:%M:%S)T' -1
}

_dsm_org_new_run_id() {
    local now="${EPOCHREALTIME:-}" seconds="" millis="000"
    seconds="${now%%[.,]*}"
    if [ -n "$seconds" ] && [ "$seconds" != "$now" ]; then
        millis="${now:${#seconds}+1:3}"
    else
        seconds="$(date +%s)"
    fi
    printf -v DSM_ORG_RUN_ID '%(%Y%m%d_%H%M%S)T_%s' "$seconds" "$millis"
}

_dsm_org_record() {
    local now=""
    _dsm_org_now now
    DSM_ORG_M_ACTION+=("$1")
    DSM_ORG_M_SOURCE+=("$2")
    DSM_ORG_M_DEST+=("$3")
    DSM_ORG_M_CAT+=("$4")
    DSM_ORG_M_REASON+=("$5")
    DSM_ORG_M_TIME+=("$now")
}

_dsm_org_reset_user() {
    DSM_ORG_R_PATH=(); DSM_ORG_R_ORIGIN=(); DSM_ORG_R_STATE=(); DSM_ORG_R_NAME=(); DSM_ORG_R_TARGET=()
    DSM_ORG_R_CAT=(); DSM_ORG_R_REASON=(); DSM_ORG_R_SUPPORTED=(); DSM_ORG_R_KEEPCOPY=()
    DSM_ORG_I_REC=(); DSM_ORG_I_CAT=(); DSM_ORG_I_MODE=()
    DSM_ORG_M_ACTION=(); DSM_ORG_M_SOURCE=(); DSM_ORG_M_DEST=(); DSM_ORG_M_CAT=(); DSM_ORG_M_REASON=(); DSM_ORG_M_TIME=()
    DSM_ORG_BROKEN=(); DSM_ORG_LOOSE=(); DSM_ORG_CLAIMED=()
    DSM_ORG_CONFLICT_PATH=(); DSM_ORG_CONFLICT_REASON=(); DSM_ORG_DONE=(); DSM_ORG_FAILED=()
    DSM_ORG_CHANGES=0
}

# Scan the Desktop, then every category folder (the scan order breaks mtime ties).
_dsm_org_scan() {
    local home="$1" desktop="$2" base="$3" dir="" file="" origin="" state=""
    for origin in "" "${DSM_ORG_CATEGORIES[@]}"; do
        dir="$desktop"
        [ -n "$origin" ] && dir="$base/$origin"
        for file in "$dir"/*.desktop; do
            _dsm_org_is_launcher "$file" || continue
            _dsm_org_read_entry "$file"
            state="valid"
            DSM_EXEC_PROGRAM=""
            if [ "$DSM_ORG_ENTRY_TYPE" != "Link" ]; then
                _dsm_exec_program "$DSM_ORG_ENTRY_EXEC"
                _dsm_exec_program_exists "$DSM_EXEC_PROGRAM" "$home" || state="broken"
            fi
            if [ -z "$DSM_ORG_ENTRY_NAME" ]; then
                DSM_ORG_ENTRY_NAME="${file##*/}"
                DSM_ORG_ENTRY_NAME="${DSM_ORG_ENTRY_NAME%.desktop}"
            fi
            DSM_ORG_R_PATH+=("$file")
            DSM_ORG_R_ORIGIN+=("$origin")
            DSM_ORG_R_STATE+=("$state")
            DSM_ORG_R_NAME+=("${DSM_ORG_ENTRY_NAME//$'\t'/ }")
            DSM_ORG_R_TARGET+=("$DSM_EXEC_PROGRAM")
        done
    done
    return 0
}

# Loose real files on the Desktop: visible, no symlinks, no shortcut files. Folders stay on the
# Desktop (they can be application data), which also keeps the icons dir and Documents in place.
_dsm_org_scan_loose() {
    local desktop="$1" base="$2" docs="$3" item="" name="" ext=""
    [ "$docs" != "$desktop" ] || return 0
    for item in "$desktop"/*; do
        [ -e "$item" ] && [ ! -L "$item" ] || continue
        [[ "$item" != *[[:cntrl:]]* ]] || continue
        [ -f "$item" ] || continue
        name="${item##*/}"
        ext="${name##*.}"
        if [ "$ext" != "$name" ] && [[ "$DSM_ORG_SHORTCUT_EXTENSIONS" == *" ${ext,,} "* ]]; then continue; fi
        [ "$item" != "$base" ] && [[ "$base/" != "$item/"* ]] || continue
        [ "$item" != "$docs" ] && [[ "$docs/" != "$item/"* ]] || continue
        DSM_ORG_LOOSE+=("$item")
    done
    return 0
}

# Classify every scanned launcher in one awk pass (token matching mirrors
# Find-DesktopCategoryMatch: camelCase and letter/digit splits, keywords of
# DSM_ORG_SHORT_KEYWORD_LENGTH chars or fewer must start the text, non-ASCII
# keywords match as substrings; best = score, then app list, then category order).
_dsm_org_classify() {
    local idx="" category="" reason="" supported="" keep="" i=0 target=""
    while IFS='|' read -r idx category reason supported keep; do
        DSM_ORG_R_CAT[idx]="$category"
        DSM_ORG_R_REASON[idx]="$reason"
        DSM_ORG_R_SUPPORTED[idx]="$supported"
        DSM_ORG_R_KEEPCOPY[idx]="$keep"
    done < <(
        {
            for category in "${DSM_ORG_CATEGORIES[@]}"; do printf 'C\t%s\n' "$category"; done
            [ -n "$DSM_ORG_APP_SIGNALS" ] && printf '%s\n' "$DSM_ORG_APP_SIGNALS"
            for category in "${DSM_ORG_CATEGORY_KEYWORDS[@]}"; do printf 'G\t%s\n' "$category"; done
            for ((i = 0; i < ${#DSM_ORG_R_PATH[@]}; i++)); do
                target="${DSM_ORG_R_TARGET[i]##*/}"
                [[ "$DSM_ORG_GENERIC_EXEC_HOSTS" == *" $target "* ]] && target=""
                printf 'R\t%s\t%s\t%s\n' "$i" "${DSM_ORG_R_NAME[i]}" "$target"
            done
        } | LC_ALL=C awk -v shortlen="$DSM_ORG_SHORT_KEYWORD_LENGTH" -v keeptargets="$DSM_ORG_KEEP_BROWSER_TARGETS" -v channels="$DSM_ORG_KEEP_EXCLUDED_CHANNELS" '
            BEGIN {
                FS = "\t"; q = sprintf("%c", 39); ncat = 0; nent = 0; nnon = 0
                hi = sprintf("[%c-%c]", 128, 255); cont = sprintf("[%c-%c]", 128, 191)
                nkt = split(keeptargets, kt, " "); nch = split(channels, ch, " ")
            }
            function hexval(h,    i, v) {
                v = 0; h = tolower(h)
                for (i = 1; i <= length(h); i++) v = v * 16 + index("0123456789abcdef", substr(h, i, 1)) - 1
                return v
            }
            function utf8(cp) {
                if (cp < 128) return sprintf("%c", cp)
                if (cp < 2048) return sprintf("%c%c", 192 + int(cp / 64), 128 + cp % 64)
                return sprintf("%c%c%c", 224 + int(cp / 4096), 128 + int(cp / 64) % 64, 128 + cp % 64)
            }
            function unescape(s,    out) {
                out = ""
                while (match(s, /\\u[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]/)) {
                    out = out substr(s, 1, RSTART - 1) utf8(hexval(substr(s, RSTART + 2, 4)))
                    s = substr(s, RSTART + 6)
                }
                return out s
            }
            function tokenize(text,    n, i, c, p, nx, buf) {
                buf = ""; n = length(text)
                for (i = 1; i <= n; i++) {
                    c = substr(text, i, 1)
                    if (i > 1) {
                        p = substr(text, i - 1, 1); nx = substr(text, i + 1, 1)
                        if ((p ~ /[a-z]/ && c ~ /[A-Z]/) || (p ~ /[A-Z]/ && c ~ /[A-Z]/ && nx ~ /[a-z]/) ||
                            (p ~ /[A-Za-z]/ && c ~ /[0-9]/) || (p ~ /[0-9]/ && c ~ /[A-Za-z]/)) buf = buf " "
                    }
                    buf = buf c
                }
                buf = tolower(buf)
                gsub(/[^a-z0-9]+/, " ", buf)
                return split(buf, tk, " ")
            }
            function add(cat, kw, rank, forname, fortarget,    e, s, n, i, t) {
                kw = unescape(kw)
                gsub(/^[ \t]+|[ \t]+$/, "", kw)
                if (kw == "" || !(cat in order)) return
                if (kw ~ hi) {
                    e = ++nent; non[++nnon] = e
                    s = kw; gsub(/[ \t]/, "", s)
                    t = s; n = gsub(cont, "", t)
                    escore[e] = length(s) - n; eshort[e] = 0; elow[e] = tolower(kw)
                } else {
                    n = tokenize(kw)
                    if (n == 0) return
                    e = ++nent; etokn[e] = n; t = ""
                    for (i = 1; i <= n; i++) { etok[e, i] = tk[i]; t = t tk[i] }
                    escore[e] = length(t); eshort[e] = (escore[e] <= shortlen + 0)
                    bucket[tk[1]] = bucket[tk[1]] " " e
                }
                ecat[e] = cat; ekw[e] = kw; erank[e] = rank; eorder[e] = order[cat]; ename[e] = forname; etarget[e] = fortarget
            }
            function consider(e) {
                seen[ecat[e]] = 1
                if (best == 0 || escore[e] > escore[best] ||
                    (escore[e] == escore[best] && (erank[e] < erank[best] || (erank[e] == erank[best] && eorder[e] < eorder[best])))) best = e
            }
            function find(text, forname,    n, p, m, j, k, e, ok, low, list) {
                best = 0
                if (text == "") return 0
                n = tokenize(text)
                for (p = 1; p <= n; p++) {
                    if (!(tk[p] in bucket)) continue
                    m = split(bucket[tk[p]], list, " ")
                    for (j = 1; j <= m; j++) {
                        e = list[j] + 0
                        if (forname ? !ename[e] : !etarget[e]) continue
                        if (eshort[e] && p != 1) continue
                        if (p + etokn[e] - 1 > n) continue
                        ok = 1
                        for (k = 2; k <= etokn[e]; k++) if (tk[p + k - 1] != etok[e, k]) { ok = 0; break }
                        if (ok) consider(e)
                    }
                }
                low = tolower(text)
                for (j = 1; j <= nnon; j++) {
                    e = non[j]
                    if ((forname ? ename[e] : etarget[e]) && index(low, elow[e])) consider(e)
                }
                return best
            }
            $1 == "C" { if (!($2 in order)) order[$2] = ncat++; next }
            $1 == "K" { add($2, $3, 0, $4 + 0, $5 + 0); next }
            $1 == "G" { m = split($2, parts, "|"); for (i = 2; i <= m; i++) add(parts[1], parts[i], 1, 1, 1); next }
            $1 == "R" {
                split("", seen); cat = ""; reason = ""
                nb = find($3, 1)
                if (nb) { cat = ecat[nb]; reason = "name keyword " q ekw[nb] q }
                if ($4 != "") { tb = find($4, 0); if (!nb && tb) { cat = ecat[tb]; reason = "target keyword " q ekw[tb] q } }
                sup = ","; for (c in seen) sup = sup c ","
                keep = 0
                if ($4 != "") for (j = 1; j <= nkt; j++) if (tolower($4) == kt[j]) keep = 1
                if (keep) { n = tokenize($3); for (i = 1; i <= n; i++) for (j = 1; j <= nch; j++) if (tk[i] == ch[j]) keep = 0 }
                print $2 "|" cat "|" reason "|" sup "|" keep
            }'
    )
    return 0
}

# Planned items: Desktop launchers (move, or copy for the one kept Chrome) and filed
# launchers that nothing supports in their current folder (refile).
_dsm_org_plan() {
    local i=0 origin="" category="" mode="" stem="" keeper=""
    for ((i = 0; i < ${#DSM_ORG_R_PATH[@]}; i++)); do
        origin="${DSM_ORG_R_ORIGIN[i]}"
        category="${DSM_ORG_R_CAT[i]}"
        stem="${DSM_ORG_R_PATH[i]##*/}"
        stem="${stem%.desktop}"
        if [ -n "${DSM_ORG_FIXED_CATEGORIES[$stem]+x}" ]; then
            category="${DSM_ORG_FIXED_CATEGORIES[$stem]}"
            DSM_ORG_R_CAT[i]="$category"
            DSM_ORG_R_REASON[i]="fixed category"
        fi
        if [ -z "$origin" ]; then
            if [ "${DSM_ORG_R_STATE[i]}" != "valid" ]; then DSM_ORG_BROKEN+=("$i"); continue; fi
            if [ -z "$category" ]; then
                category="$DSM_ORG_FALLBACK_CATEGORY"
                DSM_ORG_R_CAT[i]="$category"
                DSM_ORG_R_REASON[i]="no category keyword matched"
            fi
            mode="move"
            if [ -z "$keeper" ] && [ "$category" = "$DSM_ORG_BROWSERS_CATEGORY" ] && [ "${DSM_ORG_R_KEEPCOPY[i]}" = "1" ]; then
                keeper="$i"
                mode="copy"
            fi
        else
            [ "${DSM_ORG_R_STATE[i]}" = "valid" ] || continue
            [ -n "$category" ] && [ "$category" != "$origin" ] || continue
            if [ -z "${DSM_ORG_FIXED_CATEGORIES[$stem]+x}" ] && [[ "${DSM_ORG_R_SUPPORTED[i]}" == *",$origin,"* ]]; then continue; fi
            mode="refile"
        fi
        DSM_ORG_I_REC+=("$i")
        DSM_ORG_I_CAT+=("$category")
        DSM_ORG_I_MODE+=("$mode")
    done
    _dsm_org_resolve_collisions
    return 0
}

# At most one differing launcher per <Category>/<file>: the newest wins (ties: scan
# order), identical launchers follow it, every other one is a conflict and stays.
_dsm_org_resolve_collisions() {
    local n=0 key="" item="" kept="" kept_path="" item_path=""
    local keys=() new_rec=() new_cat=() new_mode=()
    local -A groups=()
    for ((n = 0; n < ${#DSM_ORG_I_REC[@]}; n++)); do
        key="${DSM_ORG_I_CAT[n]}/${DSM_ORG_R_PATH[DSM_ORG_I_REC[n]]##*/}"
        [ -n "${groups[$key]+x}" ] || keys+=("$key")
        groups[$key]="${groups[$key]:-} $n"
    done
    for key in "${keys[@]}"; do
        kept=""
        for item in ${groups[$key]}; do
            if [ -z "$kept" ] || [ "${DSM_ORG_R_PATH[DSM_ORG_I_REC[item]]}" -nt "${DSM_ORG_R_PATH[DSM_ORG_I_REC[kept]]}" ]; then
                kept="$item"
            fi
        done
        kept_path="${DSM_ORG_R_PATH[DSM_ORG_I_REC[kept]]}"
        new_rec+=("${DSM_ORG_I_REC[kept]}"); new_cat+=("${DSM_ORG_I_CAT[kept]}"); new_mode+=("${DSM_ORG_I_MODE[kept]}")
        for item in ${groups[$key]}; do
            [ "$item" = "$kept" ] && continue
            item_path="${DSM_ORG_R_PATH[DSM_ORG_I_REC[item]]}"
            if cmp -s -- "$item_path" "$kept_path"; then
                new_rec+=("${DSM_ORG_I_REC[item]}"); new_cat+=("${DSM_ORG_I_CAT[item]}"); new_mode+=("${DSM_ORG_I_MODE[item]}")
            else
                DSM_ORG_CONFLICT_PATH+=("$item_path")
                DSM_ORG_CONFLICT_REASON+=("$kept_path is filed under this name instead (newer or found first)")
            fi
        done
    done
    DSM_ORG_I_REC=("${new_rec[@]}")
    DSM_ORG_I_CAT=("${new_cat[@]}")
    DSM_ORG_I_MODE=("${new_mode[@]}")
    return 0
}

# place: destination free. unchanged: identical copy already filed (copy mode).
# duplicate: identical launcher already filed, the Desktop one is displaced (move mode).
# replace: a different, older filed launcher is displaced by this newer one.
# conflict: a refile onto an existing name, or a different launcher that is not older.
_dsm_org_decide() {
    local item="$1" dest="$2" src="" identical="false"
    src="${DSM_ORG_R_PATH[DSM_ORG_I_REC[item]]}"
    DSM_ORG_DECISION="place"
    DSM_ORG_DECISION_REASON=""
    if [ ! -e "$dest" ] && [ ! -L "$dest" ]; then return 0; fi
    DSM_ORG_DECISION="conflict"
    if [ ! -f "$dest" ] || [ -L "$dest" ]; then
        DSM_ORG_DECISION_REASON="the destination is not a regular file: $dest"
        return 0
    fi
    cmp -s -- "$src" "$dest" && identical="true"
    if [ "${DSM_ORG_I_MODE[item]}" = "refile" ]; then
        DSM_ORG_DECISION_REASON="same name already in ${DSM_ORG_I_CAT[item]}, identical=$identical"
    elif [ "$identical" = "true" ] && [ "${DSM_ORG_I_MODE[item]}" = "copy" ]; then
        DSM_ORG_DECISION="unchanged"
    elif [ "$identical" = "true" ]; then
        DSM_ORG_DECISION="duplicate"
    elif [ "$src" -nt "$dest" ]; then
        DSM_ORG_DECISION="replace"
    else
        DSM_ORG_DECISION_REASON="a different, not older ${dest##*/} is already in ${DSM_ORG_I_CAT[item]}"
    fi
    return 0
}

# Move an existing file into state/displaced/<runId> (never deletes) -> DSM_ORG_DISPLACED.
_dsm_org_displace() {
    local state="$1" path="$2" category="$3" reason="$4" dir="" target=""
    dir="$state/displaced/$DSM_ORG_RUN_ID"
    printf -v target '%s/%03d_%s' "$dir" "${#DSM_ORG_M_ACTION[@]}" "${path##*/}"
    _dsm_org_mkdir "$dir" || return 1
    mv -T -- "$path" "$target" 2>/dev/null || return 1
    _dsm_org_record "displace" "$path" "$target" "$category" "$reason"
    DSM_ORG_DISPLACED="$target"
    return 0
}

# Preview and organize share this walk; preview only prints what organize would change.
_dsm_org_apply() {
    local user="$1" desktop="$2" base="$3" state="$4" preview="$5"
    local category="" category_dir="" link="" n=0 item="" src="" dest="" mode="" label="" reason=""
    local items=()
    local -A placed=()
    for category in "${DSM_ORG_CATEGORIES[@]}"; do
        items=()
        for ((n = 0; n < ${#DSM_ORG_I_REC[@]}; n++)); do
            [ "${DSM_ORG_I_CAT[n]}" = "$category" ] && items+=("$n")
        done
        [ "${#items[@]}" -gt 0 ] || continue
        category_dir="$base/$category"
        if [ ! -d "$category_dir" ]; then
            DSM_ORG_CHANGES=$((DSM_ORG_CHANGES + 1))
            if [ "$preview" -eq 1 ]; then
                echo "[dsm] [preview] mkdir: $category_dir"
            elif _dsm_org_mkdir "$category_dir"; then
                _dsm_org_record "mkdir" "" "$category_dir" "$category" "category folder"
            else
                DSM_ORG_FAILED+=("mkdir $category_dir")
                continue
            fi
        fi
        link="$desktop/$category"
        if [ ! -e "$link" ] && [ ! -L "$link" ]; then
            DSM_ORG_CHANGES=$((DSM_ORG_CHANGES + 1))
            if [ "$preview" -eq 1 ]; then
                echo "[dsm] [preview] link: $link -> $category_dir"
            elif ln -s -- "$category_dir" "$link" 2>/dev/null; then
                _dsm_org_record "link" "$category_dir" "$link" "$category" "symbolic link"
            else
                DSM_ORG_FAILED+=("link $link -> $category_dir")
            fi
        fi
        for item in "${items[@]}"; do
            src="${DSM_ORG_R_PATH[DSM_ORG_I_REC[item]]}"
            mode="${DSM_ORG_I_MODE[item]}"
            reason="${DSM_ORG_R_REASON[DSM_ORG_I_REC[item]]}"
            dest="$category_dir/${src##*/}"
            if [ "$preview" -eq 1 ] && [ -n "${placed[$dest]+x}" ]; then
                case "$mode" in
                    copy) DSM_ORG_DECISION="unchanged" ;;
                    refile) DSM_ORG_DECISION="conflict"; DSM_ORG_DECISION_REASON="same name already in $category, identical=true" ;;
                    *) DSM_ORG_DECISION="duplicate" ;;
                esac
            else
                _dsm_org_decide "$item" "$dest"
            fi
            case "$DSM_ORG_DECISION" in
                unchanged) continue ;;
                conflict)
                    DSM_ORG_CONFLICT_PATH+=("$src")
                    DSM_ORG_CONFLICT_REASON+=("$DSM_ORG_DECISION_REASON")
                    continue
                    ;;
            esac
            DSM_ORG_CHANGES=$((DSM_ORG_CHANGES + 1))
            label="$mode"
            [ "$DSM_ORG_DECISION" = "place" ] || label="$mode ($DSM_ORG_DECISION)"
            if [ "$preview" -eq 1 ]; then
                placed[$dest]=1
                echo "[dsm] [preview] $label: $src -> $category ($reason)"
                continue
            fi
            if [ "$DSM_ORG_DECISION" = "duplicate" ]; then
                if _dsm_org_displace "$state" "$src" "$category" "identical launcher already filed"; then
                    DSM_ORG_DONE+=("duplicate: $src -> $DSM_ORG_DISPLACED ($reason)")
                else
                    DSM_ORG_FAILED+=("$src -> $state/displaced/$DSM_ORG_RUN_ID")
                fi
                continue
            fi
            if [ "$DSM_ORG_DECISION" = "replace" ] && ! _dsm_org_displace "$state" "$dest" "$category" "replaced by a newer launcher"; then
                DSM_ORG_FAILED+=("$dest -> $state/displaced/$DSM_ORG_RUN_ID")
                continue
            fi
            if [ "$mode" = "copy" ]; then
                if cp -p -T -- "$src" "$dest" 2>/dev/null; then
                    _dsm_org_record "copy" "$src" "$dest" "$category" "$reason"
                else
                    DSM_ORG_FAILED+=("$src -> $dest")
                    continue
                fi
            elif mv -T -- "$src" "$dest" 2>/dev/null; then
                _dsm_org_record "move" "$src" "$dest" "$category" "$reason"
            else
                DSM_ORG_FAILED+=("$src -> $dest")
                continue
            fi
            _dsm_trust_launcher "$user" "$dest"
            DSM_ORG_DONE+=("$label: $src -> $dest ($reason)")
        done
    done
    return 0
}

# "name (2).ext" style free name inside <dir> (also free of names claimed earlier in the run) -> DSM_ORG_UNIQUE.
_dsm_org_unique_dest() {
    local dir="$1" name="$2" item="$3" stem="$2" ext="" n=2 candidate=""
    if [ -f "$item" ] && [[ "$name" == ?*.* ]]; then
        stem="${name%.*}"
        ext=".${name##*.}"
    fi
    candidate="$dir/$name"
    while [ -e "$candidate" ] || [ -L "$candidate" ] || [ -n "${DSM_ORG_CLAIMED[$candidate]+x}" ]; do
        candidate="$dir/$stem ($n)$ext"
        n=$((n + 1))
    done
    DSM_ORG_UNIQUE="$candidate"
    return 0
}

# Move the loose Desktop files and folders into the Documents folder (preview only prints).
_dsm_org_apply_loose() {
    local docs="$1" preview="$2" item="" dest="" kind=""
    [ "${#DSM_ORG_LOOSE[@]}" -gt 0 ] || return 0
    if [ ! -d "$docs" ]; then
        DSM_ORG_CHANGES=$((DSM_ORG_CHANGES + 1))
        if [ "$preview" -eq 1 ]; then
            echo "[dsm] [preview] mkdir: $docs"
        elif _dsm_org_mkdir "$docs"; then
            _dsm_org_record "mkdir" "" "$docs" "$DSM_ORG_DOCUMENTS_CATEGORY" "documents folder"
        else
            DSM_ORG_FAILED+=("mkdir $docs")
            return 0
        fi
    fi
    for item in "${DSM_ORG_LOOSE[@]}"; do
        kind="loose file"
        [ -d "$item" ] && kind="loose folder"
        _dsm_org_unique_dest "$docs" "${item##*/}" "$item"
        dest="$DSM_ORG_UNIQUE"
        DSM_ORG_CLAIMED[$dest]=1
        DSM_ORG_CHANGES=$((DSM_ORG_CHANGES + 1))
        if [ "$preview" -eq 1 ]; then
            echo "[dsm] [preview] move: $item -> $dest ($kind)"
        elif mv -T -- "$item" "$dest" 2>/dev/null; then
            _dsm_org_record "move" "$item" "$dest" "$DSM_ORG_DOCUMENTS_CATEGORY" "$kind"
            DSM_ORG_DONE+=("move: $item -> $dest ($kind)")
        else
            DSM_ORG_FAILED+=("$item -> $dest")
        fi
    done
    return 0
}

# Write organize_<runId>.json (same fields as the Windows manifest) -> DSM_ORG_MANIFESTS.
_dsm_org_write_manifest() {
    local user="$1" base="$2" state="$3" dir="" path="" now="" i=0 last=0 sep="," entry=""
    local fields=()
    dir="$state/manifests"
    path="$dir/organize_${DSM_ORG_RUN_ID}.json"
    _dsm_org_mkdir "$dir" || return 1
    _dsm_org_now now
    last=$((${#DSM_ORG_M_ACTION[@]} - 1))
    {
        printf '{\n'
        _dsm_org_json "$DSM_ORG_RUN_ID"; printf '  "RunId": %s,\n' "$DSM_ORG_JSON"
        _dsm_org_json "$now"; printf '  "CreatedAt": %s,\n' "$DSM_ORG_JSON"
        _dsm_org_json "${HOSTNAME:-}"; printf '  "Computer": %s,\n' "$DSM_ORG_JSON"
        _dsm_org_json "$user"; printf '  "User": %s,\n' "$DSM_ORG_JSON"
        _dsm_org_json "$base"; printf '  "BaseDirectory": %s,\n' "$DSM_ORG_JSON"
        printf '  %s\n' "$DSM_ORG_UNDONE_AT_EMPTY"
        printf '  "Entries": [\n'
        for ((i = 0; i <= last; i++)); do
            fields=()
            for entry in "${DSM_ORG_M_ACTION[i]}" "${DSM_ORG_M_SOURCE[i]}" "${DSM_ORG_M_DEST[i]}" \
                         "${DSM_ORG_M_CAT[i]}" "${DSM_ORG_M_REASON[i]}" "${DSM_ORG_M_TIME[i]}"; do
                _dsm_org_json "$entry"
                fields+=("$DSM_ORG_JSON")
            done
            sep=","
            [ "$i" -eq "$last" ] && sep=""
            printf '    {"Action": %s, "Source": %s, "Destination": %s, "Category": %s, "Reason": %s, "Time": %s}%s\n' \
                "${fields[@]}" "$sep"
        done
        printf '  ]\n}\n'
    } > "$path" 2>/dev/null || return 1
    DSM_ORG_MANIFESTS+=("$path")
    return 0
}

_dsm_org_report() {
    local user="$1" desktop="$2" base="$3" state="$4" preview="$5" i=0 line="" category="" names="" file="" count=0
    if [ "$preview" -eq 0 ]; then
        for line in "${DSM_ORG_DONE[@]}"; do echo "[dsm] $line"; done
    fi
    for ((i = 0; i < ${#DSM_ORG_CONFLICT_PATH[@]}; i++)); do
        echo "[dsm] kept (${DSM_ORG_CONFLICT_REASON[i]}): ${DSM_ORG_CONFLICT_PATH[i]}"
    done
    for line in "${DSM_ORG_FAILED[@]}"; do echo "[dsm] failed: $line"; done
    if [ "$preview" -eq 0 ] && [ "${#DSM_ORG_M_ACTION[@]}" -gt 0 ]; then
        if _dsm_org_write_manifest "$user" "$base" "$state"; then
            echo "${DSM_ORG_MANIFEST_LABEL}${DSM_ORG_MANIFESTS[${#DSM_ORG_MANIFESTS[@]}-1]}"
        else
            echo "[dsm] failed: could not write the undo manifest under $state/manifests"
        fi
    elif [ "$DSM_ORG_CHANGES" -eq 0 ]; then
        echo "[dsm] Nothing to move; the desktop is already organized."
    fi
    for i in "${DSM_ORG_BROKEN[@]}"; do
        echo "[dsm] left in place (Exec target missing): ${DSM_ORG_R_PATH[i]} -> ${DSM_ORG_R_TARGET[i]:-<no Exec>}"
    done
    [ "$preview" -eq 0 ] || return 0
    echo "[dsm] Category folders under $base:"
    for category in "${DSM_ORG_CATEGORIES[@]}"; do
        [ -d "$base/$category" ] || continue
        names=""
        count=0
        for file in "$base/$category"/*.desktop; do
            [ -e "$file" ] || continue
            file="${file##*/}"
            names="${names:+$names, }${file%.desktop}"
            count=$((count + 1))
        done
        echo "[dsm]   $category ($count): $names"
    done
    return 0
}

_dsm_org_user() {
    local user="$1" home="$2" preview="$3" desktop="" base="" state="" docs=""
    desktop="$(_dsm_desktop_dir "$user" "$home")"
    [ -d "$desktop" ] || return 0
    base="$(_dsm_org_base_dir "$user" "$home")"
    state="$(_dsm_org_state_dir "$user" "$home")"
    docs="$(_dsm_xdg_user_dir "$home" "$DSM_ORG_DOCUMENTS_DIR_KEY" Documents)"
    [ "$docs" != "$home" ] || docs="$home/Documents"
    _dsm_org_reset_user
    echo "[dsm] Desktop: $desktop (user $user)"
    echo "[dsm] Category folders: $base"
    _dsm_org_scan "$home" "$desktop" "$base"
    _dsm_org_scan_loose "$desktop" "$base" "$docs"
    _dsm_org_classify
    _dsm_org_plan
    _dsm_org_apply "$user" "$desktop" "$base" "$state" "$preview"
    _dsm_org_apply_loose "$docs" "$preview"
    _dsm_org_report "$user" "$desktop" "$base" "$state" "$preview"
    return 0
}

# Replay one manifest backwards. Nothing is overwritten; UndoneAt is set only when no entry failed.
_dsm_org_undo_manifest() {
    local manifest="$1" line="" run_id="" undone_at="" store="" status="" restored_to="" target="" now="" content="" closed=""
    local i=0 restored=0 skipped=0 action="" src="" dest=""
    local actions=() sources=() dests=() errors=()
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ "$line" =~ $DSM_ORG_ENTRY_RE ]]; then
            _dsm_org_unjson "${BASH_REMATCH[1]}"; actions+=("$DSM_ORG_UNJSON")
            _dsm_org_unjson "${BASH_REMATCH[3]}"; sources+=("$DSM_ORG_UNJSON")
            _dsm_org_unjson "${BASH_REMATCH[5]}"; dests+=("$DSM_ORG_UNJSON")
        elif [[ "$line" =~ $DSM_ORG_RUN_ID_RE ]]; then
            run_id="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ $DSM_ORG_UNDONE_AT_RE ]]; then
            undone_at="${BASH_REMATCH[1]}"
        fi
    done < "$manifest"
    if [ -n "$undone_at" ]; then
        echo "[dsm] Already undone at $undone_at: $manifest"
        return 0
    fi
    store="${manifest%/*}"
    store="${store%/*}/undone/$run_id"
    echo "[dsm] Undoing ${#actions[@]} change(s) from $manifest"
    for ((i = ${#actions[@]} - 1; i >= 0; i--)); do
        action="${actions[i]}"
        src="${sources[i]}"
        dest="${dests[i]}"
        status="skipped"
        restored_to="$src"
        case "$action" in
            move|displace)
                if { [ -f "$dest" ] || [ -d "$dest" ]; } && [ ! -e "$src" ] && [ ! -L "$src" ]; then
                    status="failed"
                    _dsm_org_mkdir "${src%/*}" && mv -T -- "$dest" "$src" 2>/dev/null && status="restored"
                fi
                ;;
            copy|link)
                if [ "$action" = "link" ] && { [ ! -L "$dest" ] || { [ -d "$src" ] && ! _dsm_org_dir_empty "$src"; }; }; then
                    :
                elif [ -f "$dest" ] || [ -L "$dest" ]; then
                    status="failed"
                    printf -v target '%s/%03d_%s' "$store" "$i" "${dest##*/}"
                    _dsm_org_mkdir "$store" && mv -T -- "$dest" "$target" 2>/dev/null && status="restored"
                    restored_to="$target"
                fi
                ;;
            mkdir)
                if [ -d "$dest" ] && [ ! -L "$dest" ] && _dsm_org_dir_empty "$dest"; then
                    status="failed"
                    rmdir -- "$dest" 2>/dev/null && status="restored"
                    restored_to="removed (empty folder created by the run)"
                fi
                ;;
        esac
        case "$status" in
            restored)
                restored=$((restored + 1))
                echo "[dsm] undo $action: $dest -> $restored_to"
                ;;
            failed)
                errors+=("$action $dest -> $restored_to")
                ;;
            *)
                skipped=$((skipped + 1))
                echo "[dsm] undo $action skipped: $dest"
                ;;
        esac
    done
    echo "[dsm] Undo finished: $restored restored, $skipped skipped, ${#errors[@]} error(s)"
    if [ "${#errors[@]}" -eq 0 ]; then
        _dsm_org_now now
        content="$(<"$manifest")"
        closed="\"UndoneAt\": \"$now\","
        printf '%s\n' "${content/"$DSM_ORG_UNDONE_AT_EMPTY"/"$closed"}" > "$manifest"
        DSM_ORG_MANIFESTS+=("$manifest")
        echo "${DSM_ORG_UNDONE_LABEL}$manifest"
    else
        for line in "${errors[@]}"; do echo "[dsm] undo failed: $line"; done
        echo "[dsm] The run stays open for undo; run undo again to retry the failed entries: $manifest"
    fi
    return 0
}

# Undo the newest run not undone yet (per user), or the given manifest. A root run replays a
# manifest another user owns as that user.
_dsm_org_undo() {
    local manifest="$1" user="" home="" state="" candidate="" newest="" index=0 owner="" account=""
    local candidates=()
    if [ -n "$manifest" ]; then
        if [ ! -f "$manifest" ]; then
            echo "[dsm] Manifest not found: $manifest"
            return 0
        fi
        owner="$(stat -c %u -- "$manifest" 2>/dev/null)"
        if [ "$EUID" -eq 0 ] && [ "$owner" != "0" ]; then
            account="$(getent passwd "$owner" 2>/dev/null)"
            if [ -z "$account" ]; then
                echo "[dsm] Skipped $manifest: its owner (uid ${owner:-unknown}) has no account"
                return 0
            fi
            IFS=: read -r user _ _ _ _ home _ <<< "$account"
            _dsm_org_run_as_user "$user" "$home" undo "$manifest"
            return 0
        fi
        _dsm_org_undo_manifest "$manifest"
        return 0
    fi
    while IFS="$DSM_TAB" read -r user home; do
        [ -n "$user" ] && [ -n "$home" ] || continue
        state="$(_dsm_org_state_dir "$user" "$home")"
        if [ "$EUID" -eq 0 ] && [ "$user" != "root" ]; then
            if [ -d "$state/manifests" ]; then
                _dsm_org_run_as_user "$user" "$home" undo
            fi
            continue
        fi
        candidates=("$state/manifests"/organize_*.json)
        newest=""
        for ((index = ${#candidates[@]} - 1; index >= 0; index--)); do
            candidate="${candidates[index]}"
            [ -f "$candidate" ] || continue
            if grep -qF -- "$DSM_ORG_UNDONE_AT_EMPTY" "$candidate" 2>/dev/null; then
                newest="$candidate"
                break
            fi
        done
        if [ -n "$newest" ]; then
            _dsm_org_undo_manifest "$newest"
        else
            echo "[dsm] No organizer run to undo in $state/manifests"
        fi
    done < <(_dsm_org_targets)
    return 0
}

# Organize, preview or undo every target Desktop (see the file header). Sets DSM_ORG_MANIFESTS
# to the manifests written (organize) or closed (undo).
organize_desktop_icons_from_desktop_shortcut_manager() {
    local action="${1:-}" manifest="${2:-}" user="" home="" preview=0
    DSM_ORG_MANIFESTS=()
    case "$action" in
        organize|preview)
            if [ "$DSM_ORG_ENABLED" != "true" ]; then
                echo "[dsm] Desktop organizer disabled (DSM_ORG_ENABLED=$DSM_ORG_ENABLED)"
                return 0
            fi
            [ "$action" = "preview" ] && preview=1
            _dsm_org_init
            _dsm_org_new_run_id
            while IFS="$DSM_TAB" read -r user home; do
                [ -n "$user" ] && [ -n "$home" ] || continue
                if [ "$EUID" -ne 0 ] || [ "$user" = "root" ]; then
                    _dsm_org_user "$user" "$home" "$preview"
                elif [ -d "$(_dsm_desktop_dir "$user" "$home")" ]; then
                    _dsm_org_run_as_user "$user" "$home" "$action"
                fi
            done < <(_dsm_org_targets)
            ;;
        undo)
            _dsm_org_undo "$manifest"
            ;;
        *)
            echo "[dsm] Unknown desktop icon action '$action' (use organize, preview or undo)" >&2
            ;;
    esac
    return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    organize_desktop_icons_from_desktop_shortcut_manager "$@"
fi
