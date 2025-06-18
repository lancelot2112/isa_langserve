const { ISATokenizer } = require('./server/out/parser/tokenizer.js');
const { TokenType } = require('./server/out/parser/types.js');

const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x1000 descr="RAM size"
}`;

const tokenizer = new ISATokenizer(content, {
  enableSemanticTokens: true,
  spaceTagColors: {},
});

const tokens = tokenizer.tokenize();

console.log('All tokens:');
tokens.forEach((token, i) => {
  console.log(`${i}: ${token.type} = "${token.text}"`);
});

const sizeToken = tokens.find(t => t.type === TokenType.BUS_SIZE_SEPARATOR);
console.log('Size token:', sizeToken);

const rangeToken = tokens.find(t => t.type === TokenType.BUS_RANGE_SEPARATOR);
console.log('Range token:', rangeToken);

// Look for numeric tokens around the underscore
const numericTokens = tokens.filter(t => t.type === TokenType.NUMERIC_LITERAL);
console.log('Numeric tokens:', numericTokens.map(t => t.text));