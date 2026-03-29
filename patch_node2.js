import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  'useEffect(() => {\n    if (!userName) {',
  'useEffect(() => {\n    isAutostartEnabled().then(setAutostart).catch(console.error);\n    if (!userName) {'
);

fs.writeFileSync('src/App.tsx', code);
