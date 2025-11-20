// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const SUPPORTED_OPERATORS = {
    $gt: '>',
    $gte: '>=',
    $lt: '<',
    $lte: '<=',
    $ne: '!=',
    $like: 'LIKE',
    $between: 'BETWEEN',
    $in: 'IN',
    $notIn: 'NOT IN'
};

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(identifier) {
    if (typeof identifier !== 'string') {
        return identifier;
    }
    if (!IDENTIFIER_REGEX.test(identifier)) {
        return identifier;
    }
    return `"${identifier}"`;
}

function buildWhereClause(where = {}, columns = {}) {
    if (!where || Object.keys(where).length === 0) {
        return {
            clause: '',
            params: []
        };
    }
    const fragments = [];
    const params = [];

    for (const [field, condition] of Object.entries(where)) {
        if (field === '$or' && Array.isArray(condition)) {
            const orParts = [];
            const orParams = [];
            for (const item of condition) {
                const nested = buildWhereClause(item, columns);
                if (nested.clause) {
                    orParts.push(`(${nested.clause})`);
                    orParams.push(...nested.params);
                }
            }
            if (orParts.length > 0) {
                fragments.push(orParts.join(' OR '));
                params.push(...orParams);
            }
            continue;
        }

        const columnName = quoteIdentifier(field);

        if (condition === null || condition === undefined) {
            fragments.push(`${columnName} IS NULL`);
            continue;
        }

        if (typeof condition !== 'object' || Array.isArray(condition)) {
            fragments.push(`${columnName} = ?`);
            params.push(encodeValue(columns[field], condition));
            continue;
        }

        const conditionFragments = [];
        for (const [op, value] of Object.entries(condition)) {
            if (op === '$null') {
                conditionFragments.push(`${columnName} IS ${value ? '' : 'NOT '}NULL`);
                continue;
            }

            if (op === '$emptyJSON') {
                conditionFragments.push(
                    `(${columnName} IS NULL OR ${columnName} = '' OR ${columnName} = '{}' OR ${columnName} = '[]')`
                );
                continue;
            }

            if (op === '$emptyArray') {
                conditionFragments.push(
                    `(${columnName} IS NULL OR ${columnName} = '' OR ${columnName} = '[]')`
                );
                continue;
            }

            const operator = SUPPORTED_OPERATORS[op];
            if (!operator) {
                continue;
            }

            if (op === '$between' && Array.isArray(value) && value.length === 2) {
                conditionFragments.push(`${columnName} BETWEEN ? AND ?`);
                params.push(
                    encodeValue(columns[field], value[0]),
                    encodeValue(columns[field], value[1])
                );
                continue;
            }

            if ((op === '$in' || op === '$notIn') && Array.isArray(value)) {
                const placeholders = value.map(() => '?').join(', ');
                conditionFragments.push(`${columnName} ${operator} (${placeholders})`);
                params.push(...value.map((item) => encodeValue(columns[field], item)));
                continue;
            }

            conditionFragments.push(`${columnName} ${operator} ?`);
            params.push(encodeValue(columns[field], value));
        }

        if (conditionFragments.length > 0) {
            fragments.push(conditionFragments.join(' AND '));
        }
    }

    const clause = fragments.join(' AND ');
    return { clause, params };
}

function buildOrder(order = []) {
    if (!order) {
        return '';
    }
    if (typeof order === 'string') {
        return ` ORDER BY ${order}`;
    }
    if (Array.isArray(order) && order.length > 0) {
        const parts = order.map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            if (Array.isArray(item) && item.length >= 1) {
                const direction = item[1] ? String(item[1]).toUpperCase() : 'ASC';
                const column = IDENTIFIER_REGEX.test(item[0]) ? `"${item[0]}"` : item[0];
                return `${column} ${direction}`;
            }
            return '';
        }).filter(Boolean);
        if (parts.length > 0) {
            return ` ORDER BY ${parts.join(', ')}`;
        }
    }
    return '';
}

function encodeValue(columnDefinition, value) {
    if (value === undefined) {
        return null;
    }
    if (!columnDefinition || !columnDefinition.type) {
        return value;
    }
    const typeKey = columnDefinition.type.key || columnDefinition.type.name;
    if (!typeKey) {
        return value;
    }
    switch (typeKey) {
        case 'BOOLEAN':
            return value ? 1 : 0;
        case 'JSON':
        case 'JSONB':
        case 'ARRAY':
            if (value === null) {
                return null;
            }
            return JSON.stringify(value);
        case 'DATE':
        case 'DATEONLY':
            if (!value) {
                return null;
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        default:
            return value;
    }
}

function decodeRow(columns, row) {
    if (!row || !columns) {
        return row;
    }
    const decoded = {};
    for (const [key, value] of Object.entries(row)) {
        const column = columns[key];
        if (!column) {
            decoded[key] = value;
            continue;
        }
        const typeKey = column.type.key || column.type.name;
        switch (typeKey) {
            case 'BOOLEAN':
                decoded[key] = value === 1 || value === '1' || value === true;
                break;
            case 'JSON':
            case 'JSONB':
            case 'ARRAY':
                if (value === null || value === undefined || value === '') {
                    decoded[key] = column.defaultValue ?? null;
                    break;
                }
                try {
                    decoded[key] = typeof value === 'string' ? JSON.parse(value) : value;
                } catch (error) {
                    decoded[key] = value;
                }
                break;
            default:
                decoded[key] = value;
        }
    }
    return decoded;
}

module.exports = {
    buildWhereClause,
    buildOrder,
    encodeValue,
    decodeRow
};
