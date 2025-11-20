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

const winston = require('winston');
const { createLogger, transports } = winston;

class Loggin {
    mainLogin = null
    logDirectory = null

    info(text) {
        this.initLog();
        this.mainLogin.log({
            level: 'info',
            message: text
        });
    }

    error(text) {
        this.initLog();
        this.mainLogin.log({
            level: 'error',
            message: text
        });
    }

    setLogDir(logDirectory) {
        this.logDirectory = logDirectory;
    }

    initLog(logfile = 'logfile.log') {
        if (!this.mainLogin) {
            if (this.logDirectory) {
                logfile = path.join(this.logDirectory, logfile);
            }

            this.mainLogin = createLogger({
                transports: [
                    new transports.Console(),
                    new transports.File({ filename: logfile }) 
                ]
            });
        }
    }
}

Loggin.toString = () => '[class Loggin]';
module.exports = new Loggin();
