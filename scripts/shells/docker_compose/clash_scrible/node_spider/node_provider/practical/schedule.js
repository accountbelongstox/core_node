const schedule = require('node-schedule');

class Main {
    // */10 * * * * *
    // This runs every 10 seconds

    // * * * * *
    // This runs every 1 minute
    
    // 0 * * * *
    // This runs every 1 hour

    // 30 07 * * *
    // This runs every day at 14:30
    
    // 30 14 * * 0
    // This runs every Sunday at 14:30
    
    // 30 14 1 * *
    // This runs the 1st day of every month at 14:30

    tasks = {}

    register(execute_time, name, func) {
        if (!this.tasks[execute_time]) {
            this.tasks[execute_time] = {}
            schedule.scheduleJob(execute_time, () => {
                for (const fname in this.tasks[execute_time]) {
                    let func = this.tasks[execute_time][fname]
                    func()
                }
            });
        }
        this.tasks[execute_time][name] = func
    }

    async main() {
    }
}

module.exports = new Main()

