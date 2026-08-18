// Bible book + version catalogue for https://www.zeoinjesus.com/
// Auto-extracted from the site front-end bundle (static/js/main.*.js).
// 66 books in the site source order (New Testament first, then Old Testament).
// For personal academic / devotional study use only.

const VERSIONS = [
  {
    "code": "cuv",
    "label": "和合本"
  },
  {
    "code": "kjv",
    "label": "KJV"
  },
  {
    "code": "lzz",
    "label": "呂振中"
  },
  {
    "code": "nasb",
    "label": "NASB"
  },
  {
    "code": "ncv",
    "label": "新譯本"
  },
  {
    "code": "niv",
    "label": "NIV"
  }
];

const BOOKS = [
  {
    "order": 1,
    "testament": "NT",
    "abbr": "mat",
    "english": "Matthew",
    "name": "馬太福音",
    "short": "太",
    "chapters": 28
  },
  {
    "order": 2,
    "testament": "NT",
    "abbr": "mak",
    "english": "Mark",
    "name": "馬可福音",
    "short": "可",
    "chapters": 16
  },
  {
    "order": 3,
    "testament": "NT",
    "abbr": "luk",
    "english": "Luke",
    "name": "路加福音",
    "short": "路",
    "chapters": 24
  },
  {
    "order": 4,
    "testament": "NT",
    "abbr": "jhn",
    "english": "John",
    "name": "約翰福音",
    "short": "約",
    "chapters": 21
  },
  {
    "order": 5,
    "testament": "NT",
    "abbr": "act",
    "english": "Acts",
    "name": "使徒行傳",
    "short": "徒",
    "chapters": 28
  },
  {
    "order": 6,
    "testament": "NT",
    "abbr": "rom",
    "english": "Romans",
    "name": "羅馬書",
    "short": "羅",
    "chapters": 16
  },
  {
    "order": 7,
    "testament": "NT",
    "abbr": "1co",
    "english": "1Corinthians",
    "name": "哥林多前書",
    "short": "林前",
    "chapters": 16
  },
  {
    "order": 8,
    "testament": "NT",
    "abbr": "2co",
    "english": "2Corinthians",
    "name": "哥林多後書",
    "short": "林後",
    "chapters": 13
  },
  {
    "order": 9,
    "testament": "NT",
    "abbr": "gal",
    "english": "Galatians",
    "name": "加拉太書",
    "short": "加",
    "chapters": 6
  },
  {
    "order": 10,
    "testament": "NT",
    "abbr": "eph",
    "english": "Ephesians",
    "name": "以弗所書",
    "short": "弗",
    "chapters": 6
  },
  {
    "order": 11,
    "testament": "NT",
    "abbr": "phl",
    "english": "Philippians",
    "name": "腓立比書",
    "short": "腓",
    "chapters": 4
  },
  {
    "order": 12,
    "testament": "NT",
    "abbr": "col",
    "english": "Colossians",
    "name": "歌羅西書",
    "short": "西",
    "chapters": 4
  },
  {
    "order": 13,
    "testament": "NT",
    "abbr": "1ts",
    "english": "1Thessalonians",
    "name": "帖撒羅尼迦前書",
    "short": "帖前",
    "chapters": 5
  },
  {
    "order": 14,
    "testament": "NT",
    "abbr": "2ts",
    "english": "2Thessalonians",
    "name": "帖撒羅尼迦後書",
    "short": "帖後",
    "chapters": 3
  },
  {
    "order": 15,
    "testament": "NT",
    "abbr": "1ti",
    "english": "1Timothy",
    "name": "提摩太前書",
    "short": "提前",
    "chapters": 6
  },
  {
    "order": 16,
    "testament": "NT",
    "abbr": "2ti",
    "english": "2Timothy",
    "name": "提摩太後書",
    "short": "提後",
    "chapters": 4
  },
  {
    "order": 17,
    "testament": "NT",
    "abbr": "tit",
    "english": "Titus",
    "name": "提多書",
    "short": "多",
    "chapters": 3
  },
  {
    "order": 18,
    "testament": "NT",
    "abbr": "phm",
    "english": "Philemon",
    "name": "腓利門書",
    "short": "門",
    "chapters": 1
  },
  {
    "order": 19,
    "testament": "NT",
    "abbr": "heb",
    "english": "Hebrews",
    "name": "希伯來書",
    "short": "來",
    "chapters": 13
  },
  {
    "order": 20,
    "testament": "NT",
    "abbr": "jas",
    "english": "James",
    "name": "雅各書",
    "short": "雅",
    "chapters": 5
  },
  {
    "order": 21,
    "testament": "NT",
    "abbr": "1pe",
    "english": "1Peter",
    "name": "彼得前書",
    "short": "彼前",
    "chapters": 5
  },
  {
    "order": 22,
    "testament": "NT",
    "abbr": "2pe",
    "english": "2Peter",
    "name": "彼得後書",
    "short": "彼後",
    "chapters": 3
  },
  {
    "order": 23,
    "testament": "NT",
    "abbr": "1jn",
    "english": "1John",
    "name": "約翰一書",
    "short": "約一",
    "chapters": 5
  },
  {
    "order": 24,
    "testament": "NT",
    "abbr": "2jn",
    "english": "2John",
    "name": "約翰二書",
    "short": "約二",
    "chapters": 1
  },
  {
    "order": 25,
    "testament": "NT",
    "abbr": "3jn",
    "english": "3John",
    "name": "約翰三書",
    "short": "約三",
    "chapters": 1
  },
  {
    "order": 26,
    "testament": "NT",
    "abbr": "jue",
    "english": "Jude",
    "name": "猶大書",
    "short": "猶",
    "chapters": 1
  },
  {
    "order": 27,
    "testament": "NT",
    "abbr": "rev",
    "english": "Revelation",
    "name": "啟示錄",
    "short": "啟",
    "chapters": 22
  },
  {
    "order": 28,
    "testament": "OT",
    "abbr": "gen",
    "english": "Genesis",
    "name": "創世記",
    "short": "創",
    "chapters": 50
  },
  {
    "order": 29,
    "testament": "OT",
    "abbr": "exo",
    "english": "Exodus",
    "name": "出埃及記",
    "short": "出",
    "chapters": 40
  },
  {
    "order": 30,
    "testament": "OT",
    "abbr": "lev",
    "english": "Leviticus",
    "name": "利未記",
    "short": "利",
    "chapters": 27
  },
  {
    "order": 31,
    "testament": "OT",
    "abbr": "num",
    "english": "Numbers",
    "name": "民數記",
    "short": "民",
    "chapters": 36
  },
  {
    "order": 32,
    "testament": "OT",
    "abbr": "deu",
    "english": "Deuteronomy",
    "name": "申命記",
    "short": "申",
    "chapters": 34
  },
  {
    "order": 33,
    "testament": "OT",
    "abbr": "jos",
    "english": "Joshua",
    "name": "約書亞記",
    "short": "書",
    "chapters": 24
  },
  {
    "order": 34,
    "testament": "OT",
    "abbr": "jug",
    "english": "Judges",
    "name": "士師記",
    "short": "士",
    "chapters": 21
  },
  {
    "order": 35,
    "testament": "OT",
    "abbr": "rut",
    "english": "Ruth",
    "name": "路得記",
    "short": "得",
    "chapters": 4
  },
  {
    "order": 36,
    "testament": "OT",
    "abbr": "1sa",
    "english": "1Samuel",
    "name": "撒母耳記上",
    "short": "撒上",
    "chapters": 31
  },
  {
    "order": 37,
    "testament": "OT",
    "abbr": "2sa",
    "english": "2Samuel",
    "name": "撒母耳記下",
    "short": "撒下",
    "chapters": 24
  },
  {
    "order": 38,
    "testament": "OT",
    "abbr": "1ki",
    "english": "1Kings",
    "name": "列王紀上",
    "short": "王上",
    "chapters": 22
  },
  {
    "order": 39,
    "testament": "OT",
    "abbr": "2ki",
    "english": "2Kings",
    "name": "列王紀下",
    "short": "王下",
    "chapters": 25
  },
  {
    "order": 40,
    "testament": "OT",
    "abbr": "1ch",
    "english": "1Chronicles",
    "name": "歷代志上",
    "short": "代上",
    "chapters": 29
  },
  {
    "order": 41,
    "testament": "OT",
    "abbr": "2ch",
    "english": "2Chronicles",
    "name": "歷代志下",
    "short": "代下",
    "chapters": 36
  },
  {
    "order": 42,
    "testament": "OT",
    "abbr": "ezr",
    "english": "Ezra",
    "name": "以斯拉記",
    "short": "拉",
    "chapters": 10
  },
  {
    "order": 43,
    "testament": "OT",
    "abbr": "neh",
    "english": "Nehemiah",
    "name": "尼希米記",
    "short": "尼",
    "chapters": 13
  },
  {
    "order": 44,
    "testament": "OT",
    "abbr": "est",
    "english": "Esther",
    "name": "以斯帖記",
    "short": "斯",
    "chapters": 10
  },
  {
    "order": 45,
    "testament": "OT",
    "abbr": "job",
    "english": "Job",
    "name": "約伯記",
    "short": "伯",
    "chapters": 42
  },
  {
    "order": 46,
    "testament": "OT",
    "abbr": "psm",
    "english": "Psalms",
    "name": "詩篇",
    "short": "詩",
    "chapters": 150
  },
  {
    "order": 47,
    "testament": "OT",
    "abbr": "pro",
    "english": "Proverbs",
    "name": "箴言",
    "short": "箴",
    "chapters": 31
  },
  {
    "order": 48,
    "testament": "OT",
    "abbr": "ecc",
    "english": "Ecclesiastes",
    "name": "傳道書",
    "short": "傳",
    "chapters": 12
  },
  {
    "order": 49,
    "testament": "OT",
    "abbr": "son",
    "english": "Song of Songs",
    "name": "雅歌",
    "short": "歌",
    "chapters": 8
  },
  {
    "order": 50,
    "testament": "OT",
    "abbr": "isa",
    "english": "Isaiah",
    "name": "以賽亞書",
    "short": "賽",
    "chapters": 66
  },
  {
    "order": 51,
    "testament": "OT",
    "abbr": "jer",
    "english": "Jeremiah",
    "name": "耶利米書",
    "short": "耶",
    "chapters": 52
  },
  {
    "order": 52,
    "testament": "OT",
    "abbr": "lam",
    "english": "Lamentations",
    "name": "耶利米哀歌",
    "short": "哀",
    "chapters": 5
  },
  {
    "order": 53,
    "testament": "OT",
    "abbr": "eze",
    "english": "Ezekiel",
    "name": "以西結書",
    "short": "結",
    "chapters": 48
  },
  {
    "order": 54,
    "testament": "OT",
    "abbr": "dan",
    "english": "Daniel",
    "name": "但以理書",
    "short": "但",
    "chapters": 12
  },
  {
    "order": 55,
    "testament": "OT",
    "abbr": "hos",
    "english": "Hosea",
    "name": "何西阿書",
    "short": "何",
    "chapters": 14
  },
  {
    "order": 56,
    "testament": "OT",
    "abbr": "joe",
    "english": "Joel",
    "name": "約珥書",
    "short": "珥",
    "chapters": 3
  },
  {
    "order": 57,
    "testament": "OT",
    "abbr": "amo",
    "english": "Amos",
    "name": "阿摩司書",
    "short": "摩",
    "chapters": 9
  },
  {
    "order": 58,
    "testament": "OT",
    "abbr": "oba",
    "english": "Obadiah",
    "name": "俄巴底亞書",
    "short": "俄",
    "chapters": 1
  },
  {
    "order": 59,
    "testament": "OT",
    "abbr": "joh",
    "english": "Jonah",
    "name": "約拿書",
    "short": "拿",
    "chapters": 4
  },
  {
    "order": 60,
    "testament": "OT",
    "abbr": "mic",
    "english": "Micah",
    "name": "彌迦書",
    "short": "彌",
    "chapters": 7
  },
  {
    "order": 61,
    "testament": "OT",
    "abbr": "nah",
    "english": "Nahum",
    "name": "那鴻書",
    "short": "鴻",
    "chapters": 3
  },
  {
    "order": 62,
    "testament": "OT",
    "abbr": "hab",
    "english": "Habakkuk",
    "name": "哈巴谷書",
    "short": "哈",
    "chapters": 3
  },
  {
    "order": 63,
    "testament": "OT",
    "abbr": "zep",
    "english": "Zephaniah",
    "name": "西番雅書",
    "short": "番",
    "chapters": 3
  },
  {
    "order": 64,
    "testament": "OT",
    "abbr": "hag",
    "english": "Haggai",
    "name": "哈該書",
    "short": "該",
    "chapters": 2
  },
  {
    "order": 65,
    "testament": "OT",
    "abbr": "zec",
    "english": "Zechariah",
    "name": "撒迦利亞書",
    "short": "亞",
    "chapters": 14
  },
  {
    "order": 66,
    "testament": "OT",
    "abbr": "mal",
    "english": "Malachi",
    "name": "瑪拉基書",
    "short": "瑪",
    "chapters": 4
  }
];

module.exports = { VERSIONS, BOOKS };
