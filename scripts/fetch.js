import fetch from 'node-fetch';
import fs from 'fs';
import Jimp from 'jimp';

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GH_USERNAME || 'ahmedsabrari';

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'profile-cards',
};

const QUERY = `
query($login: String!) {
  user(login: $login) {
    name login bio location company createdAt avatarUrl
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false,
                 orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes {
        name description url stargazerCount forkCount updatedAt
        primaryLanguage { name color }
        languages(first: 10) { edges { size node { name color } } }
      }
    }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name description url stargazerCount
          primaryLanguage { name color }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
    }
  }
}`;

async function gql() {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data.user;
}

// ============ Téléchargi avatar → base64 ============
async function fetchAvatarBase64(url) {
  console.log('  Downloading avatar...');
  const res = await fetch(url, { headers: { 'User-Agent': 'profile-cards' } });
  if (!res.ok) throw new Error(`Avatar fetch failed: ${res.status}`);
  const buffer = await res.buffer();
  const contentType = res.headers.get('content-type') || 'image/png';
  const base64 = buffer.toString('base64');
  console.log(`  ✅ Avatar: ${(buffer.length / 1024).toFixed(1)} KB`);
  return `data:${contentType};base64,${base64}`;
}

// ============ Avatar → ASCII ============
async function avatarToAscii(url, cols = 65, rows = 55) {
  try {
    console.log(`  Converting avatar → ASCII (${cols}×${rows})...`);
    const res = await fetch(url, { headers: { 'User-Agent': 'profile-cards' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.buffer();

    const img = await Jimp.read(buffer);
    img.cover(cols, rows).grayscale();

    const chars = ' .:-=+*#%@';
    const maxIdx = chars.length - 1;

    const lines = [];
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const hex = img.getPixelColor(x, y);
        const { r } = Jimp.intToRGBA(hex);
        const idx = Math.round((r / 255) * maxIdx);
        line += chars[idx];
      }
      lines.push(line);
    }
    console.log(`  ✅ ASCII portrait ready (${lines.length} lines × ${cols} cols)`);
    return lines;
  } catch (e) {
    console.log('  ⚠️  avatarToAscii failed:', e.message);
    return [];
  }
}

// ============ ASCII lines → SVG fragment ============
function asciiLinesToSvg(lines, options = {}) {
  const {
    x = 36,
    startY = 105,
    lineHeight = 8,
    fontSize = 9,
    textLength = 408,
    fill = 'url(#scan-ahmedsabrari-aurora-dark-portrait-gradient)',
  } = options;

  return lines.map((line, i) =>
    `<text x="${x}" y="${startY + i * lineHeight}" ` +
    `font-family="ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace" ` +
    `font-size="${fontSize}" textLength="${textLength}" lengthAdjust="spacing" ` +
    `fill="${fill}">` +
    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    `</text>`
  ).join('\n  ');
}

// ============ 9ra custom avatars man JSON ============
function loadCustomAvatars() {
  try {
    const raw = fs.readFileSync('data/custom-avatars.json', 'utf8');
    const data = JSON.parse(raw);
    console.log('  ✅ custom-avatars.json loaded:', Object.keys(data).join(', '));
    return data;
  } catch (e) {
    console.log('  ⚠️  custom-avatars.json ma kaynch wla fih erreur:', e.message);
    return {};
  }
}

// ============ Relative time helper ============
function getRelativeTime(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'updated today';
  if (days < 30) return `updated ${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `updated ${months}mo ago`;
  const years = Math.floor(months / 12);
  return `updated ${years}y ago`;
}

// ============ Build donut SVG (per repo) ============
const DONUT_R = 25;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;

function buildDonut(repo, baseDelay) {
  const langEdges = repo.languages?.edges || [];
  const langs = langEdges
    .map(e => ({ name: e.node.name, color: e.node.color || '#888', size: e.size }))
    .sort((a, b) => b.size - a.size);

  if (langs.length === 0) {
    return `<circle cx="348" cy="92" r="${DONUT_R}" fill="none" stroke="#D9D2C7" stroke-opacity="0.9" stroke-width="8"/><text x="348" y="96" text-anchor="middle" font-family="ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace" font-size="11" font-weight="700" fill="#1F2933">--</text>`;
  }

  const total = langs.reduce((s, l) => s + l.size, 0) || 1;
  const top = langs.slice(0, 4);
  const otherSize = langs.slice(4).reduce((s, l) => s + l.size, 0);

  const segments = top.map(l => ({ color: l.color, size: l.size }));
  if (otherSize > 0) segments.push({ color: '#6B7280', size: otherSize });

  let cumulative = 0;
  let svg = `<circle cx="348" cy="92" r="${DONUT_R}" fill="none" stroke="#D9D2C7" stroke-opacity="0.9" stroke-width="8"/>`;

  segments.forEach((seg, idx) => {
    const pct = seg.size / total;
    const dash = pct * DONUT_CIRC;
    const rest = DONUT_CIRC - dash;
    const offset = -cumulative;
    cumulative += dash;
    const delay = (baseDelay + idx * 0.18).toFixed(2);

    svg += `<circle cx="348" cy="92" r="${DONUT_R}" fill="none" stroke="${seg.color}" stroke-width="8" stroke-dasharray="${dash.toFixed(2)} ${rest.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 348 92)" opacity="0">`;
    svg += `<animate attributeName="opacity" from="0" to="1" dur="0.01s" begin="${delay}s" fill="freeze"/>`;
    svg += `<animate attributeName="stroke-dasharray" from="0 ${DONUT_CIRC}" to="${dash.toFixed(2)} ${rest.toFixed(2)}" dur="0.6s" begin="${delay}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0 0.2 1"/>`;
    svg += `</circle>`;
  });

  const topPct = Math.round((segments[0].size / total) * 100);
  svg += `<text x="348" y="96" text-anchor="middle" font-family="ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace" font-size="11" font-weight="700" fill="#1F2933">${topPct}%</text>`;

  return svg;
}

// ============ CP Panel metrics ============
function buildCpMetrics(u, repos) {
  const contributions = u.contributionsCollection.contributionCalendar.totalContributions;
  const totalRepos = u.repositories.totalCount;
  const followers = u.followers.totalCount;
  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);

  const activityPct = Math.min(100, Math.round((contributions / 500) * 100));
  const projectsPct = Math.min(100, Math.round((totalRepos / 30) * 100));
  const communityPct = Math.min(100, Math.round((followers / 100) * 100));

  const signal = Math.min(10, Math.round(
    Math.log2(contributions + 1) + Math.log2(totalStars + 1) * 1.5
  ));

  const RING_CIRC = 263.89;
  const ringVisible = +((signal / 10) * RING_CIRC).toFixed(2);
  const ringGap = +(RING_CIRC - ringVisible).toFixed(2);

  return {
    cpActivityPct: activityPct,
    cpProjectsPct: projectsPct,
    cpCommunityPct: communityPct,
    cpActivityWidth: +((activityPct / 100) * 360).toFixed(1),
    cpProjectsWidth: +((projectsPct / 100) * 360).toFixed(1),
    cpCommunityWidth: +((communityPct / 100) * 360).toFixed(1),
    cpSignal: signal,
    cpRingDash: `${ringVisible} ${ringGap}`,
  };
}

// ============ Contribution Graph (last 91 days) ============
function buildContributionGraph(days, opts = {}) {
  const {
    chartX0 = 68,
    chartX1 = 830,
    chartY0 = 94,
    chartY1 = 178,
    numDays = 91,
  } = opts;

  const recent = days.slice(-numDays);
  if (recent.length === 0) return {};

  const maxCount = Math.max(1, ...recent.map(d => d.contributionCount));
  const xStep = (chartX1 - chartX0) / Math.max(1, recent.length - 1);

  const points = recent.map((d, i) => ({
    x: chartX0 + i * xStep,
    y: chartY1 - (d.contributionCount / maxCount) * (chartY1 - chartY0),
    count: d.contributionCount,
    date: d.date,
  }));

  const polylinePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const peakIdx = points.reduce((best, p, i) => p.count > points[best].count ? i : best, 0);
  const peak = points[peakIdx];

  const dotIndices = [];
  for (let i = 0; i < recent.length; i += 7) {
    if (i !== peakIdx) dotIndices.push(i);
  }

  const dotsSvg = dotIndices.map((idx, n) => {
    const p = points[idx];
    const delay = (0.20 + n * 0.06).toFixed(2);
    return `<circle class="dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#14B8A6" stroke="#FFFFFF" stroke-width="2" style="animation-delay:${delay}s"/>`;
  }).join('\n    ');

  const labelStep = Math.max(7, Math.floor(recent.length / 7));
  const xLabelsArr = [];
  for (let i = 0; i < recent.length; i += labelStep) {
    const p = points[i];
    const d = new Date(p.date);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    xLabelsArr.push(`<text class="t tick" x="${p.x.toFixed(1)}" y="196" text-anchor="middle">${mm}-${dd}</text>`);
  }

  const peakSvg = peak.count > 0
    ? `<circle class="peak-halo" cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" r="12" fill="url(#glowIndigo)"/>
    <circle class="peak" cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" r="5.5" fill="#4F46E5" stroke="#FFFFFF" stroke-width="2"/>`
    : '';

  return {
    cgPolylinePoints: polylinePoints,
    cgDotsSvg: dotsSvg,
    cgXLabelsSvg: xLabelsArr.join('\n  '),
    cgPeakSvg: peakSvg,
    cgYScaleMax: maxCount,
    cgMaxCount: maxCount,
  };
}

// ============ Highlights metrics ============
function buildHighlights(u, repos, languages, activeDays) {
  const topLang = languages[0] || { name: 'Code' };
  const topLangRepoCount = repos.filter(r =>
    r.primaryLanguage?.name === topLang.name
  ).length;

  const featured = u.pinnedItems.nodes[0] || repos[0] || null;
  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);

  return {
    hlTopLangName: topLang.name,
    hlTopLangRepoCount: topLangRepoCount,
    hlFeaturedName: featured ? featured.name : 'No project',
    hlFeaturedDesc: featured
      ? (featured.description || 'No description').slice(0, 28)
      : 'No description',
    hlImpactStars: totalStars,
    hlImpactActiveDays: activeDays,
  };
}

// ============ Stats Dashboard metrics ============
function buildStatsMetrics(u, repos) {
  const stars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const contributions = u.contributionsCollection.contributionCalendar.totalContributions;
  const totalRepos = u.repositories.totalCount;
  const followers = u.followers.totalCount;

  const maxVal = Math.max(stars, contributions, totalRepos, followers, 1);
  const scale = (v) => Math.max(4, Math.round((v / maxVal) * 136));

  return {
    sdStars: stars,
    sdContributions: contributions,
    sdRepos: totalRepos,
    sdFollowers: followers,
    sdStarsBarWidth: scale(stars),
    sdContributionsBarWidth: scale(contributions),
    sdReposBarWidth: scale(totalRepos),
    sdFollowersBarWidth: scale(followers),
  };
}

// ============ Tech Stack (top 6 languages) ============
function buildTechStack(languages, opts = {}) {
  const { cardX0 = 46, cardStep = 131, maxCards = 6 } = opts;
  return languages.slice(0, maxCards).map((lang, i) => {
    const x = cardX0 + i * cardStep;
    const tileX = x + 32;
    const centerX = x + 57;
    const accent = lang.color || '#4F46E5';
    const shortCode = lang.name.slice(0, 3).toUpperCase();
    return {
      name: lang.name,
      shortCode,
      accent,
      x,
      tileX,
      centerX,
      delay: (0.08 + i * 0.10).toFixed(2),
    };
  });
}

// ============ Split bio l 2 lines ============
function splitBio(bio, maxLen = 55) {
  const raw = (bio || '').trim();
  if (!raw) return { line1: '', line2: '' };
  if (raw.length <= maxLen) return { line1: raw, line2: '' };

  const shortWords = new Set([
    'a', 'an', 'the', 'or', 'and', 'with', 'in', 'on', 'at',
    'to', 'of', 'for', 'by', 'is', 'as', 'my', 'me'
  ]);

  let cut = -1;
  for (let i = Math.min(maxLen, raw.length - 1); i >= 20; i--) {
    if (raw[i] === ' ') {
      const wordStart = raw.lastIndexOf(' ', i - 1) + 1;
      const word = raw.slice(wordStart, i).toLowerCase().replace(/[^a-z]/g, '');
      if (!shortWords.has(word) && word.length > 1) {
        cut = i;
        break;
      }
    }
  }
  if (cut < 0) cut = raw.lastIndexOf(' ', maxLen);
  if (cut < 0) cut = maxLen;

  const line1 = raw.slice(0, cut).trim();
  const rest = raw.slice(cut).trim();

  const maxLine2 = maxLen + 15;
  let line2 = rest;
  if (rest.length > maxLine2) {
    let cut2 = rest.lastIndexOf(' ', maxLine2);
    if (cut2 < 20) cut2 = maxLine2 - 1;
    line2 = rest.slice(0, cut2).trim() + '…';
  }
  return { line1, line2 };
}

function computeLanguages(repos) {
  const map = new Map();
  for (const r of repos) {
    for (const e of r.languages?.edges || []) {
      const k = e.node.name;
      const cur = map.get(k) || { size: 0, color: e.node.color };
      cur.size += e.size;
      map.set(k, cur);
    }
  }
  const total = [...map.values()].reduce((s, v) => s + v.size, 0) || 1;
  return [...map.entries()]
    .map(([name, v]) => {
      const percent = +(v.size / total * 100).toFixed(1);
      return {
        name,
        color: v.color || '#888',
        percent,
        barWidth: Math.round((percent / 100) * 195),
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

async function main() {
  console.log('Fetching', USER);
  const u = await gql();
  const repos = u.repositories.nodes;
  const days = u.contributionsCollection.contributionCalendar.weeks
    .flatMap(w => w.contributionDays)
    .slice(-371);

  // GitHub avatar (base64)
  const avatarBase64 = await fetchAvatarBase64(u.avatarUrl);

  // ASCII portrait
  const asciiLines = await avatarToAscii(u.avatarUrl, 65, 55);
  const avatarAsciiSvg = asciiLinesToSvg(asciiLines);

  // Custom avatars
  const custom = loadCustomAvatars();

  // Languages (computed once)
  const languages = computeLanguages(repos);

  // CP metrics
  const cpMetrics = buildCpMetrics(u, repos);

  // Contribution graph
  const cgMetrics = buildContributionGraph(days);

  const { line1: bioLine1, line2: bioLine2 } = splitBio(u.bio || '', 55);
  const activeDays = days.filter(d => d.contributionCount > 0).length;

  // Highlights
  const hlMetrics = buildHighlights(u, repos, languages, activeDays);

  // Stats Dashboard
  const sdMetrics = buildStatsMetrics(u, repos);

  // Tech Stack
  const techStack = buildTechStack(languages, { cardX0: 46, cardStep: 131, maxCards: 6 });

  const stats = {
    activeDays,
    name: u.name || u.login,
    username: u.login,
    bio: u.bio || '',
    bioLine1,
    bioLine2,
    location: u.location || '',
    company: u.company || '',
    joined: u.createdAt,

    avatar: avatarBase64,
    avatar6: custom.hero    || avatarBase64,
    avatar1: custom.squad1  || avatarBase64,
    avatar2: custom.squad2  || avatarBase64,
    avatar3: custom.squad3  || avatarBase64,
    avatar4: custom.squad4  || avatarBase64,
    avatar5: custom.squad5  || avatarBase64,

    avatarAsciiSvg,

    followers: u.followers.totalCount,
    following: u.following.totalCount,
    totalRepos: u.repositories.totalCount,
    totalStars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    totalForks: repos.reduce((s, r) => s + r.forkCount, 0),
    contributions: u.contributionsCollection.contributionCalendar.totalContributions,
    commits: u.contributionsCollection.totalCommitContributions,
    prs: u.contributionsCollection.totalPullRequestContributions,
    issues: u.contributionsCollection.totalIssueContributions,
    reposWithCommits: u.contributionsCollection.totalRepositoriesWithContributedCommits,

    // CP Panel metrics
    ...cpMetrics,

    // Contribution Graph
    ...cgMetrics,

    // Highlights
    ...hlMetrics,

    // Stats Dashboard
    ...sdMetrics,

    // Tech Stack
    techStack,

    // Top repos — 2 cols × 3 rows + donut
    topRepos: repos.slice(0, 6).map((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 28 + col * 410;
      const y = 88 + row * 178;
      const lang = r.primaryLanguage?.name || 'Code';
      const chipWidth = Math.max(35, lang.length * 8 + 12);
      const baseDelay = 0.25 + i * 0.15;

      return {
        name: r.name,
        description: (r.description || 'No description provided.').slice(0, 42),
        url: r.url,
        stars: r.stargazerCount,
        forks: r.forkCount,
        language: lang,
        color: r.primaryLanguage?.color || '#888',
        updated: getRelativeTime(r.updatedAt),
        x,
        y,
        chipTextX: 18 + chipWidth / 2,
        chipWidth,
        delay: baseDelay.toFixed(2),
        donutSvg: buildDonut(r, baseDelay + 0.30),
      };
    }),

    pinned: u.pinnedItems.nodes.map(r => ({
      name: r.name,
      description: r.description || '',
      url: r.url,
      stars: r.stargazerCount,
      language: r.primaryLanguage?.name || '',
      color: r.primaryLanguage?.color || '#888',
    })),

    languages: languages.slice(0, 8),
    heatmapDays: days,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/stats.json', JSON.stringify(stats, null, 2));
  console.log('✅ data/stats.json');
  console.log('   stars:', stats.totalStars);
  console.log('   contributions:', stats.contributions);
  console.log('   repos:', stats.totalRepos);
  console.log('   custom avatars:', Object.keys(custom).length, '/ 6');
  console.log('   ascii lines:', asciiLines.length);
  console.log('   topRepos:', stats.topRepos.length);
  console.log('   cpSignal:', stats.cpSignal);
  console.log('   cgMaxCount:', stats.cgMaxCount);
  console.log('   hlTopLang:', stats.hlTopLangName, `(${stats.hlTopLangRepoCount} repos)`);
  console.log('   hlFeatured:', stats.hlFeaturedName);
  console.log('   sdStars:', stats.sdStars, '|', stats.sdContributions, '|', stats.sdRepos, '|', stats.sdFollowers);
  console.log('   techStack:', stats.techStack.map(t => t.name).join(', '));
  console.log('   avatar size:', (avatarBase64.length / 1024).toFixed(1), 'KB');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });