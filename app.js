import * as THREE from './vendor/three.module.js';
import { changeHeight, cloneMap, createMap, getCell, normalizeMap, roundHeight } from './model.js';
import { applyFixedContinuousHeight, getContinuousTargetHeight } from './continuous-height.js';
import { EditHistory } from './history.js';
import { AUTO_SAVE_ID, listMapRecords, loadMapRecord, saveMapRecord } from './storage.js';
import { heightLabelText, panTargetDelta, renderHeight } from './view-utils.js';

const $ = (id) => document.getElementById(id);
const paletteColors = ['#7a8b79','#566573','#8e6e53','#708b45','#587ca3','#9b6a6c','#9b8b61','#725f8e','#4f8079','#9a8062','#5f666d','#b0a58c'];
const modeNames = { terrain:'地形', impassable:'侵入禁止', memo:'メモ', select:'選択' };
const helpText = {
  terrain:'地形：タップでHeightと色を編集します。連続編集ONでは1本指のスワイプで続けて編集します。',
  impassable:'侵入禁止：タップしたセルの侵入禁止を切り替えます。赤い表示が侵入禁止です。',
  memo:'メモ：セルを選び、左メニューのオブジェクトメモへ入力します。',
  select:'選択：タップしてセル情報を確認・編集します。'
};

let map = createMap();
let mode = 'terrain';
let terrainAction = 'add';
let selected = null;
let yaw = 45;
let pitch = 42;
let cameraDistance = 24;
const cameraTarget = new THREE.Vector3();
const history = new EditHistory();
let currentRecordId = null;
let autoSaveTimer = null;

const renderer = new THREE.WebGLRenderer({ canvas:$('map-canvas'), antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x111821);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x27313b, 2.1));
const directional = new THREE.DirectionalLight(0xffffff, 2.6);
directional.position.set(-10,18,8);
scene.add(directional);
const camera = new THREE.OrthographicCamera(-10,10,10,-10,.1,300);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const cellGroup = new THREE.Group();
const gridGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(cellGroup, gridGroup, labelGroup);
const selectionMesh = new THREE.Mesh(new THREE.BoxGeometry(1.04,1,1.04),new THREE.MeshBasicMaterial({ color:0xffff66, wireframe:true, depthTest:false }));
selectionMesh.visible=false;
selectionMesh.renderOrder=20;
scene.add(selectionMesh);
const cellMeshes=[];
const heightLabels=[];
const heightLabelMaterials=new Map();
const labelGeometry=new THREE.PlaneGeometry(.74,.74);
const activePointers=new Map();
const editedDuringGesture=new Set();
let gesture=null;

function buildHeightOptions() {
  for (let value=.5; value<=10; value+=.5) {
    const option=document.createElement('option'); option.value=value; option.textContent=value.toFixed(1); $('height-amount').append(option);
  }
}

function buildPalette() {
  for (const color of paletteColors) {
    const button=document.createElement('button'); button.type='button'; button.style.background=color; button.title=color;
    button.addEventListener('click',()=>{ $('current-color').value=color; updateStatus(); buildPaletteState(); }); $('palette').append(button);
  }
  buildPaletteState();
}

function buildPaletteState() {
  [...$('palette').children].forEach((button)=>button.classList.toggle('active',button.title.toLowerCase()===$('current-color').value.toLowerCase()));
}

function clearGroup(group) {
  while (group.children.length) {
    const item=group.children[0]; group.remove(item);
    item.traverse?.((child)=>{ child.geometry?.dispose(); if (Array.isArray(child.material)) child.material.forEach((m)=>m.dispose()); else child.material?.dispose(); });
  }
}

function labelMaterial(height) {
  const text=heightLabelText(height);
  if(heightLabelMaterials.has(text))return heightLabelMaterials.get(text);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const context=canvas.getContext('2d');context.textAlign='center';context.textBaseline='middle';
  context.font='bold 132px sans-serif';context.lineJoin='round';
  context.strokeStyle='#17202a';context.lineWidth=15;
  context.strokeText(text,128,132);context.fillStyle='#ffffff';context.fillText(text,128,132);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide});
  heightLabelMaterials.set(text,material);return material;
}

function updateHeightLabel(cell) {
  const label=heightLabels[cell.z*map.width+cell.x];
  label.material=labelMaterial(cell.height);
  label.position.y=renderHeight(cell.height)+.018;
  label.visible=$('show-height').checked;
}

function updateMeshParts(root,cell) {
  const height=renderHeight(cell.height);
  const block=root.getObjectByName('block'); block.scale.y=height; block.position.y=height/2; block.material.color.set(cell.color);
  const blocked=root.getObjectByName('blocked'); blocked.scale.y=height+.06; blocked.position.y=height/2+.03; blocked.visible=cell.impassable;
}

function makeCellMesh(cell,centerX,centerZ) {
  const root=new THREE.Group(); root.position.set(cell.x-centerX,0,cell.z-centerZ); root.userData={x:cell.x,z:cell.z};
  const block=new THREE.Mesh(new THREE.BoxGeometry(.94,1,.94),new THREE.MeshStandardMaterial({ color:cell.color,roughness:.82 })); block.name='block'; root.add(block);
  const blocked=new THREE.Mesh(new THREE.BoxGeometry(.98,1.02,.98),new THREE.MeshBasicMaterial({ color:0xff3045,transparent:true,opacity:.43,depthWrite:false }));
  blocked.name='blocked'; blocked.renderOrder=5; root.add(blocked); updateMeshParts(root,cell); return root;
}

function addGrid(width,depth) {
  const material=new THREE.LineBasicMaterial({ color:0x405568,transparent:true,opacity:.85 }); const points=[];
  const x0=-width/2,x1=width/2,z0=-depth/2,z1=depth/2;
  for(let x=0;x<=width;x+=1) points.push(new THREE.Vector3(x0+x,.04,z0),new THREE.Vector3(x0+x,.04,z1));
  for(let z=0;z<=depth;z+=1) points.push(new THREE.Vector3(x0,.04,z0+z),new THREE.Vector3(x1,.04,z0+z));
  gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),material));
}

function rebuildScene() {
  clearGroup(cellGroup); clearGroup(gridGroup); cellMeshes.length=0;
  labelGroup.clear();heightLabels.length=0;
  for(const material of heightLabelMaterials.values()){material.map.dispose();material.dispose();}
  heightLabelMaterials.clear();
  const centerX=(map.width-1)/2,centerZ=(map.depth-1)/2;
  for(const cell of map.cells){
    const root=makeCellMesh(cell,centerX,centerZ);cellGroup.add(root);cellMeshes.push(root);
    const label=new THREE.Mesh(labelGeometry,labelMaterial(cell.height));label.rotation.x=-Math.PI/2;
    label.position.set(cell.x-centerX,0,cell.z-centerZ);labelGroup.add(label);heightLabels.push(label);
    updateHeightLabel(cell);
  }
  addGrid(map.width,map.depth); frameCamera(); updateSelection();
}

function updateCamera() {
  const phi=THREE.MathUtils.degToRad(90-pitch),theta=THREE.MathUtils.degToRad(yaw);
  camera.position.set(cameraTarget.x+cameraDistance*Math.sin(phi)*Math.sin(theta),cameraTarget.y+cameraDistance*Math.cos(phi),cameraTarget.z+cameraDistance*Math.sin(phi)*Math.cos(theta));
  camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
  $('hud-camera').textContent=`${Math.round(pitch)}° / ${((Math.round(yaw)%360)+360)%360}°`;
}

function frameCamera() {
  const aspect=renderer.domElement.clientWidth/Math.max(renderer.domElement.clientHeight,1);
  const projectedWidth=(map.width+map.depth)*Math.SQRT1_2;
  const size=Math.max(Math.max(map.width,map.depth)*.72,projectedWidth*.54/aspect);
  camera.left=-size*aspect; camera.right=size*aspect; camera.top=size; camera.bottom=-size; camera.zoom=1; cameraDistance=Math.max(map.width,map.depth)*1.65;
  cameraTarget.set(0,Math.max(...map.cells.map((cell)=>renderHeight(cell.height)),0)*.22,0); updateCamera();
}

function panCamera(dx,dy) {
  const delta=panTargetDelta({dx,dy,yaw,pitch,top:camera.top,bottom:camera.bottom,zoom:camera.zoom,viewportHeight:renderer.domElement.clientHeight});
  cameraTarget.x+=delta.x;cameraTarget.z+=delta.z;
  updateCamera();
}

function updateCellMesh(cell){updateMeshParts(cellMeshes[cell.z*map.width+cell.x],cell);updateHeightLabel(cell);updateSelection();}

function pickCell(point) {
  const rect=renderer.domElement.getBoundingClientRect(); pointerNdc.x=((point.clientX-rect.left)/rect.width)*2-1; pointerNdc.y=-((point.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointerNdc,camera); let object=raycaster.intersectObjects(cellMeshes,true)[0]?.object||null;
  while(object&&object.parent!==cellGroup)object=object.parent; return object?.parent===cellGroup?object:null;
}

function isAllowedSwipeCell(mesh) {
  if(!gesture?.startCell)return true; const {x,z}=mesh.userData,start=gesture.startCell.userData;
  if(!$('edit-x').checked&&x!==start.x)return false; if(!$('edit-z').checked&&z!==start.z)return false; return true;
}

function editCell(mesh,continuous=false) {
  if(!mesh||(continuous&&!isAllowedSwipeCell(mesh)))return; const key=`${mesh.userData.x},${mesh.userData.z}`; if(editedDuringGesture.has(key))return; editedDuringGesture.add(key);
  const cell=getCell(map,mesh.userData.x,mesh.userData.z); selected=cell;
  if(mode==='terrain'){
    if($('change-height').checked){
      if(continuous&&!$('edit-y').checked&&gesture?.targetHeight!==null) applyFixedContinuousHeight(cell,gesture.targetHeight,terrainAction);
      else changeHeight(cell,(terrainAction==='add'?1:-1)*Number($('height-amount').value));
    }
    if(terrainAction==='add')cell.color=$('current-color').value;updateCellMesh(cell);
  }
  else if(mode==='impassable'){cell.impassable=!cell.impassable;updateCellMesh(cell);} updateSelection(); if(mode==='memo')setTimeout(()=>$('selected-memo').focus(),0);
}

function updateHistoryButtons() {
  $('undo').disabled=!history.canUndo; $('redo').disabled=!history.canRedo;
}

function setSaveStatus(message,failed=false) {
  $('save-status').textContent=message; $('save-status').classList.toggle('error',failed);
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer); setSaveStatus('変更を保存中…');
  autoSaveTimer=setTimeout(async()=>{
    try { await saveMapRecord(AUTO_SAVE_ID,map); setSaveStatus(`自動保存済み ${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`); }
    catch(error) { console.error(error); setSaveStatus('自動保存に失敗しました',true); }
  },350);
}

async function refreshSavedMaps(selectedId=currentRecordId) {
  const records=await listMapRecords(); $('saved-maps').replaceChildren();
  if(!records.length){const option=new Option('保存済みマップはありません','');$('saved-maps').add(option);$('load-named').disabled=true;return;}
  $('load-named').disabled=false;
  for(const record of records){const date=new Date(record.updatedAt).toLocaleString('ja-JP');const option=new Option(`${record.mapName}（${date}）`,record.id);$('saved-maps').add(option);}
  if(selectedId&&records.some((record)=>record.id===selectedId))$('saved-maps').value=selectedId;
}

function commitGesture(before) {
  if(before&&history.commit(before,map)){updateHistoryButtons();scheduleAutoSave();}
}

function restoreMap(next) {
  if(!next)return; map=next; selected=null; $('map-name').value=map.mapName; rebuildScene(); updateHistoryButtons(); scheduleAutoSave();
}

function updateSelection() {
  const fields=['cell-x','cell-z','cell-height','cell-color','cell-impassable'];
  if(!selected){selectionMesh.visible=false;fields.forEach((id)=>$(id).textContent='—');$('cell-editor').hidden=true;return;}
  const root=cellMeshes[selected.z*map.width+selected.x],height=renderHeight(selected.height); selectionMesh.visible=true; selectionMesh.position.copy(root.position); selectionMesh.position.y=height/2; selectionMesh.scale.set(1,height,1);
  $('cell-x').textContent=selected.x;$('cell-z').textContent=selected.z;$('cell-height').textContent=selected.height.toFixed(1);$('cell-color').textContent=selected.color;$('cell-impassable').textContent=selected.impassable?'ON':'OFF';
  $('cell-editor').hidden=false;$('selected-height').value=selected.height.toFixed(1);$('selected-color').value=selected.color;$('selected-impassable').checked=selected.impassable;$('selected-memo').value=selected.memo;
}

function updateStatus() {
  $('hud-mode').textContent=mode==='terrain'?`${modeNames[mode]}・${terrainAction==='add'?'配置':'消去'}`:modeNames[mode];$('hud-height').textContent=Number($('height-amount').value).toFixed(1);$('hud-color').style.background=$('current-color').value;$('hud-continuous').textContent=$('continuous-edit').checked?'ON':'OFF';$('help').textContent=helpText[mode];
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const center=(values)=>{const list=[...values];return{x:list.reduce((s,p)=>s+p.x,0)/list.length,y:list.reduce((s,p)=>s+p.y,0)/list.length};};
renderer.domElement.addEventListener('contextmenu',(event)=>event.preventDefault());
renderer.domElement.addEventListener('pointerdown',(event)=>{
  event.preventDefault();renderer.domElement.setPointerCapture(event.pointerId);activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(activePointers.size===1){
    editedDuringGesture.clear();const startCell=pickCell(event);
    const startHeight=startCell?getCell(map,startCell.userData.x,startCell.userData.z).height:0;
    const targetHeight=mode==='terrain'&&$('change-height').checked&&!$('edit-y').checked&&startCell
      ?getContinuousTargetHeight(startHeight,Number($('height-amount').value),terrainAction):null;
    gesture={start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},startCell,targetHeight,moved:false,camera:event.button===2||event.button===1,pan:event.button===1||(event.button===2&&event.shiftKey),before:cloneMap(map)};
  }
  else if(activePointers.size===2){const list=[...activePointers.values()];gesture={camera:true,moved:true,lastCenter:center(list),lastDistance:distance(list[0],list[1])};editedDuringGesture.clear();}
});
renderer.domElement.addEventListener('pointermove',(event)=>{
  if(!activePointers.has(event.pointerId))return;activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(activePointers.size>=2){const list=[...activePointers.values()].slice(0,2),mid=center(list),gap=distance(list[0],list[1]);if(gesture?.lastCenter){if($('two-finger-mode').value==='pan')panCamera(mid.x-gesture.lastCenter.x,mid.y-gesture.lastCenter.y);else{if(!$('lock-y').checked)yaw-=(mid.x-gesture.lastCenter.x)*.28;if(!$('lock-x').checked)pitch=Math.max(0,Math.min(90,pitch+(mid.y-gesture.lastCenter.y)*.22));}}if(gesture?.lastDistance&&!$('lock-z').checked)camera.zoom=Math.max(.3,Math.min(6,camera.zoom*(gap/gesture.lastDistance)));gesture={...gesture,camera:true,moved:true,lastCenter:mid,lastDistance:gap};updateCamera();return;}
  if(!gesture)return;const dx=event.clientX-gesture.last.x,dy=event.clientY-gesture.last.y,total=Math.hypot(event.clientX-gesture.start.x,event.clientY-gesture.start.y);if(total>6)gesture.moved=true;
  if(gesture.camera){if(gesture.pan)panCamera(dx,dy);else{if(!$('lock-y').checked)yaw-=dx*.3;if(!$('lock-x').checked)pitch=Math.max(0,Math.min(90,pitch+dy*.24));updateCamera();}}else if(gesture.moved&&$('continuous-edit').checked){if(!editedDuringGesture.size)editCell(gesture.startCell,true);editCell(pickCell(event),true);}gesture.last={x:event.clientX,y:event.clientY};
});
function finishPointer(event){if(!activePointers.has(event.pointerId))return;const wasCamera=activePointers.size>1||gesture?.camera,before=gesture?.before;if(!gesture?.moved&&!wasCamera&&event.button!==2)editCell(pickCell(event));activePointers.delete(event.pointerId);if(!activePointers.size){if(!wasCamera)commitGesture(before);gesture=null;editedDuringGesture.clear();}else if(activePointers.size===1){const last=[...activePointers.values()][0];gesture={camera:true,pan:$('two-finger-mode').value==='pan',moved:true,start:last,last};}}
renderer.domElement.addEventListener('pointerup',finishPointer);renderer.domElement.addEventListener('pointercancel',finishPointer);
renderer.domElement.addEventListener('wheel',(event)=>{event.preventDefault();if($('lock-z').checked)return;camera.zoom=Math.max(.3,Math.min(6,camera.zoom*(event.deltaY>0?.9:1.1)));camera.updateProjectionMatrix();},{passive:false});

$('create-map').addEventListener('click',()=>{map=createMap($('map-name').value,$('map-width').value,$('map-depth').value);selected=null;currentRecordId=null;history.reset();updateHistoryButtons();rebuildScene();scheduleAutoSave();});
document.querySelectorAll('.mode').forEach((button)=>button.addEventListener('click',()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach((item)=>item.classList.toggle('active',item===button));updateStatus();}));
document.querySelectorAll('.terrain-action').forEach((button)=>button.addEventListener('click',()=>{terrainAction=button.dataset.action;document.querySelectorAll('.terrain-action').forEach((item)=>item.classList.toggle('active',item===button));updateStatus();}));
$('height-amount').addEventListener('change',updateStatus);$('current-color').addEventListener('input',()=>{updateStatus();buildPaletteState();});$('continuous-edit').addEventListener('change',updateStatus);
$('show-height').addEventListener('change',()=>{labelGroup.visible=$('show-height').checked;});
$('apply-cell').addEventListener('click',()=>{if(!selected)return;const before=cloneMap(map);selected.height=roundHeight($('selected-height').value);selected.color=$('selected-color').value;selected.impassable=$('selected-impassable').checked;selected.memo=$('selected-memo').value.slice(0,500);updateCellMesh(selected);updateSelection();commitGesture(before);});
$('undo').addEventListener('click',()=>restoreMap(history.undo(map)));
$('redo').addEventListener('click',()=>restoreMap(history.redo(map)));
const presets={top:{pitch:90,yaw:45},battle45:{pitch:42,yaw:45},battle135:{pitch:42,yaw:135},battle225:{pitch:42,yaw:225},battle315:{pitch:42,yaw:315},front:{pitch:0,yaw:0},right:{pitch:0,yaw:90}};
document.querySelectorAll('.camera-preset').forEach((button)=>button.addEventListener('click',()=>{const preset=presets[button.dataset.preset];pitch=preset.pitch;yaw=preset.yaw;camera.zoom=1;updateCamera();}));
$('reset-center').addEventListener('click',()=>{cameraTarget.x=0;cameraTarget.z=0;updateCamera();});
$('save-named').addEventListener('click',async()=>{
  map.mapName=$('map-name').value.trim()||'名称未設定マップ';
  currentRecordId=currentRecordId||`map-${crypto.randomUUID()}`;
  try{await saveMapRecord(currentRecordId,map);await refreshSavedMaps(currentRecordId);setSaveStatus(`「${map.mapName}」を保存しました`);scheduleAutoSave();}catch(error){console.error(error);setSaveStatus('名前付き保存に失敗しました',true);}
});
$('load-named').addEventListener('click',async()=>{
  const id=$('saved-maps').value;if(!id)return;
  try{const record=await loadMapRecord(id);if(!record)return;map=normalizeMap(record.map);currentRecordId=id;selected=null;history.reset();$('map-name').value=map.mapName;$('map-width').value=map.width;$('map-depth').value=map.depth;rebuildScene();updateHistoryButtons();setSaveStatus(`「${map.mapName}」を開きました`);scheduleAutoSave();}catch(error){console.error(error);setSaveStatus('マップを開けませんでした',true);}
});
function safeFileName(name){return String(name||'srpg-map').replace(/[\\/:*?"<>|]/g,'_').slice(0,80);}
function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=fileName;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-json').addEventListener('click',()=>{map.mapName=$('map-name').value.trim()||map.mapName;downloadBlob(new Blob([JSON.stringify(map,null,2)],{type:'application/json'}),`${safeFileName(map.mapName)}.json`);setSaveStatus('JSONを出力しました');});
$('import-json').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{
  const file=$('import-file').files?.[0];if(!file)return;
  try{map=normalizeMap(JSON.parse(await file.text()));currentRecordId=null;selected=null;history.reset();$('map-name').value=map.mapName;$('map-width').value=map.width;$('map-depth').value=map.depth;rebuildScene();updateHistoryButtons();scheduleAutoSave();setSaveStatus(`「${map.mapName}」を読み込みました`);}catch(error){console.error(error);setSaveStatus(`JSONを読み込めません: ${error.message}`,true);}finally{$('import-file').value='';}
});
$('export-top').addEventListener('click',()=>{
  const saved={yaw,pitch,zoom:camera.zoom,left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,width:renderer.domElement.width,height:renderer.domElement.height};
  const size=Math.max(map.width,map.depth)*.56;yaw=45;pitch=90;camera.left=-size;camera.right=size;camera.top=size;camera.bottom=-size;camera.zoom=1;renderer.setSize(1600,1600,false);updateCamera();renderer.render(scene,camera);
  renderer.domElement.toBlob((blob)=>{if(blob){downloadBlob(blob,`${safeFileName(map.mapName)}_Top.png`);setSaveStatus('真上確認画像を出力しました');}const box=$('workspace').getBoundingClientRect();renderer.setSize(box.width,box.height,false);yaw=saved.yaw;pitch=saved.pitch;camera.left=saved.left;camera.right=saved.right;camera.top=saved.top;camera.bottom=saved.bottom;camera.zoom=saved.zoom;updateCamera();},'image/png');
});
$('menu-toggle').addEventListener('click',()=>{document.body.classList.toggle('menu-collapsed');const collapsed=document.body.classList.contains('menu-collapsed');$('menu-toggle').textContent=collapsed?'メニューを開く':'メニューを折りたたむ';$('menu-toggle').setAttribute('aria-expanded',String(!collapsed));setTimeout(resize,0);});
function resize(){const box=$('workspace').getBoundingClientRect();renderer.setSize(box.width,box.height,false);const size=camera.top,aspect=box.width/Math.max(box.height,1);camera.left=-size*aspect;camera.right=size*aspect;camera.updateProjectionMatrix();}
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);}
async function start(){
  buildHeightOptions();buildPalette();updateStatus();updateHistoryButtons();
  try{const record=await loadMapRecord(AUTO_SAVE_ID);if(record?.map){map=normalizeMap(record.map);$('map-name').value=map.mapName;$('map-width').value=map.width;$('map-depth').value=map.depth;setSaveStatus('前回の自動保存を復元しました');}else setSaveStatus('自動保存を開始しました');await refreshSavedMaps();}catch(error){console.error(error);setSaveStatus('保存機能を開始できませんでした',true);}
  rebuildScene();resize();addEventListener('resize',resize);animate();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch((error)=>console.warn('Service Worker registration failed',error));}
}
start();
