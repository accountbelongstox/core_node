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

class ProgressTracker {
  constructor() {
    this.total = 0;
    this.current = 0;
    this.startTime = null;
    this.lastUpdateTime = 0;
  }

  start(total) {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.lastUpdateTime = 0;
    this.update();
  }

  increment(count = 1) {
    this.current += count;
    this.update();
  }

  update() {
    const now = Date.now();
    if (now - this.lastUpdateTime < 100) {
      return; // Limit update frequency
    }
    this.lastUpdateTime = now;

    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const elapsed = now - this.startTime;
    const estimatedTotal = this.total > 0 ? (elapsed / this.current) * this.total : 0;
    const remaining = Math.max(0, estimatedTotal - elapsed);

    const progressBar = this.createProgressBar(percentage);
    const timeInfo = this.formatTime(elapsed, remaining);

    process.stdout.write(`\r${progressBar} ${percentage.toFixed(1)}% (${this.current}/${this.total}) ${timeInfo}`);
  }

  createProgressBar(percentage) {
    const width = 30;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return filledChar.repeat(filled) + emptyChar.repeat(empty);
  }

  formatTime(elapsed, remaining) {
    const format = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    };

    return `[${format(elapsed)} / ${format(remaining)}]`;
  }

  complete() {
    const totalTime = Date.now() - this.startTime;
    const timeInfo = this.formatTime(totalTime, 0);
    process.stdout.write(`\r${' '.repeat(80)}\r`); // Clear progress bar
    console.log(`\nCompleted in ${timeInfo}`);
  }

  error(message) {
    process.stdout.write(`\r${' '.repeat(80)}\r`); // Clear progress bar
    console.error(`\nError: ${message}`);
  }
}

module.exports = ProgressTracker; 