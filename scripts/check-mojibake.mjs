#!/usr/bin/env node
/**
 * check-mojibake.mjs
 * Scans source files for common mojibake (character encoding corruption) patterns.
 * Exits with code 1 if mojibake is detected, 0 otherwise.
 * 
 * Note: This script uses more specific patterns to avoid false positives
 * with legitimate Vietnamese text.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// More specific mojibake patterns that indicate UTF-8 was misread as Latin-1
// These are multi-character sequences that are unlikely in normal text
const MOJIBAKE_PATTERNS = [
    /Ã¡(?![a-zA-Z])/g,   // corrupted á (but not part of valid sequence)
    /Ã©(?![a-zA-Z])/g,   // corrupted é
    /Ã­(?![a-zA-Z])/g,   // corrupted í
    /Ã³(?![a-zA-Z])/g,   // corrupted ó
    /Ãº(?![a-zA-Z])/g,   // corrupted ú
    /Ã½(?![a-zA-Z])/g,   // corrupted ý
    /â€™/g,              // corrupted '
    /â€œ/g,              // corrupted "
    /â€/g,               // corrupted —
    /Ã¢â‚¬/g,            // multi-byte corruption pattern
    /Ã¯Â»Â¿/g,           // BOM corruption
    /ï»¿/g,              // UTF-8 BOM read as Latin-1
    /\uFFFD/g,           // replacement character (indicates failed decode)
];

// File extensions to check
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json', '.md'];

// Directories to skip
const SKIP_DIRS = ['node_modules', 'dist', '.git', '.gemini', 'coverage', 'build'];

function walkDir(dir, files = []) {
    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            try {
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    if (!SKIP_DIRS.includes(entry)) {
                        walkDir(fullPath, files);
                    }
                } else if (stat.isFile() && EXTENSIONS.includes(extname(entry).toLowerCase())) {
                    files.push(fullPath);
                }
            } catch {
                // Skip files we can't stat
            }
        }
    } catch {
        // Skip directories we can't read
    }
    return files;
}

function checkFile(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const issues = [];

        for (const pattern of MOJIBAKE_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                issues.push({
                    pattern: pattern.source,
                    count: matches.length
                });
            }
        }

        return issues.length > 0 ? { file: filePath, issues } : null;
    } catch {
        return null;
    }
}

function main() {
    console.log('🔍 Checking for mojibake (encoding issues)...\n');

    const projectRoot = process.cwd();
    const files = walkDir(projectRoot);

    console.log(`   Scanning ${files.length} files...`);

    const problems = [];

    for (const file of files) {
        const result = checkFile(file);
        if (result) {
            problems.push(result);
        }
    }

    if (problems.length === 0) {
        console.log('\n✅ No mojibake detected. All files have correct encoding.\n');
        process.exit(0);
    } else {
        console.log(`\n❌ Mojibake detected in ${problems.length} file(s):\n`);
        for (const problem of problems) {
            console.log(`   📄 ${problem.file}`);
            for (const issue of problem.issues) {
                console.log(`      - Pattern "${issue.pattern}" found ${issue.count} time(s)`);
            }
        }
        console.log('\n   Please fix the encoding issues before building.\n');
        process.exit(1);
    }
}

main();
