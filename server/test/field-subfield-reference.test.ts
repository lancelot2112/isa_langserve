/**
 * Test for field;subfield reference validation (context operator)
 * 
 * This test verifies that field;subfield references like "spr22;lsb" are properly
 * parsed and validated instead of being treated as a single undefined field.
 * Also tests backward compatibility with legacy field.subfield syntax.
 */

import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Field Context Operator Reference Validation', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  test('validates field;subfield references correctly with new context operator', () => {
    const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name=spr%d
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg ALIAS_FIELD alias=spr22;lsb`;

    const document = TextDocument.create('test://field-subfield.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should not have any "undefined field reference" errors for spr22;lsb
    const undefinedFieldErrors = result.errors.filter(e => 
      e.code === 'undefined-field-reference' && e.message.includes('spr22')
    );

    expect(undefinedFieldErrors.length).toBe(0);

    // Should not have any "undefined subfield" errors for spr22;lsb either (assuming SPR has subfields)
    const undefinedSubfieldErrors = result.errors.filter(e => 
      e.code === 'undefined-subfield' && e.message.includes('lsb') && e.message.includes('spr22')
    );

    expect(undefinedSubfieldErrors.length).toBe(0);
  });

  test('properly reports undefined field in field;subfield reference', () => {
    const content = `:space reg addr=32 word=64 type=register

:reg EXISTING_FIELD size=32
subfields={
    sub1 @(0-15)
    sub2 @(16-31)
}

:reg ALIAS_FIELD alias=nonexistent;sub1`;

    const document = TextDocument.create('test://field-subfield-undefined.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should have an error about undefined field 'nonexistent'
    const undefinedFieldErrors = result.errors.filter(e => 
      e.code === 'undefined-field-reference' && e.message.includes('nonexistent')
    );

    expect(undefinedFieldErrors.length).toBeGreaterThan(0);
  });

  test('properly reports undefined subfield in field;subfield reference', () => {
    const content = `:space reg addr=32 word=64 type=register

:reg EXISTING_FIELD size=32
subfields={
    sub1 @(0-15)
    sub2 @(16-31)
}

:reg ALIAS_FIELD alias=EXISTING_FIELD;nonexistent_sub`;

    const document = TextDocument.create('test://field-subfield-undefined-sub.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should have an error about undefined subfield 'nonexistent_sub'
    const undefinedSubfieldErrors = result.errors.filter(e => 
      e.code === 'undefined-subfield' && e.message.includes('nonexistent_sub')
    );

    expect(undefinedSubfieldErrors.length).toBeGreaterThan(0);
  });

  test('validates field;subfield references in instruction operands', () => {
    const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name=spr%d
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg MOVE_INST (spr22;lsb, dest)`;

    const document = TextDocument.create('test://field-subfield-operand.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should not have any "undefined field reference" errors for spr22;lsb in operand
    const undefinedFieldErrors = result.errors.filter(e => 
      e.code === 'undefined-field-reference' && e.message.includes('spr22')
    );

    expect(undefinedFieldErrors.length).toBe(0);
  });

  test('rejects legacy field.subfield syntax with clear error', () => {
    const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name=spr%d
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg LEGACY_ALIAS alias=spr22.lsb`;

    const document = TextDocument.create('test://legacy-syntax.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);

    // Should have syntax errors for legacy syntax
    const syntaxErrors = result.errors.filter(e => 
      e.code === 'invalid-syntax' && e.message.includes('Use context operator syntax')
    );

    expect(syntaxErrors.length).toBeGreaterThan(0);
  });
});