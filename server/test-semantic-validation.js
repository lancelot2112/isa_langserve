#!/usr/bin/env node

/**
 * Test semantic validation with the actual SemanticAnalyzer
 */

const fs = require('fs');
const { SemanticAnalyzer } = require('./out/analysis/semantic-analyzer.js');

// Read the alias.isa file
const aliasPath = '../examples/alias.isa';
const content = fs.readFileSync(aliasPath, 'utf8');

console.log('Testing semantic validation on alias.isa...\n');

// Mock text document
const mockDocument = {
  uri: 'file:///test/alias.isa',
  getText: () => content
};

try {
  const analyzer = new SemanticAnalyzer();
  const result = analyzer.analyzeFile(mockDocument);
  
  console.log(`Found ${result.errors.length} validation errors:`);
  
  result.errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.code}: ${error.message}`);
    if (error.location && error.location.range) {
      console.log(`   Line ${error.location.range.start.line + 1}, Column ${error.location.range.start.character + 1}`);
    }
  });
  
  // Focus on the errors we care about
  const fieldOptionErrors = result.errors.filter(e => e.code === 'invalid-field-option');
  const instructionOptionErrors = result.errors.filter(e => e.code === 'invalid-instruction-option');
  
  console.log(`\nField option errors: ${fieldOptionErrors.length}`);
  fieldOptionErrors.forEach(error => {
    console.log(`  - ${error.message}`);
  });
  
  console.log(`\nInstruction option errors: ${instructionOptionErrors.length}`);
  instructionOptionErrors.forEach(error => {
    console.log(`  - ${error.message}`);
  });
  
} catch (error) {
  console.error('Error during analysis:', error);
  console.error('Stack trace:', error.stack);
}