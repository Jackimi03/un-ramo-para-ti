import * as THREE from './vendor/three.module.min.js';

// Software fallback: projects and lights the same meshes, never a flattened image.
export class CanvasBouquetRenderer {
  constructor(clock) {
    this.clock=clock;this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');
    this.shadowMap={};this.info={render:{calls:0}};this.ratio=1;this.software=true;
    this.model=new THREE.Matrix4();this.mvp=new THREE.Matrix4();this.vp=new THREE.Matrix4();this.instance=new THREE.Matrix4();this.normal=new THREE.Matrix3();
    this.v=new THREE.Vector3();this.n=new THREE.Vector3();this.tint=new THREE.Color();
    this.key=new THREE.Vector3(-3,7,5).normalize();this.fill=new THREE.Vector3(4,3,-5).normalize();
  }
  setClearColor(){} setPixelRatio(n){this.ratio=1;}
  setSize(w,h){this.w=w;this.h=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);}
  dispose(){}
  render(scene,camera) {
    if(!this.w)return;
    scene.updateMatrixWorld();camera.updateMatrixWorld();
    this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const ctx=this.ctx,faces=[],time=this.clock.value,smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
    ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,this.w,this.h);
    let calls=0;
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;calls++;
      const g=mesh.geometry,a=g.attributes,p=a.position,n=a.normal,idx=g.index?.array;
      if(!idx)return;
      for(let k=0;k<(mesh.isInstancedMesh?mesh.count:1);k++) {
        if(mesh.isInstancedMesh){mesh.getMatrixAt(k,this.instance);this.model.multiplyMatrices(mesh.matrixWorld,this.instance);}
        else this.model.copy(mesh.matrixWorld);
        this.mvp.multiplyMatrices(this.vp,this.model);this.normal.getNormalMatrix(this.model);
        let bloom=1,bud=1;
        const start=mesh.isInstancedMesh&&a.aStart?a.aStart.getX(k):0;
        if(a.closedPosition){bud=smooth(start-.8,start-.2,time);if(bud<.002)continue;bloom=(1-Math.pow(1-THREE.MathUtils.clamp((time-start)/2.65,0,1),3))*a.aOpen.getX(k);}
        else if(mesh.isInstancedMesh&&a.aStart){bud=smooth(start+.3,start+1.9,time);if(bud<.01)continue;}
        const tint=mesh.material.color.clone();if(mesh.instanceColor){mesh.getColorAt(k,this.tint);tint.multiply(this.tint);}
        const vertices=new Array(p.count),colors=new Array(p.count),normals=new Array(p.count);
        for(let j=0;j<p.count;j++) {
          this.v.fromBufferAttribute(p,j);
          if(a.closedPosition){this.v.lerp(new THREE.Vector3().fromBufferAttribute(a.closedPosition,j),1-bloom).multiplyScalar(.15+.85*bud);this.n.fromBufferAttribute(a.openNormal,j).lerp(new THREE.Vector3().fromBufferAttribute(a.closedNormal,j),1-bloom);}
          else {this.v.multiplyScalar(bud);this.n.fromBufferAttribute(n,j);}
          this.v.applyMatrix4(this.mvp);vertices[j]=[this.w*(.5+this.v.x*.5),this.h*(.5-this.v.y*.5),this.v.z];
          this.n.applyMatrix3(this.normal).normalize();normals[j]=[this.n.x,this.n.y,this.n.z];
          colors[j]=a.color?[a.color.getX(j)*tint.r,a.color.getY(j)*tint.g,a.color.getZ(j)*tint.b]:[tint.r,tint.g,tint.b];
        }
        for(let j=0;j<idx.length;j+=3) {
          const ia=idx[j],ib=idx[j+1],ic=idx[j+2],pa=vertices[ia],pb=vertices[ib],pc=vertices[ic];
          if(a.aSegment&&a.aSegment.getX(ia)>smooth(a.aStart.getX(ia),a.aStart.getX(ia)+3.1,time))continue;
          if(pa[2]>1||pb[2]>1||pc[2]>1)continue;
          const ns=normals[ia],nb=normals[ib],nc=normals[ic];this.n.set(ns[0]+nb[0]+nc[0],ns[1]+nb[1]+nc[1],ns[2]+nb[2]+nc[2]).normalize();
          // Thin petals transmit a little light on their reverse side.
          const light=.49+.53*Math.abs(this.n.dot(this.key))+.17*Math.max(0,this.n.dot(this.fill));
          const ca=colors[ia],cb=colors[ib],cc=colors[ic];
          const channel=i=>Math.round(255*Math.pow(Math.min(1,((ca[i]+cb[i]+cc[i])/3)*light),1/2.2));
          let pd=null;if(idx[j+3]===ib&&idx[j+5]===ic){pd=vertices[idx[j+4]];j+=3;}
          faces.push({pa,pb,pc,pd,z:(pa[2]+pb[2]+pc[2])/3,color:`rgb(${channel(0)},${channel(1)},${channel(2)})`});
        }
      }
    });
    faces.sort((a,b)=>b.z-a.z);
    ctx.lineWidth=.55;ctx.lineJoin='round';
    for(const f of faces){ctx.fillStyle=ctx.strokeStyle=f.color;ctx.beginPath();ctx.moveTo(f.pa[0],f.pa[1]);ctx.lineTo(f.pb[0],f.pb[1]);if(f.pd)ctx.lineTo(f.pd[0],f.pd[1]);ctx.lineTo(f.pc[0],f.pc[1]);ctx.closePath();ctx.fill();}
    this.info.render.calls=calls;
  }
}
