(() => {
'use strict';
if (window.VCCFPhotoCropper) return;
let opened = false;
function open(file) {
  if (opened) return Promise.reject(new Error('Finish adjusting the current photo first.'));
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('Choose a JPEG, PNG, or WebP photo.'));
  if (file.size > 12*1024*1024) return Promise.reject(new Error('Choose a photo smaller than 12 MB.'));
  opened = true;
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'photo-crop-dialog';
    dialog.setAttribute('aria-labelledby','photoCropTitle');
    dialog.innerHTML = `<h2 id="photoCropTitle">Adjust your profile photo</h2><p>Drag the photo and adjust the zoom. Keep your face inside the circle for your account picture.</p><div class="photo-crop-frame"><canvas width="640" height="611" tabindex="0" aria-label="Photo position. Drag or use the arrow keys to reposition."></canvas><div class="photo-crop-guide" aria-hidden="true"></div></div><label class="photo-crop-zoom">Zoom<input type="range" min="1" max="4" step=".01" value="1" aria-label="Photo zoom"></label><div class="photo-crop-controls"><button type="button" data-crop-center>Center photo</button><button type="button" data-crop-cancel>Cancel</button><button type="button" class="btn" data-crop-apply disabled>Use this photo</button></div><div role="status" class="photo-crop-status">Loading photo…</div>`;
    document.body.appendChild(dialog);
    const canvas = dialog.querySelector('canvas'), ctx = canvas.getContext('2d');
    const zoom = dialog.querySelector('input'), apply = dialog.querySelector('[data-crop-apply]'), status = dialog.querySelector('[role=status]');
    const image = new Image();
    let url = null, scale = 1, factor = 1, dx = 0, dy = 0, pointer = null, done = false;
    const signedOut = () => finish(null);
    const finish = (value, error) => {
      if (done) return;
      done = true; opened = false; clearTimeout(timer);
      window.removeEventListener('vccf-signed-out',signedOut);
      image.onload = image.onerror = null;
      if (dialog.open) dialog.close(); dialog.remove();
      if (url) URL.revokeObjectURL(url);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(null,new Error('Could not load that photo. Try another image.')),15000);
    const draw = () => {
      if (!image.naturalWidth || done) return;
      const width = image.naturalWidth*scale*factor, height = image.naturalHeight*scale*factor;
      const left = Math.min(0,Math.max(canvas.width-width,(canvas.width-width)/2+dx));
      const top = Math.min(0,Math.max(canvas.height-height,(canvas.height-height)/2+dy));
      dx = left-(canvas.width-width)/2;dy = top-(canvas.height-height)/2;
      ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,left,top,width,height);
    };
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    dialog.querySelector('[data-crop-cancel]').onclick=()=>finish(null);
    dialog.querySelector('[data-crop-center]').onclick=()=>{dx=dy=0;factor=1;zoom.value='1';draw();};
    zoom.oninput=()=>{const next=Number(zoom.value);dx*=next/factor;dy*=next/factor;factor=next;draw();};
    canvas.onpointerdown=event=>{if(!apply.disabled){pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);}};
    canvas.onpointermove=event=>{
      if(!pointer||pointer.id!==event.pointerId)return;
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      dx+=(event.clientX-pointer.x)*canvas.width/rect.width;dy+=(event.clientY-pointer.y)*canvas.height/rect.height;
      pointer.x=event.clientX;pointer.y=event.clientY;draw();
    };
    canvas.onpointerup=canvas.onpointercancel=()=>{pointer=null;};
    canvas.onkeydown=event=>{const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!move||apply.disabled)return;event.preventDefault();dx+=move[0]*(event.shiftKey?40:10);dy+=move[1]*(event.shiftKey?40:10);draw();};
    apply.onclick=()=>{try{draw();finish(canvas.toDataURL('image/jpeg',.84));}catch(error){finish(null,new Error('Could not prepare your photo. Please try again.'));}};
    image.onload=()=>{clearTimeout(timer);scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);draw();apply.disabled=false;status.textContent='The rectangle shows your Digital ID photo. The circle shows the account picture crop.';};
    image.onerror=()=>finish(null,new Error('Could not read that photo. Try another image.'));
    window.addEventListener('vccf-signed-out',signedOut,{once:true});
    try {
      if(!ctx)throw new Error('Your browser cannot adjust photos.');
      dialog.showModal();url=URL.createObjectURL(file);image.src=url;
    } catch(error) { finish(null,error); }
  });
}
window.VCCFPhotoCropper = {open};
})();
