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

import { ValidationErrorsIBAN } from 'ibantools';

export { getFriendlyErrors };

const ibanErrorToMessage = {
  [ValidationErrorsIBAN.NoIBANProvided]: 'No IBAN provided',
  [ValidationErrorsIBAN.NoIBANCountry]: 'No IBAN country',
  [ValidationErrorsIBAN.WrongBBANLength]: 'Wrong BBAN length',
  [ValidationErrorsIBAN.WrongBBANFormat]: 'Wrong BBAN format',
  [ValidationErrorsIBAN.ChecksumNotNumber]: 'Checksum is not a number',
  [ValidationErrorsIBAN.WrongIBANChecksum]: 'Wrong IBAN checksum',
  [ValidationErrorsIBAN.WrongAccountBankBranchChecksum]: 'Wrong account bank branch checksum',
  [ValidationErrorsIBAN.QRIBANNotAllowed]: 'QR-IBAN not allowed',
};

function getFriendlyErrors(errorCodes: ValidationErrorsIBAN[]) {
  return errorCodes.map(errorCode => ibanErrorToMessage[errorCode]).filter(Boolean);
}
