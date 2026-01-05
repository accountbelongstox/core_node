'use strict'

const crypto = require('crypto')
const axios = require('axios')

function parseArgs(argv) {
  return argv.reduce(
    (acc, arg) => {
      if (!arg.startsWith('--')) {
        acc._.push(arg)
        return acc
      }
      const trimmed = arg.slice(2)
      const [key, value] = trimmed.split('=')
      acc[key] = value === undefined || value === '' ? true : value
      return acc
    },
    { _: [] }
  )
}

function buildSignString(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '' && key !== 'sign')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}

function signParams(params, apiKey, signType) {
  const base = `${buildSignString(params)}&key=${apiKey}`
  if (signType === 'HMAC-SHA256') {
    return crypto.createHmac('sha256', apiKey).update(base, 'utf8').digest('hex').toUpperCase()
  }
  return crypto.createHash('md5').update(base, 'utf8').digest('hex').toUpperCase()
}

function buildXml(params) {
  const body = Object.keys(params)
    .map((key) => `<${key}><![CDATA[${params[key]}]]></${key}>`)
    .join('')
  return `<xml>${body}</xml>`
}

function parseXmlValue(xml, tag) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`)
  const plain = new RegExp(`<${tag}>([^<]+)</${tag}>`)
  const match = xml.match(cdata) || xml.match(plain)
  return match ? match[1] : ''
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const mchId = args.mchId || process.env.WECHAT_MCH_ID
  const apiKey = args.apiKey || process.env.WECHAT_API_KEY
  const signType = String(args.signType || 'MD5').toUpperCase()

  if (!mchId || !apiKey) {
    throw new Error('WECHAT_MCH_ID and WECHAT_API_KEY are required')
  }

  const params = {
    mch_id: mchId,
    nonce_str: crypto.randomBytes(16).toString('hex')
  }
  if (signType !== 'MD5') {
    params.sign_type = signType
  }
  params.sign = signParams(params, apiKey, signType)

  const xml = buildXml(params)
  const resp = await axios.post('https://api.mch.weixin.qq.com/sandboxnew/pay/getsignkey', xml, {
    headers: { 'Content-Type': 'text/xml' },
    timeout: 30000
  })

  const body = resp.data || ''
  const returnCode = parseXmlValue(body, 'return_code')
  const returnMsg = parseXmlValue(body, 'return_msg')
  if (returnCode !== 'SUCCESS') {
    throw new Error(`WeChat sandbox error: ${returnMsg || 'unknown'}`)
  }
  const sandboxKey = parseXmlValue(body, 'sandbox_signkey')
  if (!sandboxKey) {
    throw new Error('sandbox_signkey not found in response')
  }
  console.log(sandboxKey)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
