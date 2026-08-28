import React, { useEffect, useRef, useCallback } from 'react';

interface Welcome3DModalProps {
  show: boolean;
  userBalance: number;
  userTotalOrders: number;
  welcomeTitle?: string;
  welcomeText?: string;
  audioMode?: 'tts' | 'custom';
  customAudioUrl?: string;
  soundEnabled?: boolean;
  siteLogo?: string;
  onClose: () => void;
  onNavigateToOrder?: () => void;
  onNavigateToDeposit?: () => void;
}

export const Welcome3DModal: React.FC<Welcome3DModalProps> = ({
  show,
  userBalance,
  userTotalOrders,
  welcomeTitle = 'ওয়েলকাম RF SMM PANEL!',
  welcomeText = 'ওয়েলকাম টু আর এফ এসএমএম প্যানেল। বাংলাদেশের এক নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্মে আপনাকে স্বাগতম।',
  audioMode = 'tts',
  customAudioUrl,
  soundEnabled = true,
  siteLogo,
  onClose,
  onNavigateToOrder,
  onNavigateToDeposit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);

  // Futuristic Sci-Fi Sound FX using Web Audio API
  const playSciFiSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1. Sci-Fi Sub-bass sweep
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(60, now);
      subOsc.frequency.exponentialRampToValueAtTime(220, now + 0.6);
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.85);

      // 2. Futuristic Crystal Hologram Chimes (Major 9th chord)
      const notes = [293.66, 369.99, 440.0, 554.37, 659.25, 880.0];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + 0.15 + i * 0.08);

        gain.gain.setValueAtTime(0, now + 0.15 + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.15 + i * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15 + i * 0.08 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.15 + i * 0.08);
        osc.stop(now + 0.15 + i * 0.08 + 1.25);
      });
    } catch (_) {
      // Audio permission fallback
    }
  }, []);

  // Pure Bangla Speech Synthesis (speaks exact text configured by admin or default)
  const speakWelcome = useCallback((textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // Look for Bengali voices if available
      const voices = window.speechSynthesis.getVoices();
      const banglaVoice = voices.find(
        (v) =>
          v.lang.includes('bn') ||
          v.lang.includes('BD') ||
          v.name.toLowerCase().includes('bangla') ||
          v.name.toLowerCase().includes('bengali')
      );

      if (banglaVoice) {
        utterance.voice = banglaVoice;
        utterance.lang = banglaVoice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }

      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      // Ignore speech error
    }
  }, []);

  // Run ONLY ONCE when entering account / modal opens
  useEffect(() => {
    if (!show) return;

    if (!soundEnabled) {
      // Sound is turned OFF by Admin
      return;
    }

    // 1. Play sci-fi futuristic chime
    playSciFiSound();

    // 2. Play Audio: Either uploaded custom MP3/Audio or Text-to-Speech
    const timer = setTimeout(() => {
      if (audioMode === 'custom' && customAudioUrl) {
        try {
          const audio = new Audio(customAudioUrl);
          audioInstanceRef.current = audio;
          audio.play().catch((err) => {
            console.log('Audio autoplay prevented, falling back to speech', err);
            speakWelcome(welcomeText);
          });
        } catch (_) {
          speakWelcome(welcomeText);
        }
      } else {
        speakWelcome(welcomeText);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [show, soundEnabled, welcomeText, audioMode, customAudioUrl, playSciFiSound, speakWelcome]);

  // FULLSCREEN 3D CINEMATIC CANVAS: Warp Speed Stars + Cyber Hologram Ring + Equalizer Wave
  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 1. Warp Speed Tunnel 3D Stars
    const STAR_COUNT = Math.min(180, Math.floor((width * height) / 4500));
    const stars: Array<{ x: number; y: number; z: number; oZ: number; color: string }> = [];
    const starColors = ['#38bdf8', '#00f2fe', '#818cf8', '#c084fc', '#f43f5e', '#fbbf24', '#ffffff'];

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * 1000 + 1,
        oZ: 1000,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    // 2. 3D Floating Rings & Equalizer
    let time = 0;
    const fov = 350;

    const render = () => {
      time += 0.025;

      // Dark futuristic gradient background
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.85
      );
      grad.addColorStop(0, 'rgba(10, 25, 47, 0.95)');
      grad.addColorStop(0.5, 'rgba(5, 12, 28, 0.98)');
      grad.addColorStop(1, 'rgba(2, 6, 17, 1.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // --- Draw 3D Warp Stars with Streaks ---
      const centerX = width / 2;
      const centerY = height / 2;
      const speed = 16;

      ctx.save();
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.z -= speed;

        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
          star.z = 1000;
        }

        const k = fov / star.z;
        const px = star.x * k + centerX;
        const py = star.y * k + centerY;

        // Old position for streak
        const prevK = fov / (star.z + speed * 1.8);
        const ppx = star.x * prevK + centerX;
        const ppy = star.y * prevK + centerY;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const alpha = Math.min(1, (1000 - star.z) / 500);
          const size = Math.max(1, (1 - star.z / 1000) * 3.5);

          ctx.strokeStyle = star.color;
          ctx.lineWidth = size * 0.75;
          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.moveTo(ppx, ppy);
          ctx.lineTo(px, py);
          ctx.stroke();

          // Star head
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // --- Draw 3D Rotating Cyber Halo Rings around Center ---
      const ringCount = 3;
      ctx.save();
      for (let r = 0; r < ringCount; r++) {
        const ringRadius = 130 + r * 35;
        const tilt = 0.45 + r * 0.12;
        const rot = time * (r % 2 === 0 ? 0.6 : -0.5) + (r * Math.PI) / 3;

        ctx.save();
        ctx.translate(centerX, centerY - 20);
        ctx.rotate(rot);
        ctx.scale(1, tilt);

        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle =
          r === 0
            ? 'rgba(56, 189, 248, 0.55)'
            : r === 1
            ? 'rgba(168, 85, 247, 0.45)'
            : 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([12 + r * 4, 16 + r * 2]);
        ctx.shadowBlur = 18;
        ctx.shadowColor = r === 0 ? '#38bdf8' : r === 1 ? '#a855f7' : '#fbbf24';
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // --- Draw Real-time Equalizer Waveform at the Bottom ---
      const bars = Math.min(48, Math.floor(width / 20));
      const barWidth = width / bars;
      ctx.save();
      for (let b = 0; b < bars; b++) {
        const barHeight =
          Math.sin(time * 3 + b * 0.28) * 24 + Math.cos(time * 2 + b * 0.4) * 16 + 28;
        const bx = b * barWidth;
        const by = height - barHeight;

        const barGrad = ctx.createLinearGradient(0, height, 0, by);
        barGrad.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
        barGrad.addColorStop(1, 'rgba(56, 189, 248, 0.6)');

        ctx.fillStyle = barGrad;
        ctx.fillRect(bx + 2, by, barWidth - 4, barHeight);

        // Glowing cap
        ctx.fillStyle = '#00f2fe';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#38bdf8';
        ctx.fillRect(bx + 2, by, barWidth - 4, 2);
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col justify-between p-4 sm:p-8 bg-black select-none overflow-y-auto overflow-x-hidden animate-fade-in">
      {/* 3D Canvas Background (Edge-to-Edge Fullscreen) */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none w-full h-full z-0" />

      {/* Futuristic Scanline & Grid Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* TOP BAR: Clean Minimalist Header & Close Button */}
      <div className="relative z-10 w-full flex items-center justify-end max-w-5xl mx-auto pt-2 sm:pt-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-900/80 border border-white/20 text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 flex items-center justify-center transition backdrop-blur-md shadow-lg active:scale-95 cursor-pointer ml-auto"
          aria-label="Close"
        >
          <i className="fas fa-times text-sm"></i>
        </button>
      </div>

      {/* CENTER STAGE: 3D Holographic Core & Presentation */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-auto py-4 sm:py-6 flex flex-col items-center text-center">
        {/* ULTRA-LUXURIOUS 3D ROYAL VVIP MEDALLION & CREST */}
        <div className="relative mb-5 sm:mb-7 w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
          {/* 1. Golden Solar & Neon Plasma Core Flare */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/40 via-cyan-500/30 to-fuchsia-600/40 blur-3xl animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-gradient-to-r from-amber-400/30 to-yellow-500/30 blur-xl animate-pulse" />

          {/* 2. Outer Rotating Luxury Golden Gyroscope Rings */}
          <div
            className="absolute -inset-4 sm:-inset-5 rounded-full border-2 border-amber-400/50 border-dashed animate-spin shadow-[0_0_25px_rgba(251,191,36,0.4)]"
            style={{ animationDuration: '18s' }}
          />
          <div
            className="absolute -inset-1 sm:-inset-2 rounded-full border border-cyan-400/60 border-dotted animate-spin shadow-[0_0_20px_rgba(56,189,248,0.4)]"
            style={{ animationDuration: '28s', animationDirection: 'reverse' }}
          />
          <div
            className="absolute inset-2 rounded-full border border-fuchsia-400/30 border-dashed animate-spin"
            style={{ animationDuration: '22s' }}
          />

          {/* 4. Sculpted 3D Multi-Layered Royal Glass Shield */}
          <div
            className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-[32px] p-[2.5px] bg-gradient-to-br from-amber-300 via-yellow-500 via-cyan-400 to-indigo-600 shadow-[0_0_50px_rgba(251,191,36,0.5),0_0_30px_rgba(56,189,248,0.4)] flex items-center justify-center group"
            style={{
              transform: 'perspective(700px) rotateY(8deg) rotateX(6deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Inner Shield Body */}
            <div className="w-full h-full rounded-[30px] bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-3 border border-amber-400/30 relative overflow-hidden">
              {/* Glass Glint Overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
              
              {/* Subtle Holographic Grid in Shield */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(251, 191, 36, 0.4) 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                }}
              />

              {/* 3D Golden Imperial Crown & RF Monogram or Custom Site Logo */}
              {siteLogo ? (
                <div className="relative z-10 flex flex-col items-center justify-center p-2">
                  <img
                    src={siteLogo}
                    alt="Brand Logo"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_18px_rgba(251,191,36,0.85)]"
                  />
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center justify-center">
                  {/* Imperial Crown with Sparkling Glow */}
                  <div className="relative mb-0.5">
                    <i className="fas fa-crown text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_18px_rgba(251,191,36,0.9)] animate-pulse"></i>
                    <i className="fas fa-sparkles text-[10px] text-white absolute -top-1 -right-2 animate-ping"></i>
                  </div>

                  {/* Bold RF Golden Typography */}
                  <div className="flex items-center gap-1">
                    <span className="font-black text-2xl sm:text-3xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_0_15px_rgba(251,191,36,0.7)] font-sans">
                      RF
                    </span>
                    <span className="font-black text-xs sm:text-sm tracking-wider text-cyan-300 uppercase font-mono px-1 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40">
                      SMM
                    </span>
                  </div>

                  {/* Micro Subtitle */}
                  <span className="text-[9px] font-extrabold text-amber-200/80 tracking-[0.25em] uppercase font-mono mt-0.5">
                    PANEL BD
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Main Grand Title (Configurable from Admin) */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-blue-400 tracking-tight leading-tight uppercase drop-shadow-[0_0_35px_rgba(56,189,248,0.5)]">
          {welcomeTitle}
        </h1>

        {/* Dynamic Welcome Speech Text (Configurable from Admin) */}
        <p className="mt-3 text-base sm:text-xl font-bold text-cyan-300 max-w-2xl leading-relaxed">
          {welcomeText}
        </p>

        {/* 3D Futuristic HUD Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl mt-6 sm:mt-8 text-left">
          {/* Card 1 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(56,189,248,0.15)] flex items-center gap-3.5 transform transition hover:-translate-y-1">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center text-xl shadow">
              <i className="fas fa-bolt text-amber-300"></i>
            </div>
            <div>
              <p className="text-[10px] text-cyan-300 font-mono font-bold uppercase tracking-wider">স্পিড ডেলিভারি</p>
              <h4 className="text-sm font-extrabold text-white">ইনস্ট্যান্ট স্টার্ট</h4>
              <p className="text-[11px] text-slate-400">১০০% দ্রুত ও নিরাপদ সার্ভিস</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(168,85,247,0.15)] flex items-center gap-3.5 transform transition hover:-translate-y-1">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center text-xl shadow">
              <i className="fas fa-wallet text-emerald-400"></i>
            </div>
            <div>
              <p className="text-[10px] text-purple-300 font-mono font-bold uppercase tracking-wider">বর্তমান ব্যালেন্স</p>
              <h4 className="text-base font-black text-emerald-400">৳{userBalance.toFixed(2)}</h4>
              <p className="text-[11px] text-slate-400">বিকাশ / নগদ / রকেট</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(59,130,246,0.15)] flex items-center gap-3.5 transform transition hover:-translate-y-1">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center text-xl shadow">
              <i className="fas fa-shield-alt text-cyan-300"></i>
            </div>
            <div>
              <p className="text-[10px] text-blue-300 font-mono font-bold uppercase tracking-wider">অর্ডার হিস্টোরি</p>
              <h4 className="text-sm font-extrabold text-white">{userTotalOrders} টি অর্ডার</h4>
              <p className="text-[11px] text-slate-400">২৪/৭ লাইভ ট্র্যাকিং</p>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION DOCK: Enter & Quick Actions */}
      <div className="relative z-10 w-full max-w-xl mx-auto pb-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          {/* Primary Action Button */}
          <button
            onClick={() => {
              onClose();
              if (onNavigateToOrder) onNavigateToOrder();
            }}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-extrabold text-sm sm:text-base shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2.5 border border-cyan-300/30 cursor-pointer"
          >
            <i className="fas fa-rocket text-amber-300 text-base"></i>
            <span>অর্ডার শুরু করুন (Start Order)</span>
          </button>

          {/* Secondary Action: Deposit */}
          <button
            onClick={() => {
              onClose();
              if (onNavigateToDeposit) onNavigateToDeposit();
            }}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-slate-900/90 border border-cyan-400/40 text-cyan-300 font-bold text-sm sm:text-base hover:bg-slate-800 hover:text-white active:scale-[0.98] transition flex items-center justify-center gap-2 backdrop-blur-md shadow-lg cursor-pointer"
          >
            <i className="fas fa-plus-circle text-emerald-400"></i>
            <span>ব্যালেন্স যোগ করুন (Deposit)</span>
          </button>

          {/* Dismiss / Dashboard Button */}
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm sm:text-base active:scale-[0.98] transition flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
          >
            <i className="fas fa-arrow-right text-cyan-300"></i>
            <span>ড্যাশবোর্ড (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
