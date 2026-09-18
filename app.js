import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { changeHeight, cloneMap, createMap, getCell, roundHeight } from './model.js';
import { EditHistory } from './history.js';

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
scene.add(cellGroup, gridGroup);
const selectionMesh = new THREE.Mesh(new THREE.BoxGeometry(1.04,1,1.04),new THREE.MeshBasicMaterial({ color:0xffff66, wireframe:true, depthTest:false }));
selectionMesh.visible=false;
selectionMesh.renderOrder=20;
scene.add(selectionMesh);
const cellMeshes=[];
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

function updateMeshParts(root,cell) {
  const height=Math.max(cell.height,.06);
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
  const centerX=(map.width-1)/2,centerZ=(map.depth-1)/2;
  for(const cell of map.cells){const root=makeCellMesh(cell,centerX,centerZ);cellGroup.add(root);cellMeshes.push(root);} addGrid(map.width,map.depth); frameCamera(); updateSelection();
}

function updateCamera() {
  const phi=THREE.MathUtils.degToRad(90-pitch),theta=THREE.MathUtils.degToRad(yaw);
  camera.position.set(cameraTarget.x+cameraDistance*Math.sin(phi)*Math.sin(theta),cameraTarget.y+cameraDistance*Math.cos(phi),cameraTarget.z+cameraDistance*Math.sin(phi)*Math.cos(theta));
  camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
  $('hud-camera').textContent=`${Math.round(pitch)}° / ${((Math.round(yaw)%360)+360)%360}°`;
}

function frameCamera() {
  const size=Math.max(map.width,map.depth)*.72,aspect=renderer.domElement.clientWidth/Math.max(renderer.domElement.clientHeight,1);
  camera.left=-size*aspect; camera.right=size*aspect; camera.top=size; camera.bottom=-size; camera.zoom=1; cameraDistance=Math.max(map.width,map.depth)*1.65;
  cameraTarget.set(0,Math.max(...map.cells.map((cell)=>cell.height),0)*.22,0); updateCamera();
}

function updateCellMesh(cell){updateMeshParts(cellMeshes[cell.z*map.width+cell.x],cell);updateSelection();}

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
  if(mode==='terrain'){if($('change-height').checked)changeHeight(cell,(terrainAction==='add'?1:-1)*Number($('height-amount').value));if(terrainAction==='add')cell.color=$('current-color').value;updateCellMesh(cell);}
  else if(mode==='impassable'){cell.impassable=!cell.impassable;updateCellMesh(cell);} updateSelection(); if(mode==='memo')setTimeout(()=>$('selected-memo').focus(),0);
}

function updateHistoryButtons() {
  $('undo').disabled=!history.canUndo; $('redo').disabled=!history.canRedo;
}

function commitGesture(before) {
  if(before&&history.commit(before,map)) updateHistoryButtons();
}

function restoreMap(next) {
  if(!next)return; map=next; selected=null; rebuildScene(); updateHistoryButtons();
}

function updateSelection() {
  const fields=['cell-x','cell-z','cell-height','cell-color','cell-impassable'];
  if(!selected){selectionMesh.visible=false;fields.forEach((id)=>$(id).textContent='—');$('cell-editor').hidden=true;return;}
  const root=cellMeshes[selected.z*map.width+selected.x],height=Math.max(selected.height,.06); selectionMesh.visible=true; selectionMesh.position.copy(root.position); selectionMesh.position.y=height/2; selectionMesh.scale.set(1,height,1);
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
  if(activePointers.size===1){editedDuringGesture.clear();const startCell=pickCell(event);gesture={start:{x:event.clientX,y:event.clientY},last:{x:event.clientX,y:event.clientY},startCell,moved:false,camera:event.button===2,before:cloneMap(map)};}
  else if(activePointers.size===2){const list=[...activePointers.values()];gesture={camera:true,moved:true,lastCenter:center(list),lastDistance:distance(list[0],list[1])};editedDuringGesture.clear();}
});
renderer.domElement.addEventListener('pointermove',(event)=>{
  if(!activePointers.has(event.pointerId))return;activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(activePointers.size>=2){const list=[...activePointers.values()].slice(0,2),mid=center(list),gap=distance(list[0],list[1]);if(gesture?.lastCenter){if(!$('lock-y').checked)yaw-=(mid.x-gesture.lastCenter.x)*.28;if(!$('lock-x').checked)pitch=Math.max(0,Math.min(90,pitch+(mid.y-gesture.lastCenter.y)*.22));}if(gesture?.lastDistance&&!$('lock-z').checked)camera.zoom=Math.max(.3,Math.min(6,camera.zoom*(gap/gesture.lastDistance)));gesture={...gesture,camera:true,moved:true,lastCenter:mid,lastDistance:gap};updateCamera();return;}
  if(!gesture)return;const dx=event.clientX-gesture.last.x,dy=event.clientY-gesture.last.y,total=Math.hypot(event.clientX-gesture.start.x,event.clientY-gesture.start.y);if(total>6)gesture.moved=true;
  if(gesture.camera){if(!$('lock-y').checked)yaw-=dx*.3;if(!$('lock-x').checked)pitch=Math.max(0,Math.min(90,pitch+dy*.24));updateCamera();}else if(gesture.moved&&$('continuous-edit').checked){if(!editedDuringGesture.size)editCell(gesture.startCell,true);editCell(pickCell(event),true);}gesture.last={x:event.clientX,y:event.clientY};
});
function finishPointer(event){if(!activePointers.has(event.pointerId))return;const wasCamera=activePointers.size>1||gesture?.camera,before=gesture?.before;if(!gesture?.moved&&!wasCamera&&event.button!==2)editCell(pickCell(event));activePointers.delete(event.pointerId);if(!activePointers.size){if(!wasCamera)commitGesture(before);gesture=null;editedDuringGesture.clear();}else if(activePointers.size===1){const last=[...activePointers.values()][0];gesture={camera:true,moved:true,start:last,last};}}
renderer.domElement.addEventListener('pointerup',finishPointer);renderer.domElement.addEventListener('pointercancel',finishPointer);
renderer.domElement.addEventListener('wheel',(event)=>{event.preventDefault();if($('lock-z').checked)return;camera.zoom=Math.max(.3,Math.min(6,camera.zoom*(event.deltaY>0?.9:1.1)));camera.updateProjectionMatrix();},{passive:false});

$('create-map').addEventListener('click',()=>{map=createMap($('map-name').value,$('map-width').value,$('map-depth').value);selected=null;history.reset();updateHistoryButtons();rebuildScene();});
document.querySelectorAll('.mode').forEach((button)=>button.addEventListener('click',()=>{mode=button.dataset.mode;document.querySelectorAll('.mode').forEach((item)=>item.classList.toggle('active',item===button));updateStatus();}));
document.querySelectorAll('.terrain-action').forEach((button)=>button.addEventListener('click',()=>{terrainAction=button.dataset.action;document.querySelectorAll('.terrain-action').forEach((item)=>item.classList.toggle('active',item===button));updateStatus();}));
$('height-amount').addEventListener('change',updateStatus);$('current-color').addEventListener('input',()=>{updateStatus();buildPaletteState();});$('continuous-edit').addEventListener('change',updateStatus);
$('apply-cell').addEventListener('click',()=>{if(!selected)return;const before=cloneMap(map);selected.height=roundHeight($('selected-height').value);selected.color=$('selected-color').value;selected.impassable=$('selected-impassable').checked;selected.memo=$('selected-memo').value.slice(0,500);updateCellMesh(selected);updateSelection();commitGesture(before);});
$('undo').addEventListener('click',()=>restoreMap(history.undo(map)));
$('redo').addEventListener('click',()=>restoreMap(history.redo(map)));
const presets={top:{pitch:90,yaw:45},battle45:{pitch:42,yaw:45},battle135:{pitch:42,yaw:135},battle225:{pitch:42,yaw:225},battle315:{pitch:42,yaw:315},front:{pitch:0,yaw:0},right:{pitch:0,yaw:90}};
document.querySelectorAll('.camera-preset').forEach((button)=>button.addEventListener('click',()=>{const preset=presets[button.dataset.preset];pitch=preset.pitch;yaw=preset.yaw;camera.zoom=1;updateCamera();}));
$('menu-toggle').addEventListener('click',()=>{document.body.classList.toggle('menu-collapsed');const collapsed=document.body.classList.contains('menu-collapsed');$('menu-toggle').textContent=collapsed?'メニューを開く':'メニューを折りたたむ';$('menu-toggle').setAttribute('aria-expanded',String(!collapsed));setTimeout(resize,0);});
function resize(){const box=$('workspace').getBoundingClientRect();renderer.setSize(box.width,box.height,false);frameCamera();}
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);}
buildHeightOptions();buildPalette();updateStatus();updateHistoryButtons();rebuildScene();resize();addEventListener('resize',resize);animate();
