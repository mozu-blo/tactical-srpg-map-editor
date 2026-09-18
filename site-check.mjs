import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html','styles.css','app.js','model.js','history.js','storage.js','service-worker.js','manifest.webmanifest',
  'vendor/three.module.js','vendor/three.core.js','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','README.md','JSON_SCHEMA.md','QA_REPORT.md'
];
await Promise.all(required.map((file) => access(file)));
const manifest = JSON.parse(await readFile('manifest.webmanifest','utf8'));
if (manifest.start_url !== './' || manifest.scope !== './' || manifest.display !== 'standalone') throw new Error('ManifestのPages/PWA設定が不正です。');
const html = await readFile('index.html','utf8');
for (const path of ['./styles.css','./manifest.webmanifest','./app.js']) if (!html.includes(path)) throw new Error(`相対Pathがありません: ${path}`);
console.log(`Site check PASS: ${required.length} required files`);
