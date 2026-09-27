function getTableNameFromModel(model,options) {
    let {tableName} = options;
    if(!tableName) {
        tableName = model.tableName;
    }
    return tableName;
}

module.exports = {
    getTableNameFromModel
}
