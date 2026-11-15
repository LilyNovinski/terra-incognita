// IA d'Archipel : même base compétente, styles = poids différents
module.exports=function(G,W0){const AX=G.AX,AN=G.AN;
const dist=(a,b)=>{const [q1,r1]=AX[a],[q2,r2]=AX[b];return(Math.abs(q1-q2)+Math.abs(r1-r2)+Math.abs(q1+r1-q2-r2))/2};
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function worth(g,c){const k=AX[c][2];let h=Math.floor(g.r/4)+1,n=0;for(;h<=g.R;h++)if(k<=g.R-h+1)n++;return G.V(g,c)*n}
const proj=(g,p)=>{let v=g.sc[p];for(const c in g.isl)if(g.isl[c]==p)v+=worth(g,+c);return v};
const leader=(s,ex)=>{const g=s.game;let b=null,bv=-1;s.order.forEach(p=>{if(p==ex)return;const v=proj(g,p);if(v>bv){bv=v;b=p}});return b};
// prudente : évite les cases disputées, garde ses îlots ; agressive : coule, conteste le centre et le leader ;
// imitatrice : refait le type d'ordre du leader au tour précédent
const W=W0||{cautious:{raid:.6,guard:1.2,risk:.45,center:.1},aggressive:{raid:1.5,guard:.5,risk:.3,center:.5,lead:.8},copycat:{raid:1,guard:.9,risk:.35,center:.2,copy:.5}};
function score(s,p,[c,k],w){const g=s.game,ld=leader(s,p),others=s.order.filter(q=>q!=p&&g.bt[q]!=null);
 let q1=1;others.forEach(q=>{const bq=g.bt[q];const pq=bq===c?(g.isl[c]==null?.5:.2):dist(bq,c)==1?.12+.04*G.V(g,c):0;q1*=1-pq});const pc=1-q1;
 const lb=o=>o==ld?1+(w.lead||.2):1;let u;
 if(k=='b')u=worth(g,c);
 else if(k=='r'){const o=g.isl[c],back=g.bt[o]!=null&&dist(g.bt[o],c)<=1;u=w.raid*worth(g,c)*lb(o)*(back?.6:1)}
 else if(k=='g'){const th=others.some(q=>dist(g.bt[q],c)<=1);u=th?.3:-1}
 else{const o=g.isl[c];let pot=-1;
  if(o==null)pot=worth(g,c)*.6;else if(o!=p&&!G.gd(g,c))pot=w.raid*worth(g,c)*.55*lb(o);
  else if(o==p&&others.some(q=>dist(g.bt[q],c)<=1))pot=w.guard*worth(g,c)*.6;
  AN[c].forEach(d=>{if(AX[d][2]<=g.lv&&!g.rf.includes(d)&&g.isl[d]==null)pot=Math.max(pot,worth(g,d)*.35)});
  u=pot+(g.R-AX[c][2])*.3*w.center-.2}
 if(k!='g')u*=1-w.risk*pc*.8;
 // exposition : îlots laissés sans garde si le bateau finit sur c
 const pos=k=='m'?c:g.bt[p];let ex=0;for(const i in g.isl){if(g.isl[i]!=p)continue;if(dist(pos,+i)>1){const th=others.some(q=>dist(g.bt[q],+i)<=2)?.5:.12;ex+=worth(g,+i)*th}}u-=w.guard*ex*.6;
 if(w.copy){const ev=g.ev||{},lk=ev.o&&ev.o[ld]&&ev.o[ld][1];if(lk&&lk==k)u+=w.copy}
 return u+Math.random()*.6}
function choose(s,p,T,style){if(style=='random')return rnd(T)[0];const w=W[style];let best=null,bv=-1e9;T.forEach(t=>{const v=score(s,p,t,w);if(v>bv){bv=v;best=t[0]}});return best}
return {choose,styles:['random',...Object.keys(W)],worth,W}};
