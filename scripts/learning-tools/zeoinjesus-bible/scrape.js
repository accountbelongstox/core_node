#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * zeoinjesus-bible scraper
 * -------------------------------------------------------------------------
 * Learn / archive every chapter of https://www.zeoinjesus.com/ with the full
 * bilingual (Chinese + English) multi-version comparison, and emit it as a
 * structured JSON "book".
 *
 * For PERSONAL ACADEMIC / DEVOTIONAL study on the local machine only, in line
 * with the site's own stated terms. Translations belong to their respective
 * Bible societies — please support them.
 *
 * Framework: uses THIS repo's installed puppeteer-extra + stealth (resolved
 * from the repo-root node_modules) driving the locally-installed Google Chrome.
 * The actual data comes from the site's own JSON endpoint
 *   POST /api/bible/  { versions:[...], book:<abbr>, chapter:<n> }  -> { combinedResults }
 * which we call SAME-ORIGIN from inside the real page (page.evaluate), so the
 * request carries genuine browser context and never trips CORS / anti-bot.
 *
 * Usage:
 *   node scrape.js [options]
 *
 * Options:
 *   --out=<dir>            Output directory (default: ./output)
 *   --versions=a,b,c       Version codes to fetch (default: all 6)
 *   --books=mat,jhn,...    Only these book abbrs (default: all 66)
 *   --testament=NT|OT|all  Restrict to a testament (default: all)
 *   --limit-chapters=<n>   Cap chapters per book (handy for a quick smoke test)
 *   --delay=<ms>           Delay between chapter requests (default: 150)
 *   --concurrency=<n>      Parallel chapters per book (default: 1, be polite)
 *   --combined             Also write a single combined output/bible.json
 *   --no-resume            Re-fetch books even if their file already exists
 *   --headful              Show the browser window (default: headless)
 *   --chrome=<path>        Explicit Chrome executable (else auto-detect)
 *
 * Env:
 *   CHROME_PATH            Same as --chrome.
 */

const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { VERSIONS, BOOKS } = require('./lib/catalogue');
const { groupChapter } = require('./lib/parse');
const { defaultOutputDir } = require('./lib/paths');

const SITE_URL = 'https://www.zeoinjesus.com/';
const API_URL = 'https://www.zeoinjesus.com/api/bible/';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    out: defaultOutputDir(),
    versions: VERSIONS.map((v) => v.code),
    books: null,
    testament: 'all',
    limitChapters: 0,
    delay: 150,
    concurrency: 1,
    combined: false,
    resume: true,
    headful: false,
    chrome: process.env.CHROME_PATH || '',
  };
  for (const raw of argv) {
    const [k, v] = raw.replace(/^--/, '').split('=');
    switch (k) {
      case 'out': opts.out = path.resolve(v); break;
      case 'versions': opts.versions = v.split(',').map((s) => s.trim()).filter(Boolean); break;
      case 'books': opts.books = v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean); break;
      case 'testament': opts.testament = (v || 'all').toUpperCase() === 'ALL' ? 'all' : v.toUpperCase(); break;
      case 'limit-chapters': opts.limitChapters = parseInt(v, 10) || 0; break;
      case 'delay': opts.delay = parseInt(v, 10) || 0; break;
      case 'concurrency': opts.concurrency = Math.max(1, parseInt(v, 10) || 1); break;
      case 'combined': opts.combined = true; break;
      case 'no-resume': opts.resume = false; break;
      case 'headful': opts.headful = true; break;
      case 'chrome': opts.chrome = v; break;
      default: console.warn(`Unknown option ignored: --${k}`);
    }
  }
  // Validate version codes against the known catalogue.
  const known = new Set(VERSIONS.map((v) => v.code));
  const bad = opts.versions.filter((c) => !known.has(c));
  if (bad.length) throw new Error(`Unknown version code(s): ${bad.join(', ')} (known: ${[...known].join(', ')})`);
  return opts;
}

// ---------------------------------------------------------------------------
// Chrome resolution: explicit -> chrome-launcher detection -> puppeteer 'chrome'
// channel as a last resort.
// ---------------------------------------------------------------------------
function resolveChrome(explicit) {
  if (explicit && fs.existsSync(explicit)) return { executablePath: explicit };
  try {
    const { Launcher } = require('chrome-launcher');
    const installs = Launcher.getInstallations();
    if (installs && installs.length) return { executablePath: installs[0] };
  } catch (_) { /* chrome-launcher optional */ }
  // Fall back to the bundled-channel resolution (works if a Chrome channel exists).
  return { channel: 'chrome' };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Fetch one chapter SAME-ORIGIN from inside the real page.
// ---------------------------------------------------------------------------
async function fetchChapter(page, versions, bookAbbr, chapter) {
  return page.evaluate(
    async (apiUrl, versionsArg, book, ch) => {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versions: versionsArg, book, chapter: ch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${book} ${ch}`);
      const data = await res.json();
      return data.combinedResults || [];
    },
    API_URL,
    versions,
    bookAbbr,
    chapter,
  );
}

// Small concurrency pool over chapter numbers.
async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function bookFileName(book) {
  return `${String(book.order).padStart(2, '0')}_${book.abbr}_${book.english.replace(/\s+/g, '')}.json`;
}

function selectBooks(opts) {
  let list = BOOKS;
  if (opts.testament !== 'all') list = list.filter((b) => b.testament === opts.testament);
  if (opts.books) {
    const want = new Set(opts.books);
    list = list.filter((b) => want.has(b.abbr));
    const found = new Set(list.map((b) => b.abbr));
    const missing = [...want].filter((a) => !found.has(a));
    if (missing.length) console.warn(`Requested book(s) not in catalogue: ${missing.join(', ')}`);
  }
  return list;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });

  const books = selectBooks(opts);
  const versionMeta = VERSIONS.filter((v) => opts.versions.includes(v.code));
  const nowIso = new Date().toISOString();

  console.log('zeoinjesus-bible scraper');
  console.log(`  versions : ${versionMeta.map((v) => `${v.code}(${v.label})`).join(', ')}`);
  console.log(`  books    : ${books.length} (${opts.testament})`);
  console.log(`  output   : ${opts.out}`);
  console.log(`  resume   : ${opts.resume}, delay: ${opts.delay}ms, concurrency: ${opts.concurrency}`);

  const chrome = resolveChrome(opts.chrome);
  console.log(`  chrome   : ${chrome.executablePath || `channel:${chrome.channel}`}`);

  const browser = await puppeteer.launch({
    headless: opts.headful ? false : 'new',
    ...chrome,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const indexEntries = [];
  const combined = opts.combined ? [] : null;
  let totalVerses = 0;

  try {
    const page = await browser.newPage();
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Give the SPA a moment so same-origin fetches inherit a fully-set-up context.
    await sleep(800);

    for (const book of books) {
      const outFile = path.join(opts.out, bookFileName(book));
      if (opts.resume && fs.existsSync(outFile)) {
        const cached = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        indexEntries.push({ ...book, file: path.basename(outFile), verseCount: cached.verseCount });
        if (combined) combined.push(cached);
        console.log(`  = ${book.english} (${book.name}) — already present, skipped`);
        continue;
      }

      const chapterCount = opts.limitChapters ? Math.min(opts.limitChapters, book.chapters) : book.chapters;
      const chapterNums = Array.from({ length: chapterCount }, (_, i) => i + 1);
      let bookVerses = 0;
      const unparsedAll = [];

      const chapters = await mapPool(chapterNums, opts.concurrency, async (ch) => {
        let attempt = 0;
        // Light retry — transient network / cold endpoint.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            const combinedResults = await fetchChapter(page, opts.versions, book.abbr, ch);
            const { verses, unparsed } = groupChapter(combinedResults);
            if (unparsed.length) unparsedAll.push(...unparsed.map((u) => ({ chapter: ch, ...u })));
            bookVerses += verses.length;
            if (opts.delay) await sleep(opts.delay);
            return { chapter: ch, verseCount: verses.length, verses };
          } catch (err) {
            if (++attempt >= 3) {
              console.warn(`    ! ${book.abbr} ${ch}: ${err.message} (giving up after ${attempt})`);
              return { chapter: ch, verseCount: 0, verses: [], error: String(err.message || err) };
            }
            await sleep(500 * attempt);
          }
        }
      });

      const bookDoc = {
        source: SITE_URL,
        fetchedAt: nowIso,
        usage: 'Personal academic / devotional study only. Texts (c) their Bible societies.',
        versions: versionMeta,
        book: {
          order: book.order,
          testament: book.testament,
          abbr: book.abbr,
          english: book.english,
          name: book.name,
          short: book.short,
          chapterCount: book.chapters,
        },
        chapterCount: chapters.length,
        verseCount: bookVerses,
        chapters,
        ...(unparsedAll.length ? { unparsed: unparsedAll } : {}),
      };

      fs.writeFileSync(outFile, JSON.stringify(bookDoc, null, 2));
      indexEntries.push({ ...book, file: path.basename(outFile), verseCount: bookVerses });
      if (combined) combined.push(bookDoc);
      totalVerses += bookVerses;
      console.log(`  + ${book.english} (${book.name}) — ${chapters.length} ch / ${bookVerses} verses -> ${path.basename(outFile)}`);
    }

    // Index file describing the whole corpus.
    const indexDoc = {
      source: SITE_URL,
      fetchedAt: nowIso,
      versions: versionMeta,
      bookCount: indexEntries.length,
      books: indexEntries.map((e) => ({
        order: e.order, testament: e.testament, abbr: e.abbr,
        english: e.english, name: e.name, short: e.short,
        chapterCount: e.chapters, verseCount: e.verseCount, file: e.file,
      })),
    };
    fs.writeFileSync(path.join(opts.out, 'index.json'), JSON.stringify(indexDoc, null, 2));

    if (combined) {
      const combinedDoc = { ...indexDoc, books: combined };
      fs.writeFileSync(path.join(opts.out, 'bible.json'), JSON.stringify(combinedDoc, null, 2));
      console.log(`  wrote combined bible.json (${combined.length} books)`);
    }

    console.log(`Done. ${indexEntries.length} books, ${totalVerses} verses (this run) -> ${opts.out}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
