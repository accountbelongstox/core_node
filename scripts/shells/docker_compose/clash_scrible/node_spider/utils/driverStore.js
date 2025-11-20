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

const { v4: uuidv4 } = require('uuid');

class DriverStore {
    constructor() {
        this.drivers = [];
        this.nameIndex = new Map();
        this.idIndex = new Map();
    }

    addDriver(driver, name = null, index = null) {
        const id = uuidv4();
        if (!name) {
            name = `driver_${id}`;
        }
        const driverInfo = { driver, id, name };

        if (index !== null && index >= 0 && index < this.drivers.length) {
            this.drivers[index] = driverInfo;
        } else {
            index = this.drivers.length;
            this.drivers.push(driverInfo);
        }

        this.nameIndex.set(name, index);
        this.idIndex.set(id, index);

        return id;
    }

    getDriver(identifier) {
        if (typeof identifier === 'number') {
            return this.getDriverByIndex(identifier);
        } else if (typeof identifier === 'string') {
            return this.getDriverByIdOrName(identifier);
        }
        return this.getDriverByIndex(0);
    }

    getDriverByIndex(index) {
        if (index >= 0 && index < this.drivers.length) {
            return this.drivers[index].driver;
        }
        return null;
    }

    getDriverByIdOrName(identifier) {
        let index = this.idIndex.get(identifier);
        if (index === undefined) {
            index = this.nameIndex.get(identifier);
        }
        return index !== undefined ? this.drivers[index].driver : null;
    }

    hasDriverById(id) {
        return this.idIndex.has(id);
    }

    hasDriverByIndex(index) {
        return index >= 0 && index < this.drivers.length;
    }

    hasDriverByName(name) {
        return this.nameIndex.has(name);
    }

    getAllDrivers() {
        return this.drivers.map(driverInfo => driverInfo.driver);
    }

    clearDrivers() {
        this.drivers = [];
        this.nameIndex.clear();
        this.idIndex.clear();
    }
}

module.exports = new DriverStore();