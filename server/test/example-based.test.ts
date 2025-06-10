/**
 * Tests based on example files with inline comments specifying expected behavior
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { ISATokenizer } from '../src/parser/tokenizer';
import fs from 'fs';
import path from 'path';

describe('Example-Based Tests', () => {
  let analyzer: SemanticAnalyzer;
  const examplesDir = path.join(__dirname, '../../examples');

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('Alias Example Tests', () => {
    const aliasContent = fs.readFileSync(path.join(examplesDir, 'alias.isa'), 'utf8');

    test('space tags should have unique colors', () => {
      const tokenizer = new ISATokenizer(aliasContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      const spaceTagTokens = tokens.filter(t => t.type === 'spaceTag');
      const spaceTagNames = spaceTagTokens.map(t => t.text);
      
      // Should have both 'reg' and 'other' space tags
      expect(spaceTagNames).toContain('reg');
      expect(spaceTagNames).toContain('other');
      
      // Each space tag should have its own spaceTag property
      const regToken = spaceTagTokens.find(t => t.text === 'reg');
      const otherToken = spaceTagTokens.find(t => t.text === 'other');
      expect(regToken?.spaceTag).toBe('reg');
      expect(otherToken?.spaceTag).toBe('other');
    });

    test('detects undefined field reference errors', () => {
      const document = TextDocument.create('test://alias.isa', 'isa', 1, aliasContent);
      const result = analyzer.analyzeFile(document);

      // Should detect spr1024 as undefined (only spr0-spr1023 exist)
      const undefinedErrors = result.errors.filter(e => 
        e.message.includes('spr1024') || e.message.includes('NAME_NOT_DEFINED')
      );
      expect(undefinedErrors.length).toBeGreaterThan(0);
    });

    test('detects invalid subfield reference errors', () => {
      const document = TextDocument.create('test://alias.isa', 'isa', 1, aliasContent);
      const result = analyzer.analyzeFile(document);

      // Should detect NDF as invalid subfield
      const subfieldErrors = result.errors.filter(e => 
        e.message.includes('NDF') || e.message.includes('SUBFIELD_NOT_DEFINED')
      );
      expect(subfieldErrors.length).toBeGreaterThan(0);
    });

    test('detects invalid binary literals', () => {
      const document = TextDocument.create('test://alias.isa', 'isa', 1, aliasContent);
      const result = analyzer.analyzeFile(document);

      // Should detect 0b5 as invalid binary (5 not valid in binary)
      const binaryErrors = result.errors.filter(e => 
        e.message.includes('0b5') && e.message.includes('Invalid numeric literal')
      );
      expect(binaryErrors.length).toBeGreaterThan(0);
    });

    test('detects undefined field in instruction operands', () => {
      const document = TextDocument.create('test://alias.isa', 'isa', 1, aliasContent);
      const result = analyzer.analyzeFile(document);

      // Should detect 'not_def' as undefined field
      const operandErrors = result.errors.filter(e => 
        e.message.includes('not_def')
      );
      expect(operandErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Bit Field Example Tests', () => {
    const bitFieldContent = fs.readFileSync(path.join(examplesDir, 'bit-field.isa'), 'utf8');

    test('accepts valid bit field formats', () => {
      const document = TextDocument.create('test://bit-field.isa', 'isa', 1, bitFieldContent);
      const result = analyzer.analyzeFile(document);

      // Valid bit fields should not generate bit field errors
      const validBitFieldErrors = result.errors.filter(e => 
        e.message.includes('@(30)') || 
        e.message.includes('@(16-29|0b00)') ||
        e.message.includes('@(?1|18-19|0b01)')
      );
      expect(validBitFieldErrors.length).toBe(0);
    });

    test('detects bit field syntax errors', () => {
      const document = TextDocument.create('test://bit-field.isa', 'isa', 1, bitFieldContent);
      const result = analyzer.analyzeFile(document);

      // Should detect various bit field syntax errors
      const bitFieldErrors = result.errors.filter(e => 
        e.code === 'bit-index-out-of-range' || 
        e.message.includes('bit field') ||
        e.message.includes('Invalid')
      );
      
      // Should detect multiple bit field errors (INV1-INV10)
      expect(bitFieldErrors.length).toBeGreaterThan(5);
    });

    test('detects out-of-range bit indices', () => {
      const document = TextDocument.create('test://bit-field.isa', 'isa', 1, bitFieldContent);
      const result = analyzer.analyzeFile(document);

      // Should detect bits outside 0-31 range for 32-bit word
      const rangeErrors = result.errors.filter(e => 
        e.message.includes('33-35') || 
        e.message.includes('50') ||
        e.message.includes('0x20') ||
        e.message.includes('0o200')
      );
      expect(rangeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Single Word Example Tests', () => {
    const singleWordContent = fs.readFileSync(path.join(examplesDir, 'single-word.isa'), 'utf8');

    test('accepts valid field names', () => {
      const tokenizer = new ISATokenizer(singleWordContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Valid field names should be tokenized as field tags or references
      const fieldTokens = tokens.filter(t => 
        (t.type === 'fieldTag' || t.type === 'fieldReference') && 
        ['FIELD1', 'Fi_EL-d3.', 'a.', 'F', 'Te-S_T.'].includes(t.text)
      );
      expect(fieldTokens.length).toBeGreaterThan(0);
    });

    test('detects invalid field name characters', () => {
      const document = TextDocument.create('test://single-word.isa', 'isa', 1, singleWordContent);
      const result = analyzer.analyzeFile(document);

      // Should detect invalid characters in field names
      const invalidNameErrors = result.errors.filter(e => 
        e.message.includes('E\\') || 
        e.message.includes('abc/-()') ||
        e.message.includes('invalid')
      );
      expect(invalidNameErrors.length).toBeGreaterThan(0);
    });

    test('handles complex alias references', () => {
      const tokenizer = new ISATokenizer(singleWordContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should handle Te-S_T..F alias reference
      const aliasTokens = tokens.filter(t => 
        t.text.includes('Te-S_T.') || t.text === 'F'
      );
      expect(aliasTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Unnamed Field Example Tests', () => {
    const unnamedFieldContent = fs.readFileSync(path.join(examplesDir, 'unnamed-field.isa'), 'utf8');

    test('accepts valid parameter format', () => {
      const document = TextDocument.create('test://unnamed-field.isa', 'isa', 1, unnamedFieldContent);
      const result = analyzer.analyzeFile(document);

      // Should not have param format errors for :param ENDIAN=big
      const paramErrors = result.errors.filter(e => 
        e.code === 'invalid-param-format'
      );
      expect(paramErrors.length).toBe(0);
    });

    test('detects undefined instruction operands', () => {
      const document = TextDocument.create('test://unnamed-field.isa', 'isa', 1, unnamedFieldContent);
      const result = analyzer.analyzeFile(document);

      // Should detect rD and rB as undefined (not defined in subfields)
      const undefinedOperands = result.errors.filter(e => 
        (e.message.includes('rD') || e.message.includes('rB')) &&
        e.message.includes('Undefined')
      );
      expect(undefinedOperands.length).toBeGreaterThan(0);
    });

    test('accepts valid subfield references in instruction', () => {
      const document = TextDocument.create('test://unnamed-field.isa', 'isa', 1, unnamedFieldContent);
      const result = analyzer.analyzeFile(document);

      // rA, AA, opc6, BD should be valid (defined in subfields)
      // Should not have undefined reference errors for these
      const validFieldErrors = result.errors.filter(e => 
        e.message.includes('Undefined') && 
        (e.message.includes('rA') || e.message.includes('AA') || 
         e.message.includes('opc6') || e.message.includes('BD'))
      );
      expect(validFieldErrors.length).toBe(0);
    });
  });

  describe('Valid File Example Tests', () => {
    const validFileContent = fs.readFileSync(path.join(examplesDir, 'valid-file.isa'), 'utf8');

    test('generates unique colors for different spaces', () => {
      const tokenizer = new ISATokenizer(validFileContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      const spaceTagTokens = tokens.filter(t => t.type === 'spaceTag');
      const spaceTagNames = [...new Set(spaceTagTokens.map(t => t.text))];
      
      // Should have both 'insn' and 'reg' spaces
      expect(spaceTagNames).toContain('insn');
      expect(spaceTagNames).toContain('reg');
      
      // Each space should have its own identity
      const insnToken = spaceTagTokens.find(t => t.text === 'insn');
      const regToken = spaceTagTokens.find(t => t.text === 'reg');
      expect(insnToken?.spaceTag).toBe('insn');
      expect(regToken?.spaceTag).toBe('reg');
    });

    test('processes valid hex and complex field references', () => {
      const document = TextDocument.create('test://valid-file.isa', 'isa', 1, validFileContent);
      const result = analyzer.analyzeFile(document);

      // Should accept 0x20 as valid hex
      const hexErrors = result.errors.filter(e => 
        e.message.includes('0x20') && e.message.includes('Invalid')
      );
      expect(hexErrors.length).toBe(0);
    });

    test('handles complex bit field expressions', () => {
      const document = TextDocument.create('test://valid-file.isa', 'isa', 1, validFileContent);
      const result = analyzer.analyzeFile(document);

      // Should handle complex expressions like @(?1||16-20||11-15||0b00)
      // and @(22-30)=0b100001010 without bit field errors
      const complexBitFieldErrors = result.errors.filter(e => 
        e.message.includes('pmrn') || 
        (e.message.includes('22-30') && e.message.includes('Invalid'))
      );
      expect(complexBitFieldErrors.length).toBe(0);
    });

    test('validates instruction mask expressions', () => {
      const document = TextDocument.create('test://valid-file.isa', 'isa', 1, validFileContent);
      const result = analyzer.analyzeFile(document);

      // Should accept valid mask expressions without undefined reference errors
      const maskErrors = result.errors.filter(e => 
        e.message.includes('OP=0b011111') ||
        e.message.includes('OE=0') ||
        e.message.includes('Rc=0')
      );
      
      
      expect(maskErrors.length).toBe(0);
    });
  });

  describe('Token Type Accuracy Across Examples', () => {
    test('correctly identifies space options vs field options', () => {
      const validFileContent = fs.readFileSync(path.join(examplesDir, 'valid-file.isa'), 'utf8');
      const tokenizer = new ISATokenizer(validFileContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Space options should be identified correctly
      const spaceOptions = tokens.filter(t => t.type === 'spaceOptionTag');
      const spaceOptionTexts = spaceOptions.map(t => t.text);
      expect(spaceOptionTexts).toContain('addr');
      expect(spaceOptionTexts).toContain('word');
      expect(spaceOptionTexts).toContain('type');

      // Field options should be identified correctly  
      const fieldOptions = tokens.filter(t => t.type === 'fieldOptionTag');
      const fieldOptionTexts = fieldOptions.map(t => t.text);
      expect(fieldOptionTexts).toContain('size');
      expect(fieldOptionTexts).toContain('count');
      expect(fieldOptionTexts).toContain('name');
    });

    test('distinguishes comments from other tokens', () => {
      const aliasContent = fs.readFileSync(path.join(examplesDir, 'alias.isa'), 'utf8');
      const tokenizer = new ISATokenizer(aliasContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should identify comment tokens
      const commentTokens = tokens.filter(t => t.type === 'comment');
      expect(commentTokens.length).toBeGreaterThan(0);
      
      // Comments should start with #
      commentTokens.forEach(token => {
        expect(token.text).toMatch(/^#/);
      });
    });

    test('properly tokenizes numeric literals', () => {
      const validFileContent = fs.readFileSync(path.join(examplesDir, 'valid-file.isa'), 'utf8');
      const tokenizer = new ISATokenizer(validFileContent, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should identify various numeric formats
      const numericTokens = tokens.filter(t => t.type === 'numericLiteral');
      const numericTexts = numericTokens.map(t => t.text);
      
      // Should include decimal, hex, and binary literals
      expect(numericTexts.some(t => /^\d+$/.test(t))).toBe(true); // decimal
      expect(numericTexts.some(t => /^0x[0-9a-fA-F]+$/.test(t))).toBe(true); // hex
      expect(numericTexts.some(t => /^0b[01]+$/.test(t))).toBe(true); // binary
    });
  });

  describe('Error Location Accuracy', () => {
    test('error ranges are within document bounds for all examples', () => {
      const exampleFiles = ['alias.isa', 'bit-field.isa', 'single-word.isa', 'unnamed-field.isa', 'valid-file.isa'];
      
      exampleFiles.forEach(filename => {
        const content = fs.readFileSync(path.join(examplesDir, filename), 'utf8');
        const document = TextDocument.create(`test://${filename}`, 'isa', 1, content);
        const result = analyzer.analyzeFile(document);
        const lines = content.split('\n');

        result.errors.forEach(error => {
          expect(error.location.range.start.line).toBeGreaterThanOrEqual(0);
          expect(error.location.range.start.line).toBeLessThan(lines.length);
          expect(error.location.range.end.line).toBeGreaterThanOrEqual(error.location.range.start.line);
          expect(error.location.range.start.character).toBeGreaterThanOrEqual(0);
          expect(error.location.range.end.character).toBeGreaterThan(error.location.range.start.character);
          
          // Character positions should be within line bounds
          const line = lines[error.location.range.start.line] || '';
          expect(error.location.range.start.character).toBeLessThanOrEqual(line.length);
          expect(error.location.range.end.character).toBeLessThanOrEqual(line.length);
        });
      });
    });
  });
});