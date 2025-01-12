
function buildConditions(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
        return ["", []];
    }

    const clauses = [];
    const values = [];

    for (const [key, val] of Object.entries(conditions)) {
        if (val.startsWith(">=")) {
            clauses.push(`${key} >= ?`);
            values.push(val.slice(2));
        } else if (val.startsWith("<=")) {
            clauses.push(`${key} <= ?`);
            values.push(val.slice(2));
        } else if (val.startsWith(">")) {
            clauses.push(`${key} > ?`);
            values.push(val.slice(1));
        } else if (val.startsWith("<")) {
            clauses.push(`${key} < ?`);
            values.push(val.slice(1));
        } else if (val.startsWith("!=")) {
            clauses.push(`${key} != ?`);
            values.push(val.slice(2));
        } else if (val.startsWith("%") && val.endsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(val);
        } else if (val.startsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(`%${val.slice(1)}`);
        } else if (val.endsWith("%")) {
            clauses.push(`${key} LIKE ?`);
            values.push(`${val.slice(0, -1)}%`);
        } else {
            clauses.push(`${key} = ?`);
            values.push(val);
        }
    }

    return [clauses.join(" AND "), values];
}


module.exports = {
    buildConditions,
};
