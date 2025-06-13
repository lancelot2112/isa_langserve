/**
 * Tests that verify specific errors mentioned in example file comments
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { validateTextDocumentForTesting, defaultSettings } from '../src/server-test-helpers';

describe('Comment-Specified Error Tests', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('Alias.isa Comment-Specified Errors', () => {
    test('ERR1: undefined field not_def should be underlined', async () => {
      // From line 57: ":other invinsn (not_def,AA) mask={...}"
      // Comment: "ERR1 uses a field that's not defined in our space 'not_def' should be underlined"
      const content = `:space other addr=32 word=32 type=ro
:other testfield @(0-5)
:other invinsn (not_def,AA) mask={testfield=0b111}`;
      
      const document = TextDocument.create('test://err1.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const undefinedFieldErrors = diagnostics.filter(d => 
        d.message.includes('not_def') && d.message.includes('Undefined')
      );
      expect(undefinedFieldErrors.length).toBeGreaterThan(0);
      expect(undefinedFieldErrors[0]?.severity).toBe(1); // Error severity
    });

    test('ERR2: binary literal with too many bits should warn', async () => {
      // From line 57: "opcd5=0b1111111" 
      // Comment: "opcd5 in the mask is checked against a valid binary number but the binary has too many bits"
      const content = `:space other addr=32 word=32 type=ro
:other testfield subfields={
  opcd5 @(0-5) descr="6-bit field"
}
:other invinsn () mask={opcd5=0b1111111}`;
      
      const document = TextDocument.create('test://err2.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      
      const excessBitsWarnings = diagnostics.filter(d => 
        d.message.includes('0b1111111') && 
        (d.message.includes('more bits') || d.message.includes('excess'))
      );
      expect(excessBitsWarnings.length).toBeGreaterThan(0);
      expect(excessBitsWarnings[0]?.severity).toBe(2); // Warning severity
    });

    test('ERR3: invalid binary 0b5 should be underlined', async () => {
      // From line 57: "AA=0b5"
      // Comment: "AA is checked against 0b5 which is an invalid binary number. 0b5 should be underlined"
      const content = `:space other addr=32 word=32 type=ro
:other testfield subfields={
  AA @(15) descr="Address flag"  
}
:other invinsn () mask={AA=0b5}`;
      
      const document = TextDocument.create('test://err3.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const invalidBinaryErrors = diagnostics.filter(d => 
        d.message.includes('0b5') && d.message.includes('Invalid numeric literal')
      );
      expect(invalidBinaryErrors.length).toBeGreaterThan(0);
      expect(invalidBinaryErrors[0]?.severity).toBe(1); // Error severity
    });

    test('field count limit: spr1024 should be undefined', async () => {
      // From line 28: ":reg NAME_NOT_DEFINED redirect=spr1024"
      // Comment: "Should indicate field name is not available (only 1024 count which maxes at spr1023)"
      const content = `:space reg addr=32 word=64 type=register
:reg SPR size=64 count=1024 name=spr%d
:reg NAME_NOT_DEFINED redirect=spr1024`;
      
      const document = TextDocument.create('test://spr-limit.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const outOfRangeErrors = diagnostics.filter(d => 
        d.message.includes('spr1024') && d.message.includes('Undefined')
      );
      expect(outOfRangeErrors.length).toBeGreaterThan(0);
    });

    test('undefined subfield: spr22.NDF should error', async () => {
      // From line 32: ":reg SUBFIELD_NOT_DEFINED redirect=spr22.NDF"
      // Comment: "Should indicate subfield not available. Only .NDF should be underlined"
      const content = `:space reg addr=32 word=64 type=register
:reg SPR size=64 count=1024 name=spr%d subfields={
  msb @(0-31)
  lsb @(32-63)
}
:reg SUBFIELD_NOT_DEFINED redirect=spr22;NDF`;
      
      const document = TextDocument.create('test://subfield-error.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const subfieldErrors = diagnostics.filter(d => 
        d.message.includes('NDF') && d.message.includes('Undefined')
      );
      expect(subfieldErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Bit-field.isa Comment-Specified Errors', () => {
    test('INV2: invalid extension option 2 should be underlined', async () => {
      // From line 17: "INV2 @(?2)"
      // Comment: "Invalid extension option (should be 0 or 1) `2` should be underlined"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  INV2 @(?2)
}`;
      
      const document = TextDocument.create('test://inv2.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const extensionErrors = diagnostics.filter(d => 
        d.message.includes('2') && 
        (d.message.includes('extension') || d.message.includes('Invalid'))
      );
      expect(extensionErrors.length).toBeGreaterThan(0);
    });

    test('INV7: bit numbers outside range 0-31 should error', async () => {
      // From line 22: "INV7 @(33-35)"
      // Comment: "Numbers outside of class range 0-31"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  INV7 @(33-35)
}`;
      
      const document = TextDocument.create('test://inv7.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const rangeErrors = diagnostics.filter(d => 
        (d.message.includes('33') || d.message.includes('35')) && 
        d.message.includes('out of range')
      );
      expect(rangeErrors.length).toBeGreaterThan(0);
    });

    test('INV8: mixed valid/invalid bit numbers', async () => {
      // From line 23: "INV8 @(25-50)"
      // Comment: "One valid bit number and one invalid `50` should be underlined"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  INV8 @(25-50)
}`;
      
      const document = TextDocument.create('test://inv8.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const mixedRangeErrors = diagnostics.filter(d => 
        d.message.includes('50') && d.message.includes('out of range')
      );
      expect(mixedRangeErrors.length).toBeGreaterThan(0);
    });

    test('INV9: hex bit index outside range', async () => {
      // From line 24: "INV9 @(0x20)"
      // Comment: "Outside of valid bit range hex version"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  INV9 @(0x20)
}`;
      
      const document = TextDocument.create('test://inv9.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const hexRangeErrors = diagnostics.filter(d => 
        d.message.includes('0x20') && d.message.includes('out of range')
      );
      expect(hexRangeErrors.length).toBeGreaterThan(0);
    });

    test('INV10: octal bit index outside range', async () => {
      // From line 25: "INV10 @(0o200)"
      // Comment: "outside valid bit range oct version"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  INV10 @(0o200)
}`;
      
      const document = TextDocument.create('test://inv10.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const octalRangeErrors = diagnostics.filter(d => 
        d.message.includes('0o200') && d.message.includes('out of range')
      );
      expect(octalRangeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Single-word.isa Comment-Specified Errors', () => {
    test('invalid single word E\\ should be underlined', async () => {
      // From line 6: "E\ @(1)"
      // Comment: "invalid single word, `E\\` should be underlined"
      const content = `:space reg addr=32 word=64 type=register
:reg TestField size=32 subfields={
  E\\ @(1)
}`;
      
      const document = TextDocument.create('test://invalid-name.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const invalidNameErrors = diagnostics.filter(d => 
        d.message.includes('E\\') || d.message.includes('invalid')
      );
      expect(invalidNameErrors.length).toBeGreaterThan(0);
    });

    test('invalid field name abc/-() should be underlined', async () => {
      // From line 13: "abc/-() @(5)"
      // Comment: "invalid single words, `abc/-()` should be underlined and default color"
      const content = `:space reg addr=32 word=64 type=register
:reg TestField size=32 subfields={
  abc/-() @(5)
}`;
      
      const document = TextDocument.create('test://invalid-chars.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const invalidCharsErrors = diagnostics.filter(d => 
        d.message.includes('abc/-()') || d.message.includes('invalid')
      );
      expect(invalidCharsErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Unnamed-field.isa Comment-Specified Errors', () => {
    test('undefined operands rD and rB should be underlined', async () => {
      // From line 18: ":insn add (rD,rA,rB)"
      // Comment: "rD and rB should be underlined and have default coloring as they are not defined"
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  rA @(11-15) op=insn.GPR
  opc6 @(0-5) op=func
}
:insn add (rD,rA,rB) mask={opc6=0b011111}`;
      
      const document = TextDocument.create('test://undefined-operands.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const undefinedOperandErrors = diagnostics.filter(d => 
        (d.message.includes('rD') || d.message.includes('rB')) && 
        d.message.includes('Undefined')
      );
      expect(undefinedOperandErrors.length).toBeGreaterThan(0);
    });

    test('defined operand rA should be valid', async () => {
      // From line 18: ":insn add (rD,rA,rB)"
      // Comment: rA should be valid (defined in subfields)
      const content = `:space insn addr=32 word=32 type=ro
:insn size=32 subfields={
  rA @(11-15) op=insn.GPR
  opc6 @(0-5) op=func
}
:insn add (rA) mask={opc6=0b011111}`;
      
      const document = TextDocument.create('test://valid-operand.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // rA should NOT generate undefined reference errors
      const rAErrors = diagnostics.filter(d => 
        d.message.includes('rA') && d.message.includes('Undefined')
      );
      expect(rAErrors.length).toBe(0);
    });
  });

  describe('Valid-file.isa - Should Have Minimal Errors', () => {
    test('valid content should generate minimal errors', async () => {
      const content = `:param ENDIAN=big
:space insn addr=32 word=32 type=ro
:space reg addr=0x20 word=64 type=register
:reg GPR size=32 count=32 name=r%d
:insn size=32 subfields={
  OP @(0-5)
  rA @(11-15) op=reg.GPR
  rD @(6-10) op=reg.GPR
}
:insn add (rD,rA) mask={OP=0b011111}`;
      
      const document = TextDocument.create('test://mostly-valid.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      
      // Should have minimal errors for well-formed content
      expect(diagnostics.length).toBeLessThan(10);
      
      // Should not have basic syntax errors
      const syntaxErrors = diagnostics.filter(d => 
        d.message.includes('Invalid param') || 
        d.message.includes('Invalid space type') ||
        d.severity === 1 // Error severity
      );
      expect(syntaxErrors.length).toBeLessThan(3);
    });
  });

  describe('Error Message Quality', () => {
    test('error messages are descriptive and specific', async () => {
      const content = `:space reg addr=invalid word=0xGHI type=bad_type
:param INVALID_FORMAT
:reg test subfields={
  field @(50-60)
}`;
      
      const document = TextDocument.create('test://multiple-errors.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Each error should have a clear, specific message
      diagnostics.forEach(diagnostic => {
        expect(diagnostic.message.length).toBeGreaterThan(10);
        expect(diagnostic.message).toMatch(/[A-Z]/); // Should start with capital
        expect(diagnostic.code).toBeDefined();
        expect(diagnostic.source).toBe('isa-language-server');
      });
      
      // Should have multiple different error types
      const errorCodes = new Set(diagnostics.map(d => d.code));
      expect(errorCodes.size).toBeGreaterThan(1);
    });
  });
});