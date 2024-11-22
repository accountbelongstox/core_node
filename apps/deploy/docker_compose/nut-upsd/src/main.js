const { exec } = require('child_process');

const port = 3494;

const http = require('http');
const server = http.createServer();

server.on('request', (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    exec('upsc -l', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to list UPS devices' }));
        return;
      }
      const upses = stdout.trim().split('\n');
      const upsData = {};
      let count = 0;

      upses.forEach((upsName) => {
        exec(`upsc ${upsName}`, (error, stdout, stderr) => {
          count++;
          if (error) {
            console.error(`exec error: ${error}`);
            upsData[upsName] = {};
          } else {
            upsData[upsName] = parseUpsData(stdout);
          }

          if (count === upses.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(upsData));
          }
        });
      });
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

function parseUpsData(data) {
  // Implement parsing logic here based on your needs
  // Example: parse the output of upsc command
  // and return structured data
  return JSON.parse(data);
}

server.listen(port, () => {
  console.log(`UPS monitoring API listening at http://localhost:${port}`);
});
