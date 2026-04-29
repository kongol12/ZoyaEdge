const fs = require('fs');
const content = fs.readFileSync('apps/web/src/pages/admin/EAManagement.tsx', 'utf-8');
const startIndex = content.indexOf('export const DEFAULT_PACK_FILES = {');
let openBrackets = 0;
let endIndex = -1;
let started = false;

for (let i = startIndex; i < content.length; i++) {
  if (content[i] === '{') {
    openBrackets++;
    started = true;
  } else if (content[i] === '}') {
    openBrackets--;
  }
  
  if (started && openBrackets === 0) {
    endIndex = i;
    break;
  }
}

const objContent = content.substring(startIndex, endIndex + 1);
const newFile = `export const DEFAULT_PACK_FILES = ${objContent.substring(objContent.indexOf('{'))};\n`;
if (!fs.existsSync('apps/web/src/shared/constants')) {  fs.mkdirSync('apps/web/src/shared/constants', { recursive: true }); }
fs.writeFileSync('apps/web/src/shared/constants/packFiles.ts', newFile);

console.log("Done");
