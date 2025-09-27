// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

class UrlQueue {
  constructor() {
    this.pending = [];
    this.processed = new Set();
  }

  enqueue(url, depth) {
    if (!url && url !== '') {
      return;
    }
    if (typeof url !== 'string') {
      return;
    }
    const normalizedUrl = url.split('#')[0].trim();
    if (!normalizedUrl) {
      return;
    }
    const payload = { url: normalizedUrl, depth };
    if (this.processed.has(normalizedUrl)) {
      return;
    }
    const exists = this.pending.some(item => item.url === normalizedUrl);
    if (!exists) {
      this.pending.push(payload);
    }
  }

  requeue(item) {
    if (!item || !item.url) {
      return;
    }
    if (this.processed.has(item.url)) {
      return;
    }
    const exists = this.pending.some(entry => entry.url === item.url);
    if (!exists) {
      this.pending.unshift(item);
    }
  }

  dequeue() {
    return this.pending.shift();
  }

  markProcessed(url) {
    if (url) {
      this.processed.add(url);
    }
  }

  hasProcessed(url) {
    if (!url) {
      return false;
    }
    return this.processed.has(url.split('#')[0]);
  }

  hasPending() {
    return this.pending.length > 0;
  }

  size() {
    return this.pending.length;
  }

  processedCount() {
    return this.processed.size;
  }
}

module.exports = UrlQueue;
