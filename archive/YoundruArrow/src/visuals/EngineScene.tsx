import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Group } from 'three';

function Engine({ variant, onReady }: { variant: 'hero' | 'systems'; onReady: () => void }) {
  const group = useRef<Group>(null);
  const target = useRef({ x: .48, y: -.55, spread: 0 });
  const { invalidate, gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.closest('.hero-visual, .system-map') as HTMLElement | null;
    const pointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !host) return;
      const rect = host.getBoundingClientRect();
      target.current.x = .48 + ((e.clientY - rect.top) / rect.height - .5) * .14;
      target.current.y = -.55 + ((e.clientX - rect.left) / rect.width - .5) * .2;
      invalidate();
    };
    const reset = () => { target.current.x = .48; target.current.y = -.55; invalidate(); };
    const scroll = () => {
      const section = canvas.closest('section');
      if (!section) return;
      const rect = section.getBoundingClientRect();
      target.current.spread = Math.min(1, Math.max(0, (innerHeight * .65 - rect.top) / rect.height));
      invalidate();
    };
    host?.addEventListener('pointermove', pointer); host?.addEventListener('pointerleave', reset);
    window.addEventListener('scroll', scroll, { passive: true });
    scroll(); invalidate(); onReady();
    return () => { host?.removeEventListener('pointermove', pointer); host?.removeEventListener('pointerleave', reset); window.removeEventListener('scroll', scroll); };
  }, [gl, invalidate, onReady]);
  useFrame(() => {
    if (!group.current) return;
    const g = group.current;
    const x = target.current.x + target.current.spread * .12;
    const y = target.current.y + target.current.spread * .2;
    g.rotation.x += (x - g.rotation.x) * .12;
    g.rotation.y += (y - g.rotation.y) * .12;
    if (Math.abs(g.rotation.x - x) + Math.abs(g.rotation.y - y) > .001) invalidate();
  });
  return <group ref={group} rotation={[.48, -.55, 0]}>
    {[0, 1, 2].map(i => <group key={i} position={[0, (i - 1) * (variant === 'systems' ? .68 : .52), 0]}>
      <mesh><boxGeometry args={[2.55, .22, 2.15]} /><meshStandardMaterial color={i === 2 ? '#34485f' : '#20334c'} metalness={.7} roughness={.38} /></mesh>
      {[[-1.13, 0], [1.13, 0]].map(([x, z], j) => <mesh key={j} position={[x, .13, z]}><boxGeometry args={[.025, .014, 1.95]} /><meshBasicMaterial color="#91bfff" /></mesh>)}
      <mesh position={[0, .13, 0]}><boxGeometry args={[1.62, .05, 1.34]} /><meshStandardMaterial color="#101b2a" metalness={.4} roughness={.5} /></mesh>
      {[0, 1, 2, 3].map(n => <mesh key={n} position={[-.67 + n * .44, .12, 1.087]}><boxGeometry args={[.16, .055, .015]} /><meshBasicMaterial color={i === 2 ? '#b1d7ff' : '#467bab'} /></mesh>)}
    </group>)}
    <group position={[0, (variant === 'systems' ? .68 : .52) + .18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {[[.0, .36, -.2], [-.3, .0, .6], [.0, -.36, -.2]].map(([x,y,r], i) => <mesh key={i} position={[x,y,0]} rotation={[0,0,r]}><boxGeometry args={[.8,.08,.025]} /><meshBasicMaterial color="#a8d0ff" /></mesh>)}
      <mesh position={[.52,0,0]} rotation={[0,0,-.32]}><boxGeometry args={[.08,.87,.025]} /><meshBasicMaterial color="#a8d0ff" /></mesh>
      <mesh position={[.83,0,0]} rotation={[0,0,.32]}><boxGeometry args={[.08,.87,.025]} /><meshBasicMaterial color="#a8d0ff" /></mesh>
    </group>
    {[2.2, 2.7].map(r => <mesh key={r} rotation={[-Math.PI / 2,0,0]} position={[0,-1.15,0]}><ringGeometry args={[r, r + .012, 80]} /><meshBasicMaterial color="#294b73" transparent opacity={.6} side={2} /></mesh>)}
  </group>;
}

export default function EngineScene({ variant, onReady, onFailure }: { variant: 'hero' | 'systems'; onReady: () => void; onFailure: () => void }) {
  return <div className="engine-canvas" aria-hidden="true"><Canvas frameloop="demand" dpr={[1, 1.4]} camera={{ position: [0, 2.8, 6.6], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', onFailure, { once: true }); }}><ambientLight intensity={1.5} /><directionalLight position={[2,5,5]} intensity={3.5} color="#dcecff" /><directionalLight position={[-4,1,-2]} intensity={2.5} color="#639de2" /><Engine variant={variant} onReady={onReady} /></Canvas></div>;
}
