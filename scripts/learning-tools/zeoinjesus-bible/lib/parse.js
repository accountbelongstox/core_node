// Parsing helpers for the zeoinjesus.com /api/bible/ response.
//
// The API returns a FLAT array `combinedResults` where each entry is one verse
// in one version, e.g.
//   { "_id": "[CUV]JUE 1:1", "text": "..." }
//   { "_id": "[KJV]jue 1:1", "text": "..." }
// i.e. interleaved by version. We regroup it into per-verse rows keyed by
// version code so the bilingual comparison lives in a single object per verse.

// _id shape: [VERSION]<book-token> <chapter>:<verse>
// VERSION is upper-cased in the source; we normalise it to the lower-case code
// used everywhere else (cuv/kjv/lzz/nasb/ncv/niv). The book token case varies
// between versions and is redundant (we already know the book), so it is ignored.
const ID_RE = /^\[([A-Za-z0-9]+)\]\s*\S+\s+(\d+):(\d+)/;

/**
 * Regroup a chapter's flat combinedResults into ordered verses.
 * @param {{_id:string,text:string}[]} combinedResults
 * @returns {{ verses: Array<{verse:number, texts:Object}>, unparsed: any[] }}
 */
function groupChapter(combinedResults) {
  const byVerse = new Map();
  const unparsed = [];

  for (const item of combinedResults || []) {
    const id = item && item._id;
    const m = typeof id === 'string' ? ID_RE.exec(id) : null;
    if (!m) {
      unparsed.push(item);
      continue;
    }
    const version = m[1].toLowerCase();
    const verseNo = parseInt(m[3], 10);
    if (!byVerse.has(verseNo)) {
      byVerse.set(verseNo, { verse: verseNo, texts: {} });
    }
    // Trim trailing whitespace the source pads verses with; keep inner spacing.
    byVerse.get(verseNo).texts[version] = String(item.text == null ? '' : item.text).trim();
  }

  const verses = [...byVerse.values()].sort((a, b) => a.verse - b.verse);
  return { verses, unparsed };
}

module.exports = { groupChapter, ID_RE };
