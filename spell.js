/* Terra Incognita — correcteur orthographique léger (Web Worker, ou script classique en secours).
   Dictionnaire spell/<langue>.txt, chargé à la demande pour la seule langue courante : mots classés en paliers de fréquence
   (ligne « # » = palier suivant, du plus courant au plus rare), triés et codés en préfixe partagé
   (1er caractère = longueur du préfixe commun avec le mot précédent, code 48+n ; puis la fin du mot).
   Mots : FrequencyWords (Hermit Dave, d'après OpenSubtitles 2018), licence CC BY-SA 4.0.
   Messages : {lang,v} charge/remplace le dictionnaire ;
   {id,words:[…]} → {id,lang,res:{mot:suggestion|null}}  (mode « Discret » : une suggestion, mots finis fautifs)
   {id,q:[{w,cur}],n} → {id,lang,out:[{k:connu?,s:[…]}]}  (mode « Suggestions » : n propositions classées, complétion si cur) */
(function(root){
'use strict';
/* terminaisons flexionnelles (forme pliée) : un mot inconnu qui ne diffère d'un mot connu que dans sa terminaison
   est le plus souvent une conjugaison/déclinaison rare, pas une faute → on se tait (mieux vaut rater qu'importuner) */
const END={
 fr:'e es s x ee ees er ez ai as a ons ont ent ais ait aient ra ras rai rons rez ront rais rait raient iez ions ant ie ies is it ut eux euse euses ive ives ale aux elle elles ette ettes ment',
 en:'s es ed d ing er ers est ly',
 es:'o a os as e es ar er ir ad ed id amos emos imos ais eis is an en aba abas aban ia ias ian ado ada ados adas ido ida idos idas ando iendo ara aras aran are aria arian ria rian lo la le los las se me te nos selo melo telo ndo mente',
 it:'o a i e are ere ire ato ata ati ate ito ita iti ite uto uta uti ute ando endo ano ono ino iamo iate ete ra rai ranno rei rebbe rebbero lo la li le ne ci si mi ti gli glielo ssi sse mente',
 pt:'o a os as e es ar er ir ado ada ados adas ido ida idos idas ando endo indo am em ou eu iu amos emos imos ara arao aram eram iram ava avam ia iam ei ste mos lhe lo la los las se me te mente',
 de:'e en er es em n s t st et te ten tet test end ung ungen ern chen lich isch',
 ru:'а я о е ы и у ю ь й ая яя ое ее ые ие ой ей ом ем ам ям ах ях ами ями ов ев ого его ому ему ую юю им ым их ых ою ею ешь ет ете ут ют ишь ит ите ат ят ал ала ало али ил ила ило или ть ти ся сь йте вши вшись л ла ло ли ен ена ено ены ан ана ано аны нн нна нно нны ость ости остью',
 he:'ים ות ה ת ו י נו תי תם תן יה יו הם הן ך כם כן ני'};
const ENDS={};for(const l in END)ENDS[l]=[...new Set(END[l].split(' '))];
const ALPHA={ru:'абвгдежзийклмнопрстуфхцчшщъыьэюя',he:'אבגדהוזחטיכךלמםנןסעפףצץקרשת'},LATA='abcdefghijklmnopqrstuvwxyz';
/* touches voisines (fautes de frappe les plus probables) */
const ROWS={fr:['azertyuiop','qsdfghjklm','wxcvbn'],de:['qwertzuiop','asdfghjkl','yxcvbnm'],ru:['йцукенгшщзхъ','фывапролджэ','ячсмитьбю'],
 he:['קראטוןםפ','שדגכעיחלךף','זסבהנמצתץ']},QWERTY=['qwertyuiop','asdfghjkl','zxcvbnm'];
function adjOf(lang){const R=ROWS[lang]||QWERTY,m={};
 const add=(a,b)=>{if(!a||!b)return;(m[a]=m[a]||'');if(m[a].indexOf(b)<0)m[a]+=b};
 R.forEach((r,y)=>{for(let x=0;x<r.length;x++){const c=r[x];add(c,r[x-1]);add(c,r[x+1]);
  if(R[y-1]){add(c,R[y-1][x]);add(c,R[y-1][x+1])}if(R[y+1]){add(c,R[y+1][x]);add(c,R[y+1][x-1])}}});return m}
/* « pliage » : ce qui distingue à peine deux graphies (accents oubliés au téléphone, ё/е, ß/ss) */
function mkFold(lang){
 if(lang=='ru')return s=>s.replace(/ё/g,'е');
 if(lang=='he')return s=>s.replace(/[\u0591-\u05C7]/g,'');
 return s=>{s=s.normalize('NFD').replace(/[\u0300-\u036F]/g,'');if(lang=='de')s=s.replace(/ß/g,'ss');return s.replace(/œ/g,'oe').replace(/æ/g,'ae')}}
function decode(text){const words=[],tiers=[];let p='';
 for(const ln of text.split(/\r?\n/)){if(ln=='#'){tiers.push(words.length);p='';continue}if(!ln)continue;
  const w=p.slice(0,ln.charCodeAt(0)-48)+ln.slice(1);words.push(w);p=w}
 return {words,tiers}}
function Speller(lang,text){
 const fold=mkFold(lang),{words,tiers}=decode(text),exact=new Map(),best=new Map(),multi=new Map(),cache=new Map(),tierOf=new Uint8Array(words.length),F=new Array(words.length);
 for(let t=0;t<tiers.length;t++)tierOf.fill(t,tiers[t],tiers[t+1]==null?words.length:tiers[t+1]);
 for(let i=0;i<words.length;i++){const w=words[i],f=F[i]=fold(w);if(!exact.has(w))exact.set(w,i);
  if(!best.has(f))best.set(f,i);else{let l=multi.get(f);if(!l)multi.set(f,l=[best.get(f)]);if(l.length<5)l.push(i)}}
 const norm=lang=='ru'?s=>s.toLowerCase().replace(/ё/g,'е'):lang=='he'?s=>s.replace(/[\u0591-\u05C7]/g,''):s=>s.toLowerCase();
 const alpha=ALPHA[lang]||LATA,adj=adjOf(lang),known=w=>exact.has(w),VOW=lang=='ru'?'аеиоуыэюя':lang=='he'?'וי':'aeiouy';
 /* formes valides absentes de la liste : préfixes hébreux collés, mots composés allemands */
 function validish(w){
  if(lang=='he'){if(/[כמנצ]$|[ךםןףץ]./.test(w))return false;for(let i=1;i<=2&&w.length-i>=3;i++){if((i==1?'והבלמשכ':'הבלמשכ').indexOf(w[i-1])<0)break;if(known(w.slice(i)))return true}}
  if(lang=='de'&&w.length>=8){for(let i=3;i<=w.length-3;i++){const a=w.slice(0,i),b=w.slice(i);
   if(known(a)&&(known(b)||(b[0]=='s'&&b.length>3&&known(b.slice(1)))||(b.length>3&&known(b.slice(0,-1)))))return true}}
  return false}
 /* variantes à une modification, avec un coût : lettre doublée, inversion, touche voisine = fautes de frappe courantes */
 function edits(s,cb){const n=s.length;
  for(let i=0;i<n;i++)cb(s.slice(0,i)+s.slice(i+1),(s[i]==s[i-1]||s[i]==s[i+1]?.4:.8)+(i==0?.8:0));
  for(let i=0;i<n-1;i++)if(s[i]!=s[i+1])cb(s.slice(0,i)+s[i+1]+s[i]+s.slice(i+2),.6+(i==0?.5:0));
  for(let i=0;i<n;i++){const a=adj[s[i]]||'',v=VOW.indexOf(s[i])>=0;for(const c of alpha)if(c!=s[i])
   cb(s.slice(0,i)+c+s.slice(i+1),(a.indexOf(c)>=0?.6:v&&VOW.indexOf(c)>=0?.8:1)+(i==0?.8:0))}
  for(let i=0;i<=n;i++)for(const c of alpha)cb(s.slice(0,i)+c+s.slice(i),(c==s[i]||c==s[i-1]?.4:.8)+(i==0?.8:0))}
 const score=(i,cost)=>cost+.3*tierOf[i];
 function suggest(w){
  if(lang=='he'){const fx=w.replace(/[ךםןףץ](?=.)/g,c=>'כמנפצ'['ךםןףץ'.indexOf(c)]).replace(/[כמנצ]$/,c=>'ךםןףץ'['כמנפצ'.indexOf(c)]);if(fx!==w&&known(fx))return fx}/* lettres finales */
  const f=fold(w),r=best.get(f);
  if(r!=null&&words[r]!==w)return words[r];/* seul un accent / ё / ß manquait */
  let bi=-1,bs=1e9;const e1=[];
  edits(f,(c,k)=>{e1.push(c);const i=best.get(c);if(i!=null&&words[i].length>1){const s=score(i,k);if(s<bs){bs=s;bi=i}}});
  if(bi>=0)return words[bi];
  if(f.length<6||f.length>14)return null;
  const lim=tiers[4]||words.length;/* deux fautes : seulement vers un mot courant */
  for(const a of e1){if(a.length<f.length-1)continue;edits(a,(c,k)=>{const i=best.get(c);if(i!=null&&i<lim&&words[i].length>3){const s=score(i,k);if(s<bs){bs=s;bi=i}}})}
  return bi>=0?words[bi]:null}
 /* hébreu : écriture pleine / défective (ו et י en plus ou en moins) = deux graphies admises */
 const heVar=(a,b)=>a.replace(/[וי]/g,'')===b.replace(/[וי]/g,'');
 /* lettre doublée ou deux lettres inversées : c'est une faute de frappe, jamais une flexion */
 function slip(a,b){if(Math.abs(a.length-b.length)==1){const [l,s]=a.length>b.length?[a,b]:[b,a];for(let i=0;i<l.length;i++)if(l[i]!=s[i])return l[i]==l[i-1]&&l.slice(i+1)==s.slice(i);return false}
  if(a.length==b.length){let i=0;while(a[i]==b[i])i++;return a[i]==b[i+1]&&a[i+1]==b[i]&&a.slice(i+2)==b.slice(i+2)}return false}
 function inflect(w,s){const a=fold(w),b=fold(s);if(a===b||slip(w,norm(s)))return false;if(lang=='he'&&heVar(a,b))return true;
  let p=0;while(p<a.length&&p<b.length&&a[p]==b[p])p++;if(p<4)return false;const E=ENDS[lang]||[];
  return E.some(e=>a.length-e.length>=3&&a.endsWith(e)&&e.length>=a.length-p)||a.length==p&&E.some(e=>b.length-e.length>=3&&b.endsWith(e)&&e.length>=b.length-p)}
 function check(raw){
  const w=norm(raw);if(cache.has(w))return cache.get(w);
  let s=null;if(!known(w)&&!validish(w)){s=suggest(w);if(s&&(norm(s)===w||inflect(w,s)))s=null}
  if(cache.size>2000)cache.clear();cache.set(w,s);return s}
 /* ---- mode « Suggestions » : plusieurs propositions classées (coût de frappe pondéré + fréquence), complétion du mot en cours ---- */
 let sorted=null;/* index des mots triés par forme pliée, construit à la première complétion */
 function prefixRange(p){if(!sorted){sorted=Uint32Array.from(words.keys()).sort((a,b)=>F[a]<F[b]?-1:F[a]>F[b]?1:a-b)}
  let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(F[sorted[m]]<p)lo=m+1;else hi=m}return lo}
 const rcache=new Map(),TW=.35;
 function cap(raw,s){if(raw.length>1&&raw===raw.toLocaleUpperCase(lang)&&raw!==raw.toLocaleLowerCase(lang))return s.toLocaleUpperCase(lang);
  return /^\p{Lu}/u.test(raw)?s[0].toLocaleUpperCase(lang)+s.slice(1):s}
 function rank(raw,cur,n){n=n||3;const key=(cur?'1':'0')+raw;if(rcache.has(key))return rcache.get(key);
  const w=norm(raw),f=fold(w),isK=known(w)||validish(w),C=new Map(),t0=Date.now();
  const add=(i,cost)=>{if(i==null)return;const s=words[i];if(s===w||(s.length<2&&f.length>1))return;const t=tierOf[i],sc=cost+TW*t+(t>=5?.6:0);/* mots très rares : seulement s'ils collent vraiment */if(sc>3.2)return;const o=C.get(i);if(o==null||sc<o)C.set(i,sc)};
  const addF=(k,cost)=>{const l=multi.get(k);if(l)for(const i of l)add(i,cost);else add(best.get(k),cost)};
  if(lang=='he'){const fx=w.replace(/[ךםןףץ](?=.)/g,c=>'כמנפצ'['ךםןףץ'.indexOf(c)]).replace(/[כמנצ]$/,c=>'ךםןףץ'['כמנפצ'.indexOf(c)]);if(fx!==w)add(exact.get(fx),.1)}
  addF(f,.15);/* accent / ё / ß oublié : presque gratuit */
  const e1=[];edits(f,(c,k)=>{e1.push([c,k]);addF(c,k)});
  /* complétion du mot en cours : mots plus longs qui commencent pareil (accents ignorés) */
  const comp=(p,extra,lim)=>{if(p.length<2)return;let j=prefixRange(p),seen=0;
   for(;j<sorted.length&&seen<6000;j++,seen++){const i=sorted[j],g=F[i];if(g.slice(0,p.length)!==p)break;if(i>=lim||g.length===p.length)continue;
    add(i,.3+extra+.08*Math.min(g.length-p.length,8))}};
  if(cur){comp(f,0,words.length);
   if(f.length>=3&&!isK)for(const [c,k] of e1)if(c.length===f.length&&k<=.8&&Date.now()-t0<25)comp(c,k,tiers[4]||words.length)}/* préfixe avec une faute de frappe */
  /* deux fautes : vers un mot courant seulement, et si l'on manque encore de bonnes pistes */
  let good=0;for(const v of C.values())if(v<2.2)good++;
  if(good<n&&f.length>=5&&f.length<=14){const lim=tiers[4]||words.length;
   for(const [a,k1] of e1){if(a.length<f.length-1)continue;if(Date.now()-t0>40)break;edits(a,(c,k2)=>{const i=best.get(c);if(i!=null&&i<lim&&words[i].length>3)add(i,k1+k2+.2)})}}
  const out=[],seen=new Set([w]),sf=new Set();
  for(const [i] of [...C].sort((a,b)=>a[1]-b[1]||words[a[0]].length-words[b[0]].length)){const s=words[i];const l=norm(s);if(seen.has(l))continue;
   if(sf.has(F[i])&&tierOf[i]>=3)continue;/* variante d'accent rare d'un mot déjà proposé (« merçi ») */seen.add(l);sf.add(F[i]);
   const c=cap(raw,s);if(c===raw)continue;out.push(c);if(out.length>=n)break}
  const r={k:isK,s:out};if(rcache.size>1500)rcache.clear();rcache.set(key,r);return r}
 return {check,rank,size:words.length,words}}
root.TerraSpeller=Speller;
/* --- côté Worker --- */
if(typeof WorkerGlobalScope!='undefined'&&root instanceof WorkerGlobalScope){
 let cur=null,want=null,pend=null;
 const run=m=>{if(m.q){postMessage({id:m.id,lang:cur.lang,out:m.q.map(x=>cur.sp.rank(x.w,x.cur,m.n))});return}
  const res={};for(const w of m.words)res[w]=cur.sp.check(w);postMessage({id:m.id,lang:cur.lang,res})};
 onmessage=e=>{const m=e.data;
  if(m.lang!=null){if(want===m.lang)return;want=m.lang;cur=null;pend=null;
   fetch('spell/'+m.lang+'.txt?v='+(m.v||1)).then(r=>{if(!r.ok)throw 0;return r.text()}).then(t=>{if(want!==m.lang)return;
    cur={lang:m.lang,sp:Speller(m.lang,t)};postMessage({ready:m.lang});if(pend){run(pend);pend=null}},()=>{if(want===m.lang){want=null;postMessage({fail:m.lang})}});return}
  if(m.words||m.q){if(!cur)pend=m;else run(m)}}}
})(typeof self!='undefined'?self:globalThis);
