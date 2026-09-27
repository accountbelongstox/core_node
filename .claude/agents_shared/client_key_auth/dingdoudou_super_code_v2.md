# DingDuoDuo super code v2 (NC-008)

Owner of the extension verifier: ncore (`apps/dingdoudou/lib/superCode.ts`). Minting: laravel (`DingDuoDuoV1SuperCodeService`). Contract value: orchestrator.

## Format

`DDK2.<payload>.<signature>`

- `payload`: base64url without padding of the UTF-8 JSON object
  `{"v":2,"device":"<extension device id>","exp":<unix seconds>,"iat":<unix seconds>,"tier":"unlimited","features":["*"],"maxBinds":<integer>}`.
  `v`, `device` and `exp` are required. `tier`, `features` and `maxBinds` are optional (defaults: `unlimited`, `["*"]`, unlimited binds).
- `signature`: base64url without padding of the Ed25519 detached signature over the ASCII bytes of `DDK2.<payload>`.
- The device id is the extension's `deviceId` (`dev_<uuid>`, shown in the popup under the super-code field and already sent to the backend at member login).

## Verification (extension)

Valid only when the signature verifies with the public key, `v == 2`, `device` equals this extension's device id, and `exp` is in the future. A stored super license is re-verified on every `license.get`; codes in the old format (and the three master codes) no longer verify anywhere.

## Keys

- Private key: shared secret store, suggested name `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` (base64url 32-byte Ed25519 seed). Only Laravel reads it (`sodium_crypto_sign_detached`). Never shipped, never logged.
- Public key: `config/service_contract.json#dingdoudou.super_code_public_key` (base64url, 32 raw bytes). The extension imports it at build time. Until it is set, every super code is rejected (fail closed).

## Removed

- `MASTER_CODES` (`DDK-MASTER-0000`, `DINGDUODUO-VIP`, `DDK-SUPER-FOREVER`) and `SUPER_SALT` / FNV-1a signatures on both ends. The backend must not accept them as member tokens either (`DingDuoDuoV1LicenseService`).
