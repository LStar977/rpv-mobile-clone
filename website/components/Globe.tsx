'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const DOT_COUNT = 6500;
const RADIUS = 1.4;

function fibonacciSphere(n: number, r: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rxz = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points.push(new THREE.Vector3(Math.cos(theta) * rxz * r, y * r, Math.sin(theta) * rxz * r));
  }
  return points;
}

function DotGlobe() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => fibonacciSphere(DOT_COUNT, RADIUS), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    points.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.scale.setScalar(0.6 + Math.random() * 0.5);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current!.instanceMatrix.needsUpdate = true;
  }, [points]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.06;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DOT_COUNT]}>
      <sphereGeometry args={[0.0095, 6, 6]} />
      <meshBasicMaterial color="#D4A949" />
    </instancedMesh>
  );
}

// Inner black sphere occludes back-facing dots so the globe reads as solid.
function InnerSphere() {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS * 0.985, 48, 48]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

// Soft gold glow ring behind the globe — gives it the "lit from within" feel.
function GlowHalo() {
  return (
    <mesh position={[0, 0, -0.5]}>
      <ringGeometry args={[RADIUS * 1.05, RADIUS * 1.6, 64]} />
      <meshBasicMaterial color="#D4A949" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Globe() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <GlowHalo />
        <InnerSphere />
        <DotGlobe />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.45}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}
