'use strict';
// Keep ordinary scrolling and single taps while blocking page zoom gestures.
for(const event of ['gesturestart','gesturechange','gestureend']){
 document.addEventListener(event,e=>e.preventDefault(),{passive:false});
}
document.addEventListener('touchmove',e=>{
 if(e.touches.length>1)e.preventDefault();
},{passive:false});
document.addEventListener('wheel',e=>{
 if(e.ctrlKey)e.preventDefault();
},{passive:false});
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault();
});
