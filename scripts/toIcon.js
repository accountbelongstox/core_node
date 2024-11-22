const fs = require('fs');
const path = require('path');

class ImageTypeDetector {
    constructor(folderPath) {
        this.folderPath = folderPath;
    }

    async detectImageTypes() {
        try {
            const files = await this.readDirectory(this.folderPath);
            const imageInfoArray = await Promise.all(files.map(file => this.detectImageInfo(file)));
            return imageInfoArray;
        } catch (error) {
            console.error('Error detecting image types:', error);
            return [];
        }
    }

    readDirectory(folderPath) {
        return new Promise((resolve, reject) => {
            fs.readdir(folderPath, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(files);
                }
            });
        });
    }

    detectImageInfo(fileName) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(this.folderPath, fileName);
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    const fileType = this.getFileType(data);
                    if (fileType === 'Unknown') {
                        resolve({ baseName: path.basename(fileName, path.extname(fileName)), fileName, fileType,base64:null });
                    } else {
                        const baseName = path.basename(fileName, path.extname(fileName));
                        const base64 = data.toString('base64');
                        resolve({ baseName, fileName, fileType, base64 });
                    }
                }
            });
        });
    }
    
    

    getFileType(data) {
        if (this.isPNG(data)) {
            return 'PNG';
        } else if (this.isJPEG(data)) {
            return 'JPEG';
        } else if (this.isICO(data)) {
            return 'ICO';
        } else {
            return 'Unknown';
        }
    }

    isPNG(data) {
        return data[0] === 0x89 && data.toString('utf8', 1, 4) === 'PNG';
    }

    isJPEG(data) {
        return data.toString('utf8', 0, 2) === 'ÿØ'; // JPEG magic number
    }

    isICO(data) {
        return data.slice(0, 4).toString('utf8') === '\x00\x00\x01\x00'; // ICO magic number
    }
    
    async searchSoftIcons(imageInfoArray) {
        try {
            const softIconsFile = path.join(__dirname, 'soft_icons.json');

            
            const softIconsData = await fs.promises.readFile(softIconsFile);
            const softIcons = JSON.parse(softIconsData);


            imageInfoArray.forEach(imageInfo => {
                if (imageInfo.fileType !== 'Unknown') {
                    softIcons[imageInfo.baseName] = { fileType: imageInfo.fileType, iconBase64: imageInfo.base64 };
                }
            });
            const formattedSoftIcons = JSON.stringify(softIcons, null, 2);
            await fs.promises.writeFile(softIconsFile, formattedSoftIcons);
            console.log('Soft icons file updated:', softIconsFile);
        } catch (error) {
            console.error('Error saving soft icons:', error);
        }
    }
    
}

// Example usage:
const folderPath = './pngs';
const imageDetector = new ImageTypeDetector(folderPath);
imageDetector.detectImageTypes()
    .then(imageInfoArray => {
        return imageDetector.searchSoftIcons(imageInfoArray);

    })
    .catch(error => {
        console.error('Error:', error);
    });
