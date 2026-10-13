'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
for(const file of ['data.js','domain.js','storage.js','evaluators.js','app.js']){
  new vm.Script(fs.readFileSync(path.join(root,'src',file),'utf8'),{filename:file});
  console.log(`Syntax OK: src/${file}`);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!fs.existsSync(path.join(root,match[1])))throw new Error('Missing asset: '+match[1]);
console.log('All referenced local assets exist.');
