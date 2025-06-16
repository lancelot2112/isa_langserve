#!/usr/bin/env node

function isTokenInInstructionOperandList(recentContent) {
  console.log('Testing operand list detection for:', recentContent);
  
  const instructionWithOperandPattern = /:(\w+)\s+(\w+[.]?)\s*\(/;
  const match = instructionWithOperandPattern.exec(recentContent);
  console.log('Pattern match:', match);
  
  if (!match) return false;
  
  const afterOpenParen = recentContent.substring(match.index + match[0].length);
  console.log('After open paren:', afterOpenParen);
  
  let parenCount = 1;
  
  for (let i = 0; i < afterOpenParen.length; i++) {
    if (afterOpenParen[i] === '(') {
      parenCount++;
    } else if (afterOpenParen[i] === ')') {
      parenCount--;
    }
  }
  
  console.log('Final paren count:', parenCount);
  return parenCount > 0;
}

// Test with the problematic context from line 46
const testContext = ":other 32bitinsn. (";
console.log('Result:', isTokenInInstructionOperandList(testContext));
console.log('');

const testContext2 = ":other 32bitinsn. ( overlap";  
console.log('Result:', isTokenInInstructionOperandList(testContext2));