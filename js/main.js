// Countdown + simple particle background + subscribe simulation
(function(){
  // Countdown
  const launch = new Date();
  launch.setMonth(launch.getMonth()+1); // default: one month from now
  const cdEl = document.getElementById('countdown');
  function updateCountdown(){
    const now = new Date();
    const diff = Math.max(0, launch - now);
    const days = Math.floor(diff/86400000);
    const hours = Math.floor((diff%86400000)/3600000);
    const mins = Math.floor((diff%3600000)/60000);
    const secs = Math.floor((diff%60000)/1000);
    cdEl.textContent = `${days}d ${String(hours).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`
  }
  updateCountdown(); setInterval(updateCountdown,1000);

  // Subscribe form handling (no backend) - show friendly message
  const form = document.getElementById('subscribe');
  const email = document.getElementById('email');
  const resp = document.getElementById('response');
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = email.value.trim();
    if(!val || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)){
      resp.textContent = 'Please enter a valid email.'; resp.style.color = '#ffb4b4'; return;
    }
    // simulate success
    resp.textContent = 'Thanks — you are on the list! We will notify you.'; resp.style.color = '#a6f0c6';
    email.value = '';
  });

  // Subtle particle background
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
  const parts = Array.from({length: Math.round((W*H)/90000)}, ()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.8+0.4,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3}))
  function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight}
  addEventListener('resize', resize);
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let p of parts){
      p.x += p.vx; p.y += p.vy;
      if(p.x < -10) p.x = W+10; if(p.x > W+10) p.x = -10;
      if(p.y < -10) p.y = H+10; if(p.y > H+10) p.y = -10;
      ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
    // Interactive card tilt
    const card = document.querySelector('.card');
    const wrap = document.querySelector('.wrap');
    if(card && wrap){
      wrap.addEventListener('mousemove', (e)=>{
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const tiltX = (dy / rect.height) * -10; // rotateX
        const tiltY = (dx / rect.width) * 10; // rotateY
        card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      });
      wrap.addEventListener('mouseleave', ()=>{ card.style.transform = ''; });
    }

    // Button ripple effect
    const btn = document.querySelector('.subscribe button');
    if(btn){
      btn.addEventListener('click', (ev)=>{
        const rect = btn.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const r = document.createElement('span');
        r.className = 'ripple'; r.style.left = (x - 8) + 'px'; r.style.top = (y - 8) + 'px';
        btn.appendChild(r);
        setTimeout(()=> r.remove(), 650);
      });
    }

    // Card items interactive hint
    document.querySelectorAll('.card-item').forEach(item=>{
      item.addEventListener('click', ()=>{
        item.animate([{transform:'translateY(0)'},{transform:'translateY(-8px)'},{transform:'translateY(0)'}],{duration:360});
      });
    });

  })();
