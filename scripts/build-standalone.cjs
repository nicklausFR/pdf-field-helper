// Reuse the offline libraries already shipped in the standalone application.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),file=path.join(root,'PDF-Field-Helper-v1.4.1.html');
const old=fs.readFileSync(file,'utf8'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts=[...old.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const end="{type:'text/javascript'}));",start=scripts[2].indexOf('const _pdfWorkerBinary=');
const worker=scripts[2].slice(start,scripts[2].indexOf(end,start)+end.length);
if(start<0||!worker.endsWith(end))throw new Error('Missing offline worker');
let i=0;
const standalone=index.replace(/<script src="[^"]+"><\/script>/g,()=>'<script>'+scripts[i++]+'</script>')
  .replace(/pdfjsLib\.GlobalWorkerOptions\.workerSrc='https:[^']+';/,()=>worker);
for(const html of [index,standalone])new vm.Script([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1]);
fs.writeFileSync(file,standalone);
console.log('Standalone application updated; scripts parse successfully.');
