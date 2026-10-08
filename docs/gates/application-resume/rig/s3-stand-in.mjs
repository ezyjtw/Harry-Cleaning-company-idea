/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
// Rig-only S3 stand-in: path-style PUT/GET/HEAD/DELETE on a directory, so the
// bench can observe objects being written and deleted. No auth (rig only).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 9100);
function decodeAwsChunked(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf('\r\n', i);
    if (nl < 0) break;
    const size = parseInt(buf.slice(i, nl).toString().split(';')[0], 16);
    if (!size) break;
    out.push(buf.slice(nl + 2, nl + 2 + size));
    i = nl + 2 + size + 2;
  }
  return Buffer.concat(out);
}
createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = join(ROOT, key);
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let body = Buffer.concat(chunks);
    if (req.method === 'PUT') {
      if (
        String(req.headers['content-encoding'] || '').includes('aws-chunked') ||
        req.headers['x-amz-decoded-content-length']
      )
        body = decodeAwsChunked(body);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, body);
      console.log('PUT', key, body.length);
      res.writeHead(200, { ETag: '"rig"' });
      return res.end();
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'application/xml' });
        return res.end('<Error><Code>NoSuchKey</Code></Error>');
      }
      const b = readFileSync(file);
      res.writeHead(200, {
        'Content-Length': b.length,
        ETag: '"rig"',
        'Content-Type': 'application/octet-stream',
      });
      return res.end(req.method === 'GET' ? b : undefined);
    }
    if (req.method === 'DELETE') {
      rmSync(file, { force: true });
      console.log('DELETE', key);
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(405);
    res.end();
  });
}).listen(PORT, '127.0.0.1', () => console.log('s3 stand-in on', PORT));
