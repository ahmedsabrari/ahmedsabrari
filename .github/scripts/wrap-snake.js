#!/usr/bin/env node
/**
 * Wrap Platane/snk raw SVG inside the Aurora Dark card
 * (same design as the contribution heatmap).
 */
const fs = require("fs");
const path = require("path");

const RAW   = path.join("snake", "snake-raw.svg");
const FINAL = path.join("snake", "snake.svg");

// ---------- 1. Read raw snk SVG ----------
const raw = fs.readFileSync(RAW, "utf8");

// Inner content between <svg> ... </svg>
const svgMatch = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
if (!svgMatch) throw new Error("❌ ما لقيتش <svg> فـ snake-raw.svg");
let inner = svgMatch[1];

// Drop the <desc> (we provide our own)
inner = inner.replace(/<desc>[\s\S]*?<\/desc>/g, "");

// ---------- 2. Grab snk <style> and recolor palette ----------
const styleMatch = inner.match(/<style>([\s\S]*?)<\/style>/);
let style = styleMatch ? styleMatch[1] : "";

style = style
  .replace("--ce:#ebedf0", "--ce:#F0F0EE")   // empty cell
  .replace("--c1:#9be9a8", "--c1:#C3C0F6")   // level 1
  .replace("--c2:#40c463", "--c2:#9C97F0")   // level 2
  .replace("--c3:#30a14e", "--c3:#766FEB")   // level 3
  .replace("--c4:#216e39", "--c4:#4F46E5")   // level 4
  .replace("--cs:purple", "--cs:#14B8A6")    // snake body (teal)
  .replace("--cb:#1b1f230a", "--cb:transparent");

// ---------- 3. Keep only cells + snake body (drop progress bars) ----------
const rects = inner.match(/<rect[^>]*class="(?:c|s)[^"]*"[^>]*\/>/g) || [];
const rectsSvg = rects.join("\n      ");

// ---------- 4. Build the final SVG ----------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="860" height="240" viewBox="0 0 860 240" role="img"
     aria-labelledby="snakeTitle snakeDesc">
  <title id="snakeTitle">Contribution Snake — AHMED SABRARI</title>
  <desc id="snakeDesc">Animated snake eating contribution cells over the last year.</desc>

  <defs>
    <linearGradient id="snake-aurora-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#F4F1EA"/>
      <stop offset="54%"  stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F4F1EA"/>
    </linearGradient>

    <radialGradient id="snake-orb-0" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#4F46E5" stop-opacity="0.30"/>
      <stop offset="58%"  stop-color="#4F46E5" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="snake-orb-1" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#14B8A6" stop-opacity="0.24"/>
      <stop offset="58%"  stop-color="#14B8A6" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#14B8A6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="snake-orb-2" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#4F46E5" stop-opacity="0.26"/>
      <stop offset="58%"  stop-color="#4F46E5" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="snake-orb-3" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#14B8A6" stop-opacity="0.22"/>
      <stop offset="58%"  stop-color="#14B8A6" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#14B8A6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <style>
    ${style}

    #snake-card .aura-orb-a { animation: snake-float-a 9s  ease-in-out infinite; }
    #snake-card .aura-orb-b { animation: snake-float-b 11s ease-in-out infinite 1.1s; }
    #snake-card .aura-orb-c { animation: snake-float-c 13s ease-in-out infinite 0.6s; }
    @keyframes snake-float-a { 0%,100% { transform: translate(0,0);           opacity:.58; } 50% { transform: translate(28px,-20px);  opacity:.86; } }
    @keyframes snake-float-b { 0%,100% { transform: translate(0,0);           opacity:.42; } 50% { transform: translate(-24px,18px);  opacity:.72; } }
    @keyframes snake-float-c { 0%,100% { transform: translate(0,0) scale(1);  opacity:.34; } 50% { transform: translate(18px,-12px) scale(1.18); opacity:.62; } }
    @media (prefers-reduced-motion: reduce) {
      #snake-card .aura-orb-a,
      #snake-card .aura-orb-b,
      #snake-card .aura-orb-c { animation: none !important; }
    }
  </style>

  <g id="snake-card">
    <!-- Background -->
    <rect width="860" height="240" rx="20" fill="url(#snake-aurora-bg)"/>

    <!-- Aurora orbs -->
    <ellipse class="aura-orb-a" cx="138" cy="41"  rx="206" ry="106" fill="url(#snake-orb-0)"/>
    <ellipse class="aura-orb-b" cx="654" cy="51"  rx="241" ry="97"  fill="url(#snake-orb-1)"/>
    <ellipse class="aura-orb-c" cx="499" cy="202" rx="310" ry="78"  fill="url(#snake-orb-2)"/>
    <ellipse class="aura-orb-b" cx="826" cy="179" rx="172" ry="97"  fill="url(#snake-orb-3)"/>

    <!-- Inner card -->
    <rect x="26" y="26" width="808" height="188" rx="20"
          fill="#FFFFFF" fill-opacity="0.55"
          stroke="#D9D2C7" stroke-opacity="1"/>

    <!-- Title + subtitle -->
    <text x="46" y="60"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          font-size="24" font-weight="850" letter-spacing="-0.4"
          fill="#1F2933">Contribution Snake</text>
    <text x="48" y="84"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          font-size="13" font-weight="650" letter-spacing="0.6"
          fill="#6B7280">Animated activity — last year</text>

    <!-- Legend -->
    <text x="648" y="72"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          font-size="11" fill="#6B7280" text-anchor="end">Less</text>
    <rect x="656" y="63" width="11" height="11" rx="2.5" fill="#6B7280" fill-opacity="0.07"/>
    <rect x="671" y="63" width="11" height="11" rx="2.5" fill="#4F46E5" fill-opacity="0.34"/>
    <rect x="686" y="63" width="11" height="11" rx="2.5" fill="#4F46E5" fill-opacity="0.56"/>
    <rect x="701" y="63" width="11" height="11" rx="2.5" fill="#4F46E5" fill-opacity="0.78"/>
    <rect x="716" y="63" width="11" height="11" rx="2.5" fill="#4F46E5" fill-opacity="1"/>
    <text x="737" y="72"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          font-size="11" fill="#6B7280">More</text>

    <!-- Snake grid + animation (from Platane/snk) -->
    <g transform="translate(52, 96) scale(0.88)">
      ${rectsSvg}
    </g>

    <!-- Outer border -->
    <rect x="0.5" y="0.5" width="859" height="239" rx="19.5"
          fill="none" stroke="#D9D2C7" stroke-opacity="1"/>
  </g>
</svg>
`;

fs.writeFileSync(FINAL, svg, "utf8");
console.log(`✅ Wrote ${FINAL} (${svg.length.toLocaleString()} bytes)`);