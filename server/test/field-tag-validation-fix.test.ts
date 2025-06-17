/**
 * Tests for field tag validation fix - ensuring field names immediately after directives
 * are not incorrectly flagged as invalid field/instruction options
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';

describe('Field Tag Validation Fix', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  test('field names after directives should not be flagged as invalid field options', () => {
    const content = `
:space ram addr=0 word=32 type=rw
:reg SPR
`;
    
    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);
    
    // Should NOT contain any "invalid field option" errors for "SPR"
    const fieldOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-field-option' && e.message.includes('SPR')
    );
    
    expect(fieldOptionErrors).toHaveLength(0);
  });

  test('instruction names after directives should not be flagged as invalid instruction options', () => {
    const content = `
:space ram addr=0 word=32 type=rw
:insn ADDI
`;
    
    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);
    
    // Should NOT contain any "invalid instruction option" errors for "ADDI"
    const instructionOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-instruction-option' && e.message.includes('ADDI')
    );
    
    expect(instructionOptionErrors).toHaveLength(0);
  });

  test('actual field options should still be validated correctly', () => {
    const content = `
:space ram addr=0 word=32 type=rw
:reg SPR invalidoption=123
`;
    
    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);
    
    // "SPR" should not be flagged as invalid field option (it's the field name)
    const sprFieldOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-field-option' && e.message.includes('SPR')
    );
    expect(sprFieldOptionErrors).toHaveLength(0);
    
    // "invalidoption" should be caught by undefined field reference validation
    const undefinedRefErrors = result.errors.filter(e => 
      e.code === 'undefined-field-reference' && e.message.includes('invalidoption')
    );
    expect(undefinedRefErrors.length).toBeGreaterThan(0);
  });

  test('field names in subfield contexts should still be handled correctly', () => {
    const content = `
:space ram addr=0 word=32 type=rw
:reg SPR subfields={ opcd5 @(0-5) descr="Opcode" overlap @(6-10) descr="Overlap field" }
`;
    
    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    const result = analyzer.analyzeFile(document);
    
    // "SPR" should not be flagged as invalid field option (it's the field name)
    const sprFieldOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-field-option' && e.message.includes('SPR')
    );
    expect(sprFieldOptionErrors).toHaveLength(0);
    
    // "opcd5" and "overlap" should not be flagged as invalid subfield options (they're subfield names)  
    const opcd5SubfieldOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-subfield-option' && e.message.includes('opcd5')
    );
    expect(opcd5SubfieldOptionErrors).toHaveLength(0);
    
    const overlapSubfieldOptionErrors = result.errors.filter(e => 
      e.code === 'invalid-subfield-option' && e.message.includes('overlap')
    );
    expect(overlapSubfieldOptionErrors).toHaveLength(0);
  });
});