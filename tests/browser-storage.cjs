async function clickMenuAction(page,id){
  const action=page.locator('#'+id),menu=action.locator('xpath=ancestor::details[1]');
  if(await menu.count()&&!await menu.evaluate(e=>e.open))await menu.locator('summary').click();
  await action.click();
}
// Run with node tests/browser-storage.cjs (Playwright and Chrome required).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const profile=fs.mkdtempSync(path.join(root,'tmp','browser-storage-'));
const url=pathToFileURL(path.join(root,'PDF-Field-Helper-v2.0.0.html')).href;
let context;
async function open(){
  context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1550,height:950},serviceWorkers:'block'});
  const page=await context.newPage();await page.goto(url);
  await page.waitForFunction(()=>typeof saveProject==='function');return page;
}
async function state(page){
  return page.evaluate(()=>{
    collectCurrentPage();
    return {name:docName,bytes:Array.from(pdfBytes),currentPage,userZoom,pageStates:JSON.parse(JSON.stringify(pageStates))};
  });
}
(async()=>{
  try{
    let page=await open();
    await page.locator('#pdfPicker').setInputFiles(path.join(root,'Pour_test','cerfa_14599-01.pdf'));
    await page.waitForFunction(()=>pdfProxy&&document.getElementById('overlay'));
    await page.evaluate(async()=>{
      await renderPage(2);applyLanguage('fr');
      createTextDom({id:'storage-text',x:50,y:100,w:180,h:28,value:'Réponse sauvegardée',fontWeight:'bold',textColor:'#123456',manualPlacement:true});
      createCheckDom({id:'storage-check',x:250,y:100,w:14,h:14,checked:true,manualPlacement:true});
      createImageDom({id:'storage-drawing',x:50,y:200,w:120,h:80,drawing:{strokes:[{color:'#123456',width:.02,points:[{x:.1,y:.2,p:.5},{x:.8,y:.7,p:.7}]}]}});
      createMaskDom({id:'storage-mark',x:280,y:100,w:50,h:18,maskStyle:'ellipse',textColor:'#123456'});
      setZoom(.8);setEditTab('edit');collectCurrentPage();
    });
    const expected=await state(page);
    assert.equal(await page.locator('#resetDocument').innerText(),'Effacer tous les champs');
    assert.equal(await page.locator('#clear').textContent(),'Réinitialiser les champs');
    assert.equal(await page.locator('#autoYReset').innerText(),'Réinitialiser','baseline reset keeps its own label');
    assert.equal(await page.locator('#save').textContent(),'Enregistrer');
    assert.match(await page.locator('#save').getAttribute('title'),/dans le PDF/);
    for(const id of ['undoAction','redoAction'])assert.equal(await page.locator('#'+id).evaluate(e=>!!e.closest('.compact-popover')),true);
    // Legacy browser records remain readable; the Save button now writes a PDF.
    await page.evaluate(()=>saveProject());
    await page.waitForFunction(async()=>!!(await dbGet(docKey))?.state.pageStates[2].fields.find(f=>f.id==='storage-text'));
    assert.equal(await page.evaluate(()=>document.querySelector('[data-id="storage-text"]').value),'Réponse sauvegardée');
    await page.locator('.toolbar').screenshot({path:path.join(root,'tmp','storage-toolbar.png')});
    await context.close();context=null;
    page=await open();
    await page.waitForFunction(()=>!!document.querySelector('[data-id="storage-text"]'));
    assert.deepEqual(await state(page),expected,'PDF, page, zoom, values, styles and drawings survive browser shutdown');
    await page.evaluate(()=>{
      const e=document.querySelector('[data-id="storage-text"]');e.value='Non enregistré';e.dispatchEvent(new Event('input'));
    });
    await page.reload();await page.waitForFunction(()=>!!document.querySelector('[data-id="storage-text"]'));
    assert.equal(await page.locator('[data-id="storage-text"]').inputValue(),'Réponse sauvegardée','saving is explicit, not automatic');
    const count=await page.locator('#overlay .field,#overlay .check-zone,#overlay .image-zone,#overlay .mask-zone').count();
    await page.evaluate(()=>selectAllPageFields());
    await clickMenuAction(page,'clear');
    assert.equal(await page.locator('#overlay .field,#overlay .check-zone,#overlay .image-zone,#overlay .mask-zone').count(),count,'reset values preserves the fields');
    assert.deepEqual(await page.evaluate(()=>({text:document.querySelector('[data-id="storage-text"]').value,check:document.querySelector('[data-id="storage-check"] input').checked,strokes:document.querySelector('[data-id="storage-drawing"]')._drawing.strokes.length,mark:document.querySelector('[data-id="storage-mark"]').dataset.maskStyle})),{text:'',check:false,strokes:0,mark:'mark'});
    await page.evaluate(()=>resetDocument());
    assert.equal(await page.locator('#overlay .field,#overlay .check-zone,#overlay .image-zone,#overlay .mask-zone').count(),0,'delete fields leaves the page empty');
    await page.evaluate(()=>renderPage(1));
    assert.equal(await page.locator('#overlay .field,#overlay .check-zone,#overlay .image-zone,#overlay .mask-zone').count(),0,'deleted fields are not automatically reimported on another page');
    await page.evaluate(()=>saveProject());
    await clickMenuAction(page,'closePdf');
    await page.reload();
    assert.equal(await page.evaluate(()=>localStorage.getItem(LAST_KEY)),null,'Close disables automatic reopening');
    console.log('PASS: browser restart restores the saved document; explicit save, clear values, delete fields and Close behavior verified.');
  }finally{await context?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
