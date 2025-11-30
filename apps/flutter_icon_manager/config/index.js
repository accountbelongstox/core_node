// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');

const config = {
    // Flutter project configuration - hardcoded paths and settings
    flutter: {
        // Project root path - modify this to your Flutter project
        projectPath: './poly_apps/flutter_bloom',
        // External main directory for additional apps
        externalMainDir: './poly_apps',
        // Flutter sub apps to process (empty array = all apps)
        selectedApps: []
    },
    
    // Action to perform
    action: 'scan', // scan, replace, batch-replace, compress, resize, export-report, copy-to-platforms, analyze
    
    // Image processing settings
    processing: {
        // Source image path for replace operations
        sourcePath: './assets/new_icon.png',
        // Target image path for single replace
        targetPath: './android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
        // Multiple target paths for batch replace
        targetPaths: [
            './android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
            './android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
            './android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'
        ],
        // Target icon name pattern for copy-to-platforms
        targetName: 'ic_launcher',
        // Platforms to target
        platforms: ['android', 'ios', 'windows', 'web'],
        // Image dimensions for resize
        width: 256,
        height: 256,
        // Compression quality (0-100)
        quality: 85,
        // Output format
        format: 'png'
    },
    
    // Output settings
    output: {
        // Report export path
        reportPath: './flutter_icon_report.json',
        // Enable backup creation
        createBackups: true,
        // Auto resize when replacing
        autoResize: true
    },
    
    // Image scanning settings
    scanning: {
        // Image file extensions to scan
        imageExtensions: ['.png', '.jpg', '.jpeg', '.ico', '.icns', '.gif', '.webp', '.svg'],
        // Target directories to scan (empty = default Flutter platforms)
        targetDirs: [],
        // Platforms to scan
        platforms: ['android', 'ios', 'windows', 'web'],
        // Include subdirectories
        recursive: true
    },
    
    // Analysis settings
    analysis: {
        // Compliance threshold for recommendations
        complianceThreshold: 0.8,
        // File size threshold for compression (KB)
        compressionThreshold: 500,
        // Enable intelligent classification
        enableClassification: true,
        // Enable size recommendations
        enableSizeRecommendations: true,
        // Enable compression recommendations
        enableCompressionRecommendations: true
    },
    
    // Debug and logging
    debug: {
        // Enable verbose logging
        verbose: true,
        // Print scan results
        printResults: true,
        // Print analysis details
        printAnalysis: true
    }
};

module.exports = config;