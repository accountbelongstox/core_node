/** Crypto workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const CRYPTO_WORKBENCHES: ToolWorkbenchMap = {
  hashGenerator: lazy(() => import('./HashGeneratorWorkbench')),
  uuidGenerator: lazy(() => import('./UuidGeneratorWorkbench')),
  bcryptGenerator: lazy(() => import('./BcryptWorkbench')),
  hmacGenerator: lazy(() => import('./HmacWorkbench')),
  rsaKeyGenerator: lazy(() => import('./RsaKeyWorkbench')),
  bip39Generator: lazy(() => import('./Bip39Workbench')),
  otpGenerator: lazy(() => import('./OtpWorkbench')),
  textEncryption: lazy(() => import('./TextEncryptionWorkbench')),
  passwordAnalyzer: lazy(() => import('./PasswordAnalyzerWorkbench')),
  basicAuthGenerator: lazy(() => import('./BasicAuthWorkbench')),
  tokenGenerator: lazy(() => import('./TokenGeneratorWorkbench')),
};
