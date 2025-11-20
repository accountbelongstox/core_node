// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const path = require('path');
const Base = require('#@base');
let pngImgToIco = null;
const { gdir, file } = require('#@global_vars');

class IconHandler extends Base {
    convertToError = [];
    convertToErrorImgs = [];

    readBase64ByFile(filePath) {
        const extname = path.extname(filePath).toLowerCase();
        let mimeType;
        switch (extname) {
            case '.ico':
                mimeType = 'image/x-icon';
                break;
            case '.png':
                mimeType = 'image/png';
                break;
            case '.jpg':
            case '.jpeg':
                mimeType = 'image/jpeg';
                break;
            case '.bmp':
                mimeType = 'image/bmp';
                break;
            case '.gif':
                mimeType = 'image/gif';
                break;
            default:
                return null;
        }
        const imageData = fs.readFileSync(filePath);
        const base64Image = Buffer.from(imageData).toString('base64');
        return `data:${mimeType};base64,${base64Image}`;
    }

    base64ToICO(base64String, outputFilePath) {
        const binaryData = Buffer.from(base64String, 'base64');
        file.mkbasedir(outputFilePath);
        fs.writeFileSync(outputFilePath, binaryData, 'binary');
    }

    async pngImToIco(pngFilePath, outputIcoFilePath, deletePng = false) {
        if (!pngImgToIco) {
            pngImgToIco = require('png-to-ico');
        }
        const baseImgPath = path.basename(pngFilePath);
        if (this.convertToErrorImgs.includes(baseImgPath)) {
            return;
        }
        try {
            const buf = await pngImgToIco(pngFilePath);
            fs.writeFileSync(outputIcoFilePath, buf);
            if (deletePng) {
                file.delete(pngFilePath);
            }
        } catch (error) {
            this.convertToErrorImgs.push(baseImgPath);
            this.convertToError.push(baseImgPath);
            if (this.convertToError.length > 100) {
                console.error('Error while converting PNGs to ICO:');
                console.log(this.convertToError);
                this.convertToError = [];
            }
        }
    }

    base64ToPng(base64String, outputFilePath) {
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(outputFilePath, binaryData);
    }

    createIconFile(jsonData) {
        const iconsCacheDir = gdir.getLocalDir('iconsCache');
        for (const item of jsonData) {
            const softwareList = item.softwareList;
            for (const softwareItem of softwareList) {
                const basename = softwareItem.basename;
                const iconBase64 = softwareItem.iconBase64;
                const iconImgPath = softwareItem.iconImgPath;

                const imgnameByPng = file.replaceExtension(basename, 'png');
                const imgnameByIco = file.replaceExtension(basename, 'ico');
                const pngPath = path.join(iconsCacheDir, imgnameByPng);
                const iconPath = path.join(iconsCacheDir, imgnameByIco);

                if (iconBase64) {
                    if (!file.isFile(iconPath)) {
                        this.base64ToPng(iconBase64, pngPath);
                        this.pngImToIco(pngPath, iconPath, true);
                    }
                }
                if (!iconImgPath) {
                    softwareItem.iconImgPath = iconPath;
                }
            }
        }
        return jsonData;
    }

    readFileAsBase64(filePath, callback) {
        if (file.isImageFile(filePath)) {
            callback(this.getDefaultImageBase64Icon());
        } else {
            this.appReadIconByFile(filePath, callback);
        }
    }
}

module.exports = IconHandler;
