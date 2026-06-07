const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

// ─── Download helper ─────────────────────────────────────────────
function downloadPDF(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 60000
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(filepath); } catch (e) { }
        downloadPDF(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(filepath); });
    }).on('error', (err) => { file.close(); reject(err); });
  });
}

// ─── CS branch detection ─────────────────────────────────────────
const CS_BRANCH_KEYWORDS = [
  'computer science', 'computer sc', 'computers',
  'artificial intelligence', 'artificial intel',
  'data science', 'data sc',
  'machine learning',
  'cyber security', 'cyber sec',
  'information science', 'information sc', 'information tech', 'info.science', 'info science',
  'csbs', 'cs&bs', 'cs & bs', 'cs &bs',
  'cse', 'cs&e',
  'robotics',
  'iot', 'internet of things',
  'block chain', 'blockchain',
  'cloud computing',
  'full stack',
  'computer engineering', 'computer engg',
  'computing',
  'software',
  'aids', 'ai&ds', 'ai & ds', 'ai&ml', 'ai & ml',
  'aiml', 'ai-ml',
  'big data',
  'computer application',
  ' cs ', ' cs-', 'cs (',
];

function isCsBranch(courseName) {
  const lower = ' ' + courseName.toLowerCase() + ' ';
  return CS_BRANCH_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Parse cutoff value ──────────────────────────────────────────
function parseCutoff(val) {
  if (!val || val === '--' || val.trim() === '' || val.trim() === '-') return null;
  const num = parseFloat(val.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

// ─── Group PDF text items into rows ──────────────────────────────
function getPageRows(page) {
  const rows = {};
  for (const text of page.Texts) {
    const y = Math.round(text.y * 10) / 10;
    if (!rows[y]) rows[y] = [];
    rows[y].push({
      x: text.x,
      text: decodeURIComponent(text.R.map(r => r.T).join(''))
    });
  }
  const sortedYs = Object.keys(rows).map(Number).sort((a, b) => a - b);
  return sortedYs.map(y => ({
    y,
    texts: rows[y].sort((a, b) => a.x - b.x).map(i => i.text.trim())
  }));
}

// ─── Detect row types ────────────────────────────────────────────
function isHeaderRow(texts) {
  const joined = texts.join(' ').toUpperCase();
  // New format (2025 R2/R3): "Course Name | 1G | 1K | ..."
  // Old format (2022-2024): "1G | 1K | 1R | 2AG | ..." or "1H | 1KH | ..."
  return (joined.includes('COURSE NAME') && (joined.includes(' GM') || joined.includes(' GMR'))) ||
    (joined.includes(' GM') && joined.includes(' SC') && joined.includes(' ST') && texts.length > 10) ||
    (joined.includes(' GMH') && joined.includes(' SCH') && texts.length > 10);
}

function isCollegeRowNewFormat(texts) {
  const joined = texts.join(' ');
  return joined.toLowerCase().startsWith('college:');
}

function isCollegeRowOldFormat(texts) {
  // Old format: "5 | E005  R. V. College of Engineering  Bangalore"
  // First text is a number, second contains E-code and college name
  if (texts.length >= 1) {
    const joined = texts.join(' ');
    // Match pattern: number followed by E-code (E001, E002, etc.)
    if (/^\d+\s+E\d{3}/.test(joined)) return true;
    if (/^E\d{3}/.test(joined)) return true;
  }
  return false;
}

function isDataRow(texts) {
  let numCount = 0;
  let dashCount = 0;
  for (const t of texts) {
    if (t === '--' || t === '-') dashCount++;
    if (/^\d+(\.\d+)?$/.test(t.replace(/,/g, ''))) numCount++;
  }
  return (numCount + dashCount) >= 5;
}

function isPageFooter(texts) {
  const joined = texts.join(' ');
  return joined.includes('Generated on:') || /Page \d+ of/.test(joined) ||
    joined.includes('ENGINEERING CUTOFF') || /^\d{2}-\w{3}-\d{2}/.test(joined);
}

// ─── Parse PDF (handles both old and new formats) ────────────────
async function processPDF(filepath, year, round) {
  const PDFParser = (await import('pdf2json')).default;

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const results = [];
      let currentCollege = '';
      let currentCollegeCode = '';
      let headers = [];
      let pendingCourseName = '';  // For multi-line course names

      for (const page of pdfData.Pages) {
        const rows = getPageRows(page);

        for (let ri = 0; ri < rows.length; ri++) {
          const { texts } = rows[ri];
          const joined = texts.join(' ').trim();

          // Skip empty or footer rows
          if (!joined || isPageFooter(texts)) continue;

          // ── New format college (2025): "College: ..."
          if (isCollegeRowNewFormat(texts)) {
            currentCollege = joined.replace(/^College:\s*/i, '').trim();
            currentCollegeCode = '';
            // Extract code if present (e.g., "E001 ...")
            const codeMatch = currentCollege.match(/^(E\d{3})\s+/);
            if (codeMatch) {
              currentCollegeCode = codeMatch[1];
            }
            pendingCourseName = '';
            continue;
          }

          // ── Old format college (2022-2024): "5 E005 R. V. College..."
          if (isCollegeRowOldFormat(texts)) {
            // Extract college name: remove leading number and E-code
            const match = joined.match(/^\d*\s*(E\d{3})\s+(.+)$/);
            if (match) {
              currentCollegeCode = match[1];
              currentCollege = `${match[1]} ${match[2].trim()}`;
            } else {
              currentCollege = joined;
              currentCollegeCode = '';
            }
            pendingCourseName = '';
            continue;
          }

          // ── Header row
          if (isHeaderRow(texts)) {
            headers = texts.map(h => h.trim());
            // If first header is "Course Name", keep as-is
            // If it doesn't start with "Course Name", the course name comes before ranks on data rows
            pendingCourseName = '';
            continue;
          }

          // ── Data row (has ranks)
          if (isDataRow(texts) && headers.length > 0 && currentCollege) {
            let courseName = '';
            let rankValues = [];

            // Determine format: new format has "Course Name" as first header
            const hasNameHeader = headers[0] && headers[0].toLowerCase().includes('course name');

            if (hasNameHeader) {
              // New format: first text is course name, rest are rank values
              courseName = texts[0] || '';
              rankValues = texts.slice(1);
            } else {
              // Old format: first text is course code+name like " CS Computers"
              // or it could be just rank values if course name is from previous row
              const firstText = texts[0] || '';
              // Check if first text looks like a course code/name (starts with letters)
              if (/^\s*[A-Za-z]/.test(firstText) && !/^\d/.test(firstText.trim())) {
                courseName = firstText.trim();
                rankValues = texts.slice(1);
              } else {
                // All values are ranks, use pending course name
                courseName = pendingCourseName;
                rankValues = texts;
              }
            }

            // Add pending multi-line course name
            if (pendingCourseName && courseName !== pendingCourseName) {
              courseName = pendingCourseName + ' ' + courseName;
            }

            const record = {
              year: parseInt(year),
              round,
              college: currentCollege,
              collegeCode: currentCollegeCode,
              course: courseName.trim(),
              ranks: {}
            };

            // Map rank values to headers
            const startIdx = hasNameHeader ? 1 : 0;
            for (let i = 0; i < rankValues.length && (i + startIdx) < headers.length; i++) {
              const category = headers[i + startIdx];
              const rank = parseCutoff(rankValues[i]);
              if (rank !== null && category) {
                record.ranks[category] = rank;
              }
            }

            if (Object.keys(record.ranks).length > 0) {
              results.push(record);
            }
            pendingCourseName = '';
            continue;
          }

          // ── Non-data, non-header, non-college row: could be continuation of course name
          if (!isDataRow(texts) && !isHeaderRow(texts) && currentCollege) {
            const cleanText = joined.trim();
            if (cleanText && cleanText.length < 100) {
              // This might be a course name line (old format puts course name before its data)
              // Or continuation of a split course name
              if (results.length > 0 && results[results.length - 1].college === currentCollege) {
                // Check if the last result has an incomplete course name
                const lastResult = results[results.length - 1];
                // Continuation of course name from previous data line
                lastResult.course = (lastResult.course + ' ' + cleanText).trim();
              } else {
                // This is likely a standalone course name line for the next data row
                pendingCourseName = cleanText;
              }
            }
          }
        }
      }

      resolve(results);
    });

    pdfParser.on('pdfParser_dataError', (err) => reject(err));
    pdfParser.loadPDF(filepath);
  });
}

// ─── Normalize category names across years ───────────────────────
// 2024 R1 uses HK categories: GMH, 1H, 2AH, etc.
// Other rounds use: GM, 1G, 2AG, etc.
// We normalize all to standard categories
function normalizeRanks(ranks) {
  const normalized = {};
  for (const [cat, rank] of Object.entries(ranks)) {
    let normCat = cat;
    // Map HK categories to standard
    if (cat.endsWith('H') && !cat.endsWith('KH') && !cat.endsWith('RH')) {
      // e.g., GMH -> GM, SCH -> SCG, STH -> STG, 1H -> 1G, 2AH -> 2AG, etc.
      normCat = cat.slice(0, -1);
      if (['GM', 'SC', 'ST'].includes(normCat)) normCat += (normCat === 'GM' ? '' : 'G');
      else normCat += 'G';
    }
    normalized[normCat] = rank;
  }
  return normalized;
}

// ─── Filter for CS branches with rank < 60000 ────────────────────
function filterCSBranches(records, maxRank = 60000) {
  return records.filter(r => {
    if (!isCsBranch(r.course)) return false;

    // Check if any General Merit rank is < maxRank
    const gmCats = ['GM', 'GMR', 'GMK', 'GMH', 'GMKH', 'GMRH'];
    for (const cat of gmCats) {
      if (r.ranks[cat] && r.ranks[cat] <= maxRank) return true;
    }

    // If no GM category, check if majority of ranks are < maxRank
    const values = Object.values(r.ranks);
    if (values.length > 0) {
      const belowMax = values.filter(v => v <= maxRank);
      return belowMax.length > 0;
    }

    return false;
  });
}

// ─── Clean course names ──────────────────────────────────────────
function cleanCourseName(name) {
  return name
    // Remove stray numbers that got mixed in from PDF parsing
    .replace(/\s+\d+\s+/g, ' ')
    .replace(/\s+\d+$/g, '')
    // Clean up spacing
    .replace(/\s+/g, ' ')
    // Fix common split-word artifacts
    .replace(/(\w)\s*\n\s*(\w)/g, '$1 $2')
    .trim();
}

// ─── MAIN ────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.join(__dirname, 'Untitled spreadsheet - Sheet1.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n').map(l => l.trim().replace(/\r$/, ''));

  const pdfDir = path.join(__dirname, 'pdfs');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const allRecords = [];
  const csRecords = [];

  console.log('CSV Header:', lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const year = parts[0];
    const urls = [parts[1], parts[2], parts[3]];
    const rounds = ['R1', 'R2', 'R3'];

    for (let j = 0; j < urls.length; j++) {
      const url = urls[j];
      const round = rounds[j];
      const filename = `${year}_${round}.pdf`;
      const filepath = path.join(pdfDir, filename);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing: ${year} ${round}`);
      console.log(`URL: ${url}`);

      // Download if not cached
      if (!fs.existsSync(filepath)) {
        try {
          console.log('Downloading...');
          await downloadPDF(url, filepath);
          console.log('Downloaded:', filepath);
        } catch (err) {
          console.error(`FAILED to download ${year} ${round}: ${err.message}`);
          continue;
        }
      } else {
        console.log('Using cached:', filepath);
      }

      // Parse
      try {
        console.log('Parsing PDF...');
        const records = await processPDF(filepath, year, round);
        console.log(`Found ${records.length} total course entries`);

        const cs = filterCSBranches(records);
        console.log(`Found ${cs.length} CS/CS-subsidiary entries with rank <= 60000`);

        // Clean course names
        for (const r of cs) {
          r.course = cleanCourseName(r.course);
        }

        allRecords.push(...records);
        csRecords.push(...cs);

        if (cs.length > 0) {
          console.log('\nSample CS entries:');
          cs.slice(0, 5).forEach(r => {
            const gm = r.ranks['GM'] || r.ranks['GMH'] || r.ranks['GMR'] || 'N/A';
            console.log(`  ${r.college.substring(0, 60)} | ${r.course} | GM: ${gm}`);
          });
        }
      } catch (err) {
        console.error(`FAILED to parse ${year} ${round}: ${err.message}`);
        console.error(err.stack);
      }
    }
  }

  // ─── Save outputs ──────────────────────────────────────────────

  // Save all records
  fs.writeFileSync(path.join(__dirname, 'all_cutoffs.json'), JSON.stringify(allRecords, null, 2));
  console.log(`\n\nSaved ${allRecords.length} total records to all_cutoffs.json`);

  // Save CS records
  fs.writeFileSync(path.join(__dirname, 'cs_cutoffs.json'), JSON.stringify(csRecords, null, 2));
  console.log(`Saved ${csRecords.length} CS/subsidiary records to cs_cutoffs.json`);

  // Create a normalized data structure for website querying
  // Structure: { colleges: { collegeName: { years: { 2025: { R1: { courseName: { GM: rank, ... } } } } } } }
  const queryData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      years: [...new Set(csRecords.map(r => r.year))].sort(),
      rounds: ['R1', 'R2', 'R3'],
      totalEntries: csRecords.length,
      maxRank: 60000
    },
    entries: csRecords.map(r => ({
      year: r.year,
      round: r.round,
      college: r.college,
      collegeCode: r.collegeCode,
      course: r.course,
      ranks: r.ranks
    }))
  };

  fs.writeFileSync(path.join(__dirname, 'kcet_cs_data.json'), JSON.stringify(queryData, null, 2));
  console.log('Saved queryable data to kcet_cs_data.json');

  // Summary CSV
  const csvOut = ['Year,Round,College Code,College,Course,GM,1G,2AG,2BG,3AG,3BG,SCG,STG,GMH,1H,2AH,2BH,3AH,3BH,SCH,STH'];
  for (const r of csRecords) {
    const row = [
      r.year, r.round,
      r.collegeCode || '',
      `"${r.college.replace(/"/g, '""')}"`,
      `"${r.course.replace(/"/g, '""')}"`,
      r.ranks['GM'] || '', r.ranks['1G'] || '', r.ranks['2AG'] || '',
      r.ranks['2BG'] || '', r.ranks['3AG'] || '', r.ranks['3BG'] || '',
      r.ranks['SCG'] || '', r.ranks['STG'] || '',
      r.ranks['GMH'] || '', r.ranks['1H'] || '', r.ranks['2AH'] || '',
      r.ranks['2BH'] || '', r.ranks['3AH'] || '', r.ranks['3BH'] || '',
      r.ranks['SCH'] || '', r.ranks['STH'] || '',
    ];
    csvOut.push(row.join(','));
  }
  fs.writeFileSync(path.join(__dirname, 'cs_cutoffs.csv'), csvOut.join('\n'));
  console.log('Saved CS cutoffs CSV to cs_cutoffs.csv');

  // ─── Summary ───────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);

  const yearRoundCounts = {};
  for (const r of csRecords) {
    const key = `${r.year} ${r.round}`;
    yearRoundCounts[key] = (yearRoundCounts[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(yearRoundCounts).sort()) {
    console.log(`  ${key}: ${count} CS entries`);
  }

  const uniqueColleges = [...new Set(csRecords.map(r => r.college))];
  console.log(`\nUnique colleges with CS branches (rank <= 60000): ${uniqueColleges.length}`);

  const uniqueCourses = [...new Set(csRecords.map(r => r.course))];
  console.log(`Unique CS/subsidiary courses: ${uniqueCourses.length}`);
  uniqueCourses.sort().forEach(c => console.log(`  - ${c}`));
}

main().catch(console.error);
