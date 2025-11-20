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
const fs = require('fs');
const logger = require('#@logger');
const ftools = require('#@ftools');
const commander = require('#@commander');

class ImageProcessor {
    constructor() {
        this.supportedFormats = {
            input: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'],
            output: ['.png', '.jpg', '.jpeg', '.webp']
        };
        
        this.imageLibrariesAvailable = {
            sharp: false,
            jimp: false,
            imagemagick: false
        };
        
        this.initializeImageLibraries();
    }

    initializeImageLibraries() {
        try {
            require.resolve('sharp');
            this.imageLibrariesAvailable.sharp = true;
            logger.info('Sharp library available for image processing');
        } catch (e) {
            logger.warn('Sharp library not available, falling back to alternatives');
        }

        try {
            require.resolve('jimp');
            this.imageLibrariesAvailable.jimp = true;
            logger.info('Jimp library available for image processing');
        } catch (e) {
            logger.warn('Jimp library not available');
        }

        try {
            commander.execSync('convert -version', { stdio: 'pipe' });
            this.imageLibrariesAvailable.imagemagick = true;
            logger.info('ImageMagick available for image processing');
        } catch (e) {
            logger.warn('ImageMagick not available');
        }
    }

    async getImageDimensions(imagePath) {
        try {
            const absolutePath = path.resolve(imagePath);
            
            if (!ftools.file.exists(absolutePath)) {
                throw new Error(`Image file does not exist: ${absolutePath}`);
            }

            if (this.imageLibrariesAvailable.sharp) {
                return await this.getImageDimensionsWithSharp(absolutePath);
            } else if (this.imageLibrariesAvailable.jimp) {
                return await this.getImageDimensionsWithJimp(absolutePath);
            } else if (this.imageLibrariesAvailable.imagemagick) {
                return await this.getImageDimensionsWithImageMagick(absolutePath);
            } else {
                logger.warn('No image processing libraries available, using basic file analysis');
                return await this.getImageDimensionsBasic(absolutePath);
            }
            
        } catch (error) {
            logger.error('Error getting image dimensions', { imagePath, error: error.message });
            return null;
        }
    }

    async getImageDimensionsWithSharp(imagePath) {
        const sharp = require('sharp');
        const metadata = await sharp(imagePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format
        };
    }

    async getImageDimensionsWithJimp(imagePath) {
        const Jimp = require('jimp');
        const image = await Jimp.read(imagePath);
        return {
            width: image.bitmap.width,
            height: image.bitmap.height,
            format: image.getExtension()
        };
    }

    async getImageDimensionsWithImageMagick(imagePath) {
        try {
            const result = commander.execSync(`identify -format "%w %h %m" "${imagePath}"`, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            const [width, height, format] = result.trim().split(' ');
            return {
                width: parseInt(width, 10),
                height: parseInt(height, 10),
                format: format.toLowerCase()
            };
        } catch (error) {
            throw new Error(`ImageMagick identify failed: ${error.message}`);
        }
    }

    async getImageDimensionsBasic(imagePath) {
        logger.warn('Using basic PNG header parsing - limited format support');
        
        const buffer = fs.readFileSync(imagePath);
        
        if (buffer.length < 24) {
            throw new Error('File too small to be a valid image');
        }

        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            return { width, height, format: 'png' };
        }

        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return this.parseJpegDimensions(buffer);
        }

        throw new Error('Unsupported image format for basic parsing');
    }

    parseJpegDimensions(buffer) {
        let offset = 2;
        
        while (offset < buffer.length) {
            if (buffer[offset] !== 0xFF) {
                throw new Error('Invalid JPEG format');
            }
            
            const marker = buffer[offset + 1];
            
            if (marker === 0xC0 || marker === 0xC2) {
                const height = buffer.readUInt16BE(offset + 5);
                const width = buffer.readUInt16BE(offset + 7);
                return { width, height, format: 'jpeg' };
            }
            
            const length = buffer.readUInt16BE(offset + 2);
            offset += 2 + length;
        }
        
        throw new Error('Could not find JPEG dimensions');
    }

    async resizeImage(sourcePath, targetPath, width, height, options = {}) {
        try {
            const absoluteSourcePath = path.resolve(sourcePath);
            const absoluteTargetPath = path.resolve(targetPath);
            
            if (!ftools.file.exists(absoluteSourcePath)) {
                throw new Error(`Source image does not exist: ${absoluteSourcePath}`);
            }

            const resizeOptions = {
                fit: options.fit || 'cover',
                quality: options.quality || 90,
                format: options.format || null,
                ...options
            };

            if (this.imageLibrariesAvailable.sharp) {
                await this.resizeImageWithSharp(absoluteSourcePath, absoluteTargetPath, width, height, resizeOptions);
            } else if (this.imageLibrariesAvailable.jimp) {
                await this.resizeImageWithJimp(absoluteSourcePath, absoluteTargetPath, width, height, resizeOptions);
            } else if (this.imageLibrariesAvailable.imagemagick) {
                await this.resizeImageWithImageMagick(absoluteSourcePath, absoluteTargetPath, width, height, resizeOptions);
            } else {
                throw new Error('No image processing library available for resizing');
            }

            logger.info(`Resized image: ${absoluteSourcePath} -> ${absoluteTargetPath} (${width}x${height})`);
            return true;
            
        } catch (error) {
            logger.error('Error resizing image', { sourcePath, targetPath, width, height, error: error.message });
            return false;
        }
    }

    async resizeImageWithSharp(sourcePath, targetPath, width, height, options) {
        const sharp = require('sharp');
        let pipeline = sharp(sourcePath);
        
        if (options.fit === 'cover') {
            pipeline = pipeline.resize(width, height, { 
                fit: sharp.fit.cover,
                position: sharp.strategy.centre
            });
        } else if (options.fit === 'contain') {
            pipeline = pipeline.resize(width, height, { 
                fit: sharp.fit.contain,
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            });
        } else {
            pipeline = pipeline.resize(width, height, { fit: sharp.fit.fill });
        }

        if (options.format) {
            if (options.format.toLowerCase() === 'jpeg' || options.format.toLowerCase() === 'jpg') {
                pipeline = pipeline.jpeg({ quality: options.quality });
            } else if (options.format.toLowerCase() === 'png') {
                pipeline = pipeline.png({ quality: options.quality });
            } else if (options.format.toLowerCase() === 'webp') {
                pipeline = pipeline.webp({ quality: options.quality });
            }
        }

        await pipeline.toFile(targetPath);
    }

    async resizeImageWithJimp(sourcePath, targetPath, width, height, options) {
        const Jimp = require('jimp');
        const image = await Jimp.read(sourcePath);
        
        if (options.fit === 'cover') {
            image.cover(width, height);
        } else if (options.fit === 'contain') {
            image.contain(width, height);
        } else {
            image.resize(width, height);
        }

        if (options.quality && options.quality < 100) {
            image.quality(options.quality);
        }

        await image.writeAsync(targetPath);
    }

    async resizeImageWithImageMagick(sourcePath, targetPath, width, height, options) {
        let cmd = `convert "${sourcePath}"`;
        
        if (options.fit === 'cover') {
            cmd += ` -resize ${width}x${height}^ -gravity center -extent ${width}x${height}`;
        } else if (options.fit === 'contain') {
            cmd += ` -resize ${width}x${height}`;
        } else {
            cmd += ` -resize ${width}x${height}!`;
        }

        if (options.quality) {
            cmd += ` -quality ${options.quality}`;
        }

        cmd += ` "${targetPath}"`;

        try {
            commander.execSync(cmd, { stdio: 'pipe' });
        } catch (error) {
            throw new Error(`ImageMagick resize failed: ${error.message}`);
        }
    }

    async resizeAndCropImage(sourcePath, targetPath, targetWidth, targetHeight, options = {}) {
        try {
            const dimensions = await this.getImageDimensions(sourcePath);
            if (!dimensions) {
                throw new Error('Could not get source image dimensions');
            }

            const sourceWidth = dimensions.width;
            const sourceHeight = dimensions.height;
            
            const scaleX = targetWidth / sourceWidth;
            const scaleY = targetHeight / sourceHeight;
            const scale = Math.max(scaleX, scaleY);
            
            const newWidth = Math.round(sourceWidth * scale);
            const newHeight = Math.round(sourceHeight * scale);
            
            const cropOptions = {
                ...options,
                fit: 'cover'
            };

            await this.resizeImage(sourcePath, targetPath, newWidth, newHeight, cropOptions);
            
            if (newWidth !== targetWidth || newHeight !== targetHeight) {
                await this.cropImageToSize(targetPath, targetPath, targetWidth, targetHeight);
            }

            logger.info(`Resized and cropped image: ${sourcePath} -> ${targetPath} (${targetWidth}x${targetHeight})`);
            return true;
            
        } catch (error) {
            logger.error('Error resizing and cropping image', { sourcePath, targetPath, error: error.message });
            return false;
        }
    }

    async cropImageToSize(sourcePath, targetPath, width, height) {
        try {
            if (this.imageLibrariesAvailable.sharp) {
                const sharp = require('sharp');
                await sharp(sourcePath)
                    .extract({
                        left: 0,
                        top: 0,
                        width: width,
                        height: height
                    })
                    .toFile(targetPath);
            } else if (this.imageLibrariesAvailable.imagemagick) {
                const cmd = `convert "${sourcePath}" -gravity center -crop ${width}x${height}+0+0 "${targetPath}"`;
                commander.execSync(cmd, { stdio: 'pipe' });
            } else {
                throw new Error('No image processing library available for cropping');
            }
            
        } catch (error) {
            throw new Error(`Failed to crop image: ${error.message}`);
        }
    }

    async compressImage(imagePath, options = {}) {
        try {
            const absolutePath = path.resolve(imagePath);
            
            if (!ftools.file.exists(absolutePath)) {
                throw new Error(`Image file does not exist: ${absolutePath}`);
            }

            const compressionOptions = {
                quality: options.quality || 85,
                format: options.format || null,
                progressive: options.progressive !== false,
                ...options
            };

            const tempPath = absolutePath + '.tmp';
            
            if (this.imageLibrariesAvailable.sharp) {
                await this.compressImageWithSharp(absolutePath, tempPath, compressionOptions);
            } else if (this.imageLibrariesAvailable.jimp) {
                await this.compressImageWithJimp(absolutePath, tempPath, compressionOptions);
            } else if (this.imageLibrariesAvailable.imagemagick) {
                await this.compressImageWithImageMagick(absolutePath, tempPath, compressionOptions);
            } else {
                throw new Error('No image processing library available for compression');
            }

            fs.renameSync(tempPath, absolutePath);
            
            logger.info(`Compressed image: ${absolutePath}`);
            return true;
            
        } catch (error) {
            logger.error('Error compressing image', { imagePath, error: error.message });
            
            const tempPath = path.resolve(imagePath) + '.tmp';
            if (ftools.file.exists(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            
            return false;
        }
    }

    async compressImageWithSharp(sourcePath, targetPath, options) {
        const sharp = require('sharp');
        let pipeline = sharp(sourcePath);
        
        const ext = path.extname(sourcePath).toLowerCase();
        const format = options.format || (ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png');
        
        if (format === 'jpeg' || format === 'jpg') {
            pipeline = pipeline.jpeg({ 
                quality: options.quality,
                progressive: options.progressive
            });
        } else if (format === 'png') {
            pipeline = pipeline.png({ 
                quality: options.quality,
                progressive: options.progressive
            });
        } else if (format === 'webp') {
            pipeline = pipeline.webp({ 
                quality: options.quality
            });
        }

        await pipeline.toFile(targetPath);
    }

    async compressImageWithJimp(sourcePath, targetPath, options) {
        const Jimp = require('jimp');
        const image = await Jimp.read(sourcePath);
        
        if (options.quality) {
            image.quality(options.quality);
        }

        await image.writeAsync(targetPath);
    }

    async compressImageWithImageMagick(sourcePath, targetPath, options) {
        let cmd = `convert "${sourcePath}"`;
        
        if (options.quality) {
            cmd += ` -quality ${options.quality}`;
        }

        if (options.progressive) {
            cmd += ` -interlace Plane`;
        }

        cmd += ` "${targetPath}"`;

        try {
            commander.execSync(cmd, { stdio: 'pipe' });
        } catch (error) {
            throw new Error(`ImageMagick compression failed: ${error.message}`);
        }
    }

    async convertImageFormat(sourcePath, targetPath, targetFormat, options = {}) {
        try {
            const absoluteSourcePath = path.resolve(sourcePath);
            const absoluteTargetPath = path.resolve(targetPath);
            
            if (!ftools.file.exists(absoluteSourcePath)) {
                throw new Error(`Source image does not exist: ${absoluteSourcePath}`);
            }

            const convertOptions = {
                quality: options.quality || 90,
                ...options
            };

            if (this.imageLibrariesAvailable.sharp) {
                await this.convertImageFormatWithSharp(absoluteSourcePath, absoluteTargetPath, targetFormat, convertOptions);
            } else if (this.imageLibrariesAvailable.jimp) {
                await this.convertImageFormatWithJimp(absoluteSourcePath, absoluteTargetPath, targetFormat, convertOptions);
            } else if (this.imageLibrariesAvailable.imagemagick) {
                await this.convertImageFormatWithImageMagick(absoluteSourcePath, absoluteTargetPath, targetFormat, convertOptions);
            } else {
                throw new Error('No image processing library available for format conversion');
            }

            logger.info(`Converted image format: ${absoluteSourcePath} -> ${absoluteTargetPath} (${targetFormat})`);
            return true;
            
        } catch (error) {
            logger.error('Error converting image format', { sourcePath, targetPath, targetFormat, error: error.message });
            return false;
        }
    }

    async convertImageFormatWithSharp(sourcePath, targetPath, format, options) {
        const sharp = require('sharp');
        let pipeline = sharp(sourcePath);
        
        if (format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg') {
            pipeline = pipeline.jpeg({ quality: options.quality });
        } else if (format.toLowerCase() === 'png') {
            pipeline = pipeline.png({ quality: options.quality });
        } else if (format.toLowerCase() === 'webp') {
            pipeline = pipeline.webp({ quality: options.quality });
        } else {
            throw new Error(`Unsupported output format: ${format}`);
        }

        await pipeline.toFile(targetPath);
    }

    async convertImageFormatWithJimp(sourcePath, targetPath, format, options) {
        const Jimp = require('jimp');
        const image = await Jimp.read(sourcePath);
        
        if (options.quality) {
            image.quality(options.quality);
        }

        await image.writeAsync(targetPath);
    }

    async convertImageFormatWithImageMagick(sourcePath, targetPath, format, options) {
        let cmd = `convert "${sourcePath}"`;
        
        if (options.quality) {
            cmd += ` -quality ${options.quality}`;
        }

        cmd += ` "${targetPath}"`;

        try {
            commander.execSync(cmd, { stdio: 'pipe' });
        } catch (error) {
            throw new Error(`ImageMagick conversion failed: ${error.message}`);
        }
    }

    async batchResizeImages(imagePaths, targetDir, width, height, options = {}) {
        try {
            const results = {
                successful: 0,
                failed: 0,
                details: []
            };

            if (!ftools.file.exists(targetDir)) {
                ftools.fdir.mkdirSync(targetDir);
            }

            for (const imagePath of imagePaths) {
                try {
                    const fileName = path.basename(imagePath);
                    const targetPath = path.join(targetDir, fileName);
                    
                    const success = await this.resizeImage(imagePath, targetPath, width, height, options);
                    
                    if (success) {
                        results.successful++;
                        results.details.push({ source: imagePath, target: targetPath, status: 'success' });
                    } else {
                        results.failed++;
                        results.details.push({ source: imagePath, target: targetPath, status: 'failed' });
                    }
                } catch (error) {
                    results.failed++;
                    results.details.push({ 
                        source: imagePath, 
                        target: null, 
                        status: 'failed', 
                        error: error.message 
                    });
                }
            }

            logger.info('Batch resize completed', results);
            return results;
            
        } catch (error) {
            logger.error('Error in batch resize', { error: error.message });
            throw error;
        }
    }

    getImageProcessingCapabilities() {
        return {
            libraries: this.imageLibrariesAvailable,
            supportedFormats: this.supportedFormats,
            operations: {
                resize: Object.values(this.imageLibrariesAvailable).some(available => available),
                compress: Object.values(this.imageLibrariesAvailable).some(available => available),
                convert: Object.values(this.imageLibrariesAvailable).some(available => available),
                crop: this.imageLibrariesAvailable.sharp || this.imageLibrariesAvailable.imagemagick,
                getDimensions: true
            }
        };
    }
}

module.exports = ImageProcessor;