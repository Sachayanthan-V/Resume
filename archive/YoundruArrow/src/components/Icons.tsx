export function Arrow({ diagonal = false, className = '' }: { diagonal?: boolean; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function Mark({ className = '' }: { className?: string }) {
  return <svg className={className} width="34" height="32" viewBox="0 0 40 36" fill="none" aria-hidden="true"><path d="M21 5H9L3 12l13 5-7 8H1M22 12l7 17L39 5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="21" cy="5" r="2.3" fill="currentColor" /></svg>;
}
export function Download() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
export function SignatureLoader({ label = 'Connecting the details' }: { label?: string }) {
  return <div className="signature-loader" role="status"><div className="loader-mark"><Mark /><span /><span /></div><span>{label}<span className="loading-dots">…</span></span></div>;
}
