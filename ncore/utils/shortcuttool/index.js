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

const path = require('path');
    const fs = require('fs');
    const util = require('util');
    const winShortcut = require('windows-shortcuts');
    const { file, strtool, tool } = require('../utils.js');
    const { gdir, env } = require('#@global_vars');
    const { app, nativeImage } = require('electron');
    const Base = require('#@base');

    const ShortcutQueryAsync = util.promisify(winShortcut.query);
    const ShortcutEditAsync = util.promisify(winShortcut.edit);
    const ShortcutCreateAsync = util.promisify(winShortcut.create);

    class Main extends Base {
        constructor() {
            super();
            this.iconParseLnkCache = {};
            this.iconTmpDir = gdir.getLocalDir();
            this.convertToError = [];
            this.convertToErrorImgs = [];
        }

        async updateShortcut(group, basename, target, icon, base64image) {
            const iconDir = path.join(this.iconTmpDir, group);
            const iconBasename = path.extname(basename) !== '.lnk' ? `${basename}.lnk` : basename;
            const iconPath = path.join(iconDir, iconBasename);
            target = file.replaceDir(target, config.setting_soft, 2);
            const shortcutOption = {
                target,
                icon: iconPath,
            };
            if (file.existsSync(iconPath)) {
                await this.editShortcutAsync(iconPath, shortcutOption);
            } else {
                await this.createShortcutAsync(iconPath, shortcutOption);
            }
            const iconConfig = this.readIconJSONByLocal() || {};
            if (!iconConfig[group]) {
                iconConfig[group] = {};
            }
            if (!iconConfig[group][iconBasename]) {
                const softbaseinfo = {
                    path: target,
                    target,
                    id: `${group.replace(/\s+/g, '')}_selector`,
                    basename,
                };
                if (base64image) {
                    softbaseinfo.iconBase64 = base64image;
                }
                iconConfig[group][iconBasename] = softbaseinfo;
            } else {
                if (base64image) {
                    iconConfig[group][iconBasename].iconBase64 = base64image;
                }
            }
            this.saveIconJSONByLocal(iconConfig);
        }

        async updateShortcutPaths(dirPath, newPath, paths) {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.lstatSync(filePath);
                if (stats.isDirectory()) {
                    await this.updateShortcutPaths(filePath, newPath, paths);
                } else if (path.extname(file).toLowerCase() === '.lnk') {
                    const shortcut = await this.readShortcutAsync(filePath);
                    let { target, icon } = shortcut;
                    if (!icon) {
                        icon = shortcut.target;
                    }
                    let workingDir = path.dirname(target);
                    icon = icon.replace(/^"+|"+$/g, '');
                    target = target.replace(/^"+|"+$/g, '');
                    workingDir = workingDir.replace(/^"+|"+$/g, '');
                    const targetInclude = file.matchPathStartwith(target, paths);
                    const iconInclude = file.matchPathStartwith(icon, paths);
                    const workingDirInclude = file.matchPathStartwith(workingDir, paths);
                    if (targetInclude) {
                        target = file.pathReplace(target, targetInclude, newPath);
                    }
                    if (iconInclude) {
                        icon = file.pathReplace(icon, iconInclude, newPath);
                    }
                    if (workingDirInclude) {
                        workingDir = file.pathReplace(workingDir, workingDirInclude, newPath);
                    }
                    const shortcutOptions = { target, workingDir, icon };
                    await this.editShortcutAsync(filePath, shortcutOptions);
                }
            }
        }

        async createShortcutAsync(shortcutPath, shortcutOptions) {
            try {
                await ShortcutCreateAsync(shortcutPath, shortcutOptions);
            } catch (err) {
                console.error(`Failed to create shortcut ${shortcutPath}: ${err.message}`);
            }
        }

        async editShortcutAsync(shortcutPath, shortcutOptions) {
            try {
                await ShortcutEditAsync(shortcutPath, shortcutOptions);
            } catch (err) {
                console.error(`Failed to edit shortcut ${shortcutPath}: ${err.message}`);
            }
        }

        readLinkFile(filePath, callback) {
            try {
                winShortcut.query(filePath, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    callback(result, 'DEFAULT_VALUE');
                });
            } catch (e) {
                callback(null, 'DEFAULT_VALUE');
                console.log(e);
            }
        }

        appReadIconByFile(filePath, callback) {
            app.getFileIcon(filePath, { size: 'normal' }).then((icon) => {
                try {
                    const iconBase64 = icon.toDataURL();
                    callback(iconBase64);
                } catch (e) {
                    callback(this.getDefaultImageBase64Icon());
                }
            }).catch((e) => {
                callback(this.getDefaultImageBase64Icon());
            });
        }

        getIconInBase64(filePath, callback) {
            if (path.extname(filePath) === '.lnk') {
                winShortcut.query(filePath, (err, result) => {
                    if (err) {
                        callback(this.getDefaultImageBase64Icon(), 'DEFAULT_VALUE');
                        return;
                    }
                    const iconPath = result.icon;
                    if (!iconPath) {
                        callback(this.getDefaultImageBase64Icon(), 'DEFAULT_VALUE');
                        return;
                    }
                    this.readFileAsBase64(iconPath, callback);
                });
            } else {
                this.readFileAsBase64(filePath, callback);
            }
        }

        async generateIconShortcut(icons) {
            const iconCacheDirectory = 'iconCacheDirectory';
            let createIcons = 0;
            const iconDir = gdir.getLocalDir(iconCacheDirectory);
            for (const iconDirname in icons) {
                const iconType = icons[iconDirname];
                if (Object.keys(iconType).length > 0) {
                    const fullIconDir = path.join(iconDir, iconDirname);
                    try {
                        await file.mkdirPromise(fullIconDir);
                        for (const iconName in iconType) {
                            const iconOption = iconType[iconName];
                            let shortcutPath = path.join(fullIconDir, iconName);
                            if (path.extname(shortcutPath) !== '.lnk') {
                                shortcutPath += '.lnk';
                            }
                            const isFile = await file.isFileAsync(shortcutPath);
                            if (!isFile) {
                                let iconPath = iconOption.iconPath;
                                if (!file.isFile(iconPath)) {
                                    iconPath = iconOption.iconImgPath;
                                }
                                const shortcutOption = {
                                    path: iconOption.path,
                                    target: iconOption.target,
                                    icon: iconPath,
                                };
                                createIcons++;
                                try {
                                    await ShortcutCreateAsync(shortcutPath, shortcutOption);
                                } catch (e) {
                                    console.log(e);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                }
            }
            if (createIcons > 0) {
                messageWidget.success(`Successfully created icon: ${createIcons}.`);
            }
        }
    }

    module.exports = new Main();