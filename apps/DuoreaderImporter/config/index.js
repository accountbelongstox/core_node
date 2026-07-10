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

'use strict';

module.exports = {
    DuoreaderImporter: {
        shelfUrl: 'https://duoreader.cn/assets/shelf.json',
        webBaseUrl: 'https://web.duoreader.cn',
        myLang: 'zh',
        learnLang: 'en',
        laravelBaseUrl: 'http://43.163.112.77:9000',
        bookChunkSize: 80,
        chapterLoadTimeoutMs: 45000,
        pageLoadTimeoutMs: 60000,
        delayBetweenChaptersMs: 800,
        delayBetweenBooksMs: 2000,
        enableTtsEnrich: true,
        ttsEnrichBatchSize: 100,
        ttsEnrichRounds: 20,
        maxBooks: 0,
        bookIds: [],
        skipBookIds: [],
        headless: false,
        discoverTabs: ['curated'],
    },
};
