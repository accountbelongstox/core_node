const fs = require('fs').promises;
const path = require('path');

async function generateMissingFiles(directory) {
    try {
        // 递归获取目录中的所有文件
        const files = await fs.readdir(directory, { withFileTypes: true });

        // 用于存放已识别的基本文件名（不包含扩展名和'_interface'）
        const baseNames = new Set();

        // 分析文件名，收集基本文件名
        for (const file of files) {
            if (file.isFile()) {
                const parsedPath = path.parse(file.name);
                if (parsedPath.ext !== '.txt') {
                    const base = parsedPath.name.endsWith('_interface') 
                        ? parsedPath.name.slice(0, -10)
                        : parsedPath.name;
                    baseNames.add(base);
                }
            }
        }

        for (const base of baseNames) {
            const mainFile = `${base}${path.extname(base)}`;
            const interfaceFile = `${base}_interface${path.extname(base)}`;
            const txtFile = `${base}_interface.txt`;

            // 检查主文件是否存在
            if (!files.some(file => file.name === mainFile)) {
                await fs.writeFile(path.join(directory, mainFile), '');
                console.log(`Created: ${mainFile}`);
            }

            // 检查_interface文件是否存在
            if (!files.some(file => file.name === interfaceFile)) {
                await fs.writeFile(path.join(directory, interfaceFile), '');
                console.log(`Created: ${interfaceFile}`);
            }

            // 检查txt文件是否存在
            if (!files.some(file => file.name === txtFile)) {
                await fs.writeFile(path.join(directory, txtFile), '');
                console.log(`Created: ${txtFile}`);
            }
        }
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }
}

const directory = './interface'; // 替换为您的目录路径
generateMissingFiles(directory);
