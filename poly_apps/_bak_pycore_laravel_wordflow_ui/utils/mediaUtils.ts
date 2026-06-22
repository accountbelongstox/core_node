import { FileNode } from "../types";

// Mapping for Chinese numerals to Arabic for sorting
const CN_NUM_MAP: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, 
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '第': 0, '课': 0, '章': 0, '节': 0 // Ignored structural chars
};

/**
 * Advanced Natural Sort Algorithm
 * Handles: "1, 2, 10", "Lesson 1", "第一课", "一, 二, 三"
 */
export const smartSortFiles = (files: FileNode[]): FileNode[] => {
  return [...files].sort((a, b) => {
    // 1. Prioritize Folders over Files
    if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
    }

    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();

    // 2. Extract Numbers (Arabic)
    const numA = nameA.match(/\d+/g);
    const numB = nameB.match(/\d+/g);

    // If both have numbers at similar positions, compare numbers
    if (numA && numB && numA.length === numB.length) {
       // Compare first extracted number group usually sufficient for "Lesson 1" vs "Lesson 2"
       const valA = parseInt(numA[0]);
       const valB = parseInt(numB[0]);
       if (valA !== valB) return valA - valB;
    }

    // 3. Check for Chinese Numerals
    const cnValA = extractChineseNumber(nameA);
    const cnValB = extractChineseNumber(nameB);
    
    if (cnValA > 0 && cnValB > 0 && cnValA !== cnValB) {
        return cnValA - cnValB;
    }

    // 4. Default Locale Compare (Numeric enabled for standard cases)
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

const extractChineseNumber = (str: string): number => {
    let val = 0;
    // Simple extraction for "第一", "二", etc.
    for (const char of str) {
        if (CN_NUM_MAP[char]) {
            val += CN_NUM_MAP[char];
        }
    }
    return val;
};

/**
 * Recursive function to process Webkit entries (Upload Folder)
 */
export const processFileEntries = async (files: FileList): Promise<FileNode[]> => {
    const root: FileNode[] = [];
    
    // Simplistic Mapper: path/to/file -> nested objects
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pathParts = file.webkitRelativePath.split('/'); // "Folder/Sub/File.png"
        
        let currentLevel = root;
        
        // Iterate path parts
        for (let j = 0; j < pathParts.length; j++) {
            const part = pathParts[j];
            const isFile = j === pathParts.length - 1;
            
            let existingNode = currentLevel.find(n => n.name === part);
            
            if (!existingNode) {
                const newNode: FileNode = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: part,
                    type: isFile ? 'file' : 'folder',
                    fileType: isFile ? determineFileType(part) : undefined,
                    size: isFile ? formatSize(file.size) : '--',
                    date: new Date(file.lastModified).toISOString().split('T')[0],
                    children: isFile ? undefined : [],
                    isOpen: false
                };
                currentLevel.push(newNode);
                existingNode = newNode;
            }
            
            if (!isFile && existingNode.children) {
                currentLevel = existingNode.children;
            }
        }
    }
    
    return root;
};

export const determineFileType = (filename: string): FileNode['fileType'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'webm', 'mov'].includes(ext!)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext!)) return 'audio'; // Added audio type
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext!)) return 'image';
    if (['js', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'md'].includes(ext!)) return 'code';
    if (['txt', 'log'].includes(ext!)) return 'text';
    return 'unknown';
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
