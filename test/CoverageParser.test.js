const fs = require('fs');
const sinon = require('sinon');
const { expect } = require('chai');
const CoverageParser = require('../src/CoverageParser');

describe('CoverageParser', function() {
  describe('parseSingleFile', function() {
    beforeEach(function() {
      this.sandbox = sinon.createSandbox();
      this.sandbox.stub(fs, 'existsSync');
      this.sandbox.stub(fs, 'readFileSync');
    });

    afterEach(function() {
      this.sandbox.restore();
    });

    it('should parse coverage from a single valid JSON file', function() {
      const coverageData = { total: { statements: { pct: 87.5 } } };
      
      fs.existsSync.withArgs('coverage.json').returns(true);
      fs.readFileSync.withArgs('coverage.json', 'utf8').returns(JSON.stringify(coverageData));

      const result = CoverageParser.parseSingleFile('coverage.json');

      expect(result).to.equal(87.5);
    });

    it('should return 0 for missing file', function() {
      fs.existsSync.withArgs('missing.json').returns(false);

      const result = CoverageParser.parseSingleFile('missing.json');

      expect(result).to.equal(0);
    });

    it('should throw error for invalid JSON in single file', function() {
      fs.existsSync.withArgs('invalid.json').returns(true);
      fs.readFileSync.withArgs('invalid.json', 'utf8').returns('invalid json');

      expect(() => CoverageParser.parseSingleFile('invalid.json')).to.throw();
    });
  });
});
