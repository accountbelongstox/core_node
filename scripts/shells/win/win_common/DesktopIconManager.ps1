# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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
#>

# Local debug configuration for DesktopIconManager
$script:DesktopIconManagerDebugMode = $false  # Set to $true to enable debug output for desktop icon operations

# Import required modules
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$COMMON_FUNC_PATH = Join-Path $SCRIPT_DIR "CommonFunc.ps1"
 . $COMMON_FUNC_PATH

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
$Global:DESKTOP_BACKUP_DIR = Join-Path $Global:LANG_COMPILER_DIR ".desktopIcons"
$Global:AGGRESSIVE_CLEANUP_ENABLED = $false


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
            "\u817E\u8BAF\u624B\u6E38\u52A0\u901F\u5668", "\u7F51\u6613\u624B\u6E38\u52A0\u901F\u5668"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS
        AdditionalKeywords = @(
            "Visual Studio", "IntelliJ", "Eclipse", "Android Studio", "Xcode", "Git", "Docker",
            "PyCharm", "WebStorm", "PhpStorm", "CLion", "DataGrip", "GoLand", "RubyMine",
            "Rider", "AppCode", "Fleet", "Code", "VSCode", "Windsurf", "VSCodium", "Sublime Text", "Atom", "Brackets",
            "NetBeans", "BlueJ", "Dev-C++", "Code::Blocks", "Qt Creator", "Delphi", "Lazarus",
            "Unity", "Unreal Engine", "Godot", "GameMaker", "Construct", "RPG Maker",
            "Postman", "Insomnia", "Swagger", "SoapUI", "Fiddler", "Charles", "Wireshark",
            "GitHub Desktop", "GitKraken", "SourceTree", "TortoiseGit", "SmartGit", "Fork",
            "Docker Desktop", "Kubernetes", "Vagrant", "VirtualBox", "VMware", "Hyper-V",
            "Node.js", "npm", "yarn", "pnpm", "Python", "Java", "Go", "Rust", "Ruby", "PHP",
            "MySQL Workbench", "pgAdmin", "MongoDB Compass", "Redis Desktop Manager", "DBeaver",
            "HeidiSQL", "Navicat", "DataGrip", "TablePlus", "Sequel Pro", "phpMyAdmin",
            "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177", "\u652F\u4ED8\u5B9D\u5F00\u653E\u5E73\u53F0",
            "\u817E\u8BAF\u4E91", "\u963F\u91CC\u4E91", "\u767E\u5EA6\u4E91", "\u534E\u4E3A\u4E91"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_TEXT_EDITORS
        AdditionalKeywords = @(
            "Notepad", "Sublime", "Atom", "Vim", "Emacs", "TextEdit", "Notepad++", "UltraEdit",
            "EditPlus", "EmEditor", "Scrivener", "WriteMonkey", "FocusWriter", "Q10", "yWriter",
            "Typora", "Mark Text", "Zettlr", "Obsidian", "Notion", "Roam Research", "RemNote",
            "Joplin", "Standard Notes", "Bear", "Ulysses", "iA Writer", "Drafts", "Day One",
            "\u8BB0\u4E8B\u672C", "\u6709\u9053\u4E91\u7B14\u8BB0", "\u5370\u8C61\u7B14\u8BB0",
            "\u4E3A\u77E5\u7B14\u8BB0", "\u8BED\u96C0", "\u77F3\u58A8\u6587\u6863", "\u817E\u8BAF\u6587\u6863",
            "\u91D1\u5C71\u6587\u6863", "\u6C38\u4E2D\u96C6\u6210Office", "\u4E2D\u6807\u666E\u534E",
            "WPS Office", "LibreOffice", "OpenOffice", "FreeOffice", "OnlyOffice"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_MEDIA_TOOLS
        AdditionalKeywords = @(
            "Photoshop", "GIMP", "VLC", "Media Player", "Audacity", "OBS", "Adobe", "Premiere",
            "After Effects", "Illustrator", "InDesign", "Lightroom", "Acrobat", "Animate", "Audition",
            "Adobe Creative Cloud", "Adobe CC", "Adobe Bridge", "Adobe Camera Raw", "Adobe Dimension",
            "Adobe Dreamweaver", "Adobe Fresco", "Adobe XD", "Adobe Spark", "Adobe Stock", "Adobe Fonts",
            "Adobe Character Animator", "Adobe Media Encoder", "Adobe Prelude", "Adobe Rush", "Adobe Captivate",
            "Adobe FrameMaker", "Adobe InCopy", "Adobe Substance 3D", "Adobe Aero", "Adobe Comp CC",
            "Canva", "Figma", "Sketch", "Affinity", "CorelDRAW", "PaintShop", "Paint.NET",
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
            "\u5267\u5F71\u5927\u5168", "\u8FC5\u96F7\u5F71\u97F3", "PotPlayer", "KMPlayer", "GOM Player"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_OFFICE_TOOLS
        AdditionalKeywords = @(
            "Microsoft Office", "LibreOffice", "WPS", "Excel", "Word", "PowerPoint", "Outlook", "OneNote",
            "Access", "Publisher", "Project", "Visio", "Teams", "SharePoint", "OneDrive",
            "Google Workspace", "Google Docs", "Google Sheets", "Google Slides", "Google Drive",
            "Dropbox", "Box", "iCloud", "Mega", "pCloud", "Sync.com", "SpiderOak",
            "Slack", "Discord", "Zoom", "Skype", "WebEx", "GoToMeeting", "BlueJeans",
            "Trello", "Asana", "Monday.com", "Basecamp", "Jira", "Confluence", "Notion",
            "Evernote", "OneNote", "Bear", "Simplenote", "Google Keep", "Apple Notes",
            "PDF Creator", "PDFtk", "Foxit", "Nitro", "Bluebeam", "PDF-XChange",
            "\u91D1\u5C71\u529E\u516C", "\u6C38\u4E2D\u96C6\u6210Office", "\u4E2D\u6807\u666E\u534E",
            "\u817E\u8BAF\u4F1A\u8BAE", "\u9489\u9489", "\u4F01\u4E1A\u5FAE\u4FE1", "\u98DE\u4E66",
            "\u77F3\u58A8\u6587\u6863", "\u817E\u8BAF\u6587\u6863", "\u91D1\u5C71\u6587\u6863", "\u8BED\u96C0",
            "\u5370\u8C61\u7B14\u8BB0", "\u6709\u9053\u4E91\u7B14\u8BB0", "\u4E3A\u77E5\u7B14\u8BB0",
            "\u767E\u5EA6\u7F51\u76D8", "\u963F\u91CC\u4E91\u76D8", "\u817E\u8BAF\u5FAE\u4E91",
            "\u5929\u7FFC\u4E91\u76D8", "\u548C\u5F69\u4E91", "115\u7F51\u76D8", "\u8FC5\u96F7\u4E91\u76D8", "123\u4E91\u76D8", "123pan"
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
            "\u6620\u5BA2", "\u5168\u6C11\u5C0F\u89C6\u9891", "\u897F\u74DC\u89C6\u9891", "\u706B\u5C71\u5C0F\u89C6\u9891"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_COMPRESSION_TOOLS
        AdditionalKeywords = @(
            "WinRAR", "7-Zip", "Bandizip", "PeaZip", "Archive", "WinZip", "IZArc", "HaoZip",
            "360\u538B\u7F29", "\u597D\u538B", "\u5FEB\u538B", "2345\u597D\u538B", "\u9177\u538B",
            "PowerArchiver", "Ashampoo ZIP", "Express Zip", "Universal Extractor", "Zipware",
            "jZip", "Hamster ZIP", "TUGZip", "FreeArc", "KGB Archiver", "UltimateZip",
            "\u538B\u7F29\u5305", "\u89E3\u538B\u7F29", "\u6587\u4EF6\u538B\u7F29", "\u6587\u4EF6\u89E3\u538B"
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
            "Lucidchart", "Draw.io", "Creately", "Visual Paradigm", "Enterprise Architect",
            "\u6570\u636E\u5E93", "\u6570\u636E\u5E93\u7BA1\u7406", "SQL\u5DE5\u5177", "\u6570\u636E\u5EFA\u6A21"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_BROWSERS
        AdditionalKeywords = @(
            "Chrome", "Edge", "Firefox", "Safari", "Opera", "Brave", "Vivaldi", "Browser",
            "Internet Explorer", "IE", "Chromium", "Tor Browser", "DuckDuckGo", "Waterfox",
            "Pale Moon", "SeaMonkey", "Maxthon", "UC Browser", "Yandex Browser", "Cent Browser",
            "SRWare Iron", "Comodo Dragon", "Slimjet", "Torch Browser", "Avant Browser",
            "\u8C37\u6B4C\u6D4F\u89C8\u5668", "\u706B\u72D0\u6D4F\u89C8\u5668", "\u6B27\u670B\u6D4F\u89C8\u5668",
            "360\u6D4F\u89C8\u5668", "360\u6781\u901F\u6D4F\u89C8\u5668", "QQ\u6D4F\u89C8\u5668", "\u641C\u72D7\u6D4F\u89C8\u5668",
            "\u767E\u5EA6\u6D4F\u89C8\u5668", "UC\u6D4F\u89C8\u5668", "\u9177\u72D7\u6D4F\u89C8\u5668", "\u4E16\u754C\u4E4B\u7A97",
            "\u7EFF\u8272\u6D4F\u89C8\u5668", "\u795E\u7BAD\u624B", "\u5F69\u8679\u6D4F\u89C8\u5668", "\u5FC5\u5E94\u6D4F\u89C8\u5668",
            "\u6C34\u72D0\u6D4F\u89C8\u5668", "\u7231\u597D\u8005\u6D4F\u89C8\u5668", "\u5C0F\u767D\u6D4F\u89C8\u5668", "\u5343\u5F71\u6D4F\u89C8\u5668",
            "\u65D7\u9C7C\u6D4F\u89C8\u5668", "\u661F\u613F\u6D4F\u89C8\u5668", "\u95EA\u6E38\u6D4F\u89C8\u5668", "\u6D77\u8C5A\u6D4F\u89C8\u5668"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_GAMES
        AdditionalKeywords = @(
            "Steam", "Epic Games", "Origin", "Uplay", "Battle.net", "GOG Galaxy", "Xbox", "PlayStation",
            "Minecraft", "Roblox", "Fortnite", "League of Legends", "Dota 2", "Counter-Strike",
            "World of Warcraft", "Overwatch", "Apex Legends", "Valorant", "PUBG", "Among Us",
            "Fall Guys", "Rocket League", "Grand Theft Auto", "Call of Duty", "FIFA", "NBA 2K",
            "\u738B\u8005\u8363\u8000", "\u548C\u5E73\u7CBE\u82F1", "\u7EDD\u5730\u6C42\u751F", "\u82F1\u96C4\u8054\u76DF",
            "\u5B88\u671B\u5148\u950B", "\u7089\u77F3\u4F20\u8BF4", "\u9B54\u517D\u4E16\u754C", "\u5251\u7075",
            "\u68A6\u5E7B\u897F\u6E38", "\u5927\u8BDD\u897F\u6E38", "\u5929\u9F99\u516B\u90E8", "\u4ED9\u5251\u5947\u4FA0\u4F20",
            "\u4E09\u56FD\u6740", "\u6597\u5730\u4E3B", "\u9EBB\u5C06", "\u8C61\u68CB", "\u56F4\u68CB",
            "\u6E38\u620F\u5E73\u53F0", "\u6E38\u620F\u542F\u52A8\u5668", "\u6E38\u620F\u52A0\u901F\u5668", "\u6E38\u620F\u5DE5\u5177",
            "WeGame", "\u817E\u8BAF\u6E38\u620F\u5E73\u53F0", "\u7F51\u6613\u6E38\u620F", "\u5B8C\u7F8E\u4E16\u754C",
            "\u5DE8\u4EBA\u7F51\u7EDC", "\u76DB\u5927\u6E38\u620F", "\u897F\u5C71\u5C45\u6E38\u620F", "\u4E5D\u57CE\u6E38\u620F"
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
            "\u5BC6\u7801\u7BA1\u7406", "\u52A0\u5BC6\u8F6F\u4EF6", "\u9690\u79C1\u4FDD\u62A4", "\u6570\u636E\u52A0\u5BC6"
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
            "PowerToys", "Sysinternals Suite", "Windows Terminal", "Command Prompt", "PowerShell"
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
            "\u78C1\u529B\u94FE\u63A5", "BT\u4E0B\u8F7D", "\u7F51\u76D8\u4E0B\u8F7D", "\u89C6\u9891\u4E0B\u8F7D"
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
            "\u5B66\u4E60\u8F6F\u4EF6", "\u6559\u80B2\u5E73\u53F0", "\u5728\u7EBF\u5B66\u4E60", "\u8BED\u8A00\u5B66\u4E60"
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
            "\u8D22\u52A1\u8F6F\u4EF6", "\u8BB0\u8D26\u8F6F\u4EF6", "\u6295\u8D44\u7406\u8D22", "\u94F6\u884C\u5BA2\u6237\u7AEF"
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
            "\u8D2D\u7269\u8F6F\u4EF6", "\u7535\u5546\u5E73\u53F0", "\u5728\u7EBF\u8D2D\u7269", "\u624B\u673A\u8D2D\u7269"
        )
    },
    @{
        DesktopCategory    = $Global:DESKTOP_CATEGORY_NETWORK_TOOLS
        AdditionalKeywords = @(
            "RustDesk", "TeamViewer", "AnyDesk", "VNC", "Remote Desktop", "SSH", "Telnet",
            "PuTTY", "WinSCP", "FileZilla", "MobaXterm", "Wireshark", "Fiddler", "Charles", "Postman",
            "Insomnia", "SoapUI", "Swagger", "API", "REST", "GraphQL", "WebSocket",
            "FTP", "SFTP", "HTTP", "HTTPS", "TCP", "UDP", "DNS", "DHCP", "VPN",
            "Proxy", "Firewall", "Router", "Switch", "Gateway", "Load Balancer",
            "Network Monitor", "Bandwidth Monitor", "Packet Analyzer", "Network Scanner",
            "Ping", "Traceroute", "Netstat", "Ipconfig", "Nslookup", "Dig",
            "\u8FDC\u7A0B\u63A7\u5236", "\u8FDC\u7A0B\u8BBF\u95EE", "\u7F51\u7EDC\u5DE5\u5177",
            "\u7F51\u7EDC\u68C0\u6D4B", "\u7F51\u7EDC\u76D1\u63A7", "\u7F51\u7EDC\u5206\u6790",
            "\u7F51\u7EDC\u5B89\u5168", "\u7F51\u7EDC\u4F18\u5316", "\u7F51\u7EDC\u7BA1\u7406"
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
            "AI Testing", "AI Debugging", "AI Monitoring", "AI Analytics", "AI Reporting"
        )
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
    Performs comprehensive desktop icon organization by categories

.DESCRIPTION
    This function organizes all desktop shortcuts into predefined categories based on keywords.
    It creates category directories and desktop links, moves matching shortcuts, and provides
    detailed reporting of unmatched shortcuts. This is the main organization function that
    processes all categories defined in GlobalVars.ps1.

.PARAMETER ShowSummary
    Whether to display organization summary after completion (default: true)

.PARAMETER ExtractIcons
    Whether to extract icons from organized shortcuts (default: true)

.PARAMETER SpecificCategories
    Array of specific desktop categories to process. If empty, processes all categories (default: empty)

.EXAMPLE
    Invoke-DesktopIconOrganization

.EXAMPLE
    Invoke-DesktopIconOrganization -ShowSummary $false -ExtractIcons $false

.EXAMPLE
    Invoke-DesktopIconOrganization -SpecificCategories @("Development", "Media")
#>
function Invoke-DesktopIconOrganization {
    param(
        [Parameter(Mandatory = $false)]
        [bool]$ShowSummary = $true,

        [Parameter(Mandatory = $false)]
        [bool]$ExtractIcons = $true,

        [Parameter(Mandatory = $false)]
        [array]$SpecificCategories = @()
    )

    if (-not $Global:DESKTOP_CLEANUP_ENABLED) {
        Write-DesktopIconManagerDebug -Message "Desktop organization disabled, skipping" -ForegroundColor Gray
        return
    }

    Write-DesktopIconManagerDebug -Message "Starting comprehensive desktop icon organization..." -ForegroundColor Cyan

    # Variables declaration
    $unmatchedShortcuts = @()
    $processedShortcuts = @()
    $organizationResults = @{
        CategoriesProcessed = 0
        ShortcutsMoved = 0
        CategoriesCreated = 0
        UnmatchedShortcuts = 0
        Errors = @()
    }

    try {
        # Ensure the base desktop icons directory exists
        $baseDesktopIconsDir = $Global:DESKTOP_BACKUP_DIR
        Write-DesktopIconManagerDebug -Message "Base desktop icons directory: '$baseDesktopIconsDir'" -ForegroundColor Magenta
        if (-not (Test-Path $baseDesktopIconsDir)) {
            New-Item -ItemType Directory -Path $baseDesktopIconsDir -Force | Out-Null
            Write-DesktopIconManagerDebug -Message "Created base desktop icons directory: $baseDesktopIconsDir" -ForegroundColor Green
        }

        # Get desktop paths to scan
        $userDesktopPath = [Environment]::GetFolderPath('Desktop')
        $publicDesktopPath = Join-Path $env:PUBLIC "Desktop"
        $desktopPaths = @($userDesktopPath, $publicDesktopPath)

        Write-DesktopIconManagerDebug -Message "User desktop path: '$userDesktopPath'" -ForegroundColor Magenta
        Write-DesktopIconManagerDebug -Message "Public desktop path: '$publicDesktopPath'" -ForegroundColor Magenta

        # Validate organization categories
        if (-not (Test-OrganizationCategories)) {
            throw "Organization categories validation failed"
        }

        # Determine which categories to process
        $categoriesToProcess = if ($SpecificCategories.Count -gt 0) {
            # Filter to only specified categories
            $Global:DESKTOP_ORGANIZATION_CATEGORIES | Where-Object {
                $categoryName = $_.DesktopCategory
                $SpecificCategories -contains $categoryName
            }
        } else {
            # Process all categories (default behavior)
            $Global:DESKTOP_ORGANIZATION_CATEGORIES
        }

        Write-DesktopIconManagerDebug -Message "Categories to process: $($categoriesToProcess.Count) out of $($Global:DESKTOP_ORGANIZATION_CATEGORIES.Count)" -ForegroundColor Cyan

        # Process each organization category
        foreach ($categoryConfig in $categoriesToProcess) {
            $categoryName = $categoryConfig.DesktopCategory
            $keywords = $categoryConfig.AdditionalKeywords

            Write-DesktopIconManagerDebug -Message "Processing category: $categoryName" -ForegroundColor Cyan
            Write-DesktopIconManagerDebug -Message "Keywords: $($keywords -join ', ')" -ForegroundColor Cyan

            $categoryResult = Invoke-CategoryOrganization -CategoryName $categoryName -Keywords $keywords -DesktopPaths $desktopPaths -BaseDirectory $baseDesktopIconsDir -ProcessedShortcuts ([ref]$processedShortcuts)

            $organizationResults.CategoriesProcessed++
            $organizationResults.ShortcutsMoved += $categoryResult.ShortcutsMoved
            if ($categoryResult.CategoryCreated) {
                $organizationResults.CategoriesCreated++
            }
            if ($categoryResult.Errors.Count -gt 0) {
                $organizationResults.Errors += $categoryResult.Errors
            }
        }

        # Collect unmatched shortcuts after all categories are processed
        Write-DesktopIconManagerDebug -Message "Collecting unmatched shortcuts..." -ForegroundColor Cyan
        $unmatchedShortcuts = Get-UnmatchedShortcuts -DesktopPaths $desktopPaths -ProcessedShortcuts $processedShortcuts
        $organizationResults.UnmatchedShortcuts = $unmatchedShortcuts.Count

        # Display unmatched shortcuts
        if ($unmatchedShortcuts.Count -gt 0) {
            Show-UnmatchedShortcuts -UnmatchedShortcuts $unmatchedShortcuts
        } else {
            Write-DesktopIconManagerDebug -Message "All desktop shortcuts have been matched and organized!" -ForegroundColor Green
        }

        # Show organization summary
        if ($ShowSummary) {
            Show-OrganizationSummary
        }

        # Extract icons from organized shortcuts
        if ($ExtractIcons) {
            Invoke-IconExtraction -BaseDirectory $baseDesktopIconsDir
        }

        Write-DesktopIconManagerDebug -Message "Desktop icon organization completed successfully" -ForegroundColor Green
        Write-DesktopIconManagerDebug -Message "Results: Categories: $($organizationResults.CategoriesProcessed), Moved: $($organizationResults.ShortcutsMoved), Unmatched: $($organizationResults.UnmatchedShortcuts)" -ForegroundColor Green

    } catch {
        $errorMsg = "Desktop icon organization failed: $($_.Exception.Message)"
        $organizationResults.Errors += $errorMsg
        Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
    }

    return $organizationResults
}

<#
.SYNOPSIS
    Organizes shortcuts for a single category

.DESCRIPTION
    Processes a single category by scanning for matching shortcuts, creating category
    directories and desktop links, and moving/copying shortcuts as appropriate.
#>
function Invoke-CategoryOrganization {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CategoryName,

        [Parameter(Mandatory = $true)]
        [array]$Keywords,

        [Parameter(Mandatory = $true)]
        [array]$DesktopPaths,

        [Parameter(Mandatory = $true)]
        [string]$BaseDirectory,

        [Parameter(Mandatory = $true)]
        [ref]$ProcessedShortcuts
    )

    # Variables declaration
    $categoryResult = @{
        CategoryName = $CategoryName
        ShortcutsMoved = 0
        CategoryCreated = $false
        Errors = @()
    }

    $categoryDir = Join-Path $BaseDirectory $CategoryName
    $userDesktopPath = [Environment]::GetFolderPath('Desktop')

    try {
        # First, scan to see if any shortcuts match this category
        $hasMatches = Test-CategoryHasMatches -CategoryName $CategoryName -Keywords $Keywords -DesktopPaths $DesktopPaths -CategoryDirectory $categoryDir

        # Only create category directory and link if there are matches
        if ($hasMatches) {
            Write-DesktopIconManagerDebug -Message "Category '$CategoryName' has matching shortcuts, creating directory and link" -ForegroundColor Green

            # Create category directory
            if (-not (Test-Path $categoryDir)) {
                New-Item -ItemType Directory -Path $categoryDir -Force | Out-Null
                Write-DesktopIconManagerDebug -Message "Created category directory: $categoryDir" -ForegroundColor Green
                $categoryResult.CategoryCreated = $true
            }

            # Create symbolic link to category directory on desktop
            $desktopCategoryPath = Join-Path $userDesktopPath "$CategoryName.lnk"
            if (-not (Test-Path $desktopCategoryPath)) {
                try {
                    New-Item -ItemType SymbolicLink -Path $desktopCategoryPath -Target $categoryDir -Force | Out-Null
                    Write-DesktopIconManagerDebug -Message "Linked category directory to desktop: $desktopCategoryPath" -ForegroundColor Green
                } catch {
                    Write-DesktopIconManagerDebug -Message "Warning: Could not create symbolic link for category: $CategoryName" -ForegroundColor Yellow
                }
            }
        } else {
            Write-DesktopIconManagerDebug -Message "Category '$CategoryName' has no matching shortcuts, skipping directory creation" -ForegroundColor Yellow
        }

        # Scan desktop for matching shortcuts and move them
        $movedCount = Move-ShortcutsToCategory -CategoryName $CategoryName -Keywords $Keywords -DesktopPaths $DesktopPaths -CategoryDirectory $categoryDir -ProcessedShortcuts $ProcessedShortcuts
        $categoryResult.ShortcutsMoved = $movedCount

        # Clean up empty directory and desktop link if no shortcuts were moved and no existing shortcuts
        $existingShortcutsCount = 0
        if (Test-Path $categoryDir) {
            $existingShortcuts = @(Get-ChildItem -Path $categoryDir -Filter "*.lnk" -ErrorAction SilentlyContinue)
            $existingShortcutsCount = $existingShortcuts.Count
        }

        $totalShortcuts = $movedCount + $existingShortcutsCount
        if ($totalShortcuts -eq 0) {
            # Remove empty category directory if it exists
            if (Test-Path $categoryDir) {
                Remove-Item -Path $categoryDir -Recurse -Force -ErrorAction SilentlyContinue
                Write-DesktopIconManagerDebug -Message "Removed empty category directory: $categoryDir" -ForegroundColor Yellow
            }

            # Remove desktop link if it exists
            $desktopCategoryPath = Join-Path $userDesktopPath "$CategoryName.lnk"
            if (Test-Path $desktopCategoryPath) {
                Remove-Item -Path $desktopCategoryPath -Force -ErrorAction SilentlyContinue
                Write-DesktopIconManagerDebug -Message "Removed category link from desktop: $desktopCategoryPath" -ForegroundColor Yellow
            }
        }

        Write-DesktopIconManagerDebug -Message "Category '$CategoryName' processing completed. Moved $movedCount shortcuts." -ForegroundColor Green

    } catch {
        $errorMsg = "Category organization failed for ${CategoryName}: $($_.Exception.Message)"
        $categoryResult.Errors += $errorMsg
        Write-DesktopIconManagerDebug -Message $errorMsg -ForegroundColor Red
    }

    return $categoryResult
}

<#
.SYNOPSIS
    Tests if a category has matching shortcuts

.DESCRIPTION
    Scans desktop paths to determine if any shortcuts match the category keywords.
    This is used to decide whether to create category directories and links.
#>
function Test-CategoryHasMatches {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CategoryName,

        [Parameter(Mandatory = $true)]
        [array]$Keywords,

        [Parameter(Mandatory = $true)]
        [array]$DesktopPaths,

        [Parameter(Mandatory = $true)]
        [string]$CategoryDirectory
    )

    # Check if category directory already has shortcuts
    if (Test-Path $CategoryDirectory) {
        $existingShortcuts = @(Get-ChildItem -Path $CategoryDirectory -Filter "*.lnk" -ErrorAction SilentlyContinue)
        if ($existingShortcuts.Count -gt 0) {
            Write-DesktopIconManagerDebug -Message "Found $($existingShortcuts.Count) existing shortcuts in category directory" -ForegroundColor Green
            return $true
        }
    }

    # Scan desktop for matching shortcuts
    foreach ($keyword in $Keywords) {
        foreach ($desktopPath in $DesktopPaths) {
            if (-not (Test-Path $desktopPath)) {
                continue
            }

            try {
                $lnkFiles = [System.IO.Directory]::GetFiles($desktopPath, "*.lnk")
                foreach ($filePath in $lnkFiles) {
                    $shortcut = Get-Item $filePath

                    # Skip if this is already a category folder link
                    if ($shortcut.Name -like "*$CategoryName*") {
                        continue
                    }

                    # Check if shortcut matches keyword (with Unicode conversion)
                    if (Test-ShortcutMatchesKeyword -ShortcutName $shortcut.Name -Keyword $keyword) {
                        # Verify this is a valid application shortcut
                        if (Test-ValidShortcut -ShortcutPath $shortcut.FullName) {
                            return $true
                        }
                    }
                }
            } catch {
                # Fallback to PowerShell method
                $desktopShortcuts = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -ErrorAction SilentlyContinue
                foreach ($shortcut in $desktopShortcuts) {
                    # Skip if this is already a category folder link
                    if ($shortcut.Name -like "*$CategoryName*") {
                        continue
                    }

                    # Check if shortcut matches keyword
                    if (Test-ShortcutMatchesKeyword -ShortcutName $shortcut.Name -Keyword $keyword) {
                        if (Test-ValidShortcut -ShortcutPath $shortcut.FullName) {
                            return $true
                        }
                    }
                }
            }
        }
    }

    return $false
}

<#
.SYNOPSIS
    Tests if a shortcut name matches a keyword

.DESCRIPTION
    Performs comprehensive keyword matching including Unicode conversion for international characters.
#>
function Test-ShortcutMatchesKeyword {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ShortcutName,

        [Parameter(Mandatory = $true)]
        [string]$Keyword
    )

    # Convert Unicode escape sequences to actual characters for comparison
    $actualKeyword = $Keyword
    if ($Keyword -match '\\u[0-9A-Fa-f]{4}') {
        try {
            $actualKeyword = [regex]::Replace($Keyword, '\\u([0-9A-Fa-f]{4})', {
                param($match)
                [char][int]("0x" + $match.Groups[1].Value)
            })
            Write-DesktopIconManagerDebug -Message "Converted Unicode '$Keyword' to '$actualKeyword'" -ForegroundColor Magenta
        } catch {
            $actualKeyword = $Keyword
        }
    }

    # Multiple matching methods
    $keywordMatch = ($ShortcutName -like "*$actualKeyword*") -or
                   ($ShortcutName -like "*$Keyword*") -or
                   ($ShortcutName.ToLower() -like "*$($actualKeyword.ToLower())*") -or
                   ($ShortcutName.ToLower() -like "*$($Keyword.ToLower())*")

    return $keywordMatch
}

<#
.SYNOPSIS
    Tests if a shortcut is valid (has a valid target)

.DESCRIPTION
    Verifies that a shortcut file points to a valid executable target.
#>
function Test-ValidShortcut {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ShortcutPath
    )

    try {
        $shell = New-Object -ComObject WScript.Shell
        $targetPath = $shell.CreateShortcut($ShortcutPath).TargetPath

        return ($targetPath -and $targetPath -ne "" -and (Test-Path $targetPath -PathType Leaf))
    } catch {
        return $false
    }
}

<#
.SYNOPSIS
    Moves shortcuts matching keywords to a category directory

.DESCRIPTION
    Scans desktop paths for shortcuts matching the provided keywords and moves them
    to the specified category directory. Handles special cases like browsers that
    should be copied instead of moved.
#>
function Move-ShortcutsToCategory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CategoryName,

        [Parameter(Mandatory = $true)]
        [array]$Keywords,

        [Parameter(Mandatory = $true)]
        [array]$DesktopPaths,

        [Parameter(Mandatory = $true)]
        [string]$CategoryDirectory,

        [Parameter(Mandatory = $true)]
        [ref]$ProcessedShortcuts
    )

    # Variables declaration
    $movedCount = 0
    $userDesktopPath = [Environment]::GetFolderPath('Desktop')

    foreach ($keyword in $Keywords) {
        Write-DesktopIconManagerDebug -Message "Scanning for keyword: '$keyword'" -ForegroundColor Yellow

        foreach ($desktopPath in $DesktopPaths) {
            if (-not (Test-Path $desktopPath)) {
                continue
            }

            # Get all shortcuts on desktop
            try {
                $lnkFiles = [System.IO.Directory]::GetFiles($desktopPath, "*.lnk")
                $desktopShortcuts = @()
                foreach ($filePath in $lnkFiles) {
                    $desktopShortcuts += Get-Item $filePath
                }
            } catch {
                # Fallback to PowerShell method
                $desktopShortcuts = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -ErrorAction SilentlyContinue
            }

            foreach ($shortcut in $desktopShortcuts) {
                # Skip if this is already a category folder link
                if ($shortcut.Name -like "*$CategoryName*") {
                    continue
                }

                # Check if shortcut matches keyword
                if (Test-ShortcutMatchesKeyword -ShortcutName $shortcut.Name -Keyword $keyword) {
                    # Create category directory and desktop link on first match
                    if ($movedCount -eq 0) {
                        # Create category directory
                        if (-not (Test-Path $CategoryDirectory)) {
                            New-Item -ItemType Directory -Path $CategoryDirectory -Force | Out-Null
                            Write-DesktopIconManagerDebug -Message "Created category directory: $CategoryDirectory" -ForegroundColor Green
                        }

                        # Create symbolic link to category directory on desktop
                        $desktopCategoryPath = Join-Path $userDesktopPath "$CategoryName.lnk"
                        if (-not (Test-Path $desktopCategoryPath)) {
                            try {
                                New-Item -ItemType SymbolicLink -Path $desktopCategoryPath -Target $CategoryDirectory -Force | Out-Null
                                Write-DesktopIconManagerDebug -Message "Linked category directory to desktop: $desktopCategoryPath" -ForegroundColor Green
                            } catch {
                                Write-DesktopIconManagerDebug -Message "Warning: Could not create symbolic link for category: $CategoryName" -ForegroundColor Yellow
                            }
                        }
                    }

                    # Add to processed list to avoid duplicate processing
                    if ($ProcessedShortcuts.Value -notcontains $shortcut.FullName) {
                        $ProcessedShortcuts.Value += $shortcut.FullName
                    }

                    # Verify this is a valid application shortcut
                    if (-not (Test-ValidShortcut -ShortcutPath $shortcut.FullName)) {
                        Write-DesktopIconManagerDebug -Message "Skipping invalid shortcut: $($shortcut.Name)" -ForegroundColor DarkGray
                        continue
                    }

                    # Check if this is a special browser that should also stay on desktop
                    $shouldKeepOnDesktop = $false
                    $isBrowserCategory = ($CategoryName -eq $Global:DESKTOP_CATEGORY_BROWSERS)
                    $isSpecialBrowser = ($shortcut.Name -like "*Chrome*" -or $shortcut.Name -like "*Edge*")

                    if ($isBrowserCategory -and $isSpecialBrowser) {
                        $shouldKeepOnDesktop = $true
                        Write-DesktopIconManagerDebug -Message "Special browser detected: $($shortcut.Name) - will keep copy on desktop" -ForegroundColor Cyan
                    }

                    # Move or copy shortcut to category directory
                    $targetShortcutPath = Join-Path $CategoryDirectory $shortcut.Name

                    # Remove existing shortcut in category if it exists
                    if (Test-Path $targetShortcutPath) {
                        Remove-Item $targetShortcutPath -Force
                        Write-DesktopIconManagerDebug -Message "Removed existing shortcut in category: $targetShortcutPath" -ForegroundColor Yellow
                    }

                    try {
                        if ($shouldKeepOnDesktop) {
                            # Copy instead of move for special browsers
                            Copy-Item -Path $shortcut.FullName -Destination $targetShortcutPath -Force
                            Write-DesktopIconManagerDebug -Message "Copied shortcut '$($shortcut.Name)' to category '$CategoryName' (kept on desktop)" -ForegroundColor Green
                        } else {
                            # Move for regular applications
                            Move-Item -Path $shortcut.FullName -Destination $targetShortcutPath -Force
                            Write-DesktopIconManagerDebug -Message "Moved shortcut '$($shortcut.Name)' to category '$CategoryName'" -ForegroundColor Green
                        }
                        $movedCount++
                    } catch {
                        Write-DesktopIconManagerDebug -Message "Warning: Could not process shortcut '$($shortcut.Name)': $($_.Exception.Message)" -ForegroundColor Yellow
                    }
                }
            }
        }
    }

    return $movedCount
}

<#
.SYNOPSIS
    Gets unmatched shortcuts after category processing

.DESCRIPTION
    Collects all desktop shortcuts that were not processed by any category.
    These shortcuts are candidates for new categories or manual organization.
#>
function Get-UnmatchedShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [array]$DesktopPaths,

        [Parameter(Mandatory = $true)]
        [array]$ProcessedShortcuts
    )

    # Variables declaration
    $unmatchedShortcuts = @()

    foreach ($desktopPath in $DesktopPaths) {
        if (-not (Test-Path $desktopPath)) {
            continue
        }

        try {
            $lnkFiles = [System.IO.Directory]::GetFiles($desktopPath, "*.lnk")
            foreach ($filePath in $lnkFiles) {
                $shortcut = Get-Item $filePath

                # Skip category folder links and already processed shortcuts
                $isCategoryLink = $false
                foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
                    if ($shortcut.Name -like "*$($categoryConfig.DesktopCategory)*") {
                        $isCategoryLink = $true
                        break
                    }
                }

                if (-not $isCategoryLink -and $ProcessedShortcuts -notcontains $shortcut.FullName) {
                    # Verify this is a valid application shortcut
                    if (Test-ValidShortcut -ShortcutPath $shortcut.FullName) {
                        $shell = New-Object -ComObject WScript.Shell
                        $targetPath = $shell.CreateShortcut($shortcut.FullName).TargetPath

                        $unmatchedShortcuts += @{
                            Name = $shortcut.Name
                            FullPath = $shortcut.FullName
                            TargetPath = $targetPath
                            DesktopPath = $desktopPath
                        }
                    }
                }
            }
        } catch {
            # Fallback to PowerShell method
            $desktopShortcuts = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -ErrorAction SilentlyContinue
            foreach ($shortcut in $desktopShortcuts) {
                # Skip category folder links and already processed shortcuts
                $isCategoryLink = $false
                foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
                    if ($shortcut.Name -like "*$($categoryConfig.DesktopCategory)*") {
                        $isCategoryLink = $true
                        break
                    }
                }

                if (-not $isCategoryLink -and $ProcessedShortcuts -notcontains $shortcut.FullName) {
                    if (Test-ValidShortcut -ShortcutPath $shortcut.FullName) {
                        $shell = New-Object -ComObject WScript.Shell
                        $targetPath = $shell.CreateShortcut($shortcut.FullName).TargetPath

                        $unmatchedShortcuts += @{
                            Name = $shortcut.Name
                            FullPath = $shortcut.FullName
                            TargetPath = $targetPath
                            DesktopPath = $desktopPath
                        }
                    }
                }
            }
        }
    }

    return $unmatchedShortcuts
}

<#
.SYNOPSIS
    Displays unmatched shortcuts report

.DESCRIPTION
    Shows a detailed report of shortcuts that were not matched by any category.
    This helps users identify potential new categories to add.
#>
function Show-UnmatchedShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [array]$UnmatchedShortcuts
    )

    Write-DesktopIconManagerDebug -Message "UNMATCHED DESKTOP SHORTCUTS ($($UnmatchedShortcuts.Count) found):" -ForegroundColor Yellow
    Write-DesktopIconManagerDebug -Message "Consider adding these to DESKTOP_ORGANIZATION_CATEGORIES in GlobalVars.ps1" -ForegroundColor Yellow

    foreach ($shortcut in $UnmatchedShortcuts) {
        Write-DesktopIconManagerDebug -Message "  - $($shortcut.Name)" -ForegroundColor White
        Write-DesktopIconManagerDebug -Message "    Target: $($shortcut.TargetPath)" -ForegroundColor DarkGray
        Write-DesktopIconManagerDebug -Message "    Location: $($shortcut.DesktopPath)" -ForegroundColor DarkGray
    }

}

<#
.SYNOPSIS
    Creates category summary report

.DESCRIPTION
    Displays a summary of all categories and their organized shortcuts.
#>
function Show-OrganizationSummary {
    Write-DesktopIconManagerDebug -Message "Desktop Icon Organization Summary:" -ForegroundColor Cyan

    $baseDesktopIconsDir = $Global:DESKTOP_BACKUP_DIR

    foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
        $categoryName = $categoryConfig.DesktopCategory
        $categoryDir = Join-Path $baseDesktopIconsDir $categoryName

        if (Test-Path $categoryDir) {
            $shortcuts = @(Get-ChildItem -Path $categoryDir -Filter "*.lnk" -ErrorAction SilentlyContinue)
            $shortcutCount = $shortcuts.Count

            Write-DesktopIconManagerDebug -Message "Category: $categoryName ($shortcutCount shortcuts)" -ForegroundColor Green
            if ($shortcuts -and $shortcuts.Count -gt 0) {
                foreach ($shortcut in $shortcuts) {
                    Write-DesktopIconManagerDebug -Message "  - $($shortcut.Name)" -ForegroundColor White
                }
            }
        } else {
            Write-DesktopIconManagerDebug -Message "Category: $categoryName (directory not found)" -ForegroundColor Yellow
        }
    }

}

<#
.SYNOPSIS
    Validates organization categories configuration

.DESCRIPTION
    Checks that the DESKTOP_ORGANIZATION_CATEGORIES global variable is properly
    configured with required fields.
#>
function Test-OrganizationCategories {
    Write-DesktopIconManagerDebug -Message "Validating organization categories..." -ForegroundColor Cyan

    # Variables declaration
    $validationErrors = @()

    if (-not $Global:DESKTOP_ORGANIZATION_CATEGORIES -or $Global:DESKTOP_ORGANIZATION_CATEGORIES.Count -eq 0) {
        $validationErrors += "DESKTOP_ORGANIZATION_CATEGORIES is empty or not defined"
    } else {
        foreach ($categoryConfig in $Global:DESKTOP_ORGANIZATION_CATEGORIES) {
            if (-not $categoryConfig.ContainsKey("DesktopCategory") -or -not $categoryConfig.DesktopCategory) {
                $validationErrors += "Category configuration missing DesktopCategory"
            }

            if (-not $categoryConfig.ContainsKey("AdditionalKeywords") -or -not $categoryConfig.AdditionalKeywords) {
                $validationErrors += "Category '$($categoryConfig.DesktopCategory)' missing AdditionalKeywords"
            }
        }
    }

    if ($validationErrors.Count -gt 0) {
        Write-DesktopIconManagerDebug -Message "Validation errors found:" -ForegroundColor Red
        foreach ($validationError in $validationErrors) {
            Write-DesktopIconManagerDebug -Message "  - $validationError" -ForegroundColor Red
        }
        return $false
    }

    Write-DesktopIconManagerDebug -Message "Validation completed successfully." -ForegroundColor Green
    return $true
}

<#
.SYNOPSIS
    Extracts icons from organized shortcuts

.DESCRIPTION
    Extracts application icons from all organized shortcuts and saves them as PNG files
    in a structured directory hierarchy matching the organization categories.
#>
function Invoke-IconExtraction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseDirectory
    )

    Write-DesktopIconManagerDebug -Message "Starting icon extraction from organized shortcuts..." -ForegroundColor Cyan

    try {
        # Create icons directory in USER_DIR
        $iconsOutputDir = Join-Path $Global:USER_DIR ".icons"

        if (Test-Path $BaseDirectory) {
            # Simple icon extraction function
            function Extract-SimpleIcon {
                param($FilePath, $OutputPath)
                try {
                    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

                    $targetPath = $FilePath
                    if ($FilePath.EndsWith('.lnk')) {
                        try {
                            $shell = New-Object -ComObject WScript.Shell
                            $shortcut = $shell.CreateShortcut($FilePath)
                            if ($shortcut.TargetPath -and (Test-Path $shortcut.TargetPath)) {
                                $targetPath = $shortcut.TargetPath
                            }
                        } catch { }
                    }

                    if ($targetPath.EndsWith('.exe') -and (Test-Path $targetPath)) {
                        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($targetPath)
                        if ($icon) {
                            $bitmap = $icon.ToBitmap()
                            $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                            $bitmap.Dispose()
                            $icon.Dispose()
                            return $true
                        }
                    }
                } catch { }
                return $false
            }

            # Extract icons from all .lnk files
            $extractedCount = 0
            $lnkFiles = Get-ChildItem -Path $BaseDirectory -Recurse -Include "*.lnk" -File

            foreach ($file in $lnkFiles) {
                try {
                    # Calculate relative path
                    $relativePath = $file.FullName.Substring($BaseDirectory.Length).TrimStart('\')
                    $relativeDir = Split-Path $relativePath -Parent

                    # Create output directory
                    $outputDir = if ([string]::IsNullOrEmpty($relativeDir)) {
                        $iconsOutputDir
                    } else {
                        Join-Path $iconsOutputDir $relativeDir
                    }

                    if (-not (Test-Path $outputDir)) {
                        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
                    }

                    # Generate icon name
                    $iconName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                    $outputPath = Join-Path $outputDir "$iconName.png"

                    if (Extract-SimpleIcon -FilePath $file.FullName -OutputPath $outputPath) {
                        Write-DesktopIconManagerDebug -Message "Extracted icon: $iconName" -ForegroundColor Green
                        $extractedCount++
                    }
                } catch {
                    Write-DesktopIconManagerDebug -Message "Failed to extract icon from: $($file.Name)" -ForegroundColor Yellow
                }
            }

            Write-DesktopIconManagerDebug -Message "Icon extraction completed! Extracted $extractedCount icons to: $iconsOutputDir" -ForegroundColor Green
        } else {
            Write-DesktopIconManagerDebug -Message "Desktop icons directory not found: $BaseDirectory" -ForegroundColor Yellow
        }
    } catch {
        Write-DesktopIconManagerDebug -Message "Error during icon extraction: $($_.Exception.Message)" -ForegroundColor Red
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

