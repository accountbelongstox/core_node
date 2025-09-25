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

const {DictionariesTableName} = require(`../../provider/types/data_table_names.js`)
const { static_local_schema } = require(`../../provider/schemas/index.js`)
const { dbItemAlign } = require('./dbitem_align.js');
const WrapStaticItemNotKeepIdKey = (dataOrWord) => {
    return WrapStaticItemNormal(dataOrWord, false);
}
const WrapStaticArrayNotKeepIdKey = (dataArray) => {
    return dataArray.map(item => WrapStaticItemNormal(item, false));
}
const WrapStaticItemNormal = (dataOrWord, keepIdKey = true) => {
    let data;
    if (typeof dataOrWord === 'string') {
        data = {
            content: dataOrWord
        };
    } else {
        data = dataOrWord;
    }
    data = dbItemAlign(data, static_local_schema, DictionariesTableName, keepIdKey);
    return data;
};
module.exports = {
    WrapStaticItemNormal,
    WrapStaticItemNotKeepIdKey,
    WrapStaticArrayNotKeepIdKey
};