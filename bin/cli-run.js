#!/usr/bin/env node
const GitHubCoverageReporter = require('../index');
const ConfigManager = require('../src/ConfigManager');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

// Check for initialization mode
if (args.includes('--init') || args.includes('init')) {
  console.log('Starting initialization wizard...');
  require('./simple-init');
  process.exit(0);
}

// Parse --name parameter for coverage type
const nameIndex = args.findIndex(arg => arg.startsWith('--name='));
if (nameIndex !== -1) {
  options.coverageType = args[nameIndex].split('=')[1];
} else {
  // Check for separate --name argument
  const nameArgIndex = args.findIndex(arg => arg === '--name');
  if (nameArgIndex !== -1 && args[nameArgIndex + 1]) {
    options.coverageType = args[nameArgIndex + 1];
  }
}

// Parse other common options
const helpIndex = args.findIndex(arg => arg === '--help' || arg === '-h');
if (helpIndex !== -1) {
  console.log(`
GitHub Coverage Reporter CLI

Usage: github-coverage-reporter [options]

Options:
  --name=<type>       Coverage type to process (backend, frontend, lambda, etc.)
  --name <type>       Alternative syntax for coverage type
  --no-comments       Disable PR comments
  --no-status         Disable status checks
  --no-s3             Disable S3 storage
  --file=<path>       Custom coverage file path
  --config=<path>     Custom path to .gcr.json configuration file
  --init              Run the initialization wizard to create .gcr.json
  --help, -h          Show this help message

Examples:
  github-coverage-reporter --name=backend
  github-coverage-reporter --name frontend --no-comments
  github-coverage-reporter --name=lambda --file=./lambda/coverage/coverage-summary.json
  github-coverage-reporter --init
  
Configuration:
  The tool uses .gcr.json for configuration with fallback to environment variables.
  Run --init to create a configuration file interactively.
  
Required Environment Variables (if not using .gcr.json):
  <TYPE>_COVERAGE_SUMMARY_JSON_PATH - Path to coverage summary JSON file for each type
                                      (e.g., BACKEND_COVERAGE_SUMMARY_JSON_PATH)
  
  See .env.example for full list of supported environment variables.
`);
  process.exit(0);
}

// Parse boolean flags
if (args.includes('--no-comments')) {
  options.addComments = false;
}
if (args.includes('--no-status')) {
  options.setStatusChecks = false;
}
if (args.includes('--no-s3')) {
  options.storeInS3 = false;
}

// Parse file path
const fileIndex = args.findIndex(arg => arg.startsWith('--file='));
if (fileIndex !== -1) {
  options.filePath = args[fileIndex].split('=')[1];
}

// Parse config path
const configIndex = args.findIndex(arg => arg.startsWith('--config='));
if (configIndex !== -1) {
  options.configPath = args[configIndex].split('=')[1];
}

// Default coverage type if not specified
if (!options.coverageType) {
  console.log('No coverage type specified. Use --name=<type> to specify.');
  process.exit(1);
}

console.log(`Running GitHub Coverage Reporter for: ${options.coverageType}`);

// Try to load configuration
let config;
try {
  config = ConfigManager.loadConfig(options.configPath);
  console.log('Loaded configuration from .gcr.json');
} catch (error) {
  console.warn(`Warning: ${error.message}`);
  console.warn('Falling back to environment variables for configuration');
  config = null; // Ensure it's explicitly assigned
}

// Initialize and run the reporter
async function run() {
  try {
    const reporter = new GitHubCoverageReporter({
      coverageType: options.coverageType,
      addComments: options.addComments,
      setStatusChecks: options.setStatusChecks,
      storeInS3: options.storeInS3,
      configPath: options.configPath,
      config, // Pass the loaded config to the reporter
      github: {
        token: process.env.GITHUB_ACCESS_TOKEN,
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        sha: process.env.GITHUB_SHA,
        pullRequestNumber: process.env.GITHUB_PR_NUMBER,
        currentBranch: process.env.GITHUB_CURR_BRANCH,
        baseBranch: process.env.GITHUB_TARGET_BRANCH
      },
      s3: process.env.AWS_S3_BUCKET ? {
        bucketName: process.env.AWS_S3_BUCKET,
        folderName: process.env.FOLDER_NAME,
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      } : null
    });

    const result = await reporter.run(null, {
      coverageType: options.coverageType,
      filePath: options.filePath
    });

    console.log('Coverage reporting completed successfully!');
    console.log(`Coverage Type: ${result.coverageType}`);
    console.log(`Current Coverage: ${result.currentCoverage.toFixed(2)}%`);
    
    if (result.previousCoverage) {
      const diff = result.currentCoverage - result.previousCoverage;
      const diffStr = diff >= 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
      console.log(`Previous Coverage: ${result.previousCoverage.toFixed(2)}%`);
      console.log(`Change: ${diffStr}`);
    }
    
    if (result.pr) {
      console.log(`PR Number: ${result.pr}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error running coverage reporter:', error.message);
    process.exit(1);
  }
}

run();
