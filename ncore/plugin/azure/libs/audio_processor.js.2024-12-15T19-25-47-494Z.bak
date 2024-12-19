import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import Base from '#@base';

export class AudioProcessor extends Base {
    adjustSpeed(wavFile, speed) {
        return new Promise((resolve, reject) => {
            // Parse the file name and extension
            const ext = path.extname(wavFile);
            const baseName = path.basename(wavFile, ext);
            const dirName = path.dirname(wavFile);
            const newFileName = `${baseName}.s.${speed}${ext}`;
            const newFilePath = path.join(dirName, newFileName);

            // Check if the file already exists and is non-zero in size
            if (this.fileExists(newFilePath)) {
                const fileStats = fs.statSync(newFilePath);
                if (fileStats.size > 0) {
                    this.success(`Returning existing file: ${newFilePath}`);
                    resolve(newFilePath);
                    return;
                } else {
                    this.warn(`File exists but is 0 KB. Deleting and regenerating: ${newFilePath}`);
                    fs.unlinkSync(newFilePath); // Delete the zero-byte file
                }
            }

            // Execute the ffmpeg command
            const command = `ffmpeg -i "${wavFile}" -filter:a "atempo=${speed}" "${newFilePath}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    this.error(`Error adjusting speed: ${error.message}`);
                    reject(null);
                } else {
                    this.success(`Speed adjustment successful: ${newFilePath}`);
                    resolve(newFilePath);
                }
            });
        });
    }

    fileExists = (fileName) => fs.existsSync(fileName);
}



export const audioProcessor = new AudioProcessor();