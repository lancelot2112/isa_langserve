/**
 * Tests for the index operator implementation [startindex-endindex]
 */

import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Index Operator Implementation', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  test('parses basic index operator syntax', () => {
    const content = `
:space reg addr=32 word=64 type=register
:reg GPR[0-31] offset=0x0 size=64
`;

    const document = TextDocument.create('test://index-basic.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should not have any syntax errors
    const syntaxErrors = result.errors.filter(e => e.severity === 'error');
    expect(syntaxErrors).toHaveLength(0);

    // Should have generated 32 field symbols (GPR0 through GPR31)
    const gprSymbols = Array.from(result.symbols.symbols.values())
      .filter(s => s.name.startsWith('GPR') && s.name.match(/^GPR\d+$/));
    
    expect(gprSymbols).toHaveLength(32);
    
    // Check specific generated field names
    const gpr0 = result.symbols.findSymbol('GPR0', 'reg');
    const gpr31 = result.symbols.findSymbol('GPR31', 'reg');
    expect(gpr0).toBeDefined();
    expect(gpr31).toBeDefined();
  });

  test('validates index range constraints', () => {
    const content = `
:space reg addr=32 word=64 type=register
:reg INVALID1[31-0] offset=0x0 size=64
:reg INVALID2[-1-10] offset=0x100 size=64
`;

    const document = TextDocument.create('test://index-validation.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Debug: print all errors for troubleshooting if needed
    // console.log('All errors:', result.errors);

    // Should have validation errors for invalid ranges
    const rangeErrors = result.errors.filter(e => 
      e.code === 'invalid-index-range' && e.severity === 'error'
    );
    expect(rangeErrors.length).toBeGreaterThan(0);
    
    // Check for specific error messages
    const startEndError = rangeErrors.find(e => e.message.includes('end index') && e.message.includes('start index'));
    const negativeError = rangeErrors.find(e => e.message.includes('must be >= 0'));
    
    expect(startEndError).toBeDefined();
    expect(negativeError).toBeDefined();
  });

  test('validates mutually exclusive attributes', () => {
    const content = `
:space reg addr=32 word=64 type=register
:reg INVALID[0-31] count=32 offset=0x0 size=64
`;

    const document = TextDocument.create('test://index-exclusive.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should have error for mutually exclusive attributes
    const exclusiveErrors = result.errors.filter(e => 
      e.code === 'mutually-exclusive-attributes' && e.severity === 'error'
    );
    expect(exclusiveErrors).toHaveLength(1);
    expect(exclusiveErrors[0]?.message).toContain('cannot be used with count=');
  });

  test('supports hex, binary, and octal indices', () => {
    const content = `
:space reg addr=32 word=64 type=register
:reg HEX[0x0-0xF] offset=0x0 size=64
:reg BIN[0b0-0b11] offset=0x100 size=64
:reg OCT[0o0-0o7] offset=0x200 size=64
`;

    const document = TextDocument.create('test://index-formats.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should not have syntax errors
    const syntaxErrors = result.errors.filter(e => e.severity === 'error');
    expect(syntaxErrors).toHaveLength(0);

    // Check generated symbols
    const hexSymbols = Array.from(result.symbols.symbols.values())
      .filter(s => s.name.startsWith('HEX') && s.name.match(/^HEX\d+$/));
    const binSymbols = Array.from(result.symbols.symbols.values())
      .filter(s => s.name.startsWith('BIN') && s.name.match(/^BIN\d+$/));
    const octSymbols = Array.from(result.symbols.symbols.values())
      .filter(s => s.name.startsWith('OCT') && s.name.match(/^OCT\d+$/));

    expect(hexSymbols).toHaveLength(16); // 0x0-0xF = 16 values
    expect(binSymbols).toHaveLength(4);  // 0b0-0b11 = 4 values 
    expect(octSymbols).toHaveLength(8);  // 0o0-0o7 = 8 values
  });

  test('validates aliases to indexed fields', () => {
    const content = `
:space reg addr=32 word=64 type=register
:reg GPR[0-31] offset=0x0 size=64
:reg SP alias=GPR1
:reg INVALID alias=GPR32
`;

    const document = TextDocument.create('test://index-aliases.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // The alias validation should work correctly

    // SP alias should be valid (GPR1 exists)
    const validAliasErrors = result.errors.filter(e => 
      e.message.includes('SP') && e.severity === 'error'
    );
    expect(validAliasErrors).toHaveLength(0);

    // INVALID alias should fail (GPR32 doesn't exist, range is 0-31)
    const invalidAliasErrors = result.errors.filter(e => 
      (e.message.includes('INVALID') || e.message.includes('GPR32')) && e.severity === 'error'
    );
    expect(invalidAliasErrors.length).toBeGreaterThan(0);
  });
});