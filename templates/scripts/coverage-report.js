#!/usr/bin/env node

/**
 * GitHub Coverage Reporter Script
 * 
 * This script runs the GitHub coverage reporter to:
 * - Parse coverage data from coverage-summary.json files
 * - Set GitHub status checks based on coverage thresholds
 * - Add PR comments with coverage information
 * - Store coverage history in S3 (if configured)
 */
 
/* eslint-disable no-undef */
{{ENV_LOADING_SECTION}}
/* eslint-enable no-undef */

const GitHubCoverageReporter = require('{{PACKAGE_NAME}}');

async function main() {
  try {
    // Validate required environment variables
    const requiredVars = [
      'GITHUB_ACCESS_TOKEN',
      'GITHUB_CURR_BRANCH',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      process.exit(1);
    }
    
    // Configure the reporter
    const options = {
      github: {
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        token: process.env.GITHUB_ACCESS_TOKEN,
        currentBranch: process.env.GITHUB_CURR_BRANCH,
        targetBranch: process.env.GITHUB_TARGET_BRANCH,
        commitSha: process.env.GITHUB_SHA,
      },
      s3: process.env.AWS_S3_BUCKET ? {
        bucketName: process.env.AWS_S3_BUCKET,
        folderName: process.env.FOLDER_NAME,
        region: process.env.AWS_REGION,
      } : null
    };
    
    // If using config file, add it to options
    options.configPath = './.gcr.json';

    // Initialize the reporter
    const reporter = new GitHubCoverageReporter(options);
    
    // Get coverage types to process from command line arguments
    const args = process.argv.slice(2);
    let typesToProcess = [];
    
    // Check for --all flag to process all types
    if (args.includes('--all')) {
      /* eslint-disable-next-line no-undef */
      typesToProcess = config?.coverage?.types?.map(t => t.name) || DEFAULT_TYPES_PLACEHOLDER;
    } else {
      // Look for --name=type arguments
      args.forEach(arg => {
        if (arg.startsWith('--name=')) {
          typesToProcess.push(arg.split('=')[1]);
        }
      });
    }
    
    console.log(`Processing coverage for types: ${typesToProcess.join(', ')}`);
    
    if (typesToProcess.length === 0) {
      console.error('No coverage types specified. Use --all or --name=type to specify coverage types.');
      process.exit(1);
    }

    try {
      const result = await reporter.run(null, {
        coverageTypes: typesToProcess
      });

      if (result.coverageTypes && Array.isArray(result.coverageTypes)) {
        // Multi-type coverage reporting
        result.coverageTypes.forEach(type => {
          const current = result.currentCoverage[type];
          const previous = result.previousCoverage[type] || 0;
          console.log(`✅ ${type} coverage: ${current}%`);
          if (previous > 0) {
            const diff = (current - previous).toFixed(2);
            const change = diff >= 0 ? `increased by ${diff}%` : `decreased by ${Math.abs(diff)}%`;
            console.log(`   Changed: ${change} from previous ${previous}%`);
          }
        });
      } else {
        // Single-type coverage reporting
        const type = result.coverageType || typesToProcess[0];
        const current = result.currentCoverage;
        const previous = result.previousCoverage || 0;
        console.log(`✅ ${type} coverage: ${current}%`);
        if (previous > 0) {
          const diff = (current - previous).toFixed(2);
          const change = diff >= 0 ? `increased by ${diff}%` : `decreased by ${Math.abs(diff)}%`;
          console.log(`   Changed: ${change} from previous ${previous}%`);
        }
      }
    } catch (error) {
      // If error is per-type, print type if available
      if (error.coverageType) {
        console.error(`❌ Error processing ${error.coverageType} coverage:`, error.message);
      } else {
        console.error(`❌ Error processing coverage:`, error.message);
      }
    }
  
    console.log('\nCoverage reporting completed');
    
  } catch (err) {
    console.error('Fatal error in coverage reporter:');
    console.error(err.message || err);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
