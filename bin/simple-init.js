#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const TemplateProcessor = require('../src/TemplateProcessor');

/**
 * Simple GitHub Coverage Reporter initialization script
 */
async function main() {
  console.log('🚀 GitHub Coverage Reporter Initialization\n');

  const templateProcessor = new TemplateProcessor();

  try {
    // Get user configuration choices
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'configType',
        message: 'How would you like to configure the reporter?',
        choices: [
          { name: 'Use JSON configuration file (.gcr.json)', value: 'json' },
          { name: 'Use environment variables (.env.github-coverage)', value: 'env' },
          { name: 'Use both methods', value: 'both' }
        ],
        default: 'json'
      },
      {
        type: 'list',
        name: 'cicdTool',
        message: 'Which CI/CD system do you use?',
        choices: [
          { name: 'GitHub Actions', value: 'github' },
          { name: 'Jenkins', value: 'jenkins' },
          { name: 'Both', value: 'both' },
          { name: 'None / Skip CI/CD setup', value: 'none' }
        ],
        default: 'github'
      }
    ]);

    // Create JSON configuration if selected
    let config = null;
    if (answers.configType === 'json' || answers.configType === 'both') {
      config = await createJsonConfig();
    }

    // Create .env file if selected
    if (answers.configType === 'env' || answers.configType === 'both') {
      createEnvFile(answers.configType === 'both', config?.coverage?.types, templateProcessor);
    }

    // Create CI/CD configuration
    if (answers.cicdTool === 'github' || answers.cicdTool === 'both') {
      await createGitHubWorkflow(templateProcessor);
    }

    if (answers.cicdTool === 'jenkins' || answers.cicdTool === 'both') {
      await createJenkinsFile(templateProcessor);
    }

    // Create helper script
    await createHelperScript(answers.configType === 'json' || answers.configType === 'both', config, templateProcessor);

    // Update .gitignore
    updateGitIgnore();

    console.log('\n✅ GitHub Coverage Reporter initialized successfully!');
    console.log('\nNext steps:');
    
    if (answers.configType === 'json') {
      console.log('1. Review the .gcr.json configuration file');
      console.log('2. Set up your GitHub credentials as environment variables');
    } else if (answers.configType === 'env') {
      console.log('1. Fill in your configuration in the .env.github-coverage file');
    } else {
      console.log('1. Review the .gcr.json configuration file');
      console.log('2. Fill in your GitHub credentials in the .env.github-coverage file');
    }
    
  console.log('3. Run the coverage reporter with: npm run coverage-report');

    // ESLint ignore automation for coverage-report.js
    const eslintIgnorePath = path.join(process.cwd(), '.eslintignore');
    const coverageScriptRelPath = 'scripts/coverage-report.js';
    let eslintIgnoreUpdated = false;
    if (fs.existsSync(eslintIgnorePath)) {
      let eslintIgnoreContent = fs.readFileSync(eslintIgnorePath, 'utf8');
      if (!eslintIgnoreContent.includes(coverageScriptRelPath)) {
        if (eslintIgnoreContent && !eslintIgnoreContent.endsWith('\n')) {
          eslintIgnoreContent += '\n';
        }
        eslintIgnoreContent += coverageScriptRelPath + '\n';
        fs.writeFileSync(eslintIgnorePath, eslintIgnoreContent);
        eslintIgnoreUpdated = true;
      }
    } else {
      fs.writeFileSync(eslintIgnorePath, coverageScriptRelPath + '\n');
      eslintIgnoreUpdated = true;
    }
    if (eslintIgnoreUpdated) {
      console.log('✅ Updated .eslintignore to exclude scripts/coverage-report.js');
    } else {
      console.log('ℹ️ .eslintignore already excludes scripts/coverage-report.js');
    }

    // NYC ignore automation for coverage-report.js
    const nycConfigPaths = [
      path.join(process.cwd(), '.nycrc.json'),
      path.join(process.cwd(), '.nycrc'),
      path.join(process.cwd(), 'nyc.config.js'),
      path.join(process.cwd(), 'package.json') // Check package.json for nyc config
    ];
    
    let nycIgnoreUpdated = false;
    
    // Find existing nyc config file
    let nycConfigPath = null;
    let nycConfig = null;
    let isPackageJsonNyc = false;
    let packageJsonData = null;
    
    for (const configPath of nycConfigPaths) {
      if (fs.existsSync(configPath)) {
        nycConfigPath = configPath;
        try {
          if (configPath.endsWith('package.json')) {
            packageJsonData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (packageJsonData.nyc) {
              nycConfig = packageJsonData.nyc;
              isPackageJsonNyc = true;
            }
          } else if (configPath.endsWith('.json')) {
            nycConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          }
          // For .nycrc without extension, try to parse as JSON
          else if (configPath.endsWith('.nycrc')) {
            const content = fs.readFileSync(configPath, 'utf8').trim();
            if (content.startsWith('{')) {
              nycConfig = JSON.parse(content);
            }
          }
          // Skip .js config files as they're more complex to modify
        } catch (error) {
          console.warn(`⚠️ Could not parse ${configPath}, skipping nyc config update`);
          continue;
        }
        break;
      }
    }
    
    if (nycConfig && nycConfigPath && !nycConfigPath.endsWith('.js')) {
      // Ensure exclude array exists
      if (!nycConfig.exclude) {
        nycConfig.exclude = [];
      }
      
      // Check if scripts/coverage-report.js is already in exclude list
      const scriptsPattern = 'scripts/coverage-report.js';
      if (!nycConfig.exclude.includes(scriptsPattern) && !nycConfig.exclude.includes('scripts/**')) {
        nycConfig.exclude.push(scriptsPattern);
        
        // Write updated config back to file
        try {
          if (isPackageJsonNyc && packageJsonData) {
            // Update the nyc section in package.json
            packageJsonData.nyc = nycConfig;
            const updatedContent = JSON.stringify(packageJsonData, null, 2);
            fs.writeFileSync(nycConfigPath, updatedContent);
          } else {
            // Update standalone nyc config file
            const updatedContent = JSON.stringify(nycConfig, null, 2);
            fs.writeFileSync(nycConfigPath, updatedContent);
          }
          nycIgnoreUpdated = true;
        } catch (error) {
          console.warn(`⚠️ Could not update ${nycConfigPath}:`, error.message);
        }
      }
    } else if (!nycConfigPath) {
      // Create a basic .nycrc.json if no nyc config exists
      const basicNycConfig = {
        exclude: [
          'test/**',
          'coverage/**', 
          'node_modules/**',
          'scripts/coverage-report.js'
        ],
        reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
        'report-dir': 'coverage'
      };
      
      try {
        const newNycConfigPath = path.join(process.cwd(), '.nycrc.json');
        fs.writeFileSync(newNycConfigPath, JSON.stringify(basicNycConfig, null, 2));
        console.log('✅ Created .nycrc.json with scripts/coverage-report.js exclusion');
        nycIgnoreUpdated = true;
      } catch (error) {
        console.warn('⚠️ Could not create .nycrc.json:', error.message);
      }
    }
    
    if (nycIgnoreUpdated) {
      console.log('✅ Updated nyc configuration to exclude scripts/coverage-report.js');
    } else {
      console.log('ℹ️ nyc configuration already excludes scripts/coverage-report.js or could not be updated');
    }
  } catch (error) {
    console.error('❌ Error during initialization:', error.message);
    process.exit(1);
  }
}

/**
 * Create a JSON configuration file
 */
async function createJsonConfig() {
  console.log('\n📝 Creating JSON configuration file...');
  
  try {
    const configPath = path.join(process.cwd(), '.gcr.json');
    let existingConfig = null;
    let updateChoice = { action: 'fresh' }; // Default action
    
    // Check if config file already exists
    if (fs.existsSync(configPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('📋 Found existing .gcr.json configuration');
        
        updateChoice = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'How would you like to proceed?',
            choices: [
              { name: 'Update existing configuration (use current values as defaults)', value: 'update' },
              { name: 'Start fresh (ignore existing configuration)', value: 'fresh' },
              { name: 'Add new coverage types to existing configuration', value: 'append' }
            ],
            default: 'update'
          }
        ]);
        
        if (updateChoice.action === 'fresh') {
          existingConfig = null;
        }
      } catch (error) {
        console.warn('⚠️ Could not parse existing .gcr.json, starting fresh');
        existingConfig = null;
      }
    }
    
    // Ask for coverage types
    const types = [];
    
    // If updating and we have existing types, use them as starting point
    if (existingConfig && existingConfig.coverage && existingConfig.coverage.types && 
        existingConfig.coverage.types.length > 0) {
      
      if (updateChoice.action === 'append') {
        // Add existing types to our array
        types.push(...existingConfig.coverage.types);
        console.log(`\n📊 Existing coverage types loaded: ${types.map(t => t.name).join(', ')}`);
      }
    }
    
    console.log('\nLet\'s configure your coverage types:');
    
    // Use a do-while loop to ensure at least one iteration (unless we're just appending)
    let continueAdding = true;
    
    // Skip initial prompts if we're just updating with existing types
    if (updateChoice && updateChoice.action === 'update' && types.length === 0 && 
        existingConfig && existingConfig.coverage && existingConfig.coverage.types) {
      // Load existing types for update
      types.push(...existingConfig.coverage.types);
      console.log(`\n📊 Loaded ${types.length} existing coverage types`);
      
      // Ask if they want to add more types
      const addMorePrompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addMore',
          message: 'Do you want to add more coverage types?',
          default: false
        }
      ]);
      
      continueAdding = addMorePrompt.addMore;
    }
    
    // Only prompt for new types if we need to
    if (types.length === 0 || continueAdding) {
      do {
        console.log(`\n📊 Coverage Type ${types.length + 1}:`);
        
        const typeAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Coverage type name (e.g., api, web, lambda):',
            validate: input => {
              if (!input.trim()) {
                return 'Name is required';
              }
              // Check for duplicate names
              if (types.find(t => t.name.toLowerCase() === input.trim().toLowerCase())) {
                return 'This coverage type name already exists. Please choose a different name.';
              }
              return true;
            }
          },
          {
            type: 'input',
            name: 'path',
            message: answers => `Path to ${answers.name} coverage-summary.json file:`,
            default: answers => `./${answers.name}/coverage/coverage-summary.json`
          },
          {
            type: 'input',
            name: 'keyPath',
            message: answers => `Key path to get the value from ${answers.path} file:`,
            default: answers => `total.statements.pct`
          },
          {
            type: 'input',
            name: 'threshold',
            message: answers => `Coverage threshold for ${answers.name} (0-100):`,
            default: 80,
            validate: input => {
              const num = parseInt(input);
              return (!isNaN(num) && num >= 0 && num <= 100) ? 
                true : 'Please enter a number between 0 and 100';
            }
          }
        ]);
        
        // Add the type to our array
        types.push({
          name: typeAnswers.name.trim(),
          filePath: typeAnswers.path.trim(),
          keyPath: typeAnswers.keyPath.trim(),
          threshold: parseInt(typeAnswers.threshold)
        });
        
        console.log(`✅ Added coverage type: ${typeAnswers.name}`);
        
        // Ask if they want to add another
        const continuePrompt = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addAnother',
            message: `You have ${types.length} coverage type${types.length > 1 ? 's' : ''} configured. Add another?`,
            default: false
          }
        ]);
        
        continueAdding = continuePrompt.addAnother;
        
      } while (continueAdding);
    }
    
    console.log(`\n✅ Configuration complete! ${types.length} coverage type${types.length > 1 ? 's' : ''} configured:`);
    types.forEach((type, index) => {
      console.log(`  ${index + 1}. ${type.name} (${type.threshold}% threshold)`);
    });
    
    // If no types added, add a default
    if (types.length === 0) {
      types.push({
        name: 'backend',
        filePath: './artifacts/coverage-summary.json',
        threshold: 80
      });
    }
    
    // Get general settings and S3 options with existing values as defaults
    const settingsAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'githubOwner',
        message: 'GitHub repository owner/organization:',
        validate: input => input.trim() ? true : 'GitHub owner is required',
        default: () => {
          // Use existing config value first
          if (existingConfig && existingConfig.config && existingConfig.config.github && existingConfig.config.github.owner) {
            return existingConfig.config.github.owner;
          }
          
          // Try to extract from package.json if available
          try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              if (packageJson.repository && packageJson.repository.url) {
                const repoUrl = packageJson.repository.url;
                const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
                if (match) {
                  return match[1];
                }
              }
            }
          } catch (error) {
            // Ignore error and use empty default
          }
          return '';
        }
      },
      {
        type: 'input',
        name: 'repoName',
        message: 'GitHub repository name:',
        validate: input => input.trim() ? true : 'Repository name is required',
        default: () => {
          // Use existing config value first
          if (existingConfig && existingConfig.config && existingConfig.config.github && existingConfig.config.github.repo) {
            return existingConfig.config.github.repo;
          }
          
          // Try to extract from package.json if available
          try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              if (packageJson.repository && packageJson.repository.url) {
                const repoUrl = packageJson.repository.url;
                const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
                if (match) {
                  return match[2].replace(/\.git$/, '');
                }
              }
              // Fallback to package name if no repository URL
              if (packageJson.name) {
                return packageJson.name;
              }
            }
          } catch (error) {
            // Ignore error and use empty default
          }
          return '';
        }
      },
      {
        type: 'input',
        name: 'defaultTargetBranch',
        message: 'Default target branch for coverage comparison:',
        default: (existingConfig && existingConfig.config && existingConfig.config.github && existingConfig.config.github.defaultTargetBranch) 
          ? existingConfig.config.github.defaultTargetBranch 
          : 'main',
        validate: input => input.trim() ? true : 'Default target branch is required'
      },
      {
        type: 'input',
        name: 'maxDiff',
        message: 'Maximum allowed coverage decrease percentage:',
        default: (existingConfig && existingConfig.coverage && existingConfig.coverage.maxDiff) 
          ? existingConfig.coverage.maxDiff 
          : 5,
        validate: input => {
          const num = parseInt(input);
          return (!isNaN(num) && num >= 0) ? true : 'Please enter a positive number';
        }
      },
      {
        type: 'confirm',
        name: 'enableStatusChecks',
        message: 'Enable GitHub status checks?',
        default: (existingConfig && existingConfig.statusCheck && typeof existingConfig.statusCheck.enabled === 'boolean') 
          ? existingConfig.statusCheck.enabled 
          : true
      },
      {
        type: 'confirm',
        name: 'enableComments',
        message: 'Enable PR comments with coverage information?',
        default: (existingConfig && existingConfig.comment && typeof existingConfig.comment.enabled === 'boolean') 
          ? existingConfig.comment.enabled 
          : true
      },
      {
        type: 'input',
        name: 's3FileName',
        message: 'S3 file name for coverage history (e.g., coverage-history.json):',
        default: (existingConfig && existingConfig.config && existingConfig.config.s3 && existingConfig.config.s3.fileName) 
          ? existingConfig.config.s3.fileName 
          : 'coverage-history.json',
        validate: input => input.trim() ? true : 'File name is required'
      },
      {
        type: 'input',
        name: 's3FolderName',
        message: 'S3 folder name (e.g., coverage-reports):',
        default: (existingConfig && existingConfig.config && existingConfig.config.s3 && existingConfig.config.s3.folderName) 
          ? existingConfig.config.s3.folderName 
          : 'coverage-reports',
        validate: input => input.trim() ? true : 'Folder name is required'
      }
    ]);

    // Create config object
    const config = {
      coverage: {
        types: types,
        maxDiff: parseInt(settingsAnswers.maxDiff)
      },
      config: {
        s3: {
          fileName: settingsAnswers.s3FileName,
          folderName: settingsAnswers.s3FolderName
        },
        github: {
          owner: settingsAnswers.githubOwner.trim(),
          repo: settingsAnswers.repoName.trim(),
          defaultTargetBranch: settingsAnswers.defaultTargetBranch.trim()
        },
      },
      statusCheck: {
        enabled: settingsAnswers.enableStatusChecks,
        context: existingConfig && existingConfig.statusCheck && existingConfig.statusCheck.context 
          ? existingConfig.statusCheck.context 
          : 'Coverage Report'
      },
      comment: {
        enabled: settingsAnswers.enableComments,
        header: existingConfig && existingConfig.comment && existingConfig.comment.header 
          ? existingConfig.comment.header 
          : '# Coverage Report',
        footer: existingConfig && existingConfig.comment && existingConfig.comment.footer 
          ? existingConfig.comment.footer 
          : '## Coverage is enforced by GitHub Status Check'
      }
    };
    
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`✅ Created configuration file: ${configPath}`);
    return config;
  } catch (error) {
    console.error('❌ Error creating JSON configuration:', error.message);
    throw error;
  }
}

/**
 * Create a .env.github-coverage file using templates
 */
function createEnvFile(minimal = false, coverageTypes = [], templateProcessor) {
  console.log('\n📝 Creating environment variables file...');
  
  const envPath = path.join(process.cwd(), '.env.github-coverage');
  
  // Skip if file already exists
  if (fs.existsSync(envPath)) {
    console.log('ℹ️ .env.github-coverage already exists, skipping...');
    return;
  }
  
  const content = templateProcessor.generateEnvFile(minimal, coverageTypes);
  
  fs.writeFileSync(envPath, content);
  console.log(`✅ Created environment file: ${envPath}`);
}

/**
 * Create a GitHub Actions workflow file using templates
 */
async function createGitHubWorkflow(templateProcessor, nodeVersion = '16') {
  console.log('\n📝 Setting up GitHub Actions workflow...');
  
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  const workflowPath = path.join(workflowDir, 'coverage-report.yml');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  
  // Handle existing file
  if (fs.existsSync(workflowPath)) {
    console.log('⚠️ GitHub workflow file already exists at:', workflowPath);
    
    const choice = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create a new file with a different name (coverage-report-new.yml)', value: 'rename' },
          { name: 'Create backup and replace existing file', value: 'backup' },
          { name: 'Skip workflow creation', value: 'skip' }
        ],
        default: 'rename'
      }
    ]);
    
    if (choice.action === 'skip') {
      console.log('ℹ️ Skipping GitHub workflow creation');
      return;
    } else if (choice.action === 'backup') {
      const backupPath = workflowPath + '.backup-' + Date.now();
      fs.copyFileSync(workflowPath, backupPath);
      console.log(`📋 Created backup: ${backupPath}`);
    } else if (choice.action === 'rename') {
      const newWorkflowPath = path.join(workflowDir, 'coverage-report-new.yml');
      if (fs.existsSync(newWorkflowPath)) {
        const timestamp = Date.now();
        const timestampedPath = path.join(workflowDir, `coverage-report-${timestamp}.yml`);
        console.log(`📝 Creating workflow file: ${timestampedPath}`);
        const content = templateProcessor.generateGitHubWorkflow(nodeVersion);
        fs.writeFileSync(timestampedPath, content);
        console.log(`✅ Created GitHub workflow file: ${timestampedPath}`);
        return;
      } else {
        const content = templateProcessor.generateGitHubWorkflow(nodeVersion);
        fs.writeFileSync(newWorkflowPath, content);
        console.log(`✅ Created GitHub workflow file: ${newWorkflowPath}`);
        return;
      }
    }
  }
  
  const content = templateProcessor.generateGitHubWorkflow(nodeVersion);
  fs.writeFileSync(workflowPath, content);
  console.log(`✅ Created GitHub workflow file: ${workflowPath}`);
}

/**
 * Create or update a Jenkinsfile using templates
 */
async function createJenkinsFile(templateProcessor, nodeVersion = '16') {
  console.log('\n📝 Setting up Jenkinsfile...');
  
  const jenkinsfilePath = path.join(process.cwd(), 'Jenkinsfile');
  
  // Handle existing file
  if (fs.existsSync(jenkinsfilePath)) {
    console.log('⚠️ Jenkinsfile already exists at:', jenkinsfilePath);
    
    const choice = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create a new file (Jenkinsfile.coverage)', value: 'rename' },
          { name: 'Create backup and replace existing file', value: 'backup' },
          { name: 'Skip Jenkinsfile creation', value: 'skip' }
        ],
        default: 'rename'
      }
    ]);
    
    if (choice.action === 'skip') {
      console.log('ℹ️ Skipping Jenkinsfile creation');
      return;
    } else if (choice.action === 'backup') {
      const backupPath = jenkinsfilePath + '.backup-' + Date.now();
      fs.copyFileSync(jenkinsfilePath, backupPath);
      console.log(`📋 Created backup: ${backupPath}`);
    } else if (choice.action === 'rename') {
      const newJenkinsfilePath = path.join(process.cwd(), 'Jenkinsfile.coverage');
      if (fs.existsSync(newJenkinsfilePath)) {
        const timestamp = Date.now();
        const timestampedPath = path.join(process.cwd(), `Jenkinsfile.coverage-${timestamp}`);
        console.log(`📝 Creating Jenkinsfile: ${timestampedPath}`);
        
        // Try to get repo info from package.json or use defaults
        let githubOwner = 'your-org';
        let githubRepo = 'your-repo';
        
        try {
          const packageJsonPath = path.join(process.cwd(), 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.repository && packageJson.repository.url) {
              const repoUrl = packageJson.repository.url;
              const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
              if (match) {
                githubOwner = match[1];
                githubRepo = match[2].replace(/\.git$/, '');
              }
            }
          }
        } catch (error) {
          // Use defaults if we can't parse package.json
        }
        
        const content = templateProcessor.generateJenkinsfile(nodeVersion, githubOwner, githubRepo);
        fs.writeFileSync(timestampedPath, content);
        console.log(`✅ Created Jenkinsfile: ${timestampedPath}`);
        return;
      } else {
        // Try to get repo info from package.json or use defaults
        let githubOwner = 'your-org';
        let githubRepo = 'your-repo';
        
        try {
          const packageJsonPath = path.join(process.cwd(), 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.repository && packageJson.repository.url) {
              const repoUrl = packageJson.repository.url;
              const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
              if (match) {
                githubOwner = match[1];
                githubRepo = match[2].replace(/\.git$/, '');
              }
            }
          }
        } catch (error) {
          // Use defaults if we can't parse package.json
        }
        
        const content = templateProcessor.generateJenkinsfile(nodeVersion, githubOwner, githubRepo);
        fs.writeFileSync(newJenkinsfilePath, content);
        console.log(`✅ Created Jenkinsfile: ${newJenkinsfilePath}`);
        return;
      }
    }
  }
  
  // Try to get repo info from package.json or use defaults
  let githubOwner = 'your-org';
  let githubRepo = 'your-repo';
  
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.repository && packageJson.repository.url) {
        const repoUrl = packageJson.repository.url;
        const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
        if (match) {
          githubOwner = match[1];
          githubRepo = match[2].replace(/\.git$/, '');
        }
      }
    }
  } catch (error) {
    // Use defaults if we can't parse package.json
  }
  
  const content = templateProcessor.generateJenkinsfile(nodeVersion, githubOwner, githubRepo);
  
  fs.writeFileSync(jenkinsfilePath, content);
  console.log(`✅ Created Jenkinsfile: ${jenkinsfilePath}`);
}

/**
 * Create a helper script for running the coverage reporter using templates
 */
async function createHelperScript(useConfigFile = false, config = null, templateProcessor) {
  console.log('\n📝 Creating helper script...');
  
  const scriptsDir = path.join(process.cwd(), 'scripts');
  const scriptPath = path.join(scriptsDir, 'coverage-report.js');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  
  // Handle existing file
  if (fs.existsSync(scriptPath)) {
    console.log('⚠️ Helper script already exists at:', scriptPath);
    
    const choice = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create backup and replace existing script', value: 'backup' },
          { name: 'Directly replace existing script', value: 'replace' },
          { name: 'Skip script creation', value: 'skip' }
        ],
        default: 'backup'
      }
    ]);

    if (choice.action === 'skip') {
      console.log('ℹ️ Skipping helper script creation');
      // Still update package.json with scripts
      updatePackageJson(config);
      return;
    } else if (choice.action === 'backup') {
      const backupPath = scriptPath + '.backup-' + Date.now();
      fs.copyFileSync(scriptPath, backupPath);
      console.log(`📋 Created backup: ${backupPath}`);
    } // 'replace' option does nothing extra, just proceeds to overwrite
  }
  
  // Extract coverage type names from config
  const coverageTypes = config?.coverage?.types?.map(t => t.name) || [];
  
  const content = templateProcessor.generateCoverageScript(useConfigFile, coverageTypes);
  
  fs.writeFileSync(scriptPath, content);
  
  // Make the script executable
  try {
    fs.chmodSync(scriptPath, '755');
  } catch (error) {
    console.warn('⚠️ Could not make script executable');
  }
  
  console.log(`✅ Created helper script: ${scriptPath}`);
  
  // Update package.json with script reference
  updatePackageJson(config);
}

/**
 * Update .gitignore file
 */
function updateGitIgnore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let content = '';
  
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
    
    // Add newline if needed
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
  }
  
  // Check if entry is already there
  if (!content.includes('.env.github-coverage')) {
    content += '\n# GitHub Coverage Reporter\n.env.github-coverage\n';
    fs.writeFileSync(gitignorePath, content);
    console.log('✅ Updated .gitignore file');
  } else {
    console.log('ℹ️ .gitignore already contains necessary entries');
  }
}

/**
 * Update package.json with script reference
 */
function updatePackageJson(config = null) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  // Skip if package.json doesn't exist
  if (!fs.existsSync(packageJsonPath)) {
    console.log('ℹ️ package.json not found, skipping script addition');
    return;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Initialize scripts object if it doesn't exist
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Add scripts
    let updated = false;
    
    if (!packageJson.scripts['coverage-report']) {
      packageJson.scripts['coverage-report'] = 'node scripts/coverage-report.js --all';
      updated = true;
    }
    
    // If we have config with coverage types, generate scripts for each type
    if (config && config.coverage && config.coverage.types) {
      config.coverage.types.forEach(type => {
        const scriptName = `coverage-report:${type.name}`;
        if (!packageJson.scripts[scriptName]) {
          packageJson.scripts[scriptName] = `node scripts/coverage-report.js --name=${type.name}`;
          updated = true;
        }
      });
    } else {
      // Fallback to default scripts if no config provided
      if (!packageJson.scripts['coverage-report:backend']) {
        packageJson.scripts['coverage-report:backend'] = 'node scripts/coverage-report.js --name=backend';
        updated = true;
      }
      
      if (!packageJson.scripts['coverage-report:frontend']) {
        packageJson.scripts['coverage-report:frontend'] = 'node scripts/coverage-report.js --name=frontend';
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('✅ Updated package.json with coverage-report scripts');
    } else {
      console.log('ℹ️ package.json already contains coverage-report scripts');
    }
  } catch (error) {
    console.warn('⚠️ Error updating package.json:', error.message);
  }
}

// Execute the main function
main();
