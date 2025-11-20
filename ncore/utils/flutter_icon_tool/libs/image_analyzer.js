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
const logger = require('#@logger');

class ImageAnalyzer {
    constructor() {
        this.androidDensities = {
            'ldpi': 0.75,
            'mdpi': 1.0,
            'hdpi': 1.5,
            'xhdpi': 2.0,
            'xxhdpi': 3.0,
            'xxxhdpi': 4.0
        };

        this.iosScales = {
            '1x': 1.0,
            '2x': 2.0,
            '3x': 3.0
        };

        this.standardIconSizes = {
            android_launcher: {
                'ldpi': [36, 36],
                'mdpi': [48, 48],
                'hdpi': [72, 72],
                'xhdpi': [96, 96],
                'xxhdpi': [144, 144],
                'xxxhdpi': [192, 192]
            },
            android_notification: {
                'ldpi': [18, 18],
                'mdpi': [24, 24],
                'hdpi': [36, 36],
                'xhdpi': [48, 48],
                'xxhdpi': [72, 72],
                'xxxhdpi': [96, 96]
            },
            ios_app: {
                '29pt': [[29, 29], [58, 58], [87, 87]],
                '40pt': [[40, 40], [80, 80], [120, 120]],
                '60pt': [[60, 60], [120, 120], [180, 180]],
                '76pt': [[76, 76], [152, 152], [228, 228]],
                '83.5pt': [[167, 167]],
                '1024pt': [[1024, 1024]]
            },
            windows_app: {
                'small': [16, 16],
                'medium': [32, 32],
                'large': [48, 48],
                'extra_large': [256, 256]
            },
            web_favicon: {
                'standard': [16, 16],
                'large': [32, 32],
                'apple_touch': [180, 180],
                'android_chrome': [[192, 192], [512, 512]]
            }
        };

        this.directoryMappings = {
            android: {
                'mipmap-ldpi': [36, 36],
                'mipmap-mdpi': [48, 48], 
                'mipmap-hdpi': [72, 72],
                'mipmap-xhdpi': [96, 96],
                'mipmap-xxhdpi': [144, 144],
                'mipmap-xxxhdpi': [192, 192],
                'drawable': [96, 96],
                'drawable-ldpi': [36, 36],
                'drawable-mdpi': [48, 48],
                'drawable-hdpi': [72, 72], 
                'drawable-xhdpi': [96, 96],
                'drawable-xxhdpi': [144, 144],
                'drawable-xxxhdpi': [192, 192],
                'drawable-night': [96, 96],
                'drawable-night-ldpi': [36, 36],
                'drawable-night-mdpi': [48, 48],
                'drawable-night-hdpi': [72, 72],
                'drawable-night-xhdpi': [96, 96],
                'drawable-night-xxhdpi': [144, 144],
                'drawable-night-xxxhdpi': [192, 192],
                'drawable-port': [1080, 1920],
                'drawable-land': [1920, 1080]
            },
            ios: {
                'Assets.xcassets/AppIcon.appiconset': [180, 180],
                'Assets.xcassets/LaunchImage.imageset': [1125, 2436],
                'Assets.xcassets': [96, 96],
                'Images.xcassets': [96, 96],
                'Runner': [96, 96]
            },
            windows: {
                'runner/resources': [256, 256],
                'resources': [256, 256]
            },
            web: {
                'icons': [512, 512],
                'favicon': [32, 32],
                'splash': [1920, 1080],
                'images': [96, 96]
            }
        };

        this.splashScreenSizes = {
            android_splash: [
                [320, 480],
                [480, 800],
                [720, 1280],
                [1080, 1920],
                [1440, 2560],
                [2160, 3840]
            ],
            ios_splash: [
                [320, 568],
                [375, 667],
                [414, 736],
                [375, 812],
                [414, 896],
                [768, 1024],
                [834, 1112],
                [1024, 1366]
            ]
        };

        this.classificationPatterns = {
            icon: [
                /ic_launcher/i,
                /app_icon/i,
                /icon/i,
                /logo/i,
                /notification.*icon/i
            ],
            splash: [
                /splash/i,
                /launch.*image/i,
                /background/i,
                /loading/i
            ],
            placeholder: [
                /placeholder/i,
                /default/i,
                /fallback/i,
                /empty/i
            ]
        };
    }

    classifyImage(imagePath, width = null, height = null) {
        try {
            const filename = path.basename(imagePath).toLowerCase();
            const pathStr = imagePath.toLowerCase();
            const parentDirs = this.getParentDirs(imagePath);

            const classification = {
                category: 'Other',
                subcategory: null,
                confidence: 0.0,
                platform: this.detectPlatform(imagePath),
                sizeCategory: null,
                isVector: filename.endsWith('.svg')
            };

            if (width && height) {
                const aspectClassification = this.classifyByAspectRatioAndSize(width, height);
                if (aspectClassification.confidence > 0) {
                    Object.assign(classification, aspectClassification);
                }
            }

            const placeholderConfidence = this.checkPatterns(filename, this.classificationPatterns.placeholder);
            if (placeholderConfidence > 0 && placeholderConfidence > classification.confidence) {
                classification.category = 'Placeholder';
                classification.confidence = placeholderConfidence;
            }

            if (classification.category === 'Other') {
                const dirClassification = this.classifyByDirectory(parentDirs);
                if (dirClassification.confidence > classification.confidence) {
                    Object.assign(classification, dirClassification);
                }
            }

            if (classification.category === 'Other') {
                classification.confidence = 0.1;
            }

            return classification;
            
        } catch (error) {
            logger.error('Error classifying image', { imagePath, error: error.message });
            return {
                category: 'Other',
                subcategory: null,
                confidence: 0.0,
                platform: 'Unknown',
                sizeCategory: null,
                isVector: false
            };
        }
    }

    classifyByAspectRatioAndSize(width, height) {
        const classification = { confidence: 0.0 };
        
        const aspectRatio = width / height;
        const pixelCount = width * height;
        const maxDimension = Math.max(width, height);
        
        if (pixelCount > 500000) {
            return {
                category: 'Background',
                subcategory: 'Background Image',
                confidence: 0.95
            };
        }
        
        if (aspectRatio < 0.6 || aspectRatio > 1.7) {
            if (pixelCount > 100000) {
                return {
                    category: 'Background',
                    subcategory: 'Background Image',
                    confidence: 0.9
                };
            }
        }
        
        if (aspectRatio >= 0.6 && aspectRatio <= 1.7) {
            if (maxDimension <= 128) {
                return {
                    category: 'Small Icon',
                    subcategory: `${maxDimension}px Icon`,
                    confidence: 0.9
                };
            } else if (maxDimension <= 512) {
                return {
                    category: 'Large Icon', 
                    subcategory: `${maxDimension}px Icon`,
                    confidence: 0.9
                };
            } else {
                return {
                    category: 'Background',
                    subcategory: 'Large Square Background',
                    confidence: 0.8
                };
            }
        }
        
        if (pixelCount > 50000) {
            return {
                category: 'Background',
                subcategory: 'Background Image',
                confidence: 0.7
            };
        } else {
            return {
                category: 'Small Icon',
                subcategory: 'Small Rectangular Icon',
                confidence: 0.6
            };
        }
    }

    checkPatterns(text, patterns) {
        let maxConfidence = 0.0;
        
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                if (pattern.source === text) {
                    maxConfidence = Math.max(maxConfidence, 1.0);
                } else {
                    maxConfidence = Math.max(maxConfidence, 0.8);
                }
            }
        }
        
        return maxConfidence;
    }

    detectPlatform(imagePath) {
        const pathStr = imagePath.toLowerCase();
        
        if (pathStr.includes('android') || pathStr.includes('mipmap') || pathStr.includes('drawable')) {
            return 'Android';
        } else if (pathStr.includes('ios') || pathStr.includes('assets.xcassets') || pathStr.includes('appicon')) {
            return 'iOS';
        } else if (pathStr.includes('windows') || pathStr.includes('.ico')) {
            return 'Windows';
        } else if (pathStr.includes('web') || pathStr.includes('favicon')) {
            return 'Web';
        }
        
        return 'Unknown';
    }

    classifyByDirectory(parentDirs) {
        const classification = { confidence: 0.0 };
        
        for (const dirName of parentDirs) {
            if (dirName.includes('mipmap') || dirName.includes('drawable')) {
                return {
                    category: 'Icon',
                    subcategory: 'Android Resource',
                    confidence: 0.9,
                    platform: 'Android'
                };
            } else if (dirName.includes('assets.xcassets') || dirName.includes('appicon')) {
                return {
                    category: 'Icon',
                    subcategory: 'iOS Resource',
                    confidence: 0.9,
                    platform: 'iOS'
                };
            } else if (dirName.includes('splash') || dirName.includes('launch')) {
                return {
                    category: 'Background/Splash',
                    confidence: 0.8
                };
            }
        }
        
        return classification;
    }

    getSizeRecommendations(imagePath, width, height) {
        try {
            const platform = this.detectPlatform(imagePath);
            const pathStr = imagePath.toLowerCase();
            
            const recommendations = {
                currentSize: [width, height],
                platform,
                complianceScore: 0.0,
                recommendedSizes: [],
                sizeCategory: null,
                densityBucket: null,
                issues: [],
                suggestions: []
            };

            const directoryRecommendation = this.getDirectoryBasedRecommendation(imagePath, width, height);
            if (directoryRecommendation) {
                Object.assign(recommendations, directoryRecommendation);
                if (recommendations.recommendedSizes.length > 0) {
                    const recommendedSize = recommendations.recommendedSizes[0];
                    if (width === recommendedSize[0] && height === recommendedSize[1]) {
                        recommendations.complianceScore = 1.0;
                    } else {
                        const sizeDiff = Math.abs(width - recommendedSize[0]) + Math.abs(height - recommendedSize[1]);
                        const maxDiff = Math.max(recommendedSize[0], recommendedSize[1]);
                        recommendations.complianceScore = Math.max(0.0, 1.0 - (sizeDiff / maxDiff));
                    }
                }
            }

            if (recommendations.recommendedSizes.length === 0) {
                if (platform === 'Android') {
                    Object.assign(recommendations, this.getAndroidRecommendations(imagePath, width, height));
                } else if (platform === 'iOS') {
                    Object.assign(recommendations, this.getIosRecommendations(imagePath, width, height));
                } else if (platform === 'Windows') {
                    Object.assign(recommendations, this.getWindowsRecommendations(imagePath, width, height));
                } else if (platform === 'Web') {
                    Object.assign(recommendations, this.getWebRecommendations(imagePath, width, height));
                } else {
                    Object.assign(recommendations, this.getGeneralRecommendations(imagePath, width, height));
                }
            }

            if (recommendations.recommendedSizes.length === 0) {
                Object.assign(recommendations, this.getFallbackRecommendations(imagePath, width, height));
            }

            return recommendations;
            
        } catch (error) {
            logger.error('Error getting size recommendations', { imagePath, error: error.message });
            return {
                currentSize: [width, height],
                platform: 'Unknown',
                complianceScore: 0.5,
                recommendedSizes: [[96, 96]],
                sizeCategory: 'Default',
                issues: ['Error analyzing image'],
                suggestions: []
            };
        }
    }

    getDirectoryBasedRecommendation(imagePath, width, height) {
        if (!width || !height) {
            return null;
        }

        const imageType = this.classifyByAspectRatioAndSize(width, height);
        const category = imageType.category;
        
        if (category === 'Placeholder') {
            return null;
        }

        const pathStr = imagePath.toLowerCase().replace(/\\/g, '/');
        const platform = this.detectPlatform(imagePath).toLowerCase();

        if (category === 'Small Icon' || category === 'Large Icon') {
            const recommendedSize = this.getIconSizeForDirectory(imagePath, platform);
            if (recommendedSize) {
                return {
                    recommendedSizes: [recommendedSize],
                    sizeCategory: `Icon (${recommendedSize[0]}×${recommendedSize[1]})`,
                    suggestions: [`Icon size based on ${platform} DPI standards`]
                };
            }
        } else if (category === 'Background') {
            const recommendedSize = this.getBackgroundSizeForDirectory(imagePath, platform, width, height);
            if (recommendedSize) {
                return {
                    recommendedSizes: [recommendedSize],
                    sizeCategory: `Background (${recommendedSize[0]}×${recommendedSize[1]})`,
                    suggestions: ['Background size based on device standards']
                };
            }
        }

        return null;
    }

    getIconSizeForDirectory(imagePath, platform) {
        const pathStr = imagePath.toLowerCase().replace(/\\/g, '/');
        
        if (platform === 'android') {
            if (pathStr.includes('xxxhdpi')) return [192, 192];
            if (pathStr.includes('xxhdpi')) return [144, 144];
            if (pathStr.includes('xhdpi')) return [96, 96];
            if (pathStr.includes('hdpi')) return [72, 72];
            if (pathStr.includes('mdpi')) return [48, 48];
            if (pathStr.includes('ldpi')) return [36, 36];
            return [96, 96];
        } else if (platform === 'ios') {
            if (pathStr.includes('@3x')) return [180, 180];
            if (pathStr.includes('@2x')) return [120, 120];
            return [60, 60];
        } else if (platform === 'windows') {
            return [256, 256];
        } else if (platform === 'web') {
            if (pathStr.includes('favicon')) return [32, 32];
            return [512, 512];
        }
        
        return [96, 96];
    }

    getBackgroundSizeForDirectory(imagePath, platform, width, height) {
        const aspectRatio = width / height;
        const pathStr = imagePath.toLowerCase();
        
        if (platform === 'android') {
            if (aspectRatio >= 0.5 && aspectRatio <= 0.8) {
                if (pathStr.includes('xxxhdpi')) return [1440, 2560];
                if (pathStr.includes('xxhdpi')) return [1080, 1920];
                return [720, 1280];
            } else if (aspectRatio >= 1.2 && aspectRatio <= 2.0) {
                if (pathStr.includes('xxxhdpi')) return [2560, 1440];
                if (pathStr.includes('xxhdpi')) return [1920, 1080];
                return [1280, 720];
            } else {
                return [1080, 1080];
            }
        } else if (platform === 'ios') {
            if (aspectRatio < 1.0) {
                return [1125, 2436];
            } else {
                return [2436, 1125];
            }
        } else if (platform === 'web') {
            if (aspectRatio < 1.0) {
                return [1080, 1920];
            } else {
                return [1920, 1080];
            }
        }
        
        if (aspectRatio < 1.0) {
            return [1080, 1920];
        } else {
            return [1920, 1080];
        }
    }

    getAndroidRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            complianceScore: 0.0,
            issues: [],
            suggestions: []
        };
        
        const pathStr = imagePath.toLowerCase();
        let density = null;
        
        for (const densityName of Object.keys(this.androidDensities)) {
            if (pathStr.includes(densityName)) {
                density = densityName;
                break;
            }
        }
        
        recommendations.densityBucket = density;
        
        if (pathStr.includes('launcher') || pathStr.includes('ic_launcher')) {
            recommendations.sizeCategory = 'Launcher Icon';
            const expectedSizes = this.standardIconSizes.android_launcher;
            
            if (density && expectedSizes[density]) {
                const expectedSize = expectedSizes[density];
                recommendations.recommendedSizes = [expectedSize];
                
                if (width === expectedSize[0] && height === expectedSize[1]) {
                    recommendations.complianceScore = 1.0;
                } else {
                    const sizeDiff = Math.abs(width - expectedSize[0]) + Math.abs(height - expectedSize[1]);
                    recommendations.complianceScore = Math.max(0.0, 1.0 - (sizeDiff / (expectedSize[0] + expectedSize[1])));
                    
                    recommendations.issues.push(
                        `Size mismatch: expected ${expectedSize}, got [${width}, ${height}]`
                    );
                    recommendations.suggestions.push(
                        `Resize to ${expectedSize[0]}x${expectedSize[1]} for ${density} density`
                    );
                }
            } else {
                recommendations.recommendedSizes = Object.values(expectedSizes);
                recommendations.suggestions.push('Create icons for all density buckets');
            }
        }
        
        return recommendations;
    }

    getIosRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            complianceScore: 0.0,
            issues: [],
            suggestions: []
        };
        
        const pathStr = imagePath.toLowerCase();
        const filename = path.basename(imagePath).toLowerCase();
        
        if (pathStr.includes('appicon') || filename.includes('app_icon')) {
            recommendations.sizeCategory = 'App Icon';
            
            const allIosSizes = [];
            for (const sizeCategory of Object.values(this.standardIconSizes.ios_app)) {
                if (Array.isArray(sizeCategory[0])) {
                    allIosSizes.push(...sizeCategory);
                } else {
                    allIosSizes.push(sizeCategory);
                }
            }
            
            recommendations.recommendedSizes = allIosSizes;
            
            const currentSize = [width, height];
            const matchingSize = allIosSizes.find(size => size[0] === width && size[1] === height);
            
            if (matchingSize) {
                recommendations.complianceScore = 1.0;
            } else {
                const closestSize = allIosSizes.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev[0] - width) + Math.abs(prev[1] - height);
                    const currDiff = Math.abs(curr[0] - width) + Math.abs(curr[1] - height);
                    return currDiff < prevDiff ? curr : prev;
                });
                
                const sizeDiff = Math.abs(width - closestSize[0]) + Math.abs(height - closestSize[1]);
                recommendations.complianceScore = Math.max(0.0, 1.0 - (sizeDiff / (closestSize[0] + closestSize[1])));
                
                recommendations.issues.push(`Non-standard iOS icon size: [${width}, ${height}]`);
                recommendations.suggestions.push(`Consider using standard iOS sizes like ${closestSize}`);
            }
        }
        
        return recommendations;
    }

    getWindowsRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            complianceScore: 0.0,
            issues: [],
            suggestions: []
        };
        
        const pathStr = imagePath.toLowerCase();
        const ext = path.extname(imagePath).toLowerCase();
        
        if (pathStr.includes('icon') || ext === '.ico') {
            recommendations.sizeCategory = 'Windows Icon';
            const windowsSizes = Object.values(this.standardIconSizes.windows_app);
            recommendations.recommendedSizes = windowsSizes;
            
            const matchingSize = windowsSizes.find(size => size[0] === width && size[1] === height);
            if (matchingSize) {
                recommendations.complianceScore = 1.0;
            } else {
                recommendations.complianceScore = 0.5;
                recommendations.suggestions.push('Use standard Windows icon sizes: 16x16, 32x32, 48x48, 256x256');
            }
        }
        
        return recommendations;
    }

    getWebRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            complianceScore: 0.0,
            issues: [],
            suggestions: []
        };
        
        const filename = path.basename(imagePath).toLowerCase();
        
        if (filename.includes('favicon')) {
            recommendations.sizeCategory = 'Favicon';
            const faviconSizes = [
                this.standardIconSizes.web_favicon.standard,
                this.standardIconSizes.web_favicon.large
            ];
            recommendations.recommendedSizes = faviconSizes;
            
            const matchingSize = faviconSizes.find(size => size[0] === width && size[1] === height);
            if (matchingSize) {
                recommendations.complianceScore = 1.0;
            } else {
                recommendations.suggestions.push('Use 16x16 or 32x32 for favicons');
            }
        } else if (filename.includes('apple-touch-icon')) {
            recommendations.sizeCategory = 'Apple Touch Icon';
            const touchIconSize = this.standardIconSizes.web_favicon.apple_touch;
            recommendations.recommendedSizes = [touchIconSize];
            
            if (width === touchIconSize[0] && height === touchIconSize[1]) {
                recommendations.complianceScore = 1.0;
            } else {
                recommendations.suggestions.push('Use 180x180 for Apple touch icons');
            }
        }
        
        return recommendations;
    }

    getGeneralRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            complianceScore: 0.5,
            issues: [],
            suggestions: []
        };
        
        const filename = path.basename(imagePath).toLowerCase();
        
        if (['icon', 'logo'].some(keyword => filename.includes(keyword))) {
            recommendations.sizeCategory = 'Generic Icon';
            recommendations.recommendedSizes = [[48, 48], [96, 96], [144, 144], [192, 192]];
            recommendations.suggestions.push('Consider creating multiple sizes for different use cases');
        } else if (['background', 'splash', 'launch'].some(keyword => filename.includes(keyword))) {
            recommendations.sizeCategory = 'Background Image';
            recommendations.recommendedSizes = [[1080, 1920], [1440, 2560]];
            recommendations.suggestions.push('Use high resolution for better quality on various devices');
        }
        
        return recommendations;
    }

    getFallbackRecommendations(imagePath, width, height) {
        const recommendations = {
            recommendedSizes: [],
            sizeCategory: 'Default Icon',
            complianceScore: 0.5,
            suggestions: ['Universal icon size recommendation'],
            issues: []
        };
        
        const classification = this.classifyImage(imagePath, width, height);
        const category = classification.category;
        
        if (category === 'Placeholder') {
            recommendations.recommendedSizes = [];
            recommendations.sizeCategory = 'Placeholder (Skip)';
            recommendations.suggestions = ['Placeholder images are skipped from size recommendations'];
            return recommendations;
        }
        
        if (category === 'Small Icon' || category === 'Large Icon') {
            const currentMaxDimension = Math.max(width, height);
            
            if (currentMaxDimension <= 48) {
                recommendations.recommendedSizes = [[48, 48]];
                recommendations.sizeCategory = 'Standard Small Icon';
            } else if (currentMaxDimension <= 96) {
                recommendations.recommendedSizes = [[96, 96]];
                recommendations.sizeCategory = 'Standard Medium Icon';
            } else if (currentMaxDimension <= 144) {
                recommendations.recommendedSizes = [[144, 144]];
                recommendations.sizeCategory = 'Standard Large Icon';
            } else {
                recommendations.recommendedSizes = [[192, 192]];
                recommendations.sizeCategory = 'Standard Extra Large Icon';
            }
            
            recommendations.suggestions = [
                'Unified icon standard - all icons use square dimensions',
                'Size chosen based on current dimensions for optimal display'
            ];
        } else if (category === 'Background') {
            const aspectRatio = width / height;
            
            if (aspectRatio >= 0.5 && aspectRatio <= 0.8) {
                recommendations.recommendedSizes = [[1080, 1920]];
                recommendations.sizeCategory = 'Portrait Background';
            } else if (aspectRatio >= 1.2 && aspectRatio <= 2.0) {
                recommendations.recommendedSizes = [[1920, 1080]];
                recommendations.sizeCategory = 'Landscape Background';
            } else {
                recommendations.recommendedSizes = [[1080, 1080]];
                recommendations.sizeCategory = 'Square Background';
            }
            
            recommendations.suggestions = [
                'Background size based on common device resolutions',
                'High resolution for better quality across devices'
            ];
        } else {
            recommendations.recommendedSizes = [[96, 96]];
            recommendations.sizeCategory = 'Default Icon';
            recommendations.suggestions = [
                'Default square icon size for unknown image types'
            ];
        }
        
        return recommendations;
    }

    getCompressionRecommendations(imagePath, fileSizeBytes, width, height) {
        try {
            const recommendations = {
                currentSizeKb: fileSizeBytes / 1024,
                shouldCompress: false,
                targetSizeKb: null,
                compressionRatio: null,
                formatRecommendation: null,
                qualityRecommendation: null,
                reasons: []
            };
            
            const pixelCount = width * height;
            const currentSizeKb = fileSizeBytes / 1024;
            
            if (currentSizeKb > 500) {
                recommendations.shouldCompress = true;
                recommendations.targetSizeKb = 500;
                recommendations.reasons.push(`File size ${currentSizeKb.toFixed(1)}KB exceeds 500KB limit`);
                recommendations.compressionRatio = 500 / currentSizeKb;
            }
            
            const bytesPerPixel = fileSizeBytes / pixelCount;
            const classification = this.classifyImage(imagePath, width, height);
            const category = classification.category;
            
            if (category === 'Small Icon' || category === 'Large Icon') {
                const expectedBpp = category === 'Small Icon' ? 6.0 : 4.0;
                const minSizeThreshold = category === 'Small Icon' ? 10 : 20;
                
                if (bytesPerPixel > expectedBpp && currentSizeKb > minSizeThreshold) {
                    recommendations.shouldCompress = true;
                    const targetBpp = Math.min(expectedBpp, bytesPerPixel * 0.7);
                    recommendations.targetSizeKb = (pixelCount * targetBpp) / 1024;
                    recommendations.reasons.push(
                        `${category} inefficient: ${bytesPerPixel.toFixed(1)} bytes/pixel (expected: ${expectedBpp.toFixed(1)})`
                    );
                }
            } else if (category === 'Background') {
                const fileExt = path.extname(imagePath).toLowerCase();
                
                if (['.jpg', '.jpeg'].includes(fileExt)) {
                    const expectedBpp = 2.0;
                    if (bytesPerPixel > 3.0 && currentSizeKb > 100) {
                        recommendations.shouldCompress = true;
                        recommendations.targetSizeKb = (pixelCount * expectedBpp) / 1024;
                        recommendations.reasons.push(
                            `JPEG background inefficient: ${bytesPerPixel.toFixed(1)} bytes/pixel`
                        );
                    }
                } else {
                    const expectedBpp = 4.0;
                    if (bytesPerPixel > 6.0 && currentSizeKb > 150) {
                        recommendations.shouldCompress = true;
                        recommendations.targetSizeKb = (pixelCount * expectedBpp) / 1024;
                        recommendations.reasons.push(
                            `PNG background inefficient: ${bytesPerPixel.toFixed(1)} bytes/pixel`
                        );
                    }
                }
            } else if (category === 'Placeholder') {
                if (currentSizeKb > 200) {
                    recommendations.shouldCompress = true;
                    recommendations.targetSizeKb = 200;
                    recommendations.reasons.push(
                        `Placeholder image too large: ${currentSizeKb.toFixed(1)}KB`
                    );
                }
            } else {
                if (bytesPerPixel > 8.0 && currentSizeKb > 100) {
                    recommendations.shouldCompress = true;
                    recommendations.targetSizeKb = (pixelCount * 4.0) / 1024;
                    recommendations.reasons.push(
                        `Image very inefficient: ${bytesPerPixel.toFixed(1)} bytes/pixel`
                    );
                }
            }
            
            const fileExt = path.extname(imagePath).toLowerCase();
            
            if (classification.category === 'Icon' && ['.jpg', '.jpeg'].includes(fileExt)) {
                recommendations.formatRecommendation = 'PNG';
                recommendations.reasons.push('Icons should use PNG format for transparency support');
            } else if (classification.category === 'Background/Splash' && fileExt === '.png') {
                recommendations.formatRecommendation = 'JPEG';
                recommendations.reasons.push('Backgrounds without transparency can use JPEG for smaller size');
            }
            
            if (recommendations.shouldCompress) {
                if (classification.category === 'Icon') {
                    recommendations.qualityRecommendation = 90;
                } else {
                    recommendations.qualityRecommendation = 85;
                }
            }
            
            return recommendations;
            
        } catch (error) {
            logger.error('Error getting compression recommendations', { imagePath, error: error.message });
            return {
                currentSizeKb: fileSizeBytes / 1024,
                shouldCompress: false,
                targetSizeKb: null,
                compressionRatio: null,
                formatRecommendation: null,
                qualityRecommendation: null,
                reasons: ['Error analyzing compression needs']
            };
        }
    }

    getParentDirs(imagePath) {
        const pathParts = imagePath.split(path.sep);
        return pathParts.slice(0, -1).map(part => part.toLowerCase());
    }
}

module.exports = ImageAnalyzer;