// Simulation Archipel : node .sim/arc.js [parties]
const L=require('./load.js'),G=L.GAMES.arc,AX=G.AX,AN=G.AN;
const N=+process.argv[2]||3000;
const dist=(a,b)=>{const [q1,r1]=AX[a],[q2,r2]=AX[b];return(Math.abs(q1-q2)+Math.abs(r1-r2)+Math.abs(q1+r1-q2-r2))/2};
const rnd=a=>a[Math.floor(Math.random()*a.length)];
// perles futures d'une case si on y bâtit maintenant
function worth(g,c){const k=AX[c][2];let h=Math.floor(g.r/4)+1,n=0;for(;h<=g.R;h++)if(k<=g.R-h+1)n++;return G.V(g,c)*n}
const proj=(g,p)=>{let v=g.sc[p];for(const c in g.isl)if(g.isl[c]==p)v+=worth(g,+c);return v};
const leader=(s,ex)=>{const g=s.game;let b=null,bv=-1;s.order.forEach(p=>{if(p==ex)return;const v=proj(g,p);if(v>bv){bv=v;b=p}});return b};
function towards(g,p,T,score){let best=null,bv=-1e9;T.filter(t=>t[1]=='m').forEach(([c])=>{const v=score(c)+Math.random()*.3;if(v>bv){bv=v;best=c}});return best}
// meilleure case libre (atteignable) : valeur - distance
function goal(s,p,avoid){const g=s.game,b=g.bt[p];let best=b,bv=-1e9;
 AX.forEach((x,c)=>{if(x[2]>g.lv||g.rf.includes(c)||g.isl[c]!=null)return;let v=worth(g,c)-1.6*dist(b,c);
  if(avoid)s.order.forEach(q=>{if(q!=p&&g.bt[q]===c)v-=3});v+=Math.random()*.5;if(v>bv){bv=v;best=c}});return best}
const step1=(g,p,T,to)=>{if(to==g.bt[p])return null;return towards(g,p,T,c=>-dist(c,to))};
const A=require('./arcai.js')(G),ST=A.styles;const AI={};ST.forEach(x=>AI[x]=(s,p,T)=>A.choose(s,p,T,x));
function play(n,styles){const names=styles.map((x,i)=>'P'+i),s=L.mk('arc',names),g=s.game;
 names.forEach((p,i)=>{const edge=AX.map((x,c)=>c).filter(c=>AX[c][2]==g.R),inn=AX.map((x,c)=>c).filter(c=>AX[c][2]==g.R-1);G.act(s,p,{c:rnd(edge)});G.act(s,p,{c:rnd(inn)})});
 L.step(s);let guard=0;
 while(!g.over&&guard++<100){if(g.st=='o'){names.forEach((p,i)=>{const T=G.T(g,p);const c=AI[styles[i]](s,p,T);if(c!=null)G.act(s,p,{c})})}L.step(s)}
 return g.sc}
function stats(){for(let n=2;n<=8;n++){const seat=Array(n).fill(0),sw={},sp={},sc={};ST.forEach(x=>{sw[x]=0;sp[x]=0;sc[x]=0});let tot=0;
 for(let it=0;it<N;it++){const sty=Array.from({length:n},()=>rnd(ST)),sc_=play(n,sty),v=Object.values(sc_),mx=Math.max(...v),w=v.filter(x=>x==mx).length;
  sty.forEach((x,i)=>{const p=sc_['P'+i];sc[x]++;sp[x]+=p;if(p==mx){seat[i]+=1/w;sw[x]+=1/w}});tot+=v.reduce((a,b)=>a+b,0)/n}
 console.log(`n=${n} | sièges (victoires %, attendu ${(100/n).toFixed(1)}) : ${seat.map(x=>(x/N*100).toFixed(1)).join(' ')} | perles moy. ${(tot/N).toFixed(1)}`);
 console.log('   styles (victoire % relative à 1/n, perles moy.) : '+ST.map(x=>`${x} ${(sw[x]/sc[x]*n*100).toFixed(0)}% ${(sp[x]/sc[x]).toFixed(1)}`).join(' · '))}}
function duel(){console.log('Duels à 2 (victoires de la ligne contre la colonne, %) :');
 for(const a of ST){const row=[];for(const b of ST){let w=0;for(let i=0;i<N/3;i++){const sty=Math.random()<.5?[a,b]:[b,a],r=play(2,sty),ia=sty.indexOf(a),pa=r['P'+ia],pb=r['P'+(1-ia)];w+=pa>pb?1:pa==pb?.5:0}row.push((w/(N/3)*100).toFixed(0))}console.log(`  ${a.padEnd(10)} ${row.join(' ')}`)}}
function mirror(){// tout le monde au même style : seul le siège change
 for(const n of [3,4,6,8]){const seat=Array(n).fill(0);for(let it=0;it<N;it++){const st=rnd(ST),r=play(n,Array(n).fill(st)),v=Object.values(r),mx=Math.max(...v),w=v.filter(x=>x==mx).length;for(let i=0;i<n;i++)if(r['P'+i]==mx)seat[i]+=1/w}
  console.log(`miroir n=${n} : ${seat.map(x=>(x/N*100).toFixed(1)).join(' ')}`)}}
stats();duel();mirror();
