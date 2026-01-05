'use strict'

const subscriptionService = require('../src/services/subscriptionService')
const alipayService = require('../src/services/alipayService')
const wechatPayService = require('../src/services/wechatPayService')

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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0] || 'create'
  const provider = (args.provider || 'alipay').toLowerCase()
  const method = (args.method || 'web').toLowerCase()

  if (command === 'create') {
    const plans = await subscriptionService.getPlans()
    const planId = args.plan || plans[0]?.id
    if (!planId) {
      throw new Error('No plan found; pass --plan=<id>')
    }
    const orderResult = await subscriptionService.createOrder({
      userId: args.userId || 'sandbox-user',
      planId,
      provider,
      method,
      clientIp: args.clientIp,
      openId: args.openId
    })
    console.log(JSON.stringify(orderResult, null, 2))
    return
  }

  if (command === 'query') {
    const { orderId } = args
    if (!orderId) {
      throw new Error('Missing --orderId')
    }
    if (provider === 'alipay') {
      const result = await alipayService.queryOrder(orderId)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    if (provider === 'wechat') {
      const result = await wechatPayService.queryOrder(orderId)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    throw new Error(`Unsupported provider: ${provider}`)
  }

  if (command === 'refund') {
    const { orderId } = args
    if (!orderId) {
      throw new Error('Missing --orderId')
    }
    const order = await subscriptionService.getOrder(orderId)
    if (!order) {
      throw new Error('Order not found in datastore')
    }
    if (provider === 'alipay') {
      const result = await alipayService.refundOrder(order, args.amount, args.reason)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    if (provider === 'wechat') {
      const result = await wechatPayService.refundOrder(order, args.amount, args.reason)
      console.log(JSON.stringify(result, null, 2))
      return
    }
    throw new Error(`Unsupported provider: ${provider}`)
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
