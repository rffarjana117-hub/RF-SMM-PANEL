import React, { useEffect, useRef, useState } from 'react';

export type ThreeDTheme = 'cyber_neon' | 'deep_space' | 'emerald_matrix' | 'gold_luxury';

export interface ThemeConfig {
  id: ThreeDTheme;
  name: string;
  badge: string;
  primaryColor: string;
  secondaryColor: string;
  gridColor: string;
  particleColor: string;
  glowColor: string;
}

export const THEME_CONFIGS: Record<ThreeDTheme, ThemeConfig> = {
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyber 3D Neon',
    badge: '⚡ Cyber',
    primaryColor: '#38bdf8',
    secondaryColor: '#3b82f6',
    gridColor: 'rgba(56, 189, 248, 0.15)',
    particleColor: '#00f2fe',
    glowColor: 'rgba(56, 189, 248, 0.4)',
  },
  deep_space: {
    id: 'deep_space',
    name: 'Cosmic 3D Violet',
    badge: '🔮 Cosmic',
    primaryColor: '#c084fc',
    secondaryColor: '#ec4899',
    gridColor: 'rgba(192, 132, 252, 0.15)',
    particleColor: '#f472b6',
    glowColor: 'rgba(236, 72, 153, 0.4)',
  },
  emerald_matrix: {
    id: 'emerald_matrix',
    name: 'Emerald Matrix 3D',
    badge: '🌿 Matrix',
    primaryColor: '#34d399',
    secondaryColor: '#10b981',
    gridColor: 'rgba(52, 211, 153, 0.15)',
    particleColor: '#6ee7b7',
    glowColor: 'rgba(16, 185, 129, 0.4)',
  },
  gold_luxury: {
    id: 'gold_luxury',
    name: 'Royal 3D Gold',
    badge: '👑 Royal Gold',
    primaryColor: '#fbbf24',
    secondaryColor: '#f59e0b',
    gridColor: 'rgba(251, 191, 36, 0.15)',
    particleColor: '#fde68a',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
};

interface Live3DCanvasProps {
  currentTheme: ThreeDTheme;
  isInteractive?: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  opacity: number;
}

export const Live3DCanvas: React.FC<Live3DCanvasProps> = ({ currentTheme, isInteractive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isInteractive) return;
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      // Normalize to [-1, 1]
      mouseRef.current.targetX = (clientX / width - 0.5) * 2;
      mouseRef.current.targetY = (clientY / height - 0.5) * 2;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // Initialize 3D Particles
    const PARTICLE_COUNT = Math.min(65, Math.floor((width * height) / 14000));
    const particles: Particle3D[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1200,
        z: Math.random() * 800 + 100,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        vz: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 1.2,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }

    // 3D Polyhedron Geometries (Icosahedron & Octahedron vertices)
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVertices: Point3D[] = [
      { x: -1, y: phi, z: 0 },
      { x: 1, y: phi, z: 0 },
      { x: -1, y: -phi, z: 0 },
      { x: 1, y: -phi, z: 0 },
      { x: 0, y: -1, z: phi },
      { x: 0, y: 1, z: phi },
      { x: 0, y: -1, z: -phi },
      { x: 0, y: 1, z: -phi },
      { x: phi, y: 0, z: -1 },
      { x: phi, y: 0, z: 1 },
      { x: -phi, y: 0, z: -1 },
      { x: -phi, y: 0, z: 1 },
    ].map((v) => ({ x: v.x * 65, y: v.y * 65, z: v.z * 65 }));

    const icoEdges: [number, number][] = [
      [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
      [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
      [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
      [2, 4], [4, 9], [9, 8], [8, 6], [6, 2],
      [4, 5], [5, 9], [9, 1], [1, 8], [8, 7],
      [7, 6], [6, 10], [10, 2], [2, 11], [11, 4]
    ];

    let angleX = 0;
    let angleY = 0;
    let angleZ = 0;
    const fov = 420;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const theme = THEME_CONFIGS[currentTheme] || THEME_CONFIGS.cyber_neon;

      // Smooth mouse parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const rotX = angleX + mouseRef.current.y * 0.35;
      const rotY = angleY + mouseRef.current.x * 0.35;
      const rotZ = angleZ;

      angleX += 0.003;
      angleY += 0.005;
      angleZ += 0.001;

      // 1. Draw 3D Perspective Undulating Grid Floor
      const gridCols = 16;
      const gridRows = 14;
      const gridSpacing = 90;
      const gridDepthOffset = 300;
      const time = Date.now() * 0.0015;

      ctx.save();
      ctx.strokeStyle = theme.gridColor;
      ctx.lineWidth = 1;

      for (let r = 0; r < gridRows; r++) {
        ctx.beginPath();
        for (let c = 0; c < gridCols; c++) {
          const rawX = (c - gridCols / 2) * gridSpacing;
          const rawZ = r * gridSpacing + gridDepthOffset;
          const rawY = 220 + Math.sin(time + c * 0.4 + r * 0.3) * 18;

          // Apply mouse tilt to grid
          const cosY = Math.cos(mouseRef.current.x * 0.15);
          const sinY = Math.sin(mouseRef.current.x * 0.15);
          const gX = rawX * cosY - (rawZ - 400) * sinY;
          const gZ = rawX * sinY + (rawZ - 400) * cosY + 400;

          const scale = fov / (fov + gZ);
          const screenX = width / 2 + gX * scale;
          const screenY = height / 2 + rawY * scale;

          if (c === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
      }

      // Grid longitudinal lines
      for (let c = 0; c < gridCols; c++) {
        ctx.beginPath();
        for (let r = 0; r < gridRows; r++) {
          const rawX = (c - gridCols / 2) * gridSpacing;
          const rawZ = r * gridSpacing + gridDepthOffset;
          const rawY = 220 + Math.sin(time + c * 0.4 + r * 0.3) * 18;

          const cosY = Math.cos(mouseRef.current.x * 0.15);
          const sinY = Math.sin(mouseRef.current.x * 0.15);
          const gX = rawX * cosY - (rawZ - 400) * sinY;
          const gZ = rawX * sinY + (rawZ - 400) * cosY + 400;

          const scale = fov / (fov + gZ);
          const screenX = width / 2 + gX * scale;
          const screenY = height / 2 + rawY * scale;

          if (r === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      // 2. Draw 3D Floating Particles with Depth
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (p.x < -600) p.x = 600;
        if (p.x > 600) p.x = -600;
        if (p.y < -600) p.y = 600;
        if (p.y > 600) p.y = -600;
        if (p.z < 100) p.z = 900;
        if (p.z > 900) p.z = 100;

        const scale = fov / (fov + p.z);
        const screenX = width / 2 + (p.x + mouseRef.current.x * 70) * scale;
        const screenY = height / 2 + (p.y + mouseRef.current.y * 70) * scale;

        if (screenX >= -20 && screenX <= width + 20 && screenY >= -20 && screenY <= height + 20) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, p.size * scale * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = theme.particleColor;
          ctx.globalAlpha = p.opacity * scale;
          ctx.shadowBlur = 12;
          ctx.shadowColor = theme.primaryColor;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
        }
      }

      // 3. Draw 3D Rotating Polyhedron (Top-Right Floating Crystal Hologram)
      const crystalCenterX = width > 768 ? width * 0.78 : width * 0.82;
      const crystalCenterY = height > 600 ? height * 0.18 : 110;
      const crystalCenterZ = 280;

      const rotatedVertices = icoVertices.map((v) => {
        // Rotation around X
        let y1 = v.y * Math.cos(rotX) - v.z * Math.sin(rotX);
        let z1 = v.y * Math.sin(rotX) + v.z * Math.cos(rotX);

        // Rotation around Y
        let x2 = v.x * Math.cos(rotY) + z1 * Math.sin(rotY);
        let z2 = -v.x * Math.sin(rotY) + z1 * Math.cos(rotY);

        // Rotation around Z
        let x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
        let y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);

        const zFinal = z2 + crystalCenterZ;
        const scale = fov / (fov + zFinal);
        return {
          x: crystalCenterX + x3 * scale,
          y: crystalCenterY + y3 * scale,
          z: zFinal,
          scale,
        };
      });

      // Draw Polyhedron Edges
      ctx.save();
      ctx.strokeStyle = theme.primaryColor;
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 16;
      ctx.shadowColor = theme.primaryColor;

      for (let i = 0; i < icoEdges.length; i++) {
        const [startIndex, endIndex] = icoEdges[i];
        const v1 = rotatedVertices[startIndex];
        const v2 = rotatedVertices[endIndex];

        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.stroke();
      }

      // Draw Glowing Polyhedron Vertices
      for (let i = 0; i < rotatedVertices.length; i++) {
        const v = rotatedVertices[i];
        ctx.beginPath();
        ctx.arc(v.x, v.y, 3 * v.scale, 0, Math.PI * 2);
        ctx.fillStyle = theme.secondaryColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = theme.secondaryColor;
        ctx.fill();
      }

      // 4. Draw 3D Concentric Orbiting Neon Rings
      const ringRadius = 85;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        const rAngle = time * (r === 0 ? 1.2 : -0.9) + (r * Math.PI) / 2;
        const rx = ringRadius * (r === 0 ? 1 : 0.8);
        const ry = (ringRadius * (r === 0 ? 0.35 : 0.45));

        ctx.ellipse(crystalCenterX, crystalCenterY, rx, ry, rAngle, 0, Math.PI * 2);
        ctx.strokeStyle = r === 0 ? theme.primaryColor : theme.secondaryColor;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = theme.glowColor;
        ctx.stroke();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
    };
  }, [currentTheme, isInteractive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* 3D Radial Depth Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 20%, transparent 20%, rgba(3, 7, 18, 0.4) 70%, rgba(3, 7, 18, 0.85) 100%)`,
        }}
      />
    </div>
  );
};
