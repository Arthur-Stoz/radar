// Builds tests/fixtures/cv-hospitality.pdf (a real text-layer PDF) from the .txt fixture. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync('tests/fixtures/cv-hospitality.txt', 'utf8')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[—–]/g, '-')
  .replace(/[·]/g, '-')
  .split('\n');
const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '');
let y = 800;
const ops = ['BT', '/F1 10 Tf', '12 TL', `50 ${y} Td`];
for (const l of lines) ops.push(`(${esc(l)}) Tj T*`);
ops.push('ET');
const stream = ops.join('\n');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync('tests/fixtures/cv-hospitality.pdf', pdf);
console.log('tests/fixtures/cv-hospitality.pdf', Buffer.byteLength(pdf), 'bytes');
