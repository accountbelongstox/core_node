'use strict'

const fs = require('fs')
const crypto = require('crypto')

function normalizeSerial(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

function readFile(path) {
  if (!path) {
    throw new Error('Missing file path')
  }
  return fs.readFileSync(path, 'utf8')
}

function verifyPrivateKey(keyPem) {
  const privateKey = crypto.createPrivateKey(keyPem)
  const publicKey = crypto.createPublicKey(privateKey)
  const message = Buffer.from('wechat-pay-cert-check')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(message)
  sign.end()
  const signature = sign.sign(privateKey)
  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(message)
  verify.end()
  return verify.verify(publicKey, signature)
}

function parseCertificate(certPem) {
  const cert = new crypto.X509Certificate(certPem)
  return {
    serialNumber: cert.serialNumber,
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    fingerprint256: cert.fingerprint256
  }
}

function isExpired(validTo) {
  const ts = Date.parse(validTo)
  if (Number.isNaN(ts)) {
    return true
  }
  return Date.now() > ts
}

function isNotYetValid(validFrom) {
  const ts = Date.parse(validFrom)
  if (Number.isNaN(ts)) {
    return true
  }
  return Date.now() < ts
}

async function main() {
  const certPath = process.env.WECHAT_CERT_PATH
  const keyPath = process.env.WECHAT_KEY_PATH
  const expectedSerial = process.env.WECHAT_SERIAL_NO

  if (!certPath || !keyPath) {
    throw new Error('WECHAT_CERT_PATH and WECHAT_KEY_PATH are required')
  }

  const certPem = readFile(certPath)
  const keyPem = readFile(keyPath)

  const certInfo = parseCertificate(certPem)
  const serialMatch =
    normalizeSerial(certInfo.serialNumber) === normalizeSerial(expectedSerial || '')

  const keyOk = verifyPrivateKey(keyPem)
  const expired = isExpired(certInfo.validTo)
  const notYetValid = isNotYetValid(certInfo.validFrom)

  console.log(
    JSON.stringify(
      {
        serialNumber: certInfo.serialNumber,
        serialMatch: expectedSerial ? serialMatch : null,
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
        expired,
        notYetValid,
        fingerprint256: certInfo.fingerprint256,
        privateKeyValid: keyOk
      },
      null,
      2
    )
  )

  if (!keyOk || expired || notYetValid || (expectedSerial && !serialMatch)) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
