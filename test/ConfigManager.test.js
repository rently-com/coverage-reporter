const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');

const ConfigManager = require('../src/ConfigManager');

describe('ConfigManager', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Stub process.cwd() to return a test directory
    sandbox.stub(process, 'cwd').returns('/test/directory');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('loadConfig', () => {
    it('should load config from default path when no path provided', () => {
      const mockConfig = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 }
          ]
        }
      };
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(mockConfig));
      
      const result = ConfigManager.loadConfig();
      
      expect(fs.existsSync.calledWith('/test/directory/.gcr.json')).to.be.true;
      expect(result).to.deep.equal(mockConfig);
    });

    it('should load config from custom path when provided', () => {
      const customPath = '/custom/path/.gcr.json';
      const mockConfig = { test: 'config' };
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(mockConfig));
      
      const result = ConfigManager.loadConfig(customPath);
      
      expect(fs.existsSync.calledWith(customPath)).to.be.true;
      expect(result).to.deep.equal(mockConfig);
    });

    it('should throw error when config file does not exist', () => {
      sandbox.stub(fs, 'existsSync').returns(false);
      sandbox.stub(console, 'error');
      
      expect(() => ConfigManager.loadConfig()).to.throw('Failed to load configuration: Configuration file not found: /test/directory/.gcr.json');
    });

    it('should throw error when config file contains invalid JSON', () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns('invalid json');
      sandbox.stub(console, 'error');
      
      expect(() => ConfigManager.loadConfig()).to.throw(/Failed to load configuration/);
    });

    it('should throw error when file read fails', () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').throws(new Error('File read error'));
      sandbox.stub(console, 'error');
      
      expect(() => ConfigManager.loadConfig()).to.throw('Failed to load configuration: File read error');
    });
  });

  describe('getCoveragePath', () => {
    it('should return file path for existing coverage type', () => {
      const config = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 },
            { name: 'frontend', filePath: './frontend/coverage.json', threshold: 75 }
          ]
        }
      };
      
      const result = ConfigManager.getCoveragePath('backend', config);
      expect(result).to.equal('./backend/coverage.json');
    });

    it('should throw error when coverage type not found', () => {
      const config = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 }
          ]
        }
      };
      
      expect(() => ConfigManager.getCoveragePath('frontend', config)).to.throw('Coverage type not found in configuration: frontend');
    });

    it('should throw error when config is null', () => {
      expect(() => ConfigManager.getCoveragePath('backend', null)).to.throw('Invalid configuration format: coverage types not found');
    });

    it('should throw error when coverage section is missing', () => {
      const config = { other: 'data' };
      
      expect(() => ConfigManager.getCoveragePath('backend', config)).to.throw('Invalid configuration format: coverage types not found');
    });

    it('should throw error when types array is missing', () => {
      const config = { coverage: {} };
      
      expect(() => ConfigManager.getCoveragePath('backend', config)).to.throw('Invalid configuration format: coverage types not found');
    });
  });

  describe('getCoverageThreshold', () => {
    it('should return threshold for existing coverage type', () => {
      const config = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 },
            { name: 'frontend', filePath: './frontend/coverage.json', threshold: 75 }
          ]
        }
      };
      
      const result = ConfigManager.getCoverageThreshold('frontend', config);
      expect(result).to.equal(75);
    });

    it('should throw error when coverage type not found', () => {
      const config = {
        coverage: {
          types: [
            { name: 'backend', filePath: './backend/coverage.json', threshold: 80 }
          ]
        }
      };
      
      expect(() => ConfigManager.getCoverageThreshold('lambda', config)).to.throw('Coverage type not found in configuration: lambda');
    });

    it('should throw error when config is invalid', () => {
      expect(() => ConfigManager.getCoverageThreshold('backend', null)).to.throw('Invalid configuration format: coverage types not found');
    });
  });

  describe('getMaxCoverageDiff', () => {
    it('should return max coverage diff from config', () => {
      const config = {
        config: {
          maxCoverageDiff: 5
        }
      };
      
      const result = ConfigManager.getMaxCoverageDiff(config);
      expect(result).to.equal(5);
    });

    it('should return default value when config is null', () => {
      const result = ConfigManager.getMaxCoverageDiff(null);
      expect(result).to.equal(1);
    });

    it('should return default value when config section is missing', () => {
      const config = { other: 'data' };
      
      const result = ConfigManager.getMaxCoverageDiff(config);
      expect(result).to.equal(1);
    });

    it('should return default value when maxCoverageDiff is missing', () => {
      const config = {
        config: {
          features: { addComments: true }
        }
      };
      
      const result = ConfigManager.getMaxCoverageDiff(config);
      expect(result).to.equal(1);
    });
  });

  describe('getFeatures', () => {
    it('should return features from config', () => {
      const config = {
        config: {
          features: {
            addComments: false,
            setStatusChecks: true,
            storeInS3: false
          }
        }
      };
      
      const result = ConfigManager.getFeatures(config);
      expect(result).to.deep.equal({
        addComments: false,
        setStatusChecks: true,
        storeInS3: false
      });
    });

    it('should return defaults when config is null', () => {
      const result = ConfigManager.getFeatures(null);
      expect(result).to.deep.equal({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      });
    });

    it('should return defaults when config section is missing', () => {
      const config = { other: 'data' };
      
      const result = ConfigManager.getFeatures(config);
      expect(result).to.deep.equal({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      });
    });

    it('should return defaults when features section is missing', () => {
      const config = {
        config: {
          maxCoverageDiff: 5
        }
      };
      
      const result = ConfigManager.getFeatures(config);
      expect(result).to.deep.equal({
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      });
    });
  });

  describe('getS3Config', () => {
    it('should return S3 config from top-level s3 section', () => {
      const config = {
        s3: {
          bucketName: 'test-bucket',
          fileName: 'custom-coverage.json',
          folderName: 'custom-folder'
        }
      };
      
      const result = ConfigManager.getS3Config(config);
      expect(result).to.deep.equal({
        bucketName: 'test-bucket',
        fileName: 'custom-coverage.json',
        folderName: 'custom-folder'
      });
    });

    it('should return S3 config from nested config.s3 section', () => {
      const config = {
        config: {
          s3: {
            bucketName: 'nested-bucket',
            fileName: 'nested-coverage.json'
          }
        }
      };
      
      const result = ConfigManager.getS3Config(config);
      expect(result.bucketName).to.equal('nested-bucket');
      expect(result.fileName).to.equal('nested-coverage.json');
      expect(result.folderName).to.equal('github-coverage-reporter'); // default
    });

    it('should fall back to top-level fileName', () => {
      const config = {
        fileName: 'fallback-coverage.json'
      };
      
      const result = ConfigManager.getS3Config(config);
      expect(result.fileName).to.equal('fallback-coverage.json');
      expect(result.folderName).to.equal('github-coverage-reporter'); // default
    });

    it('should fall back to top-level folderName', () => {
      const config = {
        folderName: 'fallback-folder'
      };
      
      const result = ConfigManager.getS3Config(config);
      expect(result.fileName).to.equal('coverage.json'); // default
      expect(result.folderName).to.equal('fallback-folder');
    });

    it('should return defaults when config is null', () => {
      const result = ConfigManager.getS3Config(null);
      expect(result).to.deep.equal({
        fileName: 'coverage.json',
        folderName: 'github-coverage-reporter'
      });
    });

    it('should return defaults when no S3 config exists', () => {
      const config = { other: 'data' };
      
      const result = ConfigManager.getS3Config(config);
      expect(result).to.deep.equal({
        fileName: 'coverage.json',
        folderName: 'github-coverage-reporter'
      });
    });

    it('should prefer nested s3 config over top-level fallbacks', () => {
      const config = {
        fileName: 'top-level-file.json',
        folderName: 'top-level-folder',
        config: {
          s3: {
            fileName: 'nested-file.json',
            folderName: 'nested-folder'
          }
        }
      };
      
      const result = ConfigManager.getS3Config(config);
      expect(result.fileName).to.equal('nested-file.json');
      expect(result.folderName).to.equal('nested-folder');
    });
  });

  describe('getGitHubConfig', () => {
    it('should return GitHub config from top-level github section', () => {
      const config = {
        github: {
          owner: 'test-owner',
          repo: 'test-repo',
          defaultTargetBranch: 'develop'
        }
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result).to.deep.equal({
        owner: 'test-owner',
        repo: 'test-repo',
        defaultTargetBranch: 'develop'
      });
    });

    it('should return GitHub config from nested config.github section', () => {
      const config = {
        config: {
          github: {
            owner: 'nested-owner',
            repo: 'nested-repo'
          }
        }
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.owner).to.equal('nested-owner');
      expect(result.repo).to.equal('nested-repo');
    });

    it('should fall back to top-level owner', () => {
      const config = {
        owner: 'fallback-owner'
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.owner).to.equal('fallback-owner');
    });

    it('should fall back to top-level repo', () => {
      const config = {
        repo: 'fallback-repo'
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.repo).to.equal('fallback-repo');
    });

    it('should fall back to top-level defaultTargetBranch', () => {
      const config = {
        defaultTargetBranch: 'fallback-main'
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.defaultTargetBranch).to.equal('fallback-main');
    });

    it('should return empty config when config is null', () => {
      const result = ConfigManager.getGitHubConfig(null);
      expect(result).to.deep.equal({});
    });

    it('should return empty config when no GitHub config exists', () => {
      const config = { other: 'data' };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result).to.deep.equal({});
    });

    it('should prefer nested github config over top-level fallbacks', () => {
      const config = {
        owner: 'top-level-owner',
        repo: 'top-level-repo',
        defaultTargetBranch: 'top-level-main',
        config: {
          github: {
            owner: 'nested-owner',
            repo: 'nested-repo',
            defaultTargetBranch: 'nested-develop'
          }
        }
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.owner).to.equal('nested-owner');
      expect(result.repo).to.equal('nested-repo');
      expect(result.defaultTargetBranch).to.equal('nested-develop');
    });

    it('should mix nested and fallback values', () => {
      const config = {
        owner: 'fallback-owner',
        defaultTargetBranch: 'fallback-main',
        config: {
          github: {
            repo: 'nested-repo'
          }
        }
      };
      
      const result = ConfigManager.getGitHubConfig(config);
      expect(result.owner).to.equal('fallback-owner');
      expect(result.repo).to.equal('nested-repo');
      expect(result.defaultTargetBranch).to.equal('fallback-main');
    });
  });
});