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

const fs = require('fs');
    const yaml = require('yaml');

    class YamlTool {
        constructor(filePath) {
            this.filePath = filePath;
            this.composeData = this.readYaml();
        }

        // Read YAML file
        readYaml() {
            try {
                const fileContents = fs.readFileSync(this.filePath, 'utf8');
                return yaml.parse(fileContents);
            } catch (e) {
                console.error(`Failed to read YAML file: ${e.message}`);
                return null;
            }
        }

        // Save YAML file
        saveYaml() {
            try {
                const yamlStr = yaml.stringify(this.composeData);
                fs.writeFileSync(this.filePath, yamlStr, 'utf8');
            } catch (e) {
                console.error(`Failed to save YAML file: ${e.message}`);
            }
        }

        // Get services or networks
        getServices() {
            return this.composeData?.services || {};
        }

        getNetworks() {
            return this.composeData?.networks || {};
        }

        // Add service
        addService(serviceName, serviceDefinition) {
            this.composeData.services = this.composeData.services || {};
            this.composeData.services[serviceName] = serviceDefinition;
            this.saveYaml();
        }

        // Remove or replace service
        removeService(serviceName) {
            if (this.composeData.services && this.composeData.services[serviceName]) {
                delete this.composeData.services[serviceName];
                this.saveYaml();
            }
        }

        replaceService(serviceName, newServiceDefinition) {
            if (this.composeData.services) {
                this.composeData.services[serviceName] = newServiceDefinition;
                this.saveYaml();
            }
        }

        // Get service by name
        getServiceByName(serviceName) {
            return this.composeData.services?.[serviceName] || null;
        }

        // Get multiple services by names
        getServicesByNames(serviceNames) {
            return serviceNames.map(name => this.getServiceByName(name)).filter(service => service !== null);
        }

        // Filter services by a condition
        filterServices(predicate) {
            return Object.entries(this.composeData.services || {})
                .filter(([name, service]) => predicate(name, service))
                .map(([name]) => name);
        }
    }

    module.exports = YamlTool;