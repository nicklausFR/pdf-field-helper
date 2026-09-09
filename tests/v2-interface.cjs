const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp','v2-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'PDF-Field-Helper-v2.0.0.html')).href);await page.evaluate(()=>applyLanguage('fr'));
  assert.equal(await page.locator('#tabLayerButton').textContent(),'Créer et modifier les champs');
  const menu=async()=>{if(!await page.locator('#compactDocumentMenu').evaluate(e=>e.parentElement.open))await page.locator('#compactDocumentMenu').click();};
  await menu();assert.equal(await page.locator('#openPdf').isVisible(),true);assert.equal(await page.locator('#closePdf').isEnabled(),false);await page.keyboard.press('Escape');
  await page.evaluate(async()=>{const doc=await PDFLib.PDFDocument.create();for(let i=0;i<3;i++){const p=doc.addPage([595,842]);p.drawText('Page '+(i+1),{x:40,y:790});}await loadPdf(await doc.save(),'test-v2.pdf');createTextDom({id:'v2-first',x:40,y:90,w:150,h:20,value:'Première réponse',manualPlacement:true});createTextDom({id:'v2-second',x:200,y:130,w:100,h:35,value:'Deuxième réponse',manualPlacement:true});collectCurrentPage();historyCheckpoint('Test fields');});
  await menu();assert.equal(await page.locator('#compactDocumentMenu').textContent(),'test-v2.pdf');assert.equal(await page.locator('#openPdf').isVisible(),false);assert.equal(await page.locator('#closePdf').evaluate(e=>e.parentElement.firstElementChild===e),true);await page.keyboard.press('Escape');
  await page.evaluate(()=>setEditTab('edit'));await page.locator('[data-id="v2-first"]').click();await page.keyboard.press('Control+a');
  assert.equal(await page.evaluate(()=>selectedItems.size),2);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  await page.keyboard.press('Delete');assert.equal(await page.locator('#overlay .field').count(),0);await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('#overlay .field').length===2);
  await page.evaluate(()=>{setEditTab('layer');setAreaSelection(document.querySelectorAll('#overlay .field'));alignSelected('bottom');});
  assert.equal(await page.evaluate(()=>{const f=[...document.querySelectorAll('#overlay .field')];return parseFloat(f[0].style.top)+parseFloat(f[0].style.height)===parseFloat(f[1].style.top)+parseFloat(f[1].style.height);}),true);
  await page.evaluate(async()=>{await renderPage(2);createTextDom({id:'v2-page2',x:40,y:100,w:150,h:20,value:'Page deux',manualPlacement:true});collectCurrentPage();historyCheckpoint('Page two');await renderPage(1);});
  assert.equal(await page.locator('[data-id="v2-first"]').inputValue(),'Première réponse');
  await page.evaluate(()=>{clearValues();});assert.equal(await page.locator('[data-id="v2-first"]').inputValue(),'Première réponse','no selection is a no-op');
  await page.evaluate(()=>{select(document.querySelector('[data-id="v2-first"]'));clearValues();});
  assert.equal(await page.locator('[data-id="v2-first"]').inputValue(),'');assert.equal(await page.locator('[data-id="v2-second"]').inputValue(),'Deuxième réponse');
  assert.equal(await page.evaluate(()=>getPageState(2).fields[0].value),'Page deux');
  assert.equal(await page.evaluate(()=>continuousSlots.get(2)._shadow.querySelector('.field').value),'Page deux');
  await page.evaluate(()=>undoAction());assert.equal(await page.locator('[data-id="v2-first"]').inputValue(),'Première réponse');
  await page.waitForTimeout(260);await page.evaluate(()=>{const target=continuousSlots.get(2);window.scrollTo(0,target.offsetTop-document.querySelector('.toolbar').offsetHeight);});await page.waitForFunction(()=>currentPage===2&&!continuousBusy);
  assert.equal(await page.locator('[data-id="v2-page2"]').inputValue(),'Page deux');
  // Multiple printed tables: only the one under the pointer is selected.
  await page.evaluate(async()=>{const doc=await PDFLib.PDFDocument.create(),p=doc.addPage([595,842]);for(const x of [40,330]){for(let c=0;c<=2;c++)p.drawLine({start:{x:x+c*85,y:730},end:{x:x+c*85,y:640},thickness:1});for(let r=0;r<=2;r++)p.drawLine({start:{x,y:730-r*45},end:{x:x+170,y:730-r*45},thickness:1});}await loadPdf(await doc.save(),'tables.pdf');setEditTab('layer');});
  await page.locator('#detectTables').click();const point=await page.evaluate(()=>{const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.left+42*scaleNow,y:r.top+114*scaleNow};});await page.mouse.move(point.x,point.y);
  await page.waitForFunction(()=>tablePreview?.cells.length===4);await page.mouse.click(point.x,point.y);assert.equal(await page.locator('#overlay .field').count(),4);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#overlay .field')].every(e=>parseFloat(e.style.left)<300)),true);
  await page.setViewportSize({width:920,height:850});await page.waitForTimeout(150);assert.equal(await page.locator('#tabLayer').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.screenshot({path:path.join(out,'compact-fr.png')});
  await page.evaluate(async()=>{const doc=await PDFLib.PDFDocument.create();for(let i=0;i<21;i++)doc.addPage([595,842]);await loadPdf(await doc.save(),'large.pdf');});
  assert.equal(await page.locator('.continuous-page').count(),1);await page.locator('.continuous-next').click();await page.waitForFunction(()=>currentPage===2&&!continuousBusy);assert.equal(await page.locator('.continuous-page').count(),2);
  await menu();await page.locator('#closePdf').click();await menu();assert.equal(await page.locator('#openPdf').isVisible(),true);assert.equal(await page.locator('#compactDocumentMenu').textContent(),'Documents');
  assert.deepEqual(errors,[]);console.log('PASS: v2 menus, Ctrl+A, bottom alignment, reset/undo across pages, scroll activation, targeted tables, wrapping and large documents.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
