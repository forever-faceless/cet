# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KCET (Karnataka Common Entrance Test) cutoff data aggregator. Parses engineering cutoff PDFs from cetonline.karnataka.gov.in (and third-party mirrors for 2025) for the past 5 years (2021-2025), filters for CS and CS-subsidiary branches with closing rank <= 60,000, and produces queryable JSON/CSV data. A website frontend will be built on top of this data.

## Commands

```bash
# Full pipeline: download PDFs + parse into raw JSON/CSV
node parse_cutoffs.js

# Clean and normalize parsed data (run after parse_cutoffs.js)
node cleanup_data.js

# Debug PDF structure for a specific file
node debug_pdf.js
node explore_pdf.js
```

## Architecture

### Data Pipeline

1. **`Untitled spreadsheet - Sheet1.csv`** — Source of truth for PDF URLs. Columns: `year, round 1, round 2, round 3`. Four years of data (2022-2025), three rounds each.

2. **`parse_cutoffs.js`** — Downloads PDFs (cached in `pdfs/`) and parses them using `pdf2json`. Handles two distinct PDF formats:
   - **Old format (2022-2024)**: Row starts with serial number + college E-code (e.g., `5 E005 R. V. College...`), course name on its own row before rank data
   - **New format (2025)**: Rows prefixed with `College:`, then `Course Name` column in header with ranks inline
   - 2024 R1 specifically uses HK (Hyderabad-Karnataka) category headers (GMH, 1H, 2AH, etc.) instead of general (GM, 1G, 2AG)

3. **`cleanup_data.js`** — Post-processing: normalizes course names (fixes PDF word-break artifacts like `ARTIFICIA L`), maps abbreviated codes (e.g., `CS Computers` → `Computer Science and Engineering`), deduplicates, and outputs final clean data.

### Output Files

- **`kcet_cs_data.json`** — Primary queryable data: `{ metadata, entries[] }` where each entry has `year, round, collegeCode, college, course, ranks{}`
- **`cs_cutoffs.json`** — Raw filtered CS entries (before cleanup)
- **`cs_cutoffs.csv`** / **`cs_cutoffs_clean.csv`** — Flat CSV exports
- **`all_cutoffs.json`** — All branches (not just CS), unfiltered

### Key Design Decisions

- PDFs are cached in `pdfs/` — delete a file to force re-download
- CS branch detection uses keyword matching in `CS_BRANCH_KEYWORDS` array (covers AI, Data Science, Cyber Security, IoT, Robotics, CSBS, etc.)
- Rank filtering checks GM (General Merit) category first, falls back to checking any category < 60,000
- College codes follow KEA format: `E001`-`E999`
- Rank categories vary by year/round: general (GM, 1G, 2AG, 2BG, 3AG, 3BG, SCG, STG) and HK variants (GMH, 1H, etc.)

### Dependencies

- `pdf2json` — Primary PDF parser (converts to positional text items grouped by page)
- `pdf-parse` / `csv-parse` — Secondary parsing utilities
