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
