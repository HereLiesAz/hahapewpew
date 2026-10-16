// Keep the failure visible when WebGL or its GPU driver is unavailable.
import('./world3d.js').catch(error => {
  const boot=document.querySelector('#boot');
  if(boot){boot.classList.remove('ready');boot.textContent='3D GRAPHICS UNAVAILABLE · WEBGL REQUIRED';}
  console.error('The wasteland failed to render:',error);
});
