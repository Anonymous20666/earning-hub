import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeSpatialHeroProps {
  className?: string;
  isCompact?: boolean;
}

export const ThreeSpatialHero: React.FC<ThreeSpatialHeroProps> = ({ className = '', isCompact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scene & Camera setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06070a, 0.08);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || (isCompact ? 280 : 420);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 5.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Helper to generate a crisp 512x512 coin face texture
    const createCoinFace = (symbol: string, color: string, badgeText: string, borderColor: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dark metallic disc surface
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, 512, 512);

        // Outer rim
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(256, 256, 226, 0, Math.PI * 2);
        ctx.stroke();

        // Precision coin milled notches
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(256, 256, 208, 0, Math.PI * 2);
        ctx.stroke();

        // Inner circular guideline
        ctx.setLineDash([]);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(256, 256, 178, 0, Math.PI * 2);
        ctx.stroke();

        // Top Currency Badge
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, 256, 128);

        // Central Primary Symbol ($ or ₦)
        ctx.fillStyle = color;
        ctx.font = '900 172px "Segoe UI", system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 256, 240);

        // Lower Brand Name
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('PAPPY EARNING HUB', 256, 362);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    // Face 1: Standard Dollar ($) Face
    const dollarTexture = createCoinFace('$', '#F59E0B', 'USD • GLOBAL LIQUIDITY', '#D97706');

    // Face 2: Standard Nigerian Naira (₦) Face
    const nairaTexture = createCoinFace('₦', '#10B981', 'NGN • INSTANT PAYOUT', '#059669');

    // Central 3D Physical Dual-Currency Coin (Standard fintech vault piece)
    const coinGeometry = new THREE.CylinderGeometry(1.7, 1.7, 0.28, 64);
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    const dollarCapMaterial = new THREE.MeshStandardMaterial({
      map: dollarTexture,
      metalness: 0.85,
      roughness: 0.22,
    });
    const nairaCapMaterial = new THREE.MeshStandardMaterial({
      map: nairaTexture,
      metalness: 0.85,
      roughness: 0.22,
    });

    // materials array: [side, top (dollar), bottom (naira)]
    const coinMesh = new THREE.Mesh(coinGeometry, [sideMaterial, dollarCapMaterial, nairaCapMaterial]);
    coinMesh.rotation.x = Math.PI / 4.2;
    coinMesh.castShadow = true;
    rootGroup.add(coinMesh);

    // Soft Ground Shadow
    const shadowGeo = new THREE.PlaneGeometry(5.5, 5.5);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -1.8;
    scene.add(shadowMesh);

    // Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const goldFill = new THREE.PointLight(0xf59e0b, 2.8, 10);
    goldFill.position.set(-3, 2, 2);
    scene.add(goldFill);

    const emeraldRim = new THREE.PointLight(0x10b981, 2.5, 10);
    emeraldRim.position.set(3, -2, -2);
    scene.add(emeraldRim);

    // Pointer interactivity
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = normX * 0.35;
      mouseRef.current.targetY = normY * 0.25;
    };

    window.addEventListener('pointermove', handlePointerMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Exponential damping for smooth cursor follow
      mouseRef.current.x = THREE.MathUtils.damp(mouseRef.current.x, mouseRef.current.targetX, 4, delta);
      mouseRef.current.y = THREE.MathUtils.damp(mouseRef.current.y, mouseRef.current.targetY, 4, delta);

      rootGroup.rotation.y = mouseRef.current.x + (prefersReducedMotion ? 0 : time * 0.28);
      rootGroup.rotation.x = mouseRef.current.y + 0.12;

      if (!prefersReducedMotion) {
        // Subtle levitation
        coinMesh.position.y = Math.sin(time * 1.5) * 0.08;
        coinMesh.rotation.y += delta * 0.35;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      coinGeometry.dispose();
      sideMaterial.dispose();
      dollarCapMaterial.dispose();
      nairaCapMaterial.dispose();
      dollarTexture.dispose();
      nairaTexture.dispose();
      shadowGeo.dispose();
      shadowTex.dispose();
      shadowMat.dispose();
    };
  }, [isCompact]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none pointer-events-auto ${className}`}
      style={{ minHeight: isCompact ? '240px' : '380px' }}
    />
  );
};
