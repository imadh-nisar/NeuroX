/* Scroll helpers. Pure DOM, no React. Respects prefers-reduced-motion. */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fraction of the page scrolled, 0 to 1. Calls back on every animation frame. */
export function onScrollProgress(callback) {
  let frame = 0;
  const update = () => {
    frame = 0;
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    callback(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();
  return () => {
    window.removeEventListener('scroll', onScroll);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * Fades in cards in the active view as they enter the screen.
 * Returns a cleanup function that stops observing.
 */
export function revealOnScroll() {
  const targets = Array.from(
    document.querySelectorAll('.view.active .card, .view.active .priority-card, .view.active .alert-card')
  );
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-visible'));
    return () => {};
  }

  targets.forEach((t, i) => {
    if (t.classList.contains('is-visible')) return;
    t.classList.add('reveal');
    // Small stagger within each group so cards do not all arrive at once.
    t.style.transitionDelay = `${(i % 4) * 80}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach((t) => {
    if (!t.classList.contains('is-visible')) observer.observe(t);
  });
  return () => observer.disconnect();
}

/** Smoothly scrolls to the top of the page, or jumps if reduced motion is on. */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** Brings the view content into sight when a tab changes, if the user has scrolled far down. */
export function scrollToMain() {
  const main = document.getElementById('main');
  if (main && window.scrollY > 300) {
    main.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}
