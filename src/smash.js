// ── 부수기: 중력 + 잡기 · 레이저 · 폭탄 · 망치 · 불 · 물 (학원 시간표 아티팩트에서 가져옴) ──
// 각 조각은 격자(칸)마다 손상도 d(0~1+)와 열 h를 가짐.
// 레이저·폭탄 모두 같은 d에 더해지고, d가 1을 넘은 칸은 사라짐 → 남은 칸들로 물리 몸체를 다시 만들고, 끊어지면 여러 조각으로 쪼갬.
// 앱에서는 처음부터 이 상태로 시작: 모든 칸은 벽에 붙어(pin, static) 있다가 맞거나 끌면 떨어져 나옴.
// 떨어진 조각은 벽 앞으로 떨어지므로 붙어 있는 칸과는 부딪히지 않음.
import Matter from "matter-js";
if(!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){this.rect(x,y,w,h);};
let G=null,OPT=null,TOOL="grab";
// 파괴력 배율: 0.25× ~ 4× (로그 눈금), 기본 1×
let POW=1;try{const v=parseFloat(localStorage.getItem("smash-pow"));if(v>=.25&&v<=4)POW=v;}catch(e){}
const PK=()=>Math.sqrt(POW);
const TOOL_HINT={
  grab:"끌어서 떼어내 던져보세요 · 날짜를 톡 누르면 일정이 열려요",
  laser:"누르고 있으면 지져져요 · 천천히 끌면 잘려요",
  bomb:"누른 곳에 폭탄 · 한 번은 그을리고, 두 번 맞으면 뚫려요",
  hammer:"톡 누른 곳을 망치로 쾅 · 파괴력이 클수록 잘게 쪼개져요",
  fire:"문지른 곳에 불이 붙어요 · 옆으로 번지고, 물을 부으면 꺼져요",
  water:"문지른 곳에 물이 쏟아져요 · 계속 부으면 화면이 차올라요"
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd=(a,b)=>a+Math.random()*(b-a);
const BOPT={friction:.45,frictionStatic:.7,restitution:.16,frictionAir:.008,density:.0012,slop:.03};
// 충돌 분류: 떠 있는 칸(PIN)도 떨어진 조각(FREE)과 부딪힘 → 세게 부딪히면 떨어져 나옴 (startSmash의 collisionStart)
const CAT_WALL=1,CAT_PIN=2,CAT_FREE=4,KNOCK=5;   // KNOCK: 떠 있는 칸을 떼어낼 만큼의 속도 (px/스텝)
function setCat(b,cat){for(const pt of b.parts){pt.collisionFilter.category=cat;pt.collisionFilter.mask=CAT_WALL|CAT_PIN|CAT_FREE;}}
function release(p){if(!p||p.dead||!p.pin)return;p.pin=false;
  Matter.Body.setStatic(p.body,false);setCat(p.body,CAT_FREE);if(G){G.calm=0;unwall(p);}}
function unstick(b){if(b.isStatic){Matter.Body.setStatic(b,false);setCat(b,CAT_FREE);}}

// ── 소리 (WebAudio로 직접 합성) ──
const AU={ctx:null,master:null,muted:false,noise:null,laser:null,hiss:null};
function audio(){
  if(!AU.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    try{AU.ctx=new C();}catch(e){return null;}
    const c=AU.ctx;AU.master=c.createGain();AU.master.gain.value=AU.muted?0:.55;
    const comp=c.createDynamicsCompressor();AU.master.connect(comp);comp.connect(c.destination);
    const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),ch=buf.getChannelData(0);
    for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;AU.noise=buf;}
  if(AU.ctx.state==="suspended")AU.ctx.resume();
  return AU.ctx;}
function noiseSrc(c){const s=c.createBufferSource();s.buffer=AU.noise;s.loop=true;return s;}
function sBoom(k){const c=audio();if(!c)return;const t=c.currentTime;
  const n=noiseSrc(c),lp=c.createBiquadFilter(),g=c.createGain();
  lp.type="lowpass";lp.frequency.setValueAtTime(2400,t);lp.frequency.exponentialRampToValueAtTime(120,t+1.2);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.9*k,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+1.7);
  n.connect(lp);lp.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+1.8);
  const o=c.createOscillator(),og=c.createGain();o.type="sine";
  o.frequency.setValueAtTime(115,t);o.frequency.exponentialRampToValueAtTime(30,t+.6);
  og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.95*k,t+.01);og.gain.exponentialRampToValueAtTime(.0001,t+.85);
  o.connect(og);og.connect(AU.master);o.start(t);o.stop(t+.9);
  const n2=noiseSrc(c),hp=c.createBiquadFilter(),g2=c.createGain();hp.type="highpass";hp.frequency.value=2600;
  g2.gain.setValueAtTime(.35*k,t);g2.gain.exponentialRampToValueAtTime(.0001,t+.35);
  n2.connect(hp);hp.connect(g2);g2.connect(AU.master);n2.start(t,Math.random());n2.stop(t+.36);}
function sLaser(on){const c=on?audio():AU.ctx;if(!c)return;const t=c.currentTime;
  if(on&&!AU.laser){
    const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.05);
    const lp=c.createBiquadFilter();lp.type="lowpass";lp.frequency.value=2600;lp.Q.value=6;
    const o1=c.createOscillator(),o2=c.createOscillator();o1.type="sawtooth";o2.type="sawtooth";o1.frequency.value=150;o2.frequency.value=152.5;
    o1.connect(lp);o2.connect(lp);lp.connect(g);g.connect(AU.master);o1.start(t);o2.start(t);
    const n=noiseSrc(c),bp=c.createBiquadFilter(),sg=c.createGain();bp.type="bandpass";bp.frequency.value=5200;bp.Q.value=.7;sg.gain.value=0;
    n.connect(bp);bp.connect(sg);sg.connect(AU.master);n.start(t,Math.random());
    AU.laser={g,o1,o2,n,sg};
  }else if(!on&&AU.laser){const L=AU.laser;AU.laser=null;
    L.g.gain.cancelScheduledValues(t);L.g.gain.setTargetAtTime(.0001,t,.03);L.sg.gain.setTargetAtTime(0,t,.03);
    [L.o1,L.o2,L.n].forEach(o=>{try{o.stop(t+.25)}catch(e){}});}}
function sSizzle(v){if(AU.laser&&AU.ctx)AU.laser.sg.gain.setTargetAtTime(v,AU.ctx.currentTime,.04);}
function sHiss(n){const c=AU.ctx;if(!c)return;
  if(n>0&&!AU.hiss){const s=noiseSrc(c),bp=c.createBiquadFilter(),g=c.createGain();bp.type="bandpass";bp.frequency.value=7000;bp.Q.value=1.2;g.gain.value=0;
    s.connect(bp);bp.connect(g);g.connect(AU.master);s.start();AU.hiss={s,g};}
  if(AU.hiss)AU.hiss.g.gain.setTargetAtTime(Math.min(.05,.022*n),c.currentTime,.06);}
function sStopAll(){sLaser(false);if(AU.hiss){try{AU.hiss.s.stop()}catch(e){}AU.hiss=null;}sStopLoops();}
function setMute(m){AU.muted=m;if(AU.master)AU.master.gain.value=m?0:.55;
  const b=document.getElementById("gSound");b.setAttribute("aria-pressed",m?"false":"true");
  b.querySelector(".snd-on").style.display=m?"none":"";b.querySelector(".snd-off").style.display=m?"":"none";}

// ── 효과용 스프라이트 ──
let SPR=null;
function sprite(stops,size=64){const c=document.createElement("canvas");c.width=c.height=size;const x=c.getContext("2d");
  const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);stops.forEach(([o,col])=>g.addColorStop(o,col));
  x.fillStyle=g;x.fillRect(0,0,size,size);return c;}
function makeSprites(){SPR={
  fire:sprite([[0,"rgba(255,250,225,1)"],[.22,"rgba(255,200,90,.92)"],[.5,"rgba(255,100,25,.5)"],[1,"rgba(190,30,0,0)"]]),
  glow:sprite([[0,"rgba(255,255,255,1)"],[.2,"rgba(255,225,160,.9)"],[.5,"rgba(255,130,40,.35)"],[1,"rgba(255,60,0,0)"]]),
  red:sprite([[0,"rgba(255,255,255,1)"],[.14,"rgba(255,140,125,.95)"],[.42,"rgba(255,35,20,.42)"],[1,"rgba(255,0,0,0)"]]),
  smoke:sprite([[0,"rgba(78,74,70,.6)"],[.55,"rgba(78,74,70,.28)"],[1,"rgba(78,74,70,0)"]]),
  soot:sprite([[0,"rgba(22,14,8,.9)"],[.45,"rgba(28,18,10,.45)"],[1,"rgba(30,20,10,0)"]]),
  fCore:sprite([[0,"rgba(255,255,238,1)"],[.25,"rgba(255,236,160,.92)"],[.6,"rgba(255,170,60,.35)"],[1,"rgba(255,120,20,0)"]]),
  fTail:sprite([[0,"rgba(255,96,24,.75)"],[.5,"rgba(205,42,6,.28)"],[1,"rgba(120,10,0,0)"]]),
  fBlue:sprite([[0,"rgba(235,244,255,1)"],[.3,"rgba(120,170,255,.8)"],[.7,"rgba(40,80,255,.25)"],[1,"rgba(20,40,200,0)"]]),
  dust:sprite([[0,"rgba(196,186,170,.6)"],[.6,"rgba(188,178,162,.24)"],[1,"rgba(188,178,162,0)"]]),
  steam:sprite([[0,"rgba(242,246,250,.6)"],[.6,"rgba(236,242,248,.22)"],[1,"rgba(236,242,248,0)"]]),
  caus:causticTile()};
  // 캔버스 대신 ImageBitmap으로 그리면 drawImage 때마다 스냅샷을 뜨지 않아 빠름 (준비되면 바꿔 끼움)
  if(window.createImageBitmap)for(const k in SPR)if(k!=="caus")createImageBitmap(SPR[k]).then(b=>{SPR[k]=b;},()=>{});}
// 물속 빛 무늬(코스틱): 보로노이 경계가 밝게 빛나는 타일
function causticTile(){const N=128,cv=document.createElement("canvas");cv.width=cv.height=N;const x=cv.getContext("2d"),im=x.createImageData(N,N),P=[];
  for(let i=0;i<22;i++)P.push([Math.random()*N,Math.random()*N]);
  for(let y=0;y<N;y++)for(let xx=0;xx<N;xx++){let f1=1e9,f2=1e9;
    for(const [px,py] of P)for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const dx=px+ox*N-xx,dy=py+oy*N-y,d=dx*dx+dy*dy;if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}
    const v=Math.sqrt(f2)-Math.sqrt(f1),b=Math.pow(clamp(1-v/6.5,0,1),2.4),k=(y*N+xx)*4;
    im.data[k]=215;im.data[k+1]=240;im.data[k+2]=255;im.data[k+3]=b*255;}
  x.putImageData(im,0,0);return cv;}

// ── 조각(piece) ──
function isClear(col){return !col||col==="transparent"||/,\s*0\)$/.test(col);}
function solidColors(el){const out=[];const cs=getComputedStyle(el);
  if(!isClear(cs.backgroundColor))out.push(cs.backgroundColor,cs.backgroundColor,cs.backgroundColor);
  el.querySelectorAll(".chip,i").forEach(c=>{const b=getComputedStyle(c).backgroundColor;if(!isClear(b))out.push(b);});
  if(!out.length)out.push(cs.color);return out;}
// 조각은 DOM 대신 캔버스에 그림: 처음에 칸 모양을 그림(base)으로 떠 두고,
// 그을음·열은 위에 덧칠하고 구멍은 destination-in으로 뚫어서(tex) 벽/떨어진 조각 캔버스에 찍음.
// (조각마다 마스크 붙은 DOM 레이어를 두면 프레임마다 레이어 수만큼 합성해야 해서 느렸음)
// 조각 그림(base·tex)은 작아서 CPU 캔버스로 둠: GPU 캔버스를 조각마다 두면 다시 그릴 때마다 GPU 작업이 따로 쌓임
const cpu2d=cv=>cv.getContext("2d",{willReadFrequently:true});
function rasterize(el,r){const d=G.pdpr,cv=document.createElement("canvas");
  cv.width=Math.max(1,Math.round(r.width*d));cv.height=Math.max(1,Math.round(r.height*d));
  const x=cpu2d(cv);x.scale(d,d);x.translate(-r.left,-r.top);drawBox(x,el);return cv;}
// 이 달력에 쓰는 것만 그림: 배경색 · 같은 굵기 테두리 · 둥근 모서리 · overflow 잘라내기 · 글자(줄바꿈·말줄임 포함)
function drawBox(x,el){const cs=getComputedStyle(el);if(cs.display==="none")return;
  const b=el.getBoundingClientRect(),rad=parseFloat(cs.borderTopLeftRadius)||0,bw=parseFloat(cs.borderTopWidth)||0;
  x.save();
  if(!isClear(cs.backgroundColor)){x.fillStyle=cs.backgroundColor;x.beginPath();x.roundRect(b.left,b.top,b.width,b.height,rad);x.fill();}
  if(bw>0&&cs.borderTopStyle!=="none"&&!isClear(cs.borderTopColor)){x.strokeStyle=cs.borderTopColor;x.lineWidth=bw;x.beginPath();
    x.roundRect(b.left+bw/2,b.top+bw/2,b.width-bw,b.height-bw,Math.max(0,rad-bw/2));x.stroke();}
  if(cs.overflow!=="visible"){x.beginPath();x.roundRect(b.left,b.top,b.width,b.height,rad);x.clip();}
  for(const n of el.childNodes){if(n.nodeType===1)drawBox(x,n);else if(n.nodeType===3&&n.textContent.trim())drawText(x,n,cs,b);}
  x.restore();}
function drawText(x,n,cs,b){const t=n.textContent,rg=document.createRange(),lines=[];let cur=null;
  // 글자마다 위치를 재서 줄을 나눔
  for(let i=0;i<t.length;){const len=t.codePointAt(i)>0xffff?2:1;rg.setStart(n,i);rg.setEnd(n,i+len);const q=rg.getClientRects()[0];
    if(q){if(!cur||Math.abs(q.top-cur.top)>q.height*.5){cur={s:"",left:q.left,top:q.top,right:q.right};lines.push(cur);}cur.s+=t.slice(i,i+len);cur.right=q.right;}
    i+=len;}
  x.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;x.fillStyle=cs.color;x.textBaseline="alphabetic";
  if("letterSpacing" in x)x.letterSpacing=cs.letterSpacing==="normal"?"0px":cs.letterSpacing;
  for(const L of lines){let s=L.s.replace(/\s+$/,"");
    if(cs.textOverflow==="ellipsis"&&L.right>b.right+.5){const room=b.right-L.left-parseFloat(cs.paddingRight||0);
      while(s&&x.measureText(s+"…").width>room)s=s.slice(0,-1);s+="…";}
    const m=x.measureText(s),asc=m.fontBoundingBoxAscent??m.actualBoundingBoxAscent??parseFloat(cs.fontSize)*.8;
    x.fillText(s,L.left,L.top+asc);}}
// 그을음·열 데이터(낮은 해상도)와 그 결과 그림 준비
function setupTex(p){let sc=.7;if(p.W*p.H*sc*sc>45000)sc=Math.sqrt(45000/(p.W*p.H));
  p.ow=Math.max(4,Math.round(p.W*sc));p.oh=Math.max(4,Math.round(p.H*sc));
  p.ovc=document.createElement("canvas");p.ovc.width=p.ow;p.ovc.height=p.oh;p.octx=cpu2d(p.ovc);
  p.img=p.octx.createImageData(p.ow,p.oh);p.mimg=null;p.mc=null;p.cv=null;p.tex=p.base;p.masked=false;p.cx0=null;
  p.pn=new Float32Array(p.ow*p.oh);for(let i=0;i<p.pn.length;i++)p.pn[i]=Math.random();
  p.maskT=-1;p.shapeT=-1;}
// base + 그을음(둥근 모서리 안쪽만) → 구멍 뚫기
function compose(p){const w=p.base.width,h=p.base.height;
  if(!p.cv){p.cv=document.createElement("canvas");p.cv.width=w;p.cv.height=h;p.cctx=cpu2d(p.cv);}
  const x=p.cctx;x.globalCompositeOperation="copy";x.drawImage(p.base,0,0);x.globalCompositeOperation="source-over";
  x.save();if(p.rad){x.beginPath();x.roundRect(0,0,w,h,p.rad*G.pdpr);x.clip();}x.drawImage(p.ovc,0,0,w,h);x.restore();
  if(p.masked){x.globalCompositeOperation="destination-in";x.drawImage(p.mc,0,0,w,h);x.globalCompositeOperation="source-over";}
  p.tex=p.cv;if(p.pin)G.wallQ.add(p);}
// 벽에서 빠진 칸 자리 지우기 예약
function unwall(p){if(p.wr)G.wallCl.push(p.wr);p.wr=null;}
function initPiece(base,W,H,orig,look){
  const p={base,W,H,orig,dead:false,...look};
  p.cs=clamp(Math.round(Math.sqrt(W*H/700)),4,12);
  p.cols=Math.ceil(W/p.cs);p.rows=Math.ceil(H/p.cs);
  const n=p.cols*p.rows;p.n0=n;p.d=new Float32Array(n);p.h=new Float32Array(n);p.nz=new Float32Array(n);
  for(let i=0;i<n;i++)p.nz[i]=Math.random();
  // 불: fu=연료, bn=타는 세기 · 물: wt=젖은 정도
  p.fu=new Float32Array(n).fill(1);p.bn=new Float32Array(n);p.wt=new Float32Array(n);p.cl=new Uint8Array(n);
  setupTex(p);return p;}
function frame(p){const b=p.body,th=b.angle+p.ao,c=Math.cos(th),s=Math.sin(th);
  return{cx:b.position.x-(c*p.o.x-s*p.o.y),cy:b.position.y-(s*p.o.x+c*p.o.y),c,s,th};}
function toLocal(p,x,y){const f=p.f,dx=x-f.cx,dy=y-f.cy;return{x:f.c*dx+f.s*dy+p.W/2,y:-f.s*dx+f.c*dy+p.H/2};}
function toWorld(p,lx,ly){const f=p.f,ux=lx-p.W/2,uy=ly-p.H/2;return{x:f.cx+f.c*ux-f.s*uy,y:f.cy+f.s*ux+f.c*uy};}
// 남아 있는 칸들을 큰 직사각형으로 묶기 (물리 몸체용)
function rectsOf(q){const R=[],{cols,rows,cs,W,H,d}=q,used=new Uint8Array(cols*rows);
  const ok=i=>d[i]<1&&!used[i];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(!ok(i))continue;
    let w=1;while(x+w<cols&&ok(i+w))w++;
    let h=1;grow:while(y+h<rows){for(let k=0;k<w;k++)if(!ok((y+h)*cols+x+k))break grow;h++;}
    for(let yy=0;yy<h;yy++)for(let k=0;k<w;k++)used[(y+yy)*cols+x+k]=1;
    R.push({x:x*cs,y:y*cs,w:Math.min(w*cs,W-x*cs),h:Math.min(h*cs,H-y*cs)});}
  return R;}
function buildBody(q,f,ob){
  const {Bodies,Body,Composite}=Matter;const R=rectsOf(q);if(!R.length)return false;
  const {c,s,cx,cy,th}=f;
  const parts=R.map(r=>{const lx=r.x+r.w/2-q.W/2,ly=r.y+r.h/2-q.H/2;
    return Bodies.rectangle(cx+c*lx-s*ly,cy+s*lx+c*ly,r.w,r.h,Object.assign({angle:th},BOPT));});
  const b=parts.length===1?parts[0]:Body.create(Object.assign({parts},BOPT));
  q.ao=th-b.angle;const dx=b.position.x-cx,dy=b.position.y-cy;q.o={x:c*dx+s*dy,y:-s*dx+c*dy};
  if(ob){const w=ob.angularVelocity,rx=b.position.x-ob.position.x,ry=b.position.y-ob.position.y;
    Body.setVelocity(b,{x:ob.velocity.x-w*ry,y:ob.velocity.y+w*rx});Body.setAngularVelocity(b,w);}
  if(q.pin){Body.setStatic(b,true);setCat(b,CAT_PIN);}else setCat(b,CAT_FREE);
  Composite.add(G.engine.world,b);q.body=b;b.plugin.piece=q;q.f=frame(q);return true;}
// 붙어 있는 칸은 벽 캔버스(바뀔 때만 다시 그림), 떨어진 조각은 앞쪽 캔버스(움직이는 동안 매 프레임)
function drawPiece(c,p){const f=p.f,d=G.pdpr;c.globalAlpha=p.alpha;
  if(p.pin){const x=Math.round((f.cx-p.W/2)*d),y=Math.round((f.cy-p.H/2)*d);   // 픽셀에 딱 맞춰 글자가 또렷하게
    p.wr={x,y,w:p.tex.width,h:p.tex.height};c.setTransform(1,0,0,1,0,0);c.clearRect(x,y,p.wr.w,p.wr.h);c.drawImage(p.tex,x,y);}
  else{c.setTransform(f.c*d,f.s*d,-f.s*d,f.c*d,f.cx*d,f.cy*d);c.drawImage(p.tex,-p.W/2,-p.H/2,p.W,p.H);}}
// 벽 캔버스는 바뀐 칸 자리만 지우고 다시 그림 (붙어 있는 칸끼리는 겹치지 않음)
function drawPieces(){const c0=G.wallX;
  if(G.wallAll){G.wallAll=false;G.wallQ.clear();G.wallCl.length=0;c0.setTransform(1,0,0,1,0,0);c0.clearRect(0,0,G.wallCv.width,G.wallCv.height);
    for(const p of G.pieces)if(!p.dead&&p.pin)drawPiece(c0,p);}
  else if(G.wallQ.size||G.wallCl.length){c0.setTransform(1,0,0,1,0,0);for(const r of G.wallCl)c0.clearRect(r.x,r.y,r.w,r.h);G.wallCl.length=0;
    for(const p of G.wallQ)if(!p.dead&&p.pin)drawPiece(c0,p);G.wallQ.clear();}
  const c=G.freeX,any=G.pieces.some(p=>!p.dead&&!p.pin);
  if(any||G.freeAny){c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,G.freeCv.width,G.freeCv.height);
    for(const p of G.pieces)if(!p.dead&&!p.pin)drawPiece(c,p);}
  G.freeAny=any;}

// ── 손상 ──
function hurt(p,lx,ly,R,fn,heatK,onBreak){
  const {cs,cols,rows,d,h}=p;
  const x0=Math.max(0,Math.floor((lx-R)/cs)),x1=Math.min(cols-1,Math.floor((lx+R)/cs));
  const y0=Math.max(0,Math.floor((ly-R)/cs)),y1=Math.min(rows-1,Math.floor((ly+R)/cs));
  let hit=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*cols+x;if(d[i]>=1)continue;
    const cx=(x+.5)*cs,cy=(y+.5)*cs,dist=Math.hypot(cx-lx,cy-ly);if(dist>R)continue;
    const dd=fn(dist,cx,cy);if(dd<=0)continue;hit+=dd;const was=d[i];
    d[i]+=dd;h[i]=Math.min(1,h[i]+dd*heatK);
    if(was<.8&&d[i]>=.8)p.needMask=true;
    if(d[i]>=1){d[i]=1.35;p.shapeDirty=true;p.needMask=true;if(onBreak){const w=toWorld(p,cx,cy);onBreak(w.x,w.y,p);}}}
  if(hit>0){p.dirty=true;p.hot=true;}
  return hit;}

// 그을음·열·구멍을 조각 위 캔버스와 마스크에 그리기
function paint(p){
  const {ow,oh,W,H,cs,cols,rows,d,h,nz,pn}=p,data=p.img.data;
  const doMask=p.needMask&&G.time-p.maskT>(p.burning?.2:.06);
  let md=null;if(doMask){if(!p.mimg)p.mimg=new ImageData(ow,oh);md=p.mimg.data;}
  const soft=p.soft?.5:1,wt=p.wet?p.wt:null,cl=p.hasCl?p.cl:null;
  // 열(x)마다 같은 격자 보간 값은 조각마다 한 번만 계산해 둠
  if(!p.cx0){p.cx0=new Int32Array(ow);p.cx1=new Int32Array(ow);p.cfx=new Float32Array(ow);
    for(let x=0;x<ow;x++){const gx=((x+.5)*W/ow)/cs-.5;let x0=Math.floor(gx),fx=gx-x0;if(x0<0){x0=0;fx=0}if(x0>=cols-1){x0=cols-1;fx=0}
      p.cx0[x]=x0;p.cx1[x]=Math.min(x0+1,cols-1);p.cfx[x]=fx;}}
  const CX0=p.cx0,CX1=p.cx1,CFX=p.cfx;
  for(let y=0;y<oh;y++){
    const gy=((y+.5)*H/oh)/cs-.5;let y0=Math.floor(gy),fy=gy-y0;if(y0<0){y0=0;fy=0}if(y0>=rows-1){y0=rows-1;fy=0}const y1=Math.min(y0+1,rows-1);
    for(let x=0;x<ow;x++){
      const x0=CX0[x],x1=CX1[x],fx=CFX[x];
      const a=y0*cols+x0,b=y0*cols+x1,c=y1*cols+x0,e=y1*cols+x1;
      // 손상·열·물기가 하나도 없는 곳은 빠르게 건너뛰기
      if(d[a]===0&&d[b]===0&&d[c]===0&&d[e]===0&&h[a]===0&&h[b]===0&&h[c]===0&&h[e]===0&&(!wt||(wt[a]===0&&wt[b]===0&&wt[c]===0&&wt[e]===0))){const z=(y*ow+x)*4;data[z+3]=0;if(md)md[z+3]=255;continue;}
      const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
      const d0=Math.min(d[a],1.3),d1=Math.min(d[b],1.3),d2=Math.min(d[c],1.3),d3=Math.min(d[e],1.3);
      const bd=d0*w00+d1*w10+d2*w01+d3*w11;
      const k=y*ow+x,k4=k*4;
      let dv=bd,cv=bd,jit=0;
      if(bd>0){const bn=nz[a]*w00+nz[b]*w10+nz[c]*w01+nz[e]*w11;jit=(pn[k]-.5)*.07+(bn-.5)*.26;dv=bd+jit*Math.min(1,bd*4);}
      // 망치로 깨진 칸은 그을음 없이 깨끗한 단면 (가장자리만 살짝 어둡게)
      let ce=0;if(cl){ce=cl[a]*w00+cl[b]*w10+cl[c]*w01+cl[e]*w11;if(ce>0){cv=(cl[a]?0:d0)*w00+(cl[b]?0:d1)*w10+(cl[c]?0:d2)*w01+(cl[e]?0:d3)*w11;}}
      if(ce>0)cv=cv>0?cv+jit*Math.min(1,cv*4):0;else cv=dv;
      const hv=h[a]*w00+h[b]*w10+h[c]*w01+h[e]*w11;
      let al=0,r=0,g=0,bl=0;
      if(cv>.03){const t=clamp((cv-.03)/.7,0,1);al=t*t*(3-2*t)*.97*soft;const u=clamp((cv-.12)/.6,0,1);r=128-110*u;g=82-70*u;bl=38-29*u;}
      if(ce>0&&dv<1){const ea=.34*clamp(dv*2.4,0,1)*ce*soft,A=ea+al*(1-ea);if(A>0){r=(62*ea+r*al*(1-ea))/A;g=(57*ea+g*al*(1-ea))/A;bl=(52*ea+bl*al*(1-ea))/A;al=A;}}
      if(hv>.01){const em=clamp(hv*1.5,0,1),er=255,eg=70+185*Math.pow(hv,1.3),eb=20+200*hv*hv*hv,A=em+al*(1-em);
        if(A>0){r=(er*em+r*al*(1-em))/A;g=(eg*em+g*al*(1-em))/A;bl=(eb*em+bl*al*(1-em))/A;}al=A;}
      if(wt){const wv=wt[a]*w00+wt[b]*w10+wt[c]*w01+wt[e]*w11;
        if(wv>.01){const wa=.26*wv*soft,A=wa+al*(1-wa);r=(14*wa+r*al*(1-wa))/A;g=(34*wa+g*al*(1-wa))/A;bl=(62*wa+bl*al*(1-wa))/A;al=A;}}
      data[k4]=r;data[k4+1]=g;data[k4+2]=bl;data[k4+3]=al*255;
      if(md){md[k4+3]=clamp((1-dv)*7,0,1)*255;}
    }}
  p.octx.putImageData(p.img,0,0);
  if(md){if(!p.mc){p.mc=document.createElement("canvas");p.mc.width=ow;p.mc.height=oh;p.mcx=p.mc.getContext("2d",{willReadFrequently:true});}
    p.mcx.putImageData(p.mimg,0,0);p.needMask=false;p.maskT=G.time;p.masked=true;}
  compose(p);
  p.dirty=false;}

// 끊어진 부분을 찾아 조각을 나누고, 남은 모양대로 몸체를 다시 만들기
function restructure(p){
  p.shapeDirty=false;p.shapeT=G.time;
  const {cols,rows,cs}=p,d=p.d,N=cols*rows,lab=new Int32Array(N).fill(-1),comps=[];
  for(let i=0;i<N;i++){if(d[i]>=1||lab[i]>=0)continue;const id=comps.length,st=[i],cells=[];lab[i]=id;
    while(st.length){const j=st.pop();cells.push(j);const x=j%cols,y=(j/cols)|0;
      if(x>0&&d[j-1]<1&&lab[j-1]<0){lab[j-1]=id;st.push(j-1);}
      if(x<cols-1&&d[j+1]<1&&lab[j+1]<0){lab[j+1]=id;st.push(j+1);}
      if(y>0&&d[j-cols]<1&&lab[j-cols]<0){lab[j-cols]=id;st.push(j-cols);}
      if(y<rows-1&&d[j+cols]<1&&lab[j+cols]<0){lab[j+cols]=id;st.push(j+cols);}}
    comps.push(cells);}
  const minCells=Math.max(2,Math.ceil(70/(cs*cs)));
  const keep=[];
  for(const c of comps){if(c.length<minCells){c.forEach(j=>{const w=toWorld(p,(j%cols+.5)*cs,((j/cols|0)+.5)*cs);
      crumb(w.x,w.y,p,p.body.velocity);d[j]=99;});}else keep.push(c);}
  // 잡고 있던(또는 막 누른) 조각이면 잡은 지점을 기억해 뒀다가 새로 만든 조각에 다시 붙임 (타는 동안 모양이 계속 바뀌어도 놓치지 않게)
  const held=G.drag&&G.drag.b===p.body?{x:p.body.position.x+G.drag.c.pointB.x,y:p.body.position.y+G.drag.c.pointB.y}:null,
    pend=G.ptr.pend===p.body?{x:G.ptr.sx,y:G.ptr.sy}:null;
  if(held)dropDrag();
  if(!keep.length){killPiece(p);return;}
  keep.sort((a,b)=>b.length-a.length);
  const ob=p.body,f=p.f,d0=d.slice(),bh=p.h.slice();
  // 벽에 붙어 있던 칸은 원래의 절반 이상 남았으면 가장 큰 덩어리가 그대로 붙어 있고, 나머지만 떨어짐
  const stay=p.pin&&keep[0].length>=p.n0*.5;
  if(p.pin&&!stay)unwall(p);
  const made=[];
  keep.forEach((cells,k)=>{
    let q=p;
    // 쪼개진 조각은 같은 칸 그림(base)을 같이 쓰고 그을음·구멍만 따로 가짐
    if(k>0){q={base:p.base,W:p.W,H:p.H,orig:p.orig,alpha:p.alpha,rad:p.rad,soft:p.soft,colors:p.colors,dead:false,cs,cols,rows,nz:p.nz,n0:p.n0};
      q.h=bh.slice();q.fu=p.fu.slice();q.bn=p.bn.slice();q.wt=p.wt.slice();q.cl=p.cl.slice();q.hasCl=p.hasCl;q.burning=p.burning;q.wet=p.wet;
      setupTex(q);G.pieces.push(q);}
    q.pin=k===0&&stay;
    q.d=d0.slice();
    if(keep.length>1){const mark=new Uint8Array(N);cells.forEach(j=>mark[j]=1);for(let j=0;j<N;j++)if(!mark[j]&&q.d[j]<1)q.d[j]=99;}
    q.needMask=true;q.dirty=true;q.hot=true;made.push(q);});
  if(G.ptr.pend===ob)G.ptr.pend=null;
  Matter.Composite.remove(G.engine.world,ob);
  made.forEach(q=>{q.f=f;if(!buildBody(q,f,ob))killPiece(q,true);});
  const w=held||pend;
  if(w){const live=made.filter(q=>!q.dead),t=live.find(q=>{const L=toLocal(q,w.x,w.y),cx=Math.floor(L.x/q.cs),cy=Math.floor(L.y/q.cs);
      return cx>=0&&cy>=0&&cx<q.cols&&cy<q.rows&&q.d[cy*q.cols+cx]<1;})||live[0];
    if(t){if(held)grab(t.body,w.x,w.y);else G.ptr.pend=t.body;}}}
function killPiece(p,silent){if(p.dead)return;p.dead=true;if(p.pin)unwall(p);
  if(G.drag&&G.drag.b===p.body)dropDrag();
  if(G.ptr.pend===p.body)G.ptr.pend=null;
  if(p.body)Matter.Composite.remove(G.engine.world,p.body);
  if(!silent&&p.f){const {cols,cs,d}=p;for(let j=0;j<d.length;j++)if(d[j]<1){const w=toWorld(p,(j%cols+.5)*cs,((j/cols|0)+.5)*cs);crumb(w.x,w.y,p,p.body.velocity);}}}

// ── 파티클 ──
function addP(o){if(G.ps.length>2600)G.ps.splice(0,300);G.ps.push(o);}
function pickCol(p,charChance){return Math.random()<charChance?(Math.random()<.5?"#1c130d":"#3a2416"):p.colors[(Math.random()*p.colors.length)|0];}
function shard(x,y,vx,vy,col,sz){if(G.nShard>=SHARD_MAX)return;G.nShard++;const L=rnd(2.2,3.8);addP({t:"shard",x,y,vx,vy,rot:rnd(0,6.3),vr:rnd(-14,14),w:sz*rnd(.5,1.1),h:sz*rnd(.35,.9),col,life:L,max:L});}
function spark(x,y,vx,vy,L){L=L||rnd(.25,.6);addP({t:"spark",x,y,vx,vy,life:L,max:L});}
function ember(x,y,vx,vy){const L=rnd(.5,1.2);addP({t:"ember",x,y,vx,vy,life:L,max:L,s:rnd(3,7)});}
function fire(x,y,vx,vy,r){const L=rnd(.35,.75);addP({t:"fire",x,y,vx,vy,r,life:L,max:L});}
// 연기·수증기는 크게 부풀며 겹쳐 그려져 GPU에 가장 무거움 → 개수 상한 (G.nSmoke·G.nSteam은 매 프레임 다시 셈)
const SMOKE_MAX=170,STEAM_MAX=110,HAZE_R=90,SHARD_MAX=500;
function smoke(x,y,vx,vy,r,a){if(G.nSmoke>=SMOKE_MAX)return;G.nSmoke++;const L=rnd(1.3,2.6);addP({t:"smoke",x,y,vx,vy,r,gr:rnd(16,40),a,life:L,max:L});}
function crumb(x,y,p,v){const vx=(v?v.x*60:0)+rnd(-60,60),vy=(v?v.y*60:0)+rnd(-90,10);shard(x,y,vx,vy,pickCol(p,.35),p.cs*rnd(.8,1.3));}

// ── 레이저 ──
function laserStep(dt){
  const P=G.ptr;let hit=false;
  for(const B of G.bombs)if(Math.hypot(B.b.position.x-P.x,B.b.position.y-P.y)<15)B.t=Math.min(B.t,G.time+.04);
  for(const p of G.pieces){if(p.dead)continue;const bb=p.body.bounds,M=40;
    if(P.x<bb.min.x-M||P.x>bb.max.x+M||P.y<bb.min.y-M||P.y>bb.max.y+M)continue;
    const L=toLocal(p,P.x,P.y);const sg=Math.max(3.5,p.cs*.55)*(.75+.25*PK()),sg2=sg*2.4,Rr=sg2*2.4;
    if(L.x<-Rr||L.x>p.W+Rr||L.y<-Rr||L.y>p.H+Rr)continue;
    const core=hurt(p,L.x,L.y,sg*2.8,dist=>2.6*POW*dt*Math.exp(-dist*dist/(2*sg*sg)),1.7,(wx,wy)=>{
      ember(wx,wy,rnd(-80,80),rnd(-160,-20));if(Math.random()<.35)smoke(wx,wy,rnd(-10,10),rnd(-40,-15),rnd(5,9),.35);
      if(Math.random()<.12)shard(wx,wy,rnd(-60,60),rnd(-120,0),"#1c130d",p.cs*.7);});
    if(core>0)hit=true;
    // 바깥쪽은 약하게 그을리기만
    hurt(p,L.x,L.y,Rr,dist=>dist<sg*2?0:.16*dt*Math.exp(-dist*dist/(2*sg2*sg2)),.6,null);}
  G.laserHit=hit;
  if(hit){
    for(let i=0;i<3;i++){const a=rnd(0,6.28),s=rnd(120,480);spark(P.x,P.y,Math.cos(a)*s,Math.sin(a)*s-120,rnd(.15,.45));}
    if(Math.random()<.45)smoke(P.x+rnd(-3,3),P.y,rnd(-12,12),rnd(-60,-25),rnd(4,8),.32);
    sSizzle(.16);
  }else{sSizzle(0);
    G.dctx.globalAlpha=Math.min(1,dt*3);G.dctx.drawImage(SPR.soot,P.x-6,P.y-6,12,12);G.dctx.globalAlpha=1;}}

// ── 폭탄 ──
function spawnBomb(x,y){if(G.bombs.length>=14)return;
  const b=Matter.Bodies.circle(x,y,11,{restitution:.35,friction:.4,frictionAir:.004,density:.004});
  // 벽에 붙은 칸 위에 놓으면 그 자리에 붙어서 터지고, 빈 곳이면 떨어짐
  const h=pieceAt(x,y);if(h&&h.p.pin){Matter.Body.setStatic(b,true);setCat(b,CAT_PIN);}
  else{setCat(b,CAT_FREE);Matter.Body.setAngularVelocity(b,rnd(-.08,.08));}
  Matter.Composite.add(G.engine.world,b);
  G.bombs.push({b,t:G.time+1.15,fuse:1.15});}
function explode(x,y){
  const {Body}=Matter;const k=PK(),R0=24*k,R1=80*k,f0=rnd(0,6.3);
  for(const p of G.pieces.slice()){if(p.dead)continue;const bb=p.body.bounds;
    if(x<bb.min.x-R1||x>bb.max.x+R1||y<bb.min.y-R1||y>bb.max.y+R1)continue;
    const L=toLocal(p,x,y),lc=p.cs;
    if(hurt(p,L.x,L.y,R1+p.cs,(dist,cx,cy)=>{let f=dist<R0?1:Math.pow(Math.max(0,1-(dist-R0)/(R1-R0)),1.5);if(dist>=R0){const a=Math.atan2(cy-L.y,cx-L.x)+f0;f*=.55+.45*(Math.sin(a*7)*.5+Math.sin(a*13+1.7)*.3+Math.sin(a*3+.6)*.2+.5)*1.25;}return Math.min(f,1)*.62*POW*rnd(.93,1.07);},1.5,(wx,wy,q)=>{
      const dx=wx-x,dy=wy-y,dd=Math.hypot(dx,dy)||1,s=rnd(220,780)*Math.max(.35,1-dd/R1);
      shard(wx,wy,dx/dd*s+rnd(-60,60),dy/dd*s-rnd(80,260),pickCol(q,.45),q.cs*rnd(.7,1.3));
      if(Math.random()<.4)shard(wx,wy,dx/dd*s*.6,dy/dd*s*.6-120,pickCol(q,.6),q.cs*rnd(.4,.8));})>0)release(p);}
  // 폭풍: 맞지 않았어도 가까이 떠 있던 칸은 떨어져 나가 함께 날아감
  for(const p of G.pieces){if(p.dead||!p.pin)continue;const b=p.body;if(1/(1+(Math.hypot(b.position.x-x,b.position.y-y)/(85*k))**2)>.3)release(p);}
  const bodies=G.pieces.filter(p=>!p.dead).map(p=>p.body).concat(G.bombs.map(B=>B.b)).filter(b=>!b.isStatic);
  for(const b of bodies){const dx=b.position.x-x,dy=b.position.y-y,dist=Math.hypot(dx,dy)||1;if(dist>380*k)continue;
    const fall=1/(1+(dist/(85*k))**2);let ux=dx/dist,uy=dy/dist-.45;const un=Math.hypot(ux,uy);ux/=un;uy/=un;
    const dv=24*Math.pow(POW,.75)*fall/Math.sqrt(Math.max(1,b.mass/3));
    Body.setVelocity(b,{x:b.velocity.x+ux*dv,y:b.velocity.y+uy*dv});
    Body.setAngularVelocity(b,b.angularVelocity+rnd(-.3,.3)*fall/Math.sqrt(Math.max(1,b.mass/3)));}
  for(const B of G.bombs){if(Math.hypot(B.b.position.x-x,B.b.position.y-y)<85)B.t=Math.min(B.t,G.time+rnd(.06,.14));}
  // 물속 폭발: 불꽃 대신 거품 · 수면이 솟구치고 물결이 퍼짐
  if(G.W&&G.W.vol>1&&y>surfY(x)+6){const ys=surfY(x),dep=y-ys;
    for(let i=0,n=Math.round(40*k);i<n;i++)bubble(x+rnd(-20,20)*k,y+rnd(-20,20)*k,rnd(2,6.5));
    splashUp(x,ys,Math.round(14*k*clamp(1-dep/420,.3,1)),520*k*clamp(1-dep/520,.35,1));
    wDome(x,clamp(20*k*clamp(1-dep/600,.25,1),4,40),90*Math.sqrt(k));
    G.flash=Math.min(.3,G.flash+.12);G.shake=Math.min(32,G.shake+10*k);sBoom(clamp(.45+.35*k,.5,1.1));sSplash(1);return;}
  for(let i=0,n=Math.round(28*k);i<n;i++){const a=rnd(0,6.28),s=rnd(40,260);fire(x+rnd(-6,6),y+rnd(-6,6),Math.cos(a)*s,Math.sin(a)*s-60,rnd(10,26));}
  for(let i=0,n=Math.round(20*k);i<n;i++){const a=rnd(0,6.28),s=rnd(15,120);smoke(x+rnd(-14,14),y+rnd(-14,14),Math.cos(a)*s,Math.sin(a)*s-40,rnd(14,30),rnd(.5,.8));}
  for(let i=0,n=Math.round(70*k);i<n;i++){const a=rnd(0,6.28),s=rnd(250,950);spark(x,y,Math.cos(a)*s,Math.sin(a)*s-100,rnd(.3,.9));}
  addP({t:"ring",x,y,life:.36,max:.36,R:150*k});
  G.flash=Math.min(.6,G.flash+.36*Math.min(k,1.6));G.shake=Math.min(32,G.shake+13*k);
  const dc=G.dctx;dc.globalAlpha=.42;dc.drawImage(SPR.soot,x-70*k,y-70*k,140*k,140*k);dc.globalAlpha=.25;
  for(let i=0;i<14;i++){const a=rnd(0,6.28),r=rnd(20,80),s=rnd(8,22);dc.drawImage(SPR.soot,x+Math.cos(a)*r-s/2,y+Math.sin(a)*r-s/2,s,s);}
  dc.globalAlpha=1;
  sBoom(clamp(.55+.45*k,.6,1.4));}

// ── 그리기 ──
function drawBomb(c,B){const {x,y}=B.b.position,a=B.b.angle,left=B.t-G.time,fl=clamp(left/B.fuse,0,1);
  c.save();c.translate(x,y);c.rotate(a);
  c.strokeStyle="#8a6b45";c.lineWidth=2;c.lineCap="round";c.beginPath();c.moveTo(0,-13);
  const tx=7*fl+1,ty=-14-9*fl;c.quadraticCurveTo(4,-18,tx,ty);c.stroke();
  c.fillStyle="#565b63";c.fillRect(-4,-15,8,4);
  const g=c.createRadialGradient(-4,-4,1,0,0,12);g.addColorStop(0,"#7b818c");g.addColorStop(.35,"#2c3036");g.addColorStop(1,"#0b0c0e");
  c.fillStyle=g;c.beginPath();c.arc(0,0,11,0,Math.PI*2);c.fill();
  if(left<.45&&Math.floor(G.time*16)%2===0){c.fillStyle="rgba(255,60,40,.55)";c.beginPath();c.arc(0,0,11,0,Math.PI*2);c.fill();}
  c.restore();
  const ca=Math.cos(a),sa=Math.sin(a);B.tx=x+ca*tx-sa*ty;B.ty=y+sa*tx+ca*ty;}
function drawFx(dt){
  const c=G.fctx;c.setTransform(G.fdpr,0,0,G.fdpr,0,0);c.clearRect(0,0,G.vw,G.vh);
  c.save();c.translate(G.sx,G.sy);
  for(const q of G.ps){if(q.t!=="smoke")continue;const k=q.life/q.max;
    c.globalAlpha=q.a*Math.min(1,k*1.6)*Math.min(1,(1-k)*5+.25);c.drawImage(SPR.smoke,q.x-q.r,q.y-q.r,q.r*2,q.r*2);}
  // 파편: 색·투명도가 같은 것끼리 한 경로로 묶어 한 번에 칠함 (파편이 수백 개여도 칠하기는 십여 번)
  const SH=G.shB;SH.clear();
  for(const q of G.ps){if(q.t!=="shard")continue;const k=q.col+"|"+(q.life<.5?Math.max(1,Math.ceil(q.life*8)):4);
    let L=SH.get(k);if(!L)SH.set(k,L=[]);L.push(q);}
  for(const [k,L] of SH){const i=k.lastIndexOf("|");c.fillStyle=k.slice(0,i);c.globalAlpha=+k.slice(i+1)/4;c.beginPath();
    for(const q of L){const cr=Math.cos(q.rot),sr=Math.sin(q.rot),ax=cr*q.w/2,ay=sr*q.w/2,bx=-sr*q.h/2,by=cr*q.h/2;
      c.moveTo(q.x-ax-bx,q.y-ay-by);c.lineTo(q.x+ax-bx,q.y+ay-by);c.lineTo(q.x+ax+bx,q.y+ay+by);c.lineTo(q.x-ax+bx,q.y-ay+by);c.closePath();}
    c.fill();}
  c.globalAlpha=1;
  for(const B of G.bombs)drawBomb(c,B);
  if(G.tool==="laser"){const E=G.emit,P=G.ptr,ang=Math.atan2(P.y-E.y,P.x-E.x);
    c.save();c.translate(E.x,E.y);c.rotate(ang);c.fillStyle="#22262d";c.beginPath();c.roundRect(-22,-6,26,12,3);c.fill();
    c.fillStyle="#3b414b";c.fillRect(-18,-6,4,12);c.restore();}
  drawWater(c);
  for(const q of G.ps){if(q.t!=="steam"&&q.t!=="dust")continue;const k=q.life/q.max;
    c.globalAlpha=q.a*Math.min(1,k*1.5)*Math.min(1,(1-k)*6+.2);c.drawImage(q.t==="steam"?SPR.steam:SPR.dust,q.x-q.r,q.y-q.r,q.r*2,q.r*2);}
  c.globalAlpha=1;
  c.globalCompositeOperation="lighter";
  // 불: 주변을 비추는 빛 → 불꽃 → 불덩이
  const gf=gfac(),st=gf>.3?1.7:1.05,sw=gf>.3?.78:1;
  for(const L of G.glows){const r=Math.min(150,34+Math.sqrt(L.n)*9);c.globalAlpha=Math.min(.26,.05+L.n*.003)*rnd(.85,1.1);c.drawImage(SPR.glow,L.x-r,L.y-r*.95,r*2,r*2);}
  for(const q of G.fl){const k=q.life/q.max,ag=1-k,s=q.r*(.5+.8*Math.sin(Math.PI*Math.min(1,ag*1.05)));
    if(ag>.5){const s2=s*1.2;c.globalAlpha=.5*k;c.drawImage(SPR.fTail,q.x-s2*sw,q.y-s2*st,s2*2*sw,s2*2*st);}
    else{c.globalAlpha=.5*Math.pow(k,.7);c.drawImage(SPR.fire,q.x-s*sw,q.y-s*st,s*2*sw,s*2*st);}
    if(ag<.3){const s3=s*.5;c.globalAlpha=(1-ag/.3)*.5;c.drawImage(gf>.3?SPR.fCore:SPR.fBlue,q.x-s3*sw,q.y-s3*st,s3*2*sw,s3*2*st);}}
  for(const o of G.fb){let s=o.r*3.2*rnd(.8,1.1);c.globalAlpha=.5;c.drawImage(SPR.glow,o.x-s,o.y-s,s*2,s*2);s=o.r*1.3;c.globalAlpha=.9;c.drawImage(gf>.3?SPR.fCore:SPR.fBlue,o.x-s,o.y-s,s*2,s*2);}
  const SB=G.sparkB;SB.forEach(a=>a.length=0);
  for(const q of G.ps){const k=q.life/q.max;
    if(q.t==="fire"){const s=q.r*(1+(1-k)*1.3);c.globalAlpha=Math.pow(k,.8);c.drawImage(SPR.fire,q.x-s,q.y-s,s*2,s*2);}
    else if(q.t==="spark")SB[Math.min(3,(k*4)|0)].push(q);
    else if(q.t==="ember"){const s=q.s*k+2;c.globalAlpha=k;c.drawImage(SPR.glow,q.x-s,q.y-s,s*2,s*2);}
    else if(q.t==="ring"){const u=1-k;c.globalAlpha=.65*k;c.strokeStyle="rgb(255,240,220)";c.lineWidth=1+3*k;c.beginPath();c.arc(q.x,q.y,q.R*Math.sqrt(u),0,Math.PI*2);c.stroke();}}
  // 불티: 밝기 4단계로 묶어서 한 번에 그림
  c.strokeStyle="rgb(255,205,130)";c.lineWidth=1.6;
  SB.forEach((a,i)=>{if(!a.length)return;c.globalAlpha=(i+.5)/4;c.beginPath();for(const q of a){c.moveTo(q.x,q.y);c.lineTo(q.x-q.vx*.025,q.y-q.vy*.025);}c.stroke();});
  for(const B of G.bombs){if(B.tx==null)continue;const s=rnd(7,12);c.globalAlpha=1;c.drawImage(SPR.glow,B.tx-s,B.ty-s,s*2,s*2);
    if(Math.random()<.5)spark(B.tx,B.ty,rnd(-90,90),rnd(-160,-30),rnd(.12,.3));}
  if(G.tool==="laser"){const E=G.emit,P=G.ptr;
    if(P.down){let T={x:P.x,y:P.y};
      if(!G.laserHit){const dx=P.x-E.x,dy=P.y-E.y,n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n;let t=1e5;
        if(ux>0)t=Math.min(t,(G.vw-E.x)/ux);if(ux<0)t=Math.min(t,-E.x/ux);if(uy>0)t=Math.min(t,(G.vh-E.y)/uy);if(uy<0)t=Math.min(t,-E.y/uy);
        T={x:E.x+ux*t,y:E.y+uy*t};}
      const fl=rnd(.85,1.15);c.lineCap="round";
      [[10,"rgba(255,30,20,.16)"],[4.5,"rgba(255,60,40,.5)"],[1.6,"rgba(255,238,232,.95)"]].forEach(([w,col])=>{c.globalAlpha=1;c.strokeStyle=col;c.lineWidth=w*fl;c.beginPath();c.moveTo(E.x,E.y);c.lineTo(T.x,T.y);c.stroke();});
      if(G.laserHit){let s=22*fl;c.drawImage(SPR.red,P.x-s,P.y-s,s*2,s*2);s=11*fl;c.drawImage(SPR.glow,P.x-s,P.y-s,s*2,s*2);}
      const s=9;c.drawImage(SPR.red,E.x-s,E.y-s,s*2,s*2);
    }else if(P.x>0){c.globalAlpha=.7;c.drawImage(SPR.red,P.x-5,P.y-5,10,10);}}
  c.globalCompositeOperation="source-over";c.globalAlpha=1;
  for(const H of G.hm)drawHammer(c,H);
  c.globalAlpha=1;c.restore();
  if(G.flash>.005){c.fillStyle=`rgba(255,246,225,${G.flash})`;c.fillRect(0,0,G.vw,G.vh);}}

// ── 망치 · 불 · 물 · 무중력 ──
// 물: 바닥에 고인 물은 1차원 얕은물 방정식(칸마다 깊이 h, 칸 경계마다 흐름 u)으로 출렁이고,
//     공중의 물은 서로 끌어당기는 물방울 입자. 물방울이 수면에 닿으면 고인 물로 합쳐짐.
// 불: 조각의 칸마다 연료와 타는 세기가 있어 이웃 칸·위쪽으로 번지고, 다 타면 재가 되어 뚫림.
const WDX=5,RHO_W=.0021,DROP_MAX=1900,FL_MAX=750,FB_MAX=140,BUB_MAX=320,HL=104,FACE=27;
const gfac=()=>clamp(G.engine.gravity.y/1.15,0,1.2);
const gW=()=>G.engine.gravity.y*1000;

// ── 소리 (불·물·망치) ──
function sLoopSet(key,level,make){const c=AU.ctx;if(!c)return;let L=AU[key];
  if(level>.0005&&!L)L=AU[key]=make(c);
  if(L)L.g.gain.setTargetAtTime(Math.max(0,level),c.currentTime,.09);}
function nLoop(c,type,freq,Q){const s=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type=type;f.frequency.value=freq;f.Q.value=Q;g.gain.value=0;
  s.connect(f);f.connect(g);g.connect(AU.master);s.start(0,Math.random()*1.5);return{g,s,f};}
const mkFire=c=>nLoop(c,"lowpass",620,.5);
const mkPour=c=>nLoop(c,"bandpass",1250,.55);
const mkDrain=c=>{const L=nLoop(c,"lowpass",300,6),o=c.createOscillator(),og=c.createGain();o.frequency.value=5.2;og.gain.value=170;o.connect(og);og.connect(L.f.frequency);o.start();L.o=o;return L;};
function sStopLoops(){["fireS","pourS","drainS"].forEach(k=>{const L=AU[k];if(!L)return;try{L.s.stop()}catch(e){}if(L.o)try{L.o.stop()}catch(e){}AU[k]=null;});}
function burst(c,t,type,freq,Q,gain,dur){const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type=type;f.frequency.value=freq;f.Q.value=Q;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random()*1.5);n.stop(t+dur+.03);}
function tone(c,t,type,f0,f1,gain,dur){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur*.8);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+dur+.03);}
function sCrackle(v){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"bandpass",rnd(1800,5200),1.4,rnd(.05,.17)*v,rnd(.012,.035));
  if(Math.random()<.3)burst(c,t+rnd(.01,.04),"bandpass",rnd(900,2200),2,rnd(.04,.1)*v,.02);}
function sSteam(k){const c=AU.ctx;if(!c)return;const t=c.currentTime;if(t-(AU.stT||0)<.09)return;AU.stT=t;
  const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type="highpass";f.frequency.value=2800;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15*k,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.5+.3*k);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+.9);}
function sSplash(k){const c=audio();if(!c)return;const t=c.currentTime;if(t-(AU.spT||0)<.06)return;AU.spT=t;
  const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type="lowpass";f.frequency.setValueAtTime(3200,t);f.frequency.exponentialRampToValueAtTime(450,t+.4);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5*k,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+.55);
  for(let i=0;i<4;i++){const f0=rnd(450,1000);tone(c,t+rnd(.03,.22),"sine",f0,f0*1.7,.07*k,.07);}}
function sWhoosh(){const c=AU.ctx;if(!c)return;const t=c.currentTime,n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();
  f.type="bandpass";f.Q.value=2;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(1700,t+.11);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.07);g.gain.exponentialRampToValueAtTime(.0001,t+.15);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+.17);}
function sHammer(kind,k){const c=audio();if(!c)return;const t=c.currentTime;
  tone(c,t,"sine",kind==="floor"?120:160,40,(kind==="floor"?.9:.75)*k,.32);
  if(kind==="piece"){burst(c,t,"highpass",1700,.7,.5*k,.09);tone(c,t,"triangle",680,430,.2,.12);
    for(let i=0;i<7;i++)burst(c,t+rnd(.004,.15),"bandpass",rnd(1400,4800),2,rnd(.08,.26)*k,rnd(.015,.04));}
  else burst(c,t,"lowpass",900,.7,.45*k,.22);}

// ── 효과 입자 ──
function steamP(x,y,n,sp){for(let i=0;i<n&&G.nSteam<STEAM_MAX;i++,G.nSteam++){const L=rnd(1,1.9);addP({t:"steam",x:x+rnd(-5,5),y:y+rnd(-4,4),vx:rnd(-25,25),vy:-rnd(20,70)*(sp||1),r:rnd(6,12),gr:rnd(18,34),a:rnd(.3,.5),life:L,max:L});}}
function dustP(x,y,n,k){for(let i=0;i<n;i++){const a=rnd(Math.PI*1.05,Math.PI*1.95),s=rnd(30,170)*k,L=rnd(.7,1.5);
  addP({t:"dust",x:x+rnd(-6,6),y:y+rnd(-3,3),vx:Math.cos(a)*s,vy:Math.sin(a)*s*.6,r:rnd(5,11),gr:rnd(14,30),a:rnd(.35,.6),life:L,max:L});}}
function bubble(x,y,r){if(G.bub.length<BUB_MAX)G.bub.push({x,y,r:r||rnd(1.5,4.5),vx:rnd(-20,20),vy:-rnd(20,80),sd:rnd(0,9)});}
// 개수를 줄인 만큼 조금 크게 · 가득 차면 새 불꽃을 버리지 않고 아무 불꽃 하나와 바꿈 (새로 붙은 곳에도 불꽃이 보이도록)
function flame(x,y,r,b){const L=rnd(.45,.85)*(.8+.3*b),o={x:x+rnd(-2,2),y,vx:rnd(-15,15),vy:-rnd(10,50),r:r*rnd(.9,1.4),life:L,max:L,sd:rnd(0,100)};
  if(G.fl.length>=FL_MAX)G.fl[(Math.random()*G.fl.length)|0]=o;else G.fl.push(o);}

// ── 조각 찾기 (64px 격자) ──
function buildPG(){const M=G.pg;M.clear();
  for(const p of G.pieces){if(p.dead)continue;const bb=p.body.bounds;
    const x0=Math.floor((bb.min.x-10)/64),x1=Math.floor((bb.max.x+10)/64),y0=Math.floor((bb.min.y-10)/64),y1=Math.floor((bb.max.y+10)/64);
    if(x1-x0>40||y1-y0>40||y0<-60)continue;
    for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const k=(gx+64)*4096+(gy+64);let a=M.get(k);if(!a)M.set(k,a=[]);a.push(p);}}}
function pieceAt(x,y){const a=G.pg.get((Math.floor(x/64)+64)*4096+(Math.floor(y/64)+64));if(!a)return null;
  for(let k=a.length-1;k>=0;k--){const p=a[k];if(p.dead)continue;const bb=p.body.bounds;
    if(x<bb.min.x-2||x>bb.max.x+2||y<bb.min.y-2||y>bb.max.y+2)continue;
    const L=toLocal(p,x,y);if(L.x<0||L.y<0||L.x>=p.W||L.y>=p.H)continue;
    const i=Math.floor(L.y/p.cs)*p.cols+Math.floor(L.x/p.cs);if(i>=0&&i<p.d.length&&p.d[i]<1)return{p,L,i};}
  return null;}
function cellsIn(p,lx,ly,R,fn){const {cs,cols,rows}=p;
  const x0=Math.max(0,Math.floor((lx-R)/cs)),x1=Math.min(cols-1,Math.floor((lx+R)/cs)),y0=Math.max(0,Math.floor((ly-R)/cs)),y1=Math.min(rows-1,Math.floor((ly+R)/cs));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(Math.hypot((x+.5)*cs-lx,(y+.5)*cs-ly)<=R)fn(y*cols+x);}}
function igniteAt(p,lx,ly,R,s){let n=0;const {d,bn,wt}=p;
  cellsIn(p,lx,ly,R,i=>{if(d[i]>=1||wt[i]>.15)return;if(bn[i]<s)bn[i]=s;n++;});
  if(n){p.burning=true;p.hot=true;}return n;}
function wetAt(p,lx,ly,R){let ext=0;const {d,bn,wt}=p;
  cellsIn(p,lx,ly,R,i=>{if(d[i]>=1)return;if(wt[i]<.9)p.wdirty=true;wt[i]=1;if(bn[i]>0){bn[i]=0;ext++;}});
  p.wet=true;return ext;}

// ── 고인 물 (얕은물 방정식) ──
function wResize(){const n=Math.ceil(G.vw/WDX)+1,V=G.W?G.W.vol:0;
  G.W={n,h:new Float32Array(n),u:new Float32Array(n+1),F:new Float32Array(n+1),s:new Float32Array(n),tmp:new Float32Array(n),vol:0,hmax:0,drain:0,dv:0};
  if(V>0){const l=V/(n*WDX);G.W.h.fill(l);G.W.vol=V;G.W.hmax=l;}}
function hAt(x){const W=G.W,f=x/WDX-.5;let i=Math.floor(f),t=f-i;if(i<0){i=0;t=0}if(i>=W.n-1){i=W.n-1;t=0}
  const j=Math.min(i+1,W.n-1);return W.h[i]*(1-t)+W.h[j]*t;}
function surfY(x){return G.vh-hAt(x);}
function wDeposit(x,vol,vx){const W=G.W;if(W.vol+vol>G.vw*G.vh*.86)return;
  const sg=16,c=x/WDX-.5,i0=Math.max(0,Math.floor(c-3*sg/WDX)),i1=Math.min(W.n-1,Math.ceil(c+3*sg/WDX));let sum=0;
  for(let i=i0;i<=i1;i++){const d=(i-c)*WDX;sum+=Math.exp(-d*d/(2*sg*sg));}if(sum<=0)return;
  const mv=clamp(vx,-900,900)*.06;
  for(let i=i0;i<=i1;i++){const d=(i-c)*WDX,w=Math.exp(-d*d/(2*sg*sg))/sum;W.h[i]+=vol*w/WDX;W.u[i]+=mv*w;}
  W.vol+=vol;}
// 수면을 둥글게 들어올리거나(+) 움푹 파기(−): 주변 물을 옮겨와서 부피는 그대로
function wDome(x,A,R){const W=G.W,c=x/WDX-.5,r=R/WDX,i0=Math.max(0,Math.floor(c-r*3)),i1=Math.min(W.n-1,Math.ceil(c+r*3));let add=0,ring=0;
  for(let i=i0;i<=i1;i++){const t=Math.abs(i-c)/r;if(t<1){const v0=A*(.5+.5*Math.cos(Math.PI*t)),v=A>0?v0:Math.max(v0,-W.h[i]);W.h[i]+=v;add+=v;}else ring+=W.h[i];}
  if(ring>0)for(let i=i0;i<=i1;i++){if(Math.abs(i-c)/r>=1)W.h[i]=Math.max(0,W.h[i]-add*W.h[i]/ring);}}
function wShift(i0,i1,dv){const h=G.W.h,n=G.W.n,o0=Math.max(0,i0-3),o1=Math.min(n-1,i1+3),nOut=(i0-o0)+(o1-i1);if(!nOut)return;
  let inA=0,outA=0;for(let i=i0;i<=i1;i++)inA+=h[i];for(let i=o0;i<i0;i++)outA+=h[i];for(let i=i1+1;i<=o1;i++)outA+=h[i];
  if(dv>0){const v=Math.min(dv/WDX,inA*.15);if(v<=0)return;for(let i=i0;i<=i1;i++)h[i]-=v*h[i]/inA;for(let i=o0;i<i0;i++)h[i]+=v/nOut;for(let i=i1+1;i<=o1;i++)h[i]+=v/nOut;}
  else{const v=Math.min(-dv/WDX,outA*.15);if(v<=0)return;for(let i=o0;i<i0;i++)h[i]-=v*h[i]/outA;for(let i=i1+1;i<=o1;i++)h[i]-=v*h[i]/outA;const m=i1-i0+1;for(let i=i0;i<=i1;i++)h[i]+=v/m;}}
function wTake(x,vol){const W=G.W,c=Math.round(x/WDX-.5),a=Math.max(0,c-8),b=Math.min(W.n-1,c+8);let av=0;
  for(let i=a;i<=b;i++)av+=W.h[i]*WDX;if(av<=0)return 0;const k=Math.min(.6,vol/av);
  for(let i=a;i<=b;i++)W.h[i]*=1-k;const got=av*k;W.vol-=got;return got;}
function wStep(dt){const W=G.W,n=W.n,h=W.h,u=W.u,F=W.F,S=W.s;
  if(W.drain){W.dv=Math.min(1700,W.dv+1500*dt);let any=0;for(let i=0;i<n;i++){h[i]=Math.max(0,h[i]-W.dv*dt);if(h[i]>0)any=1;}
    if(!any){h.fill(0);u.fill(0);if(!G.dr.length){W.drain=0;W.dv=0;}}}
  let hm=0,sum=0,um=0;for(let i=0;i<n;i++){if(h[i]>hm)hm=h[i];sum+=h[i];}for(let j=0;j<=n;j++){const a=Math.abs(u[j]);if(a>um)um=a;}
  W.hmax=hm;W.vol=sum*WDX;
  if(hm<.02){if(sum>0)h.fill(0);u.fill(0);W.vol=0;return;}
  const g=Math.max(350,gW()),c=Math.sqrt(g*hm)+um+40,m=clamp(Math.ceil(c*dt/(WDX*.4)),1,140),sd=dt/m,damp=Math.exp(-1.4*sd);
  for(let k=0;k<m;k++){
    for(let j=1;j<n;j++){let v=(u[j]-g*sd*(h[j]-h[j-1])/WDX)*damp;if(h[j]<1e-3&&h[j-1]<1e-3)v=0;u[j]=v>900?900:v<-900?-900:v;}
    u[0]=0;u[n]=0;F[0]=0;F[n]=0;
    for(let j=1;j<n;j++)F[j]=u[j]>0?u[j]*h[j-1]:u[j]*h[j];
    for(let i=0;i<n;i++){const out=Math.max(0,F[i+1])+Math.max(0,-F[i]),cap=h[i]*WDX/sd;S[i]=out>cap?cap/out:1;}
    for(let j=1;j<n;j++)F[j]*=F[j]>0?S[j-1]:S[j];
    for(let i=0;i<n;i++){const v=h[i]-sd/WDX*(F[i+1]-F[i]);h[i]=v>0?v:0;}}
  // 격자 잡음을 살짝 고르기 (무중력에선 출렁임이 없으니 조금 더)
  const T=W.tmp,a=gW()<200?.12:.07;T.set(h);for(let i=1;i<n-1;i++)h[i]=T[i]+a*(T[i-1]+T[i+1]-2*T[i]);
  let up=u[0];for(let j=1;j<n;j++){const cur=u[j];u[j]=cur+.25*(up+u[j+1]-2*cur);up=cur;}}
// 물에 잠긴 몸체에 부력·물 저항, 그리고 몸체가 수면을 밀어 물결 만들기 (물리 한 단계마다)
function waterForces(){if(!G||!G.W||G.W.vol<1)return;const {Body}=Matter,W=G.W,eng=G.engine,gy=eng.gravity.y,gs=eng.gravity.scale;
  const list=[];for(const p of G.pieces)if(!p.dead&&p.body)list.push(p.body);for(const B of G.bombs)list.push(B.b);
  for(const b of list){const parts=b.parts.length>1?b.parts.slice(1):[b];let sub=0,cross=false;
    for(const pt of parts){const bb=pt.bounds,cx=pt.position.x,ys=surfY(cx);if(bb.max.y<=ys+.5)continue;
      const hg=Math.max(1,bb.max.y-bb.min.y),fr=clamp((bb.max.y-ys)/hg,0,1),A=pt.area*fr;sub+=A;
      if(gy>0)Body.applyForce(b,{x:cx,y:(Math.max(ys,bb.min.y)+bb.max.y)/2},{x:0,y:-RHO_W*A*gy*gs});
      if(fr<1)cross=true;}
    // 벽에 붙은 칸은 절반 넘게 잠기면 떨어져 나와 뜸
    if(b.isStatic){if(b.plugin.piece&&sub>b.area*.5)release(b.plugin.piece);continue;}
    // 수면을 지나는 조각: 가라앉는 만큼 아래 물을 양옆으로 살짝 밀어냄 (부피 보존)
    if(cross&&!W.drain){const vy=b.velocity.y*60;if(Math.abs(vy)>15){const bb=b.bounds,i0=clamp(Math.floor(bb.min.x/WDX),0,W.n-1),i1=clamp(Math.floor(bb.max.x/WDX),i0,W.n-1);
      wShift(i0,i1,clamp(vy,-600,600)/60*(bb.max.x-bb.min.x)*.25);}}
    const fr=sub/Math.max(1,b.area),was=b.plugin.sub||0;b.plugin.sub=fr;
    if(fr>0){const k=1-.05*fr,uw=W.u[clamp(Math.round(b.position.x/WDX),0,W.n)]/60;
      Body.setVelocity(b,{x:(b.velocity.x+(uw-b.velocity.x)*.025*fr)*k,y:b.velocity.y*k});Body.setAngularVelocity(b,b.angularVelocity*(1-.07*fr));
      if(was===0&&b.velocity.y*60>340)G.splashQ.push({x:b.position.x,w:b.bounds.max.x-b.bounds.min.x,v:b.velocity.y*60});}}}
function doSplashes(){for(const s of G.splashQ){const ys=surfY(s.x),k=clamp(s.v/700,.3,1.6),n=Math.min(16,Math.round(3+k*5+s.w/30));
    const got=wTake(s.x,n*110),vol=got/n;if(vol<20)continue;
    for(let i=0;i<n;i++){const side=Math.random()<.5?-1:1;spawnDrop(s.x+side*s.w*rnd(.2,.55),ys-3,side*rnd(60,260)*k,-rnd(220,560)*k,rnd(2.6,4.6),vol);}
    for(let i=0;i<8*k;i++)bubble(s.x+rnd(-s.w/2,s.w/2),ys+rnd(8,40),rnd(1.5,4));
    sSplash(clamp(k*.7,.25,1));}
  G.splashQ.length=0;}
function splashUp(x,ys,n,spd){if(n<1)return;const got=wTake(x,n*100);if(got<n*20)return;const vol=got/n;
  for(let i=0;i<n;i++)spawnDrop(x+rnd(-10,10),ys-2,rnd(-.4,.4)*spd,-rnd(.45,1)*spd,rnd(2.6,4.8),vol);}

// ── 물방울 ──
function spawnDrop(x,y,vx,vy,r,vol){if(G.dr.length>=DROP_MAX)return;G.dr.push({x:clamp(x,2,G.vw-2),y,vx,vy,r:r||rnd(4,5.6),vol:vol||rnd(140,180)});}
function dropHit(o,hit){const p=hit.p,L=hit.L,{cs,cols,rows,d}=p,gx=Math.floor(L.x/cs),gy=Math.floor(L.y/cs);let nx=0,ny=0;
  for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){if(!ox&&!oy)continue;const x=gx+ox,y=gy+oy;if(!(x>=0&&y>=0&&x<cols&&y<rows&&d[y*cols+x]<1)){nx+=ox;ny+=oy;}}
  if(!nx&&!ny){nx=L.x-p.W/2;ny=L.y-p.H/2;}
  const nn=Math.hypot(nx,ny)||1;nx/=nn;ny/=nn;
  const f=p.f,wx=f.c*nx-f.s*ny,wy=f.s*nx+f.c*ny;
  for(let k=0;k<8;k++){o.x+=wx*cs*.4;o.y+=wy*cs*.4;const q=toLocal(p,o.x,o.y),qx=Math.floor(q.x/cs),qy=Math.floor(q.y/cs);if(qx<0||qy<0||qx>=cols||qy>=rows||d[qy*cols+qx]>=1)break;}
  const b=p.body,w=b.angularVelocity*60,bvx=b.velocity.x*60-w*(o.y-b.position.y),bvy=b.velocity.y*60+w*(o.x-b.position.x);
  let vx=o.vx-bvx,vy=o.vy-bvy;const vn=vx*wx+vy*wy;
  if(vn<0){vx-=1.08*vn*wx;vy-=1.08*vn*wy;const vt=vx*wx+vy*wy,tx=vx-vt*wx,ty=vy-vt*wy;vx-=tx*.04;vy-=ty*.04;
    const kf=2e-6*(o.vol/240);Matter.Body.applyForce(b,{x:o.x,y:o.y},{x:wx*vn*kf,y:wy*vn*kf});}
  o.vx=vx+bvx;o.vy=vy+bvy;
  const ext=wetAt(p,L.x,L.y,cs*1.7);if(ext){steamP(o.x,o.y,Math.min(4,ext),1);sSteam(.7);}}
function dropStep(dt){const D=G.dr;if(!D.length)return;const W=G.W,g=gW(),H=12,R0=7.5,hash=G.hash;hash.clear();
  for(let i=0;i<D.length;i++){const o=D[i],k=(Math.floor(o.x/H)+80)*8192+(Math.floor(o.y/H)+400);let a=hash.get(k);if(!a)hash.set(k,a=[]);a.push(i);}
  // 서로 붙으려는 힘(표면장력 비슷) + 겹침 밀어내기 + 점성
  const vk=Math.min(1,7*dt),coh=380*dt;
  for(const o of D)o.nb=0;
  for(let i=0;i<D.length;i++){const o=D[i],cx=Math.floor(o.x/H)+80,cy=Math.floor(o.y/H)+400;
    for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){const a=hash.get((cx+ox)*8192+cy+oy);if(!a)continue;
      for(const j of a){if(j<=i)continue;const q=D[j],dx=q.x-o.x,dy=q.y-o.y,d2=dx*dx+dy*dy;if(d2>=H*H)continue;
        const d=Math.sqrt(d2)||.01,nx=dx/d,ny=dy/d,w=1-d/H;o.nb++;q.nb++;
        if(d<R0){const c=(R0-d)*.3;o.x-=nx*c;o.y-=ny*c;q.x+=nx*c;q.y+=ny*c;}
        else{const a2=coh*w;o.vx+=nx*a2;o.vy+=ny*a2;q.vx-=nx*a2;q.vy-=ny*a2;}
        const dvx=(q.vx-o.vx)*w*vk*.5,dvy=(q.vy-o.vy)*w*vk*.5;o.vx+=dvx;o.vy+=dvy;q.vx-=dvx;q.vy-=dvy;}}}
  // 불덩이에 물이 닿으면 꺼짐
  for(const o of G.fb){const cx=Math.floor(o.x/H)+80,cy=Math.floor(o.y/H)+400;let hit=false;
    for(let ox=-1;ox<=1&&!hit;ox++)for(let oy=-1;oy<=1&&!hit;oy++){const a=hash.get((cx+ox)*8192+cy+oy);if(a)for(const j of a){const q=D[j];if(Math.hypot(q.x-o.x,q.y-o.y)<o.r+7){hit=true;break;}}}
    if(hit&&!o.dead){o.dead=true;steamP(o.x,o.y,4,1);sSteam(.8);}}
  const zg=G.zg,vw=G.vw,vh=G.vh;
  for(let i=D.length-1;i>=0;i--){const o=D[i];
    o.vy+=g*dt;if(g<300){const k=Math.pow(.998,dt*60);o.vx*=k;o.vy*=k;}
    o.x+=o.vx*dt;o.y+=o.vy*dt;
    if(o.x<o.r){o.x=o.r;o.vx=Math.abs(o.vx)*.25;}else if(o.x>vw-o.r){o.x=vw-o.r;o.vx=-Math.abs(o.vx)*.25;}
    if(zg&&o.y<G.top+o.r){o.y=G.top+o.r;o.vy=Math.abs(o.vy)*.25;}
    let hit=pieceAt(o.x,o.y);
    // 벽에 붙은 칸에는 튕기지 않고 적시면서 흘러내림
    if(hit&&hit.p.pin){if(wetAt(hit.p,hit.L.x,hit.L.y,hit.p.cs*1.2)){steamP(o.x,o.y,1,1);sSteam(.5);}hit=null;}
    if(hit)dropHit(o,hit);
    // 조각 위에 고여 멈춘 물방울은 잠시 뒤 흘러내려 사라짐
    if(hit&&o.vx*o.vx+o.vy*o.vy<25600)o.rest=(o.rest||0)+dt;else if(o.rest)o.rest=Math.max(0,o.rest-dt*.5);
    let gone=false;
    if(o.rest>(W.drain?.5:1.6)){gone=true;if(!W.drain)wDeposit(o.x,o.vol,0);}else
    if(!W.drain){if(o.y+o.r*.4>=surfY(o.x)){gone=true;let v=o.vol;
        if(o.vy>380&&Math.random()<.08){const sv=v*.12;v-=sv*2;for(let m=0;m<2;m++)spawnDrop(o.x,o.y-4,rnd(-160,160),-o.vy*rnd(.15,.32),rnd(2,3.2),sv);}
        if(o.vy>300&&hAt(o.x)>20&&Math.random()<.12)bubble(o.x+rnd(-4,4),o.y+rnd(6,18),rnd(1.2,3));
        wDeposit(o.x,v,o.vx);G.absorbed+=v;}}
    else if(o.y>vh+40)gone=true;
    if(gone){D[i]=D[D.length-1];D.pop();}}}
function bubStep(dt){const A=G.bub,gf=Math.max(.15,gfac()),wv=G.W.vol>1;
  for(let i=A.length-1;i>=0;i--){const b=A[i];b.vy=(b.vy-420*gf*dt)*Math.pow(.96,dt*60);b.vx*=Math.pow(.95,dt*60);
    b.x+=b.vx*dt+Math.sin(G.time*9+b.sd)*18*dt;b.y+=b.vy*dt;
    if(!wv||b.y<=surfY(b.x)+b.r){A[i]=A[A.length-1];A.pop();}}}

// ── 불 ──
const _bl=[];
function fireStep(dt,budget){G.glows.length=0;const gf=gfac();let total=0;G.fireT+=dt;const spread=G.fireT>.12;if(spread)G.fireT=0;
  for(const p of G.pieces){if(p.dead||!(p.burning||p.hot))continue;
    const {cols,rows,cs,d,h,bn,fu,wt}=p,ux=-p.f.s,uy=-p.f.c;let cnt=0,sx=0,sy=0;_bl.length=0;
    const ig=(j,ox,oy,pr)=>{if(d[j]<1&&bn[j]===0&&wt[j]<.15&&Math.random()<pr*(1+2.2*Math.max(0,ox*ux+oy*uy)*gf))bn[j]=.06;};
    for(let i=0;i<d.length;i++){if(d[i]>=1)continue;
      if(bn[i]>0){
        if(wt[i]>.15){bn[i]=0;continue;}
        const b=bn[i]=Math.min(1,bn[i]+dt*.8*(1.05-bn[i]));
        fu[i]-=dt*(.1+.3*b);
        const was=d[i];d[i]+=dt*.3*b;if(was<.8&&d[i]>=.8)p.needMask=true;
        const em=fu[i]<.45?1-fu[i]/.45:0,hv=.1*b+.66*em*(.7+.3*Math.random());if(h[i]<hv)h[i]=hv;
        const x=i%cols,y=(i/cols)|0;
        if(fu[i]<=0||d[i]>=1){d[i]=1.35;bn[i]=0;p.shapeDirty=true;p.needMask=true;const w=toWorld(p,(x+.5)*cs,(y+.5)*cs);
          if(Math.random()<.45)shard(w.x,w.y,rnd(-30,30),rnd(-60,0),["#3a3532","#5a534d","#2a2522"][(Math.random()*3)|0],cs*rnd(.4,.8));if(Math.random()<.35)ember(w.x,w.y,rnd(-40,40),rnd(-120,-30));continue;}
        const pr=dt*1.3*b;
        if(x>0)ig(i-1,-1,0,pr);if(x<cols-1)ig(i+1,1,0,pr);if(y>0)ig(i-cols,0,-1,pr);if(y<rows-1)ig(i+cols,0,1,pr);
        cnt++;sx+=x;sy+=y;_bl.push(i);}
      else if(h[i]>.92&&wt[i]<.15&&Math.random()<dt*.8){bn[i]=.08;p.burning=true;}}
    if(!cnt){p.burning=false;continue;}
    p.burning=true;p.hot=true;p.dirty=true;total+=cnt;
    // 불꽃 피우기: 몫은 타는 칸 수에 비례 (지난 프레임 전체 기준) → 목록 뒤쪽 조각도 불꽃을 받음
    const share=Math.min(cnt*dt*4.5,budget*cnt/Math.max(cnt,G.fireTot||0)),ne=Math.floor(share)+(Math.random()<share%1?1:0),fr=clamp(cs*2,8,16);
    for(let k=0,tr=0;k<ne&&tr<ne*3;tr++){const i=_bl[(Math.random()*cnt)|0];if(Math.random()>fu[i]+.15)continue;k++;const w=toWorld(p,(i%cols+Math.random())*cs,((i/cols|0)+Math.random())*cs);flame(w.x,w.y,fr*(.6+.6*bn[i]),bn[i]);}
    const c=toWorld(p,(sx/cnt+.5)*cs,(sy/cnt+.5)*cs);G.glows.push({x:c.x,y:c.y,n:cnt*cs*cs/64});
    // 옆 조각으로 옮겨붙기 (불은 위로 잘 번짐)
    if(spread)for(let k=0;k<Math.min(6,cnt);k++){const i=_bl[(Math.random()*cnt)|0],w=toWorld(p,(i%cols+.5)*cs,((i/cols|0)+.5)*cs);
      const tx=w.x+rnd(-1,1)*(cs*1.3+(1-Math.min(1,gf))*10),ty=w.y-rnd(2,8+16*gf),hit=pieceAt(tx,ty);
      if(hit&&hit.p!==p&&hit.p.bn[hit.i]===0&&hit.p.wt[hit.i]<.15&&Math.random()<.6){hit.p.bn[hit.i]=.07;hit.p.burning=true;hit.p.hot=true;}
      for(const B of G.bombs)if(Math.hypot(B.b.position.x-w.x,B.b.position.y-w.y)<20)B.t=Math.min(B.t,G.time+.35);}}
  return total;}
function flameStep(dt){const A=G.fl,gf=gfac(),wv=G.W.vol>1,kx=Math.pow(gf>.3?.93:.9,dt*60),ky=gf>.3?Math.pow(.985,dt*60):kx;
  for(let i=A.length-1;i>=0;i--){const q=A[i];q.life-=dt;
    if(q.life>0){q.vy-=300*gf*dt;q.vx+=Math.sin(G.time*8+q.sd+q.y*.045)*110*dt;q.vx*=kx;q.vy*=ky;q.x+=q.vx*dt;q.y+=q.vy*dt;if(wv&&q.y>surfY(q.x))q.life=0;}
    // 폭발 연기 몫을 남겨 두려고 불꽃에서 나오는 연기는 100개까지만
    if(q.life<=0){if(G.nSmoke<100&&Math.random()<.1*gf+.03)smoke(q.x,q.y,q.vx*.3,q.vy*.3-10*gf,rnd(5,9),rnd(.22,.34));A[i]=A[A.length-1];A.pop();}}}
// 공중에 문지른 불 → 떨어지는 불덩이. 조각에 닿으면 옮겨붙고, 바닥에선 잠시 타오름
function globStep(dt,budget){const A=G.fb,g=gW(),wv=G.W.vol>1;let used=0;
  for(let i=A.length-1;i>=0;i--){const o=A[i];o.life-=dt;let dead=o.life<=0||o.dead;
    if(!dead){
      if(!o.fl){o.vy+=g*dt*.85;const k=Math.pow(G.zg?.985:.995,dt*60);o.vx*=k;o.vy*=k;o.x+=o.vx*dt;o.y+=o.vy*dt;
        if(o.x<4){o.x=4;o.vx*=-.3}if(o.x>G.vw-4){o.x=G.vw-4;o.vx*=-.3}if(G.zg&&o.y<G.top+4){o.y=G.top+4;o.vy*=-.3}
        if(wv&&o.y>=surfY(o.x)-1){steamP(o.x,o.y,5,1);sSteam(1);dead=true;}
        else if(o.y>=G.vh-3){o.fl=true;o.y=G.vh-3;o.vx=o.vy=0;}
        else{const h=pieceAt(o.x,o.y);if(h){if(h.p.wt[h.i]>.15){steamP(o.x,o.y,3,1);sSteam(.6);}else igniteAt(h.p,h.L.x,h.L.y,h.p.cs*1.9,.45);dead=true;}}}
      else{if(wv&&surfY(o.x)<G.vh-1.5){steamP(o.x,o.y,4,1);sSteam(.8);dead=true;}
        else if((o.tk=(o.tk||0)+dt)>.14){o.tk=0;const h=pieceAt(o.x+rnd(-6,6),o.y-rnd(3,18));if(h&&h.p.wt[h.i]<.15&&Math.random()<.55)igniteAt(h.p,h.L.x,h.L.y,h.p.cs*1.3,.25);}}
      for(const B of G.bombs)if(Math.hypot(B.b.position.x-o.x,B.b.position.y-o.y)<16)B.t=Math.min(B.t,G.time+.3);}
    if(!dead&&used<budget){flame(o.x,o.y-o.r*.4,o.r*rnd(1.3,2),1);used++;if(o.fl&&used<budget){flame(o.x+rnd(-5,5),o.y-2,o.r*rnd(1.5,2.2),1);used++;}}
    if(dead){if(Math.random()<.6)smoke(o.x,o.y,rnd(-8,8),-rnd(15,40),rnd(5,9),.3);A[i]=A[A.length-1];A.pop();}}
  return used;}
function fireAt(x,y,glob){const wv=G.W.vol>1;
  if(wv&&y>surfY(x)){if(Math.random()<.3){steamP(x,surfY(x),1,1);sSteam(.4);}return;}
  const h=pieceAt(x,y);
  if(h){if(h.p.wt[h.i]>.15){if(Math.random()<.4){steamP(x,y,1,.6);sSteam(.35);}return;}
    igniteAt(h.p,h.L.x,h.L.y,h.p.cs*1.6,.35);if(Math.random()<.6)flame(x,y,rnd(7,11),1);}
  else{if(Math.random()<.7)flame(x+rnd(-3,3),y+rnd(-3,3),rnd(6,10),1);
    if(glob&&G.fb.length<FB_MAX)G.fb.push({x,y,vx:clamp(G.ptr.pvx*.22,-500,500)+rnd(-25,25),vy:clamp(G.ptr.pvy*.22,-500,500)+rnd(-40,0),r:rnd(4,6.5),life:rnd(2.8,4.6)});}
  for(const B of G.bombs)if(Math.hypot(B.b.position.x-x,B.b.position.y-y)<16)B.t=Math.min(B.t,G.time+.3);}
// 젖음: 물에 잠긴 칸은 젖고 불이 꺼짐 · 젖은 칸은 천천히 마름
function wetStep(dt){G.wetT+=dt;G.ctT+=dt;const doC=G.W.vol>1&&G.ctT>.1;if(doC)G.ctT=0;const rep=G.wetT>.3;if(rep)G.wetT=0;
  for(const p of G.pieces){if(p.dead)continue;const wt=p.wt;
    if(doC){const bb=p.body.bounds,ym=Math.min(surfY(bb.min.x),surfY((bb.min.x+bb.max.x)/2),surfY(bb.max.x))-3;
      if(bb.max.y>ym){const {cols,cs,d,bn}=p;let ext=0,ex=0,ey=0;
        for(let i=0;i<d.length;i++){if(d[i]>=1)continue;const w=toWorld(p,(i%cols+.5)*cs,((i/cols|0)+.5)*cs);
          if(w.y>surfY(w.x)){if(wt[i]<.95)p.dirty=true;wt[i]=1;p.wet=true;if(bn[i]>0){bn[i]=0;ext++;ex=w.x;ey=w.y;}}}
        if(ext){steamP(ex,surfY(ex)-2,Math.min(6,2+ext/3),1.2);sSteam(1);for(let m=0;m<3;m++)bubble(ex+rnd(-8,8),ey);}}}
    if(p.wdirty){p.wdirty=false;p.dirty=true;}
    if(p.wet){let mx=0;const dk=dt*.05;for(let i=0;i<wt.length;i++){if(wt[i]>0){wt[i]-=dk;if(wt[i]<0)wt[i]=0;else if(wt[i]>mx)mx=wt[i];}}
      if(rep)p.dirty=true;if(mx===0){p.wet=false;p.dirty=true;}}}}

// ── 망치 ──
function hammerSpawn(x,y){if(G.hm.length>=6)return;const side=x+HL+16>G.vw?-1:1;G.hm.push({x,y,side,t:0,hit:false,wh:false,ti:side>0?Math.PI:0});}
function hamAngle(H){const t=H.t,s=H.side,ti=H.ti,t0=ti+s*1.75;
  if(t<.11){const e=t/.11,o=1-(1-e)*(1-e);return t0-s*.3+s*.42*o;}
  if(t<.19){const e=(t-.11)/.08,tb=t0+s*.12;return tb+(ti-tb)*e*e*e;}
  if(t<.32){const e=(t-.19)/.13;return ti+s*.2*Math.sin(Math.PI*e)*(1-e*.3);}
  const e=Math.min(1,(t-.32)/.3);return ti+s*(.02+.5*e*e);}
function hammerStep(dt){for(let i=G.hm.length-1;i>=0;i--){const H=G.hm[i];H.t+=dt;
  if(!H.wh&&H.t>=.1){H.wh=true;sWhoosh();}
  if(!H.hit&&H.t>=.19){H.hit=true;hammerImpact(H.x,H.y);}
  if(H.t>.62)G.hm.splice(i,1);}}
function drawHammer(c,H){const a=H.t<.05?H.t/.05:H.t>.4?Math.max(0,1-(H.t-.4)/.22):1;if(a<=0)return;
  const px=H.x-HL*Math.cos(H.ti),py=H.y-FACE-HL*Math.sin(H.ti);
  if(H.t>.12&&H.t<.2)[.05,.025].forEach((w,k)=>hamDraw(c,px,py,hamAngle({...H,t:Math.max(.11,H.t-w)}),H.side,a*(k?.22:.12),false));
  hamDraw(c,px,py,hamAngle(H),H.side,a,true);}
function hamDraw(c,px,py,th,side,a,shadow){const sh=()=>{if(shadow){c.shadowColor="rgba(0,0,0,.3)";c.shadowBlur=10;c.shadowOffsetX=3;c.shadowOffsetY=7;}},ns=()=>{c.shadowColor="transparent";};
  c.save();c.globalAlpha=a;c.translate(px,py);c.rotate(th);
  // 나무 손잡이
  sh();let g=c.createLinearGradient(0,-4.5,0,4.5);g.addColorStop(0,"#d39a5c");g.addColorStop(.45,"#a9713b");g.addColorStop(1,"#6c4321");
  c.fillStyle=g;c.beginPath();c.roundRect(8,-4.2,HL-8,8.4,3);c.fill();ns();
  c.strokeStyle="rgba(80,45,15,.35)";c.lineWidth=.7;c.beginPath();c.moveTo(40,-1.6);c.bezierCurveTo(60,-2.4,75,-.6,HL-12,-1.8);c.moveTo(44,1.8);c.bezierCurveTo(62,1,80,2.6,HL-14,1.2);c.stroke();
  // 고무 손잡이
  g=c.createLinearGradient(0,-5.5,0,5.5);g.addColorStop(0,"#4a4d55");g.addColorStop(.5,"#25272c");g.addColorStop(1,"#131417");
  c.fillStyle=g;c.beginPath();c.roundRect(-2,-5.4,40,10.8,4.5);c.fill();
  c.strokeStyle="rgba(255,255,255,.08)";c.lineWidth=1;c.beginPath();for(let x=4;x<36;x+=5){c.moveTo(x,-5);c.lineTo(x,5);}c.stroke();
  // 쇠 머리: 타격면이 항상 +y 쪽에 오도록 뒤집어서 그림
  c.save();c.scale(1,-side);sh();
  g=c.createLinearGradient(HL-10,0,HL+10,0);g.addColorStop(0,"#3d434c");g.addColorStop(.3,"#d7dce3");g.addColorStop(.55,"#8d959f");g.addColorStop(1,"#2e333a");c.fillStyle=g;
  c.beginPath();c.moveTo(HL-8,-9);c.lineTo(HL+8,-9);c.lineTo(HL+7,13);c.lineTo(HL+10,15);c.lineTo(HL+10,25.5);c.quadraticCurveTo(HL,28.5,HL-10,25.5);c.lineTo(HL-10,15);c.lineTo(HL-7,13);c.closePath();c.fill();
  c.beginPath();c.moveTo(HL-8,-9);c.quadraticCurveTo(HL-9,-20,HL-20,-30);c.lineTo(HL-15,-31.5);c.quadraticCurveTo(HL+2,-22,HL+8,-9);c.closePath();c.fill();ns();
  c.fillStyle="rgba(0,0,0,.45)";c.beginPath();c.moveTo(HL-2,-12);c.lineTo(HL-13,-27.5);c.lineTo(HL-9.5,-28.5);c.closePath();c.fill();
  c.fillStyle="rgba(255,255,255,.4)";c.fillRect(HL-9,24,19,1.4);c.fillStyle="rgba(255,255,255,.2)";c.fillRect(HL-4,-8,2.4,20);
  c.restore();c.restore();}
function hammerImpact(x,y){const k=PK();
  for(const B of G.bombs)if(Math.hypot(B.b.position.x-x,B.b.position.y-y)<20)B.t=G.time;
  const W=G.W,ys=W.vol>1?surfY(x):G.vh+99;let water=false;
  if(y>ys-6&&ys<G.vh-2){water=true;splashUp(x,ys,Math.round(10+8*k),380+160*k);sSplash(clamp(.5+.3*k,.4,1));for(let i=0;i<10;i++)bubble(x+rnd(-12,12),ys+rnd(6,30));
    wDome(x,-clamp(5*k,2,12),26);}
  const hit=pieceAt(x,y)||pieceAt(x,y+5)||pieceAt(x,y-5);
  if(hit){hammerBreak(hit.p,x,y,k);sHammer("piece",clamp(.6+.25*k,.5,1.2));G.hit=Math.max(G.hit,.04+.025*Math.min(k,2));G.shake=Math.min(30,G.shake+4+4*k);}
  else if(!water&&y>G.vh-26){dustP(x,G.vh-2,10,k);sHammer("floor",clamp(.6+.2*k,.5,1.1));G.shake=Math.min(30,G.shake+3+2*k);
    G.dctx.globalAlpha=.18;G.dctx.drawImage(SPR.soot,x-14,G.vh-8,28,10);G.dctx.globalAlpha=1;}
  // 충격이 옆 칸까지 퍼짐: 때린 곳 가까이 떠 있던 칸은 떨어져 나가며 바깥으로 밀려남 (파괴력이 클수록 멀리까지)
  const R=14+18*k;
  for(const q of G.pieces){if(q.dead||!q.pin)continue;const bb=q.body.bounds,dd=Math.hypot(Math.max(bb.min.x-x,0,x-bb.max.x),Math.max(bb.min.y-y,0,y-bb.max.y));
    if(dd>R)continue;release(q);const b=q.body,ux=b.position.x-x,uy=b.position.y-y,n=Math.hypot(ux,uy)||1,s=(1+1.5*k)*(1-dd/R)/Math.sqrt(Math.max(1,b.mass/3));
    Matter.Body.setVelocity(b,{x:b.velocity.x+ux/n*s,y:b.velocity.y+uy/n*s*.6});Matter.Body.setAngularVelocity(b,rnd(-.04,.04)*k);}}
// 맞은 자리는 움푹 깨지고, 거기서 금이 사방으로 뻗어 조각이 쪼개짐
function hammerBreak(p,x,y,k){release(p);const {cs,cols,rows,d}=p,L=toLocal(p,x,y),dim=Math.hypot(p.W,p.H),crater=[];
  const brk=(lx,ly)=>{const cx=Math.floor(lx/cs),cy=Math.floor(ly/cs);if(cx<0||cy<0||cx>=cols||cy>=rows)return;const i=cy*cols+cx;if(d[i]>=1)return;d[i]=1.35;p.bn[i]=0;p.cl[i]=1;};p.hasCl=true;
  const rc=cs*(.7+.45*k);cellsIn(p,L.x,L.y,rc+cs*.3,i=>{if(d[i]<1){d[i]=1.35;p.bn[i]=0;p.cl[i]=1;crater.push(i);}});
  const n=clamp(Math.round(3+Math.random()*2+1.3*k),3,10),a0=rnd(0,6.28),reach=clamp(.38+.42*k,.3,1.7);
  const walk=(lx,ly,a,len,dep)=>{const st=cs*.45;for(let s=0;s<len;s+=st){a+=rnd(-.24,.24);lx+=Math.cos(a)*st;ly+=Math.sin(a)*st;
      if(lx<-cs||ly<-cs||lx>p.W+cs||ly>p.H+cs)return;brk(lx,ly);
      if(dep<2&&Math.random()<.045)walk(lx,ly,a+(Math.random()<.5?-1:1)*rnd(.4,.9),(len-s)*rnd(.3,.6),dep+1);}};
  for(let i=0;i<n;i++)walk(L.x,L.y,a0+i*6.283/n+rnd(-.35,.35),dim*rnd(.3,.75)*reach,0);
  for(const i of crater){const w=toWorld(p,(i%cols+.5)*cs,((i/cols|0)+.5)*cs);
    for(let m=0;m<2;m++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(120,420)*Math.sqrt(k);shard(w.x,w.y,Math.cos(a)*s,Math.sin(a)*s,pickCol(p,0),cs*rnd(.5,1.1));}}
  dustP(x,y,6+Math.round(4*k),Math.sqrt(k));
  for(let i=0;i<5;i++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(200,500);spark(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(.08,.2));}
  p.shapeDirty=true;p.needMask=true;p.dirty=true;
  const before=G.pieces.length;restructure(p);
  const frags=(p.dead?[]:[p]).concat(G.pieces.slice(before)),many=frags.length>1;
  for(const q of frags){if(q.dead||!q.body)continue;const b=q.body,dx=b.position.x-x,dy=b.position.y-y,dd=Math.hypot(dx,dy)||1,m=Math.sqrt(Math.max(1,b.mass/3));
    const s=(1.4+2.6*k)/m*rnd(.7,1.15)*(many?1:.45);
    Matter.Body.setVelocity(b,{x:b.velocity.x+dx/dd*s,y:b.velocity.y+dy/dd*s*.6+1.2*k/m});
    Matter.Body.setAngularVelocity(b,b.angularVelocity+rnd(-.1,.1)*k*(many?1:.4));}}

// ── 손으로 문지르기 (불·물) ──
function toolStep(rdt){const P=G.ptr,t=G.tool;if(!P.down||(t!=="fire"&&t!=="water")){P.pvx=0;P.pvy=0;return;}
  const dx=P.x-P.lx,dy=P.y-P.ly,len=Math.hypot(dx,dy);
  P.pvx=clamp(P.pvx+(dx/rdt-P.pvx)*.5,-2500,2500);P.pvy=clamp(P.pvy+(dy/rdt-P.pvy)*.5,-2500,2500);
  if(t==="fire"){
    if(len>.5){const n=Math.ceil(len/5);for(let s=1;s<=n;s++){P.dacc+=len/n;const g=P.dacc>=12;if(g)P.dacc=0;fireAt(P.lx+dx*s/n,P.ly+dy*s/n,g);}}
    else{P.hold+=rdt;if(P.hold>.08){P.hold=0;fireAt(P.x,P.y,true);}}}
  else{
    if(len>.5){const n=Math.ceil(len/5),nx=-dy/len,ny=dx/len;for(let s=1;s<=n;s++){const x=P.lx+dx*s/n,y=P.ly+dy*s/n;
        for(let m=0;m<2;m++){const o=rnd(-9,9);spawnDrop(x+nx*o,y+ny*o,P.pvx*.5+rnd(-30,30),P.pvy*.5+rnd(-30,30));}}}
    else{P.hold+=rdt*110;while(P.hold>=1){P.hold-=1;spawnDrop(P.x+rnd(-6,6),P.y+rnd(-4,4),rnd(-25,25),rnd(10,60));}}}
  P.lx=P.x;P.ly=P.y;}

// ── 중력 · 무중력 ──
// 처음엔 칸들이 벽에 붙어 떠 있으므로 버튼은 "중력" → 누르면 모두 떨어지고 "무중력"으로, 다시 누르면 둥둥 뜨고 "중력"으로
function toggleGrav(){if(!G)return;
  if(G.grav){G.grav=false;setZG(true);showHint("무중력 · 모든 칸이 둥둥 떠다녀요");}
  else{G.grav=true;if(G.zg)setZG(false);else dropAll();showHint("중력 · 모든 칸이 떨어져요");}
  gravBtn();}
function dropAll(){G.calm=0;for(const B of G.bombs)unstick(B.b);
  for(const p of G.pieces){if(!p.pin)continue;release(p);Matter.Body.setAngularVelocity(p.body,rnd(-.02,.02));}}
function gravBtn(){const b=document.getElementById("gZero"),zero=!!(G&&G.grav),t=zero?"무중력":"중력";
  b.dataset.mode=zero?"zero":"grav";b.setAttribute("aria-label",t);b.querySelector(".lbl").textContent=t;}
function setZG(on){if(!G)return;G.zg=on;G.calm=0;
  const {Body,Composite}=Matter,T=500;
  // 무중력: 벽에 붙은 칸도 모두 떨어져 나와 떠다님 · 천장은 위쪽 도구 막대 바로 아래
  if(on){for(const p of G.pieces)release(p);for(const B of G.bombs)unstick(B.b);
    for(const b of Composite.allBodies(G.engine.world)){if(b.isStatic)continue;if(b.position.y<G.top+30)Body.setPosition(b,{x:b.position.x,y:G.top+50});
      Body.setVelocity(b,{x:b.velocity.x+rnd(-.7,.7),y:b.velocity.y-rnd(.8,2.6)});Body.setAngularVelocity(b,b.angularVelocity+rnd(-.035,.035));}
    for(const o of G.dr){o.vx+=rnd(-30,30);o.vy-=rnd(20,90);}
    Body.setPosition(G.walls.ceil,{x:G.vw/2,y:G.top-T/2});}
  else Body.setPosition(G.walls.ceil,{x:G.vw/2,y:-G.vh*2-T/2});}

// ── 물 그리기 ──
function surfPath(c,close){const W=G.W,h=W.h,vh=G.vh;c.moveTo(0,vh-h[0]);for(let i=0;i<W.n;i++)c.lineTo((i+.5)*WDX,vh-h[i]);c.lineTo(G.vw,vh-h[W.n-1]);
  if(close){c.lineTo(G.vw,vh+40);c.lineTo(0,vh+40);c.closePath();}}
function drawWater(c){const W=G.W,D=G.dr,has=W.vol>1;if(!has&&!D.length&&!G.bub.length)return;
  // 고인 물과 물방울을 한 장에 불투명하게 그린 뒤 반투명으로 얹어야 겹친 곳이 얼룩지지 않음
  const wc=G.wctx;wc.setTransform(G.fdpr,0,0,G.fdpr,0,0);wc.clearRect(0,0,G.vw,G.vh);wc.fillStyle=wc.strokeStyle="#3d8bd3";
  if(has){wc.beginPath();surfPath(wc,true);wc.fill();}
  if(D.length){wc.lineCap="round";const B=[[],[],[]];for(const o of D)B[o.r<3.4?0:o.r<4.8?1:2].push(o);
    [3.1,4.8,6.2].forEach((r,k)=>{if(!B[k].length)return;wc.lineWidth=r*2;wc.beginPath();
      for(const o of B[k]){const sx=clamp(o.vx*.014,-14,14),sy=clamp(o.vy*.014,-14,14);wc.moveTo(o.x,o.y);wc.lineTo(o.x-sx-.01,o.y-sy);}wc.stroke();});}
  c.globalAlpha=.52;c.drawImage(G.wcv,0,0,G.vw,G.vh);c.globalAlpha=1;
  if(has){const top=G.vh-W.hmax;c.save();c.beginPath();surfPath(c,true);c.clip();
    const gr=c.createLinearGradient(0,top,0,G.vh);gr.addColorStop(0,"rgba(120,190,255,.10)");gr.addColorStop(.25,"rgba(20,70,140,.06)");gr.addColorStop(1,"rgba(6,26,64,.42)");
    c.fillStyle=gr;c.fillRect(0,top-4,G.vw,G.vh-top+8);
    if(G.caus){const t=G.time;c.globalCompositeOperation="lighter";c.fillStyle=G.caus;
      try{G.caus.setTransform(new DOMMatrix().translate(t*14,t*9).scale(1.7));}catch(e){}c.globalAlpha=.09;c.fillRect(0,top,G.vw,G.vh-top);
      try{G.caus.setTransform(new DOMMatrix().translate(40-t*11,70+t*6).rotate(25).scale(2.3));}catch(e){}c.globalAlpha=.07;c.fillRect(0,top,G.vw,G.vh-top);
      c.globalCompositeOperation="source-over";c.globalAlpha=1;}
    c.restore();
    c.lineJoin="round";c.beginPath();let pen=false;
    for(let i=0;i<W.n;i++){const x=(i+.5)*WDX,y=G.vh-W.h[i];if(W.h[i]>.8){if(pen)c.lineTo(x,y);else{c.moveTo(x,y);pen=true;}}else pen=false;}
    c.strokeStyle="rgba(255,255,255,.16)";c.lineWidth=5;c.stroke();c.strokeStyle="rgba(230,245,255,.75)";c.lineWidth=1.3;c.stroke();}
  if(D.length){c.fillStyle="rgba(255,255,255,.5)";c.beginPath();
    for(const o of D){if(o.r<3||o.nb>1)continue;const r=o.r*.32,x=o.x-o.r*.3,y=o.y-o.r*.38;c.moveTo(x+r,y);c.arc(x,y,r,0,6.283);}c.fill();}
  if(G.bub.length){c.strokeStyle="rgba(230,245,255,.6)";c.lineWidth=1;c.beginPath();for(const b of G.bub){c.moveTo(b.x+b.r,b.y);c.arc(b.x,b.y,b.r,0,6.283);}c.stroke();
    c.fillStyle="rgba(255,255,255,.6)";c.beginPath();for(const b of G.bub){const x=b.x-b.r*.35,y=b.y-b.r*.35;c.moveTo(x+b.r*.3,y);c.arc(x,y,b.r*.3,0,6.283);}c.fill();}}

// ── 메인 루프 ──
// 움직이는 것도, 타거나 젖은 것도, 효과도 없으면 조용한 상태
function calm(){
  if(G.ptr.down||G.bombs.length||G.hm.length||G.ps.length||G.fl.length||G.fb.length||G.dr.length||G.bub.length||G.splashQ.length)return false;
  if(G.W.vol>0||G.W.drain||G.flash>.005||G.shake||G.hit>0||G.wallAll||G.wallQ.size||G.wallCl.length||G.engine.gravity.y!==(G.zg?0:1.15))return false;
  for(const p of G.pieces){if(p.dead)continue;if(p.burning||p.hot||p.wet||p.dirty||p.needMask||p.shapeDirty)return false;
    if(!p.pin&&(p.body.speed>.06||p.body.angularSpeed>.004))return false;}
  return true;}
function loop(ts){
  if(!G||G.paused)return;G.raf=requestAnimationFrame(loop);
  const {Engine}=Matter;
  let rdt=G.last?(ts-G.last)/1000:1/60;G.last=ts;rdt=Math.min(rdt,.05);
  // 조용한 상태가 잠시 이어지면 계산을 쉬어서 배터리를 아낌 (누르거나 무언가 바뀌면 다시 깨어남)
  if(calm()){if((G.calm+=rdt)>1.2)return;}else G.calm=0;
  let dt=rdt;if(G.hit>0){G.hit-=rdt;dt=rdt*.07;}   // 망치 타격 순간 잠깐 멈칫
  G.time+=dt;
  const gt=G.zg?0:1.15,gy=G.engine.gravity.y;if(gy!==gt){let ny=gy+(gt-gy)*Math.min(1,rdt*3.2);if(Math.abs(ny-gt)<.004)ny=gt;G.engine.gravity.y=ny;}
  G.acc+=dt;let n=0;while(G.acc>=1/60&&n<4){Engine.update(G.engine,1000/60);G.acc-=1/60;n++;}if(n>=4)G.acc=0;
  for(const p of G.pieces)if(!p.dead)p.f=frame(p);
  buildPG();
  if(G.splashQ.length)doSplashes();
  toolStep(rdt);
  hammerStep(dt);
  if(G.tool==="laser"&&G.ptr.down)laserStep(dt);else G.laserHit=false;
  for(const B of G.bombs.slice()){if(G.time>=B.t){Matter.Composite.remove(G.engine.world,B.b);G.bombs.splice(G.bombs.indexOf(B),1);
    if(G.drag&&G.drag.b===B.b)dropDrag();explode(B.b.position.x,B.b.position.y);}}
  sHiss(G.bombs.length);
  wStep(dt);G.absorbed=0;dropStep(dt);bubStep(dt);
  // 불꽃 몫: 바닥 불덩이는 일부만 쓰고, 타는 칸은 따로 받음 (불덩이가 많아도 칸의 불이 사라지지 않게)
  const fbud=Math.round(42*Math.min(2,dt*60));globStep(dt,Math.round(fbud*.4));
  G.fireTot=fireStep(dt,fbud);flameStep(dt);wetStep(dt);
  const kd=Math.exp(-dt*2.6);
  for(const p of G.pieces){if(p.dead)continue;
    if(p.hot){let mx=0;const h=p.h;for(let i=0;i<h.length;i++){if(h[i]>0){h[i]*=kd;if(h[i]<.004)h[i]=0;else if(h[i]>mx)mx=h[i];}}p.dirty=true;if(mx===0)p.hot=false;}
    if(p.shapeDirty&&G.time-p.shapeT>.07)restructure(p);}
  // 그을음·열·구멍 다시 그리기: 한 프레임에 칠하는 양을 제한하고, 구멍이 바뀐 조각 → 오래 기다린 조각 순으로
  // (여러 칸이 한꺼번에 타거나 젖어도 프레임이 일정하게 유지됨)
  const todo=G.todo;todo.length=0;
  for(const p of G.pieces){if(p.dead)continue;
    const mask=p.needMask&&G.time-p.maskT>(p.burning?.2:.06);
    if(!mask&&!(p.dirty&&G.time-(p.pT||0)>=(p.burning||p.hot?.06:0)))continue;
    p.pri=mask?1:0;todo.push(p);}
  if(todo.length>1)todo.sort((a,b)=>b.pri-a.pri||(a.pT||0)-(b.pT||0));
  let bud=36000;
  for(const p of todo){if(bud<=0)break;p.pT=G.time;paint(p);bud-=p.ow*p.oh;}
  for(const p of G.pieces){if(p.dead)continue;const f=p.f;if(f.cy>G.vh+900||f.cx<-900||f.cx>G.vw+900)killPiece(p,true);}
  for(const B of G.bombs.slice()){if(B.b.position.y>G.vh+900){Matter.Composite.remove(G.engine.world,B.b);G.bombs.splice(G.bombs.indexOf(B),1);}}
  if(G.pieces.length>40&&G.pieces.some(p=>p.dead))G.pieces=G.pieces.filter(p=>!p.dead);
  // 파티클 업데이트 (중력에 비례)
  const floorY=G.vh,gf=gfac(),wv=G.W.vol>1;
  // 다 된 입자는 끝 원소와 바꿔서 빼기 (splice는 입자가 많을 때 느림) · 연기·수증기 개수도 여기서 다시 셈
  G.nSmoke=G.nSteam=G.nShard=0;
  for(let i=G.ps.length-1;i>=0;i--){const q=G.ps[i];q.life-=dt;if(q.life<=0){G.ps[i]=G.ps[G.ps.length-1];G.ps.pop();continue;}
    if(q.t==="smoke")G.nSmoke++;else if(q.t==="steam")G.nSteam++;else if(q.t==="shard")G.nShard++;
    if(q.t==="shard"){q.vy+=1600*gf*dt;if(gf<.3){q.vx*=.995;q.vy*=.995;}
      if(wv&&q.y>surfY(q.x)){const k=Math.pow(.9,dt*60);q.vx*=k;q.vy*=k;q.vr*=k;}
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.rot+=q.vr*dt;
      if(q.y>floorY-q.h/2){q.y=floorY-q.h/2;q.vy*=-.32;q.vx*=.6;q.vr*=.5;}
      if(q.x<0){q.x=0;q.vx*=-.5}if(q.x>G.vw){q.x=G.vw;q.vx*=-.5}}
    else if(q.t==="spark"){q.vy+=900*gf*dt;q.vx*=.985;q.x+=q.vx*dt;q.y+=q.vy*dt;}
    else if(q.t==="ember"){q.vy+=420*gf*dt;q.vx*=.98;q.x+=q.vx*dt;q.y+=q.vy*dt;}
    else if(q.t==="fire"){q.vx*=.9;q.vy=q.vy*.9-70*gf*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;}
    else if(q.t==="smoke"){q.vx*=.97;q.vy=q.vy*.98-28*gf*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.r<HAZE_R)q.r+=q.gr*dt;}
    else if(q.t==="steam"){q.vx*=.97;q.vy=q.vy*.97-40*gf*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.r<HAZE_R)q.r+=q.gr*dt;}
    else if(q.t==="dust"){q.vx*=.93;q.vy=q.vy*.93+25*gf*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.r+=q.gr*dt;}}
  G.flash*=Math.exp(-rdt*12);
  G.shake*=Math.exp(-rdt*9);if(G.shake<.2)G.shake=0;
  G.sx=G.shake?rnd(-1,1)*G.shake:0;G.sy=G.shake?rnd(-1,1)*G.shake:0;
  const sh=G.shake?`translate(${G.sx}px,${G.sy}px)`:"";if(sh!==G.shT){G.shT=sh;G.wallCv.style.transform=G.freeCv.style.transform=G.decal.style.transform=sh;}
  drawPieces();
  // 소리: 불 타는 소리 · 물 붓는 소리 · 물 빠지는 소리
  const fl=G.fireTot+G.fb.length*3;
  sLoopSet("fireS",Math.min(.13,.016*Math.sqrt(fl)),mkFire);
  if(fl>0&&Math.random()<Math.min(28,fl*.15)*rdt)sCrackle(Math.min(1,.35+fl*.003));
  G.pourLv+=((G.absorbed/Math.max(rdt,.001))*1.6e-6+G.dr.length*3e-5-G.pourLv)*Math.min(1,rdt*6);
  sLoopSet("pourS",Math.min(.11,G.pourLv),mkPour);
  sLoopSet("drainS",G.W.drain&&G.W.vol>1?.12:0,mkDrain);
  if((G.uiT+=rdt)>.2){G.uiT=0;const b=document.getElementById("gDrain"),show=G.W.vol>30||G.dr.length>0;if(b.hidden===show)b.hidden=!show;
    const lb=G.W.drain?"내려가는 중…":"물 내리기",s=b.querySelector(".lbl2");if(s.textContent!==lb)s.textContent=lb;b.disabled=!!G.W.drain;}
  drawFx(dt);}

// ── 입력 ──
function pick(x,y){
  for(const B of G.bombs)if(Math.hypot(B.b.position.x-x,B.b.position.y-y)<17)return B.b;
  for(let k=G.pieces.length-1;k>=0;k--){const p=G.pieces[k];if(p.dead)continue;const bb=p.body.bounds;
    if(x<bb.min.x-4||x>bb.max.x+4||y<bb.min.y-4||y>bb.max.y+4)continue;
    const L=toLocal(p,x,y);if(L.x<-4||L.y<-4||L.x>p.W+4||L.y>p.H+4)continue;
    const cx=clamp(Math.floor(L.x/p.cs),0,p.cols-1),cy=clamp(Math.floor(L.y/p.cs),0,p.rows-1);
    if(p.d[cy*p.cols+cx]<1)return p.body;}
  return null;}
function dropDrag(){if(G&&G.drag){Matter.Composite.remove(G.engine.world,G.drag.c);G.drag=null;}}
function grab(b,x,y){const c=Matter.Constraint.create({pointA:{x:G.ptr.x,y:G.ptr.y},bodyB:b,pointB:{x:x-b.position.x,y:y-b.position.y},stiffness:.22,damping:.08,length:0});
  Matter.Composite.add(G.engine.world,c);G.drag={c,b};}
function setTool(t,quiet){TOOL=t;
  document.querySelectorAll(".gbar [data-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tool===t?"true":"false"));
  if(!quiet)showHint(hintFor(t));
  if(!G)return;G.tool=t;G.calm=0;document.documentElement.dataset.gtool=t;
  dropDrag();sLaser(false);if(G.ptr.down&&t==="laser")sLaser(true);
  const P=G.ptr;P.lx=P.x;P.ly=P.y;P.hold=t==="water"?3:.08;P.dacc=12;}
// 도구를 바꾸면 사용법이 잠깐 떴다가 사라짐
let hintTimer=0;
function showHint(s){const h=document.getElementById("gHint");h.textContent=s;h.classList.add("show");
  clearTimeout(hintTimer);hintTimer=setTimeout(()=>h.classList.remove("show"),2600);}
// 효과·물 캔버스는 매 프레임 전체를 다시 그리므로 해상도를 1.5배까지만 (불·연기·물은 원래 흐릿해서 티가 거의 안 남)
// 달력 조각 캔버스는 글자가 또렷하도록 화면 해상도 그대로(최대 3배)
function sizeCanvases(){const vw=innerWidth,vh=innerHeight,dpr=Math.min(devicePixelRatio||1,2),fd=Math.min(dpr,1.5),pd=Math.min(devicePixelRatio||1,3);
  G.vw=vw;G.vh=vh;G.dpr=dpr;G.fdpr=fd;G.pdpr=pd;G.fx.width=vw*fd;G.fx.height=vh*fd;
  G.wallCv.width=G.freeCv.width=Math.round(vw*pd);G.wallCv.height=G.freeCv.height=Math.round(vh*pd);G.wallAll=true;
  const old=G.decal.width?G.decal:null;let snap=null;
  if(old&&old.width>0){snap=document.createElement("canvas");snap.width=old.width;snap.height=old.height;snap.getContext("2d").drawImage(old,0,0);}
  G.decal.width=vw*dpr;G.decal.height=vh*dpr;G.dctx=G.decal.getContext("2d");if(snap)G.dctx.drawImage(snap,0,0);
  G.dctx.setTransform(dpr,0,0,dpr,0,0);
  G.wcv.width=vw*fd;G.wcv.height=vh*fd;G.wctx=G.wcv.getContext("2d");wResize();
  G.emit={x:vw-18,y:G.top+28};
  if(G.walls){const {Body}=Matter,T=500;Body.setPosition(G.walls.floor,{x:vw/2,y:vh+T/2});Body.setPosition(G.walls.rw,{x:vw+T/2,y:vh/2});}}

// opt: stage(달력이 그려진 요소) · selector(조각이 될 요소) · top(도구 막대 아래 y) · onTap(톡 누른 칸) · onReset · hint
export function startSmash(opt){
  if(G)stopSmash();
  OPT=opt;
  if(!SPR)makeSprites();
  const {Engine,Bodies,Composite,Body,Events}=Matter;
  const vw=innerWidth,vh=innerHeight;
  const atoms=[];
  opt.stage.querySelectorAll(opt.selector).forEach(el=>{let r=el.getBoundingClientRect();
    if(!(r.width>0&&r.height>0&&r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw))return;
    let nowrap=false;
    if(isClear(getComputedStyle(el).backgroundColor)){const rg=document.createRange();rg.selectNodeContents(el);
      const rs=[...rg.getClientRects()].filter(q=>q.width>0);
      if(rs.length&&rs.every(q=>Math.abs(q.top-rs[0].top)<4)){const rr=rg.getBoundingClientRect();
        r={left:rr.left-3,top:Math.min(r.top,rr.top),width:rr.width+6,height:Math.max(r.height,rr.height)};nowrap=true;}}
    atoms.push({orig:el,r});});
  const fx=document.createElement("canvas");fx.id="gFx";
  const decal=document.createElement("canvas");decal.id="gDecal";
  const wallCv=document.createElement("canvas");wallCv.id="gWall";
  const freeCv=document.createElement("canvas");freeCv.id="gFree";
  document.body.append(decal,wallCv,freeCv,fx);
  const engine=Engine.create();engine.gravity.y=1.15;engine.positionIterations=8;engine.velocityIterations=6;
  G={engine,pieces:[],bombs:[],ps:[],tool:TOOL,ptr:{x:-99,y:-99,down:false,id:null,pend:null},time:0,acc:0,last:0,shake:0,flash:0,sx:0,sy:0,
     fx,fctx:fx.getContext("2d"),decal,dctx:null,drag:null,laserHit:false,
     wallCv,wallX:wallCv.getContext("2d"),freeCv,freeX:freeCv.getContext("2d"),wallAll:true,wallQ:new Set(),wallCl:[],freeAny:false,shT:"",
     fl:[],fb:[],dr:[],hm:[],bub:[],glows:[],splashQ:[],pg:new Map(),hash:new Map(),todo:[],sparkB:[[],[],[],[]],shB:new Map(),nSmoke:0,nSteam:0,nShard:0,zg:false,grav:false,hit:0,top:opt.top||0,calm:0,
     wetT:0,ctT:0,fireT:0,fireTot:0,absorbed:0,pourLv:0,uiT:0,wcv:document.createElement("canvas"),wctx:null,W:null,caus:null};
  sizeCanvases();
  try{G.caus=G.fctx.createPattern(SPR.caus,"repeat");}catch(e){G.caus=null;}
  const T=500;
  G.walls={floor:Bodies.rectangle(vw/2,vh+T/2,vw*4,T,{isStatic:true}),lw:Bodies.rectangle(-T/2,vh/2,T,vh*8,{isStatic:true}),
    rw:Bodies.rectangle(vw+T/2,vh/2,T,vh*8,{isStatic:true}),ceil:Bodies.rectangle(vw/2,-vh*2-T/2,vw*4,T,{isStatic:true})};
  Composite.add(engine.world,Object.values(G.walls));
  // 모든 칸은 제자리에 붙은 채로 시작 · 칸 크기를 화면 픽셀에 맞춰야 붙어 있는 동안 글자가 흐려지지 않음
  const pd=G.pdpr;
  atoms.forEach(({orig,r})=>{const L=Math.round(r.left*pd)/pd,T0=Math.round(r.top*pd)/pd;
    r={left:L,top:T0,width:Math.round((r.left+r.width)*pd)/pd-L,height:Math.round((r.top+r.height)*pd)/pd-T0};
    const cs=getComputedStyle(orig);
    const p=initPiece(rasterize(orig,r),r.width,r.height,orig,{alpha:parseFloat(cs.opacity)||1,rad:parseFloat(cs.borderTopLeftRadius)||0,soft:isClear(cs.backgroundColor),colors:solidColors(orig)});
    p.pin=true;buildBody(p,{cx:r.left+r.width/2,cy:r.top+r.height/2,c:1,s:0,th:0},null);G.pieces.push(p);});
  document.documentElement.classList.add("grav-on");
  drawPieces();
  Events.on(engine,"beforeUpdate",()=>{for(const b of Composite.allBodies(engine.world)){if(b.isStatic)continue;
    const v=b.velocity,s=Math.hypot(v.x,v.y);const vm=45*Math.max(1,PK());if(s>vm)Body.setVelocity(b,{x:v.x*vm/s,y:v.y*vm/s});
    if(Math.abs(b.angularVelocity)>.5)Body.setAngularVelocity(b,Math.sign(b.angularVelocity)*.5);}});
  Events.on(engine,"beforeUpdate",waterForces);
  // 떠 있는 칸에 빠르게 날아온 조각이 부딪히거나, 끌고 있는 조각으로 밀면 그 칸이 떨어져 나옴 (풀린 뒤엔 물리 계산이 알아서 밀어냄)
  Events.on(engine,"collisionStart",e=>{for(const pr of e.pairs){const a=pr.bodyA.parent,b=pr.bodyB.parent;
    const [st,mv]=a.isStatic&&!b.isStatic?[a,b]:b.isStatic&&!a.isStatic?[b,a]:[];if(!st)continue;
    const q=st.plugin.piece;if(!q||!q.pin)continue;
    if(Math.hypot(mv.velocity.x,mv.velocity.y)>KNOCK||(G.drag&&G.drag.b===mv))release(q);}});
  const inUI=e=>e.target&&e.target.closest&&e.target.closest("#chrome,#sheet,#gate");
  const down=e=>{if(inUI(e))return;const P=G.ptr;if(P.down)return;e.preventDefault();audio();
    P.x=e.clientX;P.y=e.clientY;P.sx=P.x;P.sy=P.y;P.down=true;P.id=e.pointerId;P.moved=false;P.tap=null;P.pend=null;
    // 붙어 있는 칸(이나 폭탄)은 끌기 시작할 때 떼어냄 → 톡 누르기만 하면 그대로 두고 일정을 염
    if(G.tool==="grab"){const b=pick(P.x,P.y);if(b){P.tap=b.plugin.piece||null;if(b.isStatic)P.pend=b;else grab(b,P.x,P.y);}}
    else if(G.tool==="laser")sLaser(true);
    else if(G.tool==="bomb")spawnBomb(P.x,P.y);
    else if(G.tool==="hammer")hammerSpawn(P.x,P.y);
    else{P.lx=P.x;P.ly=P.y;P.pvx=0;P.pvy=0;P.dacc=12;P.hold=G.tool==="water"?3:.08;}};
  const move=e=>{const P=G.ptr;if(P.down&&e.pointerId!==P.id)return;P.x=e.clientX;P.y=e.clientY;G.calm=0;
    if(P.down&&Math.hypot(P.x-P.sx,P.y-P.sy)>6)P.moved=true;
    if(P.pend&&P.moved){const b=P.pend;P.pend=null;if(b.plugin.piece)release(b.plugin.piece);else unstick(b);grab(b,P.sx,P.sy);}
    if(G.drag){G.drag.c.pointA.x=P.x;G.drag.c.pointA.y=P.y;}};
  const up=e=>{const P=G.ptr;if(!P.down||e.pointerId!==P.id)return;P.down=false;P.id=null;P.pend=null;dropDrag();sLaser(false);
    if(G.tool==="grab"&&!P.moved&&P.tap&&!P.tap.dead&&OPT.onTap)OPT.onTap(P.tap.orig);};
  const block=e=>{if(inUI(e))return;e.preventDefault();e.stopPropagation();};
  const KT={"1":"grab","2":"laser","3":"bomb","4":"hammer","5":"fire","6":"water"};
  const key=e=>{if(KT[e.key])setTool(KT[e.key]);else if(e.key==="g"||e.key==="G")toggleGrav();else if(e.key==="Escape"&&OPT.onReset)OPT.onReset();};
  const ctx=e=>{if(!inUI(e))e.preventDefault();};
  addEventListener("pointerdown",down,{capture:true,passive:false});addEventListener("pointermove",move);addEventListener("pointerup",up);addEventListener("pointercancel",up);
  addEventListener("click",block,true);addEventListener("keydown",key);addEventListener("contextmenu",ctx);
  G.off=()=>{removeEventListener("pointerdown",down,{capture:true});removeEventListener("pointermove",move);removeEventListener("pointerup",up);removeEventListener("pointercancel",up);
    removeEventListener("click",block,true);removeEventListener("keydown",key);removeEventListener("contextmenu",ctx);};
  setTool(TOOL,!opt.hint);gravBtn();
  G.raf=requestAnimationFrame(loop);}
// fade: 불·연기·그을음 캔버스를 바로 지우지 않고 서서히 사라지게 (짓누르기로 넘어갈 때)
export function stopSmash(fade){
  if(!G)return;cancelAnimationFrame(G.raf);sStopAll();G.off();
  Matter.Composite.clear(G.engine.world,false);Matter.Engine.clear(G.engine);
  G.wallCv.remove();G.freeCv.remove();
  for(const el of [G.fx,G.decal]){if(!fade){el.remove();continue;}el.style.transition="opacity .5s";el.style.opacity="0";setTimeout(()=>el.remove(),600);}
  document.documentElement.classList.remove("grav-on");delete document.documentElement.dataset.gtool;
  document.getElementById("gDrain").hidden=true;
  G=null;gravBtn();}
// 파괴력 바
const powToT=v=>Math.log(v/.25)/Math.log(16),tToPow=t=>.25*Math.pow(16,clamp(t,0,1));
function setPow(v,quiet){POW=clamp(v>=1?Math.round(v*10)/10:Math.round(v*20)/20,.25,4);if(Math.abs(POW-1)<.06)POW=1;
  try{localStorage.setItem("smash-pow",POW)}catch(e){}
  const t=powToT(POW),tr=document.getElementById("gPow");
  tr.querySelector(".gfill").style.width=(t*100)+"%";tr.querySelector(".gthumb").style.left=(t*100)+"%";
  tr.setAttribute("aria-valuenow",POW);tr.setAttribute("aria-valuetext",POW.toFixed(2)+"배");
  document.getElementById("gPowV").textContent=(POW<1?POW.toFixed(2).replace(/0$/,""):POW.toFixed(1))+"×";
  if(!quiet&&TOOL==="bomb")showHint(hintFor(TOOL));}
function hintFor(t){if(t==="bomb"){const one=.62*POW*.93>=1;return one?"누른 곳에 폭탄 · 이 파괴력이면 한 방에 뚫려요":POW<.55?"누른 곳에 폭탄 · 약해서 여러 번 맞아야 뚫려요":"누른 곳에 폭탄 · 한 번은 그을리고, 두 번 맞으면 뚫려요";}
  return (G&&G.zg?"무중력 · ":"")+TOOL_HINT[t];}
(()=>{const tr=document.getElementById("gPow");let on=false;
  const at=e=>{const r=tr.getBoundingClientRect();setPow(tToPow((e.clientX-r.left)/r.width));};
  tr.addEventListener("pointerdown",e=>{on=true;tr.setPointerCapture(e.pointerId);at(e);e.preventDefault();});
  tr.addEventListener("pointermove",e=>{if(on)at(e);});
  tr.addEventListener("pointerup",()=>on=false);tr.addEventListener("pointercancel",()=>on=false);
  tr.addEventListener("keydown",e=>{const t=powToT(POW);if(e.key==="ArrowRight"||e.key==="ArrowUp"){setPow(tToPow(t+.05));e.preventDefault();e.stopPropagation();}
    else if(e.key==="ArrowLeft"||e.key==="ArrowDown"){setPow(tToPow(t-.05));e.preventDefault();e.stopPropagation();}});
  tr.addEventListener("dblclick",()=>setPow(1));
  setPow(POW,true);})();
if(import.meta.env.DEV)window.__smash=()=>G;   // 개발 중 성능 측정용
// ── 손으로 짓누르기: 지금 화면의 조각(그림·위치·각도)을 3D 장면에 넘기고 2D 부수기는 멈춤 ──
let crushing=false;
async function beginCrush(){if(!G||crushing)return;crushing=true;audio();
  // 3D를 준비하는 동안 2D는 그 자리에 멈춰 둠 (조각 위치가 3D 첫 화면과 똑같도록) · 도구 막대는 바로 사라짐
  cancelAnimationFrame(G.raf);G.paused=true;sStopAll();document.documentElement.classList.add("crush-on");
  const pieces=G.pieces.filter(p=>!p.dead).map(p=>({tex:p.tex,W:p.W,H:p.H,cx:p.f.cx,cy:p.f.cy,th:p.f.th,alpha:p.alpha,colors:p.colors}));
  const onReset=OPT&&OPT.onReset;
  try{const {startCrush}=await import("./crush.js");
    await startCrush({pieces,sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onDone:()=>{crushing=false;onReset&&onReset();}});
    stopSmash(true);   // 3D가 첫 화면을 그린 뒤에 2D를 지워서 끊김이 없게
  }catch(e){console.error(e);crushing=false;document.documentElement.classList.remove("crush-on");if(G){G.paused=false;G.raf=requestAnimationFrame(loop);}}}
document.getElementById("gCrushBtn").onclick=beginCrush;
document.getElementById("gReset").onclick=()=>{if(OPT&&OPT.onReset)OPT.onReset();};
document.getElementById("gSound").onclick=()=>setMute(!AU.muted);
document.getElementById("gZero").onclick=toggleGrav;
document.getElementById("gDrain").onclick=()=>{if(G&&!G.W.drain&&(G.W.vol>1||G.dr.length)){audio();G.W.drain=1;G.W.dv=40;}};
document.querySelectorAll(".gbar [data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
