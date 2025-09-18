# Secretlint

This project uses [secretlint](https://github.com/secretlint/secretlint) to prevent secrets from being committed to the repository.

## Usage

- **Check for secrets**: `npm run lint:secrets`
- **Run all linting (ESLint + secretlint)**: `npm run lint:all`

## Configuration

- **`.secretlintrc.json`**: Main configuration file with rules
- **`.secretlintignore`**: Files and patterns to ignore during secret scanning

## Rules

We use the recommended rule preset (`@secretlint/secretlint-rule-preset-recommend`) which includes:

- AWS Access Key detection
- GitHub Token detection
- Google API Key detection
- Slack Token detection
- Private Key detection
- And many more...

## Adding Exceptions

If you need to add legitimate exceptions (like example configurations), you can:

1. Add the file pattern to `.secretlintignore`
2. Use inline comments to disable specific rules:
   ```javascript
   const apiKey = "sk-1234567890abcdef"; // secretlint-disable-line
   ```

## CI Integration

The `prepare` script runs both ESLint and secretlint before any npm operations, ensuring no secrets are accidentally committed.