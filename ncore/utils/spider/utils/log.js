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
