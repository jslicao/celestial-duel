const music=document.querySelector('#background-music');
const button=document.querySelector('#music-toggle');
const hint=document.querySelector('#music-hint');
const preferenceKey='tianyi-background-music';
let wanted=true,pending=false,request=0;
try { wanted=localStorage.getItem(preferenceKey)!=='off'; } catch {}
music.volume=.32;

function savePreference(){
  try { localStorage.setItem(preferenceKey,wanted?'on':'off'); } catch {}
}
function sync(){
  const playing=!music.paused&&!music.ended&&!music.error;
  button.setAttribute('aria-pressed',String(playing));
  hint.textContent=playing?'关闭背景音乐':pending?'正在开启音乐':music.error?'音乐加载失败，点击重试':'开启背景音乐';
}
async function play(){
  if(!wanted||pending||!music.paused)return;
  pending=true;const current=++request;sync();
  try {
    await music.play();
    if(!wanted)music.pause();
  } catch {
    // Audible autoplay can be denied; a real user gesture retries below.
  } finally {
    if(current===request){pending=false;sync();}
  }
}
button.addEventListener('click',()=>{
  if(!music.paused||pending){
    wanted=false;pending=false;request++;music.pause();
  } else {
    wanted=true;
    if(music.error)music.load();
    void play();
  }
  savePreference();sync();
});
function unlock(event){
  if(event.target instanceof Element&&event.target.closest('#music-toggle'))return;
  if(event.type==='keydown'&&(event.repeat||event.ctrlKey||event.metaKey||!['Enter',' '].includes(event.key)))return;
  if(wanted&&!music.error)void play();
}
document.addEventListener('click',unlock);
document.addEventListener('keydown',unlock);
for(const event of ['playing','pause','ended','error'])music.addEventListener(event,sync);
sync();
if(wanted)void play();
