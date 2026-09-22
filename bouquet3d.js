import * as THREE from './vendor/three.module.min.js';
import { CanvasBouquetRenderer } from './canvas3d.js?v=3d-4';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const clock = { value: -1 };
let seed = 7549;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const dummy = new THREE.Object3D();

// A shared surface has two genuine 3D shapes. The GPU unfolds every instance.
function surface(kind, rows = 16, cols = 10) {
  const opened = [], closed = [], colors = [], uvs = [], indices = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols * 2 - 1;
      let p, q;
      if (kind === 'tulip') {
        const a = u * .91 * Math.pow(Math.sin(t * Math.PI / 2), .4);
        const r = .035 + .37 * Math.sin(t * Math.PI * .72) + .065 * t ** 7;
        const rc = .035 + .235 * Math.sin(t * Math.PI * .98);
        p = [Math.sin(a) * r, .85*t - .1*t**4 - .065*u*u*t**3, Math.cos(a)*r];
        q = [Math.sin(a)*rc, .86*t - .035*u*u*t**3, Math.cos(a)*rc];
      } else if (kind === 'lily') {
        const w = .23 * Math.pow(Math.sin(Math.PI*t), .72) * (1 + .07*Math.sin(t*17+u*2));
        p = [u*w, .39*Math.sin(t*Math.PI*.94)-.22*t**5 + u*u*.1*Math.sin(Math.PI*t), t*1.04];
        q = [u*w*.28, t*.96, .035+.105*Math.sin(Math.PI*t)];
      } else {
        const w = .22 * Math.pow(Math.sin(Math.PI*t), .9);
        p = [u*w, .8*t-.26*t*t + u*u*.075, .63*t*t];
        q = [u*w*.18, .83*t, .055*t];
      }
      opened.push(...p); closed.push(...q); uvs.push(j/cols,t);
      const base = new THREE.Color(kind === 'leaf' ? '#35563b' : kind === 'lily' ? '#d5a21c' : '#d9a420');
      const tip = new THREE.Color(kind === 'leaf' ? '#8fa46b' : '#ffe571');
      base.lerp(tip, .2+.66*Math.sin(t*1.5));
      base.multiplyScalar(1-.1*Math.abs(u));
      colors.push(base.r,base.g,base.b);
      if (i < rows && j < cols) {
        const a=i*(cols+1)+j,b=a+cols+1;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new THREE.Float32BufferAttribute(opened,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  g.setAttribute('openNormal',g.getAttribute('normal').clone());
  const c = g.clone();
  c.setAttribute('position',new THREE.Float32BufferAttribute(closed,3)); c.computeVertexNormals();
  g.setAttribute('closedPosition',c.getAttribute('position').clone());
  g.setAttribute('closedNormal',c.getAttribute('normal').clone());
  c.dispose();
  return g;
}

function morphMaterial(kind, depth = false) {
  const material = depth ? new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}) : new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:kind==='leaf'?.65:.48,metalness:0});
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = clock;
    shader.vertexShader = `attribute vec3 closedPosition; attribute vec3 closedNormal; attribute vec3 openNormal; attribute float aStart; attribute float aOpen; uniform float uTime; varying float vBorn; varying vec2 vPetalUv;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `float bloom = clamp((uTime-aStart)/2.65,0.0,1.0); bloom = (1.0-pow(1.0-bloom,3.0))*aOpen; vec3 objectNormal = normalize(mix(closedNormal,openNormal,bloom));`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `float bud = smoothstep(aStart-0.8,aStart-0.2,uTime); vec3 transformed = mix(closedPosition,position,bloom)*mix(0.15,1.0,bud); vBorn=bud; vPetalUv=uv;`);
    // Depth shaders do not run the normal chunk, so define the interpolation here.
    if (depth) shader.vertexShader = shader.vertexShader.replace('float bud =', 'float bloom = clamp((uTime-aStart)/2.65,0.0,1.0); bloom=(1.0-pow(1.0-bloom,3.0))*aOpen; float bud =');
    shader.fragmentShader = 'varying float vBorn; varying vec2 vPetalUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(vBorn<0.002) discard;');
    if (!depth) {
      const spots = kind==='lily' ? `vec2 cell=floor(vPetalUv*vec2(19.0,29.0)); float hash=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453); float spot=step(0.84,hash)*(1.0-smoothstep(0.13,0.23,length(fract(vPetalUv*vec2(19.0,29.0))-.5)))*(1.0-smoothstep(.2,.53,vPetalUv.y)); diffuseColor.rgb*=1.0-spot*.46;` : '';
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nfloat vein=pow(0.5+0.5*cos(vPetalUv.x*94.0+sin(vPetalUv.y*8.0)),9.0); diffuseColor.rgb*=1.0-.045*vein; ${spots}`);
    }
  };
  material.customProgramCacheKey = () => `${kind}-${depth}-botanical-v3`;
  return material;
}

function instances(geometry, material, records, root, morphKind) {
  const mesh=new THREE.InstancedMesh(geometry,material,records.length);
  const starts=[], opens=[];
  records.forEach((r,i)=>{
    mesh.setMatrixAt(i,r.matrix);
    if(r.color) mesh.setColorAt(i,r.color);
    starts.push(r.start||0); opens.push(r.open??1);
  });
  if(morphKind) {
    geometry.setAttribute('aStart',new THREE.InstancedBufferAttribute(new Float32Array(starts),1));
    geometry.setAttribute('aOpen',new THREE.InstancedBufferAttribute(new Float32Array(opens),1));
    mesh.customDepthMaterial=morphMaterial(morphKind,true);
  }
  mesh.frustumCulled=false; mesh.castShadow=true; mesh.receiveShadow=true;
  root.add(mesh); return mesh;
}

function matrix(position, quaternion, scale) {
  return new THREE.Matrix4().compose(position,quaternion,new THREE.Vector3(...scale));
}

export function createBouquet(host, onComplete, onFailure) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'}); }
  catch { renderer = new CanvasBouquetRenderer(clock); }
  host.dataset.renderer=renderer.software?'canvas-3d':'webgl';
  renderer.setClearColor(0x000000,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.5:1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const canvas=renderer.domElement;
  canvas.setAttribute('aria-label','Ramo tridimensional de 50 tulipanes amarillos y 25 lirios amarillos. Arrastra para girar; usa dos dedos para acercar. Con teclado, flechas para girar y signos más o menos para acercar.');
  canvas.setAttribute('role','img'); canvas.tabIndex=-1;
  host.append(canvas);
  const scene=new THREE.Scene(), root=new THREE.Group(); scene.add(root);
  const camera=new THREE.PerspectiveCamera(36,1,.1,100);
  const target=new THREE.Vector3(0,.28,0);
  scene.add(new THREE.HemisphereLight(0xfff7dc,0x665f40,1.75));
  const key=new THREE.DirectionalLight(0xfff0d2,3.1); key.position.set(-3,7,5);
  key.castShadow=true; key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:18});
  key.shadow.bias=-.0004; key.shadow.normalBias=.035; key.shadow.radius=2;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xf0f7ff,1.15);fill.position.set(4,3,-5);scene.add(fill);

  const flowerData=[], tulipRecords=[], lilyRecords=[], leafRecords=[];
  const stemPositions=[], stemNormals=[], stemTimes=[], stemSegments=[], stemIndices=[];
  const anthers=[], filaments=[];
  const stamenGeometry=new THREE.CylinderGeometry(1,1,1,5,1);
  const goldMaterial=new THREE.MeshStandardMaterial({color:'#775022',roughness:.67});
  const filamentMaterial=new THREE.MeshStandardMaterial({color:'#d1bb66',roughness:.52});
  const stemMaterial=new THREE.MeshStandardMaterial({color:'#496839',roughness:.8});
  seed=7549;
  for(let i=0;i<75;i++) {
    const kind=i%3===0?'lily':'tulip';
    const a=i*Math.PI*(3-Math.sqrt(5))+(random()-.5)*.24;
    const h=1-(i+.5)/75*1.38;
    const radius=(2.05+(random()-.5)*.23)*Math.sqrt(1-h*h);
    const pos=new THREE.Vector3(Math.cos(a)*radius,1.12+h*1.62+(random()-.5)*.11,Math.sin(a)*radius);
    const dir=new THREE.Vector3(pos.x*(kind==='lily'?.68:.32),.7+h*.8,pos.z*(kind==='lily'?.68:.32)).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(UP,dir);
    const size=(kind==='lily'?.77:.78)+random()*.16;
    const start=kind==='lily'?6+i*.01+random()*1.5:3.95+i*.018+random()*.9;
    const openness=kind==='lily'?.91+random()*.09:.54+random()*.46;
    const flower={kind,position:pos.toArray(),start,open:openness}; flowerData.push(flower);
    const parent=matrix(pos,q,[size,size,size]);
    for(let p=0;p<6;p++) {
      const angle=p*TAU/6+(p%2?.06:0);
      dummy.position.set(0,p%2?.025:0,0); dummy.rotation.set(0,angle,0);
      dummy.scale.setScalar(p%2?.93:1); dummy.updateMatrix();
      const tint=new THREE.Color().setRGB(1,.94+random()*.06,.77+random()*.23);
      (kind==='lily'?lilyRecords:tulipRecords).push({matrix:parent.clone().multiply(dummy.matrix),start:start+p*.04,open:openness,color:tint});
    }
    const base=new THREE.Vector3(Math.cos(a)*.18,-2.17+random()*.15,Math.sin(a)*.18);
    const curve=new THREE.CubicBezierCurve3(base,new THREE.Vector3(base.x*.6,-.9,base.z*.6),new THREE.Vector3(pos.x*.67,pos.y-.45,pos.z*.67),pos);
    const tube=new THREE.TubeGeometry(curve,17,.025+random()*.01,5,false);
    const offset=stemPositions.length/3, arr=tube.attributes.position.array;
    stemPositions.push(...arr); stemNormals.push(...tube.attributes.normal.array);
    for(let v=0;v<arr.length/3;v++) {stemTimes.push(i*.018);stemSegments.push(tube.attributes.uv.getX(v));}
    stemIndices.push(...Array.from(tube.index.array,n=>n+offset));tube.dispose();
    for(let l=0;l<2;l++) {
      const t=.47+l*.18, lp=curve.getPoint(t);
      const ld=new THREE.Vector3(Math.cos(a+(l?.5:-.5))*.85,.6,Math.sin(a+(l?.5:-.5))*.85).normalize();
      const lq=new THREE.Quaternion().setFromUnitVectors(UP,ld);
      leafRecords.push({matrix:matrix(lp,lq,[.75,1.05+random()*.45,1.1]),start:2.45+l*.52+i*.018+random()*.25,open:1});
    }
    if(kind==='lily') for(let j=0;j<6;j++) {
      const ang=j*TAU/6;
      const end=new THREE.Vector3(Math.cos(ang)*.19,.52+random()*.12,Math.sin(ang)*.19);
      const localQ=new THREE.Quaternion().setFromUnitVectors(UP,end.clone().normalize());
      filaments.push({matrix:parent.clone().multiply(matrix(end.clone().multiplyScalar(.5),localQ,[.009,end.length(),.009])),start});
      const aq=new THREE.Quaternion().setFromEuler(new THREE.Euler(.5,ang,.65));
      anthers.push({matrix:parent.clone().multiply(matrix(end,aq,[.035,.07,.026])),start});
    }
  }
  const tulipMesh=instances(surface('tulip',renderer.software?10:16,renderer.software?6:10),morphMaterial('tulip'),tulipRecords,root,'tulip');
  const lilyMesh=instances(surface('lily',renderer.software?10:16,renderer.software?6:10),morphMaterial('lily'),lilyRecords,root,'lily');
  instances(surface('leaf',10,6),morphMaterial('leaf'),leafRecords,root,'leaf');
  const stemGeometry=new THREE.BufferGeometry();stemGeometry.setIndex(stemIndices);
  stemGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stemPositions,3));
  stemGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(stemNormals,3));
  stemGeometry.setAttribute('aStart',new THREE.Float32BufferAttribute(stemTimes,1));
  stemGeometry.setAttribute('aSegment',new THREE.Float32BufferAttribute(stemSegments,1));
  function growStem(material) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.uTime=clock;
      shader.vertexShader='attribute float aStart; attribute float aSegment; uniform float uTime; varying float vCut;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCut=aSegment-smoothstep(aStart,aStart+3.1,uTime);');
      shader.fragmentShader='varying float vCut;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vCut>0.0) discard;');
    }; material.customProgramCacheKey=()=>`stems-${material.type}`;return material;
  }
  const stems=new THREE.Mesh(stemGeometry,growStem(stemMaterial));stems.castShadow=true;stems.receiveShadow=true;
  stems.customDepthMaterial=growStem(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));root.add(stems);
  function revealStamens(material) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.uTime=clock;
      shader.vertexShader='attribute float aStart; uniform float uTime; varying float vShow;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','float p=smoothstep(aStart+.3,aStart+1.9,uTime); vec3 transformed=position*p; vShow=p;');
      shader.fragmentShader='varying float vShow;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vShow<.01) discard;');
    }; material.customProgramCacheKey=()=>`stamen-${material.type}`;return material;
  }
  for(const [geometry,material,records] of [[stamenGeometry,filamentMaterial,filaments],[new THREE.SphereGeometry(1,8,6),goldMaterial,anthers]]) {
    geometry.setAttribute('aStart',new THREE.InstancedBufferAttribute(new Float32Array(records.map(r=>r.start)),1));
    const mesh=instances(geometry,revealStamens(material),records,root);
    mesh.customDepthMaterial=revealStamens(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));
  }

  const wrapper=new THREE.Group();root.add(wrapper);
  const paperMat=new THREE.MeshStandardMaterial({color:'#f1e4c9',roughness:.92,side:THREE.DoubleSide});
  for(let layer=0;layer<3;layer++) {
    const positions=[],uv=[],idx=[], segments=44, rows=12;
    for(let iy=0;iy<=rows;iy++) for(let ix=0;ix<=segments;ix++) {
      const t=iy/rows, ang=ix/segments*TAU*.72+layer*TAU/3;
      const top=.26+.16*Math.sin(ang*3+layer)+.08*Math.sin(ang*7);
      const y=-2.35+t*(top+2.35);
      const rad=(t<.32 ? .64-t*.7 : .415+Math.pow((t-.32)/.68,1.5)*1.27)+layer*.018;
      const fold=.045*Math.sin(ang*13+layer)*t+.018*Math.sin(t*10+ang*7);
      positions.push(Math.cos(ang)*(rad+fold),y,Math.sin(ang)*(rad+fold)); uv.push(ix/segments,t);
      if(iy<rows&&ix<segments) {const a=iy*(segments+1)+ix,b=a+segments+1;idx.push(a,b,a+1,b,b+1,a+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setIndex(idx);geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,paperMat);mesh.castShadow=true;mesh.receiveShadow=true;wrapper.add(mesh);
  }
  const ribbonMaterial=new THREE.MeshStandardMaterial({color:'#b39555',roughness:.39,metalness:.12,side:THREE.DoubleSide});
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.44,.038,7,48),ribbonMaterial);belt.rotation.x=Math.PI/2;belt.position.y=-1.5;wrapper.add(belt);
  function ribbonCurve(side,tail=false) {
    const points=[]; for(let i=0;i<=32;i++) {const t=i/32;
      points.push(tail?new THREE.Vector3(side*(.05+.36*t),-1.5-t*.82,.46+.14*Math.sin(t*5)):new THREE.Vector3(side*Math.sin(Math.PI*t)*.61,-1.5+Math.sin(TAU*t)*.19,.46+Math.sin(Math.PI*t)*.16));}
    const geo=new THREE.BufferGeometry(), positions=[],indices=[];
    points.forEach((p,i)=>{const w=tail?.055:.058;positions.push(p.x,p.y-w,p.z,p.x,p.y+w,p.z+.012);if(i<32){const a=i*2;indices.push(a,a+2,a+1,a+2,a+3,a+1);}});
    geo.setIndex(indices);geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,ribbonMaterial);mesh.castShadow=true;wrapper.add(mesh);
  }
  ribbonCurve(-1);ribbonCurve(1);ribbonCurve(-1,true);ribbonCurve(1,true);
  const knot=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),ribbonMaterial);knot.scale.set(1,.7,.65);knot.position.set(0,-1.5,.48);wrapper.add(knot);

  let mode='idle', elapsed=0, last=0, raf=0, theta=.15, phi=1.29, zoom=1, baseDistance=12;
  let velocityX=0,velocityY=0,lastMove=0;
  const pointers=new Map(); let pinchDistance=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function cameraPosition() {
    const r=baseDistance*zoom;
    camera.position.set(target.x+r*Math.sin(phi)*Math.sin(theta),target.y+r*Math.cos(phi),target.z+r*Math.sin(phi)*Math.cos(theta));camera.lookAt(target);
  }
  function diagnostics() {
    host.dataset.flowers=String(flowerData.length);host.dataset.tulips=String(flowerData.filter(f=>f.kind==='tulip').length);host.dataset.lilies=String(flowerData.filter(f=>f.kind==='lily').length);
    host.dataset.state=mode;host.dataset.yaw=theta.toFixed(4);host.dataset.pitch=phi.toFixed(4);host.dataset.zoom=zoom.toFixed(3);
    host.dataset.bloomed=String(flowerData.filter(f=>clock.value>=f.start+2.85).length);
    host.dataset.elapsed=elapsed.toFixed(2);host.dataset.drawCalls=String(renderer.info.render.calls);
  }
  function frame(now) {
    raf=0;const dt=Math.min((now-last)/1000||0,1);last=now;
    if(document.hidden)return;
    if(mode==='growing') {
      elapsed+=dt;
      clock.value=reduced.matches?20:elapsed;
      const w=reduced.matches?1:smooth(9.15,10.65,elapsed);
      wrapper.visible=w>0;wrapper.scale.set(1,.85+.15*w,1);
      wrapper.position.y=-.22*(1-w);
      renderer.shadowMap.needsUpdate=true;
      if(elapsed>=(reduced.matches?.65:12.25)) {mode='interactive';canvas.tabIndex=0;canvas.classList.add('is-interactive');onComplete();}
    }
    if(mode==='interactive'&&!pointers.size&&!reduced.matches) {
      theta+=velocityX;phi=clamp(phi+velocityY,.12,Math.PI-.2);
      const decay=Math.exp(-dt*9);velocityX*=decay;velocityY*=decay;
    }
    cameraPosition();renderer.render(scene,camera);diagnostics();
    if(mode==='growing'||Math.abs(velocityX)+Math.abs(velocityY)>.00005)request(false);
  }
  function request(wake=true){if(!raf&&!document.hidden){if(wake)last=performance.now();raf=requestAnimationFrame(frame);}}
  function resize(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();baseDistance=Math.max(3.35/Math.tan(Math.PI*.1),2.98/(Math.tan(Math.PI*.1)*camera.aspect))*1.02;renderer.setSize(r.width,r.height,false);request();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  function pairDistance(){const [a,b]=Array.from(pointers.values());return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
  canvas.addEventListener('pointerdown',event=>{
    if(mode!=='interactive')return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);
    velocityX=velocityY=0;lastMove=performance.now();pinchDistance=pairDistance();canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove',event=>{
    const previous=pointers.get(event.pointerId);if(!previous||mode!=='interactive')return;
    const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2){const distance=pairDistance();if(pinchDistance>0)zoom=clamp(zoom*pinchDistance/distance,.62,1.65);pinchDistance=distance;velocityX=velocityY=0;}
    else {const sensitivity=TAU/Math.max(host.clientWidth,260);theta-=dx*sensitivity;phi=clamp(phi-dy*.009,.12,Math.PI-.2);velocityX=clamp(-dx*sensitivity*.22,-.04,.04);velocityY=clamp(-dy*.002,-.025,.025);}
    lastMove=performance.now();request();
  });
  function release(event){pointers.delete(event.pointerId);pinchDistance=pairDistance();if(!pointers.size){canvas.classList.remove('is-dragging');if(performance.now()-lastMove>90||reduced.matches)velocityX=velocityY=0;request();}}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',event=>{velocityX=velocityY=0;release(event);});canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('wheel',event=>{if(mode!=='interactive')return;event.preventDefault();zoom=clamp(zoom*Math.exp(event.deltaY*.001),.62,1.65);request();},{passive:false});
  canvas.addEventListener('keydown',event=>{
    if(mode!=='interactive')return;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'];if(!keys.includes(event.key))return;event.preventDefault();velocityX=velocityY=0;
    if(event.key==='ArrowLeft')theta-=.18;if(event.key==='ArrowRight')theta+=.18;if(event.key==='ArrowUp')phi=clamp(phi-.12,.12,Math.PI-.2);if(event.key==='ArrowDown')phi=clamp(phi+.12,.12,Math.PI-.2);
    if(event.key==='+'||event.key==='=')zoom=clamp(zoom*.9,.62,1.65);if(event.key==='-')zoom=clamp(zoom/ .9,.62,1.65);if(event.key==='Home'){theta=.15;phi=1.29;zoom=1;}request();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else request();});
  reduced.addEventListener('change',()=>{velocityX=velocityY=0;request();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;mode='lost';onFailure('El ramo necesita recuperar la imagen. Toca para intentarlo otra vez.');});
  canvas.addEventListener('webglcontextrestored',()=>{renderer.shadowMap.needsUpdate=true;mode='interactive';clock.value=20;wrapper.visible=true;onComplete();request();});
  wrapper.visible=false;root.visible=false;
  resize();
  return {
    start(){elapsed=0;clock.value=-1;theta=.15;phi=1.29;zoom=1;velocityX=velocityY=0;pointers.clear();mode='growing';root.visible=true;wrapper.visible=false;canvas.tabIndex=-1;canvas.classList.remove('is-interactive','is-dragging');request();},
    manifest:flowerData,
    dispose(){cancelAnimationFrame(raf);observer.disconnect();renderer.dispose();}
  };
}
