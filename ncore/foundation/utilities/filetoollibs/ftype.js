'use strict';
const path = require('path');
const fs = require('fs');

function isFile(filePath) {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function isImageFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const imageExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
        '.tiff', '.ico', '.svg', '.raw', '.heic', '.heif',
        '.psd', '.ai', '.eps', '.pdf', '.xcf'
    ];
    return imageExtensions.includes(ext);
}

function isCompressedFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath).toLowerCase();
    
    // Common compressed file extensions
    const compressedExtensions = [
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
        '.xz', '.tgz', '.tbz2', '.txz', '.z', '.lz',
        '.lzma', '.tlz', '.ar', '.cpio', '.shar',
        '.lzh', '.lha'
    ];
    
    // Special compound extensions
    const compoundExtensions = [
        '.tar.gz', '.tar.bz2', '.tar.xz',
        '.tar.lz', '.tar.lzma'
    ];

    // Check for compound extensions
    if (compoundExtensions.some(compoundExt => filename.endsWith(compoundExt))) {
        return true;
    }

    return compressedExtensions.includes(ext);
}

function isVideoFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const videoExtensions = [
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv',
        '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.3g2',
        '.ogv', '.vob', '.divx', '.m2ts', '.mts', '.ts',
        '.asf', '.rm', '.rmvb'
    ];
    return videoExtensions.includes(ext);
}

function isAudioFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const audioExtensions = [
        '.mp3', '.wav', '.ogg', '.m4a', '.wma', '.aac',
        '.flac', '.alac', '.aiff', '.ape', '.opus',
        '.mid', '.midi', '.amr', '.ac3', '.dts',
        '.ra', '.rm', '.wv', '.tta', '.dsf', '.dff'
    ];
    return audioExtensions.includes(ext);
}

function isDocumentFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const documentExtensions = [
        // Microsoft Office formats
        '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.rtf', '.odt', '.ods', '.odp', '.odg', '.odf',
        // OpenDocument formats
        '.odt', '.ods', '.odp', '.odg', '.odf',
        // Text document formats
        '.txt', '.md', '.markdown', '.tex', '.pdf',
        // Web document formats
        '.html', '.htm', '.xhtml', '.mht', '.mhtml',
        // E-book formats
        '.epub', '.mobi', '.azw', '.azw3', '.djvu',
        '.fb2', '.lit', '.prc'
    ];
    return documentExtensions.includes(ext);
}

function isExecutableFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const executableExtensions = [
        // Windows executable formats
        '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
        '.com', '.scr', '.reg',
        // Unix executable formats
        '.sh', '.bash', '.csh', '.zsh', '.ksh',
        // Script formats
        '.py', '.pl', '.rb', '.js', '.php', '.jar'
    ];
    return executableExtensions.includes(ext);
}

function isCodeFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const codeExtensions = [
        // Web development formats
        '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx',
        '.php', '.asp', '.aspx', '.jsp', '.vue', '.svelte',
        // Programming language formats
        '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.py',
        '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
        '.pl', '.pm', '.t', '.lua', '.r', '.d',
        // Script formats
        '.sh', '.bash', '.ps1', '.bat', '.cmd',
        // Data formats
        '.json', '.xml', '.yaml', '.yml', '.toml',
        // Other formats
        '.sql', '.gradle', '.cmake', '.mk', '.pro'
    ];
    return codeExtensions.includes(ext);
}

function isDatabaseFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const databaseExtensions = [
        '.db', '.sqlite', '.sqlite3', '.db3',
        '.mdb', '.accdb', '.fdb', '.gdb',
        '.mdf', '.ldf', '.bak', '.dmp',
        '.frm', '.ibd', '.ibdata', '.rdb'
    ];
    return databaseExtensions.includes(ext);
}

function isFontFile(filePath) {
    if (!isFile(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    const fontExtensions = [
        '.ttf', '.otf', '.woff', '.woff2',
        '.eot', '.pfm', '.pfb', '.sfd',
        '.bdf', '.psf', '.fon', '.fnt'
    ];
    return fontExtensions.includes(ext);
}

module.exports = {
    isFile,
    isImageFile,
    isCompressedFile,
    isVideoFile,
    isAudioFile,
    isDocumentFile,
    isExecutableFile,
    isCodeFile,
    isDatabaseFile,
    isFontFile
}; 