import fs from 'node:fs/promises';
// A project-scoped GitHub Pages copy; the desktop build keeps using dist/.
await fs.mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await fs.cp(new URL('../dist/',import.meta.url),new URL('../docs/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../docs/.nojekyll',import.meta.url),'');
console.log('Prepared docs/ for the separate GitHub Pages project.');
