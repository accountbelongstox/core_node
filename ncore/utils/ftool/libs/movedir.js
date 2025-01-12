
async function moveFolder(srcDir, destDir) {
    try {
        const srcParent = path.dirname(srcDir);
        const destParent = path.dirname(destDir);
        if (srcParent === destParent) {
            fs.renameSync(srcDir, destDir);
        } else {
            await copyDirectory(srcDir, destDir);
            await deleteFolderAsync(srcDir);
        }
        return true;
    } catch (error) {
        console.error(`Error moving folder: ${error.message}`);
        return false;
    }
}