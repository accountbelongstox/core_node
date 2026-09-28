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