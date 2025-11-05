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

const path = require('path');
const fs = require('fs');

class Encyclopedia  {
    constructor() {
        this.encyclopedia = {};
        this.loadEncyclopedia();
    }

    loadEncyclopedia() {
        try {
            const encyclopediaPath = path.join(__dirname, 'encyclopedia.json');
            if (fs.existsSync(encyclopediaPath)) {
                const content = fs.readFileSync(encyclopediaPath, 'utf8');
                this.encyclopedia = JSON.parse(content);
            }
        } catch (error) {
            console.error('Error loading encyclopedia:', error);
            this.encyclopedia = {};
        }
    }

    saveEncyclopedia() {
        try {
            const encyclopediaPath = path.join(__dirname, 'encyclopedia.json');
            fs.writeFileSync(encyclopediaPath, JSON.stringify(this.encyclopedia, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving encyclopedia:', error);
            return false;
        }
    }

    get(key, defaultValue = null) {
        return this.encyclopedia[key] !== undefined ? this.encyclopedia[key] : defaultValue;
    }

    set(key, value) {
        this.encyclopedia[key] = value;
        return this.saveEncyclopedia();
    }

    has(key) {
        return key in this.encyclopedia;
    }

    remove(key) {
        if (key in this.encyclopedia) {
            delete this.encyclopedia[key];
            return this.saveEncyclopedia();
        }
        return false;
    }

    delete(key) {
        return this.remove(key);
    }

    keys() {
        return Object.keys(this.encyclopedia);
    }

    values() {
        return Object.values(this.encyclopedia);
    }

    entries() {
        return Object.entries(this.encyclopedia);
    }

    getAll() {
        return { ...this.encyclopedia };
    }

    clear() {
        this.encyclopedia = {};
        return this.saveEncyclopedia();
    }

    size() {
        return Object.keys(this.encyclopedia).length;
    }

    forEach(callback) {
        Object.entries(this.encyclopedia).forEach(([key, value]) => {
            callback(value, key, this.encyclopedia);
        });
    }
}

// Create and export default instance
module.exports = new Encyclopedia();
