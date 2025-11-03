// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const logger = require('#@logger');

class MathTools {
    constructor() {
        this.tools = [
            {
                id: 'expression_evaluate',
                name: 'Expression Evaluator',
                description: 'Evaluate mathematical expressions',
                category: 'math',
                icon: 'calculator',
                endpoint: '/math/evaluate',
                method: 'POST',
                keywords: ['math', 'calculator', 'evaluate', 'expression']
            }
        ];
    }

    getToolList() {
        return this.tools;
    }

    async execute(toolId, params) {
        switch (toolId) {
            case 'expression_evaluate':
                return this.evaluateExpression(params.expression);
            default:
                throw new Error(`Unknown math tool: ${toolId}`);
        }
    }

    evaluateExpression(expression) {
        if (!expression) {
            throw new Error('Expression is required');
        }

        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

        if (sanitized !== expression) {
            throw new Error('Expression contains invalid characters. Only numbers and operators (+, -, *, /, ()) are allowed.');
        }

        try {
            const result = this.safeEval(sanitized);

            if (!isFinite(result)) {
                throw new Error('Result is not a finite number');
            }

            return {
                result: result,
                expression: expression,
                sanitized: sanitized
            };
        } catch (error) {
            logger.error(`Expression evaluation error: ${error.message}`);
            throw new Error(`Failed to evaluate expression: ${error.message}`);
        }
    }

    safeEval(expression) {
        const tokens = this.tokenize(expression);
        const postfix = this.infixToPostfix(tokens);
        return this.evaluatePostfix(postfix);
    }

    tokenize(expression) {
        const tokens = [];
        let currentNumber = '';
        let i = 0;

        while (i < expression.length) {
            const char = expression[i];

            if (char === ' ') {
                i++;
                continue;
            }

            if (char >= '0' && char <= '9' || char === '.') {
                currentNumber += char;
            } else {
                if (currentNumber) {
                    tokens.push(parseFloat(currentNumber));
                    currentNumber = '';
                }

                if (char === '+' || char === '-' || char === '*' || char === '/' || char === '(' || char === ')') {
                    tokens.push(char);
                }
            }

            i++;
        }

        if (currentNumber) {
            tokens.push(parseFloat(currentNumber));
        }

        return tokens;
    }

    infixToPostfix(tokens) {
        const output = [];
        const operators = [];
        const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };

        for (const token of tokens) {
            if (typeof token === 'number') {
                output.push(token);
            } else if (token === '(') {
                operators.push(token);
            } else if (token === ')') {
                while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                    output.push(operators.pop());
                }
                operators.pop();
            } else if (token in precedence) {
                while (
                    operators.length > 0 &&
                    operators[operators.length - 1] !== '(' &&
                    precedence[operators[operators.length - 1]] >= precedence[token]
                ) {
                    output.push(operators.pop());
                }
                operators.push(token);
            }
        }

        while (operators.length > 0) {
            output.push(operators.pop());
        }

        return output;
    }

    evaluatePostfix(postfix) {
        const stack = [];

        for (const token of postfix) {
            if (typeof token === 'number') {
                stack.push(token);
            } else {
                const b = stack.pop();
                const a = stack.pop();

                switch (token) {
                    case '+':
                        stack.push(a + b);
                        break;
                    case '-':
                        stack.push(a - b);
                        break;
                    case '*':
                        stack.push(a * b);
                        break;
                    case '/':
                        if (b === 0) {
                            throw new Error('Division by zero');
                        }
                        stack.push(a / b);
                        break;
                }
            }
        }

        return stack[0];
    }
}

module.exports = MathTools;
