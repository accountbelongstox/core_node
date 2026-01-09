# Encryption Tools - Bundle Architecture

## Overview

New bundle-based encryption system for faster batch operations.

## Performance Comparison

### Old Architecture (Individual Files)
- 48 files → 48 separate .js files
- Decryption: 48 Node.js process starts (~2-3 seconds)
- Memory: 48 × process overhead

### New Architecture (Bundle)
- 48 files → 1 bundle .js file
- Decryption: 1 Node.js process start (~0.1 seconds)
- Memory: 1 × process overhead
- **Speed improvement: 20-30x faster**

## Tools

### 1. bundle_encrypt.js
Encrypt multiple files into a single bundle.

```bash
node bundle_encrypt.js PASSWORD OUTPUT_FILE FILE1 FILE2 ...
```

Example:
```bash
node bundle_encrypt.js mypassword ./secrets_bundle.js \
    ./secrets/api_key1.txt \
    ./secrets/api_key2.txt \
    ./secrets/config.json
```

### 2. migrate_to_bundle.js
Convert existing individual encrypted .js files to bundle format.

```bash
node migrate_to_bundle.js ENCRYPTED_DIR PASSWORD OUTPUT_FILE
```

Example:
```bash
node migrate_to_bundle.js \
    /www/programing/core_node/.secret_keys/already_encrypted \
    mypassword \
    /www/programing/core_node/.secret_keys/secrets_bundle.js
```

### 3. bundle_add_file.js
Add or replace a file in an existing bundle.

```bash
node bundle_add_file.js BUNDLE_PATH NEW_FILE PASSWORD [--replace]
```

Example:
```bash
node bundle_add_file.js ./secrets_bundle.js ./new_key.txt mypassword
node bundle_add_file.js ./secrets_bundle.js ./api_key.txt mypassword --replace
```

### 4. bundle_remove_file.js
Remove a file from an existing bundle.

```bash
node bundle_remove_file.js BUNDLE_PATH FILE_NAME
```

Example:
```bash
node bundle_remove_file.js ./secrets_bundle.js API_KEY_1
```

### 5. bundle_list_files.js
List all files in a bundle.

```bash
node bundle_list_files.js BUNDLE_PATH
```

Example:
```bash
node bundle_list_files.js ./secrets_bundle.js
```

### 6. Generated Bundle File
The output bundle file is self-contained and executable.

Decrypt all files:
```bash
node secrets_bundle.js pwd PASSWORD OUTPUT_DIR
```

Show password hint:
```bash
node secrets_bundle.js show
```

Force overwrite:
```bash
node secrets_bundle.js pwd PASSWORD OUTPUT_DIR --force
```

## Security Features

- Each file has unique salt, IV, pepper (same as old architecture)
- AES-256-GCM encryption
- PBKDF2 key derivation (1,000,000 iterations)
- HMAC-SHA512 integrity verification
- Anti-forensics: fake data on wrong password

## Migration Guide

1. Ensure you have the password for existing encrypted files
2. Run migrate_to_bundle.js to create bundle:
   ```bash
   cd /www/programing/core_node/scripts/encryption_tools
   node migrate_to_bundle.js \
       ../../.secret_keys/already_encrypted \
       YOUR_PASSWORD \
       ../../.secret_keys/secrets_bundle.js
   ```
3. Test the bundle:
   ```bash
   node ../../.secret_keys/secrets_bundle.js pwd YOUR_PASSWORD /tmp/test_decrypt
   ```
4. Verify decrypted files match originals
5. Update shell scripts to use bundle instead of individual files
6. Keep original encrypted files as backup until verified

## File Structure

```
encryption_tools/
├── bundle_encrypt.js        # Create new bundle from raw files
├── migrate_to_bundle.js     # Convert existing encrypted files to bundle
├── bundle_add_file.js       # Add or replace file in existing bundle
├── bundle_remove_file.js    # Remove file from existing bundle
├── bundle_list_files.js     # List all files in bundle
└── bundle.template.js       # Template for generated bundle files
```

## Integration with Shell Scripts

Update secret_functions.sh to use bundle:

Old (48 process calls):
```bash
for enc_file in "${pending_files[@]}"; do
    "$node_cmd" "$enc_file" pwd "$password" "$raw_dir"
done
```

New (1 process call):
```bash
"$node_cmd" "$SECRET_BUNDLE_FILE" pwd "$password" "$raw_dir"
```

Speed improvement: ~20-30x faster
