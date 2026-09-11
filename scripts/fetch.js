import fetch from 'node-fetch';
import fs from 'fs';

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

// ============ Jdid: Téléchargi avatar → base64 ============
async function fetchAvatarBase64(url) {
  console.log('  Downloading avatar...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'profile-cards' },
  });
  if (!res.ok) throw new Error(`Avatar fetch failed: ${res.status}`);
  const buffer = await res.buffer();
  const contentType = res.headers.get('content-type') || 'image/png';
  const base64 = buffer.toString('base64');
  console.log(`  ✅ Avatar: ${(buffer.length / 1024).toFixed(1)} KB`);
  return `data:${contentType};base64,${base64}`;
}
// ============ Split bio l 2 lines intelligently ============
function splitBio(bio, maxLen = 55) {
  const raw = (bio || '').trim();
  if (!raw) return { line1: '', line2: '' };
  if (raw.length <= maxLen) return { line1: raw, line2: '' };

  // Words 9sar li ma bghinach line1 tkml bihom
  const shortWords = new Set([
    'a', 'an', 'the', 'or', 'and', 'with', 'in', 'on', 'at',
    'to', 'of', 'for', 'by', 'is', 'as', 'my', 'me'
  ]);

  // 9elleb 3la space mzyan qrib man maxLen
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

  // Line2 momkin tkoun chwiya twil (maxLen + 15)
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
        barWidth: Math.round((percent / 100) * 195),  // ← Jdid
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

  // Jib avatar base64
  const avatarBase64 = await fetchAvatarBase64(u.avatarUrl);
  const { line1: bioLine1, line2: bioLine2 } = splitBio(u.bio || '', 55);
  const activeDays = days.filter(d => d.contributionCount > 0).length;

  const stats = {
    activeDays,
    name: u.name || u.login,
    username: u.login,
    bio: u.bio || '',
    bioLine1: bioLine1, 
    bioLine2: bioLine2,
    location: u.location || '',
    company: u.company || '',
    joined: u.createdAt,
    avatar: avatarBase64,           // ← base64 daba
    avatar1: avatarBase64,
    avatar2: avatarBase64,
    avatar3: avatarBase64,
    avatar4: avatarBase64,
    avatar5: avatarBase64,
    avatar6: avatarBase64,
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
  console.log('   avatar size:', (avatarBase64.length / 1024).toFixed(1), 'KB');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });