const fs = require('fs');
const path = './code_fragment.js';

// 读取文件内容
fs.readFile(path, 'utf8', function(err, data) {
    if (err) throw err;

    // 尝试解析文件内容为JSON
    let json;
    try {
        json = eval('(' + data + ')');
    } catch (e) {
        console.error('Error parsing JSON:', e);
        return;
    }

    // 递增每个对象的id值
    json.forEach(item => {
        item.id += 1;
    });

    // 将更新后的JSON对象转换回字符串格式
    const updatedData = JSON.stringify(json, null, 2);

    // 将更新后的数据写回文件
    fs.writeFile(path, updatedData, 'utf8', function(err) {
        if (err) throw err;
        console.log('File has been updated');
    });
});
