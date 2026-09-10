import fs from 'fs';
import path from 'path';

const stats = JSON.parse(fs.readFileSync('data/stats.json', 'utf8'));

// ============ Helpers ============
function formatNumber(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function resolve(key, ctx) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

function render(template, ctx) {
  // Loops {{#each x}}...{{/each}}
  template = template.replace(
    /\{\{#each\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, arrKey, body) => {
      const arr = resolve(arrKey, ctx) || [];
      return arr.map((item, i) => {
        const local = { ...ctx, ...item, '@index': i, this: item };
        return render(body, local);
      }).join('');
    }
  );

  // Conditions {{#if x}}...{{/if}}
  template = template.replace(
    /\{\{#if\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, body) => resolve(key, ctx) ? render(body, ctx) : ''
  );

  // Filters {{fmt:number key}}
  template = template.replace(
    /\{\{fmt:number\s+([\w.@]+)\}\}/g,
    (_, key) => formatNumber(resolve(key, ctx))
  );

  // Simple {{key}}
  template = template.replace(
    /\{\{\s*([\w.@]+)\s*\}\}/g,
    (_, key) => {
      const v = resolve(key, ctx);
      return v == null ? '' : String(v);
    }
  );

  return template;
}

// ============ Heatmap cells ============
function buildHeatmapCells(days, opts = {}) {
  const { startX = 51.5, startY = 105.5, step = 14 } = opts;
  const max = Math.max(1, ...days.map(d => d.contributionCount));
  const out = [];

  days.forEach((d, i) => {
    const week = Math.floor(i / 7);
    const day = i % 7;
    const x = startX + week * step;
    const y = startY + day * step;

    let color, opacity;
    if (d.contributionCount === 0) {
      color = '#6B7280'; opacity = 0.07;
    } else {
      color = '#4F46E5';
      opacity = Math.max(0.25, d.contributionCount / max).toFixed(2);
    }
    const delay = (i * 0.005).toFixed(3);

    out.push(`<g transform="translate(${x},${y})"><rect x="-5.5" y="-5.5" width="11" height="11" rx="2.5" fill="${color}" fill-opacity="0"><animate attributeName="fill-opacity" values="0;${opacity}" dur="0.4s" begin="${delay}s" fill="freeze"/></rect></g>`);
  });

  return out.join('');
}

// ============ Context ============
const ctx = {
  ...stats,
  heatmapCells: buildHeatmapCells(stats.heatmapDays),
  followersFmt: formatNumber(stats.followers),
  starsFmt: formatNumber(stats.totalStars),
  reposFmt: formatNumber(stats.totalRepos),
  commitsFmt: formatNumber(stats.commits),
  contributionsFmt: formatNumber(stats.contributions),
  year: new Date().getFullYear(),
  signal: Math.min(10, Math.round(Math.log2(stats.contributions + 1) + Math.log2(stats.totalStars + 1) * 1.5)),
  activityPct: Math.min(100, Math.round((stats.commits / 1000) * 100)),
  projectsPct: Math.min(100, Math.round((stats.totalRepos / 30) * 100)),
  communityPct: Math.min(100, Math.round((stats.followers / 100) * 100)),
};

// ============ Render all ============
fs.mkdirSync('banners', { recursive: true });
const templatesDir = 'templates';
const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.svg'));

let ok = 0, fail = 0;
for (const file of files) {
  try {
    const tpl = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    const out = render(tpl, ctx);
    fs.writeFileSync(path.join('banners', file), out);
    console.log('✅', file);
    ok++;
  } catch (e) {
    console.error('❌', file, '-', e.message);
    fail++;
  }
}
console.log(`\n${ok} rendered, ${fail} failed`);