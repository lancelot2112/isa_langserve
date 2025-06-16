#!/usr/bin/env node

/**
 * Debug the actual tokenizer behavior on the problematic line
 */

// Test the problematic line directly
const testLine = ":other testinsn (overlap,AA) mask={opcd5=0b110110 AA=1} size=16";

console.log('Testing line:', testLine);
console.log('');

// Simulate the getRecentTokenContext logic step by step
function simulateTokenContext(fullLine, currentTokenPosition) {
  console.log(`Analyzing token at position ${currentTokenPosition}:`);
  
  // Simple tokenization simulation
  const tokens = [];
  let currentPos = 0;
  
  // Split by spaces but keep track of original positions
  const parts = fullLine.split(/(\s+|[(){}=])/);
  parts.forEach(part => {
    if (part.trim() && !/^\s+$/.test(part)) {
      tokens.push({
        text: part,
        position: currentPos
      });
      currentPos += part.length;
    }
  });
  
  console.log('Tokens:', tokens.map(t => t.text));
  
  // Find the directive start
  let startIndex = currentTokenPosition - 1;
  while (startIndex >= 0 && tokens[startIndex] && !tokens[startIndex].text.startsWith(':')) {
    startIndex--;
    if (currentTokenPosition - startIndex > 50) break;
  }
  
  const recentTokens = tokens.slice(Math.max(0, startIndex), currentTokenPosition);
  const recentContent = recentTokens.map(t => t.text).join(' ');
  
  console.log('Recent content:', recentContent);
  
  // Test the mask context detection
  const maskIndex = recentContent.lastIndexOf('mask=');
  console.log('Mask index:', maskIndex);
  
  if (maskIndex !== -1) {
    const afterMask = recentContent.substring(maskIndex);
    console.log('After mask:', afterMask);
    
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = 0; i < afterMask.length; i++) {
      if (afterMask[i] === '{') {
        braceCount++;
        foundOpenBrace = true;
        console.log(`Found opening brace at position ${i}, braceCount: ${braceCount}`);
      } else if (afterMask[i] === '}') {
        braceCount--;
        console.log(`Found closing brace at position ${i}, braceCount: ${braceCount}`);
      }
    }
    
    const inMaskContext = foundOpenBrace && braceCount > 0;
    console.log('In mask context:', inMaskContext);
  }
  
  // Test pattern matching
  const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
  const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
  const isInstructionOperand = recentContent.includes('(') && recentContent.includes(')');
  
  console.log('Field directive pattern match:', fieldDirectivePattern.test(recentContent));
  console.log('Instruction directive pattern match:', instructionPattern.test(recentContent));  
  console.log('Is instruction operand:', isInstructionOperand);
  
  console.log('---\n');
}

// Test different token positions
console.log('=== Testing "overlap" in operand list ===');
simulateTokenContext(testLine, 3); // Position of "overlap"

console.log('=== Testing "AA" in operand list ===');
simulateTokenContext(testLine, 4); // Position of "AA" 

console.log('=== Testing "opcd5" in mask ===');
simulateTokenContext(testLine, 7); // Position of "opcd5"

console.log('=== Testing "AA" in mask ===');
simulateTokenContext(testLine, 9); // Position of "AA" in mask