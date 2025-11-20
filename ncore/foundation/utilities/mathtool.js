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

'use strict';

class MATH_ {
    generateRandomCurvePoints(w, h) {
        const curvePoints = [];
        const steps = 100;
    
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            const x = t * w;
            const y = h / 2 * Math.sin(2 * Math.PI * t) + h / 2;
    
            curvePoints.push({ x, y });
        }
    
        return curvePoints;
    }

    printMatrix(points) {
        const maxX = Math.max(...points.map(point => Math.round(point.x)));
        const maxY = Math.max(...points.map(point => Math.round(point.y)));
    
        const matrix = Array.from({ length: maxY + 1 }, () => Array(maxX + 1).fill(' '));
    
        points.forEach(point => {
            const roundedX = Math.round(point.x);
            const roundedY = Math.round(point.y);
            matrix[roundedY][roundedX] = 'x';
        });
    
        for (let row = 0; row <= maxY; row++) {
            console.log(matrix[row].join(''));
        }
    }
}

MATH_.toString = () => '[class MATH]';
module.exports = new MATH_();


