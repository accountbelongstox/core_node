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

// const { env } = require("#@global_vars");
const path = require(`path`)
const { gdir, appname, isServer } = require('#@global_vars');
const {
    ROOT_APP_CACHE_DIR,
    APP_METADATA_DIR,
} = gdir;
const WWWROOT_DIR = path.join(gdir.rootdir, '../');
const ALLOW_DOWNLOAD_DIR = path.join(gdir.rootdir, '../../');

const SKIP_DIRS = [
    'node_modules',
    '.git',
    '.get',
    '.svn',
    '.hg',
    '__pycache__',
    '.DS_Store',
    'Thumbs.db',
    '.idea',
    '.vscode',
    'dist',
    'build',
    'out',
    'logs',
    'tmp',
    'temp',
    '.cache',
    '.next',
    '.nuxt',
    '.expo',
    '.angular',
    '.meteor',
    '.serverless',
    '.venv',
    '.env',
    '.history',
    '.sass-cache',
    '.nyc_output',
    '.parcel-cache',
    '.eslintcache',
    '.turbo',
    '.vercel',
    '.firebase',
    '.netlify',
    '.output',
    '.tmp',
    '.log',
    '.coverage',
    '.pytest_cache',
    '.tox',
    '.mypy_cache',
    '.pytest_cache',
    '.cache-loader',
    '.gradle',
    '.idea',
    '.settings',
    '.classpath',
    '.project',
    '.c9',
    '.sublime-project',
    '.sublime-workspace',
    '.yarn',
    '.pnp',
    '.pnp.js',
    '.history',
    '.npm',
    '.nvm',
    '.rbenv',
    '.bundle',
    '.jekyll-metadata',
    '.sass-cache',
    '.jekyll-cache',
    '.next',
    '.expo',
    '.angular',
    '.meteor',
    '.serverless',
    '.venv',
    '.env',
    '.history',
    '.sass-cache',
    '.nyc_output',
    '.parcel-cache',
    '.eslintcache',
    '.turbo',
    '.vercel',
    '.firebase',
    '.netlify',
    '.output',
    '.tmp',
    '.log',
    '.coverage',
    '.pytest_cache',
    '.tox',
    '.mypy_cache',
    '.pytest_cache',
    '.cache-loader',
    '.gradle',
    '.idea',
    '.settings',
    '.classpath',
    '.project',
    '.c9',
    '.sublime-project',
    '.sublime-workspace',
    '.yarn',
    '.pnp',
    '.pnp.js',
    '.history',
    '.npm',
    '.nvm',
    '.rbenv',
    '.bundle',
    '.jekyll-metadata',
    '.sass-cache',
    '.jekyll-cache'
];
const UPLOAD_DIRS_CACHE_TTL = 5000;
const UPDATE_CACHE_DIR = path.join(ROOT_APP_CACHE_DIR, 'update_cache');

const config = {
    HTTP_PORT: 3900,
    HTTP_HOST: '0.0.0.0',
    WWWROOT_DIR: WWWROOT_DIR,
    SKIP_DIRS: SKIP_DIRS,
    UPLOAD_DIRS_CACHE_TTL: UPLOAD_DIRS_CACHE_TTL,
    UPDATE_CACHE_DIR: UPDATE_CACHE_DIR,
    ALLOW_DOWNLOAD_DIR: ALLOW_DOWNLOAD_DIR,
}

module.exports = config;

