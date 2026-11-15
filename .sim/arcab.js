// Ablation : quel ingrédient rend un style fort ? node .sim/arcab.js n parties
const L=require('./load.js'),G=L.GAMES.arc,AX=G.AX;
const n=+process.argv[2]||4,N=+process.argv[3]||800;
const V={base:{raid:1,guard:.9,risk:.35,center:0},raid:{raid:1.6,guard:.9,risk:.35,center:0},center:{raid:1,guard:.9,risk:.35,center:.6},bold:{raid:1,guard:.9,risk:0,center:0},guard:{raid:1,guard:1.6,risk:.35,center:0},lead:{raid:1,guard:.9,risk:.35,center:0,lead:1},noguard:{raid:1,guard:.2,risk:.35,center:0}};
const A=require('./arcai.js')(G,V),ST=Object.keys(V);const rnd=a=>a[Math.floor(Math.random()*a.length)];
const sw={},sc={};ST.forEach(x=>{sw[x]=0;sc[x]=0});
for(let it=0;it<N;it++){const sty=Array.from({length:n},()=>rnd(ST)),names=sty.map((x,i)=>'P'+i),s=L.mk('arc',names),g=s.game;
 names.forEach(p=>{G.act(s,p,{c:rnd(AX.map((x,c)=>c).filter(c=>AX[c][2]==g.R))});G.act(s,p,{c:rnd(AX.map((x,c)=>c).filter(c=>AX[c][2]==g.R-1))})});L.step(s);
 while(!g.over){if(g.st=='o')names.forEach((p,i)=>G.act(s,p,{c:A.choose(s,p,G.T(g,p),sty[i])}));L.step(s)}
 const v=Object.values(g.sc),mx=Math.max(...v),w=v.filter(x=>x==mx).length;sty.forEach((x,i)=>{sc[x]++;if(g.sc['P'+i]==mx)sw[x]+=1/w})}
console.log(ST.map(x=>`${x} ${(sw[x]/sc[x]*n*100).toFixed(0)}%`).join(' · '));
