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

  const { line1: bioLine1, line2: bioLine2 } = splitBio(u.bio || '', 55);
  const activeDays = days.filter(d => d.contributionCount > 0).length;

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

    avatarAsciiSvg,                    // ← ASCII portrait (SVG fragment)

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
    topRepos: repos.slice(0, 6).map(r => ({
      name: r.name,
      description: r.description || '',
      url: r.url,
      stars: r.stargazerCount,
      forks: r.forkCount,
      language: r.primaryLanguage?.name || '',
      color: r.primaryLanguage?.color || '#888',
    })),
    pinned: u.pinnedItems.nodes.map(r => ({
      name: r.name,
      description: r.description || '',
      url: r.url,
      stars: r.stargazerCount,
      language: r.primaryLanguage?.name || '',
      color: r.primaryLanguage?.color || '#888',
    })),
    languages: computeLanguages(repos).slice(0, 8),
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
  console.log('   avatar size:', (avatarBase64.length / 1024).toFixed(1), 'KB');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });