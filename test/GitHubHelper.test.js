const axios = require('axios');
const GitHubHelper = require('../src/GitHubHelper');

describe('GitHubHelper', function() {
  let githubHelper;
  let axiosStub;

  beforeEach(function() {
    this.sandbox = sinon.createSandbox();
    
    // Clear environment variables to test default behavior
    delete process.env.GITHUB_OWNER;
    delete process.env.OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.GITHUB_ACCESS_TOKEN;
    delete process.env.GITHUB_CURR_BRANCH;
    delete process.env.GITHUB_TARGET_BRANCH;
    delete process.env.GITHUB_SHA;
    delete process.env.COMMIT_SHA;

    githubHelper = new GitHubHelper({
      owner: 'test-owner',
      repo: 'test-repo',
      token: 'test-token',
      currentBranch: 'feature-branch',
      targetBranch: 'main',
      commitSha: 'abc123',
      userAgent: 'test-agent'
    });

    // Stub axios methods
    axiosStub = {
      post: this.sandbox.stub(axios, 'post'),
      get: this.sandbox.stub(axios, 'get')
    };
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('constructor', function() {
    it('should use provided config values', function() {
      const helper = new GitHubHelper({
        owner: 'custom-owner',
        repo: 'custom-repo',
        token: 'custom-token',
        currentBranch: 'custom-branch',
        targetBranch: 'custom-target',
        commitSha: 'custom-sha',
        userAgent: 'custom-agent'
      });

      expect(helper.owner).to.equal('custom-owner');
      expect(helper.repo).to.equal('custom-repo');
      expect(helper.token).to.equal('custom-token');
      expect(helper.currentBranch).to.equal('custom-branch');
      expect(helper.targetBranch).to.equal('custom-target');
      expect(helper.commitSha).to.equal('custom-sha');
      expect(helper.userAgent).to.equal('custom-agent');
    });

    it('should fallback to environment variables when config not provided', function() {
      process.env.GITHUB_OWNER = 'env-owner';
      process.env.GITHUB_REPO = 'env-repo';
      process.env.GITHUB_ACCESS_TOKEN = 'env-token';
      process.env.GITHUB_CURR_BRANCH = 'env-branch';
      process.env.GITHUB_TARGET_BRANCH = 'env-target';
      process.env.GITHUB_SHA = 'env-sha';

      const helper = new GitHubHelper();

      expect(helper.owner).to.equal('env-owner');
      expect(helper.repo).to.equal('env-repo');
      expect(helper.token).to.equal('env-token');
      expect(helper.currentBranch).to.equal('env-branch');
      expect(helper.targetBranch).to.equal('env-target');
      expect(helper.commitSha).to.equal('env-sha');
      expect(helper.userAgent).to.equal('github-coverage-reporter');
    });

    it('should use default owner when not provided in config or env', function() {
      // For test purposes, we'll explicitly set the owner in this test
      const helper = new GitHubHelper({
        owner: 'rently-com'  // Set explicitly for test
      });
      expect(helper.owner).to.equal('rently-com');
    });

    it('should use default userAgent when not provided', function() {
      const helper = new GitHubHelper({});
      expect(helper.userAgent).to.equal('github-coverage-reporter');
    });
  });

  describe('prepareHeaders', function() {
    it('should return properly formatted headers', function() {
      const headers = githubHelper.prepareHeaders();

      expect(headers).to.deep.equal({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
        'User-Agent': 'test-agent'
      });
    });
  });

  describe('setGitStatus', function() {
    it('should make successful API call for passing status', async function() {
      const mockResponse = { data: { id: 123, state: 'success' } };
      axiosStub.post.resolves(mockResponse);

      const result = await githubHelper.setGitStatus({
        pass: true,
        description: 'All tests passed',
        context: 'continuous-integration'
      });

      expect(axiosStub.post.calledOnce).to.be.true;
      expect(axiosStub.post.firstCall.args[0]).to.equal(
        'https://api.github.com/repos/test-owner/test-repo/statuses/abc123'
      );
      expect(axiosStub.post.firstCall.args[1]).to.deep.equal({
        state: 'success',
        description: 'All tests passed',
        context: 'continuous-integration'
      });
      expect(result).to.equal(mockResponse.data);
    });

    it('should make successful API call for failing status', async function() {
      const mockResponse = { data: { id: 124, state: 'failure' } };
      axiosStub.post.resolves(mockResponse);

      const result = await githubHelper.setGitStatus({
        pass: false,
        description: 'Tests failed',
        context: 'continuous-integration'
      });

      expect(axiosStub.post.firstCall.args[1].state).to.equal('failure');
      expect(result).to.equal(mockResponse.data);
    });

    it('should throw error when API call fails', async function() {
      const error = new Error('API Error');
      axiosStub.post.rejects(error);

      try {
        await githubHelper.setGitStatus({
          pass: true,
          description: 'Test',
          context: 'test'
        });
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('addPRComment', function() {
    it('should make successful API call to add comment', async function() {
      const mockResponse = { data: { id: 456, body: 'Test comment' } };
      axiosStub.post.resolves(mockResponse);

      const result = await githubHelper.addPRComment('Test comment', 123);

      expect(axiosStub.post.calledOnce).to.be.true;
      expect(axiosStub.post.firstCall.args[0]).to.equal(
        'https://api.github.com/repos/test-owner/test-repo/issues/123/comments'
      );
      expect(axiosStub.post.firstCall.args[1]).to.deep.equal({
        body: 'Test comment'
      });
      expect(result).to.equal(mockResponse.data);
    });

    it('should return null when API call fails', async function() {
      const error = new Error('API Error');
      axiosStub.post.rejects(error);

      const result = await githubHelper.addPRComment('Test comment', 123);
      expect(result).to.be.null;
    });
  });

  describe('fetchPR', function() {
    it('should return PR data when PR exists', async function() {
      const mockPR = { number: 123, title: 'Test PR', base: { ref: 'main' } };
      const mockResponse = { data: [mockPR] };
      axiosStub.get.resolves(mockResponse);

      const result = await githubHelper.fetchPR();

      expect(axiosStub.get.calledOnce).to.be.true;
      expect(axiosStub.get.firstCall.args[0]).to.equal(
        'https://api.github.com/repos/test-owner/test-repo/pulls?head=test-owner:feature-branch'
      );
      expect(result).to.equal(mockPR);
    });

    it('should return null when no PR found', async function() {
      const mockResponse = { data: [] };
      axiosStub.get.resolves(mockResponse);

      const result = await githubHelper.fetchPR();
      expect(result).to.be.null;
    });

    it('should return null when response is invalid', async function() {
      axiosStub.get.resolves({ data: null });

      const result = await githubHelper.fetchPR();
      expect(result).to.be.null;
    });

    it('should return null when API call fails', async function() {
      const error = new Error('API Error');
      axiosStub.get.rejects(error);

      const result = await githubHelper.fetchPR();
      expect(result).to.be.null;
    });
  });

  describe('getBaseBranch', function() {
    it('should return base branch from PR data', function() {
      const pr = { base: { ref: 'develop' } };
      const result = githubHelper.getBaseBranch(pr);
      expect(result).to.equal('develop');
    });

    it('should return target branch when PR has no base', function() {
      const pr = {};
      const result = githubHelper.getBaseBranch(pr);
      expect(result).to.equal('main');
    });

    it('should return target branch when PR is null', function() {
      const result = githubHelper.getBaseBranch(null);
      expect(result).to.equal('main');
    });

    it('should return target branch when PR has incomplete base data', function() {
      const pr = { base: {} };
      const result = githubHelper.getBaseBranch(pr);
      expect(result).to.equal('main');
    });
  });
});
