#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * zeoinjesus-bible statistics
 * -------------------------------------------------------------------------
 * Reads the scraped JSON corpus (per-book files written by scrape.js) and
 * reports:
 *   - total books / chapters / verses
 *   - per book: order, abbr, English name, Chinese name, chapters, verses
 *   - character counts for ALL text, per version and overall:
 *       * CJK (Chinese) character count
 *       * English word count + Latin-letter count
 *
 * Usage:
 *   node stats.js [--dir=./output] [--json=stats.json]
 *
 * Counting rules ("字数"):
 *   - Chinese 字数  = number of CJK ideographs (punctuation / spaces excluded).
 *   - English 字數  = number of whitespace-delimited words; Latin letters also
 *                     reported separately.
 *   Every version is measured for both, so a version is never mis-bucketed.
 */

const fs = require('fs');
const path = require('path');

const { VERSIONS } = require('./lib/catalogue');
const { defaultOutputDir } = require('./lib/paths');

// CJK unified ideographs (BMP) + ext-A + compatibility ideographs.
const CJK_RE = /[㐀-䶿一-鿿豈-﫿]/g;
// English "words": runs of Latin letters, allowing internal ' or - (e.g. don't).
const WORD_RE = /[A-Za-z]+(?:['-][A-Za-z]+)*/g;
const LETTER_RE = /[A-Za-z]/g;

const VERSION_LABEL = Object.fromEntries(VERSIONS.map((v) => [v.code, v.label]));
// Language hint for the summary buckets (counting itself is language-agnostic).
const ZH_VERSIONS = new Set(['cuv', 'lzz', 'ncv']);

function countMatches(str, re) {
  const m = str.match(re);
  return m ? m.length : 0;
}

function parseArgs(argv) {
  const opts = { dir: defaultOutputDir(), json: '' };
  for (const raw of argv) {
    const [k, v] = raw.replace(/^--/, '').split('=');
    if (k === 'dir') opts.dir = path.resolve(v);
    else if (k === 'json') opts.json = v || 'stats.json';
    else console.warn(`Unknown option ignored: --${k}`);
  }
  return opts;
}

function listBookFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{2}_.+\.json$/.test(f) && f !== 'index.json' && f !== 'bible.json')
    .sort();
}

function blankVersionStat() {
  return { cjk: 0, words: 0, letters: 0, chars: 0, verses: 0 };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.dir)) {
    console.error(`Output directory not found: ${opts.dir} (run scrape.js first)`);
    process.exit(1);
  }

  const files = listBookFiles(opts.dir);
  if (!files.length) {
    console.error(`No book JSON files found in ${opts.dir}`);
    process.exit(1);
  }

  const perVersion = {}; // code -> blankVersionStat
  const books = [];
  let totalChapters = 0;
  let totalVerses = 0;

  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(opts.dir, file), 'utf8'));
    const b = doc.book;
    let bookVerses = 0;
    const bookVersion = {}; // code -> {cjk,words,letters,chars}

    for (const ch of doc.chapters) {
      for (const verse of ch.verses) {
        bookVerses += 1;
        for (const [code, text] of Object.entries(verse.texts || {})) {
          const t = String(text || '');
          const cjk = countMatches(t, CJK_RE);
          const words = countMatches(t, WORD_RE);
          const letters = countMatches(t, LETTER_RE);
          const chars = [...t].length;

          if (!perVersion[code]) perVersion[code] = blankVersionStat();
          perVersion[code].cjk += cjk;
          perVersion[code].words += words;
          perVersion[code].letters += letters;
          perVersion[code].chars += chars;
          perVersion[code].verses += 1;

          if (!bookVersion[code]) bookVersion[code] = { cjk: 0, words: 0, letters: 0, chars: 0 };
          bookVersion[code].cjk += cjk;
          bookVersion[code].words += words;
          bookVersion[code].letters += letters;
          bookVersion[code].chars += chars;
        }
      }
    }

    totalChapters += doc.chapterCount;
    totalVerses += bookVerses;
    books.push({
      order: b.order,
      testament: b.testament,
      abbr: b.abbr,
      english: b.english,
      name: b.name,
      chapters: doc.chapterCount,
      verses: bookVerses,
      versions: bookVersion,
    });
  }

  // ----- console report -----
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);

  console.log('='.repeat(72));
  console.log('zeoinjesus-bible — corpus statistics');
  console.log(`source dir : ${opts.dir}`);
  console.log('='.repeat(72));

  console.log('\nPer-book (order | abbr | English name | 中文名 | chapters | verses)');
  console.log('-'.repeat(72));
  for (const bk of books) {
    console.log(
      `${padL(bk.order, 2)} ${pad(bk.abbr, 4)} ${pad(bk.english, 16)} ${pad(bk.name, 8)} ` +
        `${padL(bk.chapters, 3)} ch  ${padL(bk.verses, 5)} verses`,
    );
  }

  console.log('\nTotals');
  console.log('-'.repeat(72));
  console.log(`  books    : ${books.length}`);
  console.log(`  chapters : ${totalChapters}`);
  console.log(`  verses   : ${totalVerses}`);

  console.log('\nCharacter counts per version (字数)');
  console.log('-'.repeat(72));
  console.log(`  ${pad('version', 18)} ${padL('verses', 7)} ${padL('CJK 汉字', 10)} ${padL('EN words', 9)} ${padL('letters', 9)} ${padL('chars', 9)}`);
  let zhCjk = 0;
  let enWords = 0;
  let enLetters = 0;
  for (const v of VERSIONS) {
    const s = perVersion[v.code];
    if (!s) continue;
    const label = `${v.code} ${VERSION_LABEL[v.code]}`;
    console.log(
      `  ${pad(label, 18)} ${padL(s.verses, 7)} ${padL(s.cjk, 10)} ${padL(s.words, 9)} ${padL(s.letters, 9)} ${padL(s.chars, 9)}`,
    );
    if (ZH_VERSIONS.has(v.code)) zhCjk += s.cjk;
    else { enWords += s.words; enLetters += s.letters; }
  }

  console.log('\nGrand character totals');
  console.log('-'.repeat(72));
  console.log(`  Chinese versions — total CJK characters : ${zhCjk}`);
  console.log(`  English versions — total words          : ${enWords}`);
  console.log(`  English versions — total Latin letters  : ${enLetters}`);
  const allCjk = Object.values(perVersion).reduce((a, s) => a + s.cjk, 0);
  const allWords = Object.values(perVersion).reduce((a, s) => a + s.words, 0);
  const allChars = Object.values(perVersion).reduce((a, s) => a + s.chars, 0);
  console.log(`  ALL versions     — CJK chars / words / total chars : ${allCjk} / ${allWords} / ${allChars}`);

  // ----- optional JSON dump -----
  if (opts.json) {
    const outPath = path.isAbsolute(opts.json) ? opts.json : path.join(opts.dir, opts.json);
    const dump = {
      source: 'https://www.zeoinjesus.com/',
      generatedAt: new Date().toISOString(),
      totals: { books: books.length, chapters: totalChapters, verses: totalVerses },
      perVersion,
      grandTotals: { chineseCjk: zhCjk, englishWords: enWords, englishLetters: enLetters, allCjk, allWords, allChars },
      books,
    };
    fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));
    console.log(`\nWrote ${outPath}`);
  }
}

main();
