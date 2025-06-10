/**
 * Basic test suite for ISA Language Features
 */

import * as assert from 'assert';
import { ISAHoverProvider } from '../../src/features/hover-provider';
import { ISAFoldingRangeProvider } from '../../src/features/folding-provider';
import { ISADocumentSymbolProvider } from '../../src/features/document-symbols';
import { SemanticHighlighting } from '../../src/features/semantic-highlighting';
import { createMockLanguageClient } from '../helpers/mock-language-client';

suite('Basic ISA Language Features Test Suite', () => {
  let mockClient: any;

  setup(() => {
    mockClient = createMockLanguageClient();
  });

  test('should create hover provider', () => {
    const hoverProvider = new ISAHoverProvider(mockClient);
    assert.ok(hoverProvider, 'Hover provider should be created');
  });

  test('should create folding provider', () => {
    const foldingProvider = new ISAFoldingRangeProvider(mockClient);
    assert.ok(foldingProvider, 'Folding provider should be created');
  });

  test('should create document symbol provider', () => {
    const symbolProvider = new ISADocumentSymbolProvider(mockClient);
    assert.ok(symbolProvider, 'Document symbol provider should be created');
  });

  test('should create semantic highlighting', () => {
    const semanticHighlighting = new SemanticHighlighting(mockClient);
    assert.ok(semanticHighlighting, 'Semantic highlighting should be created');
    semanticHighlighting.dispose();
  });

  test('should handle provider registration', () => {
    assert.ok(typeof ISAHoverProvider.register === 'function', 'HoverProvider should have register method');
    assert.ok(typeof ISAFoldingRangeProvider.register === 'function', 'FoldingProvider should have register method');
    assert.ok(typeof ISADocumentSymbolProvider.register === 'function', 'SymbolProvider should have register method');
  });

  test('should handle mock client requests', async () => {
    mockClient.sendRequest.resolves({ test: 'data' });
    
    const result = await mockClient.sendRequest('test/method');
    assert.deepStrictEqual(result, { test: 'data' }, 'Should return mock data');
  });

  test('should handle mock client errors', async () => {
    mockClient.sendRequest.rejects(new Error('Test error'));
    
    try {
      await mockClient.sendRequest('test/method');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw error');
      assert.strictEqual(error.message, 'Test error', 'Should have correct error message');
    }
  });

  test('should handle notifications', () => {
    let notificationReceived = false;
    
    mockClient.onNotification('test/notification', () => {
      notificationReceived = true;
    });
    
    const handler = mockClient.onNotificationHandlers.get('test/notification');
    assert.ok(handler, 'Should register notification handler');
    
    handler({});
    assert.strictEqual(notificationReceived, true, 'Should receive notification');
  });

  test('should handle semantic token types', () => {
    const semanticHighlighting = new SemanticHighlighting(mockClient);
    const legend = (semanticHighlighting as any).legend;
    
    assert.ok(legend.tokenTypes.length > 0, 'Should have token types');
    assert.ok(legend.tokenModifiers.length > 0, 'Should have token modifiers');
    
    semanticHighlighting.dispose();
  });

  test('should handle space color assignments', () => {
    const semanticHighlighting = new SemanticHighlighting(mockClient);
    
    // Simulate space color assignment
    const colorAssignments = [
      {
        spaceTag: 'reg',
        color: 'hsl(200, 70%, 60%)',
        usageCount: 3,
        locations: []
      }
    ];

    const handler = mockClient.onNotificationHandlers.get('isa/spaceColorAssignment');
    if (handler) {
      handler(colorAssignments);
    }

    const spaceColors = semanticHighlighting.getSpaceColors();
    assert.strictEqual(spaceColors.get('reg'), 'hsl(200, 70%, 60%)', 'Should store space color');
    
    semanticHighlighting.dispose();
  });
});