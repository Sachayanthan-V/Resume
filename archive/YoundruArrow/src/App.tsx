import { useEffect, useRef, useState } from 'react';
import { Arrow, Download, Mark } from './components/Icons';
import { chapters, profile, roles, stages } from './content/profile';
import { EngineSlot } from './visuals/EngineSlot';

function useEffectsPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('sv-reduce-effects'); } catch { /* optional preference */ }
      setReduced(query.matches || saved === 'true');
    };
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; }, [reduced]);
  const toggle = () => {
    const next = !reduced;
    setReduced(next);
    try { localStorage.setItem('sv-reduce-effects', String(next)); } catch { /* optional preference */ }
  };
  return [reduced, toggle] as const;
}

function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return <div className="section-label"><span>{number}</span><span className="label-line" /><span>{children}</span></div>;
}

function Navigation({ active, reduced, toggleEffects }: { active: string; reduced: boolean; toggleEffects: () => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(panel.current?.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>('a, button') ?? []);
    controls()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
      if (e.key === 'Tab') {
        const items = controls(); const first = items[0]; const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const wide = matchMedia('(min-width: 1100px)');
    const closeWide = () => { if (wide.matches) setOpen(false); };
    document.addEventListener('keydown', onKey); wide.addEventListener('change', closeWide);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); wide.removeEventListener('change', closeWide); };
  }, [open]);
  const navigate = (id: string) => {
    setOpen(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  };
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#intro" aria-label="Sachayanthan V — introduction"><Mark /><span>SACHAYANTHAN<span className="wordmark-v">.V</span></span></a>
      <nav className="desktop-nav" aria-label="Chapters">{chapters.slice(1).map(c => <a key={c.id} href={`#${c.id}`} aria-current={active === c.id ? 'location' : undefined}>{c.short}</a>)}</nav>
      <div className="header-actions"><a className="resume-link" href={profile.resume} download><span>Resume</span><Download /></a><button className="menu-toggle" ref={button} aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)}><span /><span /></button></div>
    </header>
    {open && <div className="mobile-navigation" id="mobile-navigation" ref={panel} role="dialog" aria-modal="true" aria-label="Chapter navigation"><div className="mobile-nav-top"><span className="mono">EXPLORE THE CONNECTIONS</span><button className="close-menu" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Close navigation">×</button></div><nav aria-label="Mobile chapters">{chapters.map((c, i) => <a key={c.id} href={`#${c.id}`} onClick={() => navigate(c.id)}><span className="mono">0{i + 1}</span>{c.label}<Arrow /></a>)}</nav><button className="effects-control" aria-pressed={reduced} onClick={toggleEffects}>{reduced ? 'Reduced effects on' : 'Reduce effects'}<span className="toggle-indicator" /></button></div>}
    <aside className="chapter-rail" aria-label="Chapter shortcuts">{chapters.map((c, i) => <a key={c.id} href={`#${c.id}`} aria-label={c.label} aria-current={active === c.id ? 'location' : undefined}><span className="rail-label">{c.short}</span><span className="rail-number">0{i + 1}</span></a>)}</aside>
  </>;
}

function Systems({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const groups = [
    { label: 'HR applications', apps: ['Workday', 'ADP', 'UKG', 'Dayforce', 'Greenhouse'], heading: 'People data. Connected.', text: 'Bringing employee data and application events into reliable integrations across HR platforms.', icon: 'HR' },
    { label: 'Identity systems', apps: ['IAM', 'Application connectors', 'OpenAPI'], heading: 'Identity, with context.', text: 'Building connectors and integration behavior that connect application requirements to identity workflows.', icon: 'ID' },
    { label: 'Directories', apps: ['Active Directory', 'Microsoft Entra'], heading: 'The right destination.', text: 'Connecting directory systems to the wider application landscape through reusable integration products.', icon: 'AD' },
  ];
  const current = groups[selected];
  return <section id="systems" className="section systems-section" tabIndex={-1} aria-labelledby="systems-title">
    <div className="container"><SectionLabel number="02">CONNECTED SYSTEMS</SectionLabel>
      <div className="section-heading reveal"><h2 id="systems-title">Complex systems.<br /><span className="text-muted">Clear connections.</span></h2><p>From a single connector to the engine behind it. I build the backend that makes different systems work together.</p></div>
      <div className="systems-layout">
        <div className="system-map" data-selected={hovered ?? selected}>
          <div className="map-topline mono"><span>THE INTEGRATION LAYER</span><span className="status-indicator">ILLUSTRATIVE</span></div>
          <svg className="system-paths" viewBox="0 0 640 420" fill="none" aria-hidden="true"><path className="path-0" d="M95 90H225Q245 90 245 110V180Q245 200 275 200H320"/><path className="path-1" d="M545 90H415Q395 90 395 110V180Q395 200 365 200H320"/><path className="path-2" d="M320 200V300Q320 320 345 320H510"/><circle cx="320" cy="200" r="85"/><circle cx="320" cy="200" r="120" className="outer-orbit"/></svg>
          {groups.map((g, i) => <button key={g.label} className={`map-node map-node-${i}`} aria-pressed={selected === i} onClick={() => setSelected(i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}><span className="node-icon">{g.icon}</span><span>{g.label}</span><span className="node-dot" /></button>)}
          <div className="systems-engine"><EngineSlot active={active} reduced={reduced} variant="systems" /></div>
          <div className="map-bottomline mono"><span>INPUT → TRANSFORM → CONNECT</span><span>SV / ENGINE</span></div>
        </div>
        <div className="system-explanation"><div className="mini-index mono">SELECT A CONNECTION</div><h3>{current.heading}</h3><p>{current.text}</p><div className="technology-tags">{current.apps.map(app => <span key={app}>{app}</span>)}</div><div className="system-counts"><div><strong>60<span>+</span></strong><span>Custom integrations</span></div><div><strong>13<span>+</span></strong><span>Reusable products</span></div></div><p className="caption">Individually built at Aquera. Designed for real customer requirements.</p></div>
      </div>
      <div className="expertise-row">
        {[['01', 'Core engine', 'Upgraded the engine supporting OpenAPI, connectors, and integration activities within Aquera’s product.'], ['02', 'Reusable by design', 'Moved from individual custom implementations toward generic products and templates for repeated use.'], ['03', 'Beyond the handoff', 'Worked directly with customers on implementation, acceptance testing, and production go-live.']].map(([n, title, text]) => <details key={n}><summary><span className="mono">{n}</span><h3>{title}</h3><span className="disclosure-symbol">+</span></summary><p>{text}</p></details>)}
      </div>
    </div>
  </section>;
}

function Workflow({ reduced }: { reduced: boolean }) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (selected === stages.length - 1) setPlaying(false);
      else setSelected(i => i + 1);
    }, reduced ? 2500 : 1900);
    return () => clearTimeout(timer);
  }, [playing, selected, reduced]);
  const stage = stages[selected];
  return <section id="workflow" className="section workflow-section" tabIndex={-1} aria-labelledby="workflow-title"><div className="container">
    <SectionLabel number="03">AI-DRIVEN DEVELOPMENT</SectionLabel>
    <div className="section-heading reveal"><h2 id="workflow-title">One requirement.<br /><span className="text-muted">An orchestrated workflow.</span></h2><p>I build the system around the AI: specialized skills, clear roles, and feedback that moves work forward.</p></div>
    <div className="workflow-console"><div className="console-heading"><div className="mono"><span className="connection-dot" /> THE ENGINEERING WORKFLOW</div><span className="console-badge mono">~100 SPECIALIZED SKILLS</span></div>
      <div className="workflow-stages" aria-label="Workflow stages">{stages.map((s, i) => <button key={s.title} aria-pressed={i === selected} onClick={() => { setPlaying(false); setSelected(i); }} className={`workflow-stage ${i === selected ? 'selected' : ''} ${i < selected ? 'completed' : ''}`}><span className="stage-circle"><span>{s.icon}</span></span><strong>{s.title}</strong><span className="stage-subtitle">{s.label}</span></button>)}</div>
      <div className="workflow-detail" aria-live={playing ? 'off' : 'polite'}><div><div className="mono detail-eyebrow">STAGE {stage.icon} / 06</div><h3>{stage.label}</h3><p>{stage.description}</p></div><div className="workflow-io"><div><span className="mono">INPUT</span><p>{stage.input}</p></div><span className="io-arrow">↓</span><div><span className="mono">OUTPUT</span><p>{stage.output}</p></div></div></div>
      <div className="workflow-example"><span className="mono">EXAMPLE</span><p>{stage.example}</p></div>
      <div className="console-footer"><span className="caption">Illustrative workflow · synthetic example</span><div className="playback-controls"><button onClick={() => { if (!playing && selected === 5) setSelected(0); setPlaying(!playing); }}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pause walkthrough' : 'Play walkthrough'}</button><button className="reset-button" onClick={() => { setPlaying(false); setSelected(0); }} aria-label="Reset walkthrough">↺</button></div></div>
    </div>
    <div className="workflow-note"><span className="mono">BUILT TO MULTIPLY CAPABILITY</span><p>Context skills. Design personas. Three developer personas. QA, implementation, and reporting. Each with a focused job to do.</p></div>
  </div></section>;
}

function Impact() {
  return <section id="impact" className="section impact-section" tabIndex={-1} aria-labelledby="impact-title"><div className="container">
    <SectionLabel number="04">REAL OUTCOMES</SectionLabel><div className="section-heading reveal"><h2 id="impact-title">The work matters.<br /><span className="text-muted">The outcome matters more.</span></h2><p>Engineering that reaches production, earns customer trust, and helps others build better.</p></div>
    <div className="impact-grid">{[['30+', 'Customers handled', 'From requirements to implementation.'], ['8+', 'Colleagues trained', 'Interns, developers, and experienced engineers.'], ['~5', 'Customers helped retain', 'Through requested integrations and delivery.']].map(([n, label, text]) => <div className="impact-stat reveal" key={label}><strong>{n}</strong><h3>{label}</h3><p>{text}</p></div>)}</div>
    <div className="turnaround"><div className="turnaround-intro"><span className="mono">A DIFFERENT DEVELOPMENT PACE</span><h3>Less repetitive work.<br />More forward motion.</h3><p>AI workflows changed how I approach supported integration development and QA.</p></div><div className="turnaround-comparison"><div><span className="mono">BEFORE</span><strong>6–8 <span>weeks</span></strong></div><span className="turnaround-arrow" aria-hidden="true">→</span><div><span className="mono">WITH MY WORKFLOW</span><strong>~2 <span>days</span></strong></div><p>Development and QA for integrations supported by the workflow. Customer UAT remains separate and can take several weeks.</p></div></div>
    <details className="delivery-context"><summary>Read the delivery context<span className="disclosure-symbol">+</span></summary><div><p>Previously, development and QA took approximately 1.5–2 months, with the full cycle including implementation and customer UAT averaging around four months. The two-day figure describes the engineering turnaround for supported integrations, not every customer’s end-to-end timeline.</p><p>My fastest reported customer recovery example went from development to go-live in approximately one week. Working directly with customers to deliver their requested integrations helped retain approximately five accounts.</p></div></details>
  </div></section>;
}

function Zungga() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <section id="zungga" className="section zungga-section" tabIndex={-1} aria-labelledby="zungga-title"><div className="container"><SectionLabel number="05">OUTSIDE THE DAY JOB</SectionLabel>
    <div className="zungga-layout"><div className="zungga-copy reveal"><span className="project-status mono"><span /> A PERSONAL PROJECT, IN THE WORLD</span><h2 id="zungga-title">Meet<br /><span className="zungga-word">Zungga.</span><span className="project-period">↗</span></h2><p className="project-subtitle">Big ideas. Curious minds.</p><p>An AI learning platform for children aged 8–16. A place to turn curiosity into creating, exploring, and learning with AI.</p><a className="button button-light" href={profile.zungga} target="_blank" rel="noreferrer">Visit Zungga<Arrow diagonal /><span className="sr-only"> (opens in a new tab)</span></a><details className="project-details"><summary>Explore the project<span className="disclosure-symbol">+</span></summary><p>Zungga brings my interest in AI and product building into a public learning experience. Its public platform introduces learning pathways and creative AI activities for children, with information for parents.</p><p>This showcase links to the actual product. The preview shows its public homepage; private features and usage figures are not claimed here.</p></details></div>
      <div className={`project-preview ${view}`}><div className="preview-switch" aria-label="Project preview size"><button aria-pressed={view === 'desktop'} onClick={() => setView('desktop')}>Desktop</button><button aria-pressed={view === 'mobile'} onClick={() => setView('mobile')}>Mobile</button></div><div className="browser-frame"><div className="browser-toolbar"><div className="browser-dots"><i /><i /><i /></div><span className="mono">zungga.com</span><Arrow diagonal /></div><div className={`project-image-area ${loaded ? 'loaded' : ''}`}>
      {!loaded && <div className="image-placeholder"><Mark /><span className="mono">{failed ? 'EXPLORE THE LIVE PRODUCT ↗' : 'A LITTLE CURIOSITY IS LOADING'}</span></div>}
      {!failed && <picture><source srcSet={`${import.meta.env.BASE_URL}images/zungga-${view}.webp`} type="image/webp" /><img key={view} src={`${import.meta.env.BASE_URL}images/zungga-${view}.png`} alt={`Zungga's public AI learning homepage, ${view} view`} width={view === 'desktop' ? 1440 : 390} height={view === 'desktop' ? 1080 : 844} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailed(true); }} /></picture>}
      </div></div><div className="project-caption mono"><span>AI × EDUCATION × CURIOSITY</span><span>PERSONAL PROJECT / 2026</span></div></div>
    </div>
  </div></section>;
}

function Journey({ reduced, toggleEffects }: { reduced: boolean; toggleEffects: () => void }) {
  const [copyMessage, setCopyMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyEmail() {
    try { await navigator.clipboard.writeText(profile.email); setCopyMessage('Email copied.'); }
    catch { setCopyMessage('Copy unavailable. Select the email address below or use the email link.'); }
    clearTimeout(timer.current); timer.current = setTimeout(() => setCopyMessage(''), 5500);
  }
  return <section id="journey" className="section journey-section" tabIndex={-1} aria-labelledby="journey-title"><div className="container"><SectionLabel number="06">THE JOURNEY, SO FAR</SectionLabel>
    <div className="journey-layout"><div className="journey-heading reveal"><h2 id="journey-title">Always building.<br /><span className="text-muted">Always becoming.</span></h2><p>Five years of connecting systems, learning by doing, and taking on the next challenge.</p><div className="skill-list"><span>Node.js</span><span>AWS</span><span>MongoDB</span><span>MERN</span><span>Boomi</span><span>Apigee</span></div></div><div className="timeline">{roles.map((r, i) => <article key={r.title} className={`timeline-entry ${i === 0 ? 'current' : ''}`}><div className="timeline-dot" /><span className="mono timeline-date">{r.date}</span><div className="role-company">{r.company}{i === 0 && <span className="current-tag">CURRENT</span>}</div><h3>{r.title}</h3><p>{r.text}</p><details><summary>More about this chapter<span className="disclosure-symbol">+</span></summary><p>{r.detail}</p></details></article>)}</div></div>
    <div className="contact-block"><div className="contact-top mono"><span>THE NEXT CONNECTION</span><span>LET’S MAKE IT A GOOD ONE</span></div><div className="contact-heading"><h2>Good systems start<br />with a conversation<span>.</span></h2><a className="contact-arrow" href={`mailto:${profile.email}`} aria-label="Email Sachayanthan"><Arrow diagonal /></a></div><div className="contact-bottom"><div className="email-row"><a className="email-link" href={`mailto:${profile.email}`}>{profile.email}</a><button className="copy-button" onClick={copyEmail} aria-label="Copy email address"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M15 8V4H4v11h4" stroke="currentColor" strokeWidth="1.5"/></svg></button><span className="copy-message" role="status">{copyMessage}</span></div><div className="social-links"><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn<Arrow diagonal /><span className="sr-only"> (opens in a new tab)</span></a><a href={profile.github} target="_blank" rel="noreferrer">GitHub<Arrow diagonal /><span className="sr-only"> (opens in a new tab)</span></a></div></div></div>
    <footer className="footer"><a className="footer-mark" href="#intro" aria-label="Back to introduction"><Mark /><span>BUILT WITH INTENTION.</span></a><div className="footer-meta"><span>© 2026 Sachayanthan V</span><span>Updated Sep 2026</span></div><button className="effects-control" onClick={toggleEffects} aria-pressed={reduced}>Reduce effects<span className="toggle-indicator" /></button></footer>
  </div></section>;
}

export default function App() {
  const [reduced, toggleEffects] = useEffectsPreference();
  const [active, setActive] = useState('intro');
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const target = window.innerHeight * .36;
        let id = 'intro';
        for (const c of chapters) if ((document.getElementById(c.id)?.getBoundingClientRect().top ?? Infinity) <= target) id = c.id;
        setActive(id);
        const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
        document.documentElement.style.setProperty('--page-progress', String(progress));
        frame = 0;
      });
    };
    onScroll(); addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
  }, []);
  useEffect(() => {
    if (reduced) return;
    let disposed = false; let cleanup: (() => void) | undefined;
    void import('./motion').then(({ initializeMotion }) => { if (!disposed) cleanup = initializeMotion(); });
    return () => { disposed = true; cleanup?.(); };
  }, [reduced]);
  return <>
    <Navigation active={active} reduced={reduced} toggleEffects={toggleEffects} />
    <main id="main" tabIndex={-1}>
      <section id="intro" className="hero" tabIndex={-1} aria-labelledby="hero-title"><div className="container hero-container"><div className="hero-topline mono"><span><span className="connection-dot" /> SACHAYANTHAN V / SENIOR BACKEND ENGINEER</span><span className="hero-coordinate">BASED IN INDIA · BUILDING BEYOND</span></div>
        <div className="hero-grid"><div className="hero-copy"><div className="hero-eyebrow mono">BACKEND ENGINEERING. HUMAN IMPACT.</div><h1 id="hero-title">Engineering<br />the <span>connections.</span></h1><p>I build integration engines, orchestrate AI workflows, and take customer solutions from requirements to the real world.</p><div className="hero-actions"><a className="button button-primary" href="#systems">Explore my work<Arrow /></a><a className="text-link" href={`mailto:${profile.email}`}>Let’s connect<Arrow diagonal /></a></div><div className="hero-role-tags"><span>AI-driven development</span><span>Forward deployment</span></div></div>
        <div className="hero-visual"><div className="visual-coordinate mono">FIG. 01 — THE CONNECTION CORE</div><EngineSlot active={active === 'intro'} reduced={reduced} variant="hero" /><div className="engine-caption"><span className="mono">DESIGNED TO CONNECT</span><span className="model-hint mono">MOVE TO EXPLORE ↗</span></div><span className="visual-cross cross-one">+</span><span className="visual-cross cross-two">+</span></div></div>
        <div className="hero-bottom"><div className="hero-proof"><span><strong>5+</strong> years building</span><span><strong>60+</strong> custom integrations</span><span><strong>13+</strong> reusable products</span></div><a className="scroll-cue mono" href="#systems"><span>SCROLL TO CONNECT</span><span className="scroll-line">↓</span></a></div>
      </div></section>
      <div className="expertise-strip" aria-label="Areas of expertise"><div className="container"><span>BACKEND SYSTEMS</span><i>✳</i><span>ENTERPRISE INTEGRATIONS</span><i>✳</i><span>AI ORCHESTRATION</span><i>✳</i><span>REAL-WORLD DELIVERY</span></div></div>
      <Systems active={active === 'systems'} reduced={reduced} />
      <Workflow reduced={reduced} />
      <Impact />
      <Zungga />
      <Journey reduced={reduced} toggleEffects={toggleEffects} />
    </main><div className="reading-progress" aria-hidden="true" />
  </>;
}
