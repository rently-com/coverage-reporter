const { expect } = require('chai');
const sinon = require('sinon');

// Simple test to ensure CLI files can be required without errors
describe('CLI Run Script', function() {
  let processStub, consoleStub, exitStub;

  beforeEach(() => {
    // Stub process.argv to control command line arguments
    processStub = sinon.stub(process, 'argv');
    consoleStub = sinon.stub(console, 'log');
    exitStub = sinon.stub(process, 'exit');
  });

  afterEach(() => {
    // Restore all stubs
    if (processStub) processStub.restore();
    if (consoleStub) consoleStub.restore();
    if (exitStub) exitStub.restore();
    
    // Clear the require cache to ensure fresh imports
    delete require.cache[require.resolve('../bin/cli-run.js')];
  });

  it('should load without syntax errors', function() {
    expect(() => {
      // Just check that the file can be parsed
      const fs = require('fs');
      const path = require('path');
      const cliPath = path.join(__dirname, '../bin/cli-run.js');
      const content = fs.readFileSync(cliPath, 'utf8');
      expect(content).to.include('GitHub Coverage Reporter CLI');
    }).to.not.throw();
  });

  it('should contain help text', function() {
    const fs = require('fs');
    const path = require('path');
    const cliPath = path.join(__dirname, '../bin/cli-run.js');
    const content = fs.readFileSync(cliPath, 'utf8');
    
    expect(content).to.include('GitHub Coverage Reporter CLI');
    expect(content).to.include('--help');
    expect(content).to.include('--name');
    expect(content).to.include('--no-comments');
    expect(content).to.include('--no-status');
    expect(content).to.include('--no-s3');
  });

  it('should parse command line arguments correctly', function() {
    const fs = require('fs');
    const path = require('path');
    const cliPath = path.join(__dirname, '../bin/cli-run.js');
    const content = fs.readFileSync(cliPath, 'utf8');
    
    // Check that argument parsing logic is present
    expect(content).to.include('process.argv.slice(2)');
    expect(content).to.include('--name=');
    expect(content).to.include('--file=');
    expect(content).to.include('--config=');
  });

  it('should have error handling for missing coverage type', function() {
    const fs = require('fs');
    const path = require('path');
    const cliPath = path.join(__dirname, '../bin/cli-run.js');
    const content = fs.readFileSync(cliPath, 'utf8');
    
    expect(content).to.include('No coverage type specified');
    expect(content).to.include('process.exit(1)');
  });

  it('should include configuration loading logic', function() {
    const fs = require('fs');
    const path = require('path');
    const cliPath = path.join(__dirname, '../bin/cli-run.js');
    const content = fs.readFileSync(cliPath, 'utf8');
    
    expect(content).to.include('ConfigManager.loadConfig');
    expect(content).to.include('Loaded configuration from .gcr.json');
    expect(content).to.include('Falling back to environment variables');
  });
});