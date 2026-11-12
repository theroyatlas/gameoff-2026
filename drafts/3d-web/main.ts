import './style.css';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { selectBadges, trailStyle, type BadgeCandidate } from './polish';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Study, CONFIG as C } from './adapter';
import { createHUD } from './hud';
import { resonanceStyle } from './presentation';
import { AdaptiveQuality } from './quality';
import { LOW_GPU_PROFILE, TWO_D_URL } from './settings';
import { readChoice, TOKENS, LIGHTS, walnutTexture, drawField, badgeCanvas, ballMaterial, yarnTexture, buildRing, SHARED_TEXTURES, type StyleChoice } from './style1';

export function startRealtime() {
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const phaseText = document.querySelector<HTMLElement>('#phase')!;
const statusText = document.querySelector<HTMLElement>('#status')!;
const trailsRequested = new URLSearchParams(location.search).get('trail') === '1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const game = new Study();
const palette = { brass:TOKENS.brass, edge:TOKENS.brassEdge, dark:TOKENS.walnutDark, cyan:TOKENS.yarn, ochre:TOKENS.ochre };
const choice:StyleChoice = readChoice(location.search);
const failure=document.querySelector<HTMLElement>('#failure')!;
const fallbackLink=document.querySelector<HTMLAnchorElement>('#fallback-link')!;
fallbackLink.setAttribute('href',TWO_D_URL);
function showFallback(){
  canvas.hidden=true;canvas.tabIndex=-1;failure.hidden=false;
  phaseText.textContent='3D 畫面無法使用';statusText.textContent='可改玩 2D 版';
  document.querySelector<HTMLElement>('#instructions')!.hidden=true;document.querySelector<HTMLElement>('#overlay')!.hidden=true;
}
function startScene(){
const quality=new AdaptiveQuality(),qualityHistory:{level:number;fps:number;seconds:number}[]=[];
let stopped=false;
const initialPixelRatio=LOW_GPU_PROFILE?1:Math.min(devicePixelRatio,1.5);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!LOW_GPU_PROFILE,powerPreference:LOW_GPU_PROFILE?'low-power':'high-performance'});
renderer.setPixelRatio(initialPixelRatio);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopped=true;showFallback();});
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
renderer.localClippingEnabled=true;
const scene=new THREE.Scene();const bgIdle=new THREE.Color(TOKENS.bgIdle),bgShift=new THREE.Color(TOKENS.bgShift);scene.background=bgIdle.clone();const fog=new THREE.Fog(TOKENS.bgIdle,19,35);scene.fog=fog;
const camera=new THREE.PerspectiveCamera(36,1,.1,60);camera.position.set(.2,8.2,9.3);camera.lookAt(0,0,0);
const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();
const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.3;room.dispose();pmrem.dispose();
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.12,.5,1);composer.addPass(bloom);composer.addPass(new OutputPass());
const ambient=new THREE.HemisphereLight(0xffe5b7,0x2a1a10,.22);scene.add(ambient);
const key=new THREE.SpotLight(0xffa957,60,26,.55,.6,2);key.position.set(-3.6,9.5,1.6);key.target.position.set(0,0,0);key.castShadow=true;
key.shadow.mapSize.set(LOW_GPU_PROFILE?512:2048,LOW_GPU_PROFILE?512:2048);key.shadow.bias=-.0004;key.shadow.normalBias=.025;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xc8d8d4,.35);rim.position.set(4,6,-5);scene.add(rim);
const phaseLight=new THREE.PointLight(palette.cyan,0,12,1.3);phaseLight.position.set(0,1.2,0);scene.add(phaseLight);
const brass=new THREE.MeshStandardMaterial({color:palette.brass,metalness:.8,roughness:.42});
const edge=new THREE.MeshStandardMaterial({color:palette.edge,metalness:.8,roughness:.36});
const dark=new THREE.MeshStandardMaterial({color:palette.dark,metalness:0,roughness:.6});
const glow=new THREE.MeshStandardMaterial({color:palette.cyan,emissive:palette.cyan,emissiveIntensity:1.4,roughness:.25,metalness:.3});
const glass=new THREE.MeshPhysicalMaterial({color:0xd0ece4,metalness:0,roughness:.08,transmission:.93,thickness:.18,ior:1.46,clearcoat:1});

const walnutMap=walnutTexture(1024,false),walnutLightMap=walnutTexture(512,true);[walnutMap,walnutLightMap].forEach(t=>{t.anisotropy=renderer.capabilities.getMaxAnisotropy();SHARED_TEXTURES.add(t);});
const wood=new THREE.MeshStandardMaterial({map:walnutMap,roughness:.6,metalness:0});
const rimWood=new THREE.MeshPhysicalMaterial({map:walnutLightMap,color:0xb08868,roughness:.42,metalness:0,clearcoat:.4,clearcoatRoughness:.5});
const fieldCanvas=document.createElement('canvas');fieldCanvas.width=1024;fieldCanvas.height=870;drawField(fieldCanvas,choice.icon,(C.launcher.y-340)*.01);
const fieldMap=new THREE.CanvasTexture(fieldCanvas);fieldMap.colorSpace=THREE.SRGBColorSpace;fieldMap.anisotropy=renderer.capabilities.getMaxAnisotropy();SHARED_TEXTURES.add(fieldMap);
const paper=new THREE.MeshStandardMaterial({map:fieldMap,color:0xd6c6a2,roughness:.92,metalness:0});
const paperEdge=new THREE.MeshStandardMaterial({color:TOKENS.paperEdge,roughness:.95,metalness:0});
function mesh(geo:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
function cylinder(r:number,h:number,mat:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){return mesh(new THREE.CylinderGeometry(r,r,h,48),mat,x,y,z,parent);}
function ring(r:number,t:number,mat:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){const m=mesh(new THREE.TorusGeometry(r,t,8,64),mat,x,y,z,parent);m.rotation.x=-Math.PI/2;return m;}
function rod(a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material,parent:THREE.Object3D=scene){const m=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),mat,0,0,0,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
function bevelSlab(w:number,d:number,h:number,mat:THREE.Material,y:number){const s=new THREE.Shape(),r=.16;s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.06,bevelThickness:.05});g.rotateX(-Math.PI/2);return mesh(g,mat,0,y,0);}
box(40,.35,35,wood,0,-.95,0);
bevelSlab(8.65,7.45,.38,wood,-.62);
bevelSlab(8.48,7.28,.09,brass,-.2);
box(8,.12,6.8,paperEdge,0,-.062,0);
{const sheet=mesh(new THREE.PlaneGeometry(8,6.8),paper,0,.001,0);sheet.rotation.x=-Math.PI/2;sheet.castShadow=false;}
for(const x of [-4.14,4.14])box(.24,.26,7.12,rimWood,x,.07,0);
for(const z of [-3.54,3.54])box(8.5,.26,.24,rimWood,0,.07,z);
for(const x of [-4.14,4.14])for(const z of [-3.54,3.54])box(.44,.34,.44,wood,x,.1,z);
for(const x of [-4.01,4.01])box(.018,.11,6.8,edge,x,.15,0);
for(const z of [-3.41,3.41])box(8,.11,.018,edge,0,.15,z);
for(const x of [-4.12,4.12])for(const z of [-3.5,-1.75,0,1.75,3.5]){cylinder(.055,.027,edge,x,.218,z);box(.055,.005,.011,dark,x,.234,z);}
for(const z of [-3.54,3.54])for(const x of [-3,-1.5,0,1.5,3]){box(.025,.272,.242,dark,x,.07,z);}
for(const x of [-4.12,4.12])for(const z of [-3.45,3.45]){box(.12,.32,.3,edge,x,-.4,z);box(.34,.08,.13,edge,x,-.42,z);}
// 燈具不入鏡：只留下它在桌上的暖光圈。

// 玻璃罩核心：底座、刻度、透光罩與內部共鳴體。
cylinder(.66,.15,wood,0,.08,0);cylinder(.53,.11,dark,0,.2,0);ring(.54,.035,edge,0,.28,0);
for(let i=0;i<48;i++){const a=i/48*Math.PI*2;const mark=box(.012,.008,i%4===0?.09:.04,edge,Math.cos(a)*.59,.162,Math.sin(a)*.59);mark.rotation.y=-a+Math.PI/2;}
const dome=mesh(new THREE.SphereGeometry(.49,40,24,0,Math.PI*2,0,Math.PI/2),glass,0,.28,0);dome.castShadow=false;
const crystal=mesh(new THREE.OctahedronGeometry(.19),glow,0,.48,0);
const orbit1=ring(.29,.008,glow,0,.46,0);orbit1.rotation.x=.65;
const orbit2=ring(.34,.008,edge,0,.46,0);orbit2.rotation.x=-.6;orbit2.rotation.z=.8;
for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(new THREE.Vector3(Math.cos(a)*.52,.2,Math.sin(a)*.52),new THREE.Vector3(Math.cos(a)*.45,.47,Math.sin(a)*.45),.035,brass);}
cylinder(.05,.06,edge,0,.8,0);

// 將不會移動的同材質零件合批；核心與軌道保持獨立動畫。
scene.updateMatrixWorld(true);
const staticBatches=new Map<THREE.Material,THREE.BufferGeometry[]>();
for(const object of [...scene.children]){
  if(!(object instanceof THREE.Mesh)||[dome,crystal,orbit1,orbit2].includes(object))continue;
  const geometry=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrixWorld);
  const material=object.material as THREE.Material;
  const batch=staticBatches.get(material)??[];batch.push(geometry);staticBatches.set(material,batch);
  scene.remove(object);object.geometry.dispose();
}
for(const [material,geometries] of staticBatches){
  const geometry=mergeGeometries(geometries);if(!geometry)throw new Error('Static geometry merge failed');
  mesh(geometry,material);geometries.forEach(g=>g.dispose());
}

const cages=new Map<number,{group:THREE.Group,crystal:THREE.Mesh,born:number}>();
const cageGeometries=[new THREE.TetrahedronGeometry(.25),new THREE.IcosahedronGeometry(.24),new THREE.BoxGeometry(.34,.34,.34),new THREE.OctahedronGeometry(.26)];
function addCage(target:typeof game.monsters[number]){
  const g=new THREE.Group();g.position.set((target.x-400)*.01,0,(target.y-340)*.01);scene.add(g);
  cylinder(.25,.09,wood,0,.06,0,g);ring(.23,.022,edge,0,.13,0,g);
  const edges=new THREE.EdgesGeometry(cageGeometries[target.id%4]),arr=edges.attributes.position.array;
  for(let j=0;j<arr.length;j+=6)rod(new THREE.Vector3(arr[j],arr[j+1]+.35,arr[j+2]),new THREE.Vector3(arr[j+3],arr[j+4]+.35,arr[j+5]),.018,edge,g);
  const c=mesh(new THREE.OctahedronGeometry(.10),glow.clone(),0,.35,0,g);edges.dispose();cages.set(target.id,{group:g,crystal:c,born:game.tick});
}
const launcher=new THREE.Group();launcher.position.set(0,.08,(C.launcher.y-340)*.01);scene.add(launcher);
cylinder(.29,.12,wood,0,0,0,launcher);ring(.27,.042,edge,0,.09,0,launcher);cylinder(.19,.07,dark,0,.07,0,launcher);ring(.17,.012,glow,0,.12,0,launcher);
for(const x of [-.28,.28])box(.09,.24,.4,brass,x,.13,0,launcher);
const barrel=box(.16,.12,.35,brass,0,.19,-.1,launcher);
const aimMat=new THREE.MeshBasicMaterial({color:palette.edge,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});
const aimGeo=new THREE.CircleGeometry(1.5,32,-C.launcher.coneHalfAngle,C.launcher.coneHalfAngle);aimGeo.rotateX(-Math.PI/2);
const aimMesh=mesh(aimGeo,aimMat,0,.025,(C.launcher.y-340)*.01);aimMesh.visible=false;aimMesh.castShadow=false;

const fieldMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},strength:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float time;uniform float strength;void main(){vec2 q=(p-.5)*vec2(8.,6.8);float r=length(q);float f=pow(max(0.,sin(r*13.-time*3.+sin(atan(q.y,q.x)*6.)*.5)),9.);float a=strength*(.03+f*.07);gl_FragColor=vec4(.56,.86,.78,a);}'});
const field=mesh(new THREE.PlaneGeometry(8,6.8),fieldMat,0,.014,0);field.rotation.x=-Math.PI/2;field.castShadow=false;field.receiveShadow=false;
// 共振毛線：一個 InstancedMesh，每條是一段斜捻紋理的細管。
const YARN_MAX=512,yarnMap=yarnTexture();SHARED_TEXTURES.add(yarnMap);
const yarnMat=new THREE.MeshStandardMaterial({map:yarnMap,color:0xffffff,emissive:TOKENS.yarn,emissiveIntensity:.55,roughness:.95,metalness:0});
const yarnGeo=new THREE.CylinderGeometry(.032,.032,1,6,1,true);
const network=new THREE.InstancedMesh(yarnGeo,yarnMat,YARN_MAX);network.count=0;network.frustumCulled=false;network.castShadow=false;network.visible=false;scene.add(network);
const yarnMatrix=new THREE.Matrix4(),yarnQuat=new THREE.Quaternion(),yarnScale=new THREE.Vector3(),yarnPos=new THREE.Vector3(),yarnDir=new THREE.Vector3(),yarnUp=new THREE.Vector3(0,1,0);
const ballGeo=new THREE.SphereGeometry(C.ball.radius*.01,24,16);
const ballVisuals=new Map<number,{group:THREE.Group,sphere:THREE.Mesh,halo:THREE.Mesh,outer:THREE.Mesh,mat:THREE.MeshPhysicalMaterial,label:THREE.Sprite,lastX:number,lastY:number}>();
function badge(id:number){const t=new THREE.CanvasTexture(badgeCanvas(id));t.colorSpace=THREE.SRGBColorSpace;return t;}
function addBall(b:Pick<typeof game.balls[number],'id'|'material'|'x'|'y'>) {
  const group=new THREE.Group();scene.add(group);
  const mat=ballMaterial(choice.ball,b.material,palette.cyan);
  const sphere=mesh(ballGeo,mat,0,.14,0,group);
  if(b.material===0){const inner=mesh(new THREE.OctahedronGeometry(.055),new THREE.MeshStandardMaterial({color:0x9eaea2,metalness:.8,roughness:.3}),0,0,0,sphere);inner.name='glass-core';inner.visible=choice.ball==='b';}
  const halo=ring(.19,.012,new THREE.MeshBasicMaterial({color:palette.cyan,transparent:true,opacity:.0,depthWrite:false}),0,.025,0,group);halo.castShadow=false;
  const outer=ring(.26,.018,new THREE.MeshBasicMaterial({color:palette.cyan,transparent:true,depthWrite:false}),0,.028,0,group);outer.castShadow=false;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:badge(b.id),depthTest:false,transparent:true,toneMapped:false}));label.scale.set(.21,.21,1);label.position.set(0,.39,0);label.renderOrder=20;group.add(label);
  ballVisuals.set(b.id,{group,sphere,halo,outer,mat,label,lastX:b.x,lastY:b.y});
}
// 單一批次的漸細速度帶，不為每顆球建立額外 draw call。
const trailGeo=new THREE.BufferGeometry();let trailCapacity=64;
let trailPositions=new Float32Array(trailCapacity*18),trailEnergy=new Float32Array(trailCapacity*6);
function allocateTrails(){trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));trailGeo.setAttribute('energy',new THREE.BufferAttribute(trailEnergy,1));}
allocateTrails();
const trailMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:'attribute float energy;varying float light;void main(){light=energy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying float light;void main(){gl_FragColor=vec4(.56,.86,.78,light);}' });
const trailMesh=new THREE.Mesh(trailGeo,trailMat);trailMesh.frustumCulled=false;scene.add(trailMesh);
let trailCount=0,visibleBadgeCount=0;const lastImpact=new Map<number,number>();
let badgeEvidence:BadgeCandidate[]=[];
function updateTrails(){
  trailCount=0;
  if(!trailsRequested||reduced||quality.level>=3){trailGeo.setDrawRange(0,0);trailMesh.visible=false;return;}
  if(game.balls.length>trailCapacity){trailCapacity=game.balls.length*2;trailGeo.dispose();trailPositions=new Float32Array(trailCapacity*18);trailEnergy=new Float32Array(trailCapacity*6);allocateTrails();}
  for(const b of game.balls){
    const speed=Math.hypot(b.vx,b.vy),style=trailStyle(speed,!trailsRequested||reduced||quality.level>=3);
    if(style.length===0)continue;
    const dx=b.vx/speed,dz=b.vy/speed,x=(b.x-400)*.01-dx*.12,z=(b.y-340)*.01-dz*.12;
    const tx=Math.max(-3.96,Math.min(3.96,x-dx*style.length)),tz=Math.max(-3.36,Math.min(3.36,z-dz*style.length)),w=.055;
    trailPositions.set([tx,.12,tz,x-dz*w,.12,z+dx*w,x+dz*w,.12,z-dx*w,tx,.12,tz,x+dz*w,.12,z-dx*w,tx,.12,tz],trailCount*18);
    trailEnergy.set([0,style.opacity,style.opacity,0,style.opacity,0],trailCount*6);trailCount++;
  }
  trailGeo.setDrawRange(0,trailCount*6);trailGeo.attributes.position.needsUpdate=true;trailGeo.attributes.energy.needsUpdate=true;
  trailMesh.visible=trailCount>0;
}
const effectGroup=new THREE.Group();scene.add(effectGroup);
type VisualEffect={kind:string,born:number,duration:number,mesh:THREE.Object3D,radius:number};
const effects:VisualEffect[]=[];let seen=new WeakSet<object>();
const eventCounts:Record<string,number>={};let maxDepth=0;
const arenaClip=[new THREE.Plane(new THREE.Vector3(1,0,0),4),new THREE.Plane(new THREE.Vector3(-1,0,0),4),new THREE.Plane(new THREE.Vector3(0,0,1),3.4),new THREE.Plane(new THREE.Vector3(0,0,-1),3.4)];
function effectLimit(){return quality.level>=3?24:96;}
// 同形狀波紋共用不可變幾何，生命週期結束只釋放個別材質。
const effectRingGeometry=new THREE.TorusGeometry(1,.007,8,64);
function addRing(x:number,y:number,r:number,kind:string,duration=.65){
  if(effects.length>=effectLimit()){if(kind!=='release')return;disposeEffect(effects.shift()!);}
  if(quality.level>=3&&kind==='impact'&&(eventCounts.impact??0)%4!==0)return;const material=new THREE.MeshBasicMaterial({color:kind==='burst'?palette.ochre:palette.cyan,transparent:true,opacity:.8,depthWrite:false,clippingPlanes:arenaClip});const obj=mesh(effectRingGeometry,material,(x-400)*.01,.045,(y-340)*.01,effectGroup);obj.rotation.x=-Math.PI/2;obj.castShadow=false;effects.push({kind,born:game.tick*C.dt,duration,mesh:obj,radius:r*.01});}
const particleGeo=new THREE.BufferGeometry(),particlePositions=new Float32Array(600*3);
particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
const particleMesh=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0xf0d9a8,size:.05,transparent:true,opacity:.85,depthWrite:false}));particleMesh.frustumCulled=false;scene.add(particleMesh);
let particles:{x:number,y:number,z:number,vx:number,vy:number,vz:number,life:number}[]=[];
let freeze=0,nextFreezeAt=0,shake=0,recoil=0,visualTime=0;
const baseCamera=new THREE.Vector3();
function scatter(e:typeof game.effects[number],count:number,power:number){if(reduced)return;const cap=quality.level>=3?150:600;
  for(let i=0;i<count&&particles.length<cap;i++){const a=i*2.399+e.tick*.31;particles.push({x:(e.x-400)*.01,y:.15,z:(e.y-340)*.01,vx:Math.cos(a)*power,vy:.5+i%4*.3,vz:Math.sin(a)*power,life:.3+i%5*.075});}}
function ingest(){for(const e of game.effects){if(seen.has(e))continue;seen.add(e);eventCounts[e.kind]=(eventCounts[e.kind]??0)+1;hud.sound.play(e,game.phase==='active');
  if(e.kind==='impact'){for(const b of game.balls)if(Math.hypot(b.x-e.x,b.y-e.y)<C.ball.radius*2.5)lastImpact.set(b.id,game.tick);const power=Math.min(1,e.value/1300);if(visualTime>=nextFreezeAt){freeze=.009+power*.024;nextFreezeAt=visualTime+.09;}shake=Math.max(shake,.012+power*.035);scatter(e,7,.8+power*2.2);}
  if(e.kind==='launch'){recoil=.22;shake=.05;scatter(e,24,4);}
  if(e.kind==='burst'||e.kind==='death'){scatter(e,e.kind==='death'?32:22,3.6);shake=Math.max(shake,.05);}
  if(e.kind==='shift'||e.kind==='release'){freeze=.065;nextFreezeAt=visualTime+.15;shake=.09;}

  if(e.kind==='burst'){maxDepth=Math.max(maxDepth,e.value);addRing(e.x,e.y,e.radius,e.kind);}
  if(e.kind==='release')addRing(400,340,540,'release',1.05);
  if(e.kind==='impact'&&!reduced)addRing(e.x,e.y,24,'impact',.2);
  if(e.kind==='resonate')addRing(e.x,e.y,35,'resonate',.45);
  if(e.kind==='ignite'&&effects.length<effectLimit()){const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3((e.fromX!-400)*.01,.15,(e.fromY!-340)*.01),new THREE.Vector3((e.x-400)*.01,.15,(e.y-340)*.01)]);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:palette.ochre,transparent:true,opacity:.8}));effectGroup.add(line);effects.push({kind:'ignite',born:game.tick*C.dt,duration:.45,mesh:line,radius:0});}
}}
let currentPhase='',angle=-Math.PI/2,drag:number|null=null,accumulator=0,previous=performance.now();
let frameCount=0,frameTotal=0;
const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function world(clientX:number,clientY:number){const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);const p=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,p)?{x:p.x*100+400,y:p.z*100+340}:null;}
function setAim(p:{x:number,y:number}){angle=Math.atan2(Math.min(-20,p.y-C.launcher.y),p.x-C.launcher.x);}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||game.status!=='playing')return;hud.sound.unlock();const p=world(e.clientX,e.clientY);if(!p||Math.hypot(p.x-C.launcher.x,p.y-C.launcher.y)>62)return;drag=e.pointerId;canvas.setPointerCapture(e.pointerId);canvas.focus();setAim(p);});
canvas.addEventListener('pointermove',e=>{if(drag!==e.pointerId)return;const p=world(e.clientX,e.clientY);if(p)setAim(p);});
canvas.addEventListener('pointerup',e=>{if(drag!==e.pointerId)return;const p=world(e.clientX,e.clientY);if(p&&Math.hypot(p.x-C.launcher.x,p.y-C.launcher.y)>=C.launcher.minDrag){setAim(p);game.fire(angle);}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
window.addEventListener('blur',()=>drag=null);
canvas.addEventListener('keydown',e=>{if(game.status!=='playing')return;hud.sound.unlock();if(e.key==='ArrowLeft'||e.key==='ArrowRight'){angle=THREE.MathUtils.clamp(angle+(e.key==='ArrowLeft'?-.12:.12),-Math.PI+.2,-.2);e.preventDefault();}if(e.code==='Space'&&!e.repeat){game.fire(angle);e.preventDefault();}});
document.addEventListener('visibilitychange',()=>{previous=performance.now();accumulator=0;drag=null;quality.resetWindow();});
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.position.set(.2,8.2,9.3);if(choice.ring)camera.position.set(.2,11.4,11.2);fog.near=choice.ring?24:19;fog.far=choice.ring?44:35;if(camera.aspect<1.25)camera.position.multiplyScalar(1.25/camera.aspect);camera.lookAt(0,0,0);camera.updateProjectionMatrix();baseCamera.copy(camera.position);}
new ResizeObserver(()=>{if(!stopped)resize();}).observe(stage);resize();
function applyQuality(){
  if(quality.level===1){renderer.shadowMap.enabled=false;scene.traverse(o=>{const mesh=o as THREE.Mesh;const materials=mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];materials.forEach(m=>m.needsUpdate=true);});}
  if(quality.level===2){const ratio=Math.max(.5,initialPixelRatio*.75);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);resize();}
  if(quality.level===3){while(effects.length>effectLimit()){const e=effects.shift()!;disposeEffect(e);}}
  qualityHistory.push({level:quality.level,fps:quality.fps,seconds:game.tick*C.dt});
}
function disposeEffect(e:VisualEffect){e.mesh.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry!==effectRingGeometry)m.geometry?.dispose();if(m.material&&!Array.isArray(m.material))m.material.dispose();});effectGroup.remove(e.mesh);}
function screenPoint(x:number,y:number,height=0,r=canvas.getBoundingClientRect()){const p=new THREE.Vector3((x-400)*.01,height,(y-340)*.01).project(camera);return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}
function removeVisual(group:THREE.Object3D){group.traverse(o=>{const m=o as THREE.Mesh;
  if(m.geometry&&m.geometry!==ballGeo)m.geometry.dispose();const mats=m.material?(Array.isArray(m.material)?m.material:[m.material]):[];
  for(const mat of mats)if(![brass,edge,dark,glow,glass,wood].includes(mat as THREE.MeshStandardMaterial)){const map=(mat as THREE.SpriteMaterial).map;if(map&&!SHARED_TEXTURES.has(map))map.dispose();mat.dispose();}});scene.remove(group);}
function resetScene(){lastImpact.clear();badgeEvidence=[];trailCount=visibleBadgeCount=0;trailGeo.setDrawRange(0,0);trailMesh.visible=false;for(const v of ballVisuals.values())removeVisual(v.group);ballVisuals.clear();for(const v of cages.values())removeVisual(v.group);cages.clear();
  for(const e of effects)disposeEffect(e);effects.length=0;particles=[];particleGeo.setDrawRange(0,0);seen=new WeakSet();
  for(const key of Object.keys(eventCounts))delete eventCounts[key];maxDepth=0;freeze=shake=recoil=0;nextFreezeAt=0;visualTime=0;drag=null;angle=-Math.PI/2;accumulator=0;previous=performance.now();currentPhase='';network.visible=false;network.count=0;camera.position.copy(baseCamera);
}
const hud=createHUD(game,resetScene);
// 風格一的三組可選外觀；只換呈現，不碰規則與手感。
let outerRing:ReturnType<typeof buildRing>|null=null;
function applyLight(){const L=LIGHTS[choice.light];key.color.setHex(L.color);key.intensity=L.intensity;key.angle=L.angle;key.penumbra=L.penumbra;key.position.set(...L.position);ambient.intensity=L.ambient;stage.style.setProperty('--vignette',String(L.vignette));}
function applyIcons(){drawField(fieldCanvas,choice.icon,(C.launcher.y-340)*.01);fieldMap.needsUpdate=true;outerRing?.redraw(choice.icon);}
function applyBalls(){for(const [id,v] of ballVisuals){const b=game.balls.find(ball=>ball.id===id);if(!b)continue;const next=ballMaterial(choice.ball,b.material,palette.cyan);v.mat.dispose();v.sphere.material=next;v.mat=next;v.sphere.traverse(o=>{if(o.name==='glass-core')o.visible=choice.ball==='b';});}}
function applyRing(){if(choice.ring&&!outerRing){outerRing=buildRing(wood,choice.icon);scene.add(outerRing.group);}if(outerRing)outerRing.group.visible=choice.ring;resize();}
applyLight();applyRing();
if(new URLSearchParams(location.search).get('lab')==='1')Object.assign(window,{styleLab:{choice:()=>({...choice}),set(next:Partial<StyleChoice>){
  const before={...choice};Object.assign(choice,next);if(before.light!==choice.light)applyLight();if(before.icon!==choice.icon)applyIcons();if(before.ball!==choice.ball)applyBalls();if(before.ring!==choice.ring)applyRing();}}});
// 唯讀驗收資訊；不提供強制相變、植入球或改變時鐘的控制。
Object.assign(window,{studyEvidence:{timing:()=>({seconds:game.tick*C.dt,phase:game.phase,shots:game.shots,qualityLevel:quality.level}),snapshot:()=>({game:game.snapshot(),hud:hud.evidence(),visuals:{balls:ballVisuals.size,cages:cages.size,particles:particles.length,trails:trailCount,visibleBadges:visibleBadgeCount,badges:badgeEvidence},tick:game.tick,seconds:game.tick*C.dt,shots:game.shots,phase:game.phase,shifts:game.shifts,events:game.events,inputs:game.inputs,balls:game.balls.map(b=>({...b})),counts:{...eventCounts},maxDepth,frameCount,meanFrameMs:frameCount?frameTotal/frameCount:0,friction:game.phase==='active'?C.shift.friction:C.ball.friction,quality:{level:quality.level,fps:quality.fps,history:qualityHistory,shadows:renderer.shadowMap.enabled,pixelRatio:renderer.getPixelRatio(),composerPixelRatio:composer.readBuffer.width/stage.clientWidth,antialias:renderer.getContext().getContextAttributes()?.antialias,shadowMapSize:key.shadow.mapSize.x,effects:effects.length,effectLimit:effectLimit(),trailsRequested,trailsEnabled:trailsRequested&&!reduced&&quality.level<3},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),project:screenPoint}});
function frame(now:number){if(stopped)return;requestAnimationFrame(frame);if(document.hidden){previous=now;return;}const elapsed=Math.max(0,(now-previous)/1000);previous=now;
  if(quality.sample(elapsed*1000))applyQuality();
  if(!document.hidden){accumulator+=Math.min(elapsed,.25);while(accumulator>=C.dt){game.step();accumulator-=C.dt;ingest();}}
  frameCount++;frameTotal+=elapsed*1000;visualTime+=elapsed;shake*=Math.exp(-18*elapsed);recoil*=Math.exp(-17*elapsed);
  camera.position.copy(baseCamera);if(!reduced){camera.position.x+=Math.sin(visualTime*97)*shake;camera.position.y+=Math.cos(visualTime*113)*shake;}
  launcher.position.z=(C.launcher.y-340)*.01+(reduced?0:recoil);camera.updateMatrixWorld();
  const rect=canvas.getBoundingClientRect();hud.update((x,y,h)=>{const p=screenPoint(x,y,h,rect);return{x:p.x-rect.left,y:p.y-rect.top};},rect.width,rect.height);
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=elapsed;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.z+=p.vz*elapsed;p.vy-=5*elapsed;}
  particles.forEach((p,i)=>{particlePositions.set([p.x,Math.max(.025,p.y),p.z],i*3);});particleGeo.attributes.position.needsUpdate=true;particleGeo.setDrawRange(0,particles.length);
  if(freeze>0&&!reduced&&game.status==='playing'){freeze-=elapsed;return;}
const t=game.tick*C.dt,active=game.phase==='active',warning=game.phase==='warning';
  const badgeCandidates:BadgeCandidate[]=[];
  for(const b of game.balls){if(!ballVisuals.has(b.id))addBall(b);const v=ballVisuals.get(b.id)!;
    const dx=(b.x-v.lastX)*.01,dz=(b.y-v.lastY)*.01;v.sphere.rotation.z-=dx/.14;v.sphere.rotation.x+=dz/.14;v.lastX=b.x;v.lastY=b.y;
    v.group.position.set((b.x-400)*.01,0,(b.y-340)*.01);
    const state=resonanceStyle(b);v.mat.emissiveIntensity=state.emission*.1;v.outer.visible=state.doubleRing;
    const labelWorld=new THREE.Vector3(v.group.position.x,.39,v.group.position.z).applyMatrix4(camera.matrixWorldInverse);
    const labelSize=26*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*(-labelWorld.z)/rect.height;v.label.scale.set(labelSize,labelSize,1);
    const p=screenPoint(b.x,b.y,.39,rect);badgeCandidates.push({id:b.id,x:p.x-rect.left,y:p.y-rect.top,priority:(b.resonant?100000:0)+(game.tick-(lastImpact.get(b.id)??-1000)<120?10000+(lastImpact.get(b.id)??0):0)});
    (v.halo.material as THREE.MeshBasicMaterial).opacity=state.opacity;(v.halo.material as THREE.MeshBasicMaterial).color.setHex(b.resonant?palette.cyan:palette.ochre);
    v.halo.scale.setScalar(b.resonant&&!reduced?1.1+Math.sin(t*5+b.id)*.12:1);
  }
  const visibleIds=selectBadges(badgeCandidates,rect.width,rect.height);visibleBadgeCount=visibleIds.size;
  badgeEvidence=badgeCandidates.filter(b=>visibleIds.has(b.id));
  for(const [id,v] of ballVisuals)v.label.visible=visibleIds.has(id);
  updateTrails();
  // 每顆球只牽到最近兩顆（340 內），每條線在中點依球號奇偶往同一側彎 6%，像手拉過去的線。
  let yarnCount=0;if(active){const pairs=new Set<number>(),n=game.balls.length;
    for(let i=0;i<n;i++){const a=game.balls[i];const near:number[]=[];for(let j=0;j<n;j++)if(j!==i&&Math.hypot(a.x-game.balls[j].x,a.y-game.balls[j].y)<340)near.push(j);
      near.sort((p,q)=>Math.hypot(a.x-game.balls[p].x,a.y-game.balls[p].y)-Math.hypot(a.x-game.balls[q].x,a.y-game.balls[q].y));for(const j of near.slice(0,2))pairs.add(Math.min(i,j)*4096+Math.max(i,j));}
    for(const key of pairs){if(yarnCount>YARN_MAX-2)break;const a=game.balls[Math.floor(key/4096)],b=game.balls[key%4096],ax=(a.x-400)*.01,az=(a.y-340)*.01,bx=(b.x-400)*.01,bz=(b.y-340)*.01,len=Math.hypot(bx-ax,bz-az),side=(a.id+b.id)%2?1:-1;
      const mx=(ax+bx)/2-(bz-az)/len*len*.06*side,mz=(az+bz)/2+(bx-ax)/len*len*.06*side;
      for(const [px,pz,qx,qz] of [[ax,az,mx,mz],[mx,mz,bx,bz]]){const l=Math.hypot(qx-px,qz-pz);yarnDir.set(qx-px,0,qz-pz).normalize();yarnPos.set((px+qx)/2,.15,(pz+qz)/2);yarnQuat.setFromUnitVectors(yarnUp,yarnDir);yarnScale.set(1,l+.02,1);network.setMatrixAt(yarnCount++,yarnMatrix.compose(yarnPos,yarnQuat,yarnScale));}}}
  network.count=yarnCount;if(yarnCount)network.instanceMatrix.needsUpdate=true;network.visible=active&&yarnCount>0;
  yarnMap.offset.y=reduced?0:-t*.35;yarnMat.emissiveIntensity=reduced?.7:.55+.25*Math.sin(t*Math.PI);
  fieldMat.uniforms.time.value=reduced?0:t;fieldMat.uniforms.strength.value=active?1:warning?.2:0;
  phaseLight.intensity=active?6:warning?2.2:.25;bloom.strength=active?.35:.12;
  {const L=LIGHTS[choice.light],k=reduced?1:1-Math.exp(-4*elapsed);key.intensity+=((active?.8:1)*L.intensity-key.intensity)*k;(scene.background as THREE.Color).lerp(active?bgShift:bgIdle,k);fog.color.copy(scene.background as THREE.Color);}
  glow.emissiveIntensity=active?2.4:1.1;crystal.rotation.y=reduced?0:t*.35;orbit1.rotation.z=reduced?0:t*.22;
  for(const [id,v] of cages)if(!game.monsters.some(m=>m.id===id)){removeVisual(v.group);cages.delete(id);}
  for(const target of game.monsters){if(!cages.has(target.id))addCage(target);const v=cages.get(target.id)!,q=Math.min(1,(game.tick-v.born)/65),scale=reduced?1:1-Math.pow(1-q,3);
    v.group.scale.setScalar(Math.max(.01,scale));v.group.position.y=reduced?0:(1-scale)*.65;v.group.rotation.y=reduced?0:(1-scale)*Math.PI;
    const hit=game.tick<target.flashUntil;(v.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity=hit?4:1.1;v.crystal.rotation.y=reduced?0:t*.3+target.id;
  }
  crystal.scale.setScalar(game.tick<game.boss.flashUntil?1.15:1);
  for(let i=effects.length-1;i>=0;i--){const e=effects[i],q=(t-e.born)/e.duration;if(q>=1){disposeEffect(e);effects.splice(i,1);continue;}const m=e.mesh as THREE.Mesh;(m.material as THREE.MeshBasicMaterial).opacity=(1-q)*(reduced?.22:.65);if(e.kind!=='ignite')m.scale.setScalar(.12+e.radius*(1-(1-q)**3));}
  aimMesh.visible=game.status==='playing'&&(drag!==null||document.activeElement===canvas);aimMesh.rotation.y=-angle;barrel.rotation.y=-angle-Math.PI/2;
  if(currentPhase!==game.phase){currentPhase=game.phase;phaseText.textContent=active?'SHIFT · 全場同頻':warning?'正在同步':'累積，等待共振';document.querySelector('.phase')!.setAttribute('data-active',String(active));document.querySelector('#announcement')!.textContent=active?'相變開始，低摩擦流動':warning?'即將相變':'等待下一次碰撞';}
  const status=`${String(game.shots).padStart(2,'0')} 顆球留在場上 · ${active?'一起流動':maxDepth>1?`最深 ${maxDepth} 層連鎖`:'拖拉後放開'}`;if(statusText.textContent!==status)statusText.textContent=status;
  try{composer.render();}catch{stopped=true;showFallback();return;}canvas.dataset.status=game.status;canvas.dataset.ready='true';canvas.dataset.phase=game.phase;canvas.dataset.shots=String(game.shots);
}
// 開始前保留材質樣本，預熱實際後處理管線及有／無陰影的 shader。
// 樣本只屬於呈現層，不進入遊戲規則、計時或驗收的球集合。
const warmupGroup=new THREE.Group();scene.add(warmupGroup);
for(let material=0;material<3;material++){
  const id=-1-material;addBall({id,material,x:350+material*50,y:340});
  const visual=ballVisuals.get(id)!;warmupGroup.add(visual.group);visual.outer.visible=true;ballVisuals.delete(id);
}
const warmRing=new THREE.Mesh(effectRingGeometry,new THREE.MeshBasicMaterial({color:palette.cyan,transparent:true,opacity:.8,depthWrite:false,clippingPlanes:arenaClip}));
warmRing.rotation.x=-Math.PI/2;warmRing.receiveShadow=true;warmupGroup.add(warmRing);
const warmLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.15,0),new THREE.Vector3(1,.15,0)]),new THREE.LineBasicMaterial({color:palette.edge,transparent:true,opacity:.8}));warmupGroup.add(warmLine);
composer.renderToScreen=false;
for(const shadows of [true,false,true]){
  renderer.shadowMap.enabled=shadows;
  scene.traverse(o=>{const m=(o as THREE.Mesh).material;if(m)for(const material of Array.isArray(m)?m:[m])material.needsUpdate=true;});
  renderer.compile(scene,camera);composer.render();
}
warmupGroup.visible=false;composer.renderToScreen=true;
previous=performance.now();quality.resetWindow();
requestAnimationFrame(frame);
}
try{startScene();}catch{showFallback();}
}
