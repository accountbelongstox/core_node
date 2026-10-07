<#
.SYNOPSIS
    Desktop Icon Manager - Intelligent shortcut cleanup and organization system

.DESCRIPTION
    This module provides intelligent desktop shortcut management capabilities extracted from Step102.
    It handles automatic cleanup of obsolete shortcuts, smart shortcut detection, and organized
    desktop icon management for installed applications.

.NOTES
    Author: AI Assistant
    Version: 1.0
    Extracted from: Step102_InstallCustomScriptsAndCommands.ps1
    Purpose: Real-time desktop icon management during application installation

    Direct run (dd.ps1 Management & Backup menu):
    powershell -File DesktopIconManager.ps1 -DesktopIconAction Organize|Preview|Tidy|Undo [-DesktopIconUndoManifest <path>]
#>
param(
    [Parameter(Mandatory = $false)]
    [string]$DesktopIconAction = '',

    [Parameter(Mandatory = $false)]
    [string]$DesktopIconUndoManifest = ''
)

# Local debug configuration for DesktopIconManager
$script:DesktopIconManagerDebugMode = $false  # Set to $true to enable debug output for desktop icon operations

# Import required modules
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:DESKTOP_ICON_MANAGER_DIR = $SCRIPT_DIR
$COMMON_FUNC_PATH = Join-Path $SCRIPT_DIR "CommonFunc.ps1"
$APPLICATIONS_LIST_PATH = Join-Path $SCRIPT_DIR "ApplicationsList.ps1"
# CommonFunc may already be loaded (it also loads this library on demand for the per-install tidy)
if (-not (Get-Command Create-DesktopShortcutsForPackage -ErrorAction SilentlyContinue)) {
    . $COMMON_FUNC_PATH
}
if ($null -eq (Get-Variable -Name 'APPLICATIONS_PACKAGES' -Scope Global -ErrorAction SilentlyContinue)) {
    . $APPLICATIONS_LIST_PATH
}

# Debug output function for DesktopIconManager
function Write-DesktopIconManagerDebug {
    param(
        [string]$Message,
        [ConsoleColor]$ForegroundColor = [ConsoleColor]::Gray
    )
    if ($script:DesktopIconManagerDebugMode) {
        Write-Host "[DesktopIconManager] $Message" -ForegroundColor $ForegroundColor
    }
}

# Global variables for desktop management
$Global:DESKTOP_CLEANUP_ENABLED = $true
$Global:AGGRESSIVE_CLEANUP_ENABLED = $false

# Desktop organizer: what it moves, what it never moves, and where its undo state lives
$Global:DESKTOP_SHORTCUT_EXTENSIONS = @('.lnk', '.url', '.appref-ms')
$Global:DESKTOP_ORGANIZER_STATE_DIR = Join-Path (Join-Path $env:LOCALAPPDATA 'core_node') 'desktop_icons'
$Global:DESKTOP_ORGANIZER_MANIFEST_DIR = Join-Path $Global:DESKTOP_ORGANIZER_STATE_DIR 'manifests'
$Global:DESKTOP_ORGANIZER_DISPLACED_DIR = Join-Path $Global:DESKTOP_ORGANIZER_STATE_DIR 'displaced'
# Per-install tidy (Invoke-DesktopIconTidy): session fingerprint of the last tidied desktops,
# and the machine-wide lock that keeps concurrent installer processes from organizing at once
if (-not (Test-Path Variable:Global:DESKTOP_TIDY_FINGERPRINT)) {
    $Global:DESKTOP_TIDY_FINGERPRINT = ''
}
$Global:DESKTOP_TIDY_MUTEX_NAME = 'Global\core_node_desktop_icon_tidy'
$Global:DESKTOP_TIDY_MUTEX_WAIT_SECONDS = 30
# Shortcut names that always stay on the desktop (Window Launcher is written onto the desktop by its writers:
# pycore/pyutils/launcher/shortcut_check.ps1 and desktop_integration.py)
$Global:DESKTOP_ORGANIZATION_KEEP_ON_DESKTOP = @('Window Launcher')
# The desktop keeps exactly one browser shortcut: the first stable Chrome found (user desktop first).
# It is copied into Browsers and stays; every other browser shortcut is moved.
$Global:DESKTOP_ORGANIZATION_KEEP_BROWSER_EXE = 'chrome.exe'
$Global:DESKTOP_ORGANIZATION_KEEP_BROWSER_EXCLUDED_TOKENS = @('beta', 'dev', 'canary', 'unstable', 'sxs')
# Real files left on the desktops are moved into the Documents known folder (folders stay: they can be app data)
$Global:DESKTOP_ORGANIZATION_DOCUMENTS_DIR = [Environment]::GetFolderPath('MyDocuments')
$Global:DESKTOP_ORGANIZATION_LOOSE_ITEM_EXCLUDED = @('desktop.ini', 'thumbs.db')
# Launcher hosts whose file name says nothing about the application behind the shortcut
$Global:DESKTOP_ORGANIZATION_GENERIC_TARGET_HOSTS = @(
    'python', 'pythonw', 'py', 'pyw', 'powershell', 'pwsh', 'cmd', 'wscript', 'cscript', 'rundll32',
    'explorer', 'java', 'javaw', 'node', 'conhost', 'wt', 'mshta', 'msiexec', 'update', 'chrome_proxy', 'msedge_proxy'
)
$Global:DESKTOP_ORGANIZATION_URL_SCHEME_CATEGORIES = @{
    'steam'                  = $Global:DESKTOP_CATEGORY_GAMES
    'com.epicgames.launcher' = $Global:DESKTOP_CATEGORY_GAMES
    'uplay'                  = $Global:DESKTOP_CATEGORY_GAMES
    'origin'                 = $Global:DESKTOP_CATEGORY_GAMES
    'origin2'                = $Global:DESKTOP_CATEGORY_GAMES
    'battlenet'              = $Global:DESKTOP_CATEGORY_GAMES
}
# Last-resort rule: target folder fragments (game libraries, vendor suites) when no name/target keyword matches
$Global:DESKTOP_ORGANIZATION_TARGET_PATH_CATEGORIES = @(
    @{ Fragment = '\steamapps\common\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\Epic Games\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\WeGameApps\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\Riot Games\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\GOG Galaxy\Games\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\EA Games\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\Ubisoft Game Launcher\games\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\XboxGames\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\HoYoPlay\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\miHoYo\'; Category = $Global:DESKTOP_CATEGORY_GAMES },
    @{ Fragment = '\JetBrains\'; Category = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS },
    @{ Fragment = '\Microsoft Visual Studio\'; Category = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS },
    @{ Fragment = '\Android\Sdk\'; Category = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS },
    @{ Fragment = '\Microsoft Office\'; Category = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS },
    @{ Fragment = '\Kingsoft\WPS Office\'; Category = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS },
    @{ Fragment = '\Adobe\'; Category = $Global:DESKTOP_CATEGORY_MEDIA_TOOLS },
    @{ Fragment = '\Sysinternals\'; Category = $Global:DESKTOP_CATEGORY_SYSTEM_TOOLS },
    @{ Fragment = '\NirSoft\'; Category = $Global:DESKTOP_CATEGORY_SYSTEM_TOOLS }
)
# ApplicationsList.ps1 groups whose DesktopCategory rank above the keyword lists below
$Global:DESKTOP_ORGANIZATION_PACKAGE_GROUPS = @('BasePackages', 'APPLICATIONS_PACKAGES', 'DEV_SOFTWARE_PACKAGES', 'COMMON_SOFTWARE_PACKAGES')
# Category folders whose content is generated elsewhere and never refiled
$Global:DESKTOP_ORGANIZATION_REFILE_EXCLUDED = @($Global:DESKTOP_CATEGORY_DEV_SCRIPTS)
$script:DesktopTokenBoundaryPattern = '(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])'
$script:DesktopShortKeywordLength = 3
$script:DesktopKeywordTableCache = $null


# Each category contains DesktopCategory name and AdditionalKeywords for scanning existing shortcuts
$Global:DESKTOP_ORGANIZATION_CATEGORIES = @(
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_ACCELERATORS
        AdditionalKeywords = @(
            "QuickFox", "MalusNet", "\u5FEB\u5E06", "\u7A7F\u68AD", "VPN", "Accelerator", "Proxy", "Teleport",
            "\u84DD\u706F", "\u8FC5\u96F7\u52A0\u901F\u5668", "\u7F51\u6613UU", "\u8FC5\u6E38\u52A0\u901F\u5668",
            "\u817E\u8BAF\u7F51\u6E38\u52A0\u901F\u5668", "\u5947\u6E38\u52A0\u901F\u5668", "\u7F51\u6613UU\u52A0\u901F\u5668",
            "UU\u52A0\u901F\u5668", "\u7F51\u6613UU\u6E38\u620F\u52A0\u901F\u5668", "UU\u6E38\u620F\u52A0\u901F\u5668", "NetEase UU",
            "ExpressVPN", "NordVPN", "Surfshark", "CyberGhost", "ProtonVPN", "Windscribe", "TunnelBear",
            "Hotspot Shield", "IPVanish", "Private Internet Access", "PIA", "StrongVPN", "VyprVPN",
            "\u5C0F\u706B\u7BAD", "\u84DD\u706F\u4E13\u4E1A\u7248", "\u5947\u6E38\u624B\u6E38\u52A0\u901F\u5668",
            "\u817E\u8BAF\u624B\u6E38\u52A0\u901F\u5668", "\u7F51\u6613\u624B\u6E38\u52A0\u901F\u5668",
            "\u9C9C\u725B", "XianNiu", "\u52A0\u901F\u5668", "Watt Toolkit",
            "Clash for Windows", "Clash Verge", "Clash Nyanpasu", "Clash Meta", "Mihomo", "FlClash",
            "v2rayN", "V2Ray", "Qv2ray", "Nekoray", "Hiddify", "sing-box", "Shadowsocks", "ShadowsocksR",
            "Cloudflare WARP", "Lantern", "Psiphon", "Mullvad", "Astrill", "Outline Client", "ClashX", "Clash",
            "Karing", "GUI.for.Clash", "GUI.for.SingBox", "Throne", "Trojan", "Xray", "Hysteria", "LeiGod",
            "GearUP", "ExitLag", "Mudfish", "\u96F7\u795E", "\u5947\u6E38", "biubiu", "\u8FC5\u6E38"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_API_TOOLS
        AdditionalKeywords = @(
            "Postman", "Insomnia", "HTTPie", "Swagger", "SoapUI", "Hoppscotch", "Bruno", "Apifox",
            "Apipost", "Paw", "RapidAPI", "JMeter",
            "Yaak", "Requestly", "Reqable", "Proxyman", "Whistle", "Eolink", "YApi", "Hurl",
            "Kreya", "BloomRPC", "Postwoman"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        AdditionalKeywords = @(
            "Visual Studio", "IntelliJ", "Eclipse", "Android Studio", "Xcode", "Git", "Docker",
            "PyCharm", "WebStorm", "PhpStorm", "CLion", "GoLand", "RubyMine",
            "Rider", "AppCode", "Fleet", "Code", "VSCode", "Windsurf", "Devin", "Cursor", "VSCodium", "Sublime Text", "Atom", "Brackets",
            "NetBeans", "BlueJ", "Dev-C++", "Code::Blocks", "Qt Creator", "Delphi", "Lazarus",
            "Unity", "Unreal Engine", "Godot", "GameMaker", "Construct", "RPG Maker",
            "GitHub Desktop", "GitKraken", "SourceTree", "TortoiseGit", "SmartGit", "Fork",
            "Docker Desktop", "Kubernetes", "Vagrant", "VirtualBox", "VMware", "Hyper-V",
            "Node.js", "npm", "yarn", "pnpm", "Python", "Java", "Go", "Rust", "Ruby", "PHP",
            "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177", "\u652F\u4ED8\u5B9D\u5F00\u653E\u5E73\u53F0",
            "\u817E\u8BAF\u4E91", "\u963F\u91CC\u4E91", "\u767E\u5EA6\u4E91", "\u534E\u4E3A\u4E91",
            "Visual Studio Code", "Zed", "Warp", "HBuilderX", "HBuilder", "DevEco Studio", "CodeArts", "Anaconda", "Anaconda Navigator",
            "Jupyter", "Spyder", "Arduino", "Keil", "STM32CubeIDE", "STM32CubeMX", "PlatformIO", "Git Bash",
            "Git GUI", "Git CMD", "Cmder", "ConEmu", "Alacritty", "WezTerm", "Beyond Compare", "WinMerge",
            "Meld", "Genymotion", "Android SDK", "Flutter", "Dart", "Laragon", "XAMPP", "WampServer",
            "phpStudy", "Podman Desktop", "Rancher Desktop", "OrbStack", "Gitee", "HxD", "x64dbg", "IDA",
            "Ghidra", "dnSpy", "ILSpy", "Cheat Engine", "Dependency Walker", "Process Hacker", "System Informer", "\u5C0F\u76AE\u9762\u677F",
            "\u5B9D\u5854"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_TEXT_EDITORS
        AdditionalKeywords = @(
            "Notepad", "Sublime", "Atom", "Vim", "gVim", "Emacs", "TextEdit", "Notepad++", "UltraEdit", "WordPad",
            "EditPlus", "EmEditor", "Scrivener", "WriteMonkey", "FocusWriter", "Q10", "yWriter",
            "Typora", "Mark Text", "Zettlr", "Obsidian", "Notion", "Roam Research", "RemNote",
            "Joplin", "Standard Notes", "Bear", "Ulysses", "iA Writer", "Drafts", "Day One",
            "\u8BB0\u4E8B\u672C", "\u6709\u9053\u4E91\u7B14\u8BB0", "\u5370\u8C61\u7B14\u8BB0",
            "\u4E3A\u77E5\u7B14\u8BB0", "\u8BED\u96C0", "\u77F3\u58A8\u6587\u6863", "\u817E\u8BAF\u6587\u6863",
            "\u91D1\u5C71\u6587\u6863",
            "Logseq", "SiYuan", "AppFlowy", "Anytype", "Heynote", "Kate", "Geany", "Notepad3",
            "Notepad4", "Notepads", "Notepad--", "flomo", "Trilium", "Capacities", "Typst", "MarkText",
            "Ghostwriter", "Lightpad", "\u601D\u6E90\u7B14\u8BB0", "\u5E55\u5E03", "Wolai", "\u6211\u6765", "FlowUs", "\u606F\u6D41",
            "\u98DE\u4E66\u6587\u6863"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DESIGN_TOOLS
        AdditionalKeywords = @(
            "Figma", "Sketch", "Canva", "Affinity", "Affinity Designer", "Inkscape", "Draw.io", "DrawIO",
            "diagrams.net", "Lucidchart", "Creately", "Excalidraw", "XMind", "Axure", "Balsamiq", "Penpot",
            "Pixso", "MasterGo", "Lunacy", "ProcessOn", "\u5373\u65F6\u8BBE\u8BA1", "\u58A8\u5200",
            "Affinity Photo", "Affinity Publisher", "FigJam", "Framer", "Spline", "Eagle", "PureRef", "Gravit",
            "Vectornator", "Linearity", "Mockplus", "Justinmind", "Miro", "Whimsical", "Mermaid", "PlantUML",
            "yEd", "Visual Paradigm", "StarUML", "ColorPicker", "Pixcall", "\u7A3F\u5B9A\u8BBE\u8BA1", "\u521B\u5BA2\u8D34", "\u6479\u5BA2",
            "Motiff", "\u4EBF\u56FE", "EdrawMax", "EdrawMind", "MindManager", "iThoughts", "SimpleMind"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_MEDIA_TOOLS
        AdditionalKeywords = @(
            "Photoshop", "GIMP", "VLC", "Media Player", "Audacity", "OBS", "Adobe", "Premiere",
            "After Effects", "Illustrator", "InDesign", "Lightroom", "Animate", "Audition",
            "Adobe Creative Cloud", "Adobe CC", "Adobe Bridge", "Adobe Camera Raw", "Adobe Dimension",
            "Adobe Dreamweaver", "Adobe Fresco", "Adobe XD", "Adobe Spark", "Adobe Stock", "Adobe Fonts",
            "Adobe Character Animator", "Adobe Media Encoder", "Adobe Prelude", "Adobe Rush", "Adobe Captivate",
            "Adobe FrameMaker", "Adobe InCopy", "Adobe Substance 3D", "Adobe Aero", "Adobe Comp CC",
            "CorelDRAW", "PaintShop", "Paint.NET",
            "Krita", "Blender", "Cinema 4D", "Maya", "3ds Max", "ZBrush", "Substance",
            "DaVinci Resolve", "Final Cut Pro", "Avid", "Vegas Pro", "Camtasia", "ScreenFlow",
            "Bandicam", "Fraps", "Action!", "XSplit", "Streamlabs", "OBS Studio", "Wirecast",
            "iTunes", "Spotify", "Apple Music", "Tidal", "Deezer", "Amazon Music", "YouTube Music",
            "Foobar2000", "Winamp", "AIMP", "MusicBee", "MediaMonkey", "JRiver", "Plex",
            "Kodi", "Emby", "Jellyfin", "HandBrake", "MakeMKV", "DVDFab", "AnyDVD",
            "\u7231\u5947\u827A", "\u817E\u8BAF\u89C6\u9891", "\u4F18\u9177", "\u54D4\u54E9\u54D4\u54E9",
            "\u82B1\u74E3\u76F4\u64AD", "\u6597\u9C7C", "\u864E\u7259", "\u5FEB\u624B", "\u6296\u97F3",
            "\u7F51\u6613\u4E91\u97F3\u4E50", "QQ\u97F3\u4E50", "\u9177\u72D7\u97F3\u4E50", "\u5343\u5343\u97F3\u4E50",
            "\u5168\u6C11K\u6B4C", "\u5531\u5427", "K\u6B4C\u8FBE\u4EBA", "\u9177\u6211\u97F3\u4E50",
            "\u7F8E\u56FE\u79C0\u79C0", "\u5149\u5F71\u9B54\u672F\u624B", "\u4F1A\u58F0\u4F1A\u5F71",
            "\u5267\u5F71\u5927\u5168", "\u8FC5\u96F7\u5F71\u97F3", "PotPlayer", "KMPlayer", "GOM Player",
            "Shotcut", "Kdenlive", "OpenShot", "LosslessCut", "Avidemux", "MPV", "mpv.net", "MPC-HC",
            "MPC-BE", "SMPlayer", "Daum PotPlayer", "QuickTime", "Windows Media Player", "Musicolet", "Dopamine", "LX Music",
            "Format Factory", "Shutter Encoder", "XMedia Recode", "ScreenToGif", "ShareX", "Snipaste", "PixPin", "Greenshot",
            "Lightshot", "FastStone", "XnView", "IrfanView", "ImageGlass", "Honeyview", "Bandiview", "Voicemeeter",
            "Equalizer APO", "Reaper", "FL Studio", "Ableton", "Cubase", "Studio One", "Pro Tools", "Topaz",
            "Upscayl", "Waifu2x", "Real-ESRGAN", "Natron", "Clipchamp", "Filmora", "Wondershare", "PowerDirector",
            "iMovie", "Movavi", "EV Recorder", "Ocam", "\u526A\u6620", "\u5FC5\u526A", "\u6D1B\u96EA\u97F3\u4E50", "\u6C7D\u6C34\u97F3\u4E50",
            "\u559C\u9A6C\u62C9\u96C5", "\u8354\u679D", "\u873B\u8713FM", "\u683C\u5F0F\u5DE5\u5382", "\u5FEB\u526A\u8F91", "\u7231\u526A\u8F91", "\u4E07\u5174\u55B5\u5F71", "\u8FC5\u6377",
            "\u55E8\u683C\u5F0F", "\u8292\u679CTV", "\u54AA\u5495", "\u9177\u72D7", "\u9177\u6211", "\u622A\u56FE", "\u5F55\u5C4F", "\u770B\u56FE",
            "\u64AD\u653E\u5668"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS
        AdditionalKeywords = @(
            "Microsoft Office", "LibreOffice", "WPS", "WPS Office", "OpenOffice", "FreeOffice", "OnlyOffice",
            "Excel", "Word", "PowerPoint", "Outlook", "OneNote",
            "Microsoft Access", "Publisher", "Microsoft Project", "Visio", "Teams", "SharePoint", "OneDrive",
            "Google Workspace", "Google Docs", "Google Sheets", "Google Slides", "Google Drive",
            "Dropbox", "Box", "iCloud", "Mega", "pCloud", "Sync.com", "SpiderOak",
            "Slack", "Discord", "Zoom", "Skype", "WebEx", "GoToMeeting", "BlueJeans",
            "Trello", "Asana", "Monday.com", "Basecamp", "Jira", "Confluence", "Notion",
            "Evernote", "OneNote", "Bear", "Simplenote", "Google Keep", "Apple Notes",
            "\u91D1\u5C71\u529E\u516C", "\u6C38\u4E2D\u96C6\u6210Office", "\u4E2D\u6807\u666E\u534E",
            "\u817E\u8BAF\u4F1A\u8BAE", "\u9489\u9489", "\u4F01\u4E1A\u5FAE\u4FE1", "\u98DE\u4E66",
            "\u77F3\u58A8\u6587\u6863", "\u817E\u8BAF\u6587\u6863", "\u91D1\u5C71\u6587\u6863", "\u8BED\u96C0",
            "\u5370\u8C61\u7B14\u8BB0", "\u6709\u9053\u4E91\u7B14\u8BB0", "\u4E3A\u77E5\u7B14\u8BB0",
            "\u767E\u5EA6\u7F51\u76D8", "\u963F\u91CC\u4E91\u76D8", "\u817E\u8BAF\u5FAE\u4E91",
            "\u5929\u7FFC\u4E91\u76D8", "\u548C\u5F69\u4E91", "115\u7F51\u76D8", "\u8FC5\u96F7\u4E91\u76D8", "123\u4E91\u76D8", "123pan",
            "Microsoft 365", "WeChat Work", "Thunderbird", "Foxmail", "Mailspring", "eM Client", "Spark Mail", "Betterbird", "Lark",
            "Feishu", "DingTalk", "WeCom", "WXWork", "Quark Drive", "Nutstore", "MEGAsync", "Synology Drive",
            "Seafile", "Nextcloud", "ownCloud", "Resilio Sync", "Syncthing", "FreeFileSync", "GoodSync", "Todoist",
            "TickTick", "Microsoft To Do", "ClickUp", "Teambition", "Worktile", "PingCode", "\u5938\u514B\u7F51\u76D8", "\u575A\u679C\u4E91",
            "\u84DD\u594F\u4E91", "\u57CE\u901A\u7F51\u76D8", "\u7F51\u6613\u90AE\u7BB1\u5927\u5E08", "QQ\u90AE\u7BB1", "\u6EF4\u7B54\u6E05\u5355", "\u6C38\u4E2DOffice"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DOCUMENT_TOOLS
        AdditionalKeywords = @(
            "PDF", "Acrobat Reader", "Adobe Acrobat", "Adobe Reader", "Foxit", "Foxit PDF", "SumatraPDF", "PDF24",
            "PDFgear", "PDF Expert", "PDF-XChange", "PDF Creator", "PDFtk", "Nitro", "Bluebeam", "Xodo",
            "Okular", "Calibre", "Kindle", "Koodo Reader", "Neat Reader", "Readest", "Zotero", "Mendeley",
            "EndNote", "NoteExpress", "CAJViewer", "CNKI", "ABBYY FineReader", "Umi-OCR", "OCR", "Pandoc",
            "\u798F\u6615", "\u6781\u5149PDF", "\u4E07\u5174PDF", "\u91D1\u5C71PDF", "\u77E5\u7F51", "\u638C\u9605", "\u5FAE\u4FE1\u8BFB\u4E66", "\u9605\u8BFB\u5668",
            "\u6587\u6863\u626B\u63CF"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SOCIAL_MEDIA
        AdditionalKeywords = @(
            "WeChat", "\u5FAE\u4FE1", "QQ", "Telegram", "Discord", "Skype", "WhatsApp", "Signal",
            "Viber", "Line", "KakaoTalk", "Snapchat", "Instagram", "Facebook", "Twitter", "TikTok",
            "YouTube", "LinkedIn", "Pinterest", "Reddit", "Tumblr", "Flickr", "Vimeo",
            "Clubhouse", "Spaces", "Mastodon", "BeReal", "Threads", "Bluesky", "Parler",
            "\u9489\u9489", "\u4F01\u4E1A\u5FAE\u4FE1", "\u98DE\u4E66", "\u817E\u8BAF\u4F1A\u8BAE",
            "\u94C9\u94C9", "\u9047\u89C1", "\u9646\u9646", "\u63A2\u63A2", "\u4E16\u7EAA\u4F73\u7F18",
            "\u73CD\u7231\u7F51", "\u767E\u5408\u7F51", "\u6709\u7F18\u7F51", "\u5A5A\u793C\u7EAA",
            "\u5FAE\u535A", "\u77E5\u4E4E", "\u8C46\u74E3", "\u5C0F\u7EA2\u4E66", "\u5373\u523B",
            "\u4ECA\u65E5\u5934\u6761", "\u8D23\u4EFB\u7F16\u8F91", "\u4E00\u70B9\u8D44\u8BAF", "\u641C\u72D0\u65B0\u95FB",
            "\u7F51\u6613\u65B0\u95FB", "\u817E\u8BAF\u65B0\u95FB", "\u65B0\u6D6A\u5FAE\u535A", "\u65B0\u6D6A\u65B0\u95FB",
            "YY\u8BED\u97F3", "\u5343\u5343\u97F3\u4E50", "\u5168\u6C11K\u6B4C", "\u5531\u5427",
            "\u6620\u5BA2", "\u5168\u6C11\u5C0F\u89C6\u9891", "\u897F\u74DC\u89C6\u9891", "\u706B\u5C71\u5C0F\u89C6\u9891",
            "Zalo", "Messenger", "TIM", "KOOK", "TeamSpeak", "Mumble", "Weibo", "Douyin",
            "Kuaishou", "Xiaohongshu", "Zhihu", "Twitch", "Lark Messenger", "Rocket.Chat", "Mattermost", "\u5F00\u9ED1\u5566",
            "QQ\u9891\u9053", "\u5FAE\u4FE1\u8F93\u5165\u6CD5"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_COMPRESSION_TOOLS
        AdditionalKeywords = @(
            "WinRAR", "7-Zip", "Bandizip", "PeaZip", "Archive", "WinZip", "IZArc", "HaoZip",
            "360\u538B\u7F29", "\u597D\u538B", "\u5FEB\u538B", "2345\u597D\u538B", "\u9177\u538B",
            "PowerArchiver", "Ashampoo ZIP", "Express Zip", "Universal Extractor", "Zipware",
            "jZip", "Hamster ZIP", "TUGZip", "FreeArc", "KGB Archiver", "UltimateZip",
            "\u538B\u7F29\u5305", "\u89E3\u538B\u7F29", "\u6587\u4EF6\u538B\u7F29", "\u6587\u4EF6\u89E3\u538B",
            "NanaZip", "7zFM", "Explzh", "ExtractNow", "Keka", "B1 Free Archiver", "ZArchiver"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DATABASE_TOOLS
        AdditionalKeywords = @(
            "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Database", "DBeaver", "HeidiSQL",
            "Navicat", "DataGrip", "TablePlus", "Sequel Pro", "phpMyAdmin", "Adminer",
            "MySQL Workbench", "pgAdmin", "MongoDB Compass", "Redis Desktop Manager", "Robo 3T",
            "Studio 3T", "Oracle SQL Developer", "SQL Server Management Studio", "SSMS",
            "Azure Data Studio", "DbVisualizer", "SQuirreL SQL", "Toad", "ERwin", "PowerDesigner",
            "Visual Paradigm", "Enterprise Architect",
            "\u6570\u636E\u5E93", "\u6570\u636E\u5E93\u7BA1\u7406", "SQL\u5DE5\u5177", "\u6570\u636E\u5EFA\u6A21",
            "Redis Insight", "RedisInsight", "Another Redis Desktop Manager", "RESP.app", "Medis", "Beekeeper Studio", "SQLyog", "DB Browser for SQLite",
            "SQLiteStudio", "Neo4j", "ClickHouse", "Elasticvue", "Kibana", "dbForge", "Chat2DB", "NoSQLBooster",
            "DbGate", "Postico", "Antares SQL", "Valentina Studio"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_BROWSERS
        AdditionalKeywords = @(
            "Chrome", "Edge", "Firefox", "Safari", "Opera", "Brave", "Vivaldi", "Browser",
            "Google Chrome", "Chrome Beta", "Chrome Canary", "Microsoft Edge", "Thorium", "Floorp", "LibreWolf", "Zen Browser",
            "Internet Explorer", "IE", "Chromium", "Tor Browser", "DuckDuckGo", "Waterfox",
            "Pale Moon", "SeaMonkey", "Maxthon", "UC Browser", "Yandex Browser", "Cent Browser",
            "SRWare Iron", "Comodo Dragon", "Slimjet", "Torch Browser", "Avant Browser",
            "\u8C37\u6B4C\u6D4F\u89C8\u5668", "\u706B\u72D0\u6D4F\u89C8\u5668", "\u6B27\u670B\u6D4F\u89C8\u5668",
            "360\u6D4F\u89C8\u5668", "360\u6781\u901F\u6D4F\u89C8\u5668", "QQ\u6D4F\u89C8\u5668", "\u641C\u72D7\u6D4F\u89C8\u5668",
            "\u767E\u5EA6\u6D4F\u89C8\u5668", "UC\u6D4F\u89C8\u5668", "\u9177\u72D7\u6D4F\u89C8\u5668", "\u4E16\u754C\u4E4B\u7A97",
            "\u7EFF\u8272\u6D4F\u89C8\u5668", "\u795E\u7BAD\u624B", "\u5F69\u8679\u6D4F\u89C8\u5668", "\u5FC5\u5E94\u6D4F\u89C8\u5668",
            "\u6C34\u72D0\u6D4F\u89C8\u5668", "\u7231\u597D\u8005\u6D4F\u89C8\u5668", "\u5C0F\u767D\u6D4F\u89C8\u5668", "\u5343\u5F71\u6D4F\u89C8\u5668",
            "\u65D7\u9C7C\u6D4F\u89C8\u5668", "\u661F\u613F\u6D4F\u89C8\u5668", "\u95EA\u6E38\u6D4F\u89C8\u5668", "\u6D77\u8C5A\u6D4F\u89C8\u5668",
            "AdsPower", "BitBrowser", "Hubstudio", "Multilogin", "Dolphin Anty", "GoLogin", "Incogniton", "Sidekick",
            "Ungoogled Chromium", "Supermium", "Catsxp", "Ghost Browser", "Mullvad Browser", "Quark Browser", "\u6BD4\u7279\u6D4F\u89C8\u5668", "\u7D2B\u9E1F\u6D4F\u89C8\u5668",
            "\u5019\u9E1F\u6D4F\u89C8\u5668", "\u5938\u514B\u6D4F\u89C8\u5668", "\u53CC\u6838\u6D4F\u89C8\u5668", "\u6D4F\u89C8\u5668", "Arc Browser"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_GAMES
        AdditionalKeywords = @(
            "Steam", "Epic Games", "Origin", "Uplay", "Battle.net", "Blizzard", "\u66B4\u96EA\u6218\u7F51", "GOG Galaxy", "Xbox", "PlayStation",
            "Diablo", "\u6697\u9ED1\u7834\u574F\u795E", "Hearthstone", "StarCraft", "\u661F\u9645\u4E89\u9738", "Heroes of the Storm",
            "RoS-BoT", "RBAssist",
            "Minecraft", "Roblox", "Fortnite", "League of Legends", "Dota 2", "Counter-Strike",
            "World of Warcraft", "Overwatch", "Apex Legends", "Valorant", "PUBG", "Among Us",
            "Fall Guys", "Rocket League", "Grand Theft Auto", "Call of Duty", "FIFA", "NBA 2K",
            "\u738B\u8005\u8363\u8000", "\u548C\u5E73\u7CBE\u82F1", "\u7EDD\u5730\u6C42\u751F", "\u82F1\u96C4\u8054\u76DF",
            "\u5B88\u671B\u5148\u950B", "\u7089\u77F3\u4F20\u8BF4", "\u9B54\u517D\u4E16\u754C", "\u5251\u7075",
            "\u68A6\u5E7B\u897F\u6E38", "\u5927\u8BDD\u897F\u6E38", "\u5929\u9F99\u516B\u90E8", "\u4ED9\u5251\u5947\u4FA0\u4F20",
            "\u4E09\u56FD\u6740", "\u6597\u5730\u4E3B", "\u9EBB\u5C06", "\u8C61\u68CB", "\u56F4\u68CB",
            "\u6E38\u620F\u5E73\u53F0", "\u6E38\u620F\u542F\u52A8\u5668", "\u6E38\u620F\u5DE5\u5177",
            "WeGame", "\u817E\u8BAF\u6E38\u620F\u5E73\u53F0", "\u7F51\u6613\u6E38\u620F", "\u5B8C\u7F8E\u4E16\u754C",
            "\u5DE8\u4EBA\u7F51\u7EDC", "\u76DB\u5927\u6E38\u620F", "\u897F\u5C71\u5C45\u6E38\u620F", "\u4E5D\u57CE\u6E38\u620F",
            "Riot Client", "Riot Games", "EA app", "EA Desktop", "Ubisoft Connect", "Rockstar Games Launcher", "Genshin Impact", "Honkai",
            "Star Rail", "Zenless Zone Zero", "Wuthering Waves", "HoYoPlay", "miHoYo", "TapTap", "4399", "Minecraft Launcher",
            "HMCL", "PCL", "MultiMC", "Prism Launcher", "BlueStacks", "MuMu", "LDPlayer", "MEmu",
            "NoxPlayer", "Ryujinx", "RetroArch", "Dolphin", "PCSX2", "RPCS3", "Cemu", "PPSSPP",
            "DuckStation", "Playnite", "Elden Ring", "Cyberpunk", "Baldur", "Hollow Knight", "Terraria", "Stardew",
            "Black Myth", "Naraka", "CS2", "Warframe", "Path of Exile", "Lost Ark", "Final Fantasy", "Monster Hunter",
            "Palworld", "Delta Force", "CrossFire", "DNF", "Wallpaper Engine", "Game", "Games", "\u539F\u795E",
            "\u5D29\u574F", "\u661F\u7A79\u94C1\u9053", "\u7EDD\u533A\u96F6", "\u9E23\u6F6E", "\u7C73\u54C8\u6E38", "\u96F7\u7535\u6A21\u62DF\u5668", "\u591C\u795E\u6A21\u62DF\u5668", "\u900D\u9065\u6A21\u62DF\u5668",
            "\u6A21\u62DF\u5668", "\u9ED1\u795E\u8BDD", "\u6C38\u52AB\u65E0\u95F4", "\u9006\u6C34\u5BD2", "\u6D41\u653E\u4E4B\u8DEF", "\u602A\u7269\u730E\u4EBA", "\u5E7B\u517D\u5E15\u9C81", "\u4E09\u89D2\u6D32\u884C\u52A8",
            "\u7A7F\u8D8A\u706B\u7EBF", "QQ\u98DE\u8F66", "\u5730\u4E0B\u57CE\u4E0E\u52C7\u58EB", "\u7F51\u6613\u5927\u795E", "\u6E38\u620F"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SECURITY_TOOLS
        AdditionalKeywords = @(
            "Antivirus", "McAfee", "Norton", "Kaspersky", "Avast", "AVG", "Bitdefender", "ESET",
            "Malwarebytes", "Windows Defender", "Avira", "Trend Micro", "F-Secure", "Sophos",
            "360\u5B89\u5168\u536B\u58EB", "\u817E\u8BAF\u7535\u8111\u7BA1\u5BB6", "\u91D1\u5C71\u6BD2\u9738",
            "\u745E\u661F\u6740\u6BD2", "\u6C5F\u6C11\u79D1\u6280", "\u5927\u8718\u86DB", "\u706B\u7ED2",
            "\u5B89\u5168\u536B\u58EB", "\u6740\u6BD2\u8F6F\u4EF6", "\u9632\u706B\u5899", "\u7CFB\u7EDF\u4FEE\u590D",
            "VPN", "Proxy", "Tor", "Firewall", "Password Manager", "1Password", "LastPass",
            "Bitwarden", "Dashlane", "KeePass", "RoboForm", "Sticky Password", "True Key",
            "\u5BC6\u7801\u7BA1\u7406", "\u52A0\u5BC6\u8F6F\u4EF6", "\u9690\u79C1\u4FDD\u62A4", "\u6570\u636E\u52A0\u5BC6",
            "Microsoft Defender", "Comodo", "Emsisoft", "HitmanPro", "AdwCleaner", "Spybot", "ZoneAlarm", "GlassWire",
            "simplewall", "VeraCrypt", "Cryptomator", "Gpg4win", "Kleopatra", "Authy", "Proton Pass", "KeePassXC",
            "Enpass", "NordPass", "Huorong", "\u7535\u8111\u7BA1\u5BB6", "\u5B89\u5168\u4E2D\u5FC3"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SYSTEM_TOOLS
        AdditionalKeywords = @(
            "CCleaner", "Advanced SystemCare", "Driver Booster", "Uninstaller", "Registry Cleaner",
            "Disk Cleanup", "Defraggler", "CrystalDiskInfo", "HWiNFO", "CPU-Z", "GPU-Z",
            "MSI Afterburner", "Core Temp", "SpeedFan", "FurMark", "Prime95", "MemTest86",
            "Process Monitor", "Process Explorer", "Autoruns", "Sysinternals", "Task Manager",
            "\u9C81\u5927\u5E08", "\u9A71\u52A8\u7CBE\u7075", "\u9A71\u52A8\u4EBA\u751F", "360\u9A71\u52A8\u5927\u5E08",
            "\u8F6F\u4EF6\u7BA1\u5BB6", "\u7CFB\u7EDF\u4F18\u5316", "\u6E05\u7406\u5927\u5E08", "\u78C1\u76D8\u6574\u7406",
            "\u6CE8\u518C\u8868\u6E05\u7406", "\u7CFB\u7EDF\u76D1\u63A7", "\u786C\u4EF6\u68C0\u6D4B", "\u6E29\u5EA6\u76D1\u63A7",
            "Wise Care 365", "IObit Uninstaller", "Revo Uninstaller", "Geek Uninstaller",
            "TreeSize", "WinDirStat", "SpaceSniffer", "Disk Usage Analyzer", "Everything",
            "PowerToys", "Sysinternals Suite", "Windows Terminal", "Command Prompt", "PowerShell",
            "Ditto", "CopyQ", "Listary", "Wox", "Flow Launcher", "uTools", "Quicker", "AutoHotkey",
            "Keypirinha", "Rainmeter", "TranslucentTB", "StartAllBack", "Open-Shell", "ExplorerPatcher", "Fences", "DisplayFusion",
            "Dism++", "BleachBit", "Recuva", "DiskGenius", "AOMEI", "Rufus", "Ventoy", "balenaEtcher",
            "Etcher", "UltraISO", "Macrium", "Acronis", "EaseUS", "Process Lasso", "HWMonitor", "AIDA64",
            "OCCT", "CrystalDiskMark", "HD Tune", "ThrottleStop", "Bulk Rename Utility", "Advanced Renamer", "Total Commander", "Directory Opus",
            "XYplorer", "OneCommander", "Q-Dir", "FreeCommander", "Double Commander", "Mem Reduct", "Twinkle Tray", "Monitorian",
            "f.lux", "EarTrumpet", "Snappy Driver", "GeForce Experience", "NVIDIA", "AMD Software", "Radeon", "Intel Driver",
            "Logitech G HUB", "Razer Synapse", "Armoury Crate", "MSI Center", "Dragon Center", "Lenovo Vantage", "HP Support Assistant", "Acer Care Center",
            "Acer Quick Access", "NitroSense", "PredatorSense", "Realtek Audio", "Dolby", "Control Panel", "Device Manager", "Registry Editor",
            "Regedit", "Resource Monitor", "Event Viewer", "Recycle Bin", "This PC", "\u5206\u533A\u52A9\u624B", "\u8F6F\u789F\u901A", "\u63A7\u5236\u9762\u677F",
            "\u8BBE\u5907\u7BA1\u7406\u5668", "\u6CE8\u518C\u8868", "\u4EFB\u52A1\u7BA1\u7406\u5668", "\u56DE\u6536\u7AD9", "\u6B64\u7535\u8111", "\u6211\u7684\u7535\u8111", "\u9F20\u6807", "\u952E\u76D8",
            "\u9A71\u52A8", "Partition Assistant"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DOWNLOAD_TOOLS
        AdditionalKeywords = @(
            "IDM", "Internet Download Manager", "Free Download Manager", "EagleGet", "JDownloader",
            "uTorrent", "BitTorrent", "qBittorrent", "Transmission", "Deluge", "Vuze", "BitComet",
            "Thunder", "\u8FC5\u96F7", "\u65CB\u98CE", "\u7F51\u9645\u5FEB\u8F66", "\u8FC5\u96F7\u6781\u901F\u7248",
            "\u767E\u5EA6\u7F51\u76D8", "\u963F\u91CC\u4E91\u76D8", "\u817E\u8BAF\u5FAE\u4E91", "\u5929\u7FFC\u4E91\u76D8",
            "115\u7F51\u76D8", "\u548C\u5F69\u4E91", "\u5FEB\u76D8", "\u8FC5\u96F7\u4E91\u76D8", "\u5F71\u68AD\u4E91",
            "Aria2", "Wget", "Curl", "DownThemAll", "Video DownloadHelper", "4K Video Downloader",
            "YouTube-dl", "yt-dlp", "ClipGrab", "Freemake Video Downloader", "Any Video Converter",
            "\u4E0B\u8F7D\u5DE5\u5177", "\u4E0B\u8F7D\u5668", "\u4E0B\u8F7D\u52A0\u901F", "\u79CD\u5B50\u4E0B\u8F7D",
            "\u78C1\u529B\u94FE\u63A5", "BT\u4E0B\u8F7D", "\u7F51\u76D8\u4E0B\u8F7D", "\u89C6\u9891\u4E0B\u8F7D",
            "Motrix", "AB Download Manager", "Neat Download Manager", "NDM", "Xtreme Download Manager", "XDM", "Persepolis", "PikPak",
            "Tixati", "BiglyBT", "Gopeed", "Hitomi Downloader", "N_m3u8DL", "Downloader", "\u4E0B\u8F7D"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_EDUCATION
        AdditionalKeywords = @(
            "Khan Academy", "Coursera", "edX", "Udemy", "Skillshare", "MasterClass", "Pluralsight",
            "LinkedIn Learning", "Codecademy", "FreeCodeCamp", "Duolingo", "Babbel", "Rosetta Stone",
            "Anki", "Quizlet", "Memrise", "StudyBlue", "Evernote", "Notion", "Obsidian",
            "\u5B66\u800C\u601D\u7F51\u6821", "\u65B0\u4E1C\u65B9\u5728\u7EBF", "\u597D\u672A\u6765", "\u4F5C\u4E1A\u5E2E",
            "\u5C0F\u7334\u641C\u9898", "\u4E00\u8D77\u4F5C\u4E1A", "\u4F5C\u4E1A\u76D2\u5B50", "\u5B66\u4E60\u5F3A\u56FD",
            "\u667A\u5B66\u7F51", "\u8D85\u661F\u5B66\u4E60", "\u7F51\u6613\u4E91\u8BFE\u5802", "\u817E\u8BAF\u8BFE\u5802",
            "\u6709\u9053\u7CBE\u54C1\u8BFE", "\u6C99\u62C9\u82F1\u8BED", "\u767E\u8BCD\u65A9", "\u6247\u8D1D\u5355\u8BCD",
            "\u4E0D\u80CC\u5355\u8BCD", "\u6D41\u5229\u8BF4", "\u82F1\u8BED\u6D41\u5229\u8BF4", "\u53EF\u53EF\u82F1\u8BED",
            "Mathematica", "MATLAB", "R Studio", "SPSS", "SAS", "Stata", "Origin", "GraphPad Prism",
            "ChemDraw", "AutoCAD", "SolidWorks", "CATIA", "Inventor", "Fusion 360", "SketchUp",
            "\u5B66\u4E60\u8F6F\u4EF6", "\u6559\u80B2\u5E73\u53F0", "\u5728\u7EBF\u5B66\u4E60", "\u8BED\u8A00\u5B66\u4E60",
            "Youdao", "Eudic", "GoldenDict", "DeepL", "Google Translate", "Translator", "GeoGebra", "Desmos",
            "MathType", "Wolfram", "Stellarium", "Moodle", "Rain Classroom", "\u6709\u9053\u8BCD\u5178", "\u7F51\u6613\u6709\u9053", "\u6B27\u8DEF\u8BCD\u5178",
            "\u7FFB\u8BD1", "\u96E8\u8BFE\u5802", "\u9489\u9489\u8BFE\u5802", "\u4E2D\u56FD\u5927\u5B66MOOC", "\u5B66\u5802\u5728\u7EBF", "\u733F\u8F85\u5BFC", "\u7C89\u7B14"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_FINANCE
        AdditionalKeywords = @(
            "QuickBooks", "Mint", "YNAB", "Personal Capital", "Quicken", "TurboTax", "H&R Block",
            "PayPal", "Venmo", "Cash App", "Zelle", "Apple Pay", "Google Pay", "Samsung Pay",
            "\u652F\u4ED8\u5B9D", "\u5FAE\u4FE1\u652F\u4ED8", "\u4E91\u95EA\u4ED8", "\u4EAC\u4E1C\u652F\u4ED8",
            "\u62DB\u5546\u94F6\u884C", "\u5DE5\u5546\u94F6\u884C", "\u5EFA\u8BBE\u94F6\u884C", "\u4E2D\u56FD\u94F6\u884C",
            "\u519C\u4E1A\u94F6\u884C", "\u4EA4\u901A\u94F6\u884C", "\u4E2D\u4FE1\u94F6\u884C", "\u5E73\u5B89\u94F6\u884C",
            "\u540C\u82B1\u987A", "\u4E1C\u65B9\u8D22\u5BCC", "\u5927\u667A\u6167", "\u901A\u8FBE\u4FE1",
            "\u96EA\u7403", "\u5BCC\u9014", "\u5929\u5929\u57FA\u91D1", "\u8682\u8681\u8D22\u5BCC",
            "\u4EAC\u4E1C\u91D1\u878D", "\u5EA6\u5C0F\u6EE1", "\u62CD\u62CD\u8D37", "\u501F\u5457",
            "Bitcoin", "Ethereum", "Coinbase", "Binance", "Kraken", "Robinhood", "E*TRADE",
            "\u8D22\u52A1\u8F6F\u4EF6", "\u8BB0\u8D26\u8F6F\u4EF6", "\u6295\u8D44\u7406\u8D22", "\u94F6\u884C\u5BA2\u6237\u7AEF",
            "TradingView", "MetaTrader", "MT4", "MT5", "Interactive Brokers", "IBKR", "Trader Workstation", "Futu",
            "moomoo", "Tiger Brokers", "OKX", "Bybit", "Bitget", "Gate.io", "MetaMask", "Exodus",
            "Electrum", "Ledger Live", "Trezor", "\u5BCC\u9014\u725B\u725B", "\u8001\u864E\u8BC1\u5238", "\u534E\u6CF0\u8BC1\u5238", "\u6DA8\u4E50\u8D22\u5BCC\u901A", "\u56FD\u6CF0\u541B\u5B89",
            "\u62DB\u5546\u8BC1\u5238", "\u5E73\u5B89\u8BC1\u5238", "\u8BC1\u5238", "\u94F6\u884C", "\u57FA\u91D1", "\u80A1\u7968"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_SHOPPING
        AdditionalKeywords = @(
            "Amazon", "eBay", "Walmart", "Target", "Best Buy", "Costco", "Home Depot", "Lowe's",
            "\u6DD8\u5B9D", "\u5929\u732B", "\u4EAC\u4E1C", "\u62FC\u591A\u591A", "\u82CF\u5B81\u6613\u8D2D",
            "\u552F\u54C1\u4F1A", "\u5C0F\u7EA2\u4E66", "\u5F97\u7269", "\u7F51\u6613\u4E25\u9009", "\u8003\u62C9",
            "\u4E2D\u56FD\u4E9A\u9A6C\u900A", "\u5F53\u5F53", "\u56FD\u7F8E", "\u5BB6\u4E50\u798F", "\u6C38\u8F89",
            "\u7F8E\u56E2", "\u997F\u4E86\u4E48", "\u53E3\u7891", "\u5927\u4F17\u70B9\u8BC4", "\u7F8E\u56E2\u5916\u5356",
            "\u95F2\u9C7C", "\u8F6C\u8F6C", "\u7231\u56DE\u6536", "\u591A\u6297\u7C73", "\u5C0F\u9E7F\u8336",
            "Shopify", "WooCommerce", "Magento", "BigCommerce", "Squarespace", "Wix", "Etsy",
            "\u8D2D\u7269\u8F6F\u4EF6", "\u7535\u5546\u5E73\u53F0", "\u5728\u7EBF\u8D2D\u7269", "\u624B\u673A\u8D2D\u7269",
            "Temu", "SHEIN", "AliExpress", "Taobao", "JD.com", "Pinduoduo", "\u5343\u725B", "\u4EAC\u9EA6",
            "\u963F\u91CC\u65FA\u65FA", "1688", "\u901F\u5356\u901A", "\u6296\u5E97", "\u62FC\u591A\u591A\u5546\u5BB6"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        AdditionalKeywords = @(
            "RustDesk", "TeamViewer", "AnyDesk", "VNC", "Remote Desktop", "SSH", "Telnet",
            "PuTTY", "WinSCP", "FileZilla", "MobaXterm", "Wireshark", "Fiddler", "Charles",
            "API", "REST", "GraphQL", "WebSocket",
            "NetBird", "Tailscale", "ZeroTier", "WireGuard", "OpenVPN", "EasyTier", "Headscale", "Radmin VPN",
            "Hamachi", "Sunlogin", "\u5411\u65E5\u8475", "ToDesk", "Parsec", "frp", "n2n",
            "Termius", "Xshell", "Xftp", "SecureCRT", "mRemoteNG", "Remote Desktop Manager",
            "FTP", "SFTP", "HTTP", "HTTPS", "TCP", "UDP", "DNS", "DHCP", "VPN",
            "Proxy", "Firewall", "Router", "Switch", "Gateway", "Load Balancer",
            "Network Monitor", "Bandwidth Monitor", "Packet Analyzer", "Network Scanner",
            "Ping", "Traceroute", "Netstat", "Ipconfig", "Nslookup", "Dig",
            "\u8FDC\u7A0B\u63A7\u5236", "\u8FDC\u7A0B\u8BBF\u95EE", "\u7F51\u7EDC\u5DE5\u5177",
            "\u7F51\u7EDC\u68C0\u6D4B", "\u7F51\u7EDC\u76D1\u63A7", "\u7F51\u7EDC\u5206\u6790",
            "\u7F51\u7EDC\u5B89\u5168", "\u7F51\u7EDC\u4F18\u5316", "\u7F51\u7EDC\u7BA1\u7406",
            "WinBox", "Tftpd", "Advanced IP Scanner", "Angry IP Scanner", "IP Scanner", "NetSetMan", "Npcap", "Cyberduck",
            "WindTerm", "FinalShell", "electerm", "Royal TS", "Remmina", "NoMachine", "Splashtop", "Chrome Remote Desktop",
            "RealVNC", "TightVNC", "UltraVNC", "TigerVNC", "Moonlight", "Sunshine", "AweSun", "Oray",
            "Nmap", "Zenmap", "iPerf", "Rclone", "Cloudflared", "ngrok", "Wi-Fi", "WiFi",
            "\u84B2\u516C\u82F1", "\u82B1\u751F\u58F3", "UU\u8FDC\u7A0B", "\u7F51\u6613UU\u8FDC\u7A0B", "\u8FDC\u7A0B"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_AI_CLI_TOOLS
        AdditionalKeywords = @(
            "ACLI", "Atlassian CLI", "OpenAI CLI", "Claude CLI", "Anthropic CLI", "GitHub CLI", "gh",
            "Azure CLI", "AWS CLI", "Google Cloud CLI", "gcloud", "kubectl", "helm", "docker",
            "Terraform", "Ansible", "Chef", "Puppet", "Salt", "Jenkins CLI", "CircleCI CLI",
            "GitLab CLI", "Bitbucket CLI", "Jira CLI", "Confluence CLI", "Slack CLI",
            "Discord CLI", "Telegram CLI", "WhatsApp CLI", "WeChat CLI", "QQ CLI",
            "ChatGPT CLI", "Bard CLI", "Copilot CLI", "Codeium CLI", "Tabnine CLI",
            "Hugging Face CLI", "Transformers CLI", "PyTorch CLI", "TensorFlow CLI",
            "LangChain CLI", "LlamaIndex CLI", "AutoGPT CLI", "BabyAGI CLI",
            "Stable Diffusion CLI", "Midjourney CLI", "DALL-E CLI", "Firefly CLI",
            "AI Assistant", "AI Chat", "AI Code", "AI Generate", "AI Model", "AI Tool",
            "Machine Learning CLI", "ML CLI", "Deep Learning CLI", "Neural Network CLI",
            "AI Development", "AI Framework", "AI Library", "AI Platform", "AI Service",
            "Natural Language Processing", "NLP CLI", "Computer Vision CLI", "CV CLI",
            "AI Testing", "AI Debugging", "AI Monitoring", "AI Analytics", "AI Reporting",
            "Claude", "ChatGPT", "OpenAI", "Gemini", "Copilot", "DeepSeek", "Kimi", "Qwen", "Doubao", "Grok",
            "Perplexity", "Ollama", "LM Studio", "Cherry Studio", "Codex", "Manus",
            "\u8C46\u5305", "\u901A\u4E49\u5343\u95EE", "\u6587\u5FC3\u4E00\u8A00", "\u817E\u8BAF\u5143\u5B9D", "\u667A\u8C31\u6E05\u8A00",
            "Monica", "GPT4All", "AnythingLLM", "Msty", "Chatbox", "LobeChat", "NextChat", "ComfyUI",
            "Stable Diffusion", "Fooocus", "InvokeAI", "Open WebUI", "Dify", "Coze", "Hunyuan", "Kling",
            "Hailuo", "Jimeng", "Zhipu", "ChatGLM", "Baichuan", "MiniMax", "StepFun", "Ernie",
            "Tongyi", "Lingma", "MarsCode", "Comate", "Cline", "Roo Code", "Kilo Code", "Aider",
            "OpenCode", "Augment", "Tabnine", "Codeium", "Qoder", "\u5373\u68A6", "\u53EF\u7075", "\u6D77\u87BA",
            "\u5929\u5DE5", "\u79D8\u5854", "\u7EB3\u7C73AI", "\u901A\u4E49\u7075\u7801", "\u6587\u5FC3\u5FEB\u7801", "\u667A\u8C31", "\u8BAF\u98DE\u661F\u706B", "\u661F\u706B",
            "\u6263\u5B50", "\u5143\u5B9D", "AI\u52A9\u624B"
        )
    },
    @{
        # Fallback: desktop shortcuts no other category matches (no keywords by design)
        DesktopCategory    = $Global:DESKTOP_CATEGORY_OTHER_APPS
        AdditionalKeywords = @()
    }
)

<#
.SYNOPSIS
    Performs intelligent desktop cleanup for a single installed application

.DESCRIPTION
    This function provides real-time desktop icon management during application installation.
    It scans for existing shortcuts, organizes them into categories, and creates clean
    desktop shortcuts for the newly installed application.

.PARAMETER PackageName
    Name of the installed package/application

.PARAMETER ExecutablePath
    Path to the main executable of the installed application

.PARAMETER ScanKeywords
    Array of keywords to search for existing desktop shortcuts

.PARAMETER CategoryName
    Optional category name for organizing shortcuts (defaults to application type)

.PARAMETER CreateShortcut
    Whether to create a desktop shortcut (default: true)

.EXAMPLE
    Invoke-DesktopCleanupForPackage -PackageName "Visual Studio Code" -ExecutablePath "C:\Program Files\Microsoft VS Code\Code.exe" -ScanKeywords @("code", "vscode", "visual studio code")

.EXAMPLE
    Invoke-DesktopCleanupForPackage -PackageName "Python" -ExecutablePath "C:\Python39\python.exe" -ScanKeywords @("python", "py") -CategoryName "Development"
#>
function Invoke-DesktopCleanupForPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        
        [Parameter(Mandatory = $false)]
        [string]$ExecutablePath = "",
        
        [Parameter(Mandatory = $false)]
        [array]$ScanKeywords = @(),
        
        [Parameter(Mandatory = $false)]
        [string]$CategoryName = "",
        
        [Parameter(Mandatory = $false)]
        [bool]$CreateShortcut = $true
    )
    
    if (-not $Global:DESKTOP_CLEANUP_ENABLED) {
        Write-DesktopIconManagerDebug -Message "Desktop cleanup disabled, skipping for: $PackageName" -ForegroundColor Gray
        return
    }
    
    Write-DesktopIconManagerDebug -Message "Starting desktop cleanup for package: $PackageName" -ForegroundColor Cyan
    
    # Variables declaration
    $cleanupResults = @{
        PackageName = $PackageName
        ShortcutsFound = 0
        ShortcutsMoved = 0
        ShortcutsCreated = 0
        Errors = @()
    }
    
    try {
        # Step 1: Scan and organize existing shortcuts
        if ($ScanKeywords.Count -gt 0) {
            Write-DesktopIconManagerDebug -Message "Scanning for existing shortcuts with keywords: $($ScanKeywords -join ', ')" -ForegroundColor Yellow
            $scanResults = Find-ExistingShortcuts -Keywords $ScanKeywords -PackageName $PackageName
            $cleanupResults.ShortcutsFound = $scanResults.Found
            $cleanupResults.ShortcutsMoved = $scanResults.Moved
        }
        
        # Step 2: Create organized shortcut if requested and executable path provided
        if ($CreateShortcut -and $ExecutablePath -and (Test-Path $ExecutablePath)) {
            Write-DesktopIconManagerDebug -Message "Creating organized shortcut for: $PackageName" -ForegroundColor Green
            
            # Determine category based on package type or provided category
            $finalCategory = if ($CategoryName) { $CategoryName } else { Get-PackageCategory -PackageName $PackageName -ExecutablePath $ExecutablePath }
            
            # Create desktop shortcut using CommonFunc.ps1
            $shortcutCreated = Create-DesktopShortcutsForPackage -ShortcutName $PackageName -ExePath $ExecutablePath -CategoryName $finalCategory -ScanKeywords $ScanKeywords
            
            if ($shortcutCreated) {
                $cleanupResults.ShortcutsCreated = 1
                Write-DesktopIconManagerDebug -Message "Successfully created shortcut for: $PackageName" -ForegroundColor Green
            } else {
                $cleanupResults.Errors += "Failed to create shortcut"
                Write-DesktopIconManagerDebug -Message "Failed to create shortcut for: $PackageName" -ForegroundColor Red
            }
        }
        
        # Step 3: Clean up orphaned shortcuts (optional aggressive cleanup)
        if ($Global:AGGRESSIVE_CLEANUP_ENABLED) {
            Remove-OrphanedShortcuts -PackageName $PackageName
        }
        
        Write-DesktopIconManagerDebug -Message "Desktop cleanup completed for: $PackageName (Found: $($cleanupResults.ShortcutsFound), Moved: $($cleanupResults.ShortcutsMoved), Created: $($cleanupResults.ShortcutsCreated))" -ForegroundColor Green
        
    } catch {
        $errorMsg = "Desktop cleanup failed for ${PackageName}: $($_.Exception.Message)"
        $cleanupResults.Errors += $errorMsg
        Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
    }
    
    return $cleanupResults
}

<#
.SYNOPSIS
    Finds existing desktop shortcuts based on keywords

.DESCRIPTION
    Scans both user and public desktop for shortcuts matching the provided keywords.
    This function is used to identify existing shortcuts that need to be organized.
#>
function Find-ExistingShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [array]$Keywords,
        
        [Parameter(Mandatory = $true)]
        [string]$PackageName
    )
    
    # Variables declaration
    $results = @{
        Found = 0
        Moved = 0
        Shortcuts = @()
    }
    
    $userDesktopPath = [Environment]::GetFolderPath("Desktop")
    $publicDesktopPath = Join-Path $env:PUBLIC "Desktop"
    $desktopPaths = @($userDesktopPath, $publicDesktopPath)
    
    Write-DesktopIconManagerDebug -Message "Scanning desktops for shortcuts matching: $($Keywords -join ', ')" -ForegroundColor Cyan
    
    foreach ($keyword in $Keywords) {
        foreach ($desktopPath in $desktopPaths) {
            if (-not (Test-Path $desktopPath)) {
                continue
            }
            
            try {
                # Use .NET method for better Unicode handling
                $lnkFiles = [System.IO.Directory]::GetFiles($desktopPath, "*.lnk")
                
                foreach ($filePath in $lnkFiles) {
                    $shortcut = Get-Item $filePath
                    $shortcutName = $shortcut.BaseName
                    
                    # Check if shortcut matches keyword
                    if ($shortcutName -like "*$keyword*" -or $shortcutName -match $keyword) {
                        Write-DesktopIconManagerDebug -Message "Found matching shortcut: $($shortcut.Name)" -ForegroundColor Green
                        
                        $results.Shortcuts += @{
                            Name = $shortcut.Name
                            Path = $shortcut.FullName
                            Keyword = $keyword
                            Desktop = $desktopPath
                        }
                        $results.Found++
                    }
                }
            } catch {
                Write-DesktopIconManagerDebug -Message "Error scanning desktop $desktopPath`: $_" -ForegroundColor Red
            }
        }
    }
    
    return $results
}

<#
.SYNOPSIS
    Determines the appropriate category for a package based on its characteristics
#>
function Get-PackageCategory {
    param(
        [string]$PackageName,
        [string]$ExecutablePath
    )
    
    # Variables declaration
    $category = "Applications"
    $packageLower = $PackageName.ToLower()
    $executableLower = $ExecutablePath.ToLower()
    
    # Development tools
    if ($packageLower -match "python|node|npm|git|code|studio|dev|sdk|compiler") {
        $category = "Development"
    }
    # Media tools
    elseif ($packageLower -match "media|video|audio|player|vlc|spotify") {
        $category = "Media"
    }
    # System utilities
    elseif ($packageLower -match "system|utility|tool|manager|cleaner") {
        $category = "System"
    }
    # Games
    elseif ($packageLower -match "game|steam|epic") {
        $category = "Games"
    }
    # Office/Productivity
    elseif ($packageLower -match "office|word|excel|pdf|note") {
        $category = "Office"
    }
    
    return $category
}

<#
.SYNOPSIS
    Removes orphaned shortcuts that no longer have valid targets
#>
function Remove-OrphanedShortcuts {
    param(
        [string]$PackageName
    )
    
    Write-DesktopIconManagerDebug -Message "Checking for orphaned shortcuts related to: $PackageName" -ForegroundColor Yellow
    
    # Variables declaration
    $userDesktopPath = [Environment]::GetFolderPath("Desktop")
    $publicDesktopPath = Join-Path $env:PUBLIC "Desktop"
    $desktopPaths = @($userDesktopPath, $publicDesktopPath)
    $orphanedCount = 0
    
    foreach ($desktopPath in $desktopPaths) {
        if (-not (Test-Path $desktopPath)) {
            continue
        }
        
        try {
            $shortcuts = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -ErrorAction SilentlyContinue
            
            foreach ($shortcut in $shortcuts) {
                $shell = New-Object -ComObject WScript.Shell
                $targetPath = $shell.CreateShortcut($shortcut.FullName).TargetPath
                
                # Check if target exists
                if ($targetPath -and -not (Test-Path $targetPath)) {
                    Write-DesktopIconManagerDebug -Message "Found orphaned shortcut: $($shortcut.Name) -> $targetPath" -ForegroundColor Yellow
                    
                    # Only remove if it seems related to the package
                    if ($shortcut.BaseName -like "*$PackageName*") {
                        Remove-Item $shortcut.FullName -Force
                        Write-DesktopIconManagerDebug -Message "Removed orphaned shortcut: $($shortcut.Name)" -ForegroundColor Green
                        $orphanedCount++
                    }
                }
            }
        } catch {
            Write-DesktopIconManagerDebug -Message "Error checking orphaned shortcuts in $desktopPath`: $_" -ForegroundColor Red
        }
    }
    
    if ($orphanedCount -gt 0) {
        Write-DesktopIconManagerDebug -Message "Removed $orphanedCount orphaned shortcuts for: $PackageName" -ForegroundColor Green
    }
}

<#
.SYNOPSIS
    Batch desktop cleanup for multiple packages (used in Step102 scenario)
#>
function Invoke-BatchDesktopCleanup {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$PackageList
    )
    
    Write-DesktopIconManagerDebug -Message "Starting batch desktop cleanup for $($PackageList.Count) packages" -ForegroundColor Cyan
    
    # Variables declaration
    $batchResults = @{
        TotalPackages = $PackageList.Count
        Processed = 0
        Successful = 0
        Failed = 0
        Results = @()
    }
    
    foreach ($packageName in $PackageList.Keys) {
        $packageInfo = $PackageList[$packageName]
        
        try {
            $result = Invoke-DesktopCleanupForPackage -PackageName $packageName -ExecutablePath $packageInfo.ExecutablePath -ScanKeywords $packageInfo.ScanKeywords -CategoryName $packageInfo.CategoryName
            
            $batchResults.Results += $result
            $batchResults.Processed++
            
            if ($result.Errors.Count -eq 0) {
                $batchResults.Successful++
            } else {
                $batchResults.Failed++
            }
            
        } catch {
            Write-DesktopIconManagerDebug -Message "Batch cleanup failed for ${packageName}: $_" -ForegroundColor Red
            $batchResults.Failed++
        }
    }
    
    Write-DesktopIconManagerDebug -Message "Batch desktop cleanup completed - Processed: $($batchResults.Processed), Successful: $($batchResults.Successful), Failed: $($batchResults.Failed)" -ForegroundColor Green
    
    return $batchResults
}

<#
.SYNOPSIS
    Writes a visible organizer message
#>
function Write-DesktopIconManagerInfo {
    param(
        [string]$Message,
        [ConsoleColor]$ForegroundColor = [ConsoleColor]::Gray
    )
    Write-Host "[DesktopIcons] $Message" -ForegroundColor $ForegroundColor
}

<#
.SYNOPSIS
    Splits a shortcut name or keyword into lowercase ASCII word tokens
.DESCRIPTION
    CamelCase, letter/digit boundaries and every non-alphanumeric character separate tokens,
    so "VSCodiumInsiders" gives vs|codium|insiders and "Google Chrome" gives google|chrome.
#>
function ConvertTo-DesktopMatchTokens {
    param(
        [string]$Text
    )

    $spaced = [regex]::Replace($Text, $script:DesktopTokenBoundaryPattern, ' ')
    return @([regex]::Split($spaced.ToLowerInvariant(), '[^a-z0-9]+') | Where-Object { $_ -ne '' })
}

<#
.SYNOPSIS
    Decodes \uXXXX escapes used by the keyword data (the file stays ASCII)
#>
function ConvertFrom-DesktopKeywordEscapes {
    param(
        [string]$Keyword
    )

    if ($Keyword -notmatch '\\u[0-9A-Fa-f]{4}') {
        return $Keyword
    }
    return [regex]::Replace($Keyword, '\\u([0-9A-Fa-f]{4})', {
        param($match)
        [string][char][Convert]::ToInt32($match.Groups[1].Value, 16)
    })
}

<#
.SYNOPSIS
    Builds (once per session) the keyword table that classifies shortcuts
.DESCRIPTION
    Sources, highest rank first: ApplicationsList package keys, names and desktop shortcut
    names (name and target match), package Exec names (target match only), then the
    DESKTOP_ORGANIZATION_CATEGORIES keywords. ASCII keywords match whole token runs;
    keywords of three characters or fewer must start the name. Non-ASCII keywords
    (Chinese names) match as substrings.
#>
function Get-DesktopKeywordTable {
    if ($null -ne $script:DesktopKeywordTableCache) {
        return $script:DesktopKeywordTableCache
    }

    $table = @{
        AsciiIndex    = @{}
        NonAscii      = New-Object System.Collections.ArrayList
        CategoryOrder = @{}
        Categories    = New-Object System.Collections.ArrayList
    }
    $categoryIndex = 0
    $categoryConfig = $null
    $categoryName = ''
    $groupName = ''
    $groupVar = $null
    $packageKey = ''
    $package = $null
    $packageCategory = ''
    $nameSignals = @()
    $shortcutConfig = $null
    $execName = ''
    $signal = ''
    $keyword = ''

    $addEntry = {
        param([string]$EntryCategory, [string]$EntryKeyword, [int]$EntryRank, [bool]$ForName, [bool]$ForTarget)
        $decoded = (ConvertFrom-DesktopKeywordEscapes -Keyword $EntryKeyword).Trim()
        if ([string]::IsNullOrWhiteSpace($decoded)) {
            return
        }
        $entry = @{
            Category     = $EntryCategory
            Keyword      = $decoded
            KeywordLower = $decoded.ToLowerInvariant()
            Tokens       = @()
            Score        = 0
            Short        = $false
            Rank         = $EntryRank
            Order        = [int]$table.CategoryOrder[$EntryCategory]
            Name         = $ForName
            Target       = $ForTarget
        }
        if ($decoded -match '[^\x00-\x7F]') {
            $entry.Score = ($decoded -replace '\s', '').Length
            [void]$table.NonAscii.Add($entry)
            return
        }
        $entryTokens = @(ConvertTo-DesktopMatchTokens -Text $decoded)
        if ($entryTokens.Count -eq 0) {
            return
        }
        $entry.Tokens = $entryTokens
        $entry.Score = ($entryTokens -join '').Length
        $entry.Short = ($entry.Score -le $script:DesktopShortKeywordLength)
        if (-not $table.AsciiIndex.ContainsKey($entryTokens[0])) {
            $table.AsciiIndex[$entryTokens[0]] = New-Object System.Collections.ArrayList
        }
        [void]$table.AsciiIndex[$entryTokens[0]].Add($entry)
    }

    foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
        $categoryName = [string]$categoryConfig['DesktopCategory']
        if (-not [string]::IsNullOrWhiteSpace($categoryName) -and -not $table.CategoryOrder.ContainsKey($categoryName)) {
            $table.CategoryOrder[$categoryName] = $categoryIndex
            [void]$table.Categories.Add($categoryName)
            $categoryIndex++
        }
    }

    foreach ($groupName in $Global:DESKTOP_ORGANIZATION_PACKAGE_GROUPS) {
        $groupVar = Get-Variable -Name $groupName -Scope Global -ErrorAction SilentlyContinue
        if ($null -eq $groupVar -or -not ($groupVar.Value -is [System.Collections.IDictionary])) {
            continue
        }
        foreach ($packageKey in @($groupVar.Value.Keys)) {
            $package = $groupVar.Value[$packageKey]
            if (-not ($package -is [System.Collections.IDictionary])) {
                continue
            }
            $packageCategory = [string]$package['DesktopCategory']
            if (-not $table.CategoryOrder.ContainsKey($packageCategory)) {
                continue
            }
            $nameSignals = @([string]$packageKey, [string]$package['Name'])
            foreach ($shortcutConfig in @($package['DesktopShortcuts'])) {
                if ($shortcutConfig -is [System.Collections.IDictionary] -and $shortcutConfig['Name']) {
                    $nameSignals += [string]$shortcutConfig['Name']
                }
            }
            foreach ($signal in ($nameSignals | Select-Object -Unique)) {
                & $addEntry $packageCategory $signal 0 $true $true
            }
            $execName = [string]$package['Exec']
            if (-not [string]::IsNullOrWhiteSpace($execName)) {
                & $addEntry $packageCategory ([System.IO.Path]::GetFileNameWithoutExtension($execName)) 0 $false $true
            }
        }
    }

    foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
        $categoryName = [string]$categoryConfig['DesktopCategory']
        foreach ($keyword in @($categoryConfig['AdditionalKeywords'])) {
            & $addEntry $categoryName ([string]$keyword) 1 $true $true
        }
    }

    $script:DesktopKeywordTableCache = $table
    return $table
}

<#
.SYNOPSIS
    Finds the best category for a text (shortcut name or target file name)
.OUTPUTS
    Hashtable: Best (winning keyword entry or $null) and Categories (every matched category)
#>
function Find-DesktopCategoryMatch {
    param(
        [string]$Text,
        [ValidateSet('Name', 'Target')]
        [string]$Mode
    )

    $result = @{ Best = $null; Categories = @{} }
    $table = Get-DesktopKeywordTable
    $tokens = @(ConvertTo-DesktopMatchTokens -Text $Text)
    $textLower = $Text.ToLowerInvariant()
    $position = 0
    $bucket = $null
    $entry = $null
    $keywordTokens = @()
    $offset = 0
    $matched = $false
    $candidates = New-Object System.Collections.ArrayList

    for ($position = 0; $position -lt $tokens.Count; $position++) {
        $bucket = $table.AsciiIndex[$tokens[$position]]
        if ($null -eq $bucket) {
            continue
        }
        foreach ($entry in $bucket) {
            if (-not $entry[$Mode]) {
                continue
            }
            if ($entry.Short -and $position -ne 0) {
                continue
            }
            $keywordTokens = $entry.Tokens
            if ($position + $keywordTokens.Count -gt $tokens.Count) {
                continue
            }
            $matched = $true
            for ($offset = 1; $offset -lt $keywordTokens.Count; $offset++) {
                if ($tokens[$position + $offset] -ne $keywordTokens[$offset]) {
                    $matched = $false
                    break
                }
            }
            if ($matched) {
                [void]$candidates.Add($entry)
            }
        }
    }

    foreach ($entry in $table.NonAscii) {
        if ($entry[$Mode] -and $textLower.Contains($entry.KeywordLower)) {
            [void]$candidates.Add($entry)
        }
    }

    foreach ($entry in $candidates) {
        $result.Categories[$entry.Category] = $true
        if ($null -eq $result.Best -or
            $entry.Score -gt $result.Best.Score -or
            ($entry.Score -eq $result.Best.Score -and $entry.Rank -lt $result.Best.Rank) -or
            ($entry.Score -eq $result.Best.Score -and $entry.Rank -eq $result.Best.Rank -and $entry.Order -lt $result.Best.Order)) {
            $result.Best = $entry
        }
    }

    return $result
}

<#
.SYNOPSIS
    Reads one desktop shortcut (.lnk/.url/.appref-ms) without changing it
.OUTPUTS
    Hashtable with Path, Name, BaseName, Extension, TargetPath, Arguments, WorkingDirectory,
    IconLocation, Url, Hidden, LastWriteTimeUtc and State (valid, broken or unreadable)
#>
function Get-DesktopShortcutInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [object]$Shell
    )

    $fileInfo = New-Object System.IO.FileInfo($Path)
    $info = @{
        Path             = $Path
        Name             = $fileInfo.Name
        BaseName         = [System.IO.Path]::GetFileNameWithoutExtension($fileInfo.Name)
        Extension        = $fileInfo.Extension.ToLowerInvariant()
        TargetPath       = ''
        Arguments        = ''
        WorkingDirectory = ''
        IconLocation     = ''
        Url              = ''
        Hidden           = [bool]($fileInfo.Attributes -band [System.IO.FileAttributes]::Hidden)
        LastWriteTimeUtc = $fileInfo.LastWriteTimeUtc
        State            = 'valid'
    }
    $shortcut = $null
    $expandedTarget = ''
    $urlLine = $null

    if ($info.Extension -eq '.lnk') {
        try {
            $shortcut = $Shell.CreateShortcut($Path)
            $info.TargetPath = [string]$shortcut.TargetPath
            $info.Arguments = [string]$shortcut.Arguments
            $info.WorkingDirectory = [string]$shortcut.WorkingDirectory
            $info.IconLocation = [string]$shortcut.IconLocation
        } catch {
            $info.State = 'unreadable'
            return $info
        }
        if (-not [string]::IsNullOrWhiteSpace($info.TargetPath)) {
            $expandedTarget = [Environment]::ExpandEnvironmentVariables($info.TargetPath)
            if (-not (Test-Path -LiteralPath $expandedTarget)) {
                $info.State = 'broken'
            }
        }
    } elseif ($info.Extension -eq '.url') {
        try {
            $shortcut = $Shell.CreateShortcut($Path)
            $info.Url = [string]$shortcut.TargetPath
        } catch {
            $info.Url = ''
        }
        if ([string]::IsNullOrWhiteSpace($info.Url)) {
            $urlLine = Select-String -LiteralPath $Path -Pattern '^\s*URL\s*=\s*(.+)$' -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -ne $urlLine) {
                $info.Url = $urlLine.Matches[0].Groups[1].Value.Trim()
            }
        }
        if ([string]::IsNullOrWhiteSpace($info.Url)) {
            $info.State = 'broken'
        }
    }

    return $info
}

<#
.SYNOPSIS
    Tests whether two shortcut files launch the same thing
#>
function Test-DesktopShortcutEquivalent {
    param(
        [hashtable]$First,
        [hashtable]$Second
    )

    $firstBytes = $null
    $secondBytes = $null

    if ($First.Extension -ne $Second.Extension) {
        return $false
    }
    if ($First.Extension -eq '.lnk') {
        return ($First.TargetPath -eq $Second.TargetPath -and
                $First.Arguments -eq $Second.Arguments -and
                $First.WorkingDirectory -eq $Second.WorkingDirectory -and
                $First.IconLocation -eq $Second.IconLocation)
    }
    if ($First.Extension -eq '.url') {
        return ($First.Url -eq $Second.Url)
    }
    $firstBytes = [System.IO.File]::ReadAllBytes($First.Path)
    $secondBytes = [System.IO.File]::ReadAllBytes($Second.Path)
    return ([System.Convert]::ToBase64String($firstBytes) -eq [System.Convert]::ToBase64String($secondBytes))
}

<#
.SYNOPSIS
    Classifies one shortcut: pinned, category-link, broken, unmatched or a category
.OUTPUTS
    Hashtable: Kind, Category, Reason, SupportedCategories
#>
function Get-DesktopShortcutClassification {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Info
    )

    $table = Get-DesktopKeywordTable
    $classification = @{
        Kind                = 'unmatched'
        Category            = ''
        Reason              = ''
        SupportedCategories = @{}
    }
    $nameMatch = $null
    $targetMatch = $null
    $targetName = ''
    $scheme = ''
    $categoryKey = ''
    $targetFullPath = ''
    $pathRule = $null
    $baseDirectoryPrefix = Join-Path $Global:DESKTOP_BACKUP_DIR ''

    if ($Global:DESKTOP_ORGANIZATION_KEEP_ON_DESKTOP -contains $Info.BaseName) {
        $classification.Kind = 'pinned'
        $classification.Reason = 'keep-on-desktop list'
        return $classification
    }
    if ($table.CategoryOrder.ContainsKey($Info.BaseName) -or
        ($Info.TargetPath -and $Info.TargetPath.StartsWith($baseDirectoryPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        $classification.Kind = 'category-link'
        return $classification
    }
    if ($Info.State -ne 'valid') {
        $classification.Kind = $Info.State
        $classification.Reason = $Info.TargetPath
        return $classification
    }

    $nameMatch = Find-DesktopCategoryMatch -Text $Info.BaseName -Mode 'Name'
    foreach ($categoryKey in $nameMatch.Categories.Keys) {
        $classification.SupportedCategories[$categoryKey] = $true
    }

    if ($Info.TargetPath) {
        $targetName = [System.IO.Path]::GetFileNameWithoutExtension([Environment]::ExpandEnvironmentVariables($Info.TargetPath))
        if ($targetName -and ($Global:DESKTOP_ORGANIZATION_GENERIC_TARGET_HOSTS -notcontains $targetName)) {
            $targetMatch = Find-DesktopCategoryMatch -Text $targetName -Mode 'Target'
            foreach ($categoryKey in $targetMatch.Categories.Keys) {
                $classification.SupportedCategories[$categoryKey] = $true
            }
        }
    }

    if ($null -ne $nameMatch.Best) {
        $classification.Kind = 'category'
        $classification.Category = $nameMatch.Best.Category
        $classification.Reason = "name keyword '$($nameMatch.Best.Keyword)'"
        return $classification
    }

    if ($Info.Url -match '^([A-Za-z][A-Za-z0-9+.\-]*):') {
        $scheme = $Matches[1].ToLowerInvariant()
        if ($Global:DESKTOP_ORGANIZATION_URL_SCHEME_CATEGORIES.ContainsKey($scheme)) {
            $classification.Kind = 'category'
            $classification.Category = $Global:DESKTOP_ORGANIZATION_URL_SCHEME_CATEGORIES[$scheme]
            $classification.Reason = "url scheme '$scheme'"
            $classification.SupportedCategories[$classification.Category] = $true
            return $classification
        }
    }

    if ($null -ne $targetMatch -and $null -ne $targetMatch.Best) {
        $classification.Kind = 'category'
        $classification.Category = $targetMatch.Best.Category
        $classification.Reason = "target keyword '$($targetMatch.Best.Keyword)'"
        return $classification
    }

    if ($Info.TargetPath) {
        $targetFullPath = [Environment]::ExpandEnvironmentVariables($Info.TargetPath)
        foreach ($pathRule in $Global:DESKTOP_ORGANIZATION_TARGET_PATH_CATEGORIES) {
            if ($targetFullPath.IndexOf($pathRule.Fragment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $classification.Kind = 'category'
                $classification.Category = $pathRule.Category
                $classification.Reason = "target folder '$($pathRule.Fragment)'"
                $classification.SupportedCategories[$pathRule.Category] = $true
                break
            }
        }
    }

    return $classification
}

<#
.SYNOPSIS
    Returns the desktops the organizer reads: the active user desktop (OneDrive-redirected
    when Known Folder Move is on) and the all-users Public desktop
#>
function Get-DesktopOrganizationPaths {
    $paths = New-Object System.Collections.ArrayList
    $candidate = ''

    foreach ($candidate in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'))) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate) -and -not $paths.Contains($candidate)) {
            [void]$paths.Add($candidate)
        }
    }
    return @($paths)
}

<#
.SYNOPSIS
    Lists shortcut files (.lnk/.url/.appref-ms) directly inside a directory
#>
function Get-DesktopShortcutFiles {
    param(
        [string]$Directory
    )

    $files = @()
    $filePath = ''

    if (-not (Test-Path -LiteralPath $Directory)) {
        return @()
    }
    try {
        foreach ($filePath in [System.IO.Directory]::GetFiles($Directory)) {
            if ($Global:DESKTOP_SHORTCUT_EXTENSIONS -contains [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()) {
                $files += $filePath
            }
        }
    } catch {
        Write-DesktopIconManagerInfo -Message "Cannot list '$Directory': $($_.Exception.Message)" -ForegroundColor Yellow
    }
    return $files
}

<#
.SYNOPSIS
    Tests whether a shortcut is a stable Chrome launcher (the one browser shortcut kept on the desktop)
#>
function Test-DesktopKeptBrowserShortcut {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Info
    )

    $target = ''
    $channelDirectory = ''
    $tokens = @()

    if ($Info.Extension -ne '.lnk' -or [string]::IsNullOrWhiteSpace($Info.TargetPath)) {
        return $false
    }
    $target = [Environment]::ExpandEnvironmentVariables($Info.TargetPath)
    if ([System.IO.Path]::GetFileName($target) -ne $Global:DESKTOP_ORGANIZATION_KEEP_BROWSER_EXE) {
        return $false
    }
    # <...>\Chrome Beta\Application\chrome.exe: the channel is the folder above Application
    $channelDirectory = Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $target))
    $tokens = @(ConvertTo-DesktopMatchTokens -Text $Info.BaseName) + @(ConvertTo-DesktopMatchTokens -Text $channelDirectory)
    return (@($tokens | Where-Object { $Global:DESKTOP_ORGANIZATION_KEEP_BROWSER_EXCLUDED_TOKENS -contains $_ }).Count -eq 0)
}

<#
.SYNOPSIS
    Returns a path in Directory for Name that does not exist yet ("name (2).ext" on collision)
#>
function Get-DesktopFreeDestination {
    param(
        [string]$Directory,
        [string]$Name
    )

    $candidate = Join-Path $Directory $Name
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($Name)
    $extension = [System.IO.Path]::GetExtension($Name)
    $index = 2

    while (Test-Path -LiteralPath $candidate) {
        $candidate = Join-Path $Directory ('{0} ({1}){2}' -f $baseName, $index, $extension)
        $index++
    }
    return $candidate
}

<#
.SYNOPSIS
    Moves real files left on the desktops into the Documents folder
.DESCRIPTION
    Folders, shortcuts, category folder links, hidden/system entries and desktop.ini stay. A name already
    taken in Documents gets a " (n)" suffix. Every move is recorded for undo; nothing is deleted.
.OUTPUTS
    Hashtable: Moved, Messages
#>
function Move-DesktopLooseItemsToDocuments {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Context,

        [bool]$DryRun = $false
    )

    $result = @{ Moved = 0; Messages = New-Object System.Collections.ArrayList }
    $documentsDirectory = [string]$Global:DESKTOP_ORGANIZATION_DOCUMENTS_DIR
    $skipAttributes = [System.IO.FileAttributes]::Hidden -bor [System.IO.FileAttributes]::System -bor [System.IO.FileAttributes]::ReparsePoint
    $desktopPath = ''
    $entry = $null
    $destination = ''
    $reservedDestinations = @{}

    if ([string]::IsNullOrWhiteSpace($documentsDirectory) -or -not (Test-Path -LiteralPath $documentsDirectory -PathType Container)) {
        [void]$result.Messages.Add(('Documents folder not found; desktop files left in place: {0}' -f $documentsDirectory))
        return $result
    }
    foreach ($desktopPath in @(Get-DesktopOrganizationPaths)) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $desktopPath -Force -ErrorAction SilentlyContinue)) {
            if ($entry.Attributes -band $skipAttributes) {
                continue
            }
            if ($Global:DESKTOP_ORGANIZATION_LOOSE_ITEM_EXCLUDED -contains $entry.Name.ToLowerInvariant()) {
                continue
            }
            if ($entry.PSIsContainer -or $Global:DESKTOP_SHORTCUT_EXTENSIONS -contains $entry.Extension.ToLowerInvariant()) {
                continue
            }
            $destination = Get-DesktopFreeDestination -Directory $documentsDirectory -Name $entry.Name
            while ($reservedDestinations.ContainsKey($destination.ToLowerInvariant())) {
                $destination = Get-DesktopFreeDestination -Directory $documentsDirectory -Name ('{0}_{1}' -f $reservedDestinations.Count, $entry.Name)
            }
            $reservedDestinations[$destination.ToLowerInvariant()] = $true
            if ($DryRun) {
                [void]$result.Messages.Add(('move to Documents: {0} -> {1}' -f $entry.FullName, $destination))
                $result.Moved++
                continue
            }
            try {
                if ($entry.PSIsContainer) {
                    [System.IO.Directory]::Move($entry.FullName, $destination)
                    Add-DesktopOrganizationRecord -Context $Context -Action 'move-dir' -Source $entry.FullName -Destination $destination -Category '' -Reason 'desktop folder to Documents'
                } else {
                    [System.IO.File]::Move($entry.FullName, $destination)
                    Add-DesktopOrganizationRecord -Context $Context -Action 'move' -Source $entry.FullName -Destination $destination -Category '' -Reason 'desktop file to Documents'
                }
                [void]$result.Messages.Add(('moved to Documents: {0} -> {1}' -f $entry.FullName, $destination))
                $result.Moved++
            } catch {
                [void]$result.Messages.Add(('could not move to Documents: {0}: {1}' -f $entry.FullName, $_.Exception.Message))
            }
        }
    }
    return $result
}

<#
.SYNOPSIS
    Scans desktops and category folders and returns what the organizer would do
.DESCRIPTION
    Desktop shortcuts that match a category are planned as a move (or a copy for browsers
    kept on the desktop). Shortcuts already inside a category folder are planned as a refile
    only when nothing supports their current folder and a better category exists. At most one
    differing shortcut is planned per destination path (see Resolve-DesktopPlanCollisions).
#>
function Get-DesktopOrganizationPlan {
    param(
        [array]$SpecificCategories = @()
    )

    $table = Get-DesktopKeywordTable
    $shell = New-Object -ComObject WScript.Shell
    $plan = @{
        Items         = New-Object System.Collections.ArrayList
        Unmatched     = New-Object System.Collections.ArrayList
        Broken        = New-Object System.Collections.ArrayList
        Pinned        = New-Object System.Collections.ArrayList
        Conflicts     = New-Object System.Collections.ArrayList
        DesktopPaths  = @(Get-DesktopOrganizationPaths)
    }
    $desktopPath = ''
    $filePath = ''
    $info = $null
    $classification = $null
    $mode = ''
    $categoryName = ''
    $categoryDirectory = ''
    $keptBrowserPath = ''

    foreach ($desktopPath in $plan.DesktopPaths) {
        foreach ($filePath in (Get-DesktopShortcutFiles -Directory $desktopPath)) {
            $info = Get-DesktopShortcutInfo -Path $filePath -Shell $shell
            if ($info.Hidden) {
                continue
            }
            $classification = Get-DesktopShortcutClassification -Info $info
            switch ($classification.Kind) {
                'pinned' { [void]$plan.Pinned.Add(@{ Info = $info; Reason = $classification.Reason }) }
                'category-link' { }
                'broken' { [void]$plan.Broken.Add(@{ Info = $info; Reason = $classification.Reason }) }
                'unreadable' { [void]$plan.Broken.Add(@{ Info = $info; Reason = 'unreadable' }) }
                'unmatched' {
                    if ($SpecificCategories.Count -gt 0 -and $SpecificCategories -notcontains $Global:DESKTOP_CATEGORY_OTHER_APPS) {
                        [void]$plan.Unmatched.Add(@{ Info = $info; Reason = '' })
                        continue
                    }
                    [void]$plan.Items.Add(@{
                        Info     = $info
                        Category = $Global:DESKTOP_CATEGORY_OTHER_APPS
                        Reason   = 'no category matched'
                        Mode     = 'move'
                        From     = $desktopPath
                    })
                }
                'category' {
                    if ($SpecificCategories.Count -gt 0 -and $SpecificCategories -notcontains $classification.Category) {
                        continue
                    }
                    $mode = 'move'
                    if ($classification.Category -eq $Global:DESKTOP_CATEGORY_BROWSERS -and -not $keptBrowserPath -and
                        (Test-DesktopKeptBrowserShortcut -Info $info)) {
                        $mode = 'copy'
                        $keptBrowserPath = $info.Path
                    }
                    [void]$plan.Items.Add(@{
                        Info     = $info
                        Category = $classification.Category
                        Reason   = $classification.Reason
                        Mode     = $mode
                        From     = $desktopPath
                    })
                }
            }
        }
    }

    foreach ($categoryName in $table.Categories) {
        if ($Global:DESKTOP_ORGANIZATION_REFILE_EXCLUDED -contains $categoryName) {
            continue
        }
        $categoryDirectory = Join-Path $Global:DESKTOP_BACKUP_DIR $categoryName
        foreach ($filePath in (Get-DesktopShortcutFiles -Directory $categoryDirectory)) {
            $info = Get-DesktopShortcutInfo -Path $filePath -Shell $shell
            if ($info.State -ne 'valid' -or $info.Hidden) {
                continue
            }
            $classification = Get-DesktopShortcutClassification -Info $info
            if ($classification.Kind -ne 'category' -or $classification.Category -eq $categoryName) {
                continue
            }
            if ($classification.SupportedCategories.ContainsKey($categoryName)) {
                continue
            }
            if ($SpecificCategories.Count -gt 0 -and $SpecificCategories -notcontains $classification.Category) {
                continue
            }
            [void]$plan.Items.Add(@{
                Info     = $info
                Category = $classification.Category
                Reason   = $classification.Reason
                Mode     = 'refile'
                From     = $categoryDirectory
            })
        }
    }

    Resolve-DesktopPlanCollisions -Plan $plan
    return $plan
}

<#
.SYNOPSIS
    Keeps at most one differing shortcut per destination path in the plan
.DESCRIPTION
    Planned items that would land on the same category file are grouped. The newest one is kept
    (scan order breaks ties: user desktop, Public desktop, category folders). Items identical to
    the kept one follow it in the plan; every other item becomes a conflict and stays where it is.
#>
function Resolve-DesktopPlanCollisions {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Plan
    )

    $groups = New-Object System.Collections.Specialized.OrderedDictionary
    $resolvedItems = New-Object System.Collections.ArrayList
    $item = $null
    $destinationPath = ''
    $destinationKey = ''
    $groupItems = @()
    $keptItem = $null

    foreach ($item in $Plan.Items) {
        $destinationKey = (Join-Path (Join-Path $Global:DESKTOP_BACKUP_DIR $item.Category) $item.Info.Name).ToLowerInvariant()
        if (-not $groups.Contains($destinationKey)) {
            $groups.Add($destinationKey, (New-Object System.Collections.ArrayList))
        }
        [void]$groups[$destinationKey].Add($item)
    }

    foreach ($destinationKey in @($groups.Keys)) {
        $groupItems = @($groups[$destinationKey])
        $keptItem = $groupItems[0]
        foreach ($item in $groupItems) {
            if ($item.Info.LastWriteTimeUtc -gt $keptItem.Info.LastWriteTimeUtc) {
                $keptItem = $item
            }
        }
        [void]$resolvedItems.Add($keptItem)
        $destinationPath = Join-Path (Join-Path $Global:DESKTOP_BACKUP_DIR $keptItem.Category) $keptItem.Info.Name
        foreach ($item in $groupItems) {
            if ([object]::ReferenceEquals($item, $keptItem)) {
                continue
            }
            if (Test-DesktopShortcutEquivalent -First $item.Info -Second $keptItem.Info) {
                [void]$resolvedItems.Add($item)
            } else {
                [void]$Plan.Conflicts.Add(@{
                    Item        = $item
                    Destination = $destinationPath
                    Reason      = ('{0} is filed under this name instead (newer or found first)' -f $keptItem.Info.Path)
                })
            }
        }
    }

    $Plan.Items = $resolvedItems
}

<#
.SYNOPSIS
    Appends one undo record to the run context
#>
function Add-DesktopOrganizationRecord {
    param(
        [hashtable]$Context,
        [string]$Action,
        [string]$Source,
        [string]$Destination,
        [string]$Category,
        [string]$Reason
    )

    [void]$Context.Records.Add([ordered]@{
        Action      = $Action
        Source      = $Source
        Destination = $Destination
        Category    = $Category
        Reason      = $Reason
        Time        = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    })
}

<#
.SYNOPSIS
    Moves an existing file out of the way into the run's displaced folder (never deletes)
#>
function Move-DesktopFileToDisplaced {
    param(
        [hashtable]$Context,
        [string]$Path,
        [string]$Category,
        [string]$Reason
    )

    $displacedDirectory = Join-Path $Global:DESKTOP_ORGANIZER_DISPLACED_DIR $Context.RunId
    $displacedPath = Join-Path $displacedDirectory ('{0:D3}_{1}' -f $Context.Records.Count, [System.IO.Path]::GetFileName($Path))

    if (-not (Test-Path -LiteralPath $displacedDirectory)) {
        New-Item -ItemType Directory -Path $displacedDirectory -Force | Out-Null
    }
    [System.IO.File]::Move($Path, $displacedPath)
    Add-DesktopOrganizationRecord -Context $Context -Action 'displace' -Source $Path -Destination $displacedPath -Category $Category -Reason $Reason
    return $displacedPath
}

<#
.SYNOPSIS
    Ensures the desktop link to a category folder exists
.DESCRIPTION
    Uses a directory symbolic link named "<Category>.lnk" (as CommonFunc does) and falls back
    to a regular shortcut when symbolic links are not permitted.
#>
function Set-DesktopCategoryLink {
    param(
        [hashtable]$Context,
        [string]$CategoryName,
        [string]$CategoryDirectory
    )

    $userDesktopPath = [Environment]::GetFolderPath('Desktop')
    $desktopCategoryPath = Join-Path $userDesktopPath ('{0}.lnk' -f $CategoryName)
    $shell = $null
    $shortcut = $null

    if (Test-Path -LiteralPath $desktopCategoryPath) {
        return $false
    }
    try {
        New-Item -ItemType SymbolicLink -Path $desktopCategoryPath -Target $CategoryDirectory -ErrorAction Stop | Out-Null
        Add-DesktopOrganizationRecord -Context $Context -Action 'link' -Source $CategoryDirectory -Destination $desktopCategoryPath -Category $CategoryName -Reason 'symbolic link'
    } catch {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($desktopCategoryPath)
        $shortcut.TargetPath = $CategoryDirectory
        $shortcut.Save()
        Add-DesktopOrganizationRecord -Context $Context -Action 'link' -Source $CategoryDirectory -Destination $desktopCategoryPath -Category $CategoryName -Reason 'shortcut'
    }
    return $true
}

<#
.SYNOPSIS
    Organizes the planned shortcuts of one category
.DESCRIPTION
    Creates the category folder and its desktop link when missing, then moves the shortcuts.
#>
function Invoke-CategoryOrganization {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CategoryName,

        [Parameter(Mandatory = $true)]
        [array]$Items,

        [Parameter(Mandatory = $true)]
        [hashtable]$Context
    )

    $categoryResult = @{
        CategoryName    = $CategoryName
        ShortcutsMoved  = 0
        CategoryCreated = $false
        Errors          = @()
    }
    $categoryDirectory = Join-Path $Global:DESKTOP_BACKUP_DIR $CategoryName

    try {
        if (-not (Test-Path -LiteralPath $categoryDirectory)) {
            New-Item -ItemType Directory -Path $categoryDirectory -Force | Out-Null
            Add-DesktopOrganizationRecord -Context $Context -Action 'mkdir' -Source '' -Destination $categoryDirectory -Category $CategoryName -Reason 'category folder'
            $categoryResult.CategoryCreated = $true
        }
        [void](Set-DesktopCategoryLink -Context $Context -CategoryName $CategoryName -CategoryDirectory $categoryDirectory)
        $categoryResult.ShortcutsMoved = Move-ShortcutsToCategory -CategoryName $CategoryName -Items $Items -CategoryDirectory $categoryDirectory -Context $Context
    } catch {
        $categoryResult.Errors += "Category organization failed for ${CategoryName}: $($_.Exception.Message)"
    }

    return $categoryResult
}

<#
.SYNOPSIS
    Decides what happens to one planned item, given what is already at its destination
.DESCRIPTION
    place: the destination is free. unchanged: an identical copy is already filed (copy mode).
    duplicate: an identical shortcut is already filed, so the desktop one is displaced (move mode).
    replace: a different, older shortcut is displaced by this newer one.
    conflict: a refile onto an existing name, or a different shortcut that is not older; it stays.
.OUTPUTS
    Hashtable: Action, Destination, Reason
#>
function Get-DesktopPlacementDecision {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Item,

        [Parameter(Mandatory = $true)]
        [string]$CategoryDirectory,

        [Parameter(Mandatory = $true)]
        [object]$Shell
    )

    $info = $Item.Info
    $decision = @{
        Action      = 'place'
        Destination = Join-Path $CategoryDirectory $info.Name
        Reason      = ''
    }
    $destinationInfo = $null
    $isEquivalent = $false

    if (-not [System.IO.File]::Exists($decision.Destination)) {
        return $decision
    }
    $destinationInfo = Get-DesktopShortcutInfo -Path $decision.Destination -Shell $Shell
    $isEquivalent = Test-DesktopShortcutEquivalent -First $info -Second $destinationInfo
    if ($Item.Mode -eq 'refile') {
        $decision.Action = 'conflict'
        $decision.Reason = ('same name already in {0}, identical={1}' -f $Item.Category, $isEquivalent)
    } elseif ($isEquivalent -and $Item.Mode -eq 'copy') {
        $decision.Action = 'unchanged'
    } elseif ($isEquivalent) {
        $decision.Action = 'duplicate'
    } elseif ($info.LastWriteTimeUtc -le $destinationInfo.LastWriteTimeUtc) {
        $decision.Action = 'conflict'
        $decision.Reason = ('a different, not older {0} is already in {1}' -f $info.Name, $Item.Category)
    } else {
        $decision.Action = 'replace'
    }
    return $decision
}

<#
.SYNOPSIS
    Moves (or copies, for browsers kept on the desktop) planned shortcuts into a category folder
.DESCRIPTION
    Applies Get-DesktopPlacementDecision to each item and records every change for undo.
#>
function Move-ShortcutsToCategory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CategoryName,

        [Parameter(Mandatory = $true)]
        [array]$Items,

        [Parameter(Mandatory = $true)]
        [string]$CategoryDirectory,

        [Parameter(Mandatory = $true)]
        [hashtable]$Context
    )

    $movedCount = 0
    $item = $null
    $info = $null
    $destinationPath = ''
    $decision = $null
    $displacedPath = ''

    foreach ($item in $Items) {
        $info = $item.Info
        $destinationPath = Join-Path $CategoryDirectory $info.Name
        try {
            $decision = Get-DesktopPlacementDecision -Item $item -CategoryDirectory $CategoryDirectory -Shell $Context.Shell
            if ($decision.Action -eq 'conflict') {
                [void]$Context.Conflicts.Add(@{ Item = $item; Destination = $destinationPath; Reason = $decision.Reason })
                continue
            }
            if ($decision.Action -eq 'unchanged') {
                [void]$Context.Unchanged.Add(@{ Item = $item; Destination = $destinationPath })
                continue
            }
            if ($decision.Action -eq 'duplicate') {
                $displacedPath = Move-DesktopFileToDisplaced -Context $Context -Path $info.Path -Category $CategoryName -Reason 'identical shortcut already filed'
                [void]$Context.Done.Add(@{ Item = $item; Destination = $displacedPath; Label = 'duplicate' })
                $movedCount++
                continue
            }
            if ($decision.Action -eq 'replace') {
                [void](Move-DesktopFileToDisplaced -Context $Context -Path $destinationPath -Category $CategoryName -Reason 'replaced by a newer shortcut')
            }
            if ($item.Mode -eq 'copy') {
                [System.IO.File]::Copy($info.Path, $destinationPath, $false)
                Add-DesktopOrganizationRecord -Context $Context -Action 'copy' -Source $info.Path -Destination $destinationPath -Category $CategoryName -Reason $item.Reason
            } else {
                [System.IO.File]::Move($info.Path, $destinationPath)
                Add-DesktopOrganizationRecord -Context $Context -Action 'move' -Source $info.Path -Destination $destinationPath -Category $CategoryName -Reason $item.Reason
            }
            [void]$Context.Done.Add(@{ Item = $item; Destination = $destinationPath })
            $movedCount++
        } catch {
            [void]$Context.Failed.Add(@{ Item = $item; Destination = $destinationPath; Error = $_.Exception.Message })
        }
    }

    return $movedCount
}

<#
.SYNOPSIS
    Returns the desktop shortcuts no category matched
#>
function Get-UnmatchedShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Plan
    )

    $unmatchedShortcuts = @()
    $entry = $null

    foreach ($entry in $Plan.Unmatched) {
        $unmatchedShortcuts += @{
            Name        = $entry.Info.Name
            FullPath    = $entry.Info.Path
            TargetPath  = if ($entry.Info.TargetPath) { $entry.Info.TargetPath } else { $entry.Info.Url }
            DesktopPath = Split-Path -Parent $entry.Info.Path
        }
    }
    return $unmatchedShortcuts
}

<#
.SYNOPSIS
    Prints the shortcuts that no category matched
#>
function Show-UnmatchedShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [array]$UnmatchedShortcuts
    )

    $shortcut = $null

    Write-DesktopIconManagerInfo -Message "Unmatched desktop shortcuts ($($UnmatchedShortcuts.Count)); add keywords to DESKTOP_ORGANIZATION_CATEGORIES to file them:" -ForegroundColor Yellow
    foreach ($shortcut in $UnmatchedShortcuts) {
        Write-DesktopIconManagerInfo -Message "  - $($shortcut.FullPath) -> $($shortcut.TargetPath)" -ForegroundColor White
    }
}

<#
.SYNOPSIS
    Prints every category folder and its shortcuts
#>
function Show-OrganizationSummary {
    $table = Get-DesktopKeywordTable
    $categoryName = ''
    $categoryDirectory = ''
    $shortcutFiles = @()

    Write-DesktopIconManagerInfo -Message "Category folders under $($Global:DESKTOP_BACKUP_DIR):" -ForegroundColor Cyan
    foreach ($categoryName in $table.Categories) {
        $categoryDirectory = Join-Path $Global:DESKTOP_BACKUP_DIR $categoryName
        if (-not (Test-Path -LiteralPath $categoryDirectory)) {
            continue
        }
        $shortcutFiles = @(Get-DesktopShortcutFiles -Directory $categoryDirectory)
        Write-DesktopIconManagerInfo -Message ("  {0} ({1}): {2}" -f $categoryName, $shortcutFiles.Count, ((@($shortcutFiles | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_) })) -join ', ')) -ForegroundColor Green
    }
}

<#
.SYNOPSIS
    Validates the DESKTOP_ORGANIZATION_CATEGORIES configuration
#>
function Test-OrganizationCategories {
    Write-DesktopIconManagerDebug -Message "Validating organization categories..." -ForegroundColor Cyan

    $validationErrors = @()
    $categoryConfig = $null
    $seenCategories = @{}
    $validationError = ''

    if (-not $Global:DESKTOP_ORGANIZATION_CATEGORIES -or @($Global:DESKTOP_ORGANIZATION_CATEGORIES).Count -eq 0) {
        $validationErrors += "DESKTOP_ORGANIZATION_CATEGORIES is empty or not defined"
    } else {
        foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
            if (-not $categoryConfig.ContainsKey("DesktopCategory") -or -not $categoryConfig['DesktopCategory']) {
                $validationErrors += "Category configuration missing DesktopCategory"
                continue
            }
            if ($seenCategories.ContainsKey($categoryConfig['DesktopCategory'])) {
                $validationErrors += "Category '$($categoryConfig['DesktopCategory'])' is defined twice"
            }
            $seenCategories[$categoryConfig['DesktopCategory']] = $true
            if ($categoryConfig['DesktopCategory'] -ne $Global:DESKTOP_CATEGORY_OTHER_APPS -and (-not $categoryConfig.ContainsKey("AdditionalKeywords") -or -not $categoryConfig['AdditionalKeywords'])) {
                $validationErrors += "Category '$($categoryConfig['DesktopCategory'])' missing AdditionalKeywords"
            }
        }
    }

    if ($validationErrors.Count -gt 0) {
        foreach ($validationError in $validationErrors) {
            Write-DesktopIconManagerInfo -Message "Invalid category configuration: $validationError" -ForegroundColor Red
        }
        return $false
    }

    Write-DesktopIconManagerDebug -Message "Validation completed successfully." -ForegroundColor Green
    return $true
}

<#
.SYNOPSIS
    Writes the undo manifest of one organizer run
#>
function Save-DesktopOrganizationManifest {
    param(
        [hashtable]$Context
    )

    $manifestPath = Join-Path $Global:DESKTOP_ORGANIZER_MANIFEST_DIR ('organize_{0}.json' -f $Context.RunId)
    $manifest = [ordered]@{
        RunId        = $Context.RunId
        CreatedAt    = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
        Computer     = $env:COMPUTERNAME
        User         = $env:USERNAME
        BaseDirectory = $Global:DESKTOP_BACKUP_DIR
        UndoneAt     = ''
        Entries      = @($Context.Records)
    }

    if (-not (Test-Path -LiteralPath $Global:DESKTOP_ORGANIZER_MANIFEST_DIR)) {
        New-Item -ItemType Directory -Path $Global:DESKTOP_ORGANIZER_MANIFEST_DIR -Force | Out-Null
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    return $manifestPath
}

<#
.SYNOPSIS
    Old program roots and the live roots they moved to (contract migrations: D: program dirs and
    superseded E: layouts), used to re-point shortcuts after a move
#>
function Get-DesktopRerootPairs {
    $pairs = @()
    $mapping = $null
    $oldRoot = ''

    if (-not (Get-Command Get-CnProgramDirectoryMappings -ErrorAction SilentlyContinue)) {
        return $pairs
    }
    foreach ($mapping in @(Get-CnProgramDirectoryMappings)) {
        if (-not $mapping.Target) {
            continue
        }
        foreach ($oldRoot in @(@($mapping.Legacy) + @($mapping.Superseded) | Where-Object { $_ })) {
            $pairs += [pscustomobject]@{ Old = ([string]$oldRoot).TrimEnd('\'); New = ([string]$mapping.Target).TrimEnd('\') }
        }
    }
    return $pairs
}

<#
.SYNOPSIS
    The path re-rooted from an old program root to its live root ('' when no pair applies);
    anything after the path (e.g. an icon index ",0") is kept
#>
function Get-DesktopReroutedPath {
    param(
        [string]$Path,
        [array]$Pairs
    )

    $expanded = ''
    $pair = $null

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ''
    }
    $expanded = [Environment]::ExpandEnvironmentVariables($Path)
    foreach ($pair in $Pairs) {
        if ($expanded -ieq $pair.Old -or $expanded.StartsWith($pair.Old + '\', [System.StringComparison]::OrdinalIgnoreCase) -or $expanded.StartsWith($pair.Old + ',', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $pair.New + $expanded.Substring($pair.Old.Length)
        }
    }
    return ''
}

<#
.SYNOPSIS
    Moves a directory link (or folder) out of the way into the run's displaced folder (never deletes)
#>
function Move-DesktopDirectoryToDisplaced {
    param(
        [hashtable]$Context,
        [string]$Path,
        [string]$Category,
        [string]$Reason
    )

    $displacedDirectory = Join-Path $Global:DESKTOP_ORGANIZER_DISPLACED_DIR $Context.RunId
    $displacedPath = Join-Path $displacedDirectory ('{0:D3}_{1}' -f $Context.Records.Count, [System.IO.Path]::GetFileName($Path))

    if (-not (Test-Path -LiteralPath $displacedDirectory)) {
        New-Item -ItemType Directory -Path $displacedDirectory -Force | Out-Null
    }
    [System.IO.Directory]::Move($Path, $displacedPath)
    Add-DesktopOrganizationRecord -Context $Context -Action 'displace-dir' -Source $Path -Destination $displacedPath -Category $Category -Reason $Reason
    return $displacedPath
}

<#
.SYNOPSIS
    True when a directory holds no file anywhere below it (links are not followed)
#>
function Test-DesktopFolderEmpty {
    param(
        [string]$Path
    )

    $child = $null

    foreach ($child in @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue)) {
        if ($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            return $false
        }
        if (-not $child.PSIsContainer -or -not (Test-DesktopFolderEmpty -Path $child.FullName)) {
            return $false
        }
    }
    return $true
}

<#
.SYNOPSIS
    Idempotently fixes invalid desktop entries before organizing
.DESCRIPTION
    Broken shortcuts on the desktops and in the category folders are re-pointed when their target
    only moved to a live program root (Get-DesktopRerootPairs; the original .lnk is kept for undo),
    otherwise displaced. Desktop folder links whose folder is gone are re-pointed or displaced, and
    empty category folders are removed together with their desktop link. Everything is recorded
    in the run's undo manifest; nothing is deleted except empty folders. A second run changes nothing.
.OUTPUTS
    Hashtable: Retargeted, Displaced, LinksFixed, FoldersRemoved, Messages
#>
function Repair-DesktopInvalidEntries {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Context,

        [bool]$DryRun = $false
    )

    $result = @{ Retargeted = 0; Displaced = 0; LinksFixed = 0; FoldersRemoved = 0; Messages = New-Object System.Collections.ArrayList }
    $pairs = @(Get-DesktopRerootPairs)
    $shortcutDirectories = @(Get-DesktopOrganizationPaths)
    $desktopPath = ''
    $directory = ''
    $filePath = ''
    $info = $null
    $newTarget = ''
    $backupPath = ''
    $shortcut = $null
    $entry = $null
    $linkTarget = ''
    $categoryFolder = $null
    $desktopLinkPath = ''
    $displacedDirectory = Join-Path $Global:DESKTOP_ORGANIZER_DISPLACED_DIR $Context.RunId

    if (Test-Path -LiteralPath $Global:DESKTOP_BACKUP_DIR) {
        $shortcutDirectories += @(Get-ChildItem -LiteralPath $Global:DESKTOP_BACKUP_DIR -Directory -Force -ErrorAction SilentlyContinue |
            Where-Object { -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) } | ForEach-Object { $_.FullName })
    }

    # 1. Broken shortcuts: re-point after a program-root move, else displace.
    foreach ($directory in $shortcutDirectories) {
        foreach ($filePath in (Get-DesktopShortcutFiles -Directory $directory)) {
            $info = Get-DesktopShortcutInfo -Path $filePath -Shell $Context.Shell
            if ($info.Hidden -or $info.State -ne 'broken' -or $Global:DESKTOP_ORGANIZATION_KEEP_ON_DESKTOP -contains $info.BaseName) {
                continue
            }
            $newTarget = Get-DesktopReroutedPath -Path $info.TargetPath -Pairs $pairs
            if ($newTarget -and (Test-Path -LiteralPath $newTarget)) {
                [void]$result.Messages.Add(('re-pointed: {0} -> {1}' -f $info.Path, $newTarget))
                $result.Retargeted++
                if ($DryRun) {
                    continue
                }
                if (-not (Test-Path -LiteralPath $displacedDirectory)) {
                    New-Item -ItemType Directory -Path $displacedDirectory -Force | Out-Null
                }
                $backupPath = Join-Path $displacedDirectory ('{0:D3}_{1}' -f $Context.Records.Count, $info.Name)
                [System.IO.File]::Copy($info.Path, $backupPath, $false)
                $shortcut = $Context.Shell.CreateShortcut($info.Path)
                $shortcut.TargetPath = $newTarget
                if (Get-DesktopReroutedPath -Path $info.WorkingDirectory -Pairs $pairs) {
                    $shortcut.WorkingDirectory = Get-DesktopReroutedPath -Path $info.WorkingDirectory -Pairs $pairs
                }
                if (Get-DesktopReroutedPath -Path $info.IconLocation -Pairs $pairs) {
                    $shortcut.IconLocation = Get-DesktopReroutedPath -Path $info.IconLocation -Pairs $pairs
                }
                $shortcut.Save()
                Add-DesktopOrganizationRecord -Context $Context -Action 'retarget' -Source $info.Path -Destination $backupPath -Category '' -Reason ('{0} -> {1}' -f $info.TargetPath, $newTarget)
                continue
            }
            [void]$result.Messages.Add(('displaced (target missing): {0} -> {1}' -f $info.Path, $(if ($info.TargetPath) { $info.TargetPath } else { 'no URL' })))
            $result.Displaced++
            if (-not $DryRun) {
                [void](Move-DesktopFileToDisplaced -Context $Context -Path $info.Path -Category '' -Reason ('target missing: {0}' -f $info.TargetPath))
            }
        }
    }

    # 2. Desktop folder links (directory symbolic links) whose folder is gone.
    foreach ($desktopPath in @(Get-DesktopOrganizationPaths)) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $desktopPath -Directory -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint })) {
            $linkTarget = [string](@($entry.Target) | Select-Object -First 1)
            if (-not $linkTarget -or [System.IO.Directory]::Exists($linkTarget)) {
                continue
            }
            $newTarget = Get-DesktopReroutedPath -Path $linkTarget -Pairs $pairs
            if ($newTarget -and [System.IO.Directory]::Exists($newTarget)) {
                [void]$result.Messages.Add(('folder link re-pointed: {0} -> {1}' -f $entry.FullName, $newTarget))
                $result.LinksFixed++
                if (-not $DryRun) {
                    # Replace the link in place (a link to another volume cannot be moved); undo recreates the old one
                    [System.IO.Directory]::Delete($entry.FullName, $false)
                    New-Item -ItemType SymbolicLink -Path $entry.FullName -Target $newTarget -ErrorAction Stop | Out-Null
                    Add-DesktopOrganizationRecord -Context $Context -Action 'relink' -Source $linkTarget -Destination $entry.FullName -Category '' -Reason ('{0} -> {1}' -f $linkTarget, $newTarget)
                }
                continue
            }
            [void]$result.Messages.Add(('folder link displaced (folder missing): {0} -> {1}' -f $entry.FullName, $linkTarget))
            $result.Displaced++
            if (-not $DryRun) {
                [void](Move-DesktopDirectoryToDisplaced -Context $Context -Path $entry.FullName -Category '' -Reason ('folder missing: {0}' -f $linkTarget))
            }
        }
    }

    # 3. Empty category folders and their desktop link.
    if (Test-Path -LiteralPath $Global:DESKTOP_BACKUP_DIR) {
        foreach ($categoryFolder in @(Get-ChildItem -LiteralPath $Global:DESKTOP_BACKUP_DIR -Directory -Force -ErrorAction SilentlyContinue |
                Where-Object { -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) })) {
            if (-not (Test-DesktopFolderEmpty -Path $categoryFolder.FullName)) {
                continue
            }
            [void]$result.Messages.Add(('empty folder removed: {0}' -f $categoryFolder.FullName))
            $result.FoldersRemoved++
            if ($DryRun) {
                continue
            }
            [System.IO.Directory]::Delete($categoryFolder.FullName, $true)
            Add-DesktopOrganizationRecord -Context $Context -Action 'rmdir' -Source '' -Destination $categoryFolder.FullName -Category $categoryFolder.Name -Reason 'empty category folder'
            foreach ($desktopPath in @(Get-DesktopOrganizationPaths)) {
                $desktopLinkPath = Join-Path $desktopPath ('{0}.lnk' -f $categoryFolder.Name)
                $entry = Get-Item -LiteralPath $desktopLinkPath -Force -ErrorAction SilentlyContinue
                if ($null -eq $entry) {
                    continue
                }
                if ($entry.PSIsContainer) {
                    [void](Move-DesktopDirectoryToDisplaced -Context $Context -Path $desktopLinkPath -Category $categoryFolder.Name -Reason 'link to an empty category folder')
                } else {
                    [void](Move-DesktopFileToDisplaced -Context $Context -Path $desktopLinkPath -Category $categoryFolder.Name -Reason 'link to an empty category folder')
                }
            }
        }
    }

    return $result
}

<#
.SYNOPSIS
    Fingerprint of the shortcut files on the desktops (names and write times), used by
    Invoke-DesktopIconTidy to skip runs when nothing changed
#>
function Get-DesktopShortcutFingerprint {
    $parts = New-Object System.Collections.ArrayList
    $desktopPath = ''
    $entry = $null

    foreach ($desktopPath in @(Get-DesktopOrganizationPaths)) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $desktopPath -Force -ErrorAction SilentlyContinue)) {
            [void]$parts.Add(('{0}|{1}' -f $entry.FullName.ToLowerInvariant(), $entry.LastWriteTimeUtc.Ticks))
        }
    }
    return (($parts | Sort-Object) -join "`n")
}

<#
.SYNOPSIS
    Quiet, idempotent desktop tidy after an install: fixes invalid entries and files new shortcuts
.DESCRIPTION
    Skips instantly when the desktops have not changed since the last tidy of this session.
    A named mutex keeps concurrent installer processes from organizing at the same time.
    Prints one line only when something changed.
#>
function Invoke-DesktopIconTidy {
    param(
        [string]$Reason = ''
    )

    $fingerprint = ''
    $mutex = $null
    $acquired = $false
    $result = $null
    $changed = 0

    if (-not $Global:DESKTOP_CLEANUP_ENABLED) {
        return
    }
    $fingerprint = Get-DesktopShortcutFingerprint
    if ($fingerprint -ceq [string]$Global:DESKTOP_TIDY_FINGERPRINT) {
        return
    }
    try {
        $mutex = New-Object System.Threading.Mutex($false, $Global:DESKTOP_TIDY_MUTEX_NAME)
        try {
            $acquired = $mutex.WaitOne([TimeSpan]::FromSeconds($Global:DESKTOP_TIDY_MUTEX_WAIT_SECONDS))
        } catch [System.Threading.AbandonedMutexException] {
            $acquired = $true
        }
        if (-not $acquired) {
            Write-DesktopIconManagerDebug -Message "Desktop tidy busy in another process; skipped" -ForegroundColor Gray
            return
        }
        $result = Invoke-DesktopIconOrganization -ShowSummary $false -ExtractIcons $false -Quiet $true
        $Global:DESKTOP_TIDY_FINGERPRINT = Get-DesktopShortcutFingerprint
        if ($null -ne $result) {
            $changed = [int]$result.ShortcutsMoved + [int]$result.Repaired + [int]$result.DocumentsMoved
        }
        if ($changed -gt 0) {
            Write-DesktopIconManagerInfo -Message ("Desktop tidied after {0}: {1} shortcut(s) filed, {2} file(s) moved to Documents, {3} invalid entr(y/ies) fixed" -f $(if ($Reason) { $Reason } else { 'install' }), $result.ShortcutsMoved, $result.DocumentsMoved, $result.Repaired) -ForegroundColor Green
        }
    } catch {
        Write-DesktopIconManagerInfo -Message "Desktop tidy failed: $($_.Exception.Message)" -ForegroundColor Yellow
    } finally {
        if ($acquired) {
            $mutex.ReleaseMutex()
        }
        if ($null -ne $mutex) {
            $mutex.Dispose()
        }
    }
}

<#
.SYNOPSIS
    Performs comprehensive desktop icon organization by categories

.DESCRIPTION
    Scans the user and Public desktops, moves every matching shortcut (.lnk/.url/.appref-ms)
    into LANG_COMPILER_DIR\.desktopIcons\<Category> and links each category folder on the
    desktop. One stable Chrome shortcut is copied and stays on the desktop; shortcuts no category
    matches go to OtherApps; real files move to the Documents folder (folders stay). Shortcuts
    already filed in a category folder that nothing supports are refiled. Nothing is deleted, and
    every change is written to an undo manifest under DESKTOP_ORGANIZER_STATE_DIR. A second run
    changes nothing.

.PARAMETER ShowSummary
    Whether to display the category folders after completion (default: true)

.PARAMETER ExtractIcons
    Whether to extract icons from organized shortcuts (default: true)

.PARAMETER SpecificCategories
    Array of specific desktop categories to process. If empty, processes all categories (default: empty)

.PARAMETER PreviewOnly
    Print the plan without changing anything (default: false)

.EXAMPLE
    Invoke-DesktopIconOrganization -ShowSummary $false -ExtractIcons $false

.EXAMPLE
    Invoke-DesktopIconOrganization -PreviewOnly $true
#>
function Invoke-DesktopIconOrganization {
    param(
        [Parameter(Mandatory = $false)]
        [bool]$ShowSummary = $true,

        [Parameter(Mandatory = $false)]
        [bool]$ExtractIcons = $true,

        [Parameter(Mandatory = $false)]
        [array]$SpecificCategories = @(),

        [Parameter(Mandatory = $false)]
        [bool]$PreviewOnly = $false,

        # Quiet: print only what changed (per-install tidy); no desktop/pinned/unmatched listings
        [Parameter(Mandatory = $false)]
        [bool]$Quiet = $false
    )

    if (-not $Global:DESKTOP_CLEANUP_ENABLED) {
        Write-DesktopIconManagerDebug -Message "Desktop organization disabled, skipping" -ForegroundColor Gray
        return
    }

    $organizationResults = @{
        CategoriesProcessed = 0
        ShortcutsMoved      = 0
        CategoriesCreated   = 0
        UnmatchedShortcuts  = 0
        Repaired            = 0
        DocumentsMoved      = 0
        ManifestPath        = ''
        Errors              = @()
    }
    $repairResult = $null
    $repairMessage = ''
    $looseResult = $null
    $context = @{
        RunId     = (Get-Date).ToString('yyyyMMdd_HHmmss_fff')
        Shell     = $null
        Records   = New-Object System.Collections.ArrayList
        Done      = New-Object System.Collections.ArrayList
        Unchanged = New-Object System.Collections.ArrayList
        Conflicts = New-Object System.Collections.ArrayList
        Failed    = New-Object System.Collections.ArrayList
    }
    $plan = $null
    $unmatchedShortcuts = @()
    $categoryName = ''
    $categoryItems = @()
    $categoryResult = $null
    $entry = $null
    $item = $null
    $modeLabel = ''
    $decision = $null
    $previewPlaced = @{}

    try {
        if (-not (Test-OrganizationCategories)) {
            throw "Organization categories validation failed"
        }
        $context.Shell = New-Object -ComObject WScript.Shell
        # Invalid shortcuts / folder links / empty category folders first, so re-pointed
        # shortcuts are filed in this same run.
        $repairResult = Repair-DesktopInvalidEntries -Context $context -DryRun $PreviewOnly
        $organizationResults.Repaired = $repairResult.Retargeted + $repairResult.Displaced + $repairResult.LinksFixed + $repairResult.FoldersRemoved
        foreach ($repairMessage in $repairResult.Messages) {
            Write-DesktopIconManagerInfo -Message ('{0}{1}' -f $(if ($PreviewOnly) { '[preview] ' } else { '' }), $repairMessage) -ForegroundColor Green
        }
        if ($SpecificCategories.Count -eq 0) {
            $looseResult = Move-DesktopLooseItemsToDocuments -Context $context -DryRun $PreviewOnly
            $organizationResults.DocumentsMoved = $looseResult.Moved
            foreach ($repairMessage in $looseResult.Messages) {
                Write-DesktopIconManagerInfo -Message ('{0}{1}' -f $(if ($PreviewOnly) { '[preview] ' } else { '' }), $repairMessage) -ForegroundColor Green
            }
        }
        $plan = Get-DesktopOrganizationPlan -SpecificCategories $SpecificCategories
        if (-not $Quiet) {
            Write-DesktopIconManagerInfo -Message "Desktops: $($plan.DesktopPaths -join '; ')" -ForegroundColor Cyan
            Write-DesktopIconManagerInfo -Message "Category folders: $($Global:DESKTOP_BACKUP_DIR)" -ForegroundColor Cyan
        }

        foreach ($entry in $plan.Conflicts) {
            [void]$context.Conflicts.Add($entry)
        }
        if ($PreviewOnly) {
            foreach ($item in $plan.Items) {
                $decision = Get-DesktopPlacementDecision -Item $item -CategoryDirectory (Join-Path $Global:DESKTOP_BACKUP_DIR $item.Category) -Shell $context.Shell
                if ($decision.Action -eq 'place' -and $previewPlaced.ContainsKey($decision.Destination.ToLowerInvariant())) {
                    $decision.Action = 'duplicate'
                }
                if ($decision.Action -eq 'unchanged') {
                    continue
                }
                if ($decision.Action -eq 'conflict') {
                    [void]$context.Conflicts.Add(@{ Item = $item; Destination = $decision.Destination; Reason = $decision.Reason })
                    continue
                }
                $previewPlaced[$decision.Destination.ToLowerInvariant()] = $true
                $modeLabel = $item.Mode
                if ($decision.Action -ne 'place') {
                    $modeLabel = ('{0} ({1})' -f $item.Mode, $decision.Action)
                }
                Write-DesktopIconManagerInfo -Message ("[preview] {0}: {1} -> {2} ({3})" -f $modeLabel, $item.Info.Path, $item.Category, $item.Reason) -ForegroundColor White
            }
            foreach ($entry in $context.Conflicts) {
                Write-DesktopIconManagerInfo -Message ("[preview] kept ({0}): {1}" -f $entry.Reason, $entry.Item.Info.Path) -ForegroundColor Yellow
            }
            if ($previewPlaced.Count -eq 0) {
                Write-DesktopIconManagerInfo -Message "Nothing to move; the desktop is already organized." -ForegroundColor Green
            }
        } else {
            foreach ($categoryName in (Get-DesktopKeywordTable).Categories) {
                $categoryItems = @($plan.Items | Where-Object { $_.Category -eq $categoryName })
                if ($categoryItems.Count -eq 0) {
                    continue
                }
                $categoryResult = Invoke-CategoryOrganization -CategoryName $categoryName -Items $categoryItems -Context $context
                $organizationResults.CategoriesProcessed++
                $organizationResults.ShortcutsMoved += $categoryResult.ShortcutsMoved
                if ($categoryResult.CategoryCreated) {
                    $organizationResults.CategoriesCreated++
                }
                if ($categoryResult.Errors.Count -gt 0) {
                    $organizationResults.Errors += $categoryResult.Errors
                }
            }

            foreach ($entry in $context.Done) {
                $modeLabel = $entry.Item.Mode
                if ($entry.ContainsKey('Label')) {
                    $modeLabel = $entry.Label
                }
                Write-DesktopIconManagerInfo -Message ("{0}: {1} -> {2} ({3})" -f $modeLabel, $entry.Item.Info.Path, $entry.Destination, $entry.Item.Reason) -ForegroundColor Green
            }
            if (-not $Quiet) {
                foreach ($entry in $context.Conflicts) {
                    Write-DesktopIconManagerInfo -Message ("kept ({0}): {1}" -f $entry.Reason, $entry.Item.Info.Path) -ForegroundColor Yellow
                }
            }
            foreach ($entry in $context.Failed) {
                Write-DesktopIconManagerInfo -Message ("failed: {0} -> {1}: {2}" -f $entry.Item.Info.Path, $entry.Destination, $entry.Error) -ForegroundColor Red
                $organizationResults.Errors += ("Could not move {0}: {1}" -f $entry.Item.Info.Path, $entry.Error)
            }
            if ($context.Records.Count -gt 0) {
                $organizationResults.ManifestPath = Save-DesktopOrganizationManifest -Context $context
                if (-not $Quiet) {
                    Write-DesktopIconManagerInfo -Message "Undo manifest: $($organizationResults.ManifestPath)" -ForegroundColor Cyan
                }
            } elseif (-not $Quiet) {
                Write-DesktopIconManagerInfo -Message "Nothing to move; the desktop is already organized." -ForegroundColor Green
            }
        }

        $unmatchedShortcuts = @(Get-UnmatchedShortcuts -Plan $plan)
        $organizationResults.UnmatchedShortcuts = $unmatchedShortcuts.Count
        if (-not $Quiet) {
            foreach ($entry in $plan.Pinned) {
                Write-DesktopIconManagerInfo -Message "kept on desktop ($($entry.Reason)): $($entry.Info.Path)" -ForegroundColor DarkGray
            }
            foreach ($entry in $plan.Broken) {
                Write-DesktopIconManagerInfo -Message "left in place (target missing): $($entry.Info.Path) -> $($entry.Reason)" -ForegroundColor DarkYellow
            }
            if ($unmatchedShortcuts.Count -gt 0) {
                Show-UnmatchedShortcuts -UnmatchedShortcuts $unmatchedShortcuts
            }
        }

        if ($ShowSummary) {
            Show-OrganizationSummary
        }
        if ($ExtractIcons -and -not $PreviewOnly) {
            Invoke-IconExtraction -BaseDirectory $Global:DESKTOP_BACKUP_DIR
        }
    } catch {
        $organizationResults.Errors += "Desktop icon organization failed: $($_.Exception.Message)"
        Write-DesktopIconManagerInfo -Message "Desktop icon organization failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($context.Records.Count -gt 0 -and -not $organizationResults.ManifestPath) {
            $organizationResults.ManifestPath = Save-DesktopOrganizationManifest -Context $context
        }
    }

    return $organizationResults
}

<#
.SYNOPSIS
    Reverts one organizer run from its undo manifest (the newest one not yet undone by default)
.DESCRIPTION
    Replays the manifest backwards: moved shortcuts go back, copies and fallback desktop links
    go to the state folder, displaced shortcuts return, symbolic desktop links are moved away
    and category folders the run created are removed only when empty. Nothing is overwritten.
    The run is marked UndoneAt only when no entry failed, so a rerun retries the failed ones.
#>
function Undo-DesktopIconOrganization {
    param(
        [Parameter(Mandatory = $false)]
        [string]$ManifestPath = ''
    )

    $undoResults = @{
        ManifestPath = ''
        Restored     = 0
        Skipped      = 0
        Errors       = @()
    }
    $candidate = $null
    $manifest = $null
    $entries = @()
    $entry = $null
    $index = 0
    $undoStoreDirectory = ''
    $undoStorePath = ''
    $parentDirectory = ''
    $linkItem = $null
    $status = ''
    $restoredTo = ''
    $errorMessage = ''

    if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
        foreach ($candidate in @(Get-ChildItem -LiteralPath $Global:DESKTOP_ORGANIZER_MANIFEST_DIR -Filter 'organize_*.json' -File -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
            $manifest = Get-Content -LiteralPath $candidate.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            if ([string]::IsNullOrEmpty([string]$manifest.UndoneAt)) {
                $ManifestPath = $candidate.FullName
                break
            }
            $manifest = $null
        }
    } elseif (Test-Path -LiteralPath $ManifestPath) {
        $manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    if ($null -eq $manifest) {
        Write-DesktopIconManagerInfo -Message "No organizer run to undo in $($Global:DESKTOP_ORGANIZER_MANIFEST_DIR)" -ForegroundColor Yellow
        return $undoResults
    }
    if (-not [string]::IsNullOrEmpty([string]$manifest.UndoneAt)) {
        Write-DesktopIconManagerInfo -Message "Already undone at $($manifest.UndoneAt): $ManifestPath" -ForegroundColor Yellow
        return $undoResults
    }

    $undoResults.ManifestPath = $ManifestPath
    $undoStoreDirectory = Join-Path (Join-Path $Global:DESKTOP_ORGANIZER_STATE_DIR 'undone') ([string]$manifest.RunId)
    $entries = @($manifest.Entries)
    Write-DesktopIconManagerInfo -Message "Undoing $($entries.Count) change(s) from $ManifestPath" -ForegroundColor Cyan

    for ($index = $entries.Count - 1; $index -ge 0; $index--) {
        $entry = $entries[$index]
        $status = 'skipped'
        $restoredTo = [string]$entry.Source
        try {
            switch ([string]$entry.Action) {
                { $_ -eq 'move' -or $_ -eq 'displace' } {
                    if ([System.IO.File]::Exists($entry.Destination) -and -not [System.IO.File]::Exists($entry.Source)) {
                        $parentDirectory = Split-Path -Parent $entry.Source
                        if (-not (Test-Path -LiteralPath $parentDirectory)) {
                            New-Item -ItemType Directory -Path $parentDirectory -Force | Out-Null
                        }
                        [System.IO.File]::Move($entry.Destination, $entry.Source)
                        $status = 'restored'
                    }
                }
                'copy' {
                    if ([System.IO.File]::Exists($entry.Destination)) {
                        if (-not (Test-Path -LiteralPath $undoStoreDirectory)) {
                            New-Item -ItemType Directory -Path $undoStoreDirectory -Force | Out-Null
                        }
                        $undoStorePath = Join-Path $undoStoreDirectory ('{0:D3}_{1}' -f $index, [System.IO.Path]::GetFileName($entry.Destination))
                        [System.IO.File]::Move($entry.Destination, $undoStorePath)
                        $restoredTo = $undoStorePath
                        $status = 'restored'
                    }
                }
                'link' {
                    if ((Test-Path -LiteralPath $entry.Source) -and @(Get-ChildItem -LiteralPath $entry.Source -Force -ErrorAction SilentlyContinue).Count -gt 0) {
                        break
                    }
                    $linkItem = Get-Item -LiteralPath $entry.Destination -Force -ErrorAction SilentlyContinue
                    if ($null -ne $linkItem) {
                        if (-not (Test-Path -LiteralPath $undoStoreDirectory)) {
                            New-Item -ItemType Directory -Path $undoStoreDirectory -Force | Out-Null
                        }
                        $undoStorePath = Join-Path $undoStoreDirectory ('{0:D3}_{1}' -f $index, $linkItem.Name)
                        if ($linkItem.PSIsContainer) {
                            [System.IO.Directory]::Move($entry.Destination, $undoStorePath)
                        } else {
                            [System.IO.File]::Move($entry.Destination, $undoStorePath)
                        }
                        $restoredTo = $undoStorePath
                        $status = 'restored'
                    }
                }
                'mkdir' {
                    if ((Test-Path -LiteralPath $entry.Destination) -and @(Get-ChildItem -LiteralPath $entry.Destination -Force -ErrorAction SilentlyContinue).Count -eq 0) {
                        [System.IO.Directory]::Delete($entry.Destination, $false)
                        $restoredTo = 'removed (empty folder created by the run)'
                        $status = 'restored'
                    }
                }
                'move-dir' {
                    if ([System.IO.Directory]::Exists($entry.Destination) -and $null -eq (Get-Item -LiteralPath $entry.Source -Force -ErrorAction SilentlyContinue)) {
                        [System.IO.Directory]::Move($entry.Destination, $entry.Source)
                        $status = 'restored'
                    }
                }
                'displace-dir' {
                    if ($null -ne (Get-Item -LiteralPath $entry.Destination -Force -ErrorAction SilentlyContinue) -and
                        $null -eq (Get-Item -LiteralPath $entry.Source -Force -ErrorAction SilentlyContinue)) {
                        [System.IO.Directory]::Move($entry.Destination, $entry.Source)
                        $status = 'restored'
                    }
                }
                'retarget' {
                    if ([System.IO.File]::Exists($entry.Destination)) {
                        [System.IO.File]::Copy($entry.Destination, $entry.Source, $true)
                        $restoredTo = $entry.Source
                        $status = 'restored'
                    }
                }
                'relink' {
                    # mklink also recreates a link whose old target no longer exists
                    $linkItem = Get-Item -LiteralPath $entry.Destination -Force -ErrorAction SilentlyContinue
                    if ($null -ne $linkItem -and ($linkItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                        [System.IO.Directory]::Delete($entry.Destination, $false)
                    }
                    if ($null -eq (Get-Item -LiteralPath $entry.Destination -Force -ErrorAction SilentlyContinue)) {
                        & cmd.exe /d /c mklink /D "$($entry.Destination)" "$($entry.Source)" | Out-Null
                        $restoredTo = $entry.Source
                        $status = 'restored'
                    }
                }
                'rmdir' {
                    if (-not (Test-Path -LiteralPath $entry.Destination)) {
                        New-Item -ItemType Directory -Path $entry.Destination -Force | Out-Null
                        $restoredTo = $entry.Destination
                        $status = 'restored'
                    }
                }
            }
        } catch {
            $status = 'failed'
            $undoResults.Errors += ("{0} {1}: {2}" -f $entry.Action, $entry.Destination, $_.Exception.Message)
        }
        if ($status -eq 'restored') {
            $undoResults.Restored++
            Write-DesktopIconManagerInfo -Message ("undo {0}: {1} -> {2}" -f $entry.Action, $entry.Destination, $restoredTo) -ForegroundColor Green
        } else {
            $undoResults.Skipped++
            Write-DesktopIconManagerInfo -Message ("undo {0} {1}: {2}" -f $entry.Action, $status, $entry.Destination) -ForegroundColor Yellow
        }
    }

    Write-DesktopIconManagerInfo -Message ("Undo finished: {0} restored, {1} skipped, {2} error(s)" -f $undoResults.Restored, $undoResults.Skipped, $undoResults.Errors.Count) -ForegroundColor Cyan
    if ($undoResults.Errors.Count -eq 0) {
        $manifest.UndoneAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
        $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
    } else {
        foreach ($errorMessage in $undoResults.Errors) {
            Write-DesktopIconManagerInfo -Message "undo failed: $errorMessage" -ForegroundColor Red
        }
        Write-DesktopIconManagerInfo -Message "The run stays open for undo; run Undo again (elevated for the Public desktop) to retry the failed entries: $ManifestPath" -ForegroundColor Yellow
    }
    return $undoResults
}

<#
.SYNOPSIS
    Extracts icons from organized shortcuts into USER_DIR\.icons\<Category>
#>
function Invoke-IconExtraction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseDirectory
    )

    $iconsOutputDir = Join-Path $Global:USER_DIR ".icons"
    $iconExtractorPath = Join-Path $script:DESKTOP_ICON_MANAGER_DIR "IconExtractor.ps1"
    $table = Get-DesktopKeywordTable
    $categoryName = ''
    $filePath = ''
    $extractedCount = 0

    try {
        if (-not (Get-Command -Name 'Extract-IconFromFile' -ErrorAction SilentlyContinue)) {
            . $iconExtractorPath
        }
        foreach ($categoryName in $table.Categories) {
            foreach ($filePath in (Get-DesktopShortcutFiles -Directory (Join-Path $BaseDirectory $categoryName))) {
                if (Extract-IconFromFile -FilePath $filePath -OutputDir (Join-Path $iconsOutputDir $categoryName) -IconName ([System.IO.Path]::GetFileNameWithoutExtension($filePath))) {
                    $extractedCount++
                }
            }
        }
        Write-DesktopIconManagerInfo -Message "Extracted $extractedCount icons to: $iconsOutputDir" -ForegroundColor Green
    } catch {
        Write-DesktopIconManagerInfo -Message "Error during icon extraction: $($_.Exception.Message)" -ForegroundColor Red
    }
}

<#
.SYNOPSIS
    Installs custom scripts and commands with desktop shortcuts

.DESCRIPTION
    Processes custom scripts and commands from GlobalVars.ps1, creates PowerShell scripts,
    batch triggers, and desktop shortcuts. This function integrates the functionality
    from Step102_InstallCustomScriptsAndCommands.ps1.

.PARAMETER CreateShortcuts
    Whether to create desktop shortcuts for the scripts (default: true)

.EXAMPLE
    Invoke-CustomScriptsInstallation

.EXAMPLE
    Invoke-CustomScriptsInstallation -CreateShortcuts $false
#>
function Invoke-CustomScriptsInstallation {
    param(
        [Parameter(Mandatory = $false)]
        [bool]$CreateShortcuts = $true
    )

    Write-DesktopIconManagerDebug -Message "Starting custom scripts and commands installation..." -ForegroundColor Cyan

    # Variables declaration - hardcode to desktop icons directory
    $outputDir = $Global:DESKTOP_BACKUP_DIR
    $currentIdentifiers = @{}
    $installationResults = @{
        ProcessedCount = 0
        ShortcutsCreated = 0
        ScriptsCreated = 0
        Errors = @()
    }

    try {
        # Ensure output directory exists
        if (-not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
            Write-DesktopIconManagerDebug -Message "Created output directory: $outputDir" -ForegroundColor Green
        }

        # Validate custom scripts configuration
        if (-not $Global:CUSTOM_SCRIPTS_AND_COMMANDS -or $Global:CUSTOM_SCRIPTS_AND_COMMANDS.Count -eq 0) {
            Write-DesktopIconManagerDebug -Message "No custom scripts and commands defined in GlobalVars.ps1" -ForegroundColor Yellow
            return $installationResults
        }

        Write-DesktopIconManagerDebug -Message "Processing $($Global:CUSTOM_SCRIPTS_AND_COMMANDS.Count) custom scripts and commands" -ForegroundColor Cyan

        # Clean up existing scripts that are no longer in configuration
        Remove-ObsoleteScripts -OutputDirectory $outputDir

        # Process each custom script/command
        foreach ($key in $Global:CUSTOM_SCRIPTS_AND_COMMANDS.Keys) {
            $item = $Global:CUSTOM_SCRIPTS_AND_COMMANDS[$key]

            try {
                Write-DesktopIconManagerDebug -Message "Processing item: $key" -ForegroundColor Yellow

                $scriptResult = Install-CustomScriptItem -Key $key -Item $item -CreateShortcuts $CreateShortcuts

                $installationResults.ProcessedCount++
                $installationResults.ScriptsCreated += $scriptResult.ScriptsCreated
                $installationResults.ShortcutsCreated += $scriptResult.ShortcutsCreated

                if ($scriptResult.Errors.Count -gt 0) {
                    $installationResults.Errors += $scriptResult.Errors
                }

                # Track processed items for cleanup
                $currentIdentifiers[$key] = @{
                    Name = $scriptResult.ItemName
                    Command = $scriptResult.Command
                    Created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                }

            } catch {
                $errorMsg = "Failed to process custom script '$key': $($_.Exception.Message)"
                $installationResults.Errors += $errorMsg
                Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
            }
        }

        # Save current identifiers for next cleanup
        Save-ScriptIdentifiers -OutputDirectory $outputDir -Identifiers $currentIdentifiers

        Write-DesktopIconManagerDebug -Message "Custom scripts installation completed successfully" -ForegroundColor Green
        Write-DesktopIconManagerDebug -Message "Results: Processed: $($installationResults.ProcessedCount), Scripts: $($installationResults.ScriptsCreated), Shortcuts: $($installationResults.ShortcutsCreated)" -ForegroundColor Green

    } catch {
        $errorMsg = "Custom scripts installation failed: $($_.Exception.Message)"
        $installationResults.Errors += $errorMsg
        Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
    }

    return $installationResults
}

<#
.SYNOPSIS
    Installs a single custom script item

.DESCRIPTION
    Processes a single custom script/command item, creating PowerShell scripts,
    batch triggers, and desktop shortcuts as needed.
#>
function Install-CustomScriptItem {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        [hashtable]$Item,

        [Parameter(Mandatory = $true)]
        [bool]$CreateShortcuts
    )

    # Variables declaration
    $scriptResult = @{
        ItemName = ""
        Command = ""
        ScriptsCreated = 0
        ShortcutsCreated = 0
        Errors = @()
    }

    try {
        # Extract item properties safely
        $itemName = Get-CustomScriptItemString -Item $Item -PropertyName "ItemName" -DefaultValue $Key
        $itemCommand = Get-CustomScriptItemString -Item $Item -PropertyName "ItemCommand" -DefaultValue ""
        $workDir = Get-CustomScriptItemString -Item $Item -PropertyName "WorkDir" -DefaultValue ""
        $createShortcut = Get-CustomScriptItemBoolean -Item $Item -PropertyName "CreateDesktopShortcut" -DefaultValue $false
        $desktopCategory = Get-CustomScriptItemString -Item $Item -PropertyName "DesktopCategory" -DefaultValue $Global:DESKTOP_CATEGORY_DEV_SCRIPTS

        $scriptResult.ItemName = $itemName
        $scriptResult.Command = $itemCommand

        if (-not $itemCommand) {
            $scriptResult.Errors += "Item '$itemName' has no command defined"
            return $scriptResult
        }

        Write-DesktopIconManagerDebug -Message "Creating script for: $itemName" -ForegroundColor Green

        # Create category-specific output directory in desktop icons directory
        $baseOutputDir = $Global:DESKTOP_BACKUP_DIR
        $categoryOutputDir = if ($desktopCategory) {
            Join-Path $baseOutputDir $desktopCategory
        } else {
            $baseOutputDir
        }
        if (-not (Test-Path $categoryOutputDir)) {
            New-Item -ItemType Directory -Path $categoryOutputDir -Force | Out-Null
            Write-DesktopIconManagerDebug -Message "Created category directory: $categoryOutputDir" -ForegroundColor Green
        }

        # Determine script type and create appropriate files
        $scriptType = Get-ScriptType -Command $itemCommand

        switch ($scriptType) {
            "PowerShell" {
                $scriptPath = Create-PowerShellScriptFile -ItemName $itemName -Command $itemCommand -WorkDir $workDir -OutputDirectory $categoryOutputDir
                if ($scriptPath) {
                    $scriptResult.ScriptsCreated++
                }
            }
            "Batch" {
                $scriptPath = Create-BatchScriptFile -ItemName $itemName -Command $itemCommand -WorkDir $workDir -OutputDirectory $categoryOutputDir
                if ($scriptPath) {
                    $scriptResult.ScriptsCreated++
                }
            }
            "ScriptFile" {
                $scriptPath = Create-ScriptFileTrigger -ItemName $itemName -Command $itemCommand -WorkDir $workDir -OutputDirectory $categoryOutputDir
                if ($scriptPath) {
                    $scriptResult.ScriptsCreated++
                }
            }
            default {
                $scriptResult.Errors += "Unknown script type for item: $itemName"
                return $scriptResult
            }
        }

        # Create batch trigger for the script
        if ($scriptPath -and (Test-Path $scriptPath)) {
            $batchPath = Create-BatchTrigger -ScriptPath $scriptPath -ItemName $itemName

            if ($batchPath -and (Test-Path $batchPath)) {
                # Add to Windows PATH
                Add-ScriptToPath -BatchPath $batchPath

                # Create desktop shortcut if requested
                if ($CreateShortcuts -and $createShortcut) {
                    Write-DesktopIconManagerDebug -Message "Creating desktop shortcut for $itemName" -ForegroundColor Green

                    $shortcutCreated = Create-DesktopShortcutsForPackage -ShortcutName $itemName -ExePath $batchPath -CategoryName $desktopCategory

                    if ($shortcutCreated) {
                        $scriptResult.ShortcutsCreated++
                    } else {
                        $scriptResult.Errors += "Failed to create desktop shortcut for: $itemName"
                    }
                } else {
                    Write-DesktopIconManagerDebug -Message "Skipping desktop shortcut creation for $itemName" -ForegroundColor Yellow
                }
            } else {
                $scriptResult.Errors += "Failed to create batch trigger for: $itemName"
            }
        } else {
            $scriptResult.Errors += "Failed to create script file for: $itemName"
        }

    } catch {
        $errorMsg = "Error processing script item '$Key': $($_.Exception.Message)"
        $scriptResult.Errors += $errorMsg
        Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
    }

    return $scriptResult
}

<#
.SYNOPSIS
    Utility functions for custom script processing
#>
function Get-CustomScriptItemString {
    param(
        [hashtable]$Item,
        [string]$PropertyName,
        [string]$DefaultValue = ""
    )

    try {
        if ($Item.ContainsKey($PropertyName)) {
            $value = $Item[$PropertyName]

            if ($null -eq $value) {
                return $DefaultValue
            } elseif ($value -is [string]) {
                return $value.Trim()
            } else {
                return $value.ToString().Trim()
            }
        }
        return $DefaultValue
    } catch {
        Write-DesktopIconManagerDebug -Message "Error extracting string property '$PropertyName': $($_.Exception.Message)" -ForegroundColor Yellow
        return $DefaultValue
    }
}

function Get-CustomScriptItemBoolean {
    param(
        [hashtable]$Item,
        [string]$PropertyName,
        [bool]$DefaultValue = $false
    )

    try {
        if ($Item.ContainsKey($PropertyName)) {
            $value = $Item[$PropertyName]

            if ($null -eq $value) {
                return $DefaultValue
            } elseif ($value -is [bool]) {
                return $value
            } elseif ($value -is [string]) {
                $trimmedValue = $value.Trim().ToLower()
                return $trimmedValue -in @("true", "1", "yes", "on")
            } elseif ($value -is [int]) {
                return $value -ne 0
            } else {
                return [bool]$value
            }
        }
        return $DefaultValue
    } catch {
        Write-DesktopIconManagerDebug -Message "Error extracting boolean property '$PropertyName': $($_.Exception.Message)" -ForegroundColor Yellow
        return $DefaultValue
    }
}

function Get-ScriptType {
    param([string]$Command)

    if ($Command -like "*.ps1*" -or $Command -like "*powershell*") {
        return "PowerShell"
    } elseif ($Command -like "*.bat*" -or $Command -like "*.cmd*") {
        return "Batch"
    } elseif ($Command -like "*.*") {
        return "ScriptFile"
    } else {
        return "PowerShell"  # Default to PowerShell for commands
    }
}

function Create-PowerShellScriptFile {
    param(
        [string]$ItemName,
        [string]$Command,
        [string]$WorkDir,
        [string]$OutputDirectory
    )

    try {
        $scriptPath = Join-Path $OutputDirectory "$ItemName.ps1"

        # Convert command to PowerShell format
        $commands = Convert-CommandToPowerShell -Command $Command

        $scriptContent = @"
# Auto-generated PowerShell script for: $ItemName
# Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

        if ($WorkDir) {
            $scriptContent += @"
# Change to working directory
Set-Location -Path "$WorkDir"

"@
        }

        foreach ($cmd in $commands) {
            $scriptContent += "Invoke-Expression '$($cmd.Trim())'"
            $scriptContent += "`n"
        }

        Set-Content -Path $scriptPath -Value $scriptContent -Encoding UTF8
        Write-DesktopIconManagerDebug -Message "Created PowerShell script: $scriptPath" -ForegroundColor Green

        return $scriptPath
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to create PowerShell script for '$ItemName': $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Convert-CommandToPowerShell {
    param([string]$Command)

    # Replace && with ; for PowerShell compatibility
    $command = $Command -replace '&&', ';'

    # Handle \n line breaks
    $command = $command -replace '\\n', "`n"

    # Split by semicolon and create proper PowerShell commands
    $commands = $command -split ';' | Where-Object { $_.Trim() -ne '' }

    return $commands
}

function Create-BatchScriptFile {
    param(
        [string]$ItemName,
        [string]$Command,
        [string]$WorkDir,
        [string]$OutputDirectory
    )

    try {
        $scriptPath = Join-Path $OutputDirectory "$ItemName.ps1"

        $scriptContent = @"
# Auto-generated PowerShell script for batch command: $ItemName
# Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

        if ($WorkDir) {
            $scriptContent += @"
# Change to working directory
Set-Location -Path "$WorkDir"

"@
        }

        $scriptContent += @"
# Execute batch command
cmd.exe /c "$Command"
"@

        Set-Content -Path $scriptPath -Value $scriptContent -Encoding UTF8
        Write-DesktopIconManagerDebug -Message "Created batch script wrapper: $scriptPath" -ForegroundColor Green

        return $scriptPath
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to create batch script for '$ItemName': $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Create-ScriptFileTrigger {
    param(
        [string]$ItemName,
        [string]$Command,
        [string]$WorkDir,
        [string]$OutputDirectory
    )

    try {
        $scriptPath = Join-Path $OutputDirectory "$ItemName.ps1"

        $scriptContent = @"
# Auto-generated PowerShell trigger for script file: $ItemName
# Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

        if ($WorkDir) {
            $scriptContent += @"
# Change to working directory
Set-Location -Path "$WorkDir"

"@
        }

        $scriptContent += @"
# Execute script file
& "$Command"
"@

        Set-Content -Path $scriptPath -Value $scriptContent -Encoding UTF8
        Write-DesktopIconManagerDebug -Message "Created script file trigger: $scriptPath" -ForegroundColor Green

        return $scriptPath
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to create script file trigger for '$ItemName': $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Create-BatchTrigger {
    param(
        [string]$ScriptPath,
        [string]$ItemName
    )

    try {
        # Create batch file in the same directory as the script
        $scriptDir = Split-Path -Parent $ScriptPath
        $batchPath = Join-Path $scriptDir "$ItemName.cmd"

        $batchContent = @"
@echo off
REM Auto-generated batch trigger for: $ItemName
REM Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

REM Save current directory
set "ORIGINAL_DIR=%CD%"

REM Execute PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "$ScriptPath"

REM Restore original directory
cd /d "%ORIGINAL_DIR%"
"@

        Set-Content -Path $batchPath -Value $batchContent -Encoding ASCII
        Write-DesktopIconManagerDebug -Message "Created batch trigger: $batchPath" -ForegroundColor Green

        return $batchPath
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to create batch trigger for '$ItemName': $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Add-ScriptToPath {
    param([string]$BatchPath)

    try {
        # Use WindowsPathFunction to add the batch file to PATH
        if (Get-Command "Invoke-WindowsPathFunction" -ErrorAction SilentlyContinue) {
            Invoke-WindowsPathFunction -Action "addfile" -FilePath $BatchPath
            Write-DesktopIconManagerDebug -Message "Added script to PATH: $BatchPath" -ForegroundColor Green
        } else {
            Write-DesktopIconManagerDebug -Message "WindowsPathFunction not available, skipping PATH addition" -ForegroundColor Yellow
        }
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to add script to PATH: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Remove-ObsoleteScripts {
    param([string]$OutputDirectory)

    try {
        $identifiersFile = Join-Path $OutputDirectory "script_identifiers.json"

        if (Test-Path $identifiersFile) {
            $previousIdentifiers = Get-Content $identifiersFile | ConvertFrom-Json -AsHashtable

            foreach ($key in $previousIdentifiers.Keys) {
                if (-not $Global:CUSTOM_SCRIPTS_AND_COMMANDS.ContainsKey($key)) {
                    Write-DesktopIconManagerDebug -Message "Removing obsolete script: $key" -ForegroundColor Yellow

                    # Search for script files in all subdirectories
                    $scriptFiles = Get-ChildItem -Path $OutputDirectory -Recurse -Filter "$key.ps1" -ErrorAction SilentlyContinue
                    $batchFiles = Get-ChildItem -Path $OutputDirectory -Recurse -Filter "$key.cmd" -ErrorAction SilentlyContinue

                    foreach ($file in $scriptFiles) {
                        Remove-Item $file.FullName -Force
                        Write-DesktopIconManagerDebug -Message "Removed obsolete script: $($file.FullName)" -ForegroundColor Yellow
                    }

                    foreach ($file in $batchFiles) {
                        Remove-Item $file.FullName -Force
                        Write-DesktopIconManagerDebug -Message "Removed obsolete batch: $($file.FullName)" -ForegroundColor Yellow
                    }
                }
            }
        }
    } catch {
        Write-DesktopIconManagerDebug -Message "Error during obsolete script cleanup: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Save-ScriptIdentifiers {
    param(
        [string]$OutputDirectory,
        [hashtable]$Identifiers
    )

    try {
        $identifiersFile = Join-Path $OutputDirectory "script_identifiers.json"
        $Identifiers | ConvertTo-Json -Depth 3 | Set-Content $identifiersFile -Encoding UTF8
        Write-DesktopIconManagerDebug -Message "Saved script identifiers to: $identifiersFile" -ForegroundColor Green
    } catch {
        Write-DesktopIconManagerDebug -Message "Failed to save script identifiers: $($_.Exception.Message)" -ForegroundColor Red
    }
}

switch ($DesktopIconAction) {
    '' { }
    'Organize' { [void](Invoke-DesktopIconOrganization -ShowSummary $true -ExtractIcons $false) }
    'Preview' { [void](Invoke-DesktopIconOrganization -ShowSummary $false -ExtractIcons $false -PreviewOnly $true) }
    'Undo' { [void](Undo-DesktopIconOrganization -ManifestPath $DesktopIconUndoManifest) }
    'Tidy' { Invoke-DesktopIconTidy -Reason 'manual run' }
    default { Write-DesktopIconManagerInfo -Message "Unknown -DesktopIconAction '$DesktopIconAction' (use Organize, Preview, Tidy or Undo)" -ForegroundColor Red }
}
