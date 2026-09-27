const fs = require('fs');
const path = require('path');
const readline = require('readline');

class Log{

    writeLog(logText, logType = "info", maxTotalSizeMb = 500, logfilename = null, maxfile = 5,cwd) {
        const maxSize = maxTotalSizeMb * 1024 * 1024
        const logDir = path.join(cwd, "logs");
        fs.mkdirSync(logDir, { recursive: true });
        logfilename = logfilename ? `${logType}_${logfilename}` : logType;
        const logOjb = this.generateLogFile(logfilename, logDir, maxSize)
        logfilename = logOjb.logfile
        if (logOjb.logcount > maxfile) {
            this.reduceLogs(logDir, maxSize);
        }
        const logEntry = `[${new Date().toISOString()}] [${logType}] ${logText}\n`;
        fs.appendFileSync(logfilename, logEntry, 'utf-8');
    }
    
    countLogLines(logfile, logDir) {
        const logFiles = this.getLogs(logfile, logDir);
        let totalLines = 0;
        for (const logFile of logFiles) {
            const filePath = path.join(logDir, logFile);
            const rl = readline.createInterface({
                input: fs.createReadStream(filePath),
                crlfDelay: Infinity,
            });
            for (const line of rl) {
                totalLines++;
            }
        }
        return totalLines;
    }

    getLogs(logfile, logDir) {
        const logFiles = fs.readdirSync(logDir).filter(file => file.startsWith(`${logfile}_`) && file.endsWith(".log"));
        return logFiles
    }

    getLastLogfile(logfile, logDir) {
        const logFiles = this.getLogs(logfile, logDir);
        const logcount = logFiles.length
        if (logcount > 0) {
            logFiles.sort((a, b) => {
                const indexA = parseInt(a.split('_').slice(-1)[0].split('.')[0]);
                const indexB = parseInt(b.split('_').slice(-1)[0].split('.')[0]);
                return indexB - indexA;
            });
            const lastLogFile = path.join(logDir, logFiles[0]);
            const lastLogSize = fs.statSync(lastLogFile).size;
            return { path: lastLogFile, size: lastLogSize, logcount };
        } else {
            return { path: null, logcount };
        }
    }

    generateLogFile(logfile, logDir, maxSize) {
        const lastLog = this.getLastLogfile(logfile, logDir)
        const logcount = lastLog.logcount
        const lastLogFile = lastLog.path
        if (lastLogFile) {
            if (lastLog.size > maxSize) {
                const newIndex = parseInt(logFiles[0].split('_').slice(-1)[0].split('.')[0]) + 1;
                const newLogFile = path.join(logDir, `${logfile}_${newIndex}.log`);
                fs.writeFileSync(newLogFile, '');
                logfile = newLogFile
            } else {
                logfile = lastLogFile
            }
        } else {
            const initialLogFile = path.join(logDir, `${logfile}_1.log`);
            fs.writeFileSync(initialLogFile, '');
            logfile = initialLogFile
        }
        return {
            logfile,
            logcount
        }
    }

    reduceLogs(logDir, maxSize) {
        const logFiles = fs.readdirSync(logDir).filter(file => file.endsWith(".txt"));
        for (const file of logFiles) {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile() && stats.size > maxSize) {
                this.trimLogFile(filePath);
            }
        }
    }

    trimLogFile(filePath) {
        const outputFilePath = `${filePath}_trimmed.txt`;
        const readStream = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(outputFilePath);
        const rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity,
        });

        let lines = [];
        let lineCount = 0;

        for (const line of rl) {
            lines.push(line);
            lineCount++;
        }

        const halfIndex = Math.ceil(lineCount / 2);
        const secondHalf = lines.slice(halfIndex).join('\n');

        writeStream.write(secondHalf);
        writeStream.end();

        fs.unlinkSync(filePath);
        fs.renameSync(outputFilePath, filePath);

        console.log(`Trimmed ${filePath}. Kept the second half of lines.`);
    }
}

Log.toString = () => '[class Log]';
module.exports = Log;
