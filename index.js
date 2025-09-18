const GitHubHelper = require('./src/GitHubHelper');
const S3Helper = require('./src/S3Helper');
const CoverageReporter = require('./src/CoverageReporter');
const CoverageParser = require('./src/CoverageParser');
const ConfigManager = require('./src/ConfigManager');

// Helper function to merge objects with priority to first object for undefined/null values
const mergeWithPriority = (first, second) => {
  const result = { ...first };
  Object.keys(second).forEach(key => {
    if (second[key] !== undefined && second[key] !== null && second[key] !== '') {
      result[key] = second[key];
    }
  });
  return result;
};

class GitHubCoverageReporter {
  constructor(options = {}) {
    // Load configuration from .gcr.json if it exists
    try {
      this.config = ConfigManager.loadConfig(options.configPath);
    } catch (error) {
      console.warn(`Warning: Could not load .gcr.json configuration: ${error.message}`);
      this.config = null;
    }
    
    
    // Get features from config if available
    const features = this.config ? ConfigManager.getFeatures(this.config) : {};
    
    // Get S3 config from config if available
    const s3Config = this.config ? ConfigManager.getS3Config(this.config) : {};

    // Get GitHub config from config if available
    const githubConfig = this.config ? ConfigManager.getGitHubConfig(this.config) : {};

    // Initialize GitHub helper with options or environment variables
    this.githubHelper = new GitHubHelper(
      mergeWithPriority(options.github || {}, githubConfig)
    );

    // Initialize S3 helper with config values (including folderName)
    this.s3Helper = (options.s3 || s3Config) ? new S3Helper(
      mergeWithPriority(options.s3 || {}, s3Config)
    ) : null;

    // Initialize coverage reporter with options or config
    const coverageOptions = options.coverage || {};
    if (this.config) {
      // Add thresholds from config if available
      const types = this.config.coverage?.types || [];
      const thresholds = {};
      types.forEach(type => {
        thresholds[type.name] = type.threshold;
      });
      coverageOptions.customThresholds = thresholds;
      coverageOptions.maxDiff = coverageOptions.maxDiff || ConfigManager.getMaxCoverageDiff(this.config);
    }

    this.coverageReporter = new CoverageReporter(coverageOptions);

    // Set up options combining explicit options with config
    this.options = {
      addComments: options.addComments !== undefined ? options.addComments : (features.addComments !== false),
      setStatusChecks: options.setStatusChecks !== undefined ? options.setStatusChecks : (features.setStatusChecks !== false),
      storeInS3: options.storeInS3 !== undefined ? options.storeInS3 : (features.storeInS3 !== false && this.s3Helper !== null),
      fileName: options.fileName || s3Config.fileName,
      coverageType: options.coverageType, // Default coverage type for this run
      coverageTypes: options.coverageTypes || (this.config?.coverage?.types?.map(t => t.name)),
      ...options
    };
  }

  async run(coverageData, options = {}) {
    try {
      // Support merged comment for all types
      if (options.coverageTypes && Array.isArray(options.coverageTypes) && options.coverageTypes.length > 1) {
        let pr = null;
        if (this.options.addComments || this.options.setStatusChecks) {
          pr = await this.githubHelper.fetchPR();
          if (!pr && this.options.addComments) {
            console.log('No PR found, skipping comment creation');
          }
        }
        const prevCoverageJson = this.s3Helper && pr ? await this.s3Helper.getCoverageJsonFile(this.options.fileName) : {};
        const baseBranch = pr ? this.githubHelper.getBaseBranch(pr) : null;
        const branchData = baseBranch ? prevCoverageJson[baseBranch] || {} : {};

        const currentCoverage = {};
        const previousCoverage = {};
        for (const coverageType of options.coverageTypes) {
          currentCoverage[coverageType] = this.parseCoverageFromFile({ coverageType });
          previousCoverage[coverageType] = branchData[coverageType] || 0;
          // Set status checks for each type
          if (this.options.setStatusChecks) {
            await this.setStatusChecks(currentCoverage[coverageType], previousCoverage[coverageType], coverageType);
          }
          // Store coverage in S3 for each type
          if (this.options.storeInS3 && this.s3Helper) {
            const prevCoverageJsonType = await this.s3Helper.getCoverageJsonFile(this.options.fileName);
            await this.updateS3Coverage(prevCoverageJsonType, coverageType, currentCoverage[coverageType]);
          }
        }
        // Add merged PR comment
        if (this.options.addComments && pr && options.addComment !== false) {
          const commentBody = this.coverageReporter.generateCoverageComment(previousCoverage, currentCoverage, options.coverageTypes);
          await this.githubHelper.addPRComment(commentBody, pr.number);
        }
        return {
          success: true,
          coverageTypes: options.coverageTypes,
          currentCoverage,
          previousCoverage,
          pr: pr?.number || null
        };
      } else {
        // Single type (default behavior)
        const coverageType = options.coverageType || this.options.coverageType;
        const currentCoverage = coverageData || this.parseCoverageFromFile(options);
        let previousCoverage = 0;
        let pr = null;
        if (this.options.addComments || this.options.setStatusChecks) {
          pr = await this.githubHelper.fetchPR();
          if (!pr && this.options.addComments) {
            console.log('No PR found, skipping comment creation');
          }
        }
        if (this.s3Helper && pr) {
          const prevCoverageJson = await this.s3Helper.getCoverageJsonFile(this.options.fileName);
          const baseBranch = this.githubHelper.getBaseBranch(pr);
          const branchData = prevCoverageJson[baseBranch] || {};
          previousCoverage = branchData[coverageType] || 0;
        }
        if (this.options.setStatusChecks) {
          await this.setStatusChecks(currentCoverage, previousCoverage, coverageType);
        }
        if (this.options.addComments && pr && options.addComment !== false) {
          await this.addCoverageComment(currentCoverage, previousCoverage, coverageType, pr.number);
        }
        if (this.options.storeInS3 && this.s3Helper) {
          const prevCoverageJson = await this.s3Helper.getCoverageJsonFile(this.options.fileName);
          await this.updateS3Coverage(prevCoverageJson, coverageType, currentCoverage);
        }
        return {
          success: true,
          coverageType,
          currentCoverage,
          previousCoverage,
          pr: pr?.number || null
        };
      }
    } catch (err) {
      console.log('Error in GitHubCoverageReporter:', err);
      throw err;
    }
  }

  parseCoverageFromFile(options = {}) {
    const coverageType = options.coverageType || this.options.coverageType;
    
    // Check if file path is explicitly provided
    if (options.filePath) {
      const filePath = options.filePath;
      console.log(`Parsing ${coverageType} coverage from (explicit path): ${filePath}`);
      return CoverageParser.parseSingleFile(filePath);
    }
    
    // Try to get path from .gcr.json config
    if (this.config) {
      try {
        const filePath = ConfigManager.getCoveragePath(coverageType, this.config);
        console.log(`Parsing ${coverageType} coverage from (config path): ${filePath}`);
        return CoverageParser.parseSingleFile(filePath);
      } catch (configError) {
        console.log(`No path found in config for ${coverageType}, trying environment variables...`);
      }
    }
    
    // Otherwise get the path from environment variables
    try {
      const filePath = this.getDefaultFilePath(coverageType);
      console.log(`Parsing ${coverageType} coverage from (env path): ${filePath}`);
      return CoverageParser.parseSingleFile(filePath);
    } catch (error) {
      console.error(`Error finding coverage file path: ${error.message}`);
      throw error;
    }
  }

  getDefaultFilePath(coverageType) {
    // Get environment variable name in the format TYPE_COVERAGE_SUMMARY_JSON_PATH
    const envVarName = `${coverageType.toUpperCase()}_COVERAGE_SUMMARY_JSON_PATH`;
    
    // Check if the specific environment variable exists
    if (process.env[envVarName]) {
      return process.env[envVarName];
    }
    
    // If no environment variable is set, throw an error
    throw new Error(
      `No coverage path found for type '${coverageType}'. ` +
      `Please set the ${envVarName} environment variable or provide a file path explicitly.`
    );
  }

  async setStatusChecks(currentCoverage, previousCoverage, coverageType) {
    // Threshold check
    const statusCheck = this.coverageReporter.generateStatusChecks(currentCoverage, coverageType);
    await this.githubHelper.setGitStatus(statusCheck);

    // Diff check
    const diffCheck = this.coverageReporter.generateDiffStatusCheck(
      previousCoverage, 
      currentCoverage, 
      coverageType
    );
    if (diffCheck) {
      await this.githubHelper.setGitStatus(diffCheck);
    }
  }

  async addCoverageComment(currentCoverage, previousCoverage, coverageType, prNumber) {
    // Create a coverage object with single type for comment generation
    const currentCoverageObj = { [coverageType]: currentCoverage };
    const previousCoverageObj = { [coverageType]: previousCoverage };
    
    const commentBody = this.coverageReporter.generateCoverageComment(
      previousCoverageObj, 
      currentCoverageObj, 
      [coverageType]
    );
    await this.githubHelper.addPRComment(commentBody, prNumber);
  }

  async updateS3Coverage(prevCoverageJson, coverageType, currentCoverage) {
    const branchName = process.env.GITHUB_CURR_BRANCH;
    const branchData = prevCoverageJson[branchName] || {};
    branchData[coverageType] = currentCoverage;

    const updatedData = {
      ...prevCoverageJson,
      [branchName]: branchData,
    };

    try {
      await this.s3Helper.upload(this.options.fileName, JSON.stringify(updatedData));
      console.log(`${coverageType} coverage data uploaded to S3 successfully`);
    } catch (err) {
      console.log(`Error uploading ${coverageType} coverage data:`, err);
      throw err;
    }
  }
}

module.exports = GitHubCoverageReporter;
