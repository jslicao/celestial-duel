const dialog=document.querySelector('#pnp-dialog');
const trigger=document.querySelector('.pnp-cta');
const scroll=document.querySelector('.pnp-scroll');
trigger.addEventListener('click',()=>{
  if(dialog.open)return;
  dialog.showModal();
  scroll.scrollTop=0;
});
dialog.querySelector('.modal-close').addEventListener('click',()=>dialog.close());
function outside(event){
  const r=dialog.getBoundingClientRect();
  return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
}
let backdropDown=false;
dialog.addEventListener('pointerdown',event=>{backdropDown=event.target===dialog&&outside(event);});
dialog.addEventListener('click',event=>{
  if(backdropDown&&event.target===dialog&&outside(event))dialog.close();
  backdropDown=false;
});
dialog.addEventListener('close',()=>trigger.focus({preventScroll:true}));
