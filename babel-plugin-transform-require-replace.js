module.exports = function({ types: t }) {
    return {
        visitor: {
            CallExpression(path) {
                if (path.node.callee.name === 'require' && path.node.arguments.length > 0) {
                    const arg = path.node.arguments[0];
                    if (t.isStringLiteral(arg)) {
                        let newValue = arg.value;

                        // 替换路径
                        newValue = newValue.replace(/^(\.\/|\.\.\/|\s*)(ncore)/g, (match, p1, p2) => {
                            return p1 + '.' + p2;
                        });

                        newValue = newValue.replace(/^\/(ncore)/g, '/.' + '$1');

                        // 更新路径
                        if (newValue !== arg.value) {
                            path.node.arguments[0] = t.stringLiteral(newValue);
                        }
                    }
                }
            }
        }
    };
};
