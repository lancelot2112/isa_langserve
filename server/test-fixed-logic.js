#!/usr/bin/env node

/**
 * Test the fixed validation logic
 */

const testLine = ":other testinsn (overlap,AA) mask={opcd5=0b110110 AA=1} size=16";

console.log('Testing line:', testLine);
console.log('');

// Implement the fixed logic
function isTokenInMaskContext(recentContent) {
  const maskPattern = /mask\s*=\s*\{/;
  const maskMatch = maskPattern.exec(recentContent);
  if (!maskMatch) return false;
  
  const afterMask = recentContent.substring(maskMatch.index + maskMatch[0].length);
  let braceCount = 1; // We found the opening brace
  
  for (let i = 0; i < afterMask.length; i++) {
    if (afterMask[i] === '{') {
      braceCount++;
    } else if (afterMask[i] === '}') {
      braceCount--;
    }
  }
  
  return braceCount > 0;
}

function isTokenInInstructionOperandList(recentContent) {
  const instructionWithOperandPattern = /:(\w+)\s+(\w+[.]?)\s*\(/;
  const match = instructionWithOperandPattern.exec(recentContent);
  if (!match) return false;
  
  const afterOpenParen = recentContent.substring(match.index + match[0].length);
  let parenCount = 1; // We found the opening parenthesis
  
  for (let i = 0; i < afterOpenParen.length; i++) {
    if (afterOpenParen[i] === '(') {
      parenCount++;
    } else if (afterOpenParen[i] === ')') {
      parenCount--;
    }
  }
  
  return parenCount > 0;
}

function isInvalidFieldOption(text) {
  const validFieldOptions = ['offset', 'size', 'count', 'reset', 'name', 'descr', 'redirect'];
  return !validFieldOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
}

function isInvalidInstructionOption(text) {
  const validInstructionOptions = ['mask', 'descr', 'semantics'];
  return !validInstructionOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
}

// Test scenarios
const testCases = [
  { context: ":other testinsn (", token: "overlap", description: "overlap in operand list" },
  { context: ":other testinsn ( overlap,AA", token: "AA", description: "AA in operand list" },
  { context: ":other testinsn ( overlap,AA ) mask = {", token: "opcd5", description: "opcd5 in mask" },
  { context: ":other testinsn ( overlap,AA ) mask = { opcd5 = 0b110110", token: "AA", description: "AA in mask" },
  { context: ":other testinsn ( overlap,AA ) mask = { opcd5 = 0b110110 AA = 1 }", token: "size", description: "size after mask (should be valid option)" }
];

testCases.forEach(({ context, token, description }) => {
  console.log(`=== Testing: ${description} ===`);
  console.log('Context:', context);
  console.log('Token:', token);
  
  const inMask = isTokenInMaskContext(context);
  const inOperandList = isTokenInInstructionOperandList(context);
  const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
  const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
  
  console.log('In mask context:', inMask);
  console.log('In operand list:', inOperandList);
  console.log('Field directive pattern match:', fieldDirectivePattern.test(context));
  console.log('Instruction directive pattern match:', instructionPattern.test(context));
  
  // Test field option validation
  const wouldTriggerFieldError = fieldDirectivePattern.test(context) && !inOperandList && !inMask && isInvalidFieldOption(token);
  console.log('Would trigger field option error:', wouldTriggerFieldError);
  
  // Test instruction option validation  
  const wouldTriggerInstructionError = instructionPattern.test(context) && !inMask && !inOperandList && isInvalidInstructionOption(token);
  console.log('Would trigger instruction option error:', wouldTriggerInstructionError);
  
  console.log('---\n');
});