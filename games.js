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
/* mémoire entre parties (côté hôte) : contenus déjà vus, du plus ancien au plus récent */
const GSEEN='terra:seenG';
function gSeen(){try{const a=JSON.parse(localStorage.getItem(GSEEN)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function gSeenAdd(ids){try{const S=new Set(ids),a=gSeen().filter(x=>!S.has(x)).concat(ids);localStorage.setItem(GSEEN,JSON.stringify(a.slice(-3000)))}catch(e){}}
/* pioche n contenus [réserve,index] selon le ton (0 : tout public seulement) — jamais deux fois dans une partie ;
   d'abord les inédits, puis les plus anciennement vus */
function gPool(s,k,n){const t=+s.tone||0,w=t==2?[.3,.3,.4]:t==1?[.55,.45,0]:[1,0,0],SI=new Map(gSeen().map((x,i)=>[x,i])),id=(p,i)=>k+(p||'')+':'+i;
 const P3=[0,1,2].map(p=>{if(!w[p])return[];const a=shuf([...Array(GL(k+(p||''),'fr').length).keys()].map(i=>[p,i]));
  return a.filter(x=>SI.has(id(...x))).sort((x,y)=>SI.get(id(...y))-SI.get(id(...x))).concat(a.filter(x=>!SI.has(id(...x))))}),out=[];
 for(let j=0;j<n;j++){let r=Math.random(),p=0;while(p<2&&(r-=w[p])>0)p++;if(!P3[p].length)p=P3.findIndex(x=>x.length);if(p<0)break;out.push(P3[p].pop())}
 gSeenAdd(out.map(x=>id(...x)));return shuf(out)}

/* ---------- moteur ---------- */
const gOn=s=>s.order.filter(n=>{const p=P(n);return p&&p.online!==false});
/* sablier : durée de base × facteur de l'hôte (TF : 1,5 / 1 / 0,7, comme l'Expédition). TF 0 = pas de sablier : g.dl=-1,
   on avance seulement quand tout le monde a fini. Toutes les durées de jeu passent par gWait. */
const gTF=()=>{try{return typeof st!='undefined'&&st?+(st.timer??1):1}catch(e){return 1}};/* = TF() hors mode éclair (propre à l'Expédition) */
function gWait(g,sec,st,rv){const f=gTF();sec=Math.round(sec*(f||1));g.st=st;g.k++;g.done={};g.need=null;g.dl=f?Date.now()+sec*1000:-1;g.sec=sec;g.rv=rv?1:0}
const gLate=g=>g.dl>0&&Date.now()>g.dl;
const gNeed=s=>{const g=s.game;return gOn(s).filter(n=>!g.need||g.need.includes(n))};
const gAll=s=>gNeed(s).every(n=>s.game.done[n]);
function gFin(s){const g=s.game,r=GAMES[g.id].fin(s)||{};s.gres={pts:r.pts||g.sc,coop:r.coop||null};g.dl=0;s.phase='gend'}
function gCheck(s){const g=s.game;let i=0;
 while(s.phase=='game'&&g.dl&&(gAll(s)||gLate(g))&&i++<6){g.dl=0;GAMES[g.id].next(s);if(g.over){gFin(s);break}}}
function gStart(s){const id=s.gsel;s.game={id,k:0,r:0,n:0,sc:{},done:{},rx:{}};s.order.forEach(n=>s.game.sc[n]=0);s.gres=null;s.phase='game';s.gid=Date.now().toString(36);GAMES[id].init(s);gCheck(s)}
/* @games : appelé en tête de act() ; true = géré ici */
W.GAct=function(s,from,a){const t=a&&a.t;
 if(t=='gsel'){if(from==s.host&&s.phase=='lobby'&&(!a.v||GAMES[a.v])){s.gsel=a.v||null;bump()}return true}
 if(t=='start'&&s.gsel&&s.phase=='lobby'){const G=GAMES[s.gsel],on=s.players.filter(p=>p.online);
  if(from==s.host&&G&&on.length>=G.min&&on.length<=G.max){s.order=on.map(p=>p.name);gStart(s);bump()}return true}
 if(t=='gtie'){/* liens connus (couples…) : bascule une paire, hôte seulement, au salon */
  if(from==s.host&&s.phase=='lobby'&&Array.isArray(a.v)&&a.v.length==2&&a.v[0]!==a.v[1]&&a.v.every(n=>typeof n=='string'&&s.players.some(p=>p.name==n))){
   const k=a.v[0]<a.v[1]?a.v[0]+'|'+a.v[1]:a.v[1]+'|'+a.v[0],L=s.gtie||[];s.gtie=L.includes(k)?L.filter(x=>x!=k):[...L,k].slice(-8);bump()}return true}
 if(t=='gx'&&a.v=='stop'){if(from==s.host&&s.phase=='game'&&s.game){gFin(s);bump()}return true}
 if(t=='gx'){if(from!=s.host||s.phase!='gend')return true;s.players=s.players.filter(p=>p.online);
  const G=GAMES[s.game.id],on=s.players.map(p=>p.name);
  if(a.v=='again'&&on.length>=G.min&&on.length<=G.max){s.gsel=s.game.id;s.order=on;gStart(s)}else{s.phase='lobby';s.game=null;s.gres=null}
  bump();return true}
 if(t=='g'){const g=s.game;if(s.phase!='game'||!g||!s.order.includes(from))return true;if(a.k!=null&&a.k!==g.k&&!a.rx)return true;
  let ch=false;if(a.rx&&typeof a.rx=='string'&&RX.includes(a.rx)){g.rx[from]=a.rx;ch=true}
  else if(a.ok&&g.rv){if(!g.done[from]){g.done[from]=1;ch=true}}
  else{/* on peut changer d'avis tant que l'étape n'est pas finie (les autres jouent encore, sablier en cours) */
   const was=g.done[from];if(was&&!g.rv)delete g.done[from];ch=!!GAMES[g.id].act(s,from,a);if(!ch&&was)g.done[from]=was}
  if(ch){gCheck(s);bump()}return true}
 return false};
W.GHide=function(name,s){if(!s||s.phase!='game'||!s.game)return s;const G=GAMES[s.game.id];return G&&G.hide?{...s,game:G.hide(s.game,name,s)}:s};
W.GKick=function(s,name){s.order=s.order.filter(x=>x!=name);if(s.phase!='game'||!s.game)return;if(s.order.length<2)gFin(s);else gCheck(s)};
W.gTick=function(){try{if(isHost&&st&&st.phase=='game'&&st.game&&st.game.dl&&(gLate(st.game)||gAll(st))){gCheck(st);bump()}}catch(e){}};
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

W.GView=function(){const s=isHost?GHide(meN(),st):st,g=s.game;if(!g||!GAMES[g.id])return{html:''};/* l'hôte voit la même chose que les autres */
 if(s.v!==GV.v){GV.v=s.v;GV.t=Date.now()}
 if(s.phase=='gend')return gEndView(s);
 const G=GAMES[g.id],v=G.view(s)||{},two=s.order.length==2;
 const rem=g.dl>0?Math.max(0,(g.dl-((s.updatedAt||Date.now())+(Date.now()-(RCV||Date.now()))))/1000):0;
 const rk='r_'+g.id+(two&&GI18N.fr.ui['r_'+g.id+'2']?'2':'');
 const head=`<div class="ghd"><span class="gic">${G.icon}</span><b>${GT('n_'+g.id)}</b>${g.n?`<span class="grd">${Math.min(g.r+1,g.n)} / ${g.n}</span>`:''}${meN()==s.host?`<button class="gstop" id="gstop" aria-label="${esc(GT('stopAsk'))}" data-tip="${esc(GT('stopAsk'))}">✕</button>`:''}</div>
 ${g.dl>0?`<div class="gsab" aria-hidden="true"><i style="animation-duration:${g.sec}s;animation-delay:-${Math.max(0,g.sec-rem).toFixed(2)}s"></i></div>`:''}
 ${g.k<=1?`<p class="grule">${GT(rk)}</p>`:''}`;
 const h={...gHint(s),...v};const ob=v.bind;
 return{...h,html:`<div class="gw g-${g.id}${g.k>1?' gnx':''}">${head}${v.html}</div>`,bind(){
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
W.GLobby=function(host,on,E){const sel=st.gsel&&GAMES[st.gsel]?st.gsel:'';
 const tile=id=>{const G=GAMES[id],ok=!id||on<=G.max,tag=host?'button':'div';
  return `<${tag} class="gtile ggt ${sel==id?'sel':''}" ${host?`data-gsel="${id}" ${ok?'':'disabled'}`:''}><span class="gi">${id?G.icon:'⛵'}</span><span class="gt"><b>${id?GT('n_'+id):GT('exp')}</b><span class="mut">${id?GT('d_'+id):GT('expD')}</span></span><span class="gtags">${(id?G.tags:['social']).map(t=>`<i class="gtg-${t}">${GT('t_'+t)}</i>`).join('')}</span><span class="gmin">≈ ${id?G.dur:(E||'?')} min · ${id?G.min:2}–${id?G.max:8} 👤</span></${tag}>`};
 let h=`<div class="card"><h3>🎲 ${GT('room')}</h3><div class="gtiles">${host?['',...Object.keys(GAMES)].map(tile).join(''):tile(sel)}</div>${host?'':`<p class="gby">${T('chosenBy',{n:B(st.host)})}</p>`}</div>`;
 if(sel){const G=GAMES[sel],ok=on>=G.min&&on<=G.max,rk='r_'+sel+(on==2&&GI18N.fr.ui['r_'+sel+'2']?'2':'');
  let tm='';try{if(!G.rt){const tf=st.timer??1;tm=`<h3 class="gh">${T('timerT')}</h3>${host?`<div class="gseg">${TIM.map((v,i)=>`<button data-tm="${i}" class="${v==tf?'sel':''}">${T('tm'+i)}</button>`).join('')}</div>`:`<p class="gval">${T('tm'+TIM.indexOf(tf))}</p>`}<p class="gsub">${T(tf?'timerD':'timer0D')}</p>`}}catch(e){}
  let ti='';if(G.ties){const L=(st.gtie||[]).filter(k=>k.split('|').every(p=>st.players.some(x=>x.name==p))),ps=st.players.filter(p=>p.online).map(p=>p.name);
   ti=`<h3 class="gh">🔗 ${GT('mtieT')}</h3><p class="gsub">${GT('mtieD')}</p>${L.length?`<div class="gties">${L.map(k=>`<span class="gtie">${k.split('|').map(B).join(' 🔗 ')}${host?`<button class="gtx" data-gtie="${esc(k)}" aria-label="✕">✕</button>`:''}</span>`).join('')}</div>`:host?'':`<p class="gval">${GT('mtie0')}</p>`}
   ${host&&ps.length>1?`<p class="gsub">${GT('mtieH')}</p><div class="gtiep">${ps.map(p=>`<button class="ghost ${GV.tie==p?'sel':''}" data-gtp="${esc(p)}">${esc(p)}</button>`).join('')}</div>`:''}`}
  h+=(G.tone?g2ToneCard(host):'')+`<div class="card"><p class="grule">${GT(rk)}</p>${G.tut?`<button class="ghost gtutb" data-gtut="${sel}">📖 ${GT('tuB')}</button>`:''}${ok?'':`<p class="err">${GT('needP',{a:G.min,b:G.max})}</p>`}${tm}${ti}
  ${host?`<button class="pri wide" id="start" ${ok?'':'disabled'}>${GT('play',{g:GT('n_'+sel)})}</button>`:`<p class="gby">${GT('waitHost')}</p>`}</div>`}
 return h};
/* liens connus : clics délégués (le salon est rendu par index.html) */
if(typeof document!='undefined')document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-gtp],[data-gtie]');if(!t)return;
 if(t.dataset.gtie!=null){send({t:'gtie',v:t.dataset.gtie.split('|')});return}
 const p=t.dataset.gtp;if(!GV.tie||GV.tie==p){GV.tie=GV.tie==p?null:p;render();return}const a=GV.tie;GV.tie=null;send({t:'gtie',v:[a,p]});render()});

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
 init(s){const g=s.game,P=gPool(s,'bot',s.order.length*3);g.w={};g.ip={};s.order.forEach((n,i)=>g.ip[n]=P.slice(i*3,i*3+3));gWait(g,240,'w')},
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
   g.q=q;g.n=q.length;g.i=-1;delete g.w;delete g.ip;return this.nx(s)}
  if(g.st=='v'){if(two){const [a,b]=s.order,r={v:{...g.v}};[[a,b],[b,a]].forEach(([x,y])=>{const bt=g.w[y][g.i],gv=g.v[x];if(gv==null)return;if(gv==bt.f)g.sc[x]+=2;else g.sc[y]+=2});g.h[g.i]=r;gWait(g,25,'r',1);return}
   const b=g.q[g.i],gu=Object.keys(g.v).filter(n=>n!=b.a),ok=gu.filter(n=>g.v[n]==b.a);ok.forEach(n=>g.sc[n]+=2);
   const bonus=!ok.length?3:ok.length<gu.length?1:0;if(s.order.includes(b.a))g.sc[b.a]+=bonus;b.v={...g.v};b.ok=ok;b.b=bonus;gWait(g,20,'r',1);return}
  if(g.st=='r'){if(two){g.i++;g.r=g.i;if(g.i>=3){g.over=1;return}g.v={};gWait(g,45,'v');return}return this.nx(s)}},
 nx(s){const g=s.game;g.i++;while(g.i<g.q.length&&!s.order.includes(g.q[g.i].a))g.i++;if(g.i>=g.q.length){g.over=1;return}g.v={};g.r=g.i;gWait(g,45,'v')},
 hide(g,n,s){const o={...g},two=s.order.length==2;
  if(g.ip)o.ip={[n]:g.ip[n]};
  if(g.w){o.w={};for(const x in g.w){if(x==n){o.w[x]=g.w[x];continue}if(g.st=='w')continue;o.w[x]=g.w[x].map((b,j)=>j<g.i||(j==g.i&&g.st=='r')?b:j==g.i?{t:b.t}:null)}}
  if(g.q)o.q=g.q.map((b,i)=>i<g.i||(i==g.i&&g.st=='r')?b:i==g.i?{t:b.t,m:b.a==n?1:0}:null);
  if(g.st=='v')o.v=hideOwn(g.v,n);return o},
 view(s){const g=s.game,m=meN(),two=s.order.length==2,t18=(+s.tone||0)>0;
  if(g.st=='w'){if(g.done[m]&&GV.ed!==g.id+g.k)return{html:`<div class="card c"><div class="gbig ga gfloat">🍾</div><p class="ga" ${dl(2)}>${GT('bwait')}</p><button class="ghost gedit ga" ${dl(3)} id="gedit">✏️ ${GT('edit')}</button></div>`,bind(){$('#gedit').onclick=()=>{GV.ed=g.id+g.k;render()}}};
   const fl=i=>drafts['gbf'+i]=='1',ip=(g.ip&&g.ip[m])||[];
   return{html:`<div class="card">${[0,1,2].map(i=>`<div class="gwr ga" ${dl(i)}>${two?`<button type="button" class="gtf ${fl(i)?'f':''}" data-gf="${i}" aria-pressed="${fl(i)}">${GT(fl(i)?'bF':'bT')}</button>`:''}<textarea data-d="gbw${i}" rows="2" maxlength="220" placeholder="${esc(ip[i]?'💡 '+GC('bot',ip[i])+'…':GT(two?'bph2':t18?'bph18':'bph'))}"></textarea></div>`).join('')}<p class="err"></p><button class="pri wide" id="gsend">${GT('send')}</button></div>`,
    bind(){$$('[data-gf]').forEach(b=>b.onclick=()=>{const k='gbf'+b.dataset.gf,v=drafts[k]=='1'?'0':'1';drafts[k]=v;b.classList.toggle('f',v=='1');b.setAttribute('aria-pressed',v=='1');b.textContent=GT(v=='1'?'bF':'bT')});
     $('#gsend').onclick=()=>{const w=[0,1,2].map(i=>tidy($(`[data-d="gbw${i}"]`).value)),f=[0,1,2].map(fl);
      if(two?(w.some(x=>!x)||!f.includes(true)||!f.includes(false)):w.filter(Boolean).length<2)return err(GT(two?'bmin2':'bmin'));GV.ed=null;gs({w,f})}}}}
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
    ${mine&&GV.ed!==g.id+g.k?`<p class="gword ga">${esc(mine)}</p><button class="ghost gedit ga" ${dl(3)} id="gedit">✏️ ${GT('edit')}</button>`:`<div class="grow2"><input data-d="gvw${g.k}" maxlength="32" autocomplete="off" placeholder="${esc(GT(br?'vbr':'vin'))}"><button class="pri" id="gsend">${GT('send')}</button></div><p class="err"></p>`}</div>`,
    bind(){$('#gedit')&&($('#gedit').onclick=()=>{GV.ed=g.id+g.k;render()});const i=$(`[data-d="gvw${g.k}"]`);if(!i)return;const go=()=>{const w=tidy(i.value);if(!norm(w))return;if(norm(w)==norm(q)||(br&&Object.values(g.w0||{}).some(x=>norm(x)==norm(w))))return err(GT('vno'));GV.ed=null;gs({w})};
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

/* =====================================================================
   🏝️ ARCHIPEL — fiche (stratégie pure, zéro hasard)
   Mer en hexagones, rayon 3 (37 cases ; rayon 2 / 19 cases à 2-3 joueurs). Perles par case, du centre au bord : 3, 2, 2, 1
     (rayon 2 : 3, 2, 1). Rien n'est tiré au sort et aucun siège n'existe : l'ordre des joueurs n'intervient jamais.
   Mise en place (60 s, simultanée, secrète) : chacun tape une case du bord = son port (on peut partager un port) et une case
     de l'anneau juste en dessous = un récif (infranchissable). Le plateau est construit par les joueurs.
   Boucle : ordres secrets (40 s) → résolution simultanée, animée au début de l'étape suivante. Récolte tous les 4 tours.
   UN ordre = UNE case tapée (≤ 7 choix, icône sur chaque case) : case voisine → ⛵ naviguer (on peut entrer partout sauf
     récif) ; sa propre case vide → 🏝️ bâtir ; îlot adverse sous soi → 🌊 le couler, sauf s'il est protégé (bateau de son·sa
     propriétaire dessus ou à côté) ; son îlot (ou îlot protégé) → 🛡️ rester. Couler demande donc 2 tours visibles (y aller,
     puis couler) : la victime peut revenir à côté, ou viser la même case (annulation).
   Conflits : deux ordres (quels qu'ils soient) sur la même case s'annulent tous les deux.
   Tous les 4 tours : récolte (chaque îlot rapporte ses perles), puis la marée engloutit l'anneau extérieur (îlots et récifs
     compris ; les bateaux glissent vers la case intérieure libre la plus proche, départage par géométrie, jamais par siège).
     12 tours (8 à 2-3 joueurs), ≈ 12 min. Rattrapage par la position : le centre vaut plus et dure plus, mais tout le monde y
     converge. Pas d'élimination : un bateau n'est jamais détruit. Égalité : places partagées.
   SIM (node .sim/arc.js, 2000 parties/taille, IA prudente / agressive / imitatrice / hasard, mêmes bases, poids différents) :
     victoires par siège n=2 49/51 · n=4 25.3/24.1/24.5/26.1 · n=8 12.0–13.3 (attendu 12.5) ; parties « miroir » idem.
     Duels à 2 : prudente-agressive 50/50, prudente-imitatrice 53/47, agressive-imitatrice 55/45, hasard ≤ 1 %.
     Tables mixtes (victoire relative à 1/n) : prudente ≈150 %, agressive ≈125 %, imitatrice ≈115 %, hasard <10 % :
     pas de style dominant, et jouer au hasard perd (le skill compte). Versions rejetées : couler depuis une case voisine
     (l'agressive gagnait 80 % des duels), garde « dessus seulement » (garder = perdre son tour).
   ===================================================================== */
const AX=(()=>{const L=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){const k=Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));if(k<=3)L.push([q,r,k])}
 const an=([q,r])=>{const a=Math.atan2(r*Math.sqrt(3)/2,q+r/2);return a<0?a+2*Math.PI:a};return L.sort((a,b)=>a[2]-b[2]||an(a)-an(b))})();
const AXI={};AX.forEach(([q,r],i)=>AXI[q+','+r]=i);
const AN=AX.map(([q,r])=>[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([a,b])=>AXI[(q+a)+','+(r+b)]).filter(x=>x!=null).sort((a,b)=>a-b));
const AVAL={2:[3,2,1],3:[3,2,2,1]},arcV=(g,c)=>AVAL[g.R][AX[c][2]];
const arcGd=(g,c)=>{const o=g.isl[c],b=o!=null?g.bt[o]:null;return b!=null&&(b===c||AN[c].includes(b))};
/* cibles légales de p : [[case, type]] — m naviguer, b bâtir, r couler, g rester */
function arcT(g,p){const b=g.bt[p];if(b==null)return[];const own=g.isl[b],out=[[b,own==null?'b':own==p||arcGd(g,b)?'g':'r']];
 AN[b].forEach(c=>{if(AX[c][2]<=g.lv&&!g.rf.includes(c))out.push([c,'m'])});return out}
function arcNear(g,b){const seen=new Set([b]);let fr=[b];
 while(fr.length){const nx=[];fr.forEach(c=>AN[c].forEach(d=>{if(!seen.has(d)){seen.add(d);nx.push(d)}}));
  const ok=nx.filter(c=>AX[c][2]<=g.lv&&!g.rf.includes(c));if(ok.length){ok.sort((a,c)=>(g.isl[a]!=null)-(g.isl[c]!=null)||a-c);return ok[0]}fr=nx}return 0}
GAMES.arc={icon:'🏝️',min:2,max:8,dur:12,tags:['skill'],T:arcT,V:arcV,gd:arcGd,AX,AN,
 init(s){const g=s.game;g.R=s.order.length<=3?2:3;g.lv=g.R;g.N=4*g.R;g.n=0;g.bt={};g.isl={};g.rf=[];g.o={};g.pp={};g.pf={};g.ev=null;g.hv=[];g.ss={};
  s.order.forEach(p=>g.ss[p]={b:0,r:0});gWait(g,60,'s')},
 act(s,from,a){const g=s.game,c=+a.c;if(a.c==null||!(c>=0&&c<AX.length))return;
  if(g.st=='s'){const k=AX[c][2];if(k==g.R)g.pp[from]=c;else if(k==g.R-1)g.pf[from]=c;else return;
   if(g.pp[from]!=null&&g.pf[from]!=null)g.done[from]=1;return true}
  if(g.st=='o'){if(!arcT(g,from).some(t=>t[0]==c))return;g.o[from]=c;g.done[from]=1;return true}},
 next(s){const g=s.game;
  if(g.st=='s'){const edge=AX.map((x,i)=>i).filter(i=>AX[i][2]==g.R);
   s.order.forEach(p=>{g.bt[p]=g.pp[p]!=null?g.pp[p]:edge[Math.floor(Math.random()*edge.length)]});
   g.rf=[...new Set(Object.values(g.pf).filter(c=>c!=null))];g.ev={set:1,rf:[...g.rf]};g.n=g.N;g.r=0;g.o={};gWait(g,40,'o');return}
  if(g.st=='o'){this.res(s);g.o={};g.r++;if(g.r%4==0){this.harvest(s);gWait(g,20,'h',1);return}gWait(g,40,'o');return}
  if(g.st=='h'){if(g.r>=g.n){g.over=1;return}this.tide(g);gWait(g,40,'o')}},
 res(s){const g=s.game,ord={},cnt={},ev={mv:{},bd:[],rd:[],cx:[],o:{}};
  s.order.forEach(p=>{const c=g.o[p];if(c==null)return;const t=arcT(g,p).find(x=>x[0]==c);if(!t)return;ord[p]=t;cnt[c]=(cnt[c]||0)+1});
  for(const p in ord){const [c,k]=ord[p];ev.o[p]=[c,k];if(cnt[c]>1){if(!ev.cx.includes(c))ev.cx.push(c);continue}
   if(k=='m')ev.mv[p]=[g.bt[p],c];else if(k=='b')ev.bd.push([c,p]);else if(k=='r')ev.rd.push([c,p,g.isl[c]])}
  for(const p in ev.mv)g.bt[p]=ev.mv[p][1];
  ev.bd.forEach(([c,p])=>{g.isl[c]=p;g.ss[p]&&g.ss[p].b++});ev.rd.forEach(([c,p])=>{delete g.isl[c];g.ss[p]&&g.ss[p].r++});g.ev=ev},
 harvest(s){const g=s.game,gain={};s.order.forEach(p=>gain[p]=0);for(const c in g.isl){const p=g.isl[c];if(gain[p]!=null)gain[p]+=arcV(g,+c)}
  for(const p in gain)g.sc[p]+=gain[p];g.hv.push(gain)},
 tide(g){const k=g.lv;g.lv--;const sunk=[];for(const c in g.isl)if(AX[c][2]>g.lv){sunk.push([+c,g.isl[c]]);delete g.isl[c]}
  g.rf=g.rf.filter(c=>AX[c][2]<=g.lv);const mv={};
  for(const p in g.bt){const b=g.bt[p];if(AX[b][2]<=g.lv)continue;const c=arcNear(g,b);mv[p]=[b,c];g.bt[p]=c}
  g.ev={mv,bd:[],rd:[],cx:[],o:{},tide:k,sunk}},
 hide(g,n){return g.st=='o'?{...g,o:hideOwn(g.o,n)}:g.st=='s'?{...g,pp:hideOwn(g.pp,n),pf:hideOwn(g.pf,n)}:g},
 svg(s,tg,mine){mine=mine||{};const g=s.game,S=10,R=g.R,ev=g.ev||{},m=meN(),r3=Math.sqrt(3);
  const X=c=>S*r3*(AX[c][0]+AX[c][1]/2),Y=c=>S*1.5*AX[c][1],f=v=>+v.toFixed(2);
  const hx=(c,k)=>{const x=X(c),y=Y(c);return [0,1,2,3,4,5].map(i=>{const a=Math.PI/180*(60*i-30);return f(x+S*k*Math.cos(a))+','+f(y+S*k*Math.sin(a))}).join(' ')};
  const cells=AX.map((x,i)=>i).filter(i=>AX[i][2]<=R),W=f(S*r3*(R+.5)+1.5),H=f(S*(1.5*R+1)+1.5);
  const lbl=(c,t,cl,dy)=>`<text class="${cl}" x="${f(X(c))}" y="${f(Y(c)+(dy||0))}">${t}</text>`;
  let o=`<svg class="arcb" viewBox="${-W} ${-H} ${2*W} ${2*H}" role="img" aria-label="${esc(GT('n_arc'))}">`;
  cells.forEach(c=>{const k=AX[c][2],dead=k>g.lv,sk=ev.tide&&k==ev.tide;o+=`<polygon class="h r${R-k}${dead?' dead':''}" points="${hx(c,.96)}"/>`;
   if(sk)o+=`<polygon class="h r${R-k} sink" points="${hx(c,.96)}"/>`;
   if(!dead&&g.isl[c]==null&&!g.rf.includes(c))o+=lbl(c,arcV(g,c),'v',-5.4)});
  const rock=(c,cl)=>{const x=X(c),y=Y(c);return `<g class="rk ${cl||''}"><circle cx="${f(x-2.4)}" cy="${f(y+1.2)}" r="3.1"/><circle cx="${f(x+2.2)}" cy="${f(y+1.6)}" r="2.5"/><circle cx="${f(x+.2)}" cy="${f(y-1.8)}" r="2.9"/></g>`};
  g.rf.forEach(c=>o+=rock(c,ev.set?'pop':''));
  const isl=(c,p,cl)=>`<g class="${cl}"><polygon class="isl" style="fill:${col(p)}" points="${hx(c,.68)}"/>${cl=='gone'?'':lbl(c,arcV(g,c),'iv',-3.9)}</g>`;
  for(const c in g.isl)o+=isl(+c,g.isl[c],'il'+((ev.bd||[]).some(x=>x[0]==c)?' pop':''));
  (ev.rd||[]).forEach(([c,p,v])=>o+=isl(c,v,'gone'));(ev.sunk||[]).forEach(([c,p])=>o+=isl(c,p,'gone'));
  (ev.cx||[]).forEach(c=>o+=lbl(c,'✕','cx',-5));
  if(mine.pp!=null)o+=`<circle class="bt0" cx="${f(X(mine.pp))}" cy="${f(Y(mine.pp))}" r="3.4" style="fill:${col(m)}"/>`;
  if(mine.pf!=null)o+=rock(mine.pf,'mf');
  const at={};s.order.forEach(p=>{const b=g.bt[p];if(b!=null)(at[b]=at[b]||[]).push(p)});
  /* case ciblable occupée : les bateaux remontent un peu, l'icône d'ordre prend le bas de la case (aucun chevauchement) */
  const tgs=new Set((tg||[]).filter(t=>t[1]!='p'&&t[1]!='f').map(t=>t[0]));
  for(const b in at){const L=at[b],n=L.length,up=tgs.has(+b);L.forEach((p,i)=>{const a=n>1?2*Math.PI*i/n-Math.PI/2:0,rr=n>1?(n>4?(up?3.4:4.4):(up?2.9:3.6)):0,sm=n>4||(up&&n>2),x=X(+b)+rr*Math.cos(a)*(up&&n>1?1.25:1),y=Y(+b)+rr*Math.sin(a)-(up?(n>1?2:2.4):0);
   const mv=(ev.mv||{})[p],d=mv?` style="--dx:${f(X(mv[0])-X(mv[1]))}px;--dy:${f(Y(mv[0])-Y(mv[1]))}px"`:'';
   o+=`<g class="bt${mv?' mv':''}${p==m?' me':''}"${d}><circle cx="${f(x)}" cy="${f(y)}" r="${sm?2.3:n>1?2.7:3}" style="fill:${col(p)}"/><text x="${f(x)}" y="${f(y)}">${esc(([...p][0]||'').toUpperCase())}</text></g>`})}
  const gl={m:'⛵',b:'🏝️',r:'🌊',g:'🛡️',p:'⚓',f:'🪨'};
  (tg||[]).forEach(([c,k])=>{const on=mine.c===c||(k=='p'&&mine.pp===c)||(k=='f'&&mine.pf===c);
   o+=`<polygon class="tg${on?' on':''}" points="${hx(c,.96)}" data-ac="${c}" role="button" aria-label="${esc(GT('k_'+k))}"/>`+(k=='p'||k=='f'?'':lbl(c,gl[k],'gl'+(on?' on':'')+(at[c]?' sm':''),at[c]?6.3:5.2))});
  return o+'</svg>'},
 view(s){const g=s.game,m=meN(),play=s.order.includes(m);
  const nx={};for(const c in g.isl)nx[g.isl[c]]=(nx[g.isl[c]]||0)+arcV(g,+c);
  const bind=()=>$$('[data-ac]').forEach(x=>x.addEventListener('click',()=>gs({c:+x.dataset.ac})));
  if(g.st=='s'){const tg=play?AX.map((x,i)=>i).filter(i=>AX[i][2]==g.R||AX[i][2]==g.R-1).map(i=>[i,AX[i][2]==g.R?'p':'f']):[];
   return{html:`<div class="card c"><p class="arcst">${GT('asetup')}</p>${this.svg(s,tg,{pp:g.pp[m],pf:g.pf[m]})}<p class="arclg mut">⚓ ${GT('k_p')} · 🪨 ${GT('k_f')}</p></div>`,bind}}
  if(g.st=='h'){const h=g.hv[g.hv.length-1]||{},last=g.r>=g.n;
   return{html:`<div class="card c"><p class="arcst"><b>🦪 ${GT(last?'afinal':'aharv')}</b></p><div class="arcsc">${s.order.map((p,i)=>`<span class="gchip ga ${p==m?'me':''}" ${dl(i,.2)}>${DT(p)}${esc(p)} <b>+${h[p]||0}</b></span>`).join('')}</div>${this.svg(s)}
    ${last?'':`<p class="gnote ga" ${dl(3,.3)}>🌊 ${GT('atidec')}</p>`}</div>`,bind(){if((h[m]||0)>0&&!RM())sparkles($('.arcsc .me'),10)}}}
  const left=4-g.r%4,fin=g.r>=g.n-4,tg=play?arcT(g,m):[],c=g.o[m],k=c!=null&&(tg.find(t=>t[0]==c)||[])[1],ev=g.ev||{};
  const chips=`<div class="arcsc">${s.order.map(p=>`<span class="gchip ${p==m?'me':''}">${DT(p)}${esc(p)} <b>${g.sc[p]||0}</b>🦪${nx[p]?`<i class="mut">+${nx[p]}</i>`:''}</span>`).join('')}</div>`;
  return{html:`<div class="card c">${chips}<p class="arcst">${left==1?GT(fin?'afin1':'atide1'):GT(fin?'afin':'atide',{k:left})}${ev.tide?` · <b>${GT('asunk')}</b>`:(ev.cx||[]).length?` · <b class="arccx">✕ ${GT('acx')}</b>`:''}</p>
   ${this.svg(s,tg,{c})}<p class="arcmy">${!play?'':k?`${GT('amine')} : <b>${GT('k_'+k)}</b>`:GT('apick')}</p><p class="arclg mut">${['m','b','r','g'].map(x=>GT('k_'+x)).join(' · ')}</p></div>`,bind}},
 endView(s){const g=s.game;return `<div class="arcsc">${s.order.map((p,i)=>`<span class="gchip ga" ${dl(i,.3)}>${DT(p)}${esc(p)} · 🏝️ ${(g.ss[p]||{}).b||0} · 🌊 ${(g.ss[p]||{}).r||0}</span>`).join('')}</div><p class="mut arclg">🏝️ ${GT('abuilt')} · 🌊 ${GT('araid')}</p>`},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🎭 LES MASQUES — fiche (confiance / trahison, 3-8 joueurs)
   4 à 6 manches (tirées au sort, nombre caché : pas de « dernière manche » sûre pour trahir). Duos secrets (impair : un
     trio), rencontres répétées limitées ; masques marins au hasard, on ne voit QUE les masques de son duo/trio.
   Étapes : message anonyme (75 s, modifiable ; invitations tirées sans remise par ton) → choix secret Partager/Garder
     PAR PARTENAIRE (trio : un choix pour chacun ; 40 s, modifiable, sans choix = Garder) → révélation (prêt/20 s).
   Gains par face-à-face : Partager/Partager = 4, puis 3, puis 2 avec la même personne (« habitude ») ; Garder face à
     Partager = 4 / 1 ; Garder/Garder = 2. Trio : moyenne des deux face-à-face. Réseau : chaque NOUVELLE personne avec
     qui tu partages à deux rapporte +2, +4, +6… dès la 2e.
   🦈 Réputation publique : garder face à quelqu'un qui partageait (et qui n'avait pas de 🦈) te colle un 🦈 visible
     sur ton masque par tous tes futurs partenaires ; chaque 🦈 coûte 1 point avant la finale et 4 sur un vol réussi en
     finale. Garder face à un 🦈 ne marque pas (légitime défense) → pas de cascade de rancunes.
   🔗 Liens connus (couples, colocs…) déclarés par l'hôte au salon : leur face-à-face vaut la moyenne des autres
     face-à-face de la manche, leur lien ne compte que si la majorité des autres duos a partagé, et ils ne sont jamais
     tous deux finalistes → se connaître IRL ne rapporte ni plus ni moins.
   Scores secrets pendant la partie. Finale : le 1er contre le meilleur suivant qui n'est pas son lien connu (ex æquo :
     tirage) : 16 points à visage découvert, tous deux Partager = 8 ; un seul Voler = 16 − 4×🦈 ; tous deux Voler = −8
     chacun (poule mouillée). Les autres parient (+4 si juste). Fin : constellation de qui a trahi qui.
   SIM (.sim/mskv.js, hors site, 2500 parties/taille ; styles : prudente = partage sauf face à un 🦈 ou si la mer partage
     peu, agressive = garde et vole toujours, imitatrice, hasard, naïve = partage toujours, sournoise = partage puis garde
     dès la 4e manche) : sièges ±1–13 % du 1/n (bruit). Victoire relative à 1/n, n=3→8 : agressive 124/86/65/64/38/41 ;
     prudente 95–168 ; sournoise 123–153 ; imitatrice 68–99 ; hasard 43–85 ; naïve 81–136.
     Couple déclaré (partage toujours entre eux) : 49/50 · 40/40 · 35/33 · 31/29 · 20/25 % (n=4…8, obtenu/attendu),
     et parmi des joueurs prudents/imitateurs 41/50 · 42/40 · 30/33 · 28/29 · 24/25. Couple NON déclaré : juste parmi
     des joueurs prudents (50/50 · 41/40 · 33/33 · 29/29 · 25/25) mais avantagé si d'autres jouent au hasard
     (67/50 · 56/40 · 48/33 · 43/29 · 35/25) → d'où l'option « liens connus ».
     Rejetés : sans réputation (agressive 140–156 %), « habitude » à 0 (le trio de 3 devient « tout garder »), évitement
     total des liens (le couple perd des liens : 26 % au lieu de 40 à 5).
   ===================================================================== */
const MKE=['🐙','🪼','🐡','🦀','🐢','🦑','🐠','🦞','🐬','🦭'];
const mkPair=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const mkPay=(c1,c2,k)=>c1=='P'&&c2=='P'?(k==0?4:k==1?3:2):c1=='G'&&c2=='P'?4:c1=='P'?1:2;/* 1re rencontre 4, puis 3, puis 2 (habitude) */
GAMES.msk={icon:'🎭',min:3,max:8,dur:10,tags:['social'],tone:true,ties:true,MKE,pay:mkPay,nbf:k=>2*(k-1),POT:16,BET:4,TIEP:0,SHK:4,MKC:1,
 init(s){const g=s.game;g.n=4+Math.floor(Math.random()*3);g.r=0;g.pc={};g.mt={};g.net={};g.h=[];g.pub=[];g.q=gPool(s,'msk',6);g.tie=(s.gtie||[]).filter(k=>k.split('|').every(p=>s.order.includes(p)));this.round(s)},
 round(s){const g=s.game,on=s.order;let best=null,bv=1e9;
  for(let t=0;t<40;t++){const o=shuf(on),gr=[];for(let i=0;i+1<o.length;i+=2)gr.push([o[i],o[i+1]]);if(o.length%2)gr[gr.length-1].push(o[o.length-1]);
   let v=0;gr.forEach(x=>{for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){const k=mkPair(x[i],x[j]);v+=(g.mt[k]||0)**2+(g.tie.includes(k)?this.TIEP:0)}});v+=Math.random()*.1;if(v<bv){bv=v;best=gr}}
  g.grp=best;g.mk={};const ms=shuf(MKE.map((x,i)=>i));on.forEach((p,i)=>g.mk[p]=ms[i]);g.msg={};g.ch={};g.gain={};g.nb={};g.hab={};g.tm={};gWait(g,75,'m')},
 act(s,from,a){const g=s.game;
  if(g.st=='m'&&typeof a.w=='string'){g.msg[from]=tidy(a.w).slice(0,140);g.done[from]=1;return true}
  if(g.st=='c'&&(a.v=='P'||a.v=='G')){const pt=(g.grp.find(x=>x.includes(from))||[]).filter(q=>q!=from),c={...(g.ch[from]||{})};/* un choix par partenaire (trio) */
   const to=a.to==null?pt:pt.filter(q=>g.mk[q]===a.to);if(!to.length)return;to.forEach(q=>c[q]=a.v);g.ch[from]=c;if(pt.every(q=>c[q]))g.done[from]=1;return true}
  if(g.st=='f'){if(g.fin.includes(from)){if(a.v=='P'||a.v=='V'){g.fc[from]=a.v;g.done[from]=1;return true}}
   else if([0,1,2].includes(a.b)){g.bet[from]=a.b;g.done[from]=1;return true}}},
 next(s){const g=s.game;
  if(g.st=='m'){gWait(g,40,'c');return}
  if(g.st=='c'){this.resolve(s);gWait(g,20,'r',1);return}
  if(g.st=='r'){g.r++;if(g.r<g.n){this.round(s);return}this.final(s);return}
  if(g.st=='f'){this.fres(s);gWait(g,25,'F',1);return}
  if(g.st=='F'){g.over=1}},
 resolve(s){const g=s.game,ch={},rec={grp:g.grp.map(x=>[...x]),mk:{...g.mk},ch:{},msg:{...g.msg},gain:{}},pub=[];
  const C=(a,b)=>(g.ch[a]||{})[b]||'G';const tr={},tie=g.tie||[];g.tr=g.tr||{};
  /* lien connu (déclaré par l'hôte) : leur face-à-face vaut la moyenne des autres face-à-face de la manche, et leur lien
     ne compte que si la majorité des autres duos a partagé → se connaître ne rapporte ni plus ni moins */
  let fs=0,fn=0,pp=0,pn=0;g.grp.forEach(x=>{for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){const a=x[i],b=x[j],k=mkPair(a,b);if(tie.includes(k))continue;
   const pc=g.pc[k]||0,ca=C(a,b),cb=C(b,a);fs+=this.pay(ca,cb,pc)+this.pay(cb,ca,pc);fn+=2;pn++;if(ca=='P'&&cb=='P')pp++}});
  const avg=fn?fs/fn:3,link=pn?pp*2>=pn:true;
  g.grp.forEach(x=>{const tot={},nb={};x.forEach(p=>{tot[p]=0;nb[p]=0});
   for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){const a=x[i],b=x[j],k=mkPair(a,b),pc=g.pc[k]||0;
    if(tie.includes(k)){tot[a]+=avg;tot[b]+=avg;g.tm[a]=g.tm[b]=1;if(link&&!g.mt[k])[a,b].forEach(p=>{g.net[p]=(g.net[p]||0)+1;nb[p]+=this.nbf(g.net[p],s.order.length)});g.mt[k]=(g.mt[k]||0)+1;continue}
    const ca=C(a,b),cb=C(b,a);tot[a]+=this.pay(ca,cb,pc);tot[b]+=this.pay(cb,ca,pc);
    if(ca!=cb){const t=ca=='G'?a:b,u=t==a?b:a;if(!g.tr[u])tr[t]=1}/* garder face à un 🦈 ne marque pas */
    if(ca=='P'&&cb=='P'){if(pc)g.hab[a]=g.hab[b]=1;g.pc[k]=pc+1;if(!pc)[a,b].forEach(p=>{g.net[p]=(g.net[p]||0)+1;nb[p]+=this.nbf(g.net[p],s.order.length)})}g.mt[k]=(g.mt[k]||0)+1}
   x.forEach(p=>{const v=Math.round((tot[p]/(x.length-1)+nb[p])*2)/2;g.gain[p]=v;g.nb[p]=nb[p];g.sc[p]+=v;rec.gain[p]=v;const m={};x.forEach(q=>{if(q!=p)m[q]=C(p,q)});rec.ch[p]=m;const mv=Object.values(m);ch[p]=mv.every(c=>c=='P')?'P':mv.every(c=>c=='G')?'G':'M'});
   pub.push(shuf(x).map(p=>[g.mk[p],ch[p],g.gain[p]]))});
  for(const p in tr)g.tr[p]=(g.tr[p]||0)+1;/* réputation : nb de manches où ce joueur a gardé face à quelqu'un qui partageait */
  g.h.push(rec);g.pub.push(shuf(pub))},
 final(s){const g=s.game;if(this.MKC)for(const p in g.tr||{})g.sc[p]-=this.MKC*g.tr[p];/* chaque 🦈 coûte à la fin */const so=shuf(s.order).sort((a,b)=>g.sc[b]-g.sc[a]),fin=[so[0],so.slice(1).find(p=>!(g.tie||[]).includes(mkPair(so[0],p)))||so[1]];/* ex æquo : tirage au sort (symétrique) */
  g.fin=fin;g.pot=this.POT;g.fc={};g.bet={};delete g.grp;g.mk={};gWait(g,90,'f')},
 fres(s){const g=s.game,c={};g.fin.forEach(p=>c[p]=g.fc[p]||'V');const st=g.fin.filter(p=>c[p]=='V'),out=st.length==0?0:st.length==1?1:2,add={};
  g.fin.forEach(p=>add[p]=out==0?Math.floor(g.pot/g.fin.length):out==1?(c[p]=='V'?Math.max(0,g.pot-this.SHK*((g.tr||{})[p]||0)):0):(c[p]=='V'?-g.pot/2:0));
  s.order.forEach(p=>{if(!g.fin.includes(p))add[p]=g.bet[p]===out?this.BET:0});for(const p in add)g.sc[p]+=add[p];g.fr={c,out,add}},
 hide(g,n,s){const o={...g};delete o.grp;delete o.mk;delete o.h;delete o.pc;delete o.mt;delete o.msg;delete o.ch;delete o.gain;
  o.sc={[n]:g.sc[n]};o.n=0;/* nombre de manches caché (4 à 6) */const gr=(g.grp||[]).find(x=>x.includes(n))||[],pt=gr.filter(p=>p!=n);
  o.me={m:g.mk?g.mk[n]:null,pt:pt.map(p=>g.mk[p]),ptr:pt.map(p=>(g.tr||{})[p]||0),mtr:(g.tr||{})[n]||0,msg:g.msg?g.msg[n]:null,ch:pt.map(p=>((g.ch||{})[n]||{})[p]||null)};delete o.tr;
  if(g.st=='c'||g.st=='r')o.me.pm=pt.map(p=>g.msg[p]||'');
  if(g.st=='r'){o.me.pc=pt.map(p=>(g.ch[p]||{})[n]||'G');o.me.gain=g.gain[n];o.me.nb=(g.nb||{})[n]||0;o.me.ch=o.me.ch.map(c=>c||'G');o.me.hab=(g.hab||{})[n]||0;o.me.tm=(g.tm||{})[n]||0}delete o.nb;delete o.net;delete o.hab;delete o.tm;delete o.tie;o.tie=(g.tie||[]).filter(k=>k.split('|').includes(n)).length?1:0;
  if(g.fin)o.ftr=g.fin.map(p=>(g.tr||{})[p]||0);if(g.st=='f'){o.fc=hideOwn(g.fc,n);o.bet=hideOwn(g.bet,n)}return o},
 mn(i){return `<span class="mkm"><span class="mke">${MKE[i]||'❔'}</span> ${esc(GL('mkn')[i]||'')}</span>`},
 view(s){const g=s.game,m=meN(),me=g.me||{},R=GAMES.msk;
  const sh=v=>v?`<span class="mksh" title="${esc(GT('mshT'))}">🦈${v>1?'×'+v:''}</span>`:'',duo=me.pt&&me.pt.length?me.pt.map((i,j)=>R.mn(i)+sh((me.ptr||[])[j])).join(''):'';
  const head=g.st=='m'||g.st=='c'||g.st=='r'?`<div class="mkhd"><span class="mkme ga">${GT('ymask')} ${R.mn(me.m)}${sh(me.mtr)}</span><span class="mkvs ga" ${dl(1)}>${GT(me.pt.length>1?'ytrio':'yduo')} ${duo}</span></div>`:'';
  if(g.st=='m'){const pq=g.q[g.r];
   if(g.done[m]&&R.ed!==g.k)return{html:`<div class="card c">${head}<div class="mkbub mine ga" ${dl(2)}>${me.msg?esc(me.msg):`<i class="mut">${GT('mnone')}</i>`}</div><p class="gnote ga" ${dl(3)}>${GT('msent')}</p><button class="ghost mked" id="gedit">✏️ ${GT('medit')}</button></div>`,
    bind(){$('#gedit').onclick=()=>{R.ed=g.k;drafts['gmw'+g.k]=me.msg||'';render()}}};
   return{html:`<div class="card c">${head}${pq?`<p class="mktip ga" ${dl(2)}>💡 ${esc(GC('msk',pq))}</p>`:''}<textarea data-d="gmw${g.k}" rows="3" maxlength="140" placeholder="${esc(GT('mph'))}"></textarea>
    <div class="gbtns2"><button class="ghost" id="gskip">${GT('mskip')}</button><button class="pri" id="gsend">${GT('send')}</button></div></div>`,
    bind(){const t=$(`[data-d="gmw${g.k}"]`);$('#gsend').onclick=()=>{R.ed=null;gs({w:tidy(t.value)})};$('#gskip').onclick=()=>{R.ed=null;gs({w:''})}}}}
  const msgs=(me.pm||[]).map((x,i)=>`<div class="mkbub ga" ${dl(i+2)}><span class="mkfrom">${MKE[me.pt[i]]}</span>${x?esc(x):`<i class="mut">${GT('mnone')}</i>`}</div>`).join('');
  if(g.st=='c')return{html:`<div class="card c">${head}<p class="gq2">${GT('mread')}</p>${msgs}
   ${me.pt.length>1?me.pt.map((t,j)=>`<div class="mkrow ga" ${dl(j+3)}><span class="mkto">${R.mn(t)}${sh((me.ptr||[])[j])}</span><div class="gpk mkch sm">${['P','G'].map(v=>`<button class="gdec ${(me.ch||[])[j]==v?'sel':''}" data-gm="${v}" data-to="${t}">${GT('k'+v)}</button>`).join('')}</div></div>`).join(''):`<div class="gpk mkch">${['P','G'].map((v,i)=>`<button class="ga gdec ${(me.ch||[])[0]==v?'sel':''}" ${dl(i,.3)} data-gm="${v}">${GT('k'+v)}</button>`).join('')}</div>`}
   ${(me.ptr||[]).some(Boolean)?`<p class="mut mkshd">🦈 ${GT('mshD')}</p>`:''}</div>`,
   bind(){$$('[data-gm]').forEach(x=>x.onclick=()=>gs(x.dataset.to!=null?{v:x.dataset.gm,to:+x.dataset.to}:{v:x.dataset.gm}))}};
  if(g.st=='r'){const sea=(g.pub[g.r]||[]).map((gr,i)=>`<div class="mksea ga" ${dl(i,.4)}>${gr.map(([k,c,v])=>`<span class="mkc ${c=='P'?'p':'g'} ${k===me.m?'me':''}">${MKE[k]} ${c=='P'?'🤝':'🔒'} <b>+${v}</b></span>`).join('')}</div>`).join('');
   const rep=me.hab;
   return{html:`<div class="card c">${head}<div class="mkres">${(me.pc||[]).map((c,i)=>`<p class="ga" ${dl(i+1)}>${MKE[me.pt[i]]} ${GT(c=='P'?'mshared':'mkept')}${me.pt.length>1?` <span class="mut">· ${esc(GT('me'))} ${me.ch[i]=='P'?'🤝':'🔒'}</span>`:''}</p>`).join('')}
    <p class="gbig2 ga ${me.gain>=4?'ok':''}" ${dl(3)}>+${me.gain}</p>${me.nb?`<p class="mknet ga" ${dl(4)}>🕸️ ${GT('mnet',{v:me.nb})}</p>`:''}${rep?`<p class="mut ga" ${dl(4)}>🔁 ${GT('mrep')}</p>`:''}${me.tm?`<p class="mut ga" ${dl(4)}>🔗 ${GT('mtieM')}</p>`:''}${me.mtr?`<p class="mut ga" ${dl(5)}>${sh(me.mtr)} ${GT('myshk',{v:me.mtr})}</p>`:''}<p class="gcof">🔒 ${GT('mtot',{v:g.sc[m]??0})}</p></div>
    <h3 class="gh3">🌊 ${GT('msea')}</h3>${sea}</div>`,bind(){if(me.gain>=4&&!RM())sparkles($('.mkres .gbig2'),me.nb?14:8)}}}
  const fin=g.fin||[],isF=fin.includes(m),names=fin.map((p,i)=>NM(p)+((g.ftr||[])[i]?' 🦈'+(g.ftr[i]>1?'×'+g.ftr[i]:''):'')).join(' & ');
  if(g.st=='f'){const top=`<div class="mkfin ga"><span class="gbig">🎭</span><b>${GT('mfinT')}</b><p>${GT('mfinD',{n:names,v:g.pot})}</p><p class="mut">${GT('mfinC')}</p></div>`;
   if(isF)return{html:`<div class="card c">${top}<div class="gpk mkch">${['P','V'].map((v,i)=>`<button class="ga gdec ${g.fc[m]==v?'sel':''}" ${dl(i,.3)} data-gf="${v}">${GT('k'+v)}</button>`).join('')}</div><p class="gcof">🔒 ${GT('mtot',{v:g.sc[m]??0})}</p></div>`,
    bind(){$$('[data-gf]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gf}))}};
   return{html:`<div class="card c">${top}<p class="gq2">${GT('mbet')}</p><div class="gab">${[0,1,2].map(i=>`<button class="gopt ga ${g.bet[m]===i?'sel':''}" ${dl(i,.3)} data-gb="${i}">${GT('mb'+i)}</button>`).join('')}</div></div>`,
    bind(){$$('[data-gb]').forEach(x=>x.onclick=()=>gs({b:+x.dataset.gb}))}}}
  const fr=g.fr||{c:{},add:{}};
  return{html:`<div class="card c"><div class="mkfin"><b>${GT('mfinT')}</b></div><div class="gduo mkduo">${fin.map((p,i)=>`<div class="ga" ${dl(i*2,.1)}>${DT(p)}<b>${esc(p)}</b><br><span class="gtag ${fr.c[p]=='P'?'':'no'}">${GT('k'+fr.c[p])}</span><br><b>+${fr.add[p]||0}</b></div>`).join('')}</div>
   <p class="gbig2 ga ok" ${dl(4)}>${GT('mb'+fr.out)}</p>${isF?'':`<p class="gnote ga" ${dl(5)}>${g.bet[m]===fr.out?GT('mbetok'):'—'}</p>`}</div>`,
   bind(){if(fr.out==0&&!RM())sparkles($('.mkduo'),16)}}},
 endView(s){const g=s.game,o=s.order,n=o.length,W=220,cx=110,cy=110,rr=82,pos={};o.forEach((p,i)=>{const a=2*Math.PI*i/n-Math.PI/2;pos[p]=[cx+rr*Math.cos(a),cy+rr*Math.sin(a)]});
  const E={};(g.h||[]).forEach(r=>r.grp.forEach(x=>{for(let i=0;i<x.length;i++)for(let j=i+1;j<x.length;j++){const a=x[i],b=x[j],k=mkPair(a,b),e=E[k]=E[k]||{a:a<b?a:b,b:a<b?b:a,pp:0,gg:0,t:{}};
   const ca=(r.ch[a]||{})[b]||'G',cb=(r.ch[b]||{})[a]||'G';if(ca=='P'&&cb=='P')e.pp++;else if(ca=='G'&&cb=='G')e.gg++;else{const tr=ca=='G'?a:b;e.t[tr]=(e.t[tr]||0)+1}}}));
  const f=v=>v.toFixed(1);let svg=`<svg class="mkcst" viewBox="0 0 ${W} ${W}" role="img" aria-label="${esc(GT('mconst'))}"><defs><marker id="mkar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--bad)"/></marker></defs>`;
  const ln=(a,b,cl,off,mk)=>{const [x1,y1]=pos[a],[x2,y2]=pos[b],dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*off,ny=dx/L*off,sh=14/L;
   return `<line class="${cl}" x1="${f(x1+dx*sh+nx)}" y1="${f(y1+dy*sh+ny)}" x2="${f(x2-dx*sh+nx)}" y2="${f(y2-dy*sh+ny)}"${mk?' marker-end="url(#mkar)"':''}/>`};
  let li=0;for(const k in E){const e=E[k];const d=li++*.08;
   if(e.pp)svg+=`<g class="mkl" style="animation-delay:${d.toFixed(2)}s">${ln(e.a,e.b,'pp',0)}</g>`;
   else if(!Object.keys(e.t).length&&e.gg)svg+=`<g class="mkl" style="animation-delay:${d.toFixed(2)}s">${ln(e.a,e.b,'gg',0)}</g>`;
   for(const t in e.t)svg+=`<g class="mkl" style="animation-delay:${d.toFixed(2)}s">${ln(t,t==e.a?e.b:e.a,'tr',t==e.a?3:-3,1)}</g>`}
  o.forEach(p=>{const [x,y]=pos[p];svg+=`<circle cx="${f(x)}" cy="${f(y)}" r="9" style="fill:${col(p)}"/><text class="mkn" x="${f(x)}" y="${f(y+(y<cy?-14:20))}">${esc(p)}</text>`});
  svg+='</svg>';
  const tr=o.map(p=>{const v=[];for(const k in E){const e=E[k];if(e.t[p])v.push(e.a==p?e.b:e.a)}return [p,v]}).filter(x=>x[1].length);
  return `<h3 class="gh3">✨ ${GT('mconst')}</h3>${svg}<p class="mut arclg">${GT('mlegend')}</p>${tr.length?`<div class="mktr">${tr.map(([p,v],i)=>`<p class="ga" ${dl(i,.4)}>${B(p)} ${GT('mbetr')} ${v.map(B).join(', ')}</p>`).join('')}</div>`:`<p class="gnote">${GT('mnobetr')}</p>`}`},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🧭 LA CHAÎNE DES PHARES — fiche (rôles cachés, 4-8 joueurs, sans élimination ni nuit)
   Rôles secrets : 1 Naufrageur (4-5 joueurs) ou 2 (6-8, ils se connaissent) ; les autres sont gardiens de phare.
   Vague : un capitaine (tour à tour, départ tiré au sort) reçoit le bon chenal parmi 4 (🐚⭐🌙🐋). Il le transmet EN
     PRIVÉ à qui il veut, qui le relaie à son tour (2 relais à 4-7 joueurs, 3 à 8) ; le dernier guide le navire.
     Chaque relais choisit le chenal qu'il transmet : un Naufrageur peut le changer… ou pas, pour rester crédible.
     35 s par relais (sans choix : il transmet ce qu'il a reçu, à quelqu'un au hasard).
   Public : la route (qui a relayé, dans quel ordre), le bon chenal et celui pris par le navire (arrivé ou coulé).
     Privé : ce que chacun a reçu/transmis. On débat dans le chat (affirmations invérifiables).
   ⛓️ Entre deux vagues, vote (45 s) : la majorité absolue des joueurs en ligne met un suspect aux fers (ou l'en libère
     en votant « personne ») ; il joue toujours, mais ce qu'il reçoit et transmet devient public.
   Fin : 6 vagues (4-5 joueurs) ou 7 (6-8), ou dès que l'issue est jouée. Les Naufrageurs gagnent à 2 navires coulés (4-5 joueurs) ou 3 (6-8).
     Puis accusation secrète (60 s, autant de noms que de Naufrageurs). Points : équipage gagnant +4 chacun,
     Naufrageurs gagnants +6 chacun, et chaque gardien +2 par Naufrageur bien accusé.
   SIM (.sim/chn.js, hors site, 1500 parties/cas ; gardiens « prudents » = inférence bayésienne sur leurs propres relais et
     ceux du joueur aux fers, évitent les suspects, votent et accusent les plus probables ; « hasard » ; Naufrageurs agressif /
     malin (ne brouille pas après un complice, se calme s'il est trop suspect) / timide (1 fois sur 2)) : sièges ±6 % (bruit).
     Victoire des Naufrageurs n=4→8, contre gardiens prudents : malin 37/30/56/38/47 %, agressif 39/35/74/43/39 %,
     timide 32/23/34/23/30 % ; moitié prudents moitié hasard : 75/52/77/61/80 % ; tout hasard : 83–94 %.
     Gardiens prudents : 63–92 % d'accusations justes. Rejetés : 3 coulés à 4-5 joueurs (0–10 %), 3 relais à 6-7 (82 % / 66 %).
   ===================================================================== */
const CHI=['🐚','⭐','🌙','🐋'];
GAMES.chn={icon:'🧭',min:4,max:8,dur:20,tags:['social'],CHI,NF:n=>n<=5?1:2,RL:n=>n<=7?2:3,WV:n=>n<=5?6:7,TH:n=>n<=5?2:3,CW:4,NW:6,AC:2,
 init(s){const g=s.game,o=s.order;g.nf=shuf(o).slice(0,this.NF(o.length));g.K=g.nf.length;g.n=this.WV(o.length);g.th=this.TH(o.length);
  g.r=0;g.sk=0;g.ok=0;g.irn=null;g.h=[];g.pv={};o.forEach(p=>g.pv[p]=[]);g.c0=Math.floor(Math.random()*o.length);g.lv=null;this.wave(s)},
 wave(s){const g=s.game,o=s.order,on=gOn(s);let cap=o[(g.c0+g.r)%o.length];
  for(let i=0;i<o.length&&!on.includes(cap);i++)cap=o[(g.c0+g.r+i)%o.length];
  g.route=[cap];g.tr=Math.floor(Math.random()*4);g.rc={[cap]:g.tr};g.ps={};g.hold=cap;g.nx=null;this.turn(s)},
 elig(s){const g=s.game;return gOn(s).filter(p=>!g.route.includes(p))},
 pilot(s){return s.game.route.length>=this.RL(s.order.length)+1||!this.elig(s).length},
 turn(s){const g=s.game;gWait(g,35,'p');g.need=[g.hold]},
 act(s,from,a){const g=s.game;
  if(g.st=='p'&&from==g.hold&&[0,1,2,3].includes(a.c)){const pl=this.pilot(s);if(!pl&&!this.elig(s).includes(a.to))return;g.ps[from]=a.c;g.nx=pl?null:a.to;g.done[from]=1;return true}
  if(g.st=='v'&&(a.v===''||(s.order.includes(a.v)&&a.v!=from))){g.vt[from]=a.v;g.done[from]=1;return true}
  if(g.st=='a'&&Array.isArray(a.v)){g.acc[from]=[...new Set(a.v)].filter(p=>s.order.includes(p)&&p!=from).slice(0,g.K);g.done[from]=1;return true}},
 next(s){const g=s.game;
  if(g.st=='p'){const h=g.hold;if(g.ps[h]==null)g.ps[h]=g.rc[h];
   if(!this.pilot(s)){const E=this.elig(s);if(!E.includes(g.nx))g.nx=E[Math.floor(Math.random()*E.length)];
    const nx=g.nx;g.route.push(nx);g.rc[nx]=g.ps[h];g.hold=nx;g.nx=null;return this.turn(s)}
   return this.land(s)}
  if(g.st=='v'){this.irons(s);g.r++;return this.wave(s)}
  if(g.st=='a'){this.score(s);g.over=1}},
 land(s){const g=s.game,f=g.ps[g.hold],ok=f===g.tr,ir=g.irn&&g.route.includes(g.irn)?g.irn:null;
  if(ok)g.ok++;else g.sk++;
  g.h.push({route:[...g.route],tr:g.tr,f,ok,ir,ip:ir?[g.rc[ir],g.ps[ir]]:null,all:g.route.map(p=>[g.rc[p],g.ps[p]])});
  g.route.forEach(p=>g.pv[p].push([g.r,g.rc[p],g.ps[p]]));g.hold=null;
  const left=g.n-g.r-1;if(g.sk>=g.th||g.sk+left<g.th||left<=0){g.acc={};g.n=g.r+1;gWait(g,60,'a')}else{g.vt={};gWait(g,45,'v')}},
 /* majorité absolue des joueurs en ligne : fers à ce joueur (ou libération si « personne ») ; sinon rien ne change */
 irons(s){const g=s.game,c={},need=Math.floor(gOn(s).length/2)+1;for(const p in g.vt){const v=g.vt[p]??'';c[v]=(c[v]||0)+1}
  const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>=need)g.irn=top[0]||null;g.lv={c,irn:g.irn}},
 score(s){const g=s.game,nw=g.sk>=g.th;g.win=nw?'n':'c';g.ac={};
  s.order.forEach(p=>{let v=0;if(g.nf.includes(p)){if(nw)v=this.NW}else{const a=(g.acc[p]||[]).filter(x=>g.nf.includes(x)).length;g.ac[p]=a;v=(nw?0:this.CW)+this.AC*a}g.sc[p]+=v})},
 hide(g,n,s){const o={...g},vis=p=>p==n||p==g.irn;o.nf=g.nf.includes(n)?g.nf:null;delete o.tr;
  o.rc={};o.ps={};for(const p in g.rc)if(vis(p))o.rc[p]=g.rc[p];for(const p in g.ps)if(vis(p))o.ps[p]=g.ps[p];
  if(n!=g.hold)delete o.nx;o.h=g.h.map(w=>({...w,all:null}));o.pv={[n]:g.pv[n]};
  if(g.vt)o.vt=hideOwn(g.vt,n);if(g.acc)o.acc=hideOwn(g.acc,n);delete o.ac;delete o.win;return o},
 ch(i,cl){return i==null?'<span class="chc q">?</span>':`<span class="chc ${cl||''}">${CHI[i]}</span>`},
 /* route : capitaine 🧭 puis gardiens 🗼 ; kn(p,i) = [reçu, transmis] connus de moi (moi, ou le joueur aux fers) */
 chain(route,hold,kn){const R=this,m=meN();return `<div class="chrt">${route.map((p,i)=>{const k=kn(p,i);
  return `${i?'<i class="charr" aria-hidden="true">➜</i>':''}<span class="chn ga ${p==hold?'on':''} ${p==m?'me':''}" ${dl(i)}>${DT(p)}<b>${p==m?esc(GT('me')):esc(p)}</b>${k?`<span class="chk">${R.ch(k[0])}<i>›</i>${R.ch(k[1],k[1]!=null&&k[0]!=k[1]?'x':'')}</span>`:''}</span>`}).join('')}</div>`},
 log(g,m){const R=this,mine={};((g.pv||{})[m]||[]).forEach(([w,a,b])=>mine[w]=[a,b]);
  return g.h.length?`<details class="chlog"><summary>📜 ${GT('chLog')} (${g.h.length})</summary>${g.h.map((w,i)=>`<div class="chlr"><b>${w.ok?'⛵':'💥'} ${i+1}</b> ${w.route.map((p,j)=>esc(p)+(mine[i]&&p==m?` ${R.ch(mine[i][0])}›${R.ch(mine[i][1])}`:w.ir==p&&w.ip?` ⛓️${R.ch(w.ip[0])}›${R.ch(w.ip[1],w.ip[0]!=w.ip[1]?'x':'')}`:'')).join(' <i class="charr">➜</i> ')}</div>`).join('')}</details>`:''},
 view(s){const g=s.game,m=meN(),R=GAMES.chn,N=!!(g.nf&&g.nf.includes(m));
  const hd=`<div class="chhd"><span class="chrole ga ${N?'n':''}">${N?'🏴‍☠️ '+GT('chN'):'🗼 '+GT('chC')}${N&&g.nf.length>1?' · '+g.nf.filter(p=>p!=m).map(B).join(', '):''}</span>
   <span class="chsk ga" ${dl(1)} title="${esc(GT('chSkT',{v:g.th}))}">💥 ${g.sk}/${g.th} · ⛵ ${g.ok}</span>${g.irn?`<span class="chir ga" ${dl(2)}>⛓️ ${B(g.irn)}</span>`:''}</div>`;
  const kn=(rc,ps)=>p=>p in rc||p in ps?[rc[p],ps[p]]:null;
  if(g.st=='p'){const me=m==g.hold,cap=g.route[0]==m;
   if(!me)return{html:`<div class="card c">${hd}${R.chain(g.route,g.hold,kn(g.rc,g.ps))}<p class="gnote ga" ${dl(2)}>${GT(g.route.length==1?'chWaitC':'chWait',{n:B(g.hold)})}</p>${g.lv&&g.route.length==1?R.lvote(g):''}${R.log(g,m)}</div>`};
   const pl=R.pilot(s),E=pl?[]:R.elig(s),rc=g.rc[m],K='ch'+g.k;if(R.sk!==K){R.sk=K;R.sc=rc;R.st=null}
   const ready=R.sc!=null&&(pl||E.includes(R.st));
   return{html:`<div class="card c">${hd}${R.chain(g.route,g.hold,kn(g.rc,g.ps))}<p class="gq2 ga">${GT(cap?'chCap':'chGot')} ${R.ch(rc,'big')}</p>
    ${N?`<p class="chtip ga" ${dl(1)}>🏴‍☠️ ${GT('chNtip')}</p>`:''}<p class="gsub">${GT(pl?'chPilot':'chPass')}</p>
    <div class="gpk chpk">${CHI.map((x,i)=>`<button class="ga chb ${R.sc==i?'sel':''}" ${dl(i,.2)} data-chc="${i}" aria-pressed="${R.sc==i}">${x}</button>`).join('')}</div>
    ${pl?'':`<p class="gsub">${GT('chTo')}</p>${pick(E,R.st,'data-cht',m)}`}<button class="pri wide" id="gsend" ${ready?'':'disabled'}>${GT(pl?'chSail':'send')}</button></div>`,
    bind(){$$('[data-chc]').forEach(b=>b.onclick=()=>{R.sc=+b.dataset.chc;render()});$$('[data-cht]').forEach(b=>b.onclick=()=>{R.st=b.dataset.cht;render()});
     $('#gsend').onclick=()=>{if(R.sc==null)return;gs(pl?{c:R.sc}:{c:R.sc,to:R.st})}}}}
  const w=g.h[g.h.length-1]||{route:[]},mine=((g.pv||{})[m]||[]).find(x=>x[0]==g.h.length-1),
   wk=p=>p==m&&mine?[mine[1],mine[2]]:p==w.ir&&w.ip?w.ip:null;
  const res=`<div class="chres ${w.ok?'ok':'ko'}"><div class="chsea" aria-hidden="true"><span class="chship ${w.ok?'ok':'ko'}">⛵</span>${w.ok?'':'<span class="chboom">💥</span>'}</div>
   <p class="gbig2 ga ${w.ok?'ok':''}" ${dl(1,.6)}>${GT(w.ok?'chOk':'chKo')}</p><p class="mut ga" ${dl(2,.6)}>${GT('chTr')} ${R.ch(w.tr)} · ${GT('chF')} ${R.ch(w.f,w.ok?'':'x')}</p></div>`;
  const body=`${hd}${res}${R.chain(w.route,null,wk)}`;
  if(g.st=='v'){const v=g.vt[m];
   return{html:`<div class="card c">${body}<p class="gq2">⛓️ ${GT('chVote')}</p><p class="gsub">${GT('chVoteD')}</p>${pick(s.order,v,'data-chv',m)}
    <button class="ghost wide chno ${v===''?'sel':''}" data-chv="">${GT(g.irn?'chFree':'chNone')}</button>${R.log(g,m)}</div>`,
    bind(){$$('[data-chv]').forEach(b=>b.onclick=()=>gs({v:b.dataset.chv}));if(!w.ok&&!RM())try{$('.chres').classList.add('shk')}catch(e){}}}}
  const K='ca'+g.k;if(R.ak!==K){R.ak=K;R.ac=[...(g.acc[m]||[])]}
  const sent=g.acc[m]!=null&&g.done[m];
  return{html:`<div class="card c">${body}<p class="gq2">🕵️ ${GT('chAcc',{v:g.K})}</p><p class="gsub">${GT(N?'chAccN':'chAccD')}</p>
   <div class="gpk">${s.order.filter(p=>p!=m).map((p,i)=>`<button class="ga ${R.ac.includes(p)?'sel':''}" ${dl(i)} data-cha="${esc(p)}" aria-pressed="${R.ac.includes(p)}">${DT(p)}<span>${esc(p)}</span></button>`).join('')}</div>
   <button class="pri wide" id="gsend">${GT(sent?'chAccOk':'send')}</button>${R.log(g,m)}</div>`,
   bind(){$$('[data-cha]').forEach(b=>b.onclick=()=>{const p=b.dataset.cha;R.ac=R.ac.includes(p)?R.ac.filter(x=>x!=p):[...R.ac,p].slice(-g.K);render()});
    $('#gsend').onclick=()=>gs({v:R.ac})}}},
 lvote(g){const e=Object.entries(g.lv.c||{}).sort((a,b)=>b[1]-a[1]);if(!e.length)return '';
  return `<p class="mut chlv ga" ${dl(3)}>🗳️ ${e.map(([p,v])=>`${p?B(p):esc(GT('chNoneS'))} ×${v}`).join(' · ')}</p>`},
 endView(s){const g=s.game,R=this,nw=g.win=='n';
  return `<div class="chend"><p class="gbig2 ga ok">${GT(nw?'chWinN':'chWinC',{v:g.sk})}</p><p class="ga" ${dl(1)}>🏴‍☠️ ${GT('chWere')} ${g.nf.map(B).join(', ')}</p>
   ${s.order.filter(p=>!g.nf.includes(p)).map((p,i)=>`<p class="mut ga" ${dl(i+2)}>${B(p)} 🕵️ ${(g.acc[p]||[]).length?(g.acc[p]).map(x=>esc(x)+(g.nf.includes(x)?' ✅':' ❌')).join(', '):'—'}</p>`).join('')}
   <h3 class="gh3">📜 ${GT('chLog')}</h3>${g.h.map((w,i)=>`<div class="chlr ga" ${dl(i,.4)}><b>${w.ok?'⛵':'💥'} ${i+1}</b> ${R.ch(w.tr)} : ${w.route.map((p,j)=>{const a=w.all&&w.all[j]||[];return `${esc(p)} ${R.ch(a[1],a[0]!=a[1]?'x':'')}`}).join(' <i class="charr">➜</i> ')}</div>`).join('')}</div>`},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   📖 TUTORIELS ANIMÉS — une mini-démo scriptée par jeu (pièces factices qui bougent, étape par étape).
   Ouvert par le « ? » du haut (contexte : jeu en cours, ou jeu choisi au salon) et par « Les règles en images » au salon.
   Scène = 300×180 (coordonnées px), éléments .te animés en transform/opacity seulement ; mouvement réduit : état final fixe.
   Chaque étape rejoue sa scène en boucle tant qu'on ne passe pas à la suite ; on ne ferme que par « J'ai compris ».
   ===================================================================== */
const TU={c:['#ef8354','#2fa894','#9b7be8','#d9a520'],
 n:()=>{const v=String(GT('tun')||'Ana|Ben|Cléo|Dan').split('|');return v.length>3?v:['Ana','Ben','Cléo','Dan']},
 w:()=>String(GT('tuw')||'').split('|'),
 /* élément positionné : x,y en px de scène ; c = a (apparaît) | p (pop) | m (glisse depuis --x/--y) | o (disparaît à --o) | k (secousse) */
 e(x,y,h,d,c,st){return `<div class="te ${c||'a'}" style="left:${(x/3).toFixed(2)}%;top:${(y/1.8).toFixed(2)}%;--d:${d||0}s;${st||''}"><span>${h}</span></div>`},
 /* glisse de (x0,y0) vers (x,y) */
 mv(x0,y0,x,y,h,d,c,st){return TU.e(x,y,h,d,'m '+(c||''),`--x:${x0-x}px;--y:${y0-y}px;${st||''}`)},
 av(i,lab){const n=TU.n()[i]||'?';return `<b class="tav" style="--c:${TU.c[i]}">${esc([...n][0])}</b>${lab===false?'':`<small class="tnm">${esc(n)}</small>`}`},
 pt(v,cl){return `<b class="tpt ${cl||''}">${v}</b>`},
 cd(h,cl){return `<i class="tcd ${cl||''}">${h}</i>`},
 dot(i){return `<i class="tdot" style="--c:${TU.c[i]}"></i>`},
 bt(i){return `<i class="tbt" style="--c:${TU.c[i]}">⛵</i>`}};
/* hexagones de l'Archipel en miniature : centre + 1 anneau */
const TUH=[[150,90],[195,90],[172.5,51],[127.5,51],[105,90],[127.5,129],[172.5,129]];
const tuHex=(dead,hl)=>`<svg class="tub" viewBox="0 0 300 180">${TUH.map(([x,y],i)=>{const p=[0,1,2,3,4,5].map(k=>{const a=Math.PI/180*(60*k-30);return (x+25*Math.cos(a)).toFixed(1)+','+(y+25*Math.sin(a)).toFixed(1)}).join(' ');
 return `<polygon points="${p}" class="${i?'r1':'c0'}${dead&&i?' tdead':''}${hl===i?' thl':''}"/>`}).join('')}</svg>`;
const TUS={
 bot:[
  {k:'tu_bot1',s:()=>[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))+TU.e(60+90*i,104,'✉️',.3+.25*i,'p')+TU.mv(60+90*i,104,150,40,'✉️',1.3+.2*i,'o','--op0:0;--o:'+(1.9+.2*i)+'s')).join('')+TU.e(150,40,'🍾',1,'p big')},
  {k:'tu_bot2',s:()=>TU.e(150,30,'🍾',0,'a big')+TU.e(150,78,TU.cd('🗼 💤'),.5,'p')+[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))+TU.e(60+90*i,112,'❓',1.1+.15*i,'p')).join('')},
  {k:'tu_bot3',s:()=>TU.e(150,30,TU.cd('🗼 💤'))+[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))).join('')+TU.mv(60,150,140,108,TU.dot(0),.4)+TU.mv(240,150,160,108,TU.dot(2),.8)+TU.e(150,78,'✅',1.5,'p')+TU.e(60,104,TU.pt('+2'),1.9,'p')+TU.e(240,104,TU.pt('+2'),2,'p')},
  {k:'tu_bot4',x:'n',s:()=>TU.e(80,40,TU.cd('🔍 ❌❌❌'),.2,'p')+TU.e(80,95,TU.av(1,false),.2)+TU.e(80,140,TU.pt('+3'),.9,'p')+TU.e(220,40,TU.cd('🔍 ✅❌❌'),1.3,'p')+TU.e(220,95,TU.av(1,false),1.3)+TU.e(220,140,TU.pt('+1'),1.9,'p')},
  {k:'tu_bot5',x:'2',s:()=>[0,1].map(i=>TU.e(80+140*i,150,TU.av(i))+[0,1,2].map(j=>TU.e(48+140*i+32*j,104,TU.cd(j==2?'🎭':'✅'),.3+.2*j+.6*i,'p')).join('')).join('')+TU.e(80,62,TU.pt('+2'),2,'p')+TU.e(220,62,TU.pt('+2'),2.3,'p')}],
 pha:[
  {k:'tu_pha1',s:()=>TU.e(40,95,'🗼',0,'a big')+TU.e(55,95,'<i class="tbeam"></i>',.3)+TU.e(205,95,TU.cd('❓🏝️'),.7,'p')},
  {k:'tu_pha2',x:'n',s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+TU.mv(45,150,185,98,TU.dot(0),.3)+TU.mv(115,150,45,98,TU.dot(1),.5)+TU.mv(185,150,185,84,TU.dot(2),.7)+TU.mv(255,150,185,70,TU.dot(3),.9)},
  {k:'tu_pha3',x:'n',s:()=>TU.e(30,30,'🗼')+TU.e(38,32,'<i class="tbeam sm"></i>',.2)+[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+TU.e(185,98,TU.dot(0))+TU.e(45,98,TU.dot(1))+TU.e(185,84,TU.dot(2))+TU.e(185,70,TU.dot(3))+[0,2,3].map((i,j)=>TU.e(45+70*i,118,TU.pt('+1'),1+.2*j,'p')).join('')},
  {k:'tu_pha4',x:'2',s:()=>TU.e(90,140,TU.av(0))+TU.e(210,140,TU.av(1))+TU.mv(90,140,210,96,TU.dot(0),.3)+TU.e(90,60,TU.cd('🔮 '+TU.dot(1)),1,'p')+TU.mv(210,140,210,82,TU.dot(1),1.6)+TU.e(90,96,TU.pt('+1'),2.3,'p')}],
 vag:[
  {k:'tu_vag1',s:()=>TU.e(150,36,TU.cd(esc(TU.w()[0]||'')),0,'p')+[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))+TU.e(60+90*i,108,'✏️',.6+.2*i,'p')).join('')},
  {k:'tu_vag2',x:'n',s:()=>TU.e(150,30,TU.cd(esc(TU.w()[0]||'')))+[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))+TU.e(60+90*i,102,TU.cd(esc(TU.w()[i<2?1:2]||'')),.3+.3*i,'p')).join('')},
  {k:'tu_vag3',x:'n',s:()=>TU.e(150,30,TU.cd(esc(TU.w()[0]||'')))+[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))+TU.e(60+90*i,102,TU.cd(esc(TU.w()[i<2?1:2]||''),i<2?'ok':''))).join('')+TU.e(105,102,'🔗',.4,'p')+TU.e(60,66,TU.pt('+2'),.9,'p')+TU.e(150,66,TU.pt('+2'),1,'p')+TU.e(240,66,TU.pt('0','no'),1.3,'p')},
  {k:'tu_vag4',x:'2',s:()=>TU.e(80,150,TU.av(0))+TU.e(220,150,TU.av(1))+TU.e(80,104,TU.cd(esc(TU.w()[1]||'')),.2,'p')+TU.e(220,104,TU.cd(esc(TU.w()[2]||'')),.4,'p')+TU.e(150,50,TU.cd('🌉 '+esc(TU.w()[3]||''),'ok'),1.2,'p')+TU.e(150,86,TU.pt('+1'),1.9,'p')}],
 rad:[
  {k:'tu_rad1',s:()=>TU.e(80,85,TU.cd('🐬','big'),.2,'p')+TU.e(150,85,'⚖️',.5,'p')+TU.e(220,85,TU.cd('🕊️','big'),.8,'p')},
  {k:'tu_rad2',x:'n',s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))+TU.e(45+70*i,104,TU.cd('🤫'),.3+.15*i,'p')+TU.e(45+70*i,62,'🎯',1.2+.15*i,'p')).join('')},
  {k:'tu_rad3',x:'n',s:()=>TU.e(150,24,TU.cd('🐬 3 – 1 🕊️'),0,'p')+[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))+TU.e(45+70*i,104,TU.cd(i<3?'🐬':'🕊️'),.3)+TU.e(45+70*i,64,TU.pt(i<3?'+1':'+2'),1+.2*i,'p')).join('')},
  {k:'tu_rad4',x:'2',s:()=>TU.e(90,150,TU.av(0))+TU.e(210,150,TU.av(1))+TU.e(90,104,TU.cd('🐬'),.2,'p')+TU.e(90,60,TU.cd('🔮 🕊️'),.7,'p')+TU.e(210,104,TU.cd('🕊️'),1.4,'p')+TU.e(150,60,TU.pt('+1'),2,'p')}],
 pec:[
  {k:'tu_pec1',d:6,s:()=>`<i class="tsea"></i>`+TU.e(150,40,'👜',0,'p big')+['🦪','🦪','🦪','🦪','🦪','🪼','🪼','🦈','🦈','🦈','🦈','🦈'].map((x,i)=>TU.e(40+20*i,92,x,.5+.12*i,'p')).join('')+[0,1,2].map(i=>TU.mv(75+75*i,0,75+75*i,150,TU.av(i,false),2+.2*i)).join('')},
  {k:'tu_pec2',s:()=>`<i class="tsea"></i>`+TU.e(30,28,'👜')+TU.mv(30,28,150,48,'🦪<sub>3</sub>',.2)+[0,1,2].map(i=>TU.e(75+75*i,125,TU.av(i,false))+TU.e(75+75*i,160,TU.cd('🕸️ 0'),0,'o','--o:1.2s')+TU.e(75+75*i,160,TU.cd('🕸️ 3','ok'),1.2+.15*i,'p')).join('')},
  {k:'tu_pec3',s:()=>`<i class="tsea"></i>`+TU.e(268,22,'🧰')+[0,2].map(i=>TU.e(75+75*i,125,TU.av(i,false))+TU.e(75+75*i,160,TU.cd('🕸️ 3'))+TU.e(75+75*i,92,'🤿',1.6,'p')).join('')+TU.mv(150,125,150,22,TU.av(1,false),.4)+TU.e(150,160,TU.cd('🕸️ 3'),0,'o','--o:.9s')+TU.mv(150,160,268,48,TU.cd('3','ok'),1,'','--op0:0')},
  {k:'tu_pec4',d:6,s:()=>`<i class="tsea"></i>`+TU.e(150,22,TU.av(1,false))+TU.e(268,22,'🧰')+TU.e(268,48,TU.cd('3','ok'))+TU.e(110,60,'🦈',.2,'p')+TU.e(110,84,TU.pt('1/2','no'),.5,'p')+TU.e(190,60,'🦈',1.8,'p k')+[0,2].map(i=>TU.e(75+75*i,125,TU.av(i,false))+TU.e(75+75*i,160,TU.cd('🕸️ 7'),0,'o','--o:2.4s')+TU.e(75+75*i,160,TU.cd('🕸️ 0','no'),2.5,'p')).join('')},
  {k:'tu_pec5',s:()=>`<i class="tsea"></i>`+TU.e(75,125,TU.av(0,false))+TU.e(225,125,TU.av(2,false))+TU.e(75,160,TU.cd('🕸️ 8'),0,'o','--o:1.4s')+TU.e(75,160,TU.cd('🕸️ 4','no'),1.5,'p')+TU.e(225,160,TU.cd('🕸️ 5'))+TU.mv(150,40,75,92,'🪼',.3)+TU.e(122,92,TU.pt('−½','no'),1.5,'p')},
  {k:'tu_pec6',s:()=>`<i class="tsea"></i>`+TU.e(75,22,TU.av(0,false))+TU.e(150,22,TU.av(1,false))+TU.e(225,125,TU.av(2,false))+TU.mv(150,40,225,80,'🦪<sub>4</sub>',.3)+TU.e(268,80,TU.pt('×2'),1,'p')+TU.e(225,160,TU.cd('🕸️ 5'),0,'o','--o:1.5s')+TU.e(225,160,TU.cd('🕸️ 13','ok'),1.6,'p')},
  {k:'tu_pec7',s:()=>[0,1,2].map(i=>TU.e(75+75*i,140,TU.av(i))+TU.e(75+75*i,90,'🧰',.2+.2*i,'p')+TU.e(75+75*i,58,TU.pt([12,9,15][i]),.9+.3*i,'p')).join('')+TU.e(225,26,'👑',2,'p')},
  {k:'tu_pec8',x:'2',s:()=>`<i class="tsea"></i>`+TU.e(110,125,TU.av(0,false))+TU.mv(190,0,190,125,'🐟',.2,'big')+TU.e(190,160,TU.cd('🕸️ 8'),1,'p')+TU.mv(190,125,190,24,'🐟',1.8,'big')}],
 arc:[
  {k:'tu_arc1',s:()=>tuHex()+TU.e(105,90,TU.bt(0),.4,'p')+TU.e(195,90,TU.bt(1),.6,'p')+TU.e(105,64,TU.av(0,false),.8,'p sm')+TU.e(195,64,TU.av(1,false),.9,'p sm')},
  {k:'tu_arc2',s:()=>tuHex()+TU.e(105,90,TU.bt(0))+TU.e(195,90,TU.bt(1))+TU.e(40,40,TU.cd('🂠'),.2,'p')+TU.e(260,40,TU.cd('🂠'),.4,'p')+TU.e(40,40,TU.cd('↗️','ok'),1.5,'p')+TU.e(260,40,TU.cd('🏝️','ok'),1.7,'p')+TU.e(150,160,'⏳',.8,'p')},
  {k:'tu_arc3',s:()=>tuHex(0,3)+TU.e(127.5,51,'<i class="tring"></i>',.2,'p')+TU.mv(105,90,127.5,51,TU.bt(0),1)+TU.e(127.5,24,TU.av(0,false),1.6,'p sm')},
  {k:'tu_arc4',s:()=>tuHex()+TU.e(127.5,56,'🏝️',.8,'p')+TU.e(127.5,44,TU.bt(0))+TU.e(127.5,18,TU.av(0,false),0,'a sm')},
  {k:'tu_arc5',d:6,s:()=>tuHex()+TU.e(172.5,56,'🏝️',0,'o','--o:2.6s')+TU.e(172.5,56,'🌊',2.7,'p')+TU.e(172.5,44,TU.bt(0))+TU.e(172.5,18,TU.av(0,false),0,'a sm')+TU.e(195,90,TU.bt(1),0,'o','--o:1.6s')+TU.mv(195,90,172.5,129,TU.bt(1),1.6,'','--op0:0')+TU.e(212,70,'🛡️',.4,'p o','--o:1.6s')+TU.e(150,160,TU.pt('💥','no'),2.7,'p')},
  {k:'tu_arc6',s:()=>tuHex(0,0)+TU.e(105,90,TU.bt(0),0,'a k2')+TU.e(195,90,TU.bt(1),0,'a k2')+TU.mv(115,90,138,90,'➡️',.3)+TU.mv(185,90,162,90,'⬅️',.3)+TU.e(150,90,'💥',1.2,'p big')},
  {k:'tu_arc7',d:6,s:()=>tuHex(1)+TU.e(150,92,'🏝️')+TU.e(195,92,'🏝️',0,'o','--o:2.4s')+TU.e(150,66,TU.pt('+3'),.4,'p')+TU.e(195,66,TU.pt('+2'),.7,'p')+TU.e(127.5,103,TU.pt('+2'),1,'p')+TU.e(127.5,129,'🏝️',0,'o','--o:2.4s')+TU.e(150,165,'🌊 🌊 🌊',2.2,'p')}],
 msk:[
  {k:'tu_msk1',s:()=>TU.e(150,145,TU.av(0))+TU.e(150,112,'🎭',.3,'p')+TU.e(80,50,'🐙',.8,'p big')+TU.e(220,50,'🦀',1.1,'p big')+TU.e(80,86,'?',1.3,'p')+TU.e(220,86,'?',1.4,'p')},
  {k:'tu_msk2',s:()=>TU.e(150,145,TU.av(0))+TU.e(150,40,'🐙',0,'a big')+TU.mv(150,120,150,78,TU.cd('💬 …'),.3)+TU.e(100,110,TU.cd('🤝'),1.3,'p')+TU.e(200,110,TU.cd('🔒'),1.5,'p')},
  {k:'tu_msk3',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🤝'),.2,'p')+TU.e(220,130,TU.cd('🤝'),.4,'p')+TU.e(80,40,TU.pt('+4'),1,'p')+TU.e(220,40,TU.pt('+4'),1.1,'p')+TU.e(150,80,'🔗',1.5,'p big')},
  {k:'tu_msk4',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🤝'),.2,'p')+TU.e(220,130,TU.cd('🔒'),.4,'p')+TU.e(80,40,TU.pt('+1','no'),1,'p')+TU.e(220,40,TU.pt('+4'),1.1,'p')+TU.e(252,62,'🦈',1.7,'p')},
  {k:'tu_msk5',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(112,62,'🦈')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🔒'),.2,'p')+TU.e(220,130,TU.cd('🔒'),.4,'p')+TU.e(80,40,TU.pt('+2'),1,'p')+TU.e(220,40,TU.pt('+2'),1.1,'p')+TU.e(258,62,'✓',1.7,'p')},
  {k:'tu_msk6',d:7,s:()=>TU.e(70,140,TU.av(0))+TU.e(230,140,TU.av(1))+TU.e(150,40,TU.cd('16','ok'),0,'p')+
   [['🤝','🤝','+8','+8',.3,1.9],['🗡️','🤝','+16','0',2.1,3.7],['🗡️','🗡️','−8','−8',3.9,0]].map(([a,b,x,y,d,o])=>{const O=o?'p o':'p';return TU.e(70,100,TU.cd(a),d,O,'--o:'+o+'s')+TU.e(230,100,TU.cd(b),d+.1,O,'--o:'+o+'s')+TU.e(70,72,TU.pt(x,x[0]=='−'?'no':''),d+.6,O,'--o:'+o+'s')+TU.e(230,72,TU.pt(y,y[0]=='−'||y=='0'?'no':''),d+.7,O,'--o:'+o+'s')}).join('')}]};
/* 🧭 tutoriel de La Chaîne des Phares */
TUS.chn=[
 {k:'tu_chn1',s:()=>[0,1,2].map(i=>TU.e(60+90*i,145,TU.av(i))).join('')+TU.e(60,40,'🧭',0,'p big')+TU.e(60,98,TU.cd('⭐','ok'),.4,'p o','--o:1.6s')+TU.mv(60,98,150,98,TU.cd('⭐'),1.5,'','--op0:0')},
 {k:'tu_chn2',d:6,s:()=>[0,1,2].map(i=>TU.e(60+90*i,145,TU.av(i))).join('')+TU.e(150,98,TU.cd('⭐'),0,'a o','--o:1.2s')+TU.mv(150,98,240,98,TU.cd('🌙','no'),1.2,'','--op0:0')+TU.e(240,52,'🏴‍☠️ ❓',2.2,'p')},
 {k:'tu_chn3',d:6,s:()=>`<i class="tsea"></i>`+TU.e(150,46,'⛵',.2,'p big o','--o:1.8s')+TU.e(150,46,'💥',1.8,'p big')+TU.e(150,96,TU.cd('⭐ ≠ 🌙','no'),1,'p')+TU.e(150,150,TU.cd(TU.n().slice(0,3).map(esc).join(' <i class="charr">➜</i> ')),2.4,'p')},
 {k:'tu_chn4',d:6,s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+[0,1,3].map((i,j)=>TU.e(45+70*i,108,'✋',.3+.25*j,'p')).join('')+TU.e(185,104,'⛓️',1.6,'p big')+TU.e(185,56,TU.cd('🌙 › 🌙'),2.4,'p')},
 {k:'tu_chn5',d:6,s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+TU.e(45,108,'🕵️',.3,'p')+TU.e(115,108,'🕵️',.5,'p')+TU.e(255,108,'🏴‍☠️',1.5,'p big')+TU.e(45,66,TU.pt('+2'),2.1,'p')+TU.e(115,66,TU.pt('+2'),2.2,'p')+TU.e(185,66,TU.pt('+2'),2.3,'p')}];

for(const id in TUS)if(GAMES[id])GAMES[id].tut=TUS[id];
const GTU={id:null,i:0,t:null};
W.GTut=function(id){const G=GAMES[id];if(!G||!G.tut||typeof document=='undefined')return false;
 const nOn=(()=>{try{return st&&st.phase=='game'&&st.order?st.order.length:st.players.filter(p=>p.online).length}catch(e){return 3}})();
 const L=G.tut.filter(x=>!x.x||(x.x=='2'?nOn==2:nOn!=2));GTU.id=id;GTU.i=0;
 const box=$('#modal');if(!box)return false;
 box.innerHTML=`<div class="modal gtu" role="dialog" aria-modal="true" aria-label="${esc(GT('n_'+id))}"><div class="card"><div class="tuh"><span>${G.icon}</span><b>${GT('n_'+id)}</b></div>
  <div class="tus" aria-hidden="true"></div><p class="tucap" aria-live="polite"></p><div class="steps">${L.map((_,j)=>`<i data-s="${j}"></i>`).join('')}</div>
  <div class="row"><button class="ghost" id="tuag"></button><button class="pri" id="tunx"></button></div></div></div>`;
 const nm=TU.n(),tw=TU.w(),V={a:nm[0],b:nm[1],c:nm[2],d:nm[3],w0:tw[0],w1:tw[1],w2:tw[2],w3:tw[3]};
 const show=j=>{clearTimeout(GTU.t);GTU.i=j;const S=L[j],stg=$('.gtu .tus');if(!stg)return;
  stg.innerHTML=`<div class="tusc">${S.s()}</div>`;$('.gtu .tucap').innerHTML=esc(GT(S.k,V));
  $$('.gtu .steps i').forEach((el,k)=>el.className=k==j?'on':k<j?'done':'');
  const last=j==L.length-1;$('#tunx').textContent=last?GT('tuOk'):T('next');$('#tuag').textContent=last&&L.length>1?'↺ '+GT('tuAll'):'↺ '+GT('tuAgain');
  if(!RM())GTU.t=setTimeout(()=>{if($('.gtu')&&GTU.i==j)show(j)},(S.d||5)*1000)};/* la scène rejoue en boucle */
 const close=()=>{clearTimeout(GTU.t);const m=$('.gtu');if(!m)return;m.classList.add('closing');setTimeout(()=>{if($('.gtu'))$('#modal').textContent=''},240)};
 $$('.gtu .steps i').forEach(el=>el.onclick=()=>show(+el.dataset.s));
 $('#tuag').onclick=()=>show(GTU.i==L.length-1&&L.length>1?0:GTU.i);
 $('#tunx').onclick=()=>GTU.i<L.length-1?show(GTU.i+1):close();
 show(0);return true};
/* @games : « ? » contextuel — dans un jeu (ou un jeu choisi au salon) il ouvre la démo de ce jeu, sinon le tutoriel de l'Expédition */
W.GHelp=function(){try{const id=(st.phase=='game'||st.phase=='gend')&&st.game?st.game.id:st.phase=='lobby'?st.gsel:null;return id?W.GTut(id):false}catch(e){return false}};
if(typeof document!='undefined')document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-gtut]');if(t)W.GTut(t.dataset.gtut)});

/* ---------- styles (injectés) ---------- */
if(typeof document!='undefined'){const c=document.createElement('style');c.id='games-css';c.textContent=`
.gw{--gease:cubic-bezier(.22,1,.36,1)}
.ghd{display:flex;align-items:center;gap:8px;font:600 19px Fredoka,Nunito,sans-serif;margin:8px 4px 8px;color:var(--deep)}
.ghd .gic{font-size:26px;line-height:1}.ghd .gstop{margin-inline-start:6px;width:30px;height:30px;padding:0;border-radius:50%;font-size:13px;line-height:1;box-shadow:0 2px 0 var(--edge2);color:var(--mut)}.ghd .grd+.gstop{margin-inline-start:6px}.ghd b+.gstop{margin-inline-start:auto}.ghd .grd{margin-inline-start:auto;font:800 13px Nunito;color:var(--mut);background:var(--paper);border:2px solid var(--edge);border-radius:99px;padding:2px 10px}
.gsab{height:6px;border-radius:9px;background:var(--edge);overflow:hidden;margin:0 4px 10px}
.gsab i{display:block;height:100%;background:linear-gradient(90deg,var(--ink),var(--gold));transform-origin:left;animation-name:gsab;animation-timing-function:linear;animation-fill-mode:both}
[dir=rtl] .gsab i{transform-origin:right}

.gedit{display:block;margin:10px auto 0;padding:6px 16px;border-radius:99px;font-size:14px}
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
/* entre deux étapes : l'en-tête et la carte restent, seul le contenu se renouvelle (plus d'écran vide pendant le fondu) */
section>.gw.gnx{animation:none}.gw.gnx>.card{animation:gstep .28s var(--gease) both}.still .gw.gnx>.card{animation:none}
@keyframes gstep{from{opacity:.55}}
/* 🏝️ Archipel */
.arcsc{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 8px}.arcsc .gchip b{font-size:14px}.arcsc .gchip i{font-style:normal;font-size:12px}
.arcst{font:700 14px Nunito;color:var(--mut);margin:0 0 4px;text-align:center}.arcst b{color:var(--deep)}.arcst .arccx{color:var(--bad)}
.arcmy{font:700 15px Nunito;margin:6px 0 0;text-align:center;min-height:1.4em}.arclg{font-size:12px;text-align:center;margin:4px 0 0}
.arcb{display:block;width:100%;max-width:500px;margin:2px auto 0;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overflow:visible}
.arcb .h{stroke:var(--paper);stroke-width:.9;stroke-linejoin:round}
.arcb .r0{fill:#3f9fb2}.arcb .r1{fill:#62b7c5}.arcb .r2{fill:#8fcfd7}.arcb .r3{fill:#b9e4e8}
.arcb .dead{fill:var(--paper);fill-opacity:.12;stroke:var(--mut);stroke-opacity:.55;stroke-width:.6;stroke-dasharray:1.6 1.4}.arcb .gl.sm{font-size:3.8px}
.arcb .sink{opacity:0;animation:arcsink 1.2s ease both}@keyframes arcsink{from{opacity:1}}
.arcb text{text-anchor:middle;dominant-baseline:central;pointer-events:none}
.arcb .v{font:800 3.4px Nunito,sans-serif;fill:#fff;opacity:.75}
.arcb .isl{stroke:#fff;stroke-width:1;stroke-linejoin:round}
.arcb .iv{font:900 3.5px Nunito,sans-serif;fill:#fff;paint-order:stroke;stroke:#0005;stroke-width:.6}
.arcb .rk circle{fill:#56656c;stroke:#2f3b40;stroke-width:.5}.arcb .mf{opacity:.85}
.arcb .bt circle{stroke:#fff;stroke-width:1}.arcb .bt text{font:900 3.4px Nunito,sans-serif;fill:#fff}
.arcb .bt.me circle{stroke:var(--txt);stroke-width:1.1}.arcb .bt0{stroke:#fff;stroke-width:1;opacity:.95}
.arcb .tg{fill:transparent;stroke:var(--acc);stroke-width:1;stroke-dasharray:2.2 1.6;cursor:pointer;transition:fill .15s}
.arcb .tg:hover{fill:#ff8a3d22}.arcb .tg.on{fill:#ff8a3d40;stroke-dasharray:none;stroke-width:1.5}
.arcb .gl{font-size:4.6px;opacity:.8}.arcb .gl.on{opacity:1}
.arcb .cx{font:900 5px Nunito,sans-serif;fill:var(--bad);opacity:.9;transform-box:fill-box;transform-origin:center;animation:arcpop .4s var(--gease) .5s both}
.arcb .mv{animation:arcmv .75s var(--gease) both}@keyframes arcmv{from{transform:translate(var(--dx),var(--dy))}}
.arcb .pop{transform-box:fill-box;transform-origin:center;animation:arcpop .45s var(--gease) .45s both}@keyframes arcpop{from{transform:scale(.3);opacity:0}}
.arcb .gone{opacity:0;transform-box:fill-box;transform-origin:center;animation:arcgone 1s ease .35s both}@keyframes arcgone{from{opacity:1;transform:none}to{opacity:0;transform:scale(.5)}}
.still .arcb *{animation:none!important}
[data-theme=dark] .arcb .r0{fill:#2a7f97}[data-theme=dark] .arcb .r1{fill:#21627a}[data-theme=dark] .arcb .r2{fill:#1b4e66}[data-theme=dark] .arcb .r3{fill:#163f55}
[data-theme=dark] .arcb .v{fill:#bfe6ee;opacity:.7}[data-theme=dark] .arcb .isl{stroke:#e9f6f8}[data-theme=dark] .arcb .rk circle{fill:#8d9ea6;stroke:#53646b}
[data-theme=dark] .arcb .tg.on{fill:#ff8a3d55}
/* 🎭 Les Masques */
.mksh{display:inline-block;margin-inline-start:4px;padding:0 5px;border-radius:9px;font-size:.82em;background:color-mix(in srgb,var(--bad) 16%,transparent);white-space:nowrap}.mkrow{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:8px 0}.mkto{font-weight:600}.mkch.sm{margin:0;gap:6px}.mkch.sm .gdec{padding:8px 12px;font-size:14px;min-width:0}.mkshd{font-size:13px;margin-top:8px}.gties{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.gtie{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:14px;background:var(--paper2)}.gtx{min-width:0;padding:2px 8px;font-size:12px}.gtiep{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.gtiep button{min-width:0;padding:6px 12px}.gtiep button.sel{box-shadow:inset 0 0 0 2px var(--acc)}
.mkhd{display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:center;margin:0 0 10px;font:700 14px Nunito;color:var(--mut)}
.mkme,.mkvs{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:var(--paper2);border:2px solid var(--edge)}
.mkvs{border-color:var(--acc2);flex-wrap:wrap;justify-content:center;border-radius:18px}.mkhd .mke{font-size:20px;line-height:1}.mkm{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;color:var(--txt)}
.mktip{font:700 14px Nunito;color:var(--deep);margin:0 0 8px;text-align:center}
.g-msk textarea{width:100%;box-sizing:border-box;min-height:76px}
.gbtns2{display:flex;gap:8px;margin-top:8px}.gbtns2 button{flex:1}
.mkbub{position:relative;text-align:start;background:var(--paper2);border:2px solid var(--edge);border-radius:18px 18px 18px 6px;padding:10px 14px 10px 46px;margin:8px 0;font:600 16px/1.4 Nunito;overflow-wrap:anywhere;min-height:24px}
[dir=rtl] .mkbub{padding:10px 46px 10px 14px;border-radius:18px 18px 6px 18px}
.mkbub.mine{padding:12px 14px;border-radius:18px 18px 6px 18px;border-color:var(--acc2);text-align:center}
.mkfrom{position:absolute;inset-inline-start:10px;top:8px;font-size:24px;line-height:1}
.mked{margin-top:10px;font-size:14px;padding:6px 14px}
.mkch{margin-top:14px}.mkch>button{flex:1 1 40%}
.mkres p{margin:4px 0;font:700 16px Nunito}.mknet{color:var(--ink)}
.mksea{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0;padding:6px;border-radius:14px;background:var(--paper2)}
.mkc{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font:700 14px Nunito;background:var(--paper);border:2px solid var(--edge)}
.mkc.p{border-color:#8fd8bd}.mkc.g{border-color:#f3b88c}.mkc.me{outline:2px solid var(--acc);outline-offset:1px}.mkc b{font-size:13px}
.mkfin{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font:600 19px Fredoka,Nunito}.mkfin p{margin:0;font:600 15px/1.4 Nunito}
.mkcst{display:block;width:100%;max-width:300px;margin:4px auto 0;overflow:visible}
.mkcst line{stroke-width:2.2;stroke-linecap:round}.mkcst .pp{stroke:var(--ink)}.mkcst .gg{stroke:var(--mut);stroke-dasharray:3 4;opacity:.6}.mkcst .tr{stroke:var(--bad)}
.mkcst circle{stroke:var(--paper);stroke-width:2.5}.mkcst .mkn{font:800 10px Nunito,sans-serif;fill:var(--txt);text-anchor:middle;dominant-baseline:central}
.mkl{animation:fi .5s ease both}.still .mkl{animation:none}
.mktr p{margin:4px 0;font:600 14px Nunito;text-align:center}
[data-theme=dark] .mkc.p{border-color:#2c7a62}[data-theme=dark] .mkc.g{border-color:#7a4a2a}
/* 📖 tutoriels animés */
.gtu .tuh{display:flex;align-items:center;justify-content:center;gap:8px;font-size:18px;margin-bottom:10px}.gtu .tuh span{font-size:26px}
.gtu .tus{position:relative;width:min(300px,100%);aspect-ratio:300/180;margin:0 auto;border-radius:18px;overflow:hidden;background:var(--paper2);box-shadow:inset 0 0 0 2px var(--edge)}
.gtu .tusc{position:absolute;inset:0}
.gtu .tucap{min-height:3.2em;margin:12px 4px 0;font-size:15px;line-height:1.4}
.gtu .row{display:flex;gap:10px;justify-content:center}.gtu .row button{flex:1}
.te{position:absolute;width:0;height:0}.te>span{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:inline-flex;flex-direction:column;align-items:center;gap:1px;font-size:22px;line-height:1;white-space:nowrap}
.te.big>span{font-size:36px}.te.sm>span{font-size:15px}
.tav{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--c);color:#fff;font-size:15px;box-shadow:0 2px 0 #0002}
.te.sm .tav{width:22px;height:22px;font-size:12px}
.tnm{font-size:11px;font-weight:600;color:var(--mut)}
.tpt{display:inline-block;padding:2px 8px;border-radius:10px;background:var(--ok,#2fa894);color:#fff;font-size:14px}.tpt.no{background:var(--bad)}
.tcd{display:inline-block;padding:5px 9px;border-radius:10px;background:var(--paper);box-shadow:0 0 0 1.5px var(--edge),0 3px 0 var(--edge);font-style:normal;font-size:15px;color:var(--txt)}
.tcd.big{font-size:30px;padding:8px 14px}.tcd.ok{box-shadow:0 0 0 2px var(--ok,#2fa894),0 3px 0 var(--edge)}.tcd.no{box-shadow:0 0 0 2px var(--bad),0 3px 0 var(--edge)}
.te sub{font-size:11px;font-weight:700}
.tbt{font-style:normal;display:inline-block;padding:0 2px 1px;border-bottom:4px solid var(--c);border-radius:3px;line-height:1.1}
.tdot{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px var(--paper)}
.tbeam{display:block;width:170px;height:34px;transform-origin:0 50%;margin-left:170px;background:linear-gradient(90deg,#ffe9a8cc,#ffe9a800);clip-path:polygon(0 40%,100% 0,100% 100%,0 60%)}
.tbeam.sm{width:165px;margin-left:165px;transform:rotate(19deg)}
.tring{display:block;width:44px;height:44px;border-radius:50%;box-shadow:0 0 0 3px var(--acc)}
.tsea{position:absolute;inset:38px 0 0;background:linear-gradient(180deg,#5fb7d433,#1f5f8a55)}
.tub{position:absolute;inset:0;width:100%;height:100%}.tub polygon{fill:#7ec4d955;stroke:var(--edge);stroke-width:1.5}.tub .c0{fill:#7ec4d999}.tub .thl{stroke:var(--acc);stroke-width:2.5}
.tub .tdead{animation:tuDead .6s 2.2s both}
.te.a{animation:tuIn .45s var(--d) both}.te.p{animation:tuPop .45s var(--d) both}.te.m{animation:tuMv .8s cubic-bezier(.4,0,.2,1) var(--d) both}
.te.o{animation:tuOut .35s var(--o) forwards}.te.p.o{animation:tuPop .45s var(--d) both,tuOut .35s var(--o) forwards}.te.m.o{animation:tuMv .8s cubic-bezier(.4,0,.2,1) var(--d) both,tuOut .35s var(--o) forwards}
.te.p.k{animation:tuPop .45s var(--d) both,tuShake .45s calc(var(--d) + .45s) 2}.te.k2{animation:tuShake .4s 1.2s 2}
@keyframes tuIn{from{opacity:0;transform:translateY(8px)}}
@keyframes tuPop{0%{opacity:0;transform:scale(.3)}70%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}
@keyframes tuMv{0%{transform:translate(var(--x),var(--y));opacity:var(--op0,1)}1%{opacity:1}100%{transform:none;opacity:1}}
@keyframes tuOut{to{opacity:0;transform:scale(.8)}}
@keyframes tuShake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes tuDead{to{opacity:.25}}
[data-theme=dark] .gtu .tus{background:#0b1c2d;box-shadow:inset 0 0 0 2px #26475f}[data-theme=dark] .tcd{background:#16324a;box-shadow:0 0 0 1.5px #2c5574,0 3px 0 #06121f}[data-theme=dark] .tub polygon{fill:#2d6a8a55;stroke:#2c5574}[data-theme=dark] .tub .c0{fill:#2d6a8aaa}
.gtutb{margin-top:10px}
@media (prefers-reduced-motion:reduce){.te,.te>span,.tub .tdead{animation:none!important}.te.o{display:none}.te.m{transform:none}}

/* 🧭 La Chaîne des Phares */
.chhd{display:flex;flex-wrap:wrap;gap:6px 8px;justify-content:center;margin:0 0 12px;font:700 14px Nunito}
.chrole,.chsk,.chir{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;background:var(--paper2);border:2px solid var(--edge);white-space:nowrap}
.chrole.n{border-color:var(--bad)}.chir{border-style:dashed}
.chrt{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 4px;margin:6px 0 12px}
.chn{position:relative;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:14px;background:var(--paper2);border:2px solid var(--edge);font:700 14px Nunito;max-width:100%}
.chn b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:9em}.chn.me{border-color:var(--acc2)}
.chn.on::after{content:'';position:absolute;inset:-5px;border-radius:18px;border:2px solid var(--acc);animation:chPulse 1.4s ease-in-out infinite;pointer-events:none}
@keyframes chPulse{0%,100%{opacity:.25;transform:scale(.97)}50%{opacity:1;transform:scale(1.03)}}
.charr{font-style:normal;color:var(--mut);font-size:13px}[dir=rtl] .charr{display:inline-block;transform:scaleX(-1)}
.chk{display:inline-flex;align-items:center;gap:2px}.chk i{font-style:normal;color:var(--mut)}
.chc{display:inline-block;line-height:1;font-size:18px;padding:2px 3px;border-radius:8px}.chc.big{font-size:30px;vertical-align:middle}
.chc.x{background:color-mix(in srgb,var(--bad) 22%,transparent);box-shadow:inset 0 0 0 2px var(--bad)}.chc.q{font:800 14px Nunito;color:var(--mut)}
.chtip{font:700 14px Nunito;color:var(--bad);margin:0 0 8px}
.chpk{margin:8px 0 10px}.gw .chpk>button.chb{flex:1 1 20%;font-size:28px;padding:10px 4px}
.chres{margin:4px 0 6px}.chsea{position:relative;height:56px;overflow:hidden;border-radius:16px;background:linear-gradient(180deg,transparent 58%,rgba(64,160,205,.35) 58%,rgba(40,110,160,.45))}
.chship{position:absolute;left:50%;top:6px;font-size:38px;line-height:1;margin-left:-19px}
.chship.ok{animation:chSail 1.1s var(--gease,ease) both}.chship.ko{animation:chSink 1.3s ease-in .2s both}
@keyframes chSail{from{transform:translateX(-120px);opacity:0}to{transform:none;opacity:1}}
@keyframes chSink{0%{transform:none;opacity:1}100%{transform:translateY(30px) rotate(28deg);opacity:.35}}
.chboom{position:absolute;left:50%;top:4px;margin-left:-20px;font-size:34px;line-height:1;animation:chBoom .45s var(--gease,ease) 1.1s both}@keyframes chBoom{from{transform:scale(.2);opacity:0}}
.chres.shk .chsea{animation:chShk .5s ease 1s both}@keyframes chShk{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.chno{margin-top:10px}.chlv{font-size:13px;margin-top:6px}
.chlog{margin-top:14px;text-align:start;font-size:13px}.chlog summary{cursor:pointer;font:700 14px Nunito;color:var(--mut)}
.chlr{padding:5px 0;border-top:1px dashed var(--edge);overflow-wrap:anywhere;line-height:1.7}.chlr .chc{font-size:15px}
.chend{text-align:start}.chend .gbig2{text-align:center}
@media (prefers-reduced-motion:reduce){.chn.on::after,.chship,.chres.shk .chsea,.chboom{animation:none!important}.chship.ko{transform:translateY(30px) rotate(28deg);opacity:.35}}

@media (max-width:420px){.grow2{flex-direction:column}.gq{font-size:19px}.gseed{font-size:26px}.gbr{grid-template-columns:minmax(0,7em) 1fr 1.6em}.gtf{width:78px}.gcamps{gap:6px}}
@media (prefers-reduced-motion:reduce){.gw .ga,.gw .gbar,.gfloat,.gev .gbig,.grx,.arcb *,.gw.gnx>.card,.mkl{animation:none!important}.gsab i{animation-duration:0s!important;display:none}}
`;(document.head||document.documentElement).appendChild(c)}

/* =====================================================================
   TEXTES — GI18N[lang] = {ui:{…}, pha, pha1, pha2, vag, vag1, vag2, rad, rad1, rad2}
   (listes '|' alignées par index ; dilemmes « A~B » ; réserve 1 = coquin, 2 = trash, 18+ entre adultes)
   ===================================================================== */
const GI18N=W.GI18N={};
GI18N.fr={ui:{edit:`Modifier`,stopAsk:`Arrêter ce jeu et voir les scores ?`,stop:`Arrêter`,room:`Salle de jeux`,exp:`Expédition`,expD:`Le voyage d'île en île`,play:`Jouer à {g}`,waitHost:`L'hôte lance la partie`,needP:`De {a} à {b} joueurs`,
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

GI18N.en={ui:{edit:`Edit`,stopAsk:`Stop this game and see the scores?`,stop:`Stop`,room:`Game room`,exp:`Expedition`,expD:`The island-hopping voyage`,play:`Play {g}`,waitHost:`The host starts the game`,needP:`{a} to {b} players`,
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

GI18N.es={ui:{edit:`Cambiar`,stopAsk:`¿Parar este juego y ver los puntos?`,stop:`Parar`,room:`Sala de juegos`,exp:`Expedición`,expD:`El viaje de isla en isla`,play:`Jugar a {g}`,waitHost:`El anfitrión inicia la partida`,needP:`De {a} a {b} jugadores`,
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

GI18N.it={ui:{edit:`Modifica`,stopAsk:`Fermare il gioco e vedere i punteggi?`,stop:`Ferma`,room:`Sala giochi`,exp:`Spedizione`,expD:`Il viaggio di isola in isola`,play:`Gioca a {g}`,waitHost:`L'host avvia la partita`,needP:`Da {a} a {b} giocatori`,
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

GI18N.de={ui:{edit:`Ändern`,stopAsk:`Spiel beenden und Punkte zeigen?`,stop:`Beenden`,room:`Spielesaal`,exp:`Expedition`,expD:`Die Reise von Insel zu Insel`,play:`{g} spielen`,waitHost:`Der Host startet das Spiel`,needP:`{a} bis {b} Spieler`,
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

GI18N.ru={ui:{edit:`Изменить`,stopAsk:`Остановить игру и показать очки?`,stop:`Остановить`,room:`Игровой зал`,exp:`Экспедиция`,expD:`Путешествие с острова на остров`,play:`Играть: {g}`,waitHost:`Хост запускает игру`,needP:`От {a} до {b} игроков`,
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

GI18N.zh={ui:{edit:`修改`,stopAsk:`结束本局并查看得分？`,stop:`结束`,room:`游戏厅`,exp:`远征`,expD:`一岛接一岛的旅程`,play:`开始：{g}`,waitHost:`房主开始游戏`,needP:`{a}–{b} 名玩家`,
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

GI18N.he={ui:{edit:`לשנות`,stopAsk:`לעצור את המשחק ולראות ניקוד?`,stop:`לעצור`,room:`חדר משחקים`,exp:`מסע`,expD:`המסע מאי לאי`,play:`לשחק ב{g}`,waitHost:`המארח מתחיל את המשחק`,needP:`{a} עד {b} שחקנים`,
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

GI18N.pt={ui:{edit:`Alterar`,stopAsk:`Parar o jogo e ver os pontos?`,stop:`Parar`,room:`Sala de jogos`,exp:`Expedição`,expD:`A viagem de ilha em ilha`,play:`Jogar {g}`,waitHost:`O anfitrião inicia a partida`,needP:`De {a} a {b} jogadores`,
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

/* =====================================================================
   TEXTES — vague 2 (Archipel…) : ajoutés aux tables ui de chaque langue
   ===================================================================== */
const GADD=(l,o)=>Object.assign(GI18N[l].ui,o);
GADD('fr',{n_arc:`Archipel`,d_arc:`Ordres secrets et simultanés : bâtis tes îlots avant la marée`,
r_arc:`Chaque tour, en secret : tape une case voisine pour naviguer, ou ta case pour y bâtir un îlot — ou pour couler l'îlot adverse où tu es, sauf si son bateau est dessus ou à côté. Deux ordres sur la même case s'annulent. Tous les 4 tours, chaque îlot rapporte ses perles (plus au centre), puis la marée engloutit le bord.`,
r_arc2:`Chaque tour, en secret : tape une case voisine pour naviguer, ou ta case pour y bâtir un îlot — ou pour couler l'îlot adverse où tu es, sauf si son bateau est dessus ou à côté. Deux ordres sur la même case s'annulent. Tous les 4 tours, chaque îlot rapporte ses perles (plus au centre), puis la marée engloutit le bord. À deux : petite mer, 8 tours.`,
asetup:`Tape une case du bord pour ton port ⚓, puis une case de l'anneau intérieur pour ton récif 🪨. Tout le monde choisit en même temps.`,
k_m:`⛵ Naviguer`,k_b:`🏝️ Bâtir ici`,k_r:`🌊 Couler cet îlot`,k_g:`🛡️ Rester`,k_p:`ton port`,k_f:`ton récif`,
atide:`Récolte dans {k} tours`,atide1:`Récolte à la fin de ce tour`,afin:`Dernière récolte dans {k} tours`,afin1:`Dernier tour : dernière récolte`,asunk:`la marée a englouti le bord`,acx:`ordres annulés (même case)`,
amine:`Ton ordre`,apick:`Tape une case entourée`,aharv:`Récolte`,afinal:`Dernière récolte`,atidec:`La marée monte : le bord va être englouti.`,abuilt:`îlots bâtis`,araid:`îlots coulés`});
GADD('en',{n_arc:`Archipelago`,d_arc:`Secret simultaneous orders: build your islets before the tide`,
r_arc:`Each turn, in secret: tap a neighbouring hex to sail, or your own hex to build an islet there — or to sink the rival islet you're on, unless its boat is on it or next to it. Two orders on the same hex cancel out. Every 4 turns each islet yields its pearls (more in the centre), then the tide swallows the edge.`,
r_arc2:`Each turn, in secret: tap a neighbouring hex to sail, or your own hex to build an islet there — or to sink the rival islet you're on, unless its boat is on it or next to it. Two orders on the same hex cancel out. Every 4 turns each islet yields its pearls (more in the centre), then the tide swallows the edge. For two: a smaller sea, 8 turns.`,
asetup:`Tap an edge hex for your harbour ⚓, then a hex of the inner ring for your reef 🪨. Everyone chooses at the same time.`,
k_m:`⛵ Sail`,k_b:`🏝️ Build here`,k_r:`🌊 Sink this islet`,k_g:`🛡️ Stay`,k_p:`your harbour`,k_f:`your reef`,
atide:`Harvest in {k} turns`,atide1:`Harvest at the end of this turn`,afin:`Last harvest in {k} turns`,afin1:`Last turn: final harvest`,asunk:`the tide swallowed the edge`,acx:`orders cancelled (same hex)`,
amine:`Your order`,apick:`Tap an outlined hex`,aharv:`Harvest`,afinal:`Final harvest`,atidec:`The tide is rising: the edge will be swallowed.`,abuilt:`islets built`,araid:`islets sunk`});
GADD('es',{n_arc:`Archipiélago`,d_arc:`Órdenes secretas y simultáneas: construye tus islotes antes de la marea`,
r_arc:`Cada turno, en secreto: toca una casilla vecina para navegar, o la tuya para construir un islote — o para hundir el islote rival donde estás, salvo si su barco está encima o al lado. Dos órdenes sobre la misma casilla se anulan. Cada 4 turnos, cada islote da sus perlas (más en el centro) y luego la marea se traga el borde.`,
r_arc2:`Cada turno, en secreto: toca una casilla vecina para navegar, o la tuya para construir un islote — o para hundir el islote rival donde estás, salvo si su barco está encima o al lado. Dos órdenes sobre la misma casilla se anulan. Cada 4 turnos, cada islote da sus perlas (más en el centro) y luego la marea se traga el borde. A dos: mar más pequeño, 8 turnos.`,
asetup:`Toca una casilla del borde para tu puerto ⚓ y luego una del anillo interior para tu arrecife 🪨. Todos eligen a la vez.`,
k_m:`⛵ Navegar`,k_b:`🏝️ Construir aquí`,k_r:`🌊 Hundir este islote`,k_g:`🛡️ Quedarse`,k_p:`tu puerto`,k_f:`tu arrecife`,
atide:`Cosecha en {k} turnos`,atide1:`Cosecha al final de este turno`,afin:`Última cosecha en {k} turnos`,afin1:`Último turno: cosecha final`,asunk:`la marea se tragó el borde`,acx:`órdenes anuladas (misma casilla)`,
amine:`Tu orden`,apick:`Toca una casilla marcada`,aharv:`Cosecha`,afinal:`Cosecha final`,atidec:`Sube la marea: el borde va a desaparecer.`,abuilt:`islotes construidos`,araid:`islotes hundidos`});
GADD('it',{n_arc:`Arcipelago`,d_arc:`Ordini segreti e simultanei: costruisci i tuoi isolotti prima della marea`,
r_arc:`A ogni turno, in segreto: tocca una casella vicina per navigare, o la tua per costruirci un isolotto — o per affondare l'isolotto avversario su cui sei, a meno che la sua barca sia sopra o accanto. Due ordini sulla stessa casella si annullano. Ogni 4 turni ogni isolotto rende le sue perle (di più al centro), poi la marea inghiotte il bordo.`,
r_arc2:`A ogni turno, in segreto: tocca una casella vicina per navigare, o la tua per costruirci un isolotto — o per affondare l'isolotto avversario su cui sei, a meno che la sua barca sia sopra o accanto. Due ordini sulla stessa casella si annullano. Ogni 4 turni ogni isolotto rende le sue perle (di più al centro), poi la marea inghiotte il bordo. In due: mare più piccolo, 8 turni.`,
asetup:`Tocca una casella del bordo per il tuo porto ⚓, poi una dell'anello interno per il tuo scoglio 🪨. Tutti scelgono insieme.`,
k_m:`⛵ Naviga`,k_b:`🏝️ Costruisci qui`,k_r:`🌊 Affonda l'isolotto`,k_g:`🛡️ Resta`,k_p:`il tuo porto`,k_f:`il tuo scoglio`,
atide:`Raccolto tra {k} turni`,atide1:`Raccolto alla fine di questo turno`,afin:`Ultimo raccolto tra {k} turni`,afin1:`Ultimo turno: raccolto finale`,asunk:`la marea ha inghiottito il bordo`,acx:`ordini annullati (stessa casella)`,
amine:`Il tuo ordine`,apick:`Tocca una casella evidenziata`,aharv:`Raccolto`,afinal:`Raccolto finale`,atidec:`La marea sale: il bordo verrà inghiottito.`,abuilt:`isolotti costruiti`,araid:`isolotti affondati`});
GADD('de',{n_arc:`Archipel`,d_arc:`Geheime, gleichzeitige Befehle: bau deine Inseln vor der Flut`,
r_arc:`Jede Runde geheim: tippe ein Nachbarfeld, um zu segeln, oder dein eigenes Feld, um dort eine Insel zu bauen — oder um die fremde Insel zu versenken, auf der du stehst, außer ihr Boot ist darauf oder daneben. Zwei Befehle auf dasselbe Feld heben sich auf. Alle 4 Runden bringt jede Insel ihre Perlen (mehr in der Mitte), dann verschluckt die Flut den Rand.`,
r_arc2:`Jede Runde geheim: tippe ein Nachbarfeld, um zu segeln, oder dein eigenes Feld, um dort eine Insel zu bauen — oder um die fremde Insel zu versenken, auf der du stehst, außer ihr Boot ist darauf oder daneben. Zwei Befehle auf dasselbe Feld heben sich auf. Alle 4 Runden bringt jede Insel ihre Perlen (mehr in der Mitte), dann verschluckt die Flut den Rand. Zu zweit: kleineres Meer, 8 Runden.`,
asetup:`Tippe ein Randfeld für deinen Hafen ⚓, dann ein Feld des inneren Rings für dein Riff 🪨. Alle wählen gleichzeitig.`,
k_m:`⛵ Segeln`,k_b:`🏝️ Hier bauen`,k_r:`🌊 Insel versenken`,k_g:`🛡️ Bleiben`,k_p:`dein Hafen`,k_f:`dein Riff`,
atide:`Ernte in {k} Runden`,atide1:`Ernte am Ende dieser Runde`,afin:`Letzte Ernte in {k} Runden`,afin1:`Letzte Runde: Schlussernte`,asunk:`die Flut hat den Rand verschluckt`,acx:`Befehle aufgehoben (gleiches Feld)`,
amine:`Dein Befehl`,apick:`Tippe ein markiertes Feld`,aharv:`Ernte`,afinal:`Schlussernte`,atidec:`Die Flut steigt: der Rand wird verschluckt.`,abuilt:`Inseln gebaut`,araid:`Inseln versenkt`});
GADD('ru',{n_arc:`Архипелаг`,d_arc:`Тайные одновременные приказы: строй острова до прилива`,
r_arc:`Каждый ход тайно: нажми соседнюю клетку, чтобы плыть, или свою — чтобы построить там остров или потопить чужой остров, на котором стоишь, если его лодка не на нём и не рядом. Два приказа на одну клетку отменяют друг друга. Каждые 4 хода каждый остров приносит жемчуг (в центре больше), затем прилив поглощает край.`,
r_arc2:`Каждый ход тайно: нажми соседнюю клетку, чтобы плыть, или свою — чтобы построить там остров или потопить чужой остров, на котором стоишь, если его лодка не на нём и не рядом. Два приказа на одну клетку отменяют друг друга. Каждые 4 хода каждый остров приносит жемчуг (в центре больше), затем прилив поглощает край. Вдвоём: море меньше, 8 ходов.`,
asetup:`Нажми клетку на краю для своей гавани ⚓, затем клетку внутреннего кольца для рифа 🪨. Все выбирают одновременно.`,
k_m:`⛵ Плыть`,k_b:`🏝️ Строить здесь`,k_r:`🌊 Потопить остров`,k_g:`🛡️ Остаться`,k_p:`твоя гавань`,k_f:`твой риф`,
atide:`Сбор через {k} хода`,atide1:`Сбор в конце этого хода`,afin:`Последний сбор через {k} хода`,afin1:`Последний ход: финальный сбор`,asunk:`прилив поглотил край`,acx:`приказы отменены (одна клетка)`,
amine:`Твой приказ`,apick:`Нажми выделенную клетку`,aharv:`Сбор жемчуга`,afinal:`Финальный сбор`,atidec:`Прилив поднимается: край уйдёт под воду.`,abuilt:`построено островов`,araid:`потоплено островов`});
GADD('zh',{n_arc:`群岛`,d_arc:`秘密同时下令：在潮水前建起你的小岛`,
r_arc:`每回合秘密行动：点相邻格航行，或点自己所在格建造小岛——或击沉你所在的对手小岛（除非它的船在岛上或旁边）。两个指令落在同一格会互相抵消。每4回合，每座小岛产出珍珠（越靠中心越多），然后潮水吞没最外圈。`,
r_arc2:`每回合秘密行动：点相邻格航行，或点自己所在格建造小岛——或击沉你所在的对手小岛（除非它的船在岛上或旁边）。两个指令落在同一格会互相抵消。每4回合，每座小岛产出珍珠（越靠中心越多），然后潮水吞没最外圈。两人时：海域更小，共8回合。`,
asetup:`点一个边缘格作为你的港口 ⚓，再点内圈的一格放置你的礁石 🪨。所有人同时选择。`,
k_m:`⛵ 航行`,k_b:`🏝️ 在此建造`,k_r:`🌊 击沉此岛`,k_g:`🛡️ 停留`,k_p:`你的港口`,k_f:`你的礁石`,
atide:`{k} 回合后收获`,atide1:`本回合结束时收获`,afin:`{k} 回合后最后收获`,afin1:`最后一回合：最终收获`,asunk:`潮水吞没了外圈`,acx:`指令被抵消（同一格）`,
amine:`你的指令`,apick:`点一个高亮的格子`,aharv:`收获`,afinal:`最终收获`,atidec:`潮水上涨：最外圈将被吞没。`,abuilt:`建造的小岛`,araid:`击沉的小岛`});
GADD('he',{n_arc:`ארכיפלג`,d_arc:`פקודות סודיות ובו־זמניות: בנו איים לפני הגאות`,
r_arc:`בכל תור, בסוד: הקישו על משבצת שכנה כדי להפליג, או על המשבצת שלכם כדי לבנות בה אי — או כדי להטביע את האי היריב שאתם עליו, אלא אם הסירה שלו עליו או לידו. שתי פקודות על אותה משבצת מבטלות זו את זו. כל 4 תורות כל אי מניב פנינים (יותר במרכז), ואז הגאות בולעת את השוליים.`,
r_arc2:`בכל תור, בסוד: הקישו על משבצת שכנה כדי להפליג, או על המשבצת שלכם כדי לבנות בה אי — או כדי להטביע את האי היריב שאתם עליו, אלא אם הסירה שלו עליו או לידו. שתי פקודות על אותה משבצת מבטלות זו את זו. כל 4 תורות כל אי מניב פנינים (יותר במרכז), ואז הגאות בולעת את השוליים. בשניים: ים קטן יותר, 8 תורות.`,
asetup:`הקישו על משבצת בשוליים לנמל שלכם ⚓, ואז על משבצת בטבעת הפנימית לשונית שלכם 🪨. כולם בוחרים בו־זמנית.`,
k_m:`⛵ להפליג`,k_b:`🏝️ לבנות כאן`,k_r:`🌊 להטביע את האי`,k_g:`🛡️ להישאר`,k_p:`הנמל שלך`,k_f:`השונית שלך`,
atide:`קציר בעוד {k} תורות`,atide1:`קציר בסוף התור הזה`,afin:`קציר אחרון בעוד {k} תורות`,afin1:`תור אחרון: קציר אחרון`,asunk:`הגאות בלעה את השוליים`,acx:`פקודות בוטלו (אותה משבצת)`,
amine:`הפקודה שלך`,apick:`הקישו על משבצת מסומנת`,aharv:`קציר`,afinal:`קציר אחרון`,atidec:`הגאות עולה: השוליים ייבלעו.`,abuilt:`איים שנבנו`,araid:`איים שהוטבעו`});
GADD('pt',{n_arc:`Arquipélago`,d_arc:`Ordens secretas e simultâneas: construa suas ilhotas antes da maré`,
r_arc:`A cada turno, em segredo: toque numa casa vizinha para navegar, ou na sua para construir uma ilhota — ou para afundar a ilhota rival onde você está, a menos que o barco dela esteja em cima ou ao lado. Duas ordens na mesma casa se anulam. A cada 4 turnos, cada ilhota rende suas pérolas (mais no centro), e a maré engole a borda.`,
r_arc2:`A cada turno, em segredo: toque numa casa vizinha para navegar, ou na sua para construir uma ilhota — ou para afundar a ilhota rival onde você está, a menos que o barco dela esteja em cima ou ao lado. Duas ordens na mesma casa se anulam. A cada 4 turnos, cada ilhota rende suas pérolas (mais no centro), e a maré engole a borda. A dois: mar menor, 8 turnos.`,
asetup:`Toque numa casa da borda para o seu porto ⚓, depois numa casa do anel interno para o seu recife 🪨. Todos escolhem ao mesmo tempo.`,
k_m:`⛵ Navegar`,k_b:`🏝️ Construir aqui`,k_r:`🌊 Afundar a ilhota`,k_g:`🛡️ Ficar`,k_p:`seu porto`,k_f:`seu recife`,
atide:`Colheita em {k} turnos`,atide1:`Colheita no fim deste turno`,afin:`Última colheita em {k} turnos`,afin1:`Último turno: colheita final`,asunk:`a maré engoliu a borda`,acx:`ordens anuladas (mesma casa)`,
amine:`Sua ordem`,apick:`Toque numa casa destacada`,aharv:`Colheita`,afinal:`Colheita final`,atidec:`A maré sobe: a borda vai ser engolida.`,abuilt:`ilhotas construídas`,araid:`ilhotas afundadas`});
const GMSK=(l,o,c)=>{Object.assign(GI18N[l].ui,o);Object.assign(GI18N[l],c)};
GMSK('fr',{n_msk:`Les Masques`,d_msk:`Duos secrets et masqués : partager ou garder ?`,
r_msk:`Chaque manche, tu es en duo secret avec un masque marin : écris-lui un message anonyme, puis choisis en secret Partager ou Garder. Partager à deux rapporte 4 chacun (2 si vous aviez déjà partagé ensemble) et agrandit ton réseau : +2, +4, +6… dès la 2e personne différente ; Garder rapporte 4 si l'autre partage (2 pour lui), sinon 2. À la fin, les deux premiers jouent 16 points à visage découvert : tous Partager (8 chacun), un seul Voler (16 pour lui), tous Voler (−8 chacun).`,
ymask:`Ton masque`,yduo:`Ton duo`,ytrio:`Ton trio`,mph:`Ton message anonyme…`,mskip:`Rien à dire`,msent:`Message envoyé`,mnone:`(pas de message)`,mread:`Ce qu'on t'a écrit`,
kP:`🤝 Partager`,kG:`🔒 Garder`,kV:`🗡️ Voler`,mshared:`a partagé`,mkept:`a gardé`,mrep:`Seulement 2 : vous aviez déjà partagé ensemble…`,mnet:`réseau : +{v}`,mtot:`Ton total (secret) : {v}`,msea:`La mer des masques`,
mfinT:`Le dernier masque tombe`,mfinD:`{n} jouent {v} points à visage découvert`,mfinC:`Tous Partager : on divise. Un seul Voler : il prend tout. Tous Voler : −8 chacun.`,
mbet:`Ton pari (+4 si tu vois juste)`,mb0:`Ils partagent`,mb1:`Un seul vole`,mb2:`Ils volent tous les deux`,mbetok:`Pari gagné : +4`,
mconst:`Constellation des masques`,mlegend:`vert : partage mutuel · rouge : trahison (flèche vers la victime) · gris : chacun a gardé`,mbetr:`a trahi`,mnobetr:`Personne n'a trahi personne !`},
{mkn:`le Poulpe|la Méduse|le Poisson-globe|le Crabe|la Tortue|le Calmar|le Poisson-clown|le Homard|le Dauphin|le Phoque`,
msk:`Convaincs ton masque de partager|Donne un vrai indice sur qui tu es|Donne un faux indice sur qui tu es|Fais une promesse|Annonce ton plan pour cette manche|Pose une question piège|Fais un compliment sans te trahir|Avoue un petit défaut|Menace gentiment|Décris ton humeur en trois mots|Invente un mot de passe pour se reconnaître|Fais rire ton masque`,
msk1:`Séduis ton masque en une phrase|Propose un rendez-vous secret|Fais un compliment osé|Décris ton baiser idéal|Promets un câlin si vous partagez|Écris une phrase de drague de pirate|Avoue ce qui te fait craquer|Chuchote un secret tendre`,
msk2:`Fais ton offre la plus indécente|Avoue un fantasme inavouable|Promets un gage hot si vous partagez|Décris ta nuit idéale sans filtre|Insulte ton masque avec amour|Fais une proposition qui ferait rougir le groupe|Balance un secret d'alcôve|Négocie comme dans un film pour adultes`});
GMSK('en',{n_msk:`The Masks`,d_msk:`Secret masked duos: share or keep?`,
r_msk:`Each round you're in a secret duo with a sea mask: send it an anonymous message, then secretly choose Share or Keep. Sharing together gives 4 each (2 if you've already shared together) and grows your network: +2, +4, +6… from the 2nd different person; Keep gives 4 if the other shares (2 for them), otherwise 2. At the end, the top two play for 16 points face to face: both Share (8 each), one Steals (16 for them), both Steal (−8 each).`,
ymask:`Your mask`,yduo:`Your duo`,ytrio:`Your trio`,mph:`Your anonymous message…`,mskip:`Nothing to say`,msent:`Message sent`,mnone:`(no message)`,mread:`What you were sent`,
kP:`🤝 Share`,kG:`🔒 Keep`,kV:`🗡️ Steal`,mshared:`shared`,mkept:`kept`,mrep:`Only 2: you had already shared together…`,mnet:`network: +{v}`,mtot:`Your total (secret): {v}`,msea:`The sea of masks`,
mfinT:`The last mask falls`,mfinD:`{n} play for {v} points face to face`,mfinC:`Both Share: split it. One Steals: they take it all. Both Steal: −8 each.`,
mbet:`Your bet (+4 if right)`,mb0:`They share`,mb1:`One of them steals`,mb2:`They both steal`,mbetok:`Bet won: +4`,
mconst:`Constellation of masks`,mlegend:`green: mutual share · red: betrayal (arrow to the victim) · grey: both kept`,mbetr:`betrayed`,mnobetr:`Nobody betrayed anybody!`},
{mkn:`the Octopus|the Jellyfish|the Pufferfish|the Crab|the Turtle|the Squid|the Clownfish|the Lobster|the Dolphin|the Seal`,
msk:`Convince your mask to share|Give a true clue about who you are|Give a false clue about who you are|Make a promise|Announce your plan for this round|Ask a trick question|Pay a compliment without giving yourself away|Admit a small flaw|Make a friendly threat|Describe your mood in three words|Invent a password to recognise each other|Make your mask laugh`,
msk1:`Seduce your mask in one sentence|Suggest a secret date|Pay a daring compliment|Describe your ideal kiss|Promise a cuddle if you both share|Write a pirate pick-up line|Admit what makes you melt|Whisper a tender secret`,
msk2:`Make your most indecent offer|Admit an unspeakable fantasy|Promise a hot dare if you both share|Describe your ideal night, no filter|Insult your mask lovingly|Make a proposal that would make the group blush|Spill a bedroom secret|Negotiate like in an adult film`});
GMSK('es',{n_msk:`Las Máscaras`,d_msk:`Dúos secretos y enmascarados: ¿compartir o guardar?`,
r_msk:`Cada ronda estás en un dúo secreto con una máscara marina: mándale un mensaje anónimo y elige en secreto Compartir o Guardar. Compartir los dos da 4 a cada uno (2 si ya habíais compartido juntos) y amplía tu red: +2, +4, +6… desde la 2.ª persona distinta; Guardar da 4 si el otro comparte (2 para él), si no 2. Al final, los dos primeros se juegan 16 puntos cara a cara: los dos Comparten (8 cada uno), uno solo Roba (16 para él), los dos Roban (−8 cada uno).`,
ymask:`Tu máscara`,yduo:`Tu dúo`,ytrio:`Tu trío`,mph:`Tu mensaje anónimo…`,mskip:`Nada que decir`,msent:`Mensaje enviado`,mnone:`(sin mensaje)`,mread:`Lo que te han escrito`,
kP:`🤝 Compartir`,kG:`🔒 Guardar`,kV:`🗡️ Robar`,mshared:`compartió`,mkept:`guardó`,mrep:`Solo 2: ya habíais compartido juntos…`,mnet:`red: +{v}`,mtot:`Tu total (secreto): {v}`,msea:`El mar de las máscaras`,
mfinT:`Cae la última máscara`,mfinD:`{n} se juegan {v} puntos cara a cara`,mfinC:`Los dos Comparten: se reparte. Uno solo Roba: se lo lleva todo. Los dos Roban: −8 cada uno.`,
mbet:`Tu apuesta (+4 si aciertas)`,mb0:`Comparten`,mb1:`Uno solo roba`,mb2:`Roban los dos`,mbetok:`Apuesta ganada: +4`,
mconst:`Constelación de las máscaras`,mlegend:`verde: compartir mutuo · rojo: traición (flecha hacia la víctima) · gris: los dos guardaron`,mbetr:`traicionó a`,mnobetr:`¡Nadie traicionó a nadie!`},
{mkn:`el Pulpo|la Medusa|el Pez globo|el Cangrejo|la Tortuga|el Calamar|el Pez payaso|la Langosta|el Delfín|la Foca`,
msk:`Convence a tu máscara de compartir|Da una pista verdadera sobre quién eres|Da una pista falsa sobre quién eres|Haz una promesa|Anuncia tu plan para esta ronda|Haz una pregunta trampa|Haz un cumplido sin delatarte|Confiesa un pequeño defecto|Amenaza con cariño|Describe tu humor en tres palabras|Inventa una contraseña para reconoceros|Haz reír a tu máscara`,
msk1:`Seduce a tu máscara en una frase|Propón una cita secreta|Haz un cumplido atrevido|Describe tu beso ideal|Promete un abrazo si compartís|Escribe una frase de ligue pirata|Confiesa lo que te derrite|Susurra un secreto tierno`,
msk2:`Haz tu oferta más indecente|Confiesa una fantasía inconfesable|Promete un reto picante si compartís|Describe tu noche ideal sin filtro|Insulta a tu máscara con amor|Haz una propuesta que sonrojaría al grupo|Suelta un secreto de alcoba|Negocia como en una película para adultos`});
GMSK('it',{n_msk:`Le Maschere`,d_msk:`Coppie segrete e mascherate: condividere o tenere?`,
r_msk:`A ogni manche sei in coppia segreta con una maschera marina: mandale un messaggio anonimo, poi scegli in segreto Condividi o Tieni. Condividere in due dà 4 a testa (2 se avevate già condiviso insieme) e allarga la tua rete: +2, +4, +6… dalla 2ª persona diversa; Tenere dà 4 se l'altro condivide (2 per lui), altrimenti 2. Alla fine i primi due si giocano 16 punti faccia a faccia: entrambi Condividono (8 a testa), uno solo Ruba (16 per lui), entrambi Rubano (−8 a testa).`,
ymask:`La tua maschera`,yduo:`La tua coppia`,ytrio:`Il tuo trio`,mph:`Il tuo messaggio anonimo…`,mskip:`Niente da dire`,msent:`Messaggio inviato`,mnone:`(nessun messaggio)`,mread:`Cosa ti hanno scritto`,
kP:`🤝 Condividi`,kG:`🔒 Tieni`,kV:`🗡️ Ruba`,mshared:`ha condiviso`,mkept:`ha tenuto`,mrep:`Solo 2: avevate già condiviso insieme…`,mnet:`rete: +{v}`,mtot:`Il tuo totale (segreto): {v}`,msea:`Il mare delle maschere`,
mfinT:`Cade l'ultima maschera`,mfinD:`{n} si giocano {v} punti faccia a faccia`,mfinC:`Entrambi Condividono: si divide. Uno solo Ruba: prende tutto. Entrambi Rubano: −8 a testa.`,
mbet:`La tua scommessa (+4 se indovini)`,mb0:`Condividono`,mb1:`Uno solo ruba`,mb2:`Rubano entrambi`,mbetok:`Scommessa vinta: +4`,
mconst:`Costellazione delle maschere`,mlegend:`verde: condivisione reciproca · rosso: tradimento (freccia verso la vittima) · grigio: entrambi hanno tenuto`,mbetr:`ha tradito`,mnobetr:`Nessuno ha tradito nessuno!`},
{mkn:`il Polpo|la Medusa|il Pesce palla|il Granchio|la Tartaruga|il Calamaro|il Pesce pagliaccio|l'Aragosta|il Delfino|la Foca`,
msk:`Convinci la tua maschera a condividere|Dai un indizio vero su chi sei|Dai un indizio falso su chi sei|Fai una promessa|Annuncia il tuo piano per questa manche|Fai una domanda trabocchetto|Fai un complimento senza tradirti|Confessa un piccolo difetto|Minaccia con dolcezza|Descrivi il tuo umore in tre parole|Inventa una parola d'ordine per riconoscervi|Fai ridere la tua maschera`,
msk1:`Seduci la tua maschera in una frase|Proponi un appuntamento segreto|Fai un complimento audace|Descrivi il tuo bacio ideale|Prometti un abbraccio se condividete|Scrivi una frase da rimorchio piratesca|Confessa cosa ti fa sciogliere|Sussurra un segreto tenero`,
msk2:`Fai la tua offerta più indecente|Confessa una fantasia inconfessabile|Prometti una penitenza hot se condividete|Descrivi la tua notte ideale senza filtri|Insulta la tua maschera con amore|Fai una proposta che farebbe arrossire il gruppo|Svela un segreto da camera da letto|Tratta come in un film per adulti`});
GMSK('de',{n_msk:`Die Masken`,d_msk:`Geheime, maskierte Duos: teilen oder behalten?`,
r_msk:`Jede Runde bist du in einem geheimen Duo mit einer Meeresmaske: schick ihr eine anonyme Nachricht und wähle dann geheim Teilen oder Behalten. Teilen beide, bekommt jeder 4 (2, wenn ihr schon zusammen geteilt habt) und dein Netz wächst: +2, +4, +6… ab der 2. verschiedenen Person; Behalten bringt 4, wenn der andere teilt (2 für ihn), sonst 2. Am Ende spielen die zwei Ersten offen um 16 Punkte: beide Teilen (je 8), einer Stiehlt (16 für ihn), beide Stehlen (je −8).`,
ymask:`Deine Maske`,yduo:`Dein Duo`,ytrio:`Dein Trio`,mph:`Deine anonyme Nachricht…`,mskip:`Nichts zu sagen`,msent:`Nachricht gesendet`,mnone:`(keine Nachricht)`,mread:`Was man dir geschrieben hat`,
kP:`🤝 Teilen`,kG:`🔒 Behalten`,kV:`🗡️ Stehlen`,mshared:`hat geteilt`,mkept:`hat behalten`,mrep:`Nur 2: ihr hattet schon zusammen geteilt…`,mnet:`Netz: +{v}`,mtot:`Dein Stand (geheim): {v}`,msea:`Das Meer der Masken`,
mfinT:`Die letzte Maske fällt`,mfinD:`{n} spielen offen um {v} Punkte`,mfinC:`Beide Teilen: wird geteilt. Einer Stiehlt: er nimmt alles. Beide Stehlen: je −8.`,
mbet:`Deine Wette (+4 bei Treffer)`,mb0:`Sie teilen`,mb1:`Einer stiehlt`,mb2:`Beide stehlen`,mbetok:`Wette gewonnen: +4`,
mconst:`Sternbild der Masken`,mlegend:`grün: gegenseitig geteilt · rot: Verrat (Pfeil zum Opfer) · grau: beide behalten`,mbetr:`hat verraten:`,mnobetr:`Niemand hat jemanden verraten!`},
{mkn:`der Krake|die Qualle|der Kugelfisch|die Krabbe|die Schildkröte|der Tintenfisch|der Clownfisch|der Hummer|der Delfin|die Robbe`,
msk:`Überzeug deine Maske zu teilen|Gib einen echten Hinweis, wer du bist|Gib einen falschen Hinweis, wer du bist|Gib ein Versprechen|Verkünde deinen Plan für diese Runde|Stell eine Fangfrage|Mach ein Kompliment, ohne dich zu verraten|Gib eine kleine Schwäche zu|Droh nett|Beschreib deine Laune in drei Wörtern|Erfinde ein Passwort zum Wiedererkennen|Bring deine Maske zum Lachen`,
msk1:`Verführ deine Maske in einem Satz|Schlag ein geheimes Date vor|Mach ein gewagtes Kompliment|Beschreib deinen idealen Kuss|Versprich eine Umarmung, wenn ihr teilt|Schreib einen Piraten-Anmachspruch|Gesteh, was dich schwach macht|Flüstere ein zärtliches Geheimnis`,
msk2:`Mach dein unanständigstes Angebot|Gesteh eine unaussprechliche Fantasie|Versprich eine heiße Mutprobe, wenn ihr teilt|Beschreib deine ideale Nacht ohne Filter|Beleidige deine Maske liebevoll|Mach einen Vorschlag, bei dem die Gruppe rot wird|Verrat ein Schlafzimmergeheimnis|Verhandle wie in einem Erwachsenenfilm`});
GMSK('ru',{n_msk:`Маски`,d_msk:`Тайные пары в масках: делиться или оставить себе?`,
r_msk:`Каждый раунд ты в тайной паре с морской маской: отправь ей анонимное сообщение, затем тайно выбери «Делиться» или «Оставить». Если делитесь оба — по 4 каждому (2, если вы уже делились вместе), и твоя сеть растёт: +2, +4, +6… со 2-го разного человека; «Оставить» даёт 4, если другой делится (ему 2), иначе 2. В конце двое лидеров открыто играют на 16 очков: оба делятся (по 8), один крадёт (16 ему), оба крадут (по −8).`,
ymask:`Твоя маска`,yduo:`Твоя пара`,ytrio:`Твоя тройка`,mph:`Твоё анонимное сообщение…`,mskip:`Нечего сказать`,msent:`Сообщение отправлено`,mnone:`(нет сообщения)`,mread:`Что тебе написали`,
kP:`🤝 Делиться`,kG:`🔒 Оставить`,kV:`🗡️ Украсть`,mshared:`поделился(-ась)`,mkept:`оставил(а) себе`,mrep:`Только 2: вы уже делились вместе…`,mnet:`сеть: +{v}`,mtot:`Твой счёт (тайно): {v}`,msea:`Море масок`,
mfinT:`Падает последняя маска`,mfinD:`{n} открыто играют на {v} очков`,mfinC:`Оба делятся: поровну. Один крадёт: забирает всё. Оба крадут: по −8.`,
mbet:`Твоя ставка (+4, если угадаешь)`,mb0:`Они делятся`,mb1:`Один крадёт`,mb2:`Оба крадут`,mbetok:`Ставка сыграла: +4`,
mconst:`Созвездие масок`,mlegend:`зелёный: взаимный обмен · красный: предательство (стрелка к жертве) · серый: оба оставили`,mbetr:`предал(а)`,mnobetr:`Никто никого не предал!`},
{mkn:`Осьминог|Медуза|Рыба-шар|Краб|Черепаха|Кальмар|Рыба-клоун|Омар|Дельфин|Тюлень`,
msk:`Убеди свою маску делиться|Дай правдивую подсказку, кто ты|Дай ложную подсказку, кто ты|Дай обещание|Объяви свой план на этот раунд|Задай каверзный вопрос|Сделай комплимент, не выдав себя|Признайся в маленьком недостатке|Ласково пригрози|Опиши настроение тремя словами|Придумай пароль, чтобы узнать друг друга|Рассмеши свою маску`,
msk1:`Соблазни свою маску одной фразой|Предложи тайное свидание|Сделай смелый комплимент|Опиши свой идеальный поцелуй|Пообещай объятия, если оба поделитесь|Напиши пиратскую фразу для флирта|Признайся, от чего тает сердце|Прошепчи нежный секрет`,
msk2:`Сделай самое неприличное предложение|Признайся в запретной фантазии|Пообещай горячее задание, если оба поделитесь|Опиши идеальную ночь без фильтров|Оскорби свою маску с любовью|Сделай предложение, от которого покраснеет вся группа|Выдай постельный секрет|Торгуйся как во взрослом фильме`});
GMSK('zh',{n_msk:`面具`,d_msk:`秘密蒙面搭档：分享还是独占？`,
r_msk:`每轮你会和一个海洋面具秘密组队：先给它发一条匿名消息，再秘密选择“分享”或“独占”。双方都分享各得4分（若你们之前已一起分享过则为2分），并扩大你的人脉：从第2个不同的人起 +2、+4、+6……；独占时若对方分享你得4分（对方2分），否则2分。最后，前两名当面争夺16分：都分享（各8分），一人偷（他得16分），都偷（各−8分）。`,
ymask:`你的面具`,yduo:`你的搭档`,ytrio:`你的三人组`,mph:`你的匿名消息……`,mskip:`无话可说`,msent:`消息已发送`,mnone:`（没有消息）`,mread:`你收到的消息`,
kP:`🤝 分享`,kG:`🔒 独占`,kV:`🗡️ 偷`,mshared:`选择了分享`,mkept:`选择了独占`,mrep:`只有2分：你们之前已经一起分享过……`,mnet:`人脉：+{v}`,mtot:`你的总分（保密）：{v}`,msea:`面具之海`,
mfinT:`最后的面具落下`,mfinD:`{n} 当面争夺 {v} 分`,mfinC:`都分享：平分。一人偷：他全拿。都偷：各−8。`,
mbet:`你的押注（猜对 +4）`,mb0:`他们分享`,mb1:`只有一人偷`,mb2:`两人都偷`,mbetok:`押注成功：+4`,
mconst:`面具星座`,mlegend:`绿色：互相分享 · 红色：背叛（箭头指向受害者） · 灰色：双方都独占`,mbetr:`背叛了`,mnobetr:`没有人背叛任何人！`},
{mkn:`章鱼|水母|河豚|螃蟹|海龟|鱿鱼|小丑鱼|龙虾|海豚|海豹`,
msk:`说服你的面具选择分享|给出一个关于你身份的真线索|给出一个关于你身份的假线索|许下一个承诺|宣布你这一轮的计划|问一个陷阱问题|夸对方一句但别暴露自己|承认一个小缺点|温柔地威胁一下|用三个词描述你的心情|编一个暗号好认出彼此|把你的面具逗笑`,
msk1:`用一句话撩你的面具|约一次秘密约会|说一句大胆的赞美|描述你理想中的吻|承诺如果都分享就抱一下|写一句海盗式搭讪|坦白什么让你心动|悄悄说一个温柔的秘密`,
msk2:`提出你最不正经的条件|坦白一个难以启齿的幻想|承诺如果都分享就来个火辣惩罚|毫无保留地描述你理想的夜晚|用爱来骂你的面具|提一个会让全场脸红的建议|爆一个床笫秘密|像成人电影里那样讨价还价`});
GMSK('he',{n_msk:`המסכות`,d_msk:`זוגות סודיים במסכות: לחלוק או לשמור?`,
r_msk:`בכל סבב אתם בזוג סודי עם מסכה ימית: שלחו לה הודעה אנונימית, ואז בחרו בסוד לחלוק או לשמור. אם שניכם חולקים, כל אחד מקבל 4 (2 אם כבר חלקתם יחד) והרשת שלכם גדלה: ‎+2, ‎+4, ‎+6… מהאדם השני השונה; לשמור נותן 4 אם השני חולק (לו 2), אחרת 2. בסוף, שני המובילים משחקים על 16 נקודות פנים אל פנים: שניהם חולקים (8 לכל אחד), אחד גונב (16 לו), שניהם גונבים (‎−8 לכל אחד).`,
ymask:`המסכה שלך`,yduo:`הזוג שלך`,ytrio:`השלישייה שלך`,mph:`ההודעה האנונימית שלך…`,mskip:`אין מה להגיד`,msent:`ההודעה נשלחה`,mnone:`(אין הודעה)`,mread:`מה כתבו לך`,
kP:`🤝 לחלוק`,kG:`🔒 לשמור`,kV:`🗡️ לגנוב`,mshared:`חלק/ה`,mkept:`שמר/ה`,mrep:`רק 2: כבר חלקתם יחד…`,mnet:`רשת: ‎+{v}`,mtot:`הסכום שלך (סודי): {v}`,msea:`ים המסכות`,
mfinT:`המסכה האחרונה נופלת`,mfinD:`{n} משחקים על {v} נקודות פנים אל פנים`,mfinC:`שניהם חולקים: מתחלקים. אחד גונב: לוקח הכול. שניהם גונבים: ‎−8 לכל אחד.`,
mbet:`ההימור שלך (‎+4 אם צדקת)`,mb0:`הם חולקים`,mb1:`רק אחד גונב`,mb2:`שניהם גונבים`,mbetok:`ההימור הצליח: ‎+4`,
mconst:`קבוצת הכוכבים של המסכות`,mlegend:`ירוק: חלוקה הדדית · אדום: בגידה (חץ אל הקורבן) · אפור: שניהם שמרו`,mbetr:`בגד/ה ב`,mnobetr:`אף אחד לא בגד באף אחד!`},
{mkn:`התמנון|המדוזה|הנפוחית|הסרטן|הצב|הדיונון|דג הליצן|הלובסטר|הדולפין|כלב הים`,
msk:`שכנעו את המסכה לחלוק|תנו רמז אמיתי מי אתם|תנו רמז מטעה מי אתם|הבטיחו משהו|הכריזו על התוכנית שלכם לסבב|שאלו שאלה מכשילה|תנו מחמאה בלי להסגיר את עצמכם|הודו בחיסרון קטן|איימו בעדינות|תארו את מצב הרוח בשלוש מילים|המציאו סיסמה כדי לזהות זה את זה|הצחיקו את המסכה`,
msk1:`פתו את המסכה במשפט אחד|הציעו דייט סודי|תנו מחמאה נועזת|תארו את הנשיקה האידיאלית|הבטיחו חיבוק אם שניכם חולקים|כתבו משפט התחלה של פיראט|הודו במה שממיס אתכם|לחשו סוד רך`,
msk2:`הציעו את ההצעה הכי לא צנועה|הודו בפנטזיה שאסור לספר|הבטיחו משימה לוהטת אם שניכם חולקים|תארו את הלילה האידיאלי בלי פילטר|העליבו את המסכה באהבה|הציעו משהו שיסמיק את כל הקבוצה|גלו סוד מחדר השינה|התמקחו כמו בסרט למבוגרים`});
GMSK('pt',{n_msk:`As Máscaras`,d_msk:`Duplas secretas e mascaradas: dividir ou guardar?`,
r_msk:`A cada rodada você forma uma dupla secreta com uma máscara marinha: mande uma mensagem anônima e escolha em segredo Dividir ou Guardar. Dividir os dois dá 4 a cada um (2 se vocês já dividiram juntos) e aumenta sua rede: +2, +4, +6… a partir da 2ª pessoa diferente; Guardar dá 4 se o outro divide (2 para ele), senão 2. No fim, os dois primeiros disputam 16 pontos cara a cara: os dois Dividem (8 cada), um só Rouba (16 para ele), os dois Roubam (−8 cada).`,
ymask:`Sua máscara`,yduo:`Sua dupla`,ytrio:`Seu trio`,mph:`Sua mensagem anônima…`,mskip:`Nada a dizer`,msent:`Mensagem enviada`,mnone:`(sem mensagem)`,mread:`O que te escreveram`,
kP:`🤝 Dividir`,kG:`🔒 Guardar`,kV:`🗡️ Roubar`,mshared:`dividiu`,mkept:`guardou`,mrep:`Só 2: vocês já tinham dividido juntos…`,mnet:`rede: +{v}`,mtot:`Seu total (secreto): {v}`,msea:`O mar das máscaras`,
mfinT:`Cai a última máscara`,mfinD:`{n} disputam {v} pontos cara a cara`,mfinC:`Os dois Dividem: reparte-se. Um só Rouba: leva tudo. Os dois Roubam: −8 cada.`,
mbet:`Sua aposta (+4 se acertar)`,mb0:`Eles dividem`,mb1:`Um só rouba`,mb2:`Os dois roubam`,mbetok:`Aposta certa: +4`,
mconst:`Constelação das máscaras`,mlegend:`verde: divisão mútua · vermelho: traição (seta para a vítima) · cinza: os dois guardaram`,mbetr:`traiu`,mnobetr:`Ninguém traiu ninguém!`},
{mkn:`o Polvo|a Água-viva|o Baiacu|o Caranguejo|a Tartaruga|a Lula|o Peixe-palhaço|a Lagosta|o Golfinho|a Foca`,
msk:`Convença sua máscara a dividir|Dê uma pista verdadeira sobre quem você é|Dê uma pista falsa sobre quem você é|Faça uma promessa|Anuncie seu plano para esta rodada|Faça uma pergunta capciosa|Faça um elogio sem se entregar|Confesse um pequeno defeito|Ameace com carinho|Descreva seu humor em três palavras|Invente uma senha para se reconhecerem|Faça sua máscara rir`,
msk1:`Seduza sua máscara numa frase|Proponha um encontro secreto|Faça um elogio ousado|Descreva seu beijo ideal|Prometa um abraço se os dois dividirem|Escreva uma cantada de pirata|Confesse o que te derrete|Sussurre um segredo carinhoso`,
msk2:`Faça sua oferta mais indecente|Confesse uma fantasia inconfessável|Prometa um desafio picante se os dois dividirem|Descreva sua noite ideal sem filtro|Xingue sua máscara com amor|Faça uma proposta que deixaria o grupo vermelho|Solte um segredo de alcova|Negocie como num filme adulto`});
/* Les Masques : réserves d'invitations élargies (aucune répétition dans une partie : gPool tire sans remise) */
const GMX=(l,ed,a,b,c)=>{GI18N[l].ui.medit=ed;GI18N[l].msk+='|'+a;GI18N[l].msk1+='|'+b;GI18N[l].msk2+='|'+c};
GMX('fr',`Modifier`,`Jure sur quelque chose de précieux|Raconte un souvenir sans donner de nom|Écris en rimes|Parle comme un pirate|Cite une chanson qui résume ta stratégie|Décris ton masque idéal|Donne un conseil de survie en mer|Avoue si tu as déjà trahi cette partie|Lance un défi|Écris ton message en emojis seulement|Propose une alliance pour la suite|Fais semblant d'être quelqu'un d'autre|Raconte ce que tu feras avec tes points|Dis une vérité que personne ne croira`,
`Avoue ton type en trois mots|Propose une danse sous l'eau|Décris le rendez-vous parfait sur un bateau|Fais une déclaration enflammée|Avoue ton pêché mignon|Écris un message comme un poème d'amour|Propose un pacte scellé d'un baiser|Dis ce que tu murmurerais à l'oreille`,
`Avoue ta pire expérience au lit|Décris ton fantasme en trois mots|Propose un deal sans vêtements|Avoue l'endroit le plus fou où tu l'as fait|Fais une promesse que tu regretteras demain|Écris le sexto le plus nul possible|Décris ton jouet préféré sans le nommer|Balance ce que tu n'as jamais osé demander`);
GMX('en',`Edit`,`Swear on something precious|Tell a memory without naming anyone|Write in rhyme|Talk like a pirate|Quote a song that sums up your strategy|Describe your ideal mask|Give a sea-survival tip|Admit whether you've betrayed anyone yet|Throw down a challenge|Write your message in emojis only|Propose an alliance for later|Pretend to be someone else|Say what you'll do with your points|Tell a truth nobody will believe`,
`Admit your type in three words|Suggest an underwater dance|Describe the perfect date on a boat|Make a fiery declaration|Admit your sweet weakness|Write it like a love poem|Propose a pact sealed with a kiss|Say what you'd whisper in their ear`,
`Admit your worst experience in bed|Describe your fantasy in three words|Propose a deal with no clothes on|Admit the wildest place you've done it|Make a promise you'll regret tomorrow|Write the worst possible sext|Describe your favourite toy without naming it|Spill what you've never dared ask for`);
GMX('es',`Editar`,`Jura por algo valioso|Cuenta un recuerdo sin dar nombres|Escribe en rima|Habla como un pirata|Cita una canción que resuma tu estrategia|Describe tu máscara ideal|Da un consejo para sobrevivir en el mar|Confiesa si ya has traicionado en esta partida|Lanza un reto|Escribe tu mensaje solo con emojis|Propón una alianza para después|Finge ser otra persona|Cuenta qué harás con tus puntos|Di una verdad que nadie creerá`,
`Confiesa tu tipo en tres palabras|Propón un baile bajo el agua|Describe la cita perfecta en un barco|Haz una declaración ardiente|Confiesa tu debilidad dulce|Escríbelo como un poema de amor|Propón un pacto sellado con un beso|Di lo que susurrarías al oído`,
`Confiesa tu peor experiencia en la cama|Describe tu fantasía en tres palabras|Propón un trato sin ropa|Confiesa el sitio más loco donde lo has hecho|Haz una promesa de la que te arrepentirás mañana|Escribe el peor sexting posible|Describe tu juguete favorito sin nombrarlo|Suelta lo que nunca te atreviste a pedir`);
GMX('it',`Modifica`,`Giura su qualcosa di prezioso|Racconta un ricordo senza fare nomi|Scrivi in rima|Parla come un pirata|Cita una canzone che riassume la tua strategia|Descrivi la tua maschera ideale|Dai un consiglio per sopravvivere in mare|Confessa se hai già tradito in questa partita|Lancia una sfida|Scrivi il messaggio solo con emoji|Proponi un'alleanza per dopo|Fingi di essere qualcun altro|Racconta cosa farai con i tuoi punti|Di' una verità a cui nessuno crederà`,
`Confessa il tuo tipo in tre parole|Proponi un ballo sott'acqua|Descrivi l'appuntamento perfetto su una barca|Fai una dichiarazione infuocata|Confessa il tuo peccato di gola|Scrivilo come una poesia d'amore|Proponi un patto sigillato da un bacio|Di' cosa sussurreresti all'orecchio`,
`Confessa la tua peggior esperienza a letto|Descrivi la tua fantasia in tre parole|Proponi un patto senza vestiti|Confessa il posto più folle dove l'hai fatto|Fai una promessa di cui ti pentirai domani|Scrivi il sexting peggiore possibile|Descrivi il tuo giocattolo preferito senza nominarlo|Svela ciò che non hai mai osato chiedere`);
GMX('de',`Ändern`,`Schwöre auf etwas Kostbares|Erzähl eine Erinnerung ohne Namen|Schreib in Reimen|Sprich wie ein Pirat|Zitier ein Lied, das deine Strategie beschreibt|Beschreib deine ideale Maske|Gib einen Überlebenstipp auf See|Gib zu, ob du schon verraten hast|Stell eine Herausforderung|Schreib nur in Emojis|Schlag ein Bündnis für später vor|Gib dich als jemand anderes aus|Sag, was du mit deinen Punkten machst|Sag eine Wahrheit, die niemand glaubt`,
`Verrat deinen Typ in drei Wörtern|Schlag einen Tanz unter Wasser vor|Beschreib das perfekte Date auf einem Boot|Mach eine feurige Liebeserklärung|Gesteh deine süße Schwäche|Schreib es wie ein Liebesgedicht|Schlag einen Pakt vor, besiegelt mit einem Kuss|Sag, was du ins Ohr flüstern würdest`,
`Gesteh dein schlimmstes Erlebnis im Bett|Beschreib deine Fantasie in drei Wörtern|Schlag einen Deal ohne Kleidung vor|Gesteh den verrücktesten Ort, an dem du es getan hast|Gib ein Versprechen, das du morgen bereust|Schreib den schlechtesten Sexting-Satz|Beschreib dein Lieblingsspielzeug, ohne es zu nennen|Verrat, was du dich nie zu fragen getraut hast`);
GMX('ru',`Изменить`,`Поклянись чем-то дорогим|Расскажи воспоминание без имён|Напиши в рифму|Говори как пират|Процитируй песню о своей стратегии|Опиши свою идеальную маску|Дай совет по выживанию в море|Признайся, предавал(а) ли ты уже|Брось вызов|Напиши только эмодзи|Предложи союз на будущее|Притворись кем-то другим|Расскажи, что сделаешь со своими очками|Скажи правду, в которую никто не поверит`,
`Опиши свой типаж тремя словами|Предложи танец под водой|Опиши идеальное свидание на лодке|Сделай пылкое признание|Признайся в милой слабости|Напиши как любовное стихотворение|Предложи союз, скреплённый поцелуем|Скажи, что бы ты прошептал(а) на ушко`,
`Признайся в худшем опыте в постели|Опиши фантазию тремя словами|Предложи сделку без одежды|Признайся, где было самое безумное место|Дай обещание, о котором завтра пожалеешь|Напиши самый неудачный секстинг|Опиши любимую игрушку, не называя её|Выдай то, о чём никогда не решался(-ась) попросить`);
GMX('zh',`修改`,`以珍贵的东西发誓|讲一段回忆但别提名字|用押韵的方式写|像海盗一样说话|引用一首概括你策略的歌|描述你理想中的面具|给一个海上求生建议|坦白你这局是否已经背叛过|发起一个挑战|只用表情符号写消息|提议之后结盟|假装成另一个人|说说你要拿分数做什么|说一个没人会信的真相`,
`用三个词说出你喜欢的类型|邀请对方水下共舞|描述船上的完美约会|来一段炽热的表白|坦白你的小甜蜜弱点|写得像一首情诗|提议一个以吻为誓的约定|说出你会在耳边低语的话`,
`坦白你最糟的床上经历|用三个词描述你的幻想|提议一个不穿衣服的交易|坦白你做过最疯狂的地点|许一个明天会后悔的承诺|写一条最烂的情色短信|不说名字描述你最爱的玩具|说出你从来不敢开口要的东西`);
GMX('he',`לערוך`,`השביעו במשהו יקר|ספרו זיכרון בלי שמות|כתבו בחרוזים|דברו כמו פיראט|צטטו שיר שמסכם את האסטרטגיה|תארו את המסכה האידיאלית|תנו טיפ הישרדות בים|הודו אם כבר בגדתם במשחק|זרקו אתגר|כתבו רק באימוג'ים|הציעו ברית להמשך|העמידו פנים שאתם מישהו אחר|ספרו מה תעשו עם הנקודות|אמרו אמת שאף אחד לא יאמין לה`,
`תארו את הטיפוס שלכם בשלוש מילים|הציעו ריקוד מתחת למים|תארו דייט מושלם על סירה|הצהירו הצהרה לוהטת|הודו בחולשה המתוקה שלכם|כתבו כמו שיר אהבה|הציעו ברית שנחתמת בנשיקה|אמרו מה הייתם לוחשים באוזן`,
`הודו בחוויה הכי גרועה במיטה|תארו את הפנטזיה בשלוש מילים|הציעו עסקה בלי בגדים|הודו במקום הכי מטורף שעשיתם את זה|הבטיחו משהו שתתחרטו עליו מחר|כתבו את הסקסטינג הכי גרוע|תארו את הצעצוע האהוב בלי לנקוב בשמו|גלו מה אף פעם לא העזתם לבקש`);
GMX('pt',`Editar`,`Jure por algo precioso|Conte uma lembrança sem citar nomes|Escreva rimando|Fale como um pirata|Cite uma música que resuma sua estratégia|Descreva sua máscara ideal|Dê uma dica de sobrevivência no mar|Confesse se já traiu nesta partida|Lance um desafio|Escreva só com emojis|Proponha uma aliança para depois|Finja ser outra pessoa|Conte o que vai fazer com seus pontos|Diga uma verdade em que ninguém vai acreditar`,
`Confesse seu tipo em três palavras|Proponha uma dança debaixo d'água|Descreva o encontro perfeito num barco|Faça uma declaração ardente|Confesse sua fraqueza doce|Escreva como um poema de amor|Proponha um pacto selado com um beijo|Diga o que sussurraria no ouvido`,
`Confesse sua pior experiência na cama|Descreva sua fantasia em três palavras|Proponha um acordo sem roupa|Confesse o lugar mais louco onde já transou|Faça uma promessa da qual vai se arrepender amanhã|Escreva o pior sexting possível|Descreva seu brinquedo favorito sem dizer o nome|Solte o que nunca teve coragem de pedir`);
/* Les Masques v2 : choix par partenaire, 🦈 réputation, habitude, liens connus (couples) */
const GMK2=(l,o)=>Object.assign(GI18N[l].ui,o);
GMK2('fr',{r_msk:`Chaque manche (4 à 6, nul ne sait combien), tu es masqué face à 1 ou 2 joueurs : écris un message anonyme, puis choisis en secret Partager ou Garder avec chacun. Partager à deux rapporte 4 (puis 3, puis 2 par habitude) et agrandit ton réseau (+2, +4, +6… dès la 2e personne) ; Garder rapporte 4 face à un partage (1 pour l'autre) ou 2, mais te colle un 🦈 visible de tous (−1 à la fin, −4 sur un vol final), sauf si l'autre en portait déjà un. Les deux premiers jouent 16 points : tous Partager 8 chacun, un seul Voler tout pour lui, tous Voler −8 chacun.`,
mrep:`Habitude : vous aviez déjà partagé ensemble, ça rapporte moins.`,mfinC:`Tous Partager : on divise. Un seul Voler : il prend tout, moins 4 par 🦈. Tous Voler : −8 chacun.`,
mshT:`A déjà gardé face à quelqu'un qui partageait`,mshD:`a déjà trahi quelqu'un qui partageait. Garder face à un 🦈 ne te marque pas.`,myshk:`Tu portes {v} 🦈 : −{v} à la fin.`,
mtieM:`Lien connu : votre face-à-face vaut la moyenne de la manche.`,mtieT:`Liens connus`,mtieD:`Couple, coloc… : leur face-à-face vaut la moyenne de la manche et ils ne s'affrontent jamais en finale. Se connaître ne donne aucun avantage.`,mtieH:`Touche deux prénoms pour les lier (ou les délier).`,mtie0:`Aucun lien déclaré.`});
GMK2('en',{r_msk:`Each round (4 to 6, nobody knows how many), you're masked against 1 or 2 players: write an anonymous message, then secretly choose Share or Keep with each. Sharing both ways gives 4 (then 3, then 2 out of habit) and grows your network (+2, +4, +6… from the 2nd person); Keeping gives 4 against a sharer (1 for them) or 2, but sticks a 🦈 on you that everyone sees (−1 at the end, −4 on a final steal), unless the other already wore one. The top two play for 16 points: both Share 8 each, one Steals it all, both Steal −8 each.`,
mrep:`Habit: you had already shared together, it pays less.`,mfinC:`Both Share: split it. One Steals: takes it all, minus 4 per 🦈. Both Steal: −8 each.`,
mshT:`Has kept against someone who was sharing`,mshD:`has already betrayed someone who was sharing. Keeping against a 🦈 doesn't mark you.`,myshk:`You wear {v} 🦈: −{v} at the end.`,
mtieM:`Known bond: your face-off is worth the round's average.`,mtieT:`Known bonds`,mtieD:`Couple, flatmates…: their face-off is worth the round's average and they never meet in the final. Knowing each other gives no edge.`,mtieH:`Tap two names to link them (or unlink).`,mtie0:`No bond declared.`});
GMK2('es',{r_msk:`Cada ronda (de 4 a 6, nadie sabe cuántas) estás enmascarado frente a 1 o 2 jugadores: escribe un mensaje anónimo y elige en secreto Compartir o Guardar con cada uno. Compartir los dos da 4 (luego 3, luego 2 por costumbre) y amplía tu red (+2, +4, +6… desde la 2.ª persona); Guardar da 4 frente a quien comparte (1 para él) o 2, pero te pega un 🦈 que todos ven (−1 al final, −4 en un robo final), salvo si el otro ya llevaba uno. Los dos primeros se juegan 16 puntos: ambos Compartir 8 cada uno, uno solo Roba todo, ambos Roban −8 cada uno.`,
mrep:`Costumbre: ya habíais compartido juntos, da menos.`,mfinC:`Ambos Compartir: se reparte. Uno solo Roba: se lo lleva todo, menos 4 por 🦈. Ambos Roban: −8 cada uno.`,
mshT:`Ya guardó frente a alguien que compartía`,mshD:`ya traicionó a alguien que compartía. Guardar frente a un 🦈 no te marca.`,myshk:`Llevas {v} 🦈: −{v} al final.`,
mtieM:`Vínculo conocido: vuestro cara a cara vale la media de la ronda.`,mtieT:`Vínculos conocidos`,mtieD:`Pareja, compis de piso…: su cara a cara vale la media de la ronda y nunca se enfrentan en la final. Conocerse no da ventaja.`,mtieH:`Toca dos nombres para vincularlos (o desvincularlos).`,mtie0:`Ningún vínculo declarado.`});
GMK2('it',{r_msk:`Ogni round (da 4 a 6, nessuno sa quanti) sei mascherato davanti a 1 o 2 giocatori: scrivi un messaggio anonimo, poi scegli in segreto Condividi o Tieni con ciascuno. Condividere in due dà 4 (poi 3, poi 2 per abitudine) e allarga la tua rete (+2, +4, +6… dalla 2ª persona); Tenere dà 4 contro chi condivide (1 a lui) o 2, ma ti appiccica uno 🦈 visibile a tutti (−1 alla fine, −4 su un furto finale), a meno che l'altro ne avesse già uno. I primi due si giocano 16 punti: entrambi Condividi 8 a testa, uno solo Ruba tutto, entrambi Rubano −8 a testa.`,
mrep:`Abitudine: avevate già condiviso insieme, rende meno.`,mfinC:`Entrambi Condividi: si divide. Uno solo Ruba: prende tutto, meno 4 per 🦈. Entrambi Rubano: −8 a testa.`,
mshT:`Ha già tenuto contro qualcuno che condivideva`,mshD:`ha già tradito qualcuno che condivideva. Tenere contro uno 🦈 non ti marchia.`,myshk:`Porti {v} 🦈: −{v} alla fine.`,
mtieM:`Legame noto: il vostro faccia a faccia vale la media del round.`,mtieT:`Legami noti`,mtieD:`Coppia, coinquilini…: il loro faccia a faccia vale la media del round e non si sfidano mai in finale. Conoscersi non dà vantaggi.`,mtieH:`Tocca due nomi per legarli (o slegarli).`,mtie0:`Nessun legame dichiarato.`});
GMK2('de',{r_msk:`In jeder Runde (4 bis 6, niemand weiß wie viele) stehst du maskiert 1 oder 2 Leuten gegenüber: schreib eine anonyme Nachricht und wähle dann geheim Teilen oder Behalten, für jede Person. Beidseitiges Teilen bringt 4 (dann 3, dann 2 aus Gewohnheit) und vergrößert dein Netz (+2, +4, +6… ab der 2. Person); Behalten bringt 4 gegen jemanden, der teilt (1 für ihn), sonst 2, verpasst dir aber einen für alle sichtbaren 🦈 (−1 am Ende, −4 bei einem Diebstahl im Finale), außer der andere trug schon einen. Die zwei Besten spielen um 16 Punkte: beide Teilen je 8, einer Stiehlt alles, beide Stehlen je −8.`,
mrep:`Gewohnheit: ihr hattet schon zusammen geteilt, das bringt weniger.`,mfinC:`Beide Teilen: wird geteilt. Einer Stiehlt: nimmt alles, minus 4 pro 🦈. Beide Stehlen: je −8.`,
mshT:`Hat schon gegen jemanden behalten, der teilte`,mshD:`hat schon jemanden verraten, der teilte. Behalten gegen einen 🦈 markiert dich nicht.`,myshk:`Du trägst {v} 🦈: −{v} am Ende.`,
mtieM:`Bekannte Verbindung: euer Duell zählt den Rundendurchschnitt.`,mtieT:`Bekannte Verbindungen`,mtieD:`Paar, WG…: ihr Duell zählt den Rundendurchschnitt und sie treffen sich nie im Finale. Sich zu kennen bringt keinen Vorteil.`,mtieH:`Tippe zwei Namen an, um sie zu verbinden (oder zu lösen).`,mtie0:`Keine Verbindung angegeben.`});
GMK2('ru',{r_msk:`Каждый раунд (от 4 до 6, никто не знает сколько) ты в маске против 1 или 2 игроков: напиши анонимное сообщение, затем тайно выбери Делиться или Оставить — с каждым. Взаимный обмен даёт 4 (потом 3, потом 2 по привычке) и расширяет твою сеть (+2, +4, +6… со 2-го человека); Оставить даёт 4 против делящегося (ему 1) или 2, но вешает на тебя 🦈, видимую всем (−1 в конце, −4 при краже в финале), если только у другого её уже не было. Двое лучших играют на 16 очков: оба Делятся — по 8, один Крадёт — всё ему, оба Крадут — по −8.`,
mrep:`Привычка: вы уже делились вместе, это приносит меньше.`,mfinC:`Оба Делятся: пополам. Один Крадёт: забирает всё, минус 4 за каждую 🦈. Оба Крадут: по −8.`,
mshT:`Уже оставлял(а) себе против того, кто делился`,mshD:`уже предал(а) того, кто делился. Оставить против 🦈 — не помечает тебя.`,myshk:`На тебе {v} 🦈: −{v} в конце.`,
mtieM:`Известная связь: ваша дуэль стоит среднего за раунд.`,mtieT:`Известные связи`,mtieD:`Пара, соседи…: их дуэль стоит среднего за раунд, и в финале они не встречаются. Знакомство не даёт преимущества.`,mtieH:`Нажми два имени, чтобы связать их (или развязать).`,mtie0:`Связей нет.`});
GMK2('zh',{r_msk:`每轮（4到6轮，没人知道几轮）你戴着面具面对1或2名玩家：写一条匿名消息，然后对每个人秘密选择分享或独占。双方分享各得4分（之后3分、再之后2分，习惯了），并扩大你的人脉（从第2个人起+2、+4、+6…）；独占对分享者得4分（对方1分），否则2分，但会被贴上人人可见的🦈（结束时−1，决赛偷窃−4），除非对方已经有🦈。前两名争夺16分：都分享各8分，一人偷全归他，都偷各−8。`,
mrep:`习惯了：你们已经一起分享过，得分变少。`,mfinC:`都分享：平分。一人偷：全拿，每个🦈减4。都偷：各−8。`,
mshT:`曾对分享者选择独占`,mshD:`曾背叛过分享的人。对🦈独占不会给你打标记。`,myshk:`你带着{v}个🦈：结束时−{v}。`,
mtieM:`已知关系：你们的对决按本轮平均分计算。`,mtieT:`已知关系`,mtieD:`情侣、室友……：他们的对决按本轮平均分计算，决赛中也不会相遇。彼此认识没有任何优势。`,mtieH:`点两个名字把他们连起来（或解开）。`,mtie0:`没有声明的关系。`});
GMK2('he',{r_msk:`בכל סבב (4 עד 6, אף אחד לא יודע כמה) את/ה במסכה מול 1 או 2 שחקנים: כתבו הודעה אנונימית, ואז בחרו בסוד לחלוק או לשמור — מול כל אחד. חלוקה הדדית שווה 4 (אחר כך 3, ואז 2 מתוך הרגל) ומרחיבה את הרשת (+2, +4, +6… מהאדם השני); שמירה שווה 4 מול מי שחולק (לו 1) או 2, אבל מדביקה לך 🦈 שכולם רואים (−1 בסוף, −4 בגניבה בגמר), אלא אם לשני כבר היה אחד. שני הראשונים משחקים על 16 נקודות: שניהם חולקים — 8 לכל אחד, אחד גונב — הכול שלו, שניהם גונבים — ‎−8 לכל אחד.`,
mrep:`הרגל: כבר חלקתם יחד, זה שווה פחות.`,mfinC:`שניהם חולקים: מתחלקים. אחד גונב: לוקח הכול, פחות 4 לכל 🦈. שניהם גונבים: ‎−8 לכל אחד.`,
mshT:`כבר שמר/ה מול מישהו שחלק`,mshD:`כבר בגד/ה במישהו שחלק. שמירה מול 🦈 לא מסמנת אותך.`,myshk:`יש עליך {v} 🦈: ‎−{v} בסוף.`,
mtieM:`קשר ידוע: הדו־קרב שלכם שווה את ממוצע הסבב.`,mtieT:`קשרים ידועים`,mtieD:`זוג, שותפים לדירה…: הדו־קרב שלהם שווה את ממוצע הסבב והם אף פעם לא נפגשים בגמר. היכרות לא נותנת יתרון.`,mtieH:`הקישו על שני שמות כדי לקשר (או לנתק).`,mtie0:`לא הוצהר קשר.`});
GMK2('pt',{r_msk:`Em cada rodada (de 4 a 6, ninguém sabe quantas) você está mascarado diante de 1 ou 2 jogadores: escreva uma mensagem anônima e escolha em segredo Dividir ou Guardar com cada um. Dividir dos dois lados dá 4 (depois 3, depois 2 por costume) e aumenta sua rede (+2, +4, +6… a partir da 2ª pessoa); Guardar dá 4 contra quem divide (1 para ele) ou 2, mas cola em você um 🦈 que todos veem (−1 no fim, −4 num roubo final), a menos que o outro já tivesse um. Os dois primeiros disputam 16 pontos: ambos Dividir 8 cada, um só Rouba tudo, ambos Roubam −8 cada.`,
mrep:`Costume: vocês já tinham dividido juntos, rende menos.`,mfinC:`Ambos Dividir: divide-se. Um só Rouba: leva tudo, menos 4 por 🦈. Ambos Roubam: −8 cada.`,
mshT:`Já guardou contra alguém que dividia`,mshD:`já traiu alguém que dividia. Guardar contra um 🦈 não te marca.`,myshk:`Você carrega {v} 🦈: −{v} no fim.`,
mtieM:`Laço conhecido: o seu frente a frente vale a média da rodada.`,mtieT:`Laços conhecidos`,mtieD:`Casal, colegas de casa…: o frente a frente deles vale a média da rodada e eles nunca se enfrentam na final. Se conhecer não dá vantagem.`,mtieH:`Toque em dois nomes para ligá-los (ou desligar).`,mtie0:`Nenhum laço declarado.`});
/* 📖 Tutoriels animés : légendes (noms et mots d'exemple localisés) */
const GTUT=(l,o)=>Object.assign(GI18N[l].ui,o);
GTUT('fr',{tuB:`Les règles en images`,tuOk:`J'ai compris`,tuAgain:`Revoir`,tuAll:`Depuis le début`,tun:`Ana|Ben|Cléo|Dan`,tuw:`Plage|Sable|Soleil|Été`,
tu_bot1:`Chacun écrit en secret 2 ou 3 choses vraies sur soi, glissées dans des bouteilles.`,
tu_bot2:`Les bouteilles s'ouvrent une à une, sans nom : « J'ai déjà dormi dans un phare. » Qui l'a écrite ?`,
tu_bot3:`{a} et {c} votent pour {b}… c'était bien {b} : +2 chacune.`,
tu_bot4:`Personne ne trouve ton anecdote ? +3 pour toi. Seulement une partie ? +1.`,
tu_bot5:`À deux : écris 3 anecdotes, vraies ou inventées. Bonne devinette : +2 ; bluff qui passe : +2.`,
tu_pha1:`Une question s'allume : « Qui de nous partirait vivre seul sur une île ? »`,
tu_pha2:`Chacun vote pour la personne qui colle le mieux, même soi-même.`,
tu_pha3:`Le phare éclaire la majorité : {c}. Ceux qui ont voté {c} gagnent +1.`,
tu_pha4:`À deux : choisis l'un de vous, puis prédis le choix de l'autre. Bien vu : +1.`,
tu_vag1:`Un mot apparaît : « {w0} ». Écris vite le premier mot qui te vient.`,
tu_vag2:`{a} et {b} écrivent « {w1} », {c} écrit « {w2} ».`,
tu_vag3:`+1 par personne qui a écrit le même mot que toi, +1 de plus si vous êtes pile deux : {a} et {b} gagnent +2.`,
tu_vag4:`À deux : le même mot = +2. Sinon, trouvez un mot-pont qui relie les deux (« {w3} ») : +1.`,
tu_rad1:`Tu préfères nager avec les dauphins 🐬 ou voler avec les mouettes 🕊️ ?`,
tu_rad2:`Choisis en secret, puis parie sur ce que choisira la majorité.`,
tu_rad3:`🐬 l'emporte 3 à 1. Bon pari : +1 ; bon pari alors que toi tu étais dans la minorité : +2, comme {d}.`,
tu_rad4:`À deux : choisis, puis devine le choix de l'autre. Bien vu : +1.`,
tu_pec1:`Tout le monde plonge ensemble. Le sac commun est visible de tous : 12 perles 🦪, 2 méduses 🪼, 5 requins 🦈.`,
tu_pec2:`Chaque perle tirée va dans le filet de CHAQUE plongeur encore en bas : ici +3 pour tous.`,
tu_pec3:`Après chaque tirage, chacun choisit en secret : replonger, ou remonter. {b} remonte : son filet passe à l'abri dans son coffre.`,
tu_pec4:`Le 1er requin ne fait rien… mais au 2e, ceux encore en bas perdent tout leur filet et la manche s'arrête.`,
tu_pec5:`La méduse pique le plus gros filet encore en bas : il perd la moitié.`,
tu_pec6:`Seul au fond ? Chaque perle compte double !`,
tu_pec7:`Après 3 ou 4 manches, on ouvre les coffres, secrets jusque-là : le plus riche gagne.`,
tu_pec8:`À deux, le Mérou 🐟 plonge avec vous : il remonte à 8 perles, ou dès 4 après un requin.`,
tu_arc1:`Une petite mer d'hexagones. Chacun a un bateau ⛵ sur le bord.`,
tu_arc2:`Chaque tour, tout le monde donne un ordre en secret ; tout se dévoile et se joue en même temps.`,
tu_arc3:`Naviguer : touche une case voisine, ton bateau s'y rend.`,
tu_arc4:`Bâtir : touche ta propre case pour y poser un îlot 🏝️.`,
tu_arc5:`Couler : sur l'îlot d'un autre, touche ta case. Impossible tant que son bateau est dessus ou à côté 🛡️ ; s'il s'éloigne, l'îlot coule.`,
tu_arc6:`Deux ordres sur la même case s'annulent : personne n'y va.`,
tu_arc7:`Tous les 4 tours, chaque îlot rapporte ses perles (3 au centre, moins vers le bord), puis la marée engloutit le bord. Le plus de perles gagne.`,
tu_msk1:`Chaque manche, tu es masqué face à 1 ou 2 joueurs : tu vois leur masque 🐙, jamais leur nom.`,
tu_msk2:`Écris-leur un message anonyme, puis choisis en secret : 🤝 Partager ou 🔒 Garder.`,
tu_msk3:`🤝 + 🤝 : 4 chacun, et un lien de plus dans ton réseau (bonus dès la 2e personne).`,
tu_msk4:`🔒 face à 🤝 : 4 pour toi, 1 pour l'autre… et un 🦈 que tous verront (−1 à la fin).`,
tu_msk5:`🔒 + 🔒 : 2 chacun. Garder face à un 🦈 ne te marque pas.`,
tu_msk6:`Finale à 16 points : les deux partagent, 8 chacun ; un seul vole, tout pour lui ; les deux volent, −8 chacun.`});
GTUT('en',{tuB:`Rules in pictures`,tuOk:`Got it`,tuAgain:`Replay`,tuAll:`From the start`,tun:`Ana|Ben|Cleo|Dan`,tuw:`Beach|Sand|Sun|Summer`,
tu_bot1:`Everyone secretly writes 2 or 3 true things about themselves, slipped into bottles.`,
tu_bot2:`The bottles open one by one, with no name: "I once slept in a lighthouse." Who wrote it?`,
tu_bot3:`{a} and {c} vote for {b}… and it was {b}: +2 each.`,
tu_bot4:`Nobody finds your story? +3 for you. Only some do? +1.`,
tu_bot5:`Two players: write 3 stories, true or made up. Right guess: +2; bluff that works: +2.`,
tu_pha1:`A question lights up: "Who among us would go live alone on an island?"`,
tu_pha2:`Everyone votes for the person who fits best, even themselves.`,
tu_pha3:`The lighthouse shines on the majority: {c}. Everyone who voted {c} gets +1.`,
tu_pha4:`Two players: pick one of you, then predict the other's pick. Right: +1.`,
tu_vag1:`A word appears: "{w0}". Quickly write the first word that comes to mind.`,
tu_vag2:`{a} and {b} write "{w1}", {c} writes "{w2}".`,
tu_vag3:`+1 for each person who wrote the same word as you, +1 more if there are exactly two of you: {a} and {b} get +2.`,
tu_vag4:`Two players: same word = +2. Otherwise, find a bridge word linking both ("{w3}"): +1.`,
tu_rad1:`Would you rather swim with dolphins 🐬 or fly with seagulls 🕊️?`,
tu_rad2:`Choose in secret, then bet on what the majority will choose.`,
tu_rad3:`🐬 wins 3 to 1. Right bet: +1; right bet while you were in the minority: +2, like {d}.`,
tu_rad4:`Two players: choose, then guess the other's choice. Right: +1.`,
tu_pec1:`Everyone dives together. The shared bag is visible to all: 12 pearls 🦪, 2 jellyfish 🪼, 5 sharks 🦈.`,
tu_pec2:`Each pearl drawn goes into the net of EVERY diver still down: here +3 for all.`,
tu_pec3:`After each draw, everyone secretly chooses: dive again, or surface. {b} surfaces: the net goes safely into the chest.`,
tu_pec4:`The 1st shark does nothing… but at the 2nd, those still down lose their whole net and the round ends.`,
tu_pec5:`The jellyfish stings the biggest net still down: it loses half.`,
tu_pec6:`Alone at the bottom? Every pearl counts double!`,
tu_pec7:`After 3 or 4 rounds, the chests open, secret until then: the richest wins.`,
tu_pec8:`With two players, the Grouper 🐟 dives with you: it surfaces at 8 pearls, or at 4 after a shark.`,
tu_arc1:`A small sea of hexagons. Everyone has a boat ⛵ on the edge.`,
tu_arc2:`Each turn, everyone gives an order in secret; then all are revealed and played at once.`,
tu_arc3:`Sail: tap a neighbouring cell and your boat goes there.`,
tu_arc4:`Build: tap your own cell to put an islet 🏝️ there.`,
tu_arc5:`Sink: on someone else's islet, tap your cell. Impossible while their boat is on it or next to it 🛡️; if it leaves, the islet sinks.`,
tu_arc6:`Two orders on the same cell cancel out: nobody goes there.`,
tu_arc7:`Every 4 turns, each islet yields its pearls (3 in the centre, fewer towards the edge), then the tide swallows the edge. Most pearls wins.`,
tu_msk1:`Each round, you're masked facing 1 or 2 players: you see their mask 🐙, never their name.`,
tu_msk2:`Write them an anonymous message, then secretly choose: 🤝 Share or 🔒 Keep.`,
tu_msk3:`🤝 + 🤝: 4 each, and one more link in your network (bonus from the 2nd person).`,
tu_msk4:`🔒 against 🤝: 4 for you, 1 for them… and a 🦈 everyone will see (−1 at the end).`,
tu_msk5:`🔒 + 🔒: 2 each. Keeping against a 🦈 doesn't mark you.`,
tu_msk6:`Final for 16 points: both share, 8 each; one steals, all for them; both steal, −8 each.`});
GTUT('es',{tuB:`Las reglas en imágenes`,tuOk:`Entendido`,tuAgain:`Repetir`,tuAll:`Desde el principio`,tun:`Ana|Ben|Cleo|Dan`,tuw:`Playa|Arena|Sol|Verano`,
tu_bot1:`Cada uno escribe en secreto 2 o 3 cosas verdaderas sobre sí, metidas en botellas.`,
tu_bot2:`Las botellas se abren una a una, sin nombre: «Una vez dormí en un faro». ¿Quién la escribió?`,
tu_bot3:`{a} y {c} votan por {b}… y era {b}: +2 cada una.`,
tu_bot4:`¿Nadie descubre tu anécdota? +3 para ti. ¿Solo una parte? +1.`,
tu_bot5:`A dos: escribe 3 anécdotas, verdaderas o inventadas. Acierto: +2; farol que cuela: +2.`,
tu_pha1:`Se enciende una pregunta: «¿Quién de nosotros se iría a vivir solo a una isla?»`,
tu_pha2:`Cada uno vota a la persona que mejor encaja, incluso a sí mismo.`,
tu_pha3:`El faro ilumina a la mayoría: {c}. Quienes votaron a {c} ganan +1.`,
tu_pha4:`A dos: elige a uno de los dos y predice la elección del otro. Acierto: +1.`,
tu_vag1:`Aparece una palabra: «{w0}». Escribe rápido la primera que se te ocurra.`,
tu_vag2:`{a} y {b} escriben «{w1}», {c} escribe «{w2}».`,
tu_vag3:`+1 por cada persona que escribió lo mismo que tú, +1 más si sois justo dos: {a} y {b} ganan +2.`,
tu_vag4:`A dos: misma palabra = +2. Si no, buscad una palabra puente que una ambas («{w3}»): +1.`,
tu_rad1:`¿Prefieres nadar con delfines 🐬 o volar con gaviotas 🕊️?`,
tu_rad2:`Elige en secreto y luego apuesta por lo que elegirá la mayoría.`,
tu_rad3:`🐬 gana 3 a 1. Apuesta acertada: +1; acertada estando tú en la minoría: +2, como {d}.`,
tu_rad4:`A dos: elige y adivina la elección del otro. Acierto: +1.`,
tu_pec1:`Todos bucean juntos. La bolsa común es visible para todos: 12 perlas 🦪, 2 medusas 🪼, 5 tiburones 🦈.`,
tu_pec2:`Cada perla sacada va a la red de CADA buceador que sigue abajo: aquí +3 para todos.`,
tu_pec3:`Tras cada tirada, cada uno elige en secreto: seguir buceando o subir. {b} sube: su red queda a salvo en su cofre.`,
tu_pec4:`El 1.er tiburón no hace nada… pero con el 2.º, quienes siguen abajo pierden toda su red y la ronda termina.`,
tu_pec5:`La medusa pica la red más grande que sigue abajo: pierde la mitad.`,
tu_pec6:`¿Solo en el fondo? ¡Cada perla cuenta doble!`,
tu_pec7:`Tras 3 o 4 rondas se abren los cofres, secretos hasta entonces: gana el más rico.`,
tu_pec8:`A dos, el Mero 🐟 bucea con vosotros: sube con 8 perlas, o con 4 tras un tiburón.`,
tu_arc1:`Un pequeño mar de hexágonos. Cada uno tiene un barco ⛵ en el borde.`,
tu_arc2:`Cada turno, todos dan una orden en secreto; luego todo se revela y se juega a la vez.`,
tu_arc3:`Navegar: toca una casilla vecina y tu barco va allí.`,
tu_arc4:`Construir: toca tu propia casilla para poner un islote 🏝️.`,
tu_arc5:`Hundir: en el islote de otro, toca tu casilla. Imposible mientras su barco esté encima o al lado 🛡️; si se aleja, el islote se hunde.`,
tu_arc6:`Dos órdenes sobre la misma casilla se anulan: nadie va.`,
tu_arc7:`Cada 4 turnos, cada islote da sus perlas (3 en el centro, menos hacia el borde) y la marea se traga el borde. Gana quien tenga más perlas.`,
tu_msk1:`Cada ronda estás enmascarado frente a 1 o 2 jugadores: ves su máscara 🐙, nunca su nombre.`,
tu_msk2:`Escríbeles un mensaje anónimo y elige en secreto: 🤝 Compartir o 🔒 Guardar.`,
tu_msk3:`🤝 + 🤝: 4 cada uno y un vínculo más en tu red (bonus desde la 2.ª persona).`,
tu_msk4:`🔒 frente a 🤝: 4 para ti, 1 para el otro… y un 🦈 que todos verán (−1 al final).`,
tu_msk5:`🔒 + 🔒: 2 cada uno. Guardar frente a un 🦈 no te marca.`,
tu_msk6:`Final por 16 puntos: ambos comparten, 8 cada uno; uno roba, todo para él; ambos roban, −8 cada uno.`});
GTUT('it',{tuB:`Le regole per immagini`,tuOk:`Ho capito`,tuAgain:`Rivedi`,tuAll:`Dall'inizio`,tun:`Ana|Ben|Cleo|Dan`,tuw:`Spiaggia|Sabbia|Sole|Estate`,
tu_bot1:`Ognuno scrive in segreto 2 o 3 cose vere su di sé, infilate nelle bottiglie.`,
tu_bot2:`Le bottiglie si aprono una a una, senza nome: «Una volta ho dormito in un faro». Chi l'ha scritto?`,
tu_bot3:`{a} e {c} votano {b}… ed era proprio {b}: +2 a testa.`,
tu_bot4:`Nessuno indovina il tuo aneddoto? +3 per te. Solo una parte? +1.`,
tu_bot5:`In due: scrivi 3 aneddoti, veri o inventati. Indovinato: +2; bluff riuscito: +2.`,
tu_pha1:`Si accende una domanda: «Chi di noi andrebbe a vivere da solo su un'isola?»`,
tu_pha2:`Ognuno vota la persona più adatta, anche se stesso.`,
tu_pha3:`Il faro illumina la maggioranza: {c}. Chi ha votato {c} prende +1.`,
tu_pha4:`In due: scegli uno di voi, poi prevedi la scelta dell'altro. Giusto: +1.`,
tu_vag1:`Appare una parola: «{w0}». Scrivi subito la prima che ti viene in mente.`,
tu_vag2:`{a} e {b} scrivono «{w1}», {c} scrive «{w2}».`,
tu_vag3:`+1 per ogni persona che ha scritto la tua stessa parola, +1 in più se siete esattamente in due: {a} e {b} prendono +2.`,
tu_vag4:`In due: stessa parola = +2. Altrimenti trovate una parola ponte che le unisca («{w3}»): +1.`,
tu_rad1:`Preferisci nuotare con i delfini 🐬 o volare con i gabbiani 🕊️?`,
tu_rad2:`Scegli in segreto, poi scommetti su cosa sceglierà la maggioranza.`,
tu_rad3:`🐬 vince 3 a 1. Scommessa giusta: +1; giusta mentre tu eri in minoranza: +2, come {d}.`,
tu_rad4:`In due: scegli, poi indovina la scelta dell'altro. Giusto: +1.`,
tu_pec1:`Tutti si immergono insieme. Il sacco comune è visibile a tutti: 12 perle 🦪, 2 meduse 🪼, 5 squali 🦈.`,
tu_pec2:`Ogni perla pescata va nella rete di OGNI sub ancora sott'acqua: qui +3 per tutti.`,
tu_pec3:`Dopo ogni estrazione, ognuno sceglie in segreto: rituffarsi o risalire. {b} risale: la sua rete va al sicuro nel forziere.`,
tu_pec4:`Il 1° squalo non fa nulla… ma al 2°, chi è ancora sotto perde tutta la rete e la manche finisce.`,
tu_pec5:`La medusa punge la rete più grande ancora sott'acqua: perde metà.`,
tu_pec6:`Solo sul fondo? Ogni perla vale doppio!`,
tu_pec7:`Dopo 3 o 4 manche si aprono i forzieri, segreti fino ad allora: vince il più ricco.`,
tu_pec8:`In due, la Cernia 🐟 si immerge con voi: risale a 8 perle, o a 4 dopo uno squalo.`,
tu_arc1:`Un piccolo mare di esagoni. Ognuno ha una barca ⛵ sul bordo.`,
tu_arc2:`Ogni turno tutti danno un ordine in segreto; poi tutto si rivela e si gioca insieme.`,
tu_arc3:`Navigare: tocca una casella vicina e la tua barca ci va.`,
tu_arc4:`Costruire: tocca la tua casella per metterci un isolotto 🏝️.`,
tu_arc5:`Affondare: sull'isolotto di un altro, tocca la tua casella. Impossibile finché la sua barca è sopra o accanto 🛡️; se si allontana, l'isolotto affonda.`,
tu_arc6:`Due ordini sulla stessa casella si annullano: nessuno ci va.`,
tu_arc7:`Ogni 4 turni ogni isolotto rende le sue perle (3 al centro, meno verso il bordo), poi la marea inghiotte il bordo. Vince chi ha più perle.`,
tu_msk1:`Ogni manche sei mascherato davanti a 1 o 2 giocatori: vedi la loro maschera 🐙, mai il nome.`,
tu_msk2:`Scrivi loro un messaggio anonimo, poi scegli in segreto: 🤝 Condividi o 🔒 Tieni.`,
tu_msk3:`🤝 + 🤝: 4 a testa e un legame in più nella tua rete (bonus dalla 2ª persona).`,
tu_msk4:`🔒 contro 🤝: 4 per te, 1 per l'altro… e uno 🦈 che tutti vedranno (−1 alla fine).`,
tu_msk5:`🔒 + 🔒: 2 a testa. Tenere contro uno 🦈 non ti marchia.`,
tu_msk6:`Finale da 16 punti: entrambi condividono, 8 a testa; uno ruba, tutto a lui; entrambi rubano, −8 a testa.`});
GTUT('de',{tuB:`Regeln in Bildern`,tuOk:`Verstanden`,tuAgain:`Nochmal`,tuAll:`Von vorn`,tun:`Ana|Ben|Cleo|Dan`,tuw:`Strand|Sand|Sonne|Sommer`,
tu_bot1:`Alle schreiben heimlich 2 oder 3 wahre Dinge über sich, die in Flaschen landen.`,
tu_bot2:`Die Flaschen öffnen sich nacheinander, ohne Namen: „Ich habe mal in einem Leuchtturm geschlafen." Wer war's?`,
tu_bot3:`{a} und {c} stimmen für {b}… und es war {b}: je +2.`,
tu_bot4:`Niemand errät deine Anekdote? +3 für dich. Nur ein Teil? +1.`,
tu_bot5:`Zu zweit: schreib 3 Anekdoten, wahr oder erfunden. Richtig geraten: +2; Bluff klappt: +2.`,
tu_pha1:`Eine Frage leuchtet auf: „Wer von uns würde allein auf eine Insel ziehen?"`,
tu_pha2:`Alle stimmen für die Person, die am besten passt, auch für sich selbst.`,
tu_pha3:`Der Leuchtturm strahlt die Mehrheit an: {c}. Wer {c} gewählt hat, bekommt +1.`,
tu_pha4:`Zu zweit: wähle einen von euch und sag die Wahl des anderen voraus. Richtig: +1.`,
tu_vag1:`Ein Wort erscheint: „{w0}". Schreib schnell das erste Wort, das dir einfällt.`,
tu_vag2:`{a} und {b} schreiben „{w1}", {c} schreibt „{w2}".`,
tu_vag3:`+1 pro Person mit demselben Wort wie du, +1 extra, wenn ihr genau zwei seid: {a} und {b} bekommen +2.`,
tu_vag4:`Zu zweit: gleiches Wort = +2. Sonst findet ein Brückenwort, das beide verbindet („{w3}"): +1.`,
tu_rad1:`Lieber mit Delfinen schwimmen 🐬 oder mit Möwen fliegen 🕊️?`,
tu_rad2:`Wähle geheim und wette dann, was die Mehrheit wählt.`,
tu_rad3:`🐬 gewinnt 3 zu 1. Richtige Wette: +1; richtig, obwohl du in der Minderheit warst: +2, wie {d}.`,
tu_rad4:`Zu zweit: wähle und errate die Wahl des anderen. Richtig: +1.`,
tu_pec1:`Alle tauchen zusammen. Der gemeinsame Beutel ist für alle sichtbar: 12 Perlen 🦪, 2 Quallen 🪼, 5 Haie 🦈.`,
tu_pec2:`Jede gezogene Perle landet im Netz JEDER Person, die noch unten ist: hier +3 für alle.`,
tu_pec3:`Nach jedem Zug wählen alle geheim: weitertauchen oder auftauchen. {b} taucht auf: das Netz kommt sicher in die Truhe.`,
tu_pec4:`Der 1. Hai tut nichts… aber beim 2. verlieren alle, die noch unten sind, ihr ganzes Netz und die Runde endet.`,
tu_pec5:`Die Qualle sticht das größte Netz unten: es verliert die Hälfte.`,
tu_pec6:`Allein am Grund? Jede Perle zählt doppelt!`,
tu_pec7:`Nach 3 oder 4 Runden öffnen sich die bis dahin geheimen Truhen: die reichste gewinnt.`,
tu_pec8:`Zu zweit taucht der Zackenbarsch 🐟 mit: er taucht bei 8 Perlen auf, nach einem Hai schon bei 4.`,
tu_arc1:`Ein kleines Meer aus Sechsecken. Jede Person hat ein Boot ⛵ am Rand.`,
tu_arc2:`Jede Runde geben alle geheim einen Befehl; dann wird alles aufgedeckt und gleichzeitig ausgeführt.`,
tu_arc3:`Segeln: tippe ein Nachbarfeld an, dein Boot fährt dorthin.`,
tu_arc4:`Bauen: tippe dein eigenes Feld an, um eine Insel 🏝️ zu setzen.`,
tu_arc5:`Versenken: auf der Insel eines anderen tippst du dein Feld an. Geht nicht, solange sein Boot darauf oder daneben ist 🛡️; fährt es weg, versinkt die Insel.`,
tu_arc6:`Zwei Befehle auf dasselbe Feld heben sich auf: niemand fährt hin.`,
tu_arc7:`Alle 4 Runden bringt jede Insel ihre Perlen (3 in der Mitte, weniger zum Rand), dann verschluckt die Flut den Rand. Die meisten Perlen gewinnen.`,
tu_msk1:`Jede Runde stehst du maskiert 1 oder 2 Leuten gegenüber: du siehst ihre Maske 🐙, nie ihren Namen.`,
tu_msk2:`Schreib ihnen eine anonyme Nachricht und wähle dann geheim: 🤝 Teilen oder 🔒 Behalten.`,
tu_msk3:`🤝 + 🤝: je 4 und eine Verbindung mehr in deinem Netz (Bonus ab der 2. Person).`,
tu_msk4:`🔒 gegen 🤝: 4 für dich, 1 für die andere Person… und ein 🦈, den alle sehen (−1 am Ende).`,
tu_msk5:`🔒 + 🔒: je 2. Behalten gegen einen 🦈 markiert dich nicht.`,
tu_msk6:`Finale um 16 Punkte: beide teilen, je 8; einer stiehlt, alles für ihn; beide stehlen, je −8.`});
GTUT('ru',{tuB:`Правила в картинках`,tuOk:`Понятно`,tuAgain:`Ещё раз`,tuAll:`С начала`,tun:`Аня|Бен|Клео|Дэн`,tuw:`Пляж|Песок|Солнце|Лето`,
tu_bot1:`Каждый тайно пишет 2–3 правдивых факта о себе — они уплывают в бутылках.`,
tu_bot2:`Бутылки открываются по одной, без имени: «Однажды я ночевал(а) в маяке». Кто это написал?`,
tu_bot3:`{a} и {c} голосуют за {b}… и это действительно {b}: каждой +2.`,
tu_bot4:`Никто не угадал твою историю? Тебе +3. Угадала только часть? +1.`,
tu_bot5:`Вдвоём: напиши 3 истории, правдивые или выдуманные. Угадал(а): +2; удачный блеф: +2.`,
tu_pha1:`Загорается вопрос: «Кто из нас уехал бы жить один на остров?»`,
tu_pha2:`Каждый голосует за того, кто подходит лучше всего, даже за себя.`,
tu_pha3:`Маяк освещает большинство: {c}. Все, кто голосовал за {c}, получают +1.`,
tu_pha4:`Вдвоём: выбери одного из вас и предскажи выбор другого. Угадал(а): +1.`,
tu_vag1:`Появляется слово: «{w0}». Быстро напиши первое, что пришло в голову.`,
tu_vag2:`{a} и {b} пишут «{w1}», {c} пишет «{w2}».`,
tu_vag3:`+1 за каждого, кто написал то же слово, и ещё +1, если вас ровно двое: {a} и {b} получают +2.`,
tu_vag4:`Вдвоём: одинаковое слово = +2. Иначе найдите слово-мост между ними («{w3}»): +1.`,
tu_rad1:`Что лучше: плавать с дельфинами 🐬 или летать с чайками 🕊️?`,
tu_rad2:`Выбери тайно, затем поставь на то, что выберет большинство.`,
tu_rad3:`🐬 побеждает 3:1. Верная ставка: +1; верная, хотя сам(а) был(а) в меньшинстве: +2, как {d}.`,
tu_rad4:`Вдвоём: выбери и угадай выбор другого. Угадал(а): +1.`,
tu_pec1:`Все ныряют вместе. Общий мешок виден всем: 12 жемчужин 🦪, 2 медузы 🪼, 5 акул 🦈.`,
tu_pec2:`Каждая вытянутая жемчужина идёт в сеть КАЖДОГО, кто ещё внизу: здесь всем +3.`,
tu_pec3:`После каждого вытягивания все тайно выбирают: нырять дальше или всплыть. {b} всплывает: сеть уходит в сундук, в безопасность.`,
tu_pec4:`1-я акула ничего не делает… но на 2-й все, кто внизу, теряют всю сеть, и раунд заканчивается.`,
tu_pec5:`Медуза жалит самую большую сеть внизу: та теряет половину.`,
tu_pec6:`Один на дне? Каждая жемчужина считается дважды!`,
tu_pec7:`Через 3–4 раунда открываются сундуки, до этого тайные: побеждает самый богатый.`,
tu_pec8:`Вдвоём с вами ныряет Групер 🐟: он всплывает на 8 жемчужинах, а после акулы — уже на 4.`,
tu_arc1:`Маленькое море из шестиугольников. У каждого лодка ⛵ на краю.`,
tu_arc2:`Каждый ход все тайно отдают приказ; затем всё раскрывается и выполняется одновременно.`,
tu_arc3:`Плыть: нажми соседнюю клетку — лодка поплывёт туда.`,
tu_arc4:`Строить: нажми свою клетку, чтобы поставить островок 🏝️.`,
tu_arc5:`Топить: на чужом островке нажми свою клетку. Нельзя, пока его лодка на нём или рядом 🛡️; уплывёт — островок утонет.`,
tu_arc6:`Два приказа на одну клетку отменяют друг друга: туда никто не идёт.`,
tu_arc7:`Каждые 4 хода каждый островок приносит жемчуг (3 в центре, меньше к краю), затем прилив поглощает край. Больше всех жемчуга — победа.`,
tu_msk1:`Каждый раунд ты в маске против 1 или 2 игроков: видишь их маску 🐙, но не имя.`,
tu_msk2:`Напиши им анонимное сообщение, затем тайно выбери: 🤝 Делиться или 🔒 Оставить.`,
tu_msk3:`🤝 + 🤝: по 4 и ещё одна связь в твоей сети (бонус со 2-го человека).`,
tu_msk4:`🔒 против 🤝: тебе 4, другому 1… и 🦈, которую все увидят (−1 в конце).`,
tu_msk5:`🔒 + 🔒: по 2. Оставить против 🦈 — не помечает тебя.`,
tu_msk6:`Финал на 16 очков: оба делятся — по 8; один крадёт — всё ему; оба крадут — по −8.`});
GTUT('zh',{tuB:`图解规则`,tuOk:`明白了`,tuAgain:`再看一遍`,tuAll:`从头开始`,tun:`安娜|本|克莱奥|丹`,tuw:`海滩|沙子|太阳|夏天`,
tu_bot1:`每人秘密写下2到3件关于自己的真事，装进漂流瓶。`,
tu_bot2:`瓶子一个个打开，没有名字：“我曾经在灯塔里睡过一晚。”是谁写的？`,
tu_bot3:`{a}和{c}投给{b}……果然是{b}：各+2。`,
tu_bot4:`没人猜中你的故事？你+3。只有部分人猜中？+1。`,
tu_bot5:`两人局：写3个故事，可真可假。猜对+2；骗过对方+2。`,
tu_pha1:`一个问题亮起：“我们中谁会独自去岛上生活？”`,
tu_pha2:`每人投给最符合的人，也可以投自己。`,
tu_pha3:`灯塔照亮多数：{c}。投给{c}的人各+1。`,
tu_pha4:`两人局：选你们中的一个，再预测对方的选择。猜对+1。`,
tu_vag1:`出现一个词：“{w0}”。快写下你想到的第一个词。`,
tu_vag2:`{a}和{b}写了“{w1}”，{c}写了“{w2}”。`,
tu_vag3:`每有一人和你写得一样+1，正好两人相同再+1：{a}和{b}各+2。`,
tu_vag4:`两人局：同一个词+2。否则找一个连接两词的桥梁词（“{w3}”）：+1。`,
tu_rad1:`你更愿意和海豚一起游泳🐬，还是和海鸥一起飞翔🕊️？`,
tu_rad2:`秘密选择，然后押注多数人会选什么。`,
tu_rad3:`🐬以3比1获胜。押对+1；自己在少数派却押对+2，比如{d}。`,
tu_rad4:`两人局：做选择，再猜对方的选择。猜对+1。`,
tu_pec1:`大家一起下潜。公共袋子人人可见：12颗珍珠🦪、2只水母🪼、5条鲨鱼🦈。`,
tu_pec2:`每抽出一颗珍珠，都会放进每个仍在水下的人的网里：这里每人+3。`,
tu_pec3:`每次抽完，大家秘密选择：继续下潜或上浮。{b}上浮：网里的珍珠安全放进宝箱。`,
tu_pec4:`第1条鲨鱼无事发生……但第2条出现时，仍在水下的人失去整张网，本轮结束。`,
tu_pec5:`水母会蛰水下最大的那张网：它失去一半。`,
tu_pec6:`独自在海底？每颗珍珠都算双倍！`,
tu_pec7:`3或4轮后打开一直保密的宝箱：最富有的人获胜。`,
tu_pec8:`两人局时，石斑鱼🐟和你们一起下潜：它在8颗珍珠时上浮，遇到鲨鱼后4颗就上浮。`,
tu_arc1:`一片小小的六边形海域。每人在边缘有一艘船⛵。`,
tu_arc2:`每回合，大家秘密下达命令；然后全部揭晓并同时执行。`,
tu_arc3:`航行：点击相邻格子，你的船就开过去。`,
tu_arc4:`建造：点击你所在的格子，放下一座小岛🏝️。`,
tu_arc5:`击沉：在别人的小岛上点击你的格子。只要对方的船在岛上或旁边🛡️就不行；它一离开，小岛就沉了。`,
tu_arc6:`两个命令指向同一格会互相抵消：谁都去不了。`,
tu_arc7:`每4回合，每座小岛产出珍珠（中心3颗，越靠边越少），然后潮水吞没边缘。珍珠最多者获胜。`,
tu_msk1:`每轮你戴着面具面对1或2名玩家：你只看到他们的面具🐙，看不到名字。`,
tu_msk2:`给他们写一条匿名消息，然后秘密选择：🤝分享或🔒独占。`,
tu_msk3:`🤝+🤝：各得4分，你的人脉多一条联系（从第2个人起有奖励）。`,
tu_msk4:`🔒对🤝：你得4分，对方1分……还会带上人人可见的🦈（结束时−1）。`,
tu_msk5:`🔒+🔒：各2分。对🦈独占不会给你打标记。`,
tu_msk6:`16分决赛：都分享各8分；一人偷全归他；都偷各−8。`});
GTUT('he',{tuB:`החוקים בתמונות`,tuOk:`הבנתי`,tuAgain:`שוב`,tuAll:`מההתחלה`,tun:`אנה|בן|קלאו|דן`,tuw:`חוף|חול|שמש|קיץ`,
tu_bot1:`כל אחד כותב בסוד 2 או 3 דברים אמיתיים על עצמו, שנכנסים לבקבוקים.`,
tu_bot2:`הבקבוקים נפתחים אחד אחד, בלי שם: „פעם ישנתי במגדלור". מי כתב?`,
tu_bot3:`{a} ו{c} מצביעות ל{b}… וזה באמת {b}: ‎+2 לכל אחת.`,
tu_bot4:`אף אחד לא מגלה את הסיפור שלך? ‎+3 לך. רק חלק? ‎+1.`,
tu_bot5:`בשניים: כתבו 3 סיפורים, אמיתיים או מומצאים. ניחוש נכון: ‎+2; בלוף שעובד: ‎+2.`,
tu_pha1:`שאלה נדלקת: „מי מאיתנו היה עובר לגור לבד על אי?"`,
tu_pha2:`כל אחד מצביע למי שהכי מתאים, גם לעצמו.`,
tu_pha3:`המגדלור מאיר את הרוב: {c}. מי שהצביע ל{c} מקבל ‎+1.`,
tu_pha4:`בשניים: בחרו אחד מכם, ואז נחשו את הבחירה של השני. נכון: ‎+1.`,
tu_vag1:`מופיעה מילה: „{w0}". כתבו מהר את המילה הראשונה שעולה לכם.`,
tu_vag2:`{a} ו{b} כותבים „{w1}", {c} כותבת „{w2}".`,
tu_vag3:`‎+1 על כל מי שכתב את אותה מילה כמוך, ועוד ‎+1 אם אתם בדיוק שניים: {a} ו{b} מקבלים ‎+2.`,
tu_vag4:`בשניים: אותה מילה = ‎+2. אחרת, מצאו מילת גשר שמחברת ביניהן („{w3}"): ‎+1.`,
tu_rad1:`מה עדיף: לשחות עם דולפינים 🐬 או לעוף עם שחפים 🕊️?`,
tu_rad2:`בחרו בסוד, ואז המרו על מה שהרוב יבחר.`,
tu_rad3:`🐬 מנצח 3 מול 1. הימור נכון: ‎+1; הימור נכון כשאתם במיעוט: ‎+2, כמו {d}.`,
tu_rad4:`בשניים: בחרו, ואז נחשו את הבחירה של השני. נכון: ‎+1.`,
tu_pec1:`כולם צוללים יחד. השק המשותף גלוי לכולם: 12 פנינים 🦪, 2 מדוזות 🪼, 5 כרישים 🦈.`,
tu_pec2:`כל פנינה שנשלפת נכנסת לרשת של כל מי שעדיין למטה: כאן ‎+3 לכולם.`,
tu_pec3:`אחרי כל שליפה, כל אחד בוחר בסוד: להמשיך לצלול או לעלות. {b} עולה: הרשת עוברת בבטחה לתיבה.`,
tu_pec4:`הכריש הראשון לא עושה כלום… אבל בשני, מי שעדיין למטה מאבד את כל הרשת והסבב נגמר.`,
tu_pec5:`המדוזה עוקצת את הרשת הגדולה ביותר למטה: היא מאבדת חצי.`,
tu_pec6:`לבד בקרקעית? כל פנינה שווה כפול!`,
tu_pec7:`אחרי 3 או 4 סבבים פותחים את התיבות, סודיות עד אז: העשיר ביותר מנצח.`,
tu_pec8:`בשניים, הדקר 🐟 צולל איתכם: הוא עולה ב־8 פנינים, או כבר ב־4 אחרי כריש.`,
tu_arc1:`ים קטן של משושים. לכל אחד סירה ⛵ בקצה.`,
tu_arc2:`בכל תור כולם נותנים פקודה בסוד; ואז הכול נחשף ומתבצע בבת אחת.`,
tu_arc3:`להפליג: הקישו על משבצת שכנה והסירה תגיע אליה.`,
tu_arc4:`לבנות: הקישו על המשבצת שלכם כדי להניח אי 🏝️.`,
tu_arc5:`להטביע: על אי של מישהו אחר, הקישו על המשבצת שלכם. אי אפשר כל עוד הסירה שלו עליו או לידו 🛡️; אם היא מתרחקת, האי טובע.`,
tu_arc6:`שתי פקודות לאותה משבצת מבטלות זו את זו: אף אחד לא מגיע.`,
tu_arc7:`כל 4 תורות כל אי מניב פנינים (3 במרכז, פחות לכיוון הקצה), ואז הגאות בולעת את הקצה. מי שאוסף הכי הרבה פנינים מנצח.`,
tu_msk1:`בכל סבב את/ה במסכה מול 1 או 2 שחקנים: רואים את המסכה שלהם 🐙, אף פעם לא את השם.`,
tu_msk2:`כתבו להם הודעה אנונימית, ואז בחרו בסוד: 🤝 לחלוק או 🔒 לשמור.`,
tu_msk3:`🤝 + 🤝: 4 לכל אחד, ועוד קשר ברשת שלך (בונוס מהאדם השני).`,
tu_msk4:`🔒 מול 🤝: 4 לך, 1 לשני… ו־🦈 שכולם יראו (‎−1 בסוף).`,
tu_msk5:`🔒 + 🔒: 2 לכל אחד. שמירה מול 🦈 לא מסמנת אותך.`,
tu_msk6:`גמר על 16 נקודות: שניהם חולקים, 8 לכל אחד; אחד גונב, הכול שלו; שניהם גונבים, ‎−8 לכל אחד.`});
GTUT('pt',{tuB:`As regras em imagens`,tuOk:`Entendi`,tuAgain:`Rever`,tuAll:`Do começo`,tun:`Ana|Ben|Cleo|Dan`,tuw:`Praia|Areia|Sol|Verão`,
tu_bot1:`Cada um escreve em segredo 2 ou 3 coisas verdadeiras sobre si, colocadas em garrafas.`,
tu_bot2:`As garrafas se abrem uma a uma, sem nome: "Já dormi num farol." Quem escreveu?`,
tu_bot3:`{a} e {c} votam em {b}… e era {b} mesmo: +2 para cada uma.`,
tu_bot4:`Ninguém descobre a sua história? +3 para você. Só uma parte? +1.`,
tu_bot5:`A dois: escreva 3 histórias, verdadeiras ou inventadas. Acerto: +2; blefe que cola: +2.`,
tu_pha1:`Uma pergunta acende: "Quem de nós iria morar sozinho numa ilha?"`,
tu_pha2:`Cada um vota na pessoa que mais combina, até em si mesmo.`,
tu_pha3:`O farol ilumina a maioria: {c}. Quem votou em {c} ganha +1.`,
tu_pha4:`A dois: escolha um de vocês e preveja a escolha do outro. Acertou: +1.`,
tu_vag1:`Aparece uma palavra: "{w0}". Escreva rápido a primeira que vier à cabeça.`,
tu_vag2:`{a} e {b} escrevem "{w1}", {c} escreve "{w2}".`,
tu_vag3:`+1 por pessoa que escreveu a mesma palavra que você, +1 a mais se forem exatamente dois: {a} e {b} ganham +2.`,
tu_vag4:`A dois: mesma palavra = +2. Senão, achem uma palavra-ponte que ligue as duas ("{w3}"): +1.`,
tu_rad1:`Você prefere nadar com golfinhos 🐬 ou voar com gaivotas 🕊️?`,
tu_rad2:`Escolha em segredo e aposte no que a maioria vai escolher.`,
tu_rad3:`🐬 vence por 3 a 1. Aposta certa: +1; certa estando você na minoria: +2, como {d}.`,
tu_rad4:`A dois: escolha e adivinhe a escolha do outro. Acertou: +1.`,
tu_pec1:`Todos mergulham juntos. O saco comum é visível a todos: 12 pérolas 🦪, 2 águas-vivas 🪼, 5 tubarões 🦈.`,
tu_pec2:`Cada pérola sorteada vai para a rede de CADA mergulhador ainda no fundo: aqui +3 para todos.`,
tu_pec3:`Após cada sorteio, cada um escolhe em segredo: mergulhar de novo ou subir. {b} sobe: a rede vai segura para o baú.`,
tu_pec4:`O 1º tubarão não faz nada… mas no 2º, quem ainda está no fundo perde a rede inteira e a rodada acaba.`,
tu_pec5:`A água-viva queima a maior rede ainda no fundo: ela perde metade.`,
tu_pec6:`Sozinho no fundo? Cada pérola vale o dobro!`,
tu_pec7:`Depois de 3 ou 4 rodadas, os baús se abrem, secretos até então: o mais rico vence.`,
tu_pec8:`A dois, a Garoupa 🐟 mergulha com vocês: sobe com 8 pérolas, ou com 4 depois de um tubarão.`,
tu_arc1:`Um pequeno mar de hexágonos. Cada um tem um barco ⛵ na borda.`,
tu_arc2:`A cada turno, todos dão uma ordem em segredo; depois tudo é revelado e jogado ao mesmo tempo.`,
tu_arc3:`Navegar: toque numa casa vizinha e seu barco vai até lá.`,
tu_arc4:`Construir: toque na sua própria casa para colocar uma ilhota 🏝️.`,
tu_arc5:`Afundar: na ilhota de outro, toque na sua casa. Impossível enquanto o barco dele estiver em cima ou ao lado 🛡️; se ele se afastar, a ilhota afunda.`,
tu_arc6:`Duas ordens para a mesma casa se anulam: ninguém vai.`,
tu_arc7:`A cada 4 turnos, cada ilhota rende suas pérolas (3 no centro, menos perto da borda), depois a maré engole a borda. Quem tiver mais pérolas vence.`,
tu_msk1:`Em cada rodada você está mascarado diante de 1 ou 2 jogadores: vê a máscara 🐙, nunca o nome.`,
tu_msk2:`Escreva uma mensagem anônima e escolha em segredo: 🤝 Dividir ou 🔒 Guardar.`,
tu_msk3:`🤝 + 🤝: 4 para cada e mais um laço na sua rede (bônus a partir da 2ª pessoa).`,
tu_msk4:`🔒 contra 🤝: 4 para você, 1 para o outro… e um 🦈 que todos verão (−1 no fim).`,
tu_msk5:`🔒 + 🔒: 2 para cada. Guardar contra um 🦈 não marca você.`,
tu_msk6:`Final valendo 16 pontos: os dois dividem, 8 cada; um rouba, tudo para ele; os dois roubam, −8 cada.`});
/* Réserves élargies (vague 2) : ~2-4× plus de contenus par ton + idées de Bouteilles (bot/bot1/bot2).
   Ajout en fin de liste : les index existants ne bougent pas, toutes les langues restent alignées sur fr. */
const GXP=(l,o)=>{for(const k in o)GI18N[l][k]=GI18N[l][k]?GI18N[l][k]+'|'+o[k]:o[k]};
GXP('fr',{pha:`a déjà parlé à un animal comme à un humain|ferait le meilleur capitaine de bateau|oublierait son propre anniversaire|a la playlist la plus gênante|rirait au pire moment|survivrait à une apocalypse zombie|élèverait des poules en ville|deviendrait maire de son village|se lèverait à 5 h pour voir le lever du soleil|mangerait la même chose tous les jours|a le plus de photos dans son téléphone|raterait son avion|lirait le mode d'emploi en entier|gagnerait un concours de mangeurs de crêpes|finira par vivre à l'étranger|remonte le moral de tout le monde|cuisine le mieux avec trois fois rien|garderait son calme dans une tempête|sauterait le premier dans l'eau glacée|achèterait une île en gagnant au loto|a la mémoire la plus impressionnante|a été pirate dans une autre vie|parle le plus en dormant|inventera un objet utile|se teindrait les cheveux en bleu|tomberait amoureux en vacances|chante le plus faux sous la douche|ferait le meilleur prof|ne pourrait pas vivre sans café|se perdrait même avec un GPS|ouvrira un restaurant|a le rire le plus contagieux|salue tout le quartier|se souvient de tous les anniversaires|traverserait l'océan à la voile|écrira un roman|est le plus mauvais perdant|dort le plus tard le week-end|tiendrait un mois sans téléphone|ferait fortune avec une idée folle|a le plus de plantes chez soi|ferait le meilleur détective|reconnaît une chanson en deux notes|partirait demain sans valise|range tout par couleur|a le plus de chaussures|devine le mieux un mensonge|se lancerait dans le stand-up|change le plus souvent de coiffure|parlerait aux dauphins s'il le pouvait|quitte toujours la fête en dernier|arrive toujours en avance|arrive toujours en retard|a le plus beau sourire|enverrait une lettre plutôt qu'un message|a le plus de talents cachés|cartonnerait en téléréalité|deviendrait gardien de phare|connaît par cœur les répliques d'un film|imite le mieux les accents|ferait le tour du monde à vélo|se réveille sans réveil|a déjà fait la sieste au travail|est le plus têtu|fait les meilleurs câlins|serait élu délégué de classe|négocie le mieux les prix|a le plus voyagé|craque le premier devant un dessert|garderait un secret même sous la torture|parlera le plus de langues|tiendrait le plus longtemps sans parler|trouverait un trésor en plongée|ferait pousser un potager sur son balcon|serait le meilleur colocataire|serait le pire colocataire|connaît le plus de blagues nulles|se fait des amis dans une file d'attente|a le plus d'énergie le matin|regarde la même série en boucle|ferait un super guide touristique|survivrait seul en forêt|dépenserait tout en voyages|offre les meilleurs cadeaux|demanderait un selfie à une star sans gêne|partirait le premier sur Mars|a le cœur le plus tendre|a toujours une excuse|resterait ami avec un ex|répond le plus vite aux messages|laisse les messages en « vu »|aurait pu être sportif de haut niveau|se mettrait à la poterie|connaît tous les potins|tient un journal intime|est le roi ou la reine du karaoké|vivrait en nomade dans un van|ferait le plus beau discours de mariage`,
pha1:`a le plus de conquêtes|enverrait une photo osée|a le rire le plus charmeur|a déjà eu un coup de foudre au premier regard|draguerait le serveur ou la serveuse|a le regard le plus troublant|dirait « je t'aime » en premier|ferait une déclaration en public|a déjà eu un crush sur un prof|danse le plus sensuellement|craque pour un accent|fait les compliments les plus troublants|a déjà embrassé un inconnu|a les rendez-vous les plus mémorables|pourrait séduire n'importe qui|met de la lingerie assortie au premier rendez-vous|a vécu le pire rendez-vous|adore les câlins du matin|a le plus de matchs sur les applis|sortirait avec deux personnes à la fois|écrirait une lettre d'amour enflammée|garde le plus de souvenirs de ses ex|a le parfum le plus envoûtant|se baignerait nu la nuit|a déjà fait une déclaration par erreur|craquerait pour un uniforme|gagnerait au jeu de la bouteille|a donné le baiser le plus long|prend l'initiative au premier rendez-vous|a déjà dragué quelqu'un ici`,
pha2:`a déjà dormi chez un inconnu après une soirée|a le plus de jouets intimes|l'a déjà fait dans une cabine d'essayage|regarde le plus de porno|a déjà joué un jeu de rôle coquin|a un dossier secret de photos osées|ferait un plan à trois|a déjà été surpris en plein acte|a le plus d'expérience au lit|a déjà couché avec l'ex d'un ami|testerait le bondage|a déjà fait l'amour en avion|dirait oui à un plan d'un soir ce soir|a déjà eu une aventure avec un collègue|parle le plus crûment au lit|a le fantasme le plus inavouable|a déjà fait un strip-tease|a déjà couché sans connaître le prénom|testerait un club libertin|l'a déjà fait plus de cinq fois dans une nuit|tournerait une sextape|a le plus d'histoires d'un soir|a déjà eu une panne au pire moment|l'a déjà fait dans la mer|enverrait un sexto à la mauvaise personne|a déjà acheté un jouet en cachette|aime être dominé|aime dominer|coucherait avec une célébrité sans hésiter|l'a déjà fait au travail`,
vag:`écume|sel|marée|phare|coquillage|tempête|voile|ancre|vague|corail|baleine|crabe|mouette|méduse|dauphin|carte|boussole|horizon|plongeur|sous-marin|épave|palmier|hamac|cocktail|glaçon|parapluie|rivière|désert|volcan|grotte|jungle|lac|pont|tour|château|village|arc-en-ciel|métro|éclair|brouillard|vélo|aurore|bus|fusée|robot|ordinateur|comète|planète|guitare|astronaute|tambour|chanson|danse|satellite|télescope|gâteau|microscope|fraise|pomme|banane|citron|laboratoire|hôpital|pain|soupe|thé|lait|miel|sucre|sel de mer|glace|bonbon|pique-nique|barbecue|cuisine|pharmacie|boulangerie|rose|arbre|feuille|automne|marché|printemps|week-end|supermarché|valise|passeport|hôtel|tente|feu de camp|lampe|bougie|restaurant|fenêtre|porte|clé|lit|oreiller|serveur|cauchemar|sommeil|réveil|matin|soir|minuit|horloge|calendrier|menu|fourchette|cahier|crayon|tableau|professeur|examen|bibliothèque|musée|cinéma|couteau|théâtre|cuillère|clown|assiette|casserole|licorne|fantôme|sorcière|château fort|chevalier|princesse|roi|couronne|or|argent|diamant|bijou|four|surprise|frigo|mensonge|vérité|amitié|famille|canapé|souvenir|photo|album|télévision|aventure|liberté|silence|bruit|rire|larme|colère|radio|joie|courage|chance|hasard|jeu|carte à jouer|dé|ballon|football|tennis|natation|plongée|surf|ski|course|médaille|victoire|défaite|équipe|journal|chien|cheval|lapin|oiseau|papillon|abeille|fourmi|serpent|tortue|lion|éléphant|singe|pingouin|ours|loup|renard|hibou`,
vag1:`œillade|clin d'œil|rougir|papillons|parfum|chandelle|tango|velours|soie|murmure|caresse|complicité|sourire|coup de foudre|pétales|bouquet|dîner|valse|nuque|épaule|cœur|baiser volé|tendresse|attirance|jalousie|lettre d'amour|bague|lune de miel|séduire|charme|plaisir|peau|lèvres|danse lente|draguer|crush|mystère|bain moussant|câliner|matin calme`,
vag2:`nu|fantasme|jouet|positions|porno|nude|gémir|libertin|seins|soutien-gorge|string|préliminaires|capote|gode|vibro|domination|soumission|fouet|cuir|latex|jacuzzi|voyeur|exhib|coquin|plan cul|sex-shop|position|orgie|levrette|missionnaire|gorge profonde|suçon|striptease|jarretelles|massage huilé|éjaculer|érection|tétons|cunnilingus|fellation`,
rad:`Vivre sous l'eau~Vivre dans les nuages|Un phare isolé~Un appartement en plein centre|Un an sans musique~Un an sans films|Toujours dire la vérité~Toujours mentir|Parler toutes les langues~Jouer de tous les instruments|Remonter le temps~Voir le futur|Être très drôle~Être très intelligent|Un printemps éternel~Un automne éternel|Voyager seul~Ne jamais voyager seul|Un dragon de compagnie~Un robot majordome|Ne plus jamais avoir faim~Ne plus jamais avoir sommeil|Vivre 200 ans~Vivre 10 vies courtes|Gagner au loto~Trouver l'amour de ta vie|Un super-pouvoir inutile~Pas de pouvoir du tout|Chanter comme une star~Danser comme une star|Une maison sur la plage~Un chalet à la montagne|Être célèbre~Être riche en secret|Pas de téléphone~Pas d'internet|Manger épicé à vie~Manger fade à vie|Te souvenir de tout~Oublier quand tu veux|Être invisible un jour~Voler une heure|Un tour du monde en bateau~Un tour du monde en train|Ne plus jamais marcher~Ne plus jamais courir|Être un pirate~Être un explorateur|Tout savoir sur le passé~Tout savoir sur l'espace|Travailler de nuit~Travailler à 5 h du matin|Un festin chaque soir~Un voyage chaque mois|Avoir un jumeau~Être enfant unique|Rire à chaque phrase~Pleurer à chaque film|Une plage déserte~Un festival bondé|Pouvoir respirer sous l'eau~Ne jamais avoir froid|Être un chat~Être un chien|Une vie calme~Une vie pleine d'aventures|Habiter sur un bateau~Habiter dans une cabane|Changer de prénom~Changer de pays|Être le meilleur dans un domaine~Être bon partout|Savoir piloter~Savoir naviguer|Pas de dessert à vie~Pas de fromage à vie|Le premier sur la Lune~Le premier au fond des océans|Écrire un best-seller~Composer un tube|Toujours avoir 10 minutes de retard~Toujours 30 minutes d'avance|Un ami fidèle~Dix amis sympas|Revivre ton meilleur jour~Vivre un jour inconnu|Un majordome~Un chef cuisinier|Que tes pensées s'affichent~Que ton historique s'affiche|Un sac sans fond~Une porte vers n'importe où|Pas de miroir~Pas de photo|Être un géant~Être minuscule|Parler en rimes~Chanter au lieu de parler|Chaque jour une surprise~Chaque jour pareil et parfait`,
rad1:`Un rendez-vous au musée~Un rendez-vous à la fête foraine|Un rendez-vous sur un bateau~Dans une cabane|Une lettre d'amour~Une sérénade|Le coup de foudre~L'amitié qui devient amour|Cuisiner ensemble~Se faire livrer au lit|Un rendez-vous surprise~Un rendez-vous parfaitement prévu|Un amour de vacances~Un amour de bureau|Se tenir la main~Se tenir par la taille|Un partenaire drôle~Un partenaire mystérieux|Danser un slow~Danser la salsa|Petit-déjeuner au lit~Dîner aux chandelles|Draguer par message~Draguer en face|Un tatouage assorti~Des bagues assorties|Dormir collés~Dormir chacun son côté|Un week-end à Venise~Un week-end sur une île|Faire le premier pas~Attendre qu'on le fasse|Un surnom mignon~Ton vrai prénom murmuré|Un regard qui dure~Un sourire en coin|Un pique-nique au bord de l'eau~Un toit-terrasse en ville|Un baiser volé~Un baiser attendu`,
rad2:`Sous la douche~Sur la machine à laver|Dominer~Être dominé|Devant un miroir~Les yeux bandés|Un plan d'un soir~Un sex-friend régulier|Un jouet~Un massage|Le jacuzzi~Le sauna|Les menottes~Les plumes|Des mots crus~Des gémissements|Rapide et intense~Lent et long|Être filmé~Être regardé|Une seule position parfaite~Toutes les positions|En voiture~Dans un ascenseur|Le strip-tease~Le massage huilé|Une nuit avec une star~Une nuit avec ton crush|Un jeu de rôle~Un jeu de dés coquin|Le cuir~La dentelle|En silence~Bruyamment|Un club libertin~Une plage naturiste|Le sexto~L'appel coquin|Raconter ses fantasmes~Les réaliser sans prévenir`,
msk:`Promets quelque chose d'impossible|Décris ton masque en trois mots|Raconte ton plus beau souvenir de mer|Donne un indice faux sur toi|Écris comme un vieux capitaine|Annonce ta stratégie… ou fais semblant|Pose une question à ton duo|Fais un compliment sincère|Écris un haïku|Raconte une blague nulle|Parle comme une prévision météo|Écris comme une bouteille à la mer|Avoue ta plus grande peur|Négocie comme au marché|Écris en majuscules et avec passion|Fais une prédiction pour la prochaine manche|Cite un proverbe inventé|Écris comme un télégramme STOP|Décris le trésor que tu cherches|Sois mystérieux, très mystérieux|Raconte ce que tu as mangé ce midi|Défends-toi d'une accusation imaginaire|Écris comme un poème de rap|Propose un code secret|Parle à la troisième personne|Fais une offre que l'on ne peut refuser|Écris tout en questions|Parle comme une sirène|Promets de partager… en croisant les doigts|Écris un slogan pour toi-même`,
msk1:`Décris ton rendez-vous idéal sous l'eau|Fais un compliment troublant|Écris une phrase de drague de marin|Avoue un crush passé|Propose un pacte à la belle étoile|Décris ce qui te fait craquer|Écris un message à lire à voix basse|Avoue ton plus beau premier baiser|Fais semblant d'être amoureux de ton duo|Décris le parfum de ton masque|Écris une promesse sous la lune|Propose un slow sur le pont`,
msk2:`Avoue ton fantasme le plus marin|Décris ta position préférée sans la nommer|Raconte ton endroit le plus risqué|Écris un sexto de pirate|Avoue ce qui te fait perdre la tête au lit|Propose un pacte très peu habillé|Décris ta nuit la plus folle en trois mots|Avoue ton jouet secret|Écris ce que tu ferais dans une cabine de bateau|Avoue ce que tu n'as jamais essayé|Raconte ta pire panne|Promets une récompense très coquine`,
bot:`Un endroit insolite où tu as dormi|Une peur d'enfance|Un objet que tu gardes depuis toujours|Ton pire job|Un plat que tu détestes|Une rencontre avec une célébrité|Une bêtise d'enfance|Un talent caché|Un voyage raté|Un surnom que tu as eu|Une fois où tu t'es perdu|Un mensonge qui a mal tourné|Ton premier concert|Un record personnel|Un animal que tu as eu|Une chose que tu n'as jamais faite|Un rêve récurrent|Une honte à l'école|Un cadeau que tu n'as jamais oublié|Une manie bizarre|Ta pire coupe de cheveux|Une fois où tu as été très courageux|Un fou rire au mauvais moment|Un endroit où tu rêves d'aller|Un sport que tu as pratiqué|Une collection que tu as eue|Un film qui t'a fait pleurer|Un accident ridicule|Une chose que tu sais faire mieux que tout le monde|Ton premier travail|Un objet perdu qui te manque|Une rencontre due au hasard|Une recette de famille|Une phobie|Une décision qui a tout changé|Une nuit blanche mémorable|Une dispute absurde|Un plat que tu sais cuisiner|Un costume que tu as porté|Un pari perdu|Ton premier souvenir|Un moment de gloire|Une langue que tu parles un peu|Une chanson qui te rappelle quelqu'un|Une fois où tu as triché|Une rencontre avec un animal sauvage|Un endroit où tu as vécu|Un prof qui t'a marqué|Une erreur de traduction|Une chose que tu collectionnes encore`,
bot1:`Ton premier baiser|Un rendez-vous raté|Un crush improbable|Une déclaration d'amour ratée|Un message envoyé à la mauvaise personne|Un rendez-vous parfait|Une drague qui a marché|Un amour de vacances|Un compliment qui t'a fait rougir|Une jalousie ridicule|Un coup de foudre|Une rupture originale|Un rencard sur une appli|Un slow inoubliable|Un bisou volé|Un ex surprenant|Une lettre d'amour|Une nuit à la belle étoile|Un rendez-vous chez les parents|Une drague maladroite`,
bot2:`Un endroit fou où tu l'as fait|Une première fois mémorable|Un fantasme réalisé|Une panne au lit|Un plan d'un soir|Un jouet que tu as testé|Une fois où tu t'es fait surprendre|Un nude envoyé|Un strip-tease|Une nuit très agitée|Un sexto raté|Une expérience que tu ne referais pas|Un partenaire inattendu|Une position ratée|Un lieu public osé|Un achat au sex-shop|Une soirée qui a dérapé|Un rêve érotique|Un fantasme inavouable|Une nuit avec un inconnu`});
GXP('en',{pha:`has talked to an animal like a person|would make the best ship captain|would forget their own birthday|has the most embarrassing playlist|would laugh at the worst moment|would survive a zombie apocalypse|would raise chickens in the city|would become mayor of their village|would get up at 5 am to watch the sunrise|would eat the same thing every day|has the most photos on their phone|would miss their flight|would read the whole instruction manual|would win a pancake-eating contest|will end up living abroad|cheers everyone up|cooks best with almost nothing|would stay calm in a storm|would be first into icy water|would buy an island after winning the lottery|has the most impressive memory|was a pirate in another life|talks the most in their sleep|will invent something useful|would dye their hair blue|would fall in love on holiday|sings most off-key in the shower|would make the best teacher|couldn't live without coffee|would get lost even with a GPS|will open a restaurant|has the most contagious laugh|says hello to the whole neighbourhood|remembers every birthday|would sail across the ocean|will write a novel|is the worst loser|sleeps in the latest at weekends|could last a month without a phone|would get rich from a crazy idea|has the most plants at home|would make the best detective|recognises a song in two notes|would leave tomorrow without a suitcase|sorts everything by colour|has the most shoes|spots a lie the best|would try stand-up comedy|changes hairstyle most often|would talk to dolphins if they could|is always the last to leave the party|is always early|is always late|has the nicest smile|would send a letter rather than a text|has the most hidden talents|would be a reality TV hit|would become a lighthouse keeper|knows a film's lines by heart|does the best accents|would cycle around the world|wakes up without an alarm|has napped at work|is the most stubborn|gives the best hugs|would be elected class rep|haggles best|has travelled the most|caves first in front of a dessert|would keep a secret even under torture|will speak the most languages|could go longest without talking|would find treasure while diving|would grow vegetables on their balcony|would be the best flatmate|would be the worst flatmate|knows the most terrible jokes|makes friends in a queue|has the most energy in the morning|rewatches the same series on a loop|would make a great tour guide|would survive alone in a forest|would spend everything on travel|gives the best presents|would ask a star for a selfie without shame|would be first to go to Mars|has the softest heart|always has an excuse|would stay friends with an ex|replies to messages fastest|leaves messages on "seen"|could have been a pro athlete|would take up pottery|knows all the gossip|keeps a diary|is the karaoke king or queen|would live as a nomad in a van|would give the best wedding speech`,
pha1:`has the most conquests|would send a daring photo|has the most charming laugh|has had love at first sight|would flirt with the waiter|has the most unsettling gaze|would say "I love you" first|would make a public declaration|has had a crush on a teacher|dances the most sensually|falls for an accent|gives the most disarming compliments|has kissed a stranger|has the most memorable dates|could seduce anyone|wears matching lingerie on a first date|has had the worst date|loves morning cuddles|has the most matches on apps|would date two people at once|would write a passionate love letter|keeps the most souvenirs from exes|has the most bewitching perfume|would skinny-dip at night|has confessed love by mistake|would fall for a uniform|would win at spin the bottle|has given the longest kiss|makes the first move on a first date|has already flirted with someone here`,
pha2:`has slept at a stranger's after a party|has the most sex toys|has done it in a fitting room|watches the most porn|has played a naughty role-play|has a secret folder of daring photos|would have a threesome|has been walked in on mid-act|has the most experience in bed|has slept with a friend's ex|would try bondage|has done it on a plane|would say yes to a one-night stand tonight|has had a fling with a colleague|talks the dirtiest in bed|has the most unspeakable fantasy|has done a striptease|has slept with someone without knowing their name|would try a swingers' club|has done it more than five times in one night|would film a sex tape|has the most one-night stories|has had a "breakdown" at the worst moment|has done it in the sea|would sext the wrong person|has secretly bought a toy|likes being dominated|likes to dominate|would sleep with a celebrity without hesitating|has done it at work`,
vag:`foam|salt|tide|lighthouse|seashell|tempest|sail|anchor|wave|coral|whale|crab|seagull|jellyfish|dolphin|map|compass|horizon|diver|submarine|wreck|palm tree|hammock|cocktail|ice cube|umbrella|river|desert|volcano|cave|jungle|lake|bridge|tower|castle|village|rainbow|subway|lightning|fog|bicycle|aurora|bus|rocket|robot|computer|comet|planet|guitar|astronaut|drum|song|dance|satellite|telescope|cake|microscope|strawberry|apple|banana|lemon|laboratory|hospital|bread|soup|tea|milk|honey|sugar|sea salt|ice cream|candy|picnic|barbecue|kitchen|pharmacy|bakery|rose|tree|leaf|autumn|market|spring|weekend|supermarket|suitcase|passport|hotel|tent|campfire|lamp|candle|restaurant|window|door|key|bed|pillow|waiter|nightmare|sleep|alarm clock|morning|evening|midnight|clock|calendar|menu|fork|notebook|pencil|blackboard|teacher|exam|library|museum|cinema|knife|theatre|spoon|clown|plate|saucepan|unicorn|ghost|witch|fortress|knight|princess|king|crown|gold|silver|diamond|jewel|oven|surprise|fridge|lie|truth|friendship|family|sofa|memory|photo|album|television|adventure|freedom|silence|noise|laughter|tear|anger|radio|joy|courage|luck|chance|game|playing card|dice|ball|football|tennis|swimming|diving|surfing|skiing|race|medal|victory|defeat|team|newspaper|dog|horse|rabbit|bird|butterfly|bee|ant|snake|turtle|lion|elephant|monkey|penguin|bear|wolf|fox|owl`,
vag1:`rendezvous|wink|blush|goosebumps|perfume|candlelight|tango|velvet|silk|whisper|caress|glance|smile|crush|petals|butterflies|dinner|nape|shoulder|heart|stolen kiss|tenderness|attraction|jealousy|love letter|ring|honeymoon|seduce|charm|pleasure|skin|lips|bouquet|chat up|waltz|mystery|bubble bath|cuddle up|lazy morning|chemistry`,
vag2:`naked|fantasy|toy|positions|porn|nudes|groan|swinger|breasts|bra|thong|foreplay|rubber|dildo|wand|domination|submission|whip|leather|latex|jacuzzi|voyeur|exhibitionist|naughty|booty call|sex shop|position|orgy|doggy style|missionary|deep throat|hickey|lap dance|garters|oil massage|ejaculate|erection|nipples|cunnilingus|blowjob`,
rad:`Live underwater~Live in the clouds|A remote lighthouse~A flat in the city centre|A year without music~A year without films|Always tell the truth~Always lie|Speak every language~Play every instrument|Go back in time~See the future|Be very funny~Be very clever|Eternal spring~Eternal autumn|Travel alone~Never travel alone|A pet dragon~A robot butler|Never be hungry again~Never be sleepy again|Live 200 years~Live 10 short lives|Win the lottery~Find the love of your life|A silly superpower~No superpower|Sing like a star~Dance like a star|A beach house~A mountain chalet|Be famous~Be secretly rich|No phone~No internet|Eat spicy forever~Eat bland forever|Remember everything~Forget whenever you want|Be invisible for a day~Fly for an hour|Around the world by boat~Around the world by train|Never walk again~Never run again|Be a pirate~Be an explorer|Know everything about the past~Know everything about space|Work nights~Work at 5 am|A feast every night~A trip every month|Have a twin~Be an only child|Laugh at every sentence~Cry at every film|A deserted beach~A packed festival|Breathe underwater~Never feel cold|Be a cat~Be a dog|A calm life~A life full of adventure|Live on a boat~Live in a cabin|Change your name~Change your country|Be the best at one thing~Be good at everything|Know how to fly a plane~Know how to sail|No dessert ever~No cheese ever|First on the Moon~First at the bottom of the ocean|Write a bestseller~Write a hit song|Always 10 minutes late~Always 30 minutes early|One loyal friend~Ten nice friends|Relive your happiest day~Live a mystery day|A butler~A personal chef|Your thoughts on display~Your browser history on display|A bottomless bag~A door to anywhere|No mirrors~No photos|Be a giant~Be tiny|Speak in rhymes~Sing instead of talking|A surprise every day~Every day the same and perfect`,
rad1:`A museum date~A funfair date|A date on a boat~In a cabin|A love letter~A serenade|Love at first sight~Friendship turned love|Cook together~Order in bed|A surprise date~A perfectly planned date|A holiday romance~An office romance|Hold hands~Hold by the waist|A funny partner~A mysterious partner|Slow dance~Salsa|Breakfast in bed~Candlelit dinner|Flirt by text~Flirt face to face|Matching tattoos~Matching rings|Sleep cuddled up~Sleep on your own side|A weekend in Venice~A weekend on an island|Make the first move~Wait for them to|A cute nickname~Your real name whispered|A lingering look~A sideways smile|A waterside picnic~A city rooftop|A stolen kiss~A long-awaited kiss`,
rad2:`In the shower~On the washing machine|Dominate~Be dominated|In front of a mirror~Blindfolded|A one-night stand~A regular friend with benefits|A toy~A massage|The jacuzzi~The sauna|Handcuffs~Feathers|Dirty talk~Moaning|Fast and intense~Slow and long|Being filmed~Being watched|One perfect position~Every position|In a car~In a lift|A striptease~An oil massage|A night with a star~A night with your crush|A role-play~A naughty dice game|Leather~Lace|In silence~Loudly|A swingers' club~A nudist beach|Sexting~A naughty call|Share your fantasies~Act them out without warning`,
msk:`Promise something impossible|Describe your mask in three words|Tell your best sea memory|Give a false clue about yourself|Write like an old sea captain|Announce your strategy… or pretend to|Ask your partner a question|Give a sincere compliment|Write a haiku|Tell a terrible joke|Talk like a weather forecast|Write like a message in a bottle|Admit your biggest fear|Haggle like at a market|Write in capitals, with passion|Make a prediction for next round|Quote a made-up proverb|Write like a telegram STOP|Describe the treasure you seek|Be mysterious, very mysterious|Say what you had for lunch|Defend yourself against an imaginary accusation|Write it like a rap verse|Suggest a secret code|Talk about yourself in the third person|Make an offer they can't refuse|Write only in questions|Talk like a mermaid|Promise to share… fingers crossed|Write a slogan for yourself`,
msk1:`Describe your ideal underwater date|Give an unsettling compliment|Write a sailor's pick-up line|Admit a past crush|Propose a pact under the stars|Describe what makes you melt|Write a message to be read in a whisper|Admit your best first kiss|Pretend to be in love with your partner|Describe the scent of your mask|Write a promise under the moon|Propose a slow dance on deck`,
msk2:`Admit your most nautical fantasy|Describe your favourite position without naming it|Tell your riskiest place|Write a pirate sext|Admit what drives you wild in bed|Propose a pact with very few clothes|Describe your wildest night in three words|Admit your secret toy|Write what you'd do in a ship's cabin|Admit what you've never tried|Tell your worst "breakdown"|Promise a very naughty reward`,
bot:`An unusual place you've slept|A childhood fear|Something you've kept forever|Your worst job|A dish you hate|Meeting a celebrity|A childhood prank|A hidden talent|A trip gone wrong|A nickname you had|A time you got lost|A lie that went badly|Your first concert|A personal record|A pet you had|Something you've never done|A recurring dream|An embarrassing school moment|A present you never forgot|A weird habit|Your worst haircut|A time you were very brave|A laughing fit at the wrong time|A place you dream of going|A sport you played|A collection you had|A film that made you cry|A ridiculous accident|Something you do better than anyone|Your first job|A lost object you miss|A chance encounter|A family recipe|A phobia|A decision that changed everything|A memorable all-nighter|An absurd argument|A dish you can cook|A costume you wore|A bet you lost|Your earliest memory|A moment of glory|A language you speak a little|A song that reminds you of someone|A time you cheated|An encounter with a wild animal|A place you've lived|A teacher who marked you|A translation mistake|Something you still collect`,
bot1:`Your first kiss|A failed date|An unlikely crush|A botched declaration of love|A message sent to the wrong person|A perfect date|A pick-up line that worked|A holiday romance|A compliment that made you blush|A ridiculous jealousy|Love at first sight|An original break-up|A dating-app date|An unforgettable slow dance|A stolen kiss|A surprising ex|A love letter|A night under the stars|Meeting the parents|A clumsy flirt`,
bot2:`A wild place you did it|A memorable first time|A fantasy come true|A "breakdown" in bed|A one-night stand|A toy you tried|A time you got caught|A nude you sent|A striptease|A very busy night|A sext gone wrong|An experience you'd never repeat|An unexpected partner|A position gone wrong|A daring public place|A sex-shop purchase|A party that got out of hand|An erotic dream|An unspeakable fantasy|A night with a stranger`});
GXP('es',{pha:`ha hablado con un animal como con una persona|sería el mejor capitán de barco|olvidaría su propio cumpleaños|tiene la playlist más vergonzosa|se reiría en el peor momento|sobreviviría a un apocalipsis zombi|criaría gallinas en la ciudad|llegaría a alcalde de su pueblo|se levantaría a las 5 para ver amanecer|comería lo mismo todos los días|tiene más fotos en el móvil|perdería el avión|leería el manual de instrucciones entero|ganaría un concurso de comer tortitas|acabará viviendo en el extranjero|anima a todo el mundo|cocina mejor con casi nada|mantendría la calma en una tormenta|sería el primero en saltar al agua helada|compraría una isla si le tocara la lotería|tiene la memoria más impresionante|fue pirata en otra vida|habla más en sueños|inventará algo útil|se teñiría el pelo de azul|se enamoraría en vacaciones|canta más desafinado en la ducha|sería el mejor profe|no podría vivir sin café|se perdería incluso con GPS|abrirá un restaurante|tiene la risa más contagiosa|saluda a todo el barrio|recuerda todos los cumpleaños|cruzaría el océano a vela|escribirá una novela|es el peor perdedor|duerme hasta más tarde el fin de semana|aguantaría un mes sin móvil|se haría rico con una idea loca|tiene más plantas en casa|sería el mejor detective|reconoce una canción en dos notas|se iría mañana sin maleta|ordena todo por colores|tiene más zapatos|detecta mejor una mentira|se lanzaría al monólogo cómico|cambia más de peinado|hablaría con los delfines si pudiera|siempre es el último en irse de la fiesta|siempre llega pronto|siempre llega tarde|tiene la sonrisa más bonita|mandaría una carta antes que un mensaje|tiene más talentos ocultos|triunfaría en un reality|se haría farero|se sabe de memoria los diálogos de una peli|imita mejor los acentos|daría la vuelta al mundo en bici|se despierta sin despertador|se ha echado la siesta en el trabajo|es el más cabezota|da los mejores abrazos|sería elegido delegado de clase|regatea mejor|ha viajado más|cae primero ante un postre|guardaría un secreto incluso bajo tortura|hablará más idiomas|aguantaría más tiempo sin hablar|encontraría un tesoro buceando|tendría un huerto en el balcón|sería el mejor compañero de piso|sería el peor compañero de piso|se sabe más chistes malos|hace amigos en una cola|tiene más energía por la mañana|ve la misma serie en bucle|sería un guía turístico genial|sobreviviría solo en el bosque|se lo gastaría todo en viajes|hace los mejores regalos|pediría un selfie a una estrella sin vergüenza|iría el primero a Marte|tiene el corazón más tierno|siempre tiene una excusa|seguiría siendo amigo de un ex|contesta más rápido los mensajes|deja los mensajes en visto|podría haber sido deportista de élite|se pondría a hacer cerámica|se sabe todos los cotilleos|escribe un diario|es el rey o la reina del karaoke|viviría como nómada en una furgoneta|daría el mejor discurso de boda`,
pha1:`tiene más conquistas|mandaría una foto atrevida|tiene la risa más encantadora|ha tenido un flechazo a primera vista|ligaría con el camarero|tiene la mirada más turbadora|diría «te quiero» primero|haría una declaración en público|ha tenido un crush con un profe|baila de forma más sensual|cae rendido ante un acento|hace los cumplidos más desarmantes|ha besado a un desconocido|tiene las citas más memorables|podría seducir a cualquiera|lleva lencería a juego en la primera cita|ha tenido la peor cita|adora los mimos por la mañana|tiene más matches en las apps|saldría con dos personas a la vez|escribiría una carta de amor apasionada|guarda más recuerdos de sus ex|tiene el perfume más embriagador|se bañaría desnudo de noche|se ha declarado por error|caería rendido ante un uniforme|ganaría al juego de la botella|ha dado el beso más largo|toma la iniciativa en la primera cita|ya ha ligado con alguien de aquí`,
pha2:`ha dormido en casa de un desconocido tras una fiesta|tiene más juguetes íntimos|lo ha hecho en un probador|ve más porno|ha jugado a un juego de rol picante|tiene una carpeta secreta de fotos atrevidas|haría un trío|le han pillado en plena faena|tiene más experiencia en la cama|se ha acostado con el ex de un amigo|probaría el bondage|lo ha hecho en un avión|diría que sí a un rollo de una noche hoy|ha tenido una aventura con un compañero de trabajo|habla más guarro en la cama|tiene la fantasía más inconfesable|ha hecho un striptease|se ha acostado con alguien sin saber su nombre|probaría un club swinger|lo ha hecho más de cinco veces en una noche|grabaría un vídeo porno casero|tiene más historias de una noche|ha tenido un gatillazo en el peor momento|lo ha hecho en el mar|mandaría un sexting a la persona equivocada|ha comprado un juguete a escondidas|le gusta ser dominado|le gusta dominar|se acostaría con un famoso sin dudar|lo ha hecho en el trabajo`,
vag:`espuma|sal|marea|faro|concha|tempestad|vela|ancla|ola|coral|ballena|cangrejo|gaviota|medusa|delfín|mapa|brújula|horizonte|buzo|submarino|naufragio|palmera|hamaca|cóctel|cubito|paraguas|río|desierto|volcán|cueva|selva|lago|puente|torre|castillo|aldea|arcoíris|metro|relámpago|niebla|bicicleta|aurora|autobús|cohete|robot|ordenador|cometa|planeta|guitarra|astronauta|tambor|canción|baile|satélite|telescopio|tarta|microscopio|fresa|manzana|plátano|limón|laboratorio|hospital|pan|sopa|té|leche|miel|azúcar|sal marina|helado|caramelo|pícnic|barbacoa|cocina|farmacia|panadería|rosa|árbol|hoja|otoño|mercado|primavera|finde|supermercado|maleta|pasaporte|hotel|tienda de campaña|hoguera|lámpara|vela de cera|restaurante|ventana|puerta|llave|cama|almohada|camarero|pesadilla|siesta|despertador|mañana|tarde|medianoche|reloj|calendario|menú|tenedor|cuaderno|lápiz|pizarra|profesor|examen|biblioteca|museo|cine|cuchillo|teatro|cuchara|payaso|plato|cazo|unicornio|fantasma|bruja|fortaleza|caballero|princesa|rey|corona|oro|plata|diamante|joya|horno|sorpresa|nevera|mentira|verdad|amistad|familia|sofá|recuerdo|foto|álbum|televisión|aventura|libertad|silencio|ruido|risa|lágrima|enfado|radio|alegría|valor|suerte|azar|juego|naipe|dado|pelota|fútbol|tenis|natación|buceo|surf|esquí|carrera|medalla|victoria|derrota|equipo|periódico|perro|caballo|conejo|pájaro|mariposa|abeja|hormiga|serpiente|tortuga|león|elefante|mono|pingüino|oso|lobo|zorro|búho`,
vag1:`cita a ciegas|guiño|sonrojo|piel de gallina|perfume|velas|tango|terciopelo|seda|susurro|caricia|complicidad|sonrisa|flechazo|pétalos|mariposas|cena|nuca|hombro|corazón|beso robado|ternura|atracción|celos|carta de amor|anillo|luna de miel|seducir|encanto|placer|piel|labios|ramo|ligar|vals|misterio|baño de espuma|acurrucarse|mañana tranquila|química`,
vag2:`desnudo|fantasía|juguete|posturas|porno|nudes|gemir|swinger|pechos|sujetador|tanga|preliminares|goma|consolador|succionador|dominación|sumisión|látigo|cuero|látex|jacuzzi|mirón|exhibicionista|pícaro|polvo|sex shop|postura|orgía|a cuatro patas|misionero|garganta profunda|chupetón|lap dance|ligas|masaje con aceite|eyacular|erección|pezones|cunnilingus|felación`,
rad:`Vivir bajo el agua~Vivir en las nubes|Un faro aislado~Un piso en pleno centro|Un año sin música~Un año sin películas|Decir siempre la verdad~Mentir siempre|Hablar todos los idiomas~Tocar todos los instrumentos|Volver al pasado~Ver el futuro|Ser muy gracioso~Ser muy listo|Primavera eterna~Otoño eterno|Viajar solo~No viajar nunca solo|Un dragón de mascota~Un robot mayordomo|No volver a tener hambre~No volver a tener sueño|Vivir 200 años~Vivir 10 vidas cortas|Ganar la lotería~Encontrar al amor de tu vida|Un superpoder tonto~Ningún superpoder|Cantar como una estrella~Bailar como una estrella|Una casa en la playa~Una cabaña en la montaña|Ser famoso~Ser rico en secreto|Sin móvil~Sin internet|Comer picante siempre~Comer soso siempre|Recordarlo todo~Olvidar cuando quieras|Ser invisible un día~Volar una hora|La vuelta al mundo en barco~La vuelta al mundo en tren|No volver a caminar~No volver a correr|Ser pirata~Ser explorador|Saberlo todo del pasado~Saberlo todo del espacio|Trabajar de noche~Trabajar a las 5 de la mañana|Un festín cada noche~Un viaje cada mes|Tener un gemelo~Ser hijo único|Reír con cada frase~Llorar con cada película|Una playa desierta~Un festival lleno|Respirar bajo el agua~No tener frío nunca|Ser un gato~Ser un perro|Una vida tranquila~Una vida llena de aventuras|Vivir en un barco~Vivir en una cabaña|Cambiar de nombre~Cambiar de país|Ser el mejor en algo~Ser bueno en todo|Saber pilotar~Saber navegar|Sin postre nunca~Sin queso nunca|El primero en la Luna~El primero en el fondo del océano|Escribir un superventas~Componer un éxito|Llegar siempre 10 minutos tarde~Llegar siempre 30 minutos antes|Un amigo fiel~Diez amigos majos|Revivir tu día más feliz~Vivir un día misterioso|Un mayordomo~Un chef personal|Que se vean tus pensamientos~Que se vea tu historial|Un bolso sin fondo~Una puerta a cualquier lugar|Sin espejos~Sin fotos|Ser un gigante~Ser diminuto|Hablar en rima~Cantar en vez de hablar|Una sorpresa cada día~Cada día igual y perfecto`,
rad1:`Una cita en un museo~Una cita en la feria|Una cita en un barco~En una cabaña|Una carta de amor~Una serenata|Flechazo~Amistad que se vuelve amor|Cocinar juntos~Pedir comida a la cama|Una cita sorpresa~Una cita perfectamente planeada|Un amor de verano~Un amor de oficina|Ir de la mano~Ir cogidos de la cintura|Una pareja graciosa~Una pareja misteriosa|Bailar lento~Bailar salsa|Desayuno en la cama~Cena con velas|Ligar por mensaje~Ligar en persona|Tatuajes a juego~Anillos a juego|Dormir abrazados~Cada uno en su lado|Un finde en Venecia~Un finde en una isla|Dar el primer paso~Esperar a que lo den|Un apodo mono~Tu nombre susurrado|Una mirada que dura~Una sonrisa de lado|Un pícnic junto al agua~Una azotea en la ciudad|Un beso robado~Un beso esperado`,
rad2:`En la ducha~Sobre la lavadora|Dominar~Ser dominado|Delante de un espejo~Con los ojos vendados|Un rollo de una noche~Un follamigo fijo|Un juguete~Un masaje|El jacuzzi~La sauna|Esposas~Plumas|Palabras guarras~Gemidos|Rápido e intenso~Lento y largo|Ser grabado~Ser mirado|Una sola postura perfecta~Todas las posturas|En el coche~En un ascensor|Un striptease~Un masaje con aceite|Una noche con una estrella~Una noche con tu crush|Un juego de rol~Un juego de dados picante|Cuero~Encaje|En silencio~Haciendo ruido|Un club swinger~Una playa nudista|Sexting~Una llamada picante|Contar tus fantasías~Cumplirlas sin avisar`,
msk:`Promete algo imposible|Describe tu máscara en tres palabras|Cuenta tu mejor recuerdo del mar|Da una pista falsa sobre ti|Escribe como un viejo capitán|Anuncia tu estrategia… o finge|Hazle una pregunta a tu pareja|Haz un cumplido sincero|Escribe un haiku|Cuenta un chiste malo|Habla como el parte del tiempo|Escribe como un mensaje en una botella|Confiesa tu mayor miedo|Regatea como en el mercado|Escribe en mayúsculas y con pasión|Haz una predicción para la próxima ronda|Cita un refrán inventado|Escribe como un telegrama STOP|Describe el tesoro que buscas|Sé misterioso, muy misterioso|Cuenta qué comiste hoy|Defiéndete de una acusación imaginaria|Escríbelo como un rap|Propón un código secreto|Habla de ti en tercera persona|Haz una oferta que no se pueda rechazar|Escribe solo con preguntas|Habla como una sirena|Promete compartir… con los dedos cruzados|Escribe un eslogan sobre ti`,
msk1:`Describe tu cita ideal bajo el agua|Haz un cumplido turbador|Escribe una frase de ligue de marinero|Confiesa un crush pasado|Propón un pacto bajo las estrellas|Describe lo que te derrite|Escribe un mensaje para leer en susurros|Confiesa tu mejor primer beso|Finge estar enamorado de tu pareja|Describe el perfume de tu máscara|Escribe una promesa bajo la luna|Propón un baile lento en cubierta`,
msk2:`Confiesa tu fantasía más marinera|Describe tu postura favorita sin nombrarla|Cuenta tu sitio más arriesgado|Escribe un sexting pirata|Confiesa lo que te vuelve loco en la cama|Propón un pacto con muy poca ropa|Describe tu noche más loca en tres palabras|Confiesa tu juguete secreto|Escribe lo que harías en un camarote|Confiesa lo que nunca has probado|Cuenta tu peor gatillazo|Promete una recompensa muy picante`,
bot:`Un sitio insólito donde has dormido|Un miedo de la infancia|Algo que guardas desde siempre|Tu peor trabajo|Un plato que odias|Un encuentro con un famoso|Una travesura de niño|Un talento oculto|Un viaje que salió mal|Un apodo que tuviste|Una vez que te perdiste|Una mentira que salió mal|Tu primer concierto|Un récord personal|Una mascota que tuviste|Algo que nunca has hecho|Un sueño recurrente|Un momento vergonzoso en el cole|Un regalo que nunca olvidaste|Una manía rara|Tu peor corte de pelo|Una vez que fuiste muy valiente|Un ataque de risa en mal momento|Un lugar al que sueñas ir|Un deporte que practicaste|Una colección que tuviste|Una peli que te hizo llorar|Un accidente ridículo|Algo que haces mejor que nadie|Tu primer trabajo|Un objeto perdido que echas de menos|Un encuentro por casualidad|Una receta de familia|Una fobia|Una decisión que lo cambió todo|Una noche en vela memorable|Una discusión absurda|Un plato que sabes cocinar|Un disfraz que llevaste|Una apuesta perdida|Tu primer recuerdo|Un momento de gloria|Un idioma que hablas un poco|Una canción que te recuerda a alguien|Una vez que hiciste trampa|Un encuentro con un animal salvaje|Un lugar donde has vivido|Un profe que te marcó|Un error de traducción|Algo que aún coleccionas`,
bot1:`Tu primer beso|Una cita fallida|Un crush improbable|Una declaración de amor fallida|Un mensaje enviado a quien no era|Una cita perfecta|Un ligue que funcionó|Un amor de verano|Un cumplido que te sonrojó|Unos celos ridículos|Un flechazo|Una ruptura original|Una cita de app|Un baile lento inolvidable|Un beso robado|Un ex sorprendente|Una carta de amor|Una noche bajo las estrellas|Conocer a los suegros|Un ligue torpe`,
bot2:`Un sitio loco donde lo hiciste|Una primera vez memorable|Una fantasía cumplida|Un gatillazo|Un rollo de una noche|Un juguete que probaste|Una vez que te pillaron|Un nude que enviaste|Un striptease|Una noche muy movida|Un sexting que salió mal|Una experiencia que no repetirías|Una pareja inesperada|Una postura que salió mal|Un lugar público atrevido|Una compra en un sex shop|Una fiesta que se descontroló|Un sueño erótico|Una fantasía inconfesable|Una noche con un desconocido`});
GXP('it',{pha:`ha parlato a un animale come a una persona|sarebbe il miglior capitano di nave|dimenticherebbe il proprio compleanno|ha la playlist più imbarazzante|riderebbe nel momento peggiore|sopravvivrebbe a un'apocalisse zombie|alleverebbe galline in città|diventerebbe sindaco del suo paese|si alzerebbe alle 5 per vedere l'alba|mangerebbe la stessa cosa ogni giorno|ha più foto nel telefono|perderebbe l'aereo|leggerebbe tutto il libretto di istruzioni|vincerebbe una gara di mangiatori di frittelle|finirà a vivere all'estero|tira su il morale a tutti|cucina meglio con quasi niente|resterebbe calmo in una tempesta|si tufferebbe per primo nell'acqua gelida|comprerebbe un'isola vincendo alla lotteria|ha la memoria più impressionante|è stato pirata in un'altra vita|parla di più nel sonno|inventerà un oggetto utile|si tingerebbe i capelli di blu|si innamorerebbe in vacanza|canta più stonato sotto la doccia|sarebbe il miglior prof|non potrebbe vivere senza caffè|si perderebbe anche col GPS|aprirà un ristorante|ha la risata più contagiosa|saluta tutto il quartiere|ricorda tutti i compleanni|attraverserebbe l'oceano in barca a vela|scriverà un romanzo|è il peggior perdente|dorme di più nel weekend|resisterebbe un mese senza telefono|farebbe fortuna con un'idea folle|ha più piante in casa|sarebbe il miglior detective|riconosce una canzone in due note|partirebbe domani senza valigia|ordina tutto per colore|ha più scarpe|scopre meglio una bugia|si lancerebbe nella stand-up comedy|cambia più spesso pettinatura|parlerebbe ai delfini se potesse|è sempre l'ultimo a lasciare la festa|è sempre in anticipo|è sempre in ritardo|ha il sorriso più bello|manderebbe una lettera invece di un messaggio|ha più talenti nascosti|sfonderebbe in un reality|diventerebbe guardiano del faro|sa a memoria le battute di un film|imita meglio gli accenti|farebbe il giro del mondo in bici|si sveglia senza sveglia|ha già fatto un pisolino al lavoro|è il più testardo|dà gli abbracci migliori|sarebbe eletto rappresentante di classe|contratta meglio i prezzi|ha viaggiato di più|cede per primo davanti a un dolce|terrebbe un segreto anche sotto tortura|parlerà più lingue|resisterebbe più a lungo senza parlare|troverebbe un tesoro facendo immersioni|coltiverebbe un orto sul balcone|sarebbe il miglior coinquilino|sarebbe il peggior coinquilino|conosce più barzellette pessime|si fa amici in coda|ha più energia al mattino|guarda la stessa serie in loop|sarebbe una guida turistica fantastica|sopravvivrebbe da solo nel bosco|spenderebbe tutto in viaggi|fa i regali migliori|chiederebbe un selfie a una star senza vergogna|andrebbe per primo su Marte|ha il cuore più tenero|ha sempre una scusa|resterebbe amico di un ex|risponde più in fretta ai messaggi|lascia i messaggi in «visualizzato»|avrebbe potuto essere un atleta professionista|si darebbe alla ceramica|conosce tutti i pettegolezzi|tiene un diario|è il re o la regina del karaoke|vivrebbe da nomade in un furgone|farebbe il discorso di nozze più bello`,
pha1:`ha più conquiste|manderebbe una foto audace|ha la risata più affascinante|ha avuto un colpo di fulmine al primo sguardo|ci proverebbe col cameriere|ha lo sguardo più conturbante|direbbe «ti amo» per primo|farebbe una dichiarazione in pubblico|ha avuto una cotta per un prof|balla in modo più sensuale|cede davanti a un accento|fa i complimenti più disarmanti|ha baciato uno sconosciuto|ha gli appuntamenti più memorabili|potrebbe sedurre chiunque|mette intimo coordinato al primo appuntamento|ha avuto il peggior appuntamento|adora le coccole del mattino|ha più match sulle app|uscirebbe con due persone insieme|scriverebbe una lettera d'amore appassionata|conserva più ricordi degli ex|ha il profumo più inebriante|farebbe il bagno nudo di notte|si è dichiarato per sbaglio|cederebbe davanti a una divisa|vincerebbe al gioco della bottiglia|ha dato il bacio più lungo|prende l'iniziativa al primo appuntamento|ci ha già provato con qualcuno qui`,
pha2:`ha dormito da uno sconosciuto dopo una festa|ha più sex toy|l'ha fatto in un camerino|guarda più porno|ha fatto un gioco di ruolo piccante|ha una cartella segreta di foto audaci|farebbe una cosa a tre|è stato beccato sul fatto|ha più esperienza a letto|è andato a letto con l'ex di un amico|proverebbe il bondage|l'ha fatto in aereo|direbbe sì a un'avventura di una notte stasera|ha avuto una storia con un collega|parla più sporco a letto|ha la fantasia più inconfessabile|ha fatto uno spogliarello|è andato a letto con qualcuno senza saperne il nome|proverebbe un club scambista|l'ha fatto più di cinque volte in una notte|girerebbe un video hard|ha più storie di una notte|ha fatto cilecca nel momento peggiore|l'ha fatto in mare|manderebbe un sexting alla persona sbagliata|ha comprato un sex toy di nascosto|ama essere dominato|ama dominare|andrebbe a letto con una star senza esitare|l'ha fatto al lavoro`,
vag:`schiuma|sale|marea|faro|conchiglia|burrasca|vela|ancora|onda|corallo|balena|granchio|gabbiano|medusa|delfino|mappa|bussola|orizzonte|sub|sottomarino|relitto|palma|amaca|cocktail|cubetto|ombrello|fiume|deserto|vulcano|grotta|giungla|lago|ponte|torre|castello|borgo|arcobaleno|metropolitana|fulmine|nebbia|bicicletta|aurora|autobus|razzo|robot|computer|cometa|pianeta|chitarra|astronauta|tamburo|canzone|ballo|satellite|telescopio|torta|microscopio|fragola|mela|banana|limone|laboratorio|ospedale|pane|zuppa|tè|latte|miele|zucchero|sale marino|gelato|caramella|picnic|grigliata|cucina|farmacia|panetteria|rosa|albero|foglia|autunno|mercato|primavera|fine settimana|supermercato|valigia|passaporto|albergo|tenda|falò|lampada|candela|ristorante|finestra|porta|chiave|letto|cuscino|cameriere|incubo|sonno|sveglia|mattina|sera|mezzanotte|orologio|calendario|menù|forchetta|quaderno|matita|lavagna|insegnante|esame|biblioteca|museo|cinema|coltello|teatro|cucchiaio|pagliaccio|piatto|pentola|unicorno|fantasma|strega|fortezza|cavaliere|principessa|re|corona|oro|argento|diamante|gioiello|forno|sorpresa|frigo|bugia|verità|amicizia|famiglia|divano|ricordo|foto|album|televisione|avventura|libertà|silenzio|rumore|risata|lacrima|rabbia|radio|gioia|coraggio|fortuna|caso|gioco|carta da gioco|dado|pallone|calcio|tennis|nuoto|immersione|surf|sci|corsa|medaglia|vittoria|sconfitta|squadra|giornale|cane|cavallo|coniglio|uccello|farfalla|ape|formica|serpente|tartaruga|leone|elefante|scimmia|pinguino|orso|lupo|volpe|gufo`,
vag1:`serata a due|occhiolino|arrossire|pelle d'oca|profumo|lume di candela|tango|velluto|seta|sussurro|carezza|occhi negli occhi|sorriso|cotta|petali|farfalle nello stomaco|cena|nuca|spalla|cuore|bacio rubato|tenerezza|attrazione|gelosia|lettera d'amore|anello|luna di miele|sedurre|fascino|piacere|pelle|labbra|mazzo di fiori|rimorchiare|valzer|mistero|bagnoschiuma|accoccolarsi|mattina pigra|intesa`,
vag2:`nudo|fantasia|giocattolo|posizioni|porno|nudes|gemere|scambista|seno|reggiseno|perizoma|preliminari|profilattico|dildo|benda sugli occhi|dominazione|sottomissione|frusta|pelle nera|lattice|idromassaggio|guardone|esibizionista|birichino|scopamico|sexy shop|posizione|orgia|pecorina|missionario|gola profonda|succhiotto|lap dance|giarrettiere|massaggio con olio|eiaculare|erezione|capezzoli|cunnilingus|pompino`,
rad:`Vivere sott'acqua~Vivere tra le nuvole|Un faro isolato~Un appartamento in centro|Un anno senza musica~Un anno senza film|Dire sempre la verità~Mentire sempre|Parlare tutte le lingue~Suonare tutti gli strumenti|Tornare nel passato~Vedere il futuro|Essere molto divertente~Essere molto intelligente|Primavera eterna~Autunno eterno|Viaggiare da solo~Non viaggiare mai da solo|Un drago domestico~Un robot maggiordomo|Non avere mai più fame~Non avere mai più sonno|Vivere 200 anni~Vivere 10 vite brevi|Vincere alla lotteria~Trovare l'amore della tua vita|Un superpotere inutile~Nessun superpotere|Cantare come una star~Ballare come una star|Una casa sulla spiaggia~Uno chalet in montagna|Essere famoso~Essere ricco in segreto|Niente telefono~Niente internet|Mangiare piccante per sempre~Mangiare insipido per sempre|Ricordare tutto~Dimenticare quando vuoi|Invisibile per un giorno~Volare per un'ora|Il giro del mondo in barca~Il giro del mondo in treno|Non camminare mai più~Non correre mai più|Essere un pirata~Essere un esploratore|Sapere tutto del passato~Sapere tutto dello spazio|Lavorare di notte~Lavorare alle 5 del mattino|Un banchetto ogni sera~Un viaggio ogni mese|Avere un gemello~Essere figlio unico|Ridere a ogni frase~Piangere a ogni film|Una spiaggia deserta~Un festival affollato|Respirare sott'acqua~Non avere mai freddo|Essere un gatto~Essere un cane|Una vita tranquilla~Una vita piena di avventure|Vivere su una barca~Vivere in una capanna|Cambiare nome~Cambiare paese|Essere il migliore in una cosa~Essere bravo in tutto|Saper pilotare~Saper navigare|Mai più dolci~Mai più formaggio|Il primo sulla Luna~Il primo in fondo all'oceano|Scrivere un best seller~Comporre una hit|Sempre 10 minuti in ritardo~Sempre 30 minuti in anticipo|Un amico fedele~Dieci amici simpatici|Rivivere il giorno più felice~Vivere un giorno misterioso|Un maggiordomo~Uno chef personale|I tuoi pensieri in vista~La tua cronologia in vista|Una borsa senza fondo~Una porta verso ovunque|Niente specchi~Niente foto|Essere un gigante~Essere minuscolo|Parlare in rima~Cantare invece di parlare|Una sorpresa ogni giorno~Ogni giorno uguale e perfetto`,
rad1:`Un appuntamento al museo~Al luna park|Un appuntamento in barca~In una baita|Una lettera d'amore~Una serenata|Colpo di fulmine~Amicizia che diventa amore|Cucinare insieme~Farsi portare il cibo a letto|Un appuntamento a sorpresa~Un appuntamento pianificato alla perfezione|Un amore estivo~Un amore in ufficio|Tenersi per mano~Tenersi per la vita|Un partner divertente~Un partner misterioso|Un lento~La salsa|Colazione a letto~Cena a lume di candela|Corteggiare per messaggio~Corteggiare di persona|Tatuaggi coordinati~Anelli coordinati|Dormire abbracciati~Ognuno dal suo lato|Un weekend a Venezia~Un weekend su un'isola|Fare il primo passo~Aspettare che lo faccia l'altro|Un soprannome tenero~Il tuo nome sussurrato|Uno sguardo che dura~Un sorriso di sbieco|Un picnic in riva all'acqua~Una terrazza in città|Un bacio rubato~Un bacio atteso`,
rad2:`Sotto la doccia~Sulla lavatrice|Dominare~Essere dominato|Davanti allo specchio~Bendato|Un'avventura di una notte~Uno scopamico fisso|Un sex toy~Un massaggio|L'idromassaggio~La sauna|Manette~Piume|Parole sporche~Gemiti|Veloce e intenso~Lento e lungo|Essere filmato~Essere guardato|Una sola posizione perfetta~Tutte le posizioni|In macchina~In ascensore|Uno spogliarello~Un massaggio con olio|Una notte con una star~Una notte con la tua cotta|Un gioco di ruolo~Un gioco di dadi piccante|Pelle~Pizzo|In silenzio~Rumorosamente|Un club scambista~Una spiaggia nudista|Sexting~Una chiamata piccante|Raccontare le fantasie~Realizzarle senza avvisare`,
msk:`Prometti qualcosa di impossibile|Descrivi la tua maschera in tre parole|Racconta il tuo ricordo di mare più bello|Dai un indizio falso su di te|Scrivi come un vecchio capitano|Annuncia la tua strategia… o fingi|Fai una domanda al tuo partner|Fai un complimento sincero|Scrivi un haiku|Racconta una barzelletta pessima|Parla come le previsioni del tempo|Scrivi come un messaggio in bottiglia|Confessa la tua paura più grande|Contratta come al mercato|Scrivi in maiuscolo, con passione|Fai una previsione per il prossimo round|Cita un proverbio inventato|Scrivi come un telegramma STOP|Descrivi il tesoro che cerchi|Sii misterioso, molto misterioso|Racconta cosa hai mangiato a pranzo|Difenditi da un'accusa immaginaria|Scrivilo come una strofa rap|Proponi un codice segreto|Parla di te in terza persona|Fai un'offerta che non si può rifiutare|Scrivi solo domande|Parla come una sirena|Prometti di condividere… con le dita incrociate|Scrivi uno slogan su di te`,
msk1:`Descrivi il tuo appuntamento ideale sott'acqua|Fai un complimento conturbante|Scrivi una frase da rimorchio da marinaio|Confessa una vecchia cotta|Proponi un patto sotto le stelle|Descrivi cosa ti fa sciogliere|Scrivi un messaggio da leggere sottovoce|Confessa il tuo primo bacio più bello|Fingi di essere innamorato del tuo partner|Descrivi il profumo della tua maschera|Scrivi una promessa sotto la luna|Proponi un lento sul ponte`,
msk2:`Confessa la tua fantasia più marinaresca|Descrivi la tua posizione preferita senza nominarla|Racconta il posto più rischioso|Scrivi un sexting da pirata|Confessa cosa ti fa impazzire a letto|Proponi un patto con pochissimi vestiti|Descrivi la tua notte più folle in tre parole|Confessa il tuo sex toy segreto|Scrivi cosa faresti in una cabina di nave|Confessa cosa non hai mai provato|Racconta la tua peggiore cilecca|Prometti una ricompensa molto piccante`,
bot:`Un posto insolito dove hai dormito|Una paura d'infanzia|Un oggetto che conservi da sempre|Il tuo lavoro peggiore|Un piatto che odi|L'incontro con una celebrità|Una marachella d'infanzia|Un talento nascosto|Un viaggio andato storto|Un soprannome che avevi|Una volta che ti sei perso|Una bugia finita male|Il tuo primo concerto|Un record personale|Un animale che hai avuto|Una cosa che non hai mai fatto|Un sogno ricorrente|Una figuraccia a scuola|Un regalo che non hai mai dimenticato|Una mania strana|Il tuo taglio di capelli peggiore|Una volta che sei stato molto coraggioso|Una risata nel momento sbagliato|Un posto dove sogni di andare|Uno sport che hai praticato|Una collezione che avevi|Un film che ti ha fatto piangere|Un incidente ridicolo|Una cosa che sai fare meglio di tutti|Il tuo primo lavoro|Un oggetto perso che ti manca|Un incontro casuale|Una ricetta di famiglia|Una fobia|Una decisione che ha cambiato tutto|Una notte in bianco memorabile|Una lite assurda|Un piatto che sai cucinare|Un costume che hai indossato|Una scommessa persa|Il tuo primo ricordo|Un momento di gloria|Una lingua che parli un po'|Una canzone che ti ricorda qualcuno|Una volta che hai barato|L'incontro con un animale selvatico|Un posto dove hai vissuto|Un prof che ti ha segnato|Un errore di traduzione|Una cosa che collezioni ancora`,
bot1:`Il tuo primo bacio|Un appuntamento andato male|Una cotta improbabile|Una dichiarazione d'amore fallita|Un messaggio mandato alla persona sbagliata|Un appuntamento perfetto|Un approccio che ha funzionato|Un amore estivo|Un complimento che ti ha fatto arrossire|Una gelosia ridicola|Un colpo di fulmine|Una rottura originale|Un appuntamento da app|Un lento indimenticabile|Un bacio rubato|Un ex sorprendente|Una lettera d'amore|Una notte sotto le stelle|L'incontro coi genitori|Un approccio goffo`,
bot2:`Un posto folle dove l'hai fatto|Una prima volta memorabile|Una fantasia realizzata|Una cilecca a letto|Un'avventura di una notte|Un sex toy che hai provato|Una volta che ti hanno beccato|Un nude che hai mandato|Uno spogliarello|Una notte molto movimentata|Un sexting andato male|Un'esperienza che non rifaresti|Un partner inaspettato|Una posizione andata male|Un luogo pubblico audace|Un acquisto al sexy shop|Una festa sfuggita di mano|Un sogno erotico|Una fantasia inconfessabile|Una notte con uno sconosciuto`});
GXP('de',{pha:`hat schon mit einem Tier wie mit einem Menschen geredet|wäre der beste Schiffskapitän|würde den eigenen Geburtstag vergessen|hat die peinlichste Playlist|würde im unpassendsten Moment lachen|würde eine Zombie-Apokalypse überleben|würde in der Stadt Hühner halten|würde Bürgermeister seines Dorfes werden|würde um 5 Uhr für den Sonnenaufgang aufstehen|würde jeden Tag dasselbe essen|hat die meisten Fotos auf dem Handy|würde den Flug verpassen|würde die ganze Bedienungsanleitung lesen|würde ein Pfannkuchen-Wettessen gewinnen|wird irgendwann im Ausland leben|muntert alle auf|kocht am besten aus fast nichts|würde im Sturm ruhig bleiben|würde als Erstes ins eiskalte Wasser springen|würde sich vom Lottogewinn eine Insel kaufen|hat das beeindruckendste Gedächtnis|war in einem früheren Leben Pirat|redet am meisten im Schlaf|wird einen nützlichen Gegenstand erfinden|würde sich die Haare blau färben|würde sich im Urlaub verlieben|singt unter der Dusche am schiefsten|wäre der beste Lehrer|könnte ohne Kaffee nicht leben|würde sich sogar mit GPS verlaufen|wird ein Restaurant eröffnen|hat das ansteckendste Lachen|grüßt das ganze Viertel|merkt sich alle Geburtstage|würde mit dem Segelboot den Ozean überqueren|wird einen Roman schreiben|ist der schlechteste Verlierer|schläft am Wochenende am längsten|würde einen Monat ohne Handy durchhalten|würde mit einer verrückten Idee reich werden|hat die meisten Pflanzen zu Hause|wäre der beste Detektiv|erkennt ein Lied nach zwei Tönen|würde morgen ohne Koffer losfahren|sortiert alles nach Farben|hat die meisten Schuhe|durchschaut eine Lüge am besten|würde mit Stand-up-Comedy anfangen|wechselt am häufigsten die Frisur|würde mit Delfinen sprechen, wenn er könnte|verlässt die Party immer als Letzter|ist immer zu früh|ist immer zu spät|hat das schönste Lächeln|würde einen Brief statt einer Nachricht schicken|hat die meisten versteckten Talente|würde in einer Reality-Show durchstarten|würde Leuchtturmwärter werden|kann die Dialoge eines Films auswendig|imitiert Akzente am besten|würde mit dem Fahrrad um die Welt fahren|wacht ohne Wecker auf|hat schon bei der Arbeit ein Nickerchen gemacht|ist am sturköpfigsten|umarmt am besten|würde zum Klassensprecher gewählt|handelt Preise am besten herunter|ist am meisten gereist|wird bei einem Dessert als Erstes schwach|würde ein Geheimnis sogar unter Folter bewahren|wird die meisten Sprachen sprechen|würde am längsten ohne Reden durchhalten|würde beim Tauchen einen Schatz finden|würde einen Gemüsegarten auf dem Balkon anlegen|wäre der beste Mitbewohner|wäre der schlimmste Mitbewohner|kennt die meisten schlechten Witze|findet in jeder Warteschlange Freunde|hat morgens die meiste Energie|schaut dieselbe Serie in Dauerschleife|wäre ein großartiger Reiseführer|würde allein im Wald überleben|würde alles für Reisen ausgeben|macht die besten Geschenke|würde einen Star ohne Scham um ein Selfie bitten|würde als Erstes zum Mars fliegen|hat das weichste Herz|hat immer eine Ausrede|würde mit einem Ex befreundet bleiben|antwortet am schnellsten auf Nachrichten|lässt Nachrichten auf «gelesen»|hätte Profisportler werden können|würde mit Töpfern anfangen|kennt den ganzen Klatsch|führt ein Tagebuch|ist der König oder die Königin des Karaoke|würde als Nomade im Van leben|würde die schönste Hochzeitsrede halten`,
pha1:`hatte die meisten Eroberungen|würde ein gewagtes Foto schicken|hat das charmanteste Lachen|hatte schon Liebe auf den ersten Blick|würde mit der Bedienung flirten|hat die verführerischsten Augen|würde als Erstes «Ich liebe dich» sagen|würde eine öffentliche Liebeserklärung machen|war schon in eine Lehrkraft verknallt|tanzt am sinnlichsten|wird bei einem Akzent schwach|macht die entwaffnendsten Komplimente|hat schon einen Fremden geküsst|hat die denkwürdigsten Dates|könnte jeden verführen|trägt beim ersten Date passende Unterwäsche|hatte das schlimmste Date|liebt morgendliches Kuscheln|hat die meisten Matches in Apps|würde zwei Leute gleichzeitig daten|würde einen leidenschaftlichen Liebesbrief schreiben|hebt die meisten Erinnerungen an Exen auf|hat den betörendsten Duft|würde nachts nackt baden|hat sich aus Versehen verraten|wird bei einer Uniform schwach|würde beim Flaschendrehen gewinnen|hat den längsten Kuss gegeben|ergreift beim ersten Date die Initiative|hat schon mit jemandem hier geflirtet`,
pha2:`hat nach einer Party bei einem Fremden geschlafen|hat die meisten Sexspielzeuge|hat es schon in einer Umkleidekabine getan|schaut am meisten Pornos|hat schon ein heißes Rollenspiel gemacht|hat einen geheimen Ordner mit gewagten Fotos|würde einen Dreier machen|wurde schon beim Sex überrascht|hat am meisten Erfahrung im Bett|hat mit dem Ex eines Freundes geschlafen|würde Bondage ausprobieren|hat es schon im Flugzeug getan|würde heute Abend Ja zu einem One-Night-Stand sagen|hatte schon was mit einem Kollegen|redet im Bett am schmutzigsten|hat die unaussprechlichste Fantasie|hat schon einen Striptease gemacht|hat mit jemandem geschlafen, ohne den Namen zu kennen|würde einen Swingerclub ausprobieren|hat es schon mehr als fünfmal in einer Nacht getan|würde ein Sexvideo drehen|hatte die meisten One-Night-Stands|hat im schlimmsten Moment versagt|hat es schon im Meer getan|würde Sexting an die falsche Person schicken|hat heimlich ein Sexspielzeug gekauft|wird gern dominiert|dominiert gern|würde ohne Zögern mit einem Star schlafen|hat es schon bei der Arbeit getan`,
vag:`Gischt|Salz|Gezeiten|Leuchtturm|Muschel|Böe|Segel|Anker|Welle|Koralle|Wal|Krabbe|Möwe|Qualle|Delfin|Landkarte|Kompass|Horizont|Taucher|U-Boot|Wrack|Palme|Hängematte|Cocktail|Eiswürfel|Regenschirm|Fluss|Wüste|Vulkan|Höhle|Dschungel|See|Brücke|Turm|Schloss|Dorf|Regenbogen|U-Bahn|Blitz|Nebel|Fahrrad|Polarlicht|Bus|Rakete|Roboter|Computer|Komet|Planet|Gitarre|Astronaut|Trommel|Lied|Tanz|Satellit|Teleskop|Kuchen|Mikroskop|Erdbeere|Apfel|Banane|Zitrone|Labor|Krankenhaus|Brot|Suppe|Tee|Milch|Honig|Zucker|Meersalz|Eis|Bonbon|Picknick|Grillen|Küche|Apotheke|Bäckerei|Rose|Baum|Blatt|Herbst|Markt|Frühling|Wochenende|Supermarkt|Koffer|Reisepass|Hotel|Zelt|Lagerfeuer|Lampe|Kerze|Restaurant|Fenster|Tür|Schlüssel|Bett|Kissen|Kellner|Albtraum|Schlaf|Wecker|Morgen|Abend|Mitternacht|Uhr|Kalender|Speisekarte|Gabel|Heft|Bleistift|Tafel|Lehrer|Prüfung|Bibliothek|Museum|Kino|Messer|Theater|Löffel|Clown|Teller|Kochtopf|Einhorn|Gespenst|Hexe|Festung|Ritter|Prinzessin|König|Krone|Gold|Silber|Diamant|Schmuck|Backofen|Überraschung|Kühlschrank|Lüge|Wahrheit|Freundschaft|Familie|Sofa|Erinnerung|Foto|Album|Fernseher|Abenteuer|Freiheit|Stille|Lärm|Lachen|Träne|Wut|Radio|Freude|Mut|Glück|Zufall|Spiel|Spielkarte|Würfel|Ball|Fußball|Tennis|Schwimmen|Tauchen|Surfen|Skifahren|Laufen|Medaille|Sieg|Niederlage|Mannschaft|Zeitung|Hund|Pferd|Kaninchen|Vogel|Schmetterling|Biene|Ameise|Schlange|Schildkröte|Löwe|Elefant|Affe|Pinguin|Bär|Wolf|Fuchs|Eule`,
vag1:`Verabredung|Zwinkern|erröten|Kribbeln|Parfüm|Kerzenschein|Tango|Samt|Seide|Flüstern|Streicheln|Augenkontakt|Lächeln|Schwärmerei|Blütenblätter|Schmetterlinge im Bauch|Abendessen|Nacken|Schulter|Herz|gestohlener Kuss|Zärtlichkeit|Anziehung|Eifersucht|Liebesbrief|Ring|Flitterwochen|verführen|Charme|Genuss|Haut|Lippen|Blumenstrauß|anbaggern|Walzer|Geheimnis|Schaumbad|ankuscheln|fauler Morgen|Vertrautheit`,
vag2:`nackt|Fantasie|Spielzeug|Stellungen|Porno|Nacktfotos|stöhnen|Swinger|Brüste|BH|Tanga|Vorspiel|Gummi|Dildo|Augenbinde|Dominanz|Unterwerfung|Peitsche|Leder|Latex|Whirlpool|Spanner|Exhibitionist|unanständig|Freundschaft plus|Sexshop|Stellung|Orgie|Doggy|Missionar|Deepthroat|Knutschfleck|Lapdance|Strapse|Ölmassage|ejakulieren|Erektion|Nippel|Cunnilingus|Blowjob`,
rad:`Unter Wasser leben~In den Wolken leben|Ein einsamer Leuchtturm~Eine Wohnung in der Innenstadt|Ein Jahr ohne Musik~Ein Jahr ohne Filme|Immer die Wahrheit sagen~Immer lügen|Alle Sprachen sprechen~Alle Instrumente spielen|In die Vergangenheit reisen~Die Zukunft sehen|Sehr lustig sein~Sehr klug sein|Ewiger Frühling~Ewiger Herbst|Allein reisen~Nie allein reisen|Ein Haustier-Drache~Ein Roboter-Butler|Nie wieder Hunger~Nie wieder müde|200 Jahre leben~10 kurze Leben leben|Im Lotto gewinnen~Die große Liebe finden|Eine nutzlose Superkraft~Gar keine Superkraft|Singen wie ein Star~Tanzen wie ein Star|Ein Haus am Strand~Ein Chalet in den Bergen|Berühmt sein~Heimlich reich sein|Kein Handy~Kein Internet|Für immer scharf essen~Für immer fad essen|Sich an alles erinnern~Nach Belieben vergessen|Einen Tag unsichtbar~Eine Stunde fliegen|Mit dem Schiff um die Welt~Mit dem Zug um die Welt|Nie wieder gehen~Nie wieder rennen|Pirat sein~Entdecker sein|Alles über die Vergangenheit wissen~Alles über das Weltall wissen|Nachts arbeiten~Um 5 Uhr früh arbeiten|Jeden Abend ein Festmahl~Jeden Monat eine Reise|Einen Zwilling haben~Einzelkind sein|Bei jedem Satz lachen~Bei jedem Film weinen|Ein menschenleerer Strand~Ein volles Festival|Unter Wasser atmen können~Nie mehr frieren|Eine Katze sein~Ein Hund sein|Ein ruhiges Leben~Ein Leben voller Abenteuer|Auf einem Boot wohnen~In einer Hütte wohnen|Den Namen ändern~Das Land wechseln|In einer Sache der Beste sein~In allem gut sein|Fliegen können (Pilot)~Segeln können|Nie wieder Süßes~Nie wieder Käse|Als Erster auf dem Mond~Als Erster auf dem Meeresgrund|Einen Bestseller schreiben~Einen Hit komponieren|Immer 10 Minuten zu spät~Immer 30 Minuten zu früh|Ein treuer Freund~Zehn nette Freunde|Den glücklichsten Tag noch mal erleben~Einen geheimnisvollen Tag erleben|Ein Butler~Ein Privatkoch|Deine Gedanken sichtbar~Dein Suchverlauf sichtbar|Eine Tasche ohne Boden~Eine Tür nach überallhin|Keine Spiegel~Keine Fotos|Ein Riese sein~Winzig sein|In Reimen sprechen~Singen statt sprechen|Jeden Tag eine Überraschung~Jeder Tag gleich und perfekt`,
rad1:`Ein Date im Museum~Auf dem Jahrmarkt|Ein Date auf einem Boot~In einer Berghütte|Ein Liebesbrief~Ein Ständchen|Liebe auf den ersten Blick~Freundschaft, die zu Liebe wird|Zusammen kochen~Sich das Essen ans Bett bringen lassen|Ein Überraschungsdate~Ein perfekt geplantes Date|Eine Sommerliebe~Eine Büroromanze|Händchen halten~Sich um die Taille fassen|Ein lustiger Partner~Ein geheimnisvoller Partner|Ein Schmusetanz~Salsa|Frühstück im Bett~Candle-Light-Dinner|Per Nachricht flirten~Persönlich flirten|Partner-Tattoos~Partnerringe|Eng umschlungen schlafen~Jeder auf seiner Seite|Ein Wochenende in Venedig~Ein Wochenende auf einer Insel|Den ersten Schritt machen~Warten, bis der andere ihn macht|Ein zärtlicher Spitzname~Dein Name geflüstert|Ein langer Blick~Ein schiefes Lächeln|Ein Picknick am Wasser~Eine Dachterrasse in der Stadt|Ein gestohlener Kuss~Ein lang ersehnter Kuss`,
rad2:`Unter der Dusche~Auf der Waschmaschine|Dominieren~Dominiert werden|Vor dem Spiegel~Mit verbundenen Augen|Ein One-Night-Stand~Eine feste Freundschaft plus|Ein Sexspielzeug~Eine Massage|Whirlpool~Sauna|Handschellen~Federn|Schmutzige Worte~Stöhnen|Schnell und heftig~Langsam und lang|Gefilmt werden~Beobachtet werden|Eine einzige perfekte Stellung~Alle Stellungen|Im Auto~Im Aufzug|Ein Striptease~Eine Ölmassage|Eine Nacht mit einem Star~Eine Nacht mit deinem Schwarm|Ein Rollenspiel~Ein heißes Würfelspiel|Leder~Spitze|Ganz leise~Ganz laut|Ein Swingerclub~Ein FKK-Strand|Sexting~Ein heißer Anruf|Die Fantasien erzählen~Sie ohne Vorwarnung erfüllen`,
msk:`Versprich etwas Unmögliches|Beschreib deine Maske in drei Wörtern|Erzähl deine schönste Meereserinnerung|Gib einen falschen Hinweis auf dich|Schreib wie ein alter Kapitän|Verkünde deine Strategie… oder tu nur so|Stell deinem Partner eine Frage|Mach ein ehrliches Kompliment|Schreib ein Haiku|Erzähl einen richtig schlechten Witz|Sprich wie der Wetterbericht|Schreib wie eine Flaschenpost|Gesteh deine größte Angst|Feilsche wie auf dem Markt|Schreib in GROSSBUCHSTABEN, voller Leidenschaft|Sag die nächste Runde voraus|Zitiere ein erfundenes Sprichwort|Schreib wie ein Telegramm STOP|Beschreib den Schatz, den du suchst|Sei geheimnisvoll, sehr geheimnisvoll|Erzähl, was du zu Mittag gegessen hast|Verteidige dich gegen eine erfundene Anklage|Schreib es als Rap-Zeile|Schlag einen Geheimcode vor|Sprich von dir in der dritten Person|Mach ein Angebot, das man nicht ablehnen kann|Schreib nur Fragen|Sprich wie eine Meerjungfrau|Versprich zu teilen… mit gekreuzten Fingern|Schreib einen Werbeslogan über dich`,
msk1:`Beschreib dein ideales Date unter Wasser|Mach ein verführerisches Kompliment|Schreib einen Anmachspruch wie ein Matrose|Gesteh einen alten Schwarm|Schlag einen Pakt unter den Sternen vor|Beschreib, was dich schwach macht|Schreib eine Nachricht zum Flüstern|Gesteh deinen schönsten ersten Kuss|Tu so, als wärst du in deinen Partner verliebt|Beschreib den Duft deiner Maske|Schreib ein Versprechen unter dem Mond|Schlag einen Schmusetanz an Deck vor`,
msk2:`Gesteh deine seemännischste Fantasie|Beschreib deine Lieblingsstellung, ohne sie zu nennen|Erzähl vom riskantesten Ort|Schreib ein Piraten-Sexting|Gesteh, was dich im Bett verrückt macht|Schlag einen Pakt mit sehr wenig Kleidung vor|Beschreib deine wildeste Nacht in drei Wörtern|Gesteh dein geheimes Sexspielzeug|Schreib, was du in einer Schiffskabine tun würdest|Gesteh, was du noch nie ausprobiert hast|Erzähl von deinem schlimmsten Versagen|Versprich eine sehr heiße Belohnung`,
bot:`Ein ungewöhnlicher Ort, an dem du geschlafen hast|Eine Kindheitsangst|Ein Gegenstand, den du schon ewig hast|Dein schlimmster Job|Ein Gericht, das du hasst|Eine Begegnung mit einem Promi|Ein Kinderstreich|Ein verstecktes Talent|Eine Reise, die schiefging|Ein Spitzname, den du hattest|Als du dich verlaufen hast|Eine Lüge, die schlecht ausging|Dein erstes Konzert|Ein persönlicher Rekord|Ein Haustier, das du hattest|Etwas, das du nie getan hast|Ein wiederkehrender Traum|Eine Blamage in der Schule|Ein unvergessliches Geschenk|Eine seltsame Marotte|Deine schlimmste Frisur|Als du sehr mutig warst|Ein Lachanfall im falschen Moment|Ein Ort, von dem du träumst|Ein Sport, den du gemacht hast|Eine Sammlung, die du hattest|Ein Film, bei dem du geweint hast|Ein lächerlicher Unfall|Etwas, das du besser kannst als alle|Dein erster Job|Ein verlorener Gegenstand, der dir fehlt|Eine zufällige Begegnung|Ein Familienrezept|Eine Phobie|Eine Entscheidung, die alles verändert hat|Eine denkwürdige durchwachte Nacht|Ein absurder Streit|Ein Gericht, das du kochen kannst|Ein Kostüm, das du getragen hast|Eine verlorene Wette|Deine früheste Erinnerung|Ein Moment des Ruhms|Eine Sprache, die du ein bisschen sprichst|Ein Lied, das dich an jemanden erinnert|Als du geschummelt hast|Eine Begegnung mit einem wilden Tier|Ein Ort, an dem du gewohnt hast|Eine Lehrkraft, die dich geprägt hat|Ein Übersetzungsfehler|Etwas, das du immer noch sammelst`,
bot1:`Dein erster Kuss|Ein Date, das schiefging|Ein unwahrscheinlicher Schwarm|Eine gescheiterte Liebeserklärung|Eine Nachricht an die falsche Person|Ein perfektes Date|Ein Anmachspruch, der funktioniert hat|Eine Sommerliebe|Ein Kompliment, bei dem du rot wurdest|Eine lächerliche Eifersucht|Liebe auf den ersten Blick|Eine originelle Trennung|Ein Date aus einer App|Ein unvergesslicher Schmusetanz|Ein gestohlener Kuss|Ein überraschender Ex|Ein Liebesbrief|Eine Nacht unter den Sternen|Das Kennenlernen der Eltern|Ein ungeschickter Flirt`,
bot2:`Ein verrückter Ort, an dem du es getan hast|Ein denkwürdiges erstes Mal|Eine erfüllte Fantasie|Ein Versagen im Bett|Ein One-Night-Stand|Ein Sexspielzeug, das du ausprobiert hast|Als du erwischt wurdest|Ein Nacktfoto, das du verschickt hast|Ein Striptease|Eine sehr bewegte Nacht|Ein Sexting, das schiefging|Eine Erfahrung, die du nicht wiederholen würdest|Ein unerwarteter Partner|Eine Stellung, die schiefging|Ein gewagter öffentlicher Ort|Ein Einkauf im Sexshop|Eine Party, die aus dem Ruder lief|Ein erotischer Traum|Eine unaussprechliche Fantasie|Eine Nacht mit einem Fremden`});
GXP('ru',{pha:`разговаривал(а) с животным как с человеком|был(а) бы лучшим капитаном корабля|забудет собственный день рождения|слушает самый стыдный плейлист|засмеётся в самый неподходящий момент|переживёт зомби-апокалипсис|заведёт кур в городе|станет мэром своей деревни|встанет в 5 утра ради рассвета|готов(а) есть одно и то же каждый день|хранит больше всех фото в телефоне|опоздает на самолёт|прочитает всю инструкцию целиком|выиграет конкурс по поеданию блинов|в итоге будет жить за границей|поднимает всем настроение|лучше всех готовит почти из ничего|сохранит спокойствие в шторм|первым(ой) прыгнет в ледяную воду|купит остров, выиграв в лотерею|обладает самой впечатляющей памятью|в прошлой жизни был(а) пиратом|больше всех разговаривает во сне|изобретёт полезную вещь|покрасит волосы в синий|влюбится в отпуске|фальшивее всех поёт в душе|был(а) бы лучшим учителем|не проживёт без кофе|заблудится даже с навигатором|откроет ресторан|заразительнее всех смеётся|здоровается со всем районом|помнит все дни рождения|переплывёт океан на паруснике|напишет роман|хуже всех проигрывает|дольше всех спит по выходным|продержится месяц без телефона|разбогатеет на безумной идее|держит дома больше всех растений|был(а) бы лучшим детективом|узнаёт песню по двум нотам|завтра уедет без чемодана|раскладывает всё по цветам|имеет больше всех обуви|лучше всех распознаёт ложь|начнёт выступать со стендапом|чаще всех меняет причёску|говорил(а) бы с дельфинами, если бы мог(ла)|всегда уходит с вечеринки последним(ей)|всегда приходит раньше времени|всегда опаздывает|обладает самой красивой улыбкой|отправит письмо вместо сообщения|скрывает больше всех талантов|прославится в реалити-шоу|станет смотрителем маяка|знает наизусть реплики из фильма|лучше всех изображает акценты|объедет мир на велосипеде|просыпается без будильника|уже дремал(а) на работе|самый упрямый|лучше всех обнимается|будет избран(а) старостой класса|лучше всех торгуется|больше всех путешествовал(а)|первым(ой) сдастся перед десертом|сохранит секрет даже под пытками|будет говорить на большем числе языков|дольше всех продержится без слов|найдёт клад, ныряя с аквалангом|разобьёт огород на балконе|был(а) бы лучшим соседом по квартире|был(а) бы худшим соседом по квартире|знает больше всех плохих анекдотов|заводит друзей в очереди|больше всех энергии по утрам|пересматривает один сериал по кругу|был(а) бы потрясающим гидом|выживет один(одна) в лесу|потратит всё на путешествия|дарит лучшие подарки|без стеснения попросит селфи у звезды|первым(ой) полетит на Марс|самое мягкое сердце|всегда найдёт оправдание|останется другом с бывшим|быстрее всех отвечает на сообщения|оставляет сообщения «прочитанными»|мог(ла) бы стать профессиональным спортсменом|займётся гончарным делом|знает все сплетни|ведёт дневник|король или королева караоке|будет жить кочевником в фургоне|произнесёт лучшую свадебную речь`,
pha1:`больше всех покорил(а) сердец|отправит смелое фото|самый обаятельный смех|влюблялся(лась) с первого взгляда|будет флиртовать с официантом|самый соблазнительный взгляд|первым(ой) скажет «люблю»|признается в любви публично|был(а) влюблён(а) в учителя|самый чувственный танец|тает от акцента|делает самые обезоруживающие комплименты|целовал(а) незнакомца|самые запоминающиеся свидания|может соблазнить кого угодно|надевает комплект белья на первое свидание|пережил(а) худшее свидание|обожает утренние обнимашки|больше всех мэтчей в приложениях|будет встречаться с двумя одновременно|напишет страстное любовное письмо|хранит больше всех вещей от бывших|самый пьянящий аромат|искупается голым(ой) ночью|признался(лась) в чувствах случайно|не устоит перед формой|выиграет в бутылочку|целовался(лась) дольше всех|проявляет инициативу на первом свидании|уже флиртовал(а) с кем-то отсюда`,
pha2:`ночевал(а) у незнакомца после вечеринки|имеет больше всех секс-игрушек|делал(а) это в примерочной|смотрит больше всех порно|пробовал(а) горячую ролевую игру|хранит секретную папку смелых фото|согласится на секс втроём|был(а) застигнут(а) с поличным|самый опытный в постели|спал(а) с бывшим друга|попробует бондаж|делал(а) это в самолёте|скажет «да» сексу на одну ночь сегодня|крутил(а) роман с коллегой|грязнее всех говорит в постели|самая непристойная фантазия|танцевал(а) стриптиз|спал(а) с кем-то, не зная имени|сходит в свинг-клуб|делал(а) это больше пяти раз за ночь|снимет домашнее порно|больше всех связей на одну ночь|облажался(лась) в самый неподходящий момент|делал(а) это в море|отправит секстинг не тому человеку|тайком купил(а) секс-игрушку|любит подчиняться|любит доминировать|без колебаний переспит со звездой|делал(а) это на работе`,
vag:`пена|соль|прилив|маяк|ракушка|шквал|парус|якорь|волна|коралл|кит|краб|чайка|медуза|дельфин|карта|компас|горизонт|водолаз|подводная лодка|обломки корабля|пальма|гамак|коктейль|кубик льда|зонт|река|пустыня|вулкан|пещера|джунгли|озеро|мост|башня|замок|деревня|радуга|метро|молния|туман|велосипед|северное сияние|автобус|ракета|робот|компьютер|комета|планета|гитара|космонавт|барабан|песня|танец|спутник|телескоп|торт|микроскоп|клубника|яблоко|банан|лимон|лаборатория|больница|хлеб|суп|чай|молоко|мёд|сахар|морская соль|мороженое|конфета|пикник|шашлык|кухня|аптека|пекарня|роза|дерево|лист|осень|рынок|весна|выходные|супермаркет|чемодан|паспорт|гостиница|палатка|костёр|лампа|свеча|ресторан|окно|дверь|ключ|кровать|подушка|официант|кошмар|дремота|будильник|утро|вечер|полночь|часы|календарь|меню|вилка|тетрадь|карандаш|доска|учитель|экзамен|библиотека|музей|кино|нож|театр|ложка|клоун|тарелка|кастрюля|единорог|привидение|ведьма|крепость|рыцарь|принцесса|король|корона|золото|серебро|бриллиант|украшение|духовка|сюрприз|холодильник|ложь|правда|дружба|семья|диван|воспоминание|фотография|альбом|телевизор|приключение|свобода|тишина|шум|смех|слеза|гнев|радио|радость|смелость|удача|случай|игра|игральная карта|кубик|мяч|футбол|теннис|плавание|дайвинг|сёрфинг|лыжи|бег|медаль|победа|поражение|команда|газета|собака|лошадь|кролик|птица|бабочка|пчела|муравей|змея|черепаха|лев|слон|обезьяна|пингвин|медведь|волк|лиса|сова`,
vag1:`встреча вдвоём|подмигивание|краснеть|трепет|духи|при свечах|танго|бархат|шёлк|шёпот|ласка|взгляд в глаза|улыбка|влюблённость|лепестки|бабочки в животе|ужин|затылок|плечо|сердце|украденный поцелуй|нежность|притяжение|ревность|любовное письмо|кольцо|медовый месяц|соблазнять|обаяние|удовольствие|кожа|губы|букет|клеить|вальс|тайна|пенная ванна|прижаться|ленивое утро|близость`,
vag2:`голый|фантазия|игрушка|позы|порно|нюдсы|стонать|свингер|грудь|лифчик|стринги|прелюдия|резинка|дилдо|повязка на глаза|доминирование|подчинение|плётка|кожаный костюм|латекс|джакузи|вуайерист|эксгибиционист|шалун|секс по дружбе|секс-шоп|поза|оргия|сзади|миссионерская|глубокая глотка|засос|приватный танец|подвязки|масляный массаж|кончить|эрекция|соски|куннилингус|минет`,
rad:`Жить под водой~Жить в облаках|Одинокий маяк~Квартира в центре города|Год без музыки~Год без фильмов|Всегда говорить правду~Всегда врать|Говорить на всех языках~Играть на всех инструментах|Вернуться в прошлое~Увидеть будущее|Быть очень смешным~Быть очень умным|Вечная весна~Вечная осень|Путешествовать одному~Никогда не путешествовать одному|Ручной дракон~Робот-дворецкий|Никогда не хотеть есть~Никогда не хотеть спать|Прожить 200 лет~Прожить 10 коротких жизней|Выиграть в лотерею~Найти любовь всей жизни|Бесполезная суперсила~Никакой суперсилы|Петь как звезда~Танцевать как звезда|Дом на пляже~Шале в горах|Быть знаменитым~Быть тайно богатым|Без телефона~Без интернета|Всю жизнь острая еда~Всю жизнь пресная еда|Помнить всё~Забывать по желанию|Невидимость на день~Полёт на час|Вокруг света на корабле~Вокруг света на поезде|Больше никогда не ходить~Больше никогда не бегать|Быть пиратом~Быть исследователем|Знать всё о прошлом~Знать всё о космосе|Работать ночью~Работать с 5 утра|Пир каждый вечер~Путешествие каждый месяц|Иметь близнеца~Быть единственным ребёнком|Смеяться над каждой фразой~Плакать над каждым фильмом|Безлюдный пляж~Многолюдный фестиваль|Дышать под водой~Никогда не мёрзнуть|Быть кошкой~Быть собакой|Спокойная жизнь~Жизнь, полная приключений|Жить на лодке~Жить в хижине|Сменить имя~Сменить страну|Быть лучшим в одном~Быть хорошим во всём|Уметь пилотировать~Уметь ходить под парусом|Больше никаких сладостей~Больше никакого сыра|Первым на Луне~Первым на дне океана|Написать бестселлер~Сочинить хит|Всегда опаздывать на 10 минут~Всегда приходить на 30 минут раньше|Один верный друг~Десять приятных друзей|Заново прожить самый счастливый день~Прожить загадочный день|Дворецкий~Личный повар|Твои мысли видны всем~Твоя история поиска видна всем|Бездонная сумка~Дверь куда угодно|Без зеркал~Без фотографий|Быть великаном~Быть крошечным|Говорить стихами~Петь вместо слов|Каждый день сюрприз~Каждый день одинаковый и идеальный`,
rad1:`Свидание в музее~В парке аттракционов|Свидание на лодке~В горном домике|Любовное письмо~Серенада|Любовь с первого взгляда~Дружба, ставшая любовью|Готовить вместе~Завтрак в постель от любимого|Свидание-сюрприз~Идеально спланированное свидание|Курортный роман~Служебный роман|Держаться за руки~Обнимать за талию|Весёлый партнёр~Загадочный партнёр|Медленный танец~Сальса|Завтрак в постель~Ужин при свечах|Флиртовать в переписке~Флиртовать вживую|Парные татуировки~Парные кольца|Спать в обнимку~Каждый на своей половине|Выходные в Венеции~Выходные на острове|Сделать первый шаг~Ждать, пока сделает другой|Нежное прозвище~Твоё имя шёпотом|Долгий взгляд~Кривая улыбка|Пикник у воды~Терраса в городе|Украденный поцелуй~Долгожданный поцелуй`,
rad2:`В душе~На стиральной машине|Доминировать~Подчиняться|Перед зеркалом~С завязанными глазами|Секс на одну ночь~Постоянный секс по дружбе|Секс-игрушка~Массаж|Джакузи~Сауна|Наручники~Пёрышки|Грязные словечки~Стоны|Быстро и жёстко~Медленно и долго|Быть заснятым~Быть под наблюдением|Одна идеальная поза~Все позы|В машине~В лифте|Стриптиз~Массаж с маслом|Ночь со звездой~Ночь с твоей симпатией|Ролевая игра~Горячая игра в кости|Кожа~Кружево|Тихо~Громко|Свинг-клуб~Нудистский пляж|Секстинг~Горячий звонок|Рассказать о фантазиях~Воплотить их без предупреждения`,
msk:`Пообещай невозможное|Опиши свою маску тремя словами|Расскажи самое красивое морское воспоминание|Дай ложную подсказку о себе|Пиши как старый капитан|Объяви свою стратегию… или притворись|Задай вопрос своему партнёру|Сделай искренний комплимент|Напиши хайку|Расскажи ужасный анекдот|Говори как прогноз погоды|Пиши как письмо в бутылке|Признайся в самом большом страхе|Торгуйся как на базаре|Пиши ЗАГЛАВНЫМИ, со страстью|Предскажи следующий раунд|Процитируй выдуманную пословицу|Пиши как телеграмма ТЧК|Опиши сокровище, которое ищешь|Будь загадочным, очень загадочным|Расскажи, что ел на обед|Защищайся от выдуманного обвинения|Напиши это рэп-строчкой|Предложи секретный код|Говори о себе в третьем лице|Сделай предложение, от которого нельзя отказаться|Пиши только вопросами|Говори как русалка|Пообещай делиться… скрестив пальцы|Напиши рекламный слоган о себе`,
msk1:`Опиши идеальное свидание под водой|Сделай соблазнительный комплимент|Напиши подкат в стиле моряка|Признайся в старой влюблённости|Предложи договор под звёздами|Опиши, от чего ты таешь|Напиши сообщение, которое читают шёпотом|Признайся в лучшем первом поцелуе|Притворись, что влюблён в партнёра|Опиши аромат своей маски|Напиши клятву под луной|Предложи медленный танец на палубе`,
msk2:`Признайся в самой морской фантазии|Опиши любимую позу, не называя её|Расскажи о самом рискованном месте|Напиши пиратский секстинг|Признайся, что сводит тебя с ума в постели|Предложи договор почти без одежды|Опиши самую безумную ночь тремя словами|Признайся в своей тайной секс-игрушке|Напиши, что бы ты сделал в каюте корабля|Признайся, чего никогда не пробовал|Расскажи о худшем провале|Пообещай очень горячую награду`,
bot:`Необычное место, где ты спал|Детский страх|Вещь, которая у тебя очень давно|Твоя худшая работа|Блюдо, которое ты ненавидишь|Встреча со знаменитостью|Детская шалость|Скрытый талант|Поездка, которая пошла не так|Прозвище, которое у тебя было|Как ты однажды заблудился|Ложь, которая плохо кончилась|Твой первый концерт|Личный рекорд|Питомец, который у тебя был|То, чего ты никогда не делал|Повторяющийся сон|Позор в школе|Незабываемый подарок|Странная привычка|Твоя худшая стрижка|Когда ты был очень смелым|Смех в неподходящий момент|Место, куда ты мечтаешь попасть|Спорт, которым ты занимался|Коллекция, которая у тебя была|Фильм, над которым ты плакал|Нелепый несчастный случай|То, что ты умеешь лучше всех|Твоя первая работа|Потерянная вещь, по которой скучаешь|Случайная встреча|Семейный рецепт|Фобия|Решение, которое всё изменило|Незабываемая бессонная ночь|Абсурдная ссора|Блюдо, которое ты умеешь готовить|Костюм, который ты надевал|Проигранное пари|Твоё самое раннее воспоминание|Минута славы|Язык, на котором ты немного говоришь|Песня, которая напоминает о ком-то|Когда ты сжульничал|Встреча с диким животным|Место, где ты жил|Учитель, который на тебя повлиял|Ошибка перевода|То, что ты до сих пор коллекционируешь`,
bot1:`Твой первый поцелуй|Свидание, которое пошло не так|Невероятная влюблённость|Неудачное признание в любви|Сообщение не тому человеку|Идеальное свидание|Подкат, который сработал|Летняя любовь|Комплимент, от которого ты покраснел|Нелепая ревность|Любовь с первого взгляда|Необычное расставание|Свидание из приложения|Незабываемый медленный танец|Украденный поцелуй|Удивительный бывший|Любовное письмо|Ночь под звёздами|Знакомство с родителями|Неловкий флирт`,
bot2:`Безумное место, где ты это делал|Незабываемый первый раз|Сбывшаяся фантазия|Провал в постели|Секс на одну ночь|Секс-игрушка, которую ты пробовал|Когда тебя застукали|Нюдс, который ты отправил|Стриптиз|Очень бурная ночь|Неудачный секстинг|Опыт, который ты не повторил бы|Неожиданный партнёр|Поза, которая не удалась|Смелое публичное место|Покупка в секс-шопе|Вечеринка, вышедшая из-под контроля|Эротический сон|Непристойная фантазия|Ночь с незнакомцем`});
GXP('zh',{pha:`曾把动物当人一样聊天|会是最棒的船长|会忘记自己的生日|歌单最让人尴尬|会在最不合适的时候笑出来|能在丧尸末日中活下来|会在城里养鸡|会当上家乡的村长|会凌晨五点起床看日出|愿意每天吃同一样东西|手机里照片最多|会误了飞机|会把说明书从头读到尾|会赢下吃煎饼大赛|最后会定居国外|最会让大家开心|最会用几乎没有的食材做饭|在暴风雨中最冷静|会第一个跳进冰水|中了彩票会买一座岛|记忆力最惊人|上辈子是海盗|最爱说梦话|会发明一个实用的东西|会把头发染成蓝色|会在度假时坠入爱河|洗澡唱歌最跑调|会是最好的老师|离不开咖啡|开着导航也会迷路|会开一家餐厅|笑声最有感染力|跟整条街的人打招呼|记得所有人的生日|会驾帆船横渡大洋|会写一本小说|最输不起|周末睡得最久|能一个月不碰手机|会靠一个疯狂点子发财|家里植物最多|会是最厉害的侦探|两个音就能听出是哪首歌|明天就能空手出发|所有东西都按颜色排|鞋子最多|最会识破谎言|会去讲脱口秀|最常换发型|如果可以会和海豚聊天|总是最后一个离开派对|总是提前到|总是迟到|笑容最美|会写信而不是发消息|隐藏技能最多|会在真人秀里爆红|会去当灯塔看守人|能背出整部电影的台词|最会模仿口音|会骑自行车环游世界|不用闹钟就能醒|上班时偷偷打过盹|最固执|拥抱最温暖|会被选为班长|最会砍价|去过的地方最多|看到甜点第一个投降|就算被严刑逼供也会守住秘密|将来会说最多种语言|能最久不说话|潜水时会找到宝藏|会在阳台上种菜|会是最好的室友|会是最糟的室友|知道最多冷笑话|排队时都能交到朋友|早上精力最旺盛|同一部剧反复看|会是超棒的导游|能独自在森林里生存|会把钱全花在旅行上|送礼物最用心|会毫不害羞地找明星合影|会第一个去火星|心肠最软|总有借口|会和前任继续做朋友|回消息最快|消息总是已读不回|本来可以成为职业运动员|会去学陶艺|知道所有八卦|有写日记的习惯|是卡拉OK之王|会开着房车四处漂泊|会在婚礼上致最动人的祝词`,
pha1:`情史最丰富|会发一张大胆的照片|笑起来最迷人|有过一见钟情|会和服务员调情|最会放电|会先说“我爱你”|会当众表白|暗恋过老师|跳舞最性感|听到口音就心动|夸人最让人招架不住|吻过陌生人|约会经历最难忘|能撩到任何人|第一次约会会穿成套内衣|经历过最糟的约会|最爱早上的抱抱|交友软件配对最多|会同时和两个人约会|会写一封热烈的情书|留着最多前任的纪念品|身上味道最迷人|会在夜里裸泳|不小心表白过|对制服毫无抵抗力|转瓶子游戏会赢|接过最长的吻|第一次约会主动出击|已经撩过这里的某个人`,
pha2:`派对后在陌生人家过过夜|情趣玩具最多|在试衣间做过|看片最多|玩过火辣的角色扮演|有个藏着大胆照片的秘密相册|会尝试三人行|被当场撞见过|床上经验最丰富|睡过朋友的前任|会尝试捆绑|在飞机上做过|今晚会答应一夜情|和同事有过一段|床上最会说骚话|有最难以启齿的幻想|跳过脱衣舞|和不知道名字的人睡过|会去换伴俱乐部|一晚上做过五次以上|会拍成人视频|一夜情最多|在最关键的时候掉过链子|在海里做过|会把骚话发错人|偷偷买过情趣玩具|喜欢被支配|喜欢支配别人|会毫不犹豫和明星上床|在工作场所做过`,
vag:`浪花|盐|潮汐|灯塔|贝壳|狂风|船帆|船锚|波浪|珊瑚|鲸鱼|螃蟹|海鸥|水母|海豚|地图|指南针|地平线|潜水员|潜水艇|沉船|棕榈树|吊床|鸡尾酒|冰块|雨伞|河流|沙漠|火山|山洞|丛林|湖泊|桥|塔|城堡|村庄|彩虹|地铁|闪电|雾|自行车|极光|公交车|火箭|机器人|电脑|彗星|行星|吉他|宇航员|鼓|歌曲|舞蹈|卫星|望远镜|蛋糕|显微镜|草莓|苹果|香蕉|柠檬|实验室|医院|面包|汤|茶|牛奶|蜂蜜|糖|海盐|冰淇淋|糖果|野餐|烧烤|厨房|药店|面包店|玫瑰|树|叶子|秋天|集市|春天|周末|超市|行李箱|护照|酒店|帐篷|篝火|台灯|蜡烛|餐厅|窗户|门|钥匙|床|枕头|服务员|噩梦|睡眠|闹钟|早晨|傍晚|午夜|手表|日历|菜单|叉子|笔记本|铅笔|黑板|老师|考试|图书馆|博物馆|电影院|刀|剧院|勺子|小丑|盘子|锅|独角兽|幽灵|女巫|堡垒|骑士|公主|国王|王冠|金子|银子|钻石|首饰|烤箱|惊喜|冰箱|谎言|真相|友谊|家庭|沙发|回忆|照片|相册|电视|冒险|自由|寂静|噪音|笑声|眼泪|愤怒|收音机|快乐|勇气|运气|巧合|游戏|扑克牌|骰子|球|足球|网球|游泳|潜水|冲浪|滑雪|跑步|奖牌|胜利|失败|队伍|报纸|狗|马|兔子|鸟|蝴蝶|蜜蜂|蚂蚁|蛇|乌龟|狮子|大象|猴子|企鹅|熊|狼|狐狸|猫头鹰`,
vag1:`二人世界|眨眼|脸红|心跳加速|香水|烛光|探戈|天鹅绒|丝绸|耳语|抚摸|对视|微笑|暗恋|花瓣|小鹿乱撞|晚餐|后颈|肩膀|心|偷吻|温柔|吸引力|吃醋|情书|戒指|蜜月|勾引|魅力|愉悦|肌肤|嘴唇|花束|搭讪|华尔兹|神秘|泡泡浴|依偎|慵懒的早晨|默契`,
vag2:`裸体|幻想|玩具|体位|色情片|裸照|喘息|换伴|胸部|胸罩|丁字裤|前戏|套套|假阳具|眼罩|支配|服从|鞭子|皮衣|乳胶|按摩浴缸|偷窥狂|暴露狂|调皮|炮友|情趣店|姿势|群交|后入|传教士|深喉|吻痕|膝上舞|吊袜带|精油按摩|射精|勃起|乳头|舔阴|口交`,
rad:`住在水下~住在云端|孤独的灯塔~市中心的公寓|一年没有音乐~一年没有电影|永远说真话~永远说谎|会说所有语言~会弹所有乐器|回到过去~看见未来|非常幽默~非常聪明|永远的春天~永远的秋天|独自旅行~从不独自旅行|宠物龙~机器人管家|再也不会饿~再也不会困|活200岁~活10段短暂的人生|中彩票~找到一生挚爱|一个没用的超能力~没有超能力|唱歌像明星~跳舞像明星|海边的房子~山里的小木屋|出名~偷偷有钱|没有手机~没有网络|一辈子吃辣~一辈子吃清淡|记住一切~想忘就忘|隐身一天~飞行一小时|坐船环游世界~坐火车环游世界|再也不能走路~再也不能跑步|当海盗~当探险家|知道过去的一切~知道宇宙的一切|上夜班~早上五点上班|每晚一场盛宴~每月一次旅行|有个双胞胎~当独生子女|每句话都笑~每部电影都哭|无人的海滩~热闹的音乐节|能在水下呼吸~永远不怕冷|当一只猫~当一只狗|平静的生活~充满冒险的生活|住在船上~住在小屋里|改名字~换国家|在一件事上最强~样样都不错|会开飞机~会驾帆船|再也不吃甜食~再也不吃奶酪|第一个登上月球~第一个到达海底|写一本畅销书~写一首热门歌|永远迟到10分钟~永远早到30分钟|一个忠诚的朋友~十个友好的朋友|重温最快乐的一天~度过神秘的一天|一个管家~一个私人厨师|想法被人看见~搜索记录被人看见|无底的包~通往任何地方的门|没有镜子~没有照片|当巨人~变得很小|说话押韵~用唱代替说|每天一个惊喜~每天一样的完美`,
rad1:`在博物馆约会~在游乐园约会|在船上约会~在山间小屋约会|一封情书~一首小夜曲|一见钟情~日久生情|一起做饭~让对方把饭端到床上|惊喜约会~完美规划的约会|夏日恋情~办公室恋情|手牵手~搂着腰|有趣的伴侣~神秘的伴侣|慢舞~萨尔萨舞|床上早餐~烛光晚餐|发消息调情~当面调情|情侣纹身~情侣对戒|相拥而眠~各睡一边|威尼斯周末~海岛周末|主动迈出第一步~等对方先开口|甜蜜的昵称~被轻声呼唤名字|长久的凝视~嘴角一笑|水边野餐~城市露台|偷来的吻~期待已久的吻`,
rad2:`在淋浴间~在洗衣机上|支配~被支配|对着镜子~蒙着眼睛|一夜情~固定炮友|情趣玩具~按摩|按摩浴缸~桑拿|手铐~羽毛|说骚话~叫出声|又快又猛~又慢又久|被拍下来~被人看着|一个完美体位~所有体位|在车里~在电梯里|脱衣舞~精油按摩|与明星春宵一刻~与心上人春宵一刻|角色扮演~火辣骰子游戏|皮革~蕾丝|悄无声息~大声尽情|换伴俱乐部~裸体海滩|发骚话短信~打火辣电话|说出幻想~不打招呼直接实现`,
msk:`许一个不可能的承诺|用三个词描述你的面具|讲讲你最美的海边回忆|给一个关于你的假线索|用老船长的口吻写|宣布你的策略……或者假装|问你的搭档一个问题|真诚地夸一句|写一首俳句|讲一个超冷的笑话|像天气预报一样说话|像漂流瓶里的信一样写|坦白你最大的恐惧|像在菜市场一样讨价还价|用大写字母激情地写|预测下一轮|引用一句编出来的谚语|像电报一样写 完毕|描述你在寻找的宝藏|保持神秘，非常神秘|说说你午饭吃了什么|为一个虚构的指控辩护|写成一句说唱|提议一个暗号|用第三人称说自己|提出一个无法拒绝的条件|只用问句写|像美人鱼一样说话|承诺会分享……手指交叉着|给自己写一句广告语`,
msk1:`描述你理想的水下约会|说一句撩人的夸奖|写一句水手式搭讪|坦白一段旧日暗恋|提议在星空下立约|描述什么会让你融化|写一条要轻声读的消息|坦白你最美的初吻|假装爱上了你的搭档|描述你面具的香气|写一句月下誓言|提议在甲板上跳支慢舞`,
msk2:`坦白你最有海味的幻想|不说名字描述你最爱的体位|讲讲最冒险的地点|写一段海盗风格的骚话|坦白床上什么让你疯狂|提议一个穿得很少的约定|用三个词形容你最疯狂的一夜|坦白你的秘密情趣玩具|写下你在船舱里会做什么|坦白你从没试过的事|讲讲你最糟的失手|许诺一个很火辣的奖励`,
bot:`你睡过的一个奇怪地方|小时候的一个恐惧|你保存多年的一样东西|你做过最糟的工作|你讨厌的一道菜|遇见名人的经历|小时候干过的坏事|一个隐藏技能|一次出岔子的旅行|你以前的外号|你迷路的一次|一个收不了场的谎言|你的第一场演唱会|一项个人纪录|你养过的宠物|你从没做过的事|反复做的一个梦|在学校出过的糗|难忘的一份礼物|一个奇怪的小癖好|你最失败的发型|你特别勇敢的一次|在错误时机大笑|你梦想去的地方|你练过的运动|你以前的收藏|让你哭的一部电影|一次荒唐的意外|你比谁都擅长的事|你的第一份工作|你怀念的一件丢失物品|一次偶遇|家传菜谱|一种恐惧症|改变一切的决定|难忘的通宵|一次荒唐的争吵|你会做的一道菜|你穿过的一套装扮|输掉的一次赌约|你最早的记忆|你的高光时刻|你会说一点的语言|让你想起某人的歌|你作弊的一次|遇见野生动物|你住过的地方|影响你的一位老师|一次翻译错误|你至今还在收藏的东西`,
bot1:`你的初吻|一次搞砸的约会|一段不可思议的暗恋|一次失败的表白|发错人的消息|一次完美的约会|一次成功的搭讪|一段夏日恋情|让你脸红的夸奖|一次可笑的吃醋|一次一见钟情|一次别致的分手|交友软件上的约会|难忘的慢舞|一个偷吻|让人意外的前任|一封情书|星空下的一夜|第一次见对方父母|一次笨拙的调情`,
bot2:`你做过的最疯狂的地点|难忘的第一次|实现过的幻想|床上的失手|一次一夜情|你试过的情趣玩具|被撞见的一次|你发过的裸照|一次脱衣舞|非常激烈的一夜|一次失败的骚话聊天|不想再来一次的经历|意想不到的对象|失败的体位|大胆的公共场所|情趣店购物经历|失控的派对|一个春梦|难以启齿的幻想|和陌生人的一夜`});
GXP('he',{pha:`דיבר פעם עם חיה כמו עם בן אדם|יהיה רב החובל הכי טוב|ישכח את יום ההולדת של עצמו|יש לו את הפלייליסט הכי מביך|יצחק ברגע הכי לא מתאים|ישרוד אפוקליפסת זומבים|יגדל תרנגולות בעיר|ייבחר לראש המועצה של העיירה שלו|יקום בחמש בבוקר בשביל הזריחה|יאכל את אותו הדבר כל יום|יש לו הכי הרבה תמונות בטלפון|יפספס את הטיסה|יקרא את כל חוברת ההוראות|ינצח בתחרות אכילת פנקייקים|יגור בסוף בחו״ל|מרים לכולם את מצב הרוח|מבשל הכי טוב כמעט מכלום|יישאר רגוע בסערה|יקפוץ ראשון למים קפואים|יקנה אי אם יזכה בלוטו|יש לו את הזיכרון הכי מרשים|היה פיראט בגלגול קודם|מדבר הכי הרבה מתוך שינה|ימציא חפץ שימושי|יצבע את השיער בכחול|יתאהב בחופשה|שר הכי מזייף במקלחת|יהיה המורה הכי טוב|לא יכול לחיות בלי קפה|ילך לאיבוד גם עם ניווט|יפתח מסעדה|יש לו את הצחוק הכי מדבק|אומר שלום לכל השכונה|זוכר את כל ימי ההולדת|יחצה את האוקיינוס במפרשית|יכתוב רומן|הכי לא יודע להפסיד|ישן הכי הרבה בסופ״ש|יחזיק חודש בלי טלפון|יתעשר מרעיון מטורף|יש לו הכי הרבה עציצים בבית|יהיה הבלש הכי טוב|מזהה שיר משני צלילים|ייסע מחר בלי מזוודה|מסדר הכול לפי צבעים|יש לו הכי הרבה נעליים|הכי טוב בזיהוי שקרים|יתחיל לעשות סטנדאפ|מחליף תסרוקת הכי הרבה|היה מדבר עם דולפינים אם היה יכול|תמיד אחרון לעזוב את המסיבה|תמיד מגיע מוקדם|תמיד מאחר|יש לו את החיוך הכי יפה|ישלח מכתב במקום הודעה|יש לו הכי הרבה כישרונות נסתרים|יתפוצץ בריאליטי|יהיה שומר מגדלור|יודע בעל פה את כל הדיאלוגים של סרט|הכי טוב בחיקוי מבטאים|יקיף את העולם באופניים|מתעורר בלי שעון מעורר|כבר נמנם בעבודה|הכי עקשן|נותן את החיבוקים הכי טובים|ייבחר לוועד הכיתה|הכי טוב במיקוח|טייל הכי הרבה|הראשון להישבר מול קינוח|ישמור סוד גם תחת עינויים|ידבר הכי הרבה שפות|יחזיק הכי הרבה זמן בלי לדבר|ימצא אוצר בצלילה|יגדל ירקות במרפסת|יהיה השותף לדירה הכי טוב|יהיה השותף לדירה הכי גרוע|מכיר הכי הרבה בדיחות קרש|מכיר חברים בתור|יש לו הכי הרבה אנרגיה בבוקר|רואה את אותה סדרה שוב ושוב|יהיה מדריך טיולים מעולה|ישרוד לבד ביער|יבזבז הכול על טיולים|נותן את המתנות הכי טובות|יבקש סלפי מסלב בלי בושה|ייסע ראשון למאדים|יש לו את הלב הכי רך|תמיד יש לו תירוץ|יישאר חבר של אקס|עונה הכי מהר להודעות|משאיר הודעות על ״נקרא״|יכול היה להיות ספורטאי מקצועי|יתחיל לעשות קרמיקה|יודע את כל הרכילויות|כותב יומן|מלך הקריוקי|יחיה כנווד בוואן|ינאם את נאום החתונה הכי יפה`,
pha1:`היו לו הכי הרבה כיבושים|ישלח תמונה נועזת|יש לו את הצחוק הכי מקסים|התאהב ממבט ראשון|יפלרטט עם המלצר|יש לו את המבט הכי מפתה|יגיד ״אני אוהב אותך״ ראשון|יתוודה על אהבה בפומבי|היה דלוק על מורה|רוקד הכי חושני|נמס ממבטא|נותן את המחמאות הכי מפרקות|נישק זר|יש לו את הדייטים הכי בלתי נשכחים|יכול לפתות כל אחד|לובש הלבשה תחתונה תואמת לדייט ראשון|היה לו הדייט הכי גרוע|מת על חיבוקים של בוקר|יש לו הכי הרבה מאצ׳ים באפליקציות|יצא עם שניים במקביל|יכתוב מכתב אהבה סוער|שומר הכי הרבה מזכרות מאקסים|יש לו את הריח הכי משכר|ישחה עירום בלילה|התוודה בטעות|נשבר מול מדים|ינצח בסובב את הבקבוק|נתן את הנשיקה הכי ארוכה|לוקח יוזמה בדייט ראשון|כבר פלרטט עם מישהו כאן`,
pha2:`ישן אצל זר אחרי מסיבה|יש לו הכי הרבה צעצועי מין|עשה את זה בתא מדידה|רואה הכי הרבה פורנו|עשה משחק תפקידים לוהט|יש לו תיקייה סודית של תמונות נועזות|יעשה שלישייה|נתפס על חם|הכי מנוסה במיטה|שכב עם האקס של חבר|ינסה בונדאז׳|עשה את זה במטוס|יגיד כן לסטוץ הלילה|היה לו רומן עם עמית לעבודה|מדבר הכי מלוכלך במיטה|יש לו את הפנטזיה הכי לא אומרים|עשה סטריפטיז|שכב עם מישהו בלי לדעת את שמו|ינסה מועדון חילופי זוגות|עשה את זה יותר מחמש פעמים בלילה אחד|יצלם סרטון סקס|היו לו הכי הרבה סטוצים|פישל ברגע הכי גרוע|עשה את זה בים|ישלח סקסטינג לאדם הלא נכון|קנה צעצוע מין בסתר|אוהב שמשתלטים עליו|אוהב להשתלט|ישכב עם סלב בלי לחשוב פעמיים|עשה את זה בעבודה`,
vag:`קצף|מלח|גאות|מגדלור|צדף|משב רוח|מפרש|עוגן|גל|אלמוג|לווייתן|סרטן|שחף|מדוזה|דולפין|מפה|מצפן|אופק|צוללן|צוללת|ספינה טרופה|דקל|ערסל|קוקטייל|קוביית קרח|מטרייה|נהר|מדבר|הר געש|מערה|ג׳ונגל|אגם|גשר|מגדל|טירה|כפר|קשת בענן|רכבת תחתית|ברק|ערפל|אופניים|זוהר צפוני|אוטובוס|טיל|רובוט|מחשב|שביט|כוכב לכת|גיטרה|אסטרונאוט|תוף|שיר|ריקוד|לוויין|טלסקופ|עוגה|מיקרוסקופ|תות|תפוח|בננה|לימון|מעבדה|בית חולים|לחם|מרק|תה|חלב|דבש|סוכר|מלח ים|גלידה|סוכרייה|פיקניק|מנגל|מטבח|בית מרקחת|מאפייה|ורד|עץ|עלה|סתיו|שוק|אביב|סוף שבוע|סופרמרקט|מזוודה|דרכון|מלון|אוהל|מדורה|מנורה|נר|מסעדה|חלון|דלת|מפתח|מיטה|כרית|מלצר|סיוט|שינה|שעון מעורר|בוקר|ערב|חצות|שעון|לוח שנה|תפריט|מזלג|מחברת|עיפרון|לוח|מורה|מבחן|ספרייה|מוזיאון|קולנוע|סכין|תיאטרון|כפית|ליצן|צלחת|סיר|חד־קרן|רוח רפאים|מכשפה|מבצר|אביר|נסיכה|מלך|כתר|זהב|כסף|יהלום|תכשיט|תנור|הפתעה|מקרר|שקר|אמת|חברות|משפחה|ספה|זיכרון|תמונה|אלבום|טלוויזיה|הרפתקה|חופש|שקט|רעש|צחוק|דמעה|כעס|רדיו|שמחה|אומץ|מזל|צירוף מקרים|משחק|קלף|קובייה|כדור|כדורגל|טניס|שחייה|צלילה|גלישה|סקי|ריצה|מדליה|ניצחון|הפסד|קבוצה|עיתון|כלב|סוס|ארנב|ציפור|פרפר|דבורה|נמלה|נחש|צב|אריה|פיל|קוף|פינגווין|דוב|זאב|שועל|ינשוף`,
vag1:`פגישה רומנטית|קריצה|להסמיק|עור ברווז|בושם|אור נרות|טנגו|קטיפה|משי|לחישה|ליטוף|מבט בעיניים|חיוך|התאהבות|עלי כותרת|פרפרים בבטן|ארוחת ערב|עורף|כתף|לב|נשיקה גנובה|רוך|משיכה|קנאה|מכתב אהבה|טבעת|ירח דבש|לפתות|קסם|הנאה|עור|שפתיים|זר פרחים|להתחיל עם|ואלס|מסתורין|אמבט קצף|להתכרבל|בוקר עצלן|קרבה`,
vag2:`עירום|פנטזיה|צעצוע|תנוחות|פורנו|תמונות עירום|גניחות|חילופי זוגות|שדיים|חזייה|חוטיני|משחק מקדים|גומי|דילדו|כיסוי עיניים|שליטה|כניעה|שוט|עור שחור|לטקס|ג׳קוזי|מציצן|אקסהיביציוניסט|שובב|חברים עם הטבות|סקס שופ|תנוחה|אורגיה|דוגי|מיסיונרית|דיפ ת׳רואט|סימן נשיכה|ריקוד חיק|ביריות|עיסוי בשמן|לגמור|זקפה|פטמות|ליקוק|מציצה`,
rad:`לגור מתחת למים~לגור בעננים|מגדלור מבודד~דירה במרכז העיר|שנה בלי מוזיקה~שנה בלי סרטים|תמיד להגיד אמת~תמיד לשקר|לדבר את כל השפות~לנגן בכל הכלים|לחזור לעבר~לראות את העתיד|להיות מאוד מצחיק~להיות מאוד חכם|אביב נצחי~סתיו נצחי|לטייל לבד~אף פעם לא לטייל לבד|דרקון מחמד~משרת רובוט|לעולם לא להיות רעב~לעולם לא להיות עייף|לחיות 200 שנה~לחיות 10 חיים קצרים|לזכות בלוטו~למצוא את אהבת חייך|כוח־על חסר תועלת~בלי כוח־על|לשיר כמו כוכב~לרקוד כמו כוכב|בית על החוף~בקתה בהרים|להיות מפורסם~להיות עשיר בסתר|בלי טלפון~בלי אינטרנט|לאכול חריף לנצח~לאכול תפל לנצח|לזכור הכול~לשכוח כשרוצים|בלתי נראה ליום~לעוף לשעה|לשוט מסביב לעולם~מסביב לעולם ברכבת|לעולם לא ללכת שוב~לעולם לא לרוץ שוב|להיות פיראט~להיות חוקר|לדעת הכול על העבר~לדעת הכול על החלל|לעבוד בלילה~לעבוד מחמש בבוקר|סעודה כל ערב~טיול כל חודש|שיהיה לך תאום~להיות בן יחיד|לצחוק מכל משפט~לבכות בכל סרט|חוף שומם~פסטיבל עמוס|לנשום מתחת למים~לעולם לא להרגיש קור|להיות חתול~להיות כלב|חיים שקטים~חיים מלאי הרפתקאות|לגור בסירה~לגור בבקתה|להחליף שם~להחליף מדינה|להיות הכי טוב בדבר אחד~להיות טוב בהכול|לדעת להטיס~לדעת להפליג|בלי מתוקים לעולם~בלי גבינה לעולם|הראשון על הירח~הראשון בקרקעית האוקיינוס|לכתוב רב מכר~להלחין להיט|תמיד באיחור של 10 דקות~תמיד מוקדם ב־30 דקות|חבר נאמן אחד~עשרה חברים נחמדים|לחוות שוב את היום הכי שמח~לחוות יום מסתורי|משרת אישי~שף פרטי|המחשבות שלך גלויות~היסטוריית החיפוש שלך גלויה|תיק בלי תחתית~דלת לכל מקום|בלי מראות~בלי תמונות|להיות ענק~להיות זעיר|לדבר בחרוזים~לשיר במקום לדבר|הפתעה כל יום~כל יום זהה ומושלם`,
rad1:`דייט במוזיאון~בלונה פארק|דייט בסירה~בבקתה בהרים|מכתב אהבה~סרנדה|אהבה ממבט ראשון~חברות שהופכת לאהבה|לבשל ביחד~לקבל אוכל למיטה|דייט הפתעה~דייט מתוכנן עד הפרט האחרון|אהבת קיץ~רומן במשרד|להחזיק ידיים~לחבק במותניים|בן זוג מצחיק~בן זוג מסתורי|ריקוד סלואו~סלסה|ארוחת בוקר במיטה~ארוחת ערב לאור נרות|לפלרטט בהודעות~לפלרטט פנים אל פנים|קעקועים תואמים~טבעות תואמות|לישון חבוקים~כל אחד בצד שלו|סופ״ש בוונציה~סופ״ש באי|לעשות את הצעד הראשון~לחכות שהשני יעשה|כינוי חיבה~השם שלך בלחישה|מבט ארוך~חיוך עקום|פיקניק ליד המים~מרפסת גג בעיר|נשיקה גנובה~נשיקה שחיכית לה`,
rad2:`במקלחת~על מכונת הכביסה|לשלוט~שישלטו בך|מול המראה~עם עיניים מכוסות|סטוץ חד־פעמי~חבר קבוע עם הטבות|צעצוע מין~עיסוי|ג׳קוזי~סאונה|אזיקים~נוצות|מילים גסות~גניחות|מהר וחזק~לאט וארוך|שיצלמו אותך~שיסתכלו עליך|תנוחה מושלמת אחת~כל התנוחות|באוטו~במעלית|סטריפטיז~עיסוי בשמן|לילה עם סלב~לילה עם הקראש שלך|משחק תפקידים~משחק קוביות לוהט|עור~תחרה|בשקט~בקולי קולות|מועדון חילופי זוגות~חוף נודיסטים|סקסטינג~שיחה לוהטת|לספר את הפנטזיות~להגשים אותן בלי להודיע`,
msk:`הבטיחו משהו בלתי אפשרי|תארו את המסכה שלכם בשלוש מילים|ספרו את הזיכרון הכי יפה שלכם מהים|תנו רמז שקרי על עצמכם|כתבו כמו רב חובל ותיק|הכריזו על האסטרטגיה שלכם… או תעמידו פנים|שאלו את השותף שלכם שאלה|תנו מחמאה כנה|כתבו הייקו|ספרו בדיחה גרועה|דברו כמו תחזית מזג האוויר|כתבו כמו מכתב בבקבוק|התוודו על הפחד הכי גדול שלכם|התמקחו כמו בשוק|כתבו באותיות גדולות, בתשוקה|נבאו את הסיבוב הבא|צטטו פתגם מומצא|כתבו כמו מברק נקודה|תארו את האוצר שאתם מחפשים|היו מסתוריים, מאוד מסתוריים|ספרו מה אכלתם בצהריים|התגוננו מפני האשמה מומצאת|כתבו את זה כשורת ראפ|הציעו קוד סודי|דברו על עצמכם בגוף שלישי|הציעו הצעה שאי אפשר לסרב לה|כתבו רק שאלות|דברו כמו בת ים|הבטיחו לחלוק… עם אצבעות מוצלבות|כתבו סלוגן פרסומי על עצמכם`,
msk1:`תארו את הדייט האידיאלי מתחת למים|תנו מחמאה מפתה|כתבו משפט פתיחה של מלח|התוודו על קראש ישן|הציעו ברית תחת הכוכבים|תארו מה ממיס אתכם|כתבו הודעה שקוראים בלחישה|התוודו על הנשיקה הראשונה הכי יפה|תעמידו פנים שאתם מאוהבים בשותף|תארו את הריח של המסכה שלכם|כתבו הבטחה לאור הירח|הציעו ריקוד סלואו על הסיפון`,
msk2:`התוודו על הפנטזיה הכי ימית שלכם|תארו את התנוחה האהובה בלי לנקוב בשמה|ספרו על המקום הכי מסוכן|כתבו סקסטינג של פיראט|התוודו מה משגע אתכם במיטה|הציעו ברית עם מעט מאוד בגדים|תארו את הלילה הכי מטורף בשלוש מילים|התוודו על צעצוע המין הסודי שלכם|כתבו מה הייתם עושים בתא של ספינה|התוודו מה מעולם לא ניסיתם|ספרו על הפדיחה הכי גרועה|הבטיחו פרס לוהט במיוחד`,
bot:`מקום מוזר שישנת בו|פחד מהילדות|חפץ ששמור אצלך מאז ומעולם|העבודה הכי גרועה שלך|מאכל שאתה שונא|פגישה עם סלב|תעלול מהילדות|כישרון נסתר|טיול שהשתבש|כינוי שהיה לך|פעם שהלכת לאיבוד|שקר שנגמר רע|ההופעה הראשונה שלך|שיא אישי|חיית מחמד שהייתה לך|משהו שמעולם לא עשית|חלום חוזר|פדיחה בבית הספר|מתנה שלא תשכח|הרגל מוזר|התספורת הכי גרועה שלך|פעם שהיית אמיץ במיוחד|צחוק ברגע הלא נכון|מקום שאתה חולם להגיע אליו|ספורט שעסקת בו|אוסף שהיה לך|סרט שהבכה אותך|תאונה מגוחכת|משהו שאתה עושה הכי טוב מכולם|העבודה הראשונה שלך|חפץ שאבד ואתה מתגעגע אליו|פגישה מקרית|מתכון משפחתי|פוביה|החלטה ששינתה הכול|לילה לבן בלתי נשכח|ריב אבסורדי|מאכל שאתה יודע לבשל|תחפושת שלבשת|התערבות שהפסדת|הזיכרון הכי מוקדם שלך|רגע של תהילה|שפה שאתה מדבר קצת|שיר שמזכיר לך מישהו|פעם שרימית|מפגש עם חיית בר|מקום שגרת בו|מורה שהשפיע עליך|טעות תרגום|משהו שאתה עדיין אוסף`,
bot1:`הנשיקה הראשונה שלך|דייט שהשתבש|קראש לא סביר|הצהרת אהבה שנכשלה|הודעה שנשלחה לאדם הלא נכון|דייט מושלם|משפט פתיחה שעבד|אהבת קיץ|מחמאה שגרמה לך להסמיק|קנאה מגוחכת|אהבה ממבט ראשון|פרידה מקורית|דייט מאפליקציה|ריקוד סלואו בלתי נשכח|נשיקה גנובה|אקס מפתיע|מכתב אהבה|לילה תחת הכוכבים|הפגישה עם ההורים|חיזור מגושם`,
bot2:`מקום מטורף שעשית בו את זה|פעם ראשונה בלתי נשכחת|פנטזיה שהתגשמה|פדיחה במיטה|סטוץ|צעצוע מין שניסית|פעם שתפסו אותך|תמונת עירום ששלחת|סטריפטיז|לילה סוער במיוחד|סקסטינג שהשתבש|חוויה שלא היית חוזר עליה|פרטנר לא צפוי|תנוחה שלא הצליחה|מקום ציבורי נועז|קנייה בסקס שופ|מסיבה שיצאה משליטה|חלום אירוטי|פנטזיה שאי אפשר לספר|לילה עם זר`});
GXP('pt',{pha:`já conversou com um bicho como se fosse gente|seria o melhor capitão de navio|esqueceria o próprio aniversário|tem a playlist mais vergonhosa|riria na pior hora|sobreviveria a um apocalipse zumbi|criaria galinhas na cidade|viraria prefeito da sua cidadezinha|acordaria às 5h para ver o nascer do sol|comeria a mesma coisa todo dia|tem mais fotos no celular|perderia o avião|leria o manual inteiro|ganharia um concurso de comer panquecas|vai acabar morando no exterior|levanta o astral de todo mundo|cozinha melhor com quase nada|ficaria calmo numa tempestade|pularia primeiro na água gelada|compraria uma ilha se ganhasse na loteria|tem a memória mais impressionante|foi pirata em outra vida|mais fala dormindo|vai inventar um objeto útil|pintaria o cabelo de azul|se apaixonaria nas férias|canta mais desafinado no chuveiro|seria o melhor professor|não viveria sem café|se perderia até com GPS|vai abrir um restaurante|tem a risada mais contagiante|cumprimenta o bairro inteiro|lembra de todos os aniversários|atravessaria o oceano de veleiro|vai escrever um romance|é o pior perdedor|dorme mais no fim de semana|aguentaria um mês sem celular|ficaria rico com uma ideia maluca|tem mais plantas em casa|seria o melhor detetive|reconhece uma música em duas notas|viajaria amanhã sem mala|organiza tudo por cor|tem mais sapatos|percebe melhor uma mentira|se arriscaria no stand-up|muda mais de corte de cabelo|falaria com golfinhos se pudesse|é sempre o último a sair da festa|chega sempre adiantado|chega sempre atrasado|tem o sorriso mais bonito|mandaria uma carta em vez de mensagem|tem mais talentos escondidos|bombaria num reality show|viraria faroleiro|sabe de cor as falas de um filme|imita melhor sotaques|daria a volta ao mundo de bicicleta|acorda sem despertador|já cochilou no trabalho|é o mais teimoso|dá os melhores abraços|seria eleito representante de turma|pechincha melhor|mais viajou|é o primeiro a ceder diante de uma sobremesa|guardaria um segredo até sob tortura|vai falar mais idiomas|aguentaria mais tempo sem falar|acharia um tesouro mergulhando|faria uma horta na varanda|seria o melhor colega de apê|seria o pior colega de apê|conhece mais piadas ruins|faz amigos na fila|tem mais energia de manhã|vê a mesma série em looping|seria um guia turístico incrível|sobreviveria sozinho na floresta|gastaria tudo em viagens|dá os melhores presentes|pediria selfie a uma celebridade sem vergonha|iria primeiro para Marte|tem o coração mais mole|sempre tem uma desculpa|continuaria amigo de um ex|responde mais rápido às mensagens|deixa as mensagens no «visto»|poderia ter sido atleta profissional|começaria a fazer cerâmica|sabe todas as fofocas|escreve um diário|é o rei ou a rainha do karaokê|viveria como nômade numa van|faria o discurso de casamento mais bonito`,
pha1:`teve mais conquistas|mandaria uma foto ousada|tem a risada mais charmosa|já teve amor à primeira vista|daria em cima do garçom|tem os olhos mais sedutores|diria «eu te amo» primeiro|faria uma declaração em público|já teve uma queda por um professor|dança de forma mais sensual|derrete com um sotaque|faz os elogios mais desarmantes|já beijou um desconhecido|tem os encontros mais memoráveis|conseguiria seduzir qualquer um|usa lingerie combinando no primeiro encontro|teve o pior encontro|adora um chamego de manhã|tem mais matches nos apps|sairia com duas pessoas ao mesmo tempo|escreveria uma carta de amor apaixonada|guarda mais lembranças de ex|tem o perfume mais inebriante|nadaria pelado à noite|já se declarou sem querer|não resiste a um uniforme|ganharia no jogo da garrafa|deu o beijo mais longo|toma a iniciativa no primeiro encontro|já flertou com alguém daqui`,
pha2:`já dormiu na casa de um desconhecido depois de uma festa|tem mais brinquedos eróticos|já transou num provador|vê mais pornô|já fez um roleplay picante|tem uma pasta secreta de fotos ousadas|toparia um ménage|já foi surpreendido no meio do ato|tem mais experiência na cama|já ficou com o ex de um amigo|experimentaria bondage|já transou num avião|toparia uma noite casual hoje|já teve um caso com um colega|fala mais sacanagem na cama|tem a fantasia mais inconfessável|já fez striptease|já transou com alguém sem saber o nome|experimentaria uma casa de swing|já transou mais de cinco vezes numa noite|gravaria um vídeo erótico|teve mais casos de uma noite|já broxou na pior hora|já transou no mar|mandaria nudes para a pessoa errada|comprou um brinquedo erótico escondido|gosta de ser dominado|gosta de dominar|transaria com uma celebridade sem hesitar|já transou no trabalho`,
vag:`espuma|sal|maré|farol|concha|rajada|vela de barco|âncora|onda|coral|baleia|caranguejo|gaivota|água-viva|golfinho|mapa|bússola|horizonte|mergulhador|submarino|naufrágio|palmeira|rede|coquetel|cubo de gelo|guarda-chuva|rio|deserto|vulcão|caverna|selva|lago|ponte|torre|castelo|aldeia|arco-íris|metrô|relâmpago|neblina|bicicleta|aurora boreal|ônibus|foguete|robô|computador|cometa|planeta|violão|astronauta|tambor|canção|dança|satélite|telescópio|bolo|microscópio|morango|maçã|banana|limão|laboratório|hospital|pão|sopa|chá|leite|mel|açúcar|sal marinho|sorvete|bala|piquenique|churrasco|cozinha|farmácia|padaria|rosa|árvore|folha|outono|feira|primavera|fim de semana|supermercado|mala|passaporte|hotel|barraca|fogueira|abajur|vela|restaurante|janela|porta|chave|cama|travesseiro|garçom|pesadelo|sono|despertador|manhã|entardecer|meia-noite|relógio|calendário|cardápio|garfo|caderno|lápis|quadro-negro|professor|prova|biblioteca|museu|cinema|faca|teatro|colher|palhaço|prato|panela|unicórnio|fantasma|bruxa|fortaleza|cavaleiro|princesa|rei|coroa|ouro|prata|diamante|joia|forno|surpresa|geladeira|mentira|verdade|amizade|família|sofá|lembrança|foto|álbum|televisão|aventura|liberdade|silêncio|barulho|risada|lágrima|raiva|rádio|alegria|coragem|sorte|acaso|jogo|carta de baralho|dado|bola|futebol|tênis|natação|mergulho|surfe|esqui|corrida|medalha|vitória|derrota|time|jornal|cachorro|cavalo|coelho|pássaro|borboleta|abelha|formiga|cobra|tartaruga|leão|elefante|macaco|pinguim|urso|lobo|raposa|coruja`,
vag1:`encontro a dois|piscadinha|corar|pele arrepiada|perfume|luz de velas|tango|veludo|seda|sussurro|carícia|olho no olho|sorriso|paixonite|pétalas|frio na barriga|jantar|nuca|ombro|coração|beijo roubado|ternura|atração|ciúme|carta de amor|anel|lua de mel|seduzir|charme|prazer|pele|lábios|buquê|paquerar|valsa|mistério|banho de espuma|aconchegar|manhã preguiçosa|cumplicidade`,
vag2:`pelado|fantasia|brinquedo|posições|pornô|nudes|gemer|swing|seios|sutiã|fio dental|preliminares|preservativo|consolo|venda nos olhos|dominação|submissão|chicote|couro|látex|jacuzzi|voyeur|exibicionista|safado|amizade colorida|sex shop|posição|orgia|de quatro|papai e mamãe|garganta profunda|chupão|lap dance|cinta-liga|massagem com óleo|gozar|ereção|mamilos|sexo oral nela|boquete`,
rad:`Viver debaixo d'água~Viver nas nuvens|Um farol isolado~Um apartamento no centro|Um ano sem música~Um ano sem filmes|Sempre dizer a verdade~Sempre mentir|Falar todos os idiomas~Tocar todos os instrumentos|Voltar ao passado~Ver o futuro|Ser muito engraçado~Ser muito inteligente|Primavera eterna~Outono eterno|Viajar sozinho~Nunca viajar sozinho|Um dragão de estimação~Um mordomo robô|Nunca mais sentir fome~Nunca mais sentir sono|Viver 200 anos~Viver 10 vidas curtas|Ganhar na loteria~Encontrar o amor da sua vida|Um superpoder inútil~Nenhum superpoder|Cantar como um astro~Dançar como um astro|Uma casa na praia~Um chalé na montanha|Ser famoso~Ser rico em segredo|Sem celular~Sem internet|Comer apimentado para sempre~Comer sem tempero para sempre|Lembrar de tudo~Esquecer quando quiser|Invisível por um dia~Voar por uma hora|Volta ao mundo de barco~Volta ao mundo de trem|Nunca mais andar~Nunca mais correr|Ser pirata~Ser explorador|Saber tudo do passado~Saber tudo do espaço|Trabalhar à noite~Trabalhar às 5 da manhã|Um banquete toda noite~Uma viagem todo mês|Ter um gêmeo~Ser filho único|Rir a cada frase~Chorar a cada filme|Uma praia deserta~Um festival lotado|Respirar debaixo d'água~Nunca mais sentir frio|Ser um gato~Ser um cachorro|Uma vida tranquila~Uma vida cheia de aventuras|Morar num barco~Morar numa cabana|Mudar de nome~Mudar de país|Ser o melhor em uma coisa~Ser bom em tudo|Saber pilotar~Saber velejar|Nunca mais doces~Nunca mais queijo|O primeiro na Lua~O primeiro no fundo do oceano|Escrever um best-seller~Compor um sucesso|Sempre 10 minutos atrasado~Sempre 30 minutos adiantado|Um amigo fiel~Dez amigos legais|Reviver seu dia mais feliz~Viver um dia misterioso|Um mordomo~Um chef particular|Seus pensamentos à vista~Seu histórico de buscas à vista|Uma bolsa sem fundo~Uma porta para qualquer lugar|Sem espelhos~Sem fotos|Ser gigante~Ser minúsculo|Falar rimando~Cantar em vez de falar|Uma surpresa por dia~Todo dia igual e perfeito`,
rad1:`Um encontro no museu~No parque de diversões|Um encontro num barco~Num chalé na serra|Uma carta de amor~Uma serenata|Amor à primeira vista~Amizade que vira amor|Cozinhar juntos~Receber comida na cama|Um encontro surpresa~Um encontro planejado nos mínimos detalhes|Um amor de verão~Um romance no escritório|Dar as mãos~Abraçar pela cintura|Um par divertido~Um par misterioso|Uma música lenta~Salsa|Café da manhã na cama~Jantar à luz de velas|Flertar por mensagem~Flertar pessoalmente|Tatuagens combinando~Alianças combinando|Dormir de conchinha~Cada um no seu lado|Um fim de semana em Veneza~Um fim de semana numa ilha|Dar o primeiro passo~Esperar o outro dar|Um apelido carinhoso~Seu nome sussurrado|Um olhar demorado~Um sorriso de canto|Um piquenique à beira d'água~Um terraço na cidade|Um beijo roubado~Um beijo muito esperado`,
rad2:`No chuveiro~Em cima da máquina de lavar|Dominar~Ser dominado|Na frente do espelho~De olhos vendados|Uma noite casual~Uma amizade colorida fixa|Um brinquedo erótico~Uma massagem|Jacuzzi~Sauna|Algemas~Plumas|Falar sacanagem~Gemidos|Rápido e intenso~Devagar e demorado|Ser filmado~Ser observado|Uma única posição perfeita~Todas as posições|No carro~No elevador|Um striptease~Uma massagem com óleo|Uma noite com uma celebridade~Uma noite com seu crush|Um roleplay~Um jogo de dados picante|Couro~Renda|Em silêncio~Fazendo barulho|Uma casa de swing~Uma praia de nudismo|Sexting~Uma ligação picante|Contar as fantasias~Realizá-las sem avisar`,
msk:`Prometa algo impossível|Descreva sua máscara em três palavras|Conte sua lembrança de mar mais bonita|Dê uma pista falsa sobre você|Escreva como um velho capitão|Anuncie sua estratégia… ou finja|Faça uma pergunta ao seu parceiro|Faça um elogio sincero|Escreva um haicai|Conte uma piada péssima|Fale como a previsão do tempo|Escreva como uma mensagem na garrafa|Confesse seu maior medo|Pechinche como na feira|Escreva em MAIÚSCULAS, com paixão|Preveja a próxima rodada|Cite um provérbio inventado|Escreva como um telegrama PONTO|Descreva o tesouro que você procura|Seja misterioso, muito misterioso|Conte o que você almoçou|Defenda-se de uma acusação inventada|Escreva como um verso de rap|Proponha um código secreto|Fale de você na terceira pessoa|Faça uma oferta irrecusável|Escreva só perguntas|Fale como uma sereia|Prometa dividir… de dedos cruzados|Escreva um slogan sobre você`,
msk1:`Descreva seu encontro ideal debaixo d'água|Faça um elogio sedutor|Escreva uma cantada de marinheiro|Confesse uma antiga paixonite|Proponha um pacto sob as estrelas|Descreva o que faz você derreter|Escreva uma mensagem para ler sussurrando|Confesse seu primeiro beijo mais bonito|Finja estar apaixonado pelo seu parceiro|Descreva o perfume da sua máscara|Escreva uma promessa sob a lua|Proponha uma dança lenta no convés`,
msk2:`Confesse sua fantasia mais marítima|Descreva sua posição favorita sem dizer o nome|Conte o lugar mais arriscado|Escreva um sexting de pirata|Confesse o que te enlouquece na cama|Proponha um pacto com pouquíssima roupa|Descreva sua noite mais louca em três palavras|Confesse seu brinquedo erótico secreto|Escreva o que você faria numa cabine de navio|Confesse o que você nunca experimentou|Conte seu pior fiasco|Prometa uma recompensa bem picante`,
bot:`Um lugar inusitado onde você dormiu|Um medo de infância|Um objeto que você guarda desde sempre|Seu pior emprego|Uma comida que você odeia|Um encontro com uma celebridade|Uma travessura de infância|Um talento escondido|Uma viagem que deu errado|Um apelido que você tinha|Uma vez que você se perdeu|Uma mentira que acabou mal|Seu primeiro show|Um recorde pessoal|Um bicho de estimação que você teve|Algo que você nunca fez|Um sonho recorrente|Um mico na escola|Um presente inesquecível|Uma mania estranha|Seu pior corte de cabelo|Uma vez que você foi muito corajoso|Uma risada na hora errada|Um lugar que você sonha conhecer|Um esporte que você praticou|Uma coleção que você tinha|Um filme que te fez chorar|Um acidente ridículo|Algo que você faz melhor que todo mundo|Seu primeiro emprego|Um objeto perdido de que você sente falta|Um encontro por acaso|Uma receita de família|Uma fobia|Uma decisão que mudou tudo|Uma noite em claro memorável|Uma briga absurda|Um prato que você sabe cozinhar|Uma fantasia que você vestiu|Uma aposta perdida|Sua lembrança mais antiga|Um momento de glória|Um idioma que você fala um pouco|Uma música que te lembra alguém|Uma vez que você colou ou trapaceou|Um encontro com um animal selvagem|Um lugar onde você morou|Um professor que te marcou|Um erro de tradução|Algo que você ainda coleciona`,
bot1:`Seu primeiro beijo|Um encontro que deu errado|Uma paixonite improvável|Uma declaração de amor fracassada|Uma mensagem enviada para a pessoa errada|Um encontro perfeito|Uma cantada que funcionou|Um amor de verão|Um elogio que te fez corar|Um ciúme ridículo|Um amor à primeira vista|Um término original|Um encontro de aplicativo|Uma dança lenta inesquecível|Um beijo roubado|Um ex surpreendente|Uma carta de amor|Uma noite sob as estrelas|Conhecer os pais|Uma paquera desajeitada`,
bot2:`Um lugar maluco onde você transou|Uma primeira vez memorável|Uma fantasia realizada|Um fiasco na cama|Uma noite casual|Um brinquedo erótico que você testou|Uma vez que te pegaram no flagra|Um nude que você mandou|Um striptease|Uma noite muito agitada|Um sexting que deu errado|Uma experiência que você não repetiria|Um parceiro inesperado|Uma posição que deu errado|Um lugar público ousado|Uma compra no sex shop|Uma festa que saiu do controle|Um sonho erótico|Uma fantasia inconfessável|Uma noite com um desconhecido`});
/* 🧭 La Chaîne des Phares : textes */
const GCH=(l,o)=>Object.assign(GI18N[l].ui,o);
GCH('fr',{n_chn:`La Chaîne des Phares`,d_chn:`Passez le bon chenal… sans savoir qui le brouille`,
r_chn:`Chaque vague, un capitaine reçoit en secret le bon chenal (🐚 ⭐ 🌙 🐋) et le transmet en privé au gardien de son choix, qui le relaie à son tour : le dernier guide le navire. Parmi vous se cache 1 Naufrageur (2 dès 6 joueurs) qui peut changer le chenal : à 2 navires coulés (3 dès 6 joueurs), les Naufrageurs gagnent. Entre les vagues, débattez dans le chat et votez pour mettre un suspect aux fers (ce qu'il reçoit et transmet devient public) ; à la fin, chacun accuse en secret : +2 par Naufrageur démasqué.`,
chN:`Naufrageur`,chC:`Gardien de phare`,chSkT:`Les Naufrageurs gagnent à {v} navires coulés`,chWaitC:`{n} est capitaine : la passe part…`,chWait:`{n} relaie la passe…`,
chCap:`Le bon chenal :`,chGot:`On t'a transmis :`,chNtip:`Tu peux changer le chenal… ou le garder pour rester crédible.`,chPass:`Quel chenal transmets-tu ?`,chPilot:`Tu guides le navire : quel chenal ?`,chTo:`À qui ?`,chSail:`Lever l'ancre`,
chOk:`Le navire est arrivé !`,chKo:`Le navire a coulé !`,chTr:`bon chenal`,chF:`chenal pris`,chVote:`Mettre quelqu'un aux fers ?`,chVoteD:`Il faut la majorité. Ses relais deviendront publics.`,chFree:`Personne (libérer)`,chNone:`Personne`,chNoneS:`personne`,
chAcc:`Qui sont les Naufrageurs ? (jusqu'à {v})`,chAccD:`+2 par Naufrageur démasqué.`,chAccN:`Accuse aussi quelqu'un : personne ne doit deviner ton rôle.`,chAccOk:`Envoyé ✓`,chLog:`Journal de bord`,
chWinN:`Les Naufrageurs l'emportent : {v} navires coulés !`,chWinC:`L'équipage l'emporte : la flotte est sauve !`,chWere:`Les Naufrageurs étaient :`,
tu_chn1:`{a} est capitaine : il reçoit le bon chenal ⭐ et le passe en secret à {b}.`,tu_chn2:`{b} le relaie à {c}… mais un Naufrageur caché peut changer le chenal.`,
tu_chn3:`Le dernier relais guide le navire : mauvais chenal, il coule. Tous voient la route, personne ne voit ce que les autres ont passé.`,tu_chn4:`Débattez, puis votez : le suspect est mis aux fers ⛓️ et ce qu'il passe devient public.`,
tu_chn5:`À la fin, accusez en secret : +2 par Naufrageur démasqué. Mais assez de navires coulés, et ce sont eux qui gagnent.`});
GCH('en',{n_chn:`The Lighthouse Chain`,d_chn:`Pass on the right channel… without knowing who scrambles it`,
r_chn:`Each wave, a captain secretly gets the right channel (🐚 ⭐ 🌙 🐋) and privately passes it to a keeper of their choice, who relays it in turn: the last one steers the ship. Hidden among you is 1 Wrecker (2 from 6 players) who can change the channel: at 2 sunk ships (3 from 6 players), the Wreckers win. Between waves, debate in the chat and vote to put a suspect in irons (what they receive and pass becomes public); at the end, everyone accuses in secret: +2 per Wrecker unmasked.`,
chN:`Wrecker`,chC:`Lighthouse keeper`,chSkT:`The Wreckers win at {v} sunk ships`,chWaitC:`{n} is captain: the channel sets off…`,chWait:`{n} is relaying the channel…`,
chCap:`The right channel:`,chGot:`You were passed:`,chNtip:`You can change the channel… or keep it to stay believable.`,chPass:`Which channel do you pass on?`,chPilot:`You steer the ship: which channel?`,chTo:`To whom?`,chSail:`Weigh anchor`,
chOk:`The ship made it!`,chKo:`The ship sank!`,chTr:`right channel`,chF:`channel taken`,chVote:`Put someone in irons?`,chVoteD:`It takes a majority. Their relays will become public.`,chFree:`Nobody (release)`,chNone:`Nobody`,chNoneS:`nobody`,
chAcc:`Who are the Wreckers? (up to {v})`,chAccD:`+2 per Wrecker unmasked.`,chAccN:`Accuse someone too: nobody should guess your role.`,chAccOk:`Sent ✓`,chLog:`Logbook`,
chWinN:`The Wreckers win: {v} ships sunk!`,chWinC:`The crew wins: the fleet is safe!`,chWere:`The Wreckers were:`,
tu_chn1:`{a} is captain: they get the right channel ⭐ and secretly pass it to {b}.`,tu_chn2:`{b} relays it to {c}… but a hidden Wrecker can change the channel.`,
tu_chn3:`The last relay steers the ship: wrong channel, it sinks. Everyone sees the route, nobody sees what the others passed.`,tu_chn4:`Debate, then vote: the suspect is put in irons ⛓️ and what they pass becomes public.`,
tu_chn5:`At the end, accuse in secret: +2 per Wrecker unmasked. But enough sunk ships, and they win.`});
GCH('es',{n_chn:`La Cadena de Faros`,d_chn:`Pasad el canal correcto… sin saber quién lo enreda`,
r_chn:`Cada ola, un capitán recibe en secreto el canal correcto (🐚 ⭐ 🌙 🐋) y lo pasa en privado al farero que elija, que lo releva a su vez: el último guía el barco. Entre vosotros se esconde 1 Naufragador (2 desde 6 jugadores) que puede cambiar el canal: con 2 barcos hundidos (3 desde 6 jugadores), ganan los Naufragadores. Entre olas, debatid en el chat y votad para encadenar a un sospechoso (lo que recibe y pasa se vuelve público); al final, cada uno acusa en secreto: +2 por Naufragador desenmascarado.`,
chN:`Naufragador`,chC:`Farero`,chSkT:`Los Naufragadores ganan con {v} barcos hundidos`,chWaitC:`{n} es capitán: el canal sale…`,chWait:`{n} releva el canal…`,
chCap:`El canal correcto:`,chGot:`Te han pasado:`,chNtip:`Puedes cambiar el canal… o mantenerlo para seguir siendo creíble.`,chPass:`¿Qué canal pasas?`,chPilot:`Guías el barco: ¿qué canal?`,chTo:`¿A quién?`,chSail:`Levar anclas`,
chOk:`¡El barco ha llegado!`,chKo:`¡El barco se ha hundido!`,chTr:`canal correcto`,chF:`canal tomado`,chVote:`¿Encadenar a alguien?`,chVoteD:`Hace falta mayoría. Sus relevos serán públicos.`,chFree:`Nadie (liberar)`,chNone:`Nadie`,chNoneS:`nadie`,
chAcc:`¿Quiénes son los Naufragadores? (hasta {v})`,chAccD:`+2 por Naufragador desenmascarado.`,chAccN:`Acusa también a alguien: nadie debe adivinar tu rol.`,chAccOk:`Enviado ✓`,chLog:`Cuaderno de bitácora`,
chWinN:`Ganan los Naufragadores: ¡{v} barcos hundidos!`,chWinC:`Gana la tripulación: ¡la flota está a salvo!`,chWere:`Los Naufragadores eran:`,
tu_chn1:`{a} es capitán: recibe el canal correcto ⭐ y se lo pasa en secreto a {b}.`,tu_chn2:`{b} se lo pasa a {c}… pero un Naufragador oculto puede cambiar el canal.`,
tu_chn3:`El último relevo guía el barco: canal equivocado, se hunde. Todos ven la ruta, nadie ve lo que pasaron los demás.`,tu_chn4:`Debatid y votad: el sospechoso queda encadenado ⛓️ y lo que pasa se vuelve público.`,
tu_chn5:`Al final, acusad en secreto: +2 por Naufragador desenmascarado. Pero con bastantes barcos hundidos, ganan ellos.`});
GCH('it',{n_chn:`La Catena dei Fari`,d_chn:`Passate il canale giusto… senza sapere chi lo confonde`,
r_chn:`A ogni ondata, un capitano riceve in segreto il canale giusto (🐚 ⭐ 🌙 🐋) e lo passa in privato al guardiano che vuole, che lo inoltra a sua volta: l'ultimo guida la nave. Tra voi si nasconde 1 Naufragatore (2 da 6 giocatori) che può cambiare il canale: con 2 navi affondate (3 da 6 giocatori), vincono i Naufragatori. Tra un'ondata e l'altra, discutete in chat e votate per mettere ai ferri un sospettato (ciò che riceve e passa diventa pubblico); alla fine ognuno accusa in segreto: +2 per Naufragatore smascherato.`,
chN:`Naufragatore`,chC:`Guardiano del faro`,chSkT:`I Naufragatori vincono con {v} navi affondate`,chWaitC:`{n} è capitano: il canale parte…`,chWait:`{n} inoltra il canale…`,
chCap:`Il canale giusto:`,chGot:`Ti hanno passato:`,chNtip:`Puoi cambiare il canale… o tenerlo per restare credibile.`,chPass:`Che canale passi?`,chPilot:`Guidi la nave: quale canale?`,chTo:`A chi?`,chSail:`Salpare`,
chOk:`La nave è arrivata!`,chKo:`La nave è affondata!`,chTr:`canale giusto`,chF:`canale preso`,chVote:`Mettere qualcuno ai ferri?`,chVoteD:`Serve la maggioranza. I suoi passaggi diventeranno pubblici.`,chFree:`Nessuno (liberare)`,chNone:`Nessuno`,chNoneS:`nessuno`,
chAcc:`Chi sono i Naufragatori? (fino a {v})`,chAccD:`+2 per Naufragatore smascherato.`,chAccN:`Accusa anche tu qualcuno: nessuno deve indovinare il tuo ruolo.`,chAccOk:`Inviato ✓`,chLog:`Diario di bordo`,
chWinN:`Vincono i Naufragatori: {v} navi affondate!`,chWinC:`Vince l'equipaggio: la flotta è salva!`,chWere:`I Naufragatori erano:`,
tu_chn1:`{a} è capitano: riceve il canale giusto ⭐ e lo passa in segreto a {b}.`,tu_chn2:`{b} lo inoltra a {c}… ma un Naufragatore nascosto può cambiare il canale.`,
tu_chn3:`L'ultimo passaggio guida la nave: canale sbagliato, affonda. Tutti vedono la rotta, nessuno vede cosa hanno passato gli altri.`,tu_chn4:`Discutete, poi votate: il sospettato finisce ai ferri ⛓️ e ciò che passa diventa pubblico.`,
tu_chn5:`Alla fine accusate in segreto: +2 per Naufragatore smascherato. Ma con abbastanza navi affondate, vincono loro.`});
GCH('de',{n_chn:`Die Leuchtturmkette`,d_chn:`Gebt die richtige Fahrrinne weiter… ohne zu wissen, wer sie verfälscht`,
r_chn:`In jeder Welle erhält ein Kapitän geheim die richtige Fahrrinne (🐚 ⭐ 🌙 🐋) und gibt sie privat an einen Wärter seiner Wahl weiter, der sie wiederum weiterreicht: der Letzte steuert das Schiff. Unter euch versteckt sich 1 Strandräuber (2 ab 6 Leuten), der die Rinne ändern kann: bei 2 gesunkenen Schiffen (3 ab 6 Leuten) gewinnen die Strandräuber. Zwischen den Wellen diskutiert im Chat und stimmt ab, wen ihr in Ketten legt (was er erhält und weitergibt, wird öffentlich); am Ende klagt jeder geheim an: +2 pro entlarvtem Strandräuber.`,
chN:`Strandräuber`,chC:`Leuchtturmwärter`,chSkT:`Die Strandräuber gewinnen bei {v} gesunkenen Schiffen`,chWaitC:`{n} ist Kapitän: die Rinne geht los…`,chWait:`{n} gibt die Rinne weiter…`,
chCap:`Die richtige Rinne:`,chGot:`Du hast erhalten:`,chNtip:`Du kannst die Rinne ändern… oder sie behalten, um glaubwürdig zu bleiben.`,chPass:`Welche Rinne gibst du weiter?`,chPilot:`Du steuerst das Schiff: welche Rinne?`,chTo:`An wen?`,chSail:`Anker lichten`,
chOk:`Das Schiff ist angekommen!`,chKo:`Das Schiff ist gesunken!`,chTr:`richtige Rinne`,chF:`genommene Rinne`,chVote:`Jemanden in Ketten legen?`,chVoteD:`Es braucht eine Mehrheit. Seine Weitergaben werden öffentlich.`,chFree:`Niemand (freilassen)`,chNone:`Niemand`,chNoneS:`niemand`,
chAcc:`Wer sind die Strandräuber? (bis zu {v})`,chAccD:`+2 pro entlarvtem Strandräuber.`,chAccN:`Klag auch jemanden an: niemand soll deine Rolle erraten.`,chAccOk:`Gesendet ✓`,chLog:`Logbuch`,
chWinN:`Die Strandräuber gewinnen: {v} Schiffe gesunken!`,chWinC:`Die Mannschaft gewinnt: die Flotte ist gerettet!`,chWere:`Die Strandräuber waren:`,
tu_chn1:`{a} ist Kapitän: er erhält die richtige Rinne ⭐ und gibt sie geheim an {b} weiter.`,tu_chn2:`{b} gibt sie an {c} weiter… aber ein versteckter Strandräuber kann die Rinne ändern.`,
tu_chn3:`Der Letzte steuert das Schiff: falsche Rinne, es sinkt. Alle sehen die Route, niemand sieht, was die anderen weitergegeben haben.`,tu_chn4:`Diskutiert, dann stimmt ab: der Verdächtige kommt in Ketten ⛓️ und was er weitergibt, wird öffentlich.`,
tu_chn5:`Am Ende klagt ihr geheim an: +2 pro entlarvtem Strandräuber. Aber sinken genug Schiffe, gewinnen sie.`});
GCH('ru',{n_chn:`Цепь маяков`,d_chn:`Передайте верный фарватер… не зная, кто его путает`,
r_chn:`Каждую волну капитан тайно получает верный фарватер (🐚 ⭐ 🌙 🐋) и лично передаёт его выбранному смотрителю, а тот — дальше: последний ведёт корабль. Среди вас прячется 1 Мародёр (2 — от 6 игроков), который может подменить фарватер: при 2 затонувших кораблях (3 — от 6 игроков) Мародёры побеждают. Между волнами спорьте в чате и голосуйте, кого заковать в кандалы (всё, что он получает и передаёт, становится публичным); в конце каждый тайно обвиняет: +2 за каждого разоблачённого Мародёра.`,
chN:`Мародёр`,chC:`Смотритель маяка`,chSkT:`Мародёры побеждают при {v} затонувших кораблях`,chWaitC:`{n} — капитан: фарватер отправляется…`,chWait:`{n} передаёт фарватер…`,
chCap:`Верный фарватер:`,chGot:`Тебе передали:`,chNtip:`Можно подменить фарватер… или оставить, чтобы не вызвать подозрений.`,chPass:`Какой фарватер передаёшь?`,chPilot:`Ты ведёшь корабль: какой фарватер?`,chTo:`Кому?`,chSail:`Поднять якорь`,
chOk:`Корабль дошёл!`,chKo:`Корабль затонул!`,chTr:`верный фарватер`,chF:`выбранный фарватер`,chVote:`Заковать кого-нибудь?`,chVoteD:`Нужно большинство. Его передачи станут публичными.`,chFree:`Никого (освободить)`,chNone:`Никого`,chNoneS:`никого`,
chAcc:`Кто Мародёры? (до {v})`,chAccD:`+2 за каждого разоблачённого Мародёра.`,chAccN:`Тоже обвини кого-нибудь: никто не должен угадать твою роль.`,chAccOk:`Отправлено ✓`,chLog:`Судовой журнал`,
chWinN:`Побеждают Мародёры: затонуло кораблей — {v}!`,chWinC:`Побеждает команда: флот спасён!`,chWere:`Мародёрами были:`,
tu_chn1:`{a} — капитан: получает верный фарватер ⭐ и тайно передаёт его {b}.`,tu_chn2:`{b} передаёт его {c}… но скрытый Мародёр может подменить фарватер.`,
tu_chn3:`Последний ведёт корабль: неверный фарватер — и он тонет. Маршрут видят все, а что передали другие — никто.`,tu_chn4:`Спорьте и голосуйте: подозреваемого заковывают ⛓️, и всё, что он передаёт, становится публичным.`,
tu_chn5:`В конце обвиняйте тайно: +2 за каждого разоблачённого Мародёра. Но если кораблей затонет достаточно, побеждают они.`});
GCH('zh',{n_chn:`灯塔之链`,d_chn:`传出正确的航道……却不知道是谁在捣乱`,
r_chn:`每一波，船长秘密得知正确航道（🐚 ⭐ 🌙 🐋），私下传给自己选的守塔人，再由他继续传下去：最后一人为船掌舵。你们之中藏着1名破船者（6人起为2名），他可以改动航道：沉船达到2艘（6人起为3艘），破船者获胜。每波之间在聊天里讨论，并投票给嫌疑人戴上镣铐（他收到和传出的内容都会公开）；最后每人秘密指认：每揪出一名破船者+2。`,
chN:`破船者`,chC:`守塔人`,chSkT:`沉船达到{v}艘时破船者获胜`,chWaitC:`{n}是船长：航道出发了……`,chWait:`{n}正在传递航道……`,
chCap:`正确航道：`,chGot:`你收到的是：`,chNtip:`你可以改动航道……也可以照传以保持可信。`,chPass:`你要传出哪条航道？`,chPilot:`你来掌舵：走哪条航道？`,chTo:`传给谁？`,chSail:`起锚`,
chOk:`船到港了！`,chKo:`船沉了！`,chTr:`正确航道`,chF:`实际航道`,chVote:`要给谁戴上镣铐吗？`,chVoteD:`需要过半数。他的传递将会公开。`,chFree:`不选（释放）`,chNone:`不选`,chNoneS:`不选`,
chAcc:`谁是破船者？（最多{v}人）`,chAccD:`每揪出一名破船者+2。`,chAccN:`你也指认一个人吧：别让人猜出你的身份。`,chAccOk:`已发送 ✓`,chLog:`航海日志`,
chWinN:`破船者获胜：沉了{v}艘船！`,chWinC:`船员获胜：船队平安！`,chWere:`破船者是：`,
tu_chn1:`{a}是船长：他得知正确航道⭐，并秘密传给{b}。`,tu_chn2:`{b}再传给{c}……但隐藏的破船者可以改动航道。`,
tu_chn3:`最后一人掌舵：航道错了，船就沉。大家都看得到路线，却看不到别人传了什么。`,tu_chn4:`讨论后投票：嫌疑人被戴上镣铐⛓️，他传出的内容会公开。`,
tu_chn5:`最后秘密指认：每揪出一名破船者+2。但沉船够多的话，就是他们赢。`});
GCH('he',{n_chn:`שרשרת המגדלורים`,d_chn:`העבירו את הנתיב הנכון… בלי לדעת מי משבש אותו`,
r_chn:`בכל גל, רב החובל מקבל בסוד את הנתיב הנכון (🐚 ⭐ 🌙 🐋) ומעביר אותו בפרטי לשומר שהוא בוחר, וזה מעביר הלאה: האחרון מנווט את הספינה. ביניכם מסתתר מטביע 1 (2 החל מ־6 שחקנים) שיכול לשנות את הנתיב: ב־2 ספינות טבועות (3 החל מ־6 שחקנים) המטביעים מנצחים. בין הגלים התווכחו בצ׳אט והצביעו מי נכבל באזיקים (מה שהוא מקבל ומעביר נהיה גלוי); בסוף כל אחד מאשים בסוד: ‎+2 על כל מטביע שנחשף.`,
chN:`מטביע`,chC:`שומר מגדלור`,chSkT:`המטביעים מנצחים ב־{v} ספינות טבועות`,chWaitC:`{n} רב החובל: הנתיב יוצא לדרך…`,chWait:`{n} מעביר את הנתיב…`,
chCap:`הנתיב הנכון:`,chGot:`העבירו לך:`,chNtip:`אפשר לשנות את הנתיב… או להשאיר אותו כדי להישאר אמין.`,chPass:`איזה נתיב להעביר?`,chPilot:`אתה מנווט את הספינה: איזה נתיב?`,chTo:`למי?`,chSail:`להרים עוגן`,
chOk:`הספינה הגיעה!`,chKo:`הספינה טבעה!`,chTr:`נתיב נכון`,chF:`נתיב שנבחר`,chVote:`לכבול מישהו?`,chVoteD:`צריך רוב. ההעברות שלו ייחשפו.`,chFree:`אף אחד (לשחרר)`,chNone:`אף אחד`,chNoneS:`אף אחד`,
chAcc:`מי המטביעים? (עד {v})`,chAccD:`‎+2 על כל מטביע שנחשף.`,chAccN:`האשימו גם מישהו: אסור שינחשו את התפקיד שלכם.`,chAccOk:`נשלח ✓`,chLog:`יומן הספינה`,
chWinN:`המטביעים ניצחו: {v} ספינות טבעו!`,chWinC:`הצוות ניצח: הצי ניצל!`,chWere:`המטביעים היו:`,
tu_chn1:`{a} רב החובל: הוא מקבל את הנתיב הנכון ⭐ ומעביר אותו בסוד ל{b}.`,tu_chn2:`{b} מעביר אותו ל{c}… אבל מטביע נסתר יכול לשנות את הנתיב.`,
tu_chn3:`האחרון מנווט את הספינה: נתיב שגוי, והיא טובעת. כולם רואים את המסלול, אף אחד לא רואה מה האחרים העבירו.`,tu_chn4:`התווכחו ואז הצביעו: החשוד נכבל ⛓️ ומה שהוא מעביר נהיה גלוי.`,
tu_chn5:`בסוף האשימו בסוד: ‎+2 על כל מטביע שנחשף. אבל אם טבעו מספיק ספינות, הם מנצחים.`});
GCH('pt',{n_chn:`A Corrente de Faróis`,d_chn:`Passem o canal certo… sem saber quem o embaralha`,
r_chn:`A cada onda, um capitão recebe em segredo o canal certo (🐚 ⭐ 🌙 🐋) e o passa no privado para o faroleiro que quiser, que o repassa por sua vez: o último guia o navio. Entre vocês se esconde 1 Naufragador (2 a partir de 6 jogadores) que pode mudar o canal: com 2 navios afundados (3 a partir de 6 jogadores), os Naufragadores vencem. Entre as ondas, debatam no chat e votem para acorrentar um suspeito (o que ele recebe e passa fica público); no fim, cada um acusa em segredo: +2 por Naufragador desmascarado.`,
chN:`Naufragador`,chC:`Faroleiro`,chSkT:`Os Naufragadores vencem com {v} navios afundados`,chWaitC:`{n} é capitão: o canal está saindo…`,chWait:`{n} está repassando o canal…`,
chCap:`O canal certo:`,chGot:`Passaram para você:`,chNtip:`Você pode mudar o canal… ou mantê-lo para continuar confiável.`,chPass:`Que canal você passa?`,chPilot:`Você guia o navio: qual canal?`,chTo:`Para quem?`,chSail:`Levantar âncora`,
chOk:`O navio chegou!`,chKo:`O navio afundou!`,chTr:`canal certo`,chF:`canal tomado`,chVote:`Acorrentar alguém?`,chVoteD:`É preciso maioria. Os repasses dele ficarão públicos.`,chFree:`Ninguém (soltar)`,chNone:`Ninguém`,chNoneS:`ninguém`,
chAcc:`Quem são os Naufragadores? (até {v})`,chAccD:`+2 por Naufragador desmascarado.`,chAccN:`Acuse alguém também: ninguém deve adivinhar seu papel.`,chAccOk:`Enviado ✓`,chLog:`Diário de bordo`,
chWinN:`Os Naufragadores vencem: {v} navios afundados!`,chWinC:`A tripulação vence: a frota está salva!`,chWere:`Os Naufragadores eram:`,
tu_chn1:`{a} é capitão: recebe o canal certo ⭐ e o passa em segredo para {b}.`,tu_chn2:`{b} repassa para {c}… mas um Naufragador escondido pode mudar o canal.`,
tu_chn3:`O último repasse guia o navio: canal errado, ele afunda. Todos veem a rota, ninguém vê o que os outros passaram.`,tu_chn4:`Debatam e votem: o suspeito é acorrentado ⛓️ e o que ele passa fica público.`,
tu_chn5:`No fim, acusem em segredo: +2 por Naufragador desmascarado. Mas com navios afundados suficientes, eles vencem.`});
})();
