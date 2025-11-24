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

/**
 * OKX Price Monitor App Configuration
 */

// RPC server base URL (ncore_module_caller)
const rpcBaseUrl = 'http://127.0.0.1:58000';

// Base page URL to open (provides context for API requests)
const basePageUrl = 'https://www.okx.com/markets/prices/page/15';

// API URL template for price data
const apiUrlTemplate = 'https://www.okx.com/priapi/v5/market/batch-currency-trend';

// Currencies to monitor
const currencies = [
    'FOXY', 'PERP', 'PSTAKE', 'ULTI', 'PIGGY', 'FLM', 'KDA', 'SAMO',
    'VISTA', 'SPURS', 'TRA', 'LOOKS', 'BUZZ', 'POR', 'MENGO', 'NC',
    'CKB', 'BETH', 'CATS', 'MAJOR', 'OKSOL', 'HOPPY', 'WHY', 'RIF', 'NS'
];

// Fetch interval in milliseconds (1000 = 1 second)
const fetchInterval = 1000;

// Browser configuration
const browser = {
    headless: true,
    browserType: 'edge',
    timeout: 30000,
    waitUntil: 'networkidle2'
};

// Data extraction selectors
const selectors = {
    priceRows: 'tr.index-module_tr__IuClH',
    coinName: '.index-module_coinName__wCZLp',
    price: '.index-module_priceChangePercent__CtYE7',
    change: '.index-module_change__xKSRV'
};

// Storage configuration
const storage = {
    saveToFile: true,
    maxHistoryRecords: 1000
};

const okx_price_monitor = {
    rpcBaseUrl,
    basePageUrl,
    apiUrlTemplate,
    currencies,
    fetchInterval,
    browser,
    selectors,
    storage
};

module.exports = {
    okx_price_monitor
};
