// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const path = require('path');

const iconSizes = [16, 32, 64];
const outputDir = __dirname;

function generateSimpleTrayIcon(size, outputPath) {
    const width = size;
    const height = size;
    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * channels;
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= radius) {
                buffer[index] = 0;
                buffer[index + 1] = 150;
                buffer[index + 2] = 255;
                buffer[index + 3] = 255;
            } else if (distance <= radius + 2) {
                buffer[index] = 0;
                buffer[index + 1] = 100;
                buffer[index + 2] = 200;
                buffer[index + 3] = 255;
            } else {
                buffer[index] = 0;
                buffer[index + 1] = 0;
                buffer[index + 2] = 0;
                buffer[index + 3] = 0;
            }
        }
    }

    const pngHeader = Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10
    ]);

    const ihdrChunk = createPNGChunk('IHDR',
        Buffer.concat([
            Buffer.from([0, 0, 0, width]),
            Buffer.from([0, 0, 0, height]),
            Buffer.from([8]),
            Buffer.from([6]),
            Buffer.from([0, 0, 0])
        ])
    );

    const rawData = [];
    for (let y = 0; y < height; y++) {
        rawData.push(0);
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * channels;
            rawData.push(buffer[index]);
            rawData.push(buffer[index + 1]);
            rawData.push(buffer[index + 2]);
            rawData.push(buffer[index + 3]);
        }
    }

    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(rawData));
    const idatChunk = createPNGChunk('IDAT', compressed);
    const iendChunk = createPNGChunk('IEND', Buffer.alloc(0));

    const png = Buffer.concat([
        pngHeader,
        ihdrChunk,
        idatChunk,
        iendChunk
    ]);

    fs.writeFileSync(outputPath, png);
    console.log(`Generated icon: ${outputPath} (${size}x${size})`);
}

function createPNGChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crc32 = calculateCRC32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc32, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function calculateCRC32(buffer) {
    let crc = 0xFFFFFFFF;
    const table = [];
    let c;
    let n;
    let k;

    for (n = 0; n < 256; n++) {
        c = n;
        for (k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }

    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF];
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

console.log('Generating tray icons...');

iconSizes.forEach(size => {
    const outputPath = path.join(outputDir, `tray-icon-${size}.png`);
    generateSimpleTrayIcon(size, outputPath);
});

const mainIconPath = path.join(outputDir, 'tray-icon.png');
generateSimpleTrayIcon(32, mainIconPath);

const appIconPath = path.join(outputDir, 'app-icon.png');
generateSimpleTrayIcon(64, appIconPath);

console.log('Icon generation completed!');
console.log(`Main tray icon: ${mainIconPath}`);
console.log(`App icon: ${appIconPath}`);
