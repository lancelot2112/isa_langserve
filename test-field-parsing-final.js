#!/usr/bin/env node

/**
 * Final test of field parsing fixes
 */

const fs = require('fs');
const { SemanticAnalyzer } = require('./server/out/analysis/semantic-analyzer.js');

// Read the alias.isa file
const aliasPath = './examples/alias.isa';
const content = fs.readFileSync(aliasPath, 'utf8');

console.log('=== Final Test: Field Parsing Validation ===\n');

// Mock text document
const mockDocument = {
  uri: 'file:///test/alias.isa',
  getText: () => content
};

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyzeFile(mockDocument);

// Focus on the specific errors we were trying to fix
const fieldOptionErrors = result.errors.filter(e => e.code === 'invalid-field-option');
const instructionOptionErrors = result.errors.filter(e => e.code === 'invalid-instruction-option');
const subfieldOptionErrors = result.errors.filter(e => e.code === 'invalid-subfield-option');

console.log('=== Results Summary ===');
console.log(`Total validation errors: ${result.errors.length}`);
console.log(`Field option errors: ${fieldOptionErrors.length}`);
console.log(`Instruction option errors: ${instructionOptionErrors.length}`);
console.log(`Subfield option errors: ${subfieldOptionErrors.length}`);

console.log('\n=== Field Option Errors (should be minimal) ===');
fieldOptionErrors.forEach((error, index) => {
  const line = error.location.range.start.line + 1;
  const col = error.location.range.start.character + 1;
  console.log(`${index + 1}. Line ${line}:${col} - ${error.message}`);
});

console.log('\n=== Instruction Option Errors (should be 0) ===');
instructionOptionErrors.forEach((error, index) => {
  const line = error.location.range.start.line + 1;
  const col = error.location.range.start.character + 1;
  console.log(`${index + 1}. Line ${line}:${col} - ${error.message}`);
});

console.log('\n=== Subfield Option Errors (should be 0 for tags) ===');
subfieldOptionErrors.forEach((error, index) => {
  const line = error.location.range.start.line + 1;
  const col = error.location.range.start.character + 1;
  console.log(`${index + 1}. Line ${line}:${col} - ${error.message}`);
});

console.log('\n=== Success Criteria Check ===');
const issues = [
  {
    description: 'No instruction option errors (✓ FIXED)', 
    success: instructionOptionErrors.length === 0
  },
  {
    description: 'No subfield tag errors for AA, opcd5, overlap in subfields (✓ FIXED)',
    success: !subfieldOptionErrors.some(e => ['AA', 'opcd5', 'overlap'].includes(e.message.match(/'(\w+)'/)?.[1]))
  },
  {
    description: 'No field option errors for operand list tokens (❌ PENDING)',
    success: !fieldOptionErrors.some(e => 
      e.location.range.start.line === 45 && // Line 46 (0-indexed)
      ['overlap', 'AA'].includes(e.message.match(/'(\w+)'/)?.[1])
    )
  }
];

issues.forEach(issue => {
  console.log(`${issue.success ? '✅' : '❌'} ${issue.description}`);
});

const allFixesWorking = issues.every(issue => issue.success);
console.log(`\n${allFixesWorking ? '🎉 ALL FIXES SUCCESSFUL!' : '⚠️  Some issues remain'}`);

if (!allFixesWorking) {
  console.log('\nStill working on remaining field option errors on line 46...');
}