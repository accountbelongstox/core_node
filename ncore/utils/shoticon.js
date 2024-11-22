import path from 'path';
import fs from 'fs';
import electron from 'electron';
import util from 'util';
import winShortcut from 'windows-shortcuts';
import { atob } from 'atob';
import { file, strtool, httptool, tool } from '../utils.js';
import { gdir, env } from '../globalvars.js';
import Base from '#@base';

const { nativeImage, app, screen } = electron;
const ShortcutQueryAsync = util.promisify(winShortcut.query);
const ShortcutEditAsync = util.promisify(winShortcut.edit);
const ShortcutCreateAsync = util.promisify(winShortcut.create);

let pngImgToIco;

class Main extends Base {
    constructor() {
        super();
        this.iconParseLnkCache = {};
        this.iconTmpDir = gdir.getLocalDir();
        this.convertToError = [];
        this.convertToErrorImgs = [];
    }

    async parseLnkFile(lnkFilePath) {
        if (!file.isAbsolute(lnkFilePath)) {
            lnkFilePath = gdir.getDesktopFile(lnkFilePath);
        }

        const basename = path.basename(lnkFilePath);
        if (this.iconParseLnkCache[basename]) {
            return this.iconParseLnkCache[basename];
        }

        try {
            const shortcutData = await ShortcutQueryAsync(lnkFilePath);
            shortcutData.linkPath = lnkFilePath;
            this.iconParseLnkCache[basename] = shortcutData;
            return shortcutData;
        } catch (error) {
            console.error(`Error reading shortcut ${lnkFilePath}:`, error);
            return null;
        }
    }

    getPrimaryDisplay() {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        return { width, height };
    }

    getIconWidth() {
        let iconWidth = 50;
        try {
            const { width } = this.getPrimaryDisplay();
            if (width <= 1920) {
                iconWidth = 30;
            }
        } catch (e) {
            console.log(e);
        }
        return iconWidth;
    }

    addIconToCacheJSON(jsonData, resultIcons) {
        for (const item of jsonData) {
            const softwareList = item.softwareList;
            for (let i = 0; i < softwareList.length; i++) {
                const softwareItem = softwareList[i];
                const basename = softwareItem.basename;
                if (resultIcons[basename] && resultIcons[basename].iconBase64) {
                    softwareList[i].iconBase64 = resultIcons[basename].iconBase64;
                } else {
                    softwareList[i].iconBase64 = '';
                }
            }
        }
        return jsonData;
    }

    createIdByIconsJSON(jsonData) {
        const borders = ['border-primary', 'border-info', 'border-success', 'border-danger', 'border-warning'];
        for (const item of jsonData) {
            const softwareList = item.softwareList;
            const groupname = item.groupname;
            const gid = this.genGid(groupname);
            item.border = tool.getRandomItem(borders);
            item.gid = gid;
            item.icon_width = this.getIconWidth();
            for (let i = 0; i < softwareList.length; i++) {
                const softwareItem = softwareList[i];
                const basename = softwareItem.basename;
                if (!softwareList[i].aid) {
                    softwareList[i].aid = this.genAid(basename);
                    softwareList[i].gid = gid;
                    softwareList[i].img_id = this.genImgId(basename);
                }
            }
        }
        return jsonData;
    }

    updateIconToHTML(groupname, softConf, iconBase64) {
        softConf.iconBase64 = iconBase64;
        const gid = strtool.get_id(groupname, 'g');
        const basename = softConf.basename;
        const updateConf = {
            groupname,
            softConf,
            icon_width: this.getIconWidth(),
            gid,
            img_id: this.genImgId(basename),
        };
        console.log('index:updateIconToHtml');
        httptool.sendToWebSocket('index:updateIconToHtml', updateConf);
    }

    genAid(basename) {
        return strtool.get_id(basename, 'a');
    }

    genGid(groupname) {
        return strtool.get_id(groupname, 'g');
    }

    genImgId(basename) {
        const aid = this.genAid(basename);
        return `img${aid}`;
    }

    getDefaultImageBase64Icon() {
        if (this.defaultImageBase64IconTemp) {
            return this.defaultImageBase64IconTemp;
        }
        const icon = file.get_stylesheet('img/default_app.png');
        this.defaultImageBase64IconTemp = file.readBase64ByFile(icon);
        return this.defaultImageBase64IconTemp;
    }

    getDefaultImageFile() {
        return file.get_stylesheet('img/default_app.png');
    }

    async readShortcutAsync(shortcutPath) {
        try {
            const shortcut = await ShortcutQueryAsync(shortcutPath);
            return shortcut;
        } catch (err) {
            console.error(`Failed to read shortcut ${shortcutPath}: ${err.toString()}`);
            return null;
        }
    }

    readIconByFile(filePath) {
        const icon = nativeImage.createFromPath(filePath);
        return icon.toDataURL();
    }


    getRemoteShortcutsIconFile() {
        return 'icons_cache.json';
    }

    getShortcutsIconFName() {
        return gdir.getLocalDir(this.getRemoteShortcutsIconFile());
    }

    getShortcutsIconFile() {
        const configDir = this.getShortcutsIconFName();
        file.mkbasedir(configDir);
        return configDir;
    }

    readShortcutsIconJSONByLocal() {
        const jsonFile = this.getShortcutsIconFile();
        return file.readJSON(jsonFile);
    }

    getSoftCacheFile() {
        return gdir.getLocalFile('soft_group_v2.json');
    }

    getIconCacheFile() {
        return gdir.getLocalFile('soft_icons.json');
    }

    saveLocalSoftlistJSON(iconsJson) {
        file.saveJSON(this.getSoftCacheFile(), iconsJson);
    }

    readLocalSoftlistJSON() {
        const iconFile = this.getSoftCacheFile();
        if (!file.isFile(iconFile)) {
            return null;
        }
        return file.readJSON(iconFile);
    }

    saveLocalIconJSON(iconsJson) {
        file.saveJSON(this.getIconCacheFile(), iconsJson);
    }

    readLocalIconJSON() {
        const iconFile = this.getIconCacheFile();
        if (!file.isFile(iconFile)) {
            return null;
        }
        return file.readJSON(iconFile);
    }

    getLocalIconJSONModified() {
        return file.getModificationTime(this.getSoftCacheFile());
    }

    mergeIconJson(jsonData, newJsonData) {
        const groupnameOld = this.getGroupNames(jsonData);
        for (const item of newJsonData) {
            const softwareList = item.softwareList;
            const groupname = item.groupname;
            const hasGroupName = this.hasGroupName(groupname, groupnameOld);
            if (!hasGroupName) {
                jsonData.push(item);
            } else {
                const softs = this.getSoftNamesByGroup(groupname, jsonData);
                for (const softwareItem of softwareList) {
                    const basename = softwareItem.basename;
                    if (!this.hasSoftByGroup(basename, softs)) {
                        jsonData.find(g => g.groupname === groupname).softwareList.push(softwareItem);
                    }
                }
            }
        }
        return jsonData;
    }

    hasGroupName(groupname, groupnames, jsonData) {
        return groupnames ? groupnames.includes(groupname) : this.getGroupNames(jsonData).includes(groupname);
    }

    getGroupNames(jsonData) {
        return jsonData.map(item => item.groupname);
    }

    hasSoftByGroup(basename, softs, groupname, jsonData) {
        return softs ? softs.includes(basename) : this.getSoftNamesByGroup(groupname, jsonData).includes(basename);
    }

    getSoftNamesByGroup(groupname, jsonData) {
        const group = jsonData.find(g => g.groupname === groupname);
        return group ? group.softwareList.map(s => s.basename) : [];
    }

    isLocalIconJSONModifiedWithoutHour() {
        const modificationTime = this.getLocalIconJSONModified();
        if (modificationTime === 0) {
            return false;
        }
        const currentTime = Date.now();
        const hourInMilliseconds = 3600000;
        return (currentTime - modificationTime) >= hourInMilliseconds;
    }

    isCacheItemIconBase64(iconBase64) {
        return iconBase64 && !iconBase64.trim().endsWith(';base64,');
    }

    mergeIconShort(iconsJson, shortcutsIcon) {
        const base64Img = 'iconBase64';
        for (const key in iconsJson) {
            for (const key2 in iconsJson[key]) {
                const basename = iconsJson[key][key2].basename;
                if (shortcutsIcon[basename] && this.isCacheItemIconBase64(shortcutsIcon[basename][base64Img])) {
                    iconsJson[key][key2][base64Img] = shortcutsIcon[basename][base64Img];
                } else {
                    iconsJson[key][key2][base64Img] = this.getDefaultImageBase64Icon();
                }
            }
        }
        return iconsJson;
    }

    checkIconFileIsExists(jsonData) {
        const appDirValue = env.getEnv('DESKTOP_APP_DIR') || file.readFile(gdir.getLocalInfoFile('appdir_info.ini'));
        if (!appDirValue) {
            this.warn('appDirValue not exists!', appDirValue);
        }
        const appDir = appDirValue ? appDirValue.trim() : null;

        for (const item of jsonData) {
            const softwareList = item.softwareList;
            for (const softwareItem of softwareList) {
                let { iconPath, target, path: exePath } = softwareItem;
                item.appDir = appDir;
                item.icon_width = this.getIconWidth();

                if (appDir) {
                    if (!file.isAbsolute(iconPath)) {
                        iconPath = path.join(appDir, iconPath);
                        softwareItem.iconPath = iconPath;
                    }
                    if (!file.isAbsolute(exePath)) {
                        exePath = path.join(appDir, exePath);
                        softwareItem.path = exePath;
                    }
                    if (!file.isAbsolute(target)) {
                        target = path.join(appDir, target);
                        softwareItem.target = target;
                    }
                }
                if (target) {
                    item.mainDir = file.getLevelPath(target, 2);
                }
                if (file.isAbsolute(softwareItem.target)) {
                    softwareItem.isExist = file.isFile(softwareItem.target);
                }
            }
        }
        return jsonData;
    }
}

export default new Main();
