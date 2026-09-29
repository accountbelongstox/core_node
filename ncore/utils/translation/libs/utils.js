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
