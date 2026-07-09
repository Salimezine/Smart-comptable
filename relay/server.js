const express = require('express');
const SFTPClient = require('ssh2-sftp-client');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb', type: 'application/xml' }));

const {
  PORT = 3000,
  SFTP_HOST = '',
  SFTP_PORT = '22',
  SFTP_USER = '',
  SFTP_PASS = '',
  SFTP_PATH = '/invoices',
  TTN_POLL_INTERVAL = '5000',
  TTN_POLL_RETRIES = '12',
  AUTH_TOKEN = '',
} = process.env;

function requireAuth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const token = req.headers['x-api-key'] || req.headers['authorization']?.slice(7) || '';
  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

async function uploadViaSftp(xmlContent, filename) {
  const client = new SFTPClient();
  try {
    await client.connect({
      host: SFTP_HOST,
      port: parseInt(SFTP_PORT) || 22,
      username: SFTP_USER,
      password: SFTP_PASS,
      readyTimeout: 30000,
    });

    let remotePath = SFTP_PATH;
    if (!remotePath.endsWith('/')) remotePath += '/';
    remotePath += filename;

    const tmpFile = `/tmp/${filename}`;
    fs.writeFileSync(tmpFile, xmlContent, 'utf8');

    await client.put(tmpFile, remotePath);
    fs.unlinkSync(tmpFile);

    return { ok: true, remotePath };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { await client.end(); } catch {}
  }
}

async function pollSftpStatus(invoiceNumber, maxRetries) {
  const client = new SFTPClient();
  try {
    await client.connect({
      host: SFTP_HOST,
      port: parseInt(SFTP_PORT) || 22,
      username: SFTP_USER,
      password: SFTP_PASS,
      readyTimeout: 30000,
    });

    const interval = parseInt(TTN_POLL_INTERVAL) || 5000;
    const retries = maxRetries || parseInt(TTN_POLL_RETRIES) || 12;

    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, interval));

      try {
        const list = await client.list(SFTP_PATH);
        const ackFile = list.find(f =>
          f.name.includes(invoiceNumber) &&
          (f.name.endsWith('.ack') || f.name.endsWith('.xml.response'))
        );
        if (ackFile) {
          const data = await client.get(path.join(SFTP_PATH, ackFile.name));
          return { status: 'accepted', ackFile: ackFile.name, response: data.toString() };
        }

        const rejFile = list.find(f =>
          f.name.includes(invoiceNumber) &&
          (f.name.endsWith('.rej') || f.name.endsWith('.err'))
        );
        if (rejFile) {
          const data = await client.get(path.join(SFTP_PATH, rejFile.name));
          return { status: 'rejected', rejFile: rejFile.name, response: data.toString() };
        }
      } catch {}
    }

    return { status: 'pending', message: `Toujours en attente après ${retries} tentatives` };
  } catch (err) {
    return { status: 'error', error: err.message };
  } finally {
    try { await client.end(); } catch {}
  }
}

app.post('/api/ttn-submit', requireAuth, async (req, res) => {
  try {
    const xmlContent = req.body?.xml || (typeof req.body === 'string' ? req.body : req.body?.signedXml) || '';
    const invoiceNumber = req.body?.documentNumber || req.body?.invoiceNumber || `INV-${Date.now()}`;

    if (!xmlContent) {
      return res.status(400).json({ status: 'error', errors: ['XML requis'] });
    }

    const filename = `${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.xml`;

    const uploadResult = await uploadViaSftp(xmlContent, filename);
    if (!uploadResult.ok) {
      return res.status(502).json({ status: 'rejected', errors: [`SFTP échec: ${uploadResult.error}`] });
    }

    const pollResult = await pollSftpStatus(invoiceNumber, 1);
    if (pollResult.status === 'accepted' || pollResult.status === 'rejected') {
      return res.json({
        status: pollResult.status,
        ttnId: `TTN-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
        message: pollResult.status === 'accepted' ? 'Document accepté par TTN' : 'Document rejeté par TTN',
        ...pollResult,
      });
    }

    res.json({
      status: 'pending',
      message: 'Document déposé sur SFTP TTN — en attente de traitement',
      filename,
      invoiceNumber,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', errors: [err.message] });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ttn-sftp-relay',
    sftpConfigured: !!(SFTP_HOST && SFTP_USER),
  });
});

app.listen(PORT, () => {
  console.log(`TTN SFTP Relay en écoute sur le port ${PORT}`);
  if (!SFTP_HOST || !SFTP_USER) {
    console.warn('⚠️  SFTP non configuré — définissez SFTP_HOST, SFTP_USER, SFTP_PASS');
  }
});