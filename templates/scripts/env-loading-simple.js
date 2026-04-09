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
  console.warn('Could not load .env.github-coverage, proceeding without it.', error.message);
}
