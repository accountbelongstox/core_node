// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

export interface SignatureInfo {
  verified: boolean
  authenticity: boolean
  integrity: boolean
  expired: boolean
  meta: {
    certs: {
      clientCertificate?: boolean
      issuedBy: {
        commonName: string
        organizationalUnitName?: string
        organizationName: string
        countryName?: string
        localityName?: string
        stateOrProvinceName?: string
      }
      issuedTo: {
        commonName: string
        serialNumber?: string
        organizationalUnitName?: string
        organizationName: string
        countryName?: string
        localityName?: string
        stateOrProvinceName?: string
      }
      validityPeriod: {
        notBefore: string
        notAfter: string
      }
      pemCertificate: string
    }[]
    signatureMeta: {
      reason: string
      contactInfo: string | null
      location: string
      name: string | null
    }
  }
}
