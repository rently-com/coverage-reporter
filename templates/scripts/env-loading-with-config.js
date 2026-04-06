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
  console.warn('Could not load .env.github-coverage, proceeding without it.', error.message);
}

// Load the configuration file if it exists
let config;
try {
    // Load configuration from .gcr.json if it exists
  const ConfigManager = require('{{PACKAGE_NAME}}/src/ConfigManager');
  config = ConfigManager.loadConfig(); // eslint-disable-line no-unused-vars
  console.log('Loaded configuration from .gcr.json');
} catch (error) {
  console.warn(`Warning: ${error.message}`);
  console.warn('Falling back to environment variables for configuration');
}
