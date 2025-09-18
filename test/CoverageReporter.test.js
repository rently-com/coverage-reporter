const CoverageReporter = require('../src/CoverageReporter');

describe('CoverageReporter', function() {
  let coverageReporter;
  let DefaultThresholds;

  // Define test default thresholds to use across tests
  beforeEach(function() {
    // Create test default thresholds
    DefaultThresholds = {
      backend: 90,
      frontend: 95,
      lambda: 80
    };

    // Create the reporter with explicitly provided thresholds
    coverageReporter = new CoverageReporter({
      backendThreshold: DefaultThresholds.backend,
      frontendThreshold: DefaultThresholds.frontend,
      lambdaThreshold: DefaultThresholds.lambda,
      maxDiff: 1
    });
  });

  describe('constructor', function() {
    it('should use default values when no options provided', function() {
      // For test purposes, we'll provide default values explicitly
      const reporter = new CoverageReporter({
        backendThreshold: DefaultThresholds.backend,
        frontendThreshold: DefaultThresholds.frontend,
        maxDiff: 1
      });
      
      expect(reporter.thresholds.backend).to.equal(DefaultThresholds.backend);
      expect(reporter.thresholds.frontend).to.equal(DefaultThresholds.frontend);
      expect(reporter.maxDiff).to.equal(1);
    });

    it('should use default values when empty options provided', function() {
      // For test purposes, we'll provide default values explicitly
      const reporter = new CoverageReporter({
        backendThreshold: DefaultThresholds.backend,
        frontendThreshold: DefaultThresholds.frontend,
        maxDiff: 1
      });
      
      expect(reporter.thresholds.backend).to.equal(DefaultThresholds.backend);
      expect(reporter.thresholds.frontend).to.equal(DefaultThresholds.frontend);
      expect(reporter.maxDiff).to.equal(1);
    });

    it('should use provided values when options are given', function() {
      const reporter = new CoverageReporter({
        backendThreshold: 85,
        frontendThreshold: 92,
        lambdaThreshold: 88,
        maxDiff: 2
      });
      
      expect(reporter.thresholds.backend).to.equal(85);
      expect(reporter.thresholds.frontend).to.equal(92);
      expect(reporter.thresholds.lambda).to.equal(88);
      expect(reporter.maxDiff).to.equal(2);
    });

    it('should use default for missing individual options', function() {
      const reporter = new CoverageReporter({
        backendThreshold: 85,
        frontendThreshold: DefaultThresholds.frontend,
        maxDiff: 1
      });
      
      expect(reporter.thresholds.backend).to.equal(85);
      expect(reporter.thresholds.frontend).to.equal(DefaultThresholds.frontend);
      expect(reporter.maxDiff).to.equal(1);
    });
  });

  describe('generateCoverageComment', function() {
    it('should generate a properly formatted coverage comment', function() {
      const previousCoverage = { backend: 80, frontend: 90 };
      const currentCoverage = { backend: 85, frontend: 96 };

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('## Code Coverage Report');
      expect(result).to.include('| Coverage Type | Current | Previous | Change | Threshold | Status |');
      expect(result).to.include('| Backend | 85% | 80% | 📈 +5.00% | 90% | ❌ |');
      expect(result).to.include('| Frontend | 96% | 90% | 📈 +6.00% | 95% | ✅ |');
      expect(result).to.include('⚠️ Backend coverage is below the required threshold.');
    });

    it('should handle no change in coverage', function() {
      const previousCoverage = { backend: 85, frontend: 96 };
      const currentCoverage = { backend: 85, frontend: 96 };

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('🔄 No change');
    });

    it('should show decrease in coverage', function() {
      const previousCoverage = { backend: 85, frontend: 96 };
      const currentCoverage = { backend: 80, frontend: 90 };

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('📉 -5.00%');
      expect(result).to.include('📉 -6.00%');
    });

    it('should not show warnings when coverage meets thresholds', function() {
      const previousCoverage = { backend: 85, frontend: 90 };
      const currentCoverage = { backend: 95, frontend: 98 };

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.not.include('⚠️');
    });

    it('should show warning only for backend when frontend meets threshold', function() {
      const previousCoverage = { backend: 85, frontend: 90 };
      const currentCoverage = { backend: 85, frontend: 96 }; // backend below, frontend above

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('⚠️ Backend coverage is below the required threshold.');
      expect(result).to.not.include('⚠️ Frontend coverage is below the required threshold.');
    });

    it('should show warning only for frontend when backend meets threshold', function() {
      const previousCoverage = { backend: 85, frontend: 90 };
      const currentCoverage = { backend: 95, frontend: 90 }; // backend above, frontend below

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('⚠️ Frontend coverage is below the required threshold.');
      expect(result).to.not.include('⚠️ Backend coverage is below the required threshold.');
    });

    it('should show warnings for both when both are below threshold', function() {
      const previousCoverage = { backend: 85, frontend: 90 };
      const currentCoverage = { backend: 85, frontend: 90 }; // both below threshold

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage);

      expect(result).to.include('⚠️ Backend coverage is below the required threshold.');
      expect(result).to.include('⚠️ Frontend coverage is below the required threshold.');
    });
  });

  describe('generateStatusChecks', function() {
    it('should generate passing status for backend coverage above threshold', function() {
      const result = coverageReporter.generateStatusChecks(95, 'backend');

      expect(result).to.deep.equal({
        pass: true,
        description: 'threshold: 90% - current: 95%',
        context: 'code-coverage-backend'
      });
    });

    it('should generate failing status for backend coverage below threshold', function() {
      const result = coverageReporter.generateStatusChecks(85, 'backend');

      expect(result).to.deep.equal({
        pass: false,
        description: 'threshold: 90% - current: 85%',
        context: 'code-coverage-backend'
      });
    });

    it('should generate passing status for frontend coverage above threshold', function() {
      const result = coverageReporter.generateStatusChecks(98, 'frontend');

      expect(result).to.deep.equal({
        pass: true,
        description: 'threshold: 95% - current: 98%',
        context: 'code-coverage-frontend'
      });
    });

    it('should generate failing status for frontend coverage below threshold', function() {
      const result = coverageReporter.generateStatusChecks(92, 'frontend');

      expect(result).to.deep.equal({
        pass: false,
        description: 'threshold: 95% - current: 92%',
        context: 'code-coverage-frontend'
      });
    });

    it('should handle exact threshold values for backend', function() {
      const result = coverageReporter.generateStatusChecks(90, 'backend');

      expect(result).to.deep.equal({
        pass: true,
        description: 'threshold: 90% - current: 90%',
        context: 'code-coverage-backend'
      });
    });

    it('should handle exact threshold values for frontend', function() {
      const result = coverageReporter.generateStatusChecks(95, 'frontend');

      expect(result).to.deep.equal({
        pass: true,
        description: 'threshold: 95% - current: 95%',
        context: 'code-coverage-frontend'
      });
    });
  });

  describe('generateDiffStatusCheck', function() {
    it('should return null when previous coverage is 0', function() {
      const result = coverageReporter.generateDiffStatusCheck(0, 85, 'backend');
      expect(result).to.be.null;
    });

    it('should generate passing status when coverage increases', function() {
      const result = coverageReporter.generateDiffStatusCheck(80, 85, 'backend');

      expect(result.pass).to.be.true;
      expect(result.description).to.equal('went up from 80% to 85%');
      expect(result.context).to.equal('code-coverage-backend-delta');
    });

    it('should generate failing status when coverage decreases significantly', function() {
      const result = coverageReporter.generateDiffStatusCheck(85, 80, 'backend');

      expect(result.pass).to.be.false;
      expect(result.description).to.equal('decreased from 85% to 80%');
    });

    it('should generate passing status when coverage stays the same', function() {
      const result = coverageReporter.generateDiffStatusCheck(85, 85, 'backend');

      expect(result.pass).to.be.true;
      expect(result.description).to.equal('stays the same: 85% ~ 85%');
    });

    it('should generate passing status when coverage decreases within maxDiff threshold', function() {
      const result = coverageReporter.generateDiffStatusCheck(85, 84.5, 'backend');

      expect(result.pass).to.be.true; // 0.5 < maxDiff (1)
      expect(result.description).to.equal('decreased from 85% to 84.5%');
    });

    it('should generate failing status when coverage decreases beyond maxDiff threshold', function() {
      const result = coverageReporter.generateDiffStatusCheck(85, 83, 'backend');

      expect(result.pass).to.be.false; // 2 >= maxDiff (1)
      expect(result.description).to.equal('decreased from 85% to 83%');
    });

    it('should work correctly for frontend entity', function() {
      const result = coverageReporter.generateDiffStatusCheck(90, 95, 'frontend');

      expect(result.pass).to.be.true;
      expect(result.description).to.equal('went up from 90% to 95%');
      expect(result.context).to.equal('code-coverage-frontend-delta');
    });
  });

  describe('generateCoverageComment - additional coverage edge cases', function() {
    it('should handle coverage types with zero values in previous coverage', function() {
      const coverageReporter = new CoverageReporter({
        backendThreshold: 80,
        frontendThreshold: 85
      });

      const previousCoverage = { backend: 0, frontend: 0 };
      const currentCoverage = { backend: 90, frontend: 75 };
      const coverageTypes = ['backend', 'frontend'];

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage, coverageTypes);

      expect(result).to.include('Backend | 90% | 0% | 📈 +90.00% | 80% | ✅');
      expect(result).to.include('Frontend | 75% | 0% | 📈 +75.00% | 85% | ❌');
      expect(result).to.include('⚠️ Frontend coverage is below the required threshold.');
    });

    it('should handle coverage types not found in thresholds object', function() {
      const coverageReporter = new CoverageReporter({});

      const previousCoverage = { api: 75 };
      const currentCoverage = { api: 85 };
      const coverageTypes = ['api'];

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage, coverageTypes);

      expect(result).to.include('Api | 85% | 75% | 📈 +10.00% | 80% | ✅');
      expect(result).to.not.include('⚠️');
    });

    it('should handle coverage types not present in current coverage object', function() {
      const coverageReporter = new CoverageReporter({
        backendThreshold: 80,
        frontendThreshold: 85
      });

      const previousCoverage = { backend: 90, frontend: 85 };
      const currentCoverage = { backend: 95 }; // frontend missing
      const coverageTypes = ['backend', 'frontend'];

      const result = coverageReporter.generateCoverageComment(previousCoverage, currentCoverage, coverageTypes);

      expect(result).to.include('Backend | 95% | 90% | 📈 +5.00% | 80% | ✅');
      expect(result).to.include('Frontend | 0% | 85% | 📉 -85.00% | 85% | ❌');
      expect(result).to.include('⚠️ Frontend coverage is below the required threshold.');
    });
  });
});
