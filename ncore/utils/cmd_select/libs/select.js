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

const inquirer = require('inquirer');
    const chalk = require('chalk');

    class Select {
        constructor() {
            this.selectedIndices = new Set();
            this.currentIndex = 0;
            this.editUserInput = "";
        }

        async editStr(editStr = "", settingName = "", show = false, init = "str") {
            const pEnter = show ? chalk.blue("-------") : chalk.yellow("<Enter>");
            const pSkip = show ? chalk.blue("--------") : chalk.blue(" to skip  ");
            const preStr = chalk.blue("-------");
            const skipStr = `press${pEnter}${pSkip}${preStr}`;
            if (settingName) {
                const pSettingName = chalk.blue(settingName);
                console.log(`${preStr}  config:${pSettingName}, ${skipStr}`);
            }
            const greenColor = chalk.green;
            const endColor = chalk.reset;
            if (init === "pwd" && !editStr) {
                editStr = this.createPassword(12);
            }
            const inputNse = !show ? `\n\t${skipStr}\n\tInput New?:` : "";
            const prompt = `\tvalues : ${greenColor(editStr)}${endColor} ${inputNse}`;
            let newVal = "";
            if (!show) {
                newVal = await this.promptInput(prompt);
            } else {
                console.log(prompt);
            }
            if (newVal && !show) {
                editStr = newVal;
                const pKey = chalk.red(settingName);
                const pVal = chalk.red(editStr);
                console.log(`The ${pKey} has been set to ${pVal}`);
            }
            console.log("\n");
            return editStr;
        }

        async edit(initStr = "") {
            this.initStr = initStr;
            this.editUserInput = await this.editText(this.initStr);
            return this.editUserInput;
        }

        async editText(text) {
            let displayText = text || this.initStr;
            let userInput = "";

            while (true) {
                console.clear();
                console.log(displayText);
                userInput = await this.promptInput("Enter new value:");
                console.log("Confirm? (y/n)");
                const key = await this.promptInput();
                if (key === 'y' || key === 'Y' || key === '\n') {
                    return userInput;
                } else {
                    displayText = userInput;
                }
            }
        }

        async promptInput(prompt = "") {
            const answers = await inquirer.prompt({
                type: 'input',
                name: 'response',
                message: prompt
            });
            return answers.response;
        }

        async byList(options, name = "") {
            this.options = options;
            this.name = name;
            const selectedOptions = await this.main();
            return selectedOptions;
        }

        showTitle() {
            console.clear();
            console.log(`Select ${this.name}, press Space-Key to select, and Enter to confirm.`);
        }

        showOptions() {
            console.clear();
            this.options.forEach((option, i) => {
                const label = `[${i + 1}]`;
                const si = i + 1;
                const truncatedOption = option.slice(0, process.stdout.columns - label.length - 5);
                if (si < process.stdout.rows) {
                    if (i === this.currentIndex) {
                        console.log(`[>] ${label} ${truncatedOption}`);
                    } else if (this.selectedIndices.has(i)) {
                        console.log(`[*] ${label} ${truncatedOption}`);
                    } else {
                        console.log(`[ ] ${label} ${truncatedOption}`);
                    }
                }
            });
        }

        async main() {
            this.showTitle();
            this.showOptions();

            const answers = await inquirer.prompt({
                type: 'list',
                name: 'selection',
                message: 'Select an option:',
                choices: this.options.map((option, index) => ({
                    name: `${index + 1}. ${option}`,
                    value: index
                }))
            });

            this.selectedIndices.add(answers.selection);
            const confirm = await this.confirmSelection();
            if (confirm === 'y' || confirm === '\n') {
                return this.getSelected();
            } else {
                return this.main();
            }
        }

        async confirmSelection() {
            console.clear();
            this.showTitle();
            this.showOptions();
            console.log(this.getConfirmStr());
            return await this.promptInput();
        }

        getSelected() {
            return Array.from(this.selectedIndices).map(i => this.options[i]);
        }

        getConfirmStr() {
            return `Confirm selection: ${JSON.stringify(this.getSelected())}? (y/n)`;
        }

        createPassword(length) {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let password = "";
            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * charset.length);
                password += charset[randomIndex];
            }
            return password;
        }
    }

    module.exports = Select;