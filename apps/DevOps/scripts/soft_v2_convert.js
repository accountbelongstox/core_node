const fs = require('fs');
const path = require('path');

class ImageTypeDetector {
    constructor(folderPath) {
        this.folderPath = folderPath;
    }

    async searchSoftIcons() {
        const softIconsOldFile = path.join(__dirname, 'soft_group_v2_old.json');
        const softIconsFile = path.join(__dirname, 'soft_group_v2.json');

        const softIconsData = await fs.promises.readFile(softIconsOldFile);
        const jsonData = JSON.parse(softIconsData);
        let formattedJsonData = []

        for (let index = 0; index < jsonData.length; index++) {
            let group = {}
            const item = jsonData[index];
            const softwareList = item.softwareList[0];
        
            group.groupname = item.groupname
            group.show_cn =item.show_cn
            group.softwareList = []
            
            for (let key in softwareList) {
                if (softwareList.hasOwnProperty(key)) {
                    let value = softwareList[key];
                    delete value[`id`]
                    delete value[`listcount`]
                    group.softwareList.push({
                        lnkName: key,
                        ...value
                    })
                }
            }
            formattedJsonData.push(group)
        }

        console.log(JSON.stringify(formattedJsonData, null, 4));
        if (!fs.existsSync(softIconsFile)) {
            fs.writeFileSync(softIconsFile, '');
        }
        const formattedSoftIcons = JSON.stringify(formattedJsonData, null, 2);
        await fs.promises.writeFile(softIconsFile, formattedSoftIcons);

    }
    
}

// Example usage:
const folderPath = './pngs';
const imageDetector = new ImageTypeDetector(folderPath);
imageDetector.searchSoftIcons()