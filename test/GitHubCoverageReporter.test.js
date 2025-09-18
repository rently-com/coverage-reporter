const { expect } = require('chai');
const sinon = require('sinon');

const GitHubCoverageReporter = require('../index');
const CoverageParser = require('../src/CoverageParser');

describe('GitHubCoverageReporter', () => {
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
    process.env.CUSTOM_COVERAGE_SUMMARY_JSON_PATH = 'coverage/custom/coverage-summary.json';
    
    sandbox = sinon.createSandbox();
    
    // Stub the static method
    sandbox.stub(CoverageParser, 'parseSingleFile');
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const reporter = new GitHubCoverageReporter();
      
      expect(reporter.options.addComments).to.be.true;
      expect(reporter.options.setStatusChecks).to.be.true;
      expect(reporter.options.coverageType).to.be.undefined;
      expect(reporter.options.fileName).to.be.undefined;
    });

    it('should accept custom options', () => {
      const options = {
        coverageType: 'frontend',
        addComments: false,
        setStatusChecks: false,
        fileName: 'custom-coverage'
      };
      
      const reporter = new GitHubCoverageReporter(options);
      
      expect(reporter.options.coverageType).to.equal('frontend');
      expect(reporter.options.addComments).to.be.false;
      expect(reporter.options.setStatusChecks).to.be.false;
      expect(reporter.options.fileName).to.equal('custom-coverage');
    });

    it('should set storeInS3 to true by default (matches current implementation)', () => {
      const reporter = new GitHubCoverageReporter({ s3: null });
      expect(reporter.options.storeInS3).to.be.true;
    });
  });

  describe('getDefaultFilePath', () => {
    let reporter;

    beforeEach(() => {
      reporter = new GitHubCoverageReporter();
    });

    it('should return backend default path', () => {
      const path = reporter.getDefaultFilePath('backend');
      expect(path).to.include('artifacts/coverage-summary.json');
    });

    it('should return frontend default path', () => {
      const path = reporter.getDefaultFilePath('frontend');
      expect(path).to.include('frontend/coverage/coverage-summary.json');
    });

    it('should return lambda default path', () => {
      const path = reporter.getDefaultFilePath('lambda');
      expect(path).to.include('lambda/coverage/coverage-summary.json');
    });

    it('should return generic path for unknown types', () => {
      const path = reporter.getDefaultFilePath('custom');
      expect(path).to.include('coverage/custom/coverage-summary.json');
    });
  });

  describe('parseCoverageFromFile', () => {
    let reporter;

    beforeEach(() => {
      reporter = new GitHubCoverageReporter({ coverageType: 'backend' });
      CoverageParser.parseSingleFile.returns(85.5);
    });

    it('should parse coverage from file with default path', () => {
      const coverage = reporter.parseCoverageFromFile();
      
      expect(CoverageParser.parseSingleFile.calledOnce).to.be.true;
      expect(coverage).to.equal(85.5);
    });

    it('should parse coverage from custom file path', () => {
      const customPath = './custom/coverage.json';
      const coverage = reporter.parseCoverageFromFile({ filePath: customPath });
      
      expect(CoverageParser.parseSingleFile.calledWith(customPath)).to.be.true;
      expect(coverage).to.equal(85.5);
    });

    it('should use specified coverage type', () => {
      reporter.parseCoverageFromFile({ coverageType: 'frontend' });
      
      expect(CoverageParser.parseSingleFile.calledOnce).to.be.true;
      // The path should be for frontend type
      const callArgs = CoverageParser.parseSingleFile.getCall(0).args[0];
      expect(callArgs).to.include('frontend');
    });
  });
});
