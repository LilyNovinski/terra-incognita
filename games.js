/* =====================================================================
   Terra Incognita · SALLE DE JEUX (games.js) — chargé après decks.js
   ---------------------------------------------------------------------
   AJOUTER UN JEU (vague 2…) : 1 entrée dans GAMES + ses textes dans GI18N.
   GAMES[id] = {
     icon:'🍾', min:2, max:8, dur:8, tags:['social'|'skill'|'chance'], tone:true (lit st.tone),
     init(s)       : s.game existe déjà {id,k,r,n,sc,done,rx}. Prépare tout, ouvre la 1re étape avec gWait().
     act(s,from,a) : action d'un joueur ({t:'g',k,...}). Met g.done[from]=1 quand il a fini. Retourne true si changé.
     next(s)       : appelé par le moteur quand tous les joueurs attendus (en ligne) ont fini OU sablier vide.
                     Ouvre l'étape suivante (gWait) ou met g.over=1.
     view(s)       : -> {html, hint?, hintBtn?, mine?, bind?}  (s = état VU par ce joueur, déjà filtré)
     hide(g,name)  : optionnel, copie de g sans les secrets des autres (appelé par viewFor côté hôte).
     fin(s)        : -> {pts:{nom:points}, coop?} quand g.over ; endView(s) optionnel pour l'écran final.
   }
   Étapes : gWait(g,sec,nom,rv) => nouveau g.k (anime), done={}, sablier g.dl. rv=1 : étape de révélation,
   chacun clique « Continuer » (géré ici) — on avance quand TOUT le monde est prêt ou sablier vide.
   g.need = liste des joueurs attendus (défaut : tous). Joueurs hors ligne jamais attendus.
   Textes : GT(k,v) lit GI18N[LANG].ui puis fr ; accords {g:masc|fém}. Contenus : listes '|' alignées par index,
   réserves par ton : clé, clé+'1' (coquin), clé+'2' (trash) — gPool() ne pioche le 18+ que si st.tone le permet.
   Branchements dans index.html : marqués @games (lobby, act, view, viewFor, kick, clé d'animation).
   ===================================================================== */
(function(){
const W=typeof window!='undefined'?window:globalThis;
const GAMES=W.GAMES={};
const GV={v:-1,t:0,fx:null};
const RM=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};

/* ---------- textes ---------- */
const GLc={};
function GL(k,lang){lang=lang||(typeof LANG!='undefined'?LANG:'fr');const id=lang+':'+k;if(GLc[id])return GLc[id];
 const d=GI18N[lang]&&GI18N[lang][k]!=null?GI18N[lang][k]:GI18N.fr[k]||'';return GLc[id]=d.split('|')}
function GC(k,pi){const key=k+(pi[0]||''),l=GL(key);return l[pi[1]]!=null&&l[pi[1]]!==''?l[pi[1]]:GL(key,'fr')[pi[1]]}
W.GT=function(k,v){const L=(GI18N[typeof LANG!='undefined'?LANG:'fr']||GI18N.fr).ui;let s=L[k]??GI18N.fr.ui[k]??k;
 try{s=gz(s,x=>x?gOf(gPlain(v&&v[x])):GME())}catch(e){}return v?s.replace(/\{(\w+)\}/g,(m,x)=>v[x]!=null?v[x]:m):s};
const GT=W.GT;
/* pioche n contenus [réserve,index] selon le ton (0 : tout public seulement) */
function gPool(s,k,n){const t=+s.tone||0,w=t==2?[.3,.3,.4]:t==1?[.55,.45,0]:[1,0,0];
 const P3=[0,1,2].map(p=>w[p]?shuf([...Array(GL(k+(p||''),'fr').length).keys()].map(i=>[p,i])):[]),out=[];
 for(let j=0;j<n;j++){let r=Math.random(),p=0;while(p<2&&(r-=w[p])>0)p++;if(!P3[p].length)p=P3.findIndex(x=>x.length);if(p<0)break;out.push(P3[p].pop())}
 return shuf(out)}

/* ---------- moteur ---------- */
const gOn=s=>s.order.filter(n=>{const p=P(n);return p&&p.online!==false});
function gWait(g,sec,st,rv){g.st=st;g.k++;g.done={};g.need=null;g.dl=Date.now()+sec*1000;g.sec=sec;g.rv=rv?1:0}
const gNeed=s=>{const g=s.game;return gOn(s).filter(n=>!g.need||g.need.includes(n))};
const gAll=s=>gNeed(s).every(n=>s.game.done[n]);
function gFin(s){const g=s.game,r=GAMES[g.id].fin(s)||{};s.gres={pts:r.pts||g.sc,coop:r.coop||null};g.dl=0;s.phase='gend'}
function gCheck(s){const g=s.game;let i=0;
 while(s.phase=='game'&&g.dl&&(gAll(s)||Date.now()>g.dl)&&i++<6){g.dl=0;GAMES[g.id].next(s);if(g.over){gFin(s);break}}}
function gStart(s){const id=s.gsel;s.game={id,k:0,r:0,n:0,sc:{},done:{},rx:{}};s.order.forEach(n=>s.game.sc[n]=0);s.gres=null;s.phase='game';s.gid=Date.now().toString(36);GAMES[id].init(s);gCheck(s)}
/* @games : appelé en tête de act() ; true = géré ici */
W.GAct=function(s,from,a){const t=a&&a.t;
 if(t=='gsel'){if(from==s.host&&s.phase=='lobby'&&(!a.v||GAMES[a.v])){s.gsel=a.v||null;bump()}return true}
 if(t=='start'&&s.gsel&&s.phase=='lobby'){const G=GAMES[s.gsel],on=s.players.filter(p=>p.online);
  if(from==s.host&&G&&on.length>=G.min&&on.length<=G.max){s.order=on.map(p=>p.name);gStart(s);bump()}return true}
 if(t=='gx'&&a.v=='stop'){if(from==s.host&&s.phase=='game'&&s.game){gFin(s);bump()}return true}
 if(t=='gx'){if(from!=s.host||s.phase!='gend')return true;s.players=s.players.filter(p=>p.online);
  const G=GAMES[s.game.id],on=s.players.map(p=>p.name);
  if(a.v=='again'&&on.length>=G.min&&on.length<=G.max){s.gsel=s.game.id;s.order=on;gStart(s)}else{s.phase='lobby';s.game=null;s.gres=null}
  bump();return true}
 if(t=='g'){const g=s.game;if(s.phase!='game'||!g||!s.order.includes(from))return true;if(a.k!=null&&a.k!==g.k&&!a.rx)return true;
  let ch=false;if(a.rx&&typeof a.rx=='string'&&RX.includes(a.rx)){g.rx[from]=a.rx;ch=true}
  else if(a.ok&&g.rv){if(!g.done[from]){g.done[from]=1;ch=true}}
  else ch=!!GAMES[g.id].act(s,from,a);
  if(ch){gCheck(s);bump()}return true}
 return false};
W.GHide=function(name,s){if(!s||s.phase!='game'||!s.game)return s;const G=GAMES[s.game.id];return G&&G.hide?{...s,game:G.hide(s.game,name,s)}:s};
W.GKick=function(s,name){s.order=s.order.filter(x=>x!=name);if(s.phase!='game'||!s.game)return;if(s.order.length<2)gFin(s);else gCheck(s)};
W.gTick=function(){try{if(isHost&&st&&st.phase=='game'&&st.game&&st.game.dl&&(Date.now()>st.game.dl||gAll(st))){gCheck(st);bump()}}catch(e){}};
if(typeof setInterval!='undefined'&&typeof document!='undefined')setInterval(W.gTick,1000);

/* ---------- aides de vue ---------- */
const RX=['😎','😱','🫧','🦈'];
const gs=a=>send({t:'g',k:st.game.k,...a});
const meN=()=>me.name;
const NM=n=>n=='~'?`<b>🐟 ${esc(GT('ghost'))}</b>`:B(n);
const DT=n=>n=='~'?'<span class="dot" style="background:#7aa6b8"></span>':DOT(n);
const dl=(i,b=0)=>`style="animation-delay:${(b+i*.07).toFixed(2)}s"`;
function gHint(s){const g=s.game,m=meN(),need=gNeed(s);
 if(g.rv){const w=need.filter(n=>!g.done[n]);return g.done[m]?{hint:w.length?GT('waitN',{n:w.map(B).join(', ')}):'…'}:{hint:GT('ready'),hintBtn:`<button class="pri gokb" id="gok">${GT('ok')}</button>`,mine:true}}
 if(!need.includes(m))return{hint:GT('watch')};
 if(!g.done[m])return{hint:GT('yourMove'),mine:true};
 const w=need.filter(n=>!g.done[n]);return{hint:GT('waitN',{n:w.map(B).join(', ')})}}
const pick=(names,cur,attr,ex)=>`<div class="gpk">${names.filter(n=>n!=ex).map((n,i)=>`<button class="ga ${cur==n?'sel':''}" ${dl(i)} ${attr}="${esc(n)}">${DT(n)}<span>${n==meN()?GT('me'):esc(n)}</span></button>`).join('')}</div>`;
const norm=w=>String(w||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'').replace(/^(.{4,})[sx]$/,'$1');
const hideOwn=(o,n)=>{const r={};for(const k in o||{})r[k]=k==n?o[k]:null;return r};

W.GView=function(){const s=st,g=s.game;if(!g||!GAMES[g.id])return{html:''};
 if(s.v!==GV.v){GV.v=s.v;GV.t=Date.now()}
 if(s.phase=='gend')return gEndView(s);
 const G=GAMES[g.id],v=G.view(s)||{},two=s.order.length==2;
 const rem=g.dl?Math.max(0,(g.dl-(s.updatedAt||Date.now())-(Date.now()-GV.t))/1000):0;
 const rk='r_'+g.id+(two&&GI18N.fr.ui['r_'+g.id+'2']?'2':'');
 const head=`<div class="ghd"><span class="gic">${G.icon}</span><b>${GT('n_'+g.id)}</b>${g.n?`<span class="grd">${Math.min(g.r+1,g.n)} / ${g.n}</span>`:''}${meN()==s.host?`<button class="gstop" id="gstop" aria-label="${esc(GT('stopAsk'))}" data-tip="${esc(GT('stopAsk'))}">✕</button>`:''}</div>
 ${g.dl?`<div class="gsab" aria-hidden="true"><i style="animation-duration:${g.sec}s;animation-delay:-${Math.max(0,g.sec-rem).toFixed(2)}s"></i></div>`:''}
 ${g.k<=1?`<p class="grule">${GT(rk)}</p>`:''}`;
 const h={...gHint(s),...v};const ob=v.bind;
 return{...h,html:`<div class="gw g-${g.id}">${head}${v.html}</div>`,bind(){
  $('#gok')&&($('#gok').onclick=()=>gs({ok:1}));$('#gstop')&&($('#gstop').onclick=()=>ask(GT('stopAsk'),GT('stop')).then(v=>v&&send({t:'gx',v:'stop'})));
  if(GV.fx!==g.id+g.k){GV.fx=g.id+g.k;if(g.rv)try{SFX.reveal()}catch(e){}}
  ob&&ob()}}};

function gEndView(s){const g=s.game,G=GAMES[g.id],R=s.gres||{pts:{}},host=meN()==s.host,two=s.order.length==2;
 const rows=Object.entries(R.pts).sort((a,b)=>b[1]-a[1]);let rank=0,prev=null;
 const list=R.coop?'':`<div class="gsc">${rows.map(([n,p],i)=>{if(p!==prev){rank=i;prev=p}return `<div class="grow ga ${n==meN()?'me':''}" ${dl(i,.1)}><span class="gmd">${['🥇','🥈','🥉'][rank]||rank+1}</span>${DT(n)}<span class="gnm">${NM(n)}</span><b class="gpt">${p}</b></div>`}).join('')}</div>`;
 const html=`<div class="gw g-${g.id}"><div class="ghd"><span class="gic">${G.icon}</span><b>${GT('n_'+g.id)}</b></div>
 <div class="card"><h3>${GT(R.coop?'coopT':'scores')}</h3>${list}${G.endView?G.endView(s):''}</div>
 ${host?`<div class="gbtns"><button class="pri wide" data-gend="again">${GT('again')}</button><button class="ghost wide" data-gend="lobby">${GT('lobby')}</button></div>`:''}</div>`;
 return{html,mine:host,hint:host?GT('hostNext'):GT('waitHostN',{n:B(s.host)}),bind(){
  $$('[data-gend]').forEach(b=>b.onclick=()=>send({t:'gx',v:b.dataset.gend}));
  if(GV.fx!=='end'+s.gid){GV.fx='end'+s.gid;if(!RM())setTimeout(()=>{try{confetti(rows[0]&&rows[0][0]==meN()||R.coop?50:24)}catch(e){}},350)}}}}

/* @games : carte « Salle de jeux » du salon */
W.GLobby=function(host,on){const sel=st.gsel&&GAMES[st.gsel]?st.gsel:'';
 const tile=id=>{const G=GAMES[id],ok=!id||(on>=G.min&&on<=G.max),tag=host?'button':'div';
  return `<${tag} class="gtile ggt ${sel==id?'sel':''}" ${host?`data-gsel="${id}" ${ok?'':'disabled'}`:''}><span class="gi">${id?G.icon:'⛵'}</span><span class="gt"><b>${id?GT('n_'+id):GT('exp')}</b><span class="mut">${id?GT('d_'+id):GT('expD')}</span></span>${id?`<span class="gtags">${G.tags.map(t=>`<i class="gtg-${t}">${GT('t_'+t)}</i>`).join('')}</span><span class="gmin">≈ ${G.dur} min · ${G.min}–${G.max} 👤</span>`:''}</${tag}>`};
 let h=`<div class="card"><h3>🎲 ${GT('room')}</h3><div class="gtiles">${host?['',...Object.keys(GAMES)].map(tile).join(''):tile(sel)}</div>${host?'':`<p class="gby">${T('chosenBy',{n:B(st.host)})}</p>`}</div>`;
 if(sel){const G=GAMES[sel],ok=on>=G.min&&on<=G.max,rk='r_'+sel+(on==2&&GI18N.fr.ui['r_'+sel+'2']?'2':'');
  h+=(G.tone?g2ToneCard(host):'')+`<div class="card"><p class="grule">${GT(rk)}</p>${ok?'':`<p class="err">${GT('needP',{a:G.min,b:G.max})}</p>`}
  ${host?`<button class="pri wide" id="start" ${ok?'':'disabled'}>${GT('play',{g:GT('n_'+sel)})}</button>`:`<p class="gby">${GT('waitHost')}</p>`}</div>`}
 return h};

/* =====================================================================
   🍾 BOUTEILLES À LA MER — fiche
   Boucle : écriture secrète (240 s) → bouteilles une par une (vote 45 s) → révélation (prêt/20 s).
   Décision : à qui ressemble cette anecdote ? L'auteur·e vote aussi (leurre) : personne ne voit qui s'abstient.
   Points (3+) : bonne devinette +2. Auteur·e : +3 si personne ne trouve, +1 si trouvé par une partie, 0 si tous.
     → Écrire du fade n'est pas dominant : une anecdote neutre donne des votes au hasard (P(personne)=(1-1/(n-1))^(n-1)
       ≈ 30 % à 4, 34 % à 8) donc ≈1,1 pt/bouteille, alors qu'une vraie fausse piste (vraie, mais qui « ressemble » à
       quelqu'un d'autre) vise les +3 et fait rire. Une anecdote évidente rapporte 0 à l'auteur·e mais +2 à chacun.
       Sim. node (2000 parties/taille, pts auteur par bouteille) : n=4 fausse piste 2.01 > fade 1.55 > évidente 0.35 ;
       n=8 2.21 > 1.69 > 0.73. La fausse piste gagne toujours : c'est elle qu'on veut encourager.
   À 2 : variante « vraie ou inventée » : chacun écrit 3 anecdotes, au moins une vraie et une inventée (le ratio est
     libre → « toujours vraie » n'est pas dominant). Les deux devinent en même temps la bouteille de l'autre : +2 si
     juste, sinon +2 au bluffeur. 3 manches, ~5 min.
   À 3-4 : 3 bouteilles chacun (9-12 tours). À 5-8 : 2 chacun (10-16 tours, ~12 min), tours ordonnés pour alterner
     les auteur·es. Égalité finale : places partagées. Ton 18+ : invitation à des anecdotes osées.
   ===================================================================== */
GAMES.bot={icon:'🍾',min:2,max:8,dur:10,tags:['social'],tone:true,
 init(s){const g=s.game;g.w={};gWait(g,240,'w')},
 act(s,from,a){const g=s.game,two=s.order.length==2;
  if(g.st=='w'&&Array.isArray(a.w)&&!g.done[from]){const w=a.w.slice(0,3).map(x=>tidy(x).slice(0,220)),f=(a.f||[]).slice(0,3).map(x=>x?1:0);
   if(two){if(w.filter(Boolean).length<3||!f.includes(1)||!f.includes(0))return;g.w[from]=w.map((t,i)=>({t,f:f[i]}))}
   else{const k=w.filter(Boolean);if(k.length<2)return;g.w[from]=k.map(t=>({t,f:0}))}
   g.done[from]=1;return true}
  if(g.st=='v'&&!g.done[from]){if(two){if(a.v!==0&&a.v!==1)return;g.v[from]=a.v}else{if(!s.order.includes(a.v)||a.v==from)return;g.v[from]=a.v}g.done[from]=1;return true}},
 next(s){const g=s.game,two=s.order.length==2;
  if(g.st=='w'){if(two){const [a,b]=s.order;if(!g.w[a]||!g.w[b]){g.over=1;return}g.n=3;g.i=0;g.h=[];g.v={};gWait(g,45,'v');return}
   const per=s.order.length>=5?2:3,q=[];
   for(let i=0;i<per;i++)shuf(s.order).forEach(n=>{const b=(g.w[n]||[])[i];if(b)q.push({a:n,t:b.t})});
   for(let i=1;i<q.length;i++)if(q[i].a==q[i-1].a){const j=q.findIndex((x,k)=>k>i&&x.a!=q[i].a);if(j>0)[q[i],q[j]]=[q[j],q[i]]}
   g.q=q;g.n=q.length;g.i=-1;delete g.w;return this.nx(s)}
  if(g.st=='v'){if(two){const [a,b]=s.order,r={v:{...g.v}};[[a,b],[b,a]].forEach(([x,y])=>{const bt=g.w[y][g.i],gv=g.v[x];if(gv==null)return;if(gv==bt.f)g.sc[x]+=2;else g.sc[y]+=2});g.h[g.i]=r;gWait(g,25,'r',1);return}
   const b=g.q[g.i],gu=Object.keys(g.v).filter(n=>n!=b.a),ok=gu.filter(n=>g.v[n]==b.a);ok.forEach(n=>g.sc[n]+=2);
   const bonus=!ok.length?3:ok.length<gu.length?1:0;if(s.order.includes(b.a))g.sc[b.a]+=bonus;b.v={...g.v};b.ok=ok;b.b=bonus;gWait(g,20,'r',1);return}
  if(g.st=='r'){if(two){g.i++;g.r=g.i;if(g.i>=3){g.over=1;return}g.v={};gWait(g,45,'v');return}return this.nx(s)}},
 nx(s){const g=s.game;g.i++;while(g.i<g.q.length&&!s.order.includes(g.q[g.i].a))g.i++;if(g.i>=g.q.length){g.over=1;return}g.v={};g.r=g.i;gWait(g,45,'v')},
 hide(g,n,s){const o={...g},two=s.order.length==2;
  if(g.w){o.w={};for(const x in g.w){if(x==n){o.w[x]=g.w[x];continue}if(g.st=='w')continue;o.w[x]=g.w[x].map((b,j)=>j<g.i||(j==g.i&&g.st=='r')?b:j==g.i?{t:b.t}:null)}}
  if(g.q)o.q=g.q.map((b,i)=>i<g.i||(i==g.i&&g.st=='r')?b:i==g.i?{t:b.t,m:b.a==n?1:0}:null);
  if(g.st=='v')o.v=hideOwn(g.v,n);return o},
 view(s){const g=s.game,m=meN(),two=s.order.length==2,t18=(+s.tone||0)>0;
  if(g.st=='w'){if(g.done[m])return{html:`<div class="card c"><div class="gbig ga gfloat">🍾</div><p class="ga" ${dl(2)}>${GT('bwait')}</p></div>`};
   const fl=i=>drafts['gbf'+i]=='1';
   return{html:`<div class="card">${[0,1,2].map(i=>`<div class="gwr ga" ${dl(i)}>${two?`<button type="button" class="gtf ${fl(i)?'f':''}" data-gf="${i}" aria-pressed="${fl(i)}">${GT(fl(i)?'bF':'bT')}</button>`:''}<textarea data-d="gbw${i}" rows="2" maxlength="220" placeholder="${esc(GT(two?'bph2':t18?'bph18':'bph'))}"></textarea></div>`).join('')}<p class="err"></p><button class="pri wide" id="gsend">${GT('send')}</button></div>`,
    bind(){$$('[data-gf]').forEach(b=>b.onclick=()=>{const k='gbf'+b.dataset.gf,v=drafts[k]=='1'?'0':'1';drafts[k]=v;b.classList.toggle('f',v=='1');b.setAttribute('aria-pressed',v=='1');b.textContent=GT(v=='1'?'bF':'bT')});
     $('#gsend').onclick=()=>{const w=[0,1,2].map(i=>tidy($(`[data-d="gbw${i}"]`).value)),f=[0,1,2].map(fl);
      if(two?(w.some(x=>!x)||!f.includes(true)||!f.includes(false)):w.filter(Boolean).length<2)return err(GT(two?'bmin2':'bmin'));gs({w,f})}}}}
  if(two){const o=s.order.find(x=>x!=m),b=(g.w[o]||[])[g.i]||{},my=(g.w[m]||[])[g.i]||{};
   if(g.st=='v')return{html:`<div class="card c"><p class="mut">${GT('bfrom',{n:B(o)})}</p><div class="gbottle ga">${esc(b.t||'')}</div><p class="gq2">${GT('bguess')}</p>
    <div class="gpk">${[0,1].map(v=>`<button class="ga ${g.v[m]===v?'sel':''}" ${dl(v,.15)} data-gb="${v}">${GT(v?'bF':'bT')}</button>`).join('')}</div></div>`,bind(){$$('[data-gb]').forEach(x=>x.onclick=()=>gs({v:+x.dataset.gb}))}};
   const h=g.h[g.i]||{v:{}},row=(x,y)=>{const bt=g.w[y][g.i],gv=h.v[x],ok=gv==bt.f;return `<div class="gres ga" ${dl(x==m?0:3)}><div class="gbottle sm">${esc(bt.t)}</div><p><span class="gtag ${bt.f?'f':''}">${GT(bt.f?'bF':'bT')}</span> ${gv==null?'—':ok?GT('bok',{n:NM(x)}):GT('bfool',{n:NM(y)})}</p></div>`};
   return{html:`<div class="card">${row(m,o)}${row(o,m)}</div>`}}
  const b=g.q[g.i]||{};
  if(g.st=='v')return{html:`<div class="card c"><div class="gbottle ga">${esc(b.t||'')}</div>${b.m?`<p class="gnote ga" ${dl(2)}>${GT('bmine')}</p>`:''}<p class="gq2">${GT('bwho')}</p>${pick(s.order,g.v[m],'data-gv',m)}</div>`,
   bind(){$$('[data-gv]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gv}))}};
  const vs=Object.entries(b.v||{}).filter(([n])=>n!=b.a);
  return{html:`<div class="card c"><div class="gbottle sm">${esc(b.t||'')}</div><p class="gby2 ga" ${dl(2)}>${GT('bby',{n:NM(b.a)})}</p>
   <div class="gvl">${vs.map(([n,v],i)=>`<span class="gchip ga ${v==b.a?'ok':''}" ${dl(i,.35)}>${DT(n)}${esc(n)} → ${esc(v)}</span>`).join('')}</div>
   <p class="gnote ga" ${dl(vs.length,.4)}>${b.b==3?GT('bnone',{n:NM(b.a)}):b.b==1?GT('bsome',{n:NM(b.a)}):GT('ball')}</p></div>`,
   bind(){if(b.ok&&b.ok.includes(m)&&!RM())sparkles($('.gby2'),12)}}},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🗼 LE PHARE — fiche
   Boucle : énoncé « Qui de nous… » → vote simultané (30 s) → révélation en barres (prêt/12 s). Rafale de 10 (2-4) ou 12 (5-8).
   3+ : on peut voter pour soi. +1 si ton vote va à la personne la plus citée (seulement si elle a ≥2 voix :
     un vote éparpillé ne récompense personne). Stratégie « toujours la même personne » : perd dès que le groupe varie.
     Titre de la manche : la ou les personnes les plus citées (≥2 voix ; égalité = titre partagé).
   À 2 : « Qui de nous deux » : chacun choisit ET prédit le choix de l'autre (+1 par prédiction juste). Titre seulement
     si vous êtes d'accord → le portrait final montre vos accords, et les désaccords font parler.
   Fin : portrait du groupe (titres récoltés par chacun·e). Ton : réserves tout public / coquine / trash.
   ===================================================================== */
GAMES.pha={icon:'🗼',min:2,max:8,dur:5,tags:['social'],tone:true,
 init(s){const g=s.game;g.n=s.order.length<=4?10:12;g.q=gPool(s,'pha',g.n);g.n=g.q.length;g.v={};g.p={};g.res=[];gWait(g,30,'v')},
 act(s,from,a){const g=s.game,two=s.order.length==2;if(g.st!='v'||g.done[from])return;
  if(s.order.includes(a.v))g.v[from]=a.v;if(two&&s.order.includes(a.p))g.p[from]=a.p;
  if(g.v[from]&&(!two||g.p[from]))g.done[from]=1;return true},
 next(s){const g=s.game,two=s.order.length==2;
  if(g.st=='v'){const c={};for(const n in g.v)c[g.v[n]]=(c[g.v[n]]||0)+1;let tops=[];
   if(two){const [a,b]=s.order;if(g.v[a]&&g.v[a]==g.v[b])tops=[g.v[a]];[[a,b],[b,a]].forEach(([x,y])=>{if(g.p[x]&&g.p[x]==g.v[y])g.sc[x]++})}
   else{const top=Math.max(0,...Object.values(c));if(top>=2)tops=Object.keys(c).filter(n=>c[n]==top);for(const n in g.v)if(tops.includes(g.v[n]))g.sc[n]++}
   g.res.push({q:g.q[g.r],v:{...g.v},p:{...g.p},c,tops});gWait(g,12,'r',1);return}
  g.r++;if(g.r>=g.n){g.over=1;return}g.v={};g.p={};gWait(g,30,'v')},
 hide(g,n){return g.st=='v'?{...g,v:hideOwn(g.v,n),p:hideOwn(g.p,n)}:g},
 view(s){const g=s.game,m=meN(),two=s.order.length==2,o=two&&s.order.find(x=>x!=m);
  const q=`<p class="gpre">${GT(two?'pq2':'pq')}</p><p class="gq ga">${esc(GC('pha',g.q[g.r]))}</p>`;
  if(g.st=='v')return{html:`<div class="card c">${q}${pick(s.order,g.v[m],'data-gv')}${two?`<p class="gq2">${GT('ppred',{n:B(o)})}</p>${pick(s.order,g.p[m],'data-gp')}`:''}</div>`,
   bind(){$$('[data-gv]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gv}));$$('[data-gp]').forEach(x=>x.onclick=()=>gs({p:x.dataset.gp}))}};
  const r=g.res[g.r]||{c:{},v:{},p:{}},mx=Math.max(1,...Object.values(r.c));
  if(two){const [a,b]=[m,o];return{html:`<div class="card c">${q}<div class="gduo">${[a,b].map((x,i)=>`<div class="ga" ${dl(i*2,.1)}>${DT(x)}<b>${x==m?GT('me'):esc(x)}</b> → ${NM(r.v[x]||'—')}<br><span class="gtag ${r.p[x]&&r.p[x]==r.v[x==a?b:a]?'ok':'no'}">${GT('ppredS')} ${r.p[x]?esc(r.p[x]):'—'} ${r.p[x]&&r.p[x]==r.v[x==a?b:a]?'✓':'✗'}</span></div>`).join('')}</div><p class="gnote ga" ${dl(5)}>${r.tops.length?'🗼 '+GT('pagree'):GT('pdis')}</p></div>`}}
  const rows=s.order.map(n=>[n,r.c[n]||0]).sort((x,y)=>y[1]-x[1]);
  return{html:`<div class="card">${q}${rows.map(([n,c],i)=>`<div class="gbr ga ${r.tops.includes(n)?'gtop':''}" ${dl(i,.1)}><span class="gnm">${DT(n)}${esc(n)}</span><span class="gbt"><i class="gbar" style="width:${c/mx*100}%;animation-delay:${.2+i*.07}s"></i></span><b>${c||''}</b></div>`).join('')}
   ${r.tops.length?'':`<p class="gnote">${GT('pnone')}</p>`}</div>`,bind(){if(r.tops.includes(m)&&!RM())sparkles($('.gbr.gtop'),10)}}},
 endView(s){const g=s.game,t={};g.res.forEach(r=>r.tops.forEach(n=>(t[n]=t[n]||[]).push(r.q)));
  return `<h3 class="gh3">🗼 ${GT('pport')}</h3>${s.order.map((n,i)=>`<div class="gport ga" ${dl(i,.3)}><b>${DT(n)}${esc(n)}</b>${(t[n]||[]).length?`<ul>${t[n].map(q=>`<li>${esc(GC('pha',q))}</li>`).join('')}</ul>`:`<p class="mut">${GT('pnone')}</p>`}</div>`).join('')}`},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🌊 MÊME VAGUE — fiche
   Boucle : amorce → chacun écrit son 1er mot (35 s) → mots regroupés (prêt/14 s). 8 amorces.
   3+ : points = nombre d'AUTRES personnes avec le même mot ; +1 si vous êtes pile deux (complicité rare).
     « N'importe quoi » rapporte 0 ; recopier l'amorce est refusé. Le mot évident rapporte à 5-8, mais à 3-4 un duo
     complice (+2) vaut autant qu'un trio : il faut lire QUI pense comme toi. Accents, casse et pluriel en -s/-x ignorés.
   À 2 : coopératif. Même mot = +2. Raté → manche « pont » : vous voyez vos deux mots et écrivez un mot qui les relie
     (+1). Score de connexion sur 16 avec un palier final. Ton : réserves de mots tout public / coquins / trash.
   ===================================================================== */
GAMES.vag={icon:'🌊',min:2,max:8,dur:5,tags:['skill'],tone:true,
 init(s){const g=s.game;g.n=8;g.q=gPool(s,'vag',8);g.n=g.q.length;g.w={};g.res=[];gWait(g,35,'v')},
 act(s,from,a){const g=s.game;if((g.st!='v'&&g.st!='b')||g.done[from])return;const w=tidy(a.w).slice(0,32);if(!norm(w))return;g.w[from]=w;g.done[from]=1;return true},
 next(s){const g=s.game,two=s.order.length==2;
  if(g.st=='v'||g.st=='b'){const nw={};for(const n in g.w)nw[n]=norm(g.w[n]);
   if(two){const [a,b]=s.order,ok=nw[a]&&nw[a]==nw[b];
    if(g.st=='v'){g.res.push({q:g.q[g.r],w:{...g.w},ok:ok?2:0});if(ok){g.sc[a]+=2;g.sc[b]+=2;gWait(g,12,'r',1)}else if(nw[a]&&nw[b]){g.w0={...g.w};g.w={};gWait(g,35,'b')}else gWait(g,12,'r',1);return}
    const r=g.res[g.r];r.b={...g.w};if(ok){r.ok=1;g.sc[a]++;g.sc[b]++}gWait(g,12,'r',1);return}
   const gr={};for(const n in nw)if(nw[n])(gr[nw[n]]=gr[nw[n]]||[]).push(n);const pts={};
   for(const k in gr){const l=gr[k];l.forEach(n=>{pts[n]=l.length-1+(l.length==2?1:0);g.sc[n]+=pts[n]})}
   g.res.push({q:g.q[g.r],w:{...g.w},gr:Object.values(gr).sort((x,y)=>y.length-x.length),pts});gWait(g,14,'r',1);return}
  g.r++;if(g.r>=g.n){g.over=1;return}g.w={};delete g.w0;gWait(g,35,'v')},
 hide(g,n){return g.st=='v'||g.st=='b'?{...g,w:hideOwn(g.w,n)}:g},
 view(s){const g=s.game,m=meN(),two=s.order.length==2,q=GC('vag',g.q[g.r]);
  const head=`<p class="gq ga gseed">${esc(q)}</p>`;
  if(g.st=='v'||g.st=='b'){const mine=g.w[m],br=g.st=='b';
   return{html:`<div class="card c">${head}${br?`<div class="gduo">${s.order.map((n,i)=>`<div class="ga" ${dl(i)}>${DT(n)}<b>${esc((g.w0||{})[n]||'—')}</b></div>`).join('')}</div><p class="gnote">${GT('vmiss')} ${GT('vbr')}</p>`:''}
    ${mine?`<p class="gword ga">${esc(mine)}</p>`:`<div class="grow2"><input data-d="gvw${g.k}" maxlength="32" autocomplete="off" placeholder="${esc(GT(br?'vbr':'vin'))}"><button class="pri" id="gsend">${GT('send')}</button></div><p class="err"></p>`}</div>`,
    bind(){const i=$(`[data-d="gvw${g.k}"]`);if(!i)return;const go=()=>{const w=tidy(i.value);if(!norm(w))return;if(norm(w)==norm(q)||(br&&Object.values(g.w0||{}).some(x=>norm(x)==norm(w))))return err(GT('vno'));gs({w})};
     $('#gsend').onclick=go;i.onkeydown=e=>{if(e.key=='Enter')go()};if(matchMedia('(pointer:fine)').matches&&document.activeElement!==i)i.focus()}}}
  const r=g.res[g.r]||{w:{}};
  if(two){const [a,b]=s.order,ok=r.ok;return{html:`<div class="card c">${head}<div class="gduo">${[a,b].map((n,i)=>`<div class="ga" ${dl(i)}>${DT(n)}<b>${esc(r.w[n]||'—')}</b>${r.b?`<br><span class="mut">→ ${esc(r.b[n]||'—')}</span>`:''}</div>`).join('')}</div>
   <p class="gbig2 ga ${ok?'ok':''}" ${dl(3)}>${ok==2?GT('vsame')+' +2':ok==1?GT('vpont')+' +1':GT('vmiss')}</p></div>`,bind(){if(ok&&!RM())sparkles($('.gbig2'),ok==2?18:8)}}}
  return{html:`<div class="card">${head}${(r.gr||[]).map((l,i)=>`<div class="ggr ga ${l.length>1?'hit':''}" ${dl(i,.1)}><b>${esc(r.w[l[0]])}</b><span>${l.map(n=>`<span class="gchip">${DT(n)}${esc(n)}</span>`).join('')}</span>${l.length>1?`<i class="gpt">+${r.pts[l[0]]}</i>`:''}</div>`).join('')}
   ${s.order.filter(n=>!r.w[n]).length?`<p class="mut">… ${s.order.filter(n=>!r.w[n]).map(esc).join(', ')}</p>`:''}</div>`,bind(){if((r.pts||{})[m]&&!RM())sparkles($('.ggr.hit'),10)}}},
 fin(s){const g=s.game;if(s.order.length==2){const v=g.sc[s.order[0]];return{pts:g.sc,coop:{v,max:g.n*2}}}return{pts:g.sc}},
 endView(s){const R=s.gres;if(!R.coop)return '';const f=R.coop.v/R.coop.max,lv=f>=.6?2:f>=.3?1:0;
  return `<div class="gconn ga"><b class="gcv">${R.coop.v} / ${R.coop.max}</b><div class="gbt"><i class="gbar" style="width:${f*100}%"></i></div><p>🌊 ${GT('vc'+lv)}</p></div>`}};

/* =====================================================================
   🛟 LE RADEAU — fiche
   Boucle : dilemme A/B → chacun choisit ET parie sur le choix majoritaire (40 s) → camps révélés (prêt/15 s). 8 dilemmes.
   3+ : pari juste +1 ; pari juste alors que TOI tu es dans la minorité +2 (lucidité). Égalité parfaite : aucun pari ne
     gagne (« le radeau tangue »). Parier comme soi-même n'est pas dominant : le bonus de minorité paie la lucidité.
     Sim. node (3000 parties/taille, pts sur 8 dilemmes) : n=4 lire le groupe 5.56 > parier comme soi 4.84 > toujours A 3.41
     ≈ hasard 3.38 ; n=8 7.20 > 5.12 > 4.25. Lire le groupe est la compétence récompensée.
   À 2 : chacun choisit et devine le choix de l'autre : +1 par devinette juste. Fin : « âmes jumelles du radeau »
     (la paire la plus souvent d'accord, à toute taille). Ton : réserves tout public / coquine / trash.
   ===================================================================== */
GAMES.rad={icon:'🛟',min:2,max:8,dur:7,tags:['social','skill'],tone:true,
 init(s){const g=s.game;g.n=s.order.length==2?10:8;g.q=gPool(s,'rad',g.n);g.n=g.q.length;g.c={};g.b={};g.res=[];gWait(g,40,'v')},
 act(s,from,a){const g=s.game;if(g.st!='v'||g.done[from])return;if(a.c===0||a.c===1)g.c[from]=a.c;if(a.b===0||a.b===1)g.b[from]=a.b;if(g.c[from]!=null&&g.b[from]!=null)g.done[from]=1;return true},
 next(s){const g=s.game,two=s.order.length==2;
  if(g.st=='v'){let mj=-1;
   if(two){const [a,b]=s.order;[[a,b],[b,a]].forEach(([x,y])=>{if(g.b[x]!=null&&g.b[x]===g.c[y])g.sc[x]++})}
   else{const n1=Object.values(g.c).filter(x=>x==1).length,n0=Object.values(g.c).filter(x=>x==0).length;mj=n1>n0?1:n0>n1?0:-1;
    if(mj>=0)for(const n in g.b)if(g.b[n]===mj)g.sc[n]+=g.c[n]!=null&&g.c[n]!==mj?2:1}
   g.res.push({q:g.q[g.r],c:{...g.c},b:{...g.b},mj});gWait(g,15,'r',1);return}
  g.r++;if(g.r>=g.n){g.over=1;return}g.c={};g.b={};gWait(g,40,'v')},
 hide(g,n){return g.st=='v'?{...g,c:hideOwn(g.c,n),b:hideOwn(g.b,n)}:g},
 view(s){const g=s.game,m=meN(),two=s.order.length==2,o=two&&s.order.find(x=>x!=m),op=GC('rad',g.q[g.r]).split('~');
  if(g.st=='v')return{html:`<div class="card c"><div class="gab">${[0,1].map(i=>`<button class="gopt ga ${g.c[m]===i?'sel':''}" ${dl(i)} data-gc="${i}">${esc(op[i]||'')}</button>`).join(`<span class="gor">${GT('or')}</span>`)}</div>
   <p class="gq2">${two?GT('rbet2',{n:B(o)}):GT('rbet')}</p><div class="gpk">${[0,1].map(i=>`<button class="ga ${g.b[m]===i?'sel':''}" ${dl(i,.2)} data-gb="${i}">${esc(op[i]||'')}</button>`).join('')}</div></div>`,
   bind(){$$('[data-gc]').forEach(x=>x.onclick=()=>gs({c:+x.dataset.gc}));$$('[data-gb]').forEach(x=>x.onclick=()=>gs({b:+x.dataset.gb}))}};
  const r=g.res[g.r]||{c:{},b:{}};const okB=n=>two?r.b[n]!=null&&r.b[n]===r.c[s.order.find(x=>x!=n)]:r.mj>=0&&r.b[n]===r.mj;
  return{html:`<div class="card"><div class="gcamps">${[0,1].map(i=>`<div class="gcamp ga ${r.mj===i?'maj':''}" ${dl(i)}><p class="gopt2">${esc(op[i]||'')}${r.mj===i?` <span class="gtag ok">${GT('rmaj')}</span>`:''}</p>${s.order.filter(n=>r.c[n]===i).map((n,j)=>`<span class="gchip ga" ${dl(j,.25+i*.2)}>${DT(n)}${esc(n)}${okB(n)?' ✓':''}</span>`).join('')}</div>`).join('')}</div>
   ${!two&&r.mj<0?`<p class="gnote ga">${GT('rtie')}</p>`:''}</div>`}},
 endView(s){const g=s.game,o=s.order;let best=null;
  for(let i=0;i<o.length;i++)for(let j=i+1;j<o.length;j++){const k=g.res.filter(r=>r.c[o[i]]!=null&&r.c[o[i]]===r.c[o[j]]).length;if(!best||k>best[2])best=[o[i],o[j],k]}
  return best&&best[2]?`<p class="gnote ga">${GT('rtwin')} : ${B(best[0])} & ${B(best[1])} · ${best[2]}/${g.res.length}</p>`:''},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🦪 PÊCHE AUX PERLES — fiche
   Sac commun VISIBLE (19) : perles 1,1,1,2,2,2,3,3,4,5,6,8 (Σ38) + 2 méduses + 5 requins. 1er requin vers le 3e tirage.
   Boucle (simultanée) : un tirage → tous ceux encore en bas décident en secret (25 s) : Remonter (le filet va au coffre)
     ou Plonger. Puis nouveau tirage pour ceux restés en bas.
   • Perle : chaque plongeur en bas l'ajoute à son filet ; SEUL·E au fond, elle compte ×2 (pousse les autres à remonter : bluff).
   • Méduse : pique le plus gros filet en bas (égalité : tous) qui perd la moitié → mener coûte, on remonte quand on mène.
   • 2e requin : ceux en bas perdent leur filet, la manche s'arrête. Le 1er requin est inoffensif mais affiché (risque %).
   Info partielle : qui est en bas et les filets sont publics ; les COFFRES sont secrets jusqu'à la fin ; réactions 😎😱🫧🦈.
   Équilibrage (sim. node, 6000 parties par taille, stratégies à seuil après le 1er requin) : moyenne par seuil H à 4 joueurs :
   H3 26.9 · H5 28.1 · H7 28.8 · H9 28.5 · H12 26.7 · H16 22.9 · jamais 0 (écart-type 11→18) : optimum au milieu, courbe plate
   = vrai dilemme (sécurité contre variance), pas de stratégie dominante. Avec 3 requins l'avidité dominait : rejeté.
   Manches : 4 (2-4 joueurs), 3 (5-8). À 2 : le Mérou 🐟, plongeur fantôme à stratégie lisible (remonte à 8, ou à 4 après
   un requin), compte pour « seul·e au fond » et la méduse, et figure au classement : moyenne 23.6 contre 28.3 pour un
   joueur au seuil 8, il finit 1er dans 34 % des parties : battable, mais menaçant. Égalité : places partagées.
   ===================================================================== */
const PBAG=[1,1,1,2,2,2,3,3,4,5,6,8,'m','m','r','r','r','r','r'];
GAMES.pec={bag:PBAG,icon:'🦪',min:2,max:8,dur:7,tags:['chance'],
 init(s){const g=s.game;g.n=s.order.length>=5?3:4;g.ps=[...s.order];if(g.ps.length==2)g.ps.push('~');g.cof={};g.ps.forEach(n=>g.cof[n]=0);g.r=-1;g.mh=[];this.man(s)},
 man(s){const g=s.game;g.r++;if(g.r>=g.n){g.over=1;return}g.bag=shuf(this.bag);g.out=[];g.down=g.ps.filter(n=>n=='~'||s.order.includes(n));g.fil={};g.down.forEach(n=>g.fil[n]=0);g.sh=0;g.upv={};g.lost={};g.last=[];g.ch={};this.draw(s)},
 draw(s){const g=s.game,it=g.bag.pop(),ev={it,x:1,t:[]};g.out.push(it);
  if(typeof it=='number'){ev.x=g.down.length==1?2:1;g.down.forEach(n=>g.fil[n]+=it*ev.x)}
  else if(it=='m'){const mx=Math.max(0,...g.down.map(n=>g.fil[n]));if(mx>0)g.down.filter(n=>g.fil[n]==mx).forEach(n=>{const l=Math.ceil(g.fil[n]/2);g.fil[n]-=l;ev.t.push(n)})}
  else{g.sh++;if(g.sh>=2){g.down.forEach(n=>{if(g.fil[n])g.lost[n]=g.fil[n];g.fil[n]=0});ev.t=[...g.down];g.down=[]}}
  g.ev=ev;if(!g.down.length||!g.bag.length)return this.endm(s);
  gWait(g,25,'d');g.need=g.down.filter(n=>n!='~');g.ch={};g.rx={};
  if(g.down.includes('~')){const f=g.fil['~'];g.ch['~']=f>=8||(g.sh>=1&&f>=4)?'u':'d'}},
 endm(s){const g=s.game;g.down.forEach(n=>{g.cof[n]+=g.fil[n];g.upv[n]=(g.upv[n]||0)+g.fil[n]});g.down=[];g.mh.push({upv:{...g.upv},lost:{...g.lost}});gWait(g,16,'e',1)},
 act(s,from,a){const g=s.game;if(g.st!='d'||!g.down.includes(from)||(a.v!='u'&&a.v!='d'))return;g.ch[from]=a.v;g.done[from]=1;return true},
 next(s){const g=s.game;if(g.st=='e')return this.man(s);
  const up=g.down.filter(n=>(g.ch[n]||'u')=='u');up.forEach(n=>{g.cof[n]+=g.fil[n];g.upv[n]=g.fil[n]});g.down=g.down.filter(n=>!up.includes(n));g.last=up;
  if(!g.down.length)return this.endm(s);this.draw(s)},
 hide(g,n){const o={...g,cof:{[n]:g.cof[n]}};if(g.st=='d')o.ch=hideOwn(g.ch,n);return o},
 view(s){const g=s.game,m=meN(),ev=g.ev||{},down=g.down.includes(m);
  const left=g.bag.length,pl=g.bag.filter(x=>typeof x=='number').sort((a,b)=>a-b),nm=g.bag.filter(x=>x=='m').length,nr=g.bag.filter(x=>x=='r').length;
  const bag=`<div class="gbag"><span class="mut">${GT('pbag')} · ${left}</span><div>${pl.map(v=>`<i class="gpl v${v}">${v}</i>`).join('')}${'<i class="gjl">🪼</i>'.repeat(nm)}${'<i class="gsh">🦈</i>'.repeat(nr)}</div>
   <p class="grisk ${g.sh?'hot':''}">${g.sh?GT('prisk',{p:Math.round(nr/Math.max(1,left)*100)}):GT('psafe')}</p></div>`;
  const evh=ev.it==null?'':typeof ev.it=='number'?`<div class="gev ga pearl"><span class="gpl big v${ev.it}">${ev.it}</span>${ev.x==2?`<b>${GT('pdouble')}</b>`:''}</div>`
   :ev.it=='m'?`<div class="gev ga jel"><span class="gbig">🪼</span><b>${GT('pjel')}</b>${ev.t.length?`<span>${ev.t.map(NM).join(', ')} −½</span>`:''}</div>`
   :`<div class="gev ga shk ${g.sh>=2?'dead':''}"><span class="gbig">🦈</span><b>${g.sh>=2?GT('pdead'):GT('pshark')} (${g.sh}/2)</b></div>`;
  const divers=`<div class="gdv">${g.ps.filter(n=>g.fil[n]!=null).map((n,i)=>{const d=g.down.includes(n);return `<span class="gchip ${d?'dn':'up'} ${n==m?'me':''}">${d?'🤿':'⛵'} ${DT(n)}${n=='~'?'🐟':esc(n)} <b>${d?g.fil[n]:g.upv[n]!=null?'+'+g.upv[n]:g.lost[n]?'✗':''}</b>${g.rx[n]&&d?` <span class="grx">${g.rx[n]}</span>`:''}</span>`}).join('')}</div>`;
  const cof=`<p class="gcof">🔒 ${GT('pcof')} : <b>${g.cof[m]??0}</b> <span class="mut">· ${GT('psecret')}</span></p>`;
  if(g.st=='e'){const h=g.mh.at(-1)||{upv:{},lost:{}};return{html:`<div class="card c">${evh}<h3>${GT('pmanche')}</h3><div class="gdv">${g.ps.map((n,i)=>`<span class="gchip ga" ${dl(i,.2)}>${DT(n)}${n=='~'?'🐟':esc(n)} <b>${h.upv[n]!=null?'+'+h.upv[n]:h.lost[n]?'✗ −'+h.lost[n]:'0'}</b></span>`).join('')}</div>${cof}</div>`}}
  return{html:`<div class="card c">${evh}${divers}${down?`<p class="gfil">${GT('pfil')} : <b>${g.fil[m]}</b></p><div class="gpk">${[['u','pup','⛵'],['d','pdown','🤿']].map(([v,k,ic],i)=>`<button class="ga gdec ${g.ch[m]==v?'sel':''}" ${dl(i)} data-gd="${v}">${ic} ${GT(k)}</button>`).join('')}</div>
   <div class="grxb">${RX.map(e=>`<button class="ghost" data-grx="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`:`<p class="gnote">${g.upv[m]!=null?GT('pyouup',{v:g.upv[m]}):g.lost[m]?GT('pdead'):''}</p>`}${bag}${cof}</div>`,
   bind(){$$('[data-gd]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gd}));$$('[data-grx]').forEach(x=>x.onclick=()=>send({t:'g',rx:x.dataset.grx}))}}},
 fin(s){const p={};for(const n in s.game.cof)if(n=='~'||s.order.includes(n))p[n]=s.game.cof[n];return{pts:p}}};

/* ---------- styles (injectés) ---------- */
if(typeof document!='undefined'){const c=document.createElement('style');c.id='games-css';c.textContent=`
.gw{--gease:cubic-bezier(.22,1,.36,1)}
.ghd{display:flex;align-items:center;gap:8px;font:600 19px Fredoka,Nunito,sans-serif;margin:8px 4px 8px;color:var(--deep)}
.ghd .gic{font-size:26px;line-height:1}.ghd .gstop{margin-inline-start:6px;width:30px;height:30px;padding:0;border-radius:50%;font-size:13px;line-height:1;box-shadow:0 2px 0 var(--edge2);color:var(--mut)}.ghd .grd+.gstop{margin-inline-start:6px}.ghd b+.gstop{margin-inline-start:auto}.ghd .grd{margin-inline-start:auto;font:800 13px Nunito;color:var(--mut);background:var(--paper);border:2px solid var(--edge);border-radius:99px;padding:2px 10px}
.gsab{height:6px;border-radius:9px;background:var(--edge);overflow:hidden;margin:0 4px 10px}
.gsab i{display:block;height:100%;background:linear-gradient(90deg,var(--ink),var(--gold));transform-origin:left;animation-name:gsab;animation-timing-function:linear;animation-fill-mode:both}
[dir=rtl] .gsab i{transform-origin:right}
@keyframes gsab{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.grule{font-size:14px;color:var(--txt);margin:0 0 10px;line-height:1.45;background:var(--paper);border:2px solid var(--edge);border-radius:16px;padding:9px 12px;opacity:.95}.card .grule{border:0;padding:0;background:none;color:var(--mut)}
.gw .card{margin-top:0}
.gpre{font:700 13px Nunito;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin:0}
.gq{font:600 22px/1.3 Fredoka,Nunito,sans-serif;text-align:center;margin:4px 0 14px;color:var(--txt)}
.gseed{font-size:30px;color:var(--deep)}
.gq2{font:700 15px Nunito;color:var(--mut);margin:16px 0 8px;text-align:center}
.gpk{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.gpk>button{flex:1 1 42%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 10px;min-width:0;font-size:16px}
.gpk>button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gw button{transition:transform .15s var(--gease),box-shadow .15s,background .2s,border-color .2s}
.gw button:not(:disabled):active{transform:translateY(3px) scale(.98);box-shadow:0 1px 0 var(--edge2)}
.gw button.sel{border-color:var(--acc);background:#fff1e4;box-shadow:0 4px 0 var(--acc-d)}
.ga{animation:gin .34s var(--gease,ease) both}
@keyframes gin{from{opacity:0;transform:translateY(8px) scale(.97)}}
.still .ga,.still .gbar{animation:none}
.gbig{font-size:46px;line-height:1.1;display:block}
.gfloat{animation:gin .34s ease both,gfl 4s ease-in-out .4s infinite}
@keyframes gfl{50%{transform:translateY(-5px) rotate(-4deg)}}
.gbottle{background:linear-gradient(180deg,#eefcff,#d3f1f5);border:2px solid #b5e3ea;border-radius:18px;padding:16px;font:600 18px/1.4 Nunito;color:#0e4652;text-align:center;overflow-wrap:anywhere}
.gbottle.sm{font-size:16px;padding:12px}
.gnote{font:700 15px Nunito;color:var(--deep);margin:12px 0 0;text-align:center}
.gby2{font:600 20px Fredoka,Nunito;margin:12px 0 8px;text-align:center}
.gvl,.gdv{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}
.gchip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;background:var(--paper2);border:2px solid var(--edge);font:700 13px Nunito;max-width:100%;overflow-wrap:anywhere}
.gchip.ok{border-color:var(--ink);background:#dff5ec}
.gchip.me{outline:2px solid var(--acc);outline-offset:1px}
.gchip.up{opacity:.75}
.gtag{display:inline-block;font:800 12px Nunito;padding:2px 9px;border-radius:99px;background:#dff5ec;color:var(--ink)}
.gtag.f,.gtag.no{background:#ffe6d2;color:var(--acc-d)}
.gwr{display:flex;gap:8px;align-items:stretch;margin-bottom:10px}
.gwr textarea{min-height:64px;flex:1}
.gtf{flex:none;width:92px;font-size:13px;padding:6px;background:#dff5ec;border-color:#8fd8bd;color:var(--ink)}
.gtf.f{background:#ffe6d2;border-color:#f3b88c;color:var(--acc-d)}
.gres{margin:6px 0 14px}.gres p{margin:8px 0 0;text-align:center;font:700 14px Nunito}
.gduo{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0;text-align:center}
.gduo>div{background:var(--paper2);border-radius:16px;padding:12px 8px;overflow-wrap:anywhere;font:600 15px/1.5 Nunito}
.gduo b{font-size:18px}
.gbr{display:grid;grid-template-columns:minmax(0,9em) 1fr 2em;align-items:center;gap:8px;margin:7px 0;font:700 14px Nunito}
.gbr .gnm{display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.gbt{height:12px;border-radius:9px;background:var(--paper2);overflow:hidden}
.gbar{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,var(--acc2),var(--acc));transform-origin:left;animation:gbar .4s var(--gease,ease) both}
[dir=rtl] .gbar{transform-origin:right}
.gbr.gtop .gbar{background:linear-gradient(90deg,var(--gold),var(--acc))}
.gbr.gtop .gnm{color:var(--acc-d)}
@keyframes gbar{from{transform:scaleX(0)}}
.gh3{margin-top:18px}
.gport{padding:10px 12px;border-radius:14px;background:var(--paper2);margin:8px 0}
.gport b{display:flex;align-items:center;gap:6px}.gport ul{margin:6px 0 0;padding-inline-start:20px;font-size:14px}.gport p{margin:4px 0 0}
.grow2{display:flex;gap:8px}.gduo .dot{margin-inline-end:6px;vertical-align:middle}.grow2 input{flex:1;min-width:0}.grow2 .pri{font-size:16px;padding:10px 14px}
.gword{font:600 24px Fredoka,Nunito;color:var(--ink);text-align:center;margin:6px 0}
.ggr{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:var(--paper2);margin:8px 0}
.ggr>b{font:600 18px Fredoka,Nunito;overflow-wrap:anywhere}.ggr>span{display:flex;flex-wrap:wrap;gap:4px;flex:1}
.ggr.hit{background:#dff5ec;border:2px solid #8fd8bd}
.ggr .gpt,.grow .gpt{font:800 15px Nunito;font-style:normal;color:var(--ink)}
.gbig2{font:600 22px Fredoka,Nunito;text-align:center;margin:12px 0 0;color:var(--mut)}.gbig2.ok{color:var(--ink)}
.gconn{text-align:center;margin-top:8px}.gcv{font:600 34px Fredoka,Nunito;color:var(--ink)}.gconn .gbt{height:14px;margin:8px 0}
.gab{display:flex;flex-direction:column;gap:8px;align-items:stretch}
.gopt{font:600 18px/1.3 Fredoka,Nunito;padding:16px 14px;white-space:normal;overflow-wrap:anywhere}
.gor{font:800 12px Nunito;color:var(--mut);text-transform:uppercase}
.gcamps{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gcamp{background:var(--paper2);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:0;border:2px solid transparent}
.gcamp.maj{border-color:var(--gold)}
.gopt2{font:600 16px/1.3 Fredoka,Nunito;margin:0 0 4px;overflow-wrap:anywhere}
.gsc{display:flex;flex-direction:column;gap:6px}
.grow{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;background:var(--paper2)}
.grow.me{outline:2px solid var(--acc)}.grow .gmd{width:1.6em;text-align:center}.grow .gnm{flex:1;min-width:0;overflow-wrap:anywhere}.grow .gpt{font-size:18px}
.gbtns{display:flex;flex-direction:column;gap:10px;margin:6px 0}
.gtiles .ggt .gtags{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.gtags i{font:800 11px Nunito;font-style:normal;padding:1px 8px;border-radius:99px;background:#e3f6f4;color:var(--deep)}
.gtags i.gtg-chance{background:#fde9cc;color:#9a5410}.gtags i.gtg-skill{background:#e3e7fb;color:#3d4c9a}
.gtile:disabled{opacity:.5}
.gbag{margin-top:14px;padding:10px;border-radius:14px;background:var(--paper2)}
.gbag>div{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:6px 0}
.gpl{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;font:800 11px Nunito;font-style:normal;color:#5a4a3a;background:radial-gradient(circle at 35% 30%,#fff,#f1e8dc 60%,#d8c8b4)}
.gpl.v3{background:radial-gradient(circle at 35% 30%,#fff,#d9f0ff 60%,#9cc6e6)}.gpl.v5{background:radial-gradient(circle at 35% 30%,#fff,#ffe1f0 60%,#e9a3c6)}.gpl.v8{background:radial-gradient(circle at 35% 30%,#fff7d0,#f6cf52 60%,#c99a1c);color:#5b4200}
.gpl.big{width:64px;height:64px;font-size:26px;box-shadow:0 6px 18px #0002}
.gjl,.gsh{font-style:normal;font-size:18px;line-height:24px}
.grisk{margin:0;font:800 13px Nunito;color:var(--mut)}.grisk.hot{color:var(--bad)}
.gev{display:flex;flex-direction:column;align-items:center;gap:6px;margin:4px 0 10px;font:600 17px Fredoka,Nunito}
.gev.shk b{color:var(--bad)}.gev.dead .gbig{animation:gshk .4s ease 2}
@keyframes gshk{25%{transform:translateX(-6px) rotate(-6deg)}75%{transform:translateX(6px) rotate(6deg)}}
.gdec{font-size:18px!important;padding:14px!important}
.gfil{font:700 16px Nunito;margin:12px 0 8px}.gfil b{font-size:22px;color:var(--ink)}
.gcof{font:700 14px Nunito;margin:10px 0 0}
.grxb{display:flex;gap:6px;justify-content:center;margin-top:10px}.grxb button{padding:6px 12px;font-size:18px;box-shadow:none}
.grx{animation:gin .3s ease both}
.gokb{pointer-events:auto}
[data-theme=dark] .gw button.sel{background:#3a2a1c}
[data-theme=dark] .ghd{color:#eaf7f9;text-shadow:0 1px 3px #000a}
[data-theme=dark] .gbottle{background:linear-gradient(180deg,#123e52,#0f3344);border-color:#21607a;color:#d9f4f8}
[data-theme=dark] .gchip.ok,[data-theme=dark] .ggr.hit{background:#123d33;border-color:#2c7a62}
[data-theme=dark] .gtag{background:#123d33}[data-theme=dark] .gtag.f,[data-theme=dark] .gtag.no{background:#43291a;color:var(--sur)}
[data-theme=dark] .gtf{background:#123d33;border-color:#2c7a62}[data-theme=dark] .gtf.f{background:#43291a;border-color:#7a4a2a;color:var(--sur)}
[data-theme=dark] .gtags i{background:#12403f;color:#8fd6dc}[data-theme=dark] .gtags i.gtg-chance{background:#45321a;color:#ffc27a}[data-theme=dark] .gtags i.gtg-skill{background:#262f5a;color:#b7c1ff}
[data-theme=dark] .gpl{color:#3b2a1b}
@media (max-width:420px){.grow2{flex-direction:column}.gq{font-size:19px}.gseed{font-size:26px}.gbr{grid-template-columns:minmax(0,7em) 1fr 1.6em}.gtf{width:78px}.gcamps{gap:6px}}
@media (prefers-reduced-motion:reduce){.gw .ga,.gw .gbar,.gfloat,.gev .gbig,.grx{animation:none!important}.gsab i{animation-duration:0s!important;display:none}}
`;(document.head||document.documentElement).appendChild(c)}

/* =====================================================================
   TEXTES — GI18N[lang] = {ui:{…}, pha, pha1, pha2, vag, vag1, vag2, rad, rad1, rad2}
   (listes '|' alignées par index ; dilemmes « A~B » ; réserve 1 = coquin, 2 = trash, 18+ entre adultes)
   ===================================================================== */
const GI18N=W.GI18N={};
GI18N.fr={ui:{stopAsk:`Arrêter ce jeu et voir les scores ?`,stop:`Arrêter`,room:`Salle de jeux`,exp:`Expédition`,expD:`Le voyage d'île en île`,play:`Jouer à {g}`,waitHost:`L'hôte lance la partie`,needP:`De {a} à {b} joueurs`,
t_skill:`skill`,t_chance:`chance`,t_social:`social`,send:`Envoyer`,ok:`Continuer`,me:`moi`,or:`ou`,waitN:`On attend {n}`,yourMove:`À toi !`,watch:`Regarde les autres jouer`,ready:`{g:Prêt|Prête} ? On continue quand tout le monde l'est`,
scores:`Scores`,coopT:`Score de connexion`,again:`Rejouer`,lobby:`Retour au salon`,hostNext:`Rejouer, ou retour au salon ?`,waitHostN:`{n} choisit la suite`,
n_bot:`Bouteilles à la mer`,d_bot:`Des anecdotes vraies et anonymes : qui les a écrites ?`,
r_bot:`Écris 2 ou 3 choses vraies sur toi. Elles arrivent anonymes : trouve l'auteur (+2). Personne ne te trouve ? +3. Une partie seulement ? +1.`,
r_bot2:`Écris 3 anecdotes, vraies ou inventées (au moins une de chaque). Devine celles de l'autre (+2) ; chaque bluff réussi te rapporte +2.`,
bph:`Une chose vraie sur toi…`,bph18:`Une chose vraie (et osée) sur toi…`,bph2:`Une anecdote sur toi…`,bmin:`Écris-en au moins 2`,bmin2:`Remplis les 3, avec au moins une vraie et une inventée`,bwait:`Tes bouteilles sont à l'eau`,
bwho:`Qui a écrit ça ?`,bmine:`C'est la tienne : vote quand même, pour brouiller les pistes`,bby:`Écrite par {n}`,bnone:`Personne n'a trouvé : +3 pour {n}`,bsome:`Juste assez mystérieux : +1 pour {n}`,ball:`Tout le monde a trouvé !`,
bT:`Vraie`,bF:`Inventée`,bguess:`Vraie ou inventée ?`,bfrom:`Bouteille de {n}`,bfool:`Bluff réussi : +2 pour {n}`,bok:`Bien vu : +2 pour {n}`,
n_pha:`Le Phare`,d_pha:`Qui de nous… ? Votez, le phare éclaire le groupe`,r_pha:`Vote pour la personne qui colle le mieux, même toi. +1 si tu votes comme la majorité.`,r_pha2:`Choisis l'un de vous deux, puis prédis la réponse de l'autre : +1 si tu vois juste.`,
pq:`Qui de nous…`,pq2:`Qui de nous deux…`,ppred:`Et {n} va répondre…`,ppredS:`prédit`,pport:`Portrait du groupe`,pnone:`Aucun titre cette fois`,pagree:`D'accord !`,pdis:`Pas d'accord…`,
n_vag:`Même vague`,d_vag:`Un mot, le premier qui vient : pensez pareil`,r_vag:`Écris le premier mot qui te vient. +1 par personne qui a écrit le même, +1 si vous êtes pile deux.`,r_vag2:`Écrivez le même mot : +2. Raté ? Un mot-pont pour relier vos deux mots : +1.`,
vin:`Ton premier mot`,vbr:`Un mot qui relie les deux`,vsame:`Même vague !`,vpont:`Pont réussi !`,vmiss:`Pas cette fois…`,vno:`Pas ce mot-là !`,vc0:`Eaux troubles`,vc1:`Les courants se croisent`,vc2:`Même longueur d'onde`,
n_rad:`Le Radeau`,d_rad:`Tu préfères… et le groupe ?`,r_rad:`Choisis, puis parie sur le choix de la majorité : +1 si tu vois juste, +2 si toi tu étais dans la minorité.`,r_rad2:`Choisis, puis devine le choix de l'autre : +1 si tu vois juste.`,
rbet:`La majorité va choisir…`,rbet2:`{n} va choisir…`,rtie:`Égalité : le radeau tangue, aucun pari ne gagne`,rmaj:`majorité`,rtwin:`Âmes jumelles du radeau`,
n_pec:`Pêche aux perles`,d_pec:`Plonger encore, ou remonter avec son filet ?`,
r_pec:`Chaque plongée tire un objet du sac. Au 2e requin, ceux en bas perdent leur filet. La méduse pique le plus gros filet (−½). Seul au fond : perles ×2.`,
r_pec2:`Chaque plongée tire un objet du sac. Au 2e requin, ceux en bas perdent leur filet. La méduse pique le plus gros filet (−½). Seul au fond : perles ×2. Le Mérou 🐟 plonge avec vous : il remonte à 8, ou à 4 après un requin.`,
pup:`Remonter`,pdown:`Plonger`,pfil:`Ton filet`,pcof:`Coffre`,pbag:`Dans le sac`,pshark:`Requin !`,pjel:`Méduse !`,pdead:`2e requin : filets perdus`,pdouble:`Seul au fond : ×2`,
prisk:`Risque 🦈 : {p} %`,psafe:`1er requin : sans danger`,pmanche:`Fin de la manche`,ghost:`Le Mérou`,psecret:`secrets jusqu'à la fin`,pyouup:`{g:Remonté|Remontée} : +{v}`},
pha:`survivrait le plus longtemps sur une île déserte|partirait en voyage sur un coup de tête|pleure devant les films|garde le mieux un secret|se perdrait dans sa propre ville|deviendra célèbre un jour|parle aux animaux|oublie les anniversaires|rit au pire moment|mange le dernier morceau sans demander|répond aux messages trois jours après|adopterait dix chats|finit toujours par avoir raison|chante sous la douche|se lève avant le soleil|donne les meilleurs conseils|gagnerait un concours de danse|a la meilleure mémoire|dirait oui à n'importe quelle aventure|prendrait la barre du navire|tomberait à l'eau en premier|ferait un excellent espion|raconte les meilleures histoires|changerait de vie demain|cache le plus de talents|élèverait le mieux des enfants|s'endort n'importe où|connaît le plus de monde|négocie tout|ferait rire un requin|a le plus de patience|se ferait tatouer sur un coup de tête|a le plus d'imagination|se souvient de ses rêves|trouverait un trésor|écrira un livre un jour|calme n'importe quelle dispute|emporte toujours trop de bagages|parle le plus vite|ferait le meilleur repas avec trois fois rien`,
pha1:`a déjà envoyé un message coquin à la mauvaise personne|embrasse le mieux|a le plus de charme sans le savoir|ferait le premier pas|flirte sans s'en rendre compte|a le plus de succès en soirée|finirait dans un jacuzzi avec des inconnus|a déjà dormi chez quelqu'un dès le premier rendez-vous|a le regard le plus séducteur|danse le slow le plus collé-serré|garde les secrets d'alcôve les plus croustillants|a déjà joué au strip-poker|écrit les textos les plus torrides|rougit le plus vite|a le plus d'ex qui pensent encore à lui ou elle`,
pha2:`a déjà couché le premier soir|a le plus gros historique d'applis de rencontre|a déjà fait l'amour dans un lieu public|a déjà simulé|risque le plus d'avoir une sextape|a déjà envoyé un nude|a déjà recouché avec son ex|a le tiroir à jouets le mieux rempli|s'est déjà fait surprendre en plein acte|a le plus de partenaires au compteur|a déjà fait un plan à trois|est le plus bruyant au lit|a déjà oublié le prénom de quelqu'un au réveil|tournerait un porno amateur|a les fantasmes les plus tordus`,
vag:`océan|plage|île|été|nuit|café|chat|pluie|rêve|voyage|amour|musique|enfance|fête|hiver|montagne|soleil|lune|livre|train|forêt|école|maison|rouge|fromage|peur|vent|étoile|film|sport|jardin|fleur|chocolat|ville|dimanche|cadeau|neige|feu|piano|pirate|trésor|bateau|poisson|requin|sable|vacances|magie|dragon|pizza|téléphone|miroir|secret|sourire|voiture|avion|Noël|anniversaire|orage|cirque|nuage`,
vag1:`bisou|lingerie|séduction|massage|flirt|câlin|rendez-vous|désir|baignoire|champagne|draps|tentation|slow|regard|frisson`,
vag2:`orgasme|menottes|préservatif|sextape|strip-tease|plan à trois|fesses|nudisme|gémissement|sexto|kamasutra|lubrifiant|fétiche|quickie|vibromasseur`,
rad:`Vivre sur un bateau~Vivre dans une cabane perchée|Respirer sous l'eau~Voler dans les airs|Lire dans les pensées~Devenir invisible|Avoir toujours trop chaud~Avoir toujours trop froid|Une île déserte avec un bon livre~Une ville bondée avec tes amis|Connaître ton avenir~Revoir ton passé|Parler toutes les langues~Parler aux animaux|Plus jamais de musique~Plus jamais de films|Une fête surprise~Un dîner au calme|La gloire~Une fortune secrète|Voyager sans personne~Voyager à dix|La mer~La montagne|Le lever du soleil~Le coucher du soleil|Ne plus pouvoir mentir~Ne plus jamais entendre de mensonge|Un dauphin de compagnie~Un perroquet qui parle|Toujours dire ce que tu penses~Toujours tout garder pour toi|Revivre ta meilleure journée~Vivre une journée inconnue|Sucré~Salé|Une tempête au large~Un mois de calme plat|Explorer les abysses~Explorer l'espace|Un super-pouvoir inutile~Aucun pouvoir|Écrire un livre~Composer une chanson|Dormir à la belle étoile~Dormir dans un palace|Un an sans téléphone~Un an sans café|Tenir la barre~Tenir la cuisine du navire|Une vie de pirate~Une vie de sirène|Savoir tout cuisiner~Savoir tout réparer|Toujours en avance~Toujours en retard|Un an de vacances~Un an de salaire double|Te téléporter~Arrêter le temps|Trouver un trésor~Découvrir une île inconnue|Rire tout le temps~Ne jamais pleurer|Une maison sur pilotis~Un phare isolé|Chanter devant tout le monde~Danser devant tout le monde|Mille amis~Trois amis pour la vie|Un été éternel~Un hiver éternel|Lire tous les livres du monde~Voir tous les films du monde|Nager avec des requins~Marcher sur un fil au-dessus de la mer|Revenir à tes 10 ans~Sauter à tes 80 ans|Une soirée jeux~Une soirée karaoké`,
rad1:`Un premier baiser sous la pluie~Un premier baiser au coucher du soleil|Un massage~Un bain à deux|De la lingerie~Rien du tout|Draguer~Te faire draguer|Un rendez-vous à l'aveugle~Un rendez-vous avec ton ex|Des mots doux~Des regards brûlants|Une nuit à la belle étoile à deux~Une nuit dans un hôtel de luxe à deux|De longs préliminaires~Aller droit au but|Lumière allumée~Lumière éteinte|Le matin~Le soir|Un slow collé-serré~Une danse endiablée|Un texto coquin~Un appel à minuit|Un tatouage caché~Un piercing caché|Un partenaire qui cuisine~Un partenaire qui masse|Un baiser dans le cou~Un murmure à l'oreille`,
rad2:`Le sexe dans la mer~Le sexe sur la plage|Ta sextape publiée~Ton historique internet publié|Un plan à trois~Un club échangiste|Des menottes~Un bandeau sur les yeux|Coucher avec ton ex~Coucher avec quelqu'un du boulot|Un an sans sexe~Un an sans internet|Faire l'amour en silence à vie~Faire l'amour bruyamment à vie|Tes parents lisent tes fantasmes~Tu lis ceux de tes parents|Toujours dessus~Toujours dessous|Le sexe dans un avion~Le sexe dans un ascenseur|Ne plus jamais jouir~Jouir à chaque éternuement|Un nude qui fuite~Un vocal gênant qui fuite|Coucher le premier soir~Attendre trois mois|Une nuit avec une star~Une nuit avec ton crush secret|Des jouets~Que les mains`};

GI18N.en={ui:{stopAsk:`Stop this game and see the scores?`,stop:`Stop`,room:`Game room`,exp:`Expedition`,expD:`The island-hopping voyage`,play:`Play {g}`,waitHost:`The host starts the game`,needP:`{a} to {b} players`,
t_skill:`skill`,t_chance:`luck`,t_social:`social`,send:`Send`,ok:`Continue`,me:`me`,or:`or`,waitN:`Waiting for {n}`,yourMove:`Your move!`,watch:`Watch the others play`,ready:`Ready? We go on when everyone is`,
scores:`Scores`,coopT:`Connection score`,again:`Play again`,lobby:`Back to lobby`,hostNext:`Play again, or back to the lobby?`,waitHostN:`{n} picks what's next`,
n_bot:`Messages in a Bottle`,d_bot:`True, anonymous stories: who wrote them?`,r_bot:`Write 2 or 3 true things about you. They arrive anonymously: find the author (+2). Nobody finds you? +3. Only some? +1.`,
r_bot2:`Write 3 stories, true or made up (at least one of each). Guess the other's (+2); each successful bluff earns you +2.`,
bph:`Something true about you…`,bph18:`Something true (and daring) about you…`,bph2:`A story about you…`,bmin:`Write at least 2`,bmin2:`Fill all 3, with at least one true and one made up`,bwait:`Your bottles are afloat`,
bwho:`Who wrote this?`,bmine:`It's yours: vote anyway, to cover your tracks`,bby:`Written by {n}`,bnone:`Nobody found it: +3 for {n}`,bsome:`Just mysterious enough: +1 for {n}`,ball:`Everyone found it!`,
bT:`True`,bF:`Made up`,bguess:`True or made up?`,bfrom:`{n}'s bottle`,bfool:`Bluff worked: +2 for {n}`,bok:`Well spotted: +2 for {n}`,
n_pha:`The Lighthouse`,d_pha:`Who of us…? Vote, the lighthouse shines on the group`,r_pha:`Vote for whoever fits best, even you. +1 if you vote with the majority.`,r_pha2:`Pick one of you two, then predict the other's answer: +1 if you're right.`,
pq:`Who of us…`,pq2:`Which of us two…`,ppred:`And {n} will answer…`,ppredS:`guessed`,pport:`Group portrait`,pnone:`No title this time`,pagree:`Agreed!`,pdis:`Not agreed…`,
n_vag:`Same Wave`,d_vag:`One word, the first that comes: think alike`,r_vag:`Write the first word that comes to you. +1 per person with the same word, +1 if exactly two of you.`,r_vag2:`Write the same word: +2. Missed? A bridge word linking your two words: +1.`,
vin:`Your first word`,vbr:`A word linking both`,vsame:`Same wave!`,vpont:`Bridge built!`,vmiss:`Not this time…`,vno:`Not that word!`,vc0:`Murky waters`,vc1:`Currents crossing`,vc2:`Same wavelength`,
n_rad:`The Raft`,d_rad:`Would you rather… and the group?`,r_rad:`Choose, then bet on the majority's choice: +1 if right, +2 if you yourself were in the minority.`,r_rad2:`Choose, then guess the other's choice: +1 if right.`,
rbet:`The majority will pick…`,rbet2:`{n} will pick…`,rtie:`A tie: the raft rocks, no bet wins`,rmaj:`majority`,rtwin:`Raft soulmates`,
n_pec:`Pearl Diving`,d_pec:`Dive again, or surface with your net?`,r_pec:`Each dive draws from the bag. On the 2nd shark, those below lose their net. The jellyfish stings the biggest net (−½). Alone at the bottom: pearls ×2.`,
r_pec2:`Each dive draws from the bag. On the 2nd shark, those below lose their net. The jellyfish stings the biggest net (−½). Alone at the bottom: pearls ×2. The Grouper 🐟 dives with you: it surfaces at 8, or at 4 after a shark.`,
pup:`Surface`,pdown:`Dive`,pfil:`Your net`,pcof:`Chest`,pbag:`In the bag`,pshark:`Shark!`,pjel:`Jellyfish!`,pdead:`2nd shark: nets lost`,pdouble:`Alone at the bottom: ×2`,
prisk:`🦈 risk: {p}%`,psafe:`1st shark: harmless`,pmanche:`End of the round`,ghost:`The Grouper`,psecret:`secret until the end`,pyouup:`Surfaced: +{v}`},
pha:`would survive longest on a desert island|would leave on a trip on a whim|cries at movies|keeps a secret best|would get lost in their own town|will be famous one day|talks to animals|forgets birthdays|laughs at the worst moment|eats the last piece without asking|replies to messages three days later|would adopt ten cats|always ends up being right|sings in the shower|gets up before the sun|gives the best advice|would win a dance contest|has the best memory|would say yes to any adventure|would take the ship's helm|would fall in the water first|would make a great spy|tells the best stories|would change their life tomorrow|hides the most talents|would raise kids best|falls asleep anywhere|knows the most people|haggles over everything|could make a shark laugh|has the most patience|would get a tattoo on a whim|has the wildest imagination|remembers their dreams|would find a treasure|will write a book one day|calms down any argument|always packs too much|talks the fastest|would cook the best meal out of almost nothing`,
pha1:`has sent a flirty text to the wrong person|is the best kisser|has the most charm without knowing it|would make the first move|flirts without realizing it|is the biggest hit at parties|would end up in a hot tub with strangers|has spent the night at someone's place on a first date|has the most seductive look|slow-dances the closest|knows the juiciest bedroom secrets|has played strip poker|writes the steamiest texts|blushes fastest|has the most exes still thinking about them`,
pha2:`has slept with someone on the first night|has the biggest dating-app history|has had sex in a public place|has faked it|is most likely to have a sex tape|has sent a nude|has gone back to bed with an ex|has the best-stocked toy drawer|has been caught in the act|has the highest body count|has had a threesome|is the loudest in bed|has forgotten someone's name the morning after|would shoot an amateur porn|has the kinkiest fantasies`,
vag:`ocean|beach|island|summer|night|coffee|cat|rain|dream|journey|love|music|childhood|party|winter|mountain|sun|moon|book|train|forest|school|home|red|cheese|fear|wind|star|movie|sport|garden|flower|chocolate|city|Sunday|gift|snow|fire|piano|pirate|treasure|boat|fish|shark|sand|holidays|magic|dragon|pizza|phone|mirror|secret|smile|car|plane|Christmas|birthday|storm|circus|cloud`,
vag1:`kiss|lingerie|seduction|massage|flirt|cuddle|date|desire|bathtub|champagne|sheets|temptation|slow dance|gaze|shiver`,
vag2:`orgasm|handcuffs|condom|sex tape|striptease|threesome|butt|nudism|moan|sexting|kama sutra|lube|fetish|quickie|vibrator`,
rad:`Live on a boat~Live in a treehouse|Breathe underwater~Fly|Read minds~Become invisible|Always too hot~Always too cold|A desert island with a good book~A packed city with your friends|Know your future~Revisit your past|Speak every language~Talk to animals|No more music ever~No more movies ever|A surprise party~A quiet dinner|Fame~A secret fortune|Travel alone~Travel as ten|The sea~The mountains|Sunrise~Sunset|Never be able to lie~Never hear a lie again|A pet dolphin~A talking parrot|Always say what you think~Always keep it all inside|Relive your best day~Live an unknown day|Sweet~Salty|A storm at sea~A month of dead calm|Explore the deep sea~Explore space|A useless superpower~No power at all|Write a book~Write a song|Sleep under the stars~Sleep in a palace|A year without a phone~A year without coffee|Steer the ship~Run the ship's kitchen|A pirate's life~A mermaid's life|Cook anything~Fix anything|Always early~Always late|A year of holidays~A year of double pay|Teleport~Stop time|Find a treasure~Discover an unknown island|Laugh all the time~Never cry|A house on stilts~A lonely lighthouse|Sing in front of everyone~Dance in front of everyone|A thousand friends~Three friends for life|Endless summer~Endless winter|Read every book in the world~See every movie in the world|Swim with sharks~Walk a tightrope over the sea|Go back to age 10~Jump to age 80|A game night~A karaoke night`,
rad1:`A first kiss in the rain~A first kiss at sunset|A massage~A bath for two|Lingerie~Nothing at all|Flirt~Be flirted with|A blind date~A date with your ex|Sweet words~Burning looks|A night under the stars for two~A night in a luxury hotel for two|Long foreplay~Straight to the point|Lights on~Lights off|Mornings~Evenings|A close slow dance~A wild dance|A naughty text~A midnight call|A hidden tattoo~A hidden piercing|A partner who cooks~A partner who massages|A kiss on the neck~A whisper in the ear`,
rad2:`Sex in the sea~Sex on the beach|Your sex tape leaked~Your browser history leaked|A threesome~A swingers' club|Handcuffs~A blindfold|Sleep with your ex~Sleep with a coworker|A year without sex~A year without internet|Silent sex for life~Loud sex for life|Your parents read your fantasies~You read your parents'|Always on top~Always on the bottom|Sex on a plane~Sex in an elevator|Never climax again~Climax at every sneeze|A leaked nude~A leaked awkward voice note|Sleep together the first night~Wait three months|A night with a celebrity~A night with your secret crush|Toys~Hands only`};

GI18N.es={ui:{stopAsk:`¿Parar este juego y ver los puntos?`,stop:`Parar`,room:`Sala de juegos`,exp:`Expedición`,expD:`El viaje de isla en isla`,play:`Jugar a {g}`,waitHost:`El anfitrión inicia la partida`,needP:`De {a} a {b} jugadores`,
t_skill:`habilidad`,t_chance:`azar`,t_social:`social`,send:`Enviar`,ok:`Continuar`,me:`yo`,or:`o`,waitN:`Esperando a {n}`,yourMove:`¡Te toca!`,watch:`Mira jugar a los demás`,ready:`¿{g:Listo|Lista}? Seguimos cuando todos lo estén`,
scores:`Puntos`,coopT:`Puntuación de conexión`,again:`Otra vez`,lobby:`Volver a la sala`,hostNext:`¿Otra vez, o volver a la sala?`,waitHostN:`{n} elige qué sigue`,
n_bot:`Mensajes en botellas`,d_bot:`Anécdotas verdaderas y anónimas: ¿quién las escribió?`,r_bot:`Escribe 2 o 3 cosas verdaderas sobre ti. Llegan anónimas: adivina quién las escribió (+2). ¿Nadie te descubre? +3. ¿Solo algunos? +1.`,
r_bot2:`Escribe 3 anécdotas, verdaderas o inventadas (al menos una de cada). Adivina las del otro (+2); cada farol logrado te da +2.`,
bph:`Algo verdadero sobre ti…`,bph18:`Algo verdadero (y atrevido) sobre ti…`,bph2:`Una anécdota sobre ti…`,bmin:`Escribe al menos 2`,bmin2:`Rellena las 3, con al menos una verdadera y una inventada`,bwait:`Tus botellas ya flotan`,
bwho:`¿Quién escribió esto?`,bmine:`Es tuya: vota igual, para despistar`,bby:`Escrita por {n}`,bnone:`Nadie acertó: +3 para {n}`,bsome:`Justo lo bastante misterioso: +1 para {n}`,ball:`¡Todos acertaron!`,
bT:`Verdadera`,bF:`Inventada`,bguess:`¿Verdadera o inventada?`,bfrom:`Botella de {n}`,bfool:`Farol logrado: +2 para {n}`,bok:`Bien visto: +2 para {n}`,
n_pha:`El Faro`,d_pha:`¿Quién de nosotros…? Votad, el faro ilumina al grupo`,r_pha:`Vota por quien encaje mejor, incluso tú. +1 si votas como la mayoría.`,r_pha2:`Elige a uno de los dos y predice la respuesta del otro: +1 si aciertas.`,
pq:`Quién de nosotros…`,pq2:`Quién de los dos…`,ppred:`Y {n} va a responder…`,ppredS:`predijo`,pport:`Retrato del grupo`,pnone:`Ningún título esta vez`,pagree:`¡De acuerdo!`,pdis:`Sin acuerdo…`,
n_vag:`Misma ola`,d_vag:`Una palabra, la primera que venga: pensad igual`,r_vag:`Escribe la primera palabra que se te ocurra. +1 por cada persona con la misma, +1 si sois justo dos.`,r_vag2:`Escribid la misma palabra: +2. ¿Fallo? Una palabra puente que una las dos: +1.`,
vin:`Tu primera palabra`,vbr:`Una palabra que una las dos`,vsame:`¡Misma ola!`,vpont:`¡Puente logrado!`,vmiss:`Esta vez no…`,vno:`¡Esa palabra no!`,vc0:`Aguas turbias`,vc1:`Corrientes que se cruzan`,vc2:`Misma longitud de onda`,
n_rad:`La Balsa`,d_rad:`¿Qué prefieres… y el grupo?`,r_rad:`Elige y apuesta por la elección de la mayoría: +1 si aciertas, +2 si tú estabas en la minoría.`,r_rad2:`Elige y adivina la elección del otro: +1 si aciertas.`,
rbet:`La mayoría elegirá…`,rbet2:`{n} elegirá…`,rtie:`Empate: la balsa se tambalea, ninguna apuesta gana`,rmaj:`mayoría`,rtwin:`Almas gemelas de la balsa`,
n_pec:`Pesca de perlas`,d_pec:`¿Bucear otra vez o subir con tu red?`,r_pec:`Cada inmersión saca algo de la bolsa. Al 2.º tiburón, quienes están abajo pierden su red. La medusa pica la red más grande (−½). Solo en el fondo: perlas ×2.`,
r_pec2:`Cada inmersión saca algo de la bolsa. Al 2.º tiburón, quienes están abajo pierden su red. La medusa pica la red más grande (−½). Solo en el fondo: perlas ×2. El Mero 🐟 bucea con vosotros: sube con 8, o con 4 tras un tiburón.`,
pup:`Subir`,pdown:`Bucear`,pfil:`Tu red`,pcof:`Cofre`,pbag:`En la bolsa`,pshark:`¡Tiburón!`,pjel:`¡Medusa!`,pdead:`2.º tiburón: redes perdidas`,pdouble:`Solo en el fondo: ×2`,
prisk:`Riesgo 🦈: {p} %`,psafe:`1.er tiburón: sin peligro`,pmanche:`Fin de la ronda`,ghost:`El Mero`,psecret:`secretos hasta el final`,pyouup:`Arriba: +{v}`},
pha:`sobreviviría más tiempo en una isla desierta|se iría de viaje por impulso|llora con las películas|guarda mejor un secreto|se perdería en su propia ciudad|llegará a la fama un día|habla con los animales|olvida los cumpleaños|se ríe en el peor momento|se come el último trozo sin preguntar|contesta los mensajes tres días después|adoptaría diez gatos|siempre acaba teniendo razón|canta en la ducha|se levanta antes que el sol|da los mejores consejos|ganaría un concurso de baile|tiene la mejor memoria|diría que sí a cualquier aventura|llevaría el timón del barco|caería al agua antes que nadie|sería un espía excelente|cuenta las mejores historias|cambiaría de vida mañana|esconde más talentos|criaría mejor a sus hijos|se duerme en cualquier sitio|conoce a más gente|lo regatea todo|haría reír a un tiburón|tiene más paciencia|se tatuaría por impulso|tiene más imaginación|recuerda sus sueños|encontraría un tesoro|escribirá un libro algún día|calma cualquier discusión|siempre lleva demasiado equipaje|habla más rápido|haría la mejor comida con casi nada`,
pha1:`ha enviado un mensaje picante a la persona equivocada|besa mejor|tiene más encanto sin saberlo|daría el primer paso|coquetea sin darse cuenta|más triunfa en las fiestas|acabaría en un jacuzzi con desconocidos|ha dormido en casa de alguien en la primera cita|tiene la mirada más seductora|baila las lentas más pegadas|guarda los secretos de alcoba más jugosos|ha jugado al strip póker|escribe los mensajes más subidos de tono|se sonroja más rápido|tiene más ex que aún piensan en su persona`,
pha2:`se ha acostado con alguien la primera noche|tiene el historial de apps de citas más largo|ha tenido sexo en un lugar público|ha fingido un orgasmo|tiene más papeletas para un vídeo sexual|ha enviado un desnudo|ha vuelto a la cama con su ex|tiene el cajón de juguetes más lleno|ha sido pillado en pleno acto|tiene más parejas sexuales en su cuenta|ha hecho un trío|hace más ruido en la cama|ha olvidado el nombre de alguien a la mañana siguiente|grabaría un porno amateur|tiene las fantasías más retorcidas`,
vag:`océano|playa|isla|verano|noche|café|gato|lluvia|sueño|viaje|amor|música|infancia|fiesta|invierno|montaña|sol|luna|libro|tren|bosque|escuela|casa|rojo|queso|miedo|viento|estrella|película|deporte|jardín|flor|chocolate|ciudad|domingo|regalo|nieve|fuego|piano|pirata|tesoro|barco|pez|tiburón|arena|vacaciones|magia|dragón|pizza|teléfono|espejo|secreto|sonrisa|coche|avión|Navidad|cumpleaños|tormenta|circo|nube`,
vag1:`beso|lencería|seducción|masaje|coqueteo|abrazo|cita|deseo|bañera|champán|sábanas|tentación|baile lento|mirada|escalofrío`,
vag2:`orgasmo|esposas|condón|vídeo porno|striptease|trío|culo|nudismo|gemido|sexting|kamasutra|lubricante|fetiche|rapidito|vibrador`,
rad:`Vivir en un barco~Vivir en una casa del árbol|Respirar bajo el agua~Volar|Leer mentes~Volverte invisible|Tener siempre calor~Tener siempre frío|Una isla desierta con un buen libro~Una ciudad llena con tus amigos|Conocer tu futuro~Volver a ver tu pasado|Hablar todos los idiomas~Hablar con los animales|Nunca más música~Nunca más películas|Una fiesta sorpresa~Una cena tranquila|La fama~Una fortuna secreta|Viajar sin nadie~Viajar con diez personas|El mar~La montaña|El amanecer~El atardecer|No poder mentir nunca~No oír nunca una mentira|Un delfín de mascota~Un loro que habla|Decir siempre lo que piensas~Guardártelo todo|Revivir tu mejor día~Vivir un día desconocido|Dulce~Salado|Una tormenta en alta mar~Un mes de calma total|Explorar el fondo del mar~Explorar el espacio|Un superpoder inútil~Ningún poder|Escribir un libro~Componer una canción|Dormir bajo las estrellas~Dormir en un palacio|Un año sin teléfono~Un año sin café|Llevar el timón~Llevar la cocina del barco|Una vida pirata~Una vida de sirena|Saber cocinarlo todo~Saber arreglarlo todo|Siempre con adelanto~Siempre con retraso|Un año de vacaciones~Un año con el doble de sueldo|Teletransportarte~Detener el tiempo|Encontrar un tesoro~Descubrir una isla desconocida|Reír todo el tiempo~No llorar nunca|Una casa sobre pilotes~Un faro aislado|Cantar delante de todos~Bailar delante de todos|Mil amigos~Tres amigos para siempre|Un verano eterno~Un invierno eterno|Leer todos los libros del mundo~Ver todas las películas del mundo|Nadar con tiburones~Caminar en una cuerda sobre el mar|Volver a tus 10 años~Saltar a tus 80 años|Una noche de juegos~Una noche de karaoke`,
rad1:`Un primer beso bajo la lluvia~Un primer beso al atardecer|Un masaje~Un baño para dos|Lencería~Nada de nada|Ligar~Que te liguen|Una cita a ciegas~Una cita con tu ex|Palabras dulces~Miradas ardientes|Una noche bajo las estrellas en pareja~Una noche en un hotel de lujo en pareja|Preliminares largos~Ir al grano|Luz encendida~Luz apagada|Por la mañana~Por la noche|Un lento bien pegados~Un baile desenfrenado|Un mensaje picante~Una llamada a medianoche|Un tatuaje escondido~Un piercing escondido|Pareja que cocina~Pareja que da masajes|Un beso en el cuello~Un susurro al oído`,
rad2:`Sexo en el mar~Sexo en la playa|Tu vídeo porno publicado~Tu historial de internet publicado|Un trío~Un club de intercambio|Esposas~Una venda en los ojos|Acostarte con tu ex~Acostarte con alguien del trabajo|Un año sin sexo~Un año sin internet|Sexo en silencio de por vida~Sexo ruidoso de por vida|Tus padres leen tus fantasías~Tú lees las de tus padres|Siempre arriba~Siempre abajo|Sexo en un avión~Sexo en un ascensor|No volver a tener un orgasmo~Tener uno con cada estornudo|Un desnudo filtrado~Un audio vergonzoso filtrado|Acostarse la primera noche~Esperar tres meses|Una noche con una estrella~Una noche con tu crush secreto|Juguetes~Solo manos`};

GI18N.it={ui:{stopAsk:`Fermare il gioco e vedere i punteggi?`,stop:`Ferma`,room:`Sala giochi`,exp:`Spedizione`,expD:`Il viaggio di isola in isola`,play:`Gioca a {g}`,waitHost:`L'host avvia la partita`,needP:`Da {a} a {b} giocatori`,
t_skill:`abilità`,t_chance:`fortuna`,t_social:`social`,send:`Invia`,ok:`Continua`,me:`io`,or:`o`,waitN:`Si aspetta {n}`,yourMove:`Tocca a te!`,watch:`Guarda gli altri giocare`,ready:`{g:Pronto|Pronta}? Si continua quando lo sono tutti`,
scores:`Punteggi`,coopT:`Punteggio di connessione`,again:`Rigioca`,lobby:`Torna alla sala`,hostNext:`Rigiocare, o tornare alla sala?`,waitHostN:`{n} sceglie cosa fare`,
n_bot:`Messaggi in bottiglia`,d_bot:`Aneddoti veri e anonimi: chi li ha scritti?`,r_bot:`Scrivi 2 o 3 cose vere su di te. Arrivano anonime: indovina chi le ha scritte (+2). Nessuno ti scopre? +3. Solo alcuni? +1.`,
r_bot2:`Scrivi 3 aneddoti, veri o inventati (almeno uno per tipo). Indovina quelli dell'altro (+2); ogni bluff riuscito ti dà +2.`,
bph:`Una cosa vera su di te…`,bph18:`Una cosa vera (e audace) su di te…`,bph2:`Un aneddoto su di te…`,bmin:`Scrivine almeno 2`,bmin2:`Compila tutti e 3, con almeno uno vero e uno inventato`,bwait:`Le tue bottiglie galleggiano`,
bwho:`Chi l'ha scritto?`,bmine:`È tua: vota lo stesso, per depistare`,bby:`Scritta da {n}`,bnone:`Nessuno ha indovinato: +3 per {n}`,bsome:`Misterioso al punto giusto: +1 per {n}`,ball:`Tutti hanno indovinato!`,
bT:`Vero`,bF:`Inventato`,bguess:`Vero o inventato?`,bfrom:`Bottiglia di {n}`,bfool:`Bluff riuscito: +2 per {n}`,bok:`Ben visto: +2 per {n}`,
n_pha:`Il Faro`,d_pha:`Chi di noi…? Votate, il faro illumina il gruppo`,r_pha:`Vota chi ci sta meglio, anche te. +1 se voti come la maggioranza.`,r_pha2:`Scegli uno di voi due, poi prevedi la risposta dell'altro: +1 se indovini.`,
pq:`Chi di noi…`,pq2:`Chi di noi due…`,ppred:`E {n} risponderà…`,ppredS:`ha previsto`,pport:`Ritratto del gruppo`,pnone:`Nessun titolo stavolta`,pagree:`D'accordo!`,pdis:`Non d'accordo…`,
n_vag:`Stessa onda`,d_vag:`Una parola, la prima che viene: pensate uguale`,r_vag:`Scrivi la prima parola che ti viene. +1 per ogni persona con la stessa, +1 se siete proprio in due.`,r_vag2:`Scrivete la stessa parola: +2. Mancato? Una parola ponte tra le due: +1.`,
vin:`La tua prima parola`,vbr:`Una parola che unisca le due`,vsame:`Stessa onda!`,vpont:`Ponte riuscito!`,vmiss:`Non stavolta…`,vno:`Non quella parola!`,vc0:`Acque torbide`,vc1:`Correnti che si incrociano`,vc2:`Stessa lunghezza d'onda`,
n_rad:`La Zattera`,d_rad:`Preferiresti… e il gruppo?`,r_rad:`Scegli, poi scommetti sulla scelta della maggioranza: +1 se indovini, +2 se tu eri in minoranza.`,r_rad2:`Scegli, poi indovina la scelta dell'altro: +1 se indovini.`,
rbet:`La maggioranza sceglierà…`,rbet2:`{n} sceglierà…`,rtie:`Parità: la zattera dondola, nessuna scommessa vince`,rmaj:`maggioranza`,rtwin:`Anime gemelle della zattera`,
n_pec:`Pesca di perle`,d_pec:`Immergersi ancora, o risalire con la rete?`,r_pec:`Ogni immersione pesca dal sacco. Al 2º squalo, chi è sotto perde la rete. La medusa punge la rete più grande (−½). Da soli sul fondo: perle ×2.`,
r_pec2:`Ogni immersione pesca dal sacco. Al 2º squalo, chi è sotto perde la rete. La medusa punge la rete più grande (−½). Da soli sul fondo: perle ×2. La Cernia 🐟 si immerge con voi: risale a 8, o a 4 dopo uno squalo.`,
pup:`Risali`,pdown:`Immergiti`,pfil:`La tua rete`,pcof:`Forziere`,pbag:`Nel sacco`,pshark:`Squalo!`,pjel:`Medusa!`,pdead:`2º squalo: reti perse`,pdouble:`Da soli sul fondo: ×2`,
prisk:`Rischio 🦈: {p}%`,psafe:`1º squalo: innocuo`,pmanche:`Fine del turno`,ghost:`La Cernia`,psecret:`segreti fino alla fine`,pyouup:`{g:Risalito|Risalita}: +{v}`},
pha:`sopravvivrebbe più a lungo su un'isola deserta|partirebbe per un viaggio d'impulso|piange davanti ai film|mantiene meglio un segreto|si perderebbe nella propria città|raggiungerà la fama un giorno|parla con gli animali|dimentica i compleanni|ride nel momento peggiore|mangia l'ultimo pezzo senza chiedere|risponde ai messaggi dopo tre giorni|adotterebbe dieci gatti|alla fine ha sempre ragione|canta sotto la doccia|si alza prima del sole|dà i consigli migliori|vincerebbe una gara di ballo|ha la memoria migliore|direbbe sì a qualsiasi avventura|prenderebbe il timone della nave|cadrebbe in acqua prima di tutti|farebbe la spia alla perfezione|racconta le storie migliori|cambierebbe vita domani|nasconde più talenti|crescerebbe meglio dei figli|si addormenta ovunque|conosce più gente|contratta su tutto|farebbe ridere uno squalo|ha più pazienza|si farebbe un tatuaggio d'impulso|ha più fantasia|ricorda i propri sogni|troverebbe un tesoro|scriverà un libro un giorno|calma qualsiasi litigio|porta sempre troppi bagagli|parla più veloce|cucinerebbe il pasto migliore con quasi niente`,
pha1:`ha mandato un messaggio piccante alla persona sbagliata|bacia meglio|ha più fascino senza saperlo|farebbe il primo passo|flirta senza accorgersene|ha più successo alle feste|finirebbe in una vasca idromassaggio con sconosciuti|ha dormito da qualcuno al primo appuntamento|ha lo sguardo più seducente|balla i lenti più stretti|custodisce i segreti d'alcova più piccanti|ha giocato a strip poker|scrive i messaggi più bollenti|arrossisce più in fretta|ha più ex che ci pensano ancora`,
pha2:`ha fatto sesso la prima sera|ha la cronologia di app d'incontri più lunga|ha fatto sesso in un luogo pubblico|ha finto un orgasmo|rischia di più di avere un sex tape|ha mandato una foto nuda|è tornato a letto con un ex|ha il cassetto dei giocattoli più pieno|si è fatto beccare sul più bello|ha più partner nel curriculum|ha fatto una cosa a tre|fa più rumore a letto|ha dimenticato il nome di qualcuno al risveglio|girerebbe un porno amatoriale|ha le fantasie più perverse`,
vag:`oceano|spiaggia|isola|estate|notte|caffè|gatto|pioggia|sogno|viaggio|amore|musica|infanzia|festa|inverno|montagna|sole|luna|libro|treno|foresta|scuola|casa|rosso|formaggio|paura|vento|stella|film|sport|giardino|fiore|cioccolato|città|domenica|regalo|neve|fuoco|pianoforte|pirata|tesoro|barca|pesce|squalo|sabbia|vacanze|magia|drago|pizza|telefono|specchio|segreto|sorriso|macchina|aereo|Natale|compleanno|temporale|circo|nuvola`,
vag1:`bacio|lingerie|seduzione|massaggio|flirt|coccole|appuntamento|desiderio|vasca|champagne|lenzuola|tentazione|lento|sguardo|brivido`,
vag2:`orgasmo|manette|preservativo|sex tape|spogliarello|cosa a tre|sedere|nudismo|gemito|sexting|kamasutra|lubrificante|feticcio|sveltina|vibratore`,
rad:`Vivere su una barca~Vivere in una casa sull'albero|Respirare sott'acqua~Volare|Leggere nel pensiero~Diventare invisibile|Avere sempre caldo~Avere sempre freddo|Un'isola deserta con un buon libro~Una città affollata con i tuoi amici|Conoscere il tuo futuro~Rivedere il tuo passato|Parlare tutte le lingue~Parlare con gli animali|Mai più musica~Mai più film|Una festa a sorpresa~Una cena tranquilla|La fama~Una fortuna segreta|Viaggiare senza nessuno~Viaggiare in dieci|Il mare~La montagna|L'alba~Il tramonto|Non poter più mentire~Non sentire mai più una bugia|Un delfino come animale~Un pappagallo che parla|Dire sempre ciò che pensi~Tenerti tutto dentro|Rivivere il tuo giorno migliore~Vivere un giorno sconosciuto|Dolce~Salato|Una tempesta al largo~Un mese di bonaccia|Esplorare gli abissi~Esplorare lo spazio|Un superpotere inutile~Nessun potere|Scrivere un libro~Comporre una canzone|Dormire sotto le stelle~Dormire in un palazzo|Un anno senza telefono~Un anno senza caffè|Tenere il timone~Tenere la cucina di bordo|Una vita da pirata~Una vita da sirena|Saper cucinare tutto~Saper aggiustare tutto|Sempre in anticipo~Sempre in ritardo|Un anno di vacanza~Un anno a stipendio doppio|Teletrasportarti~Fermare il tempo|Trovare un tesoro~Scoprire un'isola sconosciuta|Ridere sempre~Non piangere mai|Una palafitta~Un faro isolato|Cantare davanti a tutti~Ballare davanti a tutti|Mille amici~Tre amici per la vita|Un'estate eterna~Un inverno eterno|Leggere tutti i libri del mondo~Vedere tutti i film del mondo|Nuotare con gli squali~Camminare su un filo sopra il mare|Tornare a 10 anni~Saltare a 80 anni|Una serata giochi~Una serata karaoke`,
rad1:`Un primo bacio sotto la pioggia~Un primo bacio al tramonto|Un massaggio~Un bagno in due|Lingerie~Niente di niente|Corteggiare~Farti corteggiare|Un appuntamento al buio~Un appuntamento con il tuo ex|Parole dolci~Sguardi infuocati|Una notte sotto le stelle in due~Una notte in un hotel di lusso in due|Preliminari lunghi~Dritti al punto|Luce accesa~Luce spenta|Il mattino~La sera|Un lento stretti stretti~Un ballo scatenato|Un messaggio piccante~Una chiamata a mezzanotte|Un tatuaggio nascosto~Un piercing nascosto|Un partner che cucina~Un partner che fa massaggi|Un bacio sul collo~Un sussurro all'orecchio`,
rad2:`Sesso in mare~Sesso in spiaggia|Il tuo sex tape pubblicato~La tua cronologia internet pubblicata|Una cosa a tre~Un club di scambisti|Manette~Una benda sugli occhi|Andare a letto con il tuo ex~Andare a letto con un collega|Un anno senza sesso~Un anno senza internet|Sesso in silenzio a vita~Sesso rumoroso a vita|I tuoi genitori leggono le tue fantasie~Tu leggi le loro|Sempre sopra~Sempre sotto|Sesso in aereo~Sesso in ascensore|Mai più un orgasmo~Un orgasmo a ogni starnuto|Una foto nuda trapelata~Un vocale imbarazzante trapelato|Farlo la prima sera~Aspettare tre mesi|Una notte con una star~Una notte con la tua cotta segreta|Giocattoli~Solo mani`};

GI18N.de={ui:{stopAsk:`Spiel beenden und Punkte zeigen?`,stop:`Beenden`,room:`Spielesaal`,exp:`Expedition`,expD:`Die Reise von Insel zu Insel`,play:`{g} spielen`,waitHost:`Der Host startet das Spiel`,needP:`{a} bis {b} Spieler`,
t_skill:`Können`,t_chance:`Glück`,t_social:`sozial`,send:`Senden`,ok:`Weiter`,me:`ich`,or:`oder`,waitN:`Warten auf {n}`,yourMove:`Du bist dran!`,watch:`Schau den anderen zu`,ready:`Bereit? Weiter, sobald alle bereit sind`,
scores:`Punkte`,coopT:`Verbindungswert`,again:`Nochmal`,lobby:`Zurück zur Lobby`,hostNext:`Nochmal, oder zurück zur Lobby?`,waitHostN:`{n} wählt, wie es weitergeht`,
n_bot:`Flaschenpost`,d_bot:`Wahre, anonyme Anekdoten: Wer hat sie geschrieben?`,r_bot:`Schreib 2 oder 3 wahre Dinge über dich. Sie kommen anonym an: Errate, wer sie schrieb (+2). Niemand errät dich? +3. Nur manche? +1.`,
r_bot2:`Schreib 3 Anekdoten, wahr oder erfunden (mindestens eine von jeder Sorte). Errate die des anderen (+2); jeder gelungene Bluff bringt dir +2.`,
bph:`Etwas Wahres über dich…`,bph18:`Etwas Wahres (und Gewagtes) über dich…`,bph2:`Eine Anekdote über dich…`,bmin:`Schreib mindestens 2`,bmin2:`Füll alle 3 aus, mindestens eine wahr und eine erfunden`,bwait:`Deine Flaschen treiben`,
bwho:`Wer hat das geschrieben?`,bmine:`Das ist deine: Stimm trotzdem ab, um die Spuren zu verwischen`,bby:`Geschrieben von {n}`,bnone:`Niemand hat's erraten: +3 für {n}`,bsome:`Gerade geheimnisvoll genug: +1 für {n}`,ball:`Alle haben's erraten!`,
bT:`Wahr`,bF:`Erfunden`,bguess:`Wahr oder erfunden?`,bfrom:`Flasche von {n}`,bfool:`Bluff geglückt: +2 für {n}`,bok:`Gut erkannt: +2 für {n}`,
n_pha:`Der Leuchtturm`,d_pha:`Wer von uns…? Stimmt ab, der Leuchtturm strahlt auf die Gruppe`,r_pha:`Stimm für die Person, die am besten passt, auch dich. +1, wenn du wie die Mehrheit stimmst.`,r_pha2:`Wähl einen von euch beiden und sag die Antwort des anderen voraus: +1 bei Treffer.`,
pq:`Wer von uns…`,pq2:`Wer von uns beiden…`,ppred:`Und {n} antwortet…`,ppredS:`tippte`,pport:`Gruppenporträt`,pnone:`Diesmal kein Titel`,pagree:`Einig!`,pdis:`Uneinig…`,
n_vag:`Gleiche Welle`,d_vag:`Ein Wort, das erste, das kommt: denkt gleich`,r_vag:`Schreib das erste Wort, das dir einfällt. +1 pro Person mit demselben Wort, +1, wenn ihr genau zwei seid.`,r_vag2:`Schreibt dasselbe Wort: +2. Daneben? Ein Brückenwort, das eure beiden verbindet: +1.`,
vin:`Dein erstes Wort`,vbr:`Ein Wort, das beide verbindet`,vsame:`Gleiche Welle!`,vpont:`Brücke steht!`,vmiss:`Diesmal nicht…`,vno:`Nicht dieses Wort!`,vc0:`Trübes Wasser`,vc1:`Strömungen kreuzen sich`,vc2:`Gleiche Wellenlänge`,
n_rad:`Das Floß`,d_rad:`Lieber… und die Gruppe?`,r_rad:`Wähle, dann wette auf die Wahl der Mehrheit: +1 bei Treffer, +2, wenn du selbst in der Minderheit warst.`,r_rad2:`Wähle, dann errate die Wahl des anderen: +1 bei Treffer.`,
rbet:`Die Mehrheit wählt…`,rbet2:`{n} wählt…`,rtie:`Gleichstand: Das Floß schaukelt, keine Wette gewinnt`,rmaj:`Mehrheit`,rtwin:`Seelenverwandte auf dem Floß`,
n_pec:`Perlentauchen`,d_pec:`Nochmal tauchen, oder mit dem Netz auftauchen?`,r_pec:`Jeder Tauchgang zieht aus dem Sack. Beim 2. Hai verlieren alle unten ihr Netz. Die Qualle sticht das größte Netz (−½). Allein am Grund: Perlen ×2.`,
r_pec2:`Jeder Tauchgang zieht aus dem Sack. Beim 2. Hai verlieren alle unten ihr Netz. Die Qualle sticht das größte Netz (−½). Allein am Grund: Perlen ×2. Der Zackenbarsch 🐟 taucht mit: Er taucht bei 8 auf, oder bei 4 nach einem Hai.`,
pup:`Auftauchen`,pdown:`Tauchen`,pfil:`Dein Netz`,pcof:`Truhe`,pbag:`Im Sack`,pshark:`Hai!`,pjel:`Qualle!`,pdead:`2. Hai: Netze verloren`,pdouble:`Allein am Grund: ×2`,
prisk:`🦈-Risiko: {p} %`,psafe:`1. Hai: harmlos`,pmanche:`Ende der Runde`,ghost:`Der Zackenbarsch`,psecret:`geheim bis zum Schluss`,pyouup:`Aufgetaucht: +{v}`},
pha:`würde am längsten auf einer einsamen Insel überleben|würde spontan verreisen|weint bei Filmen|hütet ein Geheimnis am besten|würde sich in der eigenen Stadt verlaufen|wird eines Tages berühmt|redet mit Tieren|vergisst Geburtstage|lacht im schlimmsten Moment|isst das letzte Stück, ohne zu fragen|antwortet erst nach drei Tagen|würde zehn Katzen adoptieren|hat am Ende immer recht|singt unter der Dusche|steht vor der Sonne auf|gibt die besten Ratschläge|würde einen Tanzwettbewerb gewinnen|hat das beste Gedächtnis|würde zu jedem Abenteuer Ja sagen|würde das Steuer des Schiffs übernehmen|würde als Erstes ins Wasser fallen|könnte hervorragend spionieren|erzählt die besten Geschichten|würde morgen ein neues Leben anfangen|versteckt die meisten Talente|würde Kinder am besten großziehen|schläft überall ein|kennt die meisten Leute|feilscht um alles|könnte einen Hai zum Lachen bringen|hat die meiste Geduld|würde sich spontan tätowieren lassen|hat die wildeste Fantasie|erinnert sich an die eigenen Träume|würde einen Schatz finden|schreibt eines Tages ein Buch|schlichtet jeden Streit|packt immer zu viel ein|redet am schnellsten|kocht aus fast nichts das beste Essen`,
pha1:`hat schon eine flirtige Nachricht an die falsche Person geschickt|küsst am besten|hat den meisten Charme, ohne es zu wissen|würde den ersten Schritt machen|flirtet, ohne es zu merken|kommt auf Partys am besten an|würde mit Fremden im Whirlpool landen|hat schon beim ersten Date woanders übernachtet|hat den verführerischsten Blick|tanzt den engsten Stehblues|kennt die pikantesten Schlafzimmergeheimnisse|hat schon Strip-Poker gespielt|schreibt die heißesten Nachrichten|wird am schnellsten rot|hat die meisten Ex, die noch an sie oder ihn denken`,
pha2:`hatte schon Sex in der ersten Nacht|hat den längsten Dating-App-Verlauf|hatte schon Sex an einem öffentlichen Ort|hat schon einen Orgasmus vorgetäuscht|hat am ehesten ein Sextape|hat schon ein Nacktfoto verschickt|ist schon mit einem Ex wieder im Bett gelandet|hat die bestgefüllte Spielzeugschublade|wurde schon in flagranti erwischt|hat die meisten Bettgeschichten|hatte schon einen Dreier|ist im Bett am lautesten|hat am Morgen danach schon einen Namen vergessen|würde einen Amateurporno drehen|hat die versautesten Fantasien`,
vag:`Ozean|Strand|Insel|Sommer|Nacht|Kaffee|Katze|Regen|Traum|Reise|Liebe|Musik|Kindheit|Party|Winter|Berg|Sonne|Mond|Buch|Zug|Wald|Schule|Haus|Rot|Käse|Angst|Wind|Stern|Film|Sport|Garten|Blume|Schokolade|Stadt|Sonntag|Geschenk|Schnee|Feuer|Klavier|Pirat|Schatz|Boot|Fisch|Hai|Sand|Urlaub|Magie|Drache|Pizza|Telefon|Spiegel|Geheimnis|Lächeln|Auto|Flugzeug|Weihnachten|Geburtstag|Gewitter|Zirkus|Wolke`,
vag1:`Kuss|Dessous|Verführung|Massage|Flirt|Kuscheln|Date|Verlangen|Badewanne|Champagner|Laken|Versuchung|Stehblues|Blick|Gänsehaut`,
vag2:`Orgasmus|Handschellen|Kondom|Sextape|Striptease|Dreier|Hintern|FKK|Stöhnen|Sexting|Kamasutra|Gleitgel|Fetisch|Quickie|Vibrator`,
rad:`Auf einem Boot leben~In einem Baumhaus leben|Unter Wasser atmen~Fliegen|Gedanken lesen~Unsichtbar werden|Immer zu warm~Immer zu kalt|Eine einsame Insel mit einem guten Buch~Eine volle Stadt mit deinen Freunden|Deine Zukunft kennen~Deine Vergangenheit wiedersehen|Alle Sprachen sprechen~Mit Tieren sprechen|Nie wieder Musik~Nie wieder Filme|Eine Überraschungsparty~Ein ruhiges Abendessen|Ruhm~Ein geheimes Vermögen|Ganz allein reisen~Zu zehnt reisen|Das Meer~Die Berge|Sonnenaufgang~Sonnenuntergang|Nie mehr lügen können~Nie mehr eine Lüge hören|Ein Delfin als Haustier~Ein sprechender Papagei|Immer sagen, was du denkst~Immer alles für dich behalten|Deinen besten Tag nochmal erleben~Einen unbekannten Tag erleben|Süß~Salzig|Ein Sturm auf hoher See~Ein Monat Flaute|Die Tiefsee erkunden~Das Weltall erkunden|Eine nutzlose Superkraft~Gar keine Kraft|Ein Buch schreiben~Ein Lied komponieren|Unter den Sternen schlafen~In einem Palast schlafen|Ein Jahr ohne Handy~Ein Jahr ohne Kaffee|Am Steuer stehen~Die Schiffsküche führen|Ein Piratenleben~Ein Leben als Meerjungfrau|Alles kochen können~Alles reparieren können|Immer zu früh~Immer zu spät|Ein Jahr Urlaub~Ein Jahr doppeltes Gehalt|Dich teleportieren~Die Zeit anhalten|Einen Schatz finden~Eine unbekannte Insel entdecken|Immer lachen~Nie weinen|Ein Pfahlhaus~Ein einsamer Leuchtturm|Vor allen singen~Vor allen tanzen|Tausend Freunde~Drei Freunde fürs Leben|Ewiger Sommer~Ewiger Winter|Alle Bücher der Welt lesen~Alle Filme der Welt sehen|Mit Haien schwimmen~Auf einem Seil über dem Meer laufen|Zurück mit 10~Vorspulen auf 80|Ein Spieleabend~Ein Karaokeabend`,
rad1:`Ein erster Kuss im Regen~Ein erster Kuss bei Sonnenuntergang|Eine Massage~Ein Bad zu zweit|Dessous~Gar nichts|Flirten~Angeflirtet werden|Ein Blind Date~Ein Date mit dem Ex|Süße Worte~Glühende Blicke|Eine Nacht unter den Sternen zu zweit~Eine Nacht im Luxushotel zu zweit|Langes Vorspiel~Direkt zur Sache|Licht an~Licht aus|Morgens~Abends|Ein enger Stehblues~Ein wilder Tanz|Eine freche Nachricht~Ein Anruf um Mitternacht|Ein verstecktes Tattoo~Ein verstecktes Piercing|Wer kocht~Wer massiert|Ein Kuss auf den Hals~Ein Flüstern ins Ohr`,
rad2:`Sex im Meer~Sex am Strand|Dein Sextape veröffentlicht~Dein Browserverlauf veröffentlicht|Ein Dreier~Ein Swingerclub|Handschellen~Eine Augenbinde|Mit dem Ex schlafen~Mit jemandem von der Arbeit schlafen|Ein Jahr ohne Sex~Ein Jahr ohne Internet|Lebenslang leiser Sex~Lebenslang lauter Sex|Deine Eltern lesen deine Fantasien~Du liest die deiner Eltern|Immer oben~Immer unten|Sex im Flugzeug~Sex im Aufzug|Nie wieder kommen~Bei jedem Niesen kommen|Ein geleaktes Nacktfoto~Eine geleakte peinliche Sprachnachricht|In der ersten Nacht~Drei Monate warten|Eine Nacht mit einem Star~Eine Nacht mit deinem heimlichen Schwarm|Spielzeug~Nur Hände`};

GI18N.ru={ui:{stopAsk:`Остановить игру и показать очки?`,stop:`Остановить`,room:`Игровой зал`,exp:`Экспедиция`,expD:`Путешествие с острова на остров`,play:`Играть: {g}`,waitHost:`Хост запускает игру`,needP:`От {a} до {b} игроков`,
t_skill:`навык`,t_chance:`удача`,t_social:`общение`,send:`Отправить`,ok:`Дальше`,me:`я`,or:`или`,waitN:`Ждём: {n}`,yourMove:`Твой ход!`,watch:`Смотри, как играют другие`,ready:`{g:Готов|Готова}? Продолжим, когда все будут готовы`,
scores:`Очки`,coopT:`Счёт связи`,again:`Ещё раз`,lobby:`В лобби`,hostNext:`Ещё раз или в лобби?`,waitHostN:`{n} выбирает, что дальше`,
n_bot:`Письма в бутылках`,d_bot:`Правдивые анонимные истории: кто их написал?`,r_bot:`Напиши 2–3 правдивых факта о себе. Они приходят анонимно: угадай автора (+2). Тебя никто не угадал? +3. Только некоторые? +1.`,
r_bot2:`Напиши 3 истории, правдивые или выдуманные (хотя бы по одной). Угадывай истории другого (+2); каждый удачный блеф даёт тебе +2.`,
bph:`Что-то правдивое о тебе…`,bph18:`Что-то правдивое (и смелое) о тебе…`,bph2:`История о тебе…`,bmin:`Напиши хотя бы 2`,bmin2:`Заполни все 3: хотя бы одна правда и одна выдумка`,bwait:`Твои бутылки в море`,
bwho:`Кто это написал?`,bmine:`Это твоя: всё равно голосуй, чтобы запутать следы`,bby:`Автор: {n}`,bnone:`Никто не угадал: +3 для {n}`,bsome:`В меру загадочно: +1 для {n}`,ball:`Все угадали!`,
bT:`Правда`,bF:`Выдумка`,bguess:`Правда или выдумка?`,bfrom:`Бутылка от {n}`,bfool:`Блеф удался: +2 для {n}`,bok:`В точку: +2 для {n}`,
n_pha:`Маяк`,d_pha:`Кто из нас…? Голосуйте, маяк освещает группу`,r_pha:`Голосуй за того, кто подходит лучше всех, даже за себя. +1, если голосуешь как большинство.`,r_pha2:`Выбери одного из вас двоих и предскажи ответ другого: +1 за верный прогноз.`,
pq:`Кто из нас…`,pq2:`Кто из нас двоих…`,ppred:`А {n} ответит…`,ppredS:`прогноз`,pport:`Портрет группы`,pnone:`На этот раз без титулов`,pagree:`Согласны!`,pdis:`Не согласны…`,
n_vag:`Одна волна`,d_vag:`Одно слово, первое пришедшее: думайте одинаково`,r_vag:`Напиши первое слово, что придёт в голову. +1 за каждого с тем же словом, +1, если вас ровно двое.`,r_vag2:`Напишите одно и то же слово: +2. Мимо? Слово-мост между вашими словами: +1.`,
vin:`Твоё первое слово`,vbr:`Слово, связывающее оба`,vsame:`Одна волна!`,vpont:`Мост построен!`,vmiss:`Не в этот раз…`,vno:`Только не это слово!`,vc0:`Мутные воды`,vc1:`Течения пересекаются`,vc2:`На одной волне`,
n_rad:`Плот`,d_rad:`Что ты выберешь… а группа?`,r_rad:`Выбери, затем поставь на выбор большинства: +1 за верную ставку, +2, если сам ты был в меньшинстве.`,r_rad2:`Выбери, затем угадай выбор другого: +1 за верный ответ.`,
rbet:`Большинство выберет…`,rbet2:`{n} выберет…`,rtie:`Ничья: плот качается, ставки не сыграли`,rmaj:`большинство`,rtwin:`Родственные души на плоту`,
n_pec:`Ловля жемчуга`,d_pec:`Нырнуть ещё или всплыть с сеткой?`,r_pec:`Каждое погружение тянет предмет из мешка. На 2-й акуле все внизу теряют сетку. Медуза жалит самую полную сетку (−½). Один на дне: жемчуг ×2.`,
r_pec2:`Каждое погружение тянет предмет из мешка. На 2-й акуле все внизу теряют сетку. Медуза жалит самую полную сетку (−½). Один на дне: жемчуг ×2. Групер 🐟 ныряет с вами: всплывает на 8 или на 4 после акулы.`,
pup:`Всплыть`,pdown:`Нырнуть`,pfil:`Твоя сетка`,pcof:`Сундук`,pbag:`В мешке`,pshark:`Акула!`,pjel:`Медуза!`,pdead:`2-я акула: сетки потеряны`,pdouble:`Один на дне: ×2`,
prisk:`Риск 🦈: {p} %`,psafe:`1-я акула: не опасна`,pmanche:`Конец раунда`,ghost:`Групер`,psecret:`тайна до конца`,pyouup:`{g:Всплыл|Всплыла}: +{v}`},
pha:`дольше всех продержится на необитаемом острове|внезапно сорвётся в путешествие|плачет над фильмами|лучше всех хранит секреты|заблудится в родном городе|однажды прославится|разговаривает с животными|забывает про дни рождения|смеётся в самый неподходящий момент|съест последний кусок не спросив|отвечает на сообщения через три дня|заведёт десять кошек|в спорах всегда выходит победителем|поёт в душе|встаёт раньше солнца|даёт лучшие советы|выиграет конкурс танцев|лучше всех всё помнит|согласится на любое приключение|встанет за штурвал корабля|упадёт в воду раньше всех|справится с ролью шпиона|рассказывает лучшие истории|завтра начнёт новую жизнь|скрывает больше всего талантов|лучше всех воспитает детей|засыпает где угодно|знает больше всех людей|торгуется за всё|рассмешит даже акулу|терпит дольше всех|внезапно сделает татуировку|фантазирует больше всех|помнит свои сны|найдёт сокровище|однажды напишет книгу|погасит любую ссору|всегда берёт слишком много вещей|говорит быстрее всех|приготовит лучший ужин почти из ничего`,
pha1:`отправлял(а) кокетливое сообщение не тому человеку|целуется лучше всех|очаровательнее всех, сам того не зная|сделает первый шаг|флиртует, не замечая этого|пользуется наибольшим успехом на вечеринках|окажется в джакузи с незнакомцами|оставался(ась) на ночь после первого свидания|смотрит соблазнительнее всех|танцует самый тесный медляк|знает самые пикантные секреты спальни|играл(а) в покер на раздевание|пишет самые горячие сообщения|краснеет быстрее всех|о ком бывшие вспоминают чаще всего`,
pha2:`переспал(а) с кем-то в первую же ночь|дольше всех сидит в приложениях знакомств|занимался(ась) сексом в общественном месте|изображал(а) оргазм|скорее всех окажется в секс-видео|отправлял(а) интимное фото|снова оказывался(ась) в постели с бывшим|у кого самый богатый ящик с игрушками|был(а) пойман(а) с поличным в постели|у кого больше всех партнёров|пробовал(а) секс втроём|громче всех в постели|утром забывал(а) имя партнёра|снимется в любительском порно|у кого самые извращённые фантазии`,
vag:`океан|пляж|остров|лето|ночь|кофе|кошка|дождь|сон|путешествие|любовь|музыка|детство|праздник|зима|гора|солнце|луна|книга|поезд|лес|школа|дом|красный|сыр|страх|ветер|звезда|фильм|спорт|сад|цветок|шоколад|город|воскресенье|подарок|снег|огонь|пианино|пират|сокровище|лодка|рыба|акула|песок|отпуск|магия|дракон|пицца|телефон|зеркало|секрет|улыбка|машина|самолёт|Рождество|день рождения|гроза|цирк|облако`,
vag1:`поцелуй|бельё|соблазн|массаж|флирт|объятия|свидание|желание|ванна|шампанское|простыни|искушение|медляк|взгляд|мурашки`,
vag2:`оргазм|наручники|презерватив|секс-видео|стриптиз|втроём|попа|нудизм|стон|секстинг|камасутра|смазка|фетиш|по-быстрому|вибратор`,
rad:`Жить на лодке~Жить в домике на дереве|Дышать под водой~Летать|Читать мысли~Становиться невидимкой|Всегда жарко~Всегда холодно|Необитаемый остров с хорошей книгой~Шумный город с друзьями|Знать своё будущее~Снова увидеть прошлое|Говорить на всех языках~Говорить с животными|Больше никакой музыки~Больше никаких фильмов|Вечеринка-сюрприз~Тихий ужин|Слава~Тайное богатство|Путешествовать в одиночку~Путешествовать вдесятером|Море~Горы|Рассвет~Закат|Никогда не мочь солгать~Никогда не слышать лжи|Дельфин-питомец~Говорящий попугай|Всегда говорить, что думаешь~Всегда держать всё в себе|Снова прожить лучший день~Прожить неизвестный день|Сладкое~Солёное|Шторм в открытом море~Месяц полного штиля|Исследовать глубины океана~Исследовать космос|Бесполезная суперсила~Никакой силы|Написать книгу~Сочинить песню|Спать под звёздами~Спать во дворце|Год без телефона~Год без кофе|Стоять у штурвала~Заведовать камбузом|Жизнь пирата~Жизнь русалки|Уметь всё приготовить~Уметь всё починить|Всегда приходить заранее~Всегда опаздывать|Год отпуска~Год двойной зарплаты|Телепортироваться~Останавливать время|Найти сокровище~Открыть неизвестный остров|Всё время смеяться~Никогда не плакать|Дом на сваях~Одинокий маяк|Петь перед всеми~Танцевать перед всеми|Тысяча друзей~Три друга на всю жизнь|Вечное лето~Вечная зима|Прочитать все книги мира~Посмотреть все фильмы мира|Плавать с акулами~Пройти по канату над морем|Вернуться в 10 лет~Перенестись в 80 лет|Вечер настолок~Вечер караоке`,
rad1:`Первый поцелуй под дождём~Первый поцелуй на закате|Массаж~Ванна на двоих|Кружевное бельё~Совсем ничего|Флиртовать~Чтобы флиртовали с тобой|Свидание вслепую~Свидание с бывшим|Нежные слова~Жгучие взгляды|Ночь под звёздами вдвоём~Ночь в роскошном отеле вдвоём|Долгие ласки~Сразу к делу|Свет включён~Свет выключен|Утром~Вечером|Тесный медляк~Зажигательный танец|Игривое сообщение~Звонок в полночь|Скрытая татуировка~Скрытый пирсинг|Партнёр, который готовит~Партнёр, который делает массаж|Поцелуй в шею~Шёпот на ухо`,
rad2:`Секс в море~Секс на пляже|Твоё секс-видео в сети~Твоя история браузера в сети|Секс втроём~Свинг-клуб|Наручники~Повязка на глаза|Переспать с бывшим~Переспать с коллегой|Год без секса~Год без интернета|Всю жизнь тихий секс~Всю жизнь громкий секс|Родители читают твои фантазии~Ты читаешь их фантазии|Всегда сверху~Всегда снизу|Секс в самолёте~Секс в лифте|Больше никогда не кончать~Кончать от каждого чиха|Утёкшее интимное фото~Утёкшее неловкое голосовое|Переспать в первую ночь~Ждать три месяца|Ночь со звездой~Ночь с тайной симпатией|Игрушки~Только руки`};

GI18N.zh={ui:{stopAsk:`结束本局并查看得分？`,stop:`结束`,room:`游戏厅`,exp:`远征`,expD:`一岛接一岛的旅程`,play:`开始：{g}`,waitHost:`房主开始游戏`,needP:`{a}–{b} 名玩家`,
t_skill:`技巧`,t_chance:`运气`,t_social:`社交`,send:`发送`,ok:`继续`,me:`我`,or:`还是`,waitN:`等待 {n}`,yourMove:`轮到你了！`,watch:`看看大家怎么玩`,ready:`准备好了吗？大家都准备好就继续`,
scores:`得分`,coopT:`默契分`,again:`再来一局`,lobby:`回到大厅`,hostNext:`再来一局，还是回大厅？`,waitHostN:`{n} 正在决定下一步`,
n_bot:`漂流瓶`,d_bot:`真实又匿名的小故事：是谁写的？`,r_bot:`写下 2–3 件关于你的真事。它们会匿名出现：猜出作者 +2。没人猜中你？+3。只有部分人猜中？+1。`,
r_bot2:`写 3 个故事，可真可假（真假至少各一个）。猜对方的故事 +2；每次骗过对方你 +2。`,
bph:`一件关于你的真事…`,bph18:`一件关于你的真事（大胆一点）…`,bph2:`一个关于你的故事…`,bmin:`至少写 2 条`,bmin2:`3 条都要写，真假至少各一条`,bwait:`你的漂流瓶已经出海`,
bwho:`这是谁写的？`,bmine:`这是你写的：照样投票，混淆视听`,bby:`作者：{n}`,bnone:`没人猜中：{n} +3`,bsome:`恰到好处的神秘：{n} +1`,ball:`所有人都猜中了！`,
bT:`真的`,bF:`编的`,bguess:`真的还是编的？`,bfrom:`{n} 的漂流瓶`,bfool:`骗术成功：{n} +2`,bok:`猜得好：{n} +2`,
n_pha:`灯塔`,d_pha:`我们之中谁…？投票吧，灯塔照亮大家`,r_pha:`投给最符合的人，也可以投自己。和多数人投得一样 +1。`,r_pha2:`在你们两人中选一个，再预测对方的答案：猜中 +1。`,
pq:`我们之中谁…`,pq2:`我们两个谁…`,ppred:`{n} 会回答…`,ppredS:`预测`,pport:`群像`,pnone:`这次没有称号`,pagree:`想法一致！`,pdis:`意见不同…`,
n_vag:`同一道浪`,d_vag:`一个词，脱口而出：想到一块去`,r_vag:`写下你想到的第一个词。每有一人写得一样 +1，恰好两人相同再 +1。`,r_vag2:`写出相同的词：+2。没对上？写一个连接两个词的“桥”：+1。`,
vin:`你的第一个词`,vbr:`连接两个词的词`,vsame:`同一道浪！`,vpont:`桥搭成了！`,vmiss:`这次没对上…`,vno:`不能写这个词！`,vc0:`浑水一片`,vc1:`暗流交汇`,vc2:`心有灵犀`,
n_rad:`木筏`,d_rad:`你更愿意…大家呢？`,r_rad:`做选择，再押多数人的选择：押中 +1，若你自己是少数派则 +2。`,r_rad2:`做选择，再猜对方的选择：猜中 +1。`,
rbet:`多数人会选…`,rbet2:`{n} 会选…`,rtie:`平局：木筏摇晃，没人押中`,rmaj:`多数`,rtwin:`木筏上的灵魂伴侣`,
n_pec:`采珍珠`,d_pec:`继续下潜，还是带着网兜上浮？`,r_pec:`每次下潜从袋中抽一样东西。第 2 条鲨鱼出现时，还在水下的人失去网兜。水母会蛰最满的网兜（−½）。独自在海底：珍珠 ×2。`,
r_pec2:`每次下潜从袋中抽一样东西。第 2 条鲨鱼出现时，还在水下的人失去网兜。水母会蛰最满的网兜（−½）。独自在海底：珍珠 ×2。石斑鱼 🐟 和你们一起潜水：满 8 就上浮，出现鲨鱼后满 4 就上浮。`,
pup:`上浮`,pdown:`下潜`,pfil:`你的网兜`,pcof:`宝箱`,pbag:`袋中`,pshark:`鲨鱼！`,pjel:`水母！`,pdead:`第 2 条鲨鱼：网兜全丢`,pdouble:`独自在海底：×2`,
prisk:`🦈 风险：{p}%`,psafe:`第 1 条鲨鱼：无害`,pmanche:`本轮结束`,ghost:`石斑鱼`,psecret:`结束前保密`,pyouup:`已上浮：+{v}`},
pha:`能在荒岛上活得最久|会说走就走去旅行|看电影会哭|最能保守秘密|会在自己的城市迷路|将来会出名|会跟动物说话|总忘记别人的生日|会在最不该笑的时候笑|会不问一声吃掉最后一块|三天后才回消息|会收养十只猫|最后总是对的|会在洗澡时唱歌|比太阳起得还早|最会给建议|能赢下跳舞比赛|记性最好|对任何冒险都说好|会去掌舵|会第一个掉进水里|最适合当间谍|最会讲故事|明天就会换一种人生|藏着最多才艺|最会带孩子|在哪儿都能睡着|认识的人最多|什么都要讨价还价|能把鲨鱼逗笑|最有耐心|会一时冲动去纹身|想象力最丰富|记得自己的梦|会找到宝藏|有一天会写书|能平息任何争吵|总是带太多行李|说话最快|能用几乎什么都没有做出最好的一餐`,
pha1:`曾把暧昧消息发错人|最会接吻|最有魅力却不自知|会先迈出第一步|不知不觉就在调情|在派对上最受欢迎|会和陌生人一起泡进按摩浴缸|第一次约会就在对方家过夜|眼神最勾人|慢舞贴得最紧|知道最劲爆的床笫秘密|玩过脱衣扑克|发的消息最火辣|最容易脸红|前任最念念不忘`,
pha2:`第一晚就上过床|约会软件记录最长|在公共场所做过爱|假装过高潮|最可能有性爱视频|发过裸照|和前任复燃上过床|情趣玩具抽屉最满|做爱时被人撞见过|床伴人数最多|玩过3P|在床上叫得最大声|第二天早上忘过对方名字|会拍业余成人片|性幻想最变态`,
vag:`海洋|海滩|岛|夏天|夜晚|咖啡|猫|雨|梦|旅行|爱|音乐|童年|派对|冬天|山|太阳|月亮|书|火车|森林|学校|家|红色|奶酪|恐惧|风|星星|电影|运动|花园|花|巧克力|城市|星期天|礼物|雪|火|钢琴|海盗|宝藏|船|鱼|鲨鱼|沙子|假期|魔法|龙|披萨|手机|镜子|秘密|微笑|汽车|飞机|圣诞节|生日|暴风雨|马戏团|云`,
vag1:`吻|内衣|诱惑|按摩|调情|拥抱|约会|欲望|浴缸|香槟|床单|诱惑力|慢舞|眼神|心动`,
vag2:`高潮|手铐|避孕套|性爱视频|脱衣舞|3P|屁股|裸体主义|呻吟|色情短信|爱经|润滑剂|恋物|快餐式|振动棒`,
rad:`住在船上~住在树屋里|在水下呼吸~在天上飞|读心术~隐身术|总是太热~总是太冷|荒岛加一本好书~拥挤的城市加你的朋友|知道未来~重看过去|会说所有语言~能和动物说话|再也没有音乐~再也没有电影|惊喜派对~安静的晚餐|名气~秘密的财富|一个人旅行~十个人一起旅行|大海~高山|日出~日落|再也不能说谎~再也听不到谎言|养一只海豚~养一只会说话的鹦鹉|总是有话直说~什么都藏在心里|重温最好的一天~过一天未知的日子|甜~咸|远海的风暴~一个月的风平浪静|探索深海~探索太空|一个没用的超能力~没有任何超能力|写一本书~写一首歌|睡在星空下~睡在宫殿里|一年没有手机~一年没有咖啡|掌舵~掌管船上的厨房|海盗的一生~美人鱼的一生|什么菜都会做~什么都会修|总是早到~总是迟到|一年的假期~一年双倍工资|瞬间移动~让时间停止|找到宝藏~发现一座未知的岛|一直笑~从不哭|水上高脚屋~孤独的灯塔|当众唱歌~当众跳舞|一千个朋友~三个一辈子的朋友|永远的夏天~永远的冬天|读遍世上所有的书~看遍世上所有的电影|和鲨鱼一起游泳~在海上走钢丝|回到10岁~跳到80岁|游戏之夜~卡拉OK之夜`,
rad1:`雨中的初吻~日落时的初吻|按摩~双人浴|性感内衣~什么都不穿|主动撩人~被人撩|盲约~和前任约会|甜言蜜语~炙热的眼神|两人星空下过夜~两人豪华酒店过夜|长长的前戏~直奔主题|开着灯~关着灯|早上~晚上|贴身慢舞~狂野热舞|一条撩人的短信~一通午夜来电|隐藏的纹身~隐藏的穿孔|会做饭的伴侣~会按摩的伴侣|吻脖子~耳边低语`,
rad2:`在海里做爱~在沙滩上做爱|你的性爱视频曝光~你的浏览记录曝光|3P~换妻俱乐部|手铐~蒙眼布|和前任上床~和同事上床|一年没有性~一年没有网络|一辈子安静地做爱~一辈子大声地做爱|父母读你的性幻想~你读父母的|永远在上面~永远在下面|在飞机上做爱~在电梯里做爱|再也不能高潮~每打一个喷嚏就高潮|裸照外泄~尴尬语音外泄|第一晚就上床~等三个月|和明星共度一夜~和暗恋对象共度一夜|用玩具~只用手`};

GI18N.he={ui:{stopAsk:`לעצור את המשחק ולראות ניקוד?`,stop:`לעצור`,room:`חדר משחקים`,exp:`מסע`,expD:`המסע מאי לאי`,play:`לשחק ב{g}`,waitHost:`המארח מתחיל את המשחק`,needP:`{a} עד {b} שחקנים`,
t_skill:`מיומנות`,t_chance:`מזל`,t_social:`חברתי`,send:`שליחה`,ok:`המשך`,me:`אני`,or:`או`,waitN:`מחכים ל{n}`,yourMove:`תורך!`,watch:`צפו באחרים משחקים`,ready:`{g:מוכן|מוכנה}? ממשיכים כשכולם מוכנים`,
scores:`ניקוד`,coopT:`ניקוד חיבור`,again:`שוב`,lobby:`חזרה ללובי`,hostNext:`עוד סיבוב, או חזרה ללובי?`,waitHostN:`{n} בוחר מה הלאה`,
n_bot:`מכתבים בבקבוק`,d_bot:`סיפורים אמיתיים ואנונימיים: מי כתב אותם?`,r_bot:`כתבו 2 או 3 דברים אמיתיים על עצמכם. הם מגיעים בעילום שם: נחשו מי כתב (+2). אף אחד לא זיהה אתכם? +3. רק חלק? +1.`,
r_bot2:`כתבו 3 סיפורים, אמיתיים או מומצאים (לפחות אחד מכל סוג). נחשו את של השני (+2); כל בלוף מוצלח שווה +2.`,
bph:`משהו אמיתי עליך…`,bph18:`משהו אמיתי (ונועז) עליך…`,bph2:`סיפור עליך…`,bmin:`כתבו לפחות 2`,bmin2:`מלאו את כל 3, לפחות אחד אמיתי ואחד מומצא`,bwait:`הבקבוקים שלך צפים`,
bwho:`מי כתב את זה?`,bmine:`זה שלך: הצביעו בכל זאת, כדי לטשטש עקבות`,bby:`נכתב על ידי {n}`,bnone:`אף אחד לא ניחש: +3 ל{n}`,bsome:`מסתורי בדיוק במידה: +1 ל{n}`,ball:`כולם ניחשו!`,
bT:`אמיתי`,bF:`מומצא`,bguess:`אמיתי או מומצא?`,bfrom:`הבקבוק של {n}`,bfool:`בלוף מוצלח: +2 ל{n}`,bok:`יפה: +2 ל{n}`,
n_pha:`המגדלור`,d_pha:`מי מאיתנו…? הצביעו, המגדלור מאיר את הקבוצה`,r_pha:`הצביעו למי שהכי מתאים, גם לעצמכם. +1 אם הצבעתם כמו הרוב.`,r_pha2:`בחרו אחד משניכם, ואז נחשו מה השני יענה: +1 אם צדקתם.`,
pq:`מי מאיתנו…`,pq2:`מי משנינו…`,ppred:`ו{n} יענה…`,ppredS:`ניחוש`,pport:`דיוקן הקבוצה`,pnone:`אין תואר הפעם`,pagree:`מסכימים!`,pdis:`לא מסכימים…`,
n_vag:`אותו גל`,d_vag:`מילה אחת, הראשונה שעולה: חשבו אותו דבר`,r_vag:`כתבו את המילה הראשונה שעולה. +1 על כל מי שכתב אותה מילה, +1 אם אתם בדיוק שניים.`,r_vag2:`כתבו אותה מילה: +2. פספסתם? מילת גשר שמחברת בין שתי המילים: +1.`,
vin:`המילה הראשונה שלך`,vbr:`מילה שמחברת בין השתיים`,vsame:`אותו גל!`,vpont:`הגשר נבנה!`,vmiss:`לא הפעם…`,vno:`לא המילה הזאת!`,vc0:`מים עכורים`,vc1:`זרמים נפגשים`,vc2:`על אותו גל`,
n_rad:`הרפסודה`,d_rad:`מה הייתם מעדיפים… והקבוצה?`,r_rad:`בחרו, ואז המרו על בחירת הרוב: +1 אם צדקתם, +2 אם אתם עצמכם הייתם במיעוט.`,r_rad2:`בחרו, ואז נחשו את הבחירה של השני: +1 אם צדקתם.`,
rbet:`הרוב יבחר…`,rbet2:`{n} יבחר…`,rtie:`תיקו: הרפסודה מתנדנדת, אף הימור לא זוכה`,rmaj:`רוב`,rtwin:`נפשות תאומות על הרפסודה`,
n_pec:`דיג פנינים`,d_pec:`לצלול שוב, או לעלות עם הרשת?`,r_pec:`כל צלילה שולפת פריט מהשק. בכריש השני, מי שלמטה מאבד את הרשת. המדוזה עוקצת את הרשת הכי מלאה (−½). לבד בקרקעית: פנינים ×2.`,
r_pec2:`כל צלילה שולפת פריט מהשק. בכריש השני, מי שלמטה מאבד את הרשת. המדוזה עוקצת את הרשת הכי מלאה (−½). לבד בקרקעית: פנינים ×2. הדקר 🐟 צולל איתכם: עולה ב־8, או ב־4 אחרי כריש.`,
pup:`לעלות`,pdown:`לצלול`,pfil:`הרשת שלך`,pcof:`תיבה`,pbag:`בשק`,pshark:`כריש!`,pjel:`מדוזה!`,pdead:`כריש שני: הרשתות אבדו`,pdouble:`לבד בקרקעית: ×2`,
prisk:`סיכון 🦈: {p}%`,psafe:`כריש ראשון: לא מסוכן`,pmanche:`סוף הסיבוב`,ghost:`הדקר`,psecret:`סודי עד הסוף`,pyouup:`{g:עלית|עלית}: +{v}`},
pha:`ישרוד הכי הרבה זמן על אי בודד|ייסע לטיול בלי לתכנן|בוכה בסרטים|הכי טוב בשמירת סודות|ילך לאיבוד בעיר שלו|יהיה מפורסם יום אחד|מדבר עם חיות|שוכח ימי הולדת|צוחק ברגע הכי לא מתאים|אוכל את החתיכה האחרונה בלי לשאול|עונה להודעות אחרי שלושה ימים|יאמץ עשרה חתולים|תמיד צודק בסוף|שר במקלחת|קם לפני השמש|נותן את העצות הכי טובות|ינצח בתחרות ריקוד|עם הזיכרון הכי טוב|יגיד כן לכל הרפתקה|ייקח את ההגה של הספינה|ייפול למים ראשון|יהיה מרגל מצוין|מספר את הסיפורים הכי טובים|יחליף חיים מחר|מסתיר הכי הרבה כישרונות|יגדל ילדים הכי טוב|נרדם בכל מקום|מכיר הכי הרבה אנשים|מתמקח על הכול|יצחיק אפילו כריש|הכי סבלני|יעשה קעקוע בדחף של רגע|עם הדמיון הכי פרוע|זוכר את החלומות שלו|ימצא אוצר|יכתוב ספר יום אחד|מרגיע כל ריב|תמיד אורז יותר מדי|מדבר הכי מהר|יבשל את הארוחה הכי טובה כמעט מכלום`,
pha1:`שלח פעם הודעה פלרטטנית לאדם הלא נכון|מנשק הכי טוב|הכי מקסים בלי לדעת|יעשה את הצעד הראשון|מפלרטט בלי לשים לב|הכי מצליח במסיבות|יגמור בג'קוזי עם זרים|ישן אצל מישהו כבר בדייט הראשון|עם המבט הכי מפתה|רוקד את הסלואו הכי צמוד|יודע את סודות חדר השינה הכי עסיסיים|שיחק פוקר חשפנות|כותב את ההודעות הכי לוהטות|מסמיק הכי מהר|האקסים שלו עדיין חושבים עליו הכי הרבה`,
pha2:`שכב עם מישהו כבר בלילה הראשון|עם ההיסטוריה הכי ארוכה באפליקציות היכרויות|עשה סקס במקום ציבורי|זייף אורגזמה|הכי סביר שיש לו סרטון סקס|שלח תמונת עירום|חזר למיטה עם אקס|עם מגירת הצעצועים הכי מלאה|נתפס על חם באמצע|עם הכי הרבה פרטנרים|עשה שלישייה|הכי רועש במיטה|שכח שם של מישהו בבוקר שאחרי|יצלם פורנו חובבני|עם הפנטזיות הכי סוטות`,
vag:`אוקיינוס|חוף|אי|קיץ|לילה|קפה|חתול|גשם|חלום|מסע|אהבה|מוזיקה|ילדות|מסיבה|חורף|הר|שמש|ירח|ספר|רכבת|יער|בית ספר|בית|אדום|גבינה|פחד|רוח|כוכב|סרט|ספורט|גינה|פרח|שוקולד|עיר|שבת|מתנה|שלג|אש|פסנתר|פיראט|אוצר|סירה|דג|כריש|חול|חופשה|קסם|דרקון|פיצה|טלפון|מראה|סוד|חיוך|מכונית|מטוס|חג|יום הולדת|סערה|קרקס|ענן`,
vag1:`נשיקה|הלבשה תחתונה|פיתוי|עיסוי|פלרטוט|חיבוק|דייט|תשוקה|אמבטיה|שמפניה|סדינים|פיתוי עז|סלואו|מבט|צמרמורת`,
vag2:`אורגזמה|אזיקים|קונדום|סרטון סקס|חשפנות|שלישייה|ישבן|נודיזם|גניחה|סקסטינג|קמסוטרה|חומר סיכה|פטיש|קוויקי|ויברטור`,
rad:`לגור על סירה~לגור בבית עץ|לנשום מתחת למים~לעוף|לקרוא מחשבות~להיות בלתי נראה|תמיד חם מדי~תמיד קר מדי|אי בודד עם ספר טוב~עיר הומה עם החברים|לדעת את העתיד~לראות שוב את העבר|לדבר בכל השפות~לדבר עם חיות|בלי מוזיקה לעולם~בלי סרטים לעולם|מסיבת הפתעה~ארוחת ערב שקטה|תהילה~הון סודי|לטייל לבד~לטייל עם עשרה אנשים|ים~הרים|זריחה~שקיעה|לא להיות מסוגל לשקר~לא לשמוע שקר לעולם|דולפין מחמד~תוכי מדבר|תמיד להגיד מה שחושבים~לשמור הכול בבטן|לחיות שוב את היום הכי טוב~לחיות יום לא מוכר|מתוק~מלוח|סערה בלב ים~חודש של שקט מוחלט|לחקור את מעמקי הים~לחקור את החלל|כוח־על מיותר~בלי כוח בכלל|לכתוב ספר~להלחין שיר|לישון תחת הכוכבים~לישון בארמון|שנה בלי טלפון~שנה בלי קפה|לעמוד ליד ההגה~לנהל את המטבח של הספינה|חיי פיראט~חיי בת ים|לדעת לבשל הכול~לדעת לתקן הכול|תמיד מוקדם~תמיד באיחור|שנה של חופש~שנה של משכורת כפולה|להשתגר ממקום למקום~לעצור את הזמן|למצוא אוצר~לגלות אי לא ידוע|לצחוק כל הזמן~לא לבכות לעולם|בית על כלונסאות~מגדלור מבודד|לשיר מול כולם~לרקוד מול כולם|אלף חברים~שלושה חברים לכל החיים|קיץ נצחי~חורף נצחי|לקרוא את כל הספרים בעולם~לראות את כל הסרטים בעולם|לשחות עם כרישים~ללכת על חבל מעל הים|לחזור לגיל 10~לקפוץ לגיל 80|ערב משחקים~ערב קריוקי`,
rad1:`נשיקה ראשונה בגשם~נשיקה ראשונה בשקיעה|עיסוי~אמבטיה זוגית|הלבשה תחתונה~כלום בכלל|לפלרטט~שיפלרטטו איתך|דייט עיוור~דייט עם האקס|מילים מתוקות~מבטים לוהטים|לילה זוגי תחת הכוכבים~לילה זוגי במלון יוקרה|משחק מקדים ארוך~ישר לעניין|אור דולק~אור כבוי|בבוקר~בערב|סלואו צמוד~ריקוד פרוע|הודעה שובבה~שיחה בחצות|קעקוע נסתר~פירסינג נסתר|בן זוג שמבשל~בן זוג שמעסה|נשיקה בצוואר~לחישה באוזן`,
rad2:`סקס בים~סקס על החוף|סרטון הסקס שלך דלף~היסטוריית הגלישה שלך דלפה|שלישייה~מועדון חילופי זוגות|אזיקים~כיסוי עיניים|לשכב עם האקס~לשכב עם מישהו מהעבודה|שנה בלי סקס~שנה בלי אינטרנט|סקס שקט כל החיים~סקס רועש כל החיים|ההורים קוראים את הפנטזיות שלך~את קורא את שלהם|תמיד למעלה~תמיד למטה|סקס במטוס~סקס במעלית|לא לגמור לעולם~לגמור בכל עיטוש|תמונת עירום שדלפה~הודעה קולית מביכה שדלפה|כבר בלילה הראשון~לחכות שלושה חודשים|לילה עם כוכב~לילה עם הקראש הסודי|צעצועים~רק ידיים`};

GI18N.pt={ui:{stopAsk:`Parar o jogo e ver os pontos?`,stop:`Parar`,room:`Sala de jogos`,exp:`Expedição`,expD:`A viagem de ilha em ilha`,play:`Jogar {g}`,waitHost:`O anfitrião inicia a partida`,needP:`De {a} a {b} jogadores`,
t_skill:`habilidade`,t_chance:`sorte`,t_social:`social`,send:`Enviar`,ok:`Continuar`,me:`eu`,or:`ou`,waitN:`Esperando {n}`,yourMove:`Sua vez!`,watch:`Veja os outros jogarem`,ready:`{g:Pronto|Pronta}? Seguimos quando todos estiverem`,
scores:`Pontos`,coopT:`Pontuação de conexão`,again:`Jogar de novo`,lobby:`Voltar ao salão`,hostNext:`Jogar de novo, ou voltar ao salão?`,waitHostN:`{n} escolhe o que vem agora`,
n_bot:`Mensagens na garrafa`,d_bot:`Histórias verdadeiras e anônimas: quem escreveu?`,r_bot:`Escreva 2 ou 3 coisas verdadeiras sobre você. Elas chegam anônimas: descubra quem escreveu (+2). Ninguém te descobriu? +3. Só alguns? +1.`,
r_bot2:`Escreva 3 histórias, verdadeiras ou inventadas (pelo menos uma de cada). Adivinhe as do outro (+2); cada blefe certeiro vale +2.`,
bph:`Algo verdadeiro sobre você…`,bph18:`Algo verdadeiro (e ousado) sobre você…`,bph2:`Uma história sobre você…`,bmin:`Escreva pelo menos 2`,bmin2:`Preencha as 3, com pelo menos uma verdadeira e uma inventada`,bwait:`Suas garrafas estão no mar`,
bwho:`Quem escreveu isto?`,bmine:`É sua: vote mesmo assim, para despistar`,bby:`Escrita por {n}`,bnone:`Ninguém acertou: +3 para {n}`,bsome:`Misterioso na medida: +1 para {n}`,ball:`Todo mundo acertou!`,
bT:`Verdadeira`,bF:`Inventada`,bguess:`Verdadeira ou inventada?`,bfrom:`Garrafa de {n}`,bfool:`Blefe certeiro: +2 para {n}`,bok:`Bem visto: +2 para {n}`,
n_pha:`O Farol`,d_pha:`Quem de nós…? Votem, o farol ilumina o grupo`,r_pha:`Vote em quem combina mais, até você. +1 se votar como a maioria.`,r_pha2:`Escolha um de vocês dois e preveja a resposta do outro: +1 se acertar.`,
pq:`Quem de nós…`,pq2:`Quem de nós dois…`,ppred:`E {n} vai responder…`,ppredS:`previu`,pport:`Retrato do grupo`,pnone:`Nenhum título desta vez`,pagree:`De acordo!`,pdis:`Sem acordo…`,
n_vag:`Mesma onda`,d_vag:`Uma palavra, a primeira que vier: pensem igual`,r_vag:`Escreva a primeira palavra que vier. +1 por pessoa com a mesma palavra, +1 se forem exatamente dois.`,r_vag2:`Escrevam a mesma palavra: +2. Errou? Uma palavra-ponte ligando as duas: +1.`,
vin:`Sua primeira palavra`,vbr:`Uma palavra que ligue as duas`,vsame:`Mesma onda!`,vpont:`Ponte feita!`,vmiss:`Desta vez não…`,vno:`Essa palavra não!`,vc0:`Águas turvas`,vc1:`Correntes que se cruzam`,vc2:`Mesma sintonia`,
n_rad:`A Jangada`,d_rad:`Você prefere… e o grupo?`,r_rad:`Escolha e aposte na escolha da maioria: +1 se acertar, +2 se você estava na minoria.`,r_rad2:`Escolha e adivinhe a escolha do outro: +1 se acertar.`,
rbet:`A maioria vai escolher…`,rbet2:`{n} vai escolher…`,rtie:`Empate: a jangada balança, nenhuma aposta ganha`,rmaj:`maioria`,rtwin:`Almas gêmeas da jangada`,
n_pec:`Pesca de pérolas`,d_pec:`Mergulhar de novo, ou subir com a rede?`,r_pec:`Cada mergulho tira algo do saco. No 2º tubarão, quem está no fundo perde a rede. A água-viva queima a rede mais cheia (−½). Sozinho no fundo: pérolas ×2.`,
r_pec2:`Cada mergulho tira algo do saco. No 2º tubarão, quem está no fundo perde a rede. A água-viva queima a rede mais cheia (−½). Sozinho no fundo: pérolas ×2. A Garoupa 🐟 mergulha com vocês: sobe com 8, ou com 4 depois de um tubarão.`,
pup:`Subir`,pdown:`Mergulhar`,pfil:`Sua rede`,pcof:`Baú`,pbag:`No saco`,pshark:`Tubarão!`,pjel:`Água-viva!`,pdead:`2º tubarão: redes perdidas`,pdouble:`Sozinho no fundo: ×2`,
prisk:`Risco 🦈: {p}%`,psafe:`1º tubarão: inofensivo`,pmanche:`Fim da rodada`,ghost:`A Garoupa`,psecret:`secretos até o fim`,pyouup:`Subiu: +{v}`},
pha:`sobreviveria mais tempo numa ilha deserta|partiria em viagem por impulso|chora com filmes|guarda melhor um segredo|se perderia na própria cidade|vai chegar à fama um dia|fala com os animais|esquece aniversários|ri na pior hora|come o último pedaço sem perguntar|responde mensagens três dias depois|adotaria dez gatos|sempre acaba tendo razão|canta no chuveiro|acorda antes do sol|dá os melhores conselhos|ganharia um concurso de dança|tem a melhor memória|diria sim a qualquer aventura|assumiria o leme do navio|cairia na água antes de todos|seria um espião excelente|conta as melhores histórias|mudaria de vida amanhã|esconde mais talentos|criaria melhor os filhos|dorme em qualquer lugar|conhece mais gente|pechincha tudo|faria um tubarão rir|tem mais paciência|faria uma tatuagem por impulso|tem mais imaginação|lembra dos próprios sonhos|encontraria um tesouro|vai escrever um livro um dia|acalma qualquer briga|sempre leva bagagem demais|fala mais rápido|faria a melhor refeição com quase nada`,
pha1:`já mandou mensagem picante para a pessoa errada|beija melhor|tem mais charme sem saber|daria o primeiro passo|flerta sem perceber|faz mais sucesso nas festas|acabaria numa banheira de hidromassagem com estranhos|já dormiu na casa de alguém no primeiro encontro|tem o olhar mais sedutor|dança a música lenta mais colado|guarda os segredos de alcova mais picantes|já jogou strip pôquer|escreve as mensagens mais quentes|fica vermelho mais rápido|tem mais ex que ainda pensam nessa pessoa`,
pha2:`já transou na primeira noite|tem o maior histórico em apps de namoro|já transou em lugar público|já fingiu orgasmo|tem mais chance de ter um vídeo íntimo|já mandou nude|já voltou para a cama com ex|tem a gaveta de brinquedos mais cheia|já foi pego no flagra|tem mais parceiros na conta|já fez ménage|é mais barulhento na cama|já esqueceu o nome de alguém na manhã seguinte|gravaria um pornô amador|tem as fantasias mais pervertidas`,
vag:`oceano|praia|ilha|verão|noite|café|gato|chuva|sonho|viagem|amor|música|infância|festa|inverno|montanha|sol|lua|livro|trem|floresta|escola|casa|vermelho|queijo|medo|vento|estrela|filme|esporte|jardim|flor|chocolate|cidade|domingo|presente|neve|fogo|piano|pirata|tesouro|barco|peixe|tubarão|areia|férias|magia|dragão|pizza|telefone|espelho|segredo|sorriso|carro|avião|Natal|aniversário|tempestade|circo|nuvem`,
vag1:`beijo|lingerie|sedução|massagem|flerte|carinho|encontro|desejo|banheira|champanhe|lençóis|tentação|dança lenta|olhar|arrepio`,
vag2:`orgasmo|algemas|camisinha|vídeo íntimo|striptease|ménage|bunda|nudismo|gemido|sexting|kama sutra|lubrificante|fetiche|rapidinha|vibrador`,
rad:`Morar num barco~Morar numa casa na árvore|Respirar debaixo d'água~Voar|Ler mentes~Ficar invisível|Sempre calor demais~Sempre frio demais|Uma ilha deserta com um bom livro~Uma cidade lotada com seus amigos|Conhecer o seu futuro~Rever o seu passado|Falar todas as línguas~Falar com os animais|Nunca mais música~Nunca mais filmes|Uma festa surpresa~Um jantar tranquilo|A fama~Uma fortuna secreta|Viajar sem ninguém~Viajar em dez|O mar~A montanha|O nascer do sol~O pôr do sol|Nunca conseguir mentir~Nunca mais ouvir uma mentira|Um golfinho de estimação~Um papagaio que fala|Sempre dizer o que pensa~Guardar tudo para si|Reviver o seu melhor dia~Viver um dia desconhecido|Doce~Salgado|Uma tempestade em alto-mar~Um mês de calmaria|Explorar o fundo do mar~Explorar o espaço|Um superpoder inútil~Nenhum poder|Escrever um livro~Compor uma canção|Dormir sob as estrelas~Dormir num palácio|Um ano sem celular~Um ano sem café|Ficar no leme~Cuidar da cozinha do navio|Uma vida de pirata~Uma vida de sereia|Saber cozinhar tudo~Saber consertar tudo|Chegar sempre cedo~Chegar sempre tarde|Um ano de férias~Um ano de salário dobrado|Se teletransportar~Parar o tempo|Achar um tesouro~Descobrir uma ilha desconhecida|Rir o tempo todo~Nunca chorar|Uma palafita~Um farol isolado|Cantar na frente de todos~Dançar na frente de todos|Mil amigos~Três amigos para a vida|Um verão eterno~Um inverno eterno|Ler todos os livros do mundo~Ver todos os filmes do mundo|Nadar com tubarões~Andar numa corda bamba sobre o mar|Voltar aos 10 anos~Pular para os 80 anos|Uma noite de jogos~Uma noite de karaokê`,
rad1:`Um primeiro beijo na chuva~Um primeiro beijo no pôr do sol|Uma massagem~Um banho a dois|Lingerie~Nada mesmo|Paquerar~Ser paquerado|Um encontro às cegas~Um encontro com o ex|Palavras doces~Olhares ardentes|Uma noite sob as estrelas a dois~Uma noite num hotel de luxo a dois|Preliminares longas~Direto ao ponto|Luz acesa~Luz apagada|De manhã~À noite|Uma dança lenta bem colada~Uma dança alucinada|Uma mensagem picante~Uma ligação à meia-noite|Uma tatuagem escondida~Um piercing escondido|Parceiro que cozinha~Parceiro que faz massagem|Um beijo no pescoço~Um sussurro no ouvido`,
rad2:`Sexo no mar~Sexo na praia|Seu vídeo íntimo vazado~Seu histórico da internet vazado|Um ménage~Um clube de swing|Algemas~Uma venda nos olhos|Transar com o ex~Transar com alguém do trabalho|Um ano sem sexo~Um ano sem internet|Sexo silencioso para sempre~Sexo barulhento para sempre|Seus pais leem suas fantasias~Você lê as dos seus pais|Sempre por cima~Sempre por baixo|Sexo num avião~Sexo num elevador|Nunca mais gozar~Gozar a cada espirro|Um nude vazado~Um áudio constrangedor vazado|Transar na primeira noite~Esperar três meses|Uma noite com uma celebridade~Uma noite com seu crush secreto|Brinquedos~Só as mãos`};
})();
