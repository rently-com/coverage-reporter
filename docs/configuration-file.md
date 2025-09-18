# Configuration File Guide

## Overview

GitHub Coverage Reporter now supports a JSON-based configuration approach using a `.gcr.json` file. This reduces the reliance on environment variables, makes your configuration more explicit and version-controllable, and provides a more structured way to configure the tool.

## Why Use a Configuration File?

- **Version Control**: Your coverage settings can be committed to version control
- **Reduced Environment Variables**: Only GitHub authentication and AWS credentials remain as environment variables
- **Structured Configuration**: JSON format provides better organization of settings
- **Explicit Settings**: No more hidden defaults - all settings are explicitly defined
- **Easier to Share**: The configuration can be shared across team members and CI/CD environments
- **Multi-Project Support**: Easier to maintain different configurations for monorepos

## Configuration File Structure

The `.gcr.json` file follows this structure:

```json
{
  "coverage": {
    "types": [
      {
        "name": "backend",
        "path": "./artifacts/coverage-summary.json",
        "threshold": 80
      },
      {
        "name": "frontend", 
        "path": "./frontend/coverage/coverage-summary.json",
        "threshold": 70
      },
      {
        "name": "lambda",
        "path": "./lambda/coverage/coverage-summary.json",
        "threshold": 60
      }
    ],
    "maxDiff": 5
  },
  "fileName": "coverage",
  "statusCheck": {
    "enabled": true,
    "context": "Coverage Report"
  },
  "comment": {
    "enabled": true,
    "header": "# Coverage Report",
    "footer": "## Coverage is enforced by GitHub Status Check"
  }
}
```

### Configuration Options

#### `coverage` Section

- `types`: Array of coverage types to monitor
  - `name`: Name of the coverage type (e.g., "backend", "frontend")
  - `path`: Path to the coverage-summary.json file for this type
  - `threshold`: Minimum acceptable coverage percentage (0-100)
- `maxDiff`: Maximum allowed decrease in coverage percentage

#### `fileName`

- Base filename for S3 storage (used if S3 storage is configured)

#### `statusCheck` Section

- `enabled`: Whether to create GitHub status checks (default: true)
- `context`: The context name for the GitHub status check

#### `comment` Section

- `enabled`: Whether to add PR comments with coverage information (default: true)
- `header`: Custom header for the PR comment
- `footer`: Custom footer for the PR comment

## Environment Variables (Minimal Set)

When using the configuration file approach, you only need to set these environment variables:

### Required

- `GITHUB_ACCESS_TOKEN`: GitHub token with repo permissions
- `GITHUB_OWNER`: GitHub organization or username
- `GITHUB_REPO`: Repository name (without owner)
- `GITHUB_CURR_BRANCH`: Current branch name

### Optional

- `GITHUB_TARGET_BRANCH`: Target branch for PRs (default: "main")
- `GITHUB_SHA`: Commit SHA (optional, used for status checks)
- `AWS_S3_BUCKET`: S3 bucket name (only if storing coverage history)
- `AWS_REGION`: AWS region for S3 bucket
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key

## Getting Started with the Configuration File

### Creating a Configuration File

The easiest way to create a configuration file is using the initialization command:

```bash
npx github-coverage-reporter init
```

When prompted, select "Use .gcr.json configuration file" as your configuration type.

You can also run the configuration wizard directly:

```bash
npm run gcr:init-config
```

### Manual Configuration

Alternatively, you can create a `.gcr.json` file manually in your project root with the structure shown above.

### Running with the Configuration File

When using a configuration file, you can run the coverage reporter with:

```bash
node scripts/coverage-report.js
```

The reporter will automatically detect and load the `.gcr.json` file if it exists.

## Overriding Configuration

Command-line options take precedence over the configuration file, which takes precedence over environment variables. This allows you to override specific settings when needed.

For example, to specify a different configuration file:

```bash
node scripts/coverage-report.js --config ./custom-config.json
```

## Migrating from Environment Variables

If you're currently using environment variables and want to migrate to the configuration file approach:

1. Run the initialization command and select the configuration file option
2. The wizard will attempt to detect your current settings from environment variables
3. Review and adjust the generated configuration file
4. Update your CI/CD pipelines to use the new minimal set of environment variables

## Best Practices

- Commit your `.gcr.json` file to version control
- Use environment variables for secrets (GitHub token, AWS credentials)
- Set up different configuration files for different projects in a monorepo
- Update your CI/CD pipelines to use the configuration file approach
