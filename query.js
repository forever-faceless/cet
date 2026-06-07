const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'kcet_cs_data.json'), 'utf-8'));

// Get the best GM rank for an entry (checking all GM variants)
function getGM(e) {
  return e.ranks.GM || e.ranks.GMH || e.ranks.GMR || e.ranks.GMK || null;
}

// Get the best 3AG rank for an entry
function get3AG(e) {
  return e.ranks['3AG'] || e.ranks['3AH'] || e.ranks['3AR'] || e.ranks['3AK'] || null;
}

function queryKCET({ rank, year, round, course, limit = 50 }) {
  const matches = data.entries.filter(e => {
    if (year && e.year !== year) return false;
    if (round && e.round !== round) return false;
    if (course && !e.course.toLowerCase().includes(course.toLowerCase())) return false;
    if (e.source === 'comedk_only') return false;

    const gm = getGM(e);
    const cat3a = get3AG(e);

    return (gm && gm >= rank) || (cat3a && cat3a >= rank);
  });

  // Sort by GM rank ascending (best colleges first)
  matches.sort((a, b) => {
    const gmA = getGM(a) || 999999;
    const gmB = getGM(b) || 999999;
    return gmA - gmB;
  });

  return matches.slice(0, limit);
}

function queryCOMEDK({ rank, year, course, limit = 50 }) {
  const matches = data.entries.filter(e => {
    if (!e.comedkRank) return false;
    if (year && e.year !== year) return false;
    if (course && !e.course.toLowerCase().includes(course.toLowerCase())) return false;
    return e.comedkRank >= rank;
  });

  // Deduplicate: one entry per college+course+year (COMEDK is R1 only)
  const seen = new Set();
  const deduped = [];
  for (const e of matches) {
    const key = `${e.year}_${e.college}_${e.course}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  return deduped.sort((a, b) => a.comedkRank - b.comedkRank).slice(0, limit);
}

function printKCET(results) {
  if (!results.length) { console.log('No colleges found.'); return; }

  const grouped = {};
  for (const r of results) {
    const key = `${r.year} ${r.round}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  for (const [yr, entries] of Object.entries(grouped).sort()) {
    console.log(`\n--- ${yr} (${entries.length} colleges) ---`);
    console.log(`  ${'GM'.padStart(7)} ${'3AG'.padStart(7)} ${'COMEDK'.padStart(7)}  ${'Course'.padEnd(40)}  College`);
    console.log(`  ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)}  ${'─'.repeat(40)}  ${'─'.repeat(50)}`);
    for (const e of entries) {
      const gm = getGM(e) || '';
      const cat3a = get3AG(e) || '';
      const ck = e.comedkRank || '';
      console.log(`  ${String(gm).padStart(7)} ${String(cat3a).padStart(7)} ${String(ck).padStart(7)}  ${e.course.padEnd(40)}  ${e.college.substring(0, 50)}`);
    }
  }
}

function printCOMEDK(results) {
  if (!results.length) { console.log('No colleges found.'); return; }

  const grouped = {};
  for (const r of results) {
    const key = `${r.year}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  for (const [yr, entries] of Object.entries(grouped).sort()) {
    console.log(`\n--- ${yr} (${entries.length} colleges) ---`);
    console.log(`  ${'COMEDK'.padStart(7)}  ${'Course'.padEnd(40)}  College`);
    console.log(`  ${'─'.repeat(7)}  ${'─'.repeat(40)}  ${'─'.repeat(50)}`);
    for (const e of entries) {
      console.log(`  ${String(e.comedkRank).padStart(7)}  ${e.course.padEnd(40)}  ${e.college.substring(0, 50)}`);
    }
  }
}

// CLI
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`KCET + COMEDK College Finder

Usage:
  node query.js --kcet <rank> [options]       Find colleges by KCET rank (GM + 3AG)
  node query.js --comedk <rank> [options]     Find colleges by COMEDK rank
  node query.js --kcet <rank> --comedk <rank> Both (KCET results + COMEDK results)

Filters:
  --year <year>        Year (2022-2025)
  --round <R1|R2|R3>   KCET round
  --course <keyword>   Course filter (e.g. "data science", "cyber")
  --top <N>            Show top N results (default: 50)

Info:
  --list-courses       List all courses
  --stats              Dataset stats

Examples:
  node query.js --kcet 15000 --year 2025 --round R3
  node query.js --kcet 15000 --comedk 8000 --year 2025
  node query.js --comedk 5000 --year 2025
  node query.js --kcet 8000 --course "data science"
`);
  process.exit(0);
}

if (args.includes('--list-courses')) {
  [...new Set(data.entries.map(e => e.course))].sort().forEach(c => console.log(`  ${c}`));
  process.exit(0);
}

if (args.includes('--stats')) {
  console.log(`Entries: ${data.metadata.totalEntries} | Colleges: ${data.metadata.uniqueColleges} | Courses: ${data.metadata.uniqueCourses}`);
  console.log(`KCET years: ${data.metadata.years.join(', ')} | COMEDK: ${data.metadata.hasComedk ? 'Yes' : 'No'}`);
  console.log(`Entries with COMEDK: ${data.entries.filter(e => e.comedkRank).length}`);
  process.exit(0);
}

const opts = { limit: 50 };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--kcet' && args[i + 1]) opts.kcetRank = parseInt(args[++i]);
  else if (args[i] === '--comedk' && args[i + 1]) opts.comedkRank = parseInt(args[++i]);
  else if (args[i] === '--year' && args[i + 1]) opts.year = parseInt(args[++i]);
  else if (args[i] === '--round' && args[i + 1]) opts.round = args[++i];
  else if (args[i] === '--course' && args[i + 1]) opts.course = args[++i];
  else if (args[i] === '--top' && args[i + 1]) opts.limit = parseInt(args[++i]);
  else if (/^\d+$/.test(args[i]) && !opts.kcetRank) opts.kcetRank = parseInt(args[i]);
}

if (!opts.kcetRank && !opts.comedkRank) {
  console.error('Provide --kcet <rank> and/or --comedk <rank>');
  process.exit(1);
}

if (opts.kcetRank) {
  const label = [`KCET rank ${opts.kcetRank} (GM + 3AG)`];
  if (opts.year) label.push(`year=${opts.year}`);
  if (opts.round) label.push(`round=${opts.round}`);
  if (opts.course) label.push(`course="${opts.course}"`);
  console.log(`\n=== ${label.join(', ')} — top ${opts.limit} ===`);

  const results = queryKCET({
    rank: opts.kcetRank,
    year: opts.year,
    round: opts.round,
    course: opts.course,
    limit: opts.limit,
  });
  console.log(`Found ${results.length} options`);
  printKCET(results);
}

if (opts.comedkRank) {
  const label = [`COMEDK rank ${opts.comedkRank}`];
  if (opts.year) label.push(`year=${opts.year}`);
  if (opts.course) label.push(`course="${opts.course}"`);
  console.log(`\n=== ${label.join(', ')} — top ${opts.limit} ===`);

  const results = queryCOMEDK({
    rank: opts.comedkRank,
    year: opts.year,
    course: opts.course,
    limit: opts.limit,
  });
  console.log(`Found ${results.length} options`);
  printCOMEDK(results);
}
