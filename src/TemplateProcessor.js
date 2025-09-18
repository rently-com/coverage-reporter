const fs = require('fs');
const path = require('path');

/**
 * Template processing utility for GitHub Coverage Reporter initialization
 */
class TemplateProcessor {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.packageJson = this.loadPackageJson();
  }

  /**
   * Load package.json to get dynamic values like package name
   * @returns {object} - Parsed package.json content
   */
  loadPackageJson() {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageContent = fs.readFileSync(packagePath, 'utf8');
      return JSON.parse(packageContent);
    } catch (error) {
      console.warn('Warning: Could not load package.json, using fallback values');
      return { name: 'github-coverage-reporter' };
    }
  }

  /**
   * Load a template file and replace placeholders with values
   * @param {string} templatePath - Relative path to template file from templates directory
   * @param {object} variables - Object with variable names and values to replace
   * @returns {string} - Processed template content
   */
  processTemplate(templatePath, variables = {}) {
    const fullPath = path.join(this.templatesDir, templatePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${fullPath}`);
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Automatically inject package name and other dynamic variables
    const allVariables = {
      PACKAGE_NAME: this.packageJson.name,
      ...variables
    };
    
    // Replace variables in the format {{VARIABLE_NAME}} or VARIABLE_NAME_PLACEHOLDER
    Object.entries(allVariables).forEach(([key, value]) => {
      const patterns = [
        new RegExp(`{{${key}}}`, 'g'),
        new RegExp(`${key}_PLACEHOLDER`, 'g')
      ];
      
      patterns.forEach(pattern => {
        content = content.replace(pattern, value);
      });
    });
    
    return content;
  }

  /**
   * Generate environment file content
   * @param {boolean} minimal - Whether to generate minimal or full config
   * @param {Array} coverageTypes - Array of coverage type objects
   * @returns {string} - Environment file content
   */
  generateEnvFile(minimal = false, coverageTypes = []) {
    if (minimal) {
      return this.processTemplate('env/minimal.env');
    }
    
    // Generate dynamic sections for full env file
    const thresholds = coverageTypes.map(type => 
      `${type.name.toUpperCase()}_COVERAGE_THRESHOLD=  # e.g., ${type.threshold}`
    ).join('\n');
    
    const filePaths = coverageTypes.map(type => 
      `${type.name.toUpperCase()}_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for ${type.name} coverage`
    ).join('\n');
    
    // Add default types if none provided
    if (coverageTypes.length === 0) {
      const defaultTypes = ['BACKEND', 'FRONTEND', 'LAMBDA'];
      const defaultThresholds = defaultTypes.map(type => 
        `${type}_COVERAGE_THRESHOLD=  # e.g., 90`
      ).join('\n');
      const defaultPaths = defaultTypes.map(type => 
        `${type}_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for ${type.toLowerCase()} coverage`
      ).join('\n');
      
      return this.processTemplate('env/full.env', {
        COVERAGE_THRESHOLDS: defaultThresholds + '\n# Add custom types as needed: <TYPE>_COVERAGE_THRESHOLD=',
        COVERAGE_FILE_PATHS: defaultPaths + '\n# Add custom types as needed: <TYPE>_COVERAGE_SUMMARY_JSON_PATH='
      });
    }
    
    return this.processTemplate('env/full.env', {
      COVERAGE_THRESHOLDS: thresholds + '\n# Add custom types as needed: <TYPE>_COVERAGE_THRESHOLD=',
      COVERAGE_FILE_PATHS: filePaths + '\n# Add custom types as needed: <TYPE>_COVERAGE_SUMMARY_JSON_PATH='
    });
  }

  /**
   * Generate GitHub Actions workflow content
   * @param {string} nodeVersion - Node.js version to use
   * @returns {string} - Workflow file content
   */
  generateGitHubWorkflow(nodeVersion = '16') {
    return this.processTemplate('cicd/github-actions.yml', {
      NODE_VERSION: nodeVersion
    });
  }

  /**
   * Generate Jenkinsfile content
   * @param {string} nodeVersion - Node.js version to use
   * @param {string} githubOwner - GitHub owner/organization
   * @param {string} githubRepo - GitHub repository name
   * @returns {string} - Jenkinsfile content
   */
  generateJenkinsfile(nodeVersion = '16', githubOwner = 'your-org', githubRepo = 'your-repo') {
    return this.processTemplate('cicd/Jenkinsfile', {
      NODE_VERSION: nodeVersion,
      GITHUB_OWNER: githubOwner,
      GITHUB_REPO: githubRepo
    });
  }

  /**
   * Generate coverage report script content
   * @param {boolean} useConfigFile - Whether to include config file loading
   * @param {Array} coverageTypes - Array of coverage type names
   * @returns {string} - Script content
   */
  generateCoverageScript(useConfigFile = false, coverageTypes = []) {
    // Load environment loading section based on config file usage
    const envLoadingTemplate = useConfigFile ? 
      'scripts/env-loading-with-config.js' : 
      'scripts/env-loading-simple.js';
    
    const envLoadingSection = this.processTemplate(envLoadingTemplate);
    
    // Default types if none provided
    const defaultTypes = coverageTypes.length > 0 ? 
      JSON.stringify(coverageTypes) : 
      "['backend', 'frontend', 'lambda']";
    
    return this.processTemplate('scripts/coverage-report.js', {
      ENV_LOADING_SECTION: envLoadingSection,
      USE_CONFIG_FILE: useConfigFile.toString(),
      DEFAULT_TYPES: defaultTypes
    });
  }

  /**
   * Get all available templates
   * @returns {object} - Object with template categories and files
   */
  getAvailableTemplates() {
    const templates = {
      env: [],
      cicd: [],
      scripts: []
    };
    
    Object.keys(templates).forEach(category => {
      const categoryPath = path.join(this.templatesDir, category);
      if (fs.existsSync(categoryPath)) {
        templates[category] = fs.readdirSync(categoryPath);
      }
    });
    
    return templates;
  }
}

module.exports = TemplateProcessor;
