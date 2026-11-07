// ── 부수기: 중력 + 잡기 · 레이저 · 폭탄 · 망치 · 불 · 물 (학원 시간표 아티팩트에서 가져옴) ──
// 각 조각은 격자(칸)마다 손상도 d(0~1+)와 열 h를 가짐.
// 레이저·폭탄 모두 같은 d에 더해지고, d가 1을 넘은 칸은 사라짐 → 남은 칸들로 물리 몸체를 다시 만들고, 끊어지면 여러 조각으로 쪼갬.
// 앱에서는 처음부터 이 상태로 시작: 모든 칸은 벽에 붙어(pin, static) 있다가 맞거나 끌면 떨어져 나옴.
// 떨어진 조각은 벽 앞으로 떨어지므로 붙어 있는 칸과는 부딪히지 않음.
import Matter from "matter-js";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { MATS, mat, setMat, isDark, PHYS, str, burns, grainOf, fillCell, fillChip, keepBorder, textPass, matColors, matPal, swatch, warmTex } from "./material.js";
import { outline, inPoly, bootSprite, shadowSprites, printSprite, makeCracks } from "./stomp.js";
if(!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){this.rect(x,y,w,h);};
let G=null,OPT=null,TOOL="grab";
// 진동: 1 가볍게 · 2 보통 · 3 세게, 배열이면 [세기, 쉬는 ms, 세기, …]
const buzz=s=>{if(Array.isArray(s)){let t=0;s.forEach((v,i)=>{if(i%2)t+=v;else setTimeout(()=>buzz(v),t);});return;}
  try{Haptics.impact({style:s===3?ImpactStyle.Heavy:s===2?ImpactStyle.Medium:ImpactStyle.Light}).catch(()=>{});}catch(e){}};
// 파괴력 배율: 0.25× ~ 4× (로그 눈금), 기본 1×
let POW=1;try{const v=parseFloat(localStorage.getItem("smash-pow"));if(v>=.25&&v<=4)POW=v;}catch(e){}
const PK=()=>Math.sqrt(POW);
const TOOL_HINT={
  grab:"끌어서 떼어내 던져보세요 · 날짜를 톡 누르면 일정이 열려요",
  laser:"누르고 있으면 지져져요 · 천천히 끌면 잘려요",
  bomb:"누른 곳에 폭탄 · 한 번은 그을리고, 두 번 맞으면 뚫려요",
  hammer:"톡 누른 곳을 망치로 쾅 · 파괴력이 클수록 잘게 쪼개져요",
  fire:"문지른 곳에 불이 붙어요 · 옆으로 번지고, 물을 부으면 꺼져요",
  water:"문지른 곳에 물이 쏟아져요 · 계속 부으면 화면이 차올라요",
  gun:"누르고 있으면 연사 · 끌면서 쓸어 보세요",
  bazooka:"톡 누른 곳으로 로켓 발사 · 다시 끼우는 데 1초쯤 걸려요"
};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd=(a,b)=>a+Math.random()*(b-a);
const BOPT={friction:.45,frictionStatic:.7,restitution:.16,frictionAir:.008,density:.0012,slop:.03};
const bopt=()=>Object.assign({},BOPT,PHYS[mat()]);
// 충돌 분류: 떠 있는 칸(PIN)도 떨어진 조각(FREE)과 부딪힘 → 세게 부딪히면 떨어져 나옴 (startSmash의 collisionStart)
const CAT_WALL=1,CAT_PIN=2,CAT_FREE=4,KNOCK=5;   // KNOCK: 떠 있는 칸을 떼어낼 만큼의 속도 (px/스텝)
function setCat(b,cat){for(const pt of b.parts){pt.collisionFilter.category=cat;pt.collisionFilter.mask=CAT_WALL|CAT_PIN|CAT_FREE;}}
// 유리로 벽 칸에 붙어 고정된 조각(anc)도 같은 식으로 풀림
function release(p){if(!p||p.dead)return;
  if(p.anc){p.anc=false;Matter.Body.setStatic(p.body,false);setCat(p.body,CAT_FREE);if(G){G.calm=0;G.grpDirty=true;relPartners(p);}return;}
  if(!p.pin)return;p.pin=false;
  Matter.Body.setStatic(p.body,false);setCat(p.body,CAT_FREE);if(G){G.calm=0;unwall(p);
    // 녹은 유리로 붙은 조각은 같이 떨어짐
    if(p.fg){G.grpDirty=true;relPartners(p);}}}
function relPartners(p){for(const L of G.fz)if(L.on&&!L.dead&&(L.a===p||L.b===p))release(L.a===p?L.b:L.a);}
// 정지 몸체(벽에 붙은 칸 · 유리로 고정된 조각)에는 속도를 주지 않음
for(const k of ["setVelocity","setAngularVelocity"]){const f=Matter.Body[k];Matter.Body[k]=(b,v)=>{if(!b.isStatic)f(b,v);};}
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
  rsm:sprite([[0,"rgba(222,220,215,.66)"],[.5,"rgba(208,205,200,.34)"],[1,"rgba(200,198,194,0)"]]),
  case:caseSprite(),
  glint:sprite([[0,"rgba(255,255,255,1)"],[.18,"rgba(235,248,255,.9)"],[.45,"rgba(170,215,255,.28)"],[1,"rgba(150,200,255,0)"]]),
  caus:causticTile()};
  // 캔버스 대신 ImageBitmap으로 그리면 drawImage 때마다 스냅샷을 뜨지 않아 빠름 (준비되면 바꿔 끼움)
  if(window.createImageBitmap)for(const k in SPR)if(k!=="caus")createImageBitmap(SPR[k]).then(b=>{SPR[k]=b;},()=>{});}
// 탄피: 놋쇠 원통 (옆에서 본 모양) · 뒤쪽 테두리
function caseSprite(){const c=document.createElement("canvas");c.width=32;c.height=14;const x=c.getContext("2d");
  const g=x.createLinearGradient(0,0,0,14);g.addColorStop(0,"#fff3c4");g.addColorStop(.3,"#e2b34c");g.addColorStop(.7,"#a8781e");g.addColorStop(1,"#5c3f0c");
  x.fillStyle=g;x.beginPath();x.roundRect(4,1,27,12,[1,5,5,1]);x.fill();x.fillStyle="#6a4a12";x.fillRect(1,0,4.5,14);x.fillStyle="#3a2808";x.fillRect(5.5,1,1.5,12);
  x.fillStyle="rgba(255,255,255,.6)";x.fillRect(8,3,20,1.6);return c;}
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
// 칸 바탕·일정 칩·글자는 고른 재질(material.js)대로
function drawBox(x,el,dep=0,inChip=false){const cs=getComputedStyle(el);if(cs.display==="none")return;
  const b=el.getBoundingClientRect(),rad=parseFloat(cs.borderTopLeftRadius)||0,bw=parseFloat(cs.borderTopWidth)||0,chip=el.classList.contains("chip");
  x.save();
  if(!isClear(cs.backgroundColor)){if(chip)fillChip(x,b,rad,cs.backgroundColor,G.pdpr);else if(!dep)fillCell(x,b,rad,cs.backgroundColor,G.pdpr);
    else{x.fillStyle=cs.backgroundColor;x.beginPath();x.roundRect(b.left,b.top,b.width,b.height,rad);x.fill();}}
  if(bw>0&&cs.borderTopStyle!=="none"&&!isClear(cs.borderTopColor)&&keepBorder(bw)){x.strokeStyle=cs.borderTopColor;x.lineWidth=bw;x.beginPath();
    x.roundRect(b.left+bw/2,b.top+bw/2,b.width-bw,b.height-bw,Math.max(0,rad-bw/2));x.stroke();}
  if(cs.overflow!=="visible"){x.beginPath();x.roundRect(b.left,b.top,b.width,b.height,rad);x.clip();}
  for(const n of el.childNodes){if(n.nodeType===1)drawBox(x,n,dep+1,inChip||chip);else if(n.nodeType===3&&n.textContent.trim())drawText(x,n,cs,b,inChip||chip);}
  x.restore();}
function drawText(x,n,cs,b,inChip){const t=n.textContent,rg=document.createRange(),lines=[];let cur=null;
  // 글자마다 위치를 재서 줄을 나눔
  for(let i=0;i<t.length;){const len=t.codePointAt(i)>0xffff?2:1;rg.setStart(n,i);rg.setEnd(n,i+len);const q=rg.getClientRects()[0];
    if(q){if(!cur||Math.abs(q.top-cur.top)>q.height*.5){cur={s:"",left:q.left,top:q.top,right:q.right};lines.push(cur);}cur.s+=t.slice(i,i+len);cur.right=q.right;}
    i+=len;}
  x.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;x.textBaseline="alphabetic";
  if("letterSpacing" in x)x.letterSpacing=cs.letterSpacing==="normal"?"0px":cs.letterSpacing;
  const out=[];
  for(const L of lines){let s=L.s.replace(/\s+$/,"");
    if(cs.textOverflow==="ellipsis"&&L.right>b.right+.5){const room=b.right-L.left-parseFloat(cs.paddingRight||0);
      while(s&&x.measureText(s+"…").width>room)s=s.slice(0,-1);s+="…";}
    const m=x.measureText(s),asc=m.fontBoundingBoxAscent??m.actualBoundingBoxAscent??parseFloat(cs.fontSize)*.8;
    out.push([s,L.left,L.top+asc]);}
  textPass(x,cs.color,inChip,G.pdpr,(dx,dy)=>{for(const [s,l,y] of out)x.fillText(s,l+dx,y+dy);});}
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
  x.save();if(p.rad){x.beginPath();x.roundRect(0,0,w,h,p.rad*G.pdpr);x.clip();}x.drawImage(p.ovc,0,0,w,h);if(p.mk)x.drawImage(p.mk,0,0);x.restore();
  if(p.masked){x.globalCompositeOperation="destination-in";x.drawImage(p.mc,0,0,w,h);x.globalCompositeOperation="source-over";}
  if(p.ho){x.globalCompositeOperation="destination-out";x.drawImage(p.ho,0,0);x.globalCompositeOperation="source-over";}
  p.tex=p.cv;if(p.pin)G.wallQ.add(p);}
// 조각 위에 덧그리는 자국(mk: 총알 자국 · 발자국 · 금)과 칸보다 작은 구멍(ho). 칸 그림과 같은 크기 · 조각의 칸 좌표(CSS px)로 그림
// 쪼개진 조각끼리는 같은 캔버스를 같이 씀 (서로의 칸은 가려져 있으므로)
function layer(p,k){if(!p[k]){const c=document.createElement("canvas");c.width=p.base.width;c.height=p.base.height;p[k]=c;p[k+"x"]=cpu2d(c);}
  const x=p[k+"x"];x.setTransform(G.pdpr,0,0,G.pdpr,0,0);return x;}
const mkCtx=p=>layer(p,"mk"),hoCtx=p=>layer(p,"ho");
function jagPath(x,cx,cy,R,n,j){x.beginPath();for(let i=0;i<n;i++){const a=i/n*6.283,r=R*rnd(1-j,1+j),px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();}
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
  const {Bodies,Body,Composite}=Matter;const R=rectsOf(q);if(!R.length)return false;q.R0=R;
  const {c,s,cx,cy,th}=f;
  const parts=R.map(r=>{const lx=r.x+r.w/2-q.W/2,ly=r.y+r.h/2-q.H/2;
    return Bodies.rectangle(cx+c*lx-s*ly,cy+s*lx+c*ly,r.w,r.h,Object.assign({angle:th},bopt()));});
  const b=parts.length===1?parts[0]:Body.create(Object.assign({parts},bopt()));
  q.ao=th-b.angle;const dx=b.position.x-cx,dy=b.position.y-cy;q.o={x:c*dx+s*dy,y:-s*dx+c*dy};
  if(ob){const w=ob.angularVelocity,rx=b.position.x-ob.position.x,ry=b.position.y-ob.position.y;
    Body.setVelocity(b,{x:ob.velocity.x-w*ry,y:ob.velocity.y+w*rx});Body.setAngularVelocity(b,w);}
  if(q.pin){Body.setStatic(b,true);setCat(b,CAT_PIN);}else setCat(b,CAT_FREE);
  Composite.add(G.engine.world,b);q.body=b;b.plugin.piece=q;q.f=frame(q);return true;}
// 붙어 있는 칸은 벽 캔버스(바뀔 때만 다시 그림), 떨어진 조각은 앞쪽 캔버스(움직이는 동안 매 프레임)
// 막 쪼개져 아직 새 모양을 칠하지 못한 조각은 자기 칸 안만 보이게 (쪼개지기 전 그림이 통째로 번쩍 보이지 않게)
function clipCells(c,p,ox,oy,s){c.save();c.beginPath();for(const r of p.R0)c.rect(ox+r.x*s,oy+r.y*s,r.w*s,r.h*s);c.clip();}
function drawPiece(c,p){const f=p.f,d=G.pdpr;c.globalAlpha=p.alpha;
  if(p.pin){const x=Math.round((f.cx-p.W/2)*d),y=Math.round((f.cy-p.H/2)*d);   // 픽셀에 딱 맞춰 글자가 또렷하게
    p.wr={x,y,w:p.tex.width,h:p.tex.height};c.setTransform(1,0,0,1,0,0);c.clearRect(x,y,p.wr.w,p.wr.h);
    if(p.clip){clipCells(c,p,x,y,d);c.drawImage(p.tex,x,y);c.restore();}else c.drawImage(p.tex,x,y);}
  else{c.setTransform(f.c*d,f.s*d,-f.s*d,f.c*d,f.cx*d,f.cy*d);
    if(p.clip){clipCells(c,p,-p.W/2,-p.H/2,1);c.drawImage(p.tex,-p.W/2,-p.H/2,p.W,p.H);c.restore();}else c.drawImage(p.tex,-p.W/2,-p.H/2,p.W,p.H);}}
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
// 재질 강도만큼 덜 부서짐 (돌은 같은 힘에 1/4쯤)
function hurt(p,lx,ly,R,fn,heatK,onBreak){
  const {cs,cols,rows,d,h}=p,S=str();
  const x0=Math.max(0,Math.floor((lx-R)/cs)),x1=Math.min(cols-1,Math.floor((lx+R)/cs));
  const y0=Math.max(0,Math.floor((ly-R)/cs)),y1=Math.min(rows-1,Math.floor((ly+R)/cs));
  let hit=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*cols+x;if(d[i]>=1)continue;
    const cx=(x+.5)*cs,cy=(y+.5)*cs,dist=Math.hypot(cx-lx,cy-ly);if(dist>R)continue;
    const dd=fn(dist,cx,cy)/S;if(dd<=0)continue;hit+=dd;const was=d[i];
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
  const soft=p.soft?.5:1,wt=p.wet?p.wt:null,cl=p.hasCl?p.cl:null,dk=isDark();
  let D=d;if(p.ml&&cl){D=p.dsm&&p.dsm.length===d.length?p.dsm:(p.dsm=new Float32Array(d.length));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;let near=false,s=0,n=0;
      for(let oy=-1;oy<=1;oy++){const yy=y+oy;if(yy<0||yy>=rows)continue;for(let ox=-1;ox<=1;ox++){const xx=x+ox;if(xx<0||xx>=cols)continue;const j=yy*cols+xx;if(cl[j]===2)near=true;s+=Math.min(d[j],1.3);n++;}}
      D[i]=near?s/n:d[i];}}
  const RE=dk?[8,22,26]:[40,88,96];
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
      if(D[a]===0&&D[b]===0&&D[c]===0&&D[e]===0&&h[a]===0&&h[b]===0&&h[c]===0&&h[e]===0&&(!wt||(wt[a]===0&&wt[b]===0&&wt[c]===0&&wt[e]===0))){const z=(y*ow+x)*4;data[z+3]=0;if(md)md[z+3]=255;continue;}
      const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
      const d0=Math.min(D[a],1.3),d1=Math.min(D[b],1.3),d2=Math.min(D[c],1.3),d3=Math.min(D[e],1.3);
      const bd=d0*w00+d1*w10+d2*w01+d3*w11;
      const k=y*ow+x,k4=k*4;
      let dv=bd,cv=bd,jit=0,ce=0,cm=0;
      if(cl){ce=(cl[a]?w00:0)+(cl[b]?w10:0)+(cl[c]?w01:0)+(cl[e]?w11:0);if(ce>0)cm=(cl[a]===2?w00:0)+(cl[b]===2?w10:0)+(cl[c]===2?w01:0)+(cl[e]===2?w11:0);}
      if(bd>0){const bn=nz[a]*w00+nz[b]*w10+nz[c]*w01+nz[e]*w11;jit=((pn[k]-.5)*.07+(bn-.5)*.26)*(1-cm);dv=bd+jit*Math.min(1,bd*4);}
      // 망치로 깨진 칸은 그을음 없이 깨끗한 단면 (가장자리만 살짝 어둡게)
      if(ce>0)cv=(cl[a]?0:Math.min(d[a],1.3))*w00+(cl[b]?0:Math.min(d[b],1.3))*w10+(cl[c]?0:Math.min(d[c],1.3))*w01+(cl[e]?0:Math.min(d[e],1.3))*w11;
      else if(D!==d)cv=Math.min(d[a],1.3)*w00+Math.min(d[b],1.3)*w10+Math.min(d[c],1.3)*w01+Math.min(d[e],1.3)*w11;
      if(ce>0||D!==d)cv=cv>0?cv+jit*Math.min(1,cv*4):0;else cv=dv;
      const hv=h[a]*w00+h[b]*w10+h[c]*w01+h[e]*w11;
      let al=0,r=0,g=0,bl=0;
      if(cv>.03){const t=clamp((cv-.03)/.7,0,1);al=t*t*(3-2*t)*.97*soft;const u=clamp((cv-.12)/.6,0,1);r=128-110*u;g=82-70*u;bl=38-29*u;}
      // 녹아 오그라든 테: 구멍 쪽으로 갈수록 짙고, 빛(왼쪽 위)을 받는 쪽 비탈에 하이라이트
      if(cm>0&&dv>.3&&dv<1){const t=clamp((dv-.3)/.5,0,1),gx=(d1-d0)*(1-fy)+(d3-d2)*fy,gy=(d2-d0)*(1-fx)+(d3-d1)*fx,gl=Math.hypot(gx,gy)||1,
          lit=Math.max(0,-(gx+gy)/(gl*1.414)),ea=(.3+.16*t)*t*cm,A=ea+al*(1-ea);
        r=(RE[0]*ea+r*al*(1-ea))/A;g=(RE[1]*ea+g*al*(1-ea))/A;bl=(RE[2]*ea+bl*al*(1-ea))/A;al=A;
        const hb=lit*Math.sin(t*Math.PI)*(dk?.3:.75)*cm;if(hb>.02){const A2=hb+al*(1-hb);r=(255*hb+r*al*(1-hb))/A2;g=(255*hb+g*al*(1-hb))/A2;bl=(255*hb+bl*al*(1-hb))/A2;al=A2;}}
      if(ce>cm&&dv<1){const ea=.34*clamp(dv*2.4,0,1)*(ce-cm)*soft,A=ea+al*(1-ea);if(A>0){r=(62*ea+r*al*(1-ea))/A;g=(57*ea+g*al*(1-ea))/A;bl=(52*ea+bl*al*(1-ea))/A;al=A;}}
      if(hv>.01){const em=clamp(hv*1.5,0,1),er=255,eg=70+185*Math.pow(hv,1.3),eb=20+200*hv*hv*hv,A=em+al*(1-em);
        if(A>0){r=(er*em+r*al*(1-em))/A;g=(eg*em+g*al*(1-em))/A;bl=(eb*em+bl*al*(1-em))/A;}al=A;}
      // 젖은 자리: 가장자리가 들쭉날쭉 번지고, 물이 멈춘 테두리(물 자국)가 조금 더 진함 · 마르면서 안쪽으로 줄어듦
      if(wt){const wv=wt[a]*w00+wt[b]*w10+wt[c]*w01+wt[e]*w11;
        if(wv>.01){const wq=wv+((nz[a]*w00+nz[b]*w10+nz[c]*w01+nz[e]*w11-.5)*.55+(pn[k]-.5)*.1)*Math.min(1,wv*2.5),
            body=clamp((wq-.3)/.28,0,1),rim=clamp((wq-.2)/.14,0,1)*(1-clamp((wq-.36)/.22,0,1)),wa=(.12*body*body*(3-2*body)+.12*rim)*soft;
          if(wa>.003){const A=wa+al*(1-wa);r=(30*wa+r*al*(1-wa))/A;g=(44*wa+g*al*(1-wa))/A;bl=(64*wa+bl*al*(1-wa))/A;al=A;}}}
      data[k4]=r;data[k4+1]=g;data[k4+2]=bl;data[k4+3]=al*255;
      if(md){md[k4+3]=clamp((1-dv)*7,0,1)*255;}
    }}
  p.octx.putImageData(p.img,0,0);
  if(md){if(!p.mc){p.mc=document.createElement("canvas");p.mc.width=ow;p.mc.height=oh;p.mcx=p.mc.getContext("2d",{willReadFrequently:true});}
    p.mcx.putImageData(p.mimg,0,0);p.needMask=false;p.maskT=G.time;p.masked=true;p.clip=false;}
  compose(p);
  p.dirty=false;}

// 끊어진 부분을 찾아 조각을 나누고, 남은 모양대로 몸체를 다시 만들기
function restructure(p){
  if(p.body&&p.body.plugin.grp)unshare(p.body);
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
  // 새 조각은 쪼개지기 전 그림(구멍·그을음 포함)을 자기 칸만큼 잘라 보여 주다가, 차례가 와서 새로 칠하면 바뀜
  let snap=null;if(keep.length>1){snap=document.createElement("canvas");snap.width=p.tex.width;snap.height=p.tex.height;snap.getContext("2d").drawImage(p.tex,0,0);}
  keep.forEach((cells,k)=>{
    let q=p;
    // 쪼개진 조각은 같은 칸 그림(base)을 같이 쓰고 그을음·구멍만 따로 가짐
    if(k>0){q={base:p.base,W:p.W,H:p.H,orig:p.orig,alpha:p.alpha,rad:p.rad,soft:p.soft,colors:p.colors,gr:p.gr,mk:p.mk,mkx:p.mkx,ho:p.ho,hox:p.hox,dead:false,cs,cols,rows,nz:p.nz,n0:p.n0};
      q.h=bh.slice();q.fu=p.fu.slice();q.bn=p.bn.slice();q.wt=p.wt.slice();q.cl=p.cl.slice();q.hasCl=p.hasCl;q.ml=p.ml;q.burning=p.burning;q.wet=p.wet;
      if(p.tg){q.tg=p.tg.slice();q.mf=p.mf.slice();q.tx=p.tx&&p.tx.slice();q.gh=p.gh;q.gm=p.gm;}
      setupTex(q);G.pieces.push(q);}
    q.pin=k===0&&stay;
    q.d=d0.slice();
    if(keep.length>1){const mark=new Uint8Array(N);cells.forEach(j=>mark[j]=1);for(let j=0;j<N;j++)if(!mark[j]&&q.d[j]<1)q.d[j]=99;}
    q.needMask=true;q.dirty=true;q.hot=true;q.clip=true;if(snap)q.tex=snap;made.push(q);});
  if(G.ptr.pend===ob)G.ptr.pend=null;
  Matter.Composite.remove(G.engine.world,ob);
  made.forEach(q=>{q.f=f;q.anc=false;if(!buildBody(q,f,ob))killPiece(q,true);});
  if(G.fz.length||G.md.length)reglass(p,made);
  if(p.fg)G.grpDirty=true;
  const w=held||pend;
  if(w){const live=made.filter(q=>!q.dead),t=live.find(q=>{const L=toLocal(q,w.x,w.y),cx=Math.floor(L.x/q.cs),cy=Math.floor(L.y/q.cs);
      return cx>=0&&cy>=0&&cx<q.cols&&cy<q.rows&&q.d[cy*q.cols+cx]<1;})||live[0];
    if(t){if(held)grab(t.body,w.x,w.y);else G.ptr.pend=t.body;}}}
function killPiece(p,silent){if(p.dead)return;p.dead=true;if(p.pin)unwall(p);
  if(p.body&&p.body.plugin.grp)unshare(p.body);
  if(p.fg||G.md.length||G.ice.length)unglass(p);
  if(G.drag&&G.drag.b===p.body)dropDrag();
  if(G.ptr.pend===p.body)G.ptr.pend=null;
  if(p.body)Matter.Composite.remove(G.engine.world,p.body);
  if(!silent&&p.f){const {cols,cs,d}=p;for(let j=0;j<d.length;j++)if(d[j]<1){const w=toWorld(p,(j%cols+.5)*cs,((j/cols|0)+.5)*cs);crumb(w.x,w.y,p,p.body.velocity);}}}

// ── 파티클 ──
function addP(o){if(G.ps.length>2600)G.ps.splice(0,300);G.ps.push(o);}
function pickCol(p,charChance){return Math.random()<charChance?(Math.random()<.5?"#1c130d":"#3a2416"):p.colors[(Math.random()*p.colors.length)|0];}
// 파편 모양: 0 종이 조각(사각) · 1 유리(뾰족한 삼각) · 2 나무 가시(가늘고 길게) · 3 돌 덩어리(오각)
const SH_OF={paper:0,glass:1,wood:2,stone:3};
function shard(x,y,vx,vy,col,sz){if(G.nShard>=SHARD_MAX)return;G.nShard++;const L=rnd(2.2,3.8),sh=SH_OF[mat()];
  let w=sz*rnd(.5,1.1),h=sz*rnd(.35,.9);if(sh===2){w=sz*rnd(1.3,2.7);h=sz*rnd(.16,.32);}else if(sh===1){w=sz*rnd(.7,1.4);h=sz*rnd(.4,1);}
  addP({t:"shard",x,y,vx,vy,rot:rnd(0,6.3),vr:rnd(-14,14),w,h,col,life:L,max:L,sh,gl:rnd(0,6.3)});}
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
  }else sSizzle(0);}

// ── 폭탄 ──
function spawnBomb(x,y){if(G.bombs.length>=14)return;
  const b=Matter.Bodies.circle(x,y,11,{restitution:.35,friction:.4,frictionAir:.004,density:.004});
  // 벽에 붙은 칸 위에 놓으면 그 자리에 붙어서 터지고, 빈 곳이면 떨어짐
  const h=pieceAt(x,y);if(h&&h.p.pin){Matter.Body.setStatic(b,true);setCat(b,CAT_PIN);}
  else{setCat(b,CAT_FREE);Matter.Body.setAngularVelocity(b,rnd(-.08,.08));}
  Matter.Composite.add(G.engine.world,b);
  G.bombs.push({b,t:G.time+1.15,fuse:1.15});}
function explode(x,y,mul=1){
  const {Body}=Matter;const k=PK()*mul,R0=24*k,R1=80*k,f0=rnd(0,6.3),S=str();let any=false,brk=0;
  for(const p of G.pieces.slice()){if(p.dead)continue;const bb=p.body.bounds;
    if(x<bb.min.x-R1||x>bb.max.x+R1||y<bb.min.y-R1||y>bb.max.y+R1)continue;
    const L=toLocal(p,x,y),lc=p.cs;
    if(hurt(p,L.x,L.y,R1+p.cs,(dist,cx,cy)=>{let f=dist<R0?1:Math.pow(Math.max(0,1-(dist-R0)/(R1-R0)),1.5);if(dist>=R0){const a=Math.atan2(cy-L.y,cx-L.x)+f0;f*=.55+.45*(Math.sin(a*7)*.5+Math.sin(a*13+1.7)*.3+Math.sin(a*3+.6)*.2+.5)*1.25;}return Math.min(f,1)*.62*POW*rnd(.93,1.07);},1.5,(wx,wy,q)=>{
      brk++;const dx=wx-x,dy=wy-y,dd=Math.hypot(dx,dy)||1,s=rnd(220,780)*Math.max(.35,1-dd/R1);
      shard(wx,wy,dx/dd*s+rnd(-60,60),dy/dd*s-rnd(80,260),pickCol(q,.45),q.cs*rnd(.7,1.3));
      if(Math.random()<.4)shard(wx,wy,dx/dd*s*.6,dy/dd*s*.6-120,pickCol(q,.6),q.cs*rnd(.4,.8));
      if(mat()==="stone"&&Math.random()<.12)dustP(wx,wy,1,.8);})>0){
      // 단단한 재질은 칸이 깨지거나 여러 번 맞아야 벽에서 떨어짐
      if(S<=1.2||brk||(p.bst=(p.bst||0)+1)>=Math.ceil(S))release(p);any=true;}brk=0;}
  if(any&&mat()!=="paper")sMatHit(clamp(.45+.3*k,.4,1.1),clamp(.5+.3*k,.5,1));
  // 폭풍: 맞지 않았어도 가까이 떠 있던 칸은 떨어져 나가 함께 날아감
  for(const p of G.pieces){if(p.dead||!p.pin)continue;const b=p.body;if(1/(1+(Math.hypot(b.position.x-x,b.position.y-y)/(85*k))**2)>Math.min(.97,.3*Math.max(1,S)))release(p);}
  const bodies=[...new Set(G.pieces.filter(p=>!p.dead).map(p=>p.body))].concat(G.bombs.map(B=>B.b)).filter(b=>!b.isStatic);
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
  drawStompShadow(c);
  for(const q of G.ps){if(q.t!=="smoke")continue;const k=q.life/q.max;
    c.globalAlpha=q.a*Math.min(1,k*1.6)*Math.min(1,(1-k)*5+.25);c.drawImage(SPR.smoke,q.x-q.r,q.y-q.r,q.r*2,q.r*2);}
  drawRSmoke(c);
  // 파편: 색·투명도가 같은 것끼리 한 경로로 묶어 한 번에 칠함 (파편이 수백 개여도 칠하기는 십여 번)
  const SH=G.shB;SH.clear();
  for(const q of G.ps){if(q.t!=="shard")continue;const k=q.col+"|"+(q.life<.5?Math.max(1,Math.ceil(q.life*8)):4);
    let L=SH.get(k);if(!L)SH.set(k,L=[]);L.push(q);}
  const glass=mat()==="glass";
  for(const [k,L] of SH){const i=k.lastIndexOf("|");c.fillStyle=k.slice(0,i);c.globalAlpha=+k.slice(i+1)/4*(glass?.78:1);c.beginPath();
    for(const q of L){const cr=Math.cos(q.rot),sr=Math.sin(q.rot),ax=cr*q.w/2,ay=sr*q.w/2,bx=-sr*q.h/2,by=cr*q.h/2;
      if(q.sh===1){c.moveTo(q.x-ax-bx,q.y-ay-by);c.lineTo(q.x+ax-bx*.2,q.y+ay-by*.2);c.lineTo(q.x-ax*.2+bx,q.y-ay*.2+by);}
      else if(q.sh===2){c.moveTo(q.x-ax,q.y-ay);c.lineTo(q.x-ax*.15-bx,q.y-ay*.15-by);c.lineTo(q.x+ax,q.y+ay);c.lineTo(q.x+ax*.2+bx,q.y+ay*.2+by);}
      else if(q.sh===3){c.moveTo(q.x-ax*.9-bx*.3,q.y-ay*.9-by*.3);c.lineTo(q.x-ax*.2-bx,q.y-ay*.2-by);c.lineTo(q.x+ax*.8-bx*.6,q.y+ay*.8-by*.6);c.lineTo(q.x+ax+bx*.4,q.y+ay+by*.4);c.lineTo(q.x-ax*.3+bx,q.y-ay*.3+by);}
      else{c.moveTo(q.x-ax-bx,q.y-ay-by);c.lineTo(q.x+ax-bx,q.y+ay-by);c.lineTo(q.x+ax+bx,q.y+ay+by);c.lineTo(q.x-ax+bx,q.y-ay+by);}
      c.closePath();}
    c.fill();
    // 유리 파편은 가장자리가 빛남
    if(glass){c.strokeStyle=isDark()?"rgba(210,240,250,.55)":"rgba(60,120,132,.6)";c.lineWidth=.7;c.stroke();}}
  c.globalAlpha=1;
  for(const B of G.bombs)drawBomb(c,B);
  if(G.tool==="laser"){const E=G.emit,P=G.ptr,ang=Math.atan2(P.y-E.y,P.x-E.x);
    c.save();c.translate(E.x,E.y);c.rotate(ang);c.fillStyle="#22262d";c.beginPath();c.roundRect(-22,-6,26,12,3);c.fill();
    c.fillStyle="#3b414b";c.fillRect(-18,-6,4,12);c.restore();}
  drawCas(c);
  drawMolten(c);
  drawWater(c);
  for(const q of G.ps){if(q.t==="dring"){const k=q.life/q.max,R=q.R*Math.sqrt(1-k)+20;c.strokeStyle=isDark()?"rgba(200,190,175,1)":"rgba(150,138,122,1)";
      c.globalAlpha=.16*k;c.lineWidth=46*k+8;c.beginPath();c.arc(q.x,q.y,R,0,6.283);c.stroke();c.globalAlpha=.22*k;c.lineWidth=12*k+3;c.stroke();continue;}
    if(q.t!=="steam"&&q.t!=="dust")continue;const k=q.life/q.max;
    c.globalAlpha=q.a*Math.min(1,k*1.5)*Math.min(1,(1-k)*6+.2);c.drawImage(q.t==="steam"?SPR.steam:SPR.dust,q.x-q.r,q.y-q.r,q.r*2,q.r*2);}
  c.globalAlpha=1;
  drawRockets(c);
  drawGun(c);
  drawBazooka(c);
  drawBoltsInk(c);
  c.globalCompositeOperation="lighter";
  // 불: 주변을 비추는 빛 → 불꽃 → 불덩이
  const gf=gfac(),st=gf>.3?1.7:1.05,sw=gf>.3?.78:1;
  for(const L of G.glows){const r=Math.min(150,34+Math.sqrt(L.n)*9);c.globalAlpha=Math.min(.26,.05+L.n*.003)*rnd(.85,1.1);c.drawImage(SPR.glow,L.x-r,L.y-r*.95,r*2,r*2);}
  drawMoltenGlow(c);
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
    else if(q.t==="ring"){const u=1-k;c.globalAlpha=.65*k;c.strokeStyle="rgb(255,240,220)";c.lineWidth=1+3*k;c.beginPath();c.arc(q.x,q.y,q.R*Math.sqrt(u),0,Math.PI*2);c.stroke();}
    else if(q.t==="glint"){const s=q.s*(.4+.6*k);c.globalAlpha=k;c.drawImage(q.red?SPR.red:q.w?SPR.glow:SPR.glint,q.x-s,q.y-s,s*2,s*2);}
    // 유리 파편이 돌면서 빛을 받아 반짝임
    else if(glass&&q.t==="shard"&&Math.sin(q.rot*2+q.gl)>.96){const s=q.w*1.6+3;c.globalAlpha=.8*Math.min(1,k*3);c.drawImage(SPR.glint,q.x-s,q.y-s,s*2,s*2);}}
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
  drawGunFx(c);
  drawBzFx(c);
  drawBoltsGlow(c);
  c.globalCompositeOperation="source-over";c.globalAlpha=1;
  for(const H of G.hm)drawHammer(c,H);
  drawStompFoot(c);
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
function sStopLoops(){["fireS","pourS","drainS","rk"].forEach(k=>{const L=AU[k];if(!L)return;try{L.s.stop()}catch(e){}if(L.o)try{L.o.stop()}catch(e){}AU[k]=null;});}
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
  if(kind==="piece"){if(mat()!=="paper"){sMatHit(k,1);return;}burst(c,t,"highpass",1700,.7,.5*k,.09);tone(c,t,"triangle",680,430,.2,.12);
    for(let i=0;i<7;i++)burst(c,t+rnd(.004,.15),"bandpass",rnd(1400,4800),2,rnd(.08,.26)*k,rnd(.015,.04));}
  else burst(c,t,"lowpass",900,.7,.45*k,.22);}
// 재질별로 깨지는 소리 (big: 0 살짝 ~ 1 크게 부서짐)
function sMatHit(k,big){const c=audio();if(!c)return;const t=c.currentTime,m=mat();
  if(m==="glass"){burst(c,t,"highpass",3200,.7,.5*k,.18+.25*big);burst(c,t,"bandpass",6500,1,.25*k,.1+.4*big);
    for(let i=0,n=8+Math.round(18*big);i<n;i++){const f=rnd(2400,8200);tone(c,t+Math.pow(Math.random(),1.8)*(.08+.6*big),"sine",f,f*rnd(.985,1.01),rnd(.025,.08)*k,rnd(.05,.2));}}
  else if(m==="wood"){tone(c,t,"sine",rnd(160,210),95,.65*k,.2);burst(c,t,"bandpass",rnd(650,950),1.4,.6*k,.09);tone(c,t,"triangle",rnd(420,560),300,.2*k,.1);
    for(let i=0,n=3+Math.round(6*big);i<n;i++)burst(c,t+rnd(.005,.12+.2*big),"bandpass",rnd(1800,4200),3,rnd(.08,.22)*k,rnd(.01,.03));}
  else if(m==="stone"){tone(c,t,"sine",92,42,.85*k,.28);burst(c,t,"lowpass",800,.7,.6*k,.22);
    for(let i=0,n=8+Math.round(14*big);i<n;i++)burst(c,t+rnd(.01,.15+.4*big),"bandpass",rnd(900,3600),2.4,rnd(.04,.16)*k,rnd(.012,.035));}
  else{burst(c,t,"highpass",1700,.7,.5*k,.09);for(let i=0;i<7;i++)burst(c,t+rnd(.004,.15),"bandpass",rnd(1400,4800),2,rnd(.08,.26)*k,rnd(.015,.04));}}
// 떨어진 조각이 바닥·벽·다른 조각에 부딪히는 소리
function sLand(v){const c=AU.ctx;if(!c)return;const t=c.currentTime,k=clamp((v-3)/14,.08,1),m=mat();
  if(m==="glass"){const f=rnd(2000,3600);tone(c,t,"sine",f,f,.08*k,.14);tone(c,t,"sine",f*1.47,f*1.47,.04*k,.09);burst(c,t,"highpass",4500,.8,.1*k,.025);if(v>11)sMatHit(.3*k,.12);}
  else if(m==="wood"){burst(c,t,"bandpass",rnd(800,1200),2,.32*k,.05);tone(c,t,"triangle",rnd(240,320),190,.22*k,.08);}
  else if(m==="stone"){tone(c,t,"sine",rnd(95,120),55,.38*k,.13);burst(c,t,"lowpass",900,.7,.28*k,.07);burst(c,t,"bandpass",2600,3,.08*k,.02);}
  else{burst(c,t,"lowpass",650,.7,.2*k,.06);tone(c,t,"sine",150,85,.1*k,.07);}}

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
// 불 대기: 종이는 바로 붙고, 나무는 먼저 달궈져야 붙음(약하게 시작) · 유리·돌은 달궈지기만 함
function igniteAt(p,lx,ly,R,s){if(!burns()){heatAt(p,lx,ly,R,s);return 0;}
  let n=0;const {d,bn,wt,h}=p,wood=mat()==="wood";
  cellsIn(p,lx,ly,R,i=>{if(d[i]>=1||wt[i]>.15)return;
    if(wood&&bn[i]===0&&h[i]<.45){h[i]=Math.min(1,h[i]+s*.42);p.hot=true;p.dirty=true;return;}
    const v=wood?s*.55:s;if(bn[i]<v)bn[i]=v;n++;});
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
  const list=[...new Set(G.pieces.filter(p=>!p.dead&&p.body).map(p=>p.body))];for(const B of G.bombs)list.push(B.b);
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
  if(!burns())return 0;
  const ws=mat()==="wood"?.42:1;   // 나무: 천천히 타고 덜 번짐
  for(const p of G.pieces){if(p.dead||!(p.burning||p.hot))continue;
    const {cols,rows,cs,d,h,bn,fu,wt}=p,ux=-p.f.s,uy=-p.f.c;let cnt=0,sx=0,sy=0;_bl.length=0;
    const ig=(j,ox,oy,pr)=>{if(d[j]<1&&bn[j]===0&&wt[j]<.15&&Math.random()<pr*ws*(1+2.2*Math.max(0,ox*ux+oy*uy)*gf))bn[j]=.06;};
    for(let i=0;i<d.length;i++){if(d[i]>=1)continue;
      if(bn[i]>0){
        if(wt[i]>.15){bn[i]=0;continue;}
        const b=bn[i]=Math.min(1,bn[i]+dt*.8*(1.05-bn[i]));
        fu[i]-=dt*(.1+.3*b)*ws;
        const was=d[i];d[i]+=dt*.3*b*ws;if(was<.8&&d[i]>=.8)p.needMask=true;
        const em=fu[i]<.45?1-fu[i]/.45:0,hv=.1*b+.66*em*(.7+.3*Math.random());if(h[i]<hv)h[i]=hv;
        const x=i%cols,y=(i/cols)|0;
        if(fu[i]<=0||d[i]>=1){d[i]=1.35;bn[i]=0;p.shapeDirty=true;p.needMask=true;const w=toWorld(p,(x+.5)*cs,(y+.5)*cs);
          if(Math.random()<.45)shard(w.x,w.y,rnd(-30,30),rnd(-60,0),["#3a3532","#5a534d","#2a2522"][(Math.random()*3)|0],cs*rnd(.4,.8));if(Math.random()<.35)ember(w.x,w.y,rnd(-40,40),rnd(-120,-30));continue;}
        const pr=dt*1.3*b;
        if(x>0)ig(i-1,-1,0,pr);if(x<cols-1)ig(i+1,1,0,pr);if(y>0)ig(i-cols,0,-1,pr);if(y<rows-1)ig(i+cols,0,1,pr);
        cnt++;sx+=x;sy+=y;_bl.push(i);}
      else if(h[i]>.92&&wt[i]<.15&&Math.random()<dt*.8*ws){bn[i]=.08;p.burning=true;}}
    if(!cnt){p.burning=false;continue;}
    p.burning=true;p.hot=true;p.dirty=true;total+=cnt;
    // 불꽃 피우기: 몫은 타는 칸 수에 비례 (지난 프레임 전체 기준) → 목록 뒤쪽 조각도 불꽃을 받음
    const share=Math.min(cnt*dt*4.5,budget*cnt/Math.max(cnt,G.fireTot||0)),ne=Math.floor(share)+(Math.random()<share%1?1:0),fr=clamp(cs*2,8,16);
    for(let k=0,tr=0;k<ne&&tr<ne*3;tr++){const i=_bl[(Math.random()*cnt)|0];if(Math.random()>fu[i]+.15)continue;k++;const w=toWorld(p,(i%cols+Math.random())*cs,((i/cols|0)+Math.random())*cs);flame(w.x,w.y,fr*(.6+.6*bn[i]),bn[i]);}
    const c=toWorld(p,(sx/cnt+.5)*cs,(sy/cnt+.5)*cs);G.glows.push({x:c.x,y:c.y,n:cnt*cs*cs/64});
    // 옆 조각으로 옮겨붙기 (불은 위로 잘 번짐)
    if(spread)for(let k=0;k<Math.min(6,cnt);k++){const i=_bl[(Math.random()*cnt)|0],w=toWorld(p,(i%cols+.5)*cs,((i/cols|0)+.5)*cs);
      const tx=w.x+rnd(-1,1)*(cs*1.3+(1-Math.min(1,gf))*10),ty=w.y-rnd(2,8+16*gf),hit=pieceAt(tx,ty);
      if(hit&&hit.p!==p&&hit.p.bn[hit.i]===0&&hit.p.wt[hit.i]<.15&&Math.random()<.6*ws){hit.p.bn[hit.i]=.07;hit.p.burning=true;hit.p.hot=true;}
      for(const B of G.bombs)if(Math.hypot(B.b.position.x-w.x,B.b.position.y-w.y)<20)B.t=Math.min(B.t,G.time+.35);}}
  return total;}
function flameStep(dt){const A=G.fl,gf=gfac(),wv=G.W.vol>1,kx=Math.pow(gf>.3?.93:.9,dt*60),ky=gf>.3?Math.pow(.985,dt*60):kx;
  for(let i=A.length-1;i>=0;i--){const q=A[i];q.life-=dt;
    if(q.life>0){q.vy-=300*gf*dt;q.vx+=Math.sin(G.time*8+q.sd+q.y*.045)*110*dt;q.vx*=kx;q.vy*=ky;q.x+=q.vx*dt;q.y+=q.vy*dt;if(wv&&q.y>surfY(q.x))q.life=0;}
    // 폭발 연기 몫을 남겨 두려고 불꽃에서 나오는 연기는 100개까지만
    if(q.life<=0){if(G.nSmoke<100&&Math.random()<(.1*gf+.03)*(G.fireTot>0||(G.fb.length&&burns())?1:burns()?.12:.03))smoke(q.x,q.y,q.vx*.3,q.vy*.3-10*gf,rnd(5,9),rnd(.22,.34));A[i]=A[A.length-1];A.pop();}}}
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

// ── 유리 녹기 ──
// 유리·돌은 불이 붙지 않음. 돌은 그을리고 잠깐 달아오르기만 하고, 유리는 칸마다 온도 tg(0~1.6)가 있어
// 불을 대면 오르고(붉게 → 주황 → 노랗게 빛남) 떼면 천천히 식음. 1이 넘은 채로 오래 두면 그 칸이 녹아
// 녹은 유리(G.md)는 꿀보다 훨씬 되직해서 받치는 유리도 함께 물러져 있어야(주변까지 달궈야) 아주 천천히 처져 흐르고,
// 아니면 그 자리에 불룩하게 고임. 가장자리에선 매달려 늘어지다 아래 조각에 닿으면 틈을 메우며 이어 붙고, 무거우면 실을 끌며 똑 떨어짐.
// 닿는 유리 조각과는 들러붙고, 식으면(기다리거나 물) 굳은 유리로 남으며 이어진 조각끼리는 붙어 버림(G.fz → 묶음 몸체 · 벽 칸에 붙으면 고정).
// 물에 닿으면 확 식으며 김이 나고, 아주 뜨거울 땐 잔금이 감(열충격).
const MD_MAX=40,GP_MAX=28;
function heatAt(p,lx,ly,R,s){const {d,h,cols,cs}=p;
  if(mat()==="stone"){cellsIn(p,lx,ly,R,i=>{if(d[i]>=1)return;if(d[i]<.26){d[i]=Math.min(.26,d[i]+s*.05);p.dirty=true;}const v=Math.min(.24,h[i]+s*.2);if(h[i]<v)h[i]=v;});p.hot=true;return;}
  if(!p.tg){p.tg=new Float32Array(d.length);p.mf=new Float32Array(d.length);p.tx=new Float32Array(d.length);}
  const tg=p.tg;
  R=Math.max(R*2.2,24);cellsIn(p,lx,ly,R,i=>{if(d[i]>=1)return;const dd=Math.hypot((i%cols+.5)*cs-lx,((i/cols|0)+.5)*cs-ly)/R;tg[i]=Math.min(1.6,tg[i]+s*.5*Math.pow(1-dd,1.6));});
  p.gh=true;p.hot=true;}
function glassStep(dt){let st=0;
  for(const p of G.pieces){if(p.dead||!p.gh)continue;
    const {tg,mf,d,h,wt,cols,cs}=p;let mx=0,qi=-1,qt=0,sx=0,sy=0,n=0;
    // 열이 옆 칸으로 조금씩 번짐 → 빛나는 자리가 둥글게 퍼지고, 녹는 구멍도 가운데부터 천천히 넓어짐
    const kd=Math.min(.3,dt*1.1);
    for(let i=0;i<tg.length;i++){if(d[i]>=1)continue;const x=i%cols;let s=0,c=0;
      if(x>0&&d[i-1]<1){s+=tg[i-1];c++;}if(x<cols-1&&d[i+1]<1){s+=tg[i+1];c++;}if(i>=cols&&d[i-cols]<1){s+=tg[i-cols];c++;}if(i+cols<tg.length&&d[i+cols]<1){s+=tg[i+cols];c++;}
      if(c)tg[i]+=(s/c-tg[i])*kd;}
    for(let i=0;i<tg.length;i++){let t=tg[i];if(t<=0)continue;if(d[i]>=1){tg[i]=0;continue;}
      if(wt[i]>.35&&t>.3){if(t>qt){qt=t;qi=i;}t=Math.min(t,.08+t*.06);}
      t-=dt*(.075+.08*t);if(t<.003)t=0;tg[i]=t;if(p.tx&&t>p.tx[i])p.tx[i]=t;   // tx: 가장 뜨거웠던 온도 (물렁해졌던 자리는 식을 때 옆 조각과 붙음)
      if(t>.2){const gl=Math.min(1,Math.pow((t-.2)/.85,1.1));if(h[i]<gl)h[i]=gl;}
      if(t>1){mf[i]+=dt*(t-1)*1.7;if(mf[i]>=1){meltCell(p,i);continue;}}
      if(t>mx)mx=t;if(t>.6){n++;sx+=i%cols;sy+=(i/cols)|0;}}
    if(qi>=0){const lx=(qi%cols+.5)*cs,ly=((qi/cols|0)+.5)*cs,w=toWorld(p,lx,ly);if(st++<3)steamP(w.x,w.y,Math.round(2+qt*3),1.3);sSteam(Math.min(1,.4+qt*.5));
      if(qt>.65){quenchCracks(p,lx,ly,qt);sCrackle(.8);}}
    if(mx>0){p.hot=true;p.dirty=true;}
    if(n){const c=toWorld(p,(sx/n+.5)*cs,(sy/n+.5)*cs);G.glows.push({x:c.x,y:c.y,n:n*cs*cs/90});}
    if(p.gm&&mx<.5){p.gm=false;fuseAround(p);}
    if(mx===0)p.gh=false;}}
// 칸 하나가 녹음: 구멍이 되고(녹아 오그라든 도톰한 테가 둥글게 남음), 녹은 유리는 바로 아래 남은 유리 위로 처져 가까운 방울에 보태짐
const drip=o=>Object.assign({p:null,lx:0,ly:0,x:0,y:0,vx:0,vy:0,vol:1,T:1,st:0,tr:[],wa:0,from:null,age:0,hl:0,ck:0},o);
const cellOf=(p,lx,ly)=>{const gx=Math.floor(lx/p.cs),gy=Math.floor(ly/p.cs);return gx>=0&&gy>=0&&gx<p.cols&&gy<p.rows?gy*p.cols+gx:-1;};
function meltCell(p,i){const {cols,cs,d,tg}=p,T=tg[i];d[i]=1.35;p.cl[i]=2;p.hasCl=true;p.bn[i]=0;tg[i]=0;p.shapeDirty=true;p.needMask=true;p.gm=true;
  const lx=(i%cols+.5)*cs,ly=((i/cols|0)+.5)*cs;p.ml=true;
  const f=p.f,w=toWorld(p,lx,ly);let best=null,bd=cs*8;
  for(const m of G.md)if(m.p===p&&m.st!==2&&!m.hang){const dd=Math.hypot(m.x-w.x,m.y-w.y);if(dd<bd){bd=dd;best=m;}}
  if(!best&&G.md.length>=MD_MAX)best=G.md.find(m=>m.p===p&&m.st!==2);
  if(best){best.vol+=1;best.T=Math.max(best.T,T);if(best.st===3&&!best.hang)best.st=0;return;}
  if(G.md.length>=MD_MAX)return;
  // 아래(중력 쪽)로 가장 가까운 남은 유리 위에 고임 · 구멍이 커서 받칠 데가 없으면 방울로 떨어짐
  for(let s=cs*.6;s<=cs*3.5;s+=cs*.5){const qx=lx+f.s*s,qy=ly+f.c*s;
    if(solidAt(p,qx,qy)){const v=toWorld(p,qx,qy),m=drip({p,lx:qx,ly:qy,x:v.x,y:v.y,T,from:p});m.tr.push([qx,qy,mdW(m)*.8]);G.md.push(m);return;}}
  G.md.push(drip({x:w.x,y:w.y,T,st:2,from:p}));}
function solidAt(p,lx,ly){const gx=Math.floor(lx/p.cs),gy=Math.floor(ly/p.cs);return gx>=0&&gy>=0&&gx<p.cols&&gy<p.rows&&p.d[gy*p.cols+gx]<1;}
function wetNear(x,y,r){const D=G.dr;if(!D.length)return false;const H=12,cx=Math.floor(x/H)+80,cy=Math.floor(y/H)+400;
  for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){const a=G.hash.get((cx+ox)*8192+cy+oy);if(a)for(const j of a){const q=D[j];if(q&&Math.hypot(q.x-x,q.y-y)<r)return true;}}return false;}
const mdW=m=>Math.min(m.p?Math.max(10,m.p.cs*4):14,4+Math.sqrt(m.vol)*3.2)*(m.sp?1.3:1);
// 녹은 유리 움직이기: 0 표면 위(받치는 유리도 물러져 있어야 아주 천천히 흐름) · 1 가장자리에 매달려 늘어짐 · 2 떨어지는 중 · 3 굳는 중
// 꿀보다 훨씬 되직해서 주변이 안 녹았으면 그 자리에 불룩하게 고여 있고, 닿는 유리 조각과는 들러붙음
const VFLOW=9;
function dripStep(dt){const A=G.md;
  // 녹은 유리로 이어진 곳이 식으면 붙임
  for(const L of G.fz)if(!L.on&&!L.dead&&(!L.m||L.m.T<.5||A.indexOf(L.m)<0))weld(L);
  if(!A.length&&!G.gp.length)return;const gf=Math.max(.2,gfac()),wv=G.W.vol>1;
  for(let k=A.length-1;k>=0;k--){const m=A[k];m.age+=dt;
    if(m.p&&m.p.dead){A[k]=A[A.length-1];A.pop();continue;}
    const p=m.p;
    if(p&&m.st!==2&&!solidAt(p,m.lx,m.ly)){const f=p.f;let ok=false;
      for(let s=p.cs*.5;s<=p.cs*10;s+=p.cs*.5){const qx=m.lx+f.s*s,qy=m.ly+f.c*s;if(solidAt(p,qx,qy)){m.lx=qx;m.ly=qy;m.tr=[[qx,qy,mdW(m)*.86]];if(m.st===1)m.st=0;ok=true;break;}}
      // 받칠 데가 없으면 가까운 남은 유리에 실처럼 매달린 채 천천히 늘어지며 떨어짐 → 아래 조각에 닿으면 그 실로 붙음
      if(!ok){const w=toWorld(p,m.lx,m.ly);let an=null;
        for(let r=p.cs;r<=p.cs*3&&!an;r+=p.cs)for(let i=0;i<8;i++){const a=i*.785,qx=m.lx+Math.cos(a)*r,qy=m.ly+Math.sin(a)*r;if(solidAt(p,qx,qy)){an={p,lx:qx,ly:qy,life:.8,max:.8};break;}}
        Object.assign(m,{p:null,x:w.x,y:w.y,st:2,vx:0,vy:0,tr:[],th:m.T>.6?an:null,hang:false,from:p,age:0});continue;}}
    if(m.st!==2&&p){const w=toWorld(p,m.lx,m.ly);m.x=w.x;m.y=w.y;
      // 흐른 자국 밑이 녹아 뚫리면 그 위쪽 자국은 구멍 테로 오그라들어 사라짐 (머리 쪽 이어진 부분만 남김)
      if(p.ml&&m.tr.length>1&&(m.tc=(m.tc||0)-dt)<=0){m.tc=.15;for(let i=m.tr.length-1;i>=0;i--)if(!solidAt(p,m.tr[i][0],m.tr[i][1])){m.tr=m.tr.slice(i+1);break;}}}
    const ci=p&&m.st!==2?cellOf(p,m.lx,m.ly):-1,sub=ci>=0&&p.tg?p.tg[ci]:0;
    // 식기: 클수록 천천히 · 찬 유리 위면 더 빨리 · 받치는 유리가 더 뜨거우면 다시 달궈짐 · 물에 닿으면 확 식음(김)
    m.T-=dt*(.07+.04*m.T)*(1.25-.3*Math.min(1,m.vol/4))*(ci>=0?1.6-.6*Math.min(1,sub):1);
    if(sub>m.T)m.T+=(sub-m.T)*Math.min(1,dt*2.5);
    if(m.T>.35&&((wv&&m.y>surfY(m.x)-2)||(ci>=0&&p.wt[ci]>.35)||wetNear(m.x,m.y,mdW(m)+8))){steamP(m.x,m.y,Math.round(2+m.T*3),1.2);sSteam(.8);if(m.T>.7)sCrackle(.6);m.T=Math.min(m.T,.12);}
    const soft=clamp((m.T-.7)/.6,0,1);
    if(m.st<2&&m.T>.5&&(m.ck-=dt)<=0){m.ck=.12;stick(m);}
    if(m.st===0){
      if(m.T<.45){m.st=3;continue;}
      const f=p.f,dlx=f.s,dly=f.c;
      const bed=clamp((sub-.8)/.4,0,1),v=VFLOW*soft*soft*bed*(.3+.7*Math.min(1,m.vol/3))*gf;
      if(v<.25)continue;
      m.wa=(m.wa+rnd(-1,1)*dt*2)*Math.pow(.95,dt*60);
      const s=Math.min(v*dt,1.2),nlx=m.lx+(dlx+dly*m.wa*.2)*s,nly=m.ly+(dly-dlx*m.wa*.2)*s;
      if(solidAt(p,nlx,nly)){m.lx=nlx;m.ly=nly;const L=m.tr[m.tr.length-1];if(!L||Math.hypot(L[0]-nlx,L[1]-nly)>1.6){m.wj=(m.wj||0)*.82+rnd(-.05,.05);m.tr.push([nlx,nly,mdW(m)*(.86+m.wj)]);if(m.tr.length>160)m.tr.splice(1,1);}continue;}
      // 가장자리: 바로 아래 맞닿은 조각이 있으면 틈을 메우며 넘어가 붙고, 없으면 매달려 늘어짐
      const w=toWorld(p,m.lx,m.ly);let hit=null;for(const o of [2,4,6]){const h=pieceAt(w.x+f.s*o,w.y+f.c*o);if(h&&h.p!==p){hit=h;break;}}
      if(hit){bridge(m,hit);continue;}
      m.st=1;m.hl=0;continue;}
    if(m.st===1){
      if(m.T<.5){m.st=3;m.hang=true;continue;}
      const f=p.f;m.hl+=dt*soft*(2.5+m.vol*2)*gf;
      const r=mdW(m),tip=m.hl+r*.9,h=pieceAt(m.x,m.y+tip);
      if(h&&h.p!==p){bridge(m,h);continue;}
      // 무거워지면 끝이 늘어나다 똑 떨어짐 (가늘고 긴 실을 끌며 천천히)
      if(m.hl>6+m.vol*3&&m.vol>1){A.push(drip({x:m.x,y:m.y+tip,vx:p.pin||p.anc?0:p.body.velocity.x*60,vy:10,vol:m.vol*.7,T:m.T,st:2,from:p,th:{p,lx:m.lx,ly:m.ly,life:.9,max:.9}}));
        m.vol*=.3;m.hl*=.3;sPlip(.25);}
      continue;}
    if(m.st===2){const th=m.th&&m.th.life>0&&!m.th.p.dead;m.vy+=1100*gf*dt*(th?.28:1);m.vx*=Math.pow(.99,dt*60);if(wv&&m.y>surfY(m.x)){m.vy*=Math.pow(.9,dt*60);m.vx*=Math.pow(.9,dt*60);}
      m.x+=m.vx*dt;m.y+=m.vy*dt;if(m.th)m.th.life-=dt;
      const r=mdW(m)*.9;
      if(m.y>=G.vh-r){puddle(m.x,m.vol,m.T);A[k]=A[A.length-1];A.pop();continue;}
      const h=pieceAt(m.x,m.y+r);
      if(h&&(h.p!==m.from||m.age>.25)){const L=toLocal(h.p,m.x,m.y+r*.5);
        // 실이 아직 이어져 있으면 두 조각이 그 실로 붙음
        if(th&&h.p!==m.from){const a=toWorld(m.th.p,m.th.lx,m.th.ly),Lk=link(m.th.p,h.p,a.x,a.y,m.x,m.y+r*.5,m);if(Lk&&!Lk.br)Lk.br=Math.max(1.6,mdW(m)*.45);}
        Object.assign(m,{p:h.p,lx:L.x,ly:L.y,st:0,tr:[[L.x,L.y,mdW(m)]],th:null,sp:1});if(m.T>.6)sCrackle(.35);}
      continue;}
    // 3: 굳는 중. 다시 달구면 다시 물러지고, 다 식으면 조각에 굳은 유리로 그려 넣음 (조각 밖으로 늘어진 고드름은 따로 남김)
    if(p&&!m.hang&&sub>.95&&m.T>.7){m.st=0;continue;}
    if(m.T<.2){if(p&&!p.dead){if(m.tr.length)bakeDrip(m);if(m.hang&&m.hl>1.5)G.ice.push({p,lx:m.lx,ly:m.ly,hl:m.hl,w:mdW(m)});}A[k]=A[A.length-1];A.pop();}}
  for(let i=0;i<A.length;i++){const a=A[i];if(a.st===2||!a.p||a.hang)continue;
    for(let j=A.length-1;j>i;j--){const b=A[j];if(b.p!==a.p||b.st===2||b.hang||Math.hypot(a.x-b.x,a.y-b.y)>(mdW(a)+mdW(b))*.42)continue;
      const f=a.p.f,lo=f.s*(b.x-a.x)+f.c*(b.y-a.y)>0?b:a,hi=lo===a?b:a;
      lo.vol+=hi.vol;lo.T=Math.max(lo.T,hi.T);if(lo.st===3&&lo.T>.45)lo.st=0;for(const L of G.fz)if(L.m===hi)L.m=lo;
      A.splice(A.indexOf(hi),1);if(hi===a){i--;break;}}}
  for(let i=G.gp.length-1;i>=0;i--){const q=G.gp[i];if(q.T<=0)continue;
    if(wv&&surfY(q.x)<G.vh-2&&q.T>.3){steamP(q.x,G.vh-4,4,1.4);sSteam(.9);q.T=.1;}
    q.T=Math.max(0,q.T-dt*.08);}}
// 녹은 유리가 틈을 건너 맞닿은 조각에 닿음: 두 조각을 잇는 유리 다리 + 닿은 쪽에 고이는 방울 (식으면 붙음)
function bridge(m,h){const p=m.p,q=h.p,r=mdW(m),w=toWorld(q,h.L.x,h.L.y),n=drip({p:q,lx:h.L.x,ly:h.L.y,x:w.x,y:w.y,vol:m.vol*.5,T:m.T,from:p});
  n.tr.push([h.L.x,h.L.y,r*.8]);G.md.push(n);
  const L=link(p,q,m.x,m.y,w.x,w.y,n);if(L&&!L.br)L.br=r*.8;
  m.vol*=.5;m.st=3;m.hang=false;m.hl=0;if(m.T>.6)sCrackle(.3);}
// 녹은 방울 둘레에 다른 조각이 닿아 있으면 들러붙음
function stick(m){const p=m.p,cx=m.x,cy=m.y+(m.st===1?m.hl:0),r=mdW(m)*.55+2.5;
  for(let i=0;i<8;i++){const a=i*.785,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,h=pieceAt(x,y);
    if(h&&h.p!==p){const L=link(p,h.p,m.x,m.y,x,y,m);if(L&&!L.br)L.br=r*.9;return;}}}
const hangPts=(x,y,hl,r)=>{const L=hl+r*.9,nk=.66-.18*Math.min(1,hl/(r*2.2));
  return [[x,y-r*.25,r*.95],[x,y+L*.3,r*nk],[x,y+L*.62,r*.98],[x,y+L*.84,r*.86],[x,y+L,r*.34]];};
// 흐르는 머리: 둥근 공이 아니라 흐른 방향으로 부풀어 뭉툭하게 오므라든 혀 모양 · 너무 짧으면 위로 늘려 처진 모양으로
function lobe(P,dx,dy){const n=P.length,h=P[n-1];
  if(n>1){const a=P[Math.max(0,n-4)],ex=h[0]-a[0],ey=h[1]-a[1],el=Math.hypot(ex,ey);if(el>.5){dx=ex/el;dy=ey/el;}}
  const w=h[2],out=P.slice(0,n-1);let L=0;for(let i=1;i<n;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
  if(L<w*.9){const a=P[0],need=w*.9-L;out.unshift([a[0]-dx*need,a[1]-dy*need,a[2]*.78]);}
  out.push([h[0],h[1],w*1.06],[h[0]+dx*w*.26,h[1]+dy*w*.26,w*.94],[h[0]+dx*w*.48,h[1]+dy*w*.48,w*.58]);return out;}
function puddle(x,vol,T){for(const q of G.gp)if(Math.abs(q.x-x)<4+Math.sqrt(q.vol)*5){q.x=(q.x*q.vol+x*vol)/(q.vol+vol);q.vol+=vol;q.T=Math.max(q.T,T);return;}
  if(G.gp.length>=GP_MAX)G.gp.shift();G.gp.push({x,vol,T});if(T>.5)sCrackle(.4);}
// 물에 확 식은 자리에 가는 잔금
function quenchCracks(p,lx,ly,t){const x=mkCtx(p),n=3+((t*4)|0);x.save();ownCells(x,p);
  for(let i=0;i<n;i++){let a=rnd(0,6.283),px=lx,py=ly;const len=p.cs*rnd(.8,2.2)*t,pts=[[px,py]];for(let s=0;s<len;s+=2.5){a+=rnd(-.5,.5);px+=Math.cos(a)*2.5;py+=Math.sin(a)*2.5;pts.push([px,py]);}glassLine(x,pts);}
  x.restore();p.dirty=true;}
// 굵기가 변하는 띠 (양 끝은 둥글게) · pts: [x,y,굵기]
function ribbon(c,pts,k,ox,oy,br){const n=pts.length;c.beginPath();
  if(br){const e=pts[n-1],r=Math.max(.3,br*k);c.moveTo(e[0]+ox+r,e[1]+oy);c.arc(e[0]+ox,e[1]+oy,r,0,-6.2832,true);c.closePath();}
  if(n===1){const r=Math.max(.3,pts[0][2]*k*.5);c.moveTo(pts[0][0]+ox+r,pts[0][1]+oy);c.arc(pts[0][0]+ox,pts[0][1]+oy,r,0,-6.2832,true);return;}
  const Lx=[],Ly=[],Rx=[],Ry=[],T=[];let tx=0,ty=1;
  for(let i=0;i<n;i++){const a=pts[i>0?i-1:0],b=pts[i<n-1?i+1:n-1],dx=b[0]-a[0],dy=b[1]-a[1],dl=Math.hypot(dx,dy);if(dl>1e-6){tx=dx/dl;ty=dy/dl;}T.push(Math.atan2(ty,tx));
    const r=Math.max(.3,pts[i][2]*k*.5),x=pts[i][0]+ox,y=pts[i][1]+oy;Lx.push(x-ty*r);Ly.push(y+tx*r);Rx.push(x+ty*r);Ry.push(y-tx*r);}
  c.moveTo(Lx[0],Ly[0]);for(let i=1;i<n;i++)c.lineTo(Lx[i],Ly[i]);
  const e=pts[n-1],s=pts[0];
  c.arc(e[0]+ox,e[1]+oy,Math.max(.3,e[2]*k*.5),T[n-1]+Math.PI/2,T[n-1]-Math.PI/2,true);
  for(let i=n-1;i>=0;i--)c.lineTo(Rx[i],Ry[i]);
  c.arc(s[0]+ox,s[1]+oy,Math.max(.3,s[2]*k*.5),T[0]-Math.PI/2,T[0]-Math.PI*1.5,true);c.closePath();}
// 녹은 유리 그리기: 뜨거울수록 검붉은 테 → 주황 → 노란 속으로 빛나고, 식으면 맑고 도톰한 유리 (가장자리 굴절 그늘 · 빛 받는 쪽 하이라이트 · 반짝점)
// bulb: 머리(끝) 방울을 몇 배 굵게
function moltenPath(c,pts,T,fr,dx=0,dy=1){if(!pts.length)return;const u=clamp((T-.35)/.8,0,1),dk=isDark();
  if(fr)pts=lobe(pts,dx,dy);
  let w=0;for(const q of pts)w+=q[2];w/=pts.length;const o=w*.15,S=(k,ox,oy)=>ribbon(c,pts,k,ox,oy,0);
  const ga=1-u*.85;
  if(ga>.01){c.globalAlpha=ga;c.lineJoin="round";
    S(1,0,0);c.fillStyle=dk?"rgba(70,122,132,.36)":"rgba(186,228,232,.5)";c.fill();
    c.lineWidth=Math.max(.8,w*.15);c.strokeStyle=dk?"rgba(4,16,20,.72)":"rgba(42,96,104,.6)";c.stroke();
    S(.56,o*.6,o*.8);c.fillStyle=dk?"rgba(0,12,16,.3)":"rgba(64,126,134,.2)";c.fill();
    S(.24,-o,-o*.8);c.fillStyle=dk?"rgba(220,245,250,.45)":"rgba(255,255,255,.9)";c.fill();}
  if(u>.01){c.globalAlpha=u;
    S(1,0,0);c.fillStyle="rgb(178,46,10)";c.fill();
    S(.76,-o*.3,-o*.3);c.fillStyle=`rgb(255,${(112+78*u)|0},${(24+34*u)|0})`;c.fill();
    c.globalAlpha=u*u;S(.4,-o*.5,-o*.6);c.fillStyle="rgb(255,242,196)";c.fill();}
  c.globalAlpha=1;}
function bakeDrip(m){const x=mkCtx(m.p);x.save();ownCells(x,m.p);moltenPath(x,m.tr,0,!m.hang,m.p.f.s,m.p.f.c);x.restore();m.p.dirty=true;}
function drawMolten(c){
  // 틈을 건너 이어 붙은 유리 다리 · 가장자리에 굳은 고드름 (조각 밖으로 나와 있어서 따로 그림)
  for(const L of G.fz){if(L.dead||!L.br||L.a.dead||L.b.dead)continue;const a=toWorld(L.a,L.ax,L.ay),b=toWorld(L.b,L.bx,L.by),w=L.br,T=L.m&&!L.on&&G.md.includes(L.m)?L.m.T:0;
    moltenPath(c,[[a.x,a.y,w],[(a.x+b.x)/2,(a.y+b.y)/2,w*.8],[b.x,b.y,w]],T,0);}
  for(const q of G.ice){if(q.p.dead)continue;const w=toWorld(q.p,q.lx,q.ly);moltenPath(c,hangPts(w.x,w.y,q.hl,q.w),0,0);}
  for(const m of G.md){
    if(m.st===2){const r=mdW(m)*.75,u=clamp((m.T-.35)/.8,0,1),len=Math.min(12,Math.abs(m.vy)*.014)+r*.5;
      if(m.th&&m.th.life>0&&!m.th.p.dead){const a=toWorld(m.th.p,m.th.lx,m.th.ly),k=m.th.life/m.th.max;c.globalAlpha=Math.min(1,k*1.6);
        c.strokeStyle=u>.2?"rgb(255,150,50)":"rgba(160,210,215,.85)";c.lineWidth=Math.max(.35,r*.34*k);c.lineCap="round";
        c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(a.x+(m.x-a.x)*.5+m.vx*.01,a.y+(m.y-a.y)*.62,m.x,m.y-len);c.stroke();c.globalAlpha=1;}
      moltenPath(c,[[m.x,m.y-len-r*.7,r*.2],[m.x,m.y-r*.55,r*.9],[m.x,m.y,r*1.25],[m.x,m.y+r*.4,r*.74]],m.T,0);continue;}
    if(!m.p||m.p.dead)continue;const p=m.p,pts=m.tr.map(q=>{const w=toWorld(p,q[0],q[1]);return [w.x,w.y,q[2]];});
    if(m.st!==3||!m.hang)pts.push([m.x,m.y,mdW(m)]);
    if(m.st===1||(m.st===3&&m.hang)){moltenPath(c,pts,m.T,0);moltenPath(c,hangPts(m.x,m.y,m.hl,mdW(m)),m.T,0);}
    else moltenPath(c,pts,m.T,1,0,1);}
  const dk=isDark();
  for(const q of G.gp){const w=5+Math.sqrt(q.vol)*6,h=2.5+Math.sqrt(q.vol)*2,u=clamp((q.T-.35)/.8,0,1),y=G.vh-h*.55;
    c.globalAlpha=1-u*.7;c.fillStyle=dk?"rgba(120,170,180,.45)":"rgba(176,220,226,.72)";c.strokeStyle=dk?"rgba(20,40,46,.5)":"rgba(52,104,112,.5)";c.lineWidth=1;
    c.beginPath();c.ellipse(q.x,y,w,h,0,Math.PI,0);c.lineTo(q.x+w,G.vh);c.lineTo(q.x-w,G.vh);c.closePath();c.fill();c.stroke();
    c.strokeStyle=dk?"rgba(225,248,255,.45)":"rgba(255,255,255,.92)";c.lineWidth=1.2;c.beginPath();c.ellipse(q.x-w*.15,y-h*.25,w*.55,h*.45,0,Math.PI*1.1,Math.PI*1.7);c.stroke();
    if(u>0){c.globalAlpha=u;c.fillStyle=`rgb(255,${(90+90*u)|0},30)`;c.beginPath();c.ellipse(q.x,y,w,h,0,Math.PI,0);c.lineTo(q.x+w,G.vh);c.lineTo(q.x-w,G.vh);c.closePath();c.fill();}}
  c.globalAlpha=1;}
// 빛(더하기 합성 단계에서): 뜨거운 방울 둘레가 은은하게 밝음
function drawMoltenGlow(c){for(const m of G.md){if(m.T<.5)continue;const s=mdW(m)*2.6+5;c.globalAlpha=Math.min(.32,(m.T-.5)*.5)*Math.min(1,.4+m.vol*.2);c.drawImage(SPR.glow,m.x-s,m.y-s,s*2,s*2);}
  for(const q of G.gp){if(q.T<.5)continue;const s=8+Math.sqrt(q.vol)*9;c.globalAlpha=Math.min(.5,(q.T-.5)*.8);c.drawImage(SPR.glow,q.x-s,G.vh-s*.6,s*2,s*1.2);}}
// ── 녹은 유리로 붙이기 ──
// 녹은 유리로 이어진 곳(G.fz)이 식으면 두 조각이 붙음. 이어진 묶음에 벽에 붙은 칸이 있으면 나머지도 그 자리에 고정(anc)되고,
// 떨어져 있는 묶음은 물리 몸체 하나로 합쳐서 통째로 움직임 (끈으로 잇지 않아서 따로 놀거나 혼자 돌지 않음)
// 이음 자리는 조각마다 자기 안쪽 점(a·b)으로 기억함 → 쪼개져도 그 점을 가진 조각이 이어받음
function link(a,b,awx,awy,bwx,bwy,m){if(!a||!b||a===b||a.dead||b.dead)return null;
  for(const L of G.fz)if(!L.dead&&((L.a===a&&L.b===b)||(L.a===b&&L.b===a))){if(!L.on&&m)L.m=m;return L;}
  const A=toLocal(a,awx,awy),B=toLocal(b,bwx,bwy),L={a,b,ax:A.x,ay:A.y,bx:B.x,by:B.y,m,on:false,dead:false,br:0};G.fz.push(L);return L;}
// 녹았던 조각이 식을 때: 녹았던 자리 둘레에서 맞닿은 다른 조각과 붙음
function fuseAround(p){const {cols,cs,d,mf}=p,tx=p.tx;let n=0;
  for(let i=0;i<d.length&&n<6;i++){if(d[i]>=1||(mf[i]<.12&&!(tx&&tx[i]>.9)))continue;const x=i%cols,y=(i/cols)|0;
    for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){const lx=(x+.5+ox*.5)*cs+ox*3,ly=(y+.5+oy*.5)*cs+oy*3;if(solidAt(p,lx,ly))continue;
      let w=toWorld(p,lx,ly),h=pieceAt(w.x,w.y);for(const e of [4,7,11])if(!h||h.p===p){w=toWorld(p,lx+ox*e,ly+oy*e);h=pieceAt(w.x,w.y);}if(h&&h.p!==p){const before=G.fz.length,c=toWorld(p,(x+.5)*cs,(y+.5)*cs),L=link(p,h.p,c.x,c.y,w.x,w.y,null);if(G.fz.length>before){n++;L.br=cs*.9;}}}}}
function weld(L){const a=L.a,b=L.b;if(a.dead||b.dead||!a.body||!b.body){L.dead=true;return;}
  if(!L.on){L.on=true;bead(a,L.ax,L.ay);bead(b,L.bx,L.by);const w=toWorld(a,L.ax,L.ay);addP({t:"glint",x:w.x,y:w.y,s:9,life:.3,max:.3});sTing(.5);}
  a.fg=b.fg=true;G.grpDirty=true;}
function unweld(){G.grpDirty=true;}
// 붙은 묶음 다시 맞추기 (붙거나 떨어지거나 쪼개진 다음 프레임에 한 번)
function regroup(){G.grpDirty=false;const {Body}=Matter;
  const live=G.pieces.filter(p=>!p.dead&&p.body&&(p.fg||p.anc||p.body.plugin.grp));if(!live.length)return;
  const par=new Map();for(const p of live)par.set(p,p);
  const find=q=>{while(par.get(q)!==q)q=par.get(q);return q;};
  for(const L of G.fz)if(L.on&&!L.dead&&par.has(L.a)&&par.has(L.b)){const a=find(L.a),b=find(L.b);if(a!==b)par.set(a,b);}
  const comps=new Map();for(const p of live){const r=find(p);let c=comps.get(r);if(!c)comps.set(r,c=[]);c.push(p);}
  for(const C of comps.values()){
    if(C.some(q=>q.pin)){for(const q of C){if(q.pin)continue;if(q.body.plugin.grp)unshare(q.body);if(!q.body.isStatic)Body.setStatic(q.body,true);q.anc=true;}continue;}
    for(const q of C)if(q.anc){q.anc=false;if(q.body.isStatic)Body.setStatic(q.body,false);}
    if(C.length===1){if(C[0].body.plugin.grp)unshare(C[0].body);continue;}
    const B=C[0].body;if(B.plugin.grp&&B.plugin.grp.length===C.length&&C.every(q=>q.body===B))continue;
    mergeBody(C);}}
// 묶음을 몸체 하나로: 각 조각의 칸 사각형을 모두 부품으로 · 속도는 원래 몸체들의 넓이 가중 평균 · 잡고 있었으면 다시 잡음
function mergeBody(C){const {Bodies,Body,Composite}=Matter,olds=[...new Set(C.map(q=>q.body))];
  for(const q of C)q.f=frame(q);
  let A=0,vx=0,vy=0,w=0;for(const b of olds){const a=b.area;A+=a;vx+=b.velocity.x*a;vy+=b.velocity.y*a;w+=b.angularVelocity*a;}
  const hb=G.drag&&olds.includes(G.drag.b)?G.drag.b:null,held=hb?{x:hb.position.x+G.drag.c.pointB.x,y:hb.position.y+G.drag.c.pointB.y}:null;if(held)dropDrag();
  if(G.ptr.pend&&olds.includes(G.ptr.pend))G.ptr.pend=null;
  for(const b of olds){const g=b.plugin.grp;if(g)for(const q of g)if(!q.dead&&q.body===b&&!C.includes(q)){q.f=frame(q);buildBody(q,q.f,b);}
    b.plugin.grp=null;Composite.remove(G.engine.world,b);}
  const parts=[];
  for(const q of C){const R=rectsOf(q),{c,s,cx,cy,th}=q.f;q.R0=R;
    for(const r of R){const lx=r.x+r.w/2-q.W/2,ly=r.y+r.h/2-q.H/2,pt=Bodies.rectangle(cx+c*lx-s*ly,cy+s*lx+c*ly,r.w,r.h,Object.assign({angle:th},bopt()));pt.plugin.piece=q;parts.push(pt);}}
  const b=Body.create(Object.assign({parts},bopt()));b.plugin.grp=C;b.plugin.piece=C[0];
  for(const q of C){const f=q.f;q.body=b;q.ao=f.th-b.angle;const dx=b.position.x-f.cx,dy=b.position.y-f.cy;q.o={x:f.c*dx+f.s*dy,y:-f.s*dx+f.c*dy};}
  if(A>0){Body.setVelocity(b,{x:vx/A,y:vy/A});Body.setAngularVelocity(b,w/A);}
  setCat(b,CAT_FREE);Composite.add(G.engine.world,b);
  for(const q of C)q.f=frame(q);
  if(held)grab(b,held.x,held.y);}
// 묶음 몸체를 조각마다 따로 나눔 (그중 하나가 쪼개지거나 사라지기 전에) → 남은 것끼리는 다음 프레임에 다시 묶임
function unshare(b){const C=b.plugin.grp;if(!C)return;b.plugin.grp=null;
  const held=G.drag&&G.drag.b===b?{x:b.position.x+G.drag.c.pointB.x,y:b.position.y+G.drag.c.pointB.y}:null;if(held)dropDrag();
  if(G.ptr.pend===b)G.ptr.pend=null;
  Matter.Composite.remove(G.engine.world,b);
  for(const q of C)if(!q.dead&&q.body===b){q.f=frame(q);buildBody(q,q.f,b);}
  if(held){const h=C.find(q=>{if(q.dead||q.body===b)return false;const L=toLocal(q,held.x,held.y);return solidAt(q,L.x,L.y);});if(h)grab(h.body,held.x,held.y);}
  G.grpDirty=true;}
// 이음매에 굳은 유리 방울
function bead(p,lx,ly){const x=mkCtx(p),r=Math.max(2.2,p.cs*.5);x.save();ownCells(x,p);moltenPath(x,[[lx,ly-r*.5,r*1.3],[lx,ly+r*.4,r*1.6]],0,0);x.restore();p.dirty=true;}
// 조각이 다시 만들어지면(쪼개짐) 붙은 자리·방울·고드름을 새 조각으로 옮김
function reglass(p,made){const live=made.filter(q=>!q.dead);
  const own=(lx,ly)=>live.find(q=>solidAt(q,lx,ly))||null;
  for(const L of G.fz){if(L.dead)continue;
    if(L.a===p){const q=own(L.ax,L.ay);if(!q){L.dead=true;unweld(L);continue;}L.a=q;if(L.on)q.fg=true;}
    if(L.b===p){const q=own(L.bx,L.by);if(!q){L.dead=true;unweld(L);continue;}L.b=q;if(L.on)q.fg=true;}}
  for(const m of G.md){if(m.p===p){const q=own(m.lx,m.ly);if(q)m.p=q;else if(p.dead&&m.st<2)Object.assign(m,{p:null,st:2,vx:0,vy:0,tr:[],th:null});}
    if(m.th&&m.th.p===p){const q=own(m.th.lx,m.th.ly);if(q)m.th.p=q;else m.th=null;}}
  G.ice=G.ice.filter(o=>{if(o.p!==p)return !o.p.dead;const q=own(o.lx,o.ly-1);if(q){o.p=q;return true;}return false;});
  if(G.fz.length>60)G.fz=G.fz.filter(L=>!L.dead);G.grpDirty=true;}
function unglass(p){for(const L of G.fz)if(!L.dead&&(L.a===p||L.b===p)){L.dead=true;unweld(L);}
  for(const m of G.md){if(m.p===p){if(m.st<2)Object.assign(m,{p:null,st:2,vx:0,vy:0,tr:[],th:null});else m.p=null;}if(m.th&&m.th.p===p)m.th=null;}
  G.ice=G.ice.filter(o=>o.p!==p);}

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
  // 단단한 재질은 맞을 때마다 충격이 쌓여서 (나무 2번 · 돌 4번쯤) 깨짐. 그 전엔 움푹 패고 금만 감
  const S=str();let broke=false;
  if(hit){const p=hit.p;if(S>1.2&&(p.hst=(p.hst||0)+k/S)<.999)hammerChip(p,x,y,k);else{hammerBreak(p,x,y,k);broke=true;}
    sHammer("piece",clamp(.6+.25*k,.5,1.2));G.hit=Math.max(G.hit,.04+.025*Math.min(k,2));G.shake=Math.min(30,G.shake+4+4*k);}
  else if(!water&&y>G.vh-26){dustP(x,G.vh-2,10,k);sHammer("floor",clamp(.6+.2*k,.5,1.1));G.shake=Math.min(30,G.shake+3+2*k);}
  // 충격이 옆 칸까지 퍼짐: 때린 곳 가까이 떠 있던 칸은 떨어져 나가며 바깥으로 밀려남 (파괴력이 클수록 멀리까지)
  if(hit&&!broke)return;
  const R=(14+18*k)/Math.sqrt(Math.max(1,S));
  for(const q of G.pieces){if(q.dead||!q.pin)continue;const bb=q.body.bounds,dd=Math.hypot(Math.max(bb.min.x-x,0,x-bb.max.x),Math.max(bb.min.y-y,0,y-bb.max.y));
    if(dd>R)continue;release(q);const b=q.body,ux=b.position.x-x,uy=b.position.y-y,n=Math.hypot(ux,uy)||1,s=(1+1.5*k)*(1-dd/R)/Math.sqrt(Math.max(1,b.mass/3));
    Matter.Body.setVelocity(b,{x:b.velocity.x+ux/n*s,y:b.velocity.y+uy/n*s*.6});Matter.Body.setAngularVelocity(b,rnd(-.04,.04)*k);}}
// 맞은 자리는 움푹 깨지고, 거기서 금이 사방으로 뻗어 조각이 쪼개짐
// 재질마다: 유리는 거미줄처럼 금이 가고 그중 일부를 따라 쐐기 모양으로 갈라짐 · 나무는 결을 따라 길게 쪼개짐 · 돌은 들쭉날쭉 + 먼지
function hammerBreak(p,x,y,k){release(p);const {cs,cols,rows,d}=p,L=toLocal(p,x,y),dim=Math.hypot(p.W,p.H),crater=[],m=mat();
  const brk=(lx,ly)=>{const cx=Math.floor(lx/cs),cy=Math.floor(ly/cs);if(cx<0||cy<0||cx>=cols||cy>=rows)return;const i=cy*cols+cx;if(d[i]>=1)return;d[i]=1.35;p.bn[i]=0;p.cl[i]=1;};p.hasCl=true;
  const rc=cs*((m==="glass"?.45:m==="stone"?.85:.7)+.45*k);cellsIn(p,L.x,L.y,rc+cs*.3,i=>{if(d[i]<1){d[i]=1.35;p.bn[i]=0;p.cl[i]=1;crater.push(i);}});
  const a0=rnd(0,6.28),reach=clamp((m==="glass"?.5:.38)+.42*k,.3,1.9);
  if(m==="glass"){const rays=glassWeb(p,L.x,L.y,dim*reach*.6,cs*.45);for(const r of rays)if(Math.random()<.6)for(const [lx,ly] of r)brk(lx,ly);}
  else{const n=clamp(Math.round((m==="wood"?2:3)+Math.random()*2+(m==="wood"?.6:1.3)*k),2,10),nz=m==="wood"?.1:m==="stone"?.34:.24,gr=p.gr||0;
    const walk=(lx,ly,a,len,dep)=>{const st=cs*.45;for(let s=0;s<len;s+=st){a+=rnd(-nz,nz);
        if(m==="wood"){const t=Math.cos(a-gr)>=0?gr:gr+Math.PI;let da=t-a;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;a+=da*.25;}
        lx+=Math.cos(a)*st;ly+=Math.sin(a)*st;
        if(lx<-cs||ly<-cs||lx>p.W+cs||ly>p.H+cs)return;brk(lx,ly);
        if(dep<2&&Math.random()<.045)walk(lx,ly,a+(Math.random()<.5?-1:1)*rnd(.4,.9),(len-s)*rnd(.3,.6),dep+1);}};
    for(let i=0;i<n;i++){const a=m==="wood"?gr+(i%2?Math.PI:0)+rnd(-.5,.5):a0+i*6.283/n+rnd(-.35,.35);walk(L.x,L.y,a,dim*rnd(.3,.75)*reach*(m==="wood"?1.4:1),0);}
    dent(p,L.x,L.y,rc);}
  const per=m==="glass"?3:2;
  for(const i of crater){const w=toWorld(p,(i%cols+.5)*cs,((i/cols|0)+.5)*cs);
    for(let j=0;j<per;j++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(120,420)*Math.sqrt(k);shard(w.x,w.y,Math.cos(a)*s,Math.sin(a)*s,pickCol(p,0),cs*rnd(.5,1.1));}}
  if(m!=="glass")dustP(x,y,Math.round((6+4*k)*(m==="stone"?2.4:1)),Math.sqrt(k));
  else for(let i=0;i<6;i++)addP({t:"glint",x:x+rnd(-12,12),y:y+rnd(-12,12),s:rnd(5,11),life:.25,max:.25});
  for(let i=0,n=m==="stone"?10:m==="glass"?0:m==="wood"?2:5;i<n;i++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(200,500);spark(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(.08,.2));}
  p.shapeDirty=true;p.needMask=true;p.dirty=true;
  const before=G.pieces.length;restructure(p);
  const frags=(p.dead?[]:[p]).concat(G.pieces.slice(before)),many=frags.length>1;
  for(const q of frags){if(q.dead||!q.body)continue;const b=q.body,dx=b.position.x-x,dy=b.position.y-y,dd=Math.hypot(dx,dy)||1,m=Math.sqrt(Math.max(1,b.mass/3));
    const s=(1.4+2.6*k)/m*rnd(.7,1.15)*(many?1:.45);
    Matter.Body.setVelocity(b,{x:b.velocity.x+dx/dd*s,y:b.velocity.y+dy/dd*s*.6+1.2*k/m});
    Matter.Body.setAngularVelocity(b,b.angularVelocity+rnd(-.1,.1)*k*(many?1:.4));}}

// 아직 안 깨지는 망치질 (나무·돌): 움푹 패고 짧은 금이 감 (쌓일수록 길게) · 돌은 맞은 칸 하나가 떨어져 나감
function hammerChip(p,x,y,k){const {cs,cols,rows,d}=p,L=toLocal(p,x,y),m=mat(),u=p.hst,c=mkCtx(p),gr=p.gr||0;
  dent(p,L.x,L.y,cs*(.45+.3*k));
  c.save();ownCells(c,p);
  for(let i=0,n=2+Math.round(u*4);i<n;i++){let a=m==="wood"?gr+(i%2?Math.PI:0)+rnd(-.25,.25):rnd(0,6.283),px=L.x,py=L.y;const len=cs*rnd(1.4,3)*(.6+u*1.8);
    for(let s=0;s<len;s+=3){a+=rnd(-.3,.3)*(m==="wood"?.35:1);const nx=px+Math.cos(a)*3,ny=py+Math.sin(a)*3;crackSeg(c,px,py,nx,ny,Math.max(.5,1.4*(1-s/len)),m);px=nx;py=ny;}}
  c.restore();
  if(m==="stone"){const gx=Math.floor(L.x/cs),gy=Math.floor(L.y/cs);if(gx>=0&&gy>=0&&gx<cols&&gy<rows){const i=gy*cols+gx;if(d[i]<1){d[i]=1.35;p.bn[i]=0;p.cl[i]=1;p.hasCl=true;p.shapeDirty=true;p.needMask=true;}}}
  for(let j=0,n=m==="stone"?7:4;j<n;j++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(100,330)*Math.sqrt(k);shard(x,y,Math.cos(a)*s,Math.sin(a)*s,pickCol(p,0),cs*rnd(.35,.8));}
  dustP(x,y,m==="stone"?9:3,Math.sqrt(k));
  if(m==="stone")for(let i=0;i<9;i++){const a=rnd(Math.PI*1.1,Math.PI*1.9),s=rnd(200,520);spark(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(.08,.2));}
  if(!p.pin){const b=p.body,mm=Math.sqrt(Math.max(1,b.mass/3));Matter.Body.setVelocity(b,{x:b.velocity.x,y:b.velocity.y+1.2*k/mm});}
  p.dirty=true;}
// 유리 거미줄 금: 맞은 곳에서 곧게 뻗는 금 + 그 사이를 잇는 고리. 금마다 점 목록(조각 좌표)을 돌려줌
function glassWeb(p,lx,ly,R,st){const x=mkCtx(p),n=10+((Math.random()*6)|0),rays=[];st=clamp(st,2,5);
  const g=x.createRadialGradient(lx,ly,0,lx,ly,R*.2);g.addColorStop(0,"rgba(255,255,255,.8)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.beginPath();x.arc(lx,ly,R*.2,0,7);x.fill();
  for(let i=0;i<n;i++){let a=i/n*6.283+rnd(-.2,.2),px=lx,py=ly;const len=R*rnd(.55,1.1),pts=[[px,py]];
    for(let s=0;s<len;s+=st){a+=rnd(-.04,.04);px+=Math.cos(a)*st;py+=Math.sin(a)*st;pts.push([px,py]);}
    rays.push(pts);glassLine(x,pts);}
  for(const f of [.14,.3,.5,.74])for(let i=0;i<n;i++){const A=rays[i],B=rays[(i+1)%n],ia=Math.floor(A.length*f*rnd(.9,1.1)),ib=Math.floor(B.length*f*rnd(.9,1.1));
    if(ia>=A.length||ib>=B.length||Math.random()<.22)continue;const [ax,ay]=A[ia],[bx,by]=B[ib];glassLine(x,[[ax,ay],[(ax+bx)/2+rnd(-1.5,1.5),(ay+by)/2+rnd(-1.5,1.5)],[bx,by]]);}
  p.dirty=true;return rays;}
// 유리 금 한 줄: 하얗게 빛나는 단면 + 옆에 어두운 선
function glassLine(x,pts){const dk=isDark();x.lineCap="round";x.lineJoin="round";
  x.strokeStyle=dk?"rgba(0,0,0,.5)":"rgba(40,90,100,.45)";x.lineWidth=.55;x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a+.5,b+.55):x.moveTo(a+.5,b+.55));x.stroke();
  x.strokeStyle=dk?"rgba(220,245,255,.65)":"rgba(255,255,255,.97)";x.lineWidth=.8;x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.stroke();}
// 망치 맞은 자리 둘레: 돌은 새로 드러난 밝은 면, 나무는 눌려 짙어진 섬유, 종이는 구겨진 그늘
function dent(p,lx,ly,r){const m=mat(),x=mkCtx(p),dk=isDark();
  if(m==="stone"){x.fillStyle=dk?"rgba(150,152,158,.5)":"rgba(240,238,232,.75)";jagPath(x,lx,ly,r*1.9,12,.35);x.fill();
    x.fillStyle=dk?"rgba(0,0,0,.3)":"rgba(80,78,74,.35)";jagPath(x,lx,ly,r*1.35,10,.3);x.fill();}
  else{const R=r*(m==="wood"?2.2:2),g=x.createRadialGradient(lx,ly,r*.6,lx,ly,R);g.addColorStop(0,m==="wood"?"rgba(50,24,6,.55)":"rgba(0,0,0,.2)");g.addColorStop(1,"rgba(0,0,0,0)");
    x.fillStyle=g;x.beginPath();x.arc(lx,ly,R,0,7);x.fill();}
  p.dirty=true;}

// ── 기관총 ──
// 화면 오른쪽 아래 구석에서 누른 곳을 겨눠 연사. 총알은 예광탄처럼 짧은 빛줄기로 슉 날아가고,
// 맞은 곳은 재질대로 구멍·금·파편이 생기며 뒤 벽에도 구멍이 남음. 탄피는 튕겨 나가 바닥에서 쨍그랑.
const GUN_RATE=13,BUL_V=5200;
function gunGeo(){const s=clamp(Math.min(G.vw,G.vh)/320,1,1.7);return{s,px:G.vw+12*s,py:G.vh+16*s,L:192*s};}
function gunState(){return G.gun||(G.gun={a:-2.3,rc:0,heat:0,cd:0,fl:0,fs:1,fr:0,last:-1e9,off:0,vis:0});}
// 총구 위치 (겨눈 곳이 총보다 가까우면 총을 뒤로 물림)
function gunPose(){const g=gunState(),o=gunGeo(),ux=Math.cos(g.a),uy=Math.sin(g.a),back=g.off+g.rc*7*o.s+(1-g.vis)*150*o.s;
  return{o,ux,uy,mx:o.px+ux*(o.L-back),my:o.py+uy*(o.L-back),flip:ux<0?-1:1};}
function gunStep(rdt){const g=gunState(),P=G.ptr,o=gunGeo(),on=G.tool==="gun";
  g.vis+=((on?1:0)-g.vis)*Math.min(1,rdt*14);if(Math.abs(g.vis-(on?1:0))<.003)g.vis=on?1:0;
  const tx=P.x>0?P.x:G.vw*.42,ty=P.x>0?P.y:G.vh*.5;
  let da=Math.atan2(ty-o.py,tx-o.px)-g.a;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;g.a+=da*Math.min(1,rdt*30);
  g.off+=(Math.max(0,o.L+38*o.s-Math.hypot(tx-o.px,ty-o.py))-g.off)*Math.min(1,rdt*20);
  g.rc*=Math.exp(-rdt*24);g.heat=Math.max(0,g.heat-rdt*(P.down&&on?.4:2.4));g.fl-=rdt;
  if(on&&P.down&&!G.stomp&&g.vis>.6){g.cd-=rdt;let n=0;while(g.cd<=0&&n<3){fireShot(tx,ty);g.cd+=1/GUN_RATE;n++;}}
  // 날아가는 총알
  for(let i=G.bul.length-1;i>=0;i--){const b=G.bul[i];b.t+=rdt;if(b.t>=b.dur){if(!b.done){b.done=true;bulletHit(b);}if(b.t>=b.dur+.02){G.bul[i]=G.bul[G.bul.length-1];G.bul.pop();}}}
  casStep(rdt);}
function fireShot(tx,ty){const g=gunState(),sp=(1.2+g.heat*7)*Math.sqrt(Math.random()),sa=rnd(0,6.283);
  g.rc=1;g.heat=Math.min(1.5,g.heat+.085);g.fl=.055;g.fs=rnd(.75,1.25);g.fr=rnd(-.3,.3);g.last=performance.now();
  const q=gunPose(),x1=tx+Math.cos(sa)*sp,y1=ty+Math.sin(sa)*sp;
  G.bul.push({x0:q.mx,y0:q.my,x1,y1,t:0,dur:Math.max(.012,Math.hypot(x1-q.mx,y1-q.my)/BUL_V)});
  // 탄피: 총 위쪽으로 튕겨 나감
  const nx=q.flip*Math.sin(g.a),ny=-q.flip*Math.cos(g.a),ex=q.mx-q.ux*118*q.o.s,ey=q.my-q.uy*118*q.o.s;
  if(G.cas.length>=70)G.cas.shift();
  G.cas.push({x:ex,y:ey,vx:nx*rnd(170,290)-q.ux*rnd(40,130),vy:ny*rnd(170,290)-q.uy*rnd(40,130)-rnd(40,130),rot:g.a,vr:rnd(-34,34),life:6,b:0});
  if(Math.random()<.55)smoke(q.mx+q.ux*8,q.my+q.uy*8,q.ux*rnd(20,70)+rnd(-10,10),q.uy*rnd(20,70)-rnd(10,30),rnd(4,7),rnd(.1,.18));
  G.shake=Math.min(8,G.shake+1.2);G.calm=0;
  sGun();buzz(1);}
function casStep(dt){if(!G.cas.length)return;const g=1500*gfac(),wv=G.W.vol>1;
  for(let i=G.cas.length-1;i>=0;i--){const c=G.cas[i];c.life-=dt;if(c.life<=0){G.cas.splice(i,1);continue;}
    c.vy+=g*dt;if(G.zg){const k=Math.pow(.995,dt*60);c.vx*=k;c.vy*=k;}
    if(wv&&c.y>surfY(c.x)){const k=Math.pow(.86,dt*60);c.vx*=k;c.vy=c.vy*k+60*dt;c.vr*=k;if(!c.wet){c.wet=1;sPlip(.5);}}
    c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.vr*dt;
    const fy=G.vh-2;if(c.y>fy){c.y=fy;if(c.vy>90){if(c.b<3)sTing(Math.min(1,c.vy/600)*(c.b?.6:1));c.b++;}c.vy*=-.42;c.vx*=.72;c.vr*=.55;if(Math.abs(c.vy)<40)c.vy=0;}
    if(c.x<2){c.x=2;c.vx=Math.abs(c.vx)*.5;}if(c.x>G.vw-2){c.x=G.vw-2;c.vx=-Math.abs(c.vx)*.5;}
    if(G.zg&&c.y<G.top+2){c.y=G.top+2;c.vy=Math.abs(c.vy)*.5;}}}
function bulletHit(b){const x=b.x1,y=b.y1,dx=b.x1-b.x0,dy=b.y1-b.y0,n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n,k=PK();
  for(const B of G.bombs)if(Math.hypot(B.b.position.x-x,B.b.position.y-y)<14){B.t=G.time;return;}
  if(G.W.vol>1&&y>surfY(x)-2){const ys=surfY(x);splashUp(x,ys,2,260);for(let i=0;i<6;i++)bubble(x+rnd(-3,3),Math.max(y,ys+4)+rnd(0,40),rnd(1,2.5));sPlip(1);return;}
  const hit=pieceAt(x,y);
  if(hit){gunHitPiece(hit.p,hit.L,x,y,ux,uy,k);return;}
  dustP(x,y,2,.55);if(Math.random()<.35)for(let i=0;i<3;i++){const a=rnd(0,6.28),s=rnd(150,420);spark(x,y,Math.cos(a)*s,Math.sin(a)*s-80,rnd(.06,.16));}
  addP({t:"glint",x,y,s:5,life:.06,max:.06});sWallHit();}
function gunHitPiece(p,L,x,y,ux,uy,k){const m=mat(),R=Math.max(3,p.cs*1.05)*Math.min(1.5,.85+.15*k);
  hurt(p,L.x,L.y,R,dist=>Math.max(0,1-dist/R)*.65*POW,.2,(wx,wy,q)=>{if(Math.random()<.5)crumb(wx,wy,q,null);});
  bulletMark(p,L.x,L.y,k);
  // 파편은 쏜 쪽으로 튀어나옴
  for(let i=0,n=m==="glass"?6:m==="stone"?5:4;i<n;i++){const s=rnd(90,320);shard(x,y,-ux*s*.5+rnd(-140,140),-uy*s*.5+rnd(-200,40),pickCol(p,.1),p.cs*rnd(.3,.65));}
  if(m==="stone"||m==="paper")dustP(x,y,m==="stone"?3:1,.5);
  if(m==="stone"&&Math.random()<.6)for(let i=0;i<3;i++){const a=rnd(0,6.28),s=rnd(150,400);spark(x,y,Math.cos(a)*s,Math.sin(a)*s-60,rnd(.05,.14));}
  addP({t:"glint",x,y,s:m==="glass"?9:5,life:m==="glass"?.14:.06,max:m==="glass"?.14:.06});
  sBulletHit(m);
  const b=p.body;
  if(p.pin){const S=str();p.gunN=(p.gunN||0)+POW;if(p.gunN>=6*S||Math.random()<.035*POW/S)release(p);}
  if(!p.pin){const mm=Math.sqrt(Math.max(1,b.mass/3)),dv=(1.1+.9*k)/mm,rx=x-b.position.x,ry=y-b.position.y;
    Matter.Body.setVelocity(b,{x:b.velocity.x+ux*dv,y:b.velocity.y+uy*dv-.4/mm});Matter.Body.setAngularVelocity(b,b.angularVelocity+(rx*uy-ry*ux)*dv*.0016);}}
// 총알 자국 (조각 좌표): 재질마다 다름 + 칸보다 작은 진짜 구멍
function bulletMark(p,lx,ly,k){const m=mat(),x=mkCtx(p),h=hoCtx(p),r=rnd(1.9,2.5)*Math.min(1.5,.8+.2*k),dk=isDark();
  x.lineCap="round";h.fillStyle="#000";
  if(m==="glass"){
    // 깨진 유리 가루로 하얗게 된 테 + 방사형 금 + 고리
    const g=x.createRadialGradient(lx,ly,r*.8,lx,ly,r*3.2);g.addColorStop(0,"rgba(255,255,255,.85)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.beginPath();x.arc(lx,ly,r*3.2,0,7);x.fill();
    const n=8+((Math.random()*5)|0),rays=[];
    for(let i=0;i<n;i++){let a=i/n*6.283+rnd(-.25,.25),px=lx+Math.cos(a)*r,py=ly+Math.sin(a)*r;const len=rnd(9,30)*Math.sqrt(k),pts=[[px,py]];
      for(let d=0;d<len;d+=4){a+=rnd(-.08,.08);px+=Math.cos(a)*4;py+=Math.sin(a)*4;pts.push([px,py]);}rays.push(pts);glassLine(x,pts);}
    for(const f of [.35,.65])for(let i=0;i<n;i++){const A=rays[i],B=rays[(i+1)%n],ia=Math.floor(A.length*f),ib=Math.floor(B.length*f*rnd(.85,1.15));
      if(Math.random()<.35||ia>=A.length||ib>=B.length)continue;glassLine(x,[A[ia],B[ib]]);}
    jagPath(h,lx,ly,r*.85,9,.25);h.fill();}
  else if(m==="wood"){
    // 결 따라 찢겨 일어난 생나무 섬유
    const gr=p.gr||0,ca=Math.cos(gr),sa=Math.sin(gr);
    for(let i=0;i<10;i++){const s=Math.random()<.5?-1:1,len=r*rnd(1.5,4.8),o=rnd(-r,r);x.strokeStyle=dk?`rgba(205,170,120,${rnd(.4,.8)})`:`rgba(248,226,186,${rnd(.55,.95)})`;x.lineWidth=rnd(.4,.9);
      x.beginPath();x.moveTo(lx-sa*o,ly+ca*o);x.lineTo(lx-sa*o+ca*len*s,ly+ca*o+sa*len*s);x.stroke();}
    x.fillStyle="rgba(40,20,6,.75)";jagPath(x,lx,ly,r*1.35,10,.3);x.fill();
    h.save();h.translate(lx,ly);h.rotate(gr);h.scale(1.25,.8);jagPath(h,0,0,r,10,.2);h.fill();h.restore();}
  else if(m==="stone"){
    // 떨어져 나간 자리(새로 드러난 돌은 밝음) + 실금
    x.fillStyle=dk?"rgba(150,152,158,.55)":"rgba(238,236,230,.82)";jagPath(x,lx,ly,r*rnd(2.2,3),11,.35);x.fill();
    x.fillStyle=dk?"rgba(0,0,0,.35)":"rgba(90,88,84,.45)";jagPath(x,lx,ly,r*1.5,9,.3);x.fill();
    x.strokeStyle=dk?"rgba(0,0,0,.6)":"rgba(40,38,36,.55)";x.lineWidth=.45;
    for(let i=0,n=3+((Math.random()*3)|0);i<n;i++){let a=rnd(0,6.28),px=lx,py=ly;x.beginPath();x.moveTo(px,py);for(let s=0,L=r*rnd(2,5);s<L;s+=2){a+=rnd(-.4,.4);px+=Math.cos(a)*2;py+=Math.sin(a)*2;x.lineTo(px,py);}x.stroke();}
    jagPath(h,lx,ly,r*.7,8,.3);h.fill();}
  else{
    // 화약 그을음 + 찢긴 테
    const g=x.createRadialGradient(lx,ly,r,lx,ly,r*3.4);g.addColorStop(0,dk?"rgba(0,0,0,.5)":"rgba(40,34,30,.38)");g.addColorStop(1,"rgba(40,34,30,0)");x.fillStyle=g;x.beginPath();x.arc(lx,ly,r*3.4,0,7);x.fill();
    x.fillStyle=dk?"rgba(0,0,0,.85)":"rgba(28,24,20,.8)";jagPath(x,lx,ly,r*1.32,11,.28);x.fill();
    x.strokeStyle=dk?"rgba(0,0,0,.7)":"rgba(28,24,20,.6)";x.lineWidth=.5;
    for(let i=0,n=3+((Math.random()*3)|0);i<n;i++){const a=rnd(0,6.28),L=r*rnd(1.6,2.8);x.beginPath();x.moveTo(lx+Math.cos(a)*r,ly+Math.sin(a)*r);x.lineTo(lx+Math.cos(a+rnd(-.2,.2))*L,ly+Math.sin(a+rnd(-.2,.2))*L);x.stroke();}
    jagPath(h,lx,ly,r,10,.25);h.fill();}
  p.dirty=true;}
function sGun(){const c=audio();if(!c)return;const t=c.currentTime,v=rnd(.92,1.08);
  burst(c,t,"highpass",1500*v,.6,.5,.045);burst(c,t,"lowpass",1200*v,.7,.55,.11);tone(c,t,"sine",170*v,44,.7,.12);burst(c,t+.003,"bandpass",4600,1.4,.1,.018);
  const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type="lowpass";f.frequency.setValueAtTime(1000,t);f.frequency.exponentialRampToValueAtTime(200,t+.38);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.14,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.42);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random()*1.5);n.stop(t+.45);}
function sTing(k){const c=AU.ctx;if(!c)return;const t=c.currentTime,f=rnd(3600,5200);tone(c,t,"sine",f,f*.995,.06*k,.16);tone(c,t,"sine",f*1.51,f*1.5,.035*k,.1);tone(c,t,"triangle",f*.5,f*.5,.02*k,.06);}
function sPlip(k){const c=AU.ctx;if(!c)return;const t=c.currentTime,f=rnd(700,1100);tone(c,t,"sine",f,f*2.2,.08*k,.08);burst(c,t,"bandpass",1800,1.5,.08*k,.04);}
function sBulletHit(m){const c=AU.ctx;if(!c)return;const t=c.currentTime;
  if(m==="glass"){burst(c,t,"highpass",4200,.8,.22,.05);for(let i=0;i<3;i++){const f=rnd(3000,7000);tone(c,t+rnd(0,.05),"sine",f,f,.04,rnd(.05,.12));}}
  else if(m==="wood"){burst(c,t,"bandpass",rnd(800,1200),2,.3,.05);tone(c,t,"triangle",rnd(300,380),220,.12,.06);}
  else if(m==="stone"){burst(c,t,"bandpass",rnd(2200,3400),2.5,.22,.03);tone(c,t,"sine",130,70,.12,.06);burst(c,t+.01,"lowpass",900,.7,.12,.06);}
  else{burst(c,t,"bandpass",rnd(1300,1900),1.2,.22,.035);burst(c,t,"lowpass",500,.7,.1,.05);}}
function sWallHit(){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"bandpass",rnd(1400,2200),1.2,.16,.04);tone(c,t,"sine",210,110,.08,.06);
  // 가끔 도탄 소리
  if(Math.random()<.08){const o=c.createOscillator(),g=c.createGain(),f0=rnd(2400,3200);o.type="sine";o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f0*.38,t+.4);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.05,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.42);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+.45);}}
// 총: 총구가 원점, +x가 앞. 옆에서 본 모양을 겨눈 방향으로 돌리고, 왼쪽을 겨누면 위아래를 뒤집어 늘 가늠자가 위로
function drawGun(c){const g=gunState();if(g.vis<.01)return;const q=gunPose(),s=q.o.s;
  c.save();c.translate(q.mx,q.my);c.rotate(g.a);c.scale(s,q.flip*s);
  c.shadowColor="rgba(0,0,0,.35)";c.shadowBlur=12;c.shadowOffsetX=4;c.shadowOffsetY=8;
  const steel=(y0,y1,a,b,cc)=>{const gr=c.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,a);gr.addColorStop(.35,b);gr.addColorStop(1,cc);return gr;};
  // 개머리 · 손잡이 · 탄창 (대부분 화면 밖)
  c.fillStyle=steel(-9,9,"#3b3e44","#25272c","#121316");
  c.beginPath();c.moveTo(-330,-8);c.lineTo(-222,-9);c.lineTo(-222,9);c.lineTo(-300,16);c.lineTo(-330,16);c.closePath();c.fill();
  c.beginPath();c.moveTo(-222,8);c.lineTo(-206,8);c.lineTo(-212,40);c.quadraticCurveTo(-220,44,-228,38);c.closePath();c.fill();
  c.fillStyle=steel(14,50,"#33363c","#202226","#0e0f11");
  c.beginPath();c.moveTo(-196,12);c.lineTo(-171,12);c.quadraticCurveTo(-166,30,-160,46);c.lineTo(-182,51);c.quadraticCurveTo(-189,32,-196,12);c.closePath();c.fill();
  // 몸통(리시버)
  c.fillStyle=steel(-9,10,"#41454c","#2a2d32","#141518");c.beginPath();c.roundRect(-224,-9,76,21,2.5);c.fill();
  // 총열 덮개
  c.fillStyle=steel(-7,7,"#3d4046","#26282d","#131416");c.beginPath();c.roundRect(-150,-7,84,14,3);c.fill();
  // 총열 · 가스 블록 · 가늠쇠 · 소염기
  c.fillStyle=steel(-2.4,2.4,"#a2a8b1","#4b5058","#1c1e22");c.fillRect(-66,-2.4,52,4.8);
  c.fillStyle=steel(-5,5,"#4a4e55","#2b2e33","#16171a");c.fillRect(-68,-5,9,10);
  c.beginPath();c.moveTo(-68,-5);c.lineTo(-59,-5);c.lineTo(-61.5,-14);c.lineTo(-65,-14);c.closePath();c.fill();
  c.fillStyle=steel(-3.4,3.4,"#b4bac3","#565b63","#1b1d21");c.fillRect(-16,-3.4,16,6.8);
  c.shadowColor="transparent";
  c.fillStyle="#08090a";for(let i=0;i<3;i++){c.fillRect(-12.5+i*3.6,-3.5,1.5,2.4);c.fillRect(-12.5+i*3.6,1.1,1.5,2.4);}
  // 레일 톱니 · 덮개 구멍 · 배출구 · 장전 손잡이
  c.fillStyle="#2c2f35";c.fillRect(-222,-12,74,3);c.fillRect(-148,-9.4,80,2.6);
  c.fillStyle="#0d0e10";for(let x=-220;x<-70;x+=3.3)c.fillRect(x,x<-148?-12:-9.4,1.3,x<-148?3:2.6);
  for(let i=0;i<6;i++){c.beginPath();c.roundRect(-142+i*12.5,-2,8,3.6,1.8);c.fill();}
  c.fillStyle="rgba(255,255,255,.13)";for(let i=0;i<6;i++)c.fillRect(-141+i*12.5,1.7,6,.7);
  c.fillStyle="#0a0b0c";c.fillRect(-194,-3,22,6);c.fillStyle="rgba(214,170,80,.55)";if(g.rc>.5)c.fillRect(-189,-2,10,4);
  c.fillStyle="#1b1c1f";c.fillRect(-221,-15,9,3.2);c.beginPath();c.arc(-162,5,2.6,0,7);c.fill();
  c.fillStyle="rgba(255,255,255,.16)";c.fillRect(-222,-8.3,72,1);c.fillRect(-148,-6.3,80,.9);c.fillRect(-64,-2,48,.8);
  c.restore();}
// 총구 불꽃 · 총알 빛줄기 (lighter로 겹쳐 그림)
function drawGunFx(c){const g=G.gun;if(!g)return;
  for(const b of G.bul){const dx=b.x1-b.x0,dy=b.y1-b.y0,n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n,u=Math.min(1,b.t/b.dur),done=b.t>=b.dur;
    const hx=b.x0+dx*u,hy=b.y0+dy*u,tl=Math.min(n*u,done?40:95),tx=hx-ux*tl,ty=hy-uy*tl,w=2.6-1.4*u,al=done?.5:1;
    let gr=c.createLinearGradient(tx,ty,hx,hy);gr.addColorStop(0,"rgba(255,150,50,0)");gr.addColorStop(1,`rgba(255,196,110,${.55*al})`);
    c.globalAlpha=1;c.strokeStyle=gr;c.lineWidth=w*3.4;c.lineCap="round";c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();
    gr=c.createLinearGradient(tx,ty,hx,hy);gr.addColorStop(0,"rgba(255,236,200,0)");gr.addColorStop(1,`rgba(255,253,244,${al})`);
    c.strokeStyle=gr;c.lineWidth=w;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();}
  if(g.fl>0&&g.vis>.5){const q=gunPose(),a=Math.min(1,g.fl/.055),s=q.o.s*g.fs;
    c.globalAlpha=.22*a;const R=130*q.o.s;c.drawImage(SPR.glow,q.mx-R,q.my-R,R*2,R*2);
    c.save();c.translate(q.mx,q.my);c.rotate(g.a+g.fr*.15);c.scale(s,s*q.flip);
    c.globalAlpha=a;c.drawImage(SPR.glow,-22,-22,44,44);c.drawImage(SPR.fCore,-4,-7,46,14);c.drawImage(SPR.fCore,2,-3.5,30,7);
    for(const r of [-.85,.85]){c.save();c.rotate(r+g.fr);c.drawImage(SPR.fCore,0,-3.5,18*rnd(.8,1.2),7);c.restore();}
    c.restore();}}
function drawCas(c){for(const q of G.cas){c.save();c.globalAlpha=Math.min(1,q.life/.6);c.translate(q.x,q.y);c.rotate(q.rot);c.drawImage(SPR.case,-4,-1.75,8,3.5);c.restore();}}

// ── 바주카포 ──
// 3D(bazooka3d.js)로 그림: 고르면 발사관이 올라오고, 누르면 3D에서 날아가 맞은 순간 여기서 부숨. 3D를 못 쓰면 아래 2D 그림으로
let BZ3=null;
function bzOn(){import("./bazooka3d.js").then(async m=>{BZ3=m;await m.bzReady();if(G&&G.tool==="bazooka"){m.bz.show(true);G.bz3d=true;const P=G.ptr;m.bz.aim(P.x>0?P.x:G.vw*.45,P.x>0?P.y:G.vh*.42);}}).catch(e=>{console.error(e);if(G)G.bz3d=false;});}
function bzOff(){if(BZ3)BZ3.bz.show(false);if(G)G.bz3d=false;}
function bz3dFire(x,y){BZ3.bz.aim(x,y);
  BZ3.bz.fire(x,y,{colors:[...new Set(G.pieces.filter(p=>!p.dead).flatMap(p=>p.colors||[]))].slice(0,14),
    launch:()=>{sBzFire();buzz([3,40,2]);if(!G)return;G.shake=Math.min(30,G.shake+9);G.flash=Math.min(.25,G.flash+.08);G.calm=0;},
    ignite:()=>sRocketIgnite(),loop:v=>sLoopSet("rk",v,mkRocket),load:()=>sBzLoad(),
    hit:(hx,hy)=>{if(!G)return;explode(hx,hy,1.75);G.hit=Math.max(G.hit,.06);G.shake=Math.min(36,G.shake+16);G.flash=Math.min(.45,G.flash+.15);G.calm=0;
      for(let i=0;i<10;i++)smoke(hx+rnd(-30,30),hy+rnd(-20,10),rnd(-30,30),rnd(-120,-40),rnd(20,36),rnd(.4,.6));sBoom(1.5);setTimeout(()=>sBoom(.35),140);buzz([3,60,3,90,2,120,1]);}});}
// 어깨에 멘 발사관(RPG-7 꼴: 녹색 관 · 나무 열가림막 · 손잡이 · 조준경, 앞에 원뿔 탄두)을 화면 오른쪽 아래에서 겨눔. 톡 누르면:
// 관 속 발사 화약이 터져(총구 불꽃 · 연기, 등 뒤 후폭풍은 화면 오른쪽 아래에서 흙먼지·연기로 밀려 들어옴) 탄이 느리게 튀어 나감 →
// 꼬리 날개가 펴지고 0.1초 뒤 로켓 모터 점화(번쩍) → 빠르게 가속하며 누른 곳(벽 쪽, 화면 속)으로 날아감.
// 멀어질수록 작아지고, 날개 때문에 빙글 돌며 살짝 나선으로 흔들리고, 꼬리 불꽃 뒤로 흰 연기 줄이 남아 천천히 부풀며 흩어짐 → 누른 곳에서 크게 터짐(폭탄보다 셈)
// 쏜 뒤엔 새 탄두를 끼우는 동안 못 쏨
const BZ_RELOAD=1.2,RK_V0=430,RK_ACC=4300,RK_VMAX=2600,RK_Z=900,RK_K=2.3,RS_MAX=420;   // RK_Z: 벽까지 깊이(가상) · RK_K: 원근 세기
function bzState(){return G.bz||(G.bz={a:-2.3,rc:0,vis:0,off:0,load:1,fl:0});}
function bzGeo(){const s=clamp(Math.min(G.vw,G.vh)/320,1,1.7);return{s,px:G.vw+40*s,py:G.vh+46*s,L:268*s};}
function bzPose(){const g=bzState(),o=bzGeo(),ux=Math.cos(g.a),uy=Math.sin(g.a),back=g.off+g.rc*26*o.s+(1-g.vis)*300*o.s;
  return{o,ux,uy,mx:o.px+ux*(o.L-back),my:o.py+uy*(o.L-back),flip:ux<0?-1:1};}
function bzStep(rdt){const g=bzState(),P=G.ptr,o=bzGeo(),on=G.tool==="bazooka";
  g.vis+=((on?1:0)-g.vis)*Math.min(1,rdt*9);if(Math.abs(g.vis-(on?1:0))<.003)g.vis=on?1:0;
  const tx=P.x>0?P.x:G.vw*.42,ty=P.x>0?P.y:G.vh*.45;
  // 무거워서 총보다 천천히 따라옴 · 쏘면 크게 들렸다가 내려옴
  let da=Math.atan2(ty-o.py,tx-o.px)-g.a-g.rc*.16;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;g.a+=da*Math.min(1,rdt*11);
  g.off+=(Math.max(0,o.L+70*o.s-Math.hypot(tx-o.px,ty-o.py))-g.off)*Math.min(1,rdt*12);
  g.rc*=Math.exp(-rdt*5.5);g.fl-=rdt;
  if(g.load<1){const was=g.load;g.load=Math.min(1,g.load+rdt/BZ_RELOAD);if(was<.55&&g.load>=.55)sBzSlide();if(g.load>=1)sBzLoad();}
  rocketStep(rdt);rsStep(rdt);}
// 로켓 연기 (밝은 회색 · 천천히 부풀고 위로 떠오르며 바람에 흩어짐)
function rsmoke(x,y,vx,vy,r,gr,a,L){if(G.rs.length>=RS_MAX)G.rs.shift();G.rs.push({x,y,vx,vy,r,gr,a,life:L,max:L,sd:Math.random()*6.28});}
function rsStep(dt){const A=G.rs;if(!A.length)return;const gf=gfac();
  for(let i=A.length-1;i>=0;i--){const q=A[i];q.life-=dt;if(q.life<=0){A[i]=A[A.length-1];A.pop();continue;}
    const k=Math.pow(.2,dt);q.vx=q.vx*k+Math.sin(G.time*.7+q.sd)*6*dt;q.vy=q.vy*k-14*gf*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.r+=q.gr*dt*(q.life/q.max);}}
function fireRocket(tx,ty){const g=bzState();if(g.load<1||g.vis<.75||G.stomp)return;
  const q=bzPose(),s=q.o.s,x0=q.mx+q.ux*30*s,y0=q.my+q.uy*30*s,D=Math.max(40,Math.hypot(tx-x0,ty-y0)),DL=Math.hypot(D,RK_Z*s);
  g.load=0;g.rc=1;g.fl=.09;G.calm=0;
  G.rk.push({x0,y0,x:x0,y:y0,tx,ty,ux:(tx-x0)/D,uy:(ty-y0)/D,D,DL,d:0,v:RK_V0,t:0,ign:false,rot:Math.random()*6.28,sp:rnd(.8,1.2),wp:rnd(0,6.28),acc:0,sc:1,px:x0-(tx-x0)/D*124*s,py:y0-(ty-y0)/D*124*s});
  // 총구: 발사 화약 불꽃 · 회색 연기 고리
  for(let i=0;i<10;i++){const a=Math.atan2(q.uy,q.ux)+rnd(-1.2,1.2),v=rnd(40,260);rsmoke(x0+rnd(-6,6),y0+rnd(-6,6),Math.cos(a)*v,Math.sin(a)*v,rnd(8,15)*s,rnd(30,70),rnd(.28,.45),rnd(1.2,2.2));}
  for(let i=0;i<12;i++){const a=Math.atan2(q.uy,q.ux)+rnd(-.5,.5),v=rnd(200,700);spark(x0,y0,Math.cos(a)*v,Math.sin(a)*v,rnd(.08,.2));}
  // 후폭풍: 등 뒤로 뿜어진 불길이 화면 오른쪽 아래 구석에서 연기·흙먼지로 밀려 들어옴
  for(let i=0;i<22;i++){const ex=G.vw+rnd(-20,30),ey=G.vh+rnd(-30,20),a=rnd(Math.PI*1.05,Math.PI*1.45),v=rnd(120,520);
    rsmoke(ex,ey,Math.cos(a)*v,Math.sin(a)*v,rnd(26,60)*s,rnd(60,140),rnd(.3,.55),rnd(1.6,3));}
  addP({t:"glint",x:G.vw-8,y:G.vh-8,s:180*s,life:.12,max:.12,w:1});
  G.flash=Math.min(.3,G.flash+.12);G.shake=Math.min(30,G.shake+11);G.hit=Math.max(G.hit,.02);
  sBzFire();buzz([3,40,2]);}
function rocketStep(dt){const A=G.rk;if(!A.length){if(AU.rk)sLoopSet("rk",0,mkRocket);return;}let loud=0;
  for(let i=A.length-1;i>=0;i--){const r=A[i];r.t+=dt;
    if(!r.ign&&r.t>.1){r.ign=true;sRocketIgnite();
      for(let k=0;k<8;k++){const a=Math.atan2(-r.uy,-r.ux)+rnd(-.6,.6),v=rnd(150,500);fire(r.x,r.y,Math.cos(a)*v,Math.sin(a)*v,rnd(6,11)*r.sc);}}
    r.v=r.ign?Math.min(RK_VMAX,r.v+RK_ACC*dt):r.v*Math.pow(.6,dt);r.d+=r.v*dt;
    // 화면 속(벽 쪽)으로 곧게 날아감: 실제로 간 비율 u → 원근으로 화면 위치 f(처음엔 빨리 지나가고 멀수록 천천히)와 크기 sc
    const u=Math.min(1,r.d/r.DL),f=u*(1+RK_K)/(1+RK_K*u);r.sc=1/(1+RK_K*u);
    // 날개 때문에 빙글 돌며(초당 몇 바퀴) 살짝 나선으로 흔들림 · 처음엔 아래로 조금 처졌다가 점화하면 바로잡힘
    r.rot+=dt*(r.ign?26:8)*r.sp;const nx=-r.uy,ny=r.ux,wa=(4+5*u)*r.sc*Math.min(1,r.t*6);
    if(!r.ign){r.dv=(r.dv||0)+300*dt;r.dy=(r.dy||0)+r.dv*dt;}else r.dy=(r.dy||0)*Math.pow(.015,dt);
    const off=Math.sin(r.rot*.5+r.wp)*wa,ox=r.x,oy=r.y;
    r.x=r.x0+r.ux*r.D*f+nx*off;r.y=r.y0+r.uy*r.D*f+ny*off+r.dy*(1-u);
    // 꼬리 연기: 지나간 길을 따라 빈틈없이 (점화 전엔 옅게)
    const kk=r.sc*bzGeo().s,tlx=r.x-r.ux*124*kk,tly=r.y-r.uy*124*kk,seg=Math.hypot(tlx-r.px,tly-r.py),stp=Math.max(2.5,6*r.sc);r.acc+=seg;
    while(r.acc>=stp){r.acc-=stp;const f=seg>0?1-r.acc/seg:1,x=r.px+(tlx-r.px)*f,y=r.py+(tly-r.py)*f;
      if(r.ign)rsmoke(x+rnd(-1.5,1.5),y+rnd(-1.5,1.5),-r.ux*rnd(10,40)+rnd(-18,18),-r.uy*rnd(10,40)+rnd(-18,18),(4.5+rnd(0,2.5))*kk,rnd(14,30)*(1.2-u*.5),rnd(.32,.5),rnd(1.6,2.8));
      else if(Math.random()<.35)rsmoke(x,y,rnd(-10,10),rnd(-10,10),3*r.sc,12,.2,.8);}
    r.px=tlx;r.py=tly;
    if(r.ign&&Math.random()<.5)spark(tlx,tly,-r.ux*rnd(150,400)+rnd(-80,80),-r.uy*rnd(150,400)+rnd(-80,80),rnd(.06,.16));
    loud=Math.max(loud,r.ign?.12*(1-u*.6):.03);
    if(r.d>=r.DL){A.splice(i,1);rocketHit(r);}}
  sLoopSet("rk",loud,mkRocket);}
// 맞은 곳: 폭탄보다 큰 폭발 + 충격파 + 버섯처럼 피어오르는 검은 연기 · 흙먼지
function rocketHit(r){const x=r.tx,y=r.ty,s=bzGeo().s;
  explode(x,y,1.75);
  for(let i=0;i<18;i++){const a=rnd(0,6.283),v=rnd(60,260);rsmoke(x+rnd(-10,10),y+rnd(-10,10),Math.cos(a)*v,Math.sin(a)*v-rnd(40,140),rnd(16,30)*s,rnd(50,110),rnd(.35,.6),rnd(2,3.6));}
  for(let i=0;i<14;i++)smoke(x+rnd(-30,30),y+rnd(-20,10),rnd(-30,30),rnd(-120,-40),rnd(20,36),rnd(.5,.75));
  addP({t:"ring",x,y,life:.5,max:.5,R:300*PK()});addP({t:"dring",x,y,life:.7,max:.7,R:260*PK()});
  addP({t:"glint",x,y,s:200,life:.14,max:.14,w:1});
  G.hit=Math.max(G.hit,.06);G.shake=Math.min(36,G.shake+16);G.flash=Math.min(.55,G.flash+.18);
  sBoom(1.5);setTimeout(()=>sBoom(.35),140);buzz([3,60,3,90,2,120,1]);}
// 발사관 (옆모습, 총구가 원점 · +x가 앞). 왼쪽을 겨누면 위아래를 뒤집어 조준경이 늘 위로
function bzTubeGr(c,r,a,b,cc){const g=c.createLinearGradient(0,-r,0,r);g.addColorStop(0,a);g.addColorStop(.28,b);g.addColorStop(.62,cc);g.addColorStop(1,"#12140d");return g;}
function warhead(c,dx,alpha,fins,rot){c.save();c.translate(dx,0);c.globalAlpha*=alpha;
  // 꼬리(추진관) · 날개 · 탄두 몸통(배가 부른 원뿔) · 앞 신관
  c.fillStyle=bzTubeGr(c,6,"#7d8466","#565c45","#363a2a");c.fillRect(-62,-6,64,12);
  if(fins>0){const L=26*fins;for(let i=0;i<4;i++){const ph=rot+i*Math.PI/2,v=Math.sin(ph);if(Math.cos(ph)<-.2)continue;c.fillStyle=Math.cos(ph)>.4?"#6f7558":"#4a4f39";
    c.beginPath();c.moveTo(-60,v*5);c.lineTo(-60+L*.15,v*(5+L*.8));c.lineTo(-38,v*(5+L*.5));c.lineTo(-38,v*5);c.closePath();c.fill();}}
  c.fillStyle="#2b2e22";c.fillRect(-64,-7,4,14);
  c.fillStyle=bzTubeGr(c,19,"#9aa07e","#6b7253","#454a35");
  c.beginPath();c.moveTo(0,-8);c.bezierCurveTo(8,-18,22,-20,40,-19);c.lineTo(58,-17);c.bezierCurveTo(78,-14,96,-6,112,-2.6);c.lineTo(112,2.6);c.bezierCurveTo(96,6,78,14,58,17);c.lineTo(40,19);c.bezierCurveTo(22,20,8,18,0,8);c.closePath();c.fill();
  c.fillStyle="rgba(0,0,0,.3)";c.fillRect(38,-19.2,3,38.4);c.fillRect(56,-17.4,2.2,34.8);
  c.fillStyle="#c9b46a";c.fillRect(24,-19.4,6,38.8);   // 띠
  c.fillStyle="rgba(255,255,255,.22)";c.beginPath();c.moveTo(6,-11);c.bezierCurveTo(16,-16,30,-17,56,-15);c.bezierCurveTo(78,-12,94,-6,108,-3);c.lineTo(106,-1.5);c.bezierCurveTo(88,-4,70,-9,50,-11.5);c.bezierCurveTo(30,-13,16,-12,6,-8);c.closePath();c.fill();
  c.fillStyle="#3a3d33";c.beginPath();c.roundRect(110,-3.4,12,6.8,2);c.fill();c.fillStyle="#9a9c92";c.fillRect(120,-1.6,3.5,3.2);
  c.restore();}
function drawBazooka(c){const g=bzState();if(g.vis<.01||G.bz3d)return;const q=bzPose(),s=q.o.s;
  c.save();c.translate(q.mx,q.my);c.rotate(g.a);c.scale(s,q.flip*s);
  c.shadowColor="rgba(0,0,0,.38)";c.shadowBlur=16;c.shadowOffsetX=5;c.shadowOffsetY=10;
  // 탄두: 끼워져 있으면 관 앞에 · 다시 끼우는 동안엔 앞에서 밀려 들어옴 (꼬리는 관 속)
  if(g.load>=.55){const u=sst((g.load-.55)/.45);warhead(c,(1-u)*70,Math.min(1,u*2.5),0,0);}
  // 관 (뒤쪽 깔때기는 화면 밖) · 총구 테
  c.fillStyle=bzTubeGr(c,13,"#7a8163","#545a43","#3a3e2e");c.beginPath();c.roundRect(-520,-13,520,26,3);c.fill();
  c.shadowColor="transparent";
  c.fillStyle=bzTubeGr(c,15,"#5c614c","#3d4133","#26291f");c.beginPath();c.roundRect(-14,-15,16,30,3);c.fill();
  c.fillStyle="#141610";c.beginPath();c.ellipse(1.5,0,3,11,0,0,7);c.fill();
  // 나무 열가림막 (나뭇결 · 금속 띠)
  const wg=c.createLinearGradient(0,-16,0,16);wg.addColorStop(0,"#b07a45");wg.addColorStop(.3,"#8a5a2e");wg.addColorStop(.75,"#5e3b1c");wg.addColorStop(1,"#2e1c0c");
  c.fillStyle=wg;c.beginPath();c.roundRect(-322,-16,118,32,6);c.fill();
  c.strokeStyle="rgba(40,22,8,.45)";c.lineWidth=.8;for(let i=0;i<7;i++){const y=-12+i*4;c.beginPath();c.moveTo(-318,y);c.bezierCurveTo(-290,y+rnd(-.3,.3)+1.2,-250,y-1.4,-208,y+.6);c.stroke();}
  c.fillStyle="#2c2f27";c.fillRect(-326,-16.5,6,33);c.fillRect(-208,-16.5,6,33);
  // 손잡이 · 방아쇠 · 앞 손잡이
  c.fillStyle="#2a241c";c.beginPath();c.moveTo(-282,13);c.lineTo(-262,13);c.lineTo(-256,52);c.quadraticCurveTo(-262,58,-272,56);c.lineTo(-278,30);c.closePath();c.fill();
  c.strokeStyle="#1b1d17";c.lineWidth=2.4;c.beginPath();c.moveTo(-262,14);c.quadraticCurveTo(-246,16,-244,30);c.quadraticCurveTo(-252,34,-258,32);c.stroke();
  c.fillStyle="#111";c.fillRect(-256,15,3,10);
  c.fillStyle="#2a241c";c.beginPath();c.moveTo(-196,13);c.lineTo(-180,13);c.lineTo(-178,44);c.quadraticCurveTo(-184,49,-192,46);c.closePath();c.fill();
  // 조준경 (관 위 왼쪽) · 앞·뒤 가늠자
  c.fillStyle=bzTubeGr(c,9,"#3f443a","#2a2d26","#171914");c.beginPath();c.roundRect(-300,-34,74,15,3);c.fill();
  c.fillStyle="#22251e";c.fillRect(-290,-20,10,8);c.fillRect(-246,-20,10,8);c.beginPath();c.roundRect(-310,-35,14,17,3);c.fill();
  c.fillStyle="#0a1418";c.fillRect(-226,-32,4,11);c.fillStyle="rgba(120,200,255,.5)";c.fillRect(-225,-30,1.6,4);
  c.fillStyle="#2a2d26";c.fillRect(-62,-22,4,9);c.fillRect(-150,-19,8,6);
  // 하이라이트 · 흠집
  c.fillStyle="rgba(255,255,255,.14)";c.fillRect(-520,-10.5,516,2.2);c.fillRect(-300,-32,72,1.6);
  c.fillStyle="rgba(0,0,0,.18)";for(const x of [-120,-96,-404,-440])c.fillRect(x,-13,1.2,26);
  c.restore();}
const sst=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// 날아가는 탄: 앞으로 갈수록 작게 · 꼬리 날개가 돌아감
function drawRockets(c){if(!G.rk.length)return;const s=bzGeo().s;
  for(const r of G.rk){c.save();c.translate(r.x,r.y);c.rotate(Math.atan2(r.uy,r.ux));const k=s*r.sc;c.scale(k,k);
    c.shadowColor="rgba(0,0,0,.3)";c.shadowBlur=8;c.shadowOffsetY=5;warhead(c,-60,1,Math.min(1,r.t/.07),r.rot);c.restore();}}
// 빛: 총구 불꽃 · 로켓 꼬리 불길 (더하기 합성)
function drawBzFx(c){const g=G.bz;
  if(g&&g.fl>0&&g.vis>.5){const q=bzPose(),a=Math.min(1,g.fl/.09),s=q.o.s;
    c.globalAlpha=.35*a;const R=220*s;c.drawImage(SPR.glow,q.mx-R,q.my-R,R*2,R*2);
    c.save();c.translate(q.mx,q.my);c.rotate(g.a);c.scale(s,s);c.globalAlpha=a;c.drawImage(SPR.fCore,-10,-26,120,52);c.drawImage(SPR.fire,0,-34,90,68);c.restore();}
  const s=bzGeo().s;
  for(const r of G.rk){if(!r.ign)continue;const k=s*r.sc,fl=rnd(.85,1.15),tx=r.x-r.ux*124*k,ty=r.y-r.uy*124*k,ang=Math.atan2(r.uy,r.ux);
    c.globalAlpha=.5;let R=70*k*fl;c.drawImage(SPR.glow,tx-R,ty-R,R*2,R*2);
    c.save();c.translate(tx,ty);c.rotate(ang+Math.PI);c.scale(k,k);
    c.globalAlpha=.85;c.drawImage(SPR.fTail,-6,-14*fl,92*fl,28*fl);c.globalAlpha=1;c.drawImage(SPR.fCore,-8,-8,54*fl,16);c.drawImage(SPR.fCore,-6,-4.5,30,9);c.restore();}
  c.globalAlpha=1;}
function drawRSmoke(c){const A=G.rs;if(!A.length)return;
  for(const q of A){const k=q.life/q.max;c.globalAlpha=q.a*Math.min(1,k*1.4)*Math.min(1,(1-k)*8+.15);c.drawImage(SPR.rsm,q.x-q.r,q.y-q.r,q.r*2,q.r*2);}
  c.globalAlpha=1;}
// 소리: 쾅 + 쉭(관을 빠져나감) · 로켓 모터 으르렁 · 새 탄두 미는 소리 · 철컥
function sBzFire(){const c=audio();if(!c)return;const t=c.currentTime;
  tone(c,t,"sine",70,28,1,.6);burst(c,t,"lowpass",900,.7,.9,.5);burst(c,t,"highpass",2400,.6,.35,.12);
  const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type="bandpass";f.Q.value=.9;f.frequency.setValueAtTime(600,t);f.frequency.exponentialRampToValueAtTime(3200,t+.35);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.4,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.6);n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+.65);}
function sRocketIgnite(){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"bandpass",1500,.8,.35,.25);tone(c,t,"sawtooth",160,90,.06,.3);}
const mkRocket=c=>{const L=nLoop(c,"bandpass",900,.8),o=c.createOscillator(),og=c.createGain();o.type="sawtooth";o.frequency.value=74;og.gain.value=.25;o.connect(og);og.connect(L.g);o.start();L.o=o;return L;};
function sBzSlide(){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"bandpass",1400,1.6,.1,.18);}
function sBzLoad(){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"bandpass",2600,3,.32,.04);tone(c,t,"sine",420,300,.08,.08);burst(c,t+.07,"bandpass",1800,3,.2,.04);}

// ── 손바닥 필살기 (3D 손은 palm.js · 맞는 순간 여기서 부숨) ──
// 손바닥 모양으로 눌린 자국(깊이 눌린 칸은 부서져 떨어짐) · 손 둘레 칸은 갈라지며 튀어 나감 · 금이 퍼짐 →
// 오른손 패시브에 따라: 번개 = 갈래 번개가 사방으로 뻗으며 지나간 칸을 그을리고 떼어 냄 · 불 = 손 둘레에 불이 붙음 ·
// 지옥 = 더 넓고 세게 타며(구멍이 남) 검붉은 불꽃과 검은 연기 · 물 = 손바닥 둘레로 큰 물보라가 쏟아져 화면에 물이 참
// 손 윤곽: 오른손을 손등 쪽에서 본 모양 (엄지가 왼쪽) · 손바닥 너비 = 1, 손바닥 가운데가 원점, v는 손가락 쪽(위)
const HAND_O=[[-.46,-.62],[-.5,-.18],[-.66,-.06],[-.84,.18],[-.9,.32],[-.82,.4],[-.68,.3],[-.52,.12],[-.5,.42],[-.48,.5],[-.44,1.12],[-.36,1.22],[-.27,1.16],[-.24,.56],[-.2,.58],[-.14,1.3],[-.05,1.38],[.04,1.3],[.06,.6],[.1,.58],[.16,1.2],[.25,1.27],[.32,1.18],[.3,.55],[.34,.5],[.42,.95],[.5,1],[.56,.92],[.5,.4],[.52,0],[.48,-.62]];
const PASSIVE=["thunder","fire","hell","water"],PASSIVE_NM={thunder:"번개",fire:"불",hell:"지옥 (불의 상위 단계)",water:"물"};
async function startPalmFx(){if(!G||G.stomp||G.palm||crushing)return;audio();
  const el=(import.meta.env.DEV&&window.__palmEl)||PASSIVE[(Math.random()*4)|0];G.palm=true;dropDrag();sLaser(false);G.calm=0;buzz(1);const g0=G;
  try{const {startPalm}=await import("./palm.js");
    await startPalm({el,colors:[...new Set(G.pieces.filter(p=>!p.dead).flatMap(p=>p.colors||[]))].slice(0,14),sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onImpact:o=>{if(G===g0)palmImpact(o);},onEnd:()=>{if(G===g0){G.palm=false;G.calm=0;}}});
  }catch(e){console.error(e);if(G)G.palm=false;}}
function palmImpact(o){const k=PK(),m=mat(),{x:cx,y:cy,w,roll,el}=o,cr=Math.cos(roll),sr=Math.sin(roll);
  const O=HAND_O.map(([u,v])=>[cx+(u*cr-v*sr)*w,cy-(u*sr+v*cr)*w]),hx=cx-sr*w*.35,hy=cy-cr*w*.35;
  G.hit=Math.max(G.hit,.3);   // 3D 쪽과 같이 잠깐 거의 멈춤G.shake=Math.max(G.shake,30+6*Math.min(k,2));G.flash=Math.min(.5,G.flash+.2);G.calm=0;
  const inF=(x,y)=>inPoly(O,x,y),dEdge=(x,y)=>{if(inF(x,y))return 0;let d=1e9;for(const q of O){const e=Math.hypot(q[0]-x,q[1]-y);if(e<d)d=e;}return d;};
  const RB=w*(.42+.1*Math.min(k,2.5))*Math.pow(Math.max(1,str()),-.22);
  const S={cx:hx,cy:hy,ci:0,rev:0,pinned:[],cracks:makeCracks(O,hx,hy,w*1.8,clamp(.8+.3*k,.8,1.7),m==="glass"?"glass":m==="wood"?"grain":"jag",G.pieces.filter(p=>!p.dead&&p.gr).length*2>G.pieces.filter(p=>!p.dead).length?Math.PI/2:0).sort((a,b)=>a.d-b.d)};
  for(const B of G.bombs)if(dEdge(B.b.position.x,B.b.position.y)<RB)B.t=Math.min(B.t,G.time+rnd(.05,.25));
  const launch=[],cols=[];
  for(const p of G.pieces.slice()){if(p.dead)continue;
    if(p.pin){const l=p.f.cx-p.W/2,tp=p.f.cy-p.H/2;let n=0;for(let a=0;a<5;a++)for(let b=0;b<5;b++)if(inF(l+(a+.5)*p.W/5,tp+(b+.5)*p.H/5))n++;
      if(n){palmStamp(p,O);S.pinned.push(p);cols.push(...p.colors);if(n>=7)crushUnder(p,inF,k);continue;}
      const d=dEdge(p.f.cx,p.f.cy);if(d<RB||(d<RB*2.4&&Math.random()<.8*(1-(d-RB)/(RB*1.4))))launch.push([p,d]);else S.pinned.push(p);}
    else{const d=dEdge(p.f.cx,p.f.cy);if(d<RB*1.6)launch.push([p,d]);}}
  for(const [p,d] of launch)if(!p.dead)stompLaunch(p,S,d,RB,k);
  G.pcr=S;
  // 손 둘레로 밀려 나오는 먼지 · 부스러기 · 충격파
  const N=O.length,pal=matPal()||cols.concat(["#8f877c","#6f675e"]);
  for(let i=0;i<90;i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-hx,dy=py-hy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(140,600)*Math.sqrt(k);
    const L=rnd(1.2,2.2);addP({t:"dust",x:px,y:py,vx:dx*sp,vy:dy*sp*.8,r:rnd(9,20),gr:rnd(30,70),a:rnd(.3,.55),life:L,max:L});}
  for(let i=0;i<130;i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-hx,dy=py-hy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(150,760)*Math.sqrt(k);
    shard(px,py,dx*sp,dy*sp*.7-rnd(80,420),pal[(Math.random()*pal.length)|0],rnd(2,6));}
  addP({t:"dring",x:hx,y:hy,life:.6,max:.6,R:w*1.6});
  const inR=(R,f)=>{for(const p of G.pieces){if(p.dead)continue;const bb=p.body.bounds;if(bb.max.x<hx-R||bb.min.x>hx+R||bb.max.y<hy-R*1.2||bb.min.y>hy+R*1.2)continue;f(p);}};
  const spot=(p,R)=>{const a=rnd(0,6.283),r=Math.sqrt(Math.random())*R,L=toLocal(p,hx+Math.cos(a)*r,hy+Math.sin(a)*r*1.2);return L.x<0||L.y<0||L.x>p.W||L.y>p.H?null:L;};
  if(el==="fire"||el==="hell"){const hell=el==="hell",R=w*(hell?.75:.55);
    // 손바닥이 닿은 자리 둘레에서 몇 군데 불이 붙어 번짐 (지옥은 더 넓고 많이 · 더 세게)
    inR(R,p=>{for(let i=0;i<(hell?4:3);i++){const L=spot(p,R);if(!L)continue;igniteAt(p,L.x,L.y,p.cs*(hell?4:3.4),1);
      if(hell)hurt(p,L.x,L.y,p.cs*2.4,dist=>.55*POW*(1-dist/(p.cs*2.4)),1.6,(wx,wy)=>{if(Math.random()<.3)ember(wx,wy,rnd(-80,80),rnd(-160,-20));});}});
    for(let i=0;i<(hell?120:80);i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-hx,dy=py-hy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(60,380);
      fire(px+rnd(-8,8),py+rnd(-8,8),dx*sp,dy*sp-rnd(40,160),rnd(10,24)*(hell?1.25:1));if(Math.random()<.3)ember(px,py,dx*sp*1.4,dy*sp-200);}
    if(hell){for(let i=0;i<36;i++)smoke(hx+rnd(-w*.6,w*.6),hy+rnd(-w*.5,w*.7),rnd(-30,30),rnd(-110,-30),rnd(22,40),rnd(.55,.85));
      for(let i=0;i<10;i++)addP({t:"glint",x:hx+rnd(-w*.5,w*.5),y:hy+rnd(-w*.5,w*.7),s:rnd(60,120),life:.5,max:.5,w:1,red:1});}
    sBoom(hell?1.3:1);}
  else if(el==="thunder"){G.zap={x:hx,y:hy,w,left:.45};for(let i=0;i<9;i++){const a=rnd(0,6.283);zapBolt(hx,hy,a,w*rnd(.9,1.9));}sThunder();}
  else{const R=w*1.15;inR(R,p=>{for(let i=0;i<8;i++){const L=spot(p,R);if(L)wetAt(p,L.x,L.y,p.cs*3);}});
    for(let i=0;i<420;i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-hx,dy=py-hy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(250,1150);
      spawnDrop(px+rnd(-6,6),py+rnd(-6,6),dx*sp,dy*sp*.8-rnd(100,520));}
    sSplash(1);sSplash(1);}
  sStomp();}
// 손바닥에 눌린 자국 (붙어 있는 칸: 칸 좌표 = 화면 좌표 - 왼쪽 위)
function palmStamp(p,O){const x=mkCtx(p),l=p.f.cx-p.W/2,t=p.f.cy-p.H/2,dk=isDark();
  x.save();ownCells(x,p);x.translate(-l,-t);x.beginPath();O.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();
  x.fillStyle=dk?"rgba(0,0,0,.24)":"rgba(70,55,45,.11)";x.fill();x.lineJoin="round";
  x.lineWidth=4;x.strokeStyle=dk?"rgba(0,0,0,.4)":"rgba(60,45,35,.22)";x.stroke();
  x.lineWidth=1.2;x.strokeStyle=dk?"rgba(255,255,255,.08)":"rgba(255,255,255,.55)";x.translate(1.5,2);x.stroke();
  x.restore();p.dirty=true;}
// 깊이 눌린 칸: 구멍 대신 짓눌려 쩍쩍 갈라진 금 (가장자리에서 안쪽으로 몇 갈래)
function crushUnder(p,inF,k){const x=mkCtx(p),m=mat(),l=p.f.cx-p.W/2,t=p.f.cy-p.H/2;x.save();ownCells(x,p);
  for(let i=0,n=Math.random()<.55?1:0;i<n;i++){let px=rnd(0,p.W),py=rnd(0,p.H);if(!inF(l+px,t+py))continue;let a=rnd(0,6.283);
    for(let s=0,L=Math.hypot(p.W,p.H)*rnd(.2,.4);s<L;s+=4){a+=rnd(-.35,.35);const nx=px+Math.cos(a)*4,ny=py+Math.sin(a)*4;crackSeg(x,px,py,nx,ny,Math.max(.6,1.8*(1-s/L)),m);px=nx;py=ny;}}
  x.restore();p.dirty=true;}
// 번개: 갈래를 치며 뻗어 나가고, 지나간 칸은 그을리고 조금 부서지며 떨어져 나감 · 종이·나무엔 불씨
function zapBolt(x0,y0,a,L){const n=14,pts=[[x0,y0]],nx=-Math.sin(a),ny=Math.cos(a);let off=0;
  for(let i=1;i<=n;i++){const u=i/n;off=off*.5+rnd(-1,1)*L*.09;pts.push([x0+Math.cos(a)*L*u+nx*off,y0+Math.sin(a)*L*u+ny*off]);}
  G.bolts.push({pts,w:2.4,life:.32,max:.32});
  for(let k=0;k<2;k++)if(Math.random()<.7){const j=3+((Math.random()*(n-5))|0),[bx,by]=pts[j],b=a+rnd(-.9,.9),bl=L*rnd(.25,.45),bp=[[bx,by]];for(let i=1;i<=6;i++)bp.push([bx+Math.cos(b)*bl*i/6+rnd(-1,1)*bl*.08,by+Math.sin(b)*bl*i/6+rnd(-1,1)*bl*.08]);G.bolts.push({pts:bp,w:1.4,life:.3,max:.3});}
  const hitP=new Set();
  for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],h=pieceAt((ax+bx)/2,(ay+by)/2);if(!h)continue;const p=h.p,A=toLocal(p,ax,ay),B=toLocal(p,bx,by),x=mkCtx(p),dk=isDark();
    x.save();ownCells(x,p);x.lineCap="round";x.strokeStyle=dk?"rgba(0,0,0,.6)":"rgba(30,22,16,.5)";x.lineWidth=3.2;x.beginPath();x.moveTo(A.x,A.y);x.lineTo(B.x,B.y);x.stroke();
    x.strokeStyle=dk?"rgba(160,200,255,.25)":"rgba(255,255,255,.5)";x.lineWidth=.9;x.stroke();x.restore();p.dirty=true;
    hurt(p,B.x,B.y,p.cs*1.3,dist=>.4*POW*(1-dist/(p.cs*1.3)),1,null);if(burns()&&i===pts.length-1&&Math.random()<.3)igniteAt(p,B.x,B.y,p.cs*1.5,.35);
    if(Math.random()<.5)spark(bx,by,rnd(-300,300),rnd(-300,100),rnd(.1,.3));hitP.add(p);}
  for(const p of hitP)if(p.pin&&Math.random()<.45){release(p);const b=p.body;Matter.Body.setVelocity(b,{x:b.velocity.x+rnd(-3,3),y:b.velocity.y-rnd(1,4)});}}
function zapStep(dt){if(G.bolts.length)for(let i=G.bolts.length-1;i>=0;i--){const B=G.bolts[i];B.life-=dt;if(B.life<=0)G.bolts.splice(i,1);}
  const Z=G.zap;if(!Z)return;Z.left-=dt;if(Math.random()<dt*22)zapBolt(Z.x+rnd(-Z.w*.2,Z.w*.2),Z.y+rnd(-Z.w*.2,Z.w*.3),rnd(0,6.283),Z.w*rnd(.7,1.6));
  if(Math.random()<dt*8)G.flash=Math.min(.35,G.flash+.08);if(Z.left<=0)G.zap=null;}
// 번개 그리기: 밝은 화면에서도 보이게 짙은 파란 바탕선 → (더하기 합성으로) 푸른 빛 · 흰 속
function boltPath(c,B){c.beginPath();B.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));}
function drawBoltsInk(c){if(!G.bolts.length)return;c.lineCap=c.lineJoin="round";
  for(const B of G.bolts){const a=Math.min(1,B.life/B.max*1.8);c.globalAlpha=.55*a;c.strokeStyle="#1b3f9a";c.lineWidth=B.w*2.6;boltPath(c,B);c.stroke();}c.globalAlpha=1;}
function drawBoltsGlow(c){if(!G.bolts.length)return;c.lineCap=c.lineJoin="round";
  for(const B of G.bolts){const a=Math.min(1,B.life/B.max*1.8)*(Math.random()<.15?.4:1);
    c.globalAlpha=.45*a;c.strokeStyle="rgb(120,180,255)";c.lineWidth=B.w*5;boltPath(c,B);c.stroke();
    c.globalAlpha=a;c.strokeStyle="rgb(245,250,255)";c.lineWidth=B.w;boltPath(c,B);c.stroke();}c.globalAlpha=1;}
function sThunder(){const c=AU.ctx;if(!c)return;const t=c.currentTime;burst(c,t,"highpass",5000,.7,.6,.25);burst(c,t,"lowpass",1200,.7,.8,.9);tone(c,t,"sine",70,30,.7,1);
  [.3,.7,1.2].forEach((d,i)=>burst(c,t+d,"lowpass",600-i*120,.7,.4/(1+i),.9));}

// ── 거대한 발 ──
// 누르면: 하늘이 어두워지며 흐린 그림자가 점점 진하고 또렷해짐 → 워커가 위에서 확 내려와 쾅 (멈칫 · 흔들림) →
// 밟힌 칸은 자국이 찍힌 채 눌려 있고, 둘레 칸은 갈라지며 튀어 나감. 금은 남아 있는 칸을 타고 퍼짐(바탕엔 안 남김) → 발이 들려 올라감
const ST_SEE=.84,ST_HIT=1.15,ST_LIFT=1.95,ST_END=2.55;
let ART=null;
function stompLs(){return Math.min((G.vh-G.top)*.72,G.vw*1.45);}
function stompArt(){const Ls=stompLs(),dk=isDark(),key=Math.round(Ls)+"|"+dk+"|"+G.vh;if(ART&&ART.key===key)return ART;
  const boot=bootSprite(Math.round(Ls*Math.min(1.5,G.fdpr)),(G.vh*1.2)/Ls);
  ART={key,boot,sh:shadowSprites(boot),pr:printSprite(Math.round(Ls*Math.min(2,G.pdpr)),dk)};return ART;}
function stompH(t){if(t<ST_HIT){const u=t/ST_HIT;return 1-u*u*u;}if(t<ST_LIFT)return 0;const u=(t-ST_LIFT)/(ST_END-ST_LIFT);return u*u*1.6;}
function startStomp(){if(!G||G.stomp||G.palm||crushing)return;audio();
  const A=stompArt(),Ls=stompLs(),side=(G.stompN=(G.stompN||0)+1)%2?1:-1,Hs=G.vh-G.top;   // 오른발 · 왼발 번갈아
  G.stomp={t:0,cx:G.vw*rnd(.4,.6),cy:G.top+Hs*rnd(.47,.56),ang:rnd(-.18,.18),mir:side,Ls,A,hit:false,lift:false,cracks:null,ci:0,rev:0,pinned:[]};
  dropDrag();sLaser(false);G.calm=0;sStompIn();buzz([1,250,1,250,1,200,2]);}
function stompStep(dt){const S=G.stomp;if(!S)return;if(import.meta.env.DEV&&G.devStop!=null)dt=Math.max(0,Math.min(dt,G.devStop-S.t));const t0=S.t;S.t+=dt;const t=S.t;
  if(t0<ST_SEE&&t>=ST_SEE)sWhooshDown();
  if(!S.hit&&t>=ST_HIT){S.hit=true;stompImpact(S);}
  if(S.cracks){S.rev+=dt*1500;revealCracks(S);}
  if(!S.lift&&t>=ST_LIFT){S.lift=true;sWhooshUp();}
  if(t>=ST_END){if(S.cracks){S.rev=1e9;revealCracks(S);}G.stomp=null;}}
function stompImpact(S){const k=PK(),{cx,cy,ang,mir,Ls}=S,ca=Math.cos(ang),sa=Math.sin(ang),m=mat();
  const O=outline(8).map(([u,v])=>[cx+(mir*u*ca-v*sa)*Ls,cy+(mir*u*sa+v*ca)*Ls]);
  G.hit=Math.max(G.hit,.09);G.shake=Math.max(G.shake,26+8*Math.min(k,2));G.flash=Math.min(.35,G.flash+.16);
  sStomp();buzz([3,50,3,90,2,140,1]);
  const inF=(x,y)=>inPoly(O,x,y),dEdge=(x,y)=>{if(inF(x,y))return 0;let d=1e9;for(let i=0;i<O.length;i+=2){const e=Math.hypot(O[i][0]-x,O[i][1]-y);if(e<d)d=e;}return d;};
  const RB=Ls*(.34+.09*Math.min(k,2.5))*Math.pow(Math.max(1,str()),-.22);   // 단단한 재질은 덜 튀어 나감
  S.cracks=makeCracks(O,cx,cy,Ls,clamp(.7+.3*k,.7,1.6),m==="glass"?"glass":m==="wood"?"grain":"jag",G.pieces.filter(p=>!p.dead&&p.gr).length*2>G.pieces.filter(p=>!p.dead).length?Math.PI/2:0).sort((a,b)=>a.d-b.d);
  for(const B of G.bombs)if(dEdge(B.b.position.x,B.b.position.y)<RB)B.t=Math.min(B.t,G.time+rnd(.05,.25));
  // 밟힌 칸(조금이라도 걸치면)은 자국이 찍힌 채 그대로 · 둘레는 갈라지며 튀어 나감 · 멀수록 덜 떨어짐
  const launch=[],cols=[];
  for(const p of G.pieces.slice()){if(p.dead)continue;
    if(p.pin){const l=p.f.cx-p.W/2,tp=p.f.cy-p.H/2;let n=0;for(let a=0;a<5;a++)for(let b=0;b<5;b++)if(inF(l+(a+.5)*p.W/5,tp+(b+.5)*p.H/5))n++;
      if(n){stampPiece(p,S);S.pinned.push(p);cols.push(...p.colors);continue;}
      const d=dEdge(p.f.cx,p.f.cy);if(d<RB||(d<RB*2.4&&Math.random()<.8*(1-(d-RB)/(RB*1.4))))launch.push([p,d]);else S.pinned.push(p);}
    else{const d=dEdge(p.f.cx,p.f.cy);if(d<RB*1.6)launch.push([p,d]);}}
  for(const [p,d] of launch)stompLaunch(p,S,d,RB,k);
  // 밑창 둘레에서 먼지가 밀려 나오고 부스러기가 튐 · 충격파
  const N=O.length,pal=matPal()||cols.concat(["#8f877c","#6f675e"]);
  for(let i=0;i<110;i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-cx,dy=py-cy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(140,560)*Math.sqrt(k);
    const L=rnd(1.3,2.4);addP({t:"dust",x:px,y:py,vx:dx*sp,vy:dy*sp*.8,r:rnd(9,20),gr:rnd(30,70),a:rnd(.35,.6),life:L,max:L});}
  for(let i=0;i<150;i++){const [px,py]=O[(Math.random()*N)|0];let dx=px-cx,dy=py-cy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;const sp=rnd(150,720)*Math.sqrt(k);
    shard(px,py,dx*sp,dy*sp*.7-rnd(80,420),pal[(Math.random()*pal.length)|0],rnd(2,6));}
  addP({t:"dring",x:cx,y:cy,life:.55,max:.55,R:Ls*.95});
  if(G.W.vol>1&&surfY(cx)<cy+Ls*.5){const ys=surfY(cx);splashUp(cx,ys,26,900*Math.sqrt(k));wDome(cx,-clamp(12*k,6,30),Ls*.3);sSplash(1);}}
// 밟힌 칸에 밑창 자국 찍기 (붙어 있는 칸은 회전이 없어 칸 좌표 = 화면 좌표 - 왼쪽 위)
// 자국 캔버스는 쪼개져 나간 조각과 같이 쓰므로 이 조각에 남은 칸 안에만 그림
function ownCells(x,p){x.beginPath();for(const r of rectsOf(p))x.rect(r.x,r.y,r.w,r.h);x.clip();}
function stampPiece(p,S){const x=mkCtx(p),pr=S.A.pr,l=p.f.cx-p.W/2,t=p.f.cy-p.H/2;
  x.save();ownCells(x,p);x.translate(S.cx-l,S.cy-t);x.rotate(S.ang);x.scale(S.mir*S.Ls/pr.U,S.Ls/pr.U);x.drawImage(pr.cv,-pr.ox,-pr.oy);x.restore();p.dirty=true;}
// 튀어 나가는 칸: 지나가는 금을 그려 넣고 그 금을 따라 쪼갠 뒤 발에서 멀어지는 쪽 + 위로 날림
function stompLaunch(p,S,d,RB,k){for(const L of G.fz)if(!L.dead&&(L.a===p||L.b===p)){L.dead=true;unweld(L);}release(p);const {cs,cols,rows}=p;let cut=false,x=null;
  for(const sg of S.cracks){const a=toLocal(p,sg.x0,sg.y0),b=toLocal(p,sg.x1,sg.y1);
    if((a.x<0&&b.x<0)||(a.y<0&&b.y<0)||(a.x>p.W&&b.x>p.W)||(a.y>p.H&&b.y>p.H))continue;
    if(!x){x=mkCtx(p);x.save();ownCells(x,p);}
    crackSeg(x,a.x,a.y,b.x,b.y,sg.w,mat());
    const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(cs*.45));
    for(let i=0;i<=n;i++){const gx=Math.floor((a.x+(b.x-a.x)*i/n)/cs),gy=Math.floor((a.y+(b.y-a.y)*i/n)/cs);if(gx<0||gy<0||gx>=cols||gy>=rows)continue;const j=gy*cols+gx;if(p.d[j]<1){p.d[j]=1.35;p.cl[j]=1;cut=true;}}}
  if(x)x.restore();p.hasCl=true;p.dirty=true;
  const before=G.pieces.length;if(cut){p.shapeDirty=true;p.needMask=true;restructure(p);}
  const frags=(p.dead?[]:[p]).concat(G.pieces.slice(before));
  for(const q of frags){if(q.dead||!q.body)continue;const b=q.body;let dx=b.position.x-S.cx,dy=b.position.y-S.cy;const n=Math.hypot(dx,dy)||1;dx/=n;dy/=n;
    const f=clamp(1-d/(RB*2.4),.15,1),mm=Math.sqrt(Math.max(1,b.mass/3)),v=(10+18*f)*Math.sqrt(k)/mm*rnd(.75,1.2);
    Matter.Body.setVelocity(b,{x:b.velocity.x+dx*v,y:b.velocity.y+dy*v*.7-v*.55});Matter.Body.setAngularVelocity(b,b.angularVelocity+rnd(-.22,.22)*f);}}
// 금이 퍼지는 만큼 붙어 있는 칸에 그려 넣음 (바탕에는 남기지 않음)
function revealCracks(S){const touched=new Map();
  while(S.ci<S.cracks.length&&S.cracks[S.ci].d<=S.rev){const sg=S.cracks[S.ci++];
    for(const p of S.pinned){if(p.dead||!p.pin)continue;const l=p.f.cx-p.W/2,t=p.f.cy-p.H/2;
      if(Math.max(sg.x0,sg.x1)<l||Math.min(sg.x0,sg.x1)>l+p.W||Math.max(sg.y0,sg.y1)<t||Math.min(sg.y0,sg.y1)>t+p.H)continue;
      let x=touched.get(p);if(!x){x=mkCtx(p);x.save();ownCells(x,p);touched.set(p,x);}
      crackSeg(x,sg.x0-l,sg.y0-t,sg.x1-l,sg.y1-t,sg.w,mat());}}
  for(const [p,x] of touched){x.restore();p.dirty=true;}
  if(S.ci>=S.cracks.length)S.cracks=null;}
// 금 한 마디: 옅은 그늘 + 아래쪽 밝은 단면 + 진한 선 (유리는 하얗게)
function crackSeg(x,x0,y0,x1,y1,w,st){const dk=isDark(),glass=st==="glass";x.lineCap="round";
  if(!glass){x.strokeStyle=dk?"rgba(0,0,0,.28)":"rgba(0,0,0,.07)";x.lineWidth=w*3.2;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();}
  x.strokeStyle=glass?(dk?"rgba(225,248,255,.6)":"rgba(255,255,255,.97)"):dk?"rgba(255,255,255,.1)":"rgba(255,255,255,.62)";
  x.lineWidth=Math.max(.6,w*(glass?.6:.55));x.beginPath();x.moveTo(x0+.7,y0+.8);x.lineTo(x1+.7,y1+.8);x.stroke();
  x.strokeStyle=glass?(dk?"rgba(0,0,0,.5)":"rgba(40,85,95,.5)"):st==="wood"?(dk?"rgba(0,0,0,.85)":"rgba(45,22,6,.85)"):dk?"rgba(0,0,0,.85)":"rgba(30,26,22,.82)";
  x.lineWidth=glass?w*.42:w;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();}
// 하늘이 가려져 어두워짐 + 발 그림자 (높을수록 크고 흐리고 옅고, 빛 반대쪽인 오른쪽 아래로 밀림)
function drawStompShadow(c){const S=G.stomp;if(!S)return;const h=stompH(S.t),A=S.A,hh=Math.min(1,h);
  c.fillStyle=`rgba(0,0,0,${(1-hh)*.24})`;c.fillRect(-40,-40,G.vw+80,G.vh+80);
  const lv=Math.min(1.999,h*2.6),i=Math.floor(lv),f=lv-i,al=.16+.62*Math.pow(1-hh,1.6),ox=(.012+h*.16)*G.vw,oy=(.01+h*.07)*G.vh,sc=1+.12*h;
  for(const [j,w] of [[i,1-f],[i+1,f]]){if(w<=.001||j>2)continue;const sp=A.sh[j];
    c.save();c.globalAlpha=al*w;c.translate(S.cx+ox,S.cy+oy);c.rotate(S.ang);c.scale(S.mir*sc*S.Ls/sp.U,sc*S.Ls/sp.U);c.drawImage(sp.cv,-sp.ox,-sp.oy);c.restore();}
  c.globalAlpha=1;}
// 발: 높을수록(카메라에 가까울수록) 크고, 다리 쪽(화면 위)으로 물러나 있음 · 빠르게 내려올 땐 잔상
function drawStompFoot(c){const S=G.stomp;if(!S||S.t<ST_SEE)return;const t=S.t,B=S.A.boot;
  const fade=t<ST_LIFT?clamp((t-ST_SEE)/.07,0,1):1-clamp(((t-ST_LIFT)/(ST_END-ST_LIFT)-.7)/.3,0,1);if(fade<=0)return;
  const sink=t>=ST_HIT&&t<ST_LIFT?1-.014*Math.sin(Math.PI*clamp((t-ST_HIT)/.22,0,1)):1;
  const draw=(hh,al)=>{const sc=(1+1.55*hh)*sink,d=hh*G.vh*.58;
    c.save();c.globalAlpha=al;c.translate(S.cx+Math.sin(S.ang)*d,S.cy-Math.cos(S.ang)*d);c.rotate(S.ang);c.scale(S.mir*sc*S.Ls/B.U,sc*S.Ls/B.U);c.drawImage(B.cv,-B.ox,-B.oy);c.restore();};
  if(t<ST_HIT&&t>ST_SEE+.03){draw(stompH(t-.032),.18*fade);draw(stompH(t-.016),.26*fade);}
  draw(stompH(t),fade);c.globalAlpha=1;}
function sStompIn(){const c=audio();if(!c)return;const t=c.currentTime,T=ST_HIT;
  const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(30,t);o.frequency.linearRampToValueAtTime(52,t+T);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.5,t+T);g.gain.setValueAtTime(.5,t+T);g.gain.exponentialRampToValueAtTime(.0001,t+T+.05);o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+T+.08);
  const n=noiseSrc(c),f=c.createBiquadFilter(),g2=c.createGain();f.type="lowpass";f.frequency.setValueAtTime(90,t);f.frequency.exponentialRampToValueAtTime(420,t+T);
  g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(.42,t+T);g2.gain.setValueAtTime(.42,t+T);g2.gain.exponentialRampToValueAtTime(.0001,t+T+.05);
  n.connect(f);f.connect(g2);g2.connect(AU.master);n.start(t,Math.random());n.stop(t+T+.08);}
function sSweep(f0,f1,gain,dur){const c=AU.ctx;if(!c)return;const t=c.currentTime,n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();
  f.type="bandpass";f.Q.value=1.2;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+dur*.85);g.gain.exponentialRampToValueAtTime(.0001,t+dur*1.1);
  n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+dur*1.15);}
const sWhooshDown=()=>sSweep(1600,220,.45,.3),sWhooshUp=()=>sSweep(250,1100,.22,.55);
function sStomp(){const c=audio();if(!c)return;const t=c.currentTime;
  tone(c,t,"sine",62,22,1.1,1.5);tone(c,t,"sine",130,38,.85,.42);
  const n=noiseSrc(c),f=c.createBiquadFilter(),g=c.createGain();f.type="lowpass";f.frequency.setValueAtTime(3200,t);f.frequency.exponentialRampToValueAtTime(160,t+.9);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.95,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+1.6);n.connect(f);f.connect(g);g.connect(AU.master);n.start(t,Math.random());n.stop(t+1.65);
  for(let i=0;i<10;i++)burst(c,t+Math.pow(Math.random(),1.5)*.35,"highpass",rnd(1800,3800),.8,rnd(.12,.3),rnd(.02,.06));   // 갈라지는 소리
  sMatHit(1.1,1);}

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
  if(G.stomp||G.palm||G.pcr||G.zap||G.bolts.length||G.grpDirty||G.rk.length||G.rs.length||(G.bz&&(G.bz.load<1||G.bz.rc>.01||G.bz.fl>0||G.bz.vis!==(G.tool==="bazooka"?1:0)))||G.bul.length||G.cas.length||G.md.length||G.gp.some(q=>q.T>.02)||(G.gun&&(G.gun.fl>0||G.gun.rc>.01||G.gun.vis!==(G.tool==="gun"?1:0))))return false;
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
  if(G.grpDirty)regroup();
  G.acc+=dt;let n=0;while(G.acc>=1/60&&n<4){Engine.update(G.engine,1000/60);G.acc-=1/60;n++;}if(n>=4)G.acc=0;
  if(G.landV>3.2&&G.time-G.landT>.05){sLand(G.landV);G.landT=G.time;}G.landV=0;
  for(const p of G.pieces)if(!p.dead)p.f=frame(p);
  buildPG();
  if(G.splashQ.length)doSplashes();
  toolStep(rdt);
  hammerStep(dt);
  gunStep(rdt);
  bzStep(rdt);
  stompStep(dt);
  zapStep(dt);if(G.pcr){G.pcr.rev+=dt*1700;revealCracks(G.pcr);if(!G.pcr.cracks)G.pcr=null;}
  if(G.tool==="laser"&&G.ptr.down)laserStep(dt);else G.laserHit=false;
  for(const B of G.bombs.slice()){if(G.time>=B.t){Matter.Composite.remove(G.engine.world,B.b);G.bombs.splice(G.bombs.indexOf(B),1);
    if(G.drag&&G.drag.b===B.b)dropDrag();explode(B.b.position.x,B.b.position.y);}}
  sHiss(G.bombs.length);
  wStep(dt);G.absorbed=0;dropStep(dt);bubStep(dt);
  // 불꽃 몫: 바닥 불덩이는 일부만 쓰고, 타는 칸은 따로 받음 (불덩이가 많아도 칸의 불이 사라지지 않게)
  const fbud=Math.round(42*Math.min(2,dt*60));globStep(dt,Math.round(fbud*.4));
  G.fireTot=fireStep(dt,fbud);flameStep(dt);wetStep(dt);glassStep(dt);dripStep(dt);
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
  const fl=G.fireTot+G.fb.length*3+(G.tool==="fire"&&G.ptr.down?14:0);   // 불을 대고 있으면 안 타는 재질이어도 불 소리
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
  if(t==="bazooka")bzOn();else bzOff();
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
     wetT:0,ctT:0,fireT:0,fireTot:0,absorbed:0,pourLv:0,uiT:0,wcv:document.createElement("canvas"),wctx:null,W:null,caus:null,
     bul:[],cas:[],gun:null,bz:null,bz3d:false,rk:[],rs:[],bolts:[],zap:null,pcr:null,palm:false,stomp:null,landV:0,landT:0,md:[],gp:[],fz:[],ice:[],grpDirty:false};
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
    const cs=getComputedStyle(orig),clear=isClear(cs.backgroundColor);
    const p=initPiece(rasterize(orig,r),r.width,r.height,orig,{alpha:parseFloat(cs.opacity)||1,rad:parseFloat(cs.borderTopLeftRadius)||0,soft:clear,
      colors:matColors(solidColors(orig),clear?0:3),gr:grainOf(r.width,r.height)});
    p.pin=true;buildBody(p,{cx:r.left+r.width/2,cy:r.top+r.height/2,c:1,s:0,th:0},null);G.pieces.push(p);});
  document.documentElement.classList.add("grav-on");
  drawPieces();
  Events.on(engine,"beforeUpdate",()=>{for(const b of Composite.allBodies(engine.world)){if(b.isStatic)continue;
    const v=b.velocity,s=Math.hypot(v.x,v.y);const vm=45*Math.max(1,PK());if(s>vm)Body.setVelocity(b,{x:v.x*vm/s,y:v.y*vm/s});
    if(Math.abs(b.angularVelocity)>.5)Body.setAngularVelocity(b,Math.sign(b.angularVelocity)*.5);}});
  Events.on(engine,"beforeUpdate",waterForces);
  // 떠 있는 칸에 빠르게 날아온 조각이 부딪히거나, 끌고 있는 조각으로 밀면 그 칸이 떨어져 나옴 (풀린 뒤엔 물리 계산이 알아서 밀어냄)
  Events.on(engine,"collisionStart",e=>{for(const pr of e.pairs){const a=pr.bodyA.parent,b=pr.bodyB.parent;
    // 부딪히는 소리는 한 프레임에 가장 센 것 하나만 (loop에서 냄)
    if(!(a.isStatic&&b.isStatic)){const v=Math.hypot(a.velocity.x-b.velocity.x,a.velocity.y-b.velocity.y);if(v>G.landV)G.landV=v;}
    const [st,mv]=a.isStatic&&!b.isStatic?[a,b]:b.isStatic&&!a.isStatic?[b,a]:[];if(!st)continue;
    const q=st.plugin.piece;if(!q||!(q.pin||q.anc))continue;
    if(Math.hypot(mv.velocity.x,mv.velocity.y)>KNOCK*Math.sqrt(Math.max(1,str()))||(G.drag&&G.drag.b===mv))release(q);}});
  const inUI=e=>e.target&&e.target.closest&&e.target.closest("#chrome,#sheet,#gate");
  const down=e=>{if(inUI(e))return;const P=G.ptr;if(P.down)return;e.preventDefault();audio();
    if(G.stomp||G.palm)return;   // 발이 내려오거나 손바닥 필살기 동안은 잠깐 손 못 댐
    P.x=e.clientX;P.y=e.clientY;P.sx=P.x;P.sy=P.y;P.down=true;P.id=e.pointerId;P.moved=false;P.tap=null;P.pend=null;
    // 붙어 있는 칸(이나 폭탄)은 끌기 시작할 때 떼어냄 → 톡 누르기만 하면 그대로 두고 일정을 염
    if(G.tool==="grab"){const b=pick(P.x,P.y);if(b){P.tap=b.plugin.piece||null;if(b.isStatic)P.pend=b;else grab(b,P.x,P.y);}}
    else if(G.tool==="laser")sLaser(true);
    else if(G.tool==="bomb")spawnBomb(P.x,P.y);
    else if(G.tool==="hammer")hammerSpawn(P.x,P.y);
    else if(G.tool==="bazooka"){if(G.bz3d&&BZ3)bz3dFire(P.x,P.y);else fireRocket(P.x,P.y);}
    else if(G.tool==="gun"){const g=gunState();if(performance.now()-g.last>1000/GUN_RATE)g.cd=0;}
    else{P.lx=P.x;P.ly=P.y;P.pvx=0;P.pvy=0;P.dacc=12;P.hold=G.tool==="water"?3:.08;}};
  const move=e=>{const P=G.ptr;if(P.down&&e.pointerId!==P.id)return;P.x=e.clientX;P.y=e.clientY;G.calm=0;
    if(P.down&&Math.hypot(P.x-P.sx,P.y-P.sy)>6)P.moved=true;
    if(P.pend&&P.moved){const b=P.pend;P.pend=null;if(b.plugin.piece)release(b.plugin.piece);else unstick(b);grab(b,P.sx,P.sy);}
    if(G.drag){G.drag.c.pointA.x=P.x;G.drag.c.pointA.y=P.y;}
    if(G.bz3d&&BZ3)BZ3.bz.aim(P.x,P.y);};
  const up=e=>{const P=G.ptr;if(!P.down||e.pointerId!==P.id)return;P.down=false;P.id=null;P.pend=null;dropDrag();sLaser(false);
    if(G.tool==="grab"&&!P.moved&&P.tap&&!P.tap.dead&&OPT.onTap)OPT.onTap(P.tap.orig);};
  const block=e=>{if(inUI(e))return;e.preventDefault();e.stopPropagation();};
  const KT={"1":"grab","2":"laser","3":"bomb","4":"hammer","5":"fire","6":"water","7":"gun","8":"bazooka"};
  const key=e=>{if(KT[e.key])setTool(KT[e.key]);else if(e.key==="g"||e.key==="G")toggleGrav();else if(e.key==="f"||e.key==="F")startStomp();else if(e.key==="p"||e.key==="P")startPalmFx();else if(e.key==="Escape"&&OPT.onReset)OPT.onReset();};
  const ctx=e=>{if(!inUI(e))e.preventDefault();};
  addEventListener("pointerdown",down,{capture:true,passive:false});addEventListener("pointermove",move);addEventListener("pointerup",up);addEventListener("pointercancel",up);
  addEventListener("click",block,true);addEventListener("keydown",key);addEventListener("contextmenu",ctx);
  G.off=()=>{removeEventListener("pointerdown",down,{capture:true});removeEventListener("pointermove",move);removeEventListener("pointerup",up);removeEventListener("pointercancel",up);
    removeEventListener("click",block,true);removeEventListener("keydown",key);removeEventListener("contextmenu",ctx);};
  setTool(TOOL,!opt.hint);gravBtn();schedulePrewarm();
  G.raf=requestAnimationFrame(loop);}
// 짓누르기를 한가할 때 미리 준비해 둠 (3D 코드·손 모델·이 달력 칸 모양의 종이 꾸기기) → 버튼을 누른 뒤 기다림이 짧음
let preT=0;
// 3D 장면(영역전개 마무리)이 아직 화면에 있으면 끝난 뒤로 미룸
function schedulePrewarm(){clearTimeout(preT);preT=setTimeout(()=>{const go=()=>{if(!G)return;if(document.getElementById("gCrush")){schedulePrewarm();return;}const pcs=G.pieces.filter(p=>!p.dead).map(p=>({W:p.W,H:p.H}));
  import("./crush.js").then(m=>m.prewarm(pcs)).catch(()=>{});
  setTimeout(()=>{if(G&&!G.palm)import("./palm.js").then(m=>m.prewarmPalm()).catch(()=>{});},1200);
  setTimeout(()=>{if(G&&!G.palm&&!nuking)import("./nuke.js").then(m=>m.prewarmNuke()).catch(()=>{});},3400);
  setTimeout(()=>{if(G&&!G.palm&&!nuking)import("./tariff.js").then(m=>m.prewarmTariff()).catch(()=>{});},5200);
  setTimeout(()=>{if(G&&!G.palm&&!nuking)import("./mars.js").then(m=>m.prewarmMars()).catch(()=>{});},7000);
  // 거대한 발 그림도 미리 (다음 한가할 때)
  const art=()=>{if(G&&!G.stomp)try{stompArt();}catch(e){console.error(e);}};window.requestIdleCallback?requestIdleCallback(art,{timeout:5000}):setTimeout(art,500);};
  window.requestIdleCallback?requestIdleCallback(go,{timeout:4000}):go();},1500);}
// fade: 불·연기·그을음 캔버스를 바로 지우지 않고 서서히 사라지게 (짓누르기로 넘어갈 때)
export function stopSmash(fade){
  if(!G)return;if(BZ3)BZ3.bz.hide();G.bz3d=false;cancelAnimationFrame(G.raf);sStopAll();G.off();
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
const FIRE_HINT={glass:"유리는 타지 않아요 · 오래 달구면 녹아 흘러내리고, 식거나 물을 뿌리면 옆 칸과 붙어요",
  stone:"돌은 불이 붙지 않아요 · 그을리기만 해요",wood:"나무는 잘 안 붙어요 · 한곳에 대고 있으면 천천히 타요"};
function hintFor(t){const S=str(),nm=MATS.find(q=>q.id===mat()).name;
  if(t==="bomb"){const n=Math.ceil(S/(.62*POW*.93));return n<=1?"누른 곳에 폭탄 · 이 파괴력이면 한 방에 뚫려요":n===2?"누른 곳에 폭탄 · 한 번은 그을리고, 두 번 맞으면 뚫려요":`누른 곳에 폭탄 · ${nm}은(는) ${n}번쯤 맞아야 뚫려요`;}
  if(t==="hammer"&&S>1.2){const n=Math.ceil(.999*S/PK());if(n>1)return `톡 누른 곳을 망치로 쾅 · ${nm}은(는) ${n}번쯤 때려야 깨져요`;}
  return (G&&G.zg?"무중력 · ":"")+(t==="fire"&&FIRE_HINT[mat()]||TOOL_HINT[t]);}
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
async function beginCrush(){if(!G||crushing||nuking||G.stomp||G.palm)return;crushing=true;audio();
  // 3D를 준비하는 동안 2D는 그 자리에 멈춰 둠 (조각 위치가 3D 첫 화면과 똑같도록) · 도구 막대는 바로 사라짐
  cancelAnimationFrame(G.raf);G.paused=true;sStopAll();document.documentElement.classList.add("crush-on");
  const pieces=G.pieces.filter(p=>!p.dead).map(p=>({tex:p.tex,W:p.W,H:p.H,cx:p.f.cx,cy:p.f.cy,th:p.f.th,alpha:p.alpha,colors:p.colors}));
  const onReset=OPT&&OPT.onReset;
  try{const {startCrush}=await import("./crush.js");
    await startCrush({pieces,sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onDone:()=>{crushing=false;onReset&&onReset();}});
    stopSmash(true);   // 3D가 첫 화면을 그린 뒤에 2D를 지워서 끊김이 없게
  }catch(e){console.error(e);crushing=false;document.documentElement.classList.remove("crush-on");if(G){G.paused=false;G.raf=requestAnimationFrame(loop);}}}
document.getElementById("gCrushBtn").onclick=beginCrush;
// 핵: 짓누르기처럼 지금 화면의 조각을 3D로 넘기고 2D는 멈춤 · 끝나면 달력을 새로
let nuking=false;
async function beginNuke(){if(!G||crushing||nuking||G.stomp||G.palm)return;nuking=true;audio();
  cancelAnimationFrame(G.raf);G.paused=true;sStopAll();if(BZ3)BZ3.bz.hide();
  const pieces=G.pieces.filter(p=>!p.dead).map(p=>({tex:p.tex,W:p.W,H:p.H,cx:p.f.cx,cy:p.f.cy,th:p.f.th,alpha:p.alpha,colors:p.colors}));
  const onReset=OPT&&OPT.onReset;
  try{const {startNuke}=await import("./nuke.js");
    await startNuke({pieces,sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onDone:()=>{nuking=false;onReset&&onReset();}});
    stopSmash(true);
  }catch(e){console.error(e);nuking=false;if(G){G.paused=false;G.raf=requestAnimationFrame(loop);}}}
document.getElementById("gNukeBtn").onclick=beginNuke;
// 관세: 핵처럼 지금 화면의 조각을 3D로 넘기고 2D는 멈춤 (달력이 눕혀진 바닥이 됨) · 끝나면 달력을 새로
async function beginTariff(){if(!G||crushing||nuking||G.stomp||G.palm)return;nuking=true;audio();
  cancelAnimationFrame(G.raf);G.paused=true;sStopAll();if(BZ3)BZ3.bz.hide();
  const pieces=G.pieces.filter(p=>!p.dead).map(p=>({tex:p.tex,W:p.W,H:p.H,cx:p.f.cx,cy:p.f.cy,th:p.f.th,alpha:p.alpha,colors:p.colors}));
  const onReset=OPT&&OPT.onReset;
  try{const {startTariff}=await import("./tariff.js");
    await startTariff({pieces,sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onDone:()=>{nuking=false;onReset&&onReset();}});
    stopSmash(true);
  }catch(e){console.error(e);nuking=false;if(G){G.paused=false;G.raf=requestAnimationFrame(loop);}}}
document.getElementById("gTariffBtn").onclick=beginTariff;
// 화성: 핵처럼 지금 화면의 조각을 3D로 넘기고 2D는 멈춤 (화면 전체가 달력 한 장이 되어 짜부됨) · 끝나면 달력을 새로
async function beginMars(){if(!G||crushing||nuking||G.stomp||G.palm)return;nuking=true;audio();
  cancelAnimationFrame(G.raf);G.paused=true;sStopAll();if(BZ3)BZ3.bz.hide();
  const pieces=G.pieces.filter(p=>!p.dead).map(p=>({tex:p.tex,W:p.W,H:p.H,cx:p.f.cx,cy:p.f.cy,th:p.f.th,alpha:p.alpha,colors:p.colors}));
  const onReset=OPT&&OPT.onReset;
  try{const {startMars}=await import("./mars.js");
    await startMars({pieces,sfx:()=>{const c=audio();return c?{c,out:AU.master,noise:AU.noise}:null;},onDone:()=>{nuking=false;onReset&&onReset();}});
    stopSmash(true);
  }catch(e){console.error(e);nuking=false;if(G){G.paused=false;G.raf=requestAnimationFrame(loop);}}}
document.getElementById("gMarsBtn").onclick=beginMars;
document.getElementById("gStompBtn").onclick=()=>startStomp();
document.getElementById("gPalmBtn").onclick=()=>startPalmFx();
// 재질 고르기: 바꾸면 달력을 새 재질로 다시 그림
(()=>{const btn=document.getElementById("gMat"),menu=document.getElementById("gMatMenu");
  const paint=()=>{const m=MATS.find(q=>q.id===mat());btn.querySelector(".sw").style.background=swatch(m.id);btn.querySelector(".nm").textContent=m.name;
    menu.querySelectorAll("[data-mat]").forEach(b=>b.setAttribute("aria-checked",b.dataset.mat===m.id?"true":"false"));};
  menu.innerHTML=`<p>재질</p>`+MATS.map(m=>`<button role="menuitemradio" data-mat="${m.id}"><i class="sw" style="background:${swatch(m.id)}"></i><span>${m.name}<small>${m.note}</small></span></button>`).join("");
  const open=v=>{menu.hidden=!v;btn.setAttribute("aria-expanded",v?"true":"false");};
  btn.onclick=()=>open(menu.hidden);
  menu.querySelectorAll("[data-mat]").forEach(b=>b.onclick=()=>{open(false);if(b.dataset.mat===mat())return;setMat(b.dataset.mat);paint();
    warmTex();if(OPT&&OPT.onReset)OPT.onReset();setTimeout(()=>{const m=MATS.find(q=>q.id===mat());showHint("재질 · "+m.name+" — "+m.note);},80);});
  addEventListener("pointerdown",e=>{if(!menu.hidden&&!e.target.closest(".gmat"))open(false);},true);
  addEventListener("keydown",e=>{if(e.key==="Escape")open(false);});
  paint();})();
document.getElementById("gReset").onclick=()=>{if(OPT&&OPT.onReset)OPT.onReset();};
document.getElementById("gSound").onclick=()=>setMute(!AU.muted);
document.getElementById("gZero").onclick=toggleGrav;
document.getElementById("gDrain").onclick=()=>{if(G&&!G.W.drain&&(G.W.vol>1||G.dr.length)){audio();G.W.drain=1;G.W.dv=40;}};
document.querySelectorAll(".gbar [data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
