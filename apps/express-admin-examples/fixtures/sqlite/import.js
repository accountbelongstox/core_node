const fs = require('fs');
    const path = require('path');
    const sqlite3 = require('sqlite3');

    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    const db = new sqlite3.Database(path.join(__dirname, 'x-admin-examples.sqlite'));

    async function importData() {
        try {
            // Read schema
            const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
            
            // Read insert statements
            const insert = fs.readFileSync(path.join(__dirname, 'insert.sql'), 'utf8');

            // Execute schema
            await new Promise((resolve, reject) => {
                db.exec(schema, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Execute insert statements
            await new Promise((resolve, reject) => {
                db.exec(insert, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log('Import successful!');
            
        } catch (err) {
            console.error('Import error:', err);
            process.exit(1);
        } finally {
            db.close();
        }
    }

    // Execute if run directly
    if (__filename === process.argv[1]) {
        importData();
    }

    module.exports = importData;