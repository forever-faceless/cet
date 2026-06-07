const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'kcet_cs_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
console.log(`Loaded ${data.entries.length} entries`);

// Every raw course name → canonical. Built from actual extracted variants.
const VARIANT_TO_CANONICAL = {
  // Computer Science and Engineering
  'cs computers': 'Computer Science and Engineering',
  'computer science and engineering': 'Computer Science and Engineering',
  'b tech in computer science and engineering': 'Computer Science and Engineering',
  'bw b tech in cs': 'Computer Science and Engineering',

  // Computer Science and Engineering (Management)
  'cs computers mgmt.': 'Computer Science and Engineering (Management)',

  // Information Science and Engineering
  'ie info.science': 'Information Science and Engineering',
  'information science and engineering': 'Information Science and Engineering',
  'information science and 5 engineering': 'Information Science and Engineering',
  'b tech in information science engineering': 'Information Science and Engineering',

  // Information Science and Engineering (Automation)
  'ie info.science automation': 'Information Science and Engineering (Automation)',

  // Information Technology
  'ig information technology': 'Information Technology',
  'b tech in information technology': 'Information Technology',

  // Information Science and Technology
  'is information sc. and tech.': 'Information Science and Technology',
  'b tech in information science & technology': 'Information Science and Technology',

  // AI and ML
  'ai artificial intelligence': 'Artificial Intelligence and Machine Learning',
  'artificial intelligence and machine learning': 'Artificial Intelligence and Machine Learning',
  'artificial intelligence and machine learning engineering': 'Artificial Intelligence and Machine Learning',
  'artificial intelligence 5 and machine learning': 'Artificial Intelligence and Machine Learning',
  'b tech in artificial intelligence and machine learning': 'Artificial Intelligence and Machine Learning',

  // AI and Data Science
  'ad artificial intel, data sc': 'Artificial Intelligence and Data Science',
  'artificial intelligence and data science': 'Artificial Intelligence and Data Science',
  'intel, data sc ca cs (ai, machine learning)': 'Artificial Intelligence and Data Science',
  'b tech in artificial intelligence and data science': 'Artificial Intelligence and Data Science',

  // CS (AI and Machine Learning)
  'ca cs (ai, machine learning)': 'Computer Science (AI and Machine Learning)',
  'b tech in computer science(ai &ml)': 'Computer Science (AI and Machine Learning)',
  'b tech in computer science & engineering (artifical intelligence & machine learning)': 'Computer Science (AI and Machine Learning)',
  'b tech in computer science & engg (artificial intelligence and future technologies)': 'Computer Science (AI and Machine Learning)',
  'b tech in computer science & engg (artificial intelligence and future technologies )': 'Computer Science (AI and Machine Learning)',

  // CS (Artificial Intelligence)
  'cf cs(artificial intel.)': 'Computer Science (Artificial Intelligence)',
  'computer science and engg (artificial intelligence)': 'Computer Science (Artificial Intelligence)',

  // CS and Design
  'cd computer sc. and design': 'Computer Science and Design',
  'computer science and design': 'Computer Science and Design',
  'bw b tech in cs and design': 'Computer Science and Design',
  'btech in computer science and design': 'Computer Science and Design',

  // CS and Technology
  'cg computer science and tech': 'Computer Science and Technology',
  'b tech in computer science and technology': 'Computer Science and Technology',

  // Computer Engineering
  'co computer engineering': 'Computer Engineering',
  'computer engineering': 'Computer Engineering',
  'b tech in computer engineering': 'Computer Engineering',

  // CS - Cyber Security
  'cy cs- cyber security': 'Computer Science - Cyber Security',
  'computer science and engineering (cyber security)': 'Computer Science - Cyber Security',
  'b tech in computer science and engineering(c yber security)': 'Computer Science - Cyber Security',
  'b tech in computer science and engineering(cyb er security)': 'Computer Science - Cyber Security',

  // CS - Data Science
  'ds comp. sc. engg- data sc.': 'Computer Science and Engineering - Data Science',
  'computer science and engineering(d ata science)': 'Computer Science and Engineering - Data Science',
  'computer science and engineering(dat a science)': 'Computer Science and Engineering - Data Science',
  'b tech in computer science and engineering(d ata science)': 'Computer Science and Engineering - Data Science',
  'b tech in computer science and engineering(dat a science)': 'Computer Science and Engineering - Data Science',
  'b tech (hons) computer science and engineering(dat a science)': 'Computer Science and Engineering - Data Science',

  // CS - Big Data
  'bd cs- big data': 'Computer Science - Big Data',
  'b tech in computer science and technology(big data)': 'Computer Science - Big Data',
  'b tech in computer science and technology(b ig data)': 'Computer Science - Big Data',

  // CS - Internet of Things
  'io cs- internet of things': 'Computer Science - Internet of Things',
  'b.tech in computer science (internet of things)': 'Computer Science - Internet of Things',
  'b tech in computer science and engineering(iot)': 'Computer Science - Internet of Things',
  'b tech in computer science and engineering(i ot)': 'Computer Science - Internet of Things',

  // CS - IoT and Blockchain
  'ib cs-iot block chain': 'Computer Science - IoT and Blockchain',
  'computer science and engg(interne t of things & cyber security including block chain tech)': 'Computer Science - IoT and Blockchain',
  'computer science and engg(internet of things & cyber security including block chain tech)': 'Computer Science - IoT and Blockchain',
  'b tech in computer science and engineering(iot including block chain)': 'Computer Science - IoT and Blockchain',
  'b tech in computer science and engineering(i ot including block chain)': 'Computer Science - IoT and Blockchain',

  // CS - Blockchain
  'lc cs- block chain': 'Computer Science - Blockchain',
  'b tech in computer science and engineering(b lock chain)': 'Computer Science - Blockchain',
  'b tech in computer science and engineering(blo ck chain)': 'Computer Science - Blockchain',

  // CS - IoT and Cyber Security
  'ic cs-iot, cyber security': 'Computer Science - IoT and Cyber Security',

  // CS and Business Systems
  'computer science and business systems': 'Computer Science and Business Systems',
  'bw b tech in cs bus sys.': 'Computer Science and Business Systems',

  // CS and Systems Engineering
  'ss cs and system engg': 'Computer Science and Systems Engineering',

  // CS and Artificial Intelligence
  'b.tech in computer science and artificial intelligence': 'Computer Science and Artificial Intelligence',

  // CS (Networks)
  'dm b.tech in cs nw': 'Computer Science (Networks)',

  // CS and Information Technology
  'b tech in computer science and information technology': 'Computer Science and Information Technology',

  // CS and Engineering (AI and ML)
  'computer science and engg(artificia l intelligence and machine learning)': 'Computer Science and Engineering (AI and ML)',
  'computer science and engg(artificial intelligence and machine learning)': 'Computer Science and Engineering (AI and ML)',
  'computer science and 5 engg(artificia l intelligence and machine learning)': 'Computer Science and Engineering (AI and ML)',
  'engineering computer science and engg(artificia l intelligence and machine learning)': 'Computer Science and Engineering (AI and ML)',

  // CS and Engineering (AI and Data Science)
  'computer science and engineering(a rtifical intelligence & data science)': 'Computer Science and Engineering (AI and Data Science)',
  'computer science and engineering(arti fical intelligence & data science)': 'Computer Science and Engineering (AI and Data Science)',
  'b tech in computer science and engineering(a rtificial intelligence and data science)': 'Computer Science and Engineering (AI and Data Science)',
  'b tech in computer science and engineering(arti ficial intelligence and data science)': 'Computer Science and Engineering (AI and Data Science)',

  // CS and Technology (DevOps)
  'b tech in computer science and technology(dev ops)': 'Computer Science and Technology (DevOps)',
  'b tech in computer science and technology(d ev ops)': 'Computer Science and Technology (DevOps)',

  // CS and Medical Engineering
  'b.tech in computer science and medical engineering': 'Computer Science and Medical Engineering',

  // CS and Engineering (Robotics)
  'b.tech in computer science and engg (robotics)': 'Computer Science and Engineering (Robotics)',

  // Computer Engineering (Software)
  'b.tech in computer engineering(sof tware product development)': 'Computer Engineering (Software Product Development)',

  // Electrical Engineering and CS
  'b.tech in electrical engineering and computer science': 'Electrical Engineering and Computer Science',

  // Mathematics and Computing
  'mc mathematics and computing': 'Mathematics and Computing',
  'b tech in mathamatics and computing': 'Mathematics and Computing',

  // Robotics and AI
  'ri robotics and ai': 'Robotics and Artificial Intelligence',
  'robotics and artificial intelligence': 'Robotics and Artificial Intelligence',
  'b tech in robotics and artificial intelligence': 'Robotics and Artificial Intelligence',

  // Robotics and Automation
  'ra robotics and automation': 'Robotics and Automation',
  'robotics and automation': 'Robotics and Automation',
  'automation and robotics': 'Robotics and Automation',

  // Robotics
  'rb robotics': 'Robotics',
  'b tech in robotics engineering': 'Robotics',

  // Electronics and Computer Engineering
  'electronics & computer engineering': 'Electronics and Computer Engineering',
  'b tech in electronics & computer engineering': 'Electronics and Computer Engineering',

  // IT (AR/VR)
  'btech in information technology augmented reality and virutal reality(ar/vr)': 'Information Technology (AR/VR)',

  // IT (Data Analytics)
  'btech in information technology data analytics': 'Information Technology (Data Analytics)',

  // CS for Differently Abled
  'computer science and engineering science and technology(e xclusively for differently abled)': 'CS for Differently Abled',
  'computer science and engineering science and technology(exc lusively for differently abled)': 'CS for Differently Abled',

  // Biotechnology
  'b.tech in biotechnology & bio- engineering': 'Biotechnology and Bio-Engineering',
  'b.tech in biotechnolog y & bio- engineering': 'Biotechnology and Bio-Engineering',
};

function cleanCourseName(name) {
  const lower = name.toLowerCase().trim();
  if (VARIANT_TO_CANONICAL[lower]) return VARIANT_TO_CANONICAL[lower];

  // Fallback: warn about unmapped course
  console.warn(`  UNMAPPED COURSE: "${name}"`);
  return name.trim();
}

function cleanCollegeName(name) {
  return name
    .replace(/^\(E\d{3}\)\s*/, '')
    .replace(/^E\d{3}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCollegeCode(name) {
  const match = name.match(/(?:^\(?(E\d{3})\)?|^(E\d{3}))\s/);
  return match ? (match[1] || match[2]) : '';
}

// Strip ranks to only GM and 3AG (plus HK/region variants)
const KEEP_CATS = ['GM', 'GMH', 'GMK', 'GMKH', 'GMR', 'GMRH', '3AG', '3AH', '3AK', '3AKH', '3AR', '3ARH'];
function stripRanks(ranks) {
  const stripped = {};
  for (const cat of KEEP_CATS) {
    if (ranks[cat] != null) stripped[cat] = ranks[cat];
  }
  return stripped;
}

// Process
const processed = [];
for (const entry of data.entries) {
  const collegeCode = entry.collegeCode || extractCollegeCode(entry.college);
  processed.push({
    year: entry.year,
    round: entry.round,
    collegeCode,
    college: cleanCollegeName(entry.college),
    course: cleanCourseName(entry.course),
    ranks: stripRanks(entry.ranks)
  });
}

// Deduplicate
const seen = new Set();
const deduped = [];
for (const entry of processed) {
  const key = `${entry.year}-${entry.round}-${entry.collegeCode || entry.college}-${entry.course}`;
  if (!seen.has(key)) {
    seen.add(key);
    deduped.push(entry);
  }
}

console.log(`After cleanup: ${deduped.length} entries (removed ${processed.length - deduped.length} duplicates)`);

// Build final output
const finalData = {
  metadata: {
    generatedAt: new Date().toISOString(),
    years: [...new Set(deduped.map(r => r.year))].sort(),
    rounds: ['R1', 'R2', 'R3'],
    totalEntries: deduped.length,
    uniqueColleges: [...new Set(deduped.map(r => r.college))].length,
    uniqueCourses: [...new Set(deduped.map(r => r.course))].length,
    maxRankFilter: 60000,
  },
  entries: deduped
};

fs.writeFileSync(path.join(__dirname, 'kcet_cs_data.json'), JSON.stringify(finalData, null, 2));
console.log('Saved cleaned data to kcet_cs_data.json');

// CSV export
const allCategories = new Set();
for (const entry of deduped) Object.keys(entry.ranks).forEach(k => allCategories.add(k));
const sortedCategories = [...allCategories].sort();
const csvHeader = ['Year', 'Round', 'College Code', 'College', 'Course', ...sortedCategories];
const csvRows = [csvHeader.join(',')];
for (const entry of deduped) {
  const row = [
    entry.year, entry.round, entry.collegeCode || '',
    `"${entry.college.replace(/"/g, '""')}"`,
    `"${entry.course.replace(/"/g, '""')}"`,
    ...sortedCategories.map(cat => entry.ranks[cat] || '')
  ];
  csvRows.push(row.join(','));
}
fs.writeFileSync(path.join(__dirname, 'cs_cutoffs_clean.csv'), csvRows.join('\n'));
console.log('Saved cleaned CSV to cs_cutoffs_clean.csv');

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log('FINAL SUMMARY');
console.log(`${'='.repeat(60)}`);
const yearRoundCounts = {};
for (const r of deduped) {
  const key = `${r.year} ${r.round}`;
  yearRoundCounts[key] = (yearRoundCounts[key] || 0) + 1;
}
for (const [key, count] of Object.entries(yearRoundCounts).sort()) {
  console.log(`  ${key}: ${count} entries`);
}
console.log(`\nTotal: ${deduped.length} | Colleges: ${finalData.metadata.uniqueColleges} | Courses: ${finalData.metadata.uniqueCourses}`);

const uniqueCourses = [...new Set(deduped.map(r => r.course))].sort();
console.log('\nCourse list:');
uniqueCourses.forEach(c => console.log(`  - ${c}`));
