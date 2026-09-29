// Shared secret crypto library + CLI for every encrypted secret format:
//   - single disguised files (<NAME>.js, scripts/disguised.template.js)
//   - bundles (already_batch_encrypted/*.js, bundle.template.js)
// The encrypted payload is read from the file text (never executed), so any
// number of files decrypt in ONE process with ONE password, and key derivation
// runs in parallel on the libuv thread pool. A wrong password is reported per
// file and nothing is written (the self-decrypting templates write random data).
//
// CLI (password through secret_password_runner.js, never on a command line):
//   <pw> | node secret_password_runner.js secret_crypto.js decrypt --password-stdin OUT_DIR [--force] SRC...
//   <pw> | node secret_password_runner.js secret_crypto.js encrypt --password-stdin OUT_DIR RAW_FILE...
//   <pw> | node secret_password_runner.js secret_crypto.js verify  --password-stdin SRC...
//   <pw> | ... secret_crypto.js bundle-add    --password-stdin BUNDLE [--replace] RAW_FILE...
//   <pw> | ... secret_crypto.js bundle-create --password-stdin BUNDLE RAW_FILE...
//   <pw> | ... secret_crypto.js migrate       --password-stdin BUNDLE SRC...   (single files -> bundle)
//   node secret_crypto.js bundle-list   BUNDLE
//   node secret_crypto.js bundle-remove BUNDLE NAME...
//   node secret_crypto.js read NAME...  (no password, never decrypts: first non-empty line of
//                                        .secret_keys/.secret_ignore/NAME; one NAME prints the
//                                        value, several print NAME<TAB>VALUE per found secret)
// SRC is an encrypted .js file or a directory of them. One result line per file:
//   SECRET_CRYPTO<TAB>STATUS<TAB>NAME
// STATUS: decrypted | skipped_exists | wrong_password | invalid_file | encrypted | verified |
//         listed | removed | exists | missing | error

const os = require('os');

const THREAD_POOL_SIZE = Math.min(Math.max(os.availableParallelism ? os.availableParallelism() : os.cpus().length, 4), 16);
if (!process.env.UV_THREADPOOL_SIZE) {
    process.env.UV_THREADPOOL_SIZE = String(THREAD_POOL_SIZE);
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const pbkdf2 = promisify(crypto.pbkdf2);

const RESULT_TAG = 'SECRET_CRYPTO';
const STATUS = {
    DECRYPTED: 'decrypted',
    SKIPPED_EXISTS: 'skipped_exists',
    WRONG_PASSWORD: 'wrong_password',
    INVALID_FILE: 'invalid_file',
    ENCRYPTED: 'encrypted',
    VERIFIED: 'verified',
    LISTED: 'listed',
    REMOVED: 'removed',
    EXISTS: 'exists',
    MISSING: 'missing',
    ERROR: 'error',
};
const ENCRYPTED_EXT = '.js';
const FORCE_FLAG = '--force';
const REPLACE_FLAG = '--replace';
const BUNDLE_TEMPLATE_PATH = path.join(__dirname, 'bundle.template.js');
const BUNDLE_HINT = /const PASSWORD_HINT = '([^']*)';/;
const PASSWORD_COMMANDS = ['decrypt', 'encrypt', 'verify', 'bundle-add', 'bundle-create', 'migrate'];
const PLAIN_COMMANDS = ['read', 'bundle-list', 'bundle-remove'];
const DISGUISED_TEMPLATE_PATH = path.join(__dirname, '..', 'disguised.template.js');
const RAW_SECRET_DIR = path.join(__dirname, '..', '..', '.secret_keys', '.secret_ignore');
const UTF8_BOM = '\uFEFF';
const ALGORITHM = 'aes-256-gcm';
const PARAMS_ALGORITHM = 'aes-256-cbc';
const KDF_DIGEST = 'sha512';
const HMAC_DIGEST = 'sha512';
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const PEPPER_LENGTH = 32;
const PARAMS_KEY_LENGTH = 32;
const PARAMS_IV_LENGTH = 16;
const ITERATIONS = 1000000;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const PRIVATE_FILE_MODE = 0o600;
const DISGUISED_FIELD = (name) => new RegExp(`const ${name} = Buffer\\.from\\('([A-Za-z0-9+/=]*)', 'base64'\\);`);
const DISGUISED_FILENAME = /const ORIGINAL_FILENAME = '([^']+)';/;
const BUNDLE_DATA = /const SECRETS_BUNDLE = (\[[\s\S]*?\]);\s*\n\s*const PASSWORD_HINT/;

function passwordHint(password) {
    return password.length === 1 ? password[0] : password[0] + password[password.length - 1];
}

async function deriveKey(password, entry) {
    const salt = Buffer.from(entry.salt, 'base64');
    const peppered = Buffer.concat([Buffer.from(password), Buffer.from(entry.pepper, 'base64')]);
    const firstKey = await pbkdf2(peppered, salt, entry.iterations, entry.keyLength, KDF_DIGEST);
    return pbkdf2(firstKey, salt, entry.iterations / 2, entry.keyLength, KDF_DIGEST);
}

function hmacDigest(key, encrypted, authTag) {
    return crypto.createHmac(HMAC_DIGEST, key).update(encrypted).update(authTag).digest();
}

function deobfuscateParams(data, key, iv) {
    const decipher = crypto.createDecipheriv(PARAMS_ALGORITHM, key, iv);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString());
}

// Entries: { name, source, filename, encryptedData, salt, iv, authTag, hmacDigest, pepper, algorithm, iterations, keyLength }
function parseEncryptedFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const bundleMatch = text.match(BUNDLE_DATA);
    if (bundleMatch) {
        return JSON.parse(bundleMatch[1]).map((entry) => ({ ...entry, name: entry.filename, source: filePath }));
    }
    const fields = {};
    for (const name of ['ENCRYPTED_DATA', 'OBFUSCATED_PARAMS', 'PARAMS_KEY', 'PARAMS_IV']) {
        const match = text.match(DISGUISED_FIELD(name));
        if (!match) {
            throw new Error(`missing ${name}`);
        }
        fields[name] = Buffer.from(match[1], 'base64');
    }
    const filenameMatch = text.match(DISGUISED_FILENAME);
    if (!filenameMatch) {
        throw new Error('missing ORIGINAL_FILENAME');
    }
    const params = deobfuscateParams(fields.OBFUSCATED_PARAMS, fields.PARAMS_KEY, fields.PARAMS_IV);
    return [{
        ...params,
        name: filenameMatch[1],
        filename: filenameMatch[1],
        source: filePath,
        encryptedData: fields.ENCRYPTED_DATA.toString('base64'),
    }];
}

// Returns the plaintext Buffer, or null when the password is wrong.
async function decryptEntry(entry, password) {
    const key = await deriveKey(password, entry);
    const encrypted = Buffer.from(entry.encryptedData, 'base64');
    const authTag = Buffer.from(entry.authTag, 'base64');
    const expected = Buffer.from(entry.hmacDigest, 'base64');
    const actual = hmacDigest(key, encrypted, authTag);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        return null;
    }
    try {
        const decipher = crypto.createDecipheriv(entry.algorithm, key, Buffer.from(entry.iv, 'base64'));
        decipher.setAuthTag(authTag);
        return zlib.inflateSync(Buffer.concat([decipher.update(encrypted), decipher.final()]));
    } catch (err) {
        return null;
    }
}

// Bundle-format entry: { filename, encryptedData, salt, iv, authTag, pepper, hmacDigest, algorithm, iterations, keyLength, tagLength }
async function encryptEntry(data, password, filename) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const pepper = crypto.randomBytes(PEPPER_LENGTH);
    const entry = {
        filename,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        pepper: pepper.toString('base64'),
        algorithm: ALGORITHM,
        iterations: ITERATIONS,
        keyLength: KEY_LENGTH,
        tagLength: TAG_LENGTH,
    };
    const key = await deriveKey(password, entry);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(zlib.deflateSync(data)), cipher.final()]);
    const authTag = cipher.getAuthTag();
    entry.encryptedData = encrypted.toString('base64');
    entry.authTag = authTag.toString('base64');
    entry.hmacDigest = hmacDigest(key, encrypted, authTag).toString('base64');
    return entry;
}

// Self-decrypting single file (scripts/disguised.template.js).
async function encryptBuffer(data, password, filename) {
    const entry = await encryptEntry(data, password, filename);
    const params = {
        salt: entry.salt,
        iv: entry.iv,
        authTag: entry.authTag,
        hmacDigest: entry.hmacDigest,
        pepper: entry.pepper,
        algorithm: entry.algorithm,
        iterations: entry.iterations,
        keyLength: entry.keyLength,
        tagLength: entry.tagLength,
        passwordHint: passwordHint(password),
    };
    const paramsKey = crypto.randomBytes(PARAMS_KEY_LENGTH);
    const paramsIv = crypto.randomBytes(PARAMS_IV_LENGTH);
    const paramsCipher = crypto.createCipheriv(PARAMS_ALGORITHM, paramsKey, paramsIv);
    const obfuscated = Buffer.concat([paramsCipher.update(JSON.stringify(params)), paramsCipher.final()]);
    return fs.readFileSync(DISGUISED_TEMPLATE_PATH, 'utf8')
        .replace('{{ENCRYPTED_DATA}}', () => entry.encryptedData)
        .replace('{{OBFUSCATED_PARAMS}}', () => obfuscated.toString('base64'))
        .replace('{{PARAMS_KEY}}', () => paramsKey.toString('base64'))
        .replace('{{PARAMS_IV}}', () => paramsIv.toString('base64'))
        .replace('{{ORIGINAL_FILENAME}}', () => filename);
}

function writeAtomic(filePath, data) {
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, data, { mode: PRIVATE_FILE_MODE });
    fs.renameSync(tmpPath, filePath);
}

function expandSources(sources) {
    const files = [];
    for (const source of sources) {
        if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
            for (const name of fs.readdirSync(source).sort()) {
                if (name.toLowerCase().endsWith(ENCRYPTED_EXT)) {
                    files.push(path.join(source, name));
                }
            }
        } else {
            files.push(source);
        }
    }
    return files;
}

// Collects entries from every source; unreadable sources become invalid_file results.
function collectEntries(sources) {
    const entries = [];
    const results = [];
    for (const file of expandSources(sources)) {
        try {
            entries.push(...parseEncryptedFile(file));
        } catch (err) {
            results.push({ status: STATUS.INVALID_FILE, name: path.basename(file, ENCRYPTED_EXT), error: err.message });
        }
    }
    return { entries, results };
}

async function decryptSources(password, outputDir, sources, options = {}) {
    const { entries, results } = collectEntries(sources);
    fs.mkdirSync(outputDir, { recursive: true });
    const decrypted = await Promise.all(entries.map(async (entry) => {
        const outputPath = path.join(outputDir, entry.filename);
        if (!options.force && fs.existsSync(outputPath)) {
            return { status: STATUS.SKIPPED_EXISTS, name: entry.name };
        }
        try {
            const data = await decryptEntry(entry, password);
            if (data === null) {
                return { status: STATUS.WRONG_PASSWORD, name: entry.name };
            }
            writeAtomic(outputPath, data);
            return { status: STATUS.DECRYPTED, name: entry.name };
        } catch (err) {
            return { status: STATUS.ERROR, name: entry.name, error: err.message };
        }
    }));
    return results.concat(decrypted);
}

async function verifySources(password, sources) {
    const { entries, results } = collectEntries(sources);
    const verified = await Promise.all(entries.map(async (entry) => {
        try {
            const data = await decryptEntry(entry, password);
            return { status: data === null ? STATUS.WRONG_PASSWORD : STATUS.VERIFIED, name: entry.name };
        } catch (err) {
            return { status: STATUS.ERROR, name: entry.name, error: err.message };
        }
    }));
    return results.concat(verified);
}

async function encryptFiles(password, outputDir, rawFiles) {
    fs.mkdirSync(outputDir, { recursive: true });
    return Promise.all(rawFiles.map(async (rawFile) => {
        const filename = path.basename(rawFile);
        try {
            const code = await encryptBuffer(fs.readFileSync(rawFile), password, filename);
            writeAtomic(path.join(outputDir, `${filename}${ENCRYPTED_EXT}`), code);
            return { status: STATUS.ENCRYPTED, name: filename };
        } catch (err) {
            return { status: STATUS.ERROR, name: filename, error: err.message };
        }
    }));
}

// First non-empty trimmed line of a decrypted secret, or '' (never decrypts).
function readSecret(name) {
    const secretFile = path.join(RAW_SECRET_DIR, path.basename(name || ''));
    let content = '';

    if (!name || !fs.existsSync(secretFile)) {
        return '';
    }
    try {
        content = fs.readFileSync(secretFile, 'utf8');
    } catch (err) {
        return '';
    }
    if (content.startsWith(UTF8_BOM)) {
        content = content.slice(1);
    }
    return content.split(/\r?\n/).map((line) => line.trim()).find((line) => line) || '';
}

// { NAME: value } for every NAME with a non-empty decrypted value.
function readSecrets(names) {
    const values = {};
    for (const name of names) {
        const value = readSecret(name);
        if (value) {
            values[name] = value;
        }
    }
    return values;
}

// Bundle entries ([] when the bundle does not exist yet).
function loadBundle(bundlePath) {
    if (!fs.existsSync(bundlePath)) {
        return { entries: [], hint: '' };
    }
    const text = fs.readFileSync(bundlePath, 'utf8');
    const dataMatch = text.match(BUNDLE_DATA);
    const hintMatch = text.match(BUNDLE_HINT);
    if (!dataMatch) {
        throw new Error(`invalid bundle format: ${bundlePath}`);
    }
    return { entries: JSON.parse(dataMatch[1]), hint: hintMatch ? hintMatch[1] : '' };
}

function saveBundle(bundlePath, entries, hint) {
    const code = fs.readFileSync(BUNDLE_TEMPLATE_PATH, 'utf8')
        .replace('{{SECRETS_DATA}}', () => JSON.stringify(entries, null, 2))
        .replace('{{PASSWORD_HINT}}', () => hint)
        .replace('{{TOTAL_COUNT}}', () => String(entries.length));
    fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
    writeAtomic(bundlePath, code);
}

// Encrypts every raw file in parallel and writes the bundle once. Without
// options.replace an existing name is kept and reported as exists; options.fresh
// starts from an empty bundle (bundle-create).
async function bundleAddFiles(password, bundlePath, rawFiles, options = {}) {
    const bundle = options.fresh ? { entries: [], hint: '' } : loadBundle(bundlePath);
    const byName = new Map(bundle.entries.map((entry) => [entry.filename, entry]));
    const results = await Promise.all(rawFiles.map(async (rawFile) => {
        const filename = path.basename(rawFile);
        if (byName.has(filename) && !options.replace) {
            return { status: STATUS.EXISTS, name: filename };
        }
        try {
            byName.set(filename, await encryptEntry(fs.readFileSync(rawFile), password, filename));
            return { status: STATUS.ENCRYPTED, name: filename };
        } catch (err) {
            return { status: STATUS.ERROR, name: filename, error: err.message };
        }
    }));
    if (results.some((result) => result.status === STATUS.ENCRYPTED) || options.fresh) {
        saveBundle(bundlePath, [...byName.values()], bundle.hint || passwordHint(password));
    }
    return results;
}

// Decrypts single files / bundles in memory and re-encrypts them into one bundle.
async function migrateToBundle(password, bundlePath, sources) {
    const { entries, results } = collectEntries(sources);
    const bundle = loadBundle(bundlePath);
    const byName = new Map(bundle.entries.map((entry) => [entry.filename, entry]));
    const migrated = await Promise.all(entries.map(async (entry) => {
        try {
            const data = await decryptEntry(entry, password);
            if (data === null) {
                return { status: STATUS.WRONG_PASSWORD, name: entry.name };
            }
            byName.set(entry.filename, await encryptEntry(data, password, entry.filename));
            return { status: STATUS.ENCRYPTED, name: entry.name };
        } catch (err) {
            return { status: STATUS.ERROR, name: entry.name, error: err.message };
        }
    }));
    if (migrated.some((result) => result.status === STATUS.ENCRYPTED)) {
        saveBundle(bundlePath, [...byName.values()], bundle.hint || passwordHint(password));
    }
    return results.concat(migrated);
}

function bundleList(bundlePath) {
    return loadBundle(bundlePath).entries.map((entry) => ({ status: STATUS.LISTED, name: entry.filename }));
}

function bundleRemove(bundlePath, names) {
    const bundle = loadBundle(bundlePath);
    const remaining = bundle.entries.filter((entry) => !names.includes(entry.filename));
    const present = new Set(bundle.entries.map((entry) => entry.filename));
    const results = names.map((name) => ({ status: present.has(name) ? STATUS.REMOVED : STATUS.MISSING, name }));
    if (remaining.length !== bundle.entries.length) {
        saveBundle(bundlePath, remaining, bundle.hint);
    }
    return results;
}

function printResults(results) {
    for (const result of results) {
        console.log([RESULT_TAG, result.status, result.name].join('\t') + (result.error ? `\t${result.error}` : ''));
    }
}

function hasFailure(results) {
    return results.some((result) => ![STATUS.DECRYPTED, STATUS.SKIPPED_EXISTS, STATUS.ENCRYPTED, STATUS.VERIFIED, STATUS.LISTED, STATUS.REMOVED].includes(result.status));
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const needsPassword = PASSWORD_COMMANDS.includes(command);
    const password = needsPassword ? args[1] : '';
    const force = args.includes(FORCE_FLAG);
    const replace = args.includes(REPLACE_FLAG);
    const rest = args.slice(needsPassword ? 2 : 1).filter((arg) => arg !== FORCE_FLAG && arg !== REPLACE_FLAG);
    let results = [];
    let values = {};

    if ((!needsPassword && !PLAIN_COMMANDS.includes(command)) || (needsPassword && !password) || rest.length === 0) {
        console.error(`Usage: secret_crypto.js ${PASSWORD_COMMANDS.join('|')} PASSWORD ... | ${PLAIN_COMMANDS.join('|')} ... (see file header)`);
        process.exitCode = 1;
        return;
    }
    if (command === 'read') {
        values = readSecrets(rest);
        if (rest.length === 1) {
            if (values[rest[0]]) {
                console.log(values[rest[0]]);
            }
        } else {
            for (const name of Object.keys(values)) {
                console.log(`${name}\t${values[name]}`);
            }
        }
        process.exitCode = Object.keys(values).length === rest.length ? 0 : 1;
        return;
    }
    if (command === 'decrypt') {
        results = await decryptSources(password, rest[0], rest.slice(1), { force });
    } else if (command === 'encrypt') {
        results = await encryptFiles(password, rest[0], rest.slice(1));
    } else if (command === 'verify') {
        results = await verifySources(password, rest);
    } else if (command === 'bundle-add') {
        results = await bundleAddFiles(password, rest[0], rest.slice(1), { replace });
    } else if (command === 'bundle-create') {
        results = await bundleAddFiles(password, rest[0], rest.slice(1), { fresh: true });
    } else if (command === 'migrate') {
        results = await migrateToBundle(password, rest[0], rest.slice(1));
    } else if (command === 'bundle-list') {
        results = bundleList(rest[0]);
    } else {
        results = bundleRemove(rest[0], rest.slice(1));
    }
    printResults(results);
    process.exitCode = hasFailure(results) ? 1 : 0;
}

module.exports = {
    STATUS,
    RESULT_TAG,
    parseEncryptedFile,
    decryptEntry,
    encryptEntry,
    encryptBuffer,
    loadBundle,
    bundleAddFiles,
    migrateToBundle,
    bundleList,
    bundleRemove,
    readSecrets,
    decryptSources,
    verifySources,
    encryptFiles,
    printResults,
    hasFailure,
    readSecret,
};

if (require.main === module) {
    main().catch((err) => {
        console.error(`[SECRET_CRYPTO] ${err.message}`);
        process.exitCode = 1;
    });
}
