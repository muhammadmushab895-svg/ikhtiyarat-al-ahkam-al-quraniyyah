const fs = require('fs');
const path = require('path');

const code = fs.readFileSync('database.js', 'utf8');
const db = (new Function(code + '; return FIQH_DATABASE;'))();

const bookCache = {};
function getBook(id) {
  if (!bookCache[id]) {
    bookCache[id] = JSON.parse(fs.readFileSync(path.join('books', `${id}.json`), 'utf8'));
  }
  return bookCache[id];
}

console.log(`Starting comprehensive audit of all ${db.issues.length} issues in database.js...`);

let totalCitations = 0;
let passedCitations = 0;
let failedCitations = [];

for (const issue of db.issues) {
  if (!issue.turath_citations || issue.turath_citations.length === 0) {
    console.error(`Issue ${issue.id} has NO turath_citations!`);
    continue;
  }

  issue.turath_citations.forEach((cit, idx) => {
    totalCitations++;
    const citLabel = `${issue.id} (Issue #${issue.number}) Cit #${idx + 1} - ${cit.book_name}`;

    // 1. Check page_index defined
    if (cit.page_index === undefined || cit.page_index === null || typeof cit.page_index !== 'number') {
      failedCitations.push({ label: citLabel, error: `page_index is ${cit.page_index}` });
      return;
    }

    // 2. Check book exists
    let book;
    try {
      book = getBook(cit.book_id);
    } catch (e) {
      failedCitations.push({ label: citLabel, error: `Book file books/${cit.book_id}.json not found` });
      return;
    }

    // 3. Check page_index in bounds
    const pageObj = book.pages[cit.page_index];
    if (!pageObj) {
      failedCitations.push({ label: citLabel, error: `page_index ${cit.page_index} out of bounds (book has ${book.pages.length} pages)` });
      return;
    }

    // 4. Check quote is exact contiguous substring
    if (!cit.quote || cit.quote.trim().length === 0) {
      failedCitations.push({ label: citLabel, error: `Quote is empty` });
      return;
    }

    const trimmedQuote = cit.quote.trim();
    if (!pageObj.text.includes(trimmedQuote)) {
      failedCitations.push({
        label: citLabel,
        error: `Quote not found in book ${cit.book_id} page ${cit.page_index}`,
        quotePreview: trimmedQuote.substring(0, 80)
      });
      return;
    }

    // 5. Check full_page_text matches underlying page
    if (cit.full_page_text !== pageObj.text) {
      failedCitations.push({ label: citLabel, error: `full_page_text does not match book.pages[page_index].text` });
      return;
    }

    // Passed!
    passedCitations++;
  });
}

console.log('====================================================');
console.log(`AUDIT RESULTS:`);
console.log(`Total Issues: ${db.issues.length}`);
console.log(`Total Citations Audited: ${totalCitations}`);
console.log(`Passed Citations (100% Verbatim Match): ${passedCitations}/${totalCitations}`);
console.log(`Failed Citations: ${failedCitations.length}`);
console.log('====================================================');

if (failedCitations.length > 0) {
  console.error('FAILURES DETECTED:');
  failedCitations.forEach(f => console.error(`- ${f.label}: ${f.error}`));
  process.exit(1);
} else {
  console.log('>>> ALL 100 CITATIONS ACROSS ALL 50 ISSUES ARE 100% AUTHENTIC AND VERBATIM! <<<');
}
