const fs = require('fs');
const path = require('path');

async function copyDirectory(src, dest, extMap = {}) {
    try {
        const entries = await fs.readdir(src, { withFileTypes: true });

        // 创建目标目录
        if (!fs.existsSync(dest)){
            await fs.mkdir(dest, { recursive: true });
        }

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await copyDirectory(srcPath, destPath, extMap);  // 递归处理子目录
            } else {
                let mappedDestPath = destPath;
                for (let ext in extMap) {
                    if (path.extname(destPath) === ext) {
                        mappedDestPath = destPath.replace(new RegExp(ext + '$'), extMap[ext]);
                        break;
                    }
                }
                await fs.copyFile(srcPath, mappedDestPath);
            }
        }
    } catch (error) {
        console.error('Error copying directory:', error);
    }
}

// 使用方法
// 假设你希望从'srcDir'目录复制到'destDir'目录，并将.js文件改为.py文件
const srcDir = './spider';
const destDir = './spider_python';
copyDirectory(srcDir, destDir, { '.js': '.py' }).then(() => {
    console.log('Directory copied successfully.');
}).catch(err => {
    console.error('Error during copying:', err);
});
