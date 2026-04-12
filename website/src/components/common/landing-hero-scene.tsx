"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type LandingHeroSceneProps = {
  className?: string;
};

export function LandingHeroScene({ className }: LandingHeroSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 4.5, 11);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    mountEl.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xd08a5f, 1.15);
    keyLight.position.set(8, 9, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x89a36b, 0.6);
    fillLight.position.set(-8, 5, -6);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);

    const floorGeo = new THREE.CircleGeometry(5.4, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xece9e2,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.7,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    root.add(floor);

    const ringGeo = new THREE.TorusGeometry(3.8, 0.07, 20, 120);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x3b3b3b,
      roughness: 0.2,
      metalness: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    ring.position.y = -0.35;
    root.add(ring);

    const bars = new THREE.Group();
    const barCount = 24;

    for (let i = 0; i < barCount; i++) {
      const theta = (i / barCount) * Math.PI * 2;
      const height = 0.9 + Math.abs(Math.sin(i * 1.7)) * 2.2;
      const geo = new THREE.BoxGeometry(0.25, height, 0.25);
      const mat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xd08a5f : i % 3 === 1 ? 0x89a36b : 0x3b3b3b,
        roughness: 0.35,
        metalness: 0.15,
      });
      const bar = new THREE.Mesh(geo, mat);
      const radius = 2.2 + (i % 4) * 0.35;
      bar.position.set(Math.cos(theta) * radius, -1.3 + height / 2, Math.sin(theta) * radius);
      bars.add(bar);
    }
    root.add(bars);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x345c9c, metalness: 0.25, roughness: 0.22 })
    );
    orb.position.set(0, 0.85, 0);
    root.add(orb);

    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xb65d50, metalness: 0.35, roughness: 0.2 })
    );
    orbCore.position.set(0, 0.85, 0);
    root.add(orbCore);

    const particlesCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount; i++) {
      const r = 3 + Math.random() * 2.4;
      const a = Math.random() * Math.PI * 2;
      particlePos[i * 3] = Math.cos(a) * r;
      particlePos[i * 3 + 1] = -0.8 + Math.random() * 3.2;
      particlePos[i * 3 + 2] = Math.sin(a) * r;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x7a7a7a,
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    root.add(particles);

    let raf = 0;
    let targetX = 0;
    let targetY = 0;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = mountEl.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      targetX = (x - 0.5) * 0.45;
      targetY = (y - 0.5) * 0.28;
    };

    const onResize = () => {
      if (!mountEl) return;
      const w = mountEl.clientWidth;
      const h = mountEl.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };

    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();

      root.rotation.y += 0.0018;
      bars.rotation.y -= 0.0025;
      ring.rotation.z = t * 0.35;
      particles.rotation.y = -t * 0.05;

      orb.position.y = 0.8 + Math.sin(t * 1.8) * 0.12;
      orbCore.position.y = orb.position.y;

      root.rotation.x += (targetY - root.rotation.x) * 0.045;
      root.rotation.z += (targetX - root.rotation.z) * 0.045;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    onResize();
    animate();

    mountEl.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      mountEl.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);

      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });

      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} aria-label="3D market scene" />;
}
