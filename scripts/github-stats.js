const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

class GitHubStatsGenerator {
  constructor(token) {
    this.octokit = new Octokit({ 
      auth: token || process.env.GITHUB_TOKEN,
      userAgent: 'ahmedsabrari-stats v1.0'
    });
    this.username = 'ahmedsabrari';
    this.statsData = {};
  }

  async getUserStats() {
    try {
      const { data } = await this.octokit.users.getByUsername({
        username: this.username
      });
      
      this.statsData.user = {
        name: data.name,
        login: data.login,
        public_repos: data.public_repos,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at
      };
      
      console.log('✅ User stats fetched');
    } catch (error) {
      console.error('❌ Error fetching user stats:', error.message);
    }
  }

  async getRepositories() {
    try {
      const repos = [];
      let page = 1;
      let hasNext = true;
      
      while (hasNext) {
        const { data } = await this.octokit.repos.listForUser({
          username: this.username,
          per_page: 100,
          page: page,
          sort: 'updated',
          direction: 'desc'
        });
        
        repos.push(...data);
        
        if (data.length < 100) {
          hasNext = false;
        } else {
          page++;
        }
      }
      
      this.statsData.repositories = repos;
      
      // Calculate total stars
      const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
      
      // Calculate languages distribution
      const languages = {};
      repos.forEach(repo => {
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
      });
      
      this.statsData.totals = {
        stars: totalStars,
        forks: repos.reduce((sum, repo) => sum + repo.forks_count, 0),
        watchers: repos.reduce((sum, repo) => sum + repo.watchers_count, 0)
      };
      
      this.statsData.languages = languages;
      
      console.log(`✅ Fetched ${repos.length} repositories`);
    } catch (error) {
      console.error('❌ Error fetching repositories:', error.message);
    }
  }

  async getContributionData() {
    try {
      // GitHub GraphQL API for contributions
      const query = `
        query($userName:String!) {
          user(login: $userName) {
            contributionsCollection {
              totalCommitContributions
              totalIssueContributions
              totalPullRequestContributions
              totalRepositoryContributions
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await this.octokit.graphql({
        query,
        userName: this.username
      });
      
      this.statsData.contributions = response.user.contributionsCollection;
      console.log('✅ Contribution data fetched');
    } catch (error) {
      console.error('❌ Error fetching contribution data:', error.message);
    }
  }

  calculateStreak() {
    if (!this.statsData.contributions) return 0;
    
    const calendar = this.statsData.contributions.contributionCalendar;
    const weeks = calendar.weeks;
    let currentStreak = 0;
    let longestStreak = 0;
    
    // Flatten all contribution days
    const allDays = weeks.flatMap(week => week.contributionDays);
    
    // Sort by date
    allDays.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate streaks
    for (const day of allDays) {
      if (day.contributionCount > 0) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    this.statsData.streak = {
      current: currentStreak,
      longest: longestStreak,
      total: calendar.totalContributions
    };
    
    return longestStreak;
  }

  getPopularRepos(limit = 4) {
    if (!this.statsData.repositories) return [];
    
    return this.statsData.repositories
      .filter(repo => !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, limit);
  }

  async generateAllStats() {
    console.log('🚀 Starting GitHub stats generation...');
    
    await this.getUserStats();
    await this.getRepositories();
    await this.getContributionData();
    this.calculateStreak();
    
    // Save data to file
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(dataDir, 'github-stats.json'),
      JSON.stringify(this.statsData, null, 2)
    );
    
    console.log('✅ All stats generated and saved!');
    
    return this.statsData;
  }
}

module.exports = GitHubStatsGenerator;