const fs = require('fs');

class CoverageParser {
  static parseFromFiles(coverageFilePaths) {
    const coverageData = {};

    for (const [coverageType, filePath] of Object.entries(coverageFilePaths)) {
      try {
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          coverageData[coverageType] = data.total.statements.pct;
        } else {
          console.log(`Coverage file not found for ${coverageType}: ${filePath}`);
          coverageData[coverageType] = 0;
        }
      } catch (err) {
        console.log(`Error parsing coverage file for ${coverageType}:`, err);
        coverageData[coverageType] = 0;
      }
    }

    return coverageData;
  }

  static parseFromData(coverageDataMap) {
    const result = {};
    
    // Handle the case when coverageDataMap is null or undefined
    if (!coverageDataMap) {
      return result;
    }
    
    for (const [coverageType, data] of Object.entries(coverageDataMap)) {
      result[coverageType] = data?.total?.statements?.pct || 0;
    }

    return result;
  }

  static parseSingleFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data.total.statements.pct;
      }
    } catch (err) {
      console.log('Error parsing coverage file:', err);
      throw err;
    }
    return 0;
  }
}

module.exports = CoverageParser;
