// Test setup file for Mocha
const chai = require('chai');
const sinon = require('sinon');

// Make chai available globally
global.expect = chai.expect;
global.sinon = sinon;

// Configure chai
chai.config.includeStack = true;
