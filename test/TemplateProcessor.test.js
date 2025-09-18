const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

const TemplateProcessor = require('../src/TemplateProcessor');

describe('TemplateProcessor', () => {
  let sandbox;
  let processor;
  let mockTemplatesDir;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockTemplatesDir = '/mock/templates';
    
    // Mock path.join to return predictable paths
    sandbox.stub(path, 'join').callsFake((...segments) => {
      if (segments.includes('templates')) {
        return segments.join('/').replace('../templates', mockTemplatesDir);
      }
      if (segments.includes('package.json')) {
        return '/mock/package.json';
      }
      return segments.join('/');
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const mockPackageJson = { name: 'test-package' };
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(mockPackageJson));
      
      processor = new TemplateProcessor();
      
      expect(processor.templatesDir).to.include('templates');
      expect(processor.packageJson).to.deep.equal(mockPackageJson);
    });
  });

  describe('loadPackageJson', () => {
    beforeEach(() => {
      processor = Object.create(TemplateProcessor.prototype);
    });

    it('should load package.json successfully', () => {
      const mockPackageJson = { name: 'test-package', version: '1.0.0' };
      sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(mockPackageJson));
      
      const result = processor.loadPackageJson();
      
      expect(result).to.deep.equal(mockPackageJson);
    });

    it('should return fallback values when package.json cannot be read', () => {
      sandbox.stub(fs, 'readFileSync').throws(new Error('File not found'));
      sandbox.stub(console, 'warn');
      
      const result = processor.loadPackageJson();
      
      expect(result).to.deep.equal({ name: 'github-coverage-reporter' });
      expect(console.warn.calledWith('Warning: Could not load package.json, using fallback values')).to.be.true;
    });

    it('should return fallback values when package.json contains invalid JSON', () => {
      sandbox.stub(fs, 'readFileSync').returns('invalid json');
      sandbox.stub(console, 'warn');
      
      const result = processor.loadPackageJson();
      
      expect(result).to.deep.equal({ name: 'github-coverage-reporter' });
    });
  });

  describe('processTemplate', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.packageJson = { name: 'test-package' };
      processor.templatesDir = mockTemplatesDir;
    });

    it('should process template with variables', () => {
      const templateContent = 'Hello {{NAME}}, package: {{PACKAGE_NAME}}';
      const expectedOutput = 'Hello World, package: test-package';
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(templateContent);
      
      const result = processor.processTemplate('test.txt', { NAME: 'World' });
      
      expect(result).to.equal(expectedOutput);
    });

    it('should process template with PLACEHOLDER pattern', () => {
      const templateContent = 'Hello NAME_PLACEHOLDER, package: PACKAGE_NAME_PLACEHOLDER';
      const expectedOutput = 'Hello World, package: test-package';
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(templateContent);
      
      const result = processor.processTemplate('test.txt', { NAME: 'World' });
      
      expect(result).to.equal(expectedOutput);
    });

    it('should throw error when template file does not exist', () => {
      sandbox.stub(fs, 'existsSync').returns(false);
      
      expect(() => processor.processTemplate('nonexistent.txt')).to.throw('Template not found');
    });

    it('should process template without variables', () => {
      const templateContent = 'Static content with {{PACKAGE_NAME}}';
      const expectedOutput = 'Static content with test-package';
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(templateContent);
      
      const result = processor.processTemplate('test.txt');
      
      expect(result).to.equal(expectedOutput);
    });

    it('should handle multiple occurrences of the same variable', () => {
      const templateContent = '{{NAME}} and {{NAME}} again, package: {{PACKAGE_NAME}}';
      const expectedOutput = 'World and World again, package: test-package';
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns(templateContent);
      
      const result = processor.processTemplate('test.txt', { NAME: 'World' });
      
      expect(result).to.equal(expectedOutput);
    });
  });

  describe('generateEnvFile', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.templatesDir = mockTemplatesDir;
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').callsFake((filePath) => {
        if (filePath.includes('minimal.env')) {
          return 'MINIMAL_ENV_CONTENT';
        }
        if (filePath.includes('full.env')) {
          return 'FULL_ENV with {{COVERAGE_THRESHOLDS}} and {{COVERAGE_FILE_PATHS}}';
        }
        return '';
      });
    });

    it('should generate minimal env file', () => {
      const result = processor.generateEnvFile(true);
      
      expect(result).to.equal('MINIMAL_ENV_CONTENT');
    });

    it('should generate full env file with custom coverage types', () => {
      const coverageTypes = [
        { name: 'backend', threshold: 80 },
        { name: 'frontend', threshold: 75 }
      ];
      
      const result = processor.generateEnvFile(false, coverageTypes);
      
      expect(result).to.include('BACKEND_COVERAGE_THRESHOLD=  # e.g., 80');
      expect(result).to.include('FRONTEND_COVERAGE_THRESHOLD=  # e.g., 75');
      expect(result).to.include('BACKEND_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for backend coverage');
      expect(result).to.include('FRONTEND_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for frontend coverage');
    });

    it('should generate full env file with default types when none provided', () => {
      const result = processor.generateEnvFile(false, []);
      
      expect(result).to.include('BACKEND_COVERAGE_THRESHOLD=  # e.g., 90');
      expect(result).to.include('FRONTEND_COVERAGE_THRESHOLD=  # e.g., 90');
      expect(result).to.include('LAMBDA_COVERAGE_THRESHOLD=  # e.g., 90');
      expect(result).to.include('BACKEND_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for backend coverage');
      expect(result).to.include('FRONTEND_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for frontend coverage');
      expect(result).to.include('LAMBDA_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for lambda coverage');
    });
  });

  describe('generateGitHubWorkflow', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.templatesDir = mockTemplatesDir;
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns('node-version: {{NODE_VERSION}}');
    });

    it('should generate workflow with default node version', () => {
      const result = processor.generateGitHubWorkflow();
      
      expect(result).to.equal('node-version: 16');
    });

    it('should generate workflow with custom node version', () => {
      const result = processor.generateGitHubWorkflow('18');
      
      expect(result).to.equal('node-version: 18');
    });
  });

  describe('generateJenkinsfile', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.templatesDir = mockTemplatesDir;
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').returns('node: {{NODE_VERSION}}, owner: {{GITHUB_OWNER}}, repo: {{GITHUB_REPO}}');
    });

    it('should generate Jenkinsfile with default values', () => {
      const result = processor.generateJenkinsfile();
      
      expect(result).to.equal('node: 16, owner: your-org, repo: your-repo');
    });

    it('should generate Jenkinsfile with custom values', () => {
      const result = processor.generateJenkinsfile('18', 'custom-org', 'custom-repo');
      
      expect(result).to.equal('node: 18, owner: custom-org, repo: custom-repo');
    });
  });

  describe('generateCoverageScript', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.templatesDir = mockTemplatesDir;
      
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readFileSync').callsFake((filePath) => {
        if (filePath.includes('env-loading-simple.js')) {
          return 'SIMPLE_ENV_LOADING';
        }
        if (filePath.includes('env-loading-with-config.js')) {
          return 'CONFIG_ENV_LOADING';
        }
        if (filePath.includes('coverage-report.js')) {
          return '{{ENV_LOADING_SECTION}}\nconfig: {{USE_CONFIG_FILE}}\ntypes: {{DEFAULT_TYPES}}';
        }
        return '';
      });
    });

    it('should generate script without config file', () => {
      const result = processor.generateCoverageScript();
      
      expect(result).to.include('SIMPLE_ENV_LOADING');
      expect(result).to.include('config: false');
      expect(result).to.include("types: ['backend', 'frontend', 'lambda']");
    });

    it('should generate script with config file', () => {
      const result = processor.generateCoverageScript(true);
      
      expect(result).to.include('CONFIG_ENV_LOADING');
      expect(result).to.include('config: true');
    });

    it('should generate script with custom coverage types', () => {
      const coverageTypes = ['api', 'web', 'mobile'];
      const result = processor.generateCoverageScript(false, coverageTypes);
      
      expect(result).to.include('types: ["api","web","mobile"]');
    });
  });

  describe('getAvailableTemplates', () => {
    beforeEach(() => {
      processor = new TemplateProcessor();
      processor.templatesDir = mockTemplatesDir;
    });

    it('should return available templates', () => {
      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'readdirSync').callsFake((dirPath) => {
        if (dirPath.includes('env')) {
          return ['minimal.env', 'full.env'];
        }
        if (dirPath.includes('cicd')) {
          return ['github-actions.yml', 'gitlab-ci.yml'];
        }
        if (dirPath.includes('scripts')) {
          return ['coverage-report.js'];
        }
        return [];
      });
      
      const result = processor.getAvailableTemplates();
      
      expect(result).to.deep.equal({
        env: ['minimal.env', 'full.env'],
        cicd: ['github-actions.yml', 'gitlab-ci.yml'],
        scripts: ['coverage-report.js']
      });
    });

    it('should handle missing template directories', () => {
      sandbox.stub(fs, 'existsSync').returns(false);
      
      const result = processor.getAvailableTemplates();
      
      expect(result).to.deep.equal({
        env: [],
        cicd: [],
        scripts: []
      });
    });

    it('should handle partial template directories', () => {
      sandbox.stub(fs, 'existsSync').callsFake((dirPath) => {
        return dirPath.includes('env');
      });
      sandbox.stub(fs, 'readdirSync').returns(['minimal.env']);
      
      const result = processor.getAvailableTemplates();
      
      expect(result).to.deep.equal({
        env: ['minimal.env'],
        cicd: [],
        scripts: []
      });
    });
  });
});