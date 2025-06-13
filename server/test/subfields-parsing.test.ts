/**
 * Test for subfields parsing bug fix
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { FieldNode } from '../src/parser/types';

describe('Subfields Parsing', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  test('parses standalone subfields block correctly', () => {
    const content = `:space reg addr=0x20 word=64 type=register

:reg XOM redirect=r4
subfields={
    OV @(0-4) descr="Overflow Flag"
    EXCEPT @(5-9) descr="Exception Flag"
}`;

    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    analyzer.analyzeFile(document);

    // Find the XOM field node
    const context = analyzer.getFileContext(document.uri);
    expect(context).toBeDefined();
    expect(context!.ast).toBeDefined();

    const xomField = context!.ast!.find(node => 
      node.type === 'field' && (node as FieldNode).fieldTag === 'XOM'
    ) as FieldNode;

    expect(xomField).toBeDefined();
    expect(xomField.subfields).toBeDefined();
    expect(xomField.subfields.length).toBeGreaterThan(0);
    
    // Check that subfields were parsed correctly
    const ovSubfield = xomField.subfields.find(sf => sf.tag === 'OV');
    const exceptSubfield = xomField.subfields.find(sf => sf.tag === 'EXCEPT');
    
    expect(ovSubfield).toBeDefined();
    expect(exceptSubfield).toBeDefined();
    
    if (ovSubfield) {
      expect(ovSubfield.bitField.text).toBe('@(0-4)');
    }
    
    if (exceptSubfield) {
      expect(exceptSubfield.bitField.text).toBe('@(5-9)');
    }
  });

  test('parses inline subfields correctly', () => {
    const content = `:space reg addr=0x20 word=64 type=register

:reg GPR size=32 count=32 name=r%d subfields={
    msb @(0-31)
    lsb @(32-63)
}`;

    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    analyzer.analyzeFile(document);

    // Find the GPR field node
    const context = analyzer.getFileContext(document.uri);
    expect(context).toBeDefined();
    expect(context!.ast).toBeDefined();

    const gprField = context!.ast!.find(node => 
      node.type === 'field' && (node as FieldNode).fieldTag === 'GPR'
    ) as FieldNode;

    expect(gprField).toBeDefined();
    expect(gprField.subfields).toBeDefined();
    expect(gprField.subfields.length).toBeGreaterThan(0);
    
    // Check that subfields were parsed correctly
    const msbSubfield = gprField.subfields.find(sf => sf.tag === 'msb');
    const lsbSubfield = gprField.subfields.find(sf => sf.tag === 'lsb');
    
    expect(msbSubfield).toBeDefined();
    expect(lsbSubfield).toBeDefined();
    
    if (msbSubfield) {
      expect(msbSubfield.bitField.text).toBe('@(0-31)');
    }
    
    if (lsbSubfield) {
      expect(lsbSubfield.bitField.text).toBe('@(32-63)');
    }
  });

  test('both inline and standalone subfields work in same file', () => {
    const content = `:space reg addr=0x20 word=64 type=register

:reg XOM redirect=r4
subfields={
    OV @(0-4) descr="Overflow Flag"
    EXCEPT @(5-9) descr="Exception Flag"
}

:reg GPR size=32 count=32 name=r%d subfields={
    msb @(0-31)
    lsb @(32-63)
}`;

    const document = TextDocument.create('test://test.isa', 'isa', 1, content);
    analyzer.analyzeFile(document);

    const context = analyzer.getFileContext(document.uri);
    expect(context).toBeDefined();
    expect(context!.ast).toBeDefined();

    // Find both field nodes
    const xomField = context!.ast!.find(node => 
      node.type === 'field' && (node as FieldNode).fieldTag === 'XOM'
    ) as FieldNode;
    
    const gprField = context!.ast!.find(node => 
      node.type === 'field' && (node as FieldNode).fieldTag === 'GPR'
    ) as FieldNode;

    // Both should have subfields
    expect(xomField).toBeDefined();
    expect(xomField.subfields.length).toBe(2);
    
    expect(gprField).toBeDefined();
    expect(gprField.subfields.length).toBe(2);
  });
});