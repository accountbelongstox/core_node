'use strict';

class MATH_ {
    generateRandomCurvePoints(w, h) {
        const curvePoints = [];
        const steps = 100;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            const x = t * w;
            const y = (h / 2) * Math.sin(2 * Math.PI * t) + h / 2;

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

export default new MATH_();
