async function clickMenuAction(page,id){
  const action=page.locator('#'+id),menu=action.locator('xpath=ancestor::details[1]');
  if(await menu.count()&&!await menu.evaluate(e=>e.open))await menu.locator('summary').click();
  await action.click();
}
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp','portable-form-qa');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1200},acceptDownloads:true});
    await page.goto(pathToFileURL(path.join(root,'PDF-Field-Helper-v2.0.0.html')).href);
    await page.locator('#pdfPicker').setInputFiles(path.join(out,'editable.pdf'));
    await page.waitForFunction(()=>!!document.querySelector('[data-id="plain"]'));
    await page.evaluate(()=>{
      applyLanguage('fr');window.picks=0;window.writes=[];window.abortPick=false;
      window.showSaveFilePicker=async()=>{
        window.picks++;if(window.abortPick)throw new DOMException('Cancelled','AbortError');
        const id=window.picks;return {name:'save-'+id+'.pdf',createWritable:async()=>({write:async blob=>window.writes.push({id,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))}),close:async()=>{}})};
      };
    });
    await clickMenuAction(page,'save');await page.locator('#confirmSaveAs').click();
    await page.waitForFunction(()=>window.writes.length===1&&!editablePdfSaving);
    assert.equal(await page.evaluate(()=>window.picks),1);
    await page.evaluate(()=>{const e=document.querySelector('[data-id="plain"]');e.value='Deuxième sauvegarde';e.dispatchEvent(new Event('input'));});
    await clickMenuAction(page,'save');await page.waitForFunction(()=>window.writes.length===2&&!editablePdfSaving);
    assert.equal(await page.evaluate(()=>window.picks),1,'Save reuses the chosen PDF');
    assert.equal(await page.evaluate(()=>window.writes[1].id),1);
    assert.equal(await page.evaluate(async()=>{
      const doc=await PDFLib.PDFDocument.load(new Uint8Array(window.writes[1].bytes));return doc.getForm().getFields().find(f=>f.getText?.()==='Deuxième sauvegarde')?.getText();
    }),'Deuxième sauvegarde','Save writes real AcroForm values');
    assert.equal(await page.evaluate(()=>dbGet(docKey)),null,'Save does not write a browser record');
    await clickMenuAction(page,'saveAs');await page.locator('#confirmSaveAs').click();
    await page.waitForFunction(()=>window.writes.length===3&&!editablePdfSaving);
    assert.equal(await page.evaluate(()=>window.picks),2,'Save as chooses a new file');
    await page.evaluate(()=>{window.abortPick=true;});
    await clickMenuAction(page,'saveAs');await page.locator('#confirmSaveAs').click();await page.waitForFunction(()=>!editablePdfSaving);
    assert.equal(await page.evaluate(()=>window.writes.length),3,'cancelling Save as writes nothing');
    await clickMenuAction(page,'save');await page.waitForFunction(()=>window.writes.length===4&&!editablePdfSaving);
    assert.equal(await page.evaluate(()=>window.writes[3].id),2,'cancelling keeps the last successful target');
    await page.evaluate(()=>{window.showSaveFilePicker=undefined;window.showDirectoryPicker=undefined;});
    for(const [language,phrase] of [['fr','Le PDF va être téléchargé'],['en','The PDF will be downloaded']]){
      await page.evaluate(language=>applyLanguage(language),language);
      let message='';page.once('dialog',async d=>{message=d.message();await d.accept();});
      const downloadEvent=page.waitForEvent('download');await page.locator('#exportPdf').click();const download=await downloadEvent;
      assert.ok(message.includes(phrase),message);
      await download.saveAs(path.join(out,'fallback-'+language+'.pdf'));
    }
    console.log('PASS: Save writes PDF, reuses its target, Save as chooses a new target, cancel preserves it; export warnings are localized.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
