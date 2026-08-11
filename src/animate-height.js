const DURATION = 320;
const EASING   = 'cubic-bezier(0.4, 0, 0.2, 1)';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs `mutate()` (a DOM change that alters `el`'s natural height — e.g. a
 * hidden/expanded toggle or an innerHTML swap) and smoothly animates `el`
 * from its pre-mutation height to its post-mutation height. Falls back to an
 * instant change when the user prefers reduced motion.
 */
export function animateHeightChange(el, mutate) {
  if (prefersReducedMotion()) { mutate(); return; }

  const fromHeight = el.getBoundingClientRect().height;
  mutate();
  const toHeight = el.scrollHeight;

  if (fromHeight === toHeight) return;

  el.style.overflow  = 'hidden';
  el.style.height    = `${fromHeight}px`;
  el.style.transition = 'none';
  void el.offsetHeight; // force reflow so the start height is committed

  el.style.transition = `height ${DURATION}ms ${EASING}`;
  requestAnimationFrame(() => { el.style.height = `${toHeight}px`; });

  el.addEventListener('transitionend', function done(e) {
    if (e.target !== el || e.propertyName !== 'height') return;
    el.style.transition = '';
    el.style.height     = '';
    el.style.overflow   = '';
    el.removeEventListener('transitionend', done);
  });
}
