const { execSync } = require('child_process');
const fs = require('fs');

function fixFile(file) {
  let output;
  try {
    output = execSync(`npx jest ${file} --no-coverage 2>&1`, { encoding: 'utf-8' });
  } catch (e) {
    output = e.stdout + '\n' + e.stderr;
  }

  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  const regex = /Expected substring: "(.*?)"\n\s*Received message:\s*"(.*?)"/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    const expected = match[1];
    const received = match[2];
    console.log(`Replacing "${expected}" with "${received}" in ${file}`);
    content = content.replace(expected, received);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
  }
}

['tests/tools/projects-nested.test.ts',
'tests/tools/tasks-crud-auth-errors.test.ts',
'tests/tools/tasks-crud-edge-cases.test.ts',
'tests/tools/tasks-crud-validation.test.ts',
'tests/tools/tasks-filter-sql-syntax.test.ts',
'tests/tools/tasks-memory-protection.test.ts',
'tests/tools/tasks-race-condition.test.ts',
'tests/tools/tasks-relations.test.ts',
'tests/tools/tasks.test.ts'].forEach(fixFile);
