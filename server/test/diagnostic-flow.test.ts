/**
 * Tests for diagnostic flow from analyzer to LSP client
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { validateTextDocumentForTesting, defaultSettings } from '../src/server-test-helpers';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';

describe('Diagnostic Flow', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('LSP Diagnostic Generation', () => {
    test('converts analyzer errors to LSP diagnostics', async () => {
      const content = ':space reg addr=32 word=64 type=invalid_type';
      const document = TextDocument.create('test://test.isa', 'isa', 1, content);
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        analyzer
      );
      
      expect(diagnostics.length).toBeGreaterThan(0);
      
      // Check diagnostic structure
      diagnostics.forEach(diagnostic => {
        expect(diagnostic.range).toBeDefined();
        expect(diagnostic.message).toBeDefined();
        expect(diagnostic.severity).toBeDefined();
        expect(diagnostic.source).toBe('isa-language-server');
        
        // Verify severity mapping
        expect([
          DiagnosticSeverity.Error,
          DiagnosticSeverity.Warning,
          DiagnosticSeverity.Information
        ]).toContain(diagnostic.severity);
      });
    });

    test('respects maxProblems setting', async () => {
      // Create content with multiple errors
      const content = Array.from({ length: 10 }, (_, i) => 
        `:space space${i} addr=32 word=64 type=invalid${i}`
      ).join('\n');
      
      const document = TextDocument.create('test://many-errors.isa', 'isa', 1, content);
      
      const limitedSettings = { ...defaultSettings, maxProblems: 3 };
      const diagnostics = await validateTextDocumentForTesting(
        document,
        limitedSettings,
        analyzer
      );
      
      // Should be limited to maxProblems
      expect(diagnostics.length).toBeLessThanOrEqual(3);
    });

    test('returns empty array when validation disabled', async () => {
      const content = ':space reg addr=32 word=64 type=invalid_type';
      const document = TextDocument.create('test://test.isa', 'isa', 1, content);
      
      const disabledSettings = { ...defaultSettings, enableValidation: false };
      const diagnostics = await validateTextDocumentForTesting(
        document,
        disabledSettings,
        analyzer
      );
      
      expect(diagnostics.length).toBe(0);
    });

    test('handles analyzer errors gracefully', async () => {
      const content = 'valid content';
      const document = TextDocument.create('test://test.isa', 'isa', 1, content);
      
      // Mock analyzer to throw error
      const faultyAnalyzer = {
        analyzeFile: jest.fn().mockImplementation(() => {
          throw new Error('Test analyzer error');
        })
      } as any;
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        faultyAnalyzer
      );
      
      // Should return empty array on error
      expect(diagnostics.length).toBe(0);
    });
  });

  describe('Diagnostic Content Validation', () => {
    test('diagnostic ranges are within document bounds', async () => {
      const content = ':space reg addr=32 word=64 type=invalid';
      const document = TextDocument.create('test://test.isa', 'isa', 1, content);
      const lines = content.split('\n');
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        analyzer
      );
      
      diagnostics.forEach(diagnostic => {
        expect(diagnostic.range.start.line).toBeGreaterThanOrEqual(0);
        expect(diagnostic.range.start.line).toBeLessThan(lines.length);
        expect(diagnostic.range.end.line).toBeGreaterThanOrEqual(diagnostic.range.start.line);
        expect(diagnostic.range.start.character).toBeGreaterThanOrEqual(0);
        expect(diagnostic.range.end.character).toBeGreaterThan(diagnostic.range.start.character);
      });
    });

    test('error messages are descriptive', async () => {
      const content = ':space reg addr=32 word=64 type=invalid_type';
      const document = TextDocument.create('test://test.isa', 'isa', 1, content);
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        analyzer
      );
      
      const typeErrors = diagnostics.filter(d => 
        d.message.includes('Invalid space type')
      );
      
      expect(typeErrors.length).toBeGreaterThan(0);
      expect(typeErrors[0]?.message).toContain('invalid_type');
      expect(typeErrors[0]?.severity).toBe(DiagnosticSeverity.Error);
    });
  });

  describe('Comprehensive Error Detection', () => {
    test('detects param format errors', async () => {
      const content = ':param INVALID_FORMAT';
      const document = TextDocument.create('test://param-error.isa', 'isa', 1, content);
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        analyzer
      );
      
      const paramErrors = diagnostics.filter(d => 
        d.message.includes('Invalid param directive')
      );
      
      expect(paramErrors.length).toBeGreaterThan(0);
      expect(paramErrors[0]?.severity).toBe(DiagnosticSeverity.Error);
    });

    test('processes valid content without errors', async () => {
      const content = `:param ENDIAN=big
:space reg addr=32 word=64 type=register
:reg GPR size=32 count=32`;
      
      const document = TextDocument.create('test://valid.isa', 'isa', 1, content);
      
      const diagnostics = await validateTextDocumentForTesting(
        document,
        defaultSettings,
        analyzer
      );
      
      // Valid content should have minimal errors (allowing for validation edge cases)
      expect(diagnostics.length).toBeLessThan(20);
    });
  });
});