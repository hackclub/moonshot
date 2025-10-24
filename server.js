const { createServer } = require('http');
const { parse } = require('url');
const crypto = require('crypto');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT) || 3000; // Use PORT env var from Docker, fallback to 3000

// Initialize Next.js (do NOT pin a hostname in Next's config so request URLs derive from forwarded headers)
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    // Optional Basic HTTP Auth using BASICAUTH_USERNAME and BASICAUTH_PASSWORD
    const basicUser = process.env.BASICAUTH_USERNAME;
    const basicPass = process.env.BASICAUTH_PASSWORD;
    const basicDebug = process.env.BASICAUTH_DEBUG === 'true';
    if (basicUser && basicPass) {
      const users = { [basicUser]: basicPass };
      if (basicDebug) {
        console.log('[basic-auth] enabled');
        console.log('[basic-auth] configured user:', basicUser);
        console.log('[basic-auth] password mode:', basicPass.startsWith('$apr1$') ? 'apr1-hash' : 'plaintext');
      }

      const unauthorized = (reason) => {
        if (basicDebug) console.log('[basic-auth] unauthorized:', reason || 'unknown');
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
        res.end('Authentication required');
      };

      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Basic ')) {
        if (basicDebug) console.log('[basic-auth] missing/invalid Authorization header');
        return unauthorized('missing header');
      }
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      const username = sep >= 0 ? decoded.slice(0, sep) : '';
      const password = sep >= 0 ? decoded.slice(sep + 1) : '';
      if (basicDebug) console.log('[basic-auth] received username:', username);

      const stored = users[username];
      if (!stored) {
        if (basicDebug) console.log('[basic-auth] unknown user');
        return unauthorized('unknown user');
      }

      const timingSafeEqual = (a, b) => {
        const ba = Buffer.from(a);
        const bb = Buffer.from(b);
        if (ba.length !== bb.length) return false;
        return crypto.timingSafeEqual(ba, bb);
      };

      const verifyApr1 = (pwd, hash) => {
        // hash format: $apr1$<salt>$<digest>
        const parts = hash.split('$');
        if (parts.length < 4 || parts[1] !== 'apr1') return false;
        const salt = parts[2];
        const magic = '$apr1$';

        const to64 = (v, n) => {
          const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
          let s = '';
          while (--n >= 0) {
            s += itoa64[v & 0x3f];
            v >>= 6;
          }
          return s;
        };

        let ctx = pwd + magic + salt;
        let final = crypto.createHash('md5').update(pwd + salt + pwd, 'binary').digest();

        for (let i = pwd.length; i > 0; i -= 16) {
          ctx += final.slice(0, Math.min(16, i)).toString('binary');
        }
        for (let i = pwd.length; i; i >>= 1) {
          ctx += (i & 1) ? '\x00' : pwd[0];
        }
        final = crypto.createHash('md5').update(Buffer.from(ctx, 'binary')).digest();

        for (let i = 0; i < 1000; i++) {
          let ctx1 = '';
          ctx1 += (i & 1) ? pwd : final.toString('binary');
          if (i % 3) ctx1 += salt;
          if (i % 7) ctx1 += pwd;
          ctx1 += (i & 1) ? final.toString('binary') : pwd;
          final = crypto.createHash('md5').update(Buffer.from(ctx1, 'binary')).digest();
        }

        let l = (final[0] << 16) | (final[6] << 8) | final[12];
        let passwd = to64(l, 4);
        l = (final[1] << 16) | (final[7] << 8) | final[13];
        passwd += to64(l, 4);
        l = (final[2] << 16) | (final[8] << 8) | final[14];
        passwd += to64(l, 4);
        l = (final[3] << 16) | (final[9] << 8) | final[15];
        passwd += to64(l, 4);
        l = (final[4] << 16) | (final[10] << 8) | final[5];
        passwd += to64(l, 4);
        l = final[11];
        passwd += to64(l, 2);

        const computed = `${magic}${salt}$${passwd}`;
        return timingSafeEqual(computed, hash);
      };

      let ok = false;
      if (stored.startsWith('$apr1$')) {
        if (basicDebug) console.log('[basic-auth] verifying with apr1-hash');
        ok = verifyApr1(password, stored);
      } else {
        // Treat as plaintext secret if no known hash prefix
        if (basicDebug) console.log('[basic-auth] verifying with plaintext compare');
        ok = timingSafeEqual(password, stored);
      }

      if (!ok) {
        if (basicDebug) console.log('[basic-auth] password mismatch');
        return unauthorized('bad password');
      }
      if (basicDebug) console.log('[basic-auth] authorized');
    }
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Set a short timeout to fail fast rather than waiting
  server.setTimeout(0);
  
  // Handle error during server listen
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\x1b[31mError: Port ${port} is already in use.\x1b[0m`);
      console.error('Please ensure no other processes are using this port before starting the application.');
      process.exit(1);
    } else {
      console.error('Server error:', e);
      process.exit(1);
    }
  });

  server.listen(port, hostname, async (err) => {
    if (err) throw err;
    const address = server.address();
    console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${address.port}`);    
  });
}); 