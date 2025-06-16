const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x1000 descr="RAM size"
}`;

// Simple test to see what tokens we get
console.log('Content to tokenize:');
console.log(content);

// Look for the underscore position
const underscorePos = content.indexOf('0x1000_0x1000');
console.log('Underscore position:', underscorePos);
console.log('Context around underscore:', content.slice(underscorePos - 20, underscorePos + 20));