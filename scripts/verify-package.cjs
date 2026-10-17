const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pnpm=path.join(root,'node_modules/.pnpm');
const asar=require(path.join(pnpm,fs.readdirSync(pnpm).find(n=>n.startsWith('@electron+asar@')),'node_modules/@electron/asar'));
const archive=path.join(root,'release/win-unpacked/resources/app.asar'),checks=[];
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);}
for(const file of ['main.cjs','preload.cjs',...walk('dist')]){const source=fs.readFileSync(path.join(root,file)),packed=asar.extractFile(archive,path.normalize(file));assert.ok(source.equals(packed),file);checks.push({file,bytes:source.length,sha256:crypto.createHash('sha256').update(source).digest('hex')});}
const p=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(p.version,require('../package.json').version);assert.ok(!asar.listPackage(archive).some(n=>/test-driver|github-auth|hosts\.yml/.test(n)));
const report={version:p.version,passed:true,filesMatched:checks.length,checks};fs.writeFileSync(path.join(root,'provenance/package-integrity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({version:p.version,filesMatched:checks.length,passed:true}));

