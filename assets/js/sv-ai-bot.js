/* sv-ai-bot.js — SuppVerse AI bot (shared component)
 * One file, used everywhere the bot appears. Self-contained (injects its own CSS), vanilla JS, no dependencies.
 *
 *   <div id="slot"></div>
 *   <script src="assets/js/sv-ai-bot.js"></script>
 *   const bot = SVBot.mount(document.getElementById('slot'), { size: 56 });   // idle by default
 *   bot.setState('reading');   // 'idle' | 'reading' | 'found' | 'failed'
 *   bot.destroy();
 *
 * States: idle (looks around, blinks, slides to the corner, blinks twice, loops) · reading (bot stays, Particle Tether
 * sphere/ring around it) · found (small hop, happy eyes, one ripple, a few particles, short jiggle) · failed (confused, "?").
 * Particle Tether: ported from the Originkit "OrbConverge" component.
 */
(function () {
  'use strict';
  if (window.SVBot) return;

  var CSS = `/* ================= BOT ================= */
.svbot{display:block;width:100%;height:100%;overflow:visible;cursor:default}
.svbot .sb-look{transform:translate(var(--lx,0px),var(--ly,0px));transition:transform .4s ease-in-out}
.svbot .sb-eye{transform-box:fill-box;transform-origin:center;transform:translate(var(--ex,0px),var(--ey,0px)) rotate(var(--er,0deg)) scale(var(--es,1));transition:transform .55s cubic-bezier(.5,0,.2,1)}
.svbot .sb-lid{transform-box:fill-box;transform-origin:center;transition:transform .11s ease}
.svbot.sb-blink .sb-lid{transform:scaleY(.08)}
.svbot .sb-pose{transform-origin:100px 100px;transition:transform .55s cubic-bezier(.5,0,.2,1)}
/* Grok-style corner pose: eyes glide to the upper-right, slanted and a bit closer together */
.svbot.sb-corner .sb-pose{transform:translate(22px,-34px) rotate(-22deg)}
.svbot.sb-corner .sb-eL{--ex:4.5px;--er:-12deg;--es:.82}
.svbot.sb-corner .sb-eR{--ex:-4.5px;--er:-12deg;--es:.82}
.svbot .sb-float{animation:sb-bob 3.4s ease-in-out infinite}
.svbot .sb-shadow{fill:rgba(0,0,0,.16);transform-box:fill-box;transform-origin:center;animation:sb-shad 3.4s ease-in-out infinite}
.svbot .sb-squash{transform-origin:100px 168px}
.svbot .sb-eyes-happy,.svbot .sb-q{opacity:0;transition:opacity .3s}
.svbot .sb-eyes-open{transition:opacity .2s}
/* reading: the bot fades out and the Particle Tether sphere takes its place */
.svbot-host{position:relative;display:block;flex:0 0 auto;--c1:#86bdff;--c2:#2f86ff;--c3:#1b4fd1;--s1:#4d96ff;--s2:#2476f0}
.svbot-host .svbot-pt{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;pointer-events:none;transition:opacity .35s ease}
.svbot-host.sb-reading .svbot-pt{opacity:1}
.svbot-host .svbot{position:relative;z-index:1;transition:opacity .3s ease,transform .45s cubic-bezier(.4,0,.2,1)}
.svbot-host .svbot-ptb{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;pointer-events:none;z-index:0;transition:opacity .35s ease}
.svbot-host .svbot-pt{z-index:2}
.svbot-host.sb-reading .svbot-ptb{opacity:1}
/* look 1 – around: the bot shrinks into the middle of the sphere/ring, eyes scanning */
.svbot-host.sb-reading .svbot{transform:scale(.64)}
.svbot-host.sb-reading .svbot .sb-shadow{animation:none;opacity:0}
.svbot[data-state="reading"] .sb-look{animation:sb-scan 1.5s ease-in-out infinite alternate}
/* found (minimal): one small hop, eyes turn into happy arcs, one soft ripple, 6 tiny particles, short jiggle */
.svbot .sb-rings circle,.svbot .sb-confetti circle{opacity:0;transform-box:fill-box;transform-origin:center}
.svbot[data-state="found"] .sb-rings circle{animation:sb-ringout .8s ease-out forwards}
.svbot[data-state="found"] .sb-confetti circle{animation:sb-burstout .7s ease-out forwards}
.svbot[data-state="found"] .sb-pose{animation:sb-jiggle .36s .55s ease-in-out 2}
.svbot[data-state="found"] .sb-squash{animation:sb-fhop .6s cubic-bezier(.3,.7,.4,1) 1}
.svbot[data-state="found"] .sb-eyes-open{animation:sb-feyes .15s ease forwards}
.svbot[data-state="found"] .sb-eyes-happy{transform-box:fill-box;transform-origin:center;animation:sb-feyes2 .3s .1s cubic-bezier(.3,1.5,.5,1) forwards}
/* failed */
.svbot[data-state="failed"] .sb-look{--lx:-7px;--ly:2px}
.svbot[data-state="failed"] .sb-eR{--ey:3px}
.svbot[data-state="failed"] .sb-eR .sb-lid{transform:scaleY(.6)}
.svbot[data-state="failed"] .sb-eL{--er:-8deg}
.svbot[data-state="failed"] .sb-squash{animation:sb-wobble 1.1s ease-in-out 2}
.svbot[data-state="failed"] .sb-q{opacity:1;animation:sb-pop .5s cubic-bezier(.3,1.6,.5,1) both;transform-box:fill-box;transform-origin:center}
/* tap */
.svbot.sb-tap .sb-squash{animation:sb-tap .55s cubic-bezier(.3,.7,.4,1) 1}
.svbot.sb-tap .sb-eR .sb-lid{animation:sb-wink .5s ease 1}
@keyframes sb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes sb-shad{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.82);opacity:.7}}
@keyframes sb-hop{0%{transform:scale(1,1)}18%{transform:scale(1.08,.9)}42%{transform:translateY(-20px) scale(.95,1.06)}68%{transform:scale(1.06,.94)}100%{transform:scale(1,1)}}
@keyframes sb-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
@keyframes sb-pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes sb-scan{from{transform:translate(-10px,-1px)}to{transform:translate(10px,1px)}}
@keyframes sb-fhop{0%{transform:scale(1,1)}25%{transform:translateY(-9px) scale(.97,1.04)}55%{transform:translateY(0) scale(1.05,.95)}100%{transform:scale(1,1)}}
@keyframes sb-feyes{to{opacity:0}}
@keyframes sb-feyes2{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes sb-ringout{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.6);opacity:0}}
@keyframes sb-burstout{0%{transform:translate(var(--sx),var(--sy)) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0}}
@keyframes sb-jiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-2.5deg)}75%{transform:rotate(2.5deg)}}
@keyframes sb-tap{0%{transform:scale(1,1)}25%{transform:scale(1.1,.88)}55%{transform:translateY(-12px) scale(.96,1.05)}100%{transform:scale(1,1)}}
@keyframes sb-wink{0%,100%{transform:scaleY(1)}40%,60%{transform:scaleY(.08)}}
@media (prefers-reduced-motion:reduce){.svbot *{animation:none!important}}

body.dark-mode .svbot-host .sb-shadow,body.dark .svbot-host .sb-shadow,html[data-theme="dark"] .svbot-host .sb-shadow{fill:rgba(0,0,0,.45)}
`;

  function injectCss() {
    if (document.getElementById('svbot-css')) return;
    var st = document.createElement('style'); st.id = 'svbot-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function isDark() {
    var b = document.body, d = document.documentElement;
    return !!(b && (b.classList.contains('dark-mode') || b.classList.contains('dark'))) || d.getAttribute('data-theme') === 'dark';
  }

  var UID = 0;
  function botSVG(){
  const u=++UID;
  const conf=[-20,38,100,160,215,278].map((deg,i)=>{const a=deg*Math.PI/180, s0=66, e=94+(i%3)*6;
    return `<circle cx="100" cy="98" r="${i%2?2.2:2.8}" style="fill:${i%2?'var(--c1)':'var(--c2)'};--sx:${(Math.cos(a)*s0).toFixed(1)}px;--sy:${(Math.sin(a)*s0).toFixed(1)}px;--dx:${(Math.cos(a)*e).toFixed(1)}px;--dy:${(Math.sin(a)*e).toFixed(1)}px;animation-delay:${(.08+(i%3)*.05).toFixed(2)}s"/>`;}).join('');
  return `<svg class="svbot" viewBox="0 0 200 200" data-state="idle" role="img" aria-label="SuppVerse AI">
  <defs>
    <radialGradient id="b${u}" cx="38%" cy="30%" r="90%"><stop offset="0" style="stop-color:var(--s1)"/><stop offset="1" style="stop-color:var(--s2)"/></radialGradient>
    <radialGradient id="g${u}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="r${u}" cx="50%" cy="50%" r="50%"><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></radialGradient>
  </defs>
  <ellipse class="sb-shadow" cx="100" cy="184" rx="46" ry="7"/>
  <g class="sb-rings"><circle cx="100" cy="98" r="71" fill="none" style="stroke:var(--c1)" stroke-width="3"/></g>
  <g class="sb-float"><g class="sb-squash">
    <circle cx="100" cy="98" r="71" fill="url(#b${u})"/>
    <circle cx="100" cy="98" r="71" fill="url(#r${u})"/>
    <ellipse cx="74" cy="58" rx="22" ry="10" transform="rotate(-30 74 58)" fill="url(#g${u})" opacity=".13"/>
    <g class="sb-pose"><g class="sb-look">
      <g class="sb-eyes-open">
        <g transform="translate(79 100)"><g class="sb-eye sb-eL"><g class="sb-lid"><rect x="-6.5" y="-15" width="13" height="30" rx="6.5" fill="#fff"/></g></g></g>
        <g transform="translate(121 100)"><g class="sb-eye sb-eR"><g class="sb-lid"><rect x="-6.5" y="-15" width="13" height="30" rx="6.5" fill="#fff"/></g></g></g>
      </g>
      <g class="sb-eyes-happy" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round">
        <path d="M68 106 Q79 88 90 106"/><path d="M110 106 Q121 88 132 106"/>
      </g>
      
    </g></g>
  </g></g>
  <g class="sb-confetti">${conf}</g>
  <g class="sb-q"><circle cx="152" cy="34" r="17" fill="#fff" stroke="rgba(0,0,0,.08)"/><text x="152" y="42" text-anchor="middle" font-size="24" font-weight="800" font-family="sans-serif" style="fill:var(--c3)">?</text></g>
</svg>`;
}

  /* ===== Particle Tether — ported 1:1 from the Originkit "OrbConverge" component (dotSize lowered from the 150 preset to 120) ===== */
const TAU=Math.PI*2, PERIOD=4.8, BASE_SPREAD=0.3, PERSPECTIVE=3.5, DEPTH_SIZE=1, DEPTH_FADE=1, MIN_RADIUS=0.6, MAX_DOTS=1024, MAX_DPR=2;
const clamp01=x=>x<0?0:x>1?1:x;
const dotsN=(base,n)=>{const v=Math.round(base*n);return v<1?1:v};
const bump=x=>0.5-0.5*Math.cos(TAU*clamp01(x));
function fib(i,n){const y=1-(i/Math.max(1,n-1))*2, r=Math.sqrt(Math.max(0,1-y*y)), th=2.399963*i; return [Math.cos(th)*r,y,Math.sin(th)*r];}
function polar(p){return [Math.acos(Math.max(-1,Math.min(1,p[1]))),Math.atan2(p[2],p[0])];}
function spin(p,yaw,pitch){const ca=Math.cos(yaw),sa=Math.sin(yaw),rx=p[0]*ca-p[2]*sa;let rz=p[0]*sa+p[2]*ca;const co=Math.cos(pitch),so=Math.sin(pitch),ry=p[1]*co-rz*so;rz=p[1]*so+rz*co;return [rx,ry,rz,p[3],p[4],p[5]];}
function tframe(t,P,out){const n=dotsN(150,P.n),k=bump(t);for(let i=0;i<n;i++){const p=polar(fib(i,n)),th=p[0]+(Math.PI/2-p[0])*k,sr=Math.sin(th);out.push(spin([Math.cos(p[1])*sr,Math.cos(th),Math.sin(p[1])*sr,0.8+0.5*k,0.9],TAU*t,0.4));}}
function tproject(pts,size,P,emit){
  const c=size/2,R=size*BASE_SPREAD*P.sp,pv=PERSPECTIVE,yaw=P.yw+TAU*P.sn*P.t,list=[];
  for(const p of pts){const q=spin(p,yaw,P.pc),z=q[2],s=pv/(pv-z),f=clamp01((z+1.1)/2.2);
    list.push([c+q[0]*R*s,c+q[1]*R*s,P.ds*(0.4+1.6*DEPTH_SIZE*f)*s*(q[3]===undefined?1:q[3]),(0.07+0.93*Math.pow(f,1.55*DEPTH_FADE))*(q[4]===undefined?1:q[4]),q[5]||P.dot,z]);}
  list.sort((a,b)=>a[5]-b[5]); for(const d of list) emit(d[0],d[1],d[2],d[3],d[4],d[5]);
}
const fitCache=new Map();
function autoFit(size,P,restYaw,restPitch){
  const key=size+'/'+P.n+'/'+P.sp+'/'+restYaw+'/'+restPitch+'/'+P.sn, hit=fitCache.get(key); if(hit!==undefined) return hit;
  const half=size/2; let ext=0; const probe=Object.assign({},P,{ds:1,dot:'#fff',acc:'#fff',t:0,yw:restYaw,pc:restPitch});
  const emit=(x,y,r,a)=>{ if(a<=0.05||r<=0.15) return; ext=Math.max(ext,Math.abs(x-half)+0.5*r,Math.abs(y-half)+0.5*r); };
  for(let k=0;k<20;k++){ probe.t=k/20; const out=[]; tframe(probe.t,probe,out); tproject(out,size,probe,emit); }
  const fit=ext>1?Math.max(0.55,Math.min(1.7,(0.415*size)/ext)):1; fitCache.set(key,fit); return fit;
}
function dotScaleFor(size){ if(size<=46) return 0.4; if(size<=190) return 0.4+((size-46)/144)*0.6; if(size<=340) return 1+((size-190)/150)*0.55; return 1.55; }
function parseColor(input,fb){
  if(!input) return fb; const str=String(input).trim();
  if(str.charAt(0)==='#'){ let hex=str.slice(1); if(hex.length===3||hex.length===4){hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+(hex.length===4?hex[3]+hex[3]:'');}
    if(hex.length>=6){const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16),a=hex.length>=8?parseInt(hex.slice(6,8),16)/255:1; if(!isNaN(r)&&!isNaN(g)&&!isNaN(b)) return [r,g,b,a];} return fb; }
  const m=str.match(/[\d.]+/g); if(m&&m.length>=3) return [Math.min(255,parseFloat(m[0])),Math.min(255,parseFloat(m[1])),Math.min(255,parseFloat(m[2])),m.length>=4?Math.min(1,parseFloat(m[3])):1];
  return fb;
}
const cssRGBA=c=>'rgba('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+','+c[3]+')';
const clampN=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;
/* spin dots are azure blue (the bot's color); as they gather into the Saturn ring they turn orange (orange only near the ring ≈ 20% of the loop) */
function tetherColor(phase){
  const dark=isDark(),
        bl=dark?[96,162,255]:[47,134,255], or=dark?[255,138,92]:[242,100,48],
        k=bump(phase), x=clamp01((k-0.83)/0.15), m=x*x*(3-2*x);
  return [bl[0]+(or[0]-bl[0])*m, bl[1]+(or[1]-bl[1])*m, bl[2]+(or[2]-bl[2])*m, 1];
}
/* settings from the component (dotSize 120 instead of the 150 preset): density 300, speed 50, spinTurns 1, ball {spread 100, turn 0, tilt 0}. Pointer/drag interaction removed. */
function makeTether(canvas,canvasB,W,H){
  const ctx=canvas.getContext('2d'), ctxB=canvasB.getContext('2d');
  const v={speed:clampN(50,-100,100)/50, density:clampN(300,20,300)/100, dotSize:clampN(120,20,300)/100, spinTurns:1, spread:1, turn:0, tilt:0};
  let last=performance.now(), phase=0, running=false, raf=0;
  function render(now){
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(running){
      const dpr=Math.min(window.devicePixelRatio||1,MAX_DPR), cw=W, ch=H, bw=Math.max(1,Math.round(cw*dpr)), bh=Math.max(1,Math.round(ch*dpr));
      if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;canvasB.width=bw;canvasB.height=bh;}
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cw,ch); ctxB.setTransform(dpr,0,0,dpr,0,0); ctxB.clearRect(0,0,cw,ch);
      const split=true;
      phase=(phase+(dt*v.speed)/PERIOD)%1; if(phase<0) phase+=1;
      const size=Math.max(4,Math.min(cw,ch)), bx=(cw-size)/2, by=(ch-size)/2, col=cssRGBA(tetherColor(phase));
      const restPitch=v.tilt;
      const P={n:v.density,sp:v.spread,ds:dotScaleFor(size)*v.dotSize,yw:v.turn,sn:v.spinTurns,pc:restPitch,t:phase,dot:col,acc:col};
      const fit=autoFit(size,P,v.turn,restPitch), half=size/2, out=[]; tframe(phase,P,out); let drawn=0;
      tproject(out,size,P,(x,y,r,a,c,z)=>{
        if(drawn>=MAX_DOTS) return; const rr=r*(0.55+0.45*fit); if(rr<=0.05||a<=0.004) return;
        const cx=bx+half+(x-half)*fit, cy=by+half+(y-half)*fit; let dr=rr, da=Math.min(1,a);
        if(dr<MIN_RADIUS){da*=(dr/MIN_RADIUS)*(dr/MIN_RADIUS); dr=MIN_RADIUS;}
        const g=(split&&z<0)?ctxB:ctx; g.globalAlpha=da; g.fillStyle=c; g.beginPath(); g.arc(cx,cy,dr,0,TAU); g.fill(); drawn++;
      });
      ctx.globalAlpha=1; ctxB.globalAlpha=1;
    }
    if(running) raf=requestAnimationFrame(render); else raf=0;
  }
  return { start(){ phase=0; last=performance.now(); running=true; if(!raf) raf=requestAnimationFrame(render); }, stop(){ running=false; }, destroy(){ running=false; if(raf) cancelAnimationFrame(raf); raf=0; } };
}



  /* ---------- one shared pointer listener for the eye-follow (all mounted bots) ---------- */
  var instances = [];
  function onPointer(px, py) {
    for (var i = 0; i < instances.length; i++) instances[i]._look(px, py);
  }
  var listening = false;
  function ensureListener() {
    if (listening) return; listening = true;
    addEventListener('pointermove', function (e) { onPointer(e.clientX, e.clientY); }, { passive: true });
    addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) onPointer(t.clientX, t.clientY); }, { passive: true });
  }

  function mount(el, opts) {
    opts = opts || {};
    injectCss(); ensureListener();
    var size = opts.size || parseInt(getComputedStyle(el).width, 10) || 56;
    el.classList.add('svbot-host');
    el.style.width = size + 'px'; el.style.height = size + 'px';
    el.innerHTML = '<canvas class="svbot-ptb"></canvas>' + botSVG() + '<canvas class="svbot-pt"></canvas>';
    var svg = el.querySelector('.svbot'), cb = el.querySelector('.svbot-ptb'), cv = el.querySelector('.svbot-pt');
    var lookG = svg.querySelector('.sb-look');
    var tether = makeTether(cv, cb, size, size);
    var state = '', idleT = [], failT = null, tapT = null, reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function blink(ms) { svg.classList.add('sb-blink'); setTimeout(function () { svg.classList.remove('sb-blink'); }, ms || 190); }
    function lookTo(x, y) { lookG.style.setProperty('--lx', x + 'px'); lookG.style.setProperty('--ly', y + 'px'); }
    function corner(on) { svg.classList.toggle('sb-corner', on); }
    function stopIdle() { idleT.forEach(clearTimeout); idleT = []; corner(false); lookTo(0, 0); }
    function startIdle() {
      stopIdle(); if (reduced) return;
      function at(ms, fn) { idleT.push(setTimeout(fn, ms)); }
      at(700, function () { lookTo(-10, -1); });      // look around
      at(1500, function () { lookTo(10, 1); });
      at(2300, function () { lookTo(0, -6); });
      at(3000, function () { lookTo(0, 0); });
      at(3600, blink);                                  // face-to-face blink
      at(5200, function () { corner(true); });          // 1) eyes glide to the corner
      at(6400, blink); at(6850, blink);                 // 2) blink twice
      at(7900, function () { corner(false); });         // 3) glide back
      at(9000, blink);
      at(10600, startIdle);                             // loop
    }

    var inst = {
      el: el,
      _look: function (px, py) {
        if (state === 'reading' || state === 'failed' || svg.classList.contains('sb-corner')) return;
        var r = svg.getBoundingClientRect(); if (!r.width) return;
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 160);
        lookTo((dx / d * 9 * m).toFixed(1), (dy / d * 7 * m).toFixed(1));
      },
      getState: function () { return state; },
      setState: function (s) {
        if (['idle', 'reading', 'found', 'failed'].indexOf(s) < 0) return;
        state = s;
        if (s === 'idle') startIdle(); else stopIdle();
        var on = s === 'reading';
        if (on && !el.classList.contains('sb-reading')) tether.start();
        el.classList.toggle('sb-reading', on);
        if (!on) setTimeout(function () { if (!el.classList.contains('sb-reading')) tether.stop(); }, 450);
        if (svg.dataset.state === s) { svg.dataset.state = ''; void svg.getBoundingClientRect(); }
        svg.dataset.state = s;
        if (s === 'idle' || s === 'found') { lookG.style.removeProperty('--lx'); lookG.style.removeProperty('--ly'); }
        el.setAttribute('data-svbot-state', s);
      },
      destroy: function () {
        stopIdle(); clearInterval(failT); tether.destroy();
        var i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
        el.removeEventListener('click', onTap); el.innerHTML = ''; el.classList.remove('svbot-host', 'sb-reading');
      }
    };
    function onTap() { svg.classList.remove('sb-tap'); void svg.getBoundingClientRect(); svg.classList.add('sb-tap'); clearTimeout(tapT); tapT = setTimeout(function () { svg.classList.remove('sb-tap'); }, 600); }
    el.addEventListener('click', onTap);
    failT = setInterval(function () { if (state === 'failed' || state === 'reading') blink(130); }, 2800 + Math.random() * 1500);
    instances.push(inst);
    inst.setState(opts.state || 'idle');
    return inst;
  }

  window.SVBot = { mount: mount };
})();
