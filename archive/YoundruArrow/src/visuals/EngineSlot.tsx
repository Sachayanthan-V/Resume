import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SignatureLoader } from '../components/Icons';

const Scene = lazy(() => import('./EngineScene'));
class VisualBoundary extends Component<{ children: React.ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function EngineFallback({ variant }: { variant: 'hero' | 'systems' }) {
  return <svg className="engine-fallback" viewBox="0 0 500 440" fill="none" aria-hidden="true"><defs><linearGradient id={`core-${variant}`} x1="100" y1="80" x2="400" y2="400" gradientUnits="userSpaceOnUse"><stop stopColor="#3D5776"/><stop offset="1" stopColor="#172230"/></linearGradient></defs><g stroke="#29405B"><ellipse cx="250" cy="255" rx="197" ry="112"/><ellipse cx="250" cy="255" rx="154" ry="88"/><path d="M50 255h60m280 0h60M250 120v30m0 205v30"/></g>{[0, 1, 2].map((n) => <g key={n} transform={`translate(0 ${n * -41})`}><path d="m250 218 115 67v22l-115 66-115-66v-22Z" fill={`url(#core-${variant})`} stroke="#6586AD"/><path d="m135 285 115 66 115-66m-115 66v22" stroke="#6E91B9"/><path d="m250 242 72 42-72 42-72-42Z" fill="#101B28" stroke="#436B96"/></g>)}<path d="m218 173 30-17 24 14-26 15 26 15 24-14m-6-25 22 13 0 24" stroke="#9AC8FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="53" cy="255" r="4" fill="#88BCFF"/><circle cx="447" cy="255" r="4" fill="#88BCFF"/></svg>;
}

export function EngineSlot({ active, reduced, variant }: { active: boolean; reduced: boolean; variant: 'hero' | 'systems' }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    if (!active || reduced) { setEnabled(false); setReady(false); return; }
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const timer = setTimeout(() => setEnabled(true), 650);
    return () => clearTimeout(timer);
  }, [active, reduced]);
  return <div className={`engine-slot ${variant} ${ready && enabled && !failed ? 'scene-ready' : ''}`} ref={host}>
    <EngineFallback variant={variant} />
    {enabled && !failed && visible && <VisualBoundary onFailure={() => { setFailed(true); setReady(false); }}><Suspense fallback={<SignatureLoader label={variant === 'hero' ? 'Connecting the signature' : 'Connecting the systems'} />}><Scene variant={variant} onReady={() => setReady(true)} onFailure={() => { setFailed(true); setReady(false); }} /></Suspense></VisualBoundary>}
  </div>;
}
