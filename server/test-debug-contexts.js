#!/usr/bin/env node

/**
 * Debug specific token contexts to understand validation
 */

const fs = require('fs');
const { SemanticAnalyzer } = require('./out/analysis/semantic-analyzer.js');

// Read the alias.isa file
const aliasPath = '../examples/alias.isa';
const content = fs.readFileSync(aliasPath, 'utf8');

// Mock text document
const mockDocument = {
  uri: 'file:///test/alias.isa',
  getText: () => content
};

console.log('=== Debugging token contexts ===\n');

// Create a custom analyzer to access tokens
const analyzer = new SemanticAnalyzer();
const result = analyzer.analyzeFile(mockDocument);

console.log('Analyzing only field option and subfield option errors:');

result.errors.forEach((error, index) => {
  if (error.code === 'invalid-field-option' || error.code === 'invalid-subfield-option') {
    console.log(`\n${index + 1}. ${error.code}: ${error.message}`);
    console.log(`   Line ${error.location.range.start.line + 1}, Column ${error.location.range.start.character + 1}`);
    
    // Get the actual line content
    const lines = content.split('\n');
    const lineContent = lines[error.location.range.start.line];
    console.log(`   Line content: "${lineContent}"`);
    
    // Extract the problematic token
    const startChar = error.location.range.start.character;
    const endChar = error.location.range.end.character;
    const tokenText = lineContent.substring(startChar, endChar);
    console.log(`   Token: "${tokenText}"`);
  }
});

console.log('\n=== Lines causing issues ===');
const lines = content.split('\n');
[10, 11, 34, 35, 36, 46].forEach(lineNum => {
  console.log(`Line ${lineNum + 1}: "${lines[lineNum]}"`);
});