# Payment Sandbox Smoke

This note documents the local smoke script for payment provider integration.

## Script
- `scripts/test-payment-sandbox.js`
- `scripts/get-wechat-sandbox-key.js`
- `scripts/verify-wechat-certs.js`

## Usage
Create an order and get payment URL/QR:
```bash
node scripts/test-payment-sandbox.js create --provider=alipay --method=web --plan=basic --userId=sandbox-user
```

Query provider status by order id:
```bash
node scripts/test-payment-sandbox.js query --provider=wechat --orderId=order_xxx
```

Trigger refund:
```bash
node scripts/test-payment-sandbox.js refund --provider=alipay --orderId=order_xxx --amount=1.00 --reason=test
```

Get WeChat sandbox sign key:
```bash
node scripts/get-wechat-sandbox-key.js
```

Verify WeChat platform certificate and merchant private key:
```bash
node scripts/verify-wechat-certs.js
```

## Required config (env)
- Alipay: `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_NOTIFY_URL`
- WeChat: `WECHAT_APP_ID`, `WECHAT_MCH_ID`, `WECHAT_KEY_PATH`, `WECHAT_SERIAL_NO`, `WECHAT_CERT_PATH`, `WECHAT_API_V3_KEY`, `WECHAT_NOTIFY_URL`
- WeChat sandbox: `WECHAT_API_KEY` (used by `get-wechat-sandbox-key.js`)
