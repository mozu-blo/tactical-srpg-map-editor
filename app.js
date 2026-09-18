import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { changeHeight, createMap, getCell } from './model.js';

const $ = (id) => document.getElementById(id);
const paletteColors = ['#7a8b79','#566573','#8e6e53','#708b45','#587ca3','#9b6a6c','#9b8b61','#725f8e','#4f8079','#9a8062','#5f666d','#b0a58c'];
let map = createMap();
let mode = 'add';
let selected = null;

const renderer = new THREE.WebGLRenderer({ canvas:$('map-canvas'), antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x111821);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x27313b, 2.1));
const directional = new THREE.DirectionalLight(0xffffff, 2.6); directional.position.set(-10,18,8); scene.add(directional);
const camera = new THREE.OrthographicCamera(-10,10,10,-10,.1,200);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cellGroup = new THREE.Group(); scene.add(cellGroup);
const gridGroup = new THREE.Group(); scene.add(gridGroup);
const selectionMaterial = new THREE.MeshBasicMaterial({ color:0xffff66, wireframe:true, depthTest:false });
const selectionMesh = new THREE.Mesh(new THREE.BoxGeometry(1.04,1.04,1.04), selectionMaterial); selectionMesh.visible=false; selectionMesh.renderOrder=20; scene.add(selectionMesh);
const cellMeshes = [];

function buildHeightOptions() {
  for (let value=.5; value<=10; value+=.5) {
    const option=document.createElement('option'); option.value=value; option.textContent=value.toFixed(1); $('height-amount').append(option);
  }
}
function buildPalette() {
  for (const color of paletteColors) {
    const button=document.createElement('button'); button.type='button'; button.style.background=color; button.title=color;
    button.addEventListener('click',()=>{ $('current-color').value=color; updateStatus(); buildPaletteState(); });
    $('palette').append(button);
  }
  buildPaletteState();
}
function buildPaletteState() {
  [...$('palette').children].forEach(b=>b.classList.toggle('active',b.title.toLowerCase()===$('current-color').value.toLowerCase()));
}
function clearGroup(group) {
  while (group.children.length) {
    const item = group.children[0];
    group.remove(item);
    item.geometry?.dispose();
    item.material?.dispose();
  }
}
function rebuildScene() {
  clearGroup(cellGroup); clearGroup(gridGroup); cellMeshes.length=0;
  const centerX=(map.width-1)/2, centerZ=(map.depth-1)/2;
  for (const cell of map.cells) {
    const height=Math.max(cell.height,.06);
    const material=new THREE.MeshStandardMaterial({ color:cell.color, roughness:.82 });
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.94,height,.94),material);
    mesh.position.set(cell.x-centerX,height/2,cell.z-centerZ); mesh.userData={x:cell.x,z:cell.z};
    cellGroup.add(mesh); cellMeshes.push(mesh);
  }
  const grid=new THREE.GridHelper(Math.max(map.width,map.depth),Math.max(map.width,map.depth),0x6e8798,0x344554);
  grid.scale.set(map.width/Math.max(map.width,map.depth),1,map.depth/Math.max(map.width,map.depth)); grid.position.y=.035; gridGroup.add(grid);
  frameCamera(); updateSelection();
}
function frameCamera() {
  const size=Math.max(map.width,map.depth)*.72; camera.left=-size*renderer.domElement.clientWidth/Math.max(renderer.domElement.clientHeight,1); camera.right=-camera.left; camera.top=size; camera.bottom=-size;
  const distance=Math.max(map.width,map.depth)*1.5; camera.position.set(distance,distance,distance); camera.lookAt(0,0,0); camera.updateProjectionMatrix();
}
function updateCellMesh(cell) {
  const mesh=cellMeshes[cell.z*map.width+cell.x];
  const h=Math.max(cell.height,.06); mesh.scale.y=h/mesh.geometry.parameters.height; mesh.position.y=h/2; mesh.material.color.set(cell.color);
  updateSelection();
}
function pickCell(event) {
  const rect=renderer.domElement.getBoundingClientRect(); pointer.x=((event.clientX-rect.left)/rect.width)*2-1; pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera); return raycaster.intersectObjects(cellMeshes,false)[0]?.object || null;
}
function editCell(mesh) {
  if (!mesh) return;
  const cell=getCell(map,mesh.userData.x,mesh.userData.z); selected=cell;
  if (mode==='add') { changeHeight(cell,Number($('height-amount').value)); cell.color=$('current-color').value; updateCellMesh(cell); }
  if (mode==='remove') { changeHeight(cell,-Number($('height-amount').value)); updateCellMesh(cell); }
  updateSelection();
}
function updateSelection() {
  if (!selected) { selectionMesh.visible=false; $('cell-x').textContent=$('cell-z').textContent=$('cell-height').textContent=$('cell-color').textContent='—'; return; }
  const mesh=cellMeshes[selected.z*map.width+selected.x]; selectionMesh.visible=true; selectionMesh.position.copy(mesh.position); selectionMesh.scale.set(1,Math.max(selected.height,.06),1);
  $('cell-x').textContent=selected.x; $('cell-z').textContent=selected.z; $('cell-height').textContent=selected.height.toFixed(1); $('cell-color').textContent=selected.color;
}
function updateStatus() {
  const names={add:'配置',remove:'消去',select:'選択'}; $('hud-mode').textContent=names[mode]; $('hud-height').textContent=Number($('height-amount').value).toFixed(1); $('hud-color').style.background=$('current-color').value;
  $('help').textContent=mode==='add'?'配置：セルをクリックしてHeightと色を追加します。':mode==='remove'?'消去：セルをクリックしてHeightを減らします。':'選択：セルをクリックして情報を確認します。';
}
renderer.domElement.addEventListener('pointerdown',(event)=>{ if(event.button!==0)return; editCell(pickCell(event)); });
renderer.domElement.addEventListener('wheel',(event)=>{ event.preventDefault(); const factor=event.deltaY>0?1.1:.9; camera.zoom=Math.max(.35,Math.min(5,camera.zoom/factor)); camera.updateProjectionMatrix(); },{passive:false});
$('create-map').addEventListener('click',()=>{ map=createMap($('map-name').value,$('map-width').value,$('map-depth').value); selected=null; rebuildScene(); });
document.querySelectorAll('.mode').forEach(button=>button.addEventListener('click',()=>{ mode=button.dataset.mode; document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b===button)); updateStatus(); }));
$('height-amount').addEventListener('change',updateStatus); $('current-color').addEventListener('input',()=>{updateStatus();buildPaletteState();});
$('menu-toggle').addEventListener('click',()=>{ document.body.classList.toggle('menu-collapsed'); const collapsed=document.body.classList.contains('menu-collapsed'); $('menu-toggle').textContent=collapsed?'メニューを開く':'メニューを折りたたむ'; $('menu-toggle').setAttribute('aria-expanded',String(!collapsed)); setTimeout(resize,0); });
function resize() { const box=$('workspace').getBoundingClientRect(); renderer.setSize(box.width,box.height,false); frameCamera(); }
function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }
buildHeightOptions(); buildPalette(); updateStatus(); rebuildScene(); resize(); addEventListener('resize',resize); animate();
