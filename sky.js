import * as THREE from './vendor/three.module.js';

const root=document.querySelector('#sky'),canvas=document.querySelector('#stars');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEG=Math.PI/180;
const toVector=(ra,dec)=>new THREE.Vector3(Math.cos(dec*DEG)*Math.cos(ra*DEG),Math.sin(dec*DEG),-Math.cos(dec*DEG)*Math.sin(ra*DEG)).multiplyScalar(100);
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);
  await initialize();
} catch(error) {
  root.classList.add('error');
  document.querySelector('#loading').textContent='星空暂时未能展开，请刷新页面或使用支持 WebGL 的浏览器。';
  console.error(error);
}

async function initialize(){
  const response=await fetch('./data/sky.json');
  if(!response.ok)throw Error('Star catalog unavailable');
  const data=await response.json();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(64,1,.1,200);
  const starsById=new Map(data.stars.map(s=>[s[0],{position:toVector(s[1],s[2]),data:s}]));
  let width=innerWidth,height=innerHeight,dpr=1;
  let ra=77,dec=19,targetRa=ra,targetDec=dec;
  let active=-1,keyboardIndex=18,drag=null,moved=false,touchUntil=0;
  let showAll=false;
  const toggle=document.querySelector('#constellation-toggle');
  toggle.addEventListener('click',()=>{
    showAll=!showAll;
    toggle.setAttribute('aria-pressed',String(showAll));
    document.querySelector('#toggle-hint').textContent=showAll?'恢复悬停显示':'显示全部星宿';
    root.classList.toggle('show-all',showAll);
    active=-1;touchUntil=0;mouse={x:-10000,y:-10000};
  });
  let mouse={x:-10000,y:-10000};
  let lastFrame=0,running=true;

  function starColor(bv){
    const color=new THREE.Color();
    if(bv<.2) color.setRGB(.70,.82,1);
    else if(bv<.8) color.setRGB(.92,.94,1);
    else color.setRGB(1,.83-Math.min(.20,(bv-.8)*.16),.63-Math.min(.20,(bv-.8)*.12));
    return color;
  }
  const positions=[],colors=[],sizes=[],brightness=[],seeds=[];
  for(const s of data.stars){
    positions.push(...starsById.get(s[0]).position.toArray());
    colors.push(...starColor(s[4]).toArray());
    sizes.push(THREE.MathUtils.clamp(16-s[3]*1.55,4.1,23));
    brightness.push(THREE.MathUtils.clamp(1.12-(s[3]-1)*.125,.16,1.4));
    seeds.push((s[0]%173)*.137);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('brightness',new THREE.Float32BufferAttribute(brightness,1));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
    uniforms:{uDpr:{value:1},uTime:{value:0},uMotion:{value:reduced?0:1}},
    vertexShader:`attribute vec3 color; attribute float size; attribute float brightness; attribute float seed;
      uniform float uDpr; varying vec3 vColor; varying float vBrightness; varying float vSeed; varying float vSize;
      void main(){ vColor=color; vBrightness=brightness; vSeed=seed; vSize=size;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=size*uDpr; }`,
    fragmentShader:`precision highp float; uniform float uTime; uniform float uMotion;
      varying vec3 vColor; varying float vBrightness; varying float vSeed; varying float vSize;
      void main(){vec2 p=gl_PointCoord-.5; float r=length(p);
      float core=exp(-r*r*155.); float halo=exp(-r*r*22.)*.105;
      float rays=(exp(-abs(p.x)*115.)*exp(-abs(p.y)*15.)+exp(-abs(p.y)*115.)*exp(-abs(p.x)*15.))*.075*step(12.,vSize);
      float twinkle=1.+.045*uMotion*sin(uTime*.65+vSeed);
      float alpha=(core+halo+rays)*vBrightness*twinkle*smoothstep(.5,.36,r);
      gl_FragColor=vec4(vColor,alpha); }`
  });
  scene.add(new THREE.Points(geometry,material));

  const houses=data.houses.map((h,index)=>{
    const ids=[...new Set(h.lines.flat())];
    const center=new THREE.Vector3();ids.forEach(id=>center.add(starsById.get(id).position));center.normalize().multiplyScalar(100);
    const vertices=[],progress=[];
    const edges=h.lines.flatMap(line=>line.slice(1).map((id,i)=>[line[i],id]));
    edges.forEach(([from,to],i)=>{
      const a=starsById.get(from).position,b=starsById.get(to).position;
      for(let part=0;part<12;part++){
        for(const t of [part/12,(part+1)/12]){
          vertices.push(...a.clone().lerp(b,t).normalize().multiplyScalar(99.9).toArray());
          progress.push((i+t)/edges.length);
        }
      }
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('aProgress',new THREE.Float32BufferAttribute(progress,1));
    const mat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
      uniforms:{uOpacity:{value:0},uReveal:{value:0}},
      vertexShader:`attribute float aProgress; varying float vProgress; void main(){vProgress=aProgress;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uOpacity;uniform float uReveal;varying float vProgress;void main(){float a=1.-smoothstep(uReveal-.12,uReveal,vProgress);float emphasis=a*uOpacity; vec3 color=mix(vec3(.45,.55,.68),vec3(.94,.83,.62),emphasis); gl_FragColor=vec4(color,.12+emphasis*.48);}`
    });
    const line=new THREE.LineSegments(geo,mat);line.visible=true;scene.add(line);
    const glowGeo=new THREE.BufferGeometry().setFromPoints(ids.map(id=>starsById.get(id).position));
    const glowMat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uOpacity:{value:0},uDpr:{value:1}},
      vertexShader:`uniform float uDpr;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=22.*uDpr;}`,
      fragmentShader:`uniform float uOpacity;void main(){float r=length(gl_PointCoord-.5);float a=exp(-r*r*115.)*.7+exp(-r*r*18.)*.13;gl_FragColor=vec4(.94,.85,.66,a*uOpacity);}`
    });
    const glow=new THREE.Points(glowGeo,glowMat);glow.visible=true;scene.add(glow);
    const label=document.createElement('div');label.className='label';label.hidden=true;
    const title=document.createElement('strong');title.textContent=h.name;
    const subtitle=document.createElement('small');subtitle.textContent=h.group;
    label.append(title,subtitle);document.querySelector('#labels').append(label);
    return {...h,index,ids,center,line,mat,glow,glowMat,label,opacity:0,reveal:0};
  });

  function resize(){
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio,2);
    renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.fov=width<600?78:64;camera.updateProjectionMatrix();
    material.uniforms.uDpr.value=dpr;houses.forEach(h=>h.glowMat.uniforms.uDpr.value=dpr);
  }
  function aim(){
    camera.up.set(0,1,0);camera.lookAt(toVector(ra,dec));camera.rotateZ(-.12);camera.updateMatrixWorld();
  }
  const projected=new THREE.Vector3();
  function screenPoint(position){
    projected.copy(position).project(camera);
    return {x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,visible:projected.z>0&&projected.z<1&&Math.abs(projected.x)<1.15&&Math.abs(projected.y)<1.15};
  }
  function pick(x,y,radius=32){
    let chosen=-1,nearest=radius*radius;
    for(const house of houses)for(const id of house.ids){
      const p=screenPoint(starsById.get(id).position);
      const distance=(x-p.x)**2+(y-p.y)**2;
      if(p.visible&&distance<nearest){nearest=distance;chosen=house.index;}
    }
    return chosen;
  }
  canvas.addEventListener('pointerdown',event=>{
    root.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
    drag={x:event.clientX,y:event.clientY,ra:targetRa,dec:targetDec,type:event.pointerType};moved=false;
  });
  canvas.addEventListener('pointermove',event=>{
    mouse={x:event.clientX,y:event.clientY};touchUntil=0;
    if(drag){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>5)moved=true;
      if(moved){targetRa=drag.ra+dx/height*camera.fov;targetDec=THREE.MathUtils.clamp(drag.dec+dy/height*camera.fov,-78,78);active=-1;}
    }
  });
  function pointerUp(event){
    if(!drag)return;
    if(!moved){active=pick(event.clientX,event.clientY,event.pointerType==='touch'?44:32);touchUntil=performance.now()+5000;}
    drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',()=>{drag=null;mouse={x:-10000,y:-10000};});
  canvas.addEventListener('pointerleave',()=>{if(!drag)mouse={x:-10000,y:-10000};});
  root.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','[',']','Escape'].includes(event.key))return;
    event.preventDefault();mouse={x:-10000,y:-10000};
    if(event.key==='ArrowLeft')targetRa-=8;
    if(event.key==='ArrowRight')targetRa+=8;
    if(event.key==='ArrowUp')targetDec=Math.min(78,targetDec+6);
    if(event.key==='ArrowDown')targetDec=Math.max(-78,targetDec-6);
    if(event.key==='Escape'){active=-1;touchUntil=0;}
    if(event.key==='['||event.key===']'){
      keyboardIndex=(keyboardIndex+(event.key===']'?1:27))%28;const h=houses[keyboardIndex];
      const unit=h.center.clone().normalize();const destination=Math.atan2(-unit.z,unit.x)/DEG;
      targetRa=ra+THREE.MathUtils.euclideanModulo(destination-ra+180,360)-180;
      targetDec=Math.asin(unit.y)/DEG;active=keyboardIndex;touchUntil=Infinity;
    }
  });
  function render(now){
    if(!running)return;
    requestAnimationFrame(render);
    if(now-lastFrame<32)return;
    const dt=Math.min((now-lastFrame)/1000,.08);lastFrame=now;
    const follow=reduced?1:1-Math.exp(-dt*9);
    ra+=(targetRa-ra)*follow;dec+=(targetDec-dec)*follow;aim();
    if(!drag&&now>touchUntil)active=pick(mouse.x,mouse.y);
    const selected=active;
    const labelBounds=[];
    for(const h of houses){
      const chosen=showAll||h.index===selected;
      h.opacity+=(Number(chosen)-h.opacity)*(reduced?1:1-Math.exp(-dt*(chosen?5:3)));
      h.reveal=chosen?Math.min(1.15,h.reveal+dt*1.4):(h.opacity<.01?0:h.reveal);
      h.line.visible=h.glow.visible=true;
      h.mat.uniforms.uOpacity.value=h.opacity;h.mat.uniforms.uReveal.value=reduced?1.15:h.reveal;h.glowMat.uniforms.uOpacity.value=.13+h.opacity*.87;
      const p=screenPoint(h.center);
      const show=h.opacity>.05&&p.visible&&(!showAll||(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height));
      h.label.hidden=!show;
      if(show){
        h.label.style.opacity=String(h.opacity*.95);
        let x=Math.max(20,Math.min(width-140,p.x+28)),y=Math.max(24,Math.min(height-90,p.y-36));
        if(showAll){
          // Keep nearby names separate without moving any stars or lines.
          x=Math.max(16,Math.min(width-90,p.x+20));
          const candidates=[-22,14,-58,50,-94,86];
          for(const offset of candidates){
            const candidate=Math.max(20,Math.min(height-44,p.y+offset));
            const underControl=x+86>width-88&&candidate<92;
            if(!underControl&&!labelBounds.some(b=>x<b.x+90&&x+90>b.x&&candidate<b.y+34&&candidate+34>b.y)){y=candidate;break;}
          }
          labelBounds.push({x,y});
        }
        h.label.style.transform=`translate(${x}px,${y}px)`;
      }
    }
    canvas.style.cursor=drag&&moved?'grabbing':active>=0?'pointer':'grab';
    material.uniforms.uTime.value=now/1000;renderer.render(scene,camera);
  }
  addEventListener('resize',resize);resize();aim();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();running=false;root.classList.add('error');document.querySelector('#loading').textContent='星空显示已暂停，请刷新页面。';});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)running=false;else if(!running){running=true;lastFrame=performance.now();requestAnimationFrame(render);}});
  root.dataset.starCount=data.stars.length;root.dataset.mansionCount=houses.length;
  toggle.disabled=false;
  root.classList.add('ready');requestAnimationFrame(render);
}
