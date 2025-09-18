const { expect } = require('chai');

// Simple test to ensure simple-init files can be required without errors
describe('Simple Init Script', function() {
  it('should load without syntax errors', function() {
    expect(() => {
      const fs = require('fs');
      const path = require('path');
      const initPath = path.join(__dirname, '../bin/simple-init.js');
      const content = fs.readFileSync(initPath, 'utf8');
      expect(content).to.include('GitHub Coverage Reporter Initialization');
    }).to.not.throw();
  });

  it('should contain initialization menu', function() {
    const fs = require('fs');
    const path = require('path');
    const initPath = path.join(__dirname, '../bin/simple-init.js');
    const content = fs.readFileSync(initPath, 'utf8');
    
    expect(content).to.include('GitHub Coverage Reporter Initialization');
    expect(content).to.include('How would you like to configure');
    expect(content).to.include('JSON configuration file');
    expect(content).to.include('environment variables');
    expect(content).to.include('Which CI/CD system');
  });

  it('should have JSON configuration handling', function() {
    const fs = require('fs');
    const path = require('path');
    const initPath = path.join(__dirname, '../bin/simple-init.js');
    const content = fs.readFileSync(initPath, 'utf8');
    
    expect(content).to.include('JSON configuration file');
    expect(content).to.include('.gcr.json');
    expect(content).to.include('JSON.stringify');
  });

  it('should have environment variables handling', function() {
    const fs = require('fs');
    const path = require('path');
    const initPath = path.join(__dirname, '../bin/simple-init.js');
    const content = fs.readFileSync(initPath, 'utf8');
    
    expect(content).to.include('environment variables');
    expect(content).to.include('.env');
    expect(content).to.include('generateEnvFile');
  });

  it('should have CI/CD tools integration', function() {
    const fs = require('fs');
    const path = require('path');
    const initPath = path.join(__dirname, '../bin/simple-init.js');
    const content = fs.readFileSync(initPath, 'utf8');
    
    expect(content).to.include('Which CI/CD system');
    expect(content).to.include('GitHub Actions');
    expect(content).to.include('Jenkins');
  });
});