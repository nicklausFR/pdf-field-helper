// Run with node tests/delimited-fields.cjs (Playwright and Chrome required).
// The local Pour_test fixtures and standalone HTML supply PDFs and offline libraries.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const standalone=fs.readFileSync(path.join(root,'PDF-Field-Helper-v1.4.html'),'utf8');
const scripts=[...standalone.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const worker=Buffer.from(standalone.match(/const _pdfWorkerBinary=atob\('([^']+)'/)[1],'base64');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    let data=fs.readFileSync(file);
    if(name==='/index.html'){
      let i=0;
      data=data.toString().replace('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js','/worker.js')
        .replace(/<script src="[^"]+"><\/script>/g,()=>'<script>'+scripts[i++]+'</script>');
    }
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.pdf')?'application/pdf':'text/javascript');
    res.end(data);
  }catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,headless:true}:{channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1200},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>typeof loadPdf==='function');
    const load=async(file,num=1)=>page.evaluate(async({file,num})=>{
      await loadPdf(await (await fetch('/Pour_test/'+file)).arrayBuffer(),file);
      if(num!==1)await renderPage(num);
    },{file,num});
    await load('cerfa_13406-17.pdf',4);
    const contacts=await page.evaluate(()=>getPageState(4).fields.filter(f=>f.y>545&&f.y<590).map(f=>f.boxes.length));
    assert.deepEqual(contacts,[5,3,2,10,4],'postal code, BP, cedex, telephone and country prefix');
    await load('cerfa_13406-17.pdf',2);
    const par=await page.evaluate(()=>getPageState(2).fields.find(f=>f.x>77&&f.x<79&&f.y>92&&f.y<95));
    assert.ok(par,'the mairie author field is imported');assert.deepEqual(par.boxes,[],'an invisible native 60-character comb must remain normal text');
    await page.evaluate(()=>setEditTab('edit'));
    await page.locator(`[data-id="${par.id}"]`).fill('QSDQSDQSDQSDQSDQSDQSDQSD');
    assert.equal(await page.locator(`.box-char-layer[data-for-id="${par.id}"]`).count(),0,'no artificial character spacing while typing');
    const repaired=await page.evaluate(async id=>{
      collectCurrentPage();const state=projectSnapshot(),f=state.pageStates[2].fields.find(f=>f.id===id),pg=await pdfProxy.getPage(2),vp=pg.getViewport({scale:1});
      const annotation=(await pg.getAnnotations()).find(a=>a.comb&&a.maxLen===60&&Math.abs(nativeWidgetRect(a,vp)?.x-f.x)<.1);
      if(!annotation)throw new Error('Missing original 60-character AcroForm fixture');
      // Restore the old imported geometry to check existing projects as well.
      f.boxes=nativeCombBoxes(annotation,nativeWidgetRect(annotation,vp),f.lineY);
      await loadPdf(new Uint8Array(pdfBytes),'saved-mairie.pdf',state);
      return getPageState(2).fields.find(f=>f.id===id);
    },par.id);
    assert.deepEqual(repaired.boxes,[],'old artificial comb geometry is corrected when reopening a project');
    assert.equal(repaired.value,'QSDQSDQSDQSDQSDQSDQSDQSD','repair preserves the answer');assert.equal(repaired.fontSize,par.fontSize);
    assert.equal(await page.evaluate(()=>getPageState(2).fields.find(f=>f.y>73&&f.y<75).boxes.length),8,'printed date cells remain delimited');
    const exportedPar=await page.evaluate(async()=>{
      const doc=await buildPdfDocument(true),f=doc.getForm().getFields().find(f=>f.getText?.()==='QSDQSDQSDQSDQSDQSDQSDQSD');
      return {value:f?.getText(),comb:f?.isCombed()};
    });
    assert.deepEqual(exportedPar,{value:repaired.value,comb:false},'saved PDF uses ordinary text too');
    if(process.env.QA_DIR){
      fs.mkdirSync(process.env.QA_DIR,{recursive:true});
      const crop=await page.evaluate(()=>{document.activeElement.blur();document.body.classList.add('clean');window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+50*scaleNow,y:r.y+71*scaleNow,width:372*scaleNow,height:43*scaleNow};});
      await page.screenshot({path:path.join(process.env.QA_DIR,'mairie-normal-text.png'),clip:crop,fullPage:true});
      await page.evaluate(()=>document.body.classList.remove('clean'));
    }
    await load('cerfa_15036-02.pdf');
    const dateId=await page.evaluate(()=>getPageState(1).fields.find(f=>f.y>510&&f.y<545)?.id);
    assert.ok(dateId,'date widget imported despite printed slashes');
    await page.evaluate(id=>{setEditTab('edit');document.querySelector(`[data-id="${id}"]`).focus();},dateId);
    await page.locator(`textarea[data-id="${dateId}"]`).fill('12345678');
    await page.waitForTimeout(150); // Allow the former destructive focus rescan to fire.
    const date=await page.evaluate(id=>{
      const e=document.querySelector(`textarea[data-id="${id}"]`),l=document.querySelector(`.box-char-layer[data-for-id="${id}"]`);
      return {n:fieldBoxData(e).length,chars:[...l.querySelectorAll('.box-char')].map(e=>e.textContent).join(''),frame:!!l.querySelector('.box-frame'),separator:getComputedStyle(l.querySelectorAll('.box-guide')[1]).borderLeftWidth};
    },dateId);
    assert.equal(date.n,8);assert.equal(date.chars,'12345678');assert.equal(date.frame,false);assert.equal(date.separator,'0px');
    const preview=await page.evaluate(id=>{
      const f=getPageState(1).fields.find(f=>f.id===id);
      beginPlacement('text');Object.assign(pendingPlacement,{x:f.x,y:f.y,w:f.w,h:f.h,visible:true,detectedWidth:true,autoFitted:true,detectedBoxes:f.boxes,detectedLineY:f.lineY,stage:'anchored'});
      applyPlacementGhost();const g=document.getElementById('placementGhost'),s=g.querySelector('.placement-box-separator');
      const result={n:g.children.length,frame:getComputedStyle(g).borderTopColor,separator:getComputedStyle(s).borderLeftColor};
      finalizePlacement(pendingPlacement);
      result.remaining=document.querySelectorAll('.placement-box-separator,.box-frame').length;
      result.fixedBorders=[...document.querySelectorAll('.box-guide')].some(e=>getComputedStyle(e).borderLeftWidth!=='0px');
      return result;
    },dateId);
    assert.deepEqual(preview,{n:7,frame:'rgb(43, 138, 62)',separator:'rgb(43, 138, 62)',remaining:0,fixedBorders:false},'green border/separators exist only before placement is fixed');
    await page.evaluate(()=>cancelPlacement(false));
    if(process.env.QA_DIR){
      fs.mkdirSync(process.env.QA_DIR,{recursive:true});
      const crop=await page.evaluate(id=>{
        window.scrollTo(0,0);const surface=document.getElementById('pageSurface').getBoundingClientRect();
        const f=document.querySelector(`[data-id="${id}"]`),y=parseFloat(f.style.top);
        return {x:Math.max(0,surface.x+45*scaleNow),y:surface.y+(y-4)*scaleNow,width:370*scaleNow,height:31*scaleNow};
      },dateId);
      await page.screenshot({path:path.join(process.env.QA_DIR,'date-edit.png'),clip:crop,fullPage:true});
      await page.evaluate(()=>setEditTab('layer'));
      await page.screenshot({path:path.join(process.env.QA_DIR,'date-layout.png'),clip:crop,fullPage:true});
    }
    const hidden=await page.evaluate(()=>{
      document.body.classList.add('clean');const l=document.querySelector('.box-char-layer');
      const result=getComputedStyle(l.querySelector('.box-guide')).display;
      document.body.classList.remove('clean');return result;
    });
    assert.equal(hidden,'none');
    const saved=await page.evaluate(async id=>{
      collectCurrentPage();const f=getPageState(1).fields.find(f=>f.id===id);f.boxes=[];
      const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};
      await loadPdf(new Uint8Array(pdfBytes),'saved-date.pdf',state);
      const restored=getPageState(1).fields.find(f=>f.id===id);return {n:restored.boxes.length,value:restored.value};
    },dateId);
    assert.deepEqual(saved,{n:8,value:'12345678'},'saved text field converted without losing its value');
    const ordinary=await page.evaluate(async()=>{
      const pg=await pdfProxy.getPage(1),vp=pg.getViewport({scale:1}),annotations=(await pg.getAnnotations()).filter(a=>a.fieldType==='Tx').map(a=>({...a,comb:false,maxLen:null,fieldValue:'QSD'}));
      pageStates[1]={fields:[],checks:[],images:[],masks:[]};nativeWidgetAutoImport=true;
      await importNativePdfWidgets({getAnnotations:async()=>annotations},vp,1);
      const f=getPageState(1).fields.find(f=>f.y>510&&f.y<545);return {n:f.boxes.length,value:f.value};
    });
    assert.deepEqual(ordinary,{n:8,value:'QSD'},'ordinary AcroForm text is converted from visual cells');
    const manual=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
      const line=detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,150,528,text);
      return {n:line?.boxes?.length,manual:detectPageBoxesForExactTextRect({x:142,y:517,w:147,h:17}).length};
    });
    assert.deepEqual(manual,{n:8,manual:8},'hover and manual area include the complete date');
    await load('cerfa_13757-03.pdf');
    const vin=await page.evaluate(()=>getPageState(1).fields.find(f=>f.boxes?.length===17));
    assert.ok(vin,'existing 17-cell VIN with vertical walls is still imported');
    const vertical=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
      return detectPageBoxGroups(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,text).some(g=>g.boxes.length===17);
    });
    assert.ok(vertical,'existing vertical-wall raster detection retained');
    await load('cerfa_15036-02.pdf',4);
    const table=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes(),cells=pageTableCells(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,text);
      const grid=cells.filter(c=>c.tableId===0),header=grid.find(c=>c.printed),first=grid.find(c=>!c.printed);
      const headerLine=detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,header.x+header.w/2,header.y+header.h/2,text);
      const line=detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,first.x+first.w/2,first.y+first.h/2,text);
      return {cells:grid.length,blank:grid.filter(c=>!c.printed).length,headerLine,candidate:placementCandidateFromDetectedLine(line,text,first.x+first.w/2),first};
    });
    assert.equal(table.cells,54);assert.equal(table.blank,48);assert.equal(table.headerLine,null);
    assert.equal(table.candidate.x,table.first.x+2,'cell placement snaps left even when clicking the middle');
    assert.equal(table.candidate.w,table.first.w-4);
    const anchored=await page.evaluate(async candidate=>{
      beginPlacement('text');applyDetectedPlacementCandidate(pendingPlacement,candidate);
      const px=candidate.x+candidate.w/2,py=candidate.y+candidate.h/2;
      pendingPlacement.lastPX=px;pendingPlacement.lastPY=py;
      await anchorTextPlacement({x:px,y:candidate.y,px,py});
      const result={x:pendingPlacement.x,w:pendingPlacement.w,cell:!!pendingPlacement.tableCell};
      cancelPlacement(false);return result;
    },table.candidate);
    assert.deepEqual(anchored,{x:table.candidate.x,w:table.candidate.w,cell:true},'first click retains complete cell geometry');
    await page.evaluate(()=>{
      createTextDom({id:'table-a',x:53,y:149,w:211,h:15,value:'Dupont',manualPlacement:true});
      createTextDom({id:'table-b',x:169,y:151,w:60,h:12,value:'Camille',manualPlacement:true});
      createTextDom({id:'table-c',x:54,y:168,w:106,h:12,value:'Martin',manualPlacement:true});
      select(document.querySelector('[data-id="table-a"]'));select(document.querySelector('[data-id="table-b"]'),true);select(document.querySelector('[data-id="table-c"]'),true);
      collectCurrentPage();historyCheckpoint('Table test fields');
    });
    await page.locator('#alignTableCells').click();
    await page.waitForFunction(()=>parseFloat(document.querySelector('[data-id="table-a"]').style.width)!==211);
    const aligned=await page.evaluate(()=>getPageState(4).fields.filter(f=>f.id.startsWith('table-')));
    assert.deepEqual(aligned.map(f=>f.value),['Dupont','Camille','Martin']);
    assert.equal(aligned[0].x,aligned[2].x);assert.equal(aligned[0].w,aligned[2].w);
    assert.equal(aligned[0].y,aligned[1].y);assert.equal(aligned[0].h,aligned[1].h);
    assert.ok(aligned[0].x+aligned[0].w<aligned[1].x,'first field no longer crosses into the next column');
    await page.evaluate(()=>undoAction());
    assert.equal(await page.evaluate(()=>getPageState(4).fields.find(f=>f.id==='table-a').w),211);
    await page.evaluate(()=>redoAction());
    assert.equal(await page.evaluate(()=>getPageState(4).fields.find(f=>f.id==='table-a').w),aligned[0].w);
    // Focus selects a single field; the table action uses that table as its scope.
    await page.evaluate(()=>select(document.querySelector('[data-id="table-a"]')));
    await page.locator('#detectTables').click();
    await page.waitForSelector('#tablePlacementPreview');
    assert.equal(await page.locator('#tablePlacementPreview .placement-ghost').count(),45);
    assert.equal(await page.locator('.field').count(),3,'preview creates no fields');
    if(process.env.QA_DIR){
      const crop=await page.evaluate(()=>{window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+48*scaleNow,y:r.y+120*scaleNow,width:522*scaleNow,height:189*scaleNow};});
      await page.screenshot({path:path.join(process.env.QA_DIR,'table-preview.png'),clip:crop,fullPage:true});
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tablePlacementPreview').count(),0);
    assert.equal(await page.locator('.field').count(),3);
    await page.locator('#detectTables').click();await page.waitForSelector('#tablePlacementPreview');await page.locator('#detectTables').click();
    assert.equal(await page.locator('.field').count(),48);
    assert.equal(await page.locator('#tablePlacementPreview').count(),0);
    assert.equal(await page.locator('.box-frame,.placement-box-separator').count(),0);
    await page.locator('#detectTables').click();
    assert.equal(await page.locator('.field').count(),48,'global recognition does not duplicate existing fields');
    assert.equal(await page.locator('#tablePlacementPreview').count(),0);
    const tableValues=await page.evaluate(()=>getPageState(4).fields.filter(f=>f.value).map(f=>f.value));
    assert.deepEqual(tableValues,['Dupont','Camille','Martin']);
    if(process.env.QA_DIR){
      const crop=await page.evaluate(()=>{window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+48*scaleNow,y:r.y+120*scaleNow,width:522*scaleNow,height:189*scaleNow};});
      await page.screenshot({path:path.join(process.env.QA_DIR,'table-fixed.png'),clip:crop,fullPage:true});
    }
    const exported=await page.evaluate(async()=>{
      let blob;const originalPicker=window.showSaveFilePicker;
      window.showSaveFilePicker=async()=>({name:'table-test.pdf',createWritable:async()=>({write:async data=>{blob=data;},close:async()=>{}})});
      try{await exportDocument();}finally{window.showSaveFilePicker=originalPicker;}
      if(!blob)throw new Error('PDF export failed');
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
      const pg=await pdf.getPage(4),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();
      const values=tc.items.filter(t=>['Dupont','Camille','Martin'].includes(t.str)).map(t=>({value:t.str,x:t.transform[4],y:vp.height-t.transform[5]}));
      const canvas=document.createElement('canvas'),rv=pg.getViewport({scale:2});canvas.width=rv.width;canvas.height=rv.height;
      await pg.render({canvasContext:canvas.getContext('2d'),viewport:rv}).promise;
      const crop=document.createElement('canvas');crop.width=1044;crop.height=378;crop.getContext('2d').drawImage(canvas,96,240,1044,378,0,0,1044,378);
      await pdf.destroy();return {values,image:crop.toDataURL('image/png').split(',')[1]};
    });
    assert.equal(exported.values.length,3,'all table values exported');
    for(const f of aligned){
      const item=exported.values.find(t=>t.value===f.value);
      assert.ok(item&&item.x>f.x&&item.x<f.x+f.w&&item.y>f.y&&item.y<f.y+f.h,'exported text remains inside its table cell');
    }
    if(process.env.QA_DIR)fs.writeFileSync(path.join(process.env.QA_DIR,'table-export.png'),Buffer.from(exported.image,'base64'));
    await page.evaluate(async()=>{
      collectCurrentPage();const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:4};
      await loadPdf(new Uint8Array(pdfBytes),'saved-table.pdf',state);
    });
    assert.equal(await page.locator('.field').count(),48,'table fields persist after reloading');
    await load('cerfa_14599-01.pdf');
    const dotted=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
      return [180,240,360].map(x=>detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,x,153,text));
    });
    for(const line of dotted){assert.ok(line&&line.x<160&&line.x+line.w>535,'ellipsis guide detected across its full width');assert.ok(!line.boxes?.length);}
    const quickDotted=await page.evaluate(async()=>{
      beginPlacement('text');await anchorTextPlacement({x:180,y:145,px:180,py:153});
      const result={detected:pendingPlacement.detectedWidth,right:pendingPlacement.x+pendingPlacement.w,boxes:pendingPlacement.detectedBoxes.length};cancelPlacement(false);return result;
    });
    assert.ok(quickDotted.detected&&quickDotted.right>535&&quickDotted.boxes===0,'fast click detects the dotted baseline too');
    const signatory=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();return detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,350,172,text);
    });
    assert.ok(signatory&&signatory.x>270&&signatory.x+signatory.w>530,'combined label/ellipsis item is recognized');
    await page.locator('#addDrawing').click();
    const drawingId=await page.evaluate(()=>{
      Object.assign(pendingPlacement,{x:80,y:350,w:150,h:90,visible:true});finalizePlacement(pendingPlacement);return selected.dataset.id;
    });
    await page.evaluate(()=>{setZoom(.65);setEditTab('edit');window.scrollTo(0,0);});
    const drawing=page.locator(`[data-id="${drawingId}"] canvas`);
    assert.equal(await page.locator('#drawingTools').isVisible(),false,'normal editor does not show the fillable-file drawing chooser');
    await drawing.scrollIntoViewIfNeeded();
    let bounds=await drawing.boundingBox();
    await page.mouse.move(bounds.x+20,bounds.y+20);await page.mouse.down();await page.mouse.move(bounds.x+100,bounds.y+60,{steps:10});await page.mouse.up();
    assert.equal(await page.evaluate(()=>getPageState(1).images[0].drawing.strokes.length),1,'mouse stroke saved');
    assert.equal(await page.locator('#drawingTools').isVisible(),false,'drawing directly does not open the chooser in the normal editor');
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:bounds.x+20,y:bounds.y+75,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.8});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x+110,y:bounds.y+35,button:'left',buttons:1,pointerType:'pen',force:.8});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:bounds.x+110,y:bounds.y+35,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
    assert.equal(await page.evaluate(()=>getPageState(1).images[0].drawing.strokes.length),2,'pen stroke saved');
    assert.ok(await page.evaluate(()=>getPageState(1).images[0].drawing.strokes[1].points.some(p=>p.p>.7)),'pen pressure retained');
    await page.evaluate(()=>undoAction());assert.equal(await page.evaluate(()=>getPageState(1).images[0].drawing.strokes.length),1);
    await page.evaluate(()=>redoAction());assert.equal(await page.evaluate(()=>getPageState(1).images[0].drawing.strokes.length),2);
    await page.evaluate(()=>{
      setEditTab('layer');cancelPlacement(false);
      createTextDom({id:'marquee-text',x:250,y:350,w:70,h:16,value:'Groupe',manualPlacement:true});
      createCheckDom({id:'marquee-check',x:250,y:380,w:12,h:12,manualPlacement:true});
      createMaskDom({id:'outside-mask',x:380,y:500,w:30,h:20});
      collectCurrentPage();historyCheckpoint('Selection test');window.scrollTo(0,0);
    });
    const pdfPoint=async(x,y)=>page.evaluate(({x,y})=>{const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+x*scaleNow,y:r.y+y*scaleNow};},{x,y});
    await page.evaluate(()=>{
      setEditTab('edit');select(null);
      createMaskDom({id:'selection-mark',x:380,y:450,w:40,h:20,maskStyle:'mark'});
    });
    const groupText=page.locator('[data-id="marquee-text"]');
    await groupText.click();await page.keyboard.press('End');await page.keyboard.type(' test');
    assert.equal(await groupText.inputValue(),'Groupe test','ordinary edit click still types text');
    await page.locator('[data-id="marquee-check"] input').click();
    assert.equal(await page.locator('[data-id="marquee-check"] input').isChecked(),true,'ordinary click still checks the box');
    await page.locator('[data-id="selection-mark"]').click();
    assert.equal(await page.locator('[data-id="selection-mark"]').getAttribute('data-mask-style'),'strike','ordinary click still changes the mark');
    await page.evaluate(()=>select(null));
    for(const locator of [groupText,page.locator('[data-id="marquee-check"] input'),drawing,page.locator('[data-id="selection-mark"]')]){
      await locator.click({modifiers:['Control']});
    }
    const maskPoint=await pdfPoint(395,510);
    await page.keyboard.down('Control');await page.mouse.click(maskPoint.x,maskPoint.y);await page.keyboard.up('Control');
    assert.equal(await page.evaluate(()=>selectedAreas().length),5,'Ctrl+click selects every area type in edit mode, including white masks');
    assert.equal(await groupText.evaluate(e=>getComputedStyle(e).outlineStyle),'dashed','multiple selected fields are visibly outlined');
    if(process.env.QA_DIR)await page.locator('#pageSurface').screenshot({path:path.join(process.env.QA_DIR,'edit-multiple-selection.png')});
    assert.equal(await page.locator('[data-id="marquee-check"] input').isChecked(),true,'selection does not toggle checkbox');
    assert.equal(await page.locator('[data-id="selection-mark"]').getAttribute('data-mask-style'),'strike','selection does not toggle mark');
    assert.equal(await page.evaluate(()=>document.querySelector('.drawing-zone')._drawing.strokes.length),2,'selection does not draw');
    await groupText.click({modifiers:['Control']});
    assert.equal(await page.evaluate(()=>selectedAreas().length),4,'Ctrl+click removes a text field without focus selecting it again');
    await groupText.click({modifiers:['Meta']});
    assert.equal(await page.evaluate(()=>selectedAreas().length),5,'Command+click also adds areas');
    await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
    assert.equal(await page.evaluate(()=>selectedAreas().length),5,'edit mode copies and pastes the selected group');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('adjust')),false,'pasting keeps edit mode active');
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('.drawing-zone').count(),1,'edit mode deletes only the pasted group');
    await groupText.click();
    let editStart=await pdfPoint(70,340),editEnd=await pdfPoint(330,445);
    await page.mouse.move(editStart.x,editStart.y);await page.mouse.down();await page.mouse.move(editEnd.x,editEnd.y,{steps:10});
    assert.equal(await page.locator('.selection-marquee').count(),1,'edit mode displays the dashed selection frame');
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>selectedAreas().length),3,'edit marquee replaces selection with drawing, text and checkbox');
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('field')),false,'marquee leaves text entry so group shortcuts work');
    await page.keyboard.down('Control');
    editStart=await pdfPoint(370,440);editEnd=await pdfPoint(425,475);
    await page.mouse.move(editStart.x,editStart.y);await page.mouse.down();await page.mouse.move(editEnd.x,editEnd.y,{steps:5});await page.mouse.up();
    await page.keyboard.up('Control');
    assert.equal(await page.evaluate(()=>selectedAreas().length),4,'Ctrl+marquee adds to the edit selection');
    editStart=await pdfPoint(370,490);editEnd=await pdfPoint(415,525);
    await page.mouse.move(editStart.x,editStart.y);await page.mouse.down();await page.mouse.move(editEnd.x,editEnd.y,{steps:5});
    await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await page.evaluate(()=>selectedAreas().length),4,'Escape restores the previous edit selection');
    assert.equal(await page.locator('.selection-marquee').count(),0);
    await page.locator('[data-id="selection-mark"]').click();
    assert.equal(await page.locator('[data-id="selection-mark"]').getAttribute('data-mask-style'),'ellipse','clicking a mark immediately after marquee still works');
    await groupText.click();
    assert.equal(await groupText.evaluate(e=>e===document.activeElement),true,'normal click focuses text after marquee cancellation');
    await page.keyboard.press('End');await page.keyboard.press('Backspace');
    assert.equal(await groupText.inputValue(),'Groupe tes','normal text deletion resumes after multiple selection');
    assert.equal(await page.evaluate(()=>selectedAreas().length),1);
    await page.evaluate(()=>{
      document.querySelector('[data-id="selection-mark"]').remove();select(null);collectCurrentPage();
      setEditTab('layer');
    });
    let p0=await pdfPoint(70,340),p1=await pdfPoint(330,445);
    await page.mouse.move(p0.x,p0.y);await page.mouse.down();await page.mouse.move(p1.x,p1.y,{steps:10});
    assert.equal(await page.locator('.selection-marquee').count(),1);
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>selectedAreas().length),3,'marquee selects drawing, text and checkbox');
    assert.equal(await page.locator('.selection-marquee').count(),0);
    if(process.env.QA_DIR)await page.locator(`[data-id="${drawingId}"]`).screenshot({path:path.join(process.env.QA_DIR,'drawing.png')});
    await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
    assert.equal(await page.evaluate(()=>selectedAreas().length),3,'pasted group stays selected');
    const copied=await page.evaluate(()=>selectedAreas().map(e=>selectedData(e)));
    assert.deepEqual(copied.map(d=>d.type).sort(),['check','field','image']);
    assert.equal(copied.find(d=>d.type==='image').drawing.strokes.length,2);
    assert.equal(copied.find(d=>d.type==='field').x-copied.find(d=>d.type==='image').x,170,'relative group positions preserved');
    await page.locator('#alignLeft').click();
    assert.equal(await page.evaluate(()=>new Set(selectedAreas().map(e=>e.style.left)).size),1,'alignment includes mixed field types');
    await page.keyboard.press('Delete');
    assert.equal(await page.evaluate(()=>getPageState(1).images.length),1,'only pasted drawing deleted');
    assert.equal(await page.locator('[data-id="outside-mask"]').count(),1);
    await page.evaluate(()=>undoAction());assert.equal(await page.evaluate(()=>getPageState(1).images.length),2);
    await page.evaluate(()=>redoAction());assert.equal(await page.evaluate(()=>getPageState(1).images.length),1);
    const drawingExport=await page.evaluate(async()=>{
      let blob;const picker=window.showSaveFilePicker;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>{blob=b;},close:async()=>{}})});
      try{await exportDocument();}finally{window.showSaveFilePicker=picker;}
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pg=await pdf.getPage(1),ops=await pg.getOperatorList();
      const embedded=ops.fnArray.filter(op=>op===pdfjsLib.OPS.paintImageXObject).length;await pdf.destroy();return embedded;
    });
    assert.ok(drawingExport>=1,'drawing embedded into exported PDF');
    const savedDrawing=await page.evaluate(async()=>{
      const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};await loadPdf(new Uint8Array(pdfBytes),'drawing-saved.pdf',state);
      return getPageState(1).images[0].drawing.strokes.length;
    });
    assert.equal(savedDrawing,2,'editable drawing restored from saved project');
    const layoutDrawing=await page.evaluate(async()=>{const layout=layoutSnapshot(),empty=layout.pageStates[1].images[0].drawing.strokes.length;await applyLayout(layout);return {empty,preserved:getPageState(1).images[0].drawing.strokes.length};});
    assert.deepEqual(layoutDrawing,{empty:0,preserved:2},'overlay stores an empty drawing area and preserves an existing drawing when reapplied');

    await page.evaluate(()=>setEditTab('layer'));
    const resizeDrawing=async(dx,dy)=>{
      const handle=page.locator(`[data-id="${drawingId}"] .image-resize`);await handle.scrollIntoViewIfNeeded();const b=await handle.boundingBox(),scale=await page.evaluate(()=>scaleNow);
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx*scale,b.y+b.height/2+dy*scale,{steps:8});await page.mouse.up();
      return page.evaluate(()=>getPageState(1).images[0]);
    };
    const widerDrawing=await resizeDrawing(40,0);
    assert.equal(widerDrawing.w,190);assert.equal(widerDrawing.h,90,'drawing width changes without changing height');
    const tallerDrawing=await resizeDrawing(0,35);
    assert.equal(tallerDrawing.w,190,'drawing height changes without changing width');assert.equal(tallerDrawing.h,125);
    assert.equal(tallerDrawing.drawing.strokes.length,2,'resizing retains editable strokes');
    await page.evaluate(()=>undoAction());assert.equal(await page.evaluate(()=>getPageState(1).images[0].h),90);
    await page.evaluate(()=>redoAction());assert.equal(await page.evaluate(()=>getPageState(1).images[0].h),125);
    const resizedSaved=await page.evaluate(async()=>{
      const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};await loadPdf(new Uint8Array(pdfBytes),'resized-drawing.pdf',state);
      const data=getPageState(1).images[0],img=new Image();img.src=data.src;await img.decode();return {w:data.w,h:data.h,strokes:data.drawing.strokes.length,imageRatio:img.naturalWidth/img.naturalHeight};
    });
    assert.deepEqual([resizedSaved.w,resizedSaved.h,resizedSaved.strokes],[190,125,2]);
    assert.ok(Math.abs(resizedSaved.imageRatio-190/125)<.01,'export image reflects the independent dimensions');
    assert.equal(await page.locator('#clearDrawing,#deleteItem').count(),0,'unwanted buttons removed');

    for(const [num,y,xs,count] of [[1,394,[140,178,245],8],[1,692,[355,447],8],[2,437,[63,120,178],9]]){
      await load('cerfa_14599-01.pdf',num);
      const groups=await page.evaluate(async({y,xs})=>{
        const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
        return xs.map(x=>detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,x,y,text));
      },{y,xs});
      for(const group of groups)assert.equal(group?.boxes?.length,count,`complete date/amount at page ${num}, y=${y}`);
      const placedId=await page.evaluate(async({x,y})=>{
        beginPlacement('text');await anchorTextPlacement({x,y:y-8,px:x,py:y});
        finalizePlacement(pendingPlacement);return selected.dataset.id;
      },{x:xs[0],y});
      const input=page.locator(`textarea[data-id="${placedId}"]`);
      await page.evaluate(()=>setEditTab('edit'));await input.fill('123456789'.slice(0,count));
      await page.waitForTimeout(150);
      const fixed=await page.evaluate(id=>{
        const e=document.querySelector(`textarea[data-id="${id}"]`),layer=document.querySelector(`.box-char-layer[data-for-id="${id}"]`);
        e.blur();return {count:fieldBoxData(e).length,text:layer.textContent,boxes:fieldBoxData(e),y:fieldLineData(e)};
      },placedId);
      assert.equal(fixed.count,count);assert.ok(fixed.text.includes('123456789'.slice(0,count)));
      if(num===2)assert.ok(fixed.boxes[7].x-fixed.boxes[6].x-fixed.boxes[6].w>5,'printed comma remains between integer and decimal cells');
      if(process.env.QA_DIR){
        const crop=await page.evaluate(({y})=>{window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+30*scaleNow,y:r.y+(y-20)*scaleNow,width:510*scaleNow,height:45*scaleNow};},{y});
        await page.screenshot({path:path.join(process.env.QA_DIR,`cells-${num}-${y}.png`),clip:crop,fullPage:true});
      }
    }

    await load('cerfa_14599-01.pdf');
    // Real SIRET guide: antialiasing at these render scales used to split the
    // fourteen cells into overlapping partial groups (sometimes just two cells).
    for(const quality of [3.055,3.3,3.95,4]){
      const siret=await page.evaluate(async quality=>{
        const pg=await pdfProxy.getPage(1),canvas=document.getElementById('pdfCanvas'),vp=pg.getViewport({scale:quality});
        canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
        await pg.render({canvasContext:canvas.getContext('2d'),viewport:vp,annotationMode:pdfjsLib.AnnotationMode.DISABLE}).promise;
        const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
        const groups=detectPageBoxGroups(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,text).filter(g=>Math.abs(g.lineY-197)<3);
        beginPlacement('text');await anchorTextPlacement({x:305,y:188,px:305,py:195});finalizePlacement(pendingPlacement);
        const id=selected.dataset.id;setEditTab('edit');
        return {groups:groups.map(g=>g.boxes.length),id};
      },quality);
      assert.deepEqual(siret.groups,[14],`one complete SIRET group at render scale ${quality}`);
      await page.locator(`[data-id="${siret.id}"]`).pressSequentially('QSDQSDQSDQSD');
      const typed=await page.evaluate(id=>{
        const e=document.querySelector(`[data-id="${id}"]`),layer=document.querySelector(`.box-char-layer[data-for-id="${id}"]`);
        const chars=[...layer.querySelectorAll('.box-char')].map(c=>({text:c.textContent,x:parseFloat(e.style.left)+parseFloat(c.style.left)+parseFloat(c.style.width)/2}));
        return {value:e.value,count:fieldBoxData(e).length,chars};
      },siret.id);
      assert.equal(typed.value,'QSDQSDQSDQSD');assert.equal(typed.count,14);
      assert.equal(typed.chars.map(c=>c.text).join(''),'QSDQSDQSDQSD');
      typed.chars.forEach((c,i)=>assert.ok(Math.abs(c.x-(310+i*13.35))<1.2,`character ${i+1} fills cell ${i+1}, without a skipped cell`));
      if(process.env.QA_DIR&&quality===4){
        const crop=await page.evaluate(()=>{document.activeElement.blur();document.body.classList.add('clean');window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+30*scaleNow,y:r.y+180*scaleNow,width:475*scaleNow,height:24*scaleNow};});
        await page.screenshot({path:path.join(process.env.QA_DIR,'siret-continuous.png'),clip:crop,fullPage:true});
        await page.evaluate(()=>document.body.classList.remove('clean'));
      }
      await page.evaluate(()=>deleteSelected());
    }
    await page.evaluate(()=>renderPage(1));
    const resizeSeed=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();
      const group=detectPageBoxGroups(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,text).find(g=>g.y>380&&g.y<405);
      const boxes=group.boxes.slice(0,4),w=boxes.at(-1).x+boxes.at(-1).w-group.x;
      createTextDom({id:'resize-date',x:group.x,y:group.y,w,h:group.h,boxes,lineY:group.lineY,value:'12 45678',manualPlacement:true});
      setEditTab('layer');setZoom(.65);collectCurrentPage();historyCheckpoint('Truncated delimited date');
      return {group,boxes,w};
    });
    const resizeTo=async width=>{
      const handle=page.locator('.text-resize[data-for-id="resize-date"]');await handle.scrollIntoViewIfNeeded();
      const b=await handle.boundingBox(),delta=await page.evaluate(width=>(width-parseFloat(document.querySelector('[data-id="resize-date"]').style.width))*scaleNow,width);
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+delta,b.y+b.height/2,{steps:8});await page.mouse.up();
      return page.evaluate(()=>selectedData(document.querySelector('[data-id="resize-date"]')));
    };
    const extended=await resizeTo(resizeSeed.group.w);
    assert.equal(extended.boxes.length,8,'extending a partial date finds its remaining cells without filling date separators');
    assert.deepEqual(extended.boxes.slice(0,4),resizeSeed.boxes,'existing cell widths and gaps survive resizing');
    assert.equal(extended.value,'12 45678','typed spaces are preserved');
    const beyond=await resizeTo(resizeSeed.group.w+30);
    assert.equal(beyond.boxes.length,8,'extending beyond recognized cells must not discard delimited mode');
    assert.deepEqual(beyond.boxes,extended.boxes,'unrecognized extra width does not distort recognized spaces');
    assert.ok(Math.abs(beyond.w-resizeSeed.group.w-30)<.1,'manual width is preserved');
    await page.evaluate(()=>undoAction());
    assert.equal(await page.evaluate(()=>fieldBoxData(document.querySelector('[data-id="resize-date"]')).length),8);
    await page.evaluate(()=>redoAction());
    assert.equal(await page.evaluate(()=>fieldBoxData(document.querySelector('[data-id="resize-date"]')).length),8);

    const restoredResize=await page.evaluate(async()=>{
      collectCurrentPage();const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};
      await loadPdf(new Uint8Array(pdfBytes),'resized-date.pdf',state);setEditTab('edit');
      const e=document.querySelector('[data-id="resize-date"]');e.focus();
      return selectedData(e);
    });
    assert.deepEqual(restoredResize.boxes,beyond.boxes,'resized cell spacing survives saving and reloading');
    assert.equal(restoredResize.value,'12 45678');
    const spacedChar=await page.evaluate(()=>{
      const layer=document.querySelector('.box-char-layer[data-for-id="resize-date"]');
      return [...layer.querySelectorAll('.box-char')].map(e=>({char:e.textContent,x:parseFloat(e.style.left)}));
    });
    assert.equal(spacedChar.map(c=>c.char).join(''),'1245678');
    assert.ok(Math.abs(spacedChar[2].x-(beyond.boxes[3].x-beyond.x))<.01,'the character after a typed space stays in its original cell');
    await page.evaluate(()=>setEditTab('layer'));
    const shortened=await resizeTo(resizeSeed.w);
    assert.deepEqual(shortened.boxes,resizeSeed.boxes,'shortening only removes cells outside the field');
    const reextended=await resizeTo(resizeSeed.group.w);
    assert.equal(reextended.boxes.length,8,'cells can be recognized again after shortening');
    assert.deepEqual(reextended.boxes.slice(0,4),resizeSeed.boxes);

    const shortLine=await page.evaluate(async()=>{
      const ac=makeAnalysisCanvas(),text=await getPagePrintedTextBoxes();return detectBestHorizontalAtPoint(ac.ctx,ac.canvas.width,ac.canvas.height,ac.q,208,223,text);
    });
    assert.ok(shortLine&&shortLine.x>=188&&shortLine.x+shortLine.w<229,'short street-number dots stop before Voie');
    const shortPlacement=await page.evaluate(async()=>{
      beginPlacement('text');await anchorTextPlacement({x:195,y:215,px:195,py:223});
      const result={detected:pendingPlacement.detectedWidth,right:pendingPlacement.x+pendingPlacement.w};cancelPlacement(false);return result;
    });
    assert.ok(shortPlacement.detected&&shortPlacement.right<229,'short dots recognized during placement');
    const dragBy=async(selector,dx,dy=0)=>{
      const area=page.locator(selector);await area.scrollIntoViewIfNeeded();const b=await area.boundingBox(),scale=await page.evaluate(()=>scaleNow);
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx*scale,b.y+b.height/2+dy*scale,{steps:8});await page.mouse.up();
      await page.waitForTimeout(180);
      return page.evaluate(selector=>selectedData(document.querySelector(selector)),selector);
    };
    const movedDate=await dragBy('[data-id="resize-date"]',-5,2);
    assert.ok(Math.abs(movedDate.x-(reextended.x-5))<.1,'delimited field stays at the dragged position');
    assert.ok(Math.abs(movedDate.y-(reextended.y+2))<.1);
    for(let i=0;i<8;i++)assert.ok(Math.abs(movedDate.boxes[i].x-(reextended.boxes[i].x-5))<.1,'cell coordinates move with the field');
    await page.evaluate(()=>{createCheckDom({id:'free-check',x:189.375,y:350.625,w:11.25,h:10,detected:true,checked:true});collectCurrentPage();});
    const movedCheck=await dragBy('[data-id="free-check"]',-4);
    assert.ok(Math.abs(movedCheck.x-185.375)<.1,'checkbox no longer snaps back to the printed box');
    await page.evaluate(async()=>{collectCurrentPage();const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};await loadPdf(new Uint8Array(pdfBytes),'moved.pdf',state);});
    assert.ok(Math.abs(await page.evaluate(()=>parseFloat(document.querySelector('[data-id="resize-date"]').style.left))-movedDate.x)<.1,'manual position survives reload');
    assert.ok(Math.abs(await page.evaluate(()=>parseFloat(document.querySelector('[data-id="free-check"]').style.left))-movedCheck.x)<.1);
    assert.equal(await page.locator('#maskStyle').count(),0,'no mask dropdown');
    const marks=[];
    for(const [style,x,w] of [['ellipse',35,44],['strike',229,24]]){
      await page.evaluate(()=>{setEditTab('layer');textColor.value='#cc2244';});await page.locator('#addMark').click();
      const mark=await page.evaluate(({x,w})=>{
        Object.assign(pendingPlacement,{x,y:216,w,h:14,visible:true});applyPlacementGhost();
        const preview=!!document.querySelector('#placementGhost.empty-mark');finalizePlacement(pendingPlacement);
        return {preview,...selectedData()};
      },{x,w});
      assert.ok(mark.preview);assert.equal(mark.maskStyle,'mark');assert.equal(mark.textColor,'#cc2244');marks.push(mark);
      // selectedData intentionally excludes IDs: read the selected element for UI clicks.
      const id=await page.evaluate(()=>selected.dataset.id),zone=page.locator(`.mask-zone[data-id="${id}"]`);
      await zone.click();assert.equal(await zone.locator('line,rect').count(),0,'creation mode only places/selects the area');
      await page.evaluate(()=>setEditTab('edit'));
      await zone.click();assert.equal(await zone.locator('line').count(),1,'first edit click strikes through');
      await zone.click();assert.equal(await zone.locator('rect').count(),1,'second edit click circles');
      await zone.click();assert.equal(await zone.locator('line,rect').count(),0,'third edit click clears');
      await page.evaluate(()=>undoAction());assert.equal(await zone.locator('rect').count(),1,'mark changes support undo');
      await page.evaluate(()=>redoAction());assert.equal(await zone.locator('line,rect').count(),0);
      await zone.click();if(style==='ellipse')await zone.click();
      assert.equal(await zone.getAttribute('data-mask-style'),style);
    }
    await page.evaluate(()=>{textColor.value='#2244cc';applyTextColor();});
    assert.equal(await page.locator('.mask-zone.mark-mask').last().locator('line').getAttribute('stroke'),'#2244cc','selected mask uses the font color control');
    await page.evaluate(()=>{textColor.value='#cc2244';applyTextColor();copySelected();pasteSelected();});
    assert.equal(await page.locator('.mask-zone.mark-mask').count(),3);
    assert.equal(await page.evaluate(()=>selectedData().maskStyle),'strike');
    await page.keyboard.press('Delete');assert.equal(await page.locator('.mask-zone.mark-mask').count(),2);
    await page.evaluate(async()=>{collectCurrentPage();const state={pageStates:JSON.parse(JSON.stringify(pageStates)),currentPage:1};await loadPdf(new Uint8Array(pdfBytes),'marked.pdf',state);});
    assert.equal(await page.locator('.mask-zone.mark-mask').count(),2);
    assert.deepEqual(await page.evaluate(()=>layoutSnapshot().pageStates[1].masks.map(m=>[m.maskStyle,m.textColor])),[['mark','#cc2244'],['mark','#cc2244']],'overlay stores unmarked areas');
    if(process.env.QA_DIR){
      const crop=await page.evaluate(()=>{window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+30*scaleNow,y:r.y+208*scaleNow,width:250*scaleNow,height:28*scaleNow};});
      await page.screenshot({path:path.join(process.env.QA_DIR,'mark-masks.png'),clip:crop,fullPage:true});
    }
    const markExport=await page.evaluate(async()=>{
      let blob;const picker=window.showSaveFilePicker;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>{blob=b;},close:async()=>{}})});
      try{await exportDocument();}finally{window.showSaveFilePicker=picker;}
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pg=await pdf.getPage(1),rv=pg.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=rv.width;canvas.height=rv.height;
      await pg.render({canvasContext:canvas.getContext('2d'),viewport:rv}).promise;
      const crop=document.createElement('canvas');crop.width=500;crop.height=56;crop.getContext('2d').drawImage(canvas,60,416,500,56,0,0,500,56);
      const d=crop.getContext('2d').getImageData(0,0,500,56).data;let red=0;for(let i=0;i<d.length;i+=4)if(d[i]>120&&d[i+1]<110&&d[i+2]<130)red++;
      await pdf.destroy();return {red,image:crop.toDataURL('image/png').split(',')[1]};
    });
    assert.ok(markExport.red>150,'circle and strike exported in the selected color');
    if(process.env.QA_DIR)fs.writeFileSync(path.join(process.env.QA_DIR,'mark-masks-export.png'),Buffer.from(markExport.image,'base64'));


    await page.evaluate(()=>{setEditTab('layer');cancelPlacement(false);});await page.locator('#addMark').click();
    const markPoint=async(x,y)=>page.evaluate(({x,y})=>{const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+x*scaleNow,y:r.y+y*scaleNow};},{x,y});
    // Choose a separate printed row so existing areas cannot intercept the pointer.
    let mp=await markPoint(37,274);await page.mouse.move(mp.x,mp.y);
    await page.waitForFunction(()=>pendingPlacement?.markLineDetected===true);
    const lineHover=await page.evaluate(()=>({x:pendingPlacement.x,y:pendingPlacement.y,w:pendingPlacement.w,h:pendingPlacement.h}));
    assert.ok(lineHover.y>269&&lineHover.y<281&&lineHover.h>=5&&lineHover.h<18,'mark follows the printed glyph band');
    mp=await markPoint(37,277);await page.mouse.move(mp.x,mp.y);
    await page.waitForFunction(()=>pendingPlacement?.lastPY>276);
    await page.waitForFunction(()=>pendingPlacement?.markLineDetected===true);
    assert.equal(await page.evaluate(()=>pendingPlacement.y),lineHover.y,'small pointer drift stays on the same text line');
    await page.mouse.click(mp.x,mp.y);
    await page.waitForFunction(()=>pendingPlacement?.stage==='hover'&&selected?.dataset.maskStyle==='mark');
    const alignedMark=await page.evaluate(()=>({id:selected.dataset.id,...selectedData()}));
    assert.ok(Math.abs(alignedMark.y-lineHover.y)<.01&&Math.abs(alignedMark.h-lineHover.h)<.01,'click confirms the detected line geometry');
    assert.ok(Math.abs(alignedMark.x-lineHover.x)<.6);assert.equal(alignedMark.w,lineHover.w,'line detection leaves width manual');
    await page.keyboard.press('Escape');
    const manualMark=await dragBy(`.mask-zone[data-id="${alignedMark.id}"]`,-3,4);
    assert.ok(Math.abs(manualMark.y-alignedMark.y-4)<.6,'manual mark movement remains free after recognition');
    await page.waitForTimeout(450); // Let the drag's synthetic-click suppression expire.
    await page.locator('#addMark').click();
    mp=await markPoint(37,308);await page.mouse.click(mp.x,mp.y);
    await page.waitForFunction(()=>pendingPlacement?.stage==='hover'&&selected?.dataset.maskStyle==='mark');
    assert.equal(await page.evaluate(()=>getPageState(1).masks.at(-1).maskStyle),'mark','quick click creates an unmarked area');
    mp=await markPoint(570,280);await page.mouse.move(mp.x,mp.y);
    await page.waitForFunction(()=>pendingPlacement?.lastPX>569&&!pendingPlacement.markLineDetected);
    assert.equal(await page.evaluate(()=>document.getElementById('placementGhost').classList.contains('detected')),false,'blank page margin does not report a text line');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>setEditTab('layer'));await page.locator('#addMark').click();
    const beforeRepeats=await page.locator('.mask-zone.mark-mask').count();
    for(const x of [320,390]){
      const pt=await page.evaluate(x=>{const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+x*scaleNow,y:r.y+235*scaleNow};},x);
      await page.mouse.click(pt.x,pt.y);
      await page.waitForFunction(()=>pendingPlacement?.type==='mask'&&pendingPlacement.stage==='hover'&&pendingPlacement.opts.maskStyle==='mark');
    }
    assert.equal(await page.locator('.mask-zone.mark-mask').count(),beforeRepeats+2,'each click places one mark area and rearms the tool');
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>pendingPlacement),null);
    const stoppedPoint=await page.evaluate(()=>{const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+470*scaleNow,y:r.y+235*scaleNow};});
    await page.mouse.click(stoppedPoint.x,stoppedPoint.y);assert.equal(await page.locator('.mask-zone.mark-mask').count(),beforeRepeats+2,'Escape stops repeated placement');
    await page.locator('#addMark').click();
    await page.evaluate(()=>{Object.assign(pendingPlacement,{x:320,y:255,w:75,h:22,visible:true});finalizePlacement(pendingPlacement);});
    await page.waitForFunction(()=>pendingPlacement?.type==='mask');
    assert.deepEqual(await page.evaluate(()=>[pendingPlacement.w,pendingPlacement.h]),[75,22],'next mark keeps the last size');
    await page.evaluate(()=>setEditTab('edit'));assert.equal(await page.evaluate(()=>pendingPlacement),null);
    await page.evaluate(()=>{addMark();Object.assign(pendingPlacement,{x:320,y:290,w:75,h:22,visible:true});finalizePlacement(pendingPlacement);setEditTab('edit');});
    await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>pendingPlacement),null,'switching to edit before deferred rearm cancels it');

    for(const [file,num] of [['cerfa_15036-02.pdf',2],['cerfa_15692-01.pdf',5],['cerfa_13406-17.pdf',5]]){
      await load(file,num);
      const choices=await page.evaluate(async()=>{
        const text=await getPagePrintedTextBoxes(),words=text.filter(t=>/^(Oui|Non)$/.test(t.text.trim())).slice(0,2);
        return words.map(t=>({word:t,probes:[.05,.5,.9].map(f=>detectMarkTextLine(t.x+t.w*f,t.baseline-t.h*.35,40,text))}));
      });
      assert.equal(choices.length,2);
      for(const {word,probes} of choices){
        for(const fit of probes){assert.ok(fit.h>=word.h,'choice height includes font metrics and padding');assert.ok(Math.abs(fit.x-word.x)<.01&&Math.abs(fit.w-word.w)<.01,'complete choice is fitted, independently of pointer position');}
        assert.deepEqual(probes[0],probes[1]);assert.deepEqual(probes[1],probes[2],'hovering on the final lowercase letter must not shrink the field');
      }
      if(file==='cerfa_15036-02.pdf'){
        const actual=await page.evaluate(async({word})=>{
          addMark();await fitMarkPlacement(pendingPlacement,{x:word.x+word.w*.8,y:word.y,px:word.x+word.w*.8,py:word.baseline-word.h*.35,w:40});
          const fit={x:pendingPlacement.x,y:pendingPlacement.y,w:pendingPlacement.w,h:pendingPlacement.h};finalizePlacement(pendingPlacement);setEditTab('edit');
          return {fit,id:selected.dataset.id};
        },choices[1]);
        assert.ok(actual.fit.w<20&&actual.fit.h>10,'Non no longer becomes a wide, thin strip');
        const marker=page.locator(`.mask-zone[data-id="${actual.id}"]`);await marker.click();await marker.click();
        if(process.env.QA_DIR){
          await page.evaluate(()=>setZoom(.65));
          const crop=await page.evaluate(()=>{window.scrollTo(0,0);const r=document.getElementById('pageSurface').getBoundingClientRect();return {x:r.x+48*scaleNow,y:r.y+616*scaleNow,width:100*scaleNow,height:28*scaleNow};});
          await page.screenshot({path:path.join(process.env.QA_DIR,'yes-no-recognition.png'),clip:crop,fullPage:true});
        }
      }
    }
    const combinedChoice=await page.evaluate(async()=>{
      const doc=await PDFLib.PDFDocument.create(),pg=doc.addPage([300,180]),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      pg.drawText('Oui Non',{x:80,y:100,size:10,font});await loadPdf(await doc.save(),'combined-choices.pdf');
      const text=await getPagePrintedTextBoxes(),nonX=80+font.widthOfTextAtSize('Oui ',10);
      return {words:text.map(t=>t.text),yes:detectMarkTextLine(86,76,40,text),no:detectMarkTextLine(nonX+15,76,40,text),nonX};
    });
    assert.ok(combinedChoice.words.some(t=>t.includes('Oui')&&t.includes('Non')),'fixture keeps both choices in one PDF text item');
    assert.ok(Math.abs(combinedChoice.yes.x-80)<.1&&Math.abs(combinedChoice.no.x-combinedChoice.nonX)<.1);
    assert.ok(combinedChoice.yes.x+combinedChoice.yes.w<combinedChoice.no.x,'combined PDF items still produce separate targets');
    await load('cerfa_13406-17.pdf',6);
    const largeId=await page.evaluate(()=>getPageState(6).fields.find(f=>f.h>100).id);
    await page.evaluate(()=>setEditTab('edit'));
    const largeInput=page.locator(`textarea[data-id="${largeId}"]`);
    await largeInput.fill(Array.from({length:24},(_,i)=>'Multiligne '+String(i+1).padStart(2,'0')).join('\n'));
    await page.waitForTimeout(150);
    const large=await page.evaluate(id=>{
      const e=document.querySelector(`textarea[data-id="${id}"]`);e.blur();updateFieldTextLayer(e);collectCurrentPage();
      const l=document.querySelector(`.field-text-layer[data-for-id="${id}"]`),geom=classicFieldTextGeometry(e);
      return {f:getPageState(6).fields.find(f=>f.id===id),geom,padding:parseFloat(e.style.paddingTop),lineHeight:parseFloat(e.style.lineHeight),mirrorHeight:parseFloat(l.style.height),overflow:l.style.overflow,blue:[e.style.getPropertyValue('--blue-top'),e.style.getPropertyValue('--blue-bottom')]};
    },largeId);
    assert.equal(large.padding,2,'large field starts at its top');assert.equal(large.f.lineY,null,'large field must not snap to a lower row');
    assert.equal(large.lineHeight,12);assert.equal(large.overflow,'hidden');assert.deepEqual(large.blue,['0.00%','100.00%']);
    assert.ok(large.mirrorHeight+large.padding<=large.f.h,'multiline mirror stays inside field');
    if(process.env.QA_DIR)await largeInput.screenshot({path:path.join(process.env.QA_DIR,'multiline.png')});
    const multilineExport=await page.evaluate(async()=>{
      let blob;const originalPicker=window.showSaveFilePicker;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>{blob=b;},close:async()=>{}})});
      try{await exportDocument();}finally{window.showSaveFilePicker=originalPicker;}
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,pg=await pdf.getPage(6),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();
      const lines=tc.items.filter(t=>t.str.startsWith('Multiligne')).map(t=>({text:t.str,y:vp.height-t.transform[5]}));
      const f=getPageState(6).fields.find(f=>f.h>100),canvas=document.createElement('canvas'),rv=pg.getViewport({scale:2});canvas.width=rv.width;canvas.height=rv.height;
      await pg.render({canvasContext:canvas.getContext('2d'),viewport:rv}).promise;
      const crop=document.createElement('canvas');crop.width=f.w*2;crop.height=f.h*2;crop.getContext('2d').drawImage(canvas,f.x*2,f.y*2,f.w*2,f.h*2,0,0,f.w*2,f.h*2);
      await pdf.destroy();return {lines,image:crop.toDataURL('image/png').split(',')[1]};
    });
    assert.equal(multilineExport.lines.length,large.geom.maxLines,'export clips to the same complete lines as the screen');
    assert.ok(Math.abs(multilineExport.lines[0].y-(large.f.y+large.geom.top+large.geom.baseline))<.01,'screen/export first baseline agrees');
    for(let i=1;i<multilineExport.lines.length;i++)assert.ok(Math.abs(multilineExport.lines[i].y-multilineExport.lines[i-1].y-large.lineHeight)<.01);
    assert.ok(multilineExport.lines.at(-1).y<large.f.y+large.f.h);
    if(process.env.QA_DIR)fs.writeFileSync(path.join(process.env.QA_DIR,'multiline-export.png'),Buffer.from(multilineExport.image,'base64'));
    assert.deepEqual(errors,[]);
    console.log('PASS: date/amount/dotted/table detection, multiline screen/export geometry, drawings, group operations, history and persistence.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
