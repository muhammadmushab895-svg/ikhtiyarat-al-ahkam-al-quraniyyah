const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const BOOKS_DIR = path.join(__dirname, 'books');

// In-memory cache for loaded books to ensure instant page serving
const bookCache = {};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function getLocalBook(bookId) {
  if (bookCache[bookId]) return bookCache[bookId];

  const filePath = path.join(BOOKS_DIR, `${bookId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      console.log(`Loading full book [${bookId}] from disk into memory...`);
      const raw = fs.readFileSync(filePath, 'utf8');
      const book = JSON.parse(raw);
      bookCache[bookId] = book;
      return book;
    } catch (e) {
      console.error(`Failed to parse book [${bookId}]:`, e.message);
    }
  }
  return null;
}

function fetchTurath(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Full Unabridged Book Page API
  if (pathname === '/api/turath/page') {
    const book_id = parsedUrl.query.book_id;
    const vol = parsedUrl.query.vol ? parsedUrl.query.vol.toString().trim() : null;
    const pg = parsedUrl.query.pg ? parseInt(parsedUrl.query.pg, 10) : null;
    const idx = parsedUrl.query.idx !== undefined ? parseInt(parsedUrl.query.idx, 10) : null;

    if (!book_id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing book_id' }));
      return;
    }

    // A. Check if the book is downloaded locally in books/
    const localBook = getLocalBook(book_id);
    if (localBook && localBook.pages && localBook.pages.length > 0) {
      let foundIndex = -1;

      // 1. If explicit array index (0-based) is passed
      if (idx !== null && !isNaN(idx) && idx >= 0 && idx < localBook.pages.length) {
        foundIndex = idx;
      }
      // 2. If vol and pg are both passed, match BOTH
      else if (vol && pg !== null && !isNaN(pg)) {
        foundIndex = localBook.pages.findIndex(p => p.vol == vol && parseInt(p.page, 10) === pg);
        if (foundIndex === -1) {
          // Fallback to matching by vol alone if near beginning
          foundIndex = localBook.pages.findIndex(p => p.vol == vol);
        }
      }
      // 3. If only pg is passed, find first matching page number
      else if (pg !== null && !isNaN(pg)) {
        foundIndex = localBook.pages.findIndex(p => parseInt(p.page, 10) === pg);
        // Fallback: treat pg as 1-based sequential index if not found
        if (foundIndex === -1 && pg >= 1 && pg <= localBook.pages.length) {
          foundIndex = pg - 1;
        }
      }

      if (foundIndex !== -1) {
        const foundPage = localBook.pages[foundIndex];
        const responseData = {
          book_id: parseInt(book_id, 10),
          total_pages: localBook.pages.length,
          page_index: foundIndex,
          vol: foundPage.vol || '1',
          page: foundPage.page || (foundIndex + 1),
          text: foundPage.text || '',
          source: 'local_full_unabridged'
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(responseData));
        return;
      }
    }

    // B. If not in local book or page not found, proxy live from Turath API
    try {
      const target = `https://api.turath.io/page?book_id=${encodeURIComponent(book_id)}&pg=${encodeURIComponent(pg || 1)}`;
      const result = await fetchTurath(target);
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(result.body);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to proxy request', message: err.message }));
    }
    return;
  }

  // 2. Book Info API
  if (pathname === '/api/turath/book_info') {
    const book_id = parsedUrl.query.book_id;
    const localBook = getLocalBook(book_id);
    if (localBook && localBook.pages) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        book_id: parseInt(book_id, 10),
        total_pages: localBook.pages.length,
        first_page: localBook.pages[0]?.page || 1,
        last_page: localBook.pages[localBook.pages.length - 1]?.page || localBook.pages.length
      }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Book not found locally' }));
    return;
  }

  // 3. Search API Proxy
  if (pathname === '/api/turath/search') {
    const q = parsedUrl.query.q;
    const page = parsedUrl.query.page || 1;
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing query q' }));
      return;
    }

    try {
      const target = `https://api.turath.io/search?q=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`;
      const result = await fetchTurath(target);
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(result.body);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to proxy request', message: err.message }));
    }
    return;
  }

  // 4. Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('الملف غير موجود (404 Not Found)');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Local Unabridged Books directory: ${BOOKS_DIR}`);
});
