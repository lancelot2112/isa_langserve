#!/usr/bin/env node

/**
 * Test script to debug field parsing issues with alias.isa
 * This script will tokenize and analyze the problematic lines to understand validation errors
 */

const fs = require('fs');
const path = require('path');

// Simple mock implementations for testing
function mockPosition(line, char) {
  return { line, character: char };
}

function mockRange(start, end) {
  return { start, end };
}

function mockLocation(start, end) {
  return {
    start,
    end,
    range: mockRange(start, end)
  };
}

// Extract the problematic lines from alias.isa for testing
const testContent = `
:other size=16 subfields={
    AA @(15) descr="Addressing mode (0=Relative, 1=Absolute)"
    opcd5 @(0-5) descr="Opcode (6bits)"
    overlap @(?1|5-8|4|0b00) descr="Field that overlaps with opcd5"
}

:other testinsn (overlap,AA) mask={opcd5=0b110110 AA=1} size=16
:other 32bitinsn. (overlap,AA) mask={opcd5=0b111 @(31)=1 $reg;SPR22;lsb=1}
:other invinsn (not_def,AA) mask={opcd5=0b1111111 AA=0b5 SPR22;lsb=1}
`;

console.log('Testing field parsing with problematic content:');
console.log(testContent);
console.log('\n--- Analysis ---');

// Simulate the context detection logic
function getRecentTokenContext(tokens, currentIndex) {
  let startIndex = currentIndex - 1;
  while (startIndex >= 0 && tokens[startIndex] && !tokens[startIndex].text.startsWith(':')) {
    startIndex--;
    if (currentIndex - startIndex > 50) break;
  }
  
  const recentTokens = tokens.slice(Math.max(0, startIndex), currentIndex);
  return recentTokens.map(t => t.text).join(' ');
}

function isTokenInMaskContext(recentContent) {
  const maskIndex = recentContent.lastIndexOf('mask=');
  if (maskIndex === -1) return false;
  
  const afterMask = recentContent.substring(maskIndex);
  let braceCount = 0;
  let foundOpenBrace = false;
  
  for (let i = 0; i < afterMask.length; i++) {
    if (afterMask[i] === '{') {
      braceCount++;
      foundOpenBrace = true;
    } else if (afterMask[i] === '}') {
      braceCount--;
    }
  }
  
  return foundOpenBrace && braceCount > 0;
}

function isInvalidFieldOption(text) {
  const validFieldOptions = ['offset', 'size', 'count', 'reset', 'name', 'descr', 'redirect'];
  return !validFieldOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
}

function isInvalidInstructionOption(text) {
  const validInstructionOptions = ['mask', 'descr', 'semantics'];
  return !validInstructionOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
}

// Simulate tokenization (simplified)
const lines = testContent.trim().split('\n');
const tokens = [];
let tokenIndex = 0;

lines.forEach((line, lineNum) => {
  const words = line.trim().split(/\s+/);
  words.forEach(word => {
    if (word) {
      // Clean up punctuation
      const cleanWord = word.replace(/[(),={}]/g, ' ').trim();
      const parts = cleanWord.split(/\s+/).filter(p => p);
      parts.forEach(part => {
        if (part && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(part)) {
          tokens.push({
            text: part,
            index: tokenIndex++,
            line: lineNum,
            location: mockLocation(mockPosition(lineNum, 0), mockPosition(lineNum, part.length))
          });
        }
      });
    }
  });
});

console.log('Tokens found:', tokens.map(t => t.text));

// Test the problematic tokens
const problematicTokens = ['overlap', 'AA', 'opcd5'];

problematicTokens.forEach(tokenText => {
  const tokenInstances = tokens.filter(t => t.text === tokenText);
  
  tokenInstances.forEach((token, idx) => {
    const recentContent = getRecentTokenContext(tokens, token.index);
    const inMaskContext = isTokenInMaskContext(recentContent);
    const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
    const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
    const isInstructionOperand = recentContent.includes('(') && recentContent.includes(')');
    
    console.log(`\n--- Token: "${tokenText}" (instance ${idx + 1}) ---`);
    console.log('Recent context:', recentContent);
    console.log('In mask context:', inMaskContext);
    console.log('Is instruction operand:', isInstructionOperand);
    console.log('Field directive pattern match:', fieldDirectivePattern.test(recentContent));
    console.log('Instruction directive pattern match:', instructionPattern.test(recentContent));
    
    // Test field option validation
    if (fieldDirectivePattern.test(recentContent) && !isInstructionOperand && !inMaskContext && isInvalidFieldOption(tokenText)) {
      console.log('❌ INVALID FIELD OPTION ERROR would be triggered');
    }
    
    // Test instruction option validation  
    if (instructionPattern.test(recentContent) && !inMaskContext && isInvalidInstructionOption(tokenText)) {
      console.log('❌ INVALID INSTRUCTION OPTION ERROR would be triggered');
    }
    
    console.log('---');
  });
});