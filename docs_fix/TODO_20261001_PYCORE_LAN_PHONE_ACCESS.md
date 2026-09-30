# TODO: pycore - admit LAN phones for clip transfer

Status: pending development (the wordnew client side is implemented).
Source: docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md section 4.6.

## Situation

The wordnew app scans the LAN for pycore (`http://<ip>:59000`) and can switch
to a found instance for the session, to transfer clips at LAN speed. pycore's
K7 gate (`pycore/pyutils/common/local_rpc_guard.py`) admits a non-loopback
caller only with a K3 client-key signature; the phone holds no machine key, so
every request - `GET /api/status` included - answers 401 and the scanner shows
the host as "refused". pycore also binds loopback unless `rpcLanBind` is on.

Working paths today: the tailnet `/pycore-api` mount (Tailscale uses the direct LAN
path when both devices share a network) and the relay.

## To implement (security-reviewed, opt-in)

1. A pairing flow that gives a phone a scoped client key (K3), e.g. a code
   shown in the pycore UI and entered in the app; the key signs requests
   exactly like other K3 clients (`X-Core-Node-*` headers).
2. Or an explicit, default-off LAN read policy: with `rpcLanBind` on and a new
   setting enabled, unsigned LAN callers may use only the read routes
   `api/status`, `ui/audio_orch/resource/lookup`, `ui/audio_orch/resource/chunk`
   (cached audio, no user data); every other route keeps K7.
3. `wordnew` then marks such hosts "up" and uses them through the temporary
   target (no client change needed for option 2; option 1 adds the signer).
