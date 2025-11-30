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

