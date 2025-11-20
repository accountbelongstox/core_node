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
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');
const env = require('../../../ncore/gvar/libs/env.js');

const GLOBAL_VAR_DIR="/usr/core_node/global_var"
const INSTALL_MODE = getValByGlobalVar(`INSTALL_MODE`);
const DOCKER_FULL = env.getEnvValue(`DOCKER_FULL`);
const DOCKER_BASE = env.getEnvValue(`DOCKER_BASE`);
const DOCKER_CADDY = env.getEnvValue(`DOCKER_CADDY`);
const DOCKER_SERVER = env.getEnvValue(`DOCKER_SERVER`);
let DEFAULT_SELECTED = [];

if (INSTALL_MODE === "caddy") {
  DEFAULT_SELECTED = [DOCKER_CADDY.split(",")];
} else if (INSTALL_MODE === "server") {
  DEFAULT_SELECTED = [DOCKER_SERVER.split(",")];
} else if (INSTALL_MODE === "base") {
  DEFAULT_SELECTED = [DOCKER_BASE.split(",")];
} else if (INSTALL_MODE === "full") {
  DEFAULT_SELECTED = [DOCKER_FULL.split(",")];
}


// Configuration
const COMPOSE_FILE = path.join(__dirname, '../docker_compose/docker-compose-template.yml');
const OUTPUT_DIR = '/usr/docker_compose/generated';
const OUTPUT_FILE = path.join(OUTPUT_DIR, `docker-compose-${new Date().toISOString().replace(/[:.]/g, '-')}.yml`);


// Display settings
const COLUMNS = 3;
const ROWS = 10; // Max rows per screen
const COLUMN_WIDTH = 30;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getValByGlobalVar(file) {
  const filePath = path.join(GLOBAL_VAR_DIR, file);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Read and parse docker-compose file
function parseComposeFile() {
  try {
    const fileContents = fs.readFileSync(COMPOSE_FILE, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
    console.error(`Error reading docker-compose file: ${e.message}`);
    process.exit(1);
  }
}

// Get all service names
function getServices(composeData) {
  return Object.keys(composeData.services || {});
}

// Generate new compose file with selected services
function generateComposeFile(composeData, selectedServices) {
  const newCompose = { ...composeData };
  
  newCompose.services = Object.fromEntries(
    Object.entries(composeData.services)
      .filter(([name]) => selectedServices.includes(name))
  );
  
  try {
    fs.writeFileSync(OUTPUT_FILE, yaml.dump(newCompose));
    console.log(`\nNew docker-compose file saved to: ${OUTPUT_FILE}`);
  } catch (e) {
    console.error(`Error writing file: ${e.message}`);
    process.exit(1);
  }
}

// Multi-column service selector
class MultiColumnSelector {
  constructor(services) {
    this.services = services;
    this.selected = services.map(service => 
      DEFAULT_SELECTED.includes(service)
    );
    this.totalItems = services.length;
    this.itemsPerColumn = Math.ceil(this.totalItems / COLUMNS);
    this.currentCol = 0;
    this.currentRow = 0;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    process.stdout.write('\x1B[?25l');
    process.stdin.setRawMode(true);
  }

  getCurrentIndex() {
    return this.currentCol * this.itemsPerColumn + this.currentRow;
  }

  getServiceAt(col, row) {
    const idx = col * this.itemsPerColumn + row;
    return idx < this.totalItems ? this.services[idx] : null;
  }

  render() {
    process.stdout.write('\x1B[2J\x1B[0f');
    
    console.log('  Docker Compose Service Selector');
    console.log(`Original file: ${COMPOSE_FILE}`);
    console.log(`Output will be saved to: ${OUTPUT_FILE}`);
    console.log('----------------------------------------');
    console.log('Use arrows to navigate, Space to toggle, Enter to confirm');
    console.log('----------------------------------------');

    // Calculate visible rows
    const startRow = Math.max(0, this.currentRow - Math.floor(ROWS/2));
    const endRow = Math.min(this.itemsPerColumn, startRow + ROWS);

    for (let row = startRow; row < endRow; row++) {
      let line = '';
      for (let col = 0; col < COLUMNS; col++) {
        const service = this.getServiceAt(col, row);
        if (!service) continue;

        const isSelected = this.selected[col * this.itemsPerColumn + row];
        const isCursor = col === this.currentCol && row === this.currentRow;
        
        const prefix = isCursor ? '\x1B[34m> ' : '  ';
        const checkbox = isSelected ? '[✓]' : '[ ]';
        const suffix = isCursor ? '\x1B[0m' : '';
        
        // Truncate long service names
        const displayName = service.length > COLUMN_WIDTH-5 ? 
          service.substring(0, COLUMN_WIDTH-5) + '...' : service;
        
        line += `${prefix}${checkbox} ${displayName.padEnd(COLUMN_WIDTH)}${suffix}`;
      }
      console.log(line);
    }

    // Show scroll indicator if needed
    if (startRow > 0) console.log('↑↑↑ More items above ↑↑↑');
    if (endRow < this.itemsPerColumn) console.log('↓↓↓ More items below ↓↓↓');
  }

  moveCursor(direction) {
    switch (direction) {
      case 'up':
        this.currentRow = Math.max(0, this.currentRow - 1);
        break;
      case 'down':
        this.currentRow = Math.min(
          this.itemsPerColumn - 1, 
          this.currentRow + 1
        );
        // Check if we moved past the last item in this column
        if (this.getServiceAt(this.currentCol, this.currentRow) === null) {
          this.currentRow--;
        }
        break;
      case 'left':
        this.currentCol = Math.max(0, this.currentCol - 1);
        // Adjust row if we moved to a shorter column
        while (this.getServiceAt(this.currentCol, this.currentRow) === null && 
               this.currentRow > 0) {
          this.currentRow--;
        }
        break;
      case 'right':
        this.currentCol = Math.min(COLUMNS - 1, this.currentCol + 1);
        // Adjust row if we moved to a shorter column
        while (this.getServiceAt(this.currentCol, this.currentRow) === null && 
               this.currentRow > 0) {
          this.currentRow--;
        }
        break;
    }
    this.render();
  }

  toggleCurrent() {
    const idx = this.getCurrentIndex();
    if (idx < this.totalItems) {
      this.selected[idx] = !this.selected[idx];
      this.render();
    }
  }

  start() {
    this.render();
    
    process.stdin.on('keypress', (_, key) => {
      if (key) {
        switch (key.name) {
          case 'up': this.moveCursor('up'); break;
          case 'down': this.moveCursor('down'); break;
          case 'left': this.moveCursor('left'); break;
          case 'right': this.moveCursor('right'); break;
          case 'space': this.toggleCurrent(); break;
          case 'return': this.confirm(); break;
          case 'c':
            if (key.ctrl) {
              this.cleanup();
              process.exit();
            }
            break;
        }
      }
    });
  }

  confirm() {
    const selectedServices = this.services.filter(
      (_, i) => this.selected[i]
    );
    this.cleanup();
    
    if (selectedServices.length === 0) {
      console.log('\nNo services selected. Exiting.');
      process.exit();
    }
    
    console.log('\nSelected services:');
    console.log(selectedServices.map(s => `- ${s}`).join('\n'));
    
    const composeData = parseComposeFile();
    generateComposeFile(composeData, selectedServices);
    process.exit();
  }

  cleanup() {
    process.stdout.write('\x1B[?25h');
    process.stdin.setRawMode(false);
    this.rl.close();
  }
}

// Main execution
function main() {
  try {
    const composeData = parseComposeFile();
    const services = getServices(composeData);
    
    if (services.length === 0) {
      console.log('No services found in docker-compose file.');
      process.exit(1);
    }
    
    const selector = new MultiColumnSelector(services);
    selector.start();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();