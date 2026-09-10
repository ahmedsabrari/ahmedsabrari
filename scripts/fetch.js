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
    .map(([name, v]) => ({ name, color: v.color || '#888', percent: +(v.size / total * 100).toFixed(1) }))
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

  const stats = {
    name: u.name || u.login,
    username: u.login,
    bio: u.bio || '',
    location: u.location || '',
    company: u.company || '',
    joined: u.createdAt,
    avatar: avatarBase64,           // ← base64 daba
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