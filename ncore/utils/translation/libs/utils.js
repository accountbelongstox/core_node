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

const logger = require('#@logger');

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function findKeyInObject(obj, value) {
  let result;
  result = null;

  for (const key in obj) {
    if (obj[key] === value) {
      result = key;
      break;
    }
  }

  return result;
}

function findValueInBFromValueInA(objA, objB, value) {
  let result;
  result = undefined;

  for (const key in objA) {
    if (objA[key] === value) {
      result = objB[key];
      break;
    }
  }

  return result;
}

function convertToPlatformLanguageCode(userLanguageCode, platformLanguageTable, globalLanguageTable) {
  const platformLanguageCode = findValueInBFromValueInA(
    globalLanguageTable,
    platformLanguageTable,
    userLanguageCode
  );

  if (!platformLanguageCode) {
    logger.error(`Unsupported language code: ${userLanguageCode}`);
    return null;
  }

  return platformLanguageCode;
}

module.exports = {
  sleep,
  findKeyInObject,
  findValueInBFromValueInA,
  convertToPlatformLanguageCode,
};
