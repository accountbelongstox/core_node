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

    getAll() {
        return { ...this.encyclopedia };
    }

    clear() {
        this.encyclopedia = {};
        return this.saveEncyclopedia();
    }
}

// Create and export default instance
module.exports = new Encyclopedia();
