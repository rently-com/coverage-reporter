const axios = require('axios');

class GitHubHelper {
  constructor(config = {}) {
    this.owner = config.owner || process.env.GITHUB_OWNER || process.env.OWNER;
    this.repo = config.repo || process.env.GITHUB_REPO;
    this.token = config.token || process.env.GITHUB_ACCESS_TOKEN;
    this.currentBranch = config.currentBranch || process.env.GITHUB_CURR_BRANCH;
    this.targetBranch = config.targetBranch || process.env.GITHUB_TARGET_BRANCH || config.defaultTargetBranch;
    this.commitSha = config.commitSha || process.env.GITHUB_SHA || process.env.COMMIT_SHA;
    this.userAgent = config.userAgent || 'github-coverage-reporter';
  }

  prepareHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'User-Agent': this.userAgent,
    };
  }

  async setGitStatus({ pass, description, context }) {
    const params = {
      state: pass ? 'success' : 'failure',
      description,
      context,
    };

    const headers = this.prepareHeaders();

    try {
      const response = await axios.post(
        `https://api.github.com/repos/${this.owner}/${this.repo}/statuses/${this.commitSha}`,
        params,
        { headers }
      );
      return response.data;
    } catch (err) {
      console.log('Error setting Git status:', err);
      throw err;
    }
  }

  async addPRComment(body, prNumber) {
    const headers = this.prepareHeaders();

    try {
      const response = await axios.post(
        `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${prNumber}/comments`,
        { body },
        { headers }
      );
      return response.data;
    } catch (err) {
      console.log('Error adding PR comment:', err);
      return null;
    }
  }

  async fetchPR() {
    const headers = this.prepareHeaders();

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.owner}/${this.repo}/pulls?head=${this.owner}:${this.currentBranch}`,
        { headers }
      );
      
      if (response && response.data && response.data[0]) {
        return response.data[0];
      }

      console.log('No PR found for the current branch');
      return null;
    } catch (err) {
      console.log('Error fetching PR:', err);
      return null;
    }
  }

  getBaseBranch(pr) {
    if (pr && pr.base && pr.base.ref) {
      return pr.base.ref;
    }
    return this.targetBranch;
  }
}

module.exports = GitHubHelper;
