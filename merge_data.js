const fs = require('fs');
const path = require('path');

// Load KCET data
const kcetData = JSON.parse(fs.readFileSync(path.join(__dirname, 'kcet_cs_data.json'), 'utf-8'));
console.log(`KCET: ${kcetData.entries.length} entries`);

// Load COMEDK data
const comedkRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'comedk_cs_cutoffs.json'), 'utf-8'));
console.log(`COMEDK: ${comedkRaw.length} entries`);

// COMEDK college code → KCET college code mapping
// COMEDK uses its own E-codes that may differ from KCET
// We'll match by college name similarity
function normalizeForMatch(name) {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(institute|college|of|engineering|technology|and|the|university)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build KCET college name index
const kcetColleges = {};
for (const e of kcetData.entries) {
  if (e.collegeCode && !kcetColleges[e.collegeCode]) {
    kcetColleges[e.collegeCode] = e.college;
  }
}

// Build COMEDK college index
const comedkColleges = {};
for (const e of comedkRaw) {
  if (!comedkColleges[e.collegeCode]) {
    comedkColleges[e.collegeCode] = e.college;
  }
}

// Note: COMEDK and KCET use DIFFERENT E-code systems!
// We match by normalized name similarity instead
function findKcetMatch(comedkName) {
  const normComedk = normalizeForMatch(comedkName);
  let bestMatch = null;
  let bestScore = 0;

  for (const [code, name] of Object.entries(kcetColleges)) {
    const normKcet = normalizeForMatch(name);

    // Count matching words
    const comedkWords = normComedk.split(' ').filter(w => w.length > 2);
    const kcetWords = normKcet.split(' ').filter(w => w.length > 2);
    const matching = comedkWords.filter(w => kcetWords.includes(w));
    const score = matching.length / Math.max(comedkWords.length, kcetWords.length, 1);

    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = { code, name, score };
    }
  }

  return bestMatch;
}

// Match colleges
console.log('\nMatching COMEDK colleges to KCET...');
const comedkToKcet = {};
const unmatched = [];

for (const [comedkCode, comedkName] of Object.entries(comedkColleges)) {
  const match = findKcetMatch(comedkName);
  if (match) {
    comedkToKcet[comedkCode] = match;
  } else {
    unmatched.push({ code: comedkCode, name: comedkName });
  }
}

const matchedCount = Object.keys(comedkToKcet).length;
console.log(`Matched: ${matchedCount}/${Object.keys(comedkColleges).length}`);
console.log(`Unmatched: ${unmatched.length}`);

// Build merged dataset
// Structure: for each college+course+year+round, we have KCET rank
// For matching college+course+year, we add COMEDK rank (R1 only since that's what we have)
const merged = {
  metadata: {
    ...kcetData.metadata,
    generatedAt: new Date().toISOString(),
    hasComedk: true,
    comedkYears: [2022, 2023, 2024, 2025],
    comedkRounds: ['R1'],
  },
  entries: kcetData.entries.map(e => ({ ...e, comedkRank: null })),
};

// Build COMEDK lookup: collegeCode+year+course → GM rank
const comedkGM = comedkRaw.filter(r => r.seatCategory === 'GM');
const comedkLookup = {};
for (const r of comedkGM) {
  const match = comedkToKcet[r.collegeCode];
  if (!match) continue;

  const key = `${match.code}_${r.year}_${r.course}`;
  if (!comedkLookup[key] || r.rank < comedkLookup[key]) {
    comedkLookup[key] = r.rank;
  }
}

// Attach COMEDK ranks to KCET entries
let matchCount = 0;
for (const entry of merged.entries) {
  if (!entry.collegeCode) continue;
  const key = `${entry.collegeCode}_${entry.year}_${entry.course}`;
  if (comedkLookup[key]) {
    entry.comedkRank = comedkLookup[key];
    matchCount++;
  }
}
console.log(`\nMatched ${matchCount} KCET entries with COMEDK ranks`);

// Also add COMEDK-only entries (colleges/courses not in KCET)
const comedkOnly = [];
for (const r of comedkGM) {
  if (r.rank > 60000) continue;
  const match = comedkToKcet[r.collegeCode];
  const kcetCode = match ? match.code : '';
  const key = `${kcetCode}_${r.year}_${r.course}`;

  // Check if this college+year+course already exists in merged
  const exists = merged.entries.some(e =>
    e.collegeCode === kcetCode && e.year === r.year && e.course === r.course
  );

  if (!exists) {
    comedkOnly.push({
      year: r.year,
      round: 'R1',
      collegeCode: kcetCode || r.collegeCode,
      college: match ? match.name : r.college,
      course: r.course,
      ranks: {},
      comedkRank: r.rank,
      source: 'comedk_only',
    });
  }
}

merged.entries.push(...comedkOnly);
console.log(`Added ${comedkOnly.length} COMEDK-only entries`);

// Update metadata
merged.metadata.totalEntries = merged.entries.length;
merged.metadata.uniqueColleges = [...new Set(merged.entries.map(r => r.college))].length;
merged.metadata.uniqueCourses = [...new Set(merged.entries.map(r => r.course))].length;

// Save
fs.writeFileSync(path.join(__dirname, 'kcet_cs_data.json'), JSON.stringify(merged, null, 2));
console.log(`\nSaved merged data: ${merged.entries.length} entries`);
console.log(`Colleges: ${merged.metadata.uniqueColleges}, Courses: ${merged.metadata.uniqueCourses}`);

// Summary stats
const withComedk = merged.entries.filter(e => e.comedkRank !== null);
console.log(`\nEntries with COMEDK rank: ${withComedk.length}`);

const byYear = {};
for (const e of withComedk) {
  byYear[e.year] = (byYear[e.year] || 0) + 1;
}
console.log('COMEDK matches by year:');
Object.entries(byYear).sort().forEach(([y, c]) => console.log(`  ${y}: ${c}`));

// Sample entries with both ranks
console.log('\nSample entries with both KCET and COMEDK ranks:');
withComedk
  .filter(e => e.ranks.GM && e.comedkRank)
  .sort((a, b) => (a.ranks.GM || 999999) - (b.ranks.GM || 999999))
  .slice(0, 15)
  .forEach(e => {
    console.log(`  KCET: ${String(e.ranks.GM || '').padStart(6)} | COMEDK: ${String(e.comedkRank).padStart(6)} | ${e.year} ${e.round} | ${e.course.padEnd(40)} | ${e.college.substring(0, 45)}`);
  });
