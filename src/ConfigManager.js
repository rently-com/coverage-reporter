/**
 * Configuration manager for GitHub Coverage Reporter
 * Handles loading and parsing configuration from .gcr.json file
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  /**
   * Load configuration from .gcr.json file
   * @param {string} configPath - Path to the config file (optional)
   * @returns {Object} - Parsed configuration
   */
  static loadConfig(configPath) {
    const defaultPath = path.join(process.cwd(), '.gcr.json');
    const configFilePath = configPath || defaultPath;
    
    try {
      if (!fs.existsSync(configFilePath)) {
        throw new Error(`Configuration file not found: ${configFilePath}`);
      }
      
      const configData = fs.readFileSync(configFilePath, 'utf8');
      const config = JSON.parse(configData);
      
      return config;
    } catch (error) {
      console.error(`Error loading configuration: ${error.message}`);
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }
  
  /**
   * Get coverage path for a specific type
   * @param {string} type - Coverage type
   * @param {Object} config - Loaded configuration
   * @returns {string} - File path for the coverage type
   */
  static getCoveragePath(type, config) {
    if (!config || !config.coverage || !config.coverage.types) {
      throw new Error('Invalid configuration format: coverage types not found');
    }
    
    const typeConfig = config.coverage.types.find(t => t.name === type);
    if (!typeConfig) {
      throw new Error(`Coverage type not found in configuration: ${type}`);
    }
    
    return typeConfig.filePath;
  }

  /**
   * Get coverage key path for a specific type
   * @param {string} type - Coverage type
   * @param {Object} config - Loaded configuration
   * @returns {string} - Key path for the coverage type
   */
  static getCoverageKeyPath(type, config) {
    if (!config || !config.coverage || !config.coverage.types) {
      throw new Error('Invalid configuration format: coverage types not found');
    }
    
    const typeConfig = config.coverage.types.find(t => t.name === type);
    if (!typeConfig) {
      throw new Error(`Coverage type not found in configuration: ${type}`);
    }

    return typeConfig.keyPath;
  }
  
  /**
   * Get threshold for a specific coverage type
   * @param {string} type - Coverage type
   * @param {Object} config - Loaded configuration
   * @returns {number} - Threshold for the coverage type
   */
  static getCoverageThreshold(type, config) {
    if (!config || !config.coverage || !config.coverage.types) {
      throw new Error('Invalid configuration format: coverage types not found');
    }
    
    const typeConfig = config.coverage.types.find(t => t.name === type);
    if (!typeConfig) {
      throw new Error(`Coverage type not found in configuration: ${type}`);
    }
    
    return typeConfig.threshold;
  }
  
  /**
   * Get maximum allowed coverage difference
   * @param {Object} config - Loaded configuration
   * @returns {number} - Maximum allowed coverage difference
   */
  static getMaxCoverageDiff(config) {
    if (!config || !config.config || ([null, undefined].includes(config.config.maxCoverageDiff))) {
      return 0; // Default value if not specified
    }
    
    return config.config.maxCoverageDiff;
  }
  
  /**
   * Get feature flags
   * @param {Object} config - Loaded configuration
   * @returns {Object} - Feature flags
   */
  static getFeatures(config) {
    if (!config || !config.config || !config.config.features) {
      return {
        addComments: true,
        setStatusChecks: true,
        storeInS3: true
      };
    }
    
    return config.config.features;
  }
  
  /**
   * Get S3 configuration (supports folderName from .gcr.json)
   * @param {Object} config - Loaded configuration
   * @returns {Object} - S3 configuration
   */
  static getS3Config(config) {
    // Support both top-level and nested config.s3
    let s3Config = {};
    if (config && config.s3) {
      s3Config = { ...config.s3 };
    } else if (config && config.config && config.config.s3) {
      s3Config = { ...config.config.s3 };
    }
    // Fallbacks
    if (!s3Config.fileName && config && config.fileName) {
      s3Config.fileName = config.fileName;
    }
    if (!s3Config.folderName && config && config.folderName) {
      s3Config.folderName = config.folderName;
    }
    // Default fileName
    if (!s3Config.fileName) {
      s3Config.fileName = 'coverage.json';
    }
    // Default folderName to empty string if not set
    if (!s3Config.folderName) {
      s3Config.folderName = 'github-coverage-reporter';
    }

    return s3Config;
  }

  /**
   * Get GitHub configuration (supports owner/repoName from .gcr.json)
   * @param {Object} config - Loaded configuration
   * @returns {Object} - GitHub configuration
   */
  static getGitHubConfig(config) {
    // Support both top-level and nested config.github
    let githubConfig = {};
    if (config && config.github) {
      githubConfig = { ...config.github };
    } else if (config && config.config && config.config.github) {
      githubConfig = { ...config.config.github };
    }
    // Fallbacks
    if (!githubConfig.owner && config && config.owner) {
      githubConfig.owner = config.owner;
    }
    if (!githubConfig.repo && config && config.repo) {
      githubConfig.repo = config.repo;
    }
    if (!githubConfig.defaultTargetBranch && config && config.defaultTargetBranch) {
      githubConfig.defaultTargetBranch = config.defaultTargetBranch;
    }

    return githubConfig;
  }
}

module.exports = ConfigManager;
