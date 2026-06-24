/**
 * VYAN LABS — Śūnya Maṇḍala Icon System
 * 8 Framer Motion SVG Icons
 * Production-grade · GPU-accelerated · Dark-mode native
 */

import { motion } from "framer-motion";

// ─── Shared Design Tokens ────────────────────────────────────────────────────
const C = {
  blue:    "#4FC3F7",
  violet:  "#9B59FF",
  pink:    "#E040FB",
  indigo:  "#3D5AFE",
  white:   "#E8EEFF",
  glow:    "rgba(157, 89, 255, 0.6)",
  glowB:   "rgba(79, 195, 247, 0.5)",
  glowP:   "rgba(224, 64, 251, 0.5)",
};

const glowFilter = (id, color = C.glow, blur = 6) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation={blur} result="blur" />
    <feFlood floodColor={color} result="color" />
    <feComposite in="color" in2="blur" operator="in" result="glow" />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

const softGlow = (id, color, blur = 4) => (
  <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
    <feColorMatrix in="blur" type="matrix"
      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="glow" />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

// ─── 1. SETTINGS — Prism Nexus ───────────────────────────────────────────────
export function SettingsIcon({ size = 64, className = "" }) {
  // 8 crystal shards arranged in a radial pattern, slowly orbiting
  const shards = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const r = 22;
    const cx = 32 + Math.cos(angle) * r;
    const cy = 32 + Math.sin(angle) * r;
    const len = i % 2 === 0 ? 10 : 7;
    const wid = i % 2 === 0 ? 4 : 3;
    const colors = [C.blue, C.violet, C.pink, C.violet, C.blue, C.violet, C.pink, C.blue];
    return { cx, cy, angle, len, wid, color: colors[i] };
  });

  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("s-glow1", C.glow, 5)}
        {glowFilter("s-glow2", C.glowB, 3)}
        <radialGradient id="s-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="40%" stopColor={C.violet} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="s-orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a0a3a" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Subtle orb background */}
      <circle cx="32" cy="32" r="30" fill="url(#s-orb)" opacity="0.6" />

      {/* Orbiting crystal shards */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
        filter="url(#s-glow1)"
      >
        {shards.map((s, i) => {
          const deg = (s.angle * 180) / Math.PI + 90;
          return (
            <g key={i} transform={`translate(${s.cx},${s.cy}) rotate(${deg})`}>
              {/* Diamond shard shape */}
              <polygon
                points={`0,${-s.len} ${s.wid},0 0,${s.len * 0.4} ${-s.wid},0`}
                fill={s.color}
                opacity={0.85}
              />
              {/* Inner highlight */}
              <polygon
                points={`0,${-s.len + 2} ${s.wid * 0.4},${-s.len * 0.3} 0,${-s.len * 0.1} ${-s.wid * 0.4},${-s.len * 0.3}`}
                fill={C.white}
                opacity={0.5}
              />
            </g>
          );
        })}
      </motion.g>

      {/* Counter-rotating inner ring of smaller crystals */}
      <motion.g
        animate={{ rotate: -360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
        filter="url(#s-glow2)"
      >
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const r = 11;
          const cx = 32 + Math.cos(angle) * r;
          const cy = 32 + Math.sin(angle) * r;
          const deg = (angle * 180) / Math.PI + 90;
          return (
            <g key={i} transform={`translate(${cx},${cy}) rotate(${deg})`}>
              <polygon points="0,-4 2,0 0,2 -2,0" fill={C.blue} opacity={0.7} />
            </g>
          );
        })}
      </motion.g>

      {/* Core nexus */}
      <motion.circle
        cx="32" cy="32" r="4"
        fill="url(#s-core)"
        filter="url(#s-glow1)"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "32px", originY: "32px" }}
      />
      <circle cx="32" cy="32" r="2" fill={C.white} opacity={0.9} />
    </svg>
  );
}

// ─── 2. GO BACK — Time Rift ──────────────────────────────────────────────────
export function BackIcon({ size = 64, className = "" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("b-glow", C.glow, 6)}
        {glowFilter("b-glow2", C.glowP, 4)}
        <radialGradient id="b-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d0620" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="b-arc1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C.violet} stopOpacity="0.9" />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="b-arc2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={C.blue} stopOpacity="0.8" />
          <stop offset="100%" stopColor={C.violet} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill="url(#b-bg)" opacity="0.6" />

      {/* Outer temporal ring - rotates CCW */}
      <motion.g
        animate={{ rotate: -360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
        filter="url(#b-glow)"
      >
        {/* Crescent arc - main thick stroke */}
        <path
          d="M 32 4 A 28 28 0 0 0 32 60"
          stroke="url(#b-arc1)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
        <path
          d="M 32 4 A 28 28 0 0 0 32 60"
          stroke={C.violet}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity={0.4}
        />
      </motion.g>

      {/* Inner ring */}
      <motion.g
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
        filter="url(#b-glow2)"
      >
        <path
          d="M 32 10 A 22 22 0 0 0 32 54"
          stroke="url(#b-arc2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity={0.7}
        />
      </motion.g>

      {/* Chevron arrows that pulse inward */}
      <motion.g
        filter="url(#b-glow)"
        animate={{ x: [-2, 2, -2] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Three chevrons */}
        {[0, 7, 14].map((offset, i) => (
          <polyline
            key={i}
            points={`${30 - offset},24 ${22 - offset},32 ${30 - offset},40`}
            stroke={C.blue}
            strokeWidth={3 - i * 0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={1 - i * 0.3}
          />
        ))}
      </motion.g>
    </svg>
  );
}

// ─── 3. FACULTY SELECTION — Cognitive Constellation ─────────────────────────
export function FacultyIcon({ size = 64, className = "" }) {
  const nodes = [
    { cx: 32, cy: 8,  r: 5.5, color: C.blue,   delay: 0 },
    { cx: 56, cy: 32, r: 5,   color: C.pink,    delay: 0.5 },
    { cx: 32, cy: 56, r: 5.5, color: C.violet,  delay: 1 },
    { cx: 8,  cy: 32, r: 4.5, color: C.blue,    delay: 1.5 },
  ];

  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("f-glow", C.glow, 5)}
        {glowFilter("f-glowB", C.glowB, 4)}
        {glowFilter("f-glowP", C.glowP, 4)}
        <radialGradient id="f-diamond" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="30%" stopColor={C.violet} stopOpacity="0.9" />
          <stop offset="100%" stopColor={C.indigo} stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id="f-node-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="100%" stopColor={C.blue} />
        </radialGradient>
        <radialGradient id="f-node-p" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="100%" stopColor={C.pink} />
        </radialGradient>
      </defs>

      {/* Connection lines */}
      {nodes.map((n, i) => (
        <line
          key={i}
          x1="32" y1="32" x2={n.cx} y2={n.cy}
          stroke={n.color}
          strokeWidth="0.75"
          opacity={0.3}
        />
      ))}

      {/* Orbital ring */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        <ellipse
          cx="32" cy="32"
          rx="24" ry="8"
          stroke={C.violet}
          strokeWidth="0.75"
          fill="none"
          opacity={0.25}
        />
        <ellipse
          cx="32" cy="32"
          rx="24" ry="8"
          stroke={C.blue}
          strokeWidth="0.5"
          fill="none"
          opacity={0.15}
          transform="rotate(60 32 32)"
        />
      </motion.g>

      {/* Orbiting outer nodes */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        style={{ originX: "32px", originY: "32px" }}
        filter="url(#f-glowB)"
      >
        {nodes.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.cx} cy={n.cy} r={n.r}
            fill={i === 1 ? "url(#f-node-p)" : "url(#f-node-b)"}
            animate={{ r: [n.r, n.r + 1.5, n.r] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: n.delay }}
          />
        ))}
      </motion.g>

      {/* Center diamond — breathes */}
      <motion.g
        filter="url(#f-glow)"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        <polygon
          points="32,18 42,32 32,46 22,32"
          fill="url(#f-diamond)"
        />
        {/* Inner diamond highlight */}
        <polygon
          points="32,22 38,32 32,42 26,32"
          fill="none"
          stroke={C.white}
          strokeWidth="0.75"
          opacity={0.5}
        />
        <polygon
          points="32,26 36,32 32,38 28,32"
          fill={C.white}
          opacity={0.15}
        />
      </motion.g>

      {/* Diamond core spark */}
      <circle cx="32" cy="32" r="2" fill={C.white} opacity={0.9} filter="url(#f-glowB)" />
    </svg>
  );
}

// ─── 4. CLOSE — Void Collapse ────────────────────────────────────────────────
export function CloseIcon({ size = 64, className = "", isHovered = false }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("cl-glow", C.glowP, 6)}
        {glowFilter("cl-glow2", "rgba(61,90,254,0.6)", 4)}
        <linearGradient id="cl-arm1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C.violet} />
          <stop offset="50%" stopColor={C.pink} />
          <stop offset="100%" stopColor={C.blue} stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="cl-arm2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={C.blue} />
          <stop offset="50%" stopColor={C.violet} />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="cl-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="100%" stopColor={C.violet} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle circular field */}
      <motion.circle
        cx="32" cy="32" r="28"
        stroke={C.violet}
        strokeWidth="0.5"
        fill="none"
        opacity={0.15}
        animate={{ opacity: isHovered ? [0.15, 0.35, 0.15] : 0.15 }}
        transition={{ duration: 1, repeat: isHovered ? Infinity : 0 }}
      />

      {/* Energy arm 1 — diagonal / */}
      <motion.g
        filter="url(#cl-glow)"
        animate={isHovered
          ? { scale: [1, 0.3], opacity: [1, 0], x: [0, 6], y: [0, 6] }
          : { scale: 1, opacity: 1, x: 0, y: 0 }
        }
        transition={{ duration: 0.4, ease: "easeIn" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        {/* Main stroke */}
        <line x1="14" y1="14" x2="50" y2="50" stroke="url(#cl-arm1)" strokeWidth="4" strokeLinecap="round" />
        {/* Glow duplicate */}
        <line x1="14" y1="14" x2="50" y2="50" stroke={C.pink} strokeWidth="1.5" strokeLinecap="round" opacity={0.6} />
        {/* Energy tail particles */}
        <line x1="14" y1="14" x2="22" y2="22" stroke={C.white} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
        <line x1="42" y1="42" x2="50" y2="50" stroke={C.white} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      </motion.g>

      {/* Energy arm 2 — diagonal \ */}
      <motion.g
        filter="url(#cl-glow2)"
        animate={isHovered
          ? { scale: [1, 0.3], opacity: [1, 0], x: [0, -6], y: [0, 6] }
          : { scale: 1, opacity: 1, x: 0, y: 0 }
        }
        transition={{ duration: 0.4, ease: "easeIn" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        <line x1="50" y1="14" x2="14" y2="50" stroke="url(#cl-arm2)" strokeWidth="4" strokeLinecap="round" />
        <line x1="50" y1="14" x2="14" y2="50" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" opacity={0.6} />
        <line x1="42" y1="22" x2="50" y2="14" stroke={C.white} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
        <line x1="14" y1="42" x2="22" y2="50" stroke={C.white} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      </motion.g>

      {/* Core void point */}
      <motion.circle
        cx="32" cy="32" r="3.5"
        fill="url(#cl-core)"
        filter="url(#cl-glow)"
        animate={{ r: [3.5, 5, 3.5], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="32" cy="32" r="1.5" fill={C.white} opacity={0.95} />
    </svg>
  );
}

// ─── 5. SEND — Intent Launch ─────────────────────────────────────────────────
export function SendIcon({ size = 64, className = "" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("sn-glow", C.glowB, 6)}
        {glowFilter("sn-glow2", C.glow, 3)}
        <linearGradient id="sn-body" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={C.blue} stopOpacity="0.2" />
          <stop offset="60%" stopColor={C.violet} />
          <stop offset="100%" stopColor={C.blue} />
        </linearGradient>
        <linearGradient id="sn-trail" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={C.pink} stopOpacity="0" />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0.7" />
        </linearGradient>
        {/* Pulse gradient that moves along the arrow */}
        <linearGradient id="sn-pulse" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="40%" stopColor={C.white} stopOpacity="0.9" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* Arrow body — double chevron */}
      <motion.g filter="url(#sn-glow)">
        {/* Rear arrow (dimmer) */}
        <polygon
          points="8,24 32,32 8,40"
          fill={C.blue}
          opacity={0.4}
        />
        {/* Main arrow */}
        <polygon
          points="20,20 56,32 20,44"
          fill="url(#sn-body)"
        />
        {/* Top edge highlight */}
        <line x1="20" y1="20" x2="56" y2="32" stroke={C.white} strokeWidth="0.75" opacity={0.6} />
        {/* Bottom edge */}
        <line x1="20" y1="44" x2="56" y2="32" stroke={C.blue} strokeWidth="0.75" opacity={0.4} />
      </motion.g>

      {/* Energy pulse traveling tail → tip */}
      <motion.rect
        x="0" y="30" width="20" height="4" rx="2"
        fill="url(#sn-pulse)"
        animate={{ x: [0, 56], opacity: [0, 1, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeIn", repeatDelay: 0.6 }}
        filter="url(#sn-glow2)"
      />

      {/* Tip spark */}
      <motion.circle
        cx="56" cy="32" r="3"
        fill={C.white}
        filter="url(#sn-glow)"
        animate={{ r: [3, 5, 3], opacity: [0.9, 0.3, 0.9] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
      />

      {/* Wake trail lines */}
      {[4, 8, 12].map((offset, i) => (
        <motion.line
          key={i}
          x1={20 - offset} y1={32 - (4 - i)}
          x2={20 - offset} y2={32 + (4 - i)}
          stroke={C.violet}
          strokeWidth={1.5 - i * 0.4}
          strokeLinecap="round"
          opacity={0.5 - i * 0.12}
          animate={{ opacity: [0.5 - i * 0.12, 0.1, 0.5 - i * 0.12] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.1, repeatDelay: 0.6 }}
        />
      ))}
    </svg>
  );
}

// ─── 6. ATTACH — Entanglement ─────────────────────────────────────────────────
export function AttachIcon({ size = 64, className = "" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("at-glow", C.glowB, 6)}
        {glowFilter("at-glow2", C.glow, 4)}
        <linearGradient id="at-loop1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C.blue} />
          <stop offset="50%" stopColor={C.violet} />
          <stop offset="100%" stopColor={C.blue} />
        </linearGradient>
        <linearGradient id="at-loop2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={C.pink} />
          <stop offset="50%" stopColor={C.violet} />
          <stop offset="100%" stopColor={C.pink} />
        </linearGradient>
        <radialGradient id="at-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#08031a" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill="url(#at-bg)" opacity="0.5" />

      {/* Outer loop — Left lobe of infinity, phasing */}
      <motion.g
        filter="url(#at-glow)"
        animate={{ scaleX: [1, 1.08, 1], x: [0, -1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "32px", originY: "32px" }}
      >
        {/* Left loop */}
        <path
          d="M 32 32 C 32 20, 10 14, 10 32 C 10 50, 32 44, 32 32"
          stroke="url(#at-loop1)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 32 32 C 32 20, 10 14, 10 32 C 10 50, 32 44, 32 32"
          stroke={C.white}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity={0.4}
        />
      </motion.g>

      {/* Right lobe — offset phase */}
      <motion.g
        filter="url(#at-glow2)"
        animate={{ scaleX: [1, 1.08, 1], x: [0, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        style={{ originX: "32px", originY: "32px" }}
      >
        <path
          d="M 32 32 C 32 20, 54 14, 54 32 C 54 50, 32 44, 32 32"
          stroke="url(#at-loop2)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 32 32 C 32 20, 54 14, 54 32 C 54 50, 32 44, 32 32"
          stroke={C.white}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
        />
      </motion.g>

      {/* Crossing sparkle at center */}
      <motion.circle
        cx="32" cy="32" r="2.5"
        fill={C.white}
        filter="url(#at-glow)"
        animate={{ scale: [1, 1.6, 1], opacity: [0.9, 0.4, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "32px", originY: "32px" }}
      />

      {/* Particle dots along loops */}
      {[
        { cx: 10, cy: 32 },
        { cx: 54, cy: 32 },
        { cx: 21, cy: 20 },
        { cx: 43, cy: 20 },
        { cx: 21, cy: 44 },
        { cx: 43, cy: 44 },
      ].map((p, i) => (
        <motion.circle
          key={i}
          cx={p.cx} cy={p.cy} r={1.5}
          fill={i % 2 === 0 ? C.blue : C.pink}
          opacity={0.7}
          animate={{ opacity: [0.7, 0.15, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
        />
      ))}
    </svg>
  );
}

// ─── 7. SPEAK — Resonance Core ───────────────────────────────────────────────
export function SpeakIcon({ size = 64, className = "" }) {
  const rings = [
    { r: 18, delay: 0,   stroke: C.blue,   w: 1.5 },
    { r: 23, delay: 0.3, stroke: C.violet, w: 1.2 },
    { r: 28, delay: 0.6, stroke: C.blue,   w: 0.8 },
    { r: 13, delay: 0.15,stroke: C.violet, w: 1.8 },
  ];

  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("sp-glow", C.glowB, 5)}
        {glowFilter("sp-glow2", C.glow, 3)}
        <radialGradient id="sp-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.white} />
          <stop offset="30%" stopColor={C.blue} />
          <stop offset="100%" stopColor={C.violet} stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="sp-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#040d1a" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill="url(#sp-bg)" opacity="0.5" />

      {/* Resonance rings — expanding and contracting */}
      {rings.map((ring, i) => (
        <motion.circle
          key={i}
          cx="32" cy="32"
          r={ring.r}
          stroke={ring.stroke}
          strokeWidth={ring.w}
          fill="none"
          filter="url(#sp-glow)"
          animate={{
            r: [ring.r - 3, ring.r + 3, ring.r - 3],
            opacity: [0.7, 0.35, 0.7],
            strokeWidth: [ring.w, ring.w * 0.5, ring.w],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: ring.delay,
          }}
        />
      ))}

      {/* Node orbs on vertical axis */}
      <motion.circle
        cx="32" cy="12" r="3.5"
        fill={C.violet}
        filter="url(#sp-glow2)"
        animate={{ cy: [12, 10, 12], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="32" cy="52" r="2.5"
        fill={C.violet}
        filter="url(#sp-glow2)"
        animate={{ cy: [52, 54, 52], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      {/* Core orb */}
      <motion.circle
        cx="32" cy="32" r="7"
        fill="url(#sp-core)"
        filter="url(#sp-glow)"
        animate={{ r: [7, 9, 7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="32" cy="32" r="3.5" fill={C.white} opacity={0.9} />
      <circle cx="30" cy="30" r="1.2" fill={C.white} opacity={0.7} />
    </svg>
  );
}

// ─── 8. REFRESH — Pravāha ────────────────────────────────────────────────────
// Two counter-flowing S-curve arms that circulate continuously.
// Upper arm (blue→violet) sweeps clockwise from bottom-left to top-right.
// Lower arm (pink→violet) sweeps clockwise from top-right to bottom-left.
// Arrowheads ride the leading tips. Distinct from Speak's concentric-ring language.
export function RefreshIcon({ size = 64, className = "" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {glowFilter("rf-glowV", C.glow, 5)}
        {glowFilter("rf-glowP", C.glowP, 4)}
        {glowFilter("rf-glowB", C.glowB, 3)}
        <radialGradient id="rf-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0a0316" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="rf-upper" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={C.blue}   stopOpacity="0.2" />
          <stop offset="35%"  stopColor={C.blue} />
          <stop offset="100%" stopColor={C.violet} />
        </linearGradient>
        <linearGradient id="rf-lower" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor={C.pink}   stopOpacity="0.2" />
          <stop offset="35%"  stopColor={C.pink} />
          <stop offset="100%" stopColor={C.violet} />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill="url(#rf-bg)" opacity="0.55" />

      {/* Upper arm — clockwise curl, blue leading edge */}
      <motion.g
        filter="url(#rf-glowB)"
        animate={{ pathLength: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M 12 46 C 8 28, 18 8, 36 8 C 50 8, 58 18, 54 30"
          stroke="url(#rf-upper)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 12 46 C 8 28, 18 8, 36 8 C 50 8, 58 18, 54 30"
          stroke={C.white}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.3}
        />
      </motion.g>

      {/* Lower arm — clockwise curl, pink leading edge */}
      <motion.g
        filter="url(#rf-glowP)"
        animate={{ pathLength: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <path
          d="M 52 18 C 56 36, 46 56, 28 56 C 14 56, 6 46, 10 34"
          stroke="url(#rf-lower)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 52 18 C 56 36, 46 56, 28 56 C 14 56, 6 46, 10 34"
          stroke={C.white}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.25}
        />
      </motion.g>

      {/* Arrowhead — upper arm tip, flows rightward-down at (54,30) */}
      <motion.g
        transform="translate(54,30) rotate(100)"
        filter="url(#rf-glowB)"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <polygon points="0,-7 4,3 0,1 -4,3" fill={C.violet} />
        <polygon points="0,-7 1.5,0 0,1 -1.5,0" fill={C.white} opacity={0.7} />
      </motion.g>

      {/* Arrowhead — lower arm tip, flows leftward-up at (10,34) */}
      <motion.g
        transform="translate(10,34) rotate(-80)"
        filter="url(#rf-glowP)"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <polygon points="0,-7 4,3 0,1 -4,3" fill={C.pink} />
        <polygon points="0,-7 1.5,0 0,1 -1.5,0" fill={C.white} opacity={0.7} />
      </motion.g>

      {/* Crossing sparkle where arms intersect */}
      <motion.circle
        cx="32" cy="32" r="3"
        fill={C.violet}
        filter="url(#rf-glowV)"
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "32px", originY: "32px" }}
      />
      <circle cx="32" cy="32" r="1.4" fill={C.white} opacity={0.9} />
    </svg>
  );
}

// ─── Demo Gallery ─────────────────────────────────────────────────────────────
export default function VyanIconGallery() {
  const icons = [
    { Icon: SettingsIcon, label: "Settings",  sub: "Prism Nexus" },
    { Icon: BackIcon,     label: "Go Back",   sub: "Time Rift" },
    { Icon: FacultyIcon,  label: "Faculty",   sub: "Cognitive Constellation" },
    { Icon: CloseIcon,    label: "Close",     sub: "Void Collapse" },
    { Icon: SendIcon,     label: "Send",      sub: "Intent Launch" },
    { Icon: AttachIcon,   label: "Attach",    sub: "Entanglement" },
    { Icon: SpeakIcon,    label: "Speak",     sub: "Resonance Core" },
    { Icon: RefreshIcon,  label: "Refresh",   sub: "Pravāha" },
  ];

  return (
    <div style={{
      background: "#06030f",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'SF Pro Display', sans-serif",
      padding: "48px 24px",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "56px" }}>
        <div style={{
          fontSize: "10px",
          letterSpacing: "0.4em",
          color: "#5b4a8a",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          VYAN LABS — ŚŪNYA MAṆḌALA
        </div>
        <div style={{
          fontSize: "22px",
          fontWeight: 300,
          color: "#c8b8ff",
          letterSpacing: "0.12em",
        }}>
          Icon System
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 140px)",
        gap: "40px 32px",
        maxWidth: "640px",
      }}>
        {icons.map(({ Icon, label, sub }) => (
          <div key={label} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}>
            {/* Icon container with subtle glass ring */}
            <div style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "rgba(20,10,40,0.6)",
              border: "1px solid rgba(120,80,220,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 24px rgba(100,60,200,0.12), inset 0 0 16px rgba(0,0,0,0.4)",
            }}>
              <Icon size={64} />
            </div>

            {/* Labels */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#7b9fff",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}>
                {label}
              </div>
              <div style={{
                fontSize: "9px",
                color: "#4a3a6a",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}>
                {sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Size variants strip */}
      <div style={{
        marginTop: "64px",
        display: "flex",
        alignItems: "center",
        gap: "24px",
        borderTop: "1px solid rgba(100,60,200,0.12)",
        paddingTop: "40px",
      }}>
        <div style={{ fontSize: "9px", color: "#3a2a5a", letterSpacing: "0.3em" }}>SCALE</div>
        {[20, 32, 48, 64, 96].map(s => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <SpeakIcon size={s} />
            <div style={{ fontSize: "8px", color: "#3a2a5a", letterSpacing: "0.2em" }}>{s}px</div>
          </div>
        ))}
      </div>
    </div>
  );
}
