const fs = require('fs');

const code = fs.readFileSync('database.js', 'utf8');
const db = (new Function(code + '; return FIQH_DATABASE;'))();

const issuesWithProblems = [];

for (let i = 0; i < db.issues.length; i++) {
  const iss = db.issues[i];
  const problems = [];

  iss.turath_citations.forEach((cit, idx) => {
    const citLabel = `Cit #${idx + 1} (${cit.book_name})`;
    const q = cit.quote ? cit.quote.trim() : '';

    // Check 1: Empty headings
    if (!cit.headings || cit.headings.length === 0 || cit.headings.some(h => !h || h.trim() === '')) {
      problems.push(`${citLabel}: Empty or missing headings`);
    }

    // Check 2: Starts with strange punctuation or broken characters
    if (/^[؟\?،,\.\)\]\}»"':;\s\u064B-\u065F]/.test(q)) {
      problems.push(`${citLabel}: Starts with cut-off punctuation/harakah: "${q.slice(0, 30)}"`);
    }

    // Check 3: Starts in the middle of a sentence (conjunctions dangling without context like "ِ؟ فَقَالَ" or "وَاخْتِيَارِ")
    const brokenStarts = ['وَاخْتِيَارِ', 'مَعَ الثِّقَةِ', 'أَرَى ذَلِكَ', 'إذَا اخْتَلَفَ النَّوْعَانِ', 'الْمُحْصَنَاتِ مِنَ'];
    for (const bs of brokenStarts) {
      if (q.startsWith(bs)) {
        problems.push(`${citLabel}: Starts mid-sentence with fragment: "${q.slice(0, 40)}"`);
      }
    }

    // Check 4: Full page text doesn't contain clean start
    if (!cit.full_page_text || !cit.full_page_text.includes(q)) {
      problems.push(`${citLabel}: Quote does not match full_page_text!`);
    }
  });

  if (problems.length > 0) {
    issuesWithProblems.push({
      issueIndex: i + 1,
      id: iss.id,
      title: iss.title,
      problems: problems
    });
  }
}

console.log(`====================================================`);
console.log(`QUALITY & SCHOLARLY AUDIT RESULTS:`);
console.log(`Total Issues Analyzed: ${db.issues.length}`);
console.log(`Issues with Flaws/Incomplete Sync: ${issuesWithProblems.length}`);
console.log(`====================================================`);

issuesWithProblems.forEach(item => {
  console.log(`\n[#${item.issueIndex}] ${item.id} - ${item.title}`);
  item.problems.forEach(p => console.log(`   ❌ ${p}`));
});

fs.writeFileSync('quality_audit_report.json', JSON.stringify(issuesWithProblems, null, 2), 'utf8');
