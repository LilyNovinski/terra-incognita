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
 const P3=[0,1,2].map(p=>{if(!w[p])return[];const a=shuf(GL(k+(p||''),'fr').map((v,i)=>v.trim()?[p,i]:null).filter(Boolean));/* réserve absente pour ce ton = rien à piocher (on retombe sur un autre ton) */
  return a.filter(x=>SI.has(id(...x))).sort((x,y)=>SI.get(id(...y))-SI.get(id(...x))).concat(a.filter(x=>!SI.has(id(...x))))}),out=[];
 for(let j=0;j<n;j++){let r=Math.random(),p=0;while(p<2&&(r-=w[p])>0)p++;if(!P3[p].length)p=P3.findIndex(x=>x.length);if(p<0)break;out.push(P3[p].pop())}
 gSeenAdd(out.map(x=>id(...x)));return shuf(out)}
/* 📜 LIVRE DE BORD : temps forts des parties, gardés sur l'appareil de l'hôte (comme terra:seenG), du plus ancien au
   plus récent. Chaque fin NORMALE de partie ajoute au plus 2 lignes {t,g,k,n} : vainqueur·e(s) (pas en coop, pas si
   plus de 2 ex æquo) + 1 temps fort propre au jeu (GAMES[id].log(s) → candidats, un seul tiré au sort).
   On ne montre que les lignes dont TOUTES les personnes citées sont là. Trois clins d'œil, pas plus :
   salon (st.clog, 5 lignes repliées), 1re étape d'un jeu (son dernier temps fort), Le Phare (≤ 1 question « souvenir »). */
/* 🎲 parties jouées par jeu ('exp' = l'Expédition) : sur l'appareil de l'hôte, copié dans st.gplay pour tout le monde */
const GPLK='terra:playsG';
function gPlays(){try{const o=JSON.parse(localStorage.getItem(GPLK)||'{}');return o&&typeof o=='object'?o:{}}catch(e){return{}}}
function gPlayAdd(s,id){const k=id||'exp',L=gPlays(),m={...L,...(s.gplay||{})};for(const x in L)m[x]=Math.max(+L[x]||0,+(s.gplay||{})[x]||0);m[k]=(+m[k]||0)+1;s.gplay=m;
 try{localStorage.setItem(GPLK,JSON.stringify(m))}catch(e){}}
/* jeux jouables au nombre actuel (spectateurs exclus) */
function gFit(s){const on=gPl(s).length;return['exp',...Object.keys(GAMES)].filter(k=>k=='exp'?on>=2:on>=GAMES[k].min&&on<=GAMES[k].max)}
const GLOGK='terra:logG';
function gLog(){try{const a=JSON.parse(localStorage.getItem(GLOGK)||'[]');return Array.isArray(a)?a.filter(e=>e&&GAMES[e.g]&&e.k&&Array.isArray(e.n)&&e.n.length):[]}catch(e){return[]}}
function gLogAdd(L){if(!L.length)return;try{localStorage.setItem(GLOGK,JSON.stringify(gLog().concat(L).slice(-150)))}catch(e){}}
const gLogFor=names=>{const S=new Set(names);return gLog().filter(e=>e.n.every(x=>S.has(x))).reverse()};
const gClog=s=>gLogFor((s.players||[]).filter(p=>p.online).map(p=>p.name)).slice(0,5).map(({g,k,n})=>({g,k,n}));
const gLogT=e=>{const v={g:GT('n_'+e.g)};(e.n||[]).forEach((x,i)=>v['ab'[i]]=B(x));return GT('lg_'+e.k,v)};
function gLogGame(s,r){if(typeof localStorage=='undefined')return;const g=s.game,G=GAMES[g.id],L=[];
 if(!r.coop&&s.order.length>1){const P=r.pts||g.sc,mx=Math.max(...s.order.map(p=>P[p]||0)),w=s.order.filter(p=>(P[p]||0)==mx);
  if(mx>0&&w.length<=2&&w.length<s.order.length)L.push({k:w.length>1?'win2':'win',n:w})}
 const c=G.log?(G.log(s)||[]).filter(e=>e&&e.n&&e.n.length&&e.n.every(x=>s.order.includes(x))):[];if(c.length)L.push(c[Math.floor(Math.random()*c.length)]);
 const t=Date.now();gLogAdd(L.map(e=>({t,g:g.id,k:e.k,n:e.n})));s.clog=gClog(s)}

/* ---------- moteur ---------- */
const gOn=s=>s.order.filter(n=>{const p=P(n);return p&&p.online!==false});
/* attente : une coupure brève (téléphone en veille, changement d'appli, réseau) ne fait pas sauter quelqu'un — on l'attend
   encore GGR ms après sa déconnexion (le sablier, lui, court toujours). Jamais compté comme « fini » pour autant. */
const GOFF={},GGR=60000;
const gWt=s=>s.order.filter(n=>{const p=P(n);if(!p)return false;if(p.online!==false){delete GOFF[n];return true}const t=GOFF[n]||(GOFF[n]=Date.now());return Date.now()-t<GGR});
/* spectateurs 👀 : au salon, chacun peut choisir de regarder (s.gspec) ; en partie, toute personne hors s.order regarde
   (arrivée en cours de partie → elle joue à la suivante). gPl = qui jouera la prochaine partie. */
const gPl=s=>s.players.filter(p=>p.online&&!(s.gspec||[]).includes(p.name)).map(p=>p.name);
W.GSpec=(s,n)=>!!(s&&P(n)&&(s.phase=='game'||s.phase=='gend'?s.order&&!s.order.includes(n):s.phase=='lobby'&&s.gsel&&(s.gspec||[]).includes(n)));
/* scores toujours propres : nombre fini, arrondi au dixième, 0 pour qui n'en a pas */
const gNum=v=>{v=+v;return isFinite(v)?Math.round(v*10)/10:0};
function gScl(s){const g=s.game;if(!g)return;g.sc=g.sc||{};s.order.forEach(n=>g.sc[n]=gNum(g.sc[n]))}
/* sablier : durée de base × facteur de l'hôte (TF : 1,5 / 1 / 0,7, comme l'Expédition). TF 0 = pas de sablier : g.dl=-1,
   on avance seulement quand tout le monde a fini. Toutes les durées de jeu passent par gWait. */
const gTF=()=>{try{return typeof st!='undefined'&&st?+(st.timer??1):1}catch(e){return 1}};/* = TF() hors mode éclair (propre à l'Expédition) */
function gWait(g,sec,st,rv){const f=gTF();sec=Math.round(sec*(f||1));g.st=st;g.k++;g.done={};g.need=null;g.dl=f?Date.now()+sec*1000:-1;g.sec=sec;g.rv=rv?1:0;g.edt=null}
const gLate=g=>g.dl>0&&Date.now()>g.dl;
const gNeed=s=>{const g=s.game;return gWt(s).filter(n=>!g.need||g.need.includes(n))};
const gAll=s=>gNeed(s).every(n=>s.game.done[n]);
function gFin(s){const g=s.game;gScl(s);const r=GAMES[g.id].fin(s)||{},rp=r.pts||g.sc,pts={};s.order.forEach(n=>pts[n]=gNum(rp[n]));s.gres={pts,coop:r.coop?{...r.coop,v:gNum(r.coop.v),max:gNum(r.coop.max)}:null};g.dl=0;s.phase='gend';if(g.over)try{gLogGame(s,r)}catch(e){}}
function gCheck(s){const g=s.game;let i=0;
 while(s.phase=='game'&&g.dl&&(gAll(s)||gLate(g))&&i++<6){g.dl=0;GAMES[g.id].next(s);gScl(s);if(g.over){gFin(s);break}}}
function gStart(s){const id=s.gsel;gPlayAdd(s,id);s.game={id,k:0,r:0,n:0,sc:{},done:{},rx:{}};s.order.forEach(n=>s.game.sc[n]=0);s.gres=null;s.phase='game';s.gid=Date.now().toString(36);GAMES[id].init(s);
 /* 📜 clin d'œil : le dernier temps fort de CE jeu entre ces personnes, en tête de la 1re étape (sauf si Le Phare en pose déjà un) */
 try{const g=s.game,e=!g.lq&&typeof localStorage!='undefined'&&gLogFor(s.order).find(e=>e.g==id);if(e)g.nod={k:e.k,n:e.n}}catch(e){}gCheck(s)}
/* @games : appelé en tête de act() ; true = géré ici */
W.GAct=function(s,from,a){const t=a&&a.t;
 if(t=='gsel'){if(from==s.host&&s.phase=='lobby'&&(!a.v||GAMES[a.v])){s.gsel=a.v||null;bump()}return true}
 if(t=='groll'){if(from==s.host&&s.phase=='lobby'){const L=gFit(s),pl=s.gplay||{};if(L.length>1){
   const w=L.map(k=>1/(1+(+pl[k]||0))**1.3),cur=s.gsel||'exp';let r=Math.random()*w.reduce((a,b)=>a+b,0),i=0;while(i<L.length-1&&(r-=w[i])>0)i++;
   if(L[i]==cur&&L.length>2&&Math.random()<.7)i=(i+1+Math.floor(Math.random()*(L.length-1)))%L.length;/* éviter de retomber sur la même */
   s.gsel=L[i]=='exp'?null:L[i];s.groll={L,c:L[i],n:((s.groll&&s.groll.n)||0)+1,at:Date.now()};bump()}}return true}
 if(t=='start'&&!s.gsel&&s.phase=='lobby'&&from==s.host&&gPl(s).length>=2)gPlayAdd(s,'');/* l'Expédition elle-même démarre dans index.html */
 if(t=='start'&&s.gsel&&s.phase=='lobby'){const G=GAMES[s.gsel],on=gPl(s);
  if(from==s.host&&G&&on.length>=G.min&&on.length<=G.max){s.order=on;gStart(s);bump()}return true}
 if(t=='gspec'){if(s.phase=='lobby'&&P(from)){const L=(s.gspec||[]).filter(n=>n!=from&&P(n));s.gspec=a.v?[...L,from]:L;bump()}return true}
 if(t=='gtie'){/* liens connus (couples…) : n'importe qui peut lier deux personnes ; seul·es les autres peuvent délier */
  if(s.phase=='lobby'&&s.players.some(p=>p.name==from)&&Array.isArray(a.v)&&a.v.length==2&&a.v[0]!==a.v[1]&&a.v.every(n=>typeof n=='string'&&s.players.some(p=>p.name==n))){
   const k=a.v[0]<a.v[1]?a.v[0]+'|'+a.v[1]:a.v[1]+'|'+a.v[0],L=s.gtie||[];if(L.includes(k)){if(a.v.includes(from))return true;s.gtie=L.filter(x=>x!=k)}else s.gtie=[...L,k].slice(-8);bump()}return true}
 if(t=='gx'&&a.v=='stop'){if(from==s.host&&s.phase=='game'&&s.game){gFin(s);bump()}return true}
 if(t=='gx'){if(from!=s.host||s.phase!='gend')return true;s.players=s.players.filter(p=>p.online);
  const G=GAMES[s.game.id],on=gPl(s);s.gspec=(s.gspec||[]).filter(n=>P(n));
  if(a.v=='again'&&on.length>=G.min&&on.length<=G.max){s.gsel=s.game.id;s.order=on;gStart(s)}else{s.phase='lobby';s.game=null;s.gres=null}
  bump();return true}
 if(t=='g'){const g=s.game;if(s.phase!='game'||!g||!P(from))return true;if(a.k!=null&&a.k!==g.k)return true;
  /* 👀 spectateurs : pas d'action de jeu (leurs réactions passent par la barre commune) */if(!s.order.includes(from))return true;
  let ch=false;if(a.ok&&g.rv){if(!g.done[from]){g.done[from]=1;ch=true}}
  /* ✏️ Modifier : la personne n'est plus prête tant qu'elle n'a pas renvoyé (jamais pendant un dévoilement) */
  else if(a.undo){if(!g.rv&&g.done[from]){delete g.done[from];(g.edt=g.edt||{})[from]=1;ch=true}}
  else{/* on peut changer d'avis tant que l'étape n'est pas finie (les autres jouent encore, sablier en cours) */
   const was=g.done[from];if(was&&!g.rv)delete g.done[from];ch=!!GAMES[g.id].act(s,from,a);if(!ch&&was)g.done[from]=was;if(ch&&g.edt)delete g.edt[from]}
  if(ch){gCheck(s);bump()}return true}
 return false};
W.GHide=function(name,s){if(!s||s.phase!='game'||!s.game)return s;const G=GAMES[s.game.id];return G&&G.hide?{...s,game:G.hide(s.game,name,s)}:s};
W.GKick=function(s,name){s.order=s.order.filter(x=>x!=name);if(s.phase!='game'||!s.game)return;if(s.order.length<2)gFin(s);else gCheck(s)};
W.gTick=function(){try{if(isHost&&st&&st.phase=='game'&&st.game&&st.game.dl&&(gLate(st.game)||gAll(st))){gCheck(st);bump()}}catch(e){}};
if(typeof setInterval!='undefined'&&typeof document!='undefined')setInterval(W.gTick,1000);

/* ---------- aides de vue ---------- */
const RX=['😎','😱','🫧','🦈'];
/* 💬 réactions : la barre de l'Expédition (reactBar, double-tap ❤️), sous le jeu ; G.rx = jeu de réactions propre (mécanique) */
const gRxBar=G=>typeof reactBar=='function'?`<div class="gwrx">${reactBar(G&&G.rx)}</div>`:'';
W.GRxOk=e=>{try{return st.phase=='game'&&!!st.game&&(GAMES[st.game.id].rx||[]).includes(e)}catch(x){return false}};
/* bulle sur la puce du joueur dans le jeu (DOM seul : ne relance aucune autre animation) */
W.GRxHit=(from,e)=>{if(typeof document=='undefined')return;document.querySelectorAll('section>.gw [data-rxp]').forEach(x=>{if(x.dataset.rxp!==from)return;
 x.querySelectorAll('.grxf').forEach(o=>o.remove());const b=document.createElement('span');b.className='grxf';b.setAttribute('aria-hidden','true');b.textContent=e;x.appendChild(b);setTimeout(()=>b.remove(),2600)})};
const gs=a=>send({t:'g',k:st.game.k,...a});
const meN=()=>me.name;
const NM=n=>n=='~'?`<b>🐟 ${esc(GT('ghost'))}</b>`:B(n);
const DT=n=>n=='~'?'<span class="dot" style="background:#7aa6b8"></span>':DOT(n);
const dl=(i,b=0)=>`style="animation-delay:${(b+i*.07).toFixed(2)}s"`;
function gHint(s){const g=s.game,m=meN(),need=gNeed(s);
 if(!s.order.includes(m))return{hint:'👀 '+GT('specH')};
 if(g.rv){const w=need.filter(n=>!g.done[n]);return g.done[m]?{hint:w.length?GT('waitN',{n:w.map(B).join(', ')}):'…'}:{hint:GT('ready'),hintBtn:`<button class="pri gokb" id="gok">${GT('ok')}</button>`,mine:true}}
 if(!need.includes(m))return{hint:GT('watch')};
 if(!g.done[m])return{hint:GT('yourMove'),mine:true};
 const w=need.filter(n=>!g.done[n]);return{hint:GT('waitN',{n:w.map(n=>(g.edt||{})[n]?B(n)+' ✏️ '+GT('gEdg'):B(n)).join(', ')})}}
const pick=(names,cur,attr,ex)=>`<div class="gpk">${names.filter(n=>n!=ex).map((n,i)=>`<button class="ga ${cur==n?'sel':''}" ${dl(i)} ${attr}="${esc(n)}">${DT(n)}<span>${n==meN()?GT('me'):esc(n)}</span></button>`).join('')}</div>`;
const norm=w=>String(w||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'').replace(/^(.{4,})[sx]$/,'$1');
/* nombres lisibles : pluriel par langue, points signés (« +3 points », « −8 pts »), temps restant d'une étape */
const gPlI=(v,l)=>{v=Math.abs(+v||0);l=l||(typeof LANG!='undefined'?LANG:'fr');if(l=='zh')return 0;if(l=='ru'){const a=v%10,b=v%100;return Number.isInteger(v)?(a==1&&b!=11?0:a>=2&&a<=4&&(b<12||b>14)?1:2):1}return l=='fr'?(v<2?0:1):(v==1?0:1)};
const GTn=W.GTn=(k,v,x)=>{const f=GT(k,{v,...(x||{})}).split('|');return f[Math.min(gPlI(parseFloat(String(v).replace('−','-'))),f.length-1)]};
const gSg=v=>v>0?'+'+v:v<0?'−'+Math.abs(v):'0';
const gP=v=>GTn('pts',gSg(+v||0)).replace(/^(\S+)/,'$1'),gPs=v=>GTn('ptsS',gSg(+v||0));
const gRem=s=>{const g=s.game;return g&&g.dl>0?Math.max(0,(g.dl-((s.updatedAt||Date.now())+(Date.now()-(typeof RCV!='undefined'&&RCV||Date.now()))))/1000):0};
const hideOwn=(o,n)=>{const r={};for(const k in o||{})r[k]=k==n?o[k]:null;return r};

/* animations d'entrée : une seule fois par étape (clé jeu + g.k). Un nouveau rendu dans la même étape (offre, réaction,
   choix d'un·e autre, chat…) recrée le DOM : chaque animation déjà vue reprend là où elle en était (currentTime), donc
   rien ne rejoue ni ne clignote ; seuls les éléments vraiment nouveaux s'animent. [data-gan] : animations qui se calent
   elles-mêmes sur une horloge (sablier, séquences, bulles de réaction) — on n'y touche pas. */
const gAnP=(el,root)=>{let p='';for(let e=el;e&&e!==root;e=e.parentElement){const c=((e.getAttribute('class')||'').split(' ')[0])||'',t=e.tagName;let i=0;
 for(let x=e.previousElementSibling;x;x=x.previousElementSibling)if(x.tagName==t&&((x.getAttribute('class')||'').split(' ')[0]||'')==c)i++;p='/'+t+'.'+c+':'+i+p}return p};
function gAnim(root,key){if(!root||!root.getAnimations)return;try{const now=performance.now(),N=new Map();if(GV.ak!==key){GV.ak=key;GV.am=new Map()}const M=GV.am;
 for(const a of root.getAnimations({subtree:true})){const el=a.effect&&a.effect.target;if(!el||!a.animationName||el.closest('[data-gan]'))continue;
  const id=gAnP(el,root.parentElement)+(a.effect.pseudoElement||'')+'@'+a.animationName,t0=M.get(id);
  if(t0!=null){a.currentTime=now-t0;N.set(id,t0)}else N.set(id,now)}
 GV.am=N}catch(e){}}
W.GAnim=gAnim;
/* brouillons de jeu (textes en cours d'écriture) : gardés aussi dans la session de l'onglet → survivent à un rechargement
   de page (téléphone qui a tué l'onglet) tant que la partie est la même */
const GDK='terra:gdr';
function gDrIn(s){if(GV.dr===s.gid)return;GV.dr=s.gid;try{const o=JSON.parse(sessionStorage.getItem(GDK)||'null');if(o&&o.gid===s.gid)for(const k in o.d)if(drafts[k]==null)drafts[k]=o.d[k]}catch(e){}}
function gDrOut(){try{const d={};for(const k in drafts)if(/^g[a-z]/.test(k)&&typeof drafts[k]=='string')d[k]=drafts[k];sessionStorage.setItem(GDK,JSON.stringify({gid:st.gid,d}))}catch(e){}}
if(typeof document!='undefined')document.addEventListener('input',e=>{const t=e.target;if(t&&t.closest&&t.closest('.gw')&&t.dataset&&t.dataset.d)setTimeout(gDrOut,0)});
/* 👀 bandeau des spectateurs (en partie) : qui regarde, et sa dernière réaction */
function gSpecBar(s){const o=s.order||[],L=(s.players||[]).filter(p=>p.online&&!o.includes(p.name));if(!L.length)return '';const g=s.game||{};
 return `<div class="gspb2"><span class="gspi" aria-hidden="true">👀</span>${L.map(p=>`<span class="gspn">${DT(p.name)}${p.name==meN()?esc(GT('me')):esc(p.name)}</span>`).join('')}</div>`}

W.GView=function(){const s=isHost?GHide(meN(),st):st,g=s.game;if(!g||!GAMES[g.id])return{html:''};/* l'hôte voit la même chose que les autres */
 if(s.v!==GV.v){GV.v=s.v;GV.t=Date.now()}
 try{gDrIn(s)}catch(e){}
 if(s.phase=='gend')return gEndView(s);
 const spc=!s.order.includes(meN());
 const G=GAMES[g.id],v=G.view(s)||{},two=s.order.length==2;
 const rem=gRem(s);
 const rk='r_'+g.id+(two&&GI18N.fr.ui['r_'+g.id+'2']?'2':'');
 const head=`<div class="ghd"><span class="gic">${G.icon}</span><b>${GT('n_'+g.id)}</b>${g.n?`<span class="grd">${Math.min(g.r+1,g.n)} / ${g.n}</span>`:''}${meN()==s.host?`<button class="gstop" id="gstop" aria-label="${esc(GT('stopAsk'))}" data-tip="${esc(GT('stopAsk'))}">✕</button>`:''}</div>
 ${spc?`<p class="gspc0">👀 ${GT((s.gspec||[]).includes(meN())?'specT2':'specT')}</p>`:''}${g.dl>0&&!(G.clk&&G.clk(g))?`<div class="gsab" data-gan aria-hidden="true"><i style="animation-duration:${g.sec}s;animation-delay:-${Math.max(0,g.sec-rem).toFixed(2)}s"></i></div>`:''}
 ${g.k<=1?`<p class="grule">${GT(rk)}</p>${g.nod?`<p class="gnod ga" ${dl(2)}>📜 ${GT('lgLast',{t:gLogT({g:g.id,...g.nod})})}</p>`:''}`:''}`;
 const h={...gHint(s),...v};const ob=v.bind;
 if(spc){delete h.hintBtn;h.mine=false}
 return{...h,html:`<div class="gw g-${g.id}${g.k>1?' gnx':''}${spc?' gspc':''}">${head}${v.html}${gSpecBar(s)}${gRxBar(G)}</div>`,bind(){
  $('#gok')&&($('#gok').onclick=()=>gs({ok:1}));$('#gstop')&&($('#gstop').onclick=()=>ask(GT('stopAsk'),GT('stop')).then(v=>v&&send({t:'gx',v:'stop'})));
  if(GV.fx!==g.id+g.k){GV.fx=g.id+g.k;if(g.rv)try{SFX.reveal()}catch(e){}}
  gAnim($('section>.gw'),'g'+s.gid+'.'+g.k);ob&&ob()}}};

function gEndView(s){const g=s.game,G=GAMES[g.id],R=s.gres||{pts:{}},host=meN()==s.host,two=s.order.length==2;
 const rows=Object.entries(R.pts).sort((a,b)=>b[1]-a[1]);let rank=0,prev=null;
 const list=R.coop?'':`<div class="gsc">${rows.map(([n,p],i)=>{if(p!==prev){rank=i;prev=p}return `<div class="grow ga ${n==meN()?'me':''}" ${dl(i,.1)}><span class="gmd">${['🥇','🥈','🥉'][rank]||rank+1}</span>${DT(n)}<span class="gnm">${NM(n)}</span><b class="gpt">${p}</b></div>`}).join('')}</div>`;
 const html=`<div class="gw g-${g.id}"><div class="ghd"><span class="gic">${G.icon}</span><b>${GT('n_'+g.id)}</b></div>
 <div class="card"><h3>${GT(R.coop?(GI18N.fr.ui['coop_'+g.id]?'coop_'+g.id:'coopT'):'scores')}</h3>${list}${G.endView?G.endView(s):''}</div>
 ${host?`<div class="gbtns"><button class="pri wide" data-gend="again">${GT('again')}</button><button class="ghost wide" data-gend="lobby">${GT('lobby')}</button></div>`:''}${gRxBar()}</div>`;
 return{html,mine:host,hint:host?GT('hostNext'):GT('waitHostN',{n:B(s.host)}),bind(){
  $$('[data-gend]').forEach(b=>b.onclick=()=>send({t:'gx',v:b.dataset.gend}));
  gAnim($('section>.gw'),'e'+s.gid);
  if(GV.fx!=='end'+s.gid){GV.fx='end'+s.gid;if(!RM())setTimeout(()=>{try{confetti(rows[0]&&rows[0][0]==meN()||R.coop?50:24)}catch(e){}},350)}}}}

/* @games : carte « Salle de jeux » du salon */
W.GLobby=function(host,on,E){const sel=st.gsel&&GAMES[st.gsel]?st.gsel:'',on0=on;on=gPl(st).length;/* 👀 les spectateurs ne comptent pas */
 if(host&&!st.gplay&&typeof localStorage!='undefined'){const p=gPlays();if(Object.keys(p).length){st.gplay=p;setTimeout(()=>{try{bump()}catch(e){}},0)}}
 const PL=st.gplay||{},fit=gFit(st),pv=fit.map(k=>+PL[k]||0),pmax=Math.max(0,...pv),pmed=pv.slice().sort((a,b)=>a-b)[pv.length>>1]||0;
 const freq=id=>{const k=id||'exp',n=+PL[k]||0;if(!pmax)return'';
  if(!n)return`<span class="gfq gfq0">✨ ${GT('pl0')}</span>`;
  if(n==pmax&&n>=3&&n>=2*Math.max(1,pmed))return`<span class="gfq gfqh">🔥 ${GT('plH')}</span>`;
  return`<span class="gfq">${GT('plN',{n})}</span>`};
 gRollShow();
 const tile=id=>{const G=GAMES[id],ok=!id||on<=G.max,miss=id?Math.max(0,G.min-on):Math.max(0,2-on),tag=host?'button':'div';
  return `<${tag} class="gtile ggt ${id?'grw':'ghero'} ${sel==id?'sel':''} ${miss||!ok?'gfew':''}" ${host?`data-gsel="${id}" ${ok?'':'disabled'}`:''}>${id?'':`<span class="gmain">★ ${GT('gmain')}</span>`}<span class="gi">${id?G.icon:'⛵'}</span><span class="gt"><b>${id?GT('n_'+id):GT('exp')}</b><span class="mut">${id?GT('d_'+id):GT('expD')}</span></span><span class="gmeta"><span class="gmin">≈ ${id?G.dur:(E||'?')} min · ${id?G.min:2}–${id?G.max:8} 👤</span>${freq(id)}</span>${miss?`<span class="gmiss">${GT(miss>1?'missN':'miss1',{n:miss})}</span>`:!ok?`<span class="gmiss">${GT('needP',{a:G.min,b:G.max})}</span>`:''}</${tag}>`};
 let h=`<div class="card"><div class="grh"><h3>🎲 ${GT('room')}</h3>${host&&fit.length>1?`<button class="ghost groll" id="groll" title="${esc(GT('rollD'))}"><span class="grd6" aria-hidden="true">🗼</span>${GT('rollB')}</button>`:''}</div>${tile('')}${(()=>{const C=[['d',['bot','pha','rad','vag']],['s',['arc','msk','coq']],['h',['chn','mim','prl']],['c',['tmp','sau','aby','pec']]],seen=new Set(C.flatMap(c=>c[1]));
  const sec=(k,ids)=>{ids=ids.filter(i=>GAMES[i]);return ids.length?`<h4 class="gsec">${GT('gcat_'+k)}</h4><div class="glist">${ids.map(tile).join('')}</div>`:''};
  return C.map(([k,ids])=>sec(k,ids)).join('')+sec('o',Object.keys(GAMES).filter(i=>!seen.has(i)))})()}${host?'':`<p class="gby">${T('chosenBy',{n:B(st.host)})}</p>`}</div>`;
 /* 📜 livre de bord : l'hôte le recalcule pour les personnes présentes (envoyé au prochain bump) */
 if(host&&typeof localStorage!='undefined')try{const c=gClog(st);if(JSON.stringify(c)!==JSON.stringify(st.clog||[])){st.clog=c;setTimeout(()=>{try{bump()}catch(e){}},0)}}catch(e){}
 const CL=(st.clog||[]).filter(e=>GAMES[e.g]);
 if(CL.length)h+=`<details class="card glog" ${GV.lgo?'open':''}><summary>📜 ${GT('lgT')}<span class="glgn">${CL.length}</span></summary><ul>${CL.map((e,i)=>`<li class="ga" ${dl(i)}><span class="glgi">${GAMES[e.g].icon}</span><span>${gLogT(e)}</span></li>`).join('')}</ul></details>`;
 if(sel){const G=GAMES[sel],ok=on>=G.min&&on<=G.max,rk='r_'+sel+(on==2&&GI18N.fr.ui['r_'+sel+'2']?'2':'');
  let tm='';try{if(!G.rt){const tf=st.timer??1;tm=`<h3 class="gh">${T('timerT')}</h3>${host?`<div class="gseg">${TIM.map((v,i)=>`<button data-tm="${i}" class="${v==tf?'sel':''}">${T('tm'+i)}</button>`).join('')}</div>`:`<p class="gval">${T('tm'+TIM.indexOf(tf))}</p>`}<p class="gsub">${T(tf?'timerD':'timer0D')}</p>`}}catch(e){}
  let ti='';if(G.ties){const L=(st.gtie||[]).filter(k=>k.split('|').every(p=>st.players.some(x=>x.name==p))),ps=st.players.filter(p=>p.online).map(p=>p.name);
   ti=`<h3 class="gh">🔗 ${GT('mtieT')}</h3><p class="gsub">${GT('mtieD')}</p>${L.length?`<div class="gties">${L.map(k=>`<span class="gtie">${k.split('|').map(B).join(' 🔗 ')}${k.split('|').includes(meN())?'':`<button class="gtx" data-gtie="${esc(k)}" aria-label="✕">✕</button>`}</span>`).join('')}</div>`:`<p class="gval">${GT('mtie0')}</p>`}
   ${ps.length>1?`<p class="gsub">${GT('mtieH')} ${GT('mtieA')}</p><div class="gtiep">${ps.map(p=>`<button class="ghost ${GV.tie==p?'sel':''}" data-gtp="${esc(p)}">${esc(p)}</button>`).join('')}</div>`:''}`}
  const sp=(st.gspec||[]).includes(meN()),SL=(st.gspec||[]).filter(n=>st.players.some(p=>p.name==n&&p.online));
  const spc=on0>1||sp?`<div class="gspw"><button class="ghost gspt ${sp?'sel':''}" id="gspec" aria-pressed="${sp}">👀 ${GT('specB')}</button><p class="gsub">${GT('specD')}</p>${SL.length?`<p class="gval gspl">${GT('specL',{n:SL.map(B).join(', ')})}</p>`:''}</div>`:'';
  h+=(G.tone?g2ToneCard(host):'')+`<div class="card"><p class="grule">${GT(rk)}</p>${G.tut?`<button class="ghost gtutb" data-gtut="${sel}">📖 ${GT('tuB')}</button>`:''}${ok?'':`<p class="err">${GT('needP',{a:G.min,b:G.max})}</p>`}${tm}${ti}${spc}
  ${host?`<button class="pri wide" id="start" ${ok?'':'disabled'}>${GT('play',{g:GT('n_'+sel)})}</button>`:`<p class="gby">${GT('waitHost')}</p>`}</div>`}
 return h};
/* 🗼 tirage au sort : rejoué une seule fois par tirage, seulement s'il vient d'avoir lieu (pas pour qui arrive après) */
function gRollShow(){const r=st.groll;if(!r||!Array.isArray(r.L)||GV.roll==r.n)return;const first=GV.roll===undefined;GV.roll=r.n;
 if(first&&!(st.updatedAt-r.at<2500))return;if(Date.now()-(isHost?r.at:RCV)>3000)return;
 if(typeof document=='undefined')return;const old=document.getElementById('grollx');old&&old.remove();
 const N=r.L.length,ci=Math.max(0,r.L.indexOf(r.c)),nm=k=>k=='exp'?GT('exp'):GT('n_'+k),ic=k=>k=='exp'?'⛵':GAMES[k].icon,PL=st.gplay||{};
 const o=document.createElement('div');o.id='grollx';o.className='grollx';o.setAttribute('role','dialog');o.setAttribute('aria-live','polite');
 o.innerHTML=`<div class="grw0"><div class="grring" style="--n:${N}"><div class="grbeam"></div>${r.L.map((k,i)=>`<span class="grisl" style="--a:${i*360/N}deg"><b>${ic(k)}</b></span>`).join('')}<div class="grtower">🗼</div></div>
  <p class="grres"><span class="mut">${GT('rollT')}</span><b></b></p></div>`;
 document.body.appendChild(o);const beam=o.querySelector('.grbeam'),isl=[...o.querySelectorAll('.grisl')],res=o.querySelector('.grres b');
 const fin=360*4+ci*360/N,D=RM()?0:4200,t0=performance.now();let last=-1;
 const close=()=>{o.classList.add('out');setTimeout(()=>o.remove(),380)};o.onclick=close;
 const done=()=>{beam.style.transform=`rotate(${fin}deg)`;isl.forEach((e,i)=>e.classList.toggle('on',i==ci));isl[ci].classList.add('win');res.textContent=nm(r.c);o.classList.add('fin');
  try{typeof ftone=='function'&&ftone([[523,0,.09],[659,.09,.09],[784,.18,.16]])}catch(e){}setTimeout(close,2600)};
 if(!D){done();return}
 const step=now=>{if(!o.isConnected)return;const t=Math.min(1,(now-t0)/D),e=1-Math.pow(1-t,3.2),a=fin*e;beam.style.transform=`rotate(${a}deg)`;
  const k=Math.round((a%360)/(360/N))%N;if(k!=last){last=k;isl.forEach((x,i)=>x.classList.toggle('on',i==k));try{typeof ftone=='function'&&t<.97&&ftone([[880,0,.03]])}catch(x){}}
  t<1?requestAnimationFrame(step):done()};
 requestAnimationFrame(step);setTimeout(()=>{if(!o.classList.contains('fin')&&o.isConnected)done()},D+400)/* onglet masqué : rAF figé */}
/* liens connus : clics délégués (le salon est rendu par index.html) */
if(typeof document!='undefined')document.addEventListener('click',e=>{const lg=e.target.closest&&e.target.closest('.glog>summary');if(lg){GV.lgo=!lg.parentNode.open;return}
 if(e.target.closest&&e.target.closest('#gspec')){send({t:'gspec',v:!(st.gspec||[]).includes(meN())});return}
 if(e.target.closest&&e.target.closest('#groll')){send({t:'groll'});return}
 const t=e.target.closest&&e.target.closest('[data-gtp],[data-gtie]');if(!t)return;
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
  if(g.st=='w'){if(g.done[m]&&GV.ed!==g.id+g.k)return{html:`<div class="card c"><div class="gbig ga gfloat">🍾</div><p class="ga" ${dl(2)}>${GT('bwait')}</p><button class="ghost gedit ga" ${dl(3)} id="gedit">✏️ ${GT('edit')}</button></div>`,bind(){$('#gedit').onclick=()=>{GV.ed=g.id+g.k;gs({undo:1});render()}}};
   const fl=i=>drafts['gbf'+i]=='1',ip=(g.ip&&g.ip[m])||[];
   return{html:`<div class="card">${[0,1,2].map(i=>`<div class="gwr ga" ${dl(i)}>${two?`<button type="button" class="gtf ${fl(i)?'f':''}" data-gf="${i}" aria-pressed="${fl(i)}">${GT(fl(i)?'bF':'bT')}</button>`:''}<textarea data-d="gbw${i}" rows="2" maxlength="220" placeholder="${esc(GT(two?'bph2':t18?'bph18':'bph'))}"></textarea></div>`).join('')}
    ${ip.length?`<div class="gidea"><p class="gidh">💡 ${GT('bIdea')}</p><div class="gidl">${ip.map((x,i)=>`<button type="button" class="gidc" data-gid="${i}">${esc(GC('bot',x))}</button>`).join('')}</div><p class="gidd">${GT('bIdeaD')}</p></div>`:''}<p class="err"></p><button class="pri wide" id="gsend">${GT('send')}</button></div>`,
    bind(){/* 💡 idées facultatives : rien n'est écrit tant qu'on ne touche pas une idée ; elle va dans la case choisie
      (ou la 1re vide), et ne remplace un texte que si toutes les cases sont pleines */
     const T=[0,1,2].map(i=>$(`[data-d="gbw${i}"]`));T.forEach((t,i)=>t&&t.addEventListener('focus',()=>GV.bf=i));
     $$('[data-gid]').forEach(b=>b.onclick=()=>{const tx=GC('bot',ip[+b.dataset.gid])+' : ';let i=GV.bf!=null&&T[GV.bf]&&!T[GV.bf].value.trim()?GV.bf:T.findIndex(t=>t&&!t.value.trim());if(i<0)i=GV.bf!=null?GV.bf:2;
      const t=T[i];if(!t)return;t.value=tx;drafts['gbw'+i]=tx;t.dispatchEvent(new Event('input',{bubbles:true}));t.focus();try{t.setSelectionRange(tx.length,tx.length)}catch(e){}GV.bf=i});
     $$('[data-gf]').forEach(b=>b.onclick=()=>{const k='gbf'+b.dataset.gf,v=drafts[k]=='1'?'0':'1';drafts[k]=v;b.classList.toggle('f',v=='1');b.setAttribute('aria-pressed',v=='1');b.textContent=GT(v=='1'?'bF':'bT')});
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
 /* 📜 question « souvenir » : au plus 1 par partie (60 %), tirée d'un vrai temps fort récent entre les personnes présentes */
 LQ:{win:'w',prlC:'c',chnC:'c',mimC:'c',prlH:'s',prlD:'s',chnW:'s',chnW2:'s',mimW:'s',mimW2:'s',mskS:'v',mskB:'v',mskP:'t'},
 init(s){const g=s.game;g.n=s.order.length<=4?10:12;g.q=gPool(s,'pha',g.n);g.n=g.q.length;g.v={};g.p={};g.res=[];
  try{const L=typeof localStorage!='undefined'?gLogFor(s.order).filter(e=>this.LQ[e.k]).slice(0,3):[];
   if(L.length&&g.n>=4&&Math.random()<.6){const e=L[Math.floor(Math.random()*L.length)];g.lq={g:e.g,k:e.k,n:e.n};g.q[1+Math.floor(Math.random()*(g.n-2))]=['@']}}catch(e){}
  gWait(g,30,'v')},
 qt(g,q){return q&&q[0]=='@'&&g.lq?GT('lq_'+this.LQ[g.lq.k],{a:B(g.lq.n[0])}):esc(GC('pha',q))},
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
  const cq=g.q[g.r],q=`${cq&&cq[0]=='@'&&g.lq?`<p class="gnod ga">📜 ${gLogT(g.lq)}</p>`:''}<p class="gpre">${GT(two?'pq2':'pq')}</p><p class="gq ga">${this.qt(g,cq)}</p>`;
  if(g.st=='v')return{html:`<div class="card c">${q}${pick(s.order,g.v[m],'data-gv')}${two?`<p class="gq2">${GT('ppred',{n:B(o)})}</p>${pick(s.order,g.p[m],'data-gp')}`:''}</div>`,
   bind(){$$('[data-gv]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gv}));$$('[data-gp]').forEach(x=>x.onclick=()=>gs({p:x.dataset.gp}))}};
  const r=g.res[g.r]||{c:{},v:{},p:{}},mx=Math.max(1,...Object.values(r.c));
  if(two){const [a,b]=[m,o];return{html:`<div class="card c">${q}<div class="gduo">${[a,b].map((x,i)=>`<div class="ga" ${dl(i*2,.1)}>${DT(x)}<b>${x==m?GT('me'):esc(x)}</b> → ${NM(r.v[x]||'—')}<br><span class="gtag ${r.p[x]&&r.p[x]==r.v[x==a?b:a]?'ok':'no'}">${GT('ppredS')} ${r.p[x]?esc(r.p[x]):'—'} ${r.p[x]&&r.p[x]==r.v[x==a?b:a]?'✓':'✗'}</span></div>`).join('')}</div><p class="gnote ga" ${dl(5)}>${r.tops.length?'🗼 '+GT('pagree'):GT('pdis')}</p></div>`}}
  const rows=s.order.map(n=>[n,r.c[n]||0]).sort((x,y)=>y[1]-x[1]);
  return{html:`<div class="card">${q}${rows.map(([n,c],i)=>`<div class="gbr ga ${r.tops.includes(n)?'gtop':''}" ${dl(i,.1)}><span class="gnm">${DT(n)}${esc(n)}</span><span class="gbt"><i class="gbar" style="width:${c/mx*100}%;animation-delay:${.2+i*.07}s"></i></span><b>${c||''}</b></div>`).join('')}
   ${r.tops.length?'':`<p class="gnote">${GT('pnone')}</p>`}</div>`,bind(){if(r.tops.includes(m)&&!RM())sparkles($('.gbr.gtop'),10)}}},
 endView(s){const g=s.game,t={};g.res.forEach(r=>r.tops.forEach(n=>(t[n]=t[n]||[]).push(r.q)));
  return `<h3 class="gh3">🗼 ${GT('pport')}</h3>${s.order.map((n,i)=>`<div class="gport ga" ${dl(i,.3)}><b>${DT(n)}${esc(n)}</b>${(t[n]||[]).length?`<ul>${t[n].map(q=>`<li>${this.qt(g,q)}</li>`).join('')}</ul>`:`<p class="mut">${GT('pnone')}</p>`}</div>`).join('')}`},
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
    bind(){$('#gedit')&&($('#gedit').onclick=()=>{GV.ed=g.id+g.k;gs({undo:1});render()});const i=$(`[data-d="gvw${g.k}"]`);if(!i)return;const go=()=>{const w=tidy(i.value);if(!norm(w))return;if(norm(w)==norm(q)||(br&&Object.values(g.w0||{}).some(x=>norm(x)==norm(w))))return err(GT('vno'));GV.ed=null;gs({w})};
     $('#gsend').onclick=go;i.onkeydown=e=>{if(e.key=='Enter')go()};if(matchMedia('(pointer:fine)').matches&&document.activeElement!==i)i.focus()}}}
  const r=g.res[g.r]||{w:{}};
  if(two){const [a,b]=s.order,ok=r.ok;return{html:`<div class="card c">${head}<div class="gduo">${[a,b].map((n,i)=>`<div class="ga" ${dl(i)}>${DT(n)}<b>${esc(r.w[n]||'—')}</b>${r.b?`<br><span class="mut">→ ${esc(r.b[n]||'—')}</span>`:''}</div>`).join('')}</div>
   <p class="gbig2 ga ${ok?'ok':''}" ${dl(3)}>${ok==2?GT('vsame')+' · '+gP(2):ok==1?GT('vpont')+' · '+gP(1):GT('vmiss')}</p></div>`,bind(){if(ok&&!RM())sparkles($('.gbig2'),ok==2?18:8)}}}
  return{html:`<div class="card">${head}${(r.gr||[]).map((l,i)=>`<div class="ggr ga ${l.length>1?'hit':''}" ${dl(i,.1)}><b>${esc(r.w[l[0]])}</b><span>${l.map(n=>`<span class="gchip">${DT(n)}${esc(n)}</span>`).join('')}</span>${l.length>1?`<i class="gpt">${gPs(r.pts[l[0]])}</i>`:''}</div>`).join('')}
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
GAMES.pec={bag:PBAG,icon:'🦪',rx:RX,min:2,max:8,dur:7,tags:['chance'],
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
  const divers=`<div class="gdv">${g.ps.filter(n=>g.fil[n]!=null).map((n,i)=>{const d=g.down.includes(n);return `<span class="gchip ${d?'dn':'up'} ${n==m?'me':''}" data-rxp="${esc(n)}">${d?'🤿':'⛵'} ${DT(n)}${n=='~'?'🐟':esc(n)} <b>${d?g.fil[n]:g.upv[n]!=null?gPs(g.upv[n]):g.lost[n]?'✗':''}</b></span>`}).join('')}</div>`;
  const cof=!s.order.includes(m)?'':`<p class="gcof">🔒 ${GT('pcof')} : <b>${g.cof[m]??0}</b> <span class="mut">· ${GT('psecret')}</span></p>`;
  if(g.st=='e'){const h=g.mh.at(-1)||{upv:{},lost:{}};return{html:`<div class="card c">${evh}<h3>${GT('pmanche')}</h3><div class="gdv">${g.ps.map((n,i)=>`<span class="gchip ga" ${dl(i,.2)}>${DT(n)}${n=='~'?'🐟':esc(n)} <b>${h.upv[n]!=null?gPs(h.upv[n]):h.lost[n]?'✗ '+GT('pLostN',{v:h.lost[n]}):gPs(0)}</b></span>`).join('')}</div>${cof}</div>`}}
  return{html:`<div class="card c">${evh}${divers}${down?`<p class="gfil">${GT('pfil')} : <b>${g.fil[m]}</b></p><div class="gpk">${[['u','pup','⛵'],['d','pdown','🤿']].map(([v,k,ic],i)=>`<button class="ga gdec ${g.ch[m]==v?'sel':''}" ${dl(i)} data-gd="${v}">${ic} ${GT(k)}</button>`).join('')}</div>`:`<p class="gnote">${g.upv[m]!=null?GT('pyouup',{v:g.upv[m]}):g.lost[m]?GT('pdead'):''}</p>`}${bag}${cof}</div>`,
   bind(){$$('[data-gd]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gd}))}}},
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
   return{html:`<div class="card c"><p class="arcst"><b>🦪 ${GT(last?'afinal':'aharv')}</b></p><div class="arcsc">${s.order.map((p,i)=>`<span class="gchip ga ${p==m?'me':''}" ${dl(i,.2)}>${DT(p)}${esc(p)} <b>${gPs(h[p]||0)}</b></span>`).join('')}</div>${this.svg(s)}
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
  const sp=!s.order.includes(m);/* 👀 spectateur : seulement le public (la mer des masques, la finale) */
  if(sp&&(g.st=='m'||g.st=='c'))return{html:`<div class="card c"><div class="gbig ga gfloat">🎭</div></div>`};
  const head=sp?'':g.st=='m'||g.st=='c'||g.st=='r'?`<div class="mkhd"><span class="mkme ga">${GT('ymask')} ${R.mn(me.m)}${sh(me.mtr)}</span><span class="mkvs ga" ${dl(1)}>${GT(me.pt.length>1?'ytrio':'yduo')} ${duo}</span></div>`:'';
  if(g.st=='m'){const pq=g.q[g.r];
   if(g.done[m]&&R.ed!==g.k)return{html:`<div class="card c">${head}<div class="mkbub mine ga" ${dl(2)}>${me.msg?esc(me.msg):`<i class="mut">${GT('mnone')}</i>`}</div><p class="gnote ga" ${dl(3)}>${GT('msent')}</p><button class="ghost mked" id="gedit">✏️ ${GT('medit')}</button></div>`,
    bind(){$('#gedit').onclick=()=>{R.ed=g.k;drafts['gmw'+g.k]=me.msg||'';gs({undo:1});render()}}};
   return{html:`<div class="card c">${head}${pq?`<p class="mktip ga" ${dl(2)}>💡 ${esc(GC('msk',pq))}</p>`:''}<textarea data-d="gmw${g.k}" rows="3" maxlength="140" placeholder="${esc(GT('mph'))}"></textarea>
    <div class="gbtns2"><button class="ghost" id="gskip">${GT('mskip')}</button><button class="pri" id="gsend">${GT('send')}</button></div></div>`,
    bind(){const t=$(`[data-d="gmw${g.k}"]`);$('#gsend').onclick=()=>{R.ed=null;gs({w:tidy(t.value)})};$('#gskip').onclick=()=>{R.ed=null;gs({w:''})}}}}
  const msgs=(me.pm||[]).map((x,i)=>`<div class="mkbub ga" ${dl(i+2)}><span class="mkfrom">${MKE[me.pt[i]]}</span>${x?esc(x):`<i class="mut">${GT('mnone')}</i>`}</div>`).join('');
  if(g.st=='c')return{html:`<div class="card c">${head}<p class="gq2">${GT('mread')}</p>${msgs}
   ${me.pt.length>1?me.pt.map((t,j)=>`<div class="mkrow ga" ${dl(j+3)}><span class="mkto">${R.mn(t)}${sh((me.ptr||[])[j])}</span><div class="gpk mkch sm">${['P','G'].map(v=>`<button class="gdec ${(me.ch||[])[j]==v?'sel':''}" data-gm="${v}" data-to="${t}">${GT('k'+v)}</button>`).join('')}</div></div>`).join(''):`<div class="gpk mkch">${['P','G'].map((v,i)=>`<button class="ga gdec ${(me.ch||[])[0]==v?'sel':''}" ${dl(i,.3)} data-gm="${v}">${GT('k'+v)}</button>`).join('')}</div>`}
   ${(me.ptr||[]).some(Boolean)?`<p class="mut mkshd">🦈 ${GT('mshD')}</p>`:''}</div>`,
   bind(){$$('[data-gm]').forEach(x=>x.onclick=()=>gs(x.dataset.to!=null?{v:x.dataset.gm,to:+x.dataset.to}:{v:x.dataset.gm}))}};
  if(g.st=='r'){const sea=(g.pub[g.r]||[]).map((gr,i)=>`<div class="mksea ga" ${dl(i,.4)}>${gr.map(([k,c,v])=>`<span class="mkc ${c=='P'?'p':'g'} ${k===me.m?'me':''}">${MKE[k]} ${c=='P'?'🤝🏻':'🔒'} <b dir="ltr">${gPs(v)}</b></span>`).join('')}</div>`).join('');
   if(sp)return{html:`<div class="card c"><h3 class="gh3">🌊 ${GT('msea')}</h3>${sea}</div>`};
   const rep=me.hab;
   return{html:`<div class="card c">${head}<div class="mkres">${(me.pc||[]).map((c,i)=>`<p class="ga" ${dl(i+1)}>${MKE[me.pt[i]]} ${GT(c=='P'?'mshared':'mkept')}${me.pt.length>1?` <span class="mut">· ${esc(GT('me'))} ${me.ch[i]=='P'?'🤝🏻':'🔒'}</span>`:''}</p>`).join('')}
    <p class="gbig2 ga ${me.gain>=4?'ok':''}" ${dl(3)}>${gP(me.gain)}</p>${me.nb?`<p class="mknet ga" ${dl(4)}>🕸️ ${GT('mnet',{v:me.nb})}</p>`:''}${rep?`<p class="mut ga" ${dl(4)}>🔁 ${GT('mrep')}</p>`:''}${me.tm?`<p class="mut ga" ${dl(4)}>🔗 ${GT('mtieM')}</p>`:''}${me.mtr?`<p class="mut ga" ${dl(5)}>${sh(me.mtr)} ${GT('myshk',{v:me.mtr})}</p>`:''}<p class="gcof">🔒 ${GT('mtot',{v:g.sc[m]??0})}</p></div>
    <h3 class="gh3">🌊 ${GT('msea')}</h3>${sea}</div>`,bind(){if(me.gain>=4&&!RM())sparkles($('.mkres .gbig2'),me.nb?14:8)}}}
  const fin=g.fin||[],isF=fin.includes(m),names=fin.map((p,i)=>NM(p)+((g.ftr||[])[i]?' 🦈'+(g.ftr[i]>1?'×'+g.ftr[i]:''):'')).join(' & ');
  if(g.st=='f'){const top=`<div class="mkfin ga"><span class="gbig">🎭</span><b>${GT('mfinT')}</b><p>${GT('mfinD',{n:names,v:g.pot})}</p><p class="mut">${GT('mfinC')}</p></div>`;
   if(sp)return{html:`<div class="card c">${top}</div>`};
   if(isF)return{html:`<div class="card c">${top}<div class="gpk mkch">${['P','V'].map((v,i)=>`<button class="ga gdec ${g.fc[m]==v?'sel':''}" ${dl(i,.3)} data-gf="${v}">${GT('k'+v)}</button>`).join('')}</div><p class="gcof">🔒 ${GT('mtot',{v:g.sc[m]??0})}</p></div>`,
    bind(){$$('[data-gf]').forEach(x=>x.onclick=()=>gs({v:x.dataset.gf}))}};
   return{html:`<div class="card c">${top}<p class="gq2">${GT('mbet')}</p><div class="gab">${[0,1,2].map(i=>`<button class="gopt ga ${g.bet[m]===i?'sel':''}" ${dl(i,.3)} data-gb="${i}">${GT('mb'+i)}</button>`).join('')}</div></div>`,
    bind(){$$('[data-gb]').forEach(x=>x.onclick=()=>gs({b:+x.dataset.gb}))}}}
  const fr=g.fr||{c:{},add:{}};
  return{html:`<div class="card c"><div class="mkfin"><b>${GT('mfinT')}</b></div><div class="gduo mkduo">${fin.map((p,i)=>`<div class="ga" ${dl(i*2,.1)}>${DT(p)}<b>${esc(p)}</b><br><span class="gtag ${fr.c[p]=='P'?'':'no'}">${GT('k'+fr.c[p])}</span><br><b class="mkadd ${(fr.add[p]||0)<0?'neg':''}">${(fr.add[p]||0)<0?GT('mLose',{v:GTn('pts',-fr.add[p])}):fr.add[p]?GT('mGain',{v:GTn('pts',fr.add[p])}):gP(0)}</b></div>`).join('')}</div>
   <p class="gbig2 ga ok" ${dl(4)}>${GT('mb'+fr.out)}</p>${isF||sp?'':`<p class="gnote ga" ${dl(5)}>${g.bet[m]===fr.out?GT('mbetok'):'—'}</p>`}</div>`,
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
 log(s){const g=s.game,f=g.fr;if(!f||!g.fin)return[];const[a,b]=g.fin;if(f.out==0)return[{k:'mskP',n:[a,b]}];if(f.out==2)return[{k:'mskB',n:[a,b]}];const t=f.c[a]=='V'?a:b;return[{k:'mskS',n:[t,t==a?b:a]}]},/* 📜 */
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🧭 LA CHAÎNE DES PHARES — fiche (rôles cachés, 4-8 joueurs, sans élimination ni nuit)
   Rôles secrets : 1 Naufrageur (4-5 joueurs) ou 2 (6-8, ils se connaissent) ; les autres sont gardiens de phare.
   Vague : un capitaine (tour à tour, départ tiré au sort) reçoit le bon chenal parmi 4 (🐚⭐🌙🐋). Il le transmet EN
     PRIVÉ à qui il veut, qui le relaie à son tour (2 relais à 4, 6 et 7 joueurs, 3 à 5 et 8) ; le dernier guide le navire.
     Chaque relais choisit le chenal qu'il transmet : un Naufrageur peut le changer… ou pas, pour rester crédible.
     35 s par relais (sans choix : il transmet ce qu'il a reçu, à quelqu'un au hasard).
   Public : la route (qui a relayé, dans quel ordre), le bon chenal et celui pris par le navire (arrivé ou coulé).
     Privé : ce que chacun a reçu/transmis. On débat dans le chat (affirmations invérifiables).
   ⛓️ Entre deux vagues, vote (45 s) : la majorité absolue des joueurs en ligne met un suspect aux fers (ou l'en libère
     en votant « personne ») ; il joue toujours, mais ce qu'il reçoit et transmet devient public.
   Fin : 6 vagues (4-5 joueurs), 8 (6), 7 (7-8), ou dès que l'issue est jouée. Les Naufrageurs gagnent à 2 navires coulés
     (4-5 joueurs), 4 (6), 3 (7-8) — le compteur 💥 l'affiche.
     Puis accusation secrète (60 s, autant de noms que de Naufrageurs). Points : équipage gagnant +4 chacun,
     Naufrageurs gagnants +6 chacun, et chaque gardien +2 par Naufrageur bien accusé.
   SIM (.sim/chn.js, hors site, 1500 parties/cas ; gardiens « prudents » = inférence bayésienne sur leurs propres relais et
     ceux du joueur aux fers, évitent les suspects, votent et accusent les plus probables ; « hasard » ; Naufrageurs agressif /
     malin (ne brouille pas après un complice, se calme s'il est trop suspect) / timide (1 fois sur 2)) : sièges ±6 % (bruit).
     Victoire des Naufrageurs n=4→8, contre gardiens prudents : malin 37/46/36/40/48 %, agressif 37/48/40/41/36 %,
     timide 29/38/15/23/31 % ; moitié prudents moitié hasard : 74/68/60/61/79 % ; tout hasard : 83–94 %.
     Gardiens prudents : 63–94 % d'accusations justes. Rejetés : 3 coulés à 4-5 joueurs (0–10 %), à 6 joueurs 3 coulés
     (malin 56 %, agressif 74 %) ou 4 coulés en 7 vagues (agressif 21 %), 3 relais à 6-7 (82 % / 66 %).
   ===================================================================== */
const CHI=['🐚','⭐','🌙','🐋'];
GAMES.chn={icon:'🧭',min:4,max:8,dur:20,tags:['social'],CHI,NF:n=>n<=5?1:2,RL:n=>n==5||n==8?3:2,WV:n=>n<=5?6:n==6?8:7,TH:n=>n<=5?2:n==6?4:3,CW:4,NW:6,AC:2,
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
 hlog(g,m){const R=this,mine={};((g.pv||{})[m]||[]).forEach(([w,a,b])=>mine[w]=[a,b]);
  return g.h.length?`<details class="chlog"><summary>📜 ${GT('chLog')} (${g.h.length})</summary>${g.h.map((w,i)=>`<div class="chlr"><b>${w.ok?'⛵':'💥'} ${i+1}</b> ${w.route.map((p,j)=>esc(p)+(mine[i]&&p==m?` ${R.ch(mine[i][0])}›${R.ch(mine[i][1])}`:w.ir==p&&w.ip?` ⛓️${R.ch(w.ip[0])}›${R.ch(w.ip[1],w.ip[0]!=w.ip[1]?'x':'')}`:'')).join(' <i class="charr">➜</i> ')}</div>`).join('')}</details>`:''},
 view(s){const g=s.game,m=meN(),R=GAMES.chn,N=!!(g.nf&&g.nf.includes(m));
  const hd=`<div class="chhd">${s.order.includes(m)?`<span class="chrole ga ${N?'n':''}">${N?'🏴‍☠️ '+GT('chN'):'🗼 '+GT('chC')}${N&&g.nf.length>1?' · '+g.nf.filter(p=>p!=m).map(B).join(', '):''}</span>`:''}
   <span class="chsk ga" ${dl(1)} title="${esc(GT('chSkT',{v:g.th}))}">💥 ${GT('chSkL',{v:g.sk,n:g.th})} · ⛵ ${GTn('chOkN',g.ok)}</span>${g.irn?`<span class="chir ga" ${dl(2)}>⛓️ ${B(g.irn)}</span>`:''}</div>`;
  const kn=(rc,ps)=>p=>p in rc||p in ps?[rc[p],ps[p]]:null;
  if(g.st=='p'){const me=m==g.hold,cap=g.route[0]==m;
   if(!me)return{html:`<div class="card c">${hd}${R.chain(g.route,g.hold,kn(g.rc,g.ps))}<p class="gnote ga" ${dl(2)}>${GT(g.route.length==1?'chWaitC':'chWait',{n:B(g.hold)})}</p>${g.lv&&g.route.length==1?R.lvote(g):''}${R.hlog(g,m)}</div>`};
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
    <button class="ghost wide chno ${v===''?'sel':''}" data-chv="">${GT(g.irn?'chFree':'chNone')}</button>${R.hlog(g,m)}</div>`,
    bind(){$$('[data-chv]').forEach(b=>b.onclick=()=>gs({v:b.dataset.chv}));if(!w.ok&&!RM())try{$('.chres').classList.add('shk')}catch(e){}}}}
  const K='ca'+g.k;if(R.ak!==K){R.ak=K;R.ac=[...(g.acc[m]||[])]}
  const sent=g.acc[m]!=null&&g.done[m];
  return{html:`<div class="card c">${body}<p class="gq2">🕵🏻 ${GT('chAcc',{v:g.K})}</p><p class="gsub">${GT(N?'chAccN':'chAccD')}</p>
   <div class="gpk">${s.order.filter(p=>p!=m).map((p,i)=>`<button class="ga ${R.ac.includes(p)?'sel':''}" ${dl(i)} data-cha="${esc(p)}" aria-pressed="${R.ac.includes(p)}">${DT(p)}<span>${esc(p)}</span></button>`).join('')}</div>
   <button class="pri wide" id="gsend">${GT(sent?'chAccOk':'send')}</button>${R.hlog(g,m)}</div>`,
   bind(){$$('[data-cha]').forEach(b=>b.onclick=()=>{const p=b.dataset.cha;R.ac=R.ac.includes(p)?R.ac.filter(x=>x!=p):[...R.ac,p].slice(-g.K);render()});
    $('#gsend').onclick=()=>gs({v:R.ac})}}},
 lvote(g){const e=Object.entries(g.lv.c||{}).sort((a,b)=>b[1]-a[1]);if(!e.length)return '';
  return `<p class="mut chlv ga" ${dl(3)}>🗳️ ${e.map(([p,v])=>`${p?B(p):esc(GT('chNoneS'))} ×${v}`).join(' · ')}</p>`},
 endView(s){const g=s.game,R=this,nw=g.win=='n';
  return `<div class="chend"><p class="gbig2 ga ok">${GT(nw?'chWinN':'chWinC',{v:g.sk})}</p><p class="ga" ${dl(1)}>🏴‍☠️ ${GT('chWere')} ${g.nf.map(B).join(', ')}</p>
   ${s.order.filter(p=>!g.nf.includes(p)).map((p,i)=>`<p class="mut ga" ${dl(i+2)}>${B(p)} 🕵🏻 ${(g.acc[p]||[]).length?(g.acc[p]).map(x=>esc(x)+(g.nf.includes(x)?' ✅':' ❌')).join(', '):'—'}</p>`).join('')}
   <h3 class="gh3">📜 ${GT('chLog')}</h3>${g.h.map((w,i)=>`<div class="chlr ga" ${dl(i,.4)}><b>${w.ok?'⛵':'💥'} ${i+1}</b> ${R.ch(w.tr)} : ${w.route.map((p,j)=>{const a=w.all&&w.all[j]||[];return `${esc(p)} ${R.ch(a[1],a[0]!=a[1]?'x':'')}`}).join(' <i class="charr">➜</i> ')}</div>`).join('')}</div>`},
 log(s){const g=s.game;if(!g.win||!g.nf)return[];if(g.win=='n')return[{k:g.nf.length>1?'chnW2':'chnW',n:g.nf.slice(0,2)}];/* 📜 */
  const gd=s.order.filter(p=>!g.nf.includes(p)),A=g.acc||{},c=p=>gd.filter(x=>(A[x]||[]).includes(p)).length;return gd.length?g.nf.filter(p=>c(p)*2>=gd.length).map(p=>({k:'chnC',n:[p]})):[]},
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   🐙 LE MIMÉTIQUE — fiche (rôles cachés EN TEMPS RÉEL, 4-8 joueurs, sans élimination)
   Grotte sous-marine 1000×640 dans le noir. On nage en touchant / cliquant un point (glisser pour diriger) : même geste
     au doigt et à la souris. Lampe : on ne voit les autres et les perles que dans son halo (rayon 115) ; l'hôte n'envoie
     à chacun QUE ce qui est dans son halo (positions, perles, nuages d'encre), jamais les rôles.
   Rôles secrets : 1 Mimétique (2 dès 7 joueurs, ils se connaissent), les autres = équipage.
   Perles : P0=2 par couleur au départ, puis 1 par couleur toutes les SI=20 s de plongée ; chaque couleur parcourt les 6 zones
     (épave, arche, coraux, kelp, cheminée, méduses) dans un ordre tiré au sort → même nombre, mêmes zones pour tous.
     On ramasse en passant dessus, seulement les siennes. Le rythme vient des apparitions, pas de la vitesse de nage.
   🎭 Le Mimétique prend l'apparence d'un·e autre MD=12 s (recharge CD=18 s, fin anticipée possible ; un nuage d'encre
     trahit chaque transformation pour qui la voit). Déguisé en Léa, il ramasse les perles de Léa = VOL (retirée, compte 0,
     compteur public 🐙 vols x/S). Ses propres perles, il peut faire semblant de les ramasser : annoncées, comptées 0.
   Fil public : « Léa · près de l'épave · 3:12 » (marqué « volée » si c'était un vol) : on sait QU'il y a eu vol, pas QUI.
   📯 Débat : 1 par joueur, 2 au total à 4-5 joueurs, 3 dès 6, jamais dans les 20 premières secondes d'une plongée.
     Chrono figé, le filet est compté (vraies perles / annoncées), chat + vote secret modifiable (90 s) ; la personne qui a
     plus de voix que toute autre option (« personne » compris) et au moins 2 révèle son rôle : Mimétique → ses pouvoirs
     s'éteignent ; équipage → −30 s de plongée. Puis tout le monde repart de la cloche (cercle, places tirées au hasard).
   Fin : objectif Q = QF × perles de l'équipage, ou tous les Mimétiques démasqués → équipage +4 ;
     S vols (3, 4 dès 7 joueurs) ou chrono à 0 → Mimétiques +6 ; +1 à chaque équipier qui a voté pour un Mimétique démasqué.
   Réseau : intentions {t:'grt',x,y | m} → hôte (simulation à pas ≤ 67 ms sur l'horloge murale : un onglet en veille rattrape
     au retour ; minuteur dans un Worker pour ne pas ralentir les autres) → instantanés filtrés par joueur ~10 Hz {t:'grt'}.
     L'état complet (bump) seulement aux changements d'étape. Clients : tampon d'interpolation 140 ms, prédiction de son
     propre plongeur, canvas + requestAnimationFrame (arrêté si l'onglet est caché).
   SIM (.sim/mim.js, hors site, 500 parties/taille, vraie logique tick/snap/act/next ; IA équipage « compétente » : partage
     les perles vues, alibis par observations, témoins d'encre, vote si preuve nette ; Mimétique : vole les perles connues
     d'un·e équipier·e vu·e loin, se transforme hors de vue, accuse le plus suspect) :
     victoire Mimétiques n=4→8 : 41 / 51 / 40 / 46 / 49 % ; victoires par siège n=8 : 48–53 % (n=4 : 51–59, bruit ±4).
     Témoins : équipage qui ne débat jamais → Mimétiques 82 / 75 / 84 % (n=4/6/8) ; Mimétique qui ne vole jamais → 17 / 2 / 0 %.
     Rejetés : 6 perles fixes (l'équipage finit en 18 s), sans compteur de vols (voler ne servait à rien : l'équipage sans
     débat gagnait 99 % à 6), QF unique (8 joueurs : .72 → 19 %, .78 → 67 %).
   ===================================================================== */
const MIW=1000,MIH=640,MIL=115,MISP=120,MIPK=17,MIDR=13,MIC=[500,320];
const MIZ=[[185,160],[500,110],[815,160],[185,480],[500,530],[815,480]],MIZE=['⚓','🪨','🪸','🌿','🫧','🪼','🔔'];
const MIRK=[[330,235,40],[670,235,40],[330,405,40],[670,405,40],[88,320,34],[912,320,34],[500,212,24],[500,428,24],[300,66,26],[700,66,26],[300,574,26],[700,574,26]];
const miZone=(x,y)=>{if(Math.hypot(x-MIC[0],y-MIC[1])<100)return 6;let b=0,bd=1e9;MIZ.forEach(([a,c],i)=>{const d=(x-a)**2+(y-c)**2;if(d<bd){bd=d;b=i}});return b};
const miFree=(x,y,pad)=>x>40&&x<MIW-40&&y>40&&y<MIH-40&&MIRK.every(([a,b,r])=>Math.hypot(x-a,y-b)>=r+pad);
const miCl=(v,a,b)=>Math.max(a,Math.min(b,v));
/* un pas de nage : droit vers la cible ; contre un rocher on glisse le long, du côté de la cible */
function miMove(d,h){const dx=d.tx-d.x,dy=d.ty-d.y,L=Math.hypot(dx,dy);if(L<.5)return;const sp=Math.min(L,MISP*h);let vx=dx/L*sp,vy=dy/L*sp;
 for(const [a,b,r] of MIRK){const ex=d.x+vx-a,ey=d.y+vy-b,e=Math.hypot(ex,ey);if(e>=r+MIDR||e<.01)continue;
  const nx=ex/e,ny=ey/e,dot=vx*nx+vy*ny;if(dot<0){vx-=nx*dot;vy-=ny*dot;if(Math.hypot(vx,vy)<sp*.35){const s=nx*dy-ny*dx<0?-1:1;vx=-ny*s*sp*.8;vy=nx*s*sp*.8}}}
 d.x+=vx;d.y+=vy;
 for(const [a,b,r] of MIRK){const ex=d.x-a,ey=d.y-b,e=Math.hypot(ex,ey),m=r+MIDR;if(e<m&&e>.01){d.x=a+ex/e*m;d.y=b+ey/e*m}}
 d.x=miCl(d.x,26,MIW-26);d.y=miCl(d.y,26,MIH-26)}
const miClock=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
GAMES.mim={icon:'🐙',min:4,max:8,dur:10,tags:['social','skill'],
 NM:n=>n>=7?2:1,ND:n=>n<=5?2:3,T:n=>200+10*n,P0:2,SI:20,S:n=>n<7?3:4,QF:n=>n==4?.91:n==5?.96:n<7?.9:n<8?.74:.72,MD:12,CD:18,CD0:12,DA:20,PEN:30,DT:90,RV:14,CW:4,MW:6,
 init(s){const g=s.game,o=s.order,n=o.length;g.N=[...o];g.M=shuf(o).slice(0,this.NM(n));g.out=[];g.C=n-g.M.length;
  g.D=this.ND(n);g.S=this.S(n);g.th=0;g.cl={};g.got=0;g.net=0;g.ann={};g.feed=[];g.fi=0;g.f0=0;g.fx=[];g.xi=0;g.hist=[];g.ss={};
  o.forEach(p=>g.ss[p]={c:0,v:0,f:0});g.left0=this.T(n)*1000;g.pl=[];g.pi=0;g.el=0;g.nsp=this.SI*1000;
  g.Q=Math.round(this.QF(n)*g.C*(this.P0+Math.floor(this.T(n)/this.SI)));
  /* perles : P0 au départ puis une par couleur toutes les SI s de plongée ; chaque couleur parcourt les 6 zones
     dans un ordre tiré au sort — même nombre, mêmes zones pour tout le monde */
  g.zp=g.N.map(()=>shuf([0,1,2,3,4,5]));g.zc=g.N.map(()=>0);for(let j=0;j<this.P0;j++)g.N.forEach((p,oi)=>this.spawn(g,oi));
  g.k=1;/* la 1re plongée ouvre à k=2 : les règles sont au salon, la grotte garde toute la place */
  this.resume(s,Date.now());if(typeof window!='undefined')miTicker()},
 /* départ de la cloche : cercle régulier, rotation et places tirées au hasard (aucun siège avantagé) */
 resume(s,now){const g=s.game,o=shuf(s.order),a0=Math.random()*Math.PI*2;g.dv=g.dv||{};
  o.forEach((p,i)=>{const a=a0+2*Math.PI*i/o.length,x=Math.round(MIC[0]+62*Math.cos(a)),y=Math.round(MIC[1]+62*Math.sin(a));g.dv[p]={x,y,tx:x,ty:y,mk:null,me:0,cd:now+this.CD0*1000}});
  g.st='p';g.k++;g.done={};g.need=null;g.dl=0;g.rv=0;g.sec=0;g.pt0=now;g.lt=now;g.da=now+this.DA*1000;g.f0=g.fi;g.caller=null},
 left(g,now){return g.st=='p'?g.left0-(now-g.pt0):g.left0},
 active(s){const g=s.game;return g.M.filter(p=>s.order.includes(p)&&!g.out.includes(p))},
 /* hôte : avance la plongée jusqu'à now (sous-pas ≤ 67 ms, masques expirés au bon moment) ; true si la partie est finie */
 tick(s,now){const g=s.game;if(g.st!='p'||g.over)return false;if(!g.dv||!g.pl){g.win=null;g.over=1;return true}
  let dt=Math.min(120,Math.max(0,(now-(g.lt||now))/1000)),t=now-dt*1000;g.lt=now;const on=new Set(gOn(s));
  while(dt>1e-4){const h=Math.min(.067,dt);dt-=h;t+=h*1000;g.el+=h*1000;while(g.el>=g.nsp){g.nsp+=this.SI*1000;g.N.forEach((p,oi)=>s.order.includes(p)&&this.spawn(g,oi,g.dv))}
   for(const n of s.order){const d=g.dv[n];if(!d)continue;if(d.mk&&t>=d.me)this.unmask(g,d,t);if(!on.has(n)){d.tx=d.x;d.ty=d.y;continue}miMove(d,h);this.pick(s,n,d,now)}}
  if(g.fx.length)g.fx=g.fx.filter(f=>now-f.t<1600);
  if(g.got>=g.Q||!this.active(s).length){g.win='c';this.score(s);g.over=1;return true}
  if(g.th>=g.S||this.left(g,now)<=0){if(this.left(g,now)<=0){g.left0=0;g.pt0=now}g.win='m';this.score(s);g.over=1;return true}
  return false},
 pick(s,n,d,now){const g=s.game,ap=d.mk||n,oi=g.N.indexOf(ap),im=g.M.includes(n);
  for(let i=g.pl.length-1;i>=0;i--){const p=g.pl[i];if(p.o!==oi||(p.x-d.x)**2+(p.y-d.y)**2>MIPK*MIPK)continue;
   g.pl.splice(i,1);const k=d.mk?'v':im?'f':'c';g.ann[ap]=(g.ann[ap]||0)+1;g.ss[n][k]++;if(k=='c')g.got++;else if(k=='v')g.th++;
   g.feed.push({i:++g.fi,o:oi,z:miZone(p.x,p.y),l:Math.ceil(this.left(g,now)/1000),...(k=='v'?{s:1}:{})});if(g.feed.length>80)g.feed.shift()}},
 spawn(g,oi,dv){const z=g.zp[oi][g.zc[oi]++%6],[cx,cy]=MIZ[z];let x=cx,y=cy;
  for(let t=0;t<300;t++){x=cx+(Math.random()*2-1)*150;y=cy+(Math.random()*2-1)*115;
   if(miFree(x,y,14)&&miZone(x,y)==z&&g.pl.every(q=>(q.x-x)**2+(q.y-y)**2>=34*34)&&(!dv||t>200||Object.values(dv).every(d=>(d.x-x)**2+(d.y-y)**2>70*70)))break}
  g.pl.push({i:g.pi++,o:oi,x:Math.round(x),y:Math.round(y)})},
 unmask(g,d,t){d.mk=null;d.cd=t+this.CD*1000;g.fx.push({i:++g.xi,x:d.x,y:d.y,t})},
 /* hôte : intention reçue hors état (cible de nage, masque) — pas de bump */
 input(s,from,d,now){const g=s.game,v=g.dv&&g.dv[from];if(!v||g.st!='p')return;
  if(typeof d.x=='number'&&typeof d.y=='number'&&isFinite(d.x)&&isFinite(d.y)){v.tx=miCl(d.x,26,MIW-26);v.ty=miCl(d.y,26,MIH-26);return}
  if(typeof d.m!='number'||!g.M.includes(from)||g.out.includes(from))return;
  if(d.m<0){if(v.mk)this.unmask(g,v,now);return}
  const t=g.N[d.m];if(v.mk||now<(v.cd||0)||!t||t==from||!s.order.includes(t)||g.out.includes(t))return;
  v.mk=t;v.me=now+this.MD*1000;g.fx.push({i:++g.xi,x:v.x,y:v.y,t:now})},
 /* instantané pour UN joueur : seulement ce qui est dans son halo ; apparence (jamais l'identité réelle) */
 snap(s,n,now){const g=s.game,me=g.dv&&g.dv[n];
  if(!me&&g.st=='p'&&!s.order.includes(n)){let a=0;for(const k in g.ann)a+=g.ann[k];/* 👀 spectateur : rien de ce qui se voit dans la grotte */
   return{t:'grt',k:g.k,h:now,me:null,sp:1,d:[],p:[],x:[],l:Math.max(0,Math.ceil(this.left(g,now)/100)),a,v:g.th,dc:Math.max(0,Math.ceil((g.da-now)/1000)),f:g.feed.slice(-4)}}
  if(!me||g.st!='p')return null;const R2=(MIL+14)**2,N=g.N,im=g.M.includes(n),r=Math.round,ix=x=>N.indexOf(x),near=(x,y)=>(x-me.x)**2+(y-me.y)**2<=R2;
  const ds=[];for(const p of s.order){const d=g.dv[p];if(p==n||!d||!near(d.x,d.y))continue;const ap=d.mk||p;ds.push([ix(ap),r(d.x),r(d.y),(g.out.includes(ap)?1:0)|(im&&g.M.includes(p)?2:0)])}
  ds.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);ds.forEach((e,i)=>e.push(i&&ds[i-1][0]==e[0]?ds[i-1][4]+1:0));
  let a=0;for(const k in g.ann)a+=g.ann[k];
  return{t:'grt',k:g.k,h:now,me:[r(me.x),r(me.y),r(me.tx),r(me.ty),me.mk?ix(me.mk):-1,me.mk?Math.max(0,Math.ceil((me.me-now)/100)):0,Math.max(0,Math.ceil(((me.cd||0)-now)/100)),im?g.ss[n].v:g.ss[n].c],
   d:ds,p:g.pl.filter(p=>near(p.x,p.y)).map(p=>[p.i,p.x,p.y,p.o]),x:g.fx.filter(f=>near(f.x,f.y)).map(f=>[f.i,r(f.x),r(f.y)]),
   l:Math.max(0,Math.ceil(this.left(g,now)/100)),a,v:g.th,dc:Math.max(0,Math.ceil((g.da-now)/1000)),f:g.feed.slice(-4)}},
 act(s,from,a){const g=s.game,now=Date.now();
  if(a.a=='call'){if(g.st!='p'||g.cl[from]||g.D<=0||now<g.da)return;if(this.tick(s,now)){gFin(s);return true}
   g.cl[from]=1;g.D--;g.caller=from;g.left0=Math.max(0,this.left(g,now));g.net=g.got;
   for(const p in g.dv){const d=g.dv[p];if(d.mk){d.mk=null;d.cd=now}}g.vt={};gWait(g,this.DT,'d');return true}
  if(g.st=='d'&&(a.v===''||(typeof a.v=='string'&&s.order.includes(a.v)&&a.v!=from&&!g.out.includes(a.v)))){g.vt[from]=a.v;g.done[from]=1;return true}},
 next(s){const g=s.game;
  if(g.st=='d'){const c={};for(const p in g.vt)if(s.order.includes(p))c[g.vt[p]]=(c[g.vt[p]]||0)+1;
   const e=Object.entries(c).sort((a,b)=>b[1]-a[1]);let who=null;if(e.length&&e[0][0]!==''&&e[0][1]>=2&&(!e[1]||e[1][1]<e[0][1]))who=e[0][0];
   const mim=!!who&&g.M.includes(who);if(mim&&!g.out.includes(who))g.out.push(who);else if(who)g.left0=Math.max(0,g.left0-this.PEN*1000);
   g.res={who,mim,c};g.hist.push({by:g.caller,who,mim,vt:{...g.vt}});
   if(!this.active(s).length)g.win='c';else if(g.left0<=0)g.win='m';gWait(g,this.RV,'r',1);return}
  if(g.st=='r'){if(g.win){this.score(s);g.over=1;return}this.resume(s,Date.now())}},
 score(s){const g=s.game,cw=g.win=='c';if(g.scored)return;g.scored=1;
  s.order.forEach(p=>{const im=g.M.includes(p);let v=im?(cw?0:this.MW):(cw?this.CW:0);if(!im)g.hist.forEach(h=>{if(h.mim&&h.vt[p]===h.who)v++});g.sc[p]+=v})},
 hide(g,n){const o={...g},im=g.M.includes(n);o.M=im?g.M:null;delete o.dv;delete o.pl;delete o.got;delete o.fx;delete o.win;o.fin=g.win?1:0;
  o.ss={[n]:g.ss[n]};o.hist=g.hist.map(h=>({...h,vt:null}));if(g.vt)o.vt=hideOwn(g.vt,n);return o},
 view(s){const g=s.game,m=meN(),R=this,N=g.N,im=!!(g.M&&g.M.includes(m)),out=g.out.includes(m),play=s.order.includes(m);
  const L=MI.gid==s.gid&&MI.last&&MI.last.k==g.k?MI.last:null,an=L?L.a:Object.values(g.ann).reduce((a,b)=>a+b,0);
  const role=!play?'':`<span class="chrole ga ${im?'n':''}">${im?'🐙 '+GT(out?'miOut':'miMim')+(g.M.length>1?' · '+g.M.filter(p=>p!=m).map(B).join(', '):''):'🤿 '+GT('miCrew')}</span>`;
  const hd=`<div class="mihd">${role}<span class="michip ga" ${dl(1)} id="mitl">⏱ ${miClock(L?L.l/10:g.left0/1000)}</span><span class="michip ga" ${dl(2)} id="mian" data-tip="${esc(GT('miGoalT'))}">🦪 <b>${an}</b>/${g.Q}${g.k>2?` · ✓${g.net}`:''}</span><span class="michip ga mith" ${dl(3)} id="mith">🐙 <b>${L?L.v:g.th}</b>/${g.S} ${GT('miThefts')}</span>${g.out.length?`<span class="michip ga" ${dl(3)}>🐙 ${g.out.map(B).join(', ')}</span>`:''}</div>`;
  const fl=(e,i)=>`<li class="ga${e.s?' st':''}" ${dl(i||0)}>${miFeedLi(N,e)}</li>`;
  if(g.st=='p'){const tg=s.order.filter(p=>p!=m&&!g.out.includes(p)),canCall=play&&!g.cl[m]&&g.D>0;
   const fd=(MI.gid==s.gid?MI.feed:g.feed).filter(e=>e.i>g.f0).slice(-3).reverse();
   return{hint:GT(im&&!out?'miHintM':'miHint'),mine:false,html:`<div class="card c mim">${hd}${play?`<div class="micv" id="micv"></div>`:''}
    <div class="mibar">${im&&!out?`<button class="ghost mimk" id="mimk">🎭 ${GT('miMask')}</button>`:''}${play?`<span class="michip" id="mimine">${im?'🎭':'🦪'} <b>${L&&L.me?L.me[7]:(g.ss[m]||{})[im?'v':'c']||0}</b> ${GT(im?'miStolen':'miMine')}</span>`:''}
     ${play?`<button class="ghost micall" id="micall" ${canCall&&!(L&&L.dc>0)?'':'disabled'}>📯 ${GT('miCall')} · ${g.D}</button>`:''}</div>
    ${im&&!out?`<div class="mipk" id="mipk" ${MI.pick?'':'hidden'}><p class="gsub">${GT('miMaskQ')}</p><div class="gpk">${tg.map(p=>`<button data-mim="${N.indexOf(p)}">${DT(p)}<span>${esc(p)}</span></button>`).join('')}</div></div>`:''}
    <ul class="mifd" id="mifd" aria-live="polite">${fd.map(e=>fl(e)).join('')}</ul></div>`,
    bind(){miMount();const k=$('#mimk');k&&(k.onclick=()=>{const l=MI.last;if(l&&l.me&&l.me[4]>=0){miSend({m:-1});return}MI.pick=!MI.pick;const pk=$('#mipk');pk&&(pk.hidden=!MI.pick)});
     $$('[data-mim]').forEach(b=>b.onclick=()=>{miSend({m:+b.dataset.mim});MI.pick=false;const pk=$('#mipk');pk&&(pk.hidden=true)});
     const c=$('#micall');c&&(c.onclick=()=>ask(GT('miCallAsk',{v:g.D}),GT('miCall')).then(v=>v&&gs({a:'call'})));if(L)miHud(L)}}}
  const since=g.feed.filter(e=>e.i>g.f0).reverse();
  const log=since.length?`<details class="chlog mild" ${g.st=='d'?'open':''}><summary>📜 ${GT('miLog')} (${since.length})</summary><ul class="mifd">${since.map((e,i)=>fl(e,Math.min(i,6))).join('')}</ul></details>`:'';
  if(g.st=='d'){const v=g.vt[m],cand=s.order.filter(p=>p!=m&&!g.out.includes(p)),nv=gNeed(s).filter(p=>g.done[p]).length;
   return{html:`<div class="card c mim">${hd}<p class="gbig2 ga ok">📯 ${GT('miDeb',{n:B(g.caller)})}</p>
    <p class="minet ga" ${dl(1)}>${GT('miNet',{a:`<b>${g.net}</b>`,b:`<b>${an}</b>`})}</p><p class="gsub ga" ${dl(2)}>${GT('miNetD')}</p>${log}
    <p class="gq2">${GT('miVote')}</p><p class="gsub">${GT('miVoteD',{v:R.PEN})}</p>${play?pick(cand,v,'data-miv',m)+`<button class="ghost wide chno ${v===''?'sel':''}" data-miv="">${GT('miNone')}</button>`:''}
    <p class="mut mivn">🗳️ ${nv}/${gNeed(s).length}</p></div>`,bind(){$$('[data-miv]').forEach(b=>b.onclick=()=>gs({v:b.dataset.miv}))}}}
  const r=g.res||{},tl=Object.entries(r.c||{}).sort((a,b)=>b[1]-a[1]).map(([p,v],i)=>`<span class="gchip ga" ${dl(i,.9)}>${p?DT(p)+esc(p):esc(GT('miNone'))} <b>×${v}</b></span>`).join('');
  return{html:`<div class="card c mim">${hd}${r.who?`<div class="mirev ${r.mim?'m':'c'}" aria-hidden="true"><span class="mirav" style="--c:${col(r.who)}">${esc(([...r.who][0]||'').toUpperCase())}</span><span class="miric">${r.mim?'🐙':'🤿'}</span></div>
   <p class="gbig2 ga ok" ${dl(2,.6)}>${GT(r.mim?'miRevM':'miRevC',{n:B(r.who),v:R.PEN})}</p>`:`<p class="gbig2 ga">${GT('miRev0')}</p>`}<div class="arcsc mitly">${tl}</div>
   ${g.fin||g.win?'':`<p class="gnote ga" ${dl(3,.8)}>🔔 ${GT('miBack')}</p>`}</div>`,
   bind(){if(r.mim&&!RM())setTimeout(()=>{try{sparkles($('.mirev'),16)}catch(e){}},700);if(r.who&&!r.mim&&!RM())try{$('.mirev').classList.add('shk')}catch(e){}}}},
 endView(s){const g=s.game,cw=g.win=='c',M=g.M||[];
  return `<div class="chend"><p class="gbig2 ga ok">${GT(cw?(g.got>=g.Q?'miWinC':'miWinC2'):g.th>=g.S?'miWinS':'miWinM',{v:g.th})}</p><p class="ga" ${dl(1)}>🐙 ${GT('miWere')} ${M.map(B).join(', ')}</p>
   ${s.order.map((p,i)=>{const x=g.ss[p]||{};return `<p class="mut ga" ${dl(i+2)}>${B(p)} · ${M.includes(p)?GT('miStM',{a:x.v||0,b:x.f||0}):GT('miStC',{a:x.c||0})}</p>`}).join('')}
   <p class="mut ga" ${dl(2)}>🦪 ${g.got}/${g.Q}</p>${g.hist.length?`<h3 class="gh3">📯 ${GT('miCall')}</h3>${g.hist.map((h,i)=>`<div class="chlr ga" ${dl(i,.4)}><b>${i+1}</b> ${B(h.by)} → ${h.who?B(h.who)+(h.mim?' 🐙 ✅':' 🤿 ❌'):esc(GT('miNone'))}</div>`).join('')}`:''}</div>`},
 log(s){const g=s.game;if(g.win=='m')return[{k:g.M.length>1?'mimW2':'mimW',n:g.M.slice(0,2)}];return g.win?(g.out||[]).map(p=>({k:'mimC',n:[p]})):[]},/* 📜 */
 fin(s){return{pts:s.game.sc}}};

/* ---------- 🐙 temps réel : côté hôte ---------- */
W.GRtIn=function(from,d){try{const s=st,g=s&&s.game;if(!isHost||!g||s.phase!='game'||g.id!='mim'||!s.order.includes(from)||(d.k!=null&&d.k!==g.k))return;GAMES.mim.input(s,from,d,Date.now())}catch(e){}};
W.GRtTick=function(){try{if(!isHost||!st||st.phase!='game'||!st.game||st.game.id!='mim'||st.game.st!='p')return;const G=GAMES.mim,now=Date.now();
 if(G.tick(st,now)){gFin(st);bump();return}
 if(now-(MI.ls||0)<95)return;MI.ls=now;
 for(const id in conns){const c=conns[id];if(c.open&&c.pname&&P(c.pname))try{const v=G.snap(st,c.pname,now);v&&c.send(v)}catch(e){}}
 const v=G.snap(st,me.name,now);v&&W.GRtRx(v)}catch(e){console.warn(e)}};
/* minuteur dans un Worker : un onglet hôte en arrière-plan continue d'envoyer ~10 instantanés/s (setInterval y serait bridé) */
let MIT=null;function miTicker(){if(MIT)return;try{const u=URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),66)'],{type:'text/javascript'}));MIT=new Worker(u);MIT.onmessage=()=>W.GRtTick()}catch(e){MIT=1}}
if(typeof setInterval!='undefined'&&typeof document!='undefined')setInterval(()=>{if(MIT&&MIT!==1)return;W.GRtTick()},66);

/* ---------- 🐙 temps réel : côté joueur (réception, interpolation, rendu canvas) ---------- */
const MI={gid:null,k:null,buf:[],off:null,last:null,feed:[],fmax:0,fx:{},cv:null,ctx:null,raf:0,ro:null,sp:null,tap:null,ts:0,tt:0,pick:false,cam:null,bg:null,bgL:null,w:0,h:0,dpr:1,ft:0};
function miSend(o){try{o.t='grt';o.k=st.game.k;if(isHost)W.GRtIn(me.name,o);else if(hostConn&&hostConn.open)hostConn.send(o)}catch(e){}}
W.GRtRx=function(d){try{if(!st||st.phase!='game'||!st.game||st.game.id!='mim'||!d||!(d.me||d.sp))return;const now=Date.now();
 if(MI.gid!==st.gid){MI.gid=st.gid;MI.feed=[];MI.fmax=0;MI.fx={};MI.pick=false;MI.off=null}
 if(d.k!==MI.k){MI.k=d.k;MI.buf=[];MI.sp=null;MI.tap=null}
 const o=now-d.h;MI.off=MI.off==null||o<MI.off?o:MI.off+(o-MI.off)*.02;
 MI.buf.push(d);if(MI.buf.length>12)MI.buf.shift();MI.last=d;
 const nf=[];(d.f||[]).forEach(e=>{if(e.i>MI.fmax){MI.fmax=e.i;MI.feed.push(e);nf.push(e)}});if(MI.feed.length>80)MI.feed.splice(0,MI.feed.length-80);
 (d.x||[]).forEach(([i,x,y])=>{if(!MI.fx[i])MI.fx[i]={x,y,t:now}});
 miHud(d,nf);if(d.me&&MI.cv&&MI.cv.isConnected&&!MI.raf&&!document.hidden)MI.raf=requestAnimationFrame(miDraw)}catch(e){}};
function miHud(d,nf){const g=st.game,m=meN(),q=s=>document.getElementById(s);if(!q('mitl'))return;
 const t=q('mitl');t&&(t.textContent='⏱ '+miClock(d.l/10),t.classList.toggle('low',d.l<300));
 const a=q('mian');if(a){const b=a.querySelector('b');b&&(b.textContent=d.a)}
 const h=q('mith');if(h){const b=h.querySelector('b');if(b&&b.textContent!=String(d.v)){b.textContent=d.v;h.classList.add('hot');RM()||h.animate&&h.animate([{transform:'scale(1.2)'},{transform:'none'}],{duration:400})}}
 const n=d.me&&q('mimine');if(n){const b=n.querySelector('b');b&&b.textContent!=String(d.me[7])&&(b.textContent=d.me[7],RM()||n.animate&&n.animate([{transform:'scale(1.15)'},{transform:'none'}],{duration:300}))}
 const k=d.me&&q('mimk');if(k){const on=d.me[4]>=0,cd=d.me[6];k.disabled=!on&&cd>0;k.classList.toggle('on',on);
  k.style.setProperty('--cd',on?d.me[5]/(GAMES.mim.MD*10):cd>0?cd/(GAMES.mim.CD*10):0);
  const lb=on?'🎭 '+GT('miAs',{n:esc(g.N[d.me[4]]||'')})+' · '+Math.ceil(d.me[5]/10)+' s':cd>0?'🎭 '+Math.ceil(cd/10)+' s':'🎭 '+GT('miMask');if(k._l!==lb){k._l=lb;k.innerHTML=lb}
  if(on&&MI.pick){MI.pick=false;const pk=q('mipk');pk&&(pk.hidden=true)}}
 const c=q('micall');if(c){const ok=!g.cl[m]&&g.D>0&&d.dc<=0&&g.st=='p';c.disabled=!ok}
 const f=q('mifd');if(f&&nf&&nf.length){nf.forEach(e=>{const li=document.createElement('li');li.className='ga'+(e.s?' st':'');li.innerHTML=miFeedLi(g.N,e);f.prepend(li)});while(f.children.length>3)f.lastChild.remove()}}
/* une ligne du fil : « 🦪 Léa · près de l'épave · 3:12 » (volée : 🐙, en rouge) */
function miFeedLi(N,e){const nm=N[e.o]||'?',zn=GT('miZ').split('|');return `<i aria-hidden="true">${e.s?'🐙':'🦪'}</i>${DT(nm)}${B(nm)}<span>${e.s?`<b class="mist">${esc(GT('miStole'))}</b> `:''}${esc(zn[e.z]||'')} · ⏱ ${miClock(e.l)}</span>`}
function miMount(){const box=document.getElementById('micv');if(!box)return;
 if(!MI.cv){const cv=MI.cv=document.createElement('canvas');cv.className='micanvas';cv.setAttribute('role','img');MI.ctx=cv.getContext('2d');
  const tap=(e,force)=>{const r=cv.getBoundingClientRect(),c=MI.cam;if(!c||!st||!st.game||st.game.st!='p')return;const px=e.clientX-r.left,py=e.clientY-r.top;let x,y;
   const mm=c.mm;if(mm&&px>=mm.x&&px<=mm.x+mm.w&&py>=mm.y&&py<=mm.y+mm.h){x=(px-mm.x)/mm.w*MIW;y=(py-mm.y)/mm.h*MIH}else{x=c.x+(px-r.width/2)/c.z;y=c.y+(py-r.height/2)/c.z}
   MI.tap={x:Math.round(miCl(x,26,MIW-26)),y:Math.round(miCl(y,26,MIH-26)),t:Date.now()};const now=Date.now();clearTimeout(MI.tt);
   if(force||now-MI.ts>=90){MI.ts=now;miSend({x:MI.tap.x,y:MI.tap.y})}else MI.tt=setTimeout(()=>{MI.ts=Date.now();MI.tap&&miSend({x:MI.tap.x,y:MI.tap.y})},90-(now-MI.ts))};
  cv.addEventListener('pointerdown',e=>{e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(x){}MI.drag=true;tap(e,true)});
  cv.addEventListener('pointermove',e=>{if(MI.drag)tap(e)});
  const up=()=>{MI.drag=false};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('contextmenu',e=>e.preventDefault())}
 MI.cv.setAttribute('aria-label',GT('n_mim'));box.appendChild(MI.cv);
 const fit=()=>{const w=box.clientWidth;if(!w)return;const vh=innerHeight||700,h=Math.round(miCl(Math.min(w*(w<500?.95:.72),vh-320),200,w));MI.dpr=Math.min(2,devicePixelRatio||1);
  if(MI.w!==w||MI.h!==h||MI.cv.width!==Math.round(w*MI.dpr)){MI.w=w;MI.h=h;MI.cv.style.height=h+'px';MI.cv.width=Math.round(w*MI.dpr);MI.cv.height=Math.round(h*MI.dpr)}};
 fit();try{MI.ro&&MI.ro.disconnect();MI.ro=new ResizeObserver(fit);MI.ro.observe(box)}catch(e){}
 if(!MI.raf&&!document.hidden)MI.raf=requestAnimationFrame(miDraw)}
if(typeof document!='undefined')document.addEventListener('visibilitychange',()=>{if(document.hidden)return;MI.buf=MI.buf.slice(-1);MI.sp=null;MI.ft=0;if(MI.cv&&MI.cv.isConnected&&!MI.raf)MI.raf=requestAnimationFrame(miDraw)});
const miRnd=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
/* décor fixe de la grotte, dessiné une fois (par langue : noms des zones) */
function miBg(){const lang=typeof LANG!='undefined'?LANG:'fr';if(MI.bg&&MI.bgL==lang)return MI.bg;const S=1.25,c=document.createElement('canvas');c.width=MIW*S;c.height=MIH*S;
 const x=c.getContext('2d'),r=miRnd(11);x.scale(S,S);
 let gr=x.createRadialGradient(500,320,30,500,320,640);gr.addColorStop(0,'#1f6580');gr.addColorStop(1,'#0b3045');x.fillStyle=gr;x.fillRect(0,0,MIW,MIH);
 for(let i=0;i<110;i++){x.fillStyle=`rgba(170,220,230,${(.025+r()*.05).toFixed(3)})`;x.beginPath();x.ellipse(r()*MIW,r()*MIH,8+r()*40,3+r()*12,r()*3,0,7);x.fill()}
 const wall=[],per=2*(MIW+MIH);for(let i=0;i<96;i++){let t=i/96*per,px,py;const j=10+r()*22;
  if(t<MIW){px=t;py=j}else if((t-=MIW)<MIH){px=MIW-j;py=t}else if((t-=MIH)<MIW){px=MIW-t;py=MIH-j}else{t-=MIW;px=j;py=MIH-t}wall.push([px,py])}
 const path=()=>{x.beginPath();wall.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath()};
 x.save();x.beginPath();x.rect(-9,-9,MIW+18,MIH+18);wall.slice().reverse().forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fillStyle='#04141e';x.fill();x.restore();
 path();x.strokeStyle='rgba(140,210,225,.22)';x.lineWidth=3;x.stroke();
 MIRK.forEach(([a,b,rr])=>{x.beginPath();for(let i=0;i<14;i++){const an=i/14*Math.PI*2,q=rr*(.9+r()*.22);i?x.lineTo(a+q*Math.cos(an),b+q*Math.sin(an)):x.moveTo(a+q,b)}x.closePath();
  const g2=x.createRadialGradient(a-rr*.35,b-rr*.4,rr*.1,a,b,rr*1.1);g2.addColorStop(0,'#3d6474');g2.addColorStop(1,'#10293a');x.fillStyle=g2;x.fill();x.strokeStyle='rgba(150,210,225,.28)';x.lineWidth=2;x.stroke()});
 const zn=GT('miZn').split('|');x.textAlign='center';x.textBaseline='middle';
 [...MIZ,MIC].forEach(([a,b],i)=>{x.globalAlpha=.6;x.font='32px serif';x.fillText(MIZE[i],a,b);x.globalAlpha=.5;x.font='700 15px Nunito,sans-serif';x.fillStyle='#d6f3f8';x.fillText(zn[i]||'',a,b+30);x.globalAlpha=1});
 MI.bg={c,S};MI.bgL=lang;return MI.bg}
/* positions à l'instant « maintenant − 140 ms » (heure de l'hôte), entre les deux instantanés qui l'encadrent */
function miSample(now){const B=MI.buf;if(!B.length)return null;const rt=now-MI.off-140;let a=B[0],b=B[0];
 for(let i=B.length-1;i>=0;i--)if(B[i].h<=rt){a=B[i];b=B[i+1]||B[i];break}
 const al=b===a?1:miCl((rt-a.h)/(b.h-a.h),0,1),key=e=>e[0]+'.'+e[4],A=new Map(a.d.map(e=>[key(e),e])),out=[];
 for(const e of b.d){const k=key(e),p=A.get(k);if(p){const far=Math.abs(p[1]-e[1])+Math.abs(p[2]-e[2])>90;out.push({n:e[0],x:far?e[1]:p[1]+(e[1]-p[1])*al,y:far?e[2]:p[2]+(e[2]-p[2])*al,f:e[3],o:1});A.delete(k)}
  else out.push({n:e[0],x:e[1],y:e[2],f:e[3],o:al})}
 for(const p of A.values())out.push({n:p[0],x:p[1],y:p[2],f:p[3],o:1-al});return{ds:out,pl:b.p}}
function miDraw(){MI.raf=0;const cv=MI.cv,s=st,g=s&&s.game;if(!cv||!cv.isConnected||!g||g.id!='mim'||g.st!='p'||document.hidden)return;MI.raf=requestAnimationFrame(miDraw);
 const x=MI.ctx,cw=MI.w,ch=MI.h,L=MI.last,now=Date.now(),rm=RM(),T=now/1000;if(!cw)return;const dt=MI.ft?Math.min(.1,(now-MI.ft)/1000):0;MI.ft=now;
 x.setTransform(MI.dpr,0,0,MI.dpr,0,0);x.globalAlpha=1;x.fillStyle='#03101a';x.fillRect(0,0,cw,ch);
 if(!L||L.k!==g.k){x.fillStyle='#bfe3ea';x.font='600 14px Nunito,sans-serif';x.textAlign='center';x.fillText('…',cw/2,ch/2);return}
 /* moi : prédiction depuis le dernier instantané (vers ma cible la plus récente), lissée */
 const M=L.me,age=miCl((now-MI.off-L.h)/1000,0,.35),tp=MI.tap&&now-MI.tap.t<450?MI.tap:null,pr={x:M[0],y:M[1],tx:tp?tp.x:M[2],ty:tp?tp.y:M[3]};miMove(pr,age);
 if(!MI.sp||Math.hypot(MI.sp.x-pr.x,MI.sp.y-pr.y)>90)MI.sp={x:pr.x,y:pr.y};else{const k=1-Math.exp(-dt*14);MI.sp.x+=(pr.x-MI.sp.x)*k;MI.sp.y+=(pr.y-MI.sp.y)*k}
 const sx=MI.sp.x,sy=MI.sp.y,z=Math.min(cw,ch)*.37/MIL,vw=cw/z,vh=ch/z,cx=vw>=MIW?MIW/2:miCl(sx,vw/2,MIW-vw/2),cy=vh>=MIH?MIH/2:miCl(sy,vh/2,MIH-vh/2);
 const X=v=>(v-cx)*z+cw/2,Y=v=>(v-cy)*z+ch/2,RR=MIL+14,fade=(px,py)=>miCl((RR-Math.hypot(px-sx,py-sy))/26,0,1);
 const bg=miBg();x.drawImage(bg.c,(cx-vw/2)*bg.S,(cy-vh/2)*bg.S,vw*bg.S,vh*bg.S,0,0,cw,ch);
 const N=g.N,smp=miSample(now)||{ds:[],pl:[]},myI=N.indexOf(meN()),ap=M[4]>=0?M[4]:myI;
 /* neige marine */
 x.fillStyle='#d8f4fa';const rs=miRnd(5);for(let i=0;i<46;i++){const px=((rs()*MIW+(rm?0:T*(3+rs()*4)))%MIW),py=((rs()*MIH+(rm?0:T*(5+rs()*5)))%MIH),q=fade(px,py);if(q<=0){rs();continue}x.globalAlpha=q*(.25+rs()*.35);x.fillRect(X(px),Y(py),1.6,1.6)}
 /* perles */
 for(const [i,px,py,o] of smp.pl){const a=fade(px,py);if(a<=0)continue;const c=col(N[o]),X0=X(px),Y0=Y(py),pr2=Math.max(3.5,6*z);x.globalAlpha=a;
  if(o===ap){x.globalAlpha=a*(rm?.35:.22+.14*Math.sin(T*3+i));x.fillStyle=c;x.beginPath();x.arc(X0,Y0,pr2*2.3,0,7);x.fill();x.globalAlpha=a}
  const gg=x.createRadialGradient(X0-pr2*.35,Y0-pr2*.4,pr2*.1,X0,Y0,pr2);gg.addColorStop(0,'#fff');gg.addColorStop(.5,c);gg.addColorStop(1,'rgba(0,0,0,.35)');x.fillStyle=gg;x.beginPath();x.arc(X0,Y0,pr2,0,7);x.fill()}
 /* nuages d'encre (transformations vues) */
 for(const i in MI.fx){const f=MI.fx[i],p=(now-f.t)/1200;if(p>=1){if(p>3)delete MI.fx[i];continue}x.globalAlpha=(1-p)*.75*fade(f.x,f.y);x.fillStyle='#2a1238';
  for(let j=0;j<5;j++){const an=j*1.26+(+i),rr=(8+30*(rm?.6:p))*z;x.beginPath();x.arc(X(f.x)+Math.cos(an)*rr*.5,Y(f.y)+Math.sin(an)*rr*.5,rr*.62,0,7);x.fill()}}
 /* plongeurs */
 const dv=(px,py,n,a,me,fl,dis)=>{const nm=N[n]||'?',c=col(nm),X0=X(px),Y0=Y(py),r=Math.max(8,MIDR*z);x.globalAlpha=a;
  if(!rm){x.fillStyle='rgba(220,245,255,.5)';for(let j=0;j<2;j++){const p=(T*.9+j*.5+n*.13)%1;x.beginPath();x.arc(X0+Math.sin(p*9+n)*3,Y0-r-p*r*2.2,1.2+p*1.6,0,7);x.fill()}}
  x.fillStyle=c;x.beginPath();x.arc(X0,Y0,r,0,7);x.fill();x.lineWidth=me?2.5:1.5;x.strokeStyle=me?'#fff':'rgba(255,255,255,.7)';if(dis||fl&2)x.setLineDash([3,3]);x.stroke();x.setLineDash([]);
  x.fillStyle='#fff';x.font=`800 ${Math.round(r*1.05)}px Nunito,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(([...nm][0]||'').toUpperCase(),X0,Y0+1);
  if(!me){x.font='700 11px Nunito,sans-serif';x.fillStyle='rgba(235,250,255,.92)';x.fillText(nm.length>12?nm.slice(0,11)+'…':nm,X0,Y0+r+10)}
  if(fl&1||dis||fl&2){x.font=`${Math.round(r*.95)}px serif`;x.fillText(fl&1?'🐙':dis?'🎭':'🐙',X0+r*.95,Y0-r*.9)}};
 for(const e of smp.ds){const a=e.o*fade(e.x,e.y);if(a>0.02)dv(e.x,e.y,e.n,a,false,e.f,false)}
 dv(sx,sy,ap,1,true,g.out.includes(meN())?1:0,M[4]>=0);
 /* obscurité : seul le halo de ma lampe éclaire */
 const hx=X(sx),hy=Y(sy),hr=MIL*z*(rm?1:1+.015*Math.sin(T*2.1)),gd=x.createRadialGradient(hx,hy,hr*.42,hx,hy,hr*1.02);
 gd.addColorStop(0,'rgba(2,9,16,0)');gd.addColorStop(.65,'rgba(2,9,16,.28)');gd.addColorStop(1,'rgba(2,9,16,.88)');x.globalAlpha=1;x.fillStyle=gd;x.fillRect(0,0,cw,ch);
 /* ma cible */
 const tg=tp||{x:M[2],y:M[3]};if(Math.hypot(tg.x-sx,tg.y-sy)>8){x.globalAlpha=.7;x.strokeStyle='#ffd27a';x.lineWidth=1.5;x.beginPath();x.arc(X(tg.x),Y(tg.y),5+(rm?0:2*Math.sin(T*5)),0,7);x.stroke()}
 if(MI.tap&&now-MI.tap.t<700&&!rm){const p=(now-MI.tap.t)/700;x.globalAlpha=1-p;x.strokeStyle='#ffe2a0';x.lineWidth=2;x.beginPath();x.arc(X(MI.tap.x),Y(MI.tap.y),6+18*p,0,7);x.stroke()}
 /* zone actuelle + mini-carte (toucher la mini-carte = nager vers ce point) */
 const zi=miZone(sx,sy),zl=MIZE[zi]+' '+(GT('miZn').split('|')[zi]||'');x.globalAlpha=1;x.font='700 12px Nunito,sans-serif';x.textAlign='left';x.textBaseline='middle';
 const tw=x.measureText(zl).width;x.fillStyle='rgba(2,12,20,.6)';x.beginPath();x.roundRect?x.roundRect(8,8,tw+16,22,11):x.rect(8,8,tw+16,22);x.fill();x.fillStyle='#e3f6fa';x.fillText(zl,16,19.5);
 const mw=Math.round(Math.min(110,cw*.28)),mh=Math.round(mw*MIH/MIW),mx=cw-mw-8,my=8;MI.cam={x:cx,y:cy,z,mm:{x:mx,y:my,w:mw,h:mh}};
 x.globalAlpha=.85;x.fillStyle='rgba(2,12,20,.62)';x.fillRect(mx,my,mw,mh);x.strokeStyle='rgba(160,215,230,.35)';x.lineWidth=1;x.strokeRect(mx+.5,my+.5,mw-1,mh-1);
 x.fillStyle='rgba(160,215,230,.35)';MIRK.forEach(([a,b,r])=>{x.beginPath();x.arc(mx+a/MIW*mw,my+b/MIH*mh,Math.max(1.5,r/MIW*mw),0,7);x.fill()});
 x.globalAlpha=.8;x.font='9px serif';x.textAlign='center';[...MIZ,MIC].forEach(([a,b],i)=>x.fillText(MIZE[i],mx+a/MIW*mw,my+b/MIH*mh));
 x.globalAlpha=1;x.strokeStyle='#ffd27a';x.strokeRect(mx+(cx-vw/2)/MIW*mw,my+(cy-vh/2)/MIH*mh,vw/MIW*mw,vh/MIH*mh);
 x.fillStyle=col(N[ap]);x.beginPath();x.arc(mx+sx/MIW*mw,my+sy/MIH*mh,3.2,0,7);x.fill();x.strokeStyle='#fff';x.lineWidth=1.2;x.stroke()}

/* =====================================================================
   ⚫ LA PERLE NOIRE — fiche (v2 « le collier », 3-8 joueurs, sans élimination)
   Inspirée des jeux d'imposteur, mais ni indices écrits ni vote sur les personnes : on se lit à travers des CHOIX.
   Manche : 5 coffres d'une même famille (ex. Pique-nique / Barbecue / Camping / Randonnée / Pêche), visibles de tous.
     Les nacres savent lequel est le vrai ; la Perle noire (1, ou 2 dès 6 joueurs) sait seulement qu'elle ne le sait pas.
   🌊 3 marées (35 s) : un plateau de 8 trésors (émojis, les mêmes pour tous, quelques-uns 18+ si le coffre l'est) ;
     chacun en glisse UN dans le collier, en secret, modifiable jusqu'à la fin de la marée ; tout se révèle ensemble et
     le collier reste affiché pendant la suite. Aucun ordre de parole, aucun avantage de place.
   Écho : un trésor pris par ≥ 2 nacres et aucune Perle noire = +1 à chacune. Si une Perle noire l'a pris aussi, elle
     vole l'écho : +1 pour elle, 0 pour ces nacres (une Perle avec une seule nacre : rien pour personne).
     → Les points ne sont comptés qu'à la révélation de la manche : pendant les marées, rien ne trahit la Perle.
   🤿 Plongée : la Perle noire désigne en secret le vrai coffre pendant la 2e marée (+3) ou la 3e (+2 ; obligatoire, sinon
     ratée). Pendant la 2e marée elle doit choisir « plonger » ou « attendre » (ses deux gestes : personne ne voit rien).
     Ratée ou absente : +2 pour chaque nacre (+1 par Perle ratée quand elles sont deux).
   → Tension : l'écho pousse les nacres vers l'évident, mais l'évident guide la Perle vers le coffre ET vers leur écho.
     Le bon trésor colle au vrai coffre et à un ou deux voisins. Les coffres d'une famille sont proches : c'est voulu.
   Rotation : chacun est Perle noire exactement une fois (ordre tiré au sort ; à 7, la dernière manche n'en a qu'une) :
     manches = ⌈n / perles⌉ → 3, 4, 5, 3, 4, 4 (≈ 2 min chacune). Les deux rôles ne valent pas pareil par manche, mais
     chacun les joue autant : aucune place n'est avantagée. Absent·e à son tour : on prend quelqu'un d'en ligne.
   SIM (.sim/prl4.js, hors site, 3000 manches/taille ; coffres = vecteurs proches d'une même famille, trésors au hasard,
     perception bruitée, nacres plus ou moins subtiles, Perle bayésienne qui plonge dès que sa meilleure hypothèse
     atteint 60 %, sinon à la 3e marée) : Perle juste n=3→8 : 46 / 48 / 49 / 41 / 46 / 46 % (plongées à la 2e marée
     36–72 %) ; pts par manche Perle / nacre : 1.9/1.7, 2.5/2.0, 2.9/2.2, 2.6/1.9, 3.0/1.9, 3.1/2.0 ; sièges (rôles tirés
     au hasard) : écart ≤ 0,04 pt. Une vraie Perle lit moins bien qu'un calcul bayésien : ~35–45 % attendu.
     Rejetés : 4 coffres (48–52 %), coffres sans lien entre eux (85–90 %), plongée seulement à la fin (≈ 80 %),
     vol d'écho dès une seule nacre (Perle ≈ 2× plus de points), indices écrits + vote (= l'ancien jeu, « Undercover »).
   ===================================================================== */
const PRL={W:35,RV:18,TD:3,TR:8,NC:5,V:[0,3,2]};
/* trésors : émojis seuls (aucune traduction) ; PRS = réserve 18+, mêlée au plateau seulement si le coffre est 18+ */
const PRS=[...new Set('🍆 🍑 🍌 🥒 🍒 🌶️ 💦 👅 💋 👄 🫦 🥵 😈 😏 😘 🤤 😳 🫣 🙈 👀 👙 🩲 🩱 👠 💄 🧴 🛁 🚿 🛏️ ⛓️ 🕯️ 🍯 🧊 🍾 🥂 🍷 📸 🎥 📹 🪢 🪶 🎀 🪞 🗝️ 🔒 🔞 🌹 💌 💘 💞 🍫 🍦 🍭 🌭 🥥 🐍 🐇 💎 🎭 🃏 🍩 🍓 🪩 💸 🦪 🪒 🧤 🎈 🏩 🍄 🔦 🛋️ 🚪 💃🏻 🕺🏻 💅🏻 🛀🏻 🧖🏻 🥛 🥵 🍸'.split(' '))];
const PRN=[...new Set(('🍎 🍐 🍊 🍋 🍉 🍇 🫐 🍈 🥭 🍍 🥝 🍅 🥑 🥦 🥬 🫑 🌽 🥕 🧄 🧅 🥔 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🍢 🍡 🍧 🍨 🥧 🧁 🍰 🎂 🍮 🍬 🍿 🍪 🌰 🥜 ☕ 🍵 🧃 🥤 🧋 🍺 🍻 🥃 🍹 🧉 🥄 🍴 🥣 🥡 🥢 🧂 '+
 '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🦂 🐢 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🐄 🐖 🐑 🦙 🐐 🦌 🐕 🐈 🐓 🦃 🦚 🦜 🦢 🦩 🕊️ 🦝 🦦 🦥 🐁 🐿️ 🦔 '+
 '🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 🍀 🪴 🍃 🍂 🍁 🐚 🪨 🌾 💐 🌷 🌺 🌸 🌼 🌻 🌞 🌝 🌙 🌎 🪐 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ 💨 💧 🌊 🌫️ '+
 '⌚ 📱 💻 ⌨️ 🖨️ 🕹️ 💾 📷 📞 📺 📻 🎙️ ⏰ ⌛ 📡 🔋 🔌 💡 🧯 💵 💰 💳 ⚖️ 🧰 🔧 🔨 🪚 🔩 ⚙️ 🧱 🧲 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ ⚰️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🩹 🩺 💊 💉 🧬 🦠 🧪 🌡️ 🧹 🧺 🧻 🚽 🧼 🪥 🧽 🪣 🛎️ 🔑 🪑 🧸 🪆 🖼️ 🛍️ 🛒 🎁 🎏 🪄 🪅 🎊 🎉 🎐 🏮 ✉️ 📦 🏷️ 📜 📊 📈 📅 🗑️ 📋 📁 📰 📓 📚 📖 🔖 🧷 📎 📐 📏 🧮 📌 ✂️ 🖊️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔓 '+
 '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🥊 🥋 🛹 🛼 🛷 ⛸️ 🎿 🏆 🥇 🏅 🎫 🎪 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩 🪁 🏹 🎣 🤿 '+
 '🚗 🚕 🚌 🏎️ 🚓 🚑 🚒 🚜 🛵 🏍️ 🚲 🛴 🚨 🚂 🚆 🚇 ✈️ 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛳️ 🚢 ⚓ 🪝 ⛽ 🚧 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🏕️ ⛺ 🛖 🏠 🏚️ 🏭 🏥 🏦 🏨 🏫 💒 🏛️ 🌅 🌄 🌠 🎇 🎆 🌃 🌌 🌉 '+
 '🧳 🌂 ☂️ 🧵 🧶 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧥 🧦 👗 👘 🩴 🩳 👛 👜 🎒 👞 👟 🥾 👢 👑 👒 🎩 🎓 🧢 ⛑️ 💍 💼').split(' '))].filter(e=>e&&!PRS.includes(e));
GAMES.prl={icon:'⚫',min:3,max:8,dur:10,tags:['social'],tone:true,PRN,PRS,
 np:n=>n>=6?2:1,
 /* les 5 coffres d'une famille (réserve q), dans une langue */
 cs(q,l){const k='prl'+(q[0]||'');return (GL(k,l)[q[1]]||GL(k,'fr')[q[1]]||'').split('~').map(x=>x.trim())},
 init(s){const g=s.game,n=s.order.length;g.n=Math.ceil(n/this.np(n));g.q=gPool(s,'prl',g.n);g.n=g.q.length;g.qq=shuf([...s.order]);g.pc={};g.res=[];this.rnd(s)},
 rnd(s){const g=s.game,on=gOn(s),np=Math.min(this.np(s.order.length),Math.max(1,on.length-2));
  /* d'abord celles et ceux qui n'ont pas encore été Perle noire (ordre tiré au sort au début) ; à 7, la dernière manche n'en a qu'une */
  const fr=g.qq.filter(p=>on.includes(p)&&!g.pc[p]),rest=shuf(on.filter(p=>!fr.includes(p))).sort((a,b)=>(g.pc[a]||0)-(g.pc[b]||0));
  g.pe=fr.length?fr.slice(0,np):rest.slice(0,np);g.pe.forEach(p=>g.pc[p]=(g.pc[p]||0)+1);
  g.cq=g.q[g.r];g.o=shuf([...Array(PRL.NC).keys()]);g.t=Math.floor(Math.random()*PRL.NC);
  const sp=[0,2,3][+g.cq[0]||0],a=PRL.TR-sp,N=shuf(PRN.slice()),S=shuf(PRS.slice());
  g.trs=[...Array(PRL.TD)].map((_,i)=>shuf(N.slice(i*a,(i+1)*a).concat(S.slice(i*sp,(i+1)*sp))));
  g.tide=0;g.h=[];g.dv={};g.wt={};this.tide(s)},
 tide(s){const g=s.game;g.tr=g.trs[g.tide];g.pk={};gWait(g,PRL.W,'p')},
 /* fini pour cette marée ? Perle noire : trésor + (2e marée) plonger ou attendre, (3e) plonger — sauf si déjà plongé avant */
 fin1(g,p){if(g.pk[p]==null)return false;if(!g.pe.includes(p)||!g.tide)return true;const d=g.dv[p];if(d)return true;return g.tide<PRL.TD-1&&g.wt[p]===g.tide},
 act(s,from,a){const g=s.game;if(g.st!='p')return;let ch=false;
  if(Number.isInteger(a.e)&&a.e>=0&&a.e<g.tr.length){g.pk[from]=a.e;ch=true}
  if(Number.isInteger(a.d)&&g.pe.includes(from)&&g.tide>0&&!(g.dv[from]&&g.dv[from].t<g.tide)){
   if(a.d>=0&&a.d<PRL.NC){g.dv[from]={c:a.d,t:g.tide};delete g.wt[from];ch=true}
   else if(a.d==-1&&g.tide<PRL.TD-1){delete g.dv[from];g.wt[from]=g.tide;ch=true}}
  if(!ch)return;if(this.fin1(g,from))g.done[from]=1;return true},
 next(s){const g=s.game;
  if(g.st=='p'){g.h.push({tr:g.tr,pk:{...g.pk}});g.tide++;if(g.tide<PRL.TD)this.tide(s);else{this.score(s);gWait(g,PRL.RV,'r',1)}return}
  g.r++;if(g.r>=g.n){g.over=1;return}this.rnd(s)},
 score(s){const g=s.game,pts={},ec=[],na=s.order.filter(p=>!g.pe.includes(p));s.order.forEach(p=>pts[p]=0);
  g.h.forEach(h=>{const G={},e={};for(const p in h.pk)if(s.order.includes(p))(G[h.pk[p]]=G[h.pk[p]]||[]).push(p);
   for(const k in G){const gp=G[k].filter(p=>g.pe.includes(p)),gn=G[k].filter(p=>!g.pe.includes(p));if(gn.length<2)continue;
    if(gp.length){gp.forEach(p=>pts[p]++);e[k]='s'}else{gn.forEach(p=>pts[p]++);e[k]='e'}}ec.push(e)});
  const dv={},np=g.pe.length;
  g.pe.forEach(p=>{const d=g.dv[p],ok=!!d&&d.c===g.t;dv[p]=d?{c:d.c,t:d.t,ok}:{c:-1};if(!s.order.includes(p))return;
   if(ok)pts[p]+=PRL.V[d.t];else na.forEach(q=>pts[q]+=np>1?1:2)});
  for(const p in pts)g.sc[p]+=pts[p];
  g.res.push({q:g.cq,o:g.o,t:g.t,pe:[...g.pe],h:g.h,ec,dv,pts})},
 /* secrets : le vrai coffre (seulement aux nacres), les Perles, les plongées, les trésors en cours et les plateaux à venir */
 hide(g,n,s){const o={...g};['q','qq','pc','trs','pe','t','dv','wt'].forEach(k=>delete o[k]);
  if(g.st=='p'){o.pk=hideOwn(g.pk,n);if(s.order.includes(n)){o.me=g.pe.includes(n)?1:0;if(!o.me)o.t=g.t;if(g.dv[n])o.mdv=g.dv[n];if(g.wt[n]!=null)o.mwt=g.wt[n]}}
  return o},
 /* le collier : une ligne par marée, trésors regroupés (écho = même trésor) */
 neck(s,H,r,m){if(!H||!H.length)return '';
  return `<div class="prnk"><p class="prnkh">📿 ${GT('prNeck')}</p>${H.map((h,t)=>{const G={};for(const p in h.pk)if(h.pk[p]!=null&&s.order.includes(p))(G[h.pk[p]]=G[h.pk[p]]||[]).push(p);
   const ec=r?r.ec[t]||{}:{},ks=Object.keys(G).sort((a,b)=>G[b].length-G[a].length);
   return `<div class="prnr ga" ${dl(t)}><span class="prti">🌊 ${GT('prTn',{i:t+1})}</span><span class="prgs">${ks.map(k=>`<span class="prg ${G[k].length>1?'two':''} ${ec[k]=='e'?'ec':ec[k]=='s'?'st':''}"><i>${h.tr[k]}</i>${G[k].map(p=>{const pk=r&&r.pe.includes(p);
    return `<small class="${pk?'pk':''}">${pk?'<b class="prbk sm" aria-hidden="true"></b>':DT(p)}${esc(p==m?GT('me'):p)}</small>`}).join('')}${ec[k]=='s'?'<b class="prst" aria-hidden="true">✋🏻</b>':''}</span>`).join('')}</span></div>`}).join('')}</div>`},
 rview(s,r,m,L){if(!r)return{html:''};const R=this,cs=R.cs(r.q,L),nm=i=>cs[r.o[i]]||'';
  const ch=`<div class="prcf">${[...Array(PRL.NC).keys()].map(i=>{const ds=r.pe.filter(p=>r.dv[p]&&r.dv[p].c===i);
   return `<span class="prch ga ${i===r.t?'tru':'off'}" ${dl(i)}><span aria-hidden="true">${i===r.t?'💎':'🧰'}</span><b>${esc(nm(i))}</b>${ds.map(p=>`<em>🤿 ${esc(p)}</em>`).join('')}</span>`}).join('')}</div>`;
  const out=r.pe.map((p,i)=>{const d=r.dv[p]||{c:-1},v=d.ok?PRL.V[d.t]:r.pe.length>1?1:2;
   return `<p class="gnote prout ga" ${dl(i,.5)}><b class="prbk" aria-hidden="true"></b> ${d.ok?GT('prOk',{n:B(p),v,i:d.t+1}):GT(d.c<0?'prNo':'prKo',{n:B(p),v})}</p>`}).join('');
  const pts=`<div class="gvl">${s.order.map((p,i)=>`<span class="gchip ga ${r.pts[p]?'ok':''} ${p==m?'me':''}" ${dl(i,.7)}>${r.pe.includes(p)?'<b class="prbk sm" aria-hidden="true"></b>':DT(p)}${esc(p)} ${gPs(r.pts[p]||0)}</span>`).join('')}</div>`;
  return{html:`<div class="card c"><p class="gpre">${GT('prTrue')}</p>${ch}${out}${R.neck(s,r.h,r,m)}<p class="prnkh prrd">${GT('prRd')}</p>${pts}</div>`,
   bind(){if(r.pts[m]&&!RM())sparkles($('.prch.tru')||$('.prcf'),Math.min(18,r.pts[m]*5))}}},
 view(s){const g=s.game,m=meN(),R=this,L=typeof LANG!='undefined'?LANG:'fr';
  if(g.st=='r')return R.rview(s,g.res[g.res.length-1],m,L);
  const cs=R.cs(g.cq,L),nm=i=>cs[g.o[i]]||'',pl=s.order.includes(m),me=pl&&g.me==1,
   lock=!!g.mdv&&g.mdv.t<g.tide,dvc=g.mdv?g.mdv.c:null,can=me&&g.tide>0&&!lock;
  const role=pl?`<div class="prmy ga"><span class="prp ${me?'k':''}" aria-hidden="true"></span><span><small>${GT(me?'prP':'prN')}</small><b>${esc(me?GT('prUnk'):nm(g.t))}</b></span></div>`:'';
  const chests=`<div class="prcf">${[...Array(PRL.NC).keys()].map(i=>{const t=pl&&!me&&i===g.t,d=me&&dvc===i,
   inner=`<span aria-hidden="true">${d?'🤿':'🧰'}</span><b>${esc(nm(i))}</b>`;
   return can?`<button class="prch ga ${d?'dv sel':''}" ${dl(i)} data-prd="${i}" aria-pressed="${d}">${inner}</button>`:`<span class="prch ga ${t?'tru':''} ${d?'dv':''}" ${dl(i)}>${inner}</span>`}).join('')}</div>`;
  let dive='';
  if(me){if(!g.tide)dive=`<p class="prdvp ga" ${dl(5)}>${GT('prDv1')}</p>`;
   else if(lock)dive=`<p class="prdvp ga" ${dl(5)}>${GT('prDvd',{c:esc(nm(dvc))})}</p>`;
   else dive=`<p class="prdvp hot ga" ${dl(5)}>${GT(g.tide<PRL.TD-1?'prDv2':'prDv3')}</p>${g.tide<PRL.TD-1?`<button class="ghost wide prwt ga ${g.mwt===g.tide&&dvc==null?'sel':''}" ${dl(6)} data-prd="-1" aria-pressed="${g.mwt===g.tide&&dvc==null}">${GT('prWait')}</button>`:''}`}
  const tray=pl?`<p class="gq2 prq">🌊 ${GT('prTide',{i:g.tide+1})} · ${GT(me?'prPkP':'prPkN')}</p><div class="prtr">${g.tr.map((e,i)=>`<button class="ga ${g.pk[m]===i?'sel':''}" ${dl(i,.1)} data-pre="${i}" aria-pressed="${g.pk[m]===i}">${e}</button>`).join('')}</div>`
   :`<p class="gq2 prq">🌊 ${GT('prTide',{i:g.tide+1})}</p>`;
  return{html:`<div class="card c">${role}${chests}${dive}${tray}${R.neck(s,g.h,null,m)}</div>`,
   bind(){$$('[data-pre]').forEach(b=>b.onclick=()=>gs({e:+b.dataset.pre}));$$('[data-prd]').forEach(b=>b.onclick=()=>gs({d:+b.dataset.prd}))}}},
 endView(s){const g=s.game,R=this,L=typeof LANG!='undefined'?LANG:'fr';if(!g.res||!g.res.length)return '';
  return `<h3 class="gh3">⚫ ${GT('prRec')}</h3>${g.res.map((r,i)=>`<div class="prend ga" ${dl(i,.3)}>${r.pe.map(p=>`<span class="prbk sm" aria-hidden="true"></span><b>${esc(p)}</b><span>${r.dv[p]&&r.dv[p].ok?'🤿 ✓':'✗'}</span>`).join(' ')}<span class="mut prres">💎 ${esc(R.cs(r.q,L)[r.o[r.t]]||'')}</span></div>`).join('')}`},
 log(s){const L=[];(s.game.res||[]).forEach(r=>r.pe.forEach(p=>{if(!s.order.includes(p))return;const d=r.dv[p];L.push({k:d&&d.ok?'prlK':'prlM',n:[p]})}));return L},/* 📜 */
 fin(s){return{pts:s.game.sc}}};

/* =====================================================================
   ⛈️ TEMPÊTE — fiche (coopératif, 2 à 8)
   Niveau k : chacun reçoit k vagues secrètes (nombres 1–100, tous différents). Il faut toutes les lâcher dans l'ordre
     croissant, à l'échelle du groupe, sans jamais dire de chiffre : pendant la partie le chat se tait (hôte : messages
     refusés), seules les 4 réactions restent.
   Rythme partagé = coups de houle (8 s × sablier de l'hôte, jamais moins de 7 s réelles ; sans sablier : quand tout le
     monde a choisi). Chaque niveau s'ouvre sur un court moment « tes vagues » (5 s ou « Continuer ») pour les lire.
     La jauge de la tempête est l'horloge : elle descend en continu pendant le coup. À chaque coup,
     en même temps et modifiable jusqu'à la fin du coup : 🌊 Lâcher (ma plus petite vague), ⏳ Retenir (défaut), 🌅 Vague
     calme. Pas de premier joueur : les vagues lâchées ensemble se rangent toutes seules ; une erreur n'arrive que si une
     vague PLUS BASSE reste en main → elle part dans l'écume (révélée), −1 ⛵ par coup fautif.
   ⛈️ La tempête : chaque niveau a B = ⌈1,5 × vagues⌉ + 8 coups ; à 0, −1 ⛵ et les vagues restantes partent à l'écume.
     Le compte à rebours sert aussi d'horloge commune (« je lâche quand il reste à peu près ma part du temps »).
   🌅 Vague calme (1 au départ, +1 après les niveaux 2 et 5) : si au moins la moitié de ceux qui ont encore des vagues la
     demande au même coup (les demandes sont visibles, les autres choix non), c'est une pause : +3 coups, et chacun montre la
     dizaine de sa plus petite vague (« 30–39 ») tant qu'elle n'est pas lâchée. ⛵ +1 après les niveaux 3 et 6.
   Absent : sa plus petite vague part seule quand elle est la plus basse en jeu (la partie ne bloque jamais).
   Niveaux : 7 (2 joueurs), 6 (3), 5 (4), 4 (5), 3 (6-8). ⛵ de départ : 2 (2 joueurs), 4 (3-7), 5 (8).
   SIM (.sim/tmp.js + tmp_grid.js, hors site, 2000-3000 parties/taille ; IA : chacun lâche sa vague quand
     (vague − dernière posée) ≤ (coups depuis la dernière + 1) × (100 − dernière)/(coups restants), bruit lognormal
     σ = 0,25 précis / 0,4 moyen / 0,6 flou ; vague calme au 1er coup des niveaux ≥ 3 ; avec les dizaines, on retient si
     quelqu'un a une dizaine plus basse, on lâche si on a la seule plus basse) :
     victoire n=2→8, moyen : 50 / 44 / 37 / 57 / 58 / 45 / 51 % ; précis : 78 / 87 / 87 / 89 / 88 / 84 / 90 % ;
     flou : 19 / 13 / 9 / 18 / 24 / 10 / 13 % (vraie logique, .sim/tmp_run.js, 600 parties/taille : 0 fuite, 0 blocage,
     et 100/100 parties finies avec un absent). Coopératif et simultané : aucun siège ne compte.
     Rejetés : mêmes niveaux pour tous (5 à 8 joueurs : 24–32 vagues au dernier niveau, 1–19 % en moyen),
     2 ⛵ partout (moyen 3–12 % dès 3 joueurs).
   ===================================================================== */
const TMP={BT:8,BM:7,FT:5,CB:3,LV:n=>n==2?7:n==3?6:n==4?5:n==5?4:3,LF:n=>n==2?2:n==8?5:4,B:c=>Math.ceil(c*1.5)+8,BON:{2:'c',3:'l',5:'c',6:'l'}};
const tpBand=v=>{const k=Math.floor((v-1)/10);return (10*k+1)+"–"+(10*k+10)};
GAMES.tmp={icon:'⛈️',rx:RX,min:2,max:8,dur:8,tags:['skill'],mute:1,TMP,clk:g=>g.st=='b',
 init(s){const g=s.game,n=s.order.length;g.n=TMP.LV(n);g.life=TMP.LF(n);g.calm=1;g.hist=[];g.ok=0;this.deal(s)},
 deal(s){const g=s.game,k=g.r+1,d=shuf([...Array(100).keys()].map(i=>i+1));g.h={};s.order.forEach(p=>g.h[p]=d.splice(0,k).sort((a,b)=>a-b));
  g.pl=[];g.ec=[];g.band={};g.left=g.B=TMP.B(k*s.order.length);g.ev=null;g.res=null;g.bt=0;g.since=0;g.nx=0;g.ch={};this.pub(s);gWait(g,TMP.FT,'f',1)},
 hold(s){const g=s.game;return s.order.filter(p=>(g.h[p]||[]).length)},
 pub(s){const g=s.game;g.cnt={};s.order.forEach(p=>g.cnt[p]=(g.h[p]||[]).length)},
 beat(s){const g=s.game,f=gTF();g.ch={};gWait(g,f?Math.max(TMP.BT,TMP.BM/f):TMP.BT,'b');g.need=this.hold(s);g.bt++;this.pub(s)},
 act(s,from,a){const g=s.game;if(g.st!='b'||!(g.h[from]||[]).length||!['P','W','C'].includes(a.v))return;if(a.v=='C'&&g.calm<1)return;
  g.ch[from]=a.v;g.done[from]=1;return true},
 next(s){const g=s.game;if(g.st=='f'){this.beat(s);return}if(g.st=='b'){this.res(s);return}
  if(g.end){g.over=1;return}g.r++;this.deal(s)},
 res(s){const g=s.game,H=this.hold(s),on=new Set(gOn(s)),ch=g.ch,Ho=H.filter(p=>on.has(p));g.left--;
  const nc=Ho.filter(p=>ch[p]=='C').length;
  if(g.calm>0&&nc&&nc>=Math.max(1,Math.ceil(Ho.length/2))){/* 🌅 pause : +3 coups, dizaines montrées, l'horloge ne bouge pas */
   g.calm--;g.left+=TMP.CB;H.forEach(p=>g.band[p]=Math.floor((g.h[p][0]-1)/10));g.ev={t:'c',n:nc};return this.after(s)}
  const P=Ho.filter(p=>ch[p]=='P'),low=Math.min(...H.map(p=>g.h[p][0]));
  H.filter(p=>!on.has(p)&&g.h[p][0]==low).forEach(p=>P.push(p));/* absent : la houle emporte sa vague quand c'est son tour */
  if(!P.length){g.since++;g.ev={t:'w'};return this.after(s)}
  const put=P.map(p=>({v:g.h[p].shift(),p})).sort((a,b)=>a.v-b.v),mx=put[put.length-1].v,lost=[];
  s.order.forEach(p=>{const h=g.h[p]||[];while(h.length&&h[0]<mx)lost.push({v:h.shift(),p})});
  put.forEach(x=>g.pl.push({v:x.v,p:x.p,b:g.bt,e:lost.length?1:0}));lost.forEach(x=>g.ec.push({v:x.v,p:x.p,b:g.bt}));
  if(lost.length){g.life--;g.nx++}
  for(const p in g.band){const h=g.h[p]||[];if(!h.length||Math.floor((h[0]-1)/10)!=g.band[p])delete g.band[p]}
  g.since=0;g.ev={t:lost.length?'x':'p',put,lost};this.after(s)},
 after(s){const g=s.game,H=this.hold(s);this.pub(s);
  if(g.life>0&&H.length&&g.left>0)return this.beat(s);
  const storm=g.life>0&&H.length>0;if(storm)g.life--;
  H.forEach(p=>{g.h[p].forEach(v=>g.ec.push({v,p,b:g.bt,t:1}));g.h[p]=[]});
  const lv=g.r+1,ok=g.life>0;let bon=null;if(ok){g.ok=lv;if(lv<g.n){bon=TMP.BON[lv]||null;if(bon=='c')g.calm++;if(bon=='l')g.life++}}
  g.res={lv,ok,storm:storm?1:0,bon};g.hist.push({lv,ok,st:storm?1:0,x:g.nx,bt:g.bt});g.end=!ok||lv>=g.n;this.pub(s);gWait(g,14,'r',1)},
 /* secrets : chacun ne reçoit que SES vagues ; pendant un coup, on voit seulement qui demande la vague calme */
 hide(g,n){const o={...g};o.h={[n]:(g.h[n]||[]).slice()};
  if(g.st=='b'){o.ch={};for(const p in g.ch)if(p==n||g.ch[p]=='C')o.ch[p]=g.ch[p]}return o},
 sea(g,nw){const P=g.pl||[],E=g.ec||[],ln={},last=[-99,-99];
  /* numéros des vagues qui viennent de tomber : rangée du haut ou du bas, jamais à moins de 9 unités l'un de l'autre */
  [...E.map(x=>({...x,k:'e'+x.v})),...P.map(x=>({...x,k:'p'+x.v}))].filter(x=>nw&&x.b==nw).sort((a,b)=>a.v-b.v).forEach(x=>{const r=x.v-last[0]>=9?0:x.v-last[1]>=9?1:last[0]<=last[1]?0:1;last[r]=x.v;ln[x.k]=r});
  const lb=(k,v)=>ln[k]!=null?`<span class="${ln[k]?'dn':''}">${v}</span>`:'';
  return `<div class="tpsea" aria-hidden="true"><i class="tpln"></i>${E.map(x=>`<b class="tpw ec ${nw&&x.b==nw?'nw':''}" style="inset-inline-start:${x.v-1}%">${lb('e'+x.v,x.v)}</b>`).join('')}
   ${P.map(x=>`<b class="tpw ${x.e?'bad':''} ${nw&&x.b==nw?'nw':''}" style="inset-inline-start:${x.v-1}%;--c:${col(x.p)}">${lb('p'+x.v,x.v)}</b>`).join('')}<span class="tp0">1</span><span class="tp1">100</span></div>`},
 /* petite légende : couleurs et icônes */
 lg(){return `<p class="tplg"><span><i class="tpw0" style="--c:${col(meN())}"></i>${GT('tpLgW')}</span><span><i class="tpw0 bad"></i>${GT('tpLgB')}</span><span><i class="tpw0 ec"></i>${GT('tpLgE')}</span><span>⛵ ${GT('tpLgL')}</span><span>🌅 ${GT('tpLgC')}</span></p>`},
 seq(g){return `<div class="tpseq">${[...(g.pl||[]).map(x=>`<b class="${x.e?'bad':''}" style="--c:${col(x.p)}">${x.v}</b>`),...(g.ec||[]).map(x=>`<b class="ec">${x.v}</b>`)].join('')}</div>`},
 view(s){const g=s.game,m=meN(),R=this,my=(g.h||{})[m]||[],ch=g.ch||{};
  const bar=`<div class="tpbar"><span class="tplf" title="${esc(GT('tpLgL'))}">${'⛵'.repeat(Math.max(0,g.life))}</span><span class="tpcl ${g.calm?'':'z'}" title="${esc(GT('tpLgC'))}">🌅 ${g.calm}</span><b class="tplv">${GT('tpLv',{v:g.r+1})}</b></div>`;
  if(g.st=='f'){const pl=s.order.includes(m);
   return{html:`<div class="card c tpcard">${bar}<p class="gq2 ga">${GT(pl?'tpFocus':'tpFocusS')}</p>${pl&&my.length?`<div class="tphand tpfoc">${my.map((v,i)=>`<b class="tpv ga ${i?'':'lo'}" ${dl(i,.15)}>${v}</b>`).join('')}</div>`:''}
    <p class="gsub ga" ${dl(3)}>${GT('tpFocusD',{v:GTn('tpBeatN',g.B)})}</p>${R.lg()}</div>`}}
  if(g.st=='r'){const r=g.res||{};
   const msg=r.ok?(r.storm?GT('tpStorm'):GT(r.lv>=g.n?'tpWin':'tpOk',{v:r.lv})):GT('tpSunk');
   return{html:`<div class="card c">${bar}<p class="gbig2 ga ${r.ok&&!r.storm?'ok':''}">${r.ok?(r.storm?'⛈️':'🌈'):'🌊'}</p><p class="gby2 ga" ${dl(1)}>${msg}</p>
    ${r.bon?`<p class="gnote ga ok" ${dl(2)}>${GT(r.bon=='l'?'tpBonL':'tpBonC')}</p>`:''}${R.sea(g,0)}${R.seq(g)}</div>`,
    bind(){if(r.ok&&!r.storm&&!RM())sparkles($('.gby2'),14)}}}
  const H=s.order.filter(p=>g.cnt[p]),nc=Object.values(ch).filter(v=>v=='C').length,ev=g.ev||{};
  const evt=ev.t=='p'?ev.put.map(x=>`<span class="tpe">${DT(x.p)}<b>${x.v}</b></span>`).join(''):ev.t=='x'?`💥 ${GT('tpX',{v:ev.lost.map(x=>x.v).join(', ')})}`:ev.t=='c'?`🌅 ${GT('tpC')}`:ev.t=='w'?GT('tpW'):GT('tpGo');
  const crew=s.order.map(p=>{const k=g.cnt[p]||0,bd=g.band[p];
   return `<div class="tpm ${p==m?'me':''} ${k?'':'out'}" data-rxp="${esc(p)}"><span class="tpnm">${DT(p)}${p==m?esc(GT('me')):esc(p)}</span><span class="tpk">${k?'🌊'.repeat(Math.min(k,7)):'✓'}</span>
    ${bd!=null&&k?`<span class="tpbd" dir="ltr">${tpBand(bd*10+1)}</span>`:''}${ch[p]=='C'?'<span class="tpcq">🌅</span>':''}${g.done[p]&&k?'<i class="tpok" aria-hidden="true"></i>':''}</div>`}).join('');
  const c=ch[m]||'W',hand=my.length?`<div class="tphand">${my.map((v,i)=>`<b class="tpv ${i?'':'lo'}">${v}</b>`).join('')}</div>
   <div class="tpbt"><button class="tpgo ${c=='P'?'sel':''}" data-tp="P" aria-pressed="${c=='P'}">🌊 ${GT('tpPut',{v:my[0]})}</button><button class="ghost ${g.done[m]&&c=='W'?'sel':''}" data-tp="W" aria-pressed="${c=='W'}">⏳ ${GT('tpHold')}</button>
   <button class="ghost tpcb ${c=='C'?'sel':''}" data-tp="C" ${g.calm?'':'disabled'} aria-pressed="${c=='C'}">🌅 ${GT('tpCalm')}${nc?` <small>${nc}/${Math.max(1,Math.ceil(H.length/2))}</small>`:''}</button></div>`:s.order.includes(m)?`<p class="gnote">${GT('tpNone')}</p>`:'';
  /* la jauge EST l'horloge : elle glisse de « coups restants » à « un de moins » pendant le coup (calée sur le sablier) */
  const ga=Math.max(0,Math.min(1,g.left/g.B)),gb=Math.max(0,Math.min(1,(g.left-1)/g.B)),rm=gRem(s),run=g.dl>0&&g.sec;
  return{html:`<div class="card c tpcard">${bar}<div class="tpst"><span>⛈️ ${GTn('tpLeftN',g.left)}</span><span class="tpsb"><i data-gan style="--a:${ga.toFixed(4)};--b:${gb.toFixed(4)};${run?`animation-duration:${g.sec}s;animation-delay:-${Math.max(0,g.sec-rm).toFixed(2)}s`:'animation:none;transform:scaleX(var(--a))'}"></i></span></div>
   ${R.sea(g,g.bt-1)}<p class="tpev" aria-live="polite">${evt}</p><p class="tpsi">${GT('tpSince',{v:g.since})}</p><div class="tpcrew">${crew}</div>${hand}${R.lg()}
   <p class="tpmu">🤫 ${GT('tpMute')}</p></div>`,
   bind(){$$('[data-tp]').forEach(b=>b.onclick=()=>gs({v:b.dataset.tp}))}}},
 endView(s){const g=s.game;
  return `<p class="gbig2 ga ${g.ok>=g.n?'ok':''}">${g.ok>=g.n?'🌈':'⛈️'} ${g.ok} / ${g.n}</p><p class="gnote ga" ${dl(1)}>${GT('tpEnd',{v:g.ok,n:g.n})}</p>
   <div class="tpend">${(g.hist||[]).map((h,i)=>`<div class="ga" ${dl(i,.3)}><b>${GT('tpLv',{v:h.lv})}</b><span>${h.ok?(h.st?'⛈️':'✓'):'🌊'}${h.x?' · 💥 '+GTn('tpErrN',h.x):''}</span><span class="mut">${GTn('tpBeatN',h.bt)}</span></div>`).join('')}</div>`},
 fin(s){const g=s.game;return{pts:g.sc,coop:{v:g.ok,max:g.n}}}};
/* @games : jeux silencieux (Tempête) — pendant la partie, le chat se tait (hôte et envoi) ; réactions seulement */
W.GMute=s=>!!(s&&s.phase=='game'&&s.game&&GAMES[s.game.id]&&GAMES[s.game.id].mute);

/* =====================================================================
   🐚 MARCHANDS DE COQUILLAGES — fiche (enchères secrètes et bluff, 2 à 8)
   5 espèces (Saint-Jacques, Conque, Porcelaine, Turritelle, Ormeau). Chaque espèce a une COTE cachée, tirée au hasard :
     0, 1, 2, 3, 5 (une valeur par espèce). Chacun connaît en secret la cote d'UNE espèce (deux à 2 joueurs) ; indices tous
     différents jusqu'à 5 joueurs (dès 6, certaines espèces sont connues de deux personnes).
   3 marées × 5 lots (2 coquillages jusqu'à 3 joueurs, 2-3 à 4-5, 3 dès 6). L'étal de toute la marée est montré d'avance.
   Bourse : 10 🪙, +5 au début des marées 2 et 3 (tout le monde pareil, bourses publiques).
   📣 Annonce (40 s, simultanée, cachée jusqu'à la fin de l'étape) : « 📈 précieuse » ou « 📉 sans valeur » sur une espèce,
     ou 🤐 rien. Vraie ou fausse, au choix. Vraie = +1 à la fin (📈 : cote ≥ 3, 📉 : cote ≤ 1 ; la cote 2 rend les deux
     fausses). Une cote sort à la fin des marées 1 et 2 (au hasard) : les annonces sur elle sont vérifiées tout de suite.
   🪙 Offre (25 s, secrète, modifiable) : 0 à 9 écus (0 = passer, rien au-dessus de sa bourse). La plus haute offre gagne et
     paie. Offres ÉGALES S'ANNULENT (les ex æquo perdent tous) ; la plus haute offre restée seule l'emporte. Personne seul·e
     au-dessus de 0 ? Le lot reste et s'ajoute au suivant (dernier lot : il ouvre la marée d'après ; à la fin, la mer le
     reprend). Aucun départage par siège, jamais. Sans choix au sablier : 0.
   Fin (grand marché) : coquillages × cote ; collection d'espèces différentes 3 → +2, 4 → +4, 5 → +7 ; +1 par annonce vraie ;
     ½ point par écu restant (arrondi bas). Égalité : places partagées. À 2 : deux indices chacun, le bluff devient un duel.
   SIM (.sim/coq.js, 3000 parties/taille ; IA : estime les cotes inconnues = moyenne des valeurs restantes ± annonces × confiance
     (confiance perdue quand une annonce est démentie), valeur du lot + gain de collection, offre ≈ valeur × k/(k+1) + bruit) :
     victoire relative à 1/n, table mixte n=2/3/4/5/6/8 : honnête 124/135/131/129/117/119 % · menteur 129/120/115/118/110/102 ·
     muet 114/110/105/105/112/93 · collectionneur 98/99/93/112/99/106 · avare 116/106/129/89/110/100 · flambeur 83/86/81/99/83/94 ·
     hasard 38/46/47/50/69/88 % (jouer au hasard perd, aucun style ne domine). Annonces seules (honnête/menteur/muet) :
     108–118 / 96–100 / 87–93 % : dire vrai rapporte un peu, mentir reste jouable. Sièges (miroir) : 50.1/49.9 · n=4
     25.2/26.6/23.9/24.2 · n=8 11.5–13.9 (attendu 12.5). Lots reportés 5–26 %.
     Rejetés : cartes 1–6 « à la Raj » (le hasard gagnait 135–186 % à 6-8), égalité = lot reporté (90 % de reports à 4+),
     offres 0/1/2/3/5/8 (trop d'égalités), écus restants à 1 pt (l'avare gagnait 150–180 %), le Goéland à 2 (pur hasard).
   ===================================================================== */
const COQ={M:3,L:5,BS:[0,1,2,3,4,5,6,7,8,9],P0:10,INC:5,TIE:'next',CV:.5,CO:[0,1,2,3,5],SET:[0,0,0,2,4,7],AT:40,BT:25,MT:16,AN:1,
 SZ:n=>n<=3?2:n>=6?3:Math.random()<.5?2:3,ok:(d,v)=>d>0?v>=3:v<=1};
const cqSv=[/* Saint-Jacques */`<path d="M16 28.5 4.2 12.6C5.8 6.3 10.6 3 16 3s10.2 3.3 11.8 9.6Z" fill="var(--q)"/><path d="M16 28.5 8.6 6.4M16 28.5 12.2 3.7M16 28.5V3.2M16 28.5l3.8-24.8M16 28.5l7.4-22.1" stroke="#0003" stroke-width="1.3" fill="none"/><path d="M12.6 27.4h6.8l-1.6 2.6h-3.6Z" fill="var(--q)"/>`,
 /* Conque */`<path d="M5.5 21.5C4.8 13 10.8 5.4 19.5 5.2c4.6-.1 7.3 2.7 7.2 6.2-.2 5.6-5.7 8.4-9.8 11.6l-6.6 5.5c-2.3 1.4-4.5-.6-4.8-7Z" fill="var(--q)"/><path d="M20.6 9.6c-3.9-.4-7 2.3-7 5.4 0 2.8 3.1 3.8 4.9 1.8" stroke="#0004" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="m25.6 6.3 3.4-3.6M27 11.4l3.6-.8M9 26.5l-3.8 2.6" stroke="var(--q)" stroke-width="2.4" stroke-linecap="round"/>`,
 /* Porcelaine */`<g transform="rotate(-28 16 16)"><ellipse cx="16" cy="16" rx="9.2" ry="13" fill="var(--q)"/><path d="M16 5.6v20.8" stroke="#0004" stroke-width="2.2" stroke-linecap="round"/><path d="M13.2 9h1.8M13 13h2M13 17h2M13.2 21h1.8M17 11h1.8M17 15h2M17 19h1.8" stroke="#0003" stroke-width="1.3" stroke-linecap="round"/><circle cx="11" cy="11" r="1" fill="#fff8"/><circle cx="21" cy="21" r="1" fill="#fff6"/></g>`,
 /* Turritelle */`<g transform="rotate(-42 16 16)"><path d="M16 1.5 22.5 27.5c0 2-13 2-13 0Z" fill="var(--q)"/><path d="M10.6 23.6h10.8M11.6 19.6h8.8M12.6 15.6h6.8M13.6 11.6h4.8M14.6 7.6h2.8" stroke="#0003" stroke-width="1.6" stroke-linecap="round"/></g>`,
 /* Ormeau */`<path d="M3.8 18.4C3.6 9.8 10.4 4 19 4c5.7 0 9.2 3.9 9.2 9 0 8.6-7.8 15-15 15-5.3 0-9.3-3.9-9.4-9.6Z" fill="var(--q)"/><path d="M9.4 21.5c3.6 2.3 9 1.2 12-3.4" stroke="#fff7" stroke-width="2" fill="none" stroke-linecap="round"/><g fill="#0003"><circle cx="7.6" cy="14.2" r="1.4"/><circle cx="10" cy="10.2" r="1.4"/><circle cx="13.8" cy="7.4" r="1.4"/><circle cx="18.2" cy="6" r="1.4"/></g>`];
const cqC=['#f0845a','#e47fae','#e3b03a','#9b7be8','#2fae9b'];
const cqS=(x,cl,st)=>`<svg class="cqs ${cl||''}" style="--q:${cqC[x]};${st||''}" viewBox="0 0 32 32" aria-hidden="true">${cqSv[x]}</svg>`;
GAMES.coq={icon:'🐚',min:2,max:8,dur:10,tags:['social','chance'],COQ,
 init(s){const g=s.game,n=s.order.length,o=s.order;
  g.co=shuf(COQ.CO.slice());const sp=shuf([0,1,2,3,4]);g.kn={};o.forEach((p,i)=>g.kn[p]=n==2?[sp[2*i],sp[2*i+1]]:[sp[i%5]]);
  g.bag=shuf([].concat(...[0,1,2,3,4].map(x=>Array(10).fill(x))));
  g.col={};g.an={};g.ac={};g.b={};g.pu={};o.forEach(p=>{g.col[p]=[0,0,0,0,0];g.an[p]=[];g.pu[p]=COQ.P0});
  g.pc={};g.n=COQ.M*COQ.L;g.m=0;g.i=0;g.hist=[];g.last=null;g.carry=[];g.lt=gPool(s,'coqL',g.n);this.tide(s)},
 tide(s){const g=s.game,n=s.order.length;if(g.m)s.order.forEach(p=>g.pu[p]=(g.pu[p]||0)+COQ.INC);
  g.et=[];for(let i=0;i<COQ.L;i++)g.et.push(g.bag.splice(0,COQ.SZ(n)));
  if(g.carry.length){g.et[0]=g.carry.concat(g.et[0]);g.carry=[]}
  g.ac={};g.ev=null;gWait(g,COQ.AT,'a')},
 act(s,from,a){const g=s.game;
  if(g.st=='a'){if(+a.s===-1)g.ac[from]=0;else{const x=+a.s,d=+a.d;if(!(x>=0&&x<5)||(d!==1&&d!==-1))return;g.ac[from]={s:x,d}}g.done[from]=1;return true}
  if(g.st=='b'){const c=+a.c;if(!COQ.BS.includes(c)||c>(g.pu[from]||0))return;g.b[from]=c;g.done[from]=1;return true}},
 next(s){const g=s.game;
  if(g.st=='a'){s.order.forEach(p=>{const c=g.ac[p];if(c)g.an[p].push({m:g.m,s:c.s,d:c.d})});g.ac={};g.b={};gWait(g,COQ.BT,'b');return}
  if(g.st=='b'){this.res(s);g.b={};g.i++;g.r++;if(g.i<COQ.L){gWait(g,COQ.BT,'b');return}
   if(g.m>=COQ.M-1){g.sea=g.carry.length?g.carry.slice():null;g.carry=[];g.over=1;return}
   /* fin de marée : une cote sort (au hasard parmi les cachées) et les annonces sur elle sont vérifiées */
   const hid=[0,1,2,3,4].filter(x=>g.pc[x]==null),x=hid[Math.floor(Math.random()*hid.length)];g.pc[x]=g.co[x];g.ev={t:'m',s:x};gWait(g,COQ.MT,'m',1);return}
  if(g.st=='m'){g.m++;g.i=0;this.tide(s)}},
 /* offres révélées : la plus haute gagne et paie ; égalité en tête = les deux perdent */
 res(s){const g=s.game,Bd={};s.order.forEach(p=>{let c=+g.b[p]||0;if(c>(g.pu[p]||0))c=0;Bd[p]=c});
  const lot=g.et[g.i].slice(),vs=[...new Set(Object.values(Bd))].sort((a,b)=>b-a);let w=null;const tie=[];
  for(const v of vs){if(v<=0&&COQ.TIE!='zero')break;const T=Object.keys(Bd).filter(p=>Bd[p]==v);if(T.length==1){w=T[0];break}tie.push(v);
   if(COQ.TIE=='few'){const nb=p=>g.col[p].reduce((a,b)=>a+b,0),mn=Math.min(...T.map(nb)),F=T.filter(p=>nb(p)==mn);if(F.length==1){w=F[0];break}}
   if(COQ.TIE!='next')break}
  if(w){lot.forEach(x=>g.col[w][x]++);g.pu[w]-=Bd[w]}
  else{if(g.i+1<COQ.L)g.et[g.i+1]=lot.concat(g.et[g.i+1]);else g.carry=lot.slice()}
  const h={m:g.m,i:g.i,lot,b:Bd,w,tie};g.hist.push(h);g.last=h},
 /* grand marché : coquillages × cote + collection + annonces vraies */
 tally(s){const g=s.game,T={};s.order.forEach(p=>{const c=g.col[p]||[0,0,0,0,0],sh=c.reduce((a,k,x)=>a+k*g.co[x],0),d=c.filter(Boolean).length,
   an=(g.an[p]||[]).filter(a=>COQ.ok(a.d,g.co[a.s])).length*COQ.AN;const pu=Math.floor((g.pu[p]||0)*COQ.CV);T[p]={sh,set:COQ.SET[d],an,d,pu,t:sh+COQ.SET[d]+an+pu}});return T},
 fin(s){const g=s.game,T=this.tally(s);s.order.forEach(p=>g.sc[p]=T[p].t);g.T=T;return{pts:g.sc}},
 /* secrets : cotes cachées, sac, indices des autres, annonces et offres en cours */
 hide(g,n){const o={...g};delete o.co;delete o.bag;delete o.T;o.kn={[n]:(g.kn[n]||[]).slice()};o.my={};(g.kn[n]||[]).forEach(x=>o.my[x]=g.co[x]);
  if(g.st=='a')o.ac=hideOwn(g.ac,n);if(g.st=='b')o.b=hideOwn(g.b,n);return o},
 log(s){const g=s.game,L=[],T=g.T||this.tally(s);
  s.order.forEach(p=>{const A=g.an[p]||[],ok=A.filter(a=>COQ.ok(a.d,g.co[a.s])).length;if(T[p]&&T[p].d==5)L.push({k:'coqS',n:[p]});
   if(A.length>=2&&!ok)L.push({k:'coqF',n:[p]});if(A.length>=3&&ok==A.length)L.push({k:'coqT',n:[p]})});
  const big=g.hist.filter(h=>h.w).sort((a,b)=>b.lot.length-a.lot.length)[0];if(big&&big.lot.length>=5)L.push({k:'coqB',n:[big.w]});return L},/* 📜 */
 /* ---------- vue ---------- */
 nm(x){return GT('cqN').split('|')[x]||''},
 lotH(l,cl){return `<span class="cqlot ${cl||''}">${l.map((x,i)=>cqS(x,'',cl=='big'?`animation-delay:${(.06*i).toFixed(2)}s`:'')).join('')}</span>`},
 /* l'étal de la marée : lots vendus (pastille), lot en cours, lots à venir */
 stall(g){return `<div class="cqst">${g.et.map((l,i)=>{const h=g.hist.find(x=>x.m==g.m&&x.i==i),cur=g.st=='b'&&i==g.i;
   return `<div class="cqsl ${cur?'on':''} ${h?'past':''}">${this.lotH(h?h.lot:l,'xs')}${h?`<i class="cqsw">${h.w?DT(h.w):'↪'}</i>`:''}</div>`}).join('')}</div>`},
 /* résultat d'un lot : toutes les offres, égalités barrées */
 resH(h,m){if(!h)return '';const E=Object.entries(h.b).sort((a,b)=>b[1]-a[1]);
  const who=h.w?`→ ${h.w==m?`<b>${esc(GT('me'))}</b>`:B(h.w)} <span class="cqpay">${GT('cqPay',{v:h.b[h.w]})}</span>`:`<b class="mut">↪ ${GT('cqCarry')}</b>`;
  return `<div class="cqres ga">${this.lotH(h.lot,'sm')}<span class="cqwho">${who}</span><span class="cqbids" dir="ltr">${E.map(([p,c],i)=>
   `<span class="cqbid ${p==h.w?'w':''} ${h.tie.includes(c)?'x':''}" ${dl(i,.12)}>${DT(p)}<b>${c}</b></span>`).join('')}</span></div>`},
 /* tableau des cotes : révélée / mon indice / ? ; annonces (▲ ▼ à la couleur de chacun), vérifiées quand la cote sort */
 board(s,g){const my=g.my||{},pc=g.pc||{},co=g.co;
  return `<div class="cqbd">${[0,1,2,3,4].map(x=>{const rv=co?co[x]:pc[x],v=rv!=null?rv:my[x],kn=rv==null&&my[x]!=null,A=[];
   s.order.forEach(p=>(g.an[p]||[]).forEach(a=>{if(a.s==x)A.push([p,a])}));
   return `<div class="cqcol" data-tip="${esc(this.nm(x))}">${cqS(x)}<b class="cqv ${kn?'kn':''} ${rv!=null?'rv':''}">${v!=null?v:'?'}</b><span class="cqan">${A.map(([p,a])=>
    `<i style="--c:${col(p)}" class="${rv!=null?(COQ.ok(a.d,rv)?'t':'f'):''}">${a.d>0?'▲':'▼'}</i>`).join('')}</span></div>`}).join('')}</div>`},
 coll(c){return c.map((k,x)=>k?`<span class="cqk">${cqS(x,'xs')}<b>${k}</b></span>`:'').join('')},
 crew(s,g,m){return `<div class="cqcr">${s.order.map(p=>`<div class="cqm ${p==m?'me':''}"><span class="cqnm">${DT(p)}<b>${p==m?esc(GT('me')):esc(p)}</b></span>
   <span class="cqco">${this.coll(g.col[p]||[])||'<i class="mut">·</i>'}</span><span class="cqpu" dir="ltr">🪙 ${g.pu[p]||0}</span>${g.done[p]&&g.st!='m'?'<i class="tpok" aria-hidden="true"></i>':''}</div>`).join('')}</div>`},
 tips(g){const my=g.my||{};return `<div class="cqtips">${Object.keys(my).map(x=>`<span class="cqtip">🔍 ${cqS(+x)}<span>${esc(this.nm(+x))}</span><b>${my[x]}</b></span>`).join('')}</div>`},
 view(s){const g=s.game,m=meN(),R=this,play=s.order.includes(m),L=g.last;
  const tide=`<p class="cqh"><b>🌊 ${GT('cqTide',{v:g.m+1,n:COQ.M})}</b>${g.st=='b'?` · ${GT('cqLot',{v:g.i+1,n:COQ.L})}`:''}</p>`;
  if(g.st=='m'){const x=(g.ev||{}).s,A=[];s.order.forEach(p=>(g.an[p]||[]).forEach(a=>{if(a.s==x)A.push([p,a])}));
   return{html:`<div class="card c">${tide}${R.resH(L,m)}<div class="cqrv"><div class="cqrvs ga" ${dl(2)}>${cqS(x,'big')}<b class="cqbig">${g.pc[x]}</b></div>
    <p class="gby2 ga" ${dl(3)}>${GT('cqOut',{s:esc(R.nm(x)),v:g.pc[x]})}</p>
    ${A.length?`<div class="gvl">${A.map(([p,a],i)=>{const ok=COQ.ok(a.d,g.pc[x]);return `<span class="gchip ga ${ok?'ok':''}" ${dl(i,.6)}>${DT(p)}${esc(p)} ${a.d>0?'📈':'📉'} ${ok?'✓ +'+COQ.AN:'✗'}</span>`}).join('')}</div>`:`<p class="gnote mut ga" ${dl(4)}>${GT('cqNoAn')}</p>`}</div>
    <p class="gnote ga" ${dl(5)}>🪙 ${GT('cqInc',{v:COQ.INC})}</p>${R.board(s,g)}${R.crew(s,g,m)}</div>`,bind(){if(!RM()&&A.some(([p,a])=>p==m&&COQ.ok(a.d,g.pc[x])))sparkles($('.cqrvs'),12)}}}
  if(g.st=='a'){const cur=g.ac[m],K='ca'+g.k;if(R.ak!==K){R.ak=K;R.dir=cur&&cur.d||1}
   return{html:`<div class="card c">${tide}<p class="gpre">${GT('cqStall')}</p>${R.stall(g)}${play?R.tips(g):''}
    ${play?`<p class="gq2">📣 ${GT('cqAnQ')}</p><div class="cqdir" role="group">${[1,-1].map(d=>`<button class="ghost ${R.dir==d?'sel':''}" data-cqd="${d}" aria-pressed="${R.dir==d}">${d>0?'📈 '+GT('cqUp'):'📉 '+GT('cqDn')}</button>`).join('')}</div>
    <div class="cqsp">${[0,1,2,3,4].map((x,i)=>`<button class="ghost ga ${cur&&cur.s==x?'sel':''}" ${dl(i)} data-cqs="${x}" aria-pressed="${!!(cur&&cur.s==x)}" aria-label="${esc(R.nm(x))}">${cqS(x)}<small>${esc(R.nm(x))}</small></button>`).join('')}</div>
    <button class="ghost wide cqmu ${cur===0?'sel':''}" data-cqs="-1" aria-pressed="${cur===0}">🤐 ${GT('cqMute')}</button><p class="cqnote">${GT('cqAnD')}</p>`:''}
    ${R.board(s,g)}${R.crew(s,g,m)}</div>`,
    bind(){$$('[data-cqd]').forEach(b=>b.onclick=()=>{R.dir=+b.dataset.cqd;const c=g.ac[m];if(c)gs({s:c.s,d:R.dir});else render()});
     $$('[data-cqs]').forEach(b=>b.onclick=()=>gs({s:+b.dataset.cqs,d:R.dir}))}}}
  const lot=g.et[g.i]||[],t=g.lt&&g.lt[g.r]?GC('coqL',g.lt[g.r]):'',pu=g.pu[m]||0,my=g.b[m];
  return{html:`<div class="card c">${tide}${R.stall(g)}${L&&L.m==g.m?R.resH(L,m):''}
   <div class="cqcur">${t?`<p class="cqlt">${esc(t)}</p>`:''}${R.lotH(lot,'big')}</div>
   ${play?`<p class="gq2">🪙 ${GT('cqBid',{v:pu})}</p><div class="cqpad" dir="ltr">${COQ.BS.map(v=>`<button class="cqc ${my==v?'sel':''} ${v?'':'z'}" data-cq="${v}" ${v>pu?'disabled':''} aria-pressed="${my==v}">${v}</button>`).join('')}</div>
   <p class="cqnote">${GT(my==null?'cqAuto':'cqTie')}</p>${R.tips(g)}`:''}${R.board(s,g)}${R.crew(s,g,m)}</div>`,
   bind(){$$('[data-cq]').forEach(b=>b.onclick=()=>gs({c:+b.dataset.cq}))}}},
 endView(s){const g=s.game,T=g.T||this.tally(s),m=meN(),R=this;
  return `<div class="cqendl">${g.sea?`<p class="gnote mut">🌊 ${GT('cqSea')}</p>`:g.last?R.resH(g.last,m):''}</div><h3 class="gh3">🐚 ${GT('cqMk')}</h3>
   <div class="cqfin">${[0,1,2,3,4].map((x,i)=>`<div class="cqfc ga" ${dl(i,.2)}>${cqS(x)}<b>${g.co[x]}</b><small>${esc(R.nm(x))}</small></div>`).join('')}</div>
   <div class="cqtl">${[...s.order].sort((a,b)=>T[b].t-T[a].t).map((p,i)=>{const t=T[p];
    return `<div class="cqtr ga ${p==m?'me':''}" ${dl(i,.5)}><span class="cqnm">${DT(p)}<b>${esc(p)}</b></span><span class="cqco">${R.coll(g.col[p])}</span>
     <span class="cqpt" dir="ltr">🐚 ${t.sh}${t.set?` · 🎨 +${t.set}`:''}${t.an?` · 📣 +${t.an}`:''}${t.pu?` · 🪙 +${t.pu}`:''}</span><b class="cqtot">${t.t}</b></div>`}).join('')}</div>
   <p class="mut cqlg">🐚 ${GT('cqSh')} · 🎨 ${GT('cqSet')} · 📣 ${GT('cqAnn')} · 🪙 ${GT('cqLeft')}</p>`}};
/* /🐚 */

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
 pt(v,cl){const m=String(v).match(/^([+−-]?)(\d+|½)$/);if(m)v=GTn('ptsS',m[1].replace('-','−')+m[2]);return `<b class="tpt ${cl||''}" dir="ltr">${v}</b>`},
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
  {k:'tu_bot5',x:'2',s:()=>[0,1].map(i=>TU.e(80+140*i,150,TU.av(i))+[0,1,2].map(j=>TU.e(44+140*i+36*j,104,TU.cd(j==2?'🎭':'✅'),.3+.2*j+.6*i,'p')).join('')).join('')+TU.e(80,62,TU.pt('+2'),2,'p')+TU.e(220,62,TU.pt('+2'),2.3,'p')}],
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
  {k:'tu_pec1',d:6,s:()=>`<i class="tsea"></i>`+TU.e(150,40,'👜',0,'p big')+['🦪','🦪','🦪','🦪','🦪','🪼','🪼','🦈','🦈','🦈','🦈','🦈'].map((x,i)=>TU.e(65+34*(i%6),84+28*(i>5),x,.5+.12*i,'p')).join('')+[0,1,2].map(i=>TU.mv(75+75*i,0,75+75*i,150,TU.av(i,false),2+.2*i)).join('')},
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
  {k:'tu_arc4',s:()=>tuHex()+TU.e(127.5,64,'🏝️',.8,'p')+TU.e(127.5,38,TU.bt(0))+TU.e(127.5,13,TU.av(0,false),0,'a sm')},
  {k:'tu_arc5',d:6,s:()=>tuHex()+TU.e(172.5,64,'🏝️',0,'o','--o:2.6s')+TU.e(172.5,64,'🌊',2.7,'p')+TU.e(172.5,38,TU.bt(0))+TU.e(172.5,13,TU.av(0,false),0,'a sm')+TU.e(195,90,TU.bt(1),0,'o','--o:1.6s')+TU.mv(195,90,172.5,129,TU.bt(1),1.6,'','--op0:0')+TU.e(218,64,'🛡️',.4,'p o','--o:1.6s')+TU.e(150,160,TU.pt('💥','no'),2.7,'p')},
  {k:'tu_arc6',s:()=>tuHex(0,0)+TU.e(105,90,TU.bt(0),0,'a k2')+TU.e(195,90,TU.bt(1),0,'a k2')+TU.mv(122,90,135,90,'➡️',.3)+TU.mv(178,90,165,90,'⬅️',.3)+TU.e(150,90,'💥',1.2,'p big')},
  {k:'tu_arc7',d:6,s:()=>tuHex(1)+TU.e(150,92,'🏝️')+TU.e(195,92,'🏝️',0,'o','--o:2.4s')+TU.e(145,68,TU.pt('+3'),.4,'p')+TU.e(210,68,TU.pt('+2'),.7,'p')+TU.e(84,129,TU.pt('+2'),1,'p')+TU.e(127.5,129,'🏝️',0,'o','--o:2.4s')+TU.e(150,165,'🌊 🌊 🌊',2.2,'p')}],
 msk:[
  {k:'tu_msk1',s:()=>TU.e(150,145,TU.av(0))+TU.e(150,112,'🎭',.3,'p')+TU.e(80,50,'🐙',.8,'p big')+TU.e(220,50,'🦀',1.1,'p big')+TU.e(80,86,'?',1.3,'p')+TU.e(220,86,'?',1.4,'p')},
  {k:'tu_msk2',s:()=>TU.e(150,145,TU.av(0))+TU.e(150,40,'🐙',0,'a big')+TU.mv(150,120,150,78,TU.cd('💬 …'),.3)+TU.e(100,110,TU.cd('🤝🏻'),1.3,'p')+TU.e(200,110,TU.cd('🔒'),1.5,'p')},
  {k:'tu_msk3',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🤝🏻'),.2,'p')+TU.e(220,130,TU.cd('🤝🏻'),.4,'p')+TU.e(80,40,TU.pt('+4'),1,'p')+TU.e(220,40,TU.pt('+4'),1.1,'p')+TU.e(150,80,'🔗',1.5,'p big')},
  {k:'tu_msk4',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🤝🏻'),.2,'p')+TU.e(220,130,TU.cd('🔒'),.4,'p')+TU.e(80,40,TU.pt('+1','no'),1,'p')+TU.e(220,40,TU.pt('+4'),1.1,'p')+TU.e(264,50,'🦈',1.7,'p')},
  {k:'tu_msk5',s:()=>TU.e(80,80,'🐙',0,'a big')+TU.e(120,50,'🦈')+TU.e(220,80,'🎭',0,'a big')+TU.e(80,130,TU.cd('🔒'),.2,'p')+TU.e(220,130,TU.cd('🔒'),.4,'p')+TU.e(80,40,TU.pt('+2'),1,'p')+TU.e(220,40,TU.pt('+2'),1.1,'p')+TU.e(258,62,'✓',1.7,'p')},
  {k:'tu_msk6',d:7,s:()=>TU.e(70,140,TU.av(0))+TU.e(230,140,TU.av(1))+TU.e(150,40,TU.cd('16','ok'),0,'p')+
   [['🤝🏻','🤝🏻','+8','+8',.3,1.9],['🗡️','🤝🏻','+16','0',2.1,3.7],['🗡️','🗡️','−8','−8',3.9,0]].map(([a,b,x,y,d,o])=>{const O=o?'p o':'p';return TU.e(70,100,TU.cd(a),d,O,'--o:'+o+'s')+TU.e(230,100,TU.cd(b),d+.1,O,'--o:'+o+'s')+TU.e(70,72,TU.pt(x,x[0]=='−'?'no':''),d+.6,O,'--o:'+o+'s')+TU.e(230,72,TU.pt(y,y[0]=='−'||y=='0'?'no':''),d+.7,O,'--o:'+o+'s')}).join('')}]};
/* 🧭 tutoriel de La Chaîne des Phares */
TUS.chn=[
 {k:'tu_chn1',s:()=>[0,1,2].map(i=>TU.e(60+90*i,145,TU.av(i))).join('')+TU.e(60,40,'🧭',0,'p big')+TU.e(60,98,TU.cd('⭐','ok'),.4,'p o','--o:1.6s')+TU.mv(60,98,150,98,TU.cd('⭐'),1.5,'','--op0:0')},
 {k:'tu_chn2',d:6,s:()=>[0,1,2].map(i=>TU.e(60+90*i,145,TU.av(i))).join('')+TU.e(150,98,TU.cd('⭐'),0,'a o','--o:1.2s')+TU.mv(150,98,240,98,TU.cd('🌙','no'),1.2,'','--op0:0')+TU.e(240,52,'🏴‍☠️ ❓',2.2,'p')},
 {k:'tu_chn3',d:6,s:()=>`<i class="tsea"></i>`+TU.e(150,46,'⛵',.2,'p big o','--o:1.8s')+TU.e(150,46,'💥',1.8,'p big')+TU.e(150,96,TU.cd('⭐ ≠ 🌙','no'),1,'p')+TU.e(150,150,TU.cd(TU.n().slice(0,3).map(esc).join(' <i class="charr">➜</i> ')),2.4,'p')},
 {k:'tu_chn4',d:6,s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+[0,1,3].map((i,j)=>TU.e(45+70*i,108,'✋🏻',.3+.25*j,'p')).join('')+TU.e(185,104,'⛓️',1.6,'p big')+TU.e(185,56,TU.cd('🌙 › 🌙'),2.4,'p')},
 {k:'tu_chn5',d:6,s:()=>[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+TU.e(45,108,'🕵🏻',.3,'p')+TU.e(115,108,'🕵🏻',.5,'p')+TU.e(255,108,'🏴‍☠️',1.5,'p big')+TU.e(45,66,TU.pt('+2'),2.1,'p')+TU.e(115,66,TU.pt('+2'),2.2,'p')+TU.e(185,66,TU.pt('+2'),2.3,'p')}];
/* 🐙 tutoriel du Mimétique : grotte sombre, halo de lampe autour de chaque plongeur */
const tuDv=(i,dis)=>'<i class="tlamp"></i>'+TU.av(i,false)+(dis?'<small>🎭</small>':'');
TUS.mim=[
 {k:'tu_mim1',s:()=>'<i class="tcave"></i>'+TU.e(225,55,'👆🏻',.2,'p o','--o:1.2s')+TU.e(225,55,'<i class="tring"></i>',.3,'p o','--o:1.4s')+TU.mv(70,130,225,62,tuDv(0),.9)+TU.e(150,160,TU.cd('⚓ 🪸 🌿'),2.2,'p')},
 {k:'tu_mim2',d:6,s:()=>'<i class="tcave"></i>'+TU.e(150,90,TU.dot(0),0,'a o','--o:1.5s')+TU.e(240,60,TU.dot(0),0,'a o','--o:2.6s')+TU.e(110,130,TU.dot(1))+TU.mv(50,110,150,90,tuDv(0),.2,'o','--o:1.5s')+TU.mv(150,90,240,60,tuDv(0),1.5,'','--op0:0')+TU.e(150,62,TU.pt('+1'),1.5,'p')+TU.e(240,30,TU.pt('+1'),2.6,'p')+TU.e(150,160,TU.cd('🦪 21 / 30'),2.9,'p')},
 {k:'tu_mim3',d:7,s:()=>'<i class="tcave"></i>'+TU.e(110,95,'<i class="tlamp"></i>🐙',0,'a big o','--o:1.3s')+TU.e(110,95,'<i class="tink"></i>',1.1,'p o','--o:2.2s')+TU.e(110,95,tuDv(1,1),1.4,'p o','--o:2.4s')+TU.mv(110,95,230,70,tuDv(1,1),2.4,'','--op0:0')+TU.e(230,70,TU.dot(1),0,'a o','--o:3.3s')+TU.e(150,158,TU.cd('🐙 '+esc(TU.n()[1])+' · ⚓','no'),3.5,'p')},
 {k:'tu_mim4',d:6,s:()=>'<i class="tcave"></i>'+TU.e(70,80,tuDv(0))+TU.e(110,80,tuDv(1))+TU.e(90,130,TU.cd('🙋🏻 '+esc(TU.n()[1])),.3,'p')+TU.e(235,80,'⚓',0,'a big')+TU.e(235,125,TU.cd('🐙 '+esc(TU.n()[1]),'no'),.6,'p')+TU.e(235,40,'❓🎭',1.6,'p')+TU.e(160,80,'↔️',2.2,'p')},
 {k:'tu_mim5',d:7,s:()=>TU.e(150,24,'📯',0,'p big')+[0,1,2,3].map(i=>TU.e(45+70*i,150,TU.av(i))).join('')+[0,1,2].map((i,j)=>TU.e(45+70*i,108,'✋🏻',.6+.25*j,'p')).join('')+TU.e(255,104,'🐙',2,'p big')+TU.e(150,66,TU.cd('🎭 ✕','ok'),2.7,'p')},
 {k:'tu_mim6',d:6,s:()=>TU.e(80,50,TU.cd('🦪 30 / 30','ok'),.2,'p')+TU.e(80,95,'🤿',.6,'p big')+TU.e(80,140,TU.cd('🐙 ✕ ✕','ok'),1,'p')+TU.e(150,95,TU.cd('/'),0,'a')+TU.e(220,50,TU.cd('🐙 3 / 3','no'),1.6,'p')+TU.e(220,95,'🐙',2,'p big')+TU.e(220,140,TU.cd('⏱ 0:00','no'),2.4,'p')}];
/* ⚫ tutoriel de La Perle noire : 5 coffres en haut, trésors en émojis, perle blanche = nacre, perle noire = Perle noire */
const tuP3=()=>[0,1,2].map(i=>TU.e(60+90*i,152,TU.av(i))).join(''),tuCh=(hl,d,o)=>[0,1,2,3,4].map(i=>TU.e(46+52*i,24,TU.cd(i===hl?'💎':'🧰',i===hl?'ok':''),(d||0)+.08*i,o||'p')).join(''),
 tuRo=d=>TU.e(60,112,'<i class="prp"></i>',d)+TU.e(150,112,'<i class="prp"></i>',d)+TU.e(240,112,'<i class="prbk big"></i>',d);
TUS.prl=[
 {k:'tu_prl1',d:6,s:()=>tuCh(-1)+tuP3()+tuRo(.6)+TU.e(150,24,TU.cd('💎','ok'),1.6,'p')+TU.mv(60,112,128,52,'👀',2,'','--op0:0')+TU.mv(150,112,172,52,'👀',2.2,'','--op0:0')+TU.e(240,72,'❓',2.6,'p big')},
 {k:'tu_prl2',d:7,s:()=>['🧺','🍉','⛺','🎣'].map((e,i)=>TU.e(75+50*i,22,TU.cd(e),.1*i,'p')).join('')+tuP3()+tuRo(0)+
  [0,1,2].map(i=>TU.e(60+90*i,82,'🫧',.5+.2*i,'p o','--o:2s')+TU.e(60+90*i,82,TU.cd(i<2?'🧺':'🎣',i<2?'ok':''),2.1,'p')).join('')+TU.e(105,82,'🔗',2.7,'p')+TU.e(60,54,TU.pt('+1'),3.1,'p')+TU.e(150,54,TU.pt('+1'),3.2,'p')},
 {k:'tu_prl3',d:6,s:()=>tuP3()+tuRo(0)+[0,1].map(i=>TU.e(60+90*i,82,TU.cd('🧺'))).join('')+TU.e(240,82,'🫧',.2,'p o','--o:1s')+TU.e(240,82,TU.cd('🧺'),1.1,'p')+
  TU.mv(240,70,105,82,'✋🏻',1.7,'','--op0:0')+TU.e(60,50,TU.pt('0','no'),2.4,'p')+TU.e(150,50,TU.pt('0','no'),2.5,'p')+TU.e(240,50,TU.pt('+1'),2.6,'p')},
 {k:'tu_prl4',d:7,s:()=>tuCh(-1,0,'a')+TU.e(150,24,TU.cd('💎','ok'),2.2,'p')+TU.e(60,152,TU.av(0))+TU.e(150,152,TU.av(1))+TU.mv(240,152,150,72,TU.av(2,false),.4)+TU.e(150,98,'🤿',.9,'p')+
  TU.e(205,72,TU.pt('+3'),2.8,'p')+TU.e(232,128,TU.cd(`${GT('prTn',{i:2})} : ${gPs(3)}<br>${GT('prTn',{i:3})} : ${gPs(2)}`,'sm2'),3.4,'p')},
 {k:'tu_prl5',d:6,s:()=>tuCh(-1,0,'a')+TU.e(150,24,TU.cd('💎','ok'),1.8,'p')+TU.e(254,24,TU.cd('✗','no'),1.2,'p')+TU.mv(240,152,254,74,TU.av(2,false),.3)+TU.e(254,100,'🤿',.7,'p')+
  TU.e(60,152,TU.av(0))+TU.e(150,152,TU.av(1))+TU.e(60,112,TU.pt('+2'),2.4,'p')+TU.e(150,112,TU.pt('+2'),2.6,'p')},
 {k:'tu_prl6',d:6,s:()=>tuP3()+[0,1,2].map(i=>TU.e(60+90*i,104,'<i class="prbk big"></i>',.3+1.3*i,i<2?'p o':'p',i<2?'--o:'+(1.5+1.3*i)+'s':'')+TU.e(60+90*i,72,TU.pt('#'+(i+1)),.4+1.3*i,'p')).join('')}];

/* ⛈️ tutoriel de Tempête : vagues en cartes, houle, écume */
const tu3A=()=>[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))).join(''),tuTk=()=>TU.e(150,40,'<i class="tutrk"></i>');
TUS.tmp=[
 {k:'tu_tmp1',s:()=>tu3A()+[[12,'🌊12'],[47,'🌊47'],[83,'🌊83']].map((x,i)=>TU.e(60+90*i,104,TU.cd(x[1]),.3+.3*i,'p')).join('')+TU.e(150,40,'🤫',1.4,'p big')},
 {k:'tu_tmp2',d:6,s:()=>tu3A()+TU.e(150,36,'〰️',0,'p big')+[0,1,2].map(i=>TU.e(60+90*i,104,TU.cd(i?'⏳':'🌊',i?'':'ok'),.8+.2*i,'p')).join('')+TU.e(150,36,'〰️',2.6,'p big')+[0,1,2].map(i=>TU.e(60+90*i,70,TU.cd(i==1?'🌊':'⏳',i==1?'ok':''),3+.2*i,'p')).join('')},
 {k:'tu_tmp3',d:6,s:()=>tu3A()+tuTk()+TU.mv(60,104,62,62,TU.cd('12','ok'),.4)+TU.mv(150,104,148,62,TU.cd('47','ok'),1.6)+TU.mv(240,104,232,62,TU.cd('83','ok'),2.8)+TU.e(150,18,'✓',3.6,'p')},
 {k:'tu_tmp4',d:6,s:()=>tu3A()+tuTk()+TU.e(240,104,TU.cd('30'),0,'a o','--o:1.6s')+TU.mv(150,104,175,62,TU.cd('47','no'),.4)+TU.e(240,104,TU.cd('30'),1.2,'p k')+TU.mv(240,104,85,62,TU.cd('<s>30</s>'),1.7,'','--op0:0')+TU.e(150,18,'💥',1.9,'p big')+TU.e(262,24,TU.pt('−1 ⛵','no'),2.4,'p')},
 {k:'tu_tmp5',d:6,s:()=>tu3A()+TU.e(150,56,TU.cd('⛈️ 3'),0,'a o','--o:1.1s')+TU.e(150,56,TU.cd('⛈️ 2'),1.1,'p o','--o:2.2s')+TU.e(150,56,TU.cd('⛈️ 1','no'),2.2,'p o','--o:3.3s')+TU.e(150,56,'⛈️',3.3,'p big k')+[0,1,2].map(i=>TU.e(60+90*i,104,TU.cd('🌊'),0,'a o','--o:3.5s')).join('')},
 {k:'tu_tmp6',d:6,s:()=>tu3A()+TU.e(150,36,'🌅',.2,'p big')+[0,1,2].map(i=>TU.e(60+90*i,104,'✋🏻',.5+.2*i,'p o','--o:1.6s')+TU.e(60+90*i,104,TU.cd(['11–20','41–50','81–90'][i],'ok'),1.7+.25*i,'p')).join('')},
 {k:'tu_tmp7',d:6,s:()=>tu3A()+TU.e(150,40,TU.cd('🔢 ✕','no'),.2,'p')+[['😎',0],['🫧',1],['😱',2]].map(([e,i])=>TU.e(60+90*i,104,e,.8+.3*i,'p big')).join('')}];
/* 🐚 tutoriel des Marchands de coquillages : coquillages en SVG, offres en cartes, annonces en bulles */
const tuQ=i=>cqS(i),tuL=(a,b)=>`<span class="tql">${cqS(a)}${cqS(b)}</span>`,tuQ3=()=>[0,1,2].map(i=>TU.e(60+90*i,150,TU.av(i))).join('');
TUS.coq=[
 {k:'tu_coq1',d:6,s:()=>[0,1,2,3,4].map(i=>TU.e(50+50*i,40,tuQ(i),.12*i,'p')+TU.e(50+50*i,76,TU.cd('?'),.8+.1*i,'p')).join('')+TU.e(80,148,TU.av(0))+TU.e(190,148,TU.cd('🔍 '+tuQ(2)+' = 5','ok'),2,'p')},
 {k:'tu_coq2',d:6,s:()=>tuQ3()+TU.e(150,30,tuL(0,3),0,'p big o','--o:2.6s')+[4,6,2].map((v,i)=>TU.e(60+90*i,104,TU.cd('🂠'),.3+.2*i,'p o','--o:1.5s')+TU.e(60+90*i,104,TU.cd(v,i==1?'ok':''),1.6,'p')).join('')+TU.mv(150,30,150,66,tuL(0,3),2.6,'','--op0:0')+TU.e(222,66,TU.pt('−6 🪙','no'),3.1,'p')},
 {k:'tu_coq3',d:6,s:()=>tuQ3()+TU.e(150,30,tuL(1,4),0,'p big o','--o:2.4s')+[5,5,3].map((v,i)=>TU.e(60+90*i,104,TU.cd(v,i<2?'no':'ok'),.3+.15*i,'p')).join('')+TU.e(105,104,'✕',1.3,'p big')+TU.mv(150,30,240,66,tuL(1,4),2.4,'','--op0:0')},
 {k:'tu_coq4',d:6,s:()=>tuQ3()+TU.e(60,100,TU.cd('📈 '+tuQ(1)),.3,'p')+TU.e(150,100,TU.cd('📉 '+tuQ(3)),.7,'p')+TU.e(240,100,TU.cd('🤐'),1.1,'p')+TU.e(150,40,'🤥 ?',2,'p big')},
 {k:'tu_coq5',d:6,s:()=>TU.e(150,40,tuQ(1),0,'p big')+TU.e(195,40,TU.cd('5','ok'),.8,'p')+TU.e(80,150,TU.av(0))+TU.e(220,150,TU.av(1))+TU.e(80,104,TU.cd('📈 '+tuQ(1)),.2,'a')+TU.e(220,104,TU.cd('📉 '+tuQ(1)),.2,'a')+TU.e(80,72,TU.pt('✓ +1'),1.6,'p')+TU.e(220,72,TU.pt('✗','no'),1.9,'p')},
 {k:'tu_coq6',d:6,s:()=>[0,1,2,3,4].map(i=>TU.e(50+50*i,40,tuQ(i),.1*i,'p')).join('')+TU.e(150,82,TU.pt('🎨 +7'),1,'p')+TU.e(90,134,TU.cd('🪙 6'),1.5,'p')+TU.e(150,134,'→',1.8,'p')+TU.e(210,134,TU.pt('+3'),2.1,'p')},
 {k:'tu_coq7',x:'2',s:()=>TU.e(80,150,TU.av(0))+TU.e(220,150,TU.av(1))+TU.e(80,100,TU.cd('🔍 '+tuQ(0)+' '+tuQ(2)),.3,'p')+TU.e(220,100,TU.cd('🔍 '+tuQ(3)+' '+tuQ(4)),.6,'p')+TU.e(150,40,'⚔️',1.4,'p big')}];
for(const id in TUS)if(GAMES[id])GAMES[id].tut=TUS[id];
const GTU={id:null,i:0,t:null};
/* scène dessinée sur 300×180 et mise à l'échelle d'un bloc (transform) : mêmes proportions partout, rien ne déborde à 375 px */
function gTuFit(){const b=$('.gtu .tus'),c=b&&b.firstElementChild;if(c)c.style.setProperty('--k',(b.clientWidth/300).toFixed(4))}W.GTuFit=gTuFit;
if(typeof window!='undefined'&&window.addEventListener)window.addEventListener('resize',()=>{if($('.gtu'))gTuFit()});
W.GTut=function(id){const G=GAMES[id];if(!G||!G.tut||typeof document=='undefined')return false;
 const nOn=(()=>{try{return st&&st.phase=='game'&&st.order?st.order.length:st.players.filter(p=>p.online).length}catch(e){return 3}})();
 const L=G.tut.filter(x=>!x.x||(x.x=='2'?nOn==2:nOn!=2));GTU.id=id;GTU.i=0;
 const box=$('#modal');if(!box)return false;
 box.innerHTML=`<div class="modal gtu" role="dialog" aria-modal="true" aria-label="${esc(GT('n_'+id))}"><div class="card"><div class="tuh"><span>${G.icon}</span><b>${GT('n_'+id)}</b><button class="tux" id="tux" aria-label="${esc(GT('tuClose'))}" data-tip="${esc(GT('tuClose'))}">✕</button></div>
  <div class="tuw"><div class="tus" aria-hidden="true"></div><button class="turp" id="tuag" aria-label="${esc(GT('tuAgain'))}" data-tip="${esc(GT('tuAgain'))}">↺</button></div>
  <p class="tucap" aria-live="polite"></p><div class="steps">${L.map((_,j)=>`<button class="tud" data-s="${j}" aria-label="${j+1} / ${L.length}"></button>`).join('')}</div>
  <div class="row"><button class="ghost" id="tupv">${document.dir=='rtl'?'▶':'◀'} ${GT('tuPrev')}</button><button class="pri" id="tunx"></button></div></div></div>`;
 const nm=TU.n(),tw=TU.w(),V={a:nm[0],b:nm[1],c:nm[2],d:nm[3],w0:tw[0],w1:tw[1],w2:tw[2],w3:tw[3]};
 const show=j=>{clearTimeout(GTU.t);GTU.i=j;const S=L[j],stg=$('.gtu .tus');if(!stg)return;
  stg.textContent='';void stg.offsetWidth;/* nouveau nœud : la scène repart de zéro (Revoir, boucle) */
  stg.innerHTML=`<div class="tusc">${S.s()}</div>`;gTuFit();$('.gtu .tucap').innerHTML=esc(GT(S.k,V));
  $$('.gtu .steps .tud').forEach((el,k)=>{el.className='tud'+(k==j?' on':k<j?' done':'');el.setAttribute('aria-current',k==j?'step':'false')});
  const last=j==L.length-1;$('#tunx').textContent=last?GT('tuOk'):T('next')+(document.dir=='rtl'?' ◀':' ▶');$('#tupv').disabled=!j;
  if(!RM())GTU.t=setTimeout(()=>{if($('.gtu')&&GTU.i==j)show(j)},(S.d||5)*1000)};/* la scène rejoue en boucle */
 const close=()=>{clearTimeout(GTU.t);document.removeEventListener('keydown',key,true);const m=$('.gtu');if(!m)return;m.classList.add('closing');setTimeout(()=>{if($('.gtu'))$('#modal').textContent=''},240)};
 const key=e=>{if(!$('.gtu')){document.removeEventListener('keydown',key,true);return}
  if(e.key=='Escape'){e.preventDefault();close()}else if(e.key=='ArrowRight'||e.key=='ArrowLeft'){const rtl=document.dir=='rtl'||document.documentElement.dir=='rtl',fw=(e.key=='ArrowRight')!=rtl;
   if(fw&&GTU.i<L.length-1)show(GTU.i+1);else if(!fw&&GTU.i>0)show(GTU.i-1)}};
 document.addEventListener('keydown',key,true);
 $$('.gtu .steps .tud').forEach(el=>el.onclick=()=>show(+el.dataset.s));
 $('#tuag').onclick=()=>{const b=$('#tuag');b.classList.remove('spin');void b.offsetWidth;b.classList.add('spin');show(GTU.i)};
 $('#tupv').onclick=()=>{if(GTU.i>0)show(GTU.i-1)};
 $('#tux').onclick=close;$('.gtu').onclick=e=>{if(e.target.classList.contains('gtu'))close()};
 $('#tunx').onclick=()=>GTU.i<L.length-1?show(GTU.i+1):close();
 show(0);return true};
/* @games : « ? » contextuel — dans un jeu (ou un jeu choisi au salon) il ouvre la démo de ce jeu, sinon le tutoriel de l'Expédition */
W.GHelp=function(){try{const id=(st.phase=='game'||st.phase=='gend')&&st.game?st.game.id:st.phase=='lobby'?st.gsel:null;return id?W.GTut(id):false}catch(e){return false}};
if(typeof document!='undefined')document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-gtut]');if(t)W.GTut(t.dataset.gtut)});

/* ---------- styles (injectés) ---------- */
if(typeof document!='undefined'){const c=document.createElement('style');c.id='games-css';c.textContent=`
.gw{--gease:cubic-bezier(.22,1,.36,1)}
.ghd{display:flex;align-items:center;gap:8px;font:600 19px Fredoka,Nunito,sans-serif;margin:8px 4px 8px;color:var(--deep)}
.ghd .grd{white-space:nowrap;direction:ltr;unicode-bidi:isolate}.ghd .gic{font-size:26px;line-height:1}.ghd .gstop{margin-inline-start:6px;width:30px;height:30px;padding:0;border-radius:50%;font-size:13px;line-height:1;box-shadow:0 2px 0 var(--edge2);color:var(--mut)}.ghd .grd+.gstop{margin-inline-start:6px}.ghd b+.gstop{margin-inline-start:auto}.ghd .grd{margin-inline-start:auto;font:800 13px Nunito;color:var(--mut);background:var(--paper);border:2px solid var(--edge);border-radius:99px;padding:2px 10px}
.gsab{height:6px;border-radius:9px;background:var(--edge);overflow:hidden;margin:0 4px 10px}
.gsab i{display:block;height:100%;background:linear-gradient(90deg,var(--ink),var(--gold));transform-origin:left;animation-name:gsab;animation-timing-function:linear;animation-fill-mode:both}
[dir=rtl] .gsab i{transform-origin:right}

.gedit{display:block;margin:10px auto 0;padding:6px 16px;border-radius:99px;font-size:14px}

.gtile.gfew:not(.sel){opacity:.55;filter:saturate(.45)}
.gtile .gmiss{display:block;margin-top:4px;font:700 12px Nunito,sans-serif;color:var(--bad,#d9534f)}
div.gtile{cursor:default}

.gtile.ghero{position:relative;width:100%;margin-top:12px;padding:16px 18px 14px;border-width:2.5px}
.gtile.ghero .gi{font-size:34px}.gtile.ghero .gt b{font-size:21px}.gtile.ghero .gt .mut{font-size:14px}
.gtile.ghero .gmain{position:absolute;top:10px;inset-inline-end:12px;font:800 11px Nunito,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--acc-d,#c2410c);background:#ffe2c6;border-radius:99px;padding:3px 9px}
.gsec{margin:18px 4px 8px;font:700 13px Nunito,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}
.glist{display:grid;grid-template-columns:1fr;gap:8px}
@media (min-width:720px){.glist{grid-template-columns:1fr 1fr}}
.gtile.grw{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;column-gap:12px;row-gap:3px;align-items:center;padding:10px 12px;border-radius:16px;box-shadow:0 3px 0 var(--edge2)}
.gtile.grw .gi{grid-row:1/3;font-size:26px}
.gtile.grw .gt b{font-size:16px}.gtile.grw .gt .mut{font-size:12.5px;line-height:1.25}
.gtile.grw .gmeta,.gtile.grw .gmiss{grid-column:2;justify-self:start;margin-top:0}
.gtile.grw .gmiss{grid-column:2}
[data-theme=dark] .gtile.ghero .gmain{background:#3a2a1c;color:#ffc48a}

.grh{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.grh h3{margin:0}
.groll{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:99px;font-weight:700}
.groll .grd6{display:inline-block;transition:transform .4s cubic-bezier(.3,1.6,.5,1)}.groll:hover .grd6{transform:rotate(-12deg) scale(1.15)}
.gmeta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;margin-top:4px}.gmeta .gmin{margin-top:0}
.gfq{font:700 11.5px Nunito,sans-serif;color:var(--mut);white-space:nowrap}
.gfq0{color:#0f8a7e}.gfqh{color:#c2410c}
[data-theme=dark] .gfq0{color:#5fd6c6}[data-theme=dark] .gfqh{color:#ffad6b}
.grollx{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,#0b2236cc,#04101cee);backdrop-filter:blur(3px);animation:grIn .35s ease both;cursor:pointer}
.grollx.out{animation:grOut .38s ease both}
@keyframes grIn{from{opacity:0}}@keyframes grOut{to{opacity:0}}
.grw0{display:grid;justify-items:center;gap:22px;padding:16px}
.grring{--R:min(38vw,150px);position:relative;width:calc(var(--R)*2 + 64px);height:calc(var(--R)*2 + 64px);border-radius:50%;background:radial-gradient(circle,#123a5a 0 34%,#0d2c47 35% 100%);box-shadow:inset 0 0 0 2px #2c5c80,0 0 60px #1d6fa533}
.grbeam{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -16deg,#ffe9a8d9 0deg,#ffe9a833 32deg,transparent 33deg);transform-origin:50% 50%;will-change:transform;filter:blur(1px)}
.grisl{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;transform:rotate(var(--a)) translateY(calc(var(--R)*-1)) rotate(calc(var(--a)*-1))}
.grisl b{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;font-size:24px;background:#1a4565;box-shadow:0 0 0 2px #2f6488;transition:transform .18s,background .18s,box-shadow .18s;filter:saturate(.7) brightness(.85)}
.grisl.on b{background:#f6d77e;box-shadow:0 0 0 3px #fff4cf,0 0 22px #ffd96b;transform:scale(1.14);filter:none}
.grisl.win b{animation:grWin .9s cubic-bezier(.3,1.6,.5,1) both}
@keyframes grWin{0%{transform:scale(1.14)}40%{transform:scale(1.55)}100%{transform:scale(1.35)}}
.grtower{position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);font-size:44px;filter:drop-shadow(0 0 14px #ffd96b88)}
.grres{margin:0;display:grid;justify-items:center;gap:4px;color:#fff3df;min-height:56px;text-align:center}
.grres .mut{color:#b9d3e6;font-size:14px;opacity:0;transition:opacity .3s}.grres b{font:800 26px Nunito,sans-serif;opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s}
.grollx.fin .grres .mut,.grollx.fin .grres b{opacity:1;transform:none}
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
.still .ga:not(.gw .ga),.still .gbar:not(.gw .gbar){animation:none}/* en jeu : gAnim() reprend les animations au lieu de les couper */
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
.gsc+*{margin-top:18px}.cqendl:empty{display:none}.cqendl>.cqres{margin:0}
.mkadd{display:inline-block;margin-top:4px;color:var(--ok,#2fa894)}.mkadd.neg{color:var(--bad)}
.tcd.sm2{font-size:12px;line-height:1.35;text-align:center;padding:4px 8px}
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
.gwrx{margin:4px 0 6px}.gwrx .reacts{margin-top:10px}
[data-rxp]{position:relative}.grxf{position:absolute;top:-14px;inset-inline-end:-4px;font-size:18px;line-height:1;pointer-events:none;animation:grxF 2.6s ease both}
@keyframes grxF{0%{opacity:0;transform:translateY(6px) scale(.5)}12%{opacity:1;transform:none}80%{opacity:1;transform:translateY(-4px)}100%{opacity:0;transform:translateY(-10px)}}
@media (prefers-reduced-motion:reduce){.grxf{animation:none}}
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
section>.gw.gnx{animation:none}.gw.gnx>.card{animation:gstep .28s var(--gease) both}
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
.mkl{animation:fi .5s ease both}
.mktr p{margin:4px 0;font:600 14px Nunito;text-align:center}
[data-theme=dark] .mkc.p{border-color:#2c7a62}[data-theme=dark] .mkc.g{border-color:#7a4a2a}
/* 📖 tutoriels animés */
.gtu .tuh{display:flex;align-items:center;justify-content:center;gap:8px;font-size:18px;margin-bottom:10px}.gtu .tuh span{font-size:26px}
.gtu .tuh{position:relative;padding:0 36px}
.gtu .tux{position:absolute;inset-inline-end:-4px;top:50%;transform:translateY(-50%);width:34px;height:34px;padding:0;border-radius:50%;border:0;background:transparent;color:var(--mut);font-size:16px;line-height:1;cursor:pointer;box-shadow:none}
.gtu .tux:hover{background:color-mix(in srgb,var(--mut) 14%,transparent);color:var(--txt)}
.gtu .tuw{position:relative;width:min(300px,100%);margin:0 auto}
.gtu .tus{position:relative;width:100%;aspect-ratio:300/180;border-radius:18px;overflow:hidden;background:var(--paper2);box-shadow:inset 0 0 0 2px var(--edge)}
.gtu .tusc{position:absolute;left:0;top:0;width:300px;height:180px;transform-origin:0 0;transform:scale(var(--k,1))}
[dir=rtl] .gtu .tusc{left:auto;right:0;transform-origin:100% 0}
.gtu .turp{position:absolute;top:6px;inset-inline-end:6px;width:30px;height:30px;padding:0;border-radius:50%;border:0;background:color-mix(in srgb,var(--paper) 82%,transparent);color:var(--txt);font-size:15px;line-height:1;cursor:pointer;box-shadow:0 1px 3px #0002}
.gtu .turp.spin{animation:tuSpin .45s var(--gease,ease)}@keyframes tuSpin{from{transform:rotate(-300deg)}}
.gtu .steps{display:flex;justify-content:center;gap:4px;margin:10px 0 12px}
.gtu .tud{width:22px;height:22px;padding:0;border:0;background:none;box-shadow:none;cursor:pointer;display:grid;place-items:center}
.gtu .tud::before{content:'';width:8px;height:8px;border-radius:99px;background:var(--edge);transition:width .2s,background .2s}
.gtu .tud.done::before{background:#ffc999}.gtu .tud.on::before{width:22px;background:linear-gradient(90deg,var(--acc2),var(--acc))}[data-theme=dark] .gtu .tud.done::before{background:#9a6a45}
.gtu .row button:disabled{opacity:.4}
.gtu .tucap{min-height:3.2em;margin:12px 4px 0;font-size:15px;line-height:1.4}
.gtu .row{display:flex;gap:10px;justify-content:center}.gtu .row button{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-inline:10px}
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
[data-theme=dark] .gtu .tus{background:#0b1c2d;box-shadow:inset 0 0 0 2px #26475f}[data-theme=dark] .gtu .turp{background:#16324acc;color:#e8f1f6}[data-theme=dark] .tcd{background:#16324a;box-shadow:0 0 0 1.5px #2c5574,0 3px 0 #06121f}[data-theme=dark] .tub polygon{fill:#2d6a8a55;stroke:#2c5574}[data-theme=dark] .tub .c0{fill:#2d6a8aaa}
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

/* 🐙 Le Mimétique */
.mim .chrole.n{border-color:#8c5cf2}
.mihd{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 10px;font:700 14px Nunito}
.michip{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:99px;background:var(--paper2);border:2px solid var(--edge);white-space:nowrap;font:700 14px Nunito;font-variant-numeric:tabular-nums}
.michip.low{border-color:var(--bad);color:var(--bad)}.mith.hot{border-color:#8c5cf2}
.micv{position:relative;margin:0 -4px;border-radius:18px;overflow:hidden;background:#03101a;box-shadow:inset 0 0 0 2px var(--edge)}
.micanvas{display:block;width:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair}
.mibar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin:10px 0 0}
.mibar button{min-width:0;padding:8px 14px;font-size:15px;border-radius:99px}
.mimk{position:relative;overflow:hidden;isolation:isolate}
.mimk::before{content:'';position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,#8c5cf2 26%,transparent);transform-origin:left;transform:scaleX(var(--cd,0));transition:transform .12s linear}
[dir=rtl] .mimk::before{transform-origin:right}.mimk.on{border-color:#8c5cf2;color:#6a3fd0}
.mipk{margin-top:8px}.mipk .gpk>button{flex:1 1 30%;padding:8px;font-size:14px}
.mifd{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;text-align:start}
.mifd li{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;background:var(--paper2);font:600 13px Nunito;min-width:0}
.mifd li>i{font-style:normal}.mifd li span{color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mifd li.st{background:color-mix(in srgb,#8c5cf2 14%,var(--paper2))}.mist{color:#8c5cf2}
.chlog.mild .mifd{margin-top:6px}
.minet{font:700 16px Nunito;margin:10px 0 2px}.mivn{text-align:center;font-size:13px;margin:8px 0 0}
.mirev{position:relative;width:96px;height:96px;margin:6px auto 0}
.mirav{position:absolute;inset:12px;display:grid;place-items:center;border-radius:50%;background:var(--c);color:#fff;font:800 32px Nunito;box-shadow:0 0 0 4px var(--paper),0 6px 18px #0003;animation:miIn .5s var(--gease) both}
.miric{position:absolute;right:-6px;bottom:-4px;font-size:40px;line-height:1;animation:miPop .5s var(--gease) .6s both}[dir=rtl] .miric{right:auto;left:-6px}
.mirev.shk .mirav{animation:miIn .5s var(--gease) both,gshk .4s ease 1.1s 2}
@keyframes miIn{from{opacity:0;transform:scale(.6)}}@keyframes miPop{from{opacity:0;transform:scale(.2) rotate(-30deg)}}
.mitly{margin-top:10px}
[data-theme=dark] .mimk.on{color:#c3a9ff}[data-theme=dark] .mist{color:#b998ff}
@media (prefers-reduced-motion:reduce){.mirav,.miric,.mirev.shk .mirav{animation:none!important}.mimk::before{transition:none}}
.tcave{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#1f6580,#06202e 75%)}
.tlamp{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:radial-gradient(circle,#ffe9a866,#ffe9a81a 55%,transparent 70%);z-index:-1;pointer-events:none}
.te>span{isolation:isolate}.tink{display:inline-block;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle,#2a1238dd,#2a123800 70%)}
/* ⚫ La Perle noire */
.prp{flex:none;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff 0 14%,#f4efe8 32%,#d9cfc2 70%,#b8ab9c);box-shadow:0 2px 6px #0002,inset -2px -3px 6px #0001;animation:prSh 4s ease-in-out infinite}
.prp.k,.prbk{background:radial-gradient(circle at 34% 30%,#c9d4e8 0 10%,#4b5568 30%,#1d2230 64%,#07090e)}
@keyframes prSh{50%{filter:brightness(1.08)}}
.prbk{display:inline-block;flex:none;width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 2px var(--paper);vertical-align:middle;animation:prBk .7s var(--gease,ease) both}
.prbk.big{width:34px;height:34px}.prbk.sm{width:12px;height:12px;animation:none}
@keyframes prBk{0%{transform:scale(.3);filter:brightness(3)}60%{transform:scale(1.15)}100%{transform:none}}
.prmy{display:inline-flex;align-items:center;gap:12px;padding:10px 18px 10px 12px;margin:0 auto;border-radius:99px;background:var(--paper2);border:2px solid var(--edge);text-align:start;max-width:100%}
.prmy small{display:block;font:800 11px Nunito;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.prmy b{display:block;font:600 22px/1.15 Fredoka,Nunito,sans-serif;color:var(--deep);overflow-wrap:anywhere}
.prcf{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0 4px}
.prch{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 12px;border-radius:14px;background:var(--paper2);border:2px solid var(--edge);font:700 14px/1.25 Nunito;color:var(--txt);max-width:100%;min-width:0;overflow-wrap:anywhere;text-align:start;box-shadow:none}
button.prch{cursor:pointer;width:auto}button.prch:hover{border-color:var(--edge2)}
.prch.tru{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 18%,var(--paper2));box-shadow:0 0 0 2px color-mix(in srgb,var(--gold) 35%,transparent)}
.prch.dv{border-color:#3a4256;background:color-mix(in srgb,#1d2230 14%,var(--paper2))}
.prch.off{opacity:.55}.prch em{font:800 11px Nunito;font-style:normal;color:var(--mut)}
.prdvp{margin:10px 0 2px;font:700 14px Nunito;color:var(--mut);text-align:center}.prdvp.hot{color:var(--deep)}
.prwt{margin-top:6px}
.prq{margin-top:14px}
.prtr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 4px}
.prtr button{font-size:32px;line-height:1;padding:12px 0;border-radius:16px;box-shadow:none;min-width:0}
.prtr button.sel{outline:3px solid var(--acc);outline-offset:1px;transform:scale(1.05)}
.prnk{margin-top:14px;text-align:start}
.prnkh{font:800 12px Nunito;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px}.prrd{margin-top:16px;text-align:center}
.prnr{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:12px;background:var(--paper2);margin:4px 0}
.prti{flex:none;font:800 12px Nunito;color:var(--mut);padding-top:5px}
.prgs{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
.prg{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;padding:2px 9px 2px 4px;border-radius:99px;background:var(--paper);border:2px solid transparent;max-width:100%;min-width:0}
.prg i{font-style:normal;font-size:20px;line-height:1.2}
.prg small{display:inline-flex;align-items:center;gap:3px;font:700 12px Nunito;color:var(--mut);overflow-wrap:anywhere}
.prg.two{border-color:color-mix(in srgb,var(--acc2) 55%,transparent)}
.prg.ec{border-color:#2fa894;background:#dff5ec}.prg.st{border-color:#3a4256;background:color-mix(in srgb,#1d2230 12%,var(--paper))}
.prg small.pk{color:var(--txt)}.prst{font-size:14px}
.prout{text-align:center}
.prend{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;border-radius:12px;background:var(--paper2);margin:6px 0;font:600 14px Nunito}.prend .prres{margin-inline-start:auto}
.te .prp{display:inline-block;width:24px;height:24px}.te .prbk{width:20px;height:20px}.te .prbk.big{width:30px;height:30px}
[data-theme=dark] .prmy b{color:#eaf7f9}[data-theme=dark] .prch.dv{border-color:#8a96b4;background:#0d1626}
[data-theme=dark] .prg.ec{background:#123d33;border-color:#2c7a62}[data-theme=dark] .prg.st{background:#0d1626;border-color:#8a96b4}
@media (prefers-reduced-motion:reduce){.prp,.prbk{animation:none!important}.prtr button.sel{transform:none}}
@media (max-width:420px){.prmy b{font-size:19px}.prtr{gap:6px}.prtr button{font-size:28px;padding:10px 0}.prch{font-size:13px;padding:5px 10px}}
/* 📜 Livre de bord */
.gidea{margin:4px 0 2px;padding:10px 12px;border-radius:14px;border:1.5px dashed var(--edge)}
.gidh{margin:0 0 8px;font-size:13px;font-weight:700;color:var(--mut)}
.gidl{display:flex;flex-wrap:wrap;gap:6px}
.gidc{font:inherit;font-size:13px;line-height:1.3;padding:6px 10px;border-radius:99px;border:1.5px solid var(--edge);background:var(--paper);color:var(--txt);cursor:pointer;text-align:start;max-width:100%;transition:transform .15s,border-color .15s}
.gidc:hover{border-color:var(--acc)}.gidc:active{transform:scale(.97)}
.gidd{margin:8px 0 0;font-size:12px;color:var(--mut);line-height:1.4}
/* 👀 spectateurs */
.gspc0{font-size:13px;color:var(--mut);margin:0 0 10px;padding:6px 11px;border-inline-start:3px solid var(--acc);border-radius:4px 12px 12px 4px;background:color-mix(in srgb,var(--acc) 8%,transparent);line-height:1.4}
.gw.gspc .card :is(textarea,input,#gsend,.gedit,.grow2,.gwr,.gidea,.gpk,.chno,.gab,.tpbt,.gbtns2,.mipk){display:none!important}
.gw.gspc .card button:not(.gtutb){pointer-events:none}
.gw.gspc .card .gpk button:not(.sel),.gw.gspc .card [data-tp]{opacity:.55}
.gspb2{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:12px;font-size:13px;color:var(--mut)}
.gspi{font-size:15px}.gspn{display:inline-flex;align-items:center;gap:5px}.gspn i{font-style:normal}
.gspw{margin-top:14px;padding-top:12px;border-top:1.5px dashed var(--edge)}
.gspt.sel{background:color-mix(in srgb,var(--acc) 14%,var(--paper));border-color:var(--acc)}
.gspw .gsub{margin:8px 0 0}.gspl{margin:6px 0 0}
.gnod{font-size:13px;color:var(--mut);margin:0 0 10px;padding:6px 11px;border-inline-start:3px solid var(--gold);border-radius:4px 12px 12px 4px;background:color-mix(in srgb,var(--gold) 9%,transparent);line-height:1.4}
.gnod b{font-weight:700}
.glog{padding:10px 14px}.glog>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;user-select:none}
.glog>summary::-webkit-details-marker{display:none}.glog>summary::after{content:'›';margin-inline-start:auto;transition:transform .25s;font-size:20px;color:var(--mut)}
.glog[open]>summary::after{transform:rotate(90deg)}
.glgn{font-size:11px;font-weight:700;color:var(--mut);border:1.5px solid var(--edge);border-radius:99px;padding:0 7px;line-height:17px}
.glog ul{list-style:none;margin:8px 0 2px;padding:0;display:grid;gap:6px}.glog li{display:flex;gap:9px;align-items:baseline;font-size:13.5px;line-height:1.4}
.glgi{flex:none;width:20px;text-align:center}
@media (prefers-reduced-motion:reduce){.glog>summary::after{transition:none}}
/* ⛈️ Tempête */
.tpbar{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:6px}
.tplf{letter-spacing:1px;font-size:15px}.tpcl{font-size:13px;font-weight:700;padding:2px 9px;border-radius:99px;border:1.5px solid var(--edge)}.tpcl.z{opacity:.45}.tplv{font-size:13px;color:var(--mut)}
.tpst{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;margin:4px 0 6px}.tpst>span:first-child{flex:none;min-width:70px;text-align:start}
.tpsb{flex:1;height:8px;border-radius:99px;background:var(--paper2);border:1px solid var(--edge);overflow:hidden}.tpsb i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#7b8fd8,#5ad8ae);transform-origin:left center;animation:tpG linear both}
[dir=rtl] .tpsb i{transform-origin:right center}
@keyframes tpG{from{transform:scaleX(var(--a))}to{transform:scaleX(var(--b))}}
.tpw span.dn{bottom:auto;top:15px}
.tpe{display:inline-flex;align-items:center;gap:4px}
.tplg{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;margin:10px 0 0;font-size:11.5px;color:var(--mut);line-height:1.3}
.tplg>span{display:inline-flex;align-items:center;gap:5px}
.tpw0{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--c,var(--ink));box-shadow:0 0 0 1px var(--edge)}.tpw0.bad{background:var(--bad)}.tpw0.ec{background:transparent;border:1.5px dashed var(--mut);box-shadow:none;width:8px;height:8px}
.tpfoc{margin:8px 0 6px}.tpfoc .tpv{font-size:26px;min-width:58px;padding:12px}
.tpsea{position:relative;height:58px;margin:14px 12px 4px}.tpln{position:absolute;inset-inline:0;top:25px;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--ink),var(--acc));opacity:.5}
.tp0,.tp1{position:absolute;top:44px;font-size:10px;color:var(--mut)}.tp0{inset-inline-start:-6px}.tp1{inset-inline-end:-10px}
.tpw{position:absolute;top:20px;width:13px;height:13px;margin-inline-start:-6px;border-radius:50%;background:var(--c,var(--ink));border:2px solid var(--paper);box-shadow:0 0 0 1px var(--edge)}
.tpw span{position:absolute;bottom:15px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--mut);opacity:0}
.tpw.nw span{opacity:1}.tpw.ec span{bottom:13px}.tpw.ec span.dn{bottom:auto;top:13px}.tpw.nw{animation:tpIn .6s cubic-bezier(.3,1.6,.5,1) both}.tpw.nw span{color:var(--txt);font-size:12px}
.tpw.bad{background:var(--bad)}.tpw.ec{background:transparent;border:2px dashed var(--mut);box-shadow:none;top:21px;width:11px;height:11px}
@keyframes tpIn{from{transform:translateY(-16px) scale(.4);opacity:0}}
.tpev{min-height:26px;font-size:15px;margin:2px 0 0;display:flex;gap:6px 12px;justify-content:center;align-items:center;flex-wrap:wrap}.tpev b{font-size:19px}
.tpsi{font-size:12px;color:var(--mut);margin:2px 0 10px}
.tpcrew{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px;margin-bottom:12px}
.tpm{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px;padding:6px 9px;border:1.5px solid var(--edge);border-radius:12px;background:var(--paper2);font-size:13px;text-align:start;min-width:0}
.tpm.me{border-color:var(--acc)}.tpm.out{opacity:.55}.tpnm{display:flex;align-items:center;gap:5px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 60px}
.tpk{font-size:11px;letter-spacing:-2px}.tpbd{font-size:11px;font-weight:700;padding:0 6px;border-radius:99px;background:color-mix(in srgb,var(--gold) 24%,transparent)}
.tpcq{font-size:12px}.tpok{position:absolute;top:-4px;inset-inline-end:-4px;width:10px;height:10px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2px var(--paper)}
.tphand{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:2px 0 12px}
.tpv{min-width:46px;padding:9px 10px;border-radius:14px;border:2px solid var(--edge);background:var(--paper2);font-size:20px;text-align:center}.tpv.lo{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,var(--paper2))}
.tpbt{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tpbt .tpgo{grid-column:1/-1;font-size:17px;padding:13px;background:linear-gradient(180deg,#4fb6c9,#2f8fa8);color:#fff;border:0}
.tpbt button.sel{outline:3px solid var(--acc);outline-offset:1px}.tpbt small{font-size:11px;opacity:.8}
.tpmu{font-size:11.5px;color:var(--mut);margin:6px 0 0}
.tpend{display:grid;gap:5px;margin-top:8px}.tpend>div{display:flex;gap:10px;justify-content:space-between;padding:6px 10px;border:1.5px solid var(--edge);border-radius:10px;font-size:14px}
.tpseq{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:10px}.tpseq b{font-size:13px;padding:2px 7px;border-radius:8px;border:1.5px solid var(--c,var(--edge))}.tpseq b.bad{border-color:var(--bad);color:var(--bad)}.tpseq b.ec{border:1.5px dashed var(--mut);color:var(--mut);text-decoration:line-through}
.tutrk{display:block;width:250px;height:3px;border-radius:3px;background:linear-gradient(90deg,#2fa894,#ef8354);opacity:.6}
@media (prefers-reduced-motion:reduce){.tpw.nw{animation:none}.tpsb i{animation:none!important;transform:scaleX(var(--a))}}
@media (max-width:420px){.tpcrew{grid-template-columns:1fr 1fr}.tpv{min-width:40px;font-size:18px;padding:7px 8px}}
.cqs{width:22px;height:22px;display:inline-block;vertical-align:middle;flex:none;filter:drop-shadow(0 1px 1px #0002)}
.cqs.xs{width:14px;height:14px}.cqlot.xs .cqs{width:17px;height:17px}.cqlot.sm .cqs{width:18px;height:18px}.cqs.big{width:46px;height:46px}
.cqlot{display:inline-flex;flex-wrap:wrap;gap:2px;align-items:center;justify-content:center}
.cqlot.big{gap:8px;margin:6px 0 2px}.cqlot.big .cqs{width:44px;height:44px;animation:cqIn .45s var(--gease) both}
@keyframes cqIn{from{opacity:0;transform:translateY(10px) scale(.7) rotate(-12deg)}}
.cqh{font:700 14px Nunito;color:var(--mut);margin:0 0 8px}.cqh b{color:var(--deep)}
.cqst{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:4px 0 10px}
.cqsl{position:relative;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:30px;padding:4px 6px;border-radius:12px;background:var(--paper2);border:2px solid transparent;transition:transform .3s var(--gease),opacity .3s}
.cqsl.on{border-color:var(--acc);transform:translateY(-2px)}.cqsl.past{opacity:.5}
.cqsw{position:absolute;top:-6px;inset-inline-end:-6px;font-style:normal;font-size:11px;line-height:1}
.cqres{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px;padding:8px 10px;border-radius:14px;background:var(--paper2);margin:0 0 10px;font:700 14px Nunito}
.cqwho{display:inline-flex;align-items:center;gap:5px}.cqpay{color:var(--mut);font-size:12px}
.cqbids{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.cqbid{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:var(--paper);border:1.5px solid var(--edge);font-size:13px;animation:gin .3s var(--gease) both}
.cqbid.w{border-color:var(--ink);background:#dff5ec}.cqbid.x b{text-decoration:line-through;opacity:.55}
.cqcur{text-align:center;margin:4px 0}
.cqlt{font:600 15px Fredoka,Nunito,sans-serif;color:var(--deep);margin:0;font-style:italic;overflow-wrap:anywhere}
.cqpad{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:330px;margin:0 auto}
.cqpad .cqc{padding:10px 0;font:600 19px Fredoka,Nunito,sans-serif;border-radius:12px;min-width:0}
.cqpad .cqc.z{color:var(--mut)}.cqpad .cqc:disabled{opacity:.3}.gw .cqpad .cqc.sel{transform:translateY(-3px)}
.cqnote{font:600 12.5px Nunito;color:var(--mut);margin:8px 0 0;text-align:center}
.cqtips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 0}
.cqtip{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;background:color-mix(in srgb,var(--gold) 20%,var(--paper2));border:1.5px dashed var(--gold);font:700 13px Nunito}
.cqtip b{font:600 18px Fredoka,Nunito,sans-serif}
.cqdir{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px}.cqdir button{padding:9px 6px;font-size:15px}
.cqsp{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.cqsp button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;min-width:0}
.cqsp .cqs{width:30px;height:30px}.cqsp small,.cqfc small{font:700 10.5px/1.1 Nunito;max-width:100%;overflow-wrap:anywhere;hyphens:auto;text-align:center}
.cqmu{margin-top:8px}
.cqbd{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:14px 0 8px;padding:8px 4px;border-radius:14px;background:var(--paper2)}
.cqcol{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
.cqv{font:600 17px Fredoka,Nunito,sans-serif;color:var(--mut)}.cqv.kn{color:var(--acc-d)}.cqv.rv{color:var(--ink)}
.cqan{display:flex;flex-wrap:wrap;justify-content:center;gap:1px;min-height:12px}
.cqan i{font-style:normal;font-size:11px;line-height:1;color:var(--c)}.cqan i.f{opacity:.35}.cqan i.t{text-shadow:0 0 4px color-mix(in srgb,var(--c) 60%,transparent)}
.cqcr{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.cqm{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:3px 8px;padding:6px 9px;border:1.5px solid var(--edge);border-radius:12px;background:var(--paper2);font-size:13px;text-align:start;min-width:0}
.cqm.me{border-color:var(--acc)}
.cqnm{display:flex;align-items:center;gap:5px;min-width:0;flex:1 1 60px}.cqnm b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cqco{display:flex;flex-wrap:wrap;gap:4px}.cqk{display:inline-flex;align-items:center;gap:1px;font-size:11px}
.cqpu{font:700 12px Nunito;color:var(--mut)}
.cqrv{text-align:center}
.cqrvs{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:20px;background:var(--paper2)}
.cqbig{font:600 34px Fredoka,Nunito,sans-serif;color:var(--ink);animation:cqPop .5s cubic-bezier(.3,1.6,.5,1) .5s both}
@keyframes cqPop{from{transform:scale(.3);opacity:0}}
.cqfin{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:6px 0 12px}
.cqfc{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border-radius:12px;background:var(--paper2);min-width:0}
.cqfc .cqs{width:30px;height:30px}.cqfc b{font:600 20px Fredoka,Nunito,sans-serif;color:var(--ink)}
.cqfc small{color:var(--mut)}
.cqtl{display:flex;flex-direction:column;gap:6px}
.cqtr{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 10px;border-radius:12px;background:var(--paper2);font-size:13px}
.cqtr.me{outline:2px solid var(--acc)}.cqpt{color:var(--mut);font-weight:700;font-size:12px}.cqtot{margin-inline-start:auto;font:600 18px Fredoka,Nunito,sans-serif;color:var(--ink)}
.cqlg{font-size:11.5px;text-align:center;margin:8px 0 0}
.tql{display:inline-flex;gap:3px}.te .tpt{direction:ltr;unicode-bidi:isolate}.te .cqs{width:24px;height:24px}.te.big .cqs{width:34px;height:34px}.tcd .cqs{width:18px;height:18px}
[data-theme=dark] .cqbid.w{background:#123d33}[data-theme=dark] .cqs{filter:drop-shadow(0 1px 2px #0009)}
@media (prefers-reduced-motion:reduce){.cqlot.big .cqs,.cqbig,.cqbid{animation:none!important}.cqsl{transition:none}}
@media (max-width:420px){.cqcr{grid-template-columns:1fr 1fr}.cqlot.big .cqs{width:38px;height:38px}.cqsp small{font-size:9.5px}}
@media (max-width:420px){.grow2{flex-direction:column}.gq{font-size:19px}.gseed{font-size:26px}.gbr{grid-template-columns:minmax(0,7em) 1fr 1.6em}.gtf{width:78px}.gcamps{gap:6px}}
@media (prefers-reduced-motion:reduce){.gw .ga,.gw .gbar,.gfloat,.gev .gbig,.grx,.arcb *,.gw.gnx>.card,.mkl{animation:none!important}.gsab i{animation-duration:0s!important;display:none}}
`;(document.head||document.documentElement).appendChild(c)}

/* =====================================================================
   TEXTES — GI18N[lang] = {ui:{…}, pha, pha1, pha2, vag, vag1, vag2, rad, rad1, rad2}
   (listes '|' alignées par index ; dilemmes « A~B » ; réserve 1 = coquin, 2 = trash, 18+ entre adultes)
   ===================================================================== */
const GI18N=W.GI18N={};
GI18N.fr={ui:{rollB:`Au hasard`,rollD:`Le phare choisit parmi les jeux possibles, en préférant ceux qu'on a peu joués.`,rollT:`Le phare a choisi`,pl0:`jamais joué`,plH:`souvent joué`,plN:`joué {n}×`,gmain:`Le jeu principal`,gcat_d:`Se découvrir`,gcat_s:`Stratégie et bluff`,gcat_h:`Rôles cachés`,gcat_c:`Ensemble et adresse`,gcat_o:`Autres jeux`,miss1:`Il manque {n} joueur`,missN:`Il manque {n} joueurs`,mtieA:`Tout le monde peut déclarer un lien ; seuls les autres peuvent le retirer.`,edit:`Modifier`,stopAsk:`Arrêter ce jeu et voir les scores ?`,stop:`Arrêter`,room:`Salle de jeux`,exp:`Expédition`,expD:`Le voyage d'île en île`,play:`Jouer à {g}`,waitHost:`L'hôte lance la partie`,needP:`De {a} à {b} joueurs`,
t_skill:`skill`,t_chance:`chance`,t_social:`social`,send:`Envoyer`,ok:`Continuer`,me:`moi`,or:`ou`,waitN:`On attend {n}`,yourMove:`À toi !`,watch:`Regarde les autres jouer`,ready:`{g:Prêt|Prête} ? On continue quand tout le monde l'est`,
scores:`Scores`,coopT:`Score de connexion`,again:`Rejouer`,lobby:`Retour au salon`,hostNext:`Rejouer, ou retour au salon ?`,waitHostN:`{n} choisit la suite`,
n_bot:`Bouteilles à la mer`,d_bot:`Des anecdotes vraies et anonymes : qui les a écrites ?`,
r_bot:`Écris 2 ou 3 choses vraies sur toi. Elles arrivent anonymes : trouve l'auteur (+2). Personne ne te trouve ? +3. Une partie seulement ? +1.`,
r_bot2:`Écris 3 anecdotes, vraies ou inventées (au moins une de chaque). Devine celles de l'autre (+2) ; chaque bluff réussi te rapporte +2.`,
bph:`Une anecdote vraie sur toi…`,bph18:`Une chose vraie (et osée) sur toi…`,bph2:`Une anecdote sur toi…`,bmin:`Écris-en au moins 2`,bmin2:`Remplis les 3, avec au moins une vraie et une inventée`,bwait:`Tes bouteilles sont à l'eau`,
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

GI18N.en={ui:{rollB:`Surprise me`,rollD:`The lighthouse picks among the playable games, favouring the ones you've played least.`,rollT:`The lighthouse chose`,pl0:`never played`,plH:`played a lot`,plN:`played {n}×`,gmain:`The main game`,gcat_d:`Get to know each other`,gcat_s:`Strategy & bluff`,gcat_h:`Hidden roles`,gcat_c:`Together & skill`,gcat_o:`More games`,miss1:`{n} more player needed`,missN:`{n} more players needed`,mtieA:`Anyone can declare a bond; only the others can remove it.`,edit:`Edit`,stopAsk:`Stop this game and see the scores?`,stop:`Stop`,room:`Game room`,exp:`Expedition`,expD:`The island-hopping voyage`,play:`Play {g}`,waitHost:`The host starts the game`,needP:`{a} to {b} players`,
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

GI18N.es={ui:{rollB:`Al azar`,rollD:`El faro elige entre los juegos posibles, prefiriendo los menos jugados.`,rollT:`El faro ha elegido`,pl0:`nunca jugado`,plH:`muy jugado`,plN:`jugado {n}×`,gmain:`El juego principal`,gcat_d:`Conocerse`,gcat_s:`Estrategia y farol`,gcat_h:`Roles ocultos`,gcat_c:`Juntos y habilidad`,gcat_o:`Más juegos`,miss1:`Falta {n} jugador`,missN:`Faltan {n} jugadores`,mtieA:`Cualquiera puede declarar un vínculo; solo los demás pueden quitarlo.`,edit:`Cambiar`,stopAsk:`¿Parar este juego y ver los puntos?`,stop:`Parar`,room:`Sala de juegos`,exp:`Expedición`,expD:`El viaje de isla en isla`,play:`Jugar a {g}`,waitHost:`El anfitrión inicia la partida`,needP:`De {a} a {b} jugadores`,
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

GI18N.it={ui:{rollB:`A caso`,rollD:`Il faro sceglie tra i giochi possibili, preferendo quelli meno giocati.`,rollT:`Il faro ha scelto`,pl0:`mai giocato`,plH:`giocato spesso`,plN:`giocato {n}×`,gmain:`Il gioco principale`,gcat_d:`Conoscersi`,gcat_s:`Strategia e bluff`,gcat_h:`Ruoli nascosti`,gcat_c:`Insieme e abilità`,gcat_o:`Altri giochi`,miss1:`Manca {n} giocatore`,missN:`Mancano {n} giocatori`,mtieA:`Chiunque può dichiarare un legame; solo gli altri possono toglierlo.`,edit:`Modifica`,stopAsk:`Fermare il gioco e vedere i punteggi?`,stop:`Ferma`,room:`Sala giochi`,exp:`Spedizione`,expD:`Il viaggio di isola in isola`,play:`Gioca a {g}`,waitHost:`L'host avvia la partita`,needP:`Da {a} a {b} giocatori`,
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

GI18N.de={ui:{rollB:`Zufall`,rollD:`Der Leuchtturm wählt unter den möglichen Spielen, am liebsten die wenig gespielten.`,rollT:`Der Leuchtturm hat gewählt`,pl0:`noch nie gespielt`,plH:`oft gespielt`,plN:`{n}× gespielt`,gmain:`Das Hauptspiel`,gcat_d:`Sich kennenlernen`,gcat_s:`Strategie & Bluff`,gcat_h:`Versteckte Rollen`,gcat_c:`Gemeinsam & Geschick`,gcat_o:`Weitere Spiele`,miss1:`Es fehlt {n} Person`,missN:`Es fehlen {n} Personen`,mtieA:`Alle können eine Verbindung angeben; nur die anderen können sie entfernen.`,edit:`Ändern`,stopAsk:`Spiel beenden und Punkte zeigen?`,stop:`Beenden`,room:`Spielesaal`,exp:`Expedition`,expD:`Die Reise von Insel zu Insel`,play:`{g} spielen`,waitHost:`Der Host startet das Spiel`,needP:`{a} bis {b} Spieler`,
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

GI18N.ru={ui:{rollB:`Наугад`,rollD:`Маяк выбирает среди доступных игр, чаще те, в которые играли меньше.`,rollT:`Маяк выбрал`,pl0:`ещё не играли`,plH:`играли часто`,plN:`сыграно: {n}`,gmain:`Главная игра`,gcat_d:`Узнать друг друга`,gcat_s:`Стратегия и блеф`,gcat_h:`Тайные роли`,gcat_c:`Вместе и ловкость`,gcat_o:`Другие игры`,miss1:`Не хватает игроков: {n}`,missN:`Не хватает игроков: {n}`,mtieA:`Любой может отметить связь; убрать её могут только остальные.`,edit:`Изменить`,stopAsk:`Остановить игру и показать очки?`,stop:`Остановить`,room:`Игровой зал`,exp:`Экспедиция`,expD:`Путешествие с острова на остров`,play:`Играть: {g}`,waitHost:`Хост запускает игру`,needP:`От {a} до {b} игроков`,
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

GI18N.zh={ui:{rollB:`随机`,rollD:`灯塔会在可玩的游戏中挑选，优先玩得少的。`,rollT:`灯塔选中了`,pl0:`从未玩过`,plH:`常玩`,plN:`玩过 {n} 次`,gmain:`主游戏`,gcat_d:`彼此了解`,gcat_s:`策略与诈唬`,gcat_h:`隐藏身份`,gcat_c:`合作与技巧`,gcat_o:`更多游戏`,miss1:`还差 {n} 名玩家`,missN:`还差 {n} 名玩家`,mtieA:`任何人都可以标记关系；只有其他人才能取消。`,edit:`修改`,stopAsk:`结束本局并查看得分？`,stop:`结束`,room:`游戏厅`,exp:`远征`,expD:`一岛接一岛的旅程`,play:`开始：{g}`,waitHost:`房主开始游戏`,needP:`{a}–{b} 名玩家`,
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

GI18N.he={ui:{rollB:`אקראי`,rollD:`המגדלור בוחר מבין המשחקים האפשריים, ומעדיף את אלה ששיחקנו פחות.`,rollT:`המגדלור בחר`,pl0:`עוד לא שיחקנו`,plH:`שיחקנו הרבה`,plN:`שיחקנו {n}×`,gmain:`המשחק הראשי`,gcat_d:`להכיר זה את זה`,gcat_s:`אסטרטגיה ובלוף`,gcat_h:`תפקידים סודיים`,gcat_c:`ביחד ומיומנות`,gcat_o:`עוד משחקים`,miss1:`חסר שחקן אחד`,missN:`חסרים {n} שחקנים`,mtieA:`כל אחד יכול לסמן קשר; רק האחרים יכולים להסיר אותו.`,edit:`לשנות`,stopAsk:`לעצור את המשחק ולראות ניקוד?`,stop:`לעצור`,room:`חדר משחקים`,exp:`מסע`,expD:`המסע מאי לאי`,play:`לשחק: {g}`,waitHost:`המארח מתחיל את המשחק`,needP:`{a} עד {b} שחקנים`,
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

GI18N.pt={ui:{rollB:`Ao acaso`,rollD:`O farol escolhe entre os jogos possíveis, preferindo os menos jogados.`,rollT:`O farol escolheu`,pl0:`nunca jogado`,plH:`muito jogado`,plN:`jogado {n}×`,gmain:`O jogo principal`,gcat_d:`Conhecer-se`,gcat_s:`Estratégia e blefe`,gcat_h:`Papéis ocultos`,gcat_c:`Juntos e habilidade`,gcat_o:`Mais jogos`,miss1:`Falta {n} jogador`,missN:`Faltam {n} jogadores`,mtieA:`Qualquer pessoa pode declarar um laço; só os outros podem removê-lo.`,edit:`Alterar`,stopAsk:`Parar o jogo e ver os pontos?`,stop:`Parar`,room:`Sala de jogos`,exp:`Expedição`,expD:`A viagem de ilha em ilha`,play:`Jogar {g}`,waitHost:`O anfitrião inicia a partida`,needP:`De {a} a {b} jogadores`,
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
kP:`🤝🏻 Partager`,kG:`🔒 Garder`,kV:`🗡️ Voler`,mshared:`a partagé`,mkept:`a gardé`,mrep:`Seulement 2 : vous aviez déjà partagé ensemble…`,mnet:`réseau : +{v}`,mtot:`Ton total (secret) : {v}`,msea:`La mer des masques`,
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
kP:`🤝🏻 Share`,kG:`🔒 Keep`,kV:`🗡️ Steal`,mshared:`shared`,mkept:`kept`,mrep:`Only 2: you had already shared together…`,mnet:`network: +{v}`,mtot:`Your total (secret): {v}`,msea:`The sea of masks`,
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
kP:`🤝🏻 Compartir`,kG:`🔒 Guardar`,kV:`🗡️ Robar`,mshared:`compartió`,mkept:`guardó`,mrep:`Solo 2: ya habíais compartido juntos…`,mnet:`red: +{v}`,mtot:`Tu total (secreto): {v}`,msea:`El mar de las máscaras`,
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
kP:`🤝🏻 Condividi`,kG:`🔒 Tieni`,kV:`🗡️ Ruba`,mshared:`ha condiviso`,mkept:`ha tenuto`,mrep:`Solo 2: avevate già condiviso insieme…`,mnet:`rete: +{v}`,mtot:`Il tuo totale (segreto): {v}`,msea:`Il mare delle maschere`,
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
kP:`🤝🏻 Teilen`,kG:`🔒 Behalten`,kV:`🗡️ Stehlen`,mshared:`hat geteilt`,mkept:`hat behalten`,mrep:`Nur 2: ihr hattet schon zusammen geteilt…`,mnet:`Netz: +{v}`,mtot:`Dein Stand (geheim): {v}`,msea:`Das Meer der Masken`,
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
kP:`🤝🏻 Делиться`,kG:`🔒 Оставить`,kV:`🗡️ Украсть`,mshared:`поделился(-ась)`,mkept:`оставил(а) себе`,mrep:`Только 2: вы уже делились вместе…`,mnet:`сеть: +{v}`,mtot:`Твой счёт (тайно): {v}`,msea:`Море масок`,
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
kP:`🤝🏻 分享`,kG:`🔒 独占`,kV:`🗡️ 偷`,mshared:`选择了分享`,mkept:`选择了独占`,mrep:`只有2分：你们之前已经一起分享过……`,mnet:`人脉：+{v}`,mtot:`你的总分（保密）：{v}`,msea:`面具之海`,
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
kP:`🤝🏻 לחלוק`,kG:`🔒 לשמור`,kV:`🗡️ לגנוב`,mshared:`חלק/ה`,mkept:`שמר/ה`,mrep:`רק 2: כבר חלקתם יחד…`,mnet:`רשת: ‎+{v}`,mtot:`הסכום שלך (סודי): {v}`,msea:`ים המסכות`,
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
kP:`🤝🏻 Dividir`,kG:`🔒 Guardar`,kV:`🗡️ Roubar`,mshared:`dividiu`,mkept:`guardou`,mrep:`Só 2: vocês já tinham dividido juntos…`,mnet:`rede: +{v}`,mtot:`Seu total (secreto): {v}`,msea:`O mar das máscaras`,
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
tu_msk2:`Écris-leur un message anonyme, puis choisis en secret : 🤝🏻 Partager ou 🔒 Garder.`,
tu_msk3:`🤝🏻 + 🤝🏻 : 4 chacun, et un lien de plus dans ton réseau (bonus dès la 2e personne).`,
tu_msk4:`🔒 face à 🤝🏻 : 4 pour toi, 1 pour l'autre… et un 🦈 que tous verront (−1 à la fin).`,
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
tu_msk2:`Write them an anonymous message, then secretly choose: 🤝🏻 Share or 🔒 Keep.`,
tu_msk3:`🤝🏻 + 🤝🏻: 4 each, and one more link in your network (bonus from the 2nd person).`,
tu_msk4:`🔒 against 🤝🏻: 4 for you, 1 for them… and a 🦈 everyone will see (−1 at the end).`,
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
tu_msk2:`Escríbeles un mensaje anónimo y elige en secreto: 🤝🏻 Compartir o 🔒 Guardar.`,
tu_msk3:`🤝🏻 + 🤝🏻: 4 cada uno y un vínculo más en tu red (bonus desde la 2.ª persona).`,
tu_msk4:`🔒 frente a 🤝🏻: 4 para ti, 1 para el otro… y un 🦈 que todos verán (−1 al final).`,
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
tu_msk2:`Scrivi loro un messaggio anonimo, poi scegli in segreto: 🤝🏻 Condividi o 🔒 Tieni.`,
tu_msk3:`🤝🏻 + 🤝🏻: 4 a testa e un legame in più nella tua rete (bonus dalla 2ª persona).`,
tu_msk4:`🔒 contro 🤝🏻: 4 per te, 1 per l'altro… e uno 🦈 che tutti vedranno (−1 alla fine).`,
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
tu_msk2:`Schreib ihnen eine anonyme Nachricht und wähle dann geheim: 🤝🏻 Teilen oder 🔒 Behalten.`,
tu_msk3:`🤝🏻 + 🤝🏻: je 4 und eine Verbindung mehr in deinem Netz (Bonus ab der 2. Person).`,
tu_msk4:`🔒 gegen 🤝🏻: 4 für dich, 1 für die andere Person… und ein 🦈, den alle sehen (−1 am Ende).`,
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
tu_msk2:`Напиши им анонимное сообщение, затем тайно выбери: 🤝🏻 Делиться или 🔒 Оставить.`,
tu_msk3:`🤝🏻 + 🤝🏻: по 4 и ещё одна связь в твоей сети (бонус со 2-го человека).`,
tu_msk4:`🔒 против 🤝🏻: тебе 4, другому 1… и 🦈, которую все увидят (−1 в конце).`,
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
tu_msk2:`给他们写一条匿名消息，然后秘密选择：🤝🏻分享或🔒独占。`,
tu_msk3:`🤝🏻+🤝🏻：各得4分，你的人脉多一条联系（从第2个人起有奖励）。`,
tu_msk4:`🔒对🤝🏻：你得4分，对方1分……还会带上人人可见的🦈（结束时−1）。`,
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
tu_msk2:`כתבו להם הודעה אנונימית, ואז בחרו בסוד: 🤝🏻 לחלוק או 🔒 לשמור.`,
tu_msk3:`🤝🏻 + 🤝🏻: 4 לכל אחד, ועוד קשר ברשת שלך (בונוס מהאדם השני).`,
tu_msk4:`🔒 מול 🤝🏻: 4 לך, 1 לשני… ו־🦈 שכולם יראו (‎−1 בסוף).`,
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
tu_msk2:`Escreva uma mensagem anônima e escolha em segredo: 🤝🏻 Dividir ou 🔒 Guardar.`,
tu_msk3:`🤝🏻 + 🤝🏻: 4 para cada e mais um laço na sua rede (bônus a partir da 2ª pessoa).`,
tu_msk4:`🔒 contra 🤝🏻: 4 para você, 1 para o outro… e um 🦈 que todos verão (−1 no fim).`,
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
r_chn:`Chaque vague, un capitaine reçoit en secret le bon chenal (🐚 ⭐ 🌙 🐋) et le transmet en privé au gardien de son choix, qui le relaie à son tour : le dernier guide le navire. Parmi vous se cache 1 Naufrageur (2 dès 6 joueurs) qui peut changer le chenal : s'ils coulent assez de navires (compteur 💥), les Naufrageurs gagnent. Entre les vagues, débattez dans le chat et votez pour mettre un suspect aux fers (ce qu'il reçoit et transmet devient public) ; à la fin, chacun accuse en secret : +2 par Naufrageur démasqué.`,
chN:`Naufrageur`,chC:`Gardien de phare`,chSkT:`Les Naufrageurs gagnent à {v} navires coulés`,chWaitC:`{n} est capitaine : la passe part…`,chWait:`{n} relaie la passe…`,
chCap:`Le bon chenal :`,chGot:`On t'a transmis :`,chNtip:`Tu peux changer le chenal… ou le garder pour rester crédible.`,chPass:`Quel chenal transmets-tu ?`,chPilot:`Tu guides le navire : quel chenal ?`,chTo:`À qui ?`,chSail:`Lever l'ancre`,
chOk:`Le navire est arrivé !`,chKo:`Le navire a coulé !`,chTr:`bon chenal`,chF:`chenal pris`,chVote:`Mettre quelqu'un aux fers ?`,chVoteD:`Il faut la majorité. Ses relais deviendront publics.`,chFree:`Personne (libérer)`,chNone:`Personne`,chNoneS:`personne`,
chAcc:`Qui sont les Naufrageurs ? (jusqu'à {v})`,chAccD:`+2 par Naufrageur démasqué.`,chAccN:`Accuse aussi quelqu'un : personne ne doit deviner ton rôle.`,chAccOk:`Envoyé ✓`,chLog:`Journal de bord`,
chWinN:`Les Naufrageurs l'emportent : {v} navires coulés !`,chWinC:`L'équipage l'emporte : la flotte est sauve !`,chWere:`Les Naufrageurs étaient :`,
tu_chn1:`{a} est capitaine : il reçoit le bon chenal ⭐ et le passe en secret à {b}.`,tu_chn2:`{b} le relaie à {c}… mais un Naufrageur caché peut changer le chenal.`,
tu_chn3:`Le dernier relais guide le navire : mauvais chenal, il coule. Tous voient la route, personne ne voit ce que les autres ont passé.`,tu_chn4:`Débattez, puis votez : le suspect est mis aux fers ⛓️ et ce qu'il passe devient public.`,
tu_chn5:`À la fin, accusez en secret : +2 par Naufrageur démasqué. Mais assez de navires coulés, et ce sont eux qui gagnent.`});
GCH('en',{n_chn:`The Lighthouse Chain`,d_chn:`Pass on the right channel… without knowing who scrambles it`,
r_chn:`Each wave, a captain secretly gets the right channel (🐚 ⭐ 🌙 🐋) and privately passes it to a keeper of their choice, who relays it in turn: the last one steers the ship. Hidden among you is 1 Wrecker (2 from 6 players) who can change the channel: if enough ships sink (💥 counter), the Wreckers win. Between waves, debate in the chat and vote to put a suspect in irons (what they receive and pass becomes public); at the end, everyone accuses in secret: +2 per Wrecker unmasked.`,
chN:`Wrecker`,chC:`Lighthouse keeper`,chSkT:`The Wreckers win at {v} sunk ships`,chWaitC:`{n} is captain: the channel sets off…`,chWait:`{n} is relaying the channel…`,
chCap:`The right channel:`,chGot:`You were passed:`,chNtip:`You can change the channel… or keep it to stay believable.`,chPass:`Which channel do you pass on?`,chPilot:`You steer the ship: which channel?`,chTo:`To whom?`,chSail:`Weigh anchor`,
chOk:`The ship made it!`,chKo:`The ship sank!`,chTr:`right channel`,chF:`channel taken`,chVote:`Put someone in irons?`,chVoteD:`It takes a majority. Their relays will become public.`,chFree:`Nobody (release)`,chNone:`Nobody`,chNoneS:`nobody`,
chAcc:`Who are the Wreckers? (up to {v})`,chAccD:`+2 per Wrecker unmasked.`,chAccN:`Accuse someone too: nobody should guess your role.`,chAccOk:`Sent ✓`,chLog:`Logbook`,
chWinN:`The Wreckers win: {v} ships sunk!`,chWinC:`The crew wins: the fleet is safe!`,chWere:`The Wreckers were:`,
tu_chn1:`{a} is captain: they get the right channel ⭐ and secretly pass it to {b}.`,tu_chn2:`{b} relays it to {c}… but a hidden Wrecker can change the channel.`,
tu_chn3:`The last relay steers the ship: wrong channel, it sinks. Everyone sees the route, nobody sees what the others passed.`,tu_chn4:`Debate, then vote: the suspect is put in irons ⛓️ and what they pass becomes public.`,
tu_chn5:`At the end, accuse in secret: +2 per Wrecker unmasked. But enough sunk ships, and they win.`});
GCH('es',{n_chn:`La Cadena de Faros`,d_chn:`Pasad el canal correcto… sin saber quién lo enreda`,
r_chn:`Cada ola, un capitán recibe en secreto el canal correcto (🐚 ⭐ 🌙 🐋) y lo pasa en privado al farero que elija, que lo releva a su vez: el último guía el barco. Entre vosotros se esconde 1 Naufragador (2 desde 6 jugadores) que puede cambiar el canal: si se hunden bastantes barcos (contador 💥), ganan los Naufragadores. Entre olas, debatid en el chat y votad para encadenar a un sospechoso (lo que recibe y pasa se vuelve público); al final, cada uno acusa en secreto: +2 por Naufragador desenmascarado.`,
chN:`Naufragador`,chC:`Farero`,chSkT:`Los Naufragadores ganan con {v} barcos hundidos`,chWaitC:`{n} es capitán: el canal sale…`,chWait:`{n} releva el canal…`,
chCap:`El canal correcto:`,chGot:`Te han pasado:`,chNtip:`Puedes cambiar el canal… o mantenerlo para seguir siendo creíble.`,chPass:`¿Qué canal pasas?`,chPilot:`Guías el barco: ¿qué canal?`,chTo:`¿A quién?`,chSail:`Levar anclas`,
chOk:`¡El barco ha llegado!`,chKo:`¡El barco se ha hundido!`,chTr:`canal correcto`,chF:`canal tomado`,chVote:`¿Encadenar a alguien?`,chVoteD:`Hace falta mayoría. Sus relevos serán públicos.`,chFree:`Nadie (liberar)`,chNone:`Nadie`,chNoneS:`nadie`,
chAcc:`¿Quiénes son los Naufragadores? (hasta {v})`,chAccD:`+2 por Naufragador desenmascarado.`,chAccN:`Acusa también a alguien: nadie debe adivinar tu rol.`,chAccOk:`Enviado ✓`,chLog:`Cuaderno de bitácora`,
chWinN:`Ganan los Naufragadores: ¡{v} barcos hundidos!`,chWinC:`Gana la tripulación: ¡la flota está a salvo!`,chWere:`Los Naufragadores eran:`,
tu_chn1:`{a} es capitán: recibe el canal correcto ⭐ y se lo pasa en secreto a {b}.`,tu_chn2:`{b} se lo pasa a {c}… pero un Naufragador oculto puede cambiar el canal.`,
tu_chn3:`El último relevo guía el barco: canal equivocado, se hunde. Todos ven la ruta, nadie ve lo que pasaron los demás.`,tu_chn4:`Debatid y votad: el sospechoso queda encadenado ⛓️ y lo que pasa se vuelve público.`,
tu_chn5:`Al final, acusad en secreto: +2 por Naufragador desenmascarado. Pero con bastantes barcos hundidos, ganan ellos.`});
GCH('it',{n_chn:`La Catena dei Fari`,d_chn:`Passate il canale giusto… senza sapere chi lo confonde`,
r_chn:`A ogni ondata, un capitano riceve in segreto il canale giusto (🐚 ⭐ 🌙 🐋) e lo passa in privato al guardiano che vuole, che lo inoltra a sua volta: l'ultimo guida la nave. Tra voi si nasconde 1 Naufragatore (2 da 6 giocatori) che può cambiare il canale: se affondano abbastanza navi (contatore 💥), vincono i Naufragatori. Tra un'ondata e l'altra, discutete in chat e votate per mettere ai ferri un sospettato (ciò che riceve e passa diventa pubblico); alla fine ognuno accusa in segreto: +2 per Naufragatore smascherato.`,
chN:`Naufragatore`,chC:`Guardiano del faro`,chSkT:`I Naufragatori vincono con {v} navi affondate`,chWaitC:`{n} è capitano: il canale parte…`,chWait:`{n} inoltra il canale…`,
chCap:`Il canale giusto:`,chGot:`Ti hanno passato:`,chNtip:`Puoi cambiare il canale… o tenerlo per restare credibile.`,chPass:`Che canale passi?`,chPilot:`Guidi la nave: quale canale?`,chTo:`A chi?`,chSail:`Salpare`,
chOk:`La nave è arrivata!`,chKo:`La nave è affondata!`,chTr:`canale giusto`,chF:`canale preso`,chVote:`Mettere qualcuno ai ferri?`,chVoteD:`Serve la maggioranza. I suoi passaggi diventeranno pubblici.`,chFree:`Nessuno (liberare)`,chNone:`Nessuno`,chNoneS:`nessuno`,
chAcc:`Chi sono i Naufragatori? (fino a {v})`,chAccD:`+2 per Naufragatore smascherato.`,chAccN:`Accusa anche tu qualcuno: nessuno deve indovinare il tuo ruolo.`,chAccOk:`Inviato ✓`,chLog:`Diario di bordo`,
chWinN:`Vincono i Naufragatori: {v} navi affondate!`,chWinC:`Vince l'equipaggio: la flotta è salva!`,chWere:`I Naufragatori erano:`,
tu_chn1:`{a} è capitano: riceve il canale giusto ⭐ e lo passa in segreto a {b}.`,tu_chn2:`{b} lo inoltra a {c}… ma un Naufragatore nascosto può cambiare il canale.`,
tu_chn3:`L'ultimo passaggio guida la nave: canale sbagliato, affonda. Tutti vedono la rotta, nessuno vede cosa hanno passato gli altri.`,tu_chn4:`Discutete, poi votate: il sospettato finisce ai ferri ⛓️ e ciò che passa diventa pubblico.`,
tu_chn5:`Alla fine accusate in segreto: +2 per Naufragatore smascherato. Ma con abbastanza navi affondate, vincono loro.`});
GCH('de',{n_chn:`Die Leuchtturmkette`,d_chn:`Gebt die richtige Fahrrinne weiter… ohne zu wissen, wer sie verfälscht`,
r_chn:`In jeder Welle erhält ein Kapitän geheim die richtige Fahrrinne (🐚 ⭐ 🌙 🐋) und gibt sie privat an einen Wärter seiner Wahl weiter, der sie wiederum weiterreicht: der Letzte steuert das Schiff. Unter euch versteckt sich 1 Strandräuber (2 ab 6 Leuten), der die Rinne ändern kann: sinken genug Schiffe (Zähler 💥), gewinnen die Strandräuber. Zwischen den Wellen diskutiert im Chat und stimmt ab, wen ihr in Ketten legt (was er erhält und weitergibt, wird öffentlich); am Ende klagt jeder geheim an: +2 pro entlarvtem Strandräuber.`,
chN:`Strandräuber`,chC:`Leuchtturmwärter`,chSkT:`Die Strandräuber gewinnen bei {v} gesunkenen Schiffen`,chWaitC:`{n} ist Kapitän: die Rinne geht los…`,chWait:`{n} gibt die Rinne weiter…`,
chCap:`Die richtige Rinne:`,chGot:`Du hast erhalten:`,chNtip:`Du kannst die Rinne ändern… oder sie behalten, um glaubwürdig zu bleiben.`,chPass:`Welche Rinne gibst du weiter?`,chPilot:`Du steuerst das Schiff: welche Rinne?`,chTo:`An wen?`,chSail:`Anker lichten`,
chOk:`Das Schiff ist angekommen!`,chKo:`Das Schiff ist gesunken!`,chTr:`richtige Rinne`,chF:`genommene Rinne`,chVote:`Jemanden in Ketten legen?`,chVoteD:`Es braucht eine Mehrheit. Seine Weitergaben werden öffentlich.`,chFree:`Niemand (freilassen)`,chNone:`Niemand`,chNoneS:`niemand`,
chAcc:`Wer sind die Strandräuber? (bis zu {v})`,chAccD:`+2 pro entlarvtem Strandräuber.`,chAccN:`Klag auch jemanden an: niemand soll deine Rolle erraten.`,chAccOk:`Gesendet ✓`,chLog:`Logbuch`,
chWinN:`Die Strandräuber gewinnen: {v} Schiffe gesunken!`,chWinC:`Die Mannschaft gewinnt: die Flotte ist gerettet!`,chWere:`Die Strandräuber waren:`,
tu_chn1:`{a} ist Kapitän: er erhält die richtige Rinne ⭐ und gibt sie geheim an {b} weiter.`,tu_chn2:`{b} gibt sie an {c} weiter… aber ein versteckter Strandräuber kann die Rinne ändern.`,
tu_chn3:`Der Letzte steuert das Schiff: falsche Rinne, es sinkt. Alle sehen die Route, niemand sieht, was die anderen weitergegeben haben.`,tu_chn4:`Diskutiert, dann stimmt ab: der Verdächtige kommt in Ketten ⛓️ und was er weitergibt, wird öffentlich.`,
tu_chn5:`Am Ende klagt ihr geheim an: +2 pro entlarvtem Strandräuber. Aber sinken genug Schiffe, gewinnen sie.`});
GCH('ru',{n_chn:`Цепь маяков`,d_chn:`Передайте верный фарватер… не зная, кто его путает`,
r_chn:`Каждую волну капитан тайно получает верный фарватер (🐚 ⭐ 🌙 🐋) и лично передаёт его выбранному смотрителю, а тот — дальше: последний ведёт корабль. Среди вас прячется 1 Мародёр (2 — от 6 игроков), который может подменить фарватер: если затонет достаточно кораблей (счётчик 💥), Мародёры побеждают. Между волнами спорьте в чате и голосуйте, кого заковать в кандалы (всё, что он получает и передаёт, становится публичным); в конце каждый тайно обвиняет: +2 за каждого разоблачённого Мародёра.`,
chN:`Мародёр`,chC:`Смотритель маяка`,chSkT:`Мародёры побеждают при {v} затонувших кораблях`,chWaitC:`{n} — капитан: фарватер отправляется…`,chWait:`{n} передаёт фарватер…`,
chCap:`Верный фарватер:`,chGot:`Тебе передали:`,chNtip:`Можно подменить фарватер… или оставить, чтобы не вызвать подозрений.`,chPass:`Какой фарватер передаёшь?`,chPilot:`Ты ведёшь корабль: какой фарватер?`,chTo:`Кому?`,chSail:`Поднять якорь`,
chOk:`Корабль дошёл!`,chKo:`Корабль затонул!`,chTr:`верный фарватер`,chF:`выбранный фарватер`,chVote:`Заковать кого-нибудь?`,chVoteD:`Нужно большинство. Его передачи станут публичными.`,chFree:`Никого (освободить)`,chNone:`Никого`,chNoneS:`никого`,
chAcc:`Кто Мародёры? (до {v})`,chAccD:`+2 за каждого разоблачённого Мародёра.`,chAccN:`Тоже обвини кого-нибудь: никто не должен угадать твою роль.`,chAccOk:`Отправлено ✓`,chLog:`Судовой журнал`,
chWinN:`Побеждают Мародёры: затонуло кораблей — {v}!`,chWinC:`Побеждает команда: флот спасён!`,chWere:`Мародёрами были:`,
tu_chn1:`{a} — капитан: получает верный фарватер ⭐ и тайно передаёт его {b}.`,tu_chn2:`{b} передаёт его {c}… но скрытый Мародёр может подменить фарватер.`,
tu_chn3:`Последний ведёт корабль: неверный фарватер — и он тонет. Маршрут видят все, а что передали другие — никто.`,tu_chn4:`Спорьте и голосуйте: подозреваемого заковывают ⛓️, и всё, что он передаёт, становится публичным.`,
tu_chn5:`В конце обвиняйте тайно: +2 за каждого разоблачённого Мародёра. Но если кораблей затонет достаточно, побеждают они.`});
GCH('zh',{n_chn:`灯塔之链`,d_chn:`传出正确的航道……却不知道是谁在捣乱`,
r_chn:`每一波，船长秘密得知正确航道（🐚 ⭐ 🌙 🐋），私下传给自己选的守塔人，再由他继续传下去：最后一人为船掌舵。你们之中藏着1名破船者（6人起为2名），他可以改动航道：沉船达到一定数量（见💥计数），破船者获胜。每波之间在聊天里讨论，并投票给嫌疑人戴上镣铐（他收到和传出的内容都会公开）；最后每人秘密指认：每揪出一名破船者+2。`,
chN:`破船者`,chC:`守塔人`,chSkT:`沉船达到{v}艘时破船者获胜`,chWaitC:`{n}是船长：航道出发了……`,chWait:`{n}正在传递航道……`,
chCap:`正确航道：`,chGot:`你收到的是：`,chNtip:`你可以改动航道……也可以照传以保持可信。`,chPass:`你要传出哪条航道？`,chPilot:`你来掌舵：走哪条航道？`,chTo:`传给谁？`,chSail:`起锚`,
chOk:`船到港了！`,chKo:`船沉了！`,chTr:`正确航道`,chF:`实际航道`,chVote:`要给谁戴上镣铐吗？`,chVoteD:`需要过半数。他的传递将会公开。`,chFree:`不选（释放）`,chNone:`不选`,chNoneS:`不选`,
chAcc:`谁是破船者？（最多{v}人）`,chAccD:`每揪出一名破船者+2。`,chAccN:`你也指认一个人吧：别让人猜出你的身份。`,chAccOk:`已发送 ✓`,chLog:`航海日志`,
chWinN:`破船者获胜：沉了{v}艘船！`,chWinC:`船员获胜：船队平安！`,chWere:`破船者是：`,
tu_chn1:`{a}是船长：他得知正确航道⭐，并秘密传给{b}。`,tu_chn2:`{b}再传给{c}……但隐藏的破船者可以改动航道。`,
tu_chn3:`最后一人掌舵：航道错了，船就沉。大家都看得到路线，却看不到别人传了什么。`,tu_chn4:`讨论后投票：嫌疑人被戴上镣铐⛓️，他传出的内容会公开。`,
tu_chn5:`最后秘密指认：每揪出一名破船者+2。但沉船够多的话，就是他们赢。`});
GCH('he',{n_chn:`שרשרת המגדלורים`,d_chn:`העבירו את הנתיב הנכון… בלי לדעת מי משבש אותו`,
r_chn:`בכל גל, רב החובל מקבל בסוד את הנתיב הנכון (🐚 ⭐ 🌙 🐋) ומעביר אותו בפרטי לשומר שהוא בוחר, וזה מעביר הלאה: האחרון מנווט את הספינה. ביניכם מסתתר מטביע 1 (2 החל מ־6 שחקנים) שיכול לשנות את הנתיב: אם טובעות מספיק ספינות (מונה 💥), המטביעים מנצחים. בין הגלים התווכחו בצ׳אט והצביעו מי נכבל באזיקים (מה שהוא מקבל ומעביר נהיה גלוי); בסוף כל אחד מאשים בסוד: ‎+2 על כל מטביע שנחשף.`,
chN:`מטביע`,chC:`שומר מגדלור`,chSkT:`המטביעים מנצחים ב־{v} ספינות טבועות`,chWaitC:`{n} רב החובל: הנתיב יוצא לדרך…`,chWait:`{n} מעביר את הנתיב…`,
chCap:`הנתיב הנכון:`,chGot:`העבירו לך:`,chNtip:`אפשר לשנות את הנתיב… או להשאיר אותו כדי להישאר אמין.`,chPass:`איזה נתיב להעביר?`,chPilot:`אתה מנווט את הספינה: איזה נתיב?`,chTo:`למי?`,chSail:`להרים עוגן`,
chOk:`הספינה הגיעה!`,chKo:`הספינה טבעה!`,chTr:`נתיב נכון`,chF:`נתיב שנבחר`,chVote:`לכבול מישהו?`,chVoteD:`צריך רוב. ההעברות שלו ייחשפו.`,chFree:`אף אחד (לשחרר)`,chNone:`אף אחד`,chNoneS:`אף אחד`,
chAcc:`מי המטביעים? (עד {v})`,chAccD:`‎+2 על כל מטביע שנחשף.`,chAccN:`האשימו גם מישהו: אסור שינחשו את התפקיד שלכם.`,chAccOk:`נשלח ✓`,chLog:`יומן הספינה`,
chWinN:`המטביעים ניצחו: {v} ספינות טבעו!`,chWinC:`הצוות ניצח: הצי ניצל!`,chWere:`המטביעים היו:`,
tu_chn1:`{a} רב החובל: הוא מקבל את הנתיב הנכון ⭐ ומעביר אותו בסוד ל{b}.`,tu_chn2:`{b} מעביר אותו ל{c}… אבל מטביע נסתר יכול לשנות את הנתיב.`,
tu_chn3:`האחרון מנווט את הספינה: נתיב שגוי, והיא טובעת. כולם רואים את המסלול, אף אחד לא רואה מה האחרים העבירו.`,tu_chn4:`התווכחו ואז הצביעו: החשוד נכבל ⛓️ ומה שהוא מעביר נהיה גלוי.`,
tu_chn5:`בסוף האשימו בסוד: ‎+2 על כל מטביע שנחשף. אבל אם טבעו מספיק ספינות, הם מנצחים.`});
GCH('pt',{n_chn:`A Corrente de Faróis`,d_chn:`Passem o canal certo… sem saber quem o embaralha`,
r_chn:`A cada onda, um capitão recebe em segredo o canal certo (🐚 ⭐ 🌙 🐋) e o passa no privado para o faroleiro que quiser, que o repassa por sua vez: o último guia o navio. Entre vocês se esconde 1 Naufragador (2 a partir de 6 jogadores) que pode mudar o canal: se afundarem navios suficientes (contador 💥), os Naufragadores vencem. Entre as ondas, debatam no chat e votem para acorrentar um suspeito (o que ele recebe e passa fica público); no fim, cada um acusa em segredo: +2 por Naufragador desmascarado.`,
chN:`Naufragador`,chC:`Faroleiro`,chSkT:`Os Naufragadores vencem com {v} navios afundados`,chWaitC:`{n} é capitão: o canal está saindo…`,chWait:`{n} está repassando o canal…`,
chCap:`O canal certo:`,chGot:`Passaram para você:`,chNtip:`Você pode mudar o canal… ou mantê-lo para continuar confiável.`,chPass:`Que canal você passa?`,chPilot:`Você guia o navio: qual canal?`,chTo:`Para quem?`,chSail:`Levantar âncora`,
chOk:`O navio chegou!`,chKo:`O navio afundou!`,chTr:`canal certo`,chF:`canal tomado`,chVote:`Acorrentar alguém?`,chVoteD:`É preciso maioria. Os repasses dele ficarão públicos.`,chFree:`Ninguém (soltar)`,chNone:`Ninguém`,chNoneS:`ninguém`,
chAcc:`Quem são os Naufragadores? (até {v})`,chAccD:`+2 por Naufragador desmascarado.`,chAccN:`Acuse alguém também: ninguém deve adivinhar seu papel.`,chAccOk:`Enviado ✓`,chLog:`Diário de bordo`,
chWinN:`Os Naufragadores vencem: {v} navios afundados!`,chWinC:`A tripulação vence: a frota está salva!`,chWere:`Os Naufragadores eram:`,
tu_chn1:`{a} é capitão: recebe o canal certo ⭐ e o passa em segredo para {b}.`,tu_chn2:`{b} repassa para {c}… mas um Naufragador escondido pode mudar o canal.`,
tu_chn3:`O último repasse guia o navio: canal errado, ele afunda. Todos veem a rota, ninguém vê o que os outros passaram.`,tu_chn4:`Debatam e votem: o suspeito é acorrentado ⛓️ e o que ele passa fica público.`,
tu_chn5:`No fim, acusem em segredo: +2 por Naufragador desmascarado. Mas com navios afundados suficientes, eles vencem.`});
/* 🐙 Le Mimétique : textes */
GCH('fr',{n_mim:`Le Mimétique`,d_mim:`Plongée dans le noir : quelqu'un imite les autres`,
r_mim:`Grotte sous-marine, en temps réel : touche un point pour y nager, ta lampe n'éclaire qu'autour de toi. Ramassez les perles de votre couleur pour atteindre l'objectif. Caché parmi vous, 1 Mimétique (2 dès 7 joueurs) peut prendre l'apparence de quelqu'un et voler ses perles : 3 vols (4 dès 7) ou la fin du temps, et les Mimétiques gagnent. Retenez qui était où, remontez pour débattre et votez : la personne désignée révèle son rôle.`,
miCrew:`Équipage`,miMim:`Mimétique`,miOut:`Démasqué`,miHint:`Touche un point pour y nager · ramasse les perles de ta couleur`,miHintM:`Touche un point pour nager · 🎭 imite quelqu'un pour voler ses perles`,
miGoalT:`Perles annoncées / objectif · ✓ = vraiment dans le filet au dernier débat`,miMine:`ramassées`,miStolen:`volées`,miMask:`Imiter`,miMaskQ:`Prendre l'apparence de…`,miAs:`en {n}`,
miCall:`Débat`,miCallAsk:`Remonter et ouvrir un débat ? Il en reste {v} pour toute la partie.`,miThefts:`vols`,miStole:`volée`,
miZ:`près de l'épave|sous l'arche|dans les coraux|dans le kelp|près de la cheminée|parmi les méduses|à la cloche`,miZn:`Épave|Arche|Coraux|Kelp|Cheminée|Méduses|Cloche`,
miLog:`Perles depuis la dernière remontée`,miDeb:`{n} a ouvert un débat`,miNet:`Dans le filet : {a} vraies perles sur {b} annoncées`,miNetD:`L'écart : des fausses récoltes de Mimétique… ou des vols.`,
miVote:`Qui doit révéler son rôle ?`,miVoteD:`Il faut le plus de voix (au moins 2). Si c'est quelqu'un de l'équipage : −{v} s de plongée.`,miNone:`Personne`,
miRevM:`{n} était Mimétique ! Ses pouvoirs s'éteignent.`,miRevC:`{n} était de l'équipage… −{v} s de plongée.`,miRev0:`Pas de majorité : personne ne révèle son rôle.`,miBack:`Tout le monde repart de la cloche.`,
miWinC:`L'équipage l'emporte : le filet est plein !`,miWinC2:`L'équipage l'emporte : tous les Mimétiques sont démasqués !`,miWinS:`Les Mimétiques l'emportent : {v} perles volées !`,miWinM:`Les Mimétiques l'emportent : le temps est écoulé.`,
miWere:`Les Mimétiques étaient :`,miStM:`perles volées : {a} · fausses récoltes : {b}`,miStC:`perles ramassées : {a}`,
tu_mim1:`Touche un point (ou glisse le doigt) pour y nager. Ta lampe n'éclaire qu'autour de toi : les autres et les perles n'apparaissent que dans ton halo.`,
tu_mim2:`Ramasse les perles de ta couleur en passant dessus. De nouvelles perles apparaissent pendant toute la plongée : ensemble, atteignez l'objectif.`,
tu_mim3:`Le Mimétique 🐙 peut prendre l'apparence de {b} quelques secondes (un nuage d'encre le trahit) et voler ses perles. Le fil annonce : perle de {b} volée près de l'épave.`,
tu_mim4:`Mais {b} était avec {a}, à l'autre bout ! Quelqu'un l'imitait. Souvenez-vous de qui était où, et guettez les nuages d'encre.`,
tu_mim5:`📯 Remontez pour débattre (nombre limité) et votez en secret, en changeant d'avis si besoin : la personne désignée révèle son rôle. Mimétique : ses pouvoirs s'éteignent. Erreur : l'équipage perd du temps.`,
tu_mim6:`L'équipage gagne à l'objectif, ou en démasquant tous les Mimétiques. Les Mimétiques gagnent après assez de vols, ou si le temps s'écoule.`});
GCH('en',{n_mim:`The Mimic`,d_mim:`A dive in the dark: someone is imitating the others`,
r_mim:`An underwater cave, in real time: tap a point to swim there; your lamp only lights up around you. Collect pearls of your own colour to reach the goal. Hidden among you, 1 Mimic (2 from 7 players) can take someone's appearance and steal their pearls: 3 thefts (4 from 7 players) or time running out, and the Mimics win. Remember who was where, surface to debate and vote: the chosen person reveals their role.`,
miCrew:`Crew`,miMim:`Mimic`,miOut:`Unmasked`,miHint:`Tap a point to swim there · collect pearls of your colour`,miHintM:`Tap a point to swim · 🎭 imitate someone to steal their pearls`,
miGoalT:`Pearls announced / goal · ✓ = really in the net at the last debate`,miMine:`collected`,miStolen:`stolen`,miMask:`Imitate`,miMaskQ:`Take the appearance of…`,miAs:`as {n}`,
miCall:`Debate`,miCallAsk:`Surface and open a debate? {v} left for the whole game.`,miThefts:`thefts`,miStole:`stolen`,
miZ:`near the wreck|under the arch|in the corals|in the kelp|near the chimney|among the jellyfish|at the bell`,miZn:`Wreck|Arch|Corals|Kelp|Chimney|Jellyfish|Bell`,
miLog:`Pearls since the last surfacing`,miDeb:`{n} opened a debate`,miNet:`In the net: {a} real pearls out of {b} announced`,miNetD:`The gap: a Mimic's fake pickups… or thefts.`,
miVote:`Who should reveal their role?`,miVoteD:`It takes the most votes (at least 2). If it's a crew member: −{v} s of dive time.`,miNone:`Nobody`,
miRevM:`{n} was a Mimic! Their powers fade out.`,miRevC:`{n} was crew… −{v} s of dive time.`,miRev0:`No majority: nobody reveals their role.`,miBack:`Everyone sets off again from the bell.`,
miWinC:`The crew wins: the net is full!`,miWinC2:`The crew wins: every Mimic is unmasked!`,miWinS:`The Mimics win: {v} pearls stolen!`,miWinM:`The Mimics win: time is up.`,
miWere:`The Mimics were:`,miStM:`pearls stolen: {a} · fake pickups: {b}`,miStC:`pearls collected: {a}`,
tu_mim1:`Tap a point (or drag your finger) to swim there. Your lamp only lights up around you: others and pearls only appear inside your halo.`,
tu_mim2:`Collect pearls of your colour by swimming over them. New pearls appear throughout the dive: together, reach the goal.`,
tu_mim3:`The Mimic 🐙 can take {b}'s appearance for a few seconds (a cloud of ink gives it away) and steal their pearls. The feed says: {b}'s pearl stolen near the wreck.`,
tu_mim4:`But {b} was with {a}, at the other end! Someone was imitating them. Remember who was where, and watch for ink clouds.`,
tu_mim5:`📯 Surface to debate (limited number) and vote in secret, changing your mind if needed: the chosen person reveals their role. A Mimic loses their powers. A mistake costs the crew time.`,
tu_mim6:`The crew wins by reaching the goal, or by unmasking every Mimic. The Mimics win after enough thefts, or when time runs out.`});
GCH('es',{n_mim:`El Mimético`,d_mim:`Buceo a oscuras: alguien imita a los demás`,
r_mim:`Una cueva submarina, en tiempo real: toca un punto para nadar hasta allí; tu linterna solo alumbra a tu alrededor. Recoged las perlas de vuestro color para alcanzar el objetivo. Escondido entre vosotros, 1 Mimético (2 desde 7 jugadores) puede tomar la apariencia de alguien y robar sus perlas: con 3 robos (4 desde 7) o al acabarse el tiempo, ganan los Miméticos. Recordad quién estaba dónde, subid a debatir y votad: la persona elegida revela su rol.`,
miCrew:`Tripulación`,miMim:`Mimético`,miOut:`Desenmascarado`,miHint:`Toca un punto para nadar · recoge las perlas de tu color`,miHintM:`Toca un punto para nadar · 🎭 imita a alguien para robar sus perlas`,
miGoalT:`Perlas anunciadas / objetivo · ✓ = realmente en la red en el último debate`,miMine:`recogidas`,miStolen:`robadas`,miMask:`Imitar`,miMaskQ:`Tomar la apariencia de…`,miAs:`como {n}`,
miCall:`Debate`,miCallAsk:`¿Subir y abrir un debate? Quedan {v} para toda la partida.`,miThefts:`robos`,miStole:`robada`,
miZ:`junto al pecio|bajo el arco|entre los corales|en el kelp|junto a la chimenea|entre las medusas|en la campana`,miZn:`Pecio|Arco|Corales|Kelp|Chimenea|Medusas|Campana`,
miLog:`Perlas desde la última subida`,miDeb:`{n} ha abierto un debate`,miNet:`En la red: {a} perlas reales de {b} anunciadas`,miNetD:`La diferencia: recogidas falsas de un Mimético… o robos.`,
miVote:`¿Quién debe revelar su rol?`,miVoteD:`Hacen falta más votos que nadie (al menos 2). Si es de la tripulación: −{v} s de buceo.`,miNone:`Nadie`,
miRevM:`¡{n} era Mimético! Sus poderes se apagan.`,miRevC:`{n} era de la tripulación… −{v} s de buceo.`,miRev0:`Sin mayoría: nadie revela su rol.`,miBack:`Todo el mundo vuelve a salir desde la campana.`,
miWinC:`¡Gana la tripulación: la red está llena!`,miWinC2:`¡Gana la tripulación: todos los Miméticos desenmascarados!`,miWinS:`¡Ganan los Miméticos: {v} perlas robadas!`,miWinM:`Ganan los Miméticos: se acabó el tiempo.`,
miWere:`Los Miméticos eran:`,miStM:`perlas robadas: {a} · recogidas falsas: {b}`,miStC:`perlas recogidas: {a}`,
tu_mim1:`Toca un punto (o desliza el dedo) para nadar hasta allí. Tu linterna solo alumbra a tu alrededor: los demás y las perlas solo aparecen dentro de tu halo.`,
tu_mim2:`Recoge las perlas de tu color pasando por encima. Aparecen perlas nuevas durante todo el buceo: juntos, alcanzad el objetivo.`,
tu_mim3:`El Mimético 🐙 puede tomar la apariencia de {b} unos segundos (una nube de tinta lo delata) y robar sus perlas. El registro anuncia: perla de {b} robada junto al pecio.`,
tu_mim4:`¡Pero {b} estaba con {a}, en la otra punta! Alguien lo imitaba. Recordad quién estaba dónde y vigilad las nubes de tinta.`,
tu_mim5:`📯 Subid a debatir (número limitado) y votad en secreto, cambiando de opinión si hace falta: la persona elegida revela su rol. Un Mimético pierde sus poderes. Un error le cuesta tiempo a la tripulación.`,
tu_mim6:`La tripulación gana al alcanzar el objetivo, o desenmascarando a todos los Miméticos. Los Miméticos ganan tras suficientes robos, o si se acaba el tiempo.`});
GCH('it',{n_mim:`Il Mimetico`,d_mim:`Un'immersione al buio: qualcuno imita gli altri`,
r_mim:`Una grotta sottomarina, in tempo reale: tocca un punto per nuotarci; la tua lampada illumina solo intorno a te. Raccogliete le perle del vostro colore per raggiungere l'obiettivo. Nascosto tra voi, 1 Mimetico (2 da 7 giocatori) può prendere l'aspetto di qualcuno e rubargli le perle: con 3 furti (4 da 7) o allo scadere del tempo, vincono i Mimetici. Ricordate chi era dove, risalite a discutere e votate: la persona scelta rivela il suo ruolo.`,
miCrew:`Equipaggio`,miMim:`Mimetico`,miOut:`Smascherato`,miHint:`Tocca un punto per nuotarci · raccogli le perle del tuo colore`,miHintM:`Tocca un punto per nuotare · 🎭 imita qualcuno per rubargli le perle`,
miGoalT:`Perle annunciate / obiettivo · ✓ = davvero nella rete all'ultimo dibattito`,miMine:`raccolte`,miStolen:`rubate`,miMask:`Imita`,miMaskQ:`Prendere l'aspetto di…`,miAs:`come {n}`,
miCall:`Dibattito`,miCallAsk:`Risalire e aprire un dibattito? Ne restano {v} per tutta la partita.`,miThefts:`furti`,miStole:`rubata`,
miZ:`vicino al relitto|sotto l'arco|tra i coralli|nel kelp|vicino al camino|tra le meduse|alla campana`,miZn:`Relitto|Arco|Coralli|Kelp|Camino|Meduse|Campana`,
miLog:`Perle dall'ultima risalita`,miDeb:`{n} ha aperto un dibattito`,miNet:`Nella rete: {a} perle vere su {b} annunciate`,miNetD:`La differenza: finte raccolte di un Mimetico… o furti.`,
miVote:`Chi deve rivelare il suo ruolo?`,miVoteD:`Servono più voti di ogni altra scelta (almeno 2). Se è dell'equipaggio: −{v} s di immersione.`,miNone:`Nessuno`,
miRevM:`{n} era un Mimetico! I suoi poteri si spengono.`,miRevC:`{n} era dell'equipaggio… −{v} s di immersione.`,miRev0:`Nessuna maggioranza: nessuno rivela il suo ruolo.`,miBack:`Tutti ripartono dalla campana.`,
miWinC:`Vince l'equipaggio: la rete è piena!`,miWinC2:`Vince l'equipaggio: tutti i Mimetici smascherati!`,miWinS:`Vincono i Mimetici: {v} perle rubate!`,miWinM:`Vincono i Mimetici: il tempo è scaduto.`,
miWere:`I Mimetici erano:`,miStM:`perle rubate: {a} · finte raccolte: {b}`,miStC:`perle raccolte: {a}`,
tu_mim1:`Tocca un punto (o trascina il dito) per nuotarci. La tua lampada illumina solo intorno a te: gli altri e le perle compaiono solo nel tuo alone.`,
tu_mim2:`Raccogli le perle del tuo colore passandoci sopra. Nuove perle compaiono per tutta l'immersione: insieme, raggiungete l'obiettivo.`,
tu_mim3:`Il Mimetico 🐙 può prendere l'aspetto di {b} per qualche secondo (una nuvola d'inchiostro lo tradisce) e rubargli le perle. Il registro annuncia: perla di {b} rubata vicino al relitto.`,
tu_mim4:`Ma {b} era con {a}, dall'altra parte! Qualcuno lo imitava. Ricordate chi era dove, e tenete d'occhio le nuvole d'inchiostro.`,
tu_mim5:`📯 Risalite a discutere (numero limitato) e votate in segreto, cambiando idea se serve: la persona scelta rivela il suo ruolo. Un Mimetico perde i suoi poteri. Un errore costa tempo all'equipaggio.`,
tu_mim6:`L'equipaggio vince raggiungendo l'obiettivo, o smascherando tutti i Mimetici. I Mimetici vincono dopo abbastanza furti, o se il tempo scade.`});
GCH('de',{n_mim:`Der Mimetiker`,d_mim:`Tauchgang im Dunkeln: jemand ahmt die anderen nach`,
r_mim:`Eine Unterwasserhöhle, in Echtzeit: tippe auf einen Punkt, um hinzuschwimmen; deine Lampe leuchtet nur um dich herum. Sammelt die Perlen eurer Farbe, um das Ziel zu erreichen. Unter euch versteckt sich 1 Mimetiker (2 ab 7 Leuten), der das Aussehen einer Person annehmen und ihre Perlen stehlen kann: 3 Diebstähle (4 ab 7) oder Zeit abgelaufen, und die Mimetiker gewinnen. Merkt euch, wer wo war, taucht auf, diskutiert und stimmt ab: die gewählte Person zeigt ihre Rolle.`,
miCrew:`Crew`,miMim:`Mimetiker`,miOut:`Entlarvt`,miHint:`Tippe auf einen Punkt, um hinzuschwimmen · sammle die Perlen deiner Farbe`,miHintM:`Tippe zum Schwimmen · 🎭 ahme jemanden nach, um Perlen zu stehlen`,
miGoalT:`Gemeldete Perlen / Ziel · ✓ = wirklich im Netz bei der letzten Debatte`,miMine:`gesammelt`,miStolen:`gestohlen`,miMask:`Nachahmen`,miMaskQ:`Das Aussehen annehmen von…`,miAs:`als {n}`,
miCall:`Debatte`,miCallAsk:`Auftauchen und eine Debatte eröffnen? Noch {v} für das ganze Spiel.`,miThefts:`Diebstähle`,miStole:`gestohlen`,
miZ:`beim Wrack|unter dem Bogen|in den Korallen|im Seetang|beim Schlot|bei den Quallen|an der Glocke`,miZn:`Wrack|Bogen|Korallen|Seetang|Schlot|Quallen|Glocke`,
miLog:`Perlen seit dem letzten Auftauchen`,miDeb:`{n} hat eine Debatte eröffnet`,miNet:`Im Netz: {a} echte Perlen von {b} gemeldeten`,miNetD:`Die Lücke: Scheinfunde eines Mimetikers… oder Diebstähle.`,
miVote:`Wer soll die eigene Rolle zeigen?`,miVoteD:`Es braucht die meisten Stimmen (mindestens 2). Trifft es die Crew: −{v} s Tauchzeit.`,miNone:`Niemand`,
miRevM:`{n} war Mimetiker! Die Kräfte erlöschen.`,miRevC:`{n} war von der Crew… −{v} s Tauchzeit.`,miRev0:`Keine Mehrheit: niemand zeigt die eigene Rolle.`,miBack:`Alle starten wieder an der Glocke.`,
miWinC:`Die Crew gewinnt: das Netz ist voll!`,miWinC2:`Die Crew gewinnt: alle Mimetiker sind entlarvt!`,miWinS:`Die Mimetiker gewinnen: {v} Perlen gestohlen!`,miWinM:`Die Mimetiker gewinnen: die Zeit ist um.`,
miWere:`Die Mimetiker waren:`,miStM:`gestohlene Perlen: {a} · Scheinfunde: {b}`,miStC:`gesammelte Perlen: {a}`,
tu_mim1:`Tippe auf einen Punkt (oder zieh den Finger), um hinzuschwimmen. Deine Lampe leuchtet nur um dich herum: andere und Perlen erscheinen nur in deinem Lichtkreis.`,
tu_mim2:`Sammle die Perlen deiner Farbe, indem du darüber schwimmst. Neue Perlen erscheinen während des ganzen Tauchgangs: gemeinsam erreicht ihr das Ziel.`,
tu_mim3:`Der Mimetiker 🐙 kann ein paar Sekunden wie {b} aussehen (eine Tintenwolke verrät es) und Perlen stehlen. Die Meldung lautet: Perle von {b} beim Wrack gestohlen.`,
tu_mim4:`Aber {b} war bei {a}, am anderen Ende! Jemand hat {b} nachgeahmt. Merkt euch, wer wo war, und achtet auf Tintenwolken.`,
tu_mim5:`📯 Taucht auf zur Debatte (begrenzte Zahl) und stimmt geheim ab, umentscheiden erlaubt: die gewählte Person zeigt ihre Rolle. Ein Mimetiker verliert seine Kräfte. Ein Irrtum kostet die Crew Zeit.`,
tu_mim6:`Die Crew gewinnt mit dem Ziel oder wenn alle Mimetiker entlarvt sind. Die Mimetiker gewinnen nach genug Diebstählen oder wenn die Zeit abläuft.`});
GCH('ru',{n_mim:`Мимик`,d_mim:`Погружение в темноте: кто-то подражает другим`,
r_mim:`Подводная пещера, в реальном времени: коснись точки, чтобы плыть туда; фонарь светит только вокруг тебя. Собирайте жемчуг своего цвета, чтобы достичь цели. Среди вас прячется 1 Мимик (2 — от 7 игроков): он может принять облик другого игрока и красть его жемчуг. 3 кражи (4 — от 7) или конец времени — и Мимики побеждают. Запоминайте, кто где был, всплывайте для спора и голосуйте: выбранный игрок раскрывает роль.`,
miCrew:`Команда`,miMim:`Мимик`,miOut:`Разоблачён`,miHint:`Коснись точки, чтобы плыть · собирай жемчуг своего цвета`,miHintM:`Коснись точки, чтобы плыть · 🎭 подражай кому-то, чтобы красть жемчуг`,
miGoalT:`Объявленный жемчуг / цель · ✓ = действительно в сети на последнем споре`,miMine:`собрано`,miStolen:`украдено`,miMask:`Подражать`,miMaskQ:`Принять облик…`,miAs:`как {n}`,
miCall:`Спор`,miCallAsk:`Всплыть и начать спор? Осталось {v} на всю игру.`,miThefts:`краж`,miStole:`украдена`,
miZ:`у затонувшего корабля|под аркой|в кораллах|в водорослях|у трубы|среди медуз|у колокола`,miZn:`Корабль|Арка|Кораллы|Водоросли|Труба|Медузы|Колокол`,
miLog:`Жемчуг с последнего всплытия`,miDeb:`{n} начинает спор`,miNet:`В сети: {a} настоящих жемчужин из {b} объявленных`,miNetD:`Разница — это притворные находки Мимика… или кражи.`,
miVote:`Кто раскроет свою роль?`,miVoteD:`Нужно больше всех голосов (не меньше 2). Если это кто-то из команды: −{v} с погружения.`,miNone:`Никто`,
miRevM:`{n} — Мимик! Его силы гаснут.`,miRevC:`{n} — из команды… −{v} с погружения.`,miRev0:`Нет большинства: никто не раскрывает роль.`,miBack:`Все снова стартуют от колокола.`,
miWinC:`Команда побеждает: сеть полна!`,miWinC2:`Команда побеждает: все Мимики разоблачены!`,miWinS:`Мимики побеждают: украдено жемчужин — {v}!`,miWinM:`Мимики побеждают: время вышло.`,
miWere:`Мимиками были:`,miStM:`украдено: {a} · притворных находок: {b}`,miStC:`собрано жемчуга: {a}`,
tu_mim1:`Коснись точки (или веди пальцем), чтобы плыть туда. Фонарь светит только вокруг тебя: других и жемчуг видно только в твоём ореоле.`,
tu_mim2:`Собирай жемчуг своего цвета, проплывая над ним. Новый жемчуг появляется всё погружение: вместе достигните цели.`,
tu_mim3:`Мимик 🐙 может на несколько секунд принять облик {b} (выдаёт облачко чернил) и украсть его жемчуг. В ленте: жемчужина {b} украдена у затонувшего корабля.`,
tu_mim4:`Но {b} был с {a} на другом конце! Кто-то ему подражал. Запоминайте, кто где был, и следите за облачками чернил.`,
tu_mim5:`📯 Всплывайте для спора (число ограничено) и голосуйте тайно, можно передумать: выбранный игрок раскрывает роль. Мимик теряет силы. Ошибка стоит команде времени.`,
tu_mim6:`Команда побеждает, достигнув цели или разоблачив всех Мимиков. Мимики побеждают после достаточного числа краж или когда время выходит.`});
GCH('zh',{n_mim:`拟态者`,d_mim:`黑暗中的潜水：有人在模仿别人`,
r_mim:`实时的海底洞穴：点一下就游过去，你的灯只照亮身边。收集自己颜色的珍珠，一起达成目标。你们之中藏着1名拟态者（7人起2名），能变成别人的样子并偷走那人的珍珠：偷到3颗（7人起4颗）或时间耗尽，拟态者获胜。记住谁在哪里，浮上水面讨论并投票：被选中的人公开身份。`,
miCrew:`船员`,miMim:`拟态者`,miOut:`已揭穿`,miHint:`点一下就游过去 · 收集自己颜色的珍珠`,miHintM:`点一下就游过去 · 🎭 模仿别人来偷他的珍珠`,
miGoalT:`已播报珍珠 / 目标 · ✓ = 上次讨论时真正在网里的`,miMine:`已收集`,miStolen:`已偷`,miMask:`模仿`,miMaskQ:`变成……的样子`,miAs:`变成{n}`,
miCall:`讨论`,miCallAsk:`浮上水面开启讨论？整局还剩{v}次。`,miThefts:`偷窃`,miStole:`被偷`,
miZ:`在沉船旁|在拱门下|在珊瑚里|在海藻里|在烟囱旁|在水母间|在潜水钟`,miZn:`沉船|拱门|珊瑚|海藻|烟囱|水母|潜水钟`,
miLog:`上次浮出后的珍珠`,miDeb:`{n}开启了讨论`,miNet:`网里：{b}颗播报中有{a}颗是真的`,miNetD:`差距来自拟态者的假收集……或偷窃。`,
miVote:`谁该公开身份？`,miVoteD:`需要票数最多（至少2票）。若是船员：潜水时间−{v}秒。`,miNone:`不选`,
miRevM:`{n}是拟态者！能力熄灭了。`,miRevC:`{n}是船员……潜水时间−{v}秒。`,miRev0:`没有多数：无人公开身份。`,miBack:`所有人从潜水钟重新出发。`,
miWinC:`船员获胜：网装满了！`,miWinC2:`船员获胜：所有拟态者都被揭穿！`,miWinS:`拟态者获胜：偷走了{v}颗珍珠！`,miWinM:`拟态者获胜：时间到了。`,
miWere:`拟态者是：`,miStM:`偷走{a}颗 · 假收集{b}次`,miStC:`收集了{a}颗珍珠`,
tu_mim1:`点一下（或拖动手指）就游过去。你的灯只照亮身边：其他人和珍珠只在你的光圈里出现。`,
tu_mim2:`游过自己颜色的珍珠就能收集。整个潜水过程中都会出现新珍珠：一起达成目标。`,
tu_mim3:`拟态者🐙能变成{b}的样子几秒钟（一团墨汁会暴露它），偷走{b}的珍珠。动态显示：{b}的珍珠在沉船旁被偷。`,
tu_mim4:`可是{b}当时和{a}在另一头！有人在模仿。记住谁在哪里，留意墨汁。`,
tu_mim5:`📯 浮上水面讨论（次数有限），秘密投票，可以改票：被选中的人公开身份。拟态者失去能力；选错了，船员会损失时间。`,
tu_mim6:`船员达成目标或揭穿所有拟态者即获胜。拟态者偷够珍珠或时间耗尽即获胜。`});
GCH('he',{n_mim:`המחקה`,d_mim:`צלילה בחושך: מישהו מחקה את האחרים`,
r_mim:`מערה תת-ימית, בזמן אמת: נוגעים בנקודה כדי לשחות אליה; הפנס מאיר רק סביבכם. אספו פנינים בצבע שלכם כדי להגיע ליעד. בינכם מסתתר מחקה 1 (2 מ-7 שחקנים) שיכול ללבוש מראה של מישהו ולגנוב את הפנינים שלו: 3 גניבות (4 מ-7) או תום הזמן, והמחקים מנצחים. זכרו מי היה איפה, עלו לדיון והצביעו: מי שנבחר חושף את תפקידו.`,
miCrew:`צוות`,miMim:`מחקה`,miOut:`נחשף`,miHint:`נגיעה בנקודה כדי לשחות · אספו פנינים בצבע שלכם`,miHintM:`נגיעה כדי לשחות · 🎭 חקו מישהו כדי לגנוב את הפנינים שלו`,
miGoalT:`פנינים שהוכרזו / יעד · ✓ = באמת ברשת בדיון האחרון`,miMine:`נאספו`,miStolen:`נגנבו`,miMask:`לחקות`,miMaskQ:`ללבוש את המראה של…`,miAs:`בתור {n}`,
miCall:`דיון`,miCallAsk:`לעלות ולפתוח דיון? נשארו {v} לכל המשחק.`,miThefts:`גניבות`,miStole:`נגנבה`,
miZ:`ליד הספינה הטבועה|מתחת לקשת|בין האלמוגים|בין האצות|ליד הארובה|בין המדוזות|ליד הפעמון`,miZn:`ספינה|קשת|אלמוגים|אצות|ארובה|מדוזות|פעמון`,
miLog:`פנינים מאז העלייה האחרונה`,miDeb:`{n} פתח דיון`,miNet:`ברשת: {a} פנינים אמיתיות מתוך {b} שהוכרזו`,miNetD:`הפער: איסופים מזויפים של מחקה… או גניבות.`,
miVote:`מי יחשוף את תפקידו?`,miVoteD:`צריך הכי הרבה קולות (לפחות 2). אם זה מישהו מהצוות: ‎−{v} שנ׳ צלילה.`,miNone:`אף אחד`,
miRevM:`{n} היה מחקה! הכוחות כבים.`,miRevC:`{n} היה מהצוות… ‎−{v} שנ׳ צלילה.`,miRev0:`אין רוב: אף אחד לא חושף תפקיד.`,miBack:`כולם יוצאים שוב מהפעמון.`,
miWinC:`הצוות ניצח: הרשת מלאה!`,miWinC2:`הצוות ניצח: כל המחקים נחשפו!`,miWinS:`המחקים ניצחו: {v} פנינים נגנבו!`,miWinM:`המחקים ניצחו: הזמן נגמר.`,
miWere:`המחקים היו:`,miStM:`פנינים שנגנבו: {a} · איסופים מזויפים: {b}`,miStC:`פנינים שנאספו: {a}`,
tu_mim1:`נוגעים בנקודה (או גוררים אצבע) כדי לשחות אליה. הפנס מאיר רק סביבכם: אחרים ופנינים מופיעים רק בתוך ההילה שלכם.`,
tu_mim2:`אוספים פנינים בצבע שלכם כששוחים מעליהן. פנינים חדשות מופיעות לאורך כל הצלילה: יחד מגיעים ליעד.`,
tu_mim3:`המחקה 🐙 יכול ללבוש את המראה של {b} לכמה שניות (ענן דיו מסגיר אותו) ולגנוב את הפנינים. ההודעה: פנינה של {b} נגנבה ליד הספינה הטבועה.`,
tu_mim4:`אבל {b} היה עם {a} בקצה השני! מישהו חיקה. זכרו מי היה איפה, ושימו לב לענני דיו.`,
tu_mim5:`📯 עולים לדיון (מספר מוגבל) ומצביעים בסוד, אפשר לשנות דעה: מי שנבחר חושף את תפקידו. מחקה מאבד את כוחותיו. טעות עולה לצוות בזמן.`,
tu_mim6:`הצוות מנצח כשמגיע ליעד או חושף את כל המחקים. המחקים מנצחים אחרי מספיק גניבות או כשהזמן נגמר.`});
GCH('pt',{n_mim:`O Mimético`,d_mim:`Mergulho no escuro: alguém imita os outros`,
r_mim:`Uma caverna submarina, em tempo real: toque num ponto para nadar até lá; sua lanterna só ilumina ao seu redor. Recolham as pérolas da sua cor para atingir o objetivo. Escondido entre vocês, 1 Mimético (2 a partir de 7 jogadores) pode assumir a aparência de alguém e roubar as pérolas dessa pessoa: com 3 roubos (4 a partir de 7) ou com o fim do tempo, os Miméticos vencem. Lembrem quem estava onde, subam para debater e votem: a pessoa escolhida revela seu papel.`,
miCrew:`Tripulação`,miMim:`Mimético`,miOut:`Desmascarado`,miHint:`Toque num ponto para nadar · recolha as pérolas da sua cor`,miHintM:`Toque num ponto para nadar · 🎭 imite alguém para roubar as pérolas`,
miGoalT:`Pérolas anunciadas / objetivo · ✓ = de fato na rede no último debate`,miMine:`recolhidas`,miStolen:`roubadas`,miMask:`Imitar`,miMaskQ:`Assumir a aparência de…`,miAs:`como {n}`,
miCall:`Debate`,miCallAsk:`Subir e abrir um debate? Restam {v} para a partida toda.`,miThefts:`roubos`,miStole:`roubada`,
miZ:`perto do naufrágio|sob o arco|nos corais|na alga|perto da chaminé|entre as águas-vivas|no sino`,miZn:`Naufrágio|Arco|Corais|Alga|Chaminé|Águas-vivas|Sino`,
miLog:`Pérolas desde a última subida`,miDeb:`{n} abriu um debate`,miNet:`Na rede: {a} pérolas reais de {b} anunciadas`,miNetD:`A diferença: coletas falsas de um Mimético… ou roubos.`,
miVote:`Quem deve revelar o papel?`,miVoteD:`É preciso ter mais votos (pelo menos 2). Se for da tripulação: −{v} s de mergulho.`,miNone:`Ninguém`,
miRevM:`{n} era Mimético! Os poderes se apagam.`,miRevC:`{n} era da tripulação… −{v} s de mergulho.`,miRev0:`Sem maioria: ninguém revela o papel.`,miBack:`Todo mundo parte de novo do sino.`,
miWinC:`A tripulação vence: a rede está cheia!`,miWinC2:`A tripulação vence: todos os Miméticos desmascarados!`,miWinS:`Os Miméticos vencem: {v} pérolas roubadas!`,miWinM:`Os Miméticos vencem: o tempo acabou.`,
miWere:`Os Miméticos eram:`,miStM:`pérolas roubadas: {a} · coletas falsas: {b}`,miStC:`pérolas recolhidas: {a}`,
tu_mim1:`Toque num ponto (ou arraste o dedo) para nadar até lá. Sua lanterna só ilumina ao seu redor: os outros e as pérolas só aparecem dentro do seu halo.`,
tu_mim2:`Recolha as pérolas da sua cor passando por cima delas. Novas pérolas surgem durante todo o mergulho: juntos, atinjam o objetivo.`,
tu_mim3:`O Mimético 🐙 pode assumir a aparência de {b} por alguns segundos (uma nuvem de tinta o denuncia) e roubar as pérolas. O registro anuncia: pérola de {b} roubada perto do naufrágio.`,
tu_mim4:`Mas {b} estava com {a}, do outro lado! Alguém imitava. Lembrem quem estava onde e fiquem de olho nas nuvens de tinta.`,
tu_mim5:`📯 Subam para debater (número limitado) e votem em segredo, podendo mudar de ideia: a pessoa escolhida revela o papel. Um Mimético perde os poderes. Um erro custa tempo à tripulação.`,
tu_mim6:`A tripulação vence ao atingir o objetivo, ou desmascarando todos os Miméticos. Os Miméticos vencem com roubos suficientes, ou se o tempo acabar.`});
/* ⚫ La Perle noire : textes (les familles de coffres prl / prl1 / prl2 sont dans games-pools.js) */
const GPRL=(l,o)=>Object.assign(GI18N[l].ui,o);
GPRL('fr',{n_prl:`La Perle noire`,d_prl:`Des trésors pour un coffre secret… qu'une perle ne connaît pas`,
r_prl:`Chaque manche, 5 coffres possibles : les nacres savent lequel est le vrai, pas la Perle noire (deux dès 6 joueurs). Pendant 3 marées, chacun glisse en secret un trésor du plateau dans le collier ; tout se révèle ensemble. Même trésor qu'une autre nacre : +1 chacune… sauf si la Perle noire l'a pris aussi : elle vole l'écho (+1). Elle plonge en secret sur un coffre : +3 à la 2e marée, +2 à la 3e ; ratée, +2 pour chaque nacre. Chacun est Perle noire une fois.`,
prN:`Nacre · le vrai coffre`,prP:`Perle noire`,prUnk:`Lequel est le vrai ?`,prTide:`Marée {i}/3`,
prPkN:`glisse un trésor que les autres nacres prendront aussi, sans trahir le coffre`,prPkP:`glisse le trésor que les nacres vont prendre : tu voles leur écho`,
prDv1:`Tu pourras plonger dès la 2e marée.`,prDv2:`🤿 Plonger maintenant ? +3 si c'est le bon coffre`,prDv3:`🤿 Dernière chance : plonge ! +2 si c'est le bon coffre`,prWait:`⏳ Attendre la 3e marée`,prDvd:`🤿 Ta plongée : « {c} »`,
prNeck:`Le collier`,prTrue:`Le vrai coffre`,prOk:`{n} a plongé sur le bon coffre à la marée {i} : +{v} !`,prKo:`{n} s'est trompé{g.n:|e|·e} de coffre : +{v} pour chaque nacre`,prNo:`{n} n'a pas plongé : +{v} pour chaque nacre`,prRd:`Points de la manche`,prRec:`Les manches`,
lg_prlK:`{a} a trouvé le vrai coffre en Perle noire`,lg_prlM:`{a} a plongé dans le mauvais coffre en Perle noire`,
tu_prl1:`Cinq coffres possibles. Les nacres voient lequel est le vrai ; la Perle noire, non (à 6 et plus, elles sont deux).`,
tu_prl2:`3 marées : chacun glisse en secret un trésor du plateau, tout se révèle ensemble. Même trésor qu'une autre nacre : +1 chacune.`,
tu_prl3:`Mais si la Perle noire prend le même, elle vole l'écho : +1 pour elle, rien pour ces nacres.`,
tu_prl4:`La Perle noire lit vos trésors et plonge en secret sur un coffre : +3 à la 2e marée, +2 à la 3e.`,
tu_prl5:`Mauvais coffre, ou pas de plongée : +2 pour chaque nacre. Trop évidents, vos trésors la guident ; trop subtils, pas d'écho.`,
tu_prl6:`Chacun est Perle noire une fois par partie.`});
GPRL('en',{n_prl:`The Black Pearl`,d_prl:`Treasures for a secret chest… that one pearl doesn't know`,
r_prl:`Each round, 5 possible chests: the nacres know which one is real, the Black Pearl doesn't (two of them from 6 players). Over 3 tides, everyone secretly slips one treasure from the tray onto the necklace; all are revealed together. Same treasure as another nacre: +1 each… unless the Black Pearl took it too: she steals the echo (+1). She secretly dives on a chest: +3 on the 2nd tide, +2 on the 3rd; if she misses, +2 for every nacre. Everyone is the Black Pearl once.`,
prN:`Nacre · the real chest`,prP:`Black Pearl`,prUnk:`Which one is real?`,prTide:`Tide {i}/3`,
prPkN:`slip in a treasure the other nacres will pick too, without giving the chest away`,prPkP:`slip in the treasure the nacres will pick: you steal their echo`,
prDv1:`You can dive from the 2nd tide on.`,prDv2:`🤿 Dive now? +3 if it's the right chest`,prDv3:`🤿 Last chance: dive! +2 if it's the right chest`,prWait:`⏳ Wait for the 3rd tide`,prDvd:`🤿 Your dive: “{c}”`,
prNeck:`The necklace`,prTrue:`The real chest`,prOk:`{n} dived on the right chest on tide {i}: +{v}!`,prKo:`{n} picked the wrong chest: +{v} for every nacre`,prNo:`{n} didn't dive: +{v} for every nacre`,prRd:`Round points`,prRec:`The rounds`,
lg_prlK:`{a} found the real chest as the Black Pearl`,lg_prlM:`{a} dived into the wrong chest as the Black Pearl`,
tu_prl1:`Five possible chests. The nacres see which one is real; the Black Pearl doesn't (with 6 or more, there are two).`,
tu_prl2:`3 tides: everyone secretly slips a treasure from the tray, all revealed together. Same treasure as another nacre: +1 each.`,
tu_prl3:`But if the Black Pearl takes the same one, she steals the echo: +1 for her, nothing for those nacres.`,
tu_prl4:`The Black Pearl reads your treasures and secretly dives on a chest: +3 on the 2nd tide, +2 on the 3rd.`,
tu_prl5:`Wrong chest, or no dive: +2 for every nacre. Too obvious, your treasures guide her; too subtle, no echo.`,
tu_prl6:`Everyone is the Black Pearl once per game.`});
GPRL('es',{n_prl:`La Perla Negra`,d_prl:`Tesoros para un cofre secreto… que una perla no conoce`,
r_prl:`Cada ronda, 5 cofres posibles: los nácares saben cuál es el verdadero, la Perla Negra no (dos a partir de 6 jugadores). Durante 3 mareas, cada uno desliza en secreto un tesoro de la bandeja en el collar; todo se revela a la vez. Mismo tesoro que otro nácar: +1 cada uno… salvo si la Perla Negra también lo eligió: roba el eco (+1). Se zambulle en secreto en un cofre: +3 en la 2.ª marea, +2 en la 3.ª; si falla, +2 para cada nácar. Todos son Perla Negra una vez.`,
prN:`Nácar · el cofre verdadero`,prP:`Perla Negra`,prUnk:`¿Cuál es el verdadero?`,prTide:`Marea {i}/3`,
prPkN:`desliza un tesoro que los otros nácares también elegirán, sin delatar el cofre`,prPkP:`desliza el tesoro que van a elegir los nácares: les robas el eco`,
prDv1:`Podrás zambullirte desde la 2.ª marea.`,prDv2:`🤿 ¿Zambullirte ya? +3 si es el cofre bueno`,prDv3:`🤿 Última oportunidad: ¡zambúllete! +2 si es el cofre bueno`,prWait:`⏳ Esperar a la 3.ª marea`,prDvd:`🤿 Tu inmersión: «{c}»`,
prNeck:`El collar`,prTrue:`El cofre verdadero`,prOk:`¡{n} se zambulló en el cofre bueno en la marea {i}: +{v}!`,prKo:`{n} se equivocó de cofre: +{v} para cada nácar`,prNo:`{n} no se zambulló: +{v} para cada nácar`,prRd:`Puntos de la ronda`,prRec:`Las rondas`,
lg_prlK:`{a} encontró el cofre verdadero siendo la Perla Negra`,lg_prlM:`{a} se zambulló en el cofre equivocado siendo la Perla Negra`,
tu_prl1:`Cinco cofres posibles. Los nácares ven cuál es el verdadero; la Perla Negra no (con 6 o más, son dos).`,
tu_prl2:`3 mareas: cada uno desliza en secreto un tesoro de la bandeja, todo se revela a la vez. Mismo tesoro que otro nácar: +1 cada uno.`,
tu_prl3:`Pero si la Perla Negra elige el mismo, roba el eco: +1 para ella, nada para esos nácares.`,
tu_prl4:`La Perla Negra lee vuestros tesoros y se zambulle en secreto en un cofre: +3 en la 2.ª marea, +2 en la 3.ª.`,
tu_prl5:`Cofre equivocado, o sin inmersión: +2 para cada nácar. Demasiado obvios, vuestros tesoros la guían; demasiado sutiles, no hay eco.`,
tu_prl6:`Cada uno es Perla Negra una vez por partida.`});
GPRL('it',{n_prl:`La Perla Nera`,d_prl:`Tesori per uno scrigno segreto… che una perla non conosce`,
r_prl:`A ogni manche, 5 scrigni possibili: le madreperle sanno qual è quello vero, la Perla Nera no (due da 6 giocatori). Per 3 maree, ognuno fa scivolare in segreto un tesoro del vassoio nella collana; tutto si rivela insieme. Stesso tesoro di un'altra madreperla: +1 a testa… a meno che la Perla Nera non l'abbia preso anche lei: ruba l'eco (+1). Si tuffa in segreto su uno scrigno: +3 alla 2ª marea, +2 alla 3ª; se sbaglia, +2 a ogni madreperla. Tutti sono Perla Nera una volta.`,
prN:`Madreperla · lo scrigno vero`,prP:`Perla Nera`,prUnk:`Qual è quello vero?`,prTide:`Marea {i}/3`,
prPkN:`fai scivolare un tesoro che sceglieranno anche le altre madreperle, senza tradire lo scrigno`,prPkP:`fai scivolare il tesoro che sceglieranno le madreperle: rubi il loro eco`,
prDv1:`Potrai tuffarti dalla 2ª marea.`,prDv2:`🤿 Tuffarti adesso? +3 se è lo scrigno giusto`,prDv3:`🤿 Ultima occasione: tuffati! +2 se è lo scrigno giusto`,prWait:`⏳ Aspettare la 3ª marea`,prDvd:`🤿 Il tuo tuffo: «{c}»`,
prNeck:`La collana`,prTrue:`Lo scrigno vero`,prOk:`{n} si è tuffato sullo scrigno giusto alla marea {i}: +{v}!`,prKo:`{n} ha sbagliato scrigno: +{v} a ogni madreperla`,prNo:`{n} non si è tuffato: +{v} a ogni madreperla`,prRd:`Punti della manche`,prRec:`Le manche`,
lg_prlK:`{a} ha trovato lo scrigno vero da Perla Nera`,lg_prlM:`{a} si è tuffato nello scrigno sbagliato da Perla Nera`,
tu_prl1:`Cinque scrigni possibili. Le madreperle vedono qual è quello vero; la Perla Nera no (da 6 in su, sono due).`,
tu_prl2:`3 maree: ognuno fa scivolare in segreto un tesoro del vassoio, tutto si rivela insieme. Stesso tesoro di un'altra madreperla: +1 a testa.`,
tu_prl3:`Ma se la Perla Nera prende lo stesso, ruba l'eco: +1 a lei, niente a quelle madreperle.`,
tu_prl4:`La Perla Nera legge i vostri tesori e si tuffa in segreto su uno scrigno: +3 alla 2ª marea, +2 alla 3ª.`,
tu_prl5:`Scrigno sbagliato, o nessun tuffo: +2 a ogni madreperla. Troppo ovvi, i vostri tesori la guidano; troppo sottili, niente eco.`,
tu_prl6:`Ognuno è Perla Nera una volta per partita.`});
GPRL('de',{n_prl:`Die schwarze Perle`,d_prl:`Schätze für eine geheime Truhe… die eine Perle nicht kennt`,
r_prl:`Jede Runde gibt es 5 mögliche Truhen: Die Perlmutte wissen, welche die echte ist, die schwarze Perle nicht (ab 6 Spielern sind es zwei). In 3 Gezeiten legt jede Person geheim einen Schatz vom Tablett in die Kette; alles wird gleichzeitig aufgedeckt. Gleicher Schatz wie ein anderes Perlmutt: je +1 … außer die schwarze Perle hat ihn auch genommen: Sie stiehlt das Echo (+1). Sie taucht geheim zu einer Truhe: +3 in der 2. Gezeit, +2 in der 3.; daneben: +2 für jedes Perlmutt. Alle sind einmal die schwarze Perle.`,
prN:`Perlmutt · die echte Truhe`,prP:`Schwarze Perle`,prUnk:`Welche ist die echte?`,prTide:`Gezeit {i}/3`,
prPkN:`leg einen Schatz hinein, den auch die anderen Perlmutte nehmen – ohne die Truhe zu verraten`,prPkP:`leg den Schatz hinein, den die Perlmutte nehmen werden: Du stiehlst ihr Echo`,
prDv1:`Ab der 2. Gezeit kannst du tauchen.`,prDv2:`🤿 Jetzt tauchen? +3, wenn es die richtige Truhe ist`,prDv3:`🤿 Letzte Chance: tauch! +2, wenn es die richtige Truhe ist`,prWait:`⏳ Auf die 3. Gezeit warten`,prDvd:`🤿 Dein Tauchgang: „{c}“`,
prNeck:`Die Kette`,prTrue:`Die echte Truhe`,prOk:`{n} ist in Gezeit {i} zur richtigen Truhe getaucht: +{v}!`,prKo:`{n} hat die falsche Truhe erwischt: +{v} für jedes Perlmutt`,prNo:`{n} ist nicht getaucht: +{v} für jedes Perlmutt`,prRd:`Punkte der Runde`,prRec:`Die Runden`,
lg_prlK:`{a} hat als schwarze Perle die echte Truhe gefunden`,lg_prlM:`{a} ist als schwarze Perle zur falschen Truhe getaucht`,
tu_prl1:`Fünf mögliche Truhen. Die Perlmutte sehen, welche die echte ist; die schwarze Perle nicht (ab 6 sind es zwei).`,
tu_prl2:`3 Gezeiten: Alle legen geheim einen Schatz vom Tablett hinein, alles wird gleichzeitig aufgedeckt. Gleicher Schatz wie ein anderes Perlmutt: je +1.`,
tu_prl3:`Nimmt die schwarze Perle denselben, stiehlt sie das Echo: +1 für sie, nichts für diese Perlmutte.`,
tu_prl4:`Die schwarze Perle liest eure Schätze und taucht geheim zu einer Truhe: +3 in der 2. Gezeit, +2 in der 3.`,
tu_prl5:`Falsche Truhe oder kein Tauchgang: +2 für jedes Perlmutt. Zu offensichtlich, und eure Schätze führen sie hin; zu subtil, und es gibt kein Echo.`,
tu_prl6:`Alle sind einmal pro Spiel die schwarze Perle.`});
GPRL('ru',{n_prl:`Чёрная жемчужина`,d_prl:`Сокровища для тайного сундука… о котором одна жемчужина не знает`,
r_prl:`В каждом раунде 5 возможных сундуков: перламутры знают, какой настоящий, Чёрная жемчужина — нет (с 6 игроков их две). За 3 прилива каждый тайно кладёт в ожерелье одно сокровище с подноса; всё открывается одновременно. То же сокровище, что у другого перламутра: +1 каждому… если только Чёрная жемчужина не взяла его тоже — тогда она крадёт эхо (+1). Она тайно ныряет к одному сундуку: +3 во 2-м приливе, +2 в 3-м; промах — +2 каждому перламутру. Каждый один раз бывает Чёрной жемчужиной.`,
prN:`Перламутр · настоящий сундук`,prP:`Чёрная жемчужина`,prUnk:`Какой настоящий?`,prTide:`Прилив {i}/3`,
prPkN:`положи сокровище, которое выберут и другие перламутры, но не выдай сундук`,prPkP:`положи сокровище, которое выберут перламутры: ты украдёшь их эхо`,
prDv1:`Нырять можно со 2-го прилива.`,prDv2:`🤿 Нырнуть сейчас? +3, если сундук верный`,prDv3:`🤿 Последний шанс: ныряй! +2, если сундук верный`,prWait:`⏳ Подождать 3-го прилива`,prDvd:`🤿 Ты нырнул(а): «{c}»`,
prNeck:`Ожерелье`,prTrue:`Настоящий сундук`,prOk:`{n} {g.n:нырнул|нырнула|нырнул(а)} к верному сундуку в {i}-м приливе: +{v}!`,prKo:`{n} {g.n:ошибся|ошиблась|ошибся(-лась)} сундуком: +{v} каждому перламутру`,prNo:`{n} не {g.n:нырнул|нырнула|нырнул(а)}: +{v} каждому перламутру`,prRd:`Очки за раунд`,prRec:`Раунды`,
lg_prlK:`{a} {g.a:нашёл|нашла|нашёл(-ла)} настоящий сундук, будучи Чёрной жемчужиной`,lg_prlM:`{a} {g.a:нырнул|нырнула|нырнул(а)} не в тот сундук, будучи Чёрной жемчужиной`,
tu_prl1:`Пять возможных сундуков. Перламутры видят, какой настоящий, Чёрная жемчужина — нет (от 6 игроков их две).`,
tu_prl2:`3 прилива: каждый тайно кладёт сокровище с подноса, всё открывается одновременно. То же сокровище, что у другого перламутра: +1 каждому.`,
tu_prl3:`Но если Чёрная жемчужина возьмёт то же самое, она украдёт эхо: +1 ей, этим перламутрам — ничего.`,
tu_prl4:`Чёрная жемчужина читает ваши сокровища и тайно ныряет к сундуку: +3 во 2-м приливе, +2 в 3-м.`,
tu_prl5:`Не тот сундук или нет нырка: +2 каждому перламутру. Слишком очевидные сокровища ведут её к цели; слишком тонкие — нет эха.`,
tu_prl6:`Каждый один раз за игру бывает Чёрной жемчужиной.`});
GPRL('zh',{n_prl:`黑珍珠`,d_prl:`为秘密宝箱挑宝物……只有一颗珍珠不知道是哪个`,
r_prl:`每局有 5 个可能的宝箱：珠贝们知道哪个是真的，黑珍珠不知道（6 人起有两颗）。在 3 次潮汐中，每人秘密地从托盘里选一件宝物串进项链，然后一起揭晓。和另一位珠贝选了同一件：各 +1……除非黑珍珠也选了它：她偷走回声（+1）。她秘密地潜向一个宝箱：第 2 次潮汐 +3，第 3 次 +2；猜错则每位珠贝 +2。每人当一次黑珍珠。`,
prN:`珠贝 · 真宝箱`,prP:`黑珍珠`,prUnk:`哪个是真的？`,prTide:`潮汐 {i}/3`,
prPkN:`选一件其他珠贝也会选的宝物，但别暴露宝箱`,prPkP:`选珠贝们会选的那件宝物：偷走她们的回声`,
prDv1:`从第 2 次潮汐起可以潜水。`,prDv2:`🤿 现在潜水？猜中宝箱 +3`,prDv3:`🤿 最后机会：潜吧！猜中宝箱 +2`,prWait:`⏳ 等第 3 次潮汐`,prDvd:`🤿 你潜向了「{c}」`,
prNeck:`项链`,prTrue:`真宝箱`,prOk:`{n} 在第 {i} 次潮汐潜中了真宝箱：+{v}！`,prKo:`{n} 潜错了宝箱：每位珠贝 +{v}`,prNo:`{n} 没有潜水：每位珠贝 +{v}`,prRd:`本局得分`,prRec:`各局回顾`,
lg_prlK:`{a} 当黑珍珠时找到了真宝箱`,lg_prlM:`{a} 当黑珍珠时潜错了宝箱`,
tu_prl1:`五个可能的宝箱。珠贝们看得到哪个是真的，黑珍珠看不到（6 人及以上有两颗）。`,
tu_prl2:`3 次潮汐：每人秘密地从托盘选一件宝物，一起揭晓。和另一位珠贝选了同一件：各 +1。`,
tu_prl3:`但如果黑珍珠也选了同一件，她就偷走回声：她 +1，那几位珠贝什么也没有。`,
tu_prl4:`黑珍珠解读你们的宝物，秘密潜向一个宝箱：第 2 次潮汐 +3，第 3 次 +2。`,
tu_prl5:`潜错或没潜：每位珠贝 +2。宝物太明显会给她指路；太隐晦就没有回声。`,
tu_prl6:`每局游戏中，每人当一次黑珍珠。`});
GPRL('he',{n_prl:`הפנינה השחורה`,d_prl:`אוצרות לתיבה סודית… שפנינה אחת לא מכירה`,
r_prl:`בכל סבב יש 5 תיבות אפשריות: הצדפות יודעות איזו האמיתית, הפנינה השחורה לא (משישה שחקנים יש שתיים). במשך 3 גאויות, כל אחד מכניס בסוד אוצר אחד מהמגש לשרשרת; הכול נחשף יחד. אותו אוצר כמו צדפה אחרת: ‎+1 לכל אחת… אלא אם גם הפנינה השחורה לקחה אותו: היא גונבת את ההד (‎+1). היא צוללת בסוד אל תיבה: ‎+3 בגאות השנייה, ‎+2 בשלישית; טעתה – ‎+2 לכל צדפה. כל אחד הוא הפנינה השחורה פעם אחת.`,
prN:`צדפה · התיבה האמיתית`,prP:`הפנינה השחורה`,prUnk:`איזו האמיתית?`,prTide:`גאות {i}/3`,
prPkN:`הכניסו אוצר שגם הצדפות האחרות יבחרו, בלי להסגיר את התיבה`,prPkP:`הכניסו את האוצר שהצדפות יבחרו: תגנבו את ההד שלהן`,
prDv1:`אפשר לצלול מהגאות השנייה.`,prDv2:`🤿 לצלול עכשיו? ‎+3 אם זו התיבה הנכונה`,prDv3:`🤿 הזדמנות אחרונה: צללו! ‎+2 אם זו התיבה הנכונה`,prWait:`⏳ לחכות לגאות השלישית`,prDvd:`🤿 הצלילה שלך: „{c}”`,
prNeck:`השרשרת`,prTrue:`התיבה האמיתית`,prOk:`{n} {g.n:צלל|צללה|צלל/ה} לתיבה הנכונה בגאות {i}: ‎+{v}!`,prKo:`{n} {g.n:טעה|טעתה|טעה/תה} בתיבה: ‎+{v} לכל צדפה`,prNo:`{n} לא {g.n:צלל|צללה|צלל/ה}: ‎+{v} לכל צדפה`,prRd:`נקודות הסבב`,prRec:`הסבבים`,
lg_prlK:`{a} {g.a:מצא|מצאה|מצא/ה} את התיבה האמיתית כפנינה השחורה`,lg_prlM:`{a} {g.a:צלל|צללה|צלל/ה} לתיבה הלא נכונה כפנינה השחורה`,
tu_prl1:`חמש תיבות אפשריות. הצדפות רואות איזו האמיתית; הפנינה השחורה לא (משישה ומעלה, יש שתיים).`,
tu_prl2:`3 גאויות: כל אחד מכניס בסוד אוצר מהמגש, הכול נחשף יחד. אותו אוצר כמו צדפה אחרת: ‎+1 לכל אחת.`,
tu_prl3:`אבל אם הפנינה השחורה לוקחת את אותו אחד, היא גונבת את ההד: ‎+1 לה, כלום לצדפות האלה.`,
tu_prl4:`הפנינה השחורה קוראת את האוצרות שלכם וצוללת בסוד אל תיבה: ‎+3 בגאות השנייה, ‎+2 בשלישית.`,
tu_prl5:`תיבה שגויה, או בלי צלילה: ‎+2 לכל צדפה. אוצרות ברורים מדי מכוונים אותה; עדינים מדי – אין הד.`,
tu_prl6:`כל אחד הוא הפנינה השחורה פעם אחת בכל משחק.`});
GPRL('pt',{n_prl:`A Pérola Negra`,d_prl:`Tesouros para um baú secreto… que uma pérola não conhece`,
r_prl:`A cada rodada, 5 baús possíveis: os nácares sabem qual é o verdadeiro, a Pérola Negra não (duas a partir de 6 jogadores). Durante 3 marés, cada um coloca em segredo um tesouro da bandeja no colar; tudo é revelado junto. Mesmo tesouro que outro nácar: +1 para cada… a não ser que a Pérola Negra também o tenha pegado: ela rouba o eco (+1). Ela mergulha em segredo num baú: +3 na 2ª maré, +2 na 3ª; se errar, +2 para cada nácar. Todo mundo é Pérola Negra uma vez.`,
prN:`Nácar · o baú verdadeiro`,prP:`Pérola Negra`,prUnk:`Qual é o verdadeiro?`,prTide:`Maré {i}/3`,
prPkN:`coloque um tesouro que os outros nácares também vão escolher, sem entregar o baú`,prPkP:`coloque o tesouro que os nácares vão escolher: você rouba o eco deles`,
prDv1:`Você pode mergulhar a partir da 2ª maré.`,prDv2:`🤿 Mergulhar agora? +3 se for o baú certo`,prDv3:`🤿 Última chance: mergulhe! +2 se for o baú certo`,prWait:`⏳ Esperar a 3ª maré`,prDvd:`🤿 Seu mergulho: “{c}”`,
prNeck:`O colar`,prTrue:`O baú verdadeiro`,prOk:`{n} mergulhou no baú certo na maré {i}: +{v}!`,prKo:`{n} errou o baú: +{v} para cada nácar`,prNo:`{n} não mergulhou: +{v} para cada nácar`,prRd:`Pontos da rodada`,prRec:`As rodadas`,
lg_prlK:`{a} achou o baú verdadeiro como Pérola Negra`,lg_prlM:`{a} mergulhou no baú errado como Pérola Negra`,
tu_prl1:`Cinco baús possíveis. Os nácares veem qual é o verdadeiro; a Pérola Negra não (com 6 ou mais, são duas).`,
tu_prl2:`3 marés: cada um coloca em segredo um tesouro da bandeja, tudo é revelado junto. Mesmo tesouro que outro nácar: +1 para cada.`,
tu_prl3:`Mas se a Pérola Negra pegar o mesmo, ela rouba o eco: +1 para ela, nada para esses nácares.`,
tu_prl4:`A Pérola Negra lê seus tesouros e mergulha em segredo num baú: +3 na 2ª maré, +2 na 3ª.`,
tu_prl5:`Baú errado, ou nenhum mergulho: +2 para cada nácar. Óbvios demais, seus tesouros a guiam; sutis demais, nada de eco.`,
tu_prl6:`Cada um é Pérola Negra uma vez por partida.`});
/* /⚫ */
/* 💡 Bouteilles : idées facultatives */
Object.assign(GI18N.fr.ui,{bIdea:`Besoin d'idée ?`,bIdeaD:`Écris ce que tu veux : ce ne sont que des idées, touche-en une seulement si elle t'inspire.`});
Object.assign(GI18N.en.ui,{bIdea:`Need an idea?`,bIdeaD:`Write whatever you like: these are only ideas, tap one only if it inspires you.`});
Object.assign(GI18N.es.ui,{bIdea:`¿Necesitas una idea?`,bIdeaD:`Escribe lo que quieras: solo son ideas, toca una únicamente si te inspira.`});
Object.assign(GI18N.it.ui,{bIdea:`Serve un'idea?`,bIdeaD:`Scrivi quello che vuoi: sono solo idee, toccane una solo se ti ispira.`});
Object.assign(GI18N.de.ui,{bIdea:`Brauchst du eine Idee?`,bIdeaD:`Schreib, was du willst: Das sind nur Ideen – tipp eine nur an, wenn sie dich inspiriert.`});
Object.assign(GI18N.ru.ui,{bIdea:`Нужна идея?`,bIdeaD:`Пиши что угодно: это лишь идеи, нажми на одну, только если она вдохновляет.`});
Object.assign(GI18N.zh.ui,{bIdea:`需要灵感吗？`,bIdeaD:`想写什么都行：这些只是灵感，喜欢再点。`});
Object.assign(GI18N.he.ui,{bIdea:`צריכים רעיון?`,bIdeaD:`כתבו מה שבא לכם: אלה רק רעיונות, הקישו על אחד רק אם הוא נותן השראה.`});
Object.assign(GI18N.pt.ui,{bIdea:`Precisa de uma ideia?`,bIdeaD:`Escreva o que quiser: são só ideias, toque numa apenas se ela te inspirar.`});
/* 📖 guides : navigation */
Object.assign(GI18N.fr.ui,{tuPrev:`Précédent`,tuClose:`Fermer`});
Object.assign(GI18N.en.ui,{tuPrev:`Back`,tuClose:`Close`});
Object.assign(GI18N.es.ui,{tuPrev:`Anterior`,tuClose:`Cerrar`});
Object.assign(GI18N.it.ui,{tuPrev:`Indietro`,tuClose:`Chiudi`});
Object.assign(GI18N.de.ui,{tuPrev:`Zurück`,tuClose:`Schließen`});
Object.assign(GI18N.ru.ui,{tuPrev:`Назад`,tuClose:`Закрыть`});
Object.assign(GI18N.zh.ui,{tuPrev:`上一步`,tuClose:`关闭`});
Object.assign(GI18N.he.ui,{tuPrev:`הקודם`,tuClose:`סגירה`});
Object.assign(GI18N.pt.ui,{tuPrev:`Anterior`,tuClose:`Fechar`});
/* 🔢 nombres lisibles (points, marées, coups) et Tempête : textes */
Object.assign(GI18N.fr.ui,{pts:`{v} point|{v} points`,ptsS:`{v} pt|{v} pts`,prTn:`Marée {i}`,cqPay:`paie {v} 🪙`,chSkL:`{v}/{n} coulés`,chOkN:`{v} arrivé|{v} arrivés`,tpLeftN:`Tempête dans {v} coup|Tempête dans {v} coups`,tpBeatN:`{v} coup|{v} coups`,tpErrN:`{v} faute|{v} fautes`,tpFocus:`Tes vagues pour ce niveau`,tpFocusS:`Nouveau niveau : chacun découvre ses vagues`,tpFocusD:`Retiens-les bien : {v} de houle avant la tempête.`,tpLgW:`vague lâchée (couleur de qui l'a lâchée)`,tpLgB:`lâchée trop tôt`,tpLgE:`emportée par l'écume`,tpLgL:`coques restantes`,tpLgC:`vagues calmes en réserve`,mGain:`gagne {v}`,mLose:`perd {v}`,pLostN:`{v} perdues`});
Object.assign(GI18N.en.ui,{pts:`{v} point|{v} points`,ptsS:`{v} pt|{v} pts`,prTn:`Tide {i}`,cqPay:`pays {v} 🪙`,chSkL:`{v}/{n} sunk`,chOkN:`{v} arrived|{v} arrived`,tpLeftN:`Storm in {v} beat|Storm in {v} beats`,tpBeatN:`{v} beat|{v} beats`,tpErrN:`{v} mistake|{v} mistakes`,tpFocus:`Your waves for this level`,tpFocusS:`New level: everyone looks at their waves`,tpFocusD:`Remember them: {v} of swell before the storm.`,tpLgW:`played wave (colour of who played it)`,tpLgB:`played too early`,tpLgE:`swept into the foam`,tpLgL:`hulls left`,tpLgC:`calm waves in reserve`,mGain:`gains {v}`,mLose:`loses {v}`,pLostN:`{v} lost`});
Object.assign(GI18N.es.ui,{pts:`{v} punto|{v} puntos`,ptsS:`{v} pt|{v} pts`,prTn:`Marea {i}`,cqPay:`paga {v} 🪙`,chSkL:`{v}/{n} hundidos`,chOkN:`{v} llegó|{v} llegaron`,tpLeftN:`Tormenta en {v} golpe|Tormenta en {v} golpes`,tpBeatN:`{v} golpe|{v} golpes`,tpErrN:`{v} fallo|{v} fallos`,tpFocus:`Tus olas para este nivel`,tpFocusS:`Nuevo nivel: cada uno descubre sus olas`,tpFocusD:`Memorízalas: {v} de oleaje antes de la tormenta.`,tpLgW:`ola soltada (color de quien la soltó)`,tpLgB:`soltada demasiado pronto`,tpLgE:`se la llevó la espuma`,tpLgL:`cascos restantes`,tpLgC:`olas calmas en reserva`,mGain:`gana {v}`,mLose:`pierde {v}`,pLostN:`{v} perdidas`});
Object.assign(GI18N.it.ui,{pts:`{v} punto|{v} punti`,ptsS:`{v} pt|{v} pt`,prTn:`Marea {i}`,cqPay:`paga {v} 🪙`,chSkL:`{v}/{n} affondate`,chOkN:`{v} arrivata|{v} arrivate`,tpLeftN:`Tempesta tra {v} colpo|Tempesta tra {v} colpi`,tpBeatN:`{v} colpo|{v} colpi`,tpErrN:`{v} errore|{v} errori`,tpFocus:`Le tue onde per questo livello`,tpFocusS:`Nuovo livello: ognuno scopre le sue onde`,tpFocusD:`Ricordale bene: {v} di mare prima della tempesta.`,tpLgW:`onda lasciata (colore di chi l'ha lasciata)`,tpLgB:`lasciata troppo presto`,tpLgE:`portata via dalla schiuma`,tpLgL:`scafi rimasti`,tpLgC:`onde calme di riserva`,mGain:`guadagna {v}`,mLose:`perde {v}`,pLostN:`{v} perse`});
Object.assign(GI18N.de.ui,{pts:`{v} Punkt|{v} Punkte`,ptsS:`{v} Pkt.|{v} Pkt.`,prTn:`Gezeit {i}`,cqPay:`zahlt {v} 🪙`,chSkL:`{v}/{n} gesunken`,chOkN:`{v} angekommen|{v} angekommen`,tpLeftN:`Sturm in {v} Wellenschlag|Sturm in {v} Wellenschlägen`,tpBeatN:`{v} Wellenschlag|{v} Wellenschläge`,tpErrN:`{v} Fehler|{v} Fehler`,tpFocus:`Deine Wellen für dieses Level`,tpFocusS:`Neues Level: Alle sehen sich ihre Wellen an`,tpFocusD:`Merk sie dir: {v} bis zum Sturm.`,tpLgW:`losgelassene Welle (Farbe der Person)`,tpLgB:`zu früh losgelassen`,tpLgE:`vom Schaum verschluckt`,tpLgL:`übrige Rümpfe`,tpLgC:`ruhige Wellen in Reserve`,mGain:`gewinnt {v}`,mLose:`verliert {v}`,pLostN:`{v} verloren`});
Object.assign(GI18N.ru.ui,{pts:`{v} очко|{v} очка|{v} очков`,ptsS:`{v} очк.`,prTn:`Прилив {i}`,cqPay:`платит {v} 🪙`,chSkL:`{v}/{n} затонуло`,chOkN:`{v} доплыл|{v} доплыли|{v} доплыли`,tpLeftN:`Буря через {v} удар|Буря через {v} удара|Буря через {v} ударов`,tpBeatN:`{v} удар|{v} удара|{v} ударов`,tpErrN:`{v} ошибка|{v} ошибки|{v} ошибок`,tpFocus:`Твои волны на этом уровне`,tpFocusS:`Новый уровень: каждый смотрит на свои волны`,tpFocusD:`Запомни их: до бури {v} волн.`,tpLgW:`отпущенная волна (цвет того, кто отпустил)`,tpLgB:`отпущена слишком рано`,tpLgE:`унесена пеной`,tpLgL:`оставшиеся корпуса`,tpLgC:`спокойные волны в запасе`,mGain:`получает {v}`,mLose:`теряет {v}`,pLostN:`потеряно {v}`});
Object.assign(GI18N.zh.ui,{pts:`{v} 分`,ptsS:`{v} 分`,prTn:`第 {i} 潮`,cqPay:`支付 {v} 🪙`,chSkL:`已沉 {v}/{n}`,chOkN:`到港 {v}`,tpLeftN:`风暴还有 {v} 拍`,tpBeatN:`{v} 拍`,tpErrN:`{v} 次失误`,tpFocus:`本关你的浪`,tpFocusS:`新关卡：大家各自看自己的浪`,tpFocusD:`记住它们：离风暴还有 {v}。`,tpLgW:`已放出的浪（颜色＝放出的人）`,tpLgB:`放得太早`,tpLgE:`被泡沫卷走`,tpLgL:`剩余船体`,tpLgC:`储备的平静浪`,mGain:`获得 {v}`,mLose:`失去 {v}`,pLostN:`失去 {v}`});
Object.assign(GI18N.he.ui,{pts:`{v} נקודה|{v} נקודות`,ptsS:`{v} נק׳`,prTn:`גאות {i}`,cqPay:`משלם/ת {v} 🪙`,chSkL:`{v}/{n} טבעו`,chOkN:`{v} הגיעה|{v} הגיעו`,tpLeftN:`סערה בעוד מכה {v}|סערה בעוד {v} מכות`,tpBeatN:`מכה {v}|{v} מכות`,tpErrN:`טעות {v}|{v} טעויות`,tpFocus:`הגלים שלך לשלב הזה`,tpFocusS:`שלב חדש: כל אחד מגלה את הגלים שלו`,tpFocusD:`{g:זכור|זכרי} אותם: {v} עד הסערה.`,tpLgW:`גל ששוחרר (בצבע של מי ששחרר)`,tpLgB:`שוחרר מוקדם מדי`,tpLgE:`נסחף בקצף`,tpLgL:`ספינות שנותרו`,tpLgC:`גלים שקטים במלאי`,mGain:`מרוויח/ה {v}`,mLose:`מפסיד/ה {v}`,pLostN:`{v} אבדו`});
Object.assign(GI18N.pt.ui,{pts:`{v} ponto|{v} pontos`,ptsS:`{v} pt|{v} pts`,prTn:`Maré {i}`,cqPay:`paga {v} 🪙`,chSkL:`{v}/{n} afundados`,chOkN:`{v} chegou|{v} chegaram`,tpLeftN:`Tempestade em {v} golpe|Tempestade em {v} golpes`,tpBeatN:`{v} golpe|{v} golpes`,tpErrN:`{v} erro|{v} erros`,tpFocus:`Suas ondas neste nível`,tpFocusS:`Novo nível: cada um descobre suas ondas`,tpFocusD:`Guarde-as bem: {v} de ondulação antes da tempestade.`,tpLgW:`onda solta (cor de quem soltou)`,tpLgB:`solta cedo demais`,tpLgE:`levada pela espuma`,tpLgL:`cascos restantes`,tpLgC:`ondas calmas de reserva`,mGain:`ganha {v}`,mLose:`perde {v}`,pLostN:`{v} perdidas`});
/* ✏️ en train de modifier */
Object.assign(GI18N.fr.ui,{gEdg:`en train de modifier`});
Object.assign(GI18N.en.ui,{gEdg:`editing`});
Object.assign(GI18N.es.ui,{gEdg:`editando`});
Object.assign(GI18N.it.ui,{gEdg:`sta modificando`});
Object.assign(GI18N.de.ui,{gEdg:`ändert gerade`});
Object.assign(GI18N.ru.ui,{gEdg:`редактирует`});
Object.assign(GI18N.zh.ui,{gEdg:`正在修改`});
Object.assign(GI18N.he.ui,{gEdg:`עורך/ת`});
Object.assign(GI18N.pt.ui,{gEdg:`editando`});
/* 👀 Spectateurs : textes */
Object.assign(GI18N.fr.ui,{specB:`Je regarde`,specD:`Tu suis la partie sans jouer : tu vois ce qui est public, tu peux réagir et discuter.`,specL:`Regardent : {n}`,specT:`Partie en cours : tu regardes, tu joueras à la prochaine.`,specT2:`Tu regardes cette partie.`,specH:`Tu regardes · réactions et chat ouverts`});
Object.assign(GI18N.en.ui,{specB:`I'm watching`,specD:`Follow the game without playing: you see what's public, and you can react and chat.`,specL:`Watching: {n}`,specT:`Game in progress: you're watching, you'll play the next one.`,specT2:`You're watching this game.`,specH:`You're watching · reactions and chat are open`});
Object.assign(GI18N.es.ui,{specB:`Solo miro`,specD:`Sigues la partida sin jugar: ves lo que es público y puedes reaccionar y chatear.`,specL:`Miran: {n}`,specT:`Partida en curso: miras y jugarás la próxima.`,specT2:`Estás mirando esta partida.`,specH:`Estás mirando · reacciones y chat abiertos`});
Object.assign(GI18N.it.ui,{specB:`Guardo e basta`,specD:`Segui la partita senza giocare: vedi ciò che è pubblico, puoi reagire e chattare.`,specL:`Guardano: {n}`,specT:`Partita in corso: guardi e giocherai la prossima.`,specT2:`Stai guardando questa partita.`,specH:`Stai guardando · reazioni e chat aperte`});
Object.assign(GI18N.de.ui,{specB:`Ich schaue zu`,specD:`Du verfolgst das Spiel, ohne mitzuspielen: Du siehst alles Öffentliche und kannst reagieren und chatten.`,specL:`Schauen zu: {n}`,specT:`Laufendes Spiel: Du schaust zu und spielst beim nächsten mit.`,specT2:`Du schaust diesem Spiel zu.`,specH:`Du schaust zu · Reaktionen und Chat offen`});
Object.assign(GI18N.ru.ui,{specB:`Я смотрю`,specD:`Следишь за игрой, не играя: видишь всё открытое, можешь реагировать и писать в чат.`,specL:`Смотрят: {n}`,specT:`Игра уже идёт: ты смотришь и сыграешь в следующей.`,specT2:`Ты смотришь эту игру.`,specH:`Ты смотришь · реакции и чат открыты`});
Object.assign(GI18N.zh.ui,{specB:`我只观看`,specD:`不参与游戏，只观看：你能看到公开内容，也可以互动和聊天。`,specL:`观看中：{n}`,specT:`游戏进行中：你先观看，下一局再加入。`,specT2:`你正在观看这局游戏。`,specH:`观看中 · 可以互动和聊天`});
Object.assign(GI18N.he.ui,{specB:`אני צופה`,specD:`עוקבים אחרי המשחק בלי לשחק: רואים את מה שגלוי לכולם, ואפשר להגיב ולצ'וטט.`,specL:`צופים: {n}`,specT:`משחק בעיצומו: {g:אתה צופה ותשחק|את צופה ותשחקי} בסיבוב הבא.`,specT2:`{g:אתה צופה|את צופה} במשחק הזה.`,specH:`במצב צפייה · תגובות וצ'אט פתוחים`});
Object.assign(GI18N.pt.ui,{specB:`Só assisto`,specD:`Acompanhe a partida sem jogar: você vê o que é público e pode reagir e conversar.`,specL:`Assistindo: {n}`,specT:`Partida em andamento: você assiste e joga a próxima.`,specT2:`Você está assistindo a esta partida.`,specH:`Assistindo · reações e chat abertos`});
/* /👀 */
/* 📜 Livre de bord : textes */
Object.assign(GI18N.fr.ui,{lgT:`Livre de bord`,lgLast:`La dernière fois : {t}`,lg_win:`{a} a remporté {g}`,lg_win2:`{a} et {b} ont remporté {g}`,lg_prlC:`{a} s'est fait démasquer en Perle noire`,lg_prlD:`{a} a plongé 🤿 en Perle noire et trouvé le mot des autres`,lg_prlH:`{a} est passé{g.a:|e|·e} inaperçu{g.a:|e|·e} en Perle noire`,lg_chnC:`{a} s'est fait démasquer en Naufrageur`,lg_chnW:`{a} a coulé la flotte en Naufrageur`,lg_chnW2:`{a} et {b} ont coulé la flotte en Naufrageurs`,lg_mimC:`{a} s'est fait démasquer en Mimétique`,lg_mimW:`{a} a filé avec les perles en Mimétique`,lg_mimW2:`{a} et {b} ont filé avec les perles en Mimétiques`,lg_mskS:`{a} a tout volé à {b} en finale des Masques`,lg_mskP:`{a} et {b} ont partagé le trésor en finale des Masques`,lg_mskB:`{a} et {b} ont voulu tout voler en finale des Masques : perdu pour les deux`,lq_c:`se ferait démasquer le plus vite la prochaine fois`,lq_s:`bluffe le mieux sans en avoir l'air`,lq_v:`volerait tout le trésor sans trembler`,lq_t:`partagerait le trésor sans hésiter`,lq_w:`battrait {a} à la revanche`});
Object.assign(GI18N.en.ui,{lgT:`Logbook`,lgLast:`Last time: {t}`,lg_win:`{a} won {g}`,lg_win2:`{a} and {b} won {g}`,lg_prlC:`{a} got unmasked as the Black Pearl`,lg_prlD:`{a} dived 🤿 as the Black Pearl and found the others' word`,lg_prlH:`{a} went unnoticed as the Black Pearl`,lg_chnC:`{a} got unmasked as a Wrecker`,lg_chnW:`{a} sank the fleet as a Wrecker`,lg_chnW2:`{a} and {b} sank the fleet as Wreckers`,lg_mimC:`{a} got unmasked as the Mimic`,lg_mimW:`{a} got away with the pearls as the Mimic`,lg_mimW2:`{a} and {b} got away with the pearls as Mimics`,lg_mskS:`{a} stole everything from {b} in the Masks final`,lg_mskP:`{a} and {b} shared the treasure in the Masks final`,lg_mskB:`{a} and {b} both tried to steal it all in the Masks final: both lost`,lq_c:`would get unmasked fastest next time`,lq_s:`bluffs best without showing it`,lq_v:`would steal the whole treasure without blinking`,lq_t:`would share the treasure without hesitating`,lq_w:`would beat {a} in a rematch`});
Object.assign(GI18N.es.ui,{lgT:`Bitácora`,lgLast:`La última vez: {t}`,lg_win:`{a} ganó {g}`,lg_win2:`{a} y {b} ganaron {g}`,lg_prlC:`Descubrieron a {a}, la Perla Negra`,lg_prlD:`{a}, la Perla Negra, se zambulló 🤿 y encontró la palabra de los demás`,lg_prlH:`Nadie vio a {a}, la Perla Negra`,lg_chnC:`Descubrieron a {a}, Naufragador`,lg_chnW:`{a} hundió la flota como Naufragador`,lg_chnW2:`{a} y {b} hundieron la flota como Naufragadores`,lg_mimC:`Descubrieron a {a}, el Mimético`,lg_mimW:`{a} escapó con las perlas como Mimético`,lg_mimW2:`{a} y {b} escaparon con las perlas como Miméticos`,lg_mskS:`{a} le robó todo a {b} en la final de las Máscaras`,lg_mskP:`{a} y {b} compartieron el tesoro en la final de las Máscaras`,lg_mskB:`{a} y {b} quisieron robarlo todo en la final de las Máscaras: perdieron los dos`,lq_c:`se dejaría descubrir antes que nadie la próxima vez`,lq_s:`farolea mejor sin que se note`,lq_v:`robaría todo el tesoro sin pestañear`,lq_t:`compartiría el tesoro sin dudar`,lq_w:`le ganaría a {a} en la revancha`});
Object.assign(GI18N.it.ui,{lgT:`Diario di bordo`,lgLast:`L'ultima volta: {t}`,lg_win:`{a} ha vinto {g}`,lg_win2:`{a} e {b} hanno vinto {g}`,lg_prlC:`Hanno smascherato {a}, la Perla Nera`,lg_prlD:`{a}, la Perla Nera, ha fatto il tuffo 🤿 e trovato la parola degli altri`,lg_prlH:`Nessuno ha notato {a}, la Perla Nera`,lg_chnC:`Hanno smascherato {a}, Naufragatore`,lg_chnW:`{a} ha affondato la flotta da Naufragatore`,lg_chnW2:`{a} e {b} hanno affondato la flotta da Naufragatori`,lg_mimC:`Hanno smascherato {a}, il Mimetico`,lg_mimW:`{a} ha portato via le perle da Mimetico`,lg_mimW2:`{a} e {b} hanno portato via le perle da Mimetici`,lg_mskS:`{a} ha rubato tutto a {b} nella finale delle Maschere`,lg_mskP:`{a} e {b} hanno condiviso il tesoro nella finale delle Maschere`,lg_mskB:`{a} e {b} hanno voluto rubare tutto nella finale delle Maschere: persi entrambi`,lq_c:`si farebbe smascherare più in fretta la prossima volta`,lq_s:`bluffa meglio senza darlo a vedere`,lq_v:`ruberebbe tutto il tesoro senza battere ciglio`,lq_t:`dividerebbe il tesoro senza esitare`,lq_w:`batterebbe {a} nella rivincita`});
Object.assign(GI18N.de.ui,{lgT:`Logbuch`,lgLast:`Letztes Mal: {t}`,lg_win:`{a} hat {g} gewonnen`,lg_win2:`{a} und {b} haben {g} gewonnen`,lg_prlC:`{a} wurde als schwarze Perle enttarnt`,lg_prlD:`{a} ist als schwarze Perle abgetaucht 🤿 und hat das Wort der anderen gefunden`,lg_prlH:`{a} blieb als schwarze Perle unbemerkt`,lg_chnC:`{a} wurde als Strandräuber enttarnt`,lg_chnW:`{a} hat als Strandräuber die Flotte versenkt`,lg_chnW2:`{a} und {b} haben als Strandräuber die Flotte versenkt`,lg_mimC:`{a} wurde als Mimetiker enttarnt`,lg_mimW:`{a} ist als Mimetiker mit den Perlen entkommen`,lg_mimW2:`{a} und {b} sind als Mimetiker mit den Perlen entkommen`,lg_mskS:`{a} hat {b} im Finale der Masken alles gestohlen`,lg_mskP:`{a} und {b} haben im Finale der Masken den Schatz geteilt`,lg_mskB:`{a} und {b} wollten im Finale der Masken alles stehlen: beide verloren`,lq_c:`würde nächstes Mal am schnellsten enttarnt werden`,lq_s:`blufft am besten, ohne dass man es merkt`,lq_v:`würde ohne Zögern den ganzen Schatz stehlen`,lq_t:`würde den Schatz ohne Zögern teilen`,lq_w:`würde {a} in der Revanche schlagen`});
Object.assign(GI18N.ru.ui,{lgT:`Судовой журнал`,lgLast:`В прошлый раз: {t}`,lg_win:`{a} {g.a:выиграл|выиграла|выиграл(а)} «{g}»`,lg_win2:`{a} и {b} выиграли «{g}»`,lg_prlC:`{a} {g.a:был разоблачён|была разоблачена|был(а) разоблачен(а)} в роли Чёрной жемчужины`,lg_prlD:`{a} в роли Чёрной жемчужины {g.a:нырнул|нырнула|нырнул(а)} 🤿 и {g.a:угадал|угадала|угадал(а)} слово остальных`,lg_prlH:`Никто не заметил {a} в роли Чёрной жемчужины`,lg_chnC:`{a} {g.a:был разоблачён|была разоблачена|был(а) разоблачен(а)} в роли Мародёра`,lg_chnW:`{a} в роли Мародёра {g.a:потопил|потопила|потопил(а)} флот`,lg_chnW2:`{a} и {b} в роли Мародёров потопили флот`,lg_mimC:`{a} {g.a:был разоблачён|была разоблачена|был(а) разоблачен(а)} в роли Мимика`,lg_mimW:`{a} в роли Мимика {g.a:ушёл|ушла|ушёл(ушла)} с жемчугом`,lg_mimW2:`{a} и {b} в роли Мимиков ушли с жемчугом`,lg_mskS:`{a} {g.a:забрал|забрала|забрал(а)} всё у {b} в финале «Масок»`,lg_mskP:`{a} и {b} поделили сокровище в финале «Масок»`,lg_mskB:`{a} и {b} оба хотели забрать всё в финале «Масок»: проиграли оба`,lq_c:`быстрее всех попадётся в следующий раз`,lq_s:`лучше всех блефует, не подавая виду`,lq_v:`не моргнув глазом заберёт всё сокровище`,lq_t:`не раздумывая поделится сокровищем`,lq_w:`обыграет {a} в реванше`});
Object.assign(GI18N.zh.ui,{lgT:`航海日志`,lgLast:`上次：{t}`,lg_win:`{a} 赢得了「{g}」`,lg_win2:`{a} 和 {b} 赢得了「{g}」`,lg_prlC:`{a} 作为黑珍珠被识破了`,lg_prlD:`{a} 作为黑珍珠潜水 🤿，猜中了大家的词`,lg_prlH:`{a} 作为黑珍珠，没被任何人发现`,lg_chnC:`{a} 作为破船者被识破了`,lg_chnW:`{a} 作为破船者击沉了船队`,lg_chnW2:`{a} 和 {b} 作为破船者击沉了船队`,lg_mimC:`{a} 作为拟态者被识破了`,lg_mimW:`{a} 作为拟态者带着珍珠溜走了`,lg_mimW2:`{a} 和 {b} 作为拟态者带着珍珠溜走了`,lg_mskS:`{a} 在「面具」决赛中抢走了 {b} 的全部`,lg_mskP:`{a} 和 {b} 在「面具」决赛中平分了宝藏`,lg_mskB:`{a} 和 {b} 在「面具」决赛中都想独吞：两人都输了`,lq_c:`下次会最快被识破`,lq_s:`最会不动声色地虚张声势`,lq_v:`会眼都不眨地抢走全部宝藏`,lq_t:`会毫不犹豫地分享宝藏`,lq_w:`能在复仇赛中打败 {a}`});
Object.assign(GI18N.he.ui,{lgT:`יומן הספינה`,lgLast:`בפעם הקודמת: {t}`,lg_win:`{g}: {a} {g.a:ניצח|ניצחה|ניצח/ה}`,lg_win2:`{g}: {a} ו-{b} ניצחו`,lg_prlC:`{a} {g.a:נחשף|נחשפה|נחשף/ה} בתור הפנינה השחורה`,lg_prlD:`{a} {g.a:צלל|צללה|צלל/ה} 🤿 בתור הפנינה השחורה {g.a:ומצא|ומצאה|ומצא/ה} את המילה של האחרים`,lg_prlH:`אף אחד לא שם לב ל-{a}, הפנינה השחורה`,lg_chnC:`{a} {g.a:נחשף|נחשפה|נחשף/ה} בתור מטביע`,lg_chnW:`{a} {g.a:הטביע|הטביעה|הטביע/ה} את הצי בתור מטביע`,lg_chnW2:`{a} ו-{b} הטביעו את הצי בתור מטביעים`,lg_mimC:`{a} {g.a:נחשף|נחשפה|נחשף/ה} בתור מחקה`,lg_mimW:`{a} {g.a:ברח|ברחה|ברח/ה} עם הפנינים בתור מחקה`,lg_mimW2:`{a} ו-{b} ברחו עם הפנינים בתור מחקים`,lg_mskS:`{a} {g.a:לקח|לקחה|לקח/ה} הכול מ-{b} בגמר של המסכות`,lg_mskP:`{a} ו-{b} חלקו את האוצר בגמר של המסכות`,lg_mskB:`{a} ו-{b} רצו לקחת הכול בגמר של המסכות: שניהם הפסידו`,lq_c:`ייחשף הכי מהר בפעם הבאה`,lq_s:`מבלף הכי טוב בלי שישימו לב`,lq_v:`ייקח את כל האוצר בלי למצמץ`,lq_t:`יחלוק את האוצר בלי להסס`,lq_w:`ינצח את {a} במשחק הגומלין`});
Object.assign(GI18N.pt.ui,{lgT:`Diário de bordo`,lgLast:`Da última vez: {t}`,lg_win:`{a} venceu {g}`,lg_win2:`{a} e {b} venceram {g}`,lg_prlC:`Desmascararam {a}, a Pérola Negra`,lg_prlD:`{a}, a Pérola Negra, mergulhou 🤿 e achou a palavra dos outros`,lg_prlH:`Ninguém notou {a}, a Pérola Negra`,lg_chnC:`Desmascararam {a}, Naufragador`,lg_chnW:`{a} afundou a frota como Naufragador`,lg_chnW2:`{a} e {b} afundaram a frota como Naufragadores`,lg_mimC:`Desmascararam {a}, o Mimético`,lg_mimW:`{a} fugiu com as pérolas como Mimético`,lg_mimW2:`{a} e {b} fugiram com as pérolas como Miméticos`,lg_mskS:`{a} roubou tudo de {b} na final das Máscaras`,lg_mskP:`{a} e {b} dividiram o tesouro na final das Máscaras`,lg_mskB:`{a} e {b} quiseram roubar tudo na final das Máscaras: os dois perderam`,lq_c:`se deixaria desmascarar primeiro da próxima vez`,lq_s:`blefa melhor sem dar na vista`,lq_v:`roubaria o tesouro todo sem pestanejar`,lq_t:`dividiria o tesouro sem hesitar`,lq_w:`venceria {a} na revanche`});
/* /📜 */
/* ⛈️ Tempête : textes */
Object.assign(GI18N.fr.ui,{coop_tmp:`La traversée`,n_tmp:`Tempête`,d_tmp:`En silence, lâchez vos vagues dans l'ordre avant l'orage`,r_tmp:`Coopératif. Chacun a des vagues secrètes de 1 à 100. À chaque coup de houle, tout le monde choisit en même temps : lâcher sa plus petite vague, ou retenir. Elles doivent sortir dans l'ordre croissant, sans jamais dire de chiffre. Trop tôt : −1 ⛵. De 2 à 8.`,tpLv:`Niveau {v}`,tpLeft:`dans {v}`,tpSince:`Houle sans vague : {v}`,tpPut:`Lâcher {v}`,tpHold:`Retenir`,tpCalm:`Vague calme`,tpNone:`Tes vagues sont parties. Encourage l'équipage !`,tpX:`Trop tôt ! L'écume emporte {v}`,tpC:`Vague calme : chacun montre sa dizaine`,tpW:`La mer retient son souffle…`,tpGo:`Sentez le rythme : lâchez au bon moment`,tpOk:`Niveau {v} franchi !`,tpStorm:`La tempête a frappé : −1 ⛵`,tpSunk:`Naufrage… plus de coque.`,tpWin:`Toutes les vagues sont passées : tempête domptée !`,tpBonL:`+1 ⛵ en renfort`,tpBonC:`+1 🌅 vague calme`,tpEnd:`Niveaux franchis : {v} sur {n}`,tpMute:`Pas de chiffres : le chat se tait, réactions seulement`,tu_tmp1:`Chacun reçoit en secret des vagues numérotées de 1 à 100.`,tu_tmp2:`À chaque coup de houle, tout le monde choisit en même temps : 🌊 lâcher sa plus petite vague, ou ⏳ retenir.`,tu_tmp3:`Les vagues doivent sortir dans l'ordre croissant. Lâchées au même coup, elles se rangent toutes seules.`,tu_tmp4:`Trop tôt ? Les vagues plus basses encore en main partent dans l'écume : −1 ⛵.`,tu_tmp5:`⛈️ La tempête approche à chaque coup : finissez le niveau avant elle. Le compte à rebours est votre horloge commune.`,tu_tmp6:`🌅 Vague calme : si la moitié la demande, pause. Chacun montre la dizaine de sa plus petite vague (ex. 41–50).`,tu_tmp7:`Aucun chiffre ne se dit : seulement des réactions. Écoutez le rythme du groupe.`});
Object.assign(GI18N.en.ui,{coop_tmp:`The crossing`,n_tmp:`Storm`,d_tmp:`In silence, release your waves in order before the storm hits`,r_tmp:`Co-op. Everyone holds secret waves from 1 to 100. On each swell beat, everyone chooses at once: release your lowest wave, or hold. They must come out in ascending order, without ever saying a number. Too early: −1 ⛵. 2 to 8 players.`,tpLv:`Level {v}`,tpLeft:`in {v}`,tpSince:`Swells without a wave: {v}`,tpPut:`Release {v}`,tpHold:`Hold`,tpCalm:`Calm wave`,tpNone:`Your waves are out. Cheer the crew on!`,tpX:`Too early! The foam takes {v}`,tpC:`Calm wave: everyone shows their range`,tpW:`The sea holds its breath…`,tpGo:`Feel the rhythm: release at the right moment`,tpOk:`Level {v} cleared!`,tpStorm:`The storm struck: −1 ⛵`,tpSunk:`Shipwreck… no hulls left.`,tpWin:`Every wave is through: storm tamed!`,tpBonL:`+1 ⛵ reinforcement`,tpBonC:`+1 🌅 calm wave`,tpEnd:`Levels cleared: {v} of {n}`,tpMute:`No numbers: chat is muted, reactions only`,tu_tmp1:`Everyone secretly gets waves numbered 1 to 100.`,tu_tmp2:`On each swell beat, everyone chooses at the same time: 🌊 release your lowest wave, or ⏳ hold.`,tu_tmp3:`Waves must come out in ascending order. Released on the same beat, they sort themselves.`,tu_tmp4:`Too early? Lower waves still in hand go to the foam: −1 ⛵.`,tu_tmp5:`⛈️ The storm draws closer every beat: finish the level before it arrives. The countdown is your shared clock.`,tu_tmp6:`🌅 Calm wave: if half of you ask for it, pause. Everyone shows the range of their lowest wave (e.g. 41–50).`,tu_tmp7:`No numbers are spoken: reactions only. Listen to the group's rhythm.`});
Object.assign(GI18N.es.ui,{coop_tmp:`La travesía`,n_tmp:`Tormenta`,d_tmp:`En silencio, soltad vuestras olas en orden antes de la tormenta`,r_tmp:`Cooperativo. Cada uno tiene olas secretas del 1 al 100. En cada golpe de mar, todos eligen a la vez: soltar su ola más baja o aguantar. Deben salir en orden creciente, sin decir nunca un número. Demasiado pronto: −1 ⛵. De 2 a 8.`,tpLv:`Nivel {v}`,tpLeft:`en {v}`,tpSince:`Golpes sin ola: {v}`,tpPut:`Soltar {v}`,tpHold:`Aguantar`,tpCalm:`Ola calma`,tpNone:`Tus olas ya salieron. ¡Anima a la tripulación!`,tpX:`¡Demasiado pronto! La espuma se lleva {v}`,tpC:`Ola calma: cada uno muestra su decena`,tpW:`El mar contiene el aliento…`,tpGo:`Sentid el ritmo: soltad en el momento justo`,tpOk:`¡Nivel {v} superado!`,tpStorm:`La tormenta golpeó: −1 ⛵`,tpSunk:`Naufragio… no quedan cascos.`,tpWin:`Todas las olas han pasado: ¡tormenta domada!`,tpBonL:`+1 ⛵ de refuerzo`,tpBonC:`+1 🌅 ola calma`,tpEnd:`Niveles superados: {v} de {n}`,tpMute:`Sin números: el chat calla, solo reacciones`,tu_tmp1:`Cada uno recibe en secreto olas numeradas del 1 al 100.`,tu_tmp2:`En cada golpe de mar, todos eligen a la vez: 🌊 soltar su ola más baja o ⏳ aguantar.`,tu_tmp3:`Las olas deben salir en orden creciente. Soltadas en el mismo golpe, se ordenan solas.`,tu_tmp4:`¿Demasiado pronto? Las olas más bajas aún en mano se van a la espuma: −1 ⛵.`,tu_tmp5:`⛈️ La tormenta se acerca a cada golpe: terminad el nivel antes. La cuenta atrás es vuestro reloj común.`,tu_tmp6:`🌅 Ola calma: si la mitad la pide, pausa. Cada uno muestra la decena de su ola más baja (p. ej. 41–50).`,tu_tmp7:`No se dice ningún número: solo reacciones. Escuchad el ritmo del grupo.`});
Object.assign(GI18N.it.ui,{coop_tmp:`La traversata`,n_tmp:`Tempesta`,d_tmp:`In silenzio, lasciate andare le onde in ordine prima della tempesta`,r_tmp:`Cooperativo. Ognuno ha onde segrete da 1 a 100. A ogni colpo di mare, tutti scelgono insieme: lasciare la propria onda più bassa o trattenerla. Devono uscire in ordine crescente, senza mai dire un numero. Troppo presto: −1 ⛵. Da 2 a 8.`,tpLv:`Livello {v}`,tpLeft:`tra {v}`,tpSince:`Colpi senza onda: {v}`,tpPut:`Lascia {v}`,tpHold:`Trattieni`,tpCalm:`Onda calma`,tpNone:`Le tue onde sono partite. Incoraggia l'equipaggio!`,tpX:`Troppo presto! La schiuma porta via {v}`,tpC:`Onda calma: ognuno mostra la sua decina`,tpW:`Il mare trattiene il respiro…`,tpGo:`Sentite il ritmo: lasciate al momento giusto`,tpOk:`Livello {v} superato!`,tpStorm:`La tempesta ha colpito: −1 ⛵`,tpSunk:`Naufragio… niente più scafi.`,tpWin:`Tutte le onde sono passate: tempesta domata!`,tpBonL:`+1 ⛵ di rinforzo`,tpBonC:`+1 🌅 onda calma`,tpEnd:`Livelli superati: {v} su {n}`,tpMute:`Niente numeri: la chat tace, solo reazioni`,tu_tmp1:`Ognuno riceve in segreto onde numerate da 1 a 100.`,tu_tmp2:`A ogni colpo di mare, tutti scelgono insieme: 🌊 lasciare la propria onda più bassa o ⏳ trattenerla.`,tu_tmp3:`Le onde devono uscire in ordine crescente. Lasciate allo stesso colpo, si mettono in fila da sole.`,tu_tmp4:`Troppo presto? Le onde più basse ancora in mano finiscono nella schiuma: −1 ⛵.`,tu_tmp5:`⛈️ La tempesta si avvicina a ogni colpo: finite il livello prima che arrivi. Il conto alla rovescia è il vostro orologio comune.`,tu_tmp6:`🌅 Onda calma: se la metà la chiede, pausa. Ognuno mostra la decina della sua onda più bassa (es. 41–50).`,tu_tmp7:`Nessun numero si dice: solo reazioni. Ascoltate il ritmo del gruppo.`});
Object.assign(GI18N.de.ui,{coop_tmp:`Die Überfahrt`,n_tmp:`Sturm`,d_tmp:`Lasst eure Wellen schweigend der Reihe nach los, bevor der Sturm kommt`,r_tmp:`Kooperativ. Alle haben geheime Wellen von 1 bis 100. Bei jedem Wellenschlag wählen alle gleichzeitig: die eigene niedrigste Welle loslassen oder halten. Sie müssen aufsteigend kommen, ohne dass je eine Zahl fällt. Zu früh: −1 ⛵. 2 bis 8.`,tpLv:`Level {v}`,tpLeft:`in {v}`,tpSince:`Schläge ohne Welle: {v}`,tpPut:`{v} loslassen`,tpHold:`Halten`,tpCalm:`Ruhige Welle`,tpNone:`Deine Wellen sind raus. Feuer die Crew an!`,tpX:`Zu früh! Die Gischt nimmt {v} mit`,tpC:`Ruhige Welle: alle zeigen ihren Zehnerbereich`,tpW:`Das Meer hält den Atem an…`,tpGo:`Spürt den Rhythmus: Lasst im richtigen Moment los`,tpOk:`Level {v} geschafft!`,tpStorm:`Der Sturm hat zugeschlagen: −1 ⛵`,tpSunk:`Schiffbruch… kein Rumpf mehr.`,tpWin:`Alle Wellen sind durch: Sturm gezähmt!`,tpBonL:`+1 ⛵ Verstärkung`,tpBonC:`+1 🌅 ruhige Welle`,tpEnd:`Geschaffte Level: {v} von {n}`,tpMute:`Keine Zahlen: Der Chat schweigt, nur Reaktionen`,tu_tmp1:`Alle bekommen geheim Wellen mit Zahlen von 1 bis 100.`,tu_tmp2:`Bei jedem Wellenschlag wählen alle gleichzeitig: 🌊 die niedrigste Welle loslassen oder ⏳ halten.`,tu_tmp3:`Die Wellen müssen aufsteigend kommen. Im selben Schlag losgelassen, ordnen sie sich von selbst.`,tu_tmp4:`Zu früh? Niedrigere Wellen, die noch auf der Hand sind, gehen in die Gischt: −1 ⛵.`,tu_tmp5:`⛈️ Der Sturm kommt mit jedem Schlag näher: Schafft das Level vorher. Der Countdown ist eure gemeinsame Uhr.`,tu_tmp6:`🌅 Ruhige Welle: Wenn die Hälfte sie will, Pause. Alle zeigen den Zehnerbereich ihrer niedrigsten Welle (z. B. 41–50).`,tu_tmp7:`Keine Zahl wird gesagt: nur Reaktionen. Hört auf den Rhythmus der Gruppe.`});
Object.assign(GI18N.ru.ui,{coop_tmp:`Переход`,n_tmp:`Шторм`,d_tmp:`Молча выпускайте волны по порядку, пока не грянул шторм`,r_tmp:`Кооператив. У каждого тайные волны от 1 до 100. На каждом ударе прибоя все одновременно выбирают: выпустить свою самую низкую волну или удержать. Они должны выходить по возрастанию, и ни одного числа вслух. Слишком рано: −1 ⛵. От 2 до 8.`,tpLv:`Уровень {v}`,tpLeft:`через {v}`,tpSince:`Ударов без волны: {v}`,tpPut:`Выпустить {v}`,tpHold:`Держать`,tpCalm:`Тихая волна`,tpNone:`Твои волны ушли. Подбадривай команду!`,tpX:`Слишком рано! Пена уносит {v}`,tpC:`Тихая волна: каждый показывает свой десяток`,tpW:`Море затаило дыхание…`,tpGo:`Почувствуйте ритм: выпускайте в нужный момент`,tpOk:`Уровень {v} пройден!`,tpStorm:`Шторм ударил: −1 ⛵`,tpSunk:`Кораблекрушение… корпусов не осталось.`,tpWin:`Все волны прошли: шторм укрощён!`,tpBonL:`+1 ⛵ подкрепление`,tpBonC:`+1 🌅 тихая волна`,tpEnd:`Пройдено уровней: {v} из {n}`,tpMute:`Никаких чисел: чат молчит, только реакции`,tu_tmp1:`Каждый тайно получает волны с номерами от 1 до 100.`,tu_tmp2:`На каждом ударе прибоя все выбирают одновременно: 🌊 выпустить самую низкую волну или ⏳ удержать.`,tu_tmp3:`Волны должны выходить по возрастанию. Выпущенные на одном ударе, они сами встают по порядку.`,tu_tmp4:`Слишком рано? Более низкие волны, оставшиеся на руках, уходят в пену: −1 ⛵.`,tu_tmp5:`⛈️ С каждым ударом шторм ближе: пройдите уровень до него. Обратный отсчёт — ваши общие часы.`,tu_tmp6:`🌅 Тихая волна: если половина просит — пауза. Каждый показывает десяток своей самой низкой волны (например 41–50).`,tu_tmp7:`Числа вслух не говорят: только реакции. Слушайте ритм группы.`});
Object.assign(GI18N.zh.ui,{coop_tmp:`穿越风暴`,n_tmp:`风暴`,d_tmp:`默默地按顺序放出海浪，赶在风暴之前`,r_tmp:`合作游戏。每人手里有 1 到 100 的秘密海浪。每一拍浪涌，所有人同时选择：放出自己最小的海浪，或按住不动。海浪必须从小到大依次出现，全程不能说出任何数字。放早了：−1 ⛵。2 到 8 人。`,tpLv:`第 {v} 关`,tpLeft:`还剩 {v} 拍`,tpSince:`无浪拍数：{v}`,tpPut:`放出 {v}`,tpHold:`按住`,tpCalm:`平静之浪`,tpNone:`你的海浪都放出去了，给大家加油吧！`,tpX:`放早了！浪花卷走了 {v}`,tpC:`平静之浪：每人亮出自己的十位区间`,tpW:`大海屏住了呼吸……`,tpGo:`感受节奏：在对的时刻放出`,tpOk:`第 {v} 关通过！`,tpStorm:`风暴来袭：−1 ⛵`,tpSunk:`沉船了……没有船体了。`,tpWin:`所有海浪都已通过：风暴被驯服了！`,tpBonL:`+1 ⛵ 增援`,tpBonC:`+1 🌅 平静之浪`,tpEnd:`通过关卡：{v} / {n}`,tpMute:`不能说数字：聊天已关闭，只能用表情`,tu_tmp1:`每人秘密拿到编号 1 到 100 的海浪。`,tu_tmp2:`每一拍浪涌，所有人同时选择：🌊 放出最小的海浪，或 ⏳ 按住。`,tu_tmp3:`海浪必须从小到大出现。同一拍放出的海浪会自动排好序。`,tu_tmp4:`放早了？手里更小的海浪会被卷进浪花：−1 ⛵。`,tu_tmp5:`⛈️ 每一拍风暴都更近一步：在它到来前完成本关。倒计时就是你们共同的时钟。`,tu_tmp6:`🌅 平静之浪：一半人请求就暂停，每人亮出自己最小海浪所在的十位区间（如 41–50）。`,tu_tmp7:`不能说任何数字：只能用表情。听听大家的节奏。`});
Object.assign(GI18N.he.ui,{coop_tmp:`המעבר`,n_tmp:`סערה`,d_tmp:`בשקט, שחררו את הגלים לפי הסדר לפני שהסערה מגיעה`,r_tmp:`שיתופי. לכל אחד גלים סודיים מ-1 עד 100. בכל הכאת גל כולם בוחרים בו-זמנית: לשחרר את הגל הנמוך ביותר שלהם או להחזיק. הגלים חייבים לצאת בסדר עולה, בלי לומר אף מספר. מוקדם מדי: −1 ⛵. 2 עד 8.`,tpLv:`שלב {v}`,tpLeft:`בעוד {v}`,tpSince:`הכאות בלי גל: {v}`,tpPut:`לשחרר {v}`,tpHold:`להחזיק`,tpCalm:`גל שקט`,tpNone:`הגלים שלך יצאו. עודדו את הצוות!`,tpX:`מוקדם מדי! הקצף לוקח את {v}`,tpC:`גל שקט: כל אחד מראה את הטווח שלו`,tpW:`הים עוצר את נשימתו…`,tpGo:`הרגישו את הקצב: שחררו ברגע הנכון`,tpOk:`שלב {v} עבר!`,tpStorm:`הסערה היכתה: −1 ⛵`,tpSunk:`טביעה… לא נשארו ספינות.`,tpWin:`כל הגלים עברו: הסערה אולפה!`,tpBonL:`+1 ⛵ תגבורת`,tpBonC:`+1 🌅 גל שקט`,tpEnd:`שלבים שעברו: {v} מתוך {n}`,tpMute:`בלי מספרים: הצ'אט שותק, רק תגובות`,tu_tmp1:`כל אחד מקבל בסוד גלים ממוספרים מ-1 עד 100.`,tu_tmp2:`בכל הכאת גל כולם בוחרים יחד: 🌊 לשחרר את הגל הנמוך ביותר או ⏳ להחזיק.`,tu_tmp3:`הגלים חייבים לצאת בסדר עולה. גלים ששוחררו באותה הכאה מסתדרים לבד.`,tu_tmp4:`מוקדם מדי? גלים נמוכים יותר שעוד ביד הולכים לקצף: −1 ⛵.`,tu_tmp5:`⛈️ הסערה מתקרבת בכל הכאה: סיימו את השלב לפניה. הספירה לאחור היא השעון המשותף שלכם.`,tu_tmp6:`🌅 גל שקט: אם חצי מבקשים, הפסקה. כל אחד מראה את הטווח של הגל הנמוך ביותר שלו (למשל 41–50).`,tu_tmp7:`לא אומרים מספרים: רק תגובות. הקשיבו לקצב של הקבוצה.`});
Object.assign(GI18N.pt.ui,{coop_tmp:`A travessia`,n_tmp:`Tempestade`,d_tmp:`Em silêncio, soltem suas ondas em ordem antes da tempestade`,r_tmp:`Cooperativo. Cada um tem ondas secretas de 1 a 100. A cada batida do mar, todos escolhem ao mesmo tempo: soltar sua onda mais baixa ou segurar. Elas devem sair em ordem crescente, sem nunca dizer um número. Cedo demais: −1 ⛵. De 2 a 8.`,tpLv:`Nível {v}`,tpLeft:`em {v}`,tpSince:`Batidas sem onda: {v}`,tpPut:`Soltar {v}`,tpHold:`Segurar`,tpCalm:`Onda calma`,tpNone:`Suas ondas já saíram. Anime a tripulação!`,tpX:`Cedo demais! A espuma leva {v}`,tpC:`Onda calma: cada um mostra sua dezena`,tpW:`O mar prende a respiração…`,tpGo:`Sintam o ritmo: soltem na hora certa`,tpOk:`Nível {v} superado!`,tpStorm:`A tempestade atingiu: −1 ⛵`,tpSunk:`Naufrágio… sem cascos.`,tpWin:`Todas as ondas passaram: tempestade domada!`,tpBonL:`+1 ⛵ de reforço`,tpBonC:`+1 🌅 onda calma`,tpEnd:`Níveis superados: {v} de {n}`,tpMute:`Sem números: o chat se cala, só reações`,tu_tmp1:`Cada um recebe em segredo ondas numeradas de 1 a 100.`,tu_tmp2:`A cada batida do mar, todos escolhem ao mesmo tempo: 🌊 soltar a onda mais baixa ou ⏳ segurar.`,tu_tmp3:`As ondas devem sair em ordem crescente. Soltas na mesma batida, elas se ordenam sozinhas.`,tu_tmp4:`Cedo demais? Ondas mais baixas ainda na mão vão para a espuma: −1 ⛵.`,tu_tmp5:`⛈️ A tempestade se aproxima a cada batida: terminem o nível antes dela. A contagem regressiva é o relógio comum de vocês.`,tu_tmp6:`🌅 Onda calma: se metade pedir, pausa. Cada um mostra a dezena da sua onda mais baixa (ex. 41–50).`,tu_tmp7:`Nenhum número é dito: só reações. Escutem o ritmo do grupo.`});
/* /⛈️ */
/* 🐚 textes des Marchands de coquillages (9 langues) ; coqL = noms de lots (réserve sans redite entre parties) */
const GCQ=(l,o,c)=>{Object.assign(GI18N[l].ui,o);Object.assign(GI18N[l],c)};
GCQ('fr',{n_coq:`Marchands de coquillages`,d_coq:`Enchères secrètes, cotes cachées, annonces vraies ou fausses`,
r_coq:`Chaque lot va à la plus haute offre secrète, payée en écus 🪙. Offres égales en tête : elles s'annulent, la suivante l'emporte. Chaque espèce a une cote cachée ; tu en connais une. Annonce, vrai ou faux : +1 si c'est vrai. À la fin : cotes, collection et écus restants.`,
r_coq2:`À deux, chacun connaît deux cotes. Chaque lot va à la plus haute offre secrète, payée en écus 🪙 ; offres égales : le lot reste et grossit. Annonce, vrai ou faux : +1 si c'est vrai. À la fin : cotes, collection et écus restants.`,
cqN:`Saint-Jacques|Conque|Porcelaine|Turritelle|Ormeau`,cqCarry:`personne, le lot reste`,cqTide:`Marée {v}/{n}`,cqLot:`lot {v}/{n}`,cqStall:`L'étal de la marée`,
cqAnQ:`Ton annonce publique (vraie ou fausse)`,cqUp:`Précieuse`,cqDn:`Sans valeur`,cqMute:`Rien à dire`,cqAnD:`+1 à la fin si c'est vrai : 📈 = cote 3 ou plus, 📉 = cote 1 ou moins.`,
cqBid:`Ton offre secrète (bourse : {v} 🪙)`,cqAuto:`0 = tu passes. Sans choix, tu passes.`,cqTie:`Modifiable jusqu'à la fin. Offres égales en tête : elles s'annulent.`,
cqOut:`La marée découvre une cote : {s} = {v}`,cqNoAn:`Personne n'avait rien annoncé sur cette espèce.`,cqInc:`Nouvelle marée : +{v} 🪙 pour chacun`,cqSea:`Le dernier lot, sans preneur, retourne à la mer.`,
cqMk:`Le grand marché`,cqSh:`coquillages × cote`,cqSet:`collection (3 espèces +2, 4 +4, 5 +7)`,cqAnn:`annonces vraies`,cqLeft:`½ point par écu restant`,
tu_coq1:`Cinq espèces de coquillages. Chacune a une cote cachée : 0, 1, 2, 3 ou 5. Toi, tu en connais une en secret.`,
tu_coq2:`Chaque lot est mis aux enchères : tout le monde offre en même temps, en secret. La plus haute offre gagne et paie ses écus.`,
tu_coq3:`Offres égales en tête ? Elles s'annulent : la plus haute offre restée seule l'emporte. Sinon, le lot reste et grossit.`,
tu_coq4:`Au début de chaque marée, une annonce publique : « précieuse » ou « sans valeur ». Elle peut être fausse !`,
tu_coq5:`À la fin des marées 1 et 2, une cote sort : les annonces vraies rapportent +1, les fausses sont démasquées.`,
tu_coq6:`Au grand marché : chaque coquillage vaut sa cote, plus la collection (5 espèces : +7) et ½ point par écu gardé.`,
tu_coq7:`À deux, chacun connaît deux cotes : le bluff devient un duel.`,
lg_coqS:`{a} a réuni les 5 espèces de coquillages`,lg_coqF:`{a} a vendu du vent : aucune annonce vraie aux Coquillages`,lg_coqT:`{a} n'a dit que la vérité aux Coquillages`,lg_coqB:`{a} a raflé un lot géant de coquillages`},
{coqL:`Panier de pêche à pied|Trouvaille de marée basse|La boîte à trésors de mamie|Sac oublié sur le ponton|Récolte de l'aube|Cadeau d'un phoque|Butin d'un crabe|Vitrine du musée fermé|Les poches d'un marin|Un seau de plage|Collection d'un vieux capitaine|Repêché après la tempête|Bocal de la cabane|Trésor d'une sirène distraite|Échantillons du professeur|Souvenirs de vacances|Caisse sans étiquette|Filet emmêlé|Le tiroir du phare|Coquilles du dimanche|Collier défait|La bourse d'une mouette|Le stock de la concurrence|Ramassage clandestin|Héritage d'un pirate|Fond de cale|Corbeille de la criée|Plongée de minuit|Laissé par l'écume|Dernière caisse du port`});
GCQ('en',{n_coq:`Shell Merchants`,d_coq:`Secret bids, hidden prices, true or false claims`,
r_coq:`Each lot goes to the highest secret bid, paid in coins 🪙. Tied top bids cancel out; the next one wins. Each species has a hidden price; you know one. Make a claim, true or false: +1 if it's true. At the end: prices, collection and leftover coins.`,
r_coq2:`For two, each of you knows two prices. Each lot goes to the highest secret bid, paid in coins 🪙; tied bids: the lot stays and grows. Make a claim, true or false: +1 if it's true. At the end: prices, collection and leftover coins.`,
cqN:`Scallop|Conch|Cowrie|Auger|Abalone`,cqCarry:`nobody, the lot stays`,cqTide:`Tide {v}/{n}`,cqLot:`lot {v}/{n}`,cqStall:`This tide's stall`,
cqAnQ:`Your public claim (true or false)`,cqUp:`Precious`,cqDn:`Worthless`,cqMute:`Nothing to say`,cqAnD:`+1 at the end if true: 📈 = price 3 or more, 📉 = price 1 or less.`,
cqBid:`Your secret bid (purse: {v} 🪙)`,cqAuto:`0 = you pass. No choice, you pass.`,cqTie:`You can change it until the end. Tied top bids cancel out.`,
cqOut:`The tide reveals a price: {s} = {v}`,cqNoAn:`Nobody had made a claim about this species.`,cqInc:`New tide: +{v} 🪙 each`,cqSea:`The last lot, unsold, goes back to the sea.`,
cqMk:`The grand market`,cqSh:`shells × price`,cqSet:`collection (3 species +2, 4 +4, 5 +7)`,cqAnn:`true claims`,cqLeft:`½ point per leftover coin`,
tu_coq1:`Five species of shells. Each has a hidden price: 0, 1, 2, 3 or 5. You secretly know one.`,
tu_coq2:`Each lot is auctioned: everyone bids at once, in secret. The highest bid wins and pays its coins.`,
tu_coq3:`Tied top bids? They cancel out: the highest bid left alone wins. If there is none, the lot stays and grows.`,
tu_coq4:`At the start of each tide, one public claim: "precious" or "worthless". It may be false!`,
tu_coq5:`After tides 1 and 2, a price comes out: true claims earn +1, false ones are exposed.`,
tu_coq6:`At the grand market: each shell is worth its price, plus the collection (5 species: +7) and ½ point per coin kept.`,
tu_coq7:`For two, each knows two prices: bluffing becomes a duel.`,
lg_coqS:`{a} gathered all 5 shell species`,lg_coqF:`{a} sold thin air: not one true claim in Shell Merchants`,lg_coqT:`{a} told nothing but the truth in Shell Merchants`,lg_coqB:`{a} scooped a giant lot of shells`},
{coqL:`The shore-forager's basket|Low-tide find|Grandma's treasure box|Bag forgotten on the pier|Dawn harvest|Gift from a seal|A crab's loot|Closed museum's showcase|A sailor's pockets|A beach bucket|An old captain's collection|Fished out after the storm|Jar from the beach hut|A distracted mermaid's treasure|The professor's samples|Holiday souvenirs|Unlabelled crate|Tangled net|The lighthouse drawer|Sunday shells|Broken necklace|A seagull's purse|The rival's stock|Secret beachcombing|A pirate's inheritance|Bottom of the hold|Fish-market basket|Midnight dive|Left by the foam|Last crate in the port`});
GCQ('es',{n_coq:`Mercaderes de conchas`,d_coq:`Pujas secretas, precios ocultos, anuncios verdaderos o falsos`,
r_coq:`Cada lote va a la puja secreta más alta, pagada en monedas 🪙. Pujas iguales en cabeza: se anulan y gana la siguiente. Cada especie tiene un precio oculto; tú conoces uno. Anuncia, verdad o mentira: +1 si es verdad. Al final: precios, colección y monedas sobrantes.`,
r_coq2:`A dos, cada uno conoce dos precios. Cada lote va a la puja secreta más alta, pagada en monedas 🪙; pujas iguales: el lote se queda y crece. Anuncia, verdad o mentira: +1 si es verdad. Al final: precios, colección y monedas sobrantes.`,
cqN:`Vieira|Caracola|Cauri|Turritela|Oreja de mar`,cqCarry:`nadie, el lote se queda`,cqTide:`Marea {v}/{n}`,cqLot:`lote {v}/{n}`,cqStall:`El puesto de esta marea`,
cqAnQ:`Tu anuncio público (verdadero o falso)`,cqUp:`Valiosa`,cqDn:`Sin valor`,cqMute:`Nada que decir`,cqAnD:`+1 al final si es verdad: 📈 = precio 3 o más, 📉 = precio 1 o menos.`,
cqBid:`Tu puja secreta (bolsa: {v} 🪙)`,cqAuto:`0 = pasas. Sin elección, pasas.`,cqTie:`Puedes cambiarla hasta el final. Pujas iguales en cabeza: se anulan.`,
cqOut:`La marea descubre un precio: {s} = {v}`,cqNoAn:`Nadie había anunciado nada sobre esta especie.`,cqInc:`Nueva marea: +{v} 🪙 para cada uno`,cqSea:`El último lote, sin comprador, vuelve al mar.`,
cqMk:`El gran mercado`,cqSh:`conchas × precio`,cqSet:`colección (3 especies +2, 4 +4, 5 +7)`,cqAnn:`anuncios verdaderos`,cqLeft:`½ punto por moneda sobrante`,
tu_coq1:`Cinco especies de conchas. Cada una tiene un precio oculto: 0, 1, 2, 3 o 5. Tú conoces uno en secreto.`,
tu_coq2:`Cada lote se subasta: todos pujan a la vez, en secreto. La puja más alta gana y paga sus monedas.`,
tu_coq3:`¿Pujas iguales en cabeza? Se anulan: gana la puja más alta que quede sola. Si no hay, el lote se queda y crece.`,
tu_coq4:`Al empezar cada marea, un anuncio público: «valiosa» o «sin valor». ¡Puede ser falso!`,
tu_coq5:`Tras las mareas 1 y 2 sale un precio: los anuncios verdaderos dan +1, los falsos quedan al descubierto.`,
tu_coq6:`En el gran mercado: cada concha vale su precio, más la colección (5 especies: +7) y ½ punto por moneda guardada.`,
tu_coq7:`A dos, cada uno conoce dos precios: el farol se vuelve un duelo.`,
lg_coqS:`{a} reunió las 5 especies de conchas`,lg_coqF:`{a} vendió humo: ni un anuncio verdadero en Mercaderes de conchas`,lg_coqT:`{a} solo dijo la verdad en Mercaderes de conchas`,lg_coqB:`{a} se llevó un lote gigante de conchas`},
{coqL:`La cesta del mariscador|Hallazgo de marea baja|La cajita de tesoros de la abuela|Bolsa olvidada en el muelle|Cosecha del alba|Regalo de una foca|El botín de un cangrejo|Vitrina del museo cerrado|Los bolsillos de un marinero|Un cubo de playa|Colección de un viejo capitán|Rescatado tras la tormenta|Tarro de la caseta|Tesoro de una sirena despistada|Muestras del profesor|Recuerdos de vacaciones|Caja sin etiqueta|Red enredada|El cajón del faro|Conchas de domingo|Collar deshecho|La bolsa de una gaviota|El género de la competencia|Recogida clandestina|Herencia de un pirata|Fondo de bodega|Cesta de la lonja|Inmersión de medianoche|Lo que dejó la espuma|Última caja del puerto`});
GCQ('it',{n_coq:`Mercanti di conchiglie`,d_coq:`Offerte segrete, prezzi nascosti, annunci veri o falsi`,
r_coq:`Ogni lotto va all'offerta segreta più alta, pagata in monete 🪙. Offerte uguali in testa: si annullano e vince la successiva. Ogni specie ha un prezzo nascosto; tu ne conosci uno. Annuncia, vero o falso: +1 se è vero. Alla fine: prezzi, collezione e monete rimaste.`,
r_coq2:`In due, ognuno conosce due prezzi. Ogni lotto va all'offerta segreta più alta, pagata in monete 🪙; offerte uguali: il lotto resta e cresce. Annuncia, vero o falso: +1 se è vero. Alla fine: prezzi, collezione e monete rimaste.`,
cqN:`Capasanta|Conca|Porcellana|Turritella|Orecchia di mare`,cqCarry:`nessuno, il lotto resta`,cqTide:`Marea {v}/{n}`,cqLot:`lotto {v}/{n}`,cqStall:`Il banco di questa marea`,
cqAnQ:`Il tuo annuncio pubblico (vero o falso)`,cqUp:`Preziosa`,cqDn:`Senza valore`,cqMute:`Niente da dire`,cqAnD:`+1 alla fine se è vero: 📈 = prezzo 3 o più, 📉 = prezzo 1 o meno.`,
cqBid:`La tua offerta segreta (borsa: {v} 🪙)`,cqAuto:`0 = passi. Senza scelta, passi.`,cqTie:`Puoi cambiarla fino alla fine. Offerte uguali in testa: si annullano.`,
cqOut:`La marea scopre un prezzo: {s} = {v}`,cqNoAn:`Nessuno aveva annunciato niente su questa specie.`,cqInc:`Nuova marea: +{v} 🪙 a testa`,cqSea:`L'ultimo lotto, invenduto, torna al mare.`,
cqMk:`Il grande mercato`,cqSh:`conchiglie × prezzo`,cqSet:`collezione (3 specie +2, 4 +4, 5 +7)`,cqAnn:`annunci veri`,cqLeft:`½ punto per moneta rimasta`,
tu_coq1:`Cinque specie di conchiglie. Ognuna ha un prezzo nascosto: 0, 1, 2, 3 o 5. Tu ne conosci uno in segreto.`,
tu_coq2:`Ogni lotto va all'asta: tutti offrono insieme, in segreto. L'offerta più alta vince e paga le sue monete.`,
tu_coq3:`Offerte uguali in testa? Si annullano: vince l'offerta più alta rimasta sola. Altrimenti il lotto resta e cresce.`,
tu_coq4:`All'inizio di ogni marea, un annuncio pubblico: «preziosa» o «senza valore». Può essere falso!`,
tu_coq5:`Dopo le maree 1 e 2 esce un prezzo: gli annunci veri valgono +1, quelli falsi vengono smascherati.`,
tu_coq6:`Al grande mercato: ogni conchiglia vale il suo prezzo, più la collezione (5 specie: +7) e ½ punto per moneta tenuta.`,
tu_coq7:`In due, ognuno conosce due prezzi: il bluff diventa un duello.`,
lg_coqS:`{a} ha riunito tutte e 5 le specie di conchiglie`,lg_coqF:`{a} ha venduto fumo: nessun annuncio vero in Mercanti di conchiglie`,lg_coqT:`{a} ha detto solo la verità in Mercanti di conchiglie`,lg_coqB:`{a} ha vinto un lotto gigante di conchiglie`},
{coqL:`Il cesto della pesca a piedi|Scoperta di bassa marea|La scatola dei tesori della nonna|Borsa dimenticata sul pontile|Raccolto dell'alba|Regalo di una foca|Il bottino di un granchio|Vetrina del museo chiuso|Le tasche di un marinaio|Un secchiello da spiaggia|Collezione di un vecchio capitano|Ripescato dopo la tempesta|Barattolo del capanno|Tesoro di una sirena distratta|Campioni del professore|Ricordi delle vacanze|Cassa senza etichetta|Rete aggrovigliata|Il cassetto del faro|Conchiglie della domenica|Collana disfatta|La borsa di un gabbiano|La merce della concorrenza|Raccolta clandestina|Eredità di un pirata|Fondo della stiva|Cesta del mercato del pesce|Immersione di mezzanotte|Lasciato dalla schiuma|Ultima cassa del porto`});
GCQ('de',{n_coq:`Muschelhändler`,d_coq:`Geheime Gebote, verborgene Preise, wahre oder falsche Ansagen`,
r_coq:`Jedes Los geht an das höchste geheime Gebot, bezahlt in Münzen 🪙. Gleiche Höchstgebote heben sich auf, das nächste gewinnt. Jede Art hat einen verborgenen Preis; du kennst einen. Sag etwas an, wahr oder falsch: +1, wenn es stimmt. Am Ende zählen Preise, Sammlung und übrige Münzen.`,
r_coq2:`Zu zweit kennt ihr je zwei Preise. Jedes Los geht an das höchste geheime Gebot, bezahlt in Münzen 🪙; bei Gleichstand bleibt das Los liegen und wächst. Sag etwas an, wahr oder falsch: +1, wenn es stimmt. Am Ende zählen Preise, Sammlung und übrige Münzen.`,
cqN:`Jakobsmuschel|Flügelschnecke|Kauri|Turmschnecke|Seeohr`,cqCarry:`niemand, das Los bleibt`,cqTide:`Gezeit {v}/{n}`,cqLot:`Los {v}/{n}`,cqStall:`Der Stand dieser Gezeit`,
cqAnQ:`Deine öffentliche Ansage (wahr oder falsch)`,cqUp:`Wertvoll`,cqDn:`Wertlos`,cqMute:`Nichts zu sagen`,cqAnD:`+1 am Ende, wenn es stimmt: 📈 = Preis 3 oder mehr, 📉 = Preis 1 oder weniger.`,
cqBid:`Dein geheimes Gebot (Börse: {v} 🪙)`,cqAuto:`0 = du passt. Ohne Wahl passt du.`,cqTie:`Änderbar bis zum Schluss. Gleiche Höchstgebote heben sich auf.`,
cqOut:`Die Gezeit enthüllt einen Preis: {s} = {v}`,cqNoAn:`Niemand hatte etwas über diese Art angesagt.`,cqInc:`Neue Gezeit: +{v} 🪙 für alle`,cqSea:`Das letzte Los ohne Käufer geht zurück ins Meer.`,
cqMk:`Der große Markt`,cqSh:`Muscheln × Preis`,cqSet:`Sammlung (3 Arten +2, 4 +4, 5 +7)`,cqAnn:`wahre Ansagen`,cqLeft:`½ Punkt je übrige Münze`,
tu_coq1:`Fünf Muschelarten. Jede hat einen verborgenen Preis: 0, 1, 2, 3 oder 5. Du kennst heimlich einen.`,
tu_coq2:`Jedes Los wird versteigert: Alle bieten gleichzeitig und geheim. Das höchste Gebot gewinnt und zahlt seine Münzen.`,
tu_coq3:`Gleiche Höchstgebote? Sie heben sich auf: Das höchste allein stehende Gebot gewinnt. Sonst bleibt das Los liegen und wächst.`,
tu_coq4:`Zu Beginn jeder Gezeit eine öffentliche Ansage: „wertvoll“ oder „wertlos“. Sie darf falsch sein!`,
tu_coq5:`Nach Gezeit 1 und 2 kommt ein Preis heraus: Wahre Ansagen bringen +1, falsche fliegen auf.`,
tu_coq6:`Auf dem großen Markt zählt jede Muschel ihren Preis, dazu die Sammlung (5 Arten: +7) und ½ Punkt je behaltene Münze.`,
tu_coq7:`Zu zweit kennt jede Seite zwei Preise: Bluffen wird zum Duell.`,
lg_coqS:`{a} hat alle 5 Muschelarten gesammelt`,lg_coqF:`{a} hat heiße Luft verkauft: keine einzige wahre Ansage bei den Muschelhändlern`,lg_coqT:`{a} hat bei den Muschelhändlern nur die Wahrheit gesagt`,lg_coqB:`{a} hat ein riesiges Muschellos ergattert`},
{coqL:`Korb vom Wattsammeln|Fund bei Ebbe|Omas Schatzkästchen|Am Steg vergessene Tasche|Ernte im Morgengrauen|Geschenk einer Robbe|Beute einer Krabbe|Vitrine des geschlossenen Museums|Die Taschen eines Seemanns|Ein Sandeimer|Sammlung eines alten Kapitäns|Nach dem Sturm herausgefischt|Glas aus der Strandhütte|Schatz einer zerstreuten Meerjungfrau|Proben des Professors|Urlaubsandenken|Kiste ohne Etikett|Verheddertes Netz|Die Schublade im Leuchtturm|Sonntagsmuscheln|Gerissene Kette|Die Börse einer Möwe|Ware der Konkurrenz|Heimliches Sammeln|Erbe eines Piraten|Ganz unten im Laderaum|Korb vom Fischmarkt|Tauchgang um Mitternacht|Vom Schaum zurückgelassen|Letzte Kiste im Hafen`});
GCQ('ru',{n_coq:`Торговцы ракушками`,d_coq:`Тайные ставки, скрытые цены, правдивые или ложные заявления`,
r_coq:`Каждый лот уходит к самой высокой тайной ставке в монетах 🪙. Равные лучшие ставки сгорают, побеждает следующая. У каждого вида скрытая цена; одну знаешь ты. Делай заявление, правдивое или ложное: +1, если оно верно. В конце: цены, коллекция и оставшиеся монеты.`,
r_coq2:`Вдвоём каждый знает две цены. Каждый лот уходит к самой высокой тайной ставке в монетах 🪙; при равных ставках лот остаётся и растёт. Делай заявление, правдивое или ложное: +1, если оно верно. В конце: цены, коллекция и оставшиеся монеты.`,
cqN:`Гребешок|Стромбус|Каури|Башенка|Морское ушко`,cqCarry:`никто, лот остаётся`,cqTide:`Прилив {v}/{n}`,cqLot:`лот {v}/{n}`,cqStall:`Прилавок этого прилива`,
cqAnQ:`Твоё публичное заявление (правда или ложь)`,cqUp:`Ценная`,cqDn:`Ничего не стоит`,cqMute:`Нечего сказать`,cqAnD:`+1 в конце, если это правда: 📈 = цена 3 и выше, 📉 = цена 1 и ниже.`,
cqBid:`Твоя тайная ставка (кошелёк: {v} 🪙)`,cqAuto:`0 = пас. Без выбора — пас.`,cqTie:`Можно менять до конца. Равные лучшие ставки сгорают.`,
cqOut:`Прилив открывает цену: {s} = {v}`,cqNoAn:`Об этом виде никто ничего не заявлял.`,cqInc:`Новый прилив: +{v} 🪙 каждому`,cqSea:`Последний лот без покупателя уходит обратно в море.`,
cqMk:`Большой рынок`,cqSh:`ракушки × цена`,cqSet:`коллекция (3 вида +2, 4 +4, 5 +7)`,cqAnn:`верные заявления`,cqLeft:`½ очка за каждую оставшуюся монету`,
tu_coq1:`Пять видов ракушек. У каждого скрытая цена: 0, 1, 2, 3 или 5. Одну из них ты тайно знаешь.`,
tu_coq2:`Каждый лот идёт с торгов: все ставят одновременно и тайно. Самая высокая ставка побеждает и платит свои монеты.`,
tu_coq3:`Равные лучшие ставки? Они сгорают: побеждает самая высокая ставка, оставшаяся в одиночку. Если такой нет, лот остаётся и растёт.`,
tu_coq4:`В начале каждого прилива — публичное заявление: «ценная» или «ничего не стоит». Оно может быть ложным!`,
tu_coq5:`После 1-го и 2-го прилива открывается одна цена: верные заявления дают +1, ложные раскрыты.`,
tu_coq6:`На большом рынке каждая ракушка стоит своей цены, плюс коллекция (5 видов: +7) и ½ очка за каждую сохранённую монету.`,
tu_coq7:`Вдвоём каждый знает две цены: блеф превращается в дуэль.`,
lg_coqS:`{a} {g.a:собрал|собрала|собрал(а)} все 5 видов ракушек`,lg_coqF:`{a} {g.a:продавал|продавала|продавал(а)} воздух: ни одного верного заявления в «Торговцах ракушками»`,lg_coqT:`{a} {g.a:говорил|говорила|говорил(а)} только правду в «Торговцах ракушками»`,lg_coqB:`{a} {g.a:урвал|урвала|урвал(а)} гигантский лот ракушек`},
{coqL:`Корзинка собирателя на отмели|Находка в отлив|Бабушкина шкатулка с сокровищами|Сумка, забытая на пирсе|Утренний сбор|Подарок тюленя|Добыча краба|Витрина закрытого музея|Карманы моряка|Пляжное ведёрко|Коллекция старого капитана|Выловлено после шторма|Банка из пляжного домика|Клад рассеянной русалки|Образцы профессора|Сувениры из отпуска|Ящик без этикетки|Спутанная сеть|Ящик стола на маяке|Воскресные ракушки|Рассыпанное ожерелье|Кошелёк чайки|Товар конкурентов|Тайный сбор|Наследство пирата|Со дна трюма|Корзина с рыбного рынка|Ночное погружение|Оставлено пеной|Последний ящик в порту`});
GCQ('zh',{n_coq:`贝壳商人`,d_coq:`秘密出价、隐藏价格、真假宣言`,
r_coq:`每个拍品归出价最高者，用金币 🪙 暗中出价。最高出价相同则互相抵消，次高者得。每种贝壳都有隐藏价格，你知道其中一种。发表宣言，真假随意：属实 +1。终局计算价格、收藏和剩余金币。`,
r_coq2:`两人对局，每人知道两种价格。每个拍品归暗中出价最高者（金币 🪙）；出价相同则拍品留下并变大。发表宣言，真假随意：属实 +1。终局计算价格、收藏和剩余金币。`,
cqN:`扇贝|凤螺|宝贝|锥螺|鲍鱼`,cqCarry:`无人得手，拍品留下`,cqTide:`第 {v}/{n} 潮`,cqLot:`拍品 {v}/{n}`,cqStall:`本潮的摊位`,
cqAnQ:`你的公开宣言（真假随意）`,cqUp:`珍贵`,cqDn:`不值钱`,cqMute:`无可奉告`,cqAnD:`属实则终局 +1：📈 = 价格 3 或以上，📉 = 价格 1 或以下。`,
cqBid:`你的秘密出价（钱袋：{v} 🪙）`,cqAuto:`0 = 放弃。不选就算放弃。`,cqTie:`结束前都可修改。最高出价相同则互相抵消。`,
cqOut:`潮水揭晓一个价格：{s} = {v}`,cqNoAn:`没有人对这种贝壳发表过宣言。`,cqInc:`新的潮水：每人 +{v} 🪙`,cqSea:`最后一个拍品无人买下，回到大海。`,
cqMk:`大集市`,cqSh:`贝壳 × 价格`,cqSet:`收藏（3 种 +2，4 种 +4，5 种 +7）`,cqAnn:`属实的宣言`,cqLeft:`每枚剩余金币 ½ 分`,
tu_coq1:`五种贝壳，每种都有隐藏价格：0、1、2、3 或 5。你暗中知道其中一种。`,
tu_coq2:`每个拍品都要拍卖：大家同时暗中出价。最高出价者获胜并付出金币。`,
tu_coq3:`最高出价相同？互相抵消：单独剩下的最高出价获胜。若没有，拍品留下并变大。`,
tu_coq4:`每次潮开始时，发表一条公开宣言：「珍贵」或「不值钱」。可以是假的！`,
tu_coq5:`第 1、2 次潮结束时揭晓一个价格：属实的宣言 +1，假的被识破。`,
tu_coq6:`大集市上：每个贝壳按价格计分，加上收藏（5 种：+7），每枚留下的金币 ½ 分。`,
tu_coq7:`两人对局，每人知道两种价格：虚张声势变成一场对决。`,
lg_coqS:`{a} 集齐了 5 种贝壳`,lg_coqF:`{a} 在「贝壳商人」里卖空气：没有一句宣言属实`,lg_coqT:`{a} 在「贝壳商人」里句句属实`,lg_coqB:`{a} 拿下了一大堆贝壳`},
{coqL:`赶海人的篮子|退潮时的发现|奶奶的百宝盒|码头上遗忘的袋子|黎明的收获|海豹的礼物|螃蟹的战利品|闭馆博物馆的橱窗|水手的口袋|沙滩小桶|老船长的收藏|风暴后捞起的|海滩小屋的罐子|迷糊美人鱼的宝藏|教授的样本|度假纪念品|没有标签的箱子|缠成一团的渔网|灯塔的抽屉|星期天的贝壳|散开的项链|海鸥的钱袋|对手的存货|偷偷捡来的|海盗的遗产|货舱最底层|鱼市的篮子|午夜潜水|浪花留下的|港口最后一箱`});
GCQ('he',{n_coq:`סוחרי צדפים`,d_coq:`הצעות סודיות, מחירים נסתרים, הכרזות אמת או שקר`,
r_coq:`כל חבילה הולכת להצעה הסודית הגבוהה ביותר, בתשלום במטבעות 🪙. הצעות שוות בראש מבטלות זו את זו, והבאה בתור זוכה. לכל מין מחיר נסתר, ואחד מהם ידוע לך. מכריזים, אמת או שקר: ⁦+1⁩ אם זה נכון. בסוף: מחירים, אוסף ומטבעות שנשארו.`,
r_coq2:`בשניים, כל צד יודע שני מחירים. כל חבילה הולכת להצעה הסודית הגבוהה ביותר, בתשלום במטבעות 🪙; בהצעות שוות החבילה נשארת וגדלה. מכריזים, אמת או שקר: ⁦+1⁩ אם זה נכון. בסוף: מחירים, אוסף ומטבעות שנשארו.`,
cqN:`מסרקית|קונכייה|קאורי|צריחון|אוזן־ים`,cqCarry:`אין זוכה, החבילה נשארת`,cqTide:`גאות {v}/{n}`,cqLot:`חבילה {v}/{n}`,cqStall:`הדוכן של הגאות הזאת`,
cqAnQ:`ההכרזה הפומבית שלך (אמת או שקר)`,cqUp:`יקרת ערך`,cqDn:`חסרת ערך`,cqMute:`אין מה לומר`,cqAnD:`⁦+1⁩ בסוף אם זה נכון: 📈 = מחיר 3 ומעלה, 📉 = מחיר 1 ומטה.`,
cqBid:`ההצעה הסודית שלך (ארנק: {v} 🪙)`,cqAuto:`0 = ויתור. בלי בחירה — ויתור.`,cqTie:`אפשר לשנות עד הסוף. הצעות שוות בראש מבטלות זו את זו.`,
cqOut:`הגאות חושפת מחיר: {s} = {v}`,cqNoAn:`לא הייתה שום הכרזה על המין הזה.`,cqInc:`גאות חדשה: ⁦+{v}⁩ 🪙 לכולם`,cqSea:`החבילה האחרונה, בלי קונה, חוזרת לים.`,
cqMk:`השוק הגדול`,cqSh:`צדפים × מחיר`,cqSet:`אוסף (3 מינים ⁦+2⁩, 4 ⁦+4⁩, 5 ⁦+7⁩)`,cqAnn:`הכרזות נכונות`,cqLeft:`חצי נקודה לכל מטבע שנשאר`,
tu_coq1:`חמישה מיני צדפים. לכל אחד מחיר נסתר: 0, 1, 2, 3 או 5. אחד מהם ידוע לך בסוד.`,
tu_coq2:`כל חבילה עולה למכירה פומבית: כולם מציעים יחד, בסוד. ההצעה הגבוהה ביותר זוכה ומשלמת את המטבעות.`,
tu_coq3:`הצעות שוות בראש? הן מתבטלות: ההצעה הגבוהה ביותר שנשארה לבד זוכה. אם אין, החבילה נשארת וגדלה.`,
tu_coq4:`בתחילת כל גאות, הכרזה פומבית: „יקרת ערך" או „חסרת ערך". מותר לשקר!`,
tu_coq5:`אחרי גאות 1 ו־2 נחשף מחיר: הכרזות נכונות שוות ⁦+1⁩, והשקריות נחשפות.`,
tu_coq6:`בשוק הגדול: כל צדף שווה את מחירו, ועוד האוסף (5 מינים: ⁦+7⁩) וחצי נקודה לכל מטבע שנשמר.`,
tu_coq7:`בשניים, כל צד יודע שני מחירים: הבלוף הופך לדו־קרב.`,
lg_coqS:`{a} {g.a:אסף|אספה|אסף/ה} את כל 5 מיני הצדפים`,lg_coqF:`{a} {g.a:מכר|מכרה|מכר/ה} אוויר: אף הכרזה נכונה בסוחרי צדפים`,lg_coqT:`{a} {g.a:אמר|אמרה|אמר/ה} רק אמת בסוחרי צדפים`,lg_coqB:`{a} {g.a:חטף|חטפה|חטף/ה} חבילת צדפים ענקית`},
{coqL:`הסל של מלקטי החוף|ממצא של שפל|קופסת האוצרות של סבתא|תיק שנשכח על המזח|קציר של שחר|מתנה מכלב ים|שלל של סרטן|ויטרינה של מוזיאון סגור|הכיסים של מלח|דלי של חוף|האוסף של רב־חובל זקן|נמשה אחרי הסערה|צנצנת מהבקתה|אוצר של בתולת ים מפוזרת|הדגימות של הפרופסור|מזכרות מהחופשה|ארגז בלי תווית|רשת מסובכת|המגירה של המגדלור|צדפים של שבת|שרשרת שהתפרקה|הארנק של שחף|הסחורה של המתחרים|ליקוט חשאי|הירושה של פיראט|בתחתית הספינה|סל משוק הדגים|צלילת חצות|מה שהקצף השאיר|הארגז האחרון בנמל`});
GCQ('pt',{n_coq:`Mercadores de conchas`,d_coq:`Lances secretos, preços ocultos, anúncios verdadeiros ou falsos`,
r_coq:`Cada lote vai para o lance secreto mais alto, pago em moedas 🪙. Lances iguais no topo se anulam, e o seguinte vence. Cada espécie tem um preço oculto; você conhece um. Anuncie, verdade ou mentira: +1 se for verdade. No fim: preços, coleção e moedas que sobraram.`,
r_coq2:`A dois, cada um conhece dois preços. Cada lote vai para o lance secreto mais alto, pago em moedas 🪙; lances iguais: o lote fica e cresce. Anuncie, verdade ou mentira: +1 se for verdade. No fim: preços, coleção e moedas que sobraram.`,
cqN:`Vieira|Búzio|Cauri|Turritela|Orelha-do-mar`,cqCarry:`ninguém, o lote fica`,cqTide:`Maré {v}/{n}`,cqLot:`lote {v}/{n}`,cqStall:`A banca desta maré`,
cqAnQ:`Seu anúncio público (verdadeiro ou falso)`,cqUp:`Valiosa`,cqDn:`Sem valor`,cqMute:`Nada a dizer`,cqAnD:`+1 no fim se for verdade: 📈 = preço 3 ou mais, 📉 = preço 1 ou menos.`,
cqBid:`Seu lance secreto (bolsa: {v} 🪙)`,cqAuto:`0 = você passa. Sem escolha, você passa.`,cqTie:`Dá para mudar até o fim. Lances iguais no topo se anulam.`,
cqOut:`A maré revela um preço: {s} = {v}`,cqNoAn:`Ninguém tinha anunciado nada sobre esta espécie.`,cqInc:`Nova maré: +{v} 🪙 para cada um`,cqSea:`O último lote, sem comprador, volta para o mar.`,
cqMk:`O grande mercado`,cqSh:`conchas × preço`,cqSet:`coleção (3 espécies +2, 4 +4, 5 +7)`,cqAnn:`anúncios verdadeiros`,cqLeft:`½ ponto por moeda que sobrou`,
tu_coq1:`Cinco espécies de conchas. Cada uma tem um preço oculto: 0, 1, 2, 3 ou 5. Você conhece um em segredo.`,
tu_coq2:`Cada lote vai a leilão: todos dão lances ao mesmo tempo, em segredo. O lance mais alto vence e paga suas moedas.`,
tu_coq3:`Lances iguais no topo? Eles se anulam: vence o lance mais alto que ficou sozinho. Se não houver, o lote fica e cresce.`,
tu_coq4:`No início de cada maré, um anúncio público: «valiosa» ou «sem valor». Pode ser falso!`,
tu_coq5:`Depois das marés 1 e 2 sai um preço: anúncios verdadeiros valem +1, os falsos são desmascarados.`,
tu_coq6:`No grande mercado: cada concha vale seu preço, mais a coleção (5 espécies: +7) e ½ ponto por moeda guardada.`,
tu_coq7:`A dois, cada um conhece dois preços: o blefe vira um duelo.`,
lg_coqS:`{a} reuniu as 5 espécies de conchas`,lg_coqF:`{a} vendeu fumaça: nenhum anúncio verdadeiro em Mercadores de conchas`,lg_coqT:`{a} só disse a verdade em Mercadores de conchas`,lg_coqB:`{a} arrematou um lote gigante de conchas`},
{coqL:`O cesto da mariscagem|Achado da maré baixa|A caixinha de tesouros da avó|Sacola esquecida no píer|Colheita do amanhecer|Presente de uma foca|O saque de um caranguejo|Vitrine do museu fechado|Os bolsos de um marinheiro|Um baldinho de praia|Coleção de um velho capitão|Pescado depois da tempestade|Pote da cabana|Tesouro de uma sereia distraída|Amostras do professor|Lembranças das férias|Caixa sem etiqueta|Rede embaraçada|A gaveta do farol|Conchas de domingo|Colar desfeito|A bolsa de uma gaivota|O estoque da concorrência|Coleta clandestina|Herança de um pirata|Fundo do porão|Cesto da peixaria|Mergulho da meia-noite|Deixado pela espuma|Última caixa do porto`});
/* /🐚 i18n */
/* =====================================================================
   🫧 MÉMOIRE DES ABYSSES — fiche (mémoire, 2 à 8, ~8 min)
   9 manches, une épreuve chacune, de plus en plus longues (plan fixe, contenu tiré au hasard) :
     🔁 Écho 3 · ✨ Lucioles 4 · 🔍 Changement 5 (1 case) · 🔁 Écho 5 · ↩️ Reflux 4 · 👀 Intrus 6 · ✨ Lucioles 6 ·
     🔍 Changement 7 (2 cases) · ↩️ Reflux 6 (répétitions permises).
     Écho : des créatures passent une à une, on les rend dans l'ordre. Reflux : à l'envers. Lucioles : des lumières
     s'allument sur une grille 3×3, dans l'ordre. Changement : un décor 4×3, puis le même avec des cases changées
     (apparition, disparition ou substitution) à toucher. Intrus : une suite passe, puis tout revient mélangé avec une
     créature jamais passée.
   Anti-latence : pendant l'étape « montrer », l'état ne contient qu'une GRAINE (g.sd). Chaque appareil en tire la même
     suite (abGen, PRNG déterministe) et la joue LOCALEMENT dès que l'étape lui arrive, puis envoie « vu » tout seul ; le
     rappel s'ouvre quand tout le monde a vu (sablier jamais plus court que la séquence, même en mode rapide). La graine
     sort de l'état dès la fin de l'étape (hide) : pendant le rappel, chacun ne reçoit que SES données (palette, décor
     modifié ou candidats). On juge la JUSTESSE ; le temps (mesuré sur l'appareil, de l'ouverture du rappel à la réponse
     complète) ne sert qu'à départager une égalité en tête à la fin (+1 ⚡ au plus rapide).
   Points : suites = plus longue sous-suite commune avec la bonne réponse (un oubli coûte 1, pas tout le reste) + 1 si
     sans faute ; changement / intrus = 4 par case trouvée. Réponses modifiables jusqu'à la fin de l'étape.
   🤿 Plongée profonde (choisie en secret pendant la révélation précédente ; 2 par partie, 3 à deux ; seulement si on
     n'est PAS en tête, ex æquo compris, donc jamais à la 1re manche) : la même épreuve avec +2 éléments (créatures /
     lumières, ou 2 créatures de plus dans le décor), points ×1,5 (arrondi) si au moins la moitié est juste, sinon 0.
     Un pari à espérance presque neutre mais risqué : de la variance pour qui est derrière, jamais pour la tête.
   À deux : duel, 3 plongées chacun ; seul·e celui / celle qui est derrière peut plonger.
   Pas d'élimination, pas de premier joueur : tout est simultané et secret jusqu'à la révélation.
   SIM (.sim/aby.js, 4000 parties/taille ; modèle : empan 5 / 6 / 7 (faible / moyen / fort) ± bruit, chaque élément retenu
     selon une logistique (longueur − empan), −1 à l'envers, −0,5 pour les lumières ; changement / intrus selon le nombre de créatures) :
     styles de plongée, niveau égal, tables mixtes (victoire relative à 1/n), n=2/3/4/6/8 : jamais 98/94/91/83/79 ·
     dès que possible 101/102/105/111/109 · tard (manches 6+) 100/102/101/102/104 · si 4 pts de retard 102/100/99/97/98 ·
     au hasard 100/102/103/108/110 → plonger aide un peu, aucun moment ne domine ; 44 % de plongées réussies.
     Sièges (tous pareils) : 48.4/51.6 · n=4 24.1–25.6 · n=8 12.1–13.5 (attendu 12.5).
     Niveaux : faible / moyen / fort ≈ 23 / 29 / 35 points (le faible garde ~80 % du score grâce aux points partiels) ;
     la tête change après la manche 4 dans 46 % des parties ; un·e fort·e contre des moyens gagne 80 % à 2, 62 % à 4, 51 % à 6.
     Rejetés : ×2 dès la moitié (plonger dès que possible écrasait tout : « jamais » 23–81 %), plongée permise aux ex æquo
     en tête (tout le monde plongeait à la manche 1, la plus facile), ×2 aux deux tiers (19 % de réussite, frustrant).
     Vraie logique (.sim/aby_run.js, 600 parties de 2 à 8, dont avec absent) : 0 blocage, 0 fuite (graine, réponses,
     plongées, temps), jamais de plongée en tête.
   ===================================================================== */
const ABY={PL:['🐙','🦑','🪼','🐡','🦀','🐠','🦈','🐚','🦐','🐢','🐳'],TY:'erlci',IC:{e:'🔁',r:'↩️',l:'✨',c:'🔍',i:'👀'},
 R:[{t:'e',n:3,k:6,v:900},{t:'l',n:4,v:900},{t:'c',n:5,c:1},{t:'e',n:5,k:8,v:800},{t:'r',n:4,k:7,v:800},{t:'i',n:6,c:1,v:750},
  {t:'l',n:6,v:750},{t:'c',n:7,c:2},{t:'r',n:6,k:8,rep:1,v:750}],
 X:2,DV:n=>n==2?3:2,DM:1.5,DT:.5,CP:4,LEAD:1800,GAP:260,CS:n=>2400+450*n,AT:m=>14+2*m,RT:25,PT:30,
 HZ:[392,440,494,523,587,659,698,784,880]};
/* PRNG déterministe (mulberry32) : même graine → même suite sur tous les appareils */
const abRng=sd=>{let a=sd>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const abSh=(a,r)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
/* contenu d'une manche : D = version plongée profonde (+2), B = version de base (préfixe / sous-ensemble de D) */
function abGen(sd,R){const r=abRng(sd),X=ABY.X,N=R.n+X,P=abSh([...ABY.PL.keys()],r);
 if(R.t=='l'){const s=[];while(s.length<N){const v=Math.floor(r()*9);if(v!==s[s.length-1])s.push(v)}return{D:{s},B:{s:s.slice(0,R.n)}}}
 if(R.t=='e'||R.t=='r'){const pal=P.slice(0,Math.max(R.k,R.rep?0:N));let s;
  if(R.rep){s=[];while(s.length<N){const v=pal[Math.floor(r()*pal.length)];if(v!==s[s.length-1])s.push(v)}}else s=abSh(pal,r).slice(0,N);
  return{pal:pal.slice().sort((a,b)=>a-b),D:{s},B:{s:s.slice(0,R.n)}}}
 if(R.t=='i'){const s=P.slice(0,N),x=P.slice(N,N+R.c),b=s.slice(0,R.n);return{D:{s,x,cand:abSh(s.concat(x),r)},B:{s:b,x,cand:abSh(b.concat(x),r)}}}
 /* changement : décor 4×3 (-1 = vide) ; les 2 créatures en plus de D ne changent jamais */
 const cells=abSh([...Array(12).keys()],r),B=Array(12).fill(-1);cells.slice(0,R.n).forEach((c,j)=>B[c]=P[j]);
 const D=B.slice();cells.slice(R.n,N).forEach((c,j)=>D[c]=P[R.n+j]);
 const bc=abSh(cells.slice(0,R.n),r),fc=cells.slice(N),Ba=B.slice(),Da=D.slice(),ch=[];let nx=N;
 for(let j=0;j<R.c;j++){const ty=r();let c;
  if(ty<.5){c=bc.pop();Ba[c]=Da[c]=P[nx++]}/* substitution */
  else if(ty<.75||!fc.length){c=bc.pop();Ba[c]=Da[c]=-1}/* disparition */
  else{c=fc.pop();Ba[c]=Da[c]=P[nx++]}/* apparition */
  ch.push(c)}
 return{D:{sc:D,alt:Da,ch},B:{sc:B,alt:Ba,ch}}}
/* plus longue sous-suite commune + éléments de la réponse qui en font partie */
function abLcs(a,b){const m=a.length,n=b.length,T=[...Array(m+1)].map(()=>Array(n+1).fill(0));
 for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)T[i][j]=a[i-1]===b[j-1]?T[i-1][j-1]+1:Math.max(T[i-1][j],T[i][j-1]);
 const mk=Array(m).fill(0);let i=m,j=n;while(i&&j){if(a[i-1]===b[j-1]){mk[i-1]=1;i--;j--}else if(T[i-1][j]>=T[i][j-1])i--;else j--}return{c:T[m][n],mk}}
function abScore(R,v,a,dv){a=a||[];let c,N,mk,base,perf;
 if(R.t=='e'||R.t=='r'||R.t=='l'){const tg=R.t=='r'?v.s.slice().reverse():v.s,L=abLcs(a,tg);c=L.c;N=tg.length;mk=L.mk;perf=c==N&&a.length==N;base=c+(perf?1:0)}
 else{const S=R.t=='c'?v.ch:v.x;mk=a.map(x=>S.includes(x)?1:0);c=mk.reduce((x,y)=>x+y,0);N=R.c;perf=c==N;base=ABY.CP*c}
 const ok=!dv||c>=Math.ceil(ABY.DT*N-1e-9);return{c,N,mk,perf:perf?1:0,pts:dv?(ok?Math.round(ABY.DM*base):0):base,fail:ok?0:1}}
const abLen=(R,dv)=>ABY.LEAD+(R.t=='c'?ABY.CS(R.n):(R.n+(dv?ABY.X:0))*(R.v+ABY.GAP));
const AG={};/* affichage local (jamais envoyé) : départ de la séquence, brouillon de réponse */
const abC=(i,cl)=>`<span class="abc ${cl||''}">${ABY.PL[i]}</span>`;
const abM=(c,cl)=>`<i class="abmg ${cl||''}" dir="ltr">${[...Array(9).keys()].map(j=>`<b class="${j==c?'on':''}"></b>`).join('')}</i>`;
GAMES.aby={icon:'🫧',min:2,max:8,dur:8,tags:['skill'],ABY,gen:abGen,score:abScore,
 init(s){const g=s.game,n=s.order.length;g.n=ABY.R.length;g.tk={};g.tt={};g.pf={};g.dok={};g.du={};g.dv={};g.dn=[];g.hist=[];
  s.order.forEach(p=>{g.tk[p]=ABY.DV(n);g.tt[p]=0;g.pf[p]=0;g.dok[p]=0;g.du[p]=0});gWait(g,ABY.PT,'p',1)},
 lead(s,p){const g=s.game,mx=Math.max(...s.order.map(x=>g.sc[x]||0));return (g.sc[p]||0)==mx},
 can(s,p){const g=s.game,ri=g.st=='p'?g.r:g.r+1;return ri<g.n&&(g.tk[p]||0)>0&&!this.lead(s,p)},
 act(s,from,a){const g=s.game;
  if(g.rv){if(a.dv==null)return;const v=a.dv?1:0;if(v&&!this.can(s,from))return;g.dv[from]=v;return true}
  if(g.st=='s'){if(!a.seen)return;g.done[from]=1;return true}
  if(g.st=='a'){const R=ABY.R[g.r],q=(g.q||{})[from];if(!q||!Array.isArray(a.a))return;const A=a.a.slice(0,q.m).map(x=>+x);
   if(A.some(x=>!Number.isInteger(x)))return;
   if(R.t=='l'){if(A.some(x=>x<0||x>8))return}
   else if(R.t=='c'){if(A.some(x=>x<0||x>11)||new Set(A).size<A.length)return}
   else if(R.t=='i'){if(A.some(x=>!q.cand.includes(x))||new Set(A).size<A.length)return}
   else if(A.some(x=>!q.pal.includes(x)))return;
   g.ans[from]=A;if(A.length==q.m){g.done[from]=1;g.ms[from]=Math.max(0,Math.min(+a.ms||0,(g.sec||60)*1000))}else delete g.ms[from];return true}},
 next(s){const g=s.game;
  if(g.st=='p')return this.show(s);
  if(g.st=='s'){const R=ABY.R[g.r],G=abGen(g.sd,R);g.q={};g.ans={};g.ms={};let mx=0;
   s.order.forEach(p=>{const v=g.dn.includes(p)?G.D:G.B,q={m:R.t=='c'||R.t=='i'?R.c:v.s.length};if(G.pal)q.pal=G.pal;if(R.t=='c')q.alt=v.alt;if(R.t=='i')q.cand=v.cand;g.q[p]=q;mx=Math.max(mx,R.t=='c'||R.t=='i'?4:q.m)});
   gWait(g,ABY.AT(mx),'a');return}
  if(g.st=='a')return this.judge(s);
  if(g.st=='r'){g.r++;if(g.r>=g.n){g.over=1;return}this.show(s)}},
 /* nouvelle manche : plongeurs validés (jeton + pas en tête), nouvelle graine, sablier ≥ durée de la séquence */
 show(s){const g=s.game,R=ABY.R[g.r];g.dn=s.order.filter(p=>g.dv[p]&&(g.tk[p]||0)>0&&!this.lead(s,p));g.dn.forEach(p=>{g.tk[p]--;g.du[p]++});
  g.dv={};g.res=null;g.q=null;g.ans={};g.sd=Math.floor(Math.random()*4294967296);
  const need=Math.ceil(abLen(R,1)/1000)+5;gWait(g,need,'s');if(g.dl>0&&g.sec<need){g.sec=need;g.dl=Date.now()+need*1000}},
 judge(s){const g=s.game,R=ABY.R[g.r],G=abGen(g.sd,R),P={};
  s.order.forEach(p=>{const dv=g.dn.includes(p),sc=abScore(R,dv?G.D:G.B,g.ans[p],dv);sc.a=(g.ans[p]||[]).slice();sc.dv=dv?1:0;
   g.sc[p]=(g.sc[p]||0)+sc.pts;if(sc.perf)g.pf[p]++;if(dv&&!sc.fail)g.dok[p]++;
   g.tt[p]+=g.ms[p]!=null?g.ms[p]:(g.sec||60)*1000;P[p]=sc});
  g.res={B:G.B,D:G.D,p:P};g.hist.push(Object.fromEntries(s.order.map(p=>[p,P[p].pts])));g.dv={};gWait(g,ABY.RT,'r',1)},
 /* secrets : la graine seulement pendant « montrer » ; chacun ne reçoit que SES données de rappel, SA réponse, SON choix de plongée */
 hide(g,n){const o={...g};if(g.st!='s')delete o.sd;delete o.ms;delete o.tt;
  if(g.q)o.q={[n]:g.q[n]};if(g.st=='a')o.ans={[n]:(g.ans||{})[n]};if(g.rv)o.dv={[n]:(g.dv||{})[n]};return o},
 /* fin : égalité en tête → +1 ⚡ au plus rapide (temps cumulé mesuré sur chaque appareil) */
 fin(s){const g=s.game;if(!g.fz){g.fz=1;const mx=Math.max(...s.order.map(p=>g.sc[p]||0)),T=s.order.filter(p=>(g.sc[p]||0)==mx);g.tb=null;
   if(T.length>1&&mx>0){const t=T.map(p=>g.tt[p]||0),mn=Math.min(...t);if(t.filter(x=>x==mn).length==1){g.tb=T[t.indexOf(mn)];g.sc[g.tb]++}}}return{pts:g.sc}},
 log(s){const g=s.game,L=[];s.order.forEach(p=>{if((g.pf[p]||0)>=6)L.push({k:'abyP',n:[p]});if((g.dok[p]||0)>=2)L.push({k:'abyD',n:[p]})});
  const h=g.hist||[];if(h.length>=g.n&&s.order.length>2){const c={};s.order.forEach(p=>c[p]=0);h.slice(0,4).forEach(r=>{for(const p in r)if(p in c)c[p]+=r[p]});
   const mn=Math.min(...Object.values(c)),last=s.order.filter(p=>c[p]==mn),mx=Math.max(...s.order.map(p=>g.sc[p]||0));
   if(last.length==1&&(g.sc[last[0]]||0)==mx&&s.order.filter(p=>(g.sc[p]||0)==mx).length==1)L.push({k:'abyC',n:last})}return L},/* 📜 */
 /* ---------- vue ---------- */
 tn(R,k){return GT(k,{v:R.c||''}).split('|')[ABY.TY.indexOf(R.t)]||''},
 top(R,k,dv){return `<div class="abhd"><span class="abti">${ABY.IC[R.t]}</span><b>${this.tn(R,'abT')}</b>${dv?'<span class="abdvt">🤿 +2</span>':''}</div><p class="abins">${this.tn(R,k)}</p>`},
 nx(R){return `<div class="abnx ga" ${dl(1)}><span class="abti">${ABY.IC[R.t]}</span><span><b>${this.tn(R,'abT')}</b><small>${this.tn(R,'abS')} · ${GT('abN',{v:R.n})}</small></span></div>`},
 /* seuil concret de la plongée pour l'épreuve R : au moins k justes sur n */
 dvk(R){const n=R.t=='c'||R.t=='i'?R.c:R.n+ABY.X;return{n,k:Math.ceil(ABY.DT*n-1e-9)}},
 dive(s,g,m){if(!s.order.includes(m))return '';const ri=g.st=='p'?g.r:g.r+1;if(ri>=g.n)return '';const t=g.tk[m]||0,on=!!(g.dv||{})[m];
  if(!t)return `<p class="abdv0">🤿 ${GT('abDv0')}</p>`;if(!this.can(s,m))return `<p class="abdv0">🤿 ${GT('abDvL')}</p>`;
  return `<button class="abdvb ga ${on?'sel':''}" ${dl(2)} data-abdv="${on?0:1}" aria-pressed="${on}"><span class="abdvi">🤿</span><span class="abdvx"><b>${GT('abDv')}</b><small>${GT('abDvD',this.dvk(ABY.R[ri]))}</small></span><span class="abtk" aria-label="${t}">${'🫧'.repeat(t)}</span></button>`},
 crew(s,g,m,sh){return `<div class="abcr">${s.order.map(p=>`<span class="abm ${p==m?'me':''}">${DT(p)}<b>${p==m?esc(GT('me')):esc(p)}</b>${sh&&(g.dn||[]).includes(p)?'<i>🤿</i>':''}<em dir="ltr">${g.sc[p]||0}</em>${g.done[p]&&!g.rv?'<i class="tpok" aria-hidden="true"></i>':''}</span>`).join('')}</div>`},
 /* la séquence, jouée localement : délais négatifs → un nouveau rendu continue l'animation sans la relancer */
 stage(R,v,e){const L=ABY.LEAD,d=t=>((t-e)/1000).toFixed(2)+'s',at=j=>L+j*(R.v+ABY.GAP);let h='';
  if(R.t=='l')h=`<div class="abgl" dir="ltr">${[...Array(9).keys()].map(c=>`<span class="abln">${v.s.map((x,j)=>x==c?`<i class="abfl" style="animation-duration:${R.v}ms;animation-delay:${d(at(j))}"></i>`:'').join('')}</span>`).join('')}</div>`;
  else if(R.t=='c')h=`<div class="abgc abshow" dir="ltr" style="animation-duration:${ABY.CS(R.n)}ms;animation-delay:${d(L)}">${v.sc.map(x=>`<span class="abcl">${x>=0?ABY.PL[x]:''}</span>`).join('')}</div>`;
  else h=v.s.map((x,j)=>`<span class="abit" style="animation-duration:${R.v}ms;animation-delay:${d(at(j))};--x:${((j*37)%5-2)*16}px;--y:${((j*53)%3-1)*10}px"><b>${ABY.PL[x]}</b></span>`).join('');
  const dots=R.t=='c'?'':`<div class="abdots">${v.s.map((_,j)=>`<i style="animation-delay:${d(at(j))}"></i>`).join('')}</div>`;
  return `<div class="abs ${R.t=='l'?'l':''}" data-gan aria-hidden="true"><i class="abb"></i><i class="abb b2"></i><i class="abb b3"></i><span class="abcd" style="animation-delay:${d(0)};animation-duration:${L}ms"><b>👁️</b></span>${h}${dots}</div>`},
 showV(s,g,m){const R=ABY.R[g.r],play=s.order.includes(m),dv=(g.dn||[]).includes(m),K=s.gid+'.'+g.k;
  if(g.sd==null)return{html:`<div class="card c">${this.top(R,'abS')}${this.crew(s,g,m,1)}</div>`};
  const G=abGen(g.sd,R),v=dv?G.D:G.B,T=abLen(R,dv);
  if(AG.sk!==K){AG.sk=K;AG.st=Date.now();AG.sent=0;clearTimeout(AG.to);
   if(typeof tone=='function'&&R.t!='c')try{tone(v.s.map((x,j)=>[R.t=='l'?ABY.HZ[x]:523,(ABY.LEAD+j*(R.v+ABY.GAP))/1000,R.t=='l'?.32:.12]))}catch(e){}
   if(play)AG.to=setTimeout(()=>{if(AG.sk===K&&!AG.sent){AG.sent=1;try{gs({seen:1})}catch(e){}}},T+150)}
  const e=Date.now()-AG.st,dvs=(g.dn||[]).filter(p=>p!=m);
  return{html:`<div class="card c abcard">${this.top(R,'abS',dv)}${this.stage(R,v,e)}
   ${play?`<p class="abok" data-gan style="animation-delay:${((T-e)/1000).toFixed(2)}s">✓ ${GT('abSeen')}</p>`:''}${dvs.length?`<p class="abdvs">🤿 ${GT('abDvs',{n:dvs.map(B).join(', ')})}</p>`:''}${this.crew(s,g,m,1)}</div>`,
   ...(play&&!g.done[m]?{hint:GT('abWatch'),mine:false}:{})}},
 recV(s,g,m){const R=ABY.R[g.r],q=(g.q||{})[m],K=s.gid+'.'+g.k,dv=(g.dn||[]).includes(m);
  if(!q)return{html:`<div class="card c">${this.top(R,'abA')}${this.crew(s,g,m,1)}</div>`};
  if(AG.ak!==K){AG.ak=K;AG.t0=Date.now();AG.a=((g.ans||{})[m]||[]).slice();AG.fl=null}
  const A=AG.a,need=q.m,seq=R.t=='e'||R.t=='r'||R.t=='l',it=x=>R.t=='l'?abM(x):ABY.PL[x];
  let body;
  if(seq){const hit=AG.fl&&Date.now()-AG.fl.t<450?AG.fl.c:-1;
   body=`<div class="abslots">${[...Array(need).keys()].map(j=>A[j]!=null?`<span class="absl f">${it(A[j])}</span>`:`<span class="absl ${j==A.length?'nx':''}"><small dir="ltr">${j+1}</small></span>`).join('')}</div>
    ${R.t=='l'?`<div class="abgl abpick" dir="ltr">${[...Array(9).keys()].map(c=>`<button class="abln ${c==hit?'hit':''}" data-abp="${c}" aria-label="${c+1}" ${A.length>=need?'disabled':''}></button>`).join('')}</div>`
     :`<div class="abpal">${q.pal.map(x=>`<button data-abp="${x}" ${A.length>=need?'disabled':''}>${ABY.PL[x]}</button>`).join('')}</div>`}
    <div class="abctl"><button class="ghost" data-abu="1" ${A.length?'':'disabled'} aria-label="⌫">⌫</button><button class="ghost" data-abu="0" ${A.length?'':'disabled'}>${GT('abClr')}</button></div>`}
  else if(R.t=='c')body=`<div class="abgc abpick" dir="ltr">${q.alt.map((x,c)=>`<button class="abcl ${A.includes(c)?'sel':''}" data-abt="${c}" aria-pressed="${A.includes(c)}">${x>=0?ABY.PL[x]:''}</button>`).join('')}</div><p class="abcnt" dir="ltr">${A.length} / ${need}</p>`;
  else body=`<div class="abpal abcand">${q.cand.map(x=>`<button class="${A.includes(x)?'sel':''}" data-abt="${x}" aria-pressed="${A.includes(x)}">${ABY.PL[x]}</button>`).join('')}</div><p class="abcnt" dir="ltr">${A.length} / ${need}</p>`;
  const put=a=>{AG.a=a;render();gs({a,ms:Date.now()-AG.t0})};
  return{html:`<div class="card c abcard">${this.top(R,'abA',dv)}${body}${this.crew(s,g,m,1)}</div>`,
   bind(){$$('[data-abp]').forEach(b=>b.onclick=()=>{const x=+b.dataset.abp;if(AG.a.length>=need)return;if(R.t=='l'){AG.fl={c:x,t:Date.now()};if(typeof tone=='function')try{tone([[ABY.HZ[x],0,.25]])}catch(e){}}put([...AG.a,x])});
    $$('[data-abu]').forEach(b=>b.onclick=()=>put(b.dataset.abu=='1'?AG.a.slice(0,-1):[]));
    $$('[data-abt]').forEach(b=>b.onclick=()=>{const x=+b.dataset.abt;let a=AG.a.includes(x)?AG.a.filter(y=>y!=x):[...AG.a,x];if(a.length>need)a=a.slice(-need);put(a)})}}},
 /* révélation : la bonne réponse (de MA version), ma réponse, puis tout le monde ; et la prochaine épreuve */
 revV(s,g,m){const R=ABY.R[g.r],X=g.res||{p:{}},me=X.p[m],v=me&&me.dv?X.D:X.B;let h='';
  if(!v)return{html:''};
  if(R.t=='e'||R.t=='r'||R.t=='l'){const tg=R.t=='r'?v.s.slice().reverse():v.s,it=x=>R.t=='l'?abM(x):abC(x);
   h=`<p class="gpre">${GT('abAns')}</p><div class="abrow">${tg.map((x,j)=>`<span class="abrc ga" ${dl(j)}>${it(x)}</span>`).join('')}</div>`+
    (me?`<p class="gpre">${GT('abMine')}</p><div class="abrow">${me.a.length?me.a.map((x,j)=>`<span class="abrc ga ${me.mk[j]?'ok':'no'}" ${dl(j,.3)}>${it(x)}</span>`).join(''):`<span class="mut">${GT('abNone')}</span>`}</div>`:'')}
  else if(R.t=='c')h=`<div class="abgc abrv" dir="ltr">${v.alt.map((x,c)=>{const ch=v.ch.includes(c),pk=me&&me.a.includes(c);
   return `<span class="abcl ${ch?'chg':''} ${pk?(ch?'ok':'no'):''}">${ch?`<small>${v.sc[c]>=0?ABY.PL[v.sc[c]]:'·'}</small><i>›</i>`:''}${x>=0?ABY.PL[x]:ch?'·':''}</span>`}).join('')}</div>`;
  else h=`<div class="abpal abrv">${v.cand.map(x=>{const xi=v.x.includes(x),pk=me&&me.a.includes(x);return `<span class="abrc ${xi?'chg':''} ${pk?(xi?'ok':'no'):''}">${ABY.PL[x]}</span>`}).join('')}</div>`;
  const msg=me?(me.fail?`<p class="abmsg no ga" ${dl(3)}>🤿 ${GT('abFail')}</p>`:me.perf?`<p class="abmsg ok ga" ${dl(3)}>✨ ${GT('abPerf')}</p>`:''):'';
  const rows=[...s.order].sort((a,b)=>(g.sc[b]||0)-(g.sc[a]||0)).map((p,i)=>{const r=X.p[p]||{c:0,N:0,pts:0};
   return `<div class="abrr ga ${p==m?'me':''}" ${dl(i,.4)}>${DT(p)}<b class="abnm">${p==m?esc(GT('me')):esc(p)}</b>${r.dv?'<span>🤿</span>':''}${r.perf?'<span>✨</span>':''}<span class="abac" dir="ltr">${r.c}/${r.N}</span><span class="abpt ${r.pts?'':'z'}" dir="ltr">+${r.pts}</span><b class="abto" dir="ltr">${g.sc[p]||0}</b></div>`}).join('');
  const nr=ABY.R[g.r+1];
  return{html:`<div class="card c abcard">${this.top(R,'abA',me&&me.dv)}${h}${msg}<div class="abres">${rows}</div>
   ${nr?`<p class="gpre abnxh">${GT('abNx')}</p>${this.nx(nr)}${this.dive(s,g,m)}`:''}</div>`,
   bind(){$$('[data-abdv]').forEach(b=>b.onclick=()=>gs({dv:+b.dataset.abdv}));if(me&&me.perf&&!RM()&&GV.abp!=='abp'+s.gid+g.k){GV.abp='abp'+s.gid+g.k;try{sparkles($('.abmsg'),12)}catch(e){}}}}},
 view(s){const g=s.game,m=meN();
  if(g.st=='p')return{html:`<div class="card c abcard"><div class="gbig ga gfloat">🫧</div><p class="gpre">${GT('abNx')}</p>${this.nx(ABY.R[g.r])}${this.crew(s,g,m)}</div>`,
   bind(){$$('[data-abdv]').forEach(b=>b.onclick=()=>gs({dv:+b.dataset.abdv}))}};
  if(g.st=='s')return this.showV(s,g,m);
  if(g.st=='a')return this.recV(s,g,m);
  return this.revV(s,g,m)},
 endView(s){const g=s.game,m=meN();
  return `${g.tb?`<p class="gnote ga">⚡ ${GT('abTb',{n:B(g.tb)})}</p>`:''}<div class="abres abfin">${[...s.order].sort((a,b)=>(g.sc[b]||0)-(g.sc[a]||0)).map((p,i)=>
   `<div class="abrr ga ${p==m?'me':''}" ${dl(i,.3)}>${DT(p)}<b class="abnm">${esc(p)}</b><span class="abac" dir="ltr">✨ ${g.pf[p]||0} · 🤿 ${g.dok[p]||0}/${g.du[p]||0}</span><b class="abto" dir="ltr">${g.sc[p]||0}</b></div>`).join('')}</div>
   <p class="mut cqlg">✨ ${GT('abPf')} · 🤿 ${GT('abDk')}</p>`}};
/* 🫧 tutoriel : créatures qui passent, réponses simultanées, points partiels, épreuves, plongée profonde */
const tuAb3=()=>[0,1,2].map(i=>TU.e(60+90*i,152,TU.av(i))).join('');
GAMES.aby.tut=[
 {k:'tu_aby1',d:6,s:()=>'<i class="tcave"></i>'+['🐙','🦀','🪼'].map((x,i)=>TU.e(150,66,x,.3+1.1*i,'p big o','--o:'+(1.2+1.1*i).toFixed(1)+'s')).join('')+[0,1,2].map(i=>TU.e(130+20*i,128,'<i class="tudt"></i>',.3+1.1*i,'p')).join('')},
 {k:'tu_aby2',d:6,s:()=>tuAb3()+[0,1,2].map(i=>['🐙','🦀','🪼'].map((x,j)=>TU.e(60+90*i+(j-1)*28,108,x,.4+.5*j+.15*i,'p')).join('')).join('')+TU.e(150,36,'👆🏻',.2,'p big')},
 {k:'tu_aby3',d:6,s:()=>TU.e(150,26,TU.cd('🐙 🦀 🪼 🐡','ok'),0,'p')+TU.e(80,150,TU.av(0))+TU.e(220,150,TU.av(1))+TU.e(80,98,TU.cd('🐙 🦀 🪼 🐡'),.4,'p')+TU.e(220,98,TU.cd('🐙 <s>🐠</s> 🪼 🐡'),.7,'p')+TU.e(80,62,TU.pt('+5'),1.5,'p')+TU.e(220,62,TU.pt('+3'),1.8,'p')},
 {k:'tu_aby4',d:6,s:()=>[['↩️','🪼 🦀 🐙'],['✨','💡💡'],['🔍','🐙 › 🦈'],['👀','🐢 ?']].map(([a,b],i)=>TU.e(45+70*i,70,'<span class="tuab">'+a+'</span>',.2+.4*i,'p big')+TU.e(45+70*i,124,TU.cd(b,'sm2'),.5+.4*i,'p')).join('')},
 {k:'tu_aby5',d:7,s:()=>TU.e(80,150,TU.av(0))+TU.e(80,104,'🤿',.3,'p big')+TU.e(150,40,TU.cd('🐙 🦀 🪼 <b>🐡 🦈</b>'),.8,'p')+TU.e(220,96,TU.pt('×1½'),1.8,'p')+TU.e(220,132,TU.pt('&lt;½ → 0','no'),3,'p')},
 {k:'tu_aby6',x:'2',s:()=>TU.e(80,150,TU.av(0))+TU.e(220,150,TU.av(1))+TU.e(80,104,'🥇',.3,'p')+TU.e(220,104,'🤿',.8,'p big')+TU.e(220,62,TU.cd('🫧🫧🫧'),1.3,'p')}];
if(typeof document!='undefined'){const c=document.createElement('style');c.id='aby-css';c.textContent=`
.abcard{--abA:#0d2a45;--abB:#04101e;--abG:#7ff3e0}
.abhd{display:flex;align-items:center;justify-content:center;gap:8px;font:600 18px Fredoka,Nunito,sans-serif;color:var(--deep)}
.abti{font-size:22px;line-height:1}.abdvt{font:800 12px Nunito;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,var(--ink) 18%,transparent);color:var(--ink)}
.abins{font:700 14px Nunito;color:var(--mut);margin:2px 0 10px}
.abs{position:relative;height:200px;border-radius:20px;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,var(--abA),var(--abB));box-shadow:inset 0 0 0 2px #ffffff14,inset 0 -30px 60px #0008;isolation:isolate}
.abb{position:absolute;bottom:-14px;inset-inline-start:18%;width:8px;height:8px;border-radius:50%;border:1.5px solid #bfefff55;animation:abBub 7s linear infinite}
.abb.b2{inset-inline-start:72%;width:6px;height:6px;animation-duration:9s;animation-delay:-3s}.abb.b3{inset-inline-start:46%;width:5px;height:5px;animation-duration:11s;animation-delay:-6s}
@keyframes abBub{to{transform:translateY(-230px)}}
.abcd{position:absolute;inset:0;display:grid;place-items:center;opacity:0;animation-name:abCd;animation-fill-mode:both;animation-timing-function:ease-in}
.abcd b{font-size:34px;width:74px;height:74px;display:grid;place-items:center;border-radius:50%;box-shadow:0 0 0 3px #7ff3e066,0 0 24px #7ff3e033}
@keyframes abCd{0%{opacity:0;transform:scale(1.2)}15%{opacity:1;transform:none}80%{opacity:1;transform:scale(.9)}100%{opacity:0;transform:scale(.6)}}
.abit{position:absolute;inset:0 0 22px;display:grid;place-items:center;opacity:0;animation-name:abIt;animation-fill-mode:both;animation-timing-function:ease-out;pointer-events:none}
.abit b{font-size:66px;line-height:1;filter:drop-shadow(0 0 14px #7ff3e055)}
@keyframes abIt{0%{opacity:0;transform:translate(var(--x),var(--y)) scale(.55)}14%{opacity:1;transform:translate(var(--x),var(--y)) scale(1)}84%{opacity:1;transform:translate(var(--x),var(--y)) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1.08)}}
.abdots{position:absolute;inset-inline:0;bottom:10px;display:flex;justify-content:center;gap:6px}
.abdots i{width:8px;height:8px;border-radius:50%;background:var(--abG);opacity:.22;animation:abDot .25s ease-out both}
@keyframes abDot{from{opacity:.22;transform:scale(.7)}to{opacity:.95;transform:none}}
.abgl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:min(156px,62%);margin:0 auto}
.abs .abgl{position:absolute;inset:16px 0 auto;margin:0 auto}
.abln{position:relative;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#2b5878,#123048);box-shadow:inset 0 0 0 2px #ffffff12;display:block;padding:0;border:0;min-width:0}
.abfl{position:absolute;inset:-3px;border-radius:50%;background:radial-gradient(circle,#fff 0,#b6fff2 30%,#4fe0c8 60%,#4fe0c800 72%);opacity:0;animation-name:abFl;animation-fill-mode:both;animation-timing-function:ease-out}
@keyframes abFl{0%{opacity:0;transform:scale(.6)}15%{opacity:1;transform:scale(1.08)}82%{opacity:1;transform:none}100%{opacity:0;transform:scale(.9)}}
.abgc{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:min(280px,100%);margin:0 auto}
.abs .abgc{position:absolute;inset:14px 0 auto;margin:0 auto;width:min(250px,86%)}
.abshow{opacity:0;animation-name:abScn;animation-fill-mode:both;animation-timing-function:linear}
@keyframes abScn{0%{opacity:0;transform:scale(.97)}6%{opacity:1;transform:none}94%{opacity:1}100%{opacity:0}}
.abcl{position:relative;aspect-ratio:1.25;display:grid;place-items:center;border-radius:12px;background:#ffffff0d;box-shadow:inset 0 0 0 1.5px #ffffff14;font-size:28px;line-height:1;padding:0;min-width:0}
.abok{font:700 13px Nunito;color:var(--ink);margin:8px 0 0;opacity:0;animation:abIn .4s ease-out both}
@keyframes abIn{from{opacity:0;transform:translateY(6px)}}
.abdvs{font-size:12.5px;color:var(--mut);margin:6px 0 0}
.abcr{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:12px}
.abm{position:relative;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1.5px solid var(--edge);border-radius:99px;background:var(--paper2);font-size:13px;max-width:100%}
.abm.me{border-color:var(--acc)}.abm b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:9em}.abm em{font:600 13px Fredoka,Nunito,sans-serif;font-style:normal;color:var(--ink)}.abm i{font-style:normal}
.abslots{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:2px 0 12px;min-height:46px}
.absl{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;border:2px dashed var(--edge);font-size:26px;line-height:1;color:var(--mut)}
.absl small{font:700 12px Nunito;opacity:.6}.absl.nx{border-color:var(--acc)}
.absl.f{border-style:solid;border-color:color-mix(in srgb,var(--acc) 55%,var(--edge));background:var(--paper2);animation:abPop .25s var(--gease) both}
@keyframes abPop{from{transform:scale(.6);opacity:.3}}
.abpal{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:340px;margin:0 auto}
.abpal button,.abpal .abrc{font-size:30px;line-height:1;padding:9px 0;border-radius:14px;min-width:0;height:auto}
.abpal button:disabled{opacity:.45}
.abcand button.sel,.abgc button.sel{outline:3px solid var(--acc);outline-offset:1px}
.abpick.abgl{width:min(210px,66%)}.abpick .abln{cursor:pointer;transition:transform .15s var(--gease)}.abpick .abln:not(:disabled):active{transform:scale(.9)}
.abpick .abln.hit::after{content:'';position:absolute;inset:-3px;border-radius:50%;background:radial-gradient(circle,#fff 0,#b6fff2 30%,#4fe0c8 60%,#4fe0c800 72%);animation:abHit .45s ease-out both}
@keyframes abHit{from{opacity:1}to{opacity:0;transform:scale(1.15)}}
.abpick .abln:disabled{opacity:.6}
.abpick.abgc,.abrv.abgc{padding:10px;border-radius:18px;background:radial-gradient(120% 90% at 50% 0%,var(--abA),var(--abB))}
.abpick .abcl{cursor:pointer;border:0;color:inherit}
.abctl{display:flex;gap:8px;justify-content:center;margin-top:10px}.abctl button{padding:7px 16px;font-size:15px}
.abcnt{font:700 13px Nunito;color:var(--mut);margin:8px 0 0}
.abmg{display:inline-grid;grid-template-columns:repeat(3,1fr);gap:2px;width:26px;height:26px;vertical-align:middle}
.abmg b{border-radius:50%;background:color-mix(in srgb,var(--mut) 30%,transparent)}.abmg b.on{background:#2fc7ae;box-shadow:0 0 5px #4fe0c8}
.abrow{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:4px 0 10px}
.abrc{display:inline-grid;place-items:center;min-width:42px;height:42px;padding:0 4px;border-radius:12px;background:var(--paper2);border:2px solid var(--edge);font-size:24px;line-height:1}
.abrc.ok{border-color:var(--ink);background:color-mix(in srgb,var(--ink) 14%,var(--paper2))}.abrc.no{border-color:var(--bad);opacity:.7}
.abrc.chg{box-shadow:0 0 0 3px #f2c94c}
.abc{display:inline-block;line-height:1}
.abrv .abcl{font-size:24px}.abrv .abcl small{font-size:13px;opacity:.75;position:absolute;top:3px;inset-inline-start:4px}.abrv .abcl i{position:absolute;top:2px;inset-inline-start:21px;font-size:11px;font-style:normal;color:#f2c94c}
.abrv .abcl.chg{box-shadow:inset 0 0 0 2.5px #f2c94c}.abrv .abcl.ok{box-shadow:inset 0 0 0 3px #4fe0c8}.abrv .abcl.no{box-shadow:inset 0 0 0 3px var(--bad)}
.abmsg{font:600 17px Fredoka,Nunito,sans-serif;margin:4px 0 8px}.abmsg.ok{color:var(--ink)}.abmsg.no{color:var(--bad)}
.abres{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.abrr{display:flex;align-items:center;gap:7px;padding:6px 10px;border-radius:12px;background:var(--paper2);font-size:13.5px;text-align:start;min-width:0}
.abrr.me{outline:2px solid var(--acc)}.abnm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.abac{color:var(--mut);font-weight:700;font-size:12px}.abpt{font:700 13px Nunito;color:var(--ink);min-width:2.2em;text-align:end}.abpt.z{color:var(--mut)}
.abto{font:600 18px Fredoka,Nunito,sans-serif;color:var(--deep);min-width:1.6em;text-align:end}
.abnxh{margin-top:16px}
.abnx{display:flex;align-items:center;gap:10px;justify-content:center;text-align:start;padding:8px 14px;border-radius:14px;background:var(--paper2);margin:6px auto 0;width:fit-content;max-width:100%}
.abnx .abti{font-size:26px}.abnx b{display:block;font:600 16px Fredoka,Nunito,sans-serif}.abnx small{display:block;font-size:12.5px;color:var(--mut)}
.abdvb{display:flex;align-items:center;gap:10px;width:100%;max-width:380px;margin:10px auto 0;padding:10px 12px;text-align:start;border-radius:16px}
.abdvb .abdvi{font-size:26px}.abdvx{flex:1;min-width:0}.abdvx b{display:block;font-size:15px}.abdvx small{display:block;font-size:12px;color:var(--mut);font-weight:600}
.abtk{font-size:13px;letter-spacing:-1px;white-space:nowrap}
.abdv0{font-size:12.5px;color:var(--mut);margin:10px 0 0}
.tudt{display:block;width:8px;height:8px;border-radius:50%;background:#4fe0c8;box-shadow:0 0 6px #4fe0c8}
.tuab{font-size:28px}
[data-theme=dark] .abcard{--abA:#0f3150;--abB:#020a14}
[data-theme=dark] .abdvt{color:#7ff3e0}
@media (max-width:420px){.abs{height:184px}.abit b{font-size:58px}.abpal{gap:6px}.abpal button,.abpal .abrc{font-size:26px;padding:8px 0}.absl{width:38px;height:38px;font-size:22px}.abcl{font-size:24px}.abrc{min-width:36px;height:36px;font-size:20px}.abmg{width:22px;height:22px}}
@media (prefers-reduced-motion:reduce){.abb{display:none}.abit,.abfl,.abcd,.abshow{animation-name:abItR}.abdots i,.absl.f,.abok,.abpick .abln.hit::after{animation-duration:.01s}}
@keyframes abItR{0%,100%{opacity:0}2%,96%{opacity:1}}
`;(document.head||document.documentElement).appendChild(c)}
/* /🫧 */

/* 🫧 textes de Mémoire des abysses (9 langues) ; abT/abS/abA : listes alignées sur ABY.TY (Écho, Reflux, Lucioles, Changement, Intrus) */
const GAB=(l,o)=>Object.assign(GI18N[l].ui,o);
GAB('fr',{n_aby:`Mémoire des abysses`,d_aby:`Retenir créatures et lumières, tous en même temps`,
r_aby:`Des créatures et des lumières passent dans l'abysse : retiens-les, puis tout le monde répond en même temps. Chaque élément juste rapporte, sans faute +1. Les épreuves changent : à l'envers, ce qui a changé, l'intrus. 🤿 Plongée profonde (2 fois, seulement si tu n'es pas en tête) : +2 éléments, points ×1,5 si au moins la moitié est juste, sinon 0.`,
r_aby2:`À deux, c'est un duel de mémoire : l'abysse montre, vous répondez en même temps. Chaque élément juste rapporte, sans faute +1. 🤿 Plongée profonde (3 fois chacun, pas quand tu mènes) : +2 éléments, points ×1,5 si au moins la moitié est juste, sinon 0.`,
abT:`Écho|Reflux|Lucioles|Le changement|L'intrus`,abS:`Retiens l'ordre|Retiens l'ordre, tu le rendras à l'envers|Retiens les lumières dans l'ordre|Retiens le décor|Retiens qui passe`,
abA:`Dans le même ordre|À l'envers : du dernier au premier|Les lumières, dans l'ordre|Touche ce qui a changé ({v})|Qui n'est jamais passé ? ({v})`,abN:`{v} à retenir`,
abSeen:`Mémorisé ! On attend les autres…`,abWatch:`Regarde bien : l'abysse ne montre qu'une fois`,abClr:`Effacer`,abDv:`Plongée profonde`,abDvD:`+2 éléments · ×1,5 si au moins {k} sur {n} sont justes, sinon 0`,
abDvL:`En tête : pas de plongée profonde`,abDv0:`Plus de plongée profonde`,abDvs:`En plongée profonde : {n}`,abNx:`Prochaine épreuve`,abAns:`La bonne réponse`,abMine:`Ta réponse`,
abPerf:`Sans faute !`,abFail:`Plongée ratée : moins de la moitié, 0 cette fois`,abNone:`pas de réponse`,abTb:`Égalité en tête : {n} a répondu le plus vite (+1)`,abPf:`sans-faute`,abDk:`plongées profondes réussies`,
tu_aby1:`Des créatures passent une à une dans l'abysse. Retiens-les dans l'ordre : elles ne passent qu'une fois.`,
tu_aby2:`Puis tout le monde répond en même temps, en touchant les créatures dans l'ordre. On peut corriger jusqu'à la fin.`,
tu_aby3:`Chaque créature à sa place rapporte 1 : un oubli ne coûte qu'un point. Sans faute : +1 en plus.`,
tu_aby4:`Les épreuves changent : à l'envers, des lumières, ce qui a changé dans un décor, l'intrus jamais passé.`,
tu_aby5:`🤿 Plongée profonde, quelques fois par partie, seulement si tu n'es pas en tête : +2 éléments, points ×1,5 si au moins la moitié est juste, sinon 0.`,
tu_aby6:`À deux : 3 plongées chacun. Qui mène ne peut pas plonger : le duel se rattrape.`,
lg_abyP:`{a} n'a presque rien oublié dans les abysses`,lg_abyD:`{a} a réussi deux plongées profondes`,lg_abyC:`{a} est {g.a:remonté|remontée|remonté·e} de la dernière place jusqu'à la victoire dans les abysses`});
GAB('en',{n_aby:`Memory of the Deep`,d_aby:`Remember creatures and lights, all at once`,
r_aby:`Creatures and lights pass through the deep: remember them, then everyone answers at the same time. Every right element scores, a perfect answer +1. The trials change: backwards, what changed, the odd one out. 🤿 Deep dive (twice, only when you're not in the lead): +2 elements, points ×1.5 if at least half is right, otherwise 0.`,
r_aby2:`For two, it's a memory duel: the deep shows, you both answer at once. Every right element scores, a perfect answer +1. 🤿 Deep dive (3 times each, not while you lead): +2 elements, points ×1.5 if at least half is right, otherwise 0.`,
abT:`Echo|Ebb|Fireflies|Spot the change|Odd one out`,abS:`Remember the order|Remember the order, you'll give it backwards|Remember the lights in order|Remember the scene|Remember who passes`,
abA:`In the same order|Backwards: from last to first|The lights, in order|Tap what changed ({v})|Who never passed? ({v})`,abN:`{v} to remember`,
abSeen:`Memorised! Waiting for the others…`,abWatch:`Watch closely: the deep only shows once`,abClr:`Clear`,abDv:`Deep dive`,abDvD:`+2 elements · ×1.5 if at least {k} of {n} are right, otherwise 0`,
abDvL:`In the lead: no deep dive`,abDv0:`No deep dives left`,abDvs:`Deep diving: {n}`,abNx:`Next trial`,abAns:`The right answer`,abMine:`Your answer`,
abPerf:`Perfect!`,abFail:`Dive failed: less than half, 0 this time`,abNone:`no answer`,abTb:`Tied at the top: {n} answered fastest (+1)`,abPf:`perfect rounds`,abDk:`deep dives landed`,
tu_aby1:`Creatures pass one by one through the deep. Remember them in order: they only pass once.`,
tu_aby2:`Then everyone answers at the same time, tapping the creatures in order. You can fix it until the end.`,
tu_aby3:`Each creature in its place scores 1: forgetting one only costs a point. Perfect: +1 more.`,
tu_aby4:`The trials change: backwards, lights, what changed in a scene, the odd one out that never passed.`,
tu_aby5:`🤿 Deep dive, a few times per game, only when you're not in the lead: +2 elements, points ×1.5 if at least half is right, otherwise 0.`,
tu_aby6:`For two: 3 dives each. Whoever leads can't dive, so the duel swings back.`,
lg_abyP:`{a} forgot almost nothing in the deep`,lg_abyD:`{a} landed two deep dives`,lg_abyC:`{a} climbed from last place to victory in the deep`});
GAB('es',{n_aby:`Memoria del abismo`,d_aby:`Recordar criaturas y luces, todos a la vez`,
r_aby:`Criaturas y luces pasan por el abismo: recuérdalas y luego todos responden a la vez. Cada elemento correcto puntúa, sin fallos +1. Las pruebas cambian: al revés, qué ha cambiado, el intruso. 🤿 Inmersión profunda (2 veces, solo si no vas en cabeza): +2 elementos, puntos ×1,5 si aciertas al menos la mitad, si no 0.`,
r_aby2:`A dos es un duelo de memoria: el abismo muestra y respondéis a la vez. Cada elemento correcto puntúa, sin fallos +1. 🤿 Inmersión profunda (3 veces cada uno, no cuando vas en cabeza): +2 elementos, puntos ×1,5 si aciertas al menos la mitad, si no 0.`,
abT:`Eco|Resaca|Luciérnagas|El cambio|El intruso`,abS:`Recuerda el orden|Recuerda el orden, lo darás al revés|Recuerda las luces en orden|Recuerda el decorado|Recuerda quién pasa`,
abA:`En el mismo orden|Al revés: del último al primero|Las luces, en orden|Toca lo que ha cambiado ({v})|¿Quién no ha pasado nunca? ({v})`,abN:`{v} por recordar`,
abSeen:`¡Memorizado! Esperando a los demás…`,abWatch:`Mira bien: el abismo solo lo muestra una vez`,abClr:`Borrar`,abDv:`Inmersión profunda`,abDvD:`+2 elementos · ×1,5 si aciertas al menos {k} de {n}, si no 0`,
abDvL:`En cabeza: sin inmersión profunda`,abDv0:`No quedan inmersiones profundas`,abDvs:`En inmersión profunda: {n}`,abNx:`Próxima prueba`,abAns:`La respuesta correcta`,abMine:`Tu respuesta`,
abPerf:`¡Sin fallos!`,abFail:`Inmersión fallida: menos de la mitad, 0 esta vez`,abNone:`sin respuesta`,abTb:`Empate en cabeza: {n} respondió más rápido (+1)`,abPf:`sin fallos`,abDk:`inmersiones profundas logradas`,
tu_aby1:`Las criaturas pasan una a una por el abismo. Recuérdalas en orden: solo pasan una vez.`,
tu_aby2:`Luego todos responden a la vez, tocando las criaturas en orden. Se puede corregir hasta el final.`,
tu_aby3:`Cada criatura en su sitio da 1: un olvido solo cuesta un punto. Sin fallos: +1 más.`,
tu_aby4:`Las pruebas cambian: al revés, luces, qué ha cambiado en un decorado, el intruso que nunca pasó.`,
tu_aby5:`🤿 Inmersión profunda, pocas veces por partida, solo si no vas en cabeza: +2 elementos, puntos ×1,5 si aciertas al menos la mitad, si no 0.`,
tu_aby6:`A dos: 3 inmersiones cada uno. Quien va en cabeza no puede bajar: el duelo se equilibra.`,
lg_abyP:`{a} casi no olvidó nada en el abismo`,lg_abyD:`{a} logró dos inmersiones profundas`,lg_abyC:`{a} pasó del último puesto a la victoria en el abismo`});
GAB('it',{n_aby:`Memoria degli abissi`,d_aby:`Ricordare creature e luci, tutti insieme`,
r_aby:`Creature e luci passano negli abissi: ricordale, poi tutti rispondono insieme. Ogni elemento giusto vale, senza errori +1. Le prove cambiano: al contrario, cosa è cambiato, l'intruso. 🤿 Immersione profonda (2 volte, solo se non sei in testa): +2 elementi, punti ×1,5 se almeno metà è giusta, altrimenti 0.`,
r_aby2:`In due è un duello di memoria: l'abisso mostra, rispondete insieme. Ogni elemento giusto vale, senza errori +1. 🤿 Immersione profonda (3 volte a testa, non quando sei in testa): +2 elementi, punti ×1,5 se almeno metà è giusta, altrimenti 0.`,
abT:`Eco|Risacca|Lucciole|Il cambiamento|L'intruso`,abS:`Ricorda l'ordine|Ricorda l'ordine, lo darai al contrario|Ricorda le luci in ordine|Ricorda la scena|Ricorda chi passa`,
abA:`Nello stesso ordine|Al contrario: dall'ultimo al primo|Le luci, in ordine|Tocca cosa è cambiato ({v})|Chi non è mai passato? ({v})`,abN:`{v} da ricordare`,
abSeen:`Memorizzato! Si aspettano gli altri…`,abWatch:`Guarda bene: l'abisso mostra una volta sola`,abClr:`Cancella`,abDv:`Immersione profonda`,abDvD:`+2 elementi · ×1,5 se almeno {k} su {n} sono giusti, altrimenti 0`,
abDvL:`In testa: niente immersione profonda`,abDv0:`Niente più immersioni profonde`,abDvs:`In immersione profonda: {n}`,abNx:`Prossima prova`,abAns:`La risposta giusta`,abMine:`La tua risposta`,
abPerf:`Senza errori!`,abFail:`Immersione fallita: meno della metà, 0 stavolta`,abNone:`nessuna risposta`,abTb:`Pari in testa: {n} ha risposto più in fretta (+1)`,abPf:`senza errori`,abDk:`immersioni profonde riuscite`,
tu_aby1:`Le creature passano una alla volta negli abissi. Ricordale in ordine: passano una volta sola.`,
tu_aby2:`Poi tutti rispondono insieme, toccando le creature in ordine. Si può correggere fino alla fine.`,
tu_aby3:`Ogni creatura al suo posto vale 1: una dimenticanza costa solo un punto. Senza errori: +1 in più.`,
tu_aby4:`Le prove cambiano: al contrario, luci, cosa è cambiato in una scena, l'intruso mai passato.`,
tu_aby5:`🤿 Immersione profonda, poche volte a partita, solo se non sei in testa: +2 elementi, punti ×1,5 se almeno metà è giusta, altrimenti 0.`,
tu_aby6:`In due: 3 immersioni a testa. Chi è in testa non può scendere: il duello si riequilibra.`,
lg_abyP:`{a} non ha dimenticato quasi niente negli abissi`,lg_abyD:`{a} ha completato due immersioni profonde`,lg_abyC:`{a} è {g.a:passato|passata|passato/a} dall'ultimo posto alla vittoria negli abissi`});
GAB('de',{n_aby:`Gedächtnis der Tiefe`,d_aby:`Wesen und Lichter merken, alle gleichzeitig`,
r_aby:`Wesen und Lichter ziehen durch die Tiefe: Merk sie dir, dann antworten alle gleichzeitig. Jedes richtige Element zählt, fehlerfrei +1. Die Prüfungen wechseln: rückwärts, was sich verändert hat, der Eindringling. 🤿 Tieftauchen (2-mal, nur wenn du nicht führst): +2 Elemente, Punkte ×1,5, wenn mindestens die Hälfte stimmt, sonst 0.`,
r_aby2:`Zu zweit ist es ein Gedächtnisduell: Die Tiefe zeigt, ihr antwortet gleichzeitig. Jedes richtige Element zählt, fehlerfrei +1. 🤿 Tieftauchen (je 3-mal, nicht wenn du führst): +2 Elemente, Punkte ×1,5, wenn mindestens die Hälfte stimmt, sonst 0.`,
abT:`Echo|Ebbe|Glühwürmchen|Die Veränderung|Der Eindringling`,abS:`Merk dir die Reihenfolge|Merk dir die Reihenfolge, du gibst sie rückwärts wieder|Merk dir die Lichter der Reihe nach|Merk dir das Bild|Merk dir, wer vorbeizieht`,
abA:`In derselben Reihenfolge|Rückwärts: vom letzten zum ersten|Die Lichter, der Reihe nach|Tippe an, was sich verändert hat ({v})|Wer ist nie vorbeigezogen? ({v})`,abN:`{v} zum Merken`,
abSeen:`Gemerkt! Warten auf die anderen…`,abWatch:`Schau genau hin: Die Tiefe zeigt es nur einmal`,abClr:`Löschen`,abDv:`Tieftauchen`,abDvD:`+2 Elemente · ×1,5, wenn mindestens {k} von {n} stimmen, sonst 0`,
abDvL:`In Führung: kein Tieftauchen`,abDv0:`Kein Tieftauchen mehr`,abDvs:`Beim Tieftauchen: {n}`,abNx:`Nächste Prüfung`,abAns:`Die richtige Antwort`,abMine:`Deine Antwort`,
abPerf:`Fehlerfrei!`,abFail:`Tauchgang gescheitert: weniger als die Hälfte, diesmal 0`,abNone:`keine Antwort`,abTb:`Gleichstand an der Spitze: {n} hat am schnellsten geantwortet (+1)`,abPf:`fehlerfreie Runden`,abDk:`gelungene Tieftauchgänge`,
tu_aby1:`Wesen ziehen eins nach dem anderen durch die Tiefe. Merk sie dir der Reihe nach: Sie kommen nur einmal.`,
tu_aby2:`Dann antworten alle gleichzeitig und tippen die Wesen der Reihe nach an. Korrigieren geht bis zum Schluss.`,
tu_aby3:`Jedes Wesen am richtigen Platz bringt 1: Ein vergessenes kostet nur einen Punkt. Fehlerfrei: +1 dazu.`,
tu_aby4:`Die Prüfungen wechseln: rückwärts, Lichter, was sich in einem Bild verändert hat, der Eindringling, der nie vorbeikam.`,
tu_aby5:`🤿 Tieftauchen, ein paarmal pro Partie, nur wenn du nicht führst: +2 Elemente, Punkte ×1,5, wenn mindestens die Hälfte stimmt, sonst 0.`,
tu_aby6:`Zu zweit: je 3 Tauchgänge. Wer führt, darf nicht tauchen: So holt man im Duell auf.`,
lg_abyP:`{a} hat in der Tiefe fast nichts vergessen`,lg_abyD:`{a} hat zwei Tieftauchgänge geschafft`,lg_abyC:`{a} ist in der Tiefe vom letzten Platz bis zum Sieg aufgestiegen`});
GAB('ru',{n_aby:`Память бездны`,d_aby:`Запоминать существ и огни, все одновременно`,
r_aby:`Через бездну проплывают существа и огни: запомни их, потом все отвечают одновременно. Каждый верный элемент приносит очко, без ошибок +1. Испытания меняются: задом наперёд, что изменилось, лишний. 🤿 Глубокое погружение (2 раза, только если ты не впереди): +2 элемента, очки ×1,5, если верна хотя бы половина, иначе 0.`,
r_aby2:`Вдвоём — дуэль памяти: бездна показывает, вы отвечаете одновременно. Каждый верный элемент приносит очко, без ошибок +1. 🤿 Глубокое погружение (по 3 раза, но не когда ты впереди): +2 элемента, очки ×1,5, если верна хотя бы половина, иначе 0.`,
abT:`Эхо|Отлив|Светлячки|Что изменилось|Лишний`,abS:`Запомни порядок|Запомни порядок, ответишь задом наперёд|Запомни огни по порядку|Запомни картину|Запомни, кто проплывает`,
abA:`В том же порядке|Задом наперёд: с последнего до первого|Огни, по порядку|Отметь, что изменилось ({v})|Кто ни разу не проплывал? ({v})`,abN:`запомнить: {v}`,
abSeen:`Запомнено! Ждём остальных…`,abWatch:`Смотри внимательно: бездна показывает только раз`,abClr:`Стереть`,abDv:`Глубокое погружение`,abDvD:`+2 элемента · ×1,5, если верны хотя бы {k} из {n}, иначе 0`,
abDvL:`Ты впереди: без глубокого погружения`,abDv0:`Глубоких погружений больше нет`,abDvs:`В глубоком погружении: {n}`,abNx:`Следующее испытание`,abAns:`Правильный ответ`,abMine:`Твой ответ`,
abPerf:`Без ошибок!`,abFail:`Погружение не удалось: меньше половины, в этот раз 0`,abNone:`нет ответа`,abTb:`Ничья на первом месте: {n} {g.n:ответил|ответила|ответил(а)} быстрее (+1)`,abPf:`без ошибок`,abDk:`удачные погружения`,
tu_aby1:`Существа проплывают через бездну по одному. Запомни их по порядку: они проплывают только раз.`,
tu_aby2:`Потом все отвечают одновременно, нажимая на существ по порядку. Исправлять можно до самого конца.`,
tu_aby3:`Каждое существо на своём месте приносит 1: забытое стоит лишь одного очка. Без ошибок: ещё +1.`,
tu_aby4:`Испытания меняются: задом наперёд, огни, что изменилось в картине, лишний, который не проплывал.`,
tu_aby5:`🤿 Глубокое погружение, несколько раз за игру и только если ты не впереди: +2 элемента, очки ×1,5, если верна хотя бы половина, иначе 0.`,
tu_aby6:`Вдвоём: по 3 погружения. Лидер нырять не может, поэтому дуэль выравнивается.`,
lg_abyP:`{a} почти ничего не {g.a:забыл|забыла|забыл(а)} в бездне`,lg_abyD:`{a} {g.a:совершил|совершила|совершил(а)} два удачных глубоких погружения`,lg_abyC:`{a} {g.a:поднялся|поднялась|поднялся(ась)} с последнего места до победы в бездне`});
GAB('zh',{n_aby:`深渊记忆`,d_aby:`记住生物和光点，大家同时作答`,
r_aby:`生物和光点在深渊中依次出现：记住它们，然后大家同时作答。每个正确的元素都得分，全对 +1。挑战会变化：倒序、哪里变了、找出闯入者。🤿 深潜（2 次，仅在未领先时可用）：+2 个元素，至少对一半则得分 ×1.5，否则 0。`,
r_aby2:`两人对局是一场记忆对决：深渊展示，你们同时作答。每个正确的元素都得分，全对 +1。🤿 深潜（每人 3 次，领先时不可用）：+2 个元素，至少对一半则得分 ×1.5，否则 0。`,
abT:`回声|退潮|萤火|哪里变了|闯入者`,abS:`记住顺序|记住顺序，之后倒着答|按顺序记住光点|记住画面|记住谁游过`,
abA:`按相同顺序|倒序：从最后一个到第一个|光点，按顺序|点出变化的格子（{v}）|谁从没出现过？（{v}）`,abN:`要记 {v} 个`,
abSeen:`记住了！等待其他人……`,abWatch:`看仔细：深渊只展示一次`,abClr:`清除`,abDv:`深潜`,abDvD:`+2 个元素 · 至少对 {k}/{n} 则 ×1.5，否则 0`,
abDvL:`领先中：不能深潜`,abDv0:`深潜次数已用完`,abDvs:`正在深潜：{n}`,abNx:`下一项挑战`,abAns:`正确答案`,abMine:`你的答案`,
abPerf:`全对！`,abFail:`深潜失败：不到一半，这次 0 分`,abNone:`没有作答`,abTb:`并列第一：{n} 答得最快（+1）`,abPf:`全对轮数`,abDk:`成功深潜`,
tu_aby1:`生物在深渊中一个接一个游过。按顺序记住它们：只出现一次。`,
tu_aby2:`然后大家同时作答，按顺序点选生物。结束前都可以修改。`,
tu_aby3:`每个位置正确的生物得 1 分：忘了一个只扣一分。全对：再 +1。`,
tu_aby4:`挑战会变化：倒序、光点、画面里哪里变了、从没出现过的闯入者。`,
tu_aby5:`🤿 深潜，每局几次，仅在未领先时可用：+2 个元素，至少对一半则得分 ×1.5，否则 0。`,
tu_aby6:`两人对局：每人 3 次深潜。领先者不能深潜，对决因此此消彼长。`,
lg_abyP:`{a} 在深渊里几乎什么都没忘`,lg_abyD:`{a} 成功完成了两次深潜`,lg_abyC:`{a} 在深渊里从最后一名逆袭夺冠`});
GAB('he',{n_aby:`זיכרון המעמקים`,d_aby:`לזכור יצורים ואורות, כולם בבת אחת`,
r_aby:`יצורים ואורות חולפים במעמקים: {g:זכור|זכרי|לזכור} אותם, ואז כולם עונים בו־זמנית. כל פריט נכון מזכה, בלי טעויות +1. המשימות משתנות: הפוך, מה השתנה, הזר. 🤿 צלילה עמוקה (פעמיים, רק למי שלא מוביל): +2 פריטים, נקודות ×1.5 אם לפחות חצי נכון, אחרת 0.`,
r_aby2:`בשניים זה דו־קרב זיכרון: המעמקים מראים, ושניכם עונים בו־זמנית. כל פריט נכון מזכה, בלי טעויות +1. 🤿 צלילה עמוקה (3 פעמים לכל אחד, לא למי שמוביל): +2 פריטים, נקודות ×1.5 אם לפחות חצי נכון, אחרת 0.`,
abT:`הד|שפל|גחליליות|מה השתנה|הזר`,abS:`{g:זכור|זכרי|לזכור} את הסדר|{g:זכור|זכרי|לזכור} את הסדר, התשובה הפוכה|{g:זכור|זכרי|לזכור} את האורות לפי הסדר|{g:זכור|זכרי|לזכור} את התמונה|{g:זכור|זכרי|לזכור} מי חולף`,
abA:`באותו סדר|הפוך: מהאחרון לראשון|האורות, לפי הסדר|{g:גע|געי|לגעת} במה שהשתנה ({v})|מי אף פעם לא חלף? ({v})`,abN:`{v} לזכור`,
abSeen:`בזיכרון! מחכים לאחרים…`,abWatch:`{g:הסתכל|הסתכלי|להסתכל} היטב: המעמקים מראים רק פעם אחת`,abClr:`מחיקה`,abDv:`צלילה עמוקה`,abDvD:`+2 פריטים · ×1.5 אם לפחות {k} מתוך {n} נכונים, אחרת 0`,
abDvL:`{g:מוביל|מובילה|מוביל/ה}: אין צלילה עמוקה`,abDv0:`לא נשארו צלילות עמוקות`,abDvs:`בצלילה עמוקה: {n}`,abNx:`המשימה הבאה`,abAns:`התשובה הנכונה`,abMine:`התשובה שלך`,
abPerf:`בלי טעויות!`,abFail:`הצלילה נכשלה: פחות מחצי, הפעם 0`,abNone:`אין תשובה`,abTb:`תיקו בראש: {n} {g.n:ענה|ענתה|ענה/תה} הכי מהר (+1)`,abPf:`סבבים בלי טעויות`,abDk:`צלילות עמוקות מוצלחות`,
tu_aby1:`יצורים חולפים אחד אחד במעמקים. {g:זכור|זכרי|לזכור} אותם לפי הסדר: הם חולפים רק פעם אחת.`,
tu_aby2:`ואז כולם עונים בו־זמנית ונוגעים ביצורים לפי הסדר. אפשר לתקן עד הסוף.`,
tu_aby3:`כל יצור במקומו מזכה ב־1: שכחה עולה רק נקודה. בלי טעויות: עוד +1.`,
tu_aby4:`המשימות משתנות: הפוך, אורות, מה השתנה בתמונה, הזר שאף פעם לא חלף.`,
tu_aby5:`🤿 צלילה עמוקה, כמה פעמים במשחק ורק למי שלא מוביל: +2 פריטים, נקודות ×1.5 אם לפחות חצי נכון, אחרת 0.`,
tu_aby6:`בשניים: 3 צלילות לכל אחד. מי שמוביל לא יכול לצלול, כך הדו־קרב מתאזן.`,
lg_abyP:`{a} כמעט לא {g.a:שכח|שכחה|שכח/ה} כלום במעמקים`,lg_abyD:`{a} {g.a:הצליח|הצליחה|הצליח/ה} בשתי צלילות עמוקות`,lg_abyC:`{a} {g.a:טיפס|טיפסה|טיפס/ה} מהמקום האחרון עד הניצחון במעמקים`});
GAB('pt',{n_aby:`Memória do abismo`,d_aby:`Lembrar criaturas e luzes, todos ao mesmo tempo`,
r_aby:`Criaturas e luzes passam pelo abismo: memorize-as e depois todos respondem ao mesmo tempo. Cada elemento certo pontua, sem erros +1. As provas mudam: ao contrário, o que mudou, o intruso. 🤿 Mergulho profundo (2 vezes, só se você não estiver na frente): +2 elementos, pontos ×1,5 se acertar pelo menos metade, senão 0.`,
r_aby2:`A dois é um duelo de memória: o abismo mostra e vocês respondem ao mesmo tempo. Cada elemento certo pontua, sem erros +1. 🤿 Mergulho profundo (3 vezes cada, não quando você lidera): +2 elementos, pontos ×1,5 se acertar pelo menos metade, senão 0.`,
abT:`Eco|Refluxo|Vaga-lumes|A mudança|O intruso`,abS:`Memorize a ordem|Memorize a ordem, você vai dar ao contrário|Memorize as luzes em ordem|Memorize o cenário|Memorize quem passa`,
abA:`Na mesma ordem|Ao contrário: do último ao primeiro|As luzes, em ordem|Toque no que mudou ({v})|Quem nunca passou? ({v})`,abN:`{v} para lembrar`,
abSeen:`Memorizado! Esperando os outros…`,abWatch:`Olhe bem: o abismo só mostra uma vez`,abClr:`Apagar`,abDv:`Mergulho profundo`,abDvD:`+2 elementos · ×1,5 se acertar pelo menos {k} de {n}, senão 0`,
abDvL:`Na liderança: sem mergulho profundo`,abDv0:`Sem mergulhos profundos restantes`,abDvs:`Em mergulho profundo: {n}`,abNx:`Próxima prova`,abAns:`A resposta certa`,abMine:`Sua resposta`,
abPerf:`Sem erros!`,abFail:`Mergulho falhou: menos da metade, 0 desta vez`,abNone:`sem resposta`,abTb:`Empate na liderança: {n} respondeu mais rápido (+1)`,abPf:`rodadas sem erros`,abDk:`mergulhos profundos certeiros`,
tu_aby1:`As criaturas passam uma a uma pelo abismo. Memorize-as em ordem: elas só passam uma vez.`,
tu_aby2:`Depois todos respondem ao mesmo tempo, tocando as criaturas em ordem. Dá para corrigir até o fim.`,
tu_aby3:`Cada criatura no lugar certo vale 1: um esquecimento custa só um ponto. Sem erros: +1 a mais.`,
tu_aby4:`As provas mudam: ao contrário, luzes, o que mudou num cenário, o intruso que nunca passou.`,
tu_aby5:`🤿 Mergulho profundo, poucas vezes por partida, só se você não estiver na liderança: +2 elementos, pontos ×1,5 se acertar pelo menos metade, senão 0.`,
tu_aby6:`A dois: 3 mergulhos cada. Quem lidera não pode mergulhar: o duelo se equilibra.`,
lg_abyP:`{a} quase não esqueceu nada no abismo`,lg_abyD:`{a} acertou dois mergulhos profundos`,lg_abyC:`{a} foi do último lugar à vitória no abismo`});
/* /🫧 i18n */
})();
