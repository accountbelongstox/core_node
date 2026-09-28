#!/usr/bin/env node

/**
 * Calculate Chrome Extension ID from manifest.json key field
 * Extension ID is calculated as: SHA256(public key) -> first 128 bits -> base16 (lowercase)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Convert hexadecimal string to Chrome Extension ID alphabet
 * Chrome uses 'a'-'p' instead of '0'-'f' to avoid numeric-only IDs
 * (which could be interpreted as IP addresses)
 * 
 * @param {string} hex - Hexadecimal string (lowercase)
 * @returns {string} Extension ID using a-p alphabet
 */
function convertHexToIdAlphabet(hex) {
  return hex.split('').map(char => {
    const val = parseInt(char, 16);
    return String.fromCharCode('a'.charCodeAt(0) + val);
  }).join('');
}

/**
 * Calculate extension ID from public key
 * Chrome Extension ID calculation (as per Chromium id_util.cc):
 * 1. Decode the public key from base64
 * 2. Calculate SHA256 hash of the decoded key
 * 3. Take first 128 bits (16 bytes)
 * 4. Convert to hex and map '0'-'f' -> 'a'-'p'
 * 
 * @param {string} publicKey - The public key from manifest.json (base64, without BEGIN/END markers)
 * @returns {string} Extension ID (32 characters, a-p alphabet)
 */
function calculateExtensionId(publicKey) {
  // Remove whitespace, newlines, and BEGIN/END markers
  let cleanKey = publicKey.replace(/-----BEGIN PUBLIC KEY-----/g, '');
  cleanKey = cleanKey.replace(/-----END PUBLIC KEY-----/g, '');
  cleanKey = cleanKey.replace(/\s+/g, '');
  cleanKey = cleanKey.trim();
  
  if (!cleanKey) {
    throw new Error('Empty public key');
  }
  
  // Decode the base64 public key
  const keyBuffer = Buffer.from(cleanKey, 'base64');
  
  // Calculate SHA256 hash
  const hash = crypto.createHash('sha256').update(keyBuffer).digest();
  
  // Take first 16 bytes (128 bits) and convert to hex
  const hex = hash.slice(0, 16).toString('hex');
  
  // Convert hex to Chrome Extension ID alphabet (0-f -> a-p)
  const extensionId = convertHexToIdAlphabet(hex);
  
  return extensionId;
}

/**
 * Extract extension ID from manifest.json
 * @param {string} manifestPath - Path to manifest.json
 * @returns {string|null} Extension ID or null if not found
 */
function getExtensionIdFromManifest(manifestPath) {
  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    if (!manifest.key) {
      return null;
    }

    // Remove BEGIN/END markers if present
    let publicKey = manifest.key;
    publicKey = publicKey.replace(/-----BEGIN PUBLIC KEY-----/g, '');
    publicKey = publicKey.replace(/-----END PUBLIC KEY-----/g, '');
    publicKey = publicKey.trim();

    if (!publicKey) {
      return null;
    }

    return calculateExtensionId(publicKey);
  } catch (error) {
    console.error(`Error reading manifest: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
function main() {
  const manifestPath = process.argv[2];
  
  if (!manifestPath) {
    console.error('Usage: node extension-id-calculator.cjs <manifest.json path>');
    process.exit(1);
  }

  const extensionId = getExtensionIdFromManifest(manifestPath);
  
  if (extensionId) {
    console.log(extensionId);
    process.exit(0);
  } else {
    console.error('Could not calculate extension ID from manifest');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { calculateExtensionId, getExtensionIdFromManifest };
