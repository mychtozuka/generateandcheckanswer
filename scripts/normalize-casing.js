#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

console.log('Collecting tracked files...');
const raw = run('git ls-files -z');
if (!raw) {
  console.log('No tracked files found.');
  process.exit(0);
}

const files = raw.split('\0').filter(Boolean);
const lowerSet = new Set(files.map(f => f.toLowerCase()));

const moves = [];

for (const f of files) {
  // skip .git, node_modules, .next and dotfiles
  if (f.startsWith('.git') || f.startsWith('node_modules') || f.startsWith('.next')) continue;
  if (f.split(path.sep).some(part => part.startsWith('.'))) continue;

  const lower = f.toLowerCase();
  if (f === lower) continue;

  if (lowerSet.has(lower) && lower !== f) {
    console.warn(`Skipping '${f}' because target '${lower}' already exists in repository.`);
    continue;
  }

  const tmp = f + '.casefix.tmp';
  try {
    console.log(`Renaming '${f}' -> '${lower}'`);
    execSync(`git mv -k -- "${f}" "${tmp}"`);
    execSync(`git mv -k -- "${tmp}" "${lower}"`);
    moves.push({ from: f, to: lower });
    // update sets so subsequent checks are accurate
    lowerSet.add(lower);
  } catch (err) {
    console.error(`Failed to rename '${f}':`, err.message || err);
  }
}

if (moves.length === 0) {
  console.log('No files required renaming.');
  process.exit(0);
}

console.log(`Renamed ${moves.length} files.`);
process.exit(0);
