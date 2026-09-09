// Reuse the offline libraries already shipped in the standalone application.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version;
const file=path.join(root,`PDF-Field-Helper-v${version}.html`);
const previous=fs.readdirSync(root).filter(name=>/^PDF-Field-Helper-v[\d.]+\.html$/.test(name)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
if(!previous)throw new Error('A previous standalone HTML is required to reuse the offline libraries.');
const source=fs.existsSync(file)?file:path.join(root,previous);
const old=fs.readFileSync(source,'utf8'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...old.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const end="{type:'text/javascript'}));",start=scripts[2].indexOf('const _pdfWorkerBinary=');
const worker=scripts[2].slice(start,scripts[2].indexOf(end,start)+end.length);
if(start<0||!worker.endsWith(end))throw new Error('Missing offline worker');
let i=0;
const standalone=index.replace(/<script src="[^"]+"><\/script>/g,()=>'<script>'+scripts[i++]+'</script>')
  .replace(/pdfjsLib\.GlobalWorkerOptions\.workerSrc='https:[^']+';/,()=>worker);
for(const html of [index,standalone])for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
fs.writeFileSync(file,standalone);
console.log('Standalone application updated; scripts parse successfully.');
