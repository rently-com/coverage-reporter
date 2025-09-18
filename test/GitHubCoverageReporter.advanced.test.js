const { expect } = require('chai');
const sinon = require('sinon');

const GitHubCoverageReporter = require('../index');
const ConfigManager = require('../src/ConfigManager');
const GitHubHelper = require('../src/GitHubHelper');
const CoverageReporter = require('../src/CoverageReporter');
const CoverageParser = require('../src/CoverageParser');

describe('GitHubCoverageReporter - Advanced Features', () => {
  let sandbox;
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
    
    // Set up test environment variables
    process.env.FILE_NAME = 'coverage';
    process.env.BACKEND_COVERAGE_SUMMARY_JSON_PATH = 'artifacts/coverage-summary.json';
    process.env.FRONTEND_COVERAGE_SUMMARY_JSON_PATH = 'frontend/coverage/coverage-summary.json';
    process.env.LAMBDA_COVERAGE_SUMMARY_JSON_PATH = 'lambda/coverage/coverage-summary.json';
    process.env.GITHUB_CURR_BRANCH = 'test-branch';
    
    sandbox = sinon.createSandbox();
    
    // Stub console methods to reduce noise
    sandbox.stub(console, 'log');
    sandbox.stub(console, 'warn');
    sandbox.stub(console, 'error');
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    
    sandbox.restore();
  });

  describe('constructor with config file', () => {
    it('should load configuration from .gcr.json file', () => {
      const mockConfig = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 },
            { name: 'frontend', filePath: './frontend/coverage.json', threshold: 75 }
          ]
        },
        config: {
          features: {
            addComments: true,
            setStatusChecks: true,
            storeInS3: false
          },
          maxCoverageDiff: 5,
          s3: {
            bucketName: 'test-bucket',
            fileName: 'test-coverage.json'
          },
          github: {
            owner: 'test-owner',
            repo: 'test-repo'
          }
        }
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').returns(mockConfig);
      sandbox.stub(ConfigManager, 'getFeatures').returns(mockConfig.config.features);
      sandbox.stub(ConfigManager, 'getS3Config').returns(mockConfig.config.s3);
      sandbox.stub(ConfigManager, 'getGitHubConfig').returns(mockConfig.config.github);
      sandbox.stub(ConfigManager, 'getMaxCoverageDiff').returns(5);
      
      const reporter = new GitHubCoverageReporter();
      
      expect(reporter.config).to.equal(mockConfig);
      expect(reporter.options.storeInS3).to.be.false;
      expect(reporter.options.fileName).to.equal('test-coverage.json');
      expect(reporter.coverageReporter).to.be.instanceOf(CoverageReporter);
    });

    it('should handle config with coverage types for threshold mapping', () => {
      const mockConfig = {
        coverage: {
          types: [
            { name: 'backend', threshold: 80 },
            { name: 'frontend', threshold: 75 }
          ]
        },
        config: {
          maxCoverageDiff: 3
        }
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').returns(mockConfig);
      sandbox.stub(ConfigManager, 'getFeatures').returns({});
      sandbox.stub(ConfigManager, 'getS3Config').returns({});
      sandbox.stub(ConfigManager, 'getGitHubConfig').returns({});
      sandbox.stub(ConfigManager, 'getMaxCoverageDiff').returns(3);
      
      const reporter = new GitHubCoverageReporter();
      
      expect(reporter.options.coverageTypes).to.deep.equal(['backend', 'frontend']);
    });
  });

  describe('run method - multi-type coverage', () => {
    let reporter;
    let mockGitHubHelper;
    let mockS3Helper;
    let mockCoverageReporter;

    beforeEach(() => {
      mockGitHubHelper = {
        fetchPR: sandbox.stub(),
        setGitStatus: sandbox.stub(),
        addPRComment: sandbox.stub(),
        getBaseBranch: sandbox.stub().returns('main')
      };
      
      mockS3Helper = {
        getCoverageJsonFile: sandbox.stub(),
        upload: sandbox.stub()
      };
      
      mockCoverageReporter = {
        generateStatusChecks: sandbox.stub(),
        generateDiffStatusCheck: sandbox.stub(),
        generateCoverageComment: sandbox.stub()
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').throws(new Error('Config not found'));
      sandbox.stub(CoverageParser, 'parseSingleFile').returns(85.5);
      
      reporter = new GitHubCoverageReporter({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      });
      
      reporter.githubHelper = mockGitHubHelper;
      reporter.s3Helper = mockS3Helper;
      reporter.coverageReporter = mockCoverageReporter;
      
      sandbox.stub(reporter, 'parseCoverageFromFile').returns(85.5);
      sandbox.stub(reporter, 'updateS3Coverage').resolves();
    });

    it('should handle multi-type coverage with PR found', async () => {
      const mockPR = { number: 123, base: { ref: 'main' } };
      const mockPrevCoverage = { main: { backend: 80, frontend: 75 } };
      
      mockGitHubHelper.fetchPR.resolves(mockPR);
      mockS3Helper.getCoverageJsonFile.resolves(mockPrevCoverage);
      mockCoverageReporter.generateStatusChecks.returns({ state: 'success' });
      mockCoverageReporter.generateDiffStatusCheck.returns({ state: 'success' });
      mockCoverageReporter.generateCoverageComment.returns('Test coverage comment');
      
      const result = await reporter.run(null, {
        coverageTypes: ['backend', 'frontend'],
        addComment: true
      });
      
      expect(result.success).to.be.true;
      expect(result.coverageTypes).to.deep.equal(['backend', 'frontend']);
      expect(result.currentCoverage).to.deep.equal({ backend: 85.5, frontend: 85.5 });
      expect(result.previousCoverage).to.deep.equal({ backend: 80, frontend: 75 });
      expect(result.pr).to.equal(123);
      
      // setGitStatus called 4 times: 2 types × 2 calls each (threshold + diff)
      expect(mockGitHubHelper.setGitStatus.callCount).to.equal(4);
      expect(mockGitHubHelper.addPRComment.calledOnce).to.be.true;
      expect(reporter.updateS3Coverage.calledTwice).to.be.true;
    });

    it('should handle multi-type coverage without PR', async () => {
      mockGitHubHelper.fetchPR.resolves(null);
      mockCoverageReporter.generateStatusChecks.returns({ state: 'success' });
      mockCoverageReporter.generateDiffStatusCheck.returns({ state: 'success' });
      
      const result = await reporter.run(null, {
        coverageTypes: ['backend', 'frontend']
      });
      
      expect(result.success).to.be.true;
      expect(result.pr).to.be.null;
      expect(console.log.calledWith('No PR found, skipping comment creation')).to.be.true;
    });

    it('should handle multi-type coverage with addComment disabled', async () => {
      const mockPR = { number: 123 };
      mockGitHubHelper.fetchPR.resolves(mockPR);
      mockS3Helper.getCoverageJsonFile.resolves({});
      
      await reporter.run(null, {
        coverageTypes: ['backend', 'frontend'],
        addComment: false
      });
      
      expect(mockGitHubHelper.addPRComment.called).to.be.false;
    });
  });

  describe('run method - single type coverage', () => {
    let reporter;
    let mockGitHubHelper;
    let mockS3Helper;
    let mockCoverageReporter;

    beforeEach(() => {
      mockGitHubHelper = {
        fetchPR: sandbox.stub(),
        setGitStatus: sandbox.stub(),
        addPRComment: sandbox.stub(),
        getBaseBranch: sandbox.stub().returns('main')
      };
      
      mockS3Helper = {
        getCoverageJsonFile: sandbox.stub(),
        upload: sandbox.stub()
      };
      
      mockCoverageReporter = {
        generateStatusChecks: sandbox.stub(),
        generateDiffStatusCheck: sandbox.stub(),
        generateCoverageComment: sandbox.stub()
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').throws(new Error('Config not found'));
      
      reporter = new GitHubCoverageReporter({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true,
        coverageType: 'backend'
      });
      
      reporter.githubHelper = mockGitHubHelper;
      reporter.s3Helper = mockS3Helper;
      reporter.coverageReporter = mockCoverageReporter;
      
      sandbox.stub(reporter, 'parseCoverageFromFile').returns(85.5);
      sandbox.stub(reporter, 'addCoverageComment').resolves();
      sandbox.stub(reporter, 'updateS3Coverage').resolves();
      sandbox.stub(reporter, 'setStatusChecks').resolves();
    });

    it('should handle single type coverage with all features enabled', async () => {
      const mockPR = { number: 123 };
      const mockPrevCoverage = { main: { backend: 80 } };
      
      mockGitHubHelper.fetchPR.resolves(mockPR);
      mockS3Helper.getCoverageJsonFile.resolves(mockPrevCoverage);
      
      const result = await reporter.run(90.5);
      
      expect(result.success).to.be.true;
      expect(result.coverageType).to.equal('backend');
      expect(result.currentCoverage).to.equal(90.5);
      expect(result.previousCoverage).to.equal(80);
      expect(result.pr).to.equal(123);
      
      expect(reporter.setStatusChecks.calledWith(90.5, 80, 'backend')).to.be.true;
      expect(reporter.addCoverageComment.calledWith(90.5, 80, 'backend', 123)).to.be.true;
      expect(reporter.updateS3Coverage.called).to.be.true;
    });

    it('should handle single type coverage without S3 helper', async () => {
      reporter.s3Helper = null;
      reporter.options.storeInS3 = false;
      
      const mockPR = { number: 123 };
      mockGitHubHelper.fetchPR.resolves(mockPR);
      
      const result = await reporter.run(85.5);
      
      expect(result.success).to.be.true;
      expect(result.previousCoverage).to.equal(0);
      expect(reporter.updateS3Coverage.called).to.be.false;
    });

    it('should handle errors in run method', async () => {
      mockGitHubHelper.fetchPR.rejects(new Error('GitHub API error'));
      
      try {
        await reporter.run(85.5);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('GitHub API error');
        expect(console.log.calledWith('Error in GitHubCoverageReporter:', error)).to.be.true;
      }
    });
  });

  describe('parseCoverageFromFile with config', () => {
    let reporter;

    beforeEach(() => {
      const mockConfig = {
        coverage: {
          types: [
            { name: 'backend', filePath: './custom/backend.json', threshold: 80 }
          ]
        }
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').returns(mockConfig);
      sandbox.stub(ConfigManager, 'getFeatures').returns({});
      sandbox.stub(ConfigManager, 'getS3Config').returns({});
      sandbox.stub(ConfigManager, 'getGitHubConfig').returns({});
      sandbox.stub(ConfigManager, 'getCoveragePath').returns('./custom/backend.json');
      sandbox.stub(CoverageParser, 'parseSingleFile').returns(88.0);
      
      reporter = new GitHubCoverageReporter();
    });

    it('should use config file path when available', () => {
      const result = reporter.parseCoverageFromFile({ coverageType: 'backend' });
      
      expect(ConfigManager.getCoveragePath.calledWith('backend', reporter.config)).to.be.true;
      expect(CoverageParser.parseSingleFile.calledWith('./custom/backend.json')).to.be.true;
      expect(result).to.equal(88.0);
      expect(console.log.calledWith('Parsing backend coverage from (config path): ./custom/backend.json')).to.be.true;
    });

    it('should fallback to environment variables when config path fails', () => {
      ConfigManager.getCoveragePath.throws(new Error('Path not found in config'));
      sandbox.stub(reporter, 'getDefaultFilePath').returns('./env/backend.json');
      
      const result = reporter.parseCoverageFromFile({ coverageType: 'backend' });
      
      expect(console.log.calledWith('No path found in config for backend, trying environment variables...')).to.be.true;
      expect(console.log.calledWith('Parsing backend coverage from (env path): ./env/backend.json')).to.be.true;
      expect(result).to.equal(88.0);
    });
  });

  describe('updateS3Coverage', () => {
    let reporter;
    let mockS3Helper;

    beforeEach(() => {
      mockS3Helper = {
        upload: sandbox.stub()
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').throws(new Error('Config not found'));
      
      reporter = new GitHubCoverageReporter({
        fileName: 'test-coverage.json'
      });
      reporter.s3Helper = mockS3Helper;
    });

    it('should upload coverage data to S3 successfully', async () => {
      const prevCoverageJson = {
        main: { backend: 80 }
      };
      
      mockS3Helper.upload.resolves();
      
      await reporter.updateS3Coverage(prevCoverageJson, 'frontend', 75.5);
      
      const expectedData = {
        main: { backend: 80 },
        'test-branch': { frontend: 75.5 }
      };
      
      expect(mockS3Helper.upload.calledWith('test-coverage.json', JSON.stringify(expectedData))).to.be.true;
      expect(console.log.calledWith('frontend coverage data uploaded to S3 successfully')).to.be.true;
    });

    it('should handle S3 upload errors', async () => {
      const prevCoverageJson = {};
      mockS3Helper.upload.rejects(new Error('S3 upload failed'));
      
      try {
        await reporter.updateS3Coverage(prevCoverageJson, 'backend', 85.5);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('S3 upload failed');
        expect(console.log.calledWith('Error uploading backend coverage data:', error)).to.be.true;
      }
    });
  });

  describe('addCoverageComment', () => {
    let reporter;
    let mockGitHubHelper;
    let mockCoverageReporter;

    beforeEach(() => {
      mockGitHubHelper = {
        addPRComment: sandbox.stub()
      };
      
      mockCoverageReporter = {
        generateCoverageComment: sandbox.stub()
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').throws(new Error('Config not found'));
      
      reporter = new GitHubCoverageReporter();
      reporter.githubHelper = mockGitHubHelper;
      reporter.coverageReporter = mockCoverageReporter;
    });

    it('should add coverage comment to PR', async () => {
      mockCoverageReporter.generateCoverageComment.returns('Coverage report comment');
      
      await reporter.addCoverageComment(85.5, 80.0, 'backend', 123);
      
      expect(mockCoverageReporter.generateCoverageComment.calledWith(
        { backend: 80.0 },
        { backend: 85.5 },
        ['backend']
      )).to.be.true;
      expect(mockGitHubHelper.addPRComment.calledWith('Coverage report comment', 123)).to.be.true;
    });
  });

  describe('setStatusChecks', () => {
    let reporter;
    let mockGitHubHelper;
    let mockCoverageReporter;

    beforeEach(() => {
      mockGitHubHelper = {
        setGitStatus: sandbox.stub()
      };
      
      mockCoverageReporter = {
        generateStatusChecks: sandbox.stub(),
        generateDiffStatusCheck: sandbox.stub()
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').throws(new Error('Config not found'));
      
      reporter = new GitHubCoverageReporter();
      reporter.githubHelper = mockGitHubHelper;
      reporter.coverageReporter = mockCoverageReporter;
    });

    it('should set threshold and diff status checks', async () => {
      const thresholdCheck = { state: 'success', description: 'Coverage above threshold' };
      const diffCheck = { state: 'success', description: 'Coverage improved' };
      
      mockCoverageReporter.generateStatusChecks.returns(thresholdCheck);
      mockCoverageReporter.generateDiffStatusCheck.returns(diffCheck);
      
      await reporter.setStatusChecks(85.5, 80.0, 'backend');
      
      expect(mockCoverageReporter.generateStatusChecks.calledWith(85.5, 'backend')).to.be.true;
      expect(mockCoverageReporter.generateDiffStatusCheck.calledWith(80.0, 85.5, 'backend')).to.be.true;
      expect(mockGitHubHelper.setGitStatus.calledTwice).to.be.true;
      expect(mockGitHubHelper.setGitStatus.firstCall.calledWith(thresholdCheck)).to.be.true;
      expect(mockGitHubHelper.setGitStatus.secondCall.calledWith(diffCheck)).to.be.true;
    });

    it('should handle null diff check', async () => {
      const thresholdCheck = { state: 'success' };
      
      mockCoverageReporter.generateStatusChecks.returns(thresholdCheck);
      mockCoverageReporter.generateDiffStatusCheck.returns(null);
      
      await reporter.setStatusChecks(85.5, 0, 'backend');
      
      expect(mockGitHubHelper.setGitStatus.calledOnce).to.be.true;
      expect(mockGitHubHelper.setGitStatus.calledWith(thresholdCheck)).to.be.true;
    });
  });

  describe('mergeWithPriority helper function', () => {
    it('should merge objects with priority to first object', () => {
      // Test the helper function indirectly through constructor behavior
      const options = {
        github: { owner: 'first-owner', token: 'first-token' }
      };
      
      const mockConfig = {
        config: {
          github: { owner: 'second-owner', repo: 'config-repo' }
        }
      };
      
      sandbox.stub(ConfigManager, 'loadConfig').returns(mockConfig);
      sandbox.stub(ConfigManager, 'getFeatures').returns({});
      sandbox.stub(ConfigManager, 'getS3Config').returns({});
      sandbox.stub(ConfigManager, 'getGitHubConfig').returns({ owner: 'second-owner', repo: 'config-repo' });
      
      const reporter = new GitHubCoverageReporter(options);
      
      // The GitHub helper should be initialized with merged config
      expect(reporter.githubHelper).to.be.instanceOf(GitHubHelper);
    });
  });

  // Additional tests to cover remaining lines in index.js
  describe('index.js coverage edge cases', function() {
    let mockGitHubHelper, mockS3Helper, mockCoverageReporter, reporter, sandbox;

    beforeEach(function() {
      sandbox = sinon.createSandbox();
      
      // Create mocks
      mockGitHubHelper = {
        fetchPR: sandbox.stub(),
        addPRComment: sandbox.stub(),
        setGitStatus: sandbox.stub()
      };
      
      mockS3Helper = {
        getCoverageJsonFile: sandbox.stub()
      };
      
      mockCoverageReporter = {
        generateStatusChecks: sandbox.stub(),
        generateDiffStatusCheck: sandbox.stub(),
        generateCoverageComment: sandbox.stub()
      };
      
      reporter = new GitHubCoverageReporter({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      });
      
      reporter.githubHelper = mockGitHubHelper;
      reporter.s3Helper = mockS3Helper;
      reporter.coverageReporter = mockCoverageReporter;
      
      sandbox.stub(reporter, 'parseCoverageFromFile').returns(85.5);
      sandbox.stub(reporter, 'updateS3Coverage').resolves();
    });

    afterEach(function() {
      sandbox.restore();
    });

    // Line 126: Test console.log when no PR found and addComments is true
    it('should handle missing PR with addComments enabled', async () => {
      // Mock no PR found
      mockGitHubHelper.fetchPR.resolves(null);
      mockCoverageReporter.generateStatusChecks.returns({ state: 'success' });
      mockCoverageReporter.generateDiffStatusCheck.returns({ state: 'success' });
      
      // Use the existing console.log stub
      const consoleLogStub = console.log;
      
      const result = await reporter.run(null, {
        coverageType: 'backend'
      });
      
      expect(result.success).to.be.true;
      expect(consoleLogStub.calledWith('No PR found, skipping comment creation')).to.be.true;
    });

    // Lines 186-187, 201: Test error paths in parseCoverageFromFile
    it('should handle errors in getDefaultFilePath', async () => {
      // Unset environment variables to trigger the error path
      const originalEnv = process.env.BACKEND_COVERAGE_SUMMARY_JSON_PATH;
      delete process.env.BACKEND_COVERAGE_SUMMARY_JSON_PATH;
      
      reporter.parseCoverageFromFile.restore(); // Remove the stub
      
      try {
        await reporter.parseCoverageFromFile({ coverageType: 'backend' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No coverage path found for type \'backend\'');
        expect(error.message).to.include('Please set the BACKEND_COVERAGE_SUMMARY_JSON_PATH environment variable');
      }
      
      // Restore environment variable
      if (originalEnv) {
        process.env.BACKEND_COVERAGE_SUMMARY_JSON_PATH = originalEnv;
      }
    });

    it('should handle CoverageParser errors and rethrow them', async () => {
      // Set up environment variable but make CoverageParser fail
      process.env.TEST_COVERAGE_SUMMARY_JSON_PATH = '/path/to/invalid.json';
      
      reporter.parseCoverageFromFile.restore(); // Remove the stub
      
      // Stub CoverageParser to throw an error
      const CoverageParser = require('../src/CoverageParser');
      sandbox.stub(CoverageParser, 'parseSingleFile').throws(new Error('File parsing failed'));
      
      try {
        await reporter.parseCoverageFromFile({ coverageType: 'test' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('File parsing failed');
      }
      
      // Clean up
      delete process.env.TEST_COVERAGE_SUMMARY_JSON_PATH;
    });
  });
});