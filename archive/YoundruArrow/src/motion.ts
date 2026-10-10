import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initializeMotion() {
  gsap.registerPlugin(ScrollTrigger);
  const context = gsap.context(() => {
    document.querySelectorAll('.reveal').forEach(el => {
      gsap.from(el, { y: 24, opacity: .3, duration: .75, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 94%', once: true } });
    });
    document.querySelectorAll('.system-paths path').forEach(el => {
      gsap.fromTo(el, { strokeDasharray: 700, strokeDashoffset: 700 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '#systems', start: 'top 80%', end: 'center 55%', scrub: .6 } });
    });
    gsap.fromTo('.timeline', { '--timeline-progress': '0%' }, { '--timeline-progress': '100%', ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 75%', end: 'bottom 80%', scrub: .4 } });
  });
  return () => context.revert();
}
