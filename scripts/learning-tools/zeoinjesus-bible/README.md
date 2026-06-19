# zeoinjesus-bible

Learn / archive every chapter of **https://www.zeoinjesus.com/** ("聖經中英對照",
a free Chinese–English parallel Bible reader) and emit it as a structured JSON
"book" with the full bilingual, multi-version verse-by-verse comparison.

> **Usage scope.** For **personal academic / devotional study on the local
> machine only**, consistent with the site's own stated terms. The translation
> texts belong to their respective Bible societies — please buy from / support
> them. This tool adds no value beyond convenience of offline study.

## How it works

The site is a React SPA whose verse data comes from one JSON endpoint:

```
POST https://www.zeoinjesus.com/api/bible/
body: { "versions": ["cuv","kjv",...], "book": "<abbr>", "chapter": <n> }
->    { "combinedResults": [ { "_id": "[CUV]JUE 1:1", "text": "..." }, ... ] }
```

`combinedResults` is a flat list interleaved by version; the tool regroups it
into one row per verse keyed by version code.

Rather than scrape the rendered DOM, the tool **drives the locally-installed
Google Chrome via this repo's own `puppeteer-extra` + stealth** (resolved from
the repo-root `node_modules`), opens the real site, and calls the endpoint
**same-origin from inside the page** (`page.evaluate` + `fetch`). That keeps the
request in a genuine browser context (real headers / origin, no CORS or
anti-bot friction) while staying fast and reliable.

## Catalogue

- **66 books** (27 New Testament, then 39 Old Testament) — `lib/catalogue.js`,
  auto-extracted from the site bundle (`abbr`, `english`, `name`, `short`,
  `chapters`, `testament`, `order`).
- **6 versions**: `cuv` 和合本, `kjv` KJV, `lzz` 呂振中, `nasb` NASB,
  `ncv` 新譯本, `niv` NIV.

## Requirements

- Node.js (uses the repo-root `puppeteer-extra`, `puppeteer-extra-plugin-stealth`,
  `chrome-launcher` — already in this repo, no extra install).
- A locally-installed Google Chrome (auto-detected via `chrome-launcher`; override
  with `--chrome=<path>` or `CHROME_PATH`).

## Usage

```bash
# from this directory
node scrape.js                       # all 66 books, all 6 versions -> ./output
node scrape.js --combined            # also write a single ./output/bible.json
node scrape.js --books=jhn,rom       # only John + Romans
node scrape.js --testament=NT        # New Testament only
node scrape.js --versions=cuv,niv    # only 和合本 + NIV
node scrape.js --limit-chapters=1    # one chapter per book (quick smoke test)
node scrape.js --concurrency=3 --delay=100   # faster (still polite)
```

### Options

Default output directory is the per-user data dir (username auto-detected, dir
auto-created), **not** inside the repo:

```
~/.core_node/learning-tools/zeoinjesus-bible/
  # Windows: C:\Users\<you>\.core_node\learning-tools\zeoinjesus-bible\
```

| Option | Default | Meaning |
|---|---|---|
| `--out=<dir>` | `~/.core_node/learning-tools/zeoinjesus-bible` | Output directory |
| `--versions=a,b` | all 6 | Version codes to fetch |
| `--books=mat,jhn` | all 66 | Restrict to these book abbrs |
| `--testament=NT\|OT\|all` | `all` | Restrict to a testament |
| `--limit-chapters=<n>` | `0` (all) | Cap chapters per book |
| `--delay=<ms>` | `150` | Delay between chapter requests |
| `--concurrency=<n>` | `1` | Parallel chapters per book |
| `--combined` | off | Also emit one combined `bible.json` |
| `--no-resume` | off | Re-fetch books even if their file exists |
| `--headful` | off | Show the browser window |
| `--chrome=<path>` | auto | Explicit Chrome executable |

`--resume` is on by default: a book whose output file already exists is skipped,
so an interrupted run can simply be re-run.

## Output

Written to `~/.core_node/learning-tools/zeoinjesus-bible/` by default
(override with `--out`):

```
<out-dir>/
  index.json                     # corpus manifest (books, versions, counts, files)
  01_mat_Matthew.json            # one file per book
  ...
  66_mal_Malachi.json
  bible.json                     # only with --combined: everything in one file
```

Per-book document shape:

```jsonc
{
  "source": "https://www.zeoinjesus.com/",
  "fetchedAt": "2026-06-19T...Z",
  "versions": [ { "code": "cuv", "label": "和合本" }, ... ],
  "book": { "order": 26, "testament": "NT", "abbr": "jue",
            "english": "Jude", "name": "猶大書", "short": "猶", "chapterCount": 1 },
  "chapterCount": 1,
  "verseCount": 25,
  "chapters": [
    {
      "chapter": 1,
      "verseCount": 25,
      "verses": [
        {
          "verse": 1,
          "texts": {
            "cuv": "耶穌基督的僕人...",
            "kjv": "Jude, the servant of Jesus Christ...",
            "lzz": "...", "nasb": "...", "ncv": "...", "niv": "..."
          }
        }
      ]
    }
  ]
}
```

Any verse whose `_id` cannot be parsed is preserved under a top-level
`unparsed` array on that book document (none expected for the standard canon).

## Files

```
zeoinjesus-bible/
  scrape.js          # CLI entry point
  lib/
    catalogue.js     # 66 books + 6 versions (extracted from the site bundle)
    parse.js         # regroup combinedResults -> per-verse rows
  README.md
```
