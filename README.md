# GitHub Coverage Reporter

A modular npm package for reporting code coverage to GitHub pull requests with status checks and comments.

## Features

- 📊 Posts coverage status checks to GitHub commits
- 💬 Adds detailed coverage reports as PR comments  
- 📈 Tracks coverage changes over time
- ☁️ Stores coverage history in S3 (optional)
- 🎯 Configurable coverage thresholds per coverage type
- 📦 Modular and reusable across projects
- 🔄 **Dynamic coverage type support** - api, web, lambda, services, or any custom type
- 🔧 **CLI parameters** - `--name=<type>` for flexible coverage reporting
- 🏗️ **Multi-type projects** - run multiple times for different coverage types
- 🚀 **Interactive initialization** - smart setup wizard for any project structure
- 🎯 **Dynamic npm scripts** - automatically generates scripts based on your coverage types

## Installation

```bash
npm install @rently-com/github-coverage-reporter
```

## Quick Start

Initialize the GitHub Coverage Reporter in your project with an interactive setup wizard:

```bash
# Using npx (recommended)
npx github-coverage-init

# Or after installation
npm install github-coverage-reporter
npx github-coverage-reporter init
```

### 🎯 Smart Initialization

The interactive wizard will:

1. **Detect your project structure** and suggest appropriate coverage types
2. **Generate dynamic npm scripts** based on your choices (no more hardcoded names!)
3. **Create configuration files** tailored to your setup
4. **Set up CI/CD integration** for GitHub Actions, Jenkins, or custom workflows

**Example**: If you choose "api" and "web-client" as coverage types, it automatically creates:

- `npm run coverage-report:api`
- `npm run coverage-report:web-client`
- Corresponding configuration for each type

After initialization, simply edit your configuration file with your project-specific values, then run:

```bash
# Run coverage for all configured types
npm run coverage-report:api
npm run coverage-report:web-client

# Or run them all in sequence
npm run coverage-report:all  # (if you selected this option during setup)
```

## Usage

### As a CLI tool

The module supports different coverage types through command-line parameters:

```bash
# Specify coverage type (required)
npx github-coverage-reporter --name=api
npx github-coverage-reporter --name=web
npx github-coverage-reporter --name=lambda
npx github-coverage-reporter --name=services

# Custom file path
npx github-coverage-reporter --name=api --file=./custom/coverage-summary.json

# Disable specific features
npx github-coverage-reporter --name=web --no-comments
npx github-coverage-reporter --name=api --no-status --no-s3

# Show help
npx github-coverage-reporter --help
```

**For projects with multiple coverage types**, run the command multiple times:

```bash
# In CI/CD pipeline or script
npx github-coverage-reporter --name=api
npx github-coverage-reporter --name=web
npx github-coverage-reporter --name=lambda
npx github-coverage-reporter --name=services
```

### Programmatically

```javascript
const GitHubCoverageReporter = require('@rently-com/github-coverage-reporter');

const reporter = new GitHubCoverageReporter({
  coverageType: 'api', // Specify the coverage type for this run
  github: {
    owner: 'your-org',
    repo: 'your-repo',
    token: 'github-token',
    currentBranch: 'feature-branch',
    sha: 'commit-sha',
    pullRequestNumber: 123
  },
  coverage: {
    thresholds: {
      api: 90,
      web: 95,
      lambda: 80,
      services: 85
    }
  }
});

// With automatic file detection
await reporter.run();

// With custom coverage data
await reporter.run(87.5, { coverageType: 'api' });

// For multiple coverage types, create separate instances or call multiple times
const webReporter = new GitHubCoverageReporter({
  coverageType: 'web',
  // ... other options
});
await webReporter.run();
```

## Configuration

### JSON Configuration File (Recommended)

The simplest way to configure the GitHub Coverage Reporter is to use a `.gcr.json` file, which can be created with the initialization wizard:

```bash
# Create a configuration file interactively
npx github-coverage-reporter init
# Select "Use .gcr.json configuration file"
```

The configuration file approach offers several advantages:

- Reduced environment variables (only GitHub and AWS credentials needed)
- Version-controllable configuration
- Structured settings for all coverage types
- Explicit configuration with no hidden defaults

See [Configuration File Documentation](./docs/configuration-file.md) for details on the structure and options.

### Environment Variables

Alternatively, you can use environment variables for configuration:

```bash
# Initialize with environment variables
npx github-coverage-reporter init
# Select "Use .env environment variables file"
```

This will create an `.env.github-coverage` file template that you can fill in with your values.

**CI/CD Friendly**: The reporter automatically detects whether environment variables are provided by CI systems (like GitHub Actions, Jenkins) or from local `.env` files. In CI environments, simply set the environment variables through your CI system's secrets/environment configuration - no `.env` file is needed.

See [Environment Variables Documentation](./docs/environment-variables.md) for a complete list of available variables.

### Required Variables

When using environment variables for configuration, you must set:

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_ACCESS_TOKEN` | GitHub personal access token | `ghp_abc123...` |
| `GITHUB_REPO` | Repository name | `rently-billing` |
| `GITHUB_OWNER` | Repository owner | `rently-com` |
| `GITHUB_CURR_BRANCH` | Current branch name | `feature/my-feature` |
| `<TYPE>_COVERAGE_SUMMARY_JSON_PATH` | Path to coverage JSON file | `./artifacts/coverage-summary.json` |

When using the `.gcr.json` configuration file, you only need:

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_ACCESS_TOKEN` | GitHub personal access token | `ghp_abc123...` |
| `GITHUB_REPO` | Repository name | `rently-billing` |
| `GITHUB_OWNER` | Repository owner | `rently-com` |
| `GITHUB_CURR_BRANCH` | Current branch name | `feature/my-feature` |

**Note:** For each coverage type you want to report, you MUST either:

- Define it in your `.gcr.json` configuration file
- OR set the corresponding `<TYPE>_COVERAGE_SUMMARY_JSON_PATH` environment variable
- OR provide the `--file=<path>` parameter when running the CLI command

All default values have been removed to make configuration explicit.

### Required for S3 Storage

If you want to store coverage history in S3:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_S3_BUCKET` | S3 bucket name | `my-coverage-bucket` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | `AKIAXXXXXXXXXXXXXXXX` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

When using the configuration file, the S3 bucket name and folder structure can be defined in `.gcr.json`, but credentials should always be provided as environment variables for security.

### Options Object

```javascript
{
  github: {
    owner: 'string',
    repo: 'string', 
    token: 'string',
    currentBranch: 'string',
    targetBranch: 'string',
    commitSha: 'string',
    userAgent: 'string'
  },
  s3: {
    bucketName: 'string',
    folderName: 'string',
    region: 'string',
    s3Options: {} // Additional S3 client options
  },
  coverage: {
    api: 90,
    web: 95,
    lambda: 80,
    services: 85,
    maxDiff: 1
  },
  addComments: true,        // Add PR comments
  setStatusChecks: true,    // Set GitHub status checks
  storeInS3: true,         // Store coverage in S3
  fileName: 'coverage'      // S3 file name
}
```

## API

### GitHubCoverageReporter

Main class for handling coverage reporting.

#### Methods

- `run(coverageData?, options?)` - Main method to run coverage reporting
- `parseCoverageFromFiles(options?)` - Parse coverage from JSON files
- `setStatusChecks(currentCoverage, previousCoverage)` - Set GitHub status checks
- `addCoverageComment(currentCoverage, previousCoverage, prNumber)` - Add PR comment

### Helper Classes

- `GitHubHelper` - GitHub API interactions
- `S3Helper` - S3 operations for coverage storage
- `CoverageReporter` - Coverage report generation
- `CoverageParser` - Coverage data parsing

## Example Output

The module generates a coverage report like this:

```markdown
## Code Coverage Report

| Coverage Type | Current | Previous | Change | Threshold | Status |
|--------------|---------|-----------|---------|-----------|---------|
| API | 85% | 80% | 📈 +5.00% | 90% | ❌ |
| Web Client | 96% | 95% | 📈 +1.00% | 95% | ✅ |
| Lambda | 88% | 85% | 📈 +3.00% | 80% | ✅ |

⚠️ API coverage is below the required threshold.
```

## Development

### Security

This project uses [secretlint](https://github.com/secretlint/secretlint) to prevent secrets from being committed to the repository.

```bash
# Check for secrets in the codebase
npm run lint:secrets

# Run all linting (ESLint + secretlint)
npm run lint:all
```

**Security Features:**

- 🔍 **Automatic secret detection** - Prevents API keys, tokens, and credentials from being committed
- 🚨 **Pre-commit hooks** - Automatically runs secretlint before each commit
- 🛡️ **CI/CD integration** - GitHub Actions workflows include secret scanning
- 📋 **Configurable rules** - Uses the recommended rule preset with customizable exceptions

See [Security Documentation](./docs/secretlint.md) for detailed configuration and usage.

### Testing the Package

This project includes comprehensive testing environments to validate functionality before using in production:

```bash
# Quick interactive test (minimal setup)
npm run test:quick

# Full realistic test (complete project simulation)
npm run test:local

# Automated validation suite (tests multiple scenarios)
npm run test:automated

# Clean up generated test projects
npm run test:clean
```

#### Testing Options Explained

- **`test:quick`** - Creates a minimal test project for quick validation of the initialization flow
- **`test:local`** - Creates a realistic project with complete source structure (API, Web, Lambda, Utils)
- **`test:automated`** - Runs automated tests across multiple project scenarios
- **`test:clean`** - Removes all generated test projects while preserving test scripts

All test environments are safely isolated using gitignore patterns and create temporary projects within the `test-environments/` directory.

### Unit Testing

This project uses Mocha for testing with Chai for assertions and Sinon for mocking.

```bash
# Run unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

The project uses `.nycrc` to configure coverage thresholds and reporters. Custom thresholds have been set to ensure adequate test coverage while being realistic about coverage goals.

### Test Structure

```bash
test/
├── setup.js                    # Test setup and configuration
├── CoverageReporter.test.js     # CoverageReporter tests
├── CoverageParser.test.js       # CoverageParser tests
├── GitHubHelper.test.js         # GitHubHelper tests
└── S3Helper.test.js             # S3Helper tests

test-environments/
├── README.md                    # Testing environments documentation
├── local-test.js               # Interactive testing with realistic projects
├── automated-test.js           # Automated validation suite
└── quick-test.js               # Quick minimal testing setup
```

## License

MIT
