class CoverageReporter {
  constructor(options = {}) {
    // Default thresholds for different coverage types
    this.thresholds = {
      backend: options.backendThreshold || 90,
      frontend: options.frontendThreshold || 95,
      lambda: options.lambdaThreshold || 80,
      ...options.customThresholds
    };
    this.maxDiff = [null, undefined].includes(options.maxDiff) ? 0 : options.maxDiff;
    this.coverageTypes = options.coverageTypes || ['backend', 'frontend'];
  }

  generateCoverageComment(previousCoverage, currentCoverage, coverageTypes = this.coverageTypes) {
    const getChangeEmoji = (curr, prev) => {
      if (curr > prev) return '📈';
      if (curr < prev) return '📉';
      return '🔄';
    };

    const getChangeText = (curr, prev) => {
      if (curr === prev) return 'No change';
      const diff = (curr - prev).toFixed(2);
      return curr > prev ? `+${diff}%` : `${diff}%`;
    };

    const isCoverageDropWithinLimit = (curr, prev) => {
      const diffCoverage = prev - curr;
      if (diffCoverage <= this.maxDiff) {
        return true;
      }
      return false;
    };

    const getStatusEmoji = (success) => success ? '✅' : '❌';

    // Generate table rows for each coverage type
    const tableRows = coverageTypes.map(type => {
      const current = currentCoverage[type] || 0;
      const previous = previousCoverage[type] || 0;
      const threshold = this.thresholds[type] || 80;
      const changeStatus = isCoverageDropWithinLimit(current, previous);
      const overallStatus = current >= threshold && changeStatus;

      return `| ${type.charAt(0).toUpperCase() + type.slice(1)} | ${current}% | ${previous}% | ${getChangeEmoji(current, previous)} ${getChangeText(current, previous)} | ${threshold}% | ${getStatusEmoji(overallStatus)} |`;
    }).join('\n');

    // Generate warnings for coverage types below threshold
    const warnings = coverageTypes
      .filter(type => {
        if (!isCoverageDropWithinLimit(currentCoverage[type], previousCoverage[type])) {
          return true;
        }
        return (currentCoverage[type] || 0) < this.thresholds[type];
      })
      .map(type => `⚠️ ${type.charAt(0).toUpperCase() + type.slice(1)} coverage is below the required threshold / max allowed change of ${this.maxDiff}%.`);

    const warningText = warnings.length > 0 ? '\n\n' + warnings.join('\n') : '';

    return `## Code Coverage Report

| Coverage Type | Current | Previous | Change | Threshold | Status |
|--------------|---------|-----------|---------|-----------|---------|
${tableRows}${warningText}`;
  }

  generateStatusChecks(coverage, coverageType) {
    const threshold = this.thresholds[coverageType] || 80;
    
    return {
      pass: coverage >= threshold,
      description: `threshold: ${threshold}% - current: ${coverage}%`,
      context: `code-coverage-${coverageType}`,
    };
  }

  generateDiffStatusCheck(previousCoverage, currentCoverage, coverageType) {
    if (previousCoverage === 0) {
      return null;
    }

    const diffCoverage = previousCoverage - currentCoverage;
    const pass = diffCoverage <= this.maxDiff;

    let description;
    if (currentCoverage === previousCoverage) {
      description = `stays the same: ${previousCoverage}% ~ ${currentCoverage}%`;
    } else if (currentCoverage > previousCoverage) {
      description = `went up from ${previousCoverage}% to ${currentCoverage}%`;
    } else {
      description = `decreased from ${previousCoverage}% to ${currentCoverage}%`;
    }

    return {
      pass,
      description,
      context: `code-coverage-${coverageType}-delta`,
    };
  }
}

module.exports = CoverageReporter;
