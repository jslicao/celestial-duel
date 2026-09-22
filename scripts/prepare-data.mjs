import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('./stars.8.json',import.meta.url)));
const culture=JSON.parse(fs.readFileSync(new URL('./chinese.json',import.meta.url)));
const order='角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸'.split('');
const houses=order.map((name,index)=>{
  const entry=culture.constellations.find(c=>c.common_name.native===name+'宿');
  if(!entry) throw Error('Missing mansion '+name);
  return {name:name+'宿',group:['东方 · 青龙','北方 · 玄武','西方 · 白虎','南方 · 朱雀'][Math.floor(index/7)],lines:entry.lines};
});
const required=new Set(houses.flatMap(h=>h.lines.flat()));
const stars=catalog.features.filter(s=>s.properties.mag<=7.5||required.has(s.id)).map(s=>[s.id,...s.geometry.coordinates,s.properties.mag,Number(s.properties.bv)||0]);
const ids=new Set(stars.map(s=>s[0]));
for(const id of required)if(!ids.has(id))throw Error('Missing HIP '+id);
fs.writeFileSync(new URL('../dist/data/sky.json',import.meta.url),JSON.stringify({epoch:'J2000',stars,houses}));
console.log(JSON.stringify({stars:stars.length,mansions:houses.length,mansionStars:required.size}));
