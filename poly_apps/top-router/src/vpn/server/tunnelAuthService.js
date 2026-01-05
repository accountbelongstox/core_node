'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const DEFAULT_PASSWORD_LENGTH = 6
const DEFAULT_BCRYPT_ROUNDS = 10

function generatePassword(length = DEFAULT_PASSWORD_LENGTH) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

async function hashPassword(password, rounds = DEFAULT_BCRYPT_ROUNDS) {
  return await bcrypt.hash(password, rounds)
}

async function verifyPassword(password, hash) {
  if (!hash) {
    return false
  }
  return await bcrypt.compare(password, hash)
}

module.exports = {
  generatePassword,
  hashPassword,
  verifyPassword
}
