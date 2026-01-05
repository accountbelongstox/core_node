'use strict'

const nodemailer = require('nodemailer')
const config = require('../../config/config')
const logger = require('../utils/logger')

let transporter = null

function ensureTransporter() {
  if (transporter) {
    return transporter
  }
  if (!config.email?.enabled) {
    logger.warn('📧 Email service disabled (EMAIL_ENABLED != true), using no-op sender')
    return null
  }
  const { host, port, secure, auth } = config.email.smtp || {}
  if (!host || !auth?.user || !auth?.pass) {
    logger.warn('📧 Email SMTP not fully configured, email sending skipped')
    return null
  }
  transporter = nodemailer.createTransport({ host, port, secure, auth })
  return transporter
}

async function sendPasswordResetEmail(to, username, resetToken) {
  const mailer = ensureTransporter()
  const from = config.email?.from || 'no-reply@example.com'
  const baseUrl = config.email?.resetBaseUrl || ''
  const resetLink = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`
    : null
  const subject = 'Password Reset'
  const text = resetLink
    ? `Hello ${username},\n\nClick the link to reset your password: ${resetLink}\nIf you did not request this, please ignore.`
    : `Hello ${username},\n\nUse this token to reset your password: ${resetToken}\nIf you did not request this, please ignore.`

  if (!mailer) {
    // 仅记录日志，方便在未配置 SMTP 时调试
    logger.info(
      `[Email] (noop) Password reset for ${to}: ${resetToken}${resetLink ? ` link=${resetLink}` : ''}`
    )
    return { accepted: [], rejected: [], envelope: null, noop: true }
  }

  const info = await mailer.sendMail({ from, to, subject, text })
  logger.info(`📧 Password reset email sent to ${to}, messageId=${info.messageId}`)
  return info
}

module.exports = {
  sendPasswordResetEmail
}
