# Template System Documentation

The GitHub Coverage Reporter uses a template-based system for generating configuration files, CI/CD workflows, and scripts. This provides better maintainability, consistency, and flexibility.

## Template Structure

```text
templates/
├── env/                     # Environment variable templates
│   ├── minimal.env         # Minimal config for .gcr.json users
│   └── full.env            # Full config with dynamic placeholders
├── cicd/                   # CI/CD workflow templates
│   ├── github-actions.yml  # GitHub Actions workflow
│   ├── gitlab-ci.yml       # GitLab CI configuration
│   └── Jenkinsfile         # Jenkins pipeline
└── scripts/                # Script templates
    ├── coverage-report.js           # Main coverage script
    ├── env-loading-simple.js       # Basic env loading
    └── env-loading-with-config.js  # Env + config loading
```

## Template Variables

Templates use placeholder replacement for dynamic content:

### Supported Placeholder Formats

1. **Double braces**: `{{VARIABLE_NAME}}`
2. **Placeholder suffix**: `VARIABLE_NAME_PLACEHOLDER`

### Common Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PACKAGE_NAME` | Package name (auto-injected) | `@rently-com/github-coverage-reporter` |
| `NODE_VERSION` | Node.js version for CI | `16`, `18`, `20` |
| `GITHUB_OWNER` | GitHub organization/user | `my-org` |
| `GITHUB_REPO` | Repository name | `my-repo` |
| `COVERAGE_THRESHOLDS` | Dynamic coverage thresholds | Generated from config |
| `COVERAGE_FILE_PATHS` | Dynamic file paths | Generated from config |
| `ENV_LOADING_SECTION` | Environment loading code | From sub-templates |
| `USE_CONFIG_FILE` | Whether to use .gcr.json | `true`/`false` |
| `DEFAULT_TYPES` | Default coverage types | `['api', 'web']` |

## TemplateProcessor Class

### Methods

#### `processTemplate(templatePath, variables)`

Process a template file with variable replacement.

**Auto-injected Variables:**
- `PACKAGE_NAME`: Automatically loaded from package.json

```javascript
const processor = new TemplateProcessor();
const content = processor.processTemplate('scripts/coverage-report.js', { NODE_VERSION: '18' });
// PACKAGE_NAME is automatically available as '@rently-com/github-coverage-reporter'
```

#### `generateEnvFile(minimal, coverageTypes)`
Generate environment variable file content.

```javascript
const coverageTypes = [
  { name: 'api', threshold: 90 },
  { name: 'web', threshold: 95 }
];
const envContent = processor.generateEnvFile(false, coverageTypes);
```

#### `generateGitHubWorkflow(nodeVersion)`
Generate GitHub Actions workflow content.

```javascript
const workflow = processor.generateGitHubWorkflow('18');
```

#### `generateJenkinsfile(nodeVersion, githubOwner, githubRepo)`
Generate Jenkinsfile content.

```javascript
const jenkinsfile = processor.generateJenkinsfile('18', 'my-org', 'my-repo');
```

#### `generateCoverageScript(useConfigFile, coverageTypes)`
Generate coverage reporter script content.

```javascript
const script = processor.generateCoverageScript(true, ['api', 'web']);
```

#### `getAvailableTemplates()`
List all available templates.

```javascript
const templates = processor.getAvailableTemplates();
// Returns: { env: [...], cicd: [...], scripts: [...] }
```

## Dynamic Content Generation

### Environment Variables

The `full.env` template generates dynamic sections based on coverage types:

**Input:**
```javascript
[
  { name: 'api', threshold: 90 },
  { name: 'web', threshold: 95 }
]
```

**Generated:**
```bash
# Coverage Thresholds
API_COVERAGE_THRESHOLD=  # e.g., 90
WEB_COVERAGE_THRESHOLD=  # e.g., 95

# Coverage File Paths
API_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for api coverage
WEB_COVERAGE_SUMMARY_JSON_PATH=  # REQUIRED for web coverage
```

### Scripts

The coverage script template dynamically includes:

1. **Environment loading section** - Based on configuration method
2. **Coverage types** - From user configuration
3. **Config file usage** - Boolean flag for .gcr.json usage

## Benefits

### ✅ Maintainability
- All templates in dedicated files
- Single source of truth for each file type
- Easy to update and version control

### ✅ Consistency
- Standardized variable replacement
- Consistent formatting across generated files
- Reduced copy-paste errors

### ✅ Flexibility
- Dynamic content based on user choices
- Support for any number of coverage types
- Extensible for new template types

### ✅ Testing
- Templates can be tested independently
- Generated content validation
- Easy to verify template processing

## Adding New Templates

1. **Create template file** in appropriate directory
2. **Add placeholders** using `{{VARIABLE}}` format
3. **Update TemplateProcessor** with generation method
4. **Add tests** for new template functionality

### Example: New Template

```javascript
// templates/cicd/azure-pipelines.yml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '{{NODE_VERSION}}'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '$(nodeVersion)'
```

```javascript
// In TemplateProcessor.js
generateAzurePipeline(nodeVersion = '16') {
  return this.processTemplate('cicd/azure-pipelines.yml', {
    NODE_VERSION: nodeVersion
  });
}
```

## Migration Benefits

The template-based approach provides:

1. **Reduced code duplication** - 80% reduction in string literals
2. **Better separation of concerns** - Logic vs. content
3. **Easier maintenance** - Update templates, not code
4. **Enhanced testing** - Template validation and generation testing
5. **Future extensibility** - Easy to add new CI/CD systems
