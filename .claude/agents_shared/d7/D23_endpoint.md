# D23 ruling: local test endpoint without certificates

User D23 (2026-09-27): "继续所有任务，如果证书不方便，可以使用一个在解密目录里的加密字符串" (continue all tasks; if the certificate is inconvenient, use an encrypted string from the decryption directory).

Ruling (orchestrator):
- For local tests (D7, D8, D9), pycore's Laravel endpoint is **`http://127.0.0.1:9000`**, the same local FrankenPHP instance (see `laravel_local.md`), over loopback without TLS.
  - Machine calls are authenticated by the shared client key `CORE_NODE_CLIENT_KEY_1` (K3 HMAC signature). pycore reads the key from the decrypted secret store `.secret_keys/.secret_ignore/`; the encrypted copy travels with the code (`.secret_keys/already_encrypted/*.js`, user D21).
  - Operator/UI calls use the normal dashboard login.
- Select the endpoint through pycore's own endpoint selection (LaravelEndpointManager via its RPC/UI route), never by editing code. Save the previous selection to `endpoint_before.json` first.
- Withdrawn:
  - the process-level CA bundle (`REQUESTS_CA_BUNDLE`/`SSL_CERT_FILE`);
  - the system-wide trust of the local mkcert CA, which is no longer needed for tests.
  - `https://127.0.0.1` keeps working for browsers that are given the CA explicitly.
- Keep K7: pycore still binds loopback, and non-loopback callers still need a valid K3 signature.
