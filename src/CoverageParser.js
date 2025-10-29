const fs = require('fs');

class CoverageParser {
  static parseSingleFile(filePath, keyPath = 'total.statements.pct') {
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const coverage = CoverageParser.getNestedValue(data, keyPath);
        if (coverage !== undefined) {
          return coverage;
        }

        throw new Error(`Key path not found in coverage file: ${keyPath}`);
      }
    } catch (err) {
      console.log('Error parsing coverage file:', err);
      throw err;
    }
    return 0;
  }

  static getNestedValue(obj, path) {
    // Split the path string into an array of keys
    const keys = path.split('.');

    // Use reduce to traverse the object
    return keys.reduce((current, key) => {
      // If current is null or undefined, prevent further access and return undefined
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj); // Start with the initial object
  }
}

module.exports = CoverageParser;
