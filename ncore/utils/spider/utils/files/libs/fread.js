import fs from 'fs';
import path from 'path';

export class FileReader {
    constructor() {
        this.encodings = [
            "utf-8",
            "utf-16",
            "utf-16le",
            "utf-16BE",
            "gbk",
            "gb2312",
            "us-ascii",
            "ascii",
            "IBM037",
            "IBM437",
            "IBM500",
            "ASMO-708",
            "DOS-720",
            "ibm737",
            "ibm775",
            "ibm850",
            "ibm852",
            "IBM855",
            "ibm857",
            "IBM00858",
            "IBM860",
            "ibm861",
            "DOS-862",
            "IBM863",
            "IBM864",
            "IBM865",
            "cp866",
            "ibm869",
            "IBM870",
            "windows-874",
            "cp875",
            "shift_jis",
            "ks_c_5601-1987",
            "big5",
            "IBM1026",
            "IBM01047",
            "IBM01140",
            "IBM01141",
            "IBM01142",
            "IBM01143",
            "IBM01144",
            "IBM01145",
            "IBM01146",
            "IBM01147",
            "IBM01148",
            "IBM01149",
            "windows-1250",
            "windows-1251",
            "Windows-1252",
            "windows-1253",
            "windows-1254",
            "windows-1255",
            "windows-1256",
            "windows-1257",
            "windows-1258",
            "Johab",
            "macintosh",
            "x-mac-japanese",
            "x-mac-chinesetrad",
            "x-mac-korean",
            "x-mac-arabic",
            "x-mac-hebrew",
            "x-mac-greek",
            "x-mac-cyrillic",
            "x-mac-chinesesimp",
            "x-mac-romanian",
            "x-mac-ukrainian",
            "x-mac-thai",
            "x-mac-ce",
            "x-mac-icelandic",
            "x-mac-turkish",
            "x-mac-croatian",
            "utf-32",
            "utf-32BE",
            "x-Chinese-CNS",
            "x-cp20001",
            "x-Chinese-Eten",
            "x-cp20003",
            "x-cp20004",
            "x-cp20005",
            "x-IA5",
            "x-IA5-German",
            "x-IA5-Swedish",
            "x-IA5-Norwegian",
            "x-cp20261",
            "x-cp20269",
            "IBM273",
            "IBM277",
            "IBM278",
            "IBM280",
            "IBM284",
            "IBM285",
            "IBM290",
            "IBM297",
            "IBM420",
            "IBM423",
            "IBM424",
            "x-EBCDIC-KoreanExtended",
            "IBM-Thai",
            "koi8-r",
            "IBM871",
            "IBM880",
            "IBM905",
            "IBM00924",
            "EUC-JP",
            "x-cp20936",
            "x-cp20949",
            "cp1025",
            "koi8-u",
            "iso-8859-1",
            "iso-8859-2",
            "iso-8859-3",
            "iso-8859-4",
            "iso-8859-5",
            "iso-8859-6",
            "iso-8859-7",
            "iso-8859-8",
            "iso-8859-9",
            "iso-8859-13",
            "iso-8859-15",
            "x-Europa",
            "iso-8859-8-i",
            "iso-2022-jp",
            "csISO2022JP",
            "iso-2022-jp",
            "iso-2022-kr",
            "x-cp50227",
            "euc-jp",
            "EUC-CN",
            "euc-kr",
            "hz-gb-2312",
            "GB18030",
            "x-iscii-de",
            "x-iscii-be",
            "x-iscii-ta",
            "x-iscii-te",
            "x-iscii-as",
            "x-iscii-or",
            "x-iscii-ka",
            "x-iscii-ma",
            "x-iscii-gu",
            "x-iscii-pa",
            "utf-7",
        ];
    }

    readFile(fileName, preferredEncoding = null, verbose = false) {
        if (!fs.existsSync(fileName)) {
            throw new Error(`File not found: ${fileName}`);
        }

        const encodingsToTry = [...this.encodings];
        if (preferredEncoding) {
            encodingsToTry.unshift(preferredEncoding);
        }

        for (const encoding of encodingsToTry) {
            try {
                const content = fs.readFileSync(fileName, { encoding });
                
                if (verbose) {
                    console.log(`Successfully read ${fileName} using ${encoding} encoding`);
                }
                
                return { 
                    encoding,
                    content,
                    fileName
                };
            } catch (error) {
                if (verbose) {
                    console.warn(`Failed to read with ${encoding} encoding:`, error.message);
                }
                continue;
            }
        }

        throw new Error(`Failed to read ${fileName} with any supported encoding`);
    }

    detectEncoding(fileName, preferredEncoding = null) {
        try {
            const result = this.readFile(fileName, preferredEncoding, false);
            return result.encoding;
        } catch (error) {
            return null;
        }
    }

    readWithEncoding(fileName, encoding) {
        try {
            return fs.readFileSync(fileName, { encoding });
        } catch (error) {
            console.error(`Error reading file with ${encoding} encoding:`, error.message);
            return null;
        }
    }

    readJSON(fileName, preferredEncoding = null) {
        try {
            const result = this.readFile(fileName, preferredEncoding);
            return JSON.parse(result.content);
        } catch (error) {
            console.warn(`Failed to parse ${fileName} as JSON:`, error.message);
            return {};
        }
    }

    readLines(fileName, preferredEncoding = null, skipEmpty = true, trim = true) {
        try {
            const result = this.readFile(fileName, preferredEncoding);
            let lines = result.content.split('\n');
            
            if (trim) {
                lines = lines.map(line => line.trim());
            }
            
            if (skipEmpty) {
                lines = lines.filter(line => line.length > 0);
            }
            
            return lines;
        } catch (error) {
            console.warn(`Failed to read lines from ${fileName}:`, error.message);
            return [];
        }
    }

    readKeyValue(fileName, preferredEncoding = null, delimiter = '=', skipComments = true) {
        const result = {};
        try {
            const lines = this.readLines(fileName, preferredEncoding, true, true);
            
            for (const line of lines) {
                // Skip comments if requested
                if (skipComments && line.startsWith('#')) {
                    continue;
                }
                
                try {
                    const parts = line.split(delimiter);
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        // Skip if key is empty
                        if (!key) continue;
                        // Join remaining parts in case value contains delimiter
                        const value = parts.slice(1).join(delimiter).trim();
                        result[key] = value;
                    }
                } catch (error) {
                    console.warn(`Skipping malformed line: ${line}`);
                    continue;
                }
            }
        } catch (error) {
            console.warn(`Failed to read key-value pairs from ${fileName}:`, error.message);
        }
        return result;
    }

    saveJSON(fileName, data, pretty = true, encoding = 'utf8') {
        try {
            const content = pretty 
                ? JSON.stringify(data, null, 2) 
                : JSON.stringify(data);
                
            return this.saveFile(fileName, content, encoding);
        } catch (error) {
            console.error(`Failed to save JSON to ${fileName}:`, error.message);
            return false;
        }
    }

    saveFile(fileName, content, encoding = 'utf8') {
        try {
            // Ensure the directory exists
            const dir = path.dirname(fileName);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(fileName, content, { encoding });
            return true;
        } catch (error) {
            console.error(`Failed to save file ${fileName}:`, error.message);
            return false;
        }
    }

    appendFile(fileName, content, addNewLine = true, encoding = 'utf8') {
        try {
            if (!fs.existsSync(fileName)) {
                return this.saveFile(fileName, content, encoding);
            }

            const dataToAppend = addNewLine 
                ? `\n${content}` 
                : content;
                
            fs.appendFileSync(fileName, dataToAppend, { encoding });
            return true;
        } catch (error) {
            console.error(`Failed to append to file ${fileName}:`, error.message);
            return false;
        }
    }
}

// Create default instance
const defaultReader = new FileReader();
export default defaultReader;

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    FileReader.runTests();
}
