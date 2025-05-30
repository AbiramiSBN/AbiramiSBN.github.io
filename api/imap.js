const tls = require('tls');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  let body = '';
  req.on('data', chunk => { body += chunk });
  req.on('end', () => {
    let server, username, password, command;
    try {
      ({ server, username, password, command } = JSON.parse(body));
    } catch (e) {
      res.statusCode = 400;
      return res.end('Invalid JSON');
    }

    const [host, portStr] = server.split(':');
    const port = parseInt(portStr, 10);
    let dataBuf = '';
    let step = 0;

    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      // connected & SSL handshake done
    });

    socket.on('data', chunk => {
      const s = chunk.toString();
      dataBuf += s;

      if (step === 0) {
        // after greeting, send LOGIN
        socket.write(`A001 LOGIN ${username} ${password}\r\n`);
        step++;
      }
      else if (step === 1 && s.includes('A001 OK')) {
        // login succeeded, send LIST
        socket.write(`A002 ${command}\r\n`);
        step++;
      }
      else if (step === 2 && s.includes('A002 OK')) {
        // LIST done, close
        socket.end();
      }
    });

    // safety timeout
    socket.setTimeout(10000, () => socket.end());

    socket.on('end', () => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(dataBuf);
    });

    socket.on('error', err => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('IMAP Error: ' + err.message);
      }
    });
  });
};
