// Charge games.js dans node (sans DOM) pour les simulations.
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','games.js'),'utf8');
const ctx={console,Math,Date,JSON,Set,Map,Array,Object,String,Number,Promise,setTimeout,clearTimeout};
ctx.globalThis=ctx;
ctx.shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
ctx.P=n=>({name:n,online:true});ctx.esc=s=>String(s);ctx.tidy=s=>String(s||'').trim();
vm.createContext(ctx);vm.runInContext(src,ctx);
module.exports=ctx;
// moteur minimal : crée un état, lance un jeu, fait avancer les étapes
module.exports.mk=(id,names,extra)=>{const s={order:[...names],players:names.map(n=>({name:n,online:true})),gsel:id,phase:'lobby',tone:0,...(extra||{})};
 s.game={id,k:0,r:0,n:0,sc:{},done:{},rx:{}};names.forEach(n=>s.game.sc[n]=0);s.phase='game';ctx.GAMES[id].init(s);return s};
module.exports.step=s=>{const g=s.game;g.dl=0;ctx.GAMES[g.id].next(s)};
