// Load environment variables from .env.github-coverage (only if file exists)
// This allows the script to work in both local development and CI environments
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env.github-coverage');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('Loaded environment variables from .env.github-coverage');
  }
} catch (error) {
  // Silently continue - environment variables may be provided by CI
}

// Load the configuration file if it exists
let config; // eslint-disable-line no-unused-vars
try {
    // Load configuration from .gcr.json if it exists
  const ConfigManager = require('{{PACKAGE_NAME}}/src/ConfigManager');
  config = ConfigManager.loadConfig();
  console.log('Loaded configuration from .gcr.json');
} catch (error) {
  console.warn(`Warning: ${error.message}`);
  console.warn('Falling back to environment variables for configuration');
}
