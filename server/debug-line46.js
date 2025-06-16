#!/usr/bin/env node

/**
 * Debug why operand list detection isn't working for line 46
 */

// Simulate the exact content that would be passed to analyzeTokenContext for line 46 tokens

function isTokenInMaskContext(recentContent) {
  const maskPattern = /mask\s*=\s*\{/;
  const maskMatch = maskPattern.exec(recentContent);
  if (!maskMatch) return false;
  
  const afterMask = recentContent.substring(maskMatch.index + maskMatch[0].length);
  let braceCount = 1;
  
  for (let i = 0; i < afterMask.length; i++) {
    if (afterMask[i] === '{') {
      braceCount++;
    } else if (afterMask[i] === '}') {
      braceCount--;
    }
  }
  
  return braceCount > 0;
}

function isTokenInSubfieldsContext(recentContent) {
  const subfieldsPattern = /subfields\s*=\s*\{/;
  const subfieldsMatch = subfieldsPattern.exec(recentContent);
  if (!subfieldsMatch) return false;
  
  const afterSubfields = recentContent.substring(subfieldsMatch.index + subfieldsMatch[0].length);
  let braceCount = 1;
  
  for (let i = 0; i < afterSubfields.length; i++) {
    if (afterSubfields[i] === '{') {
      braceCount++;
    } else if (afterSubfields[i] === '}') {
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
  let parenCount = 1;
  
  for (let i = 0; i < afterOpenParen.length; i++) {
    if (afterOpenParen[i] === '(') {
      parenCount++;
    } else if (afterOpenParen[i] === ')') {
      parenCount--;
    }
  }
  
  return parenCount > 0;
}

function analyzeTokenContext(recentContent, tokenText) {
  const inMaskContext = isTokenInMaskContext(recentContent);
  const inSubfieldsContext = isTokenInSubfieldsContext(recentContent);
  const inOperandListContext = isTokenInInstructionOperandList(recentContent);
  
  const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
  const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
  const hasFieldDirective = fieldDirectivePattern.test(recentContent);
  const hasInstructionDirective = instructionPattern.test(recentContent);
  
  const isAfterBitField = /@\([^)]+\)\s+$/.test(recentContent);
  
  let context = 'unknown';
  let shouldValidateAsFieldOption = false;
  let shouldValidateAsSubfieldOption = false;
  let shouldValidateAsInstructionOption = false;
  
  if (inMaskContext) {
    context = 'mask';
  } else if (inOperandListContext) {
    context = 'operand-list';
  } else if (inSubfieldsContext) {
    if (isAfterBitField) {
      context = 'subfield-option';
      shouldValidateAsSubfieldOption = true;
    } else {
      context = 'subfield-tag';
    }
  } else if (hasInstructionDirective) {
    context = 'instruction-option';
    shouldValidateAsInstructionOption = true;
  } else if (hasFieldDirective) {
    context = 'field-option'; 
    shouldValidateAsFieldOption = true;
  }
  
  return {
    shouldValidateAsFieldOption,
    shouldValidateAsSubfieldOption,
    shouldValidateAsInstructionOption,
    context,
    inMaskContext,
    inSubfieldsContext,
    inOperandListContext,
    hasFieldDirective,
    hasInstructionDirective,
    isAfterBitField
  };
}

// Test the line 46 scenario
console.log('=== Testing line 46 overlap token ===');

// This is what the recent content might look like for the 'overlap' token on line 46
// Based on the getRecentTokenContext method, it should capture from the start of the directive
const overlapContext = ":other 32bitinsn. (";
console.log('Recent content for overlap:', overlapContext);
const overlapAnalysis = analyzeTokenContext(overlapContext, 'overlap');
console.log('Analysis for overlap:', overlapAnalysis);
console.log('Should validate as field option:', overlapAnalysis.shouldValidateAsFieldOption);

console.log('\n=== Testing line 46 AA token ===');

// For the 'AA' token, the recent content should include the overlap token too
const aaContext = ":other 32bitinsn. ( overlap,";
console.log('Recent content for AA:', aaContext);
const aaAnalysis = analyzeTokenContext(aaContext, 'AA');
console.log('Analysis for AA:', aaAnalysis);
console.log('Should validate as field option:', aaAnalysis.shouldValidateAsFieldOption);

console.log('\n=== Manual operand list detection test ===');
console.log('isTokenInInstructionOperandList(":other 32bitinsn. (") =', isTokenInInstructionOperandList(":other 32bitinsn. ("));
console.log('isTokenInInstructionOperandList(":other 32bitinsn. ( overlap,") =', isTokenInInstructionOperandList(":other 32bitinsn. ( overlap,"));