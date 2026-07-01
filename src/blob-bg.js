const canvas = document.getElementById('blob-bg');
const ctx = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
addEventListener('resize', resize);
resize();

// Pointer tracking — starts at a neutral position
const ptr = { x: W * 0.5, y: H * 0.38 };
addEventListener('mousemove', e => { ptr.x = e.clientX; ptr.y = e.clientY; });
addEventListener('touchmove', e => {
  ptr.x = e.touches[0].clientX;
  ptr.y = e.touches[0].clientY;
}, { passive: true });

const dark = matchMedia('(prefers-color-scheme: dark)').matches;

// Each blob: follower uses spring physics, ambients use Lissajous float
const blobs = [
  // Mouse/touch follower
  {
    x: W * 0.5, y: H * 0.38, vx: 0, vy: 0,
    r: 320,
    c: dark ? '70,175,230' : '186,240,255',
    follow: true,
  },
  // Ambient 1 — upper-left drift
  {
    r: 260,
    c: dark ? '50,130,210' : '172,218,255',
    bx: 0.18, by: 0.40,
    ax: 0.14, ay: 0.11,
    fx: 3.1e-4, fy: 2.7e-4, ph: 0,
  },
  // Ambient 2 — right side drift
  {
    r: 240,
    c: dark ? '90,110,215' : '202,224,255',
    bx: 0.80, by: 0.62,
    ax: 0.10, ay: 0.15,
    fx: 2.6e-4, fy: 3.4e-4, ph: 2.1,
  },
  // Ambient 3 — lower-centre drift
  {
    r: 210,
    c: dark ? '30,150,190' : '155,232,248',
    bx: 0.50, by: 0.80,
    ax: 0.17, ay: 0.09,
    fx: 2.2e-4, fy: 2.9e-4, ph: 4.5,
  },
];

const follower = blobs[0];

function draw(t) {
  ctx.clearRect(0, 0, W, H);

  // Gentle spring pull toward pointer (k=0.0004, damping=0.97 → slow, silky)
  follower.vx += (ptr.x - follower.x) * 4e-4;
  follower.vy += (ptr.y - follower.y) * 4e-4;
  follower.vx *= 0.97;
  follower.vy *= 0.97;
  follower.x  += follower.vx;
  follower.y  += follower.vy;

  for (const b of blobs) {
    const x = b.follow ? b.x : b.bx * W + Math.sin(t * b.fx + b.ph)       * b.ax * W;
    const y = b.follow ? b.y : b.by * H + Math.cos(t * b.fy + b.ph * 1.4) * b.ay * H;

    const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
    g.addColorStop(0,   `rgba(${b.c},1)`);
    g.addColorStop(0.45,`rgba(${b.c},0.55)`);
    g.addColorStop(1,   `rgba(${b.c},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
