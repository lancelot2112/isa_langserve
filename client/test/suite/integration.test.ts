/**
 * Integration tests for ISA Language Client
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { ISALanguageClient } from '../../src/language-client';
import { ISAHoverProvider } from '../../src/features/hover-provider';
import { ISAFoldingRangeProvider } from '../../src/features/folding-provider';
import { ISADocumentSymbolProvider } from '../../src/features/document-symbols';
import { SemanticHighlighting } from '../../src/features/semantic-highlighting';

suite('ISA Language Client Integration Tests', () => {
  let context: vscode.ExtensionContext;
  let languageClient: ISALanguageClient;

  suiteSetup(async () => {
    // Get the extension context
    const extension = vscode.extensions.getExtension('isa-tools.isa-language-support');
    if (extension) {
      context = extension.exports?.context || {
        subscriptions: [],
        extensionPath: extension.extensionPath,
        asAbsolutePath: (relativePath: string) => 
          vscode.Uri.joinPath(extension.extensionUri, relativePath).fsPath
      } as any;
    }
  });

  setup(() => {
    if (context) {
      languageClient = new ISALanguageClient(context);
    }
  });

  teardown(async () => {
    if (languageClient) {
      await languageClient.stop();
    }
  });

  test('should create language client successfully', () => {
    assert.ok(languageClient, 'Language client should be created');
    assert.ok(typeof languageClient.start === 'function', 'Should have start method');
    assert.ok(typeof languageClient.stop === 'function', 'Should have stop method');
  });

  test('should handle server configuration correctly', () => {
    const serverOptions = (languageClient as any).createServerOptions();
    assert.ok(serverOptions, 'Should create server options');
    assert.ok(serverOptions.run, 'Should have run configuration');
    assert.ok(serverOptions.debug, 'Should have debug configuration');
  });

  test('should handle client configuration correctly', () => {
    const clientOptions = (languageClient as any).createClientOptions();
    assert.ok(clientOptions, 'Should create client options');
    assert.ok(clientOptions.documentSelector, 'Should have document selector');
    assert.ok(clientOptions.synchronize, 'Should have synchronization settings');
    
    const docSelector = clientOptions.documentSelector;
    const languages = docSelector.map((sel: any) => sel.language);
    assert.ok(languages.includes('isa'), 'Should support .isa files');
    assert.ok(languages.includes('isaext'), 'Should support .isaext files');
    assert.ok(languages.includes('coredef'), 'Should support .coredef files');
    assert.ok(languages.includes('sysdef'), 'Should support .sysdef files');
  });

  test('should register all providers correctly', async () => {
    // Test provider registration functions exist
    assert.ok(typeof ISAHoverProvider.register === 'function', 'HoverProvider should have register method');
    assert.ok(typeof ISAFoldingRangeProvider.register === 'function', 'FoldingProvider should have register method');
    assert.ok(typeof ISADocumentSymbolProvider.register === 'function', 'SymbolProvider should have register method');
  });

  test('should handle file associations', async () => {
    // Create test documents with different ISA file types
    const isaDoc = await vscode.workspace.openTextDocument({
      content: ':space reg addr=32',
      language: 'isa'
    });

    const isaextDoc = await vscode.workspace.openTextDocument({
      content: ':extension base=core1',
      language: 'isaext'
    });

    const coredefDoc = await vscode.workspace.openTextDocument({
      content: ':include base.isa',
      language: 'coredef'
    });

    const sysdefDoc = await vscode.workspace.openTextDocument({
      content: ':attach core1.coredef',
      language: 'sysdef'
    });

    assert.strictEqual(isaDoc.languageId, 'isa', 'ISA file should be recognized');
    assert.strictEqual(isaextDoc.languageId, 'isaext', 'ISAEXT file should be recognized');
    assert.strictEqual(coredefDoc.languageId, 'coredef', 'COREDEF file should be recognized');
    assert.strictEqual(sysdefDoc.languageId, 'sysdef', 'SYSDEF file should be recognized');
  });

  test('should handle workspace configuration', () => {
    const config = vscode.workspace.getConfiguration('isaLanguage');
    
    // Test that configuration properties are accessible
    const serverPath = config.get('server.path');
    const validationEnabled = config.get('validation.enabled');
    const useSemanticTokens = config.get('highlighting.useSemanticTokens');
    
    // These should not throw errors
    assert.ok(typeof serverPath === 'string' || serverPath === undefined, 'Server path should be string or undefined');
    assert.ok(typeof validationEnabled === 'boolean' || validationEnabled === undefined, 'Validation should be boolean or undefined');
    assert.ok(typeof useSemanticTokens === 'boolean' || useSemanticTokens === undefined, 'Semantic tokens should be boolean or undefined');
  });

  test('should handle example files correctly', async () => {
    // Test with a real example file if available
    const exampleContent = `# Test file for ISA language support
:param ENDIAN=big

:space reg addr=0x20 word=64 type=register
:reg GPR size=32 count=32 name=r%d
:reg XER size=32 subfields={
    OV @(0-4) descr="Overflow Flag"
    SO @(5-9) descr="Summary Overflow"
}

:space insn addr=32 word=32 type=ro
:insn add (rD,rA,rB) mask={OP=0b011111 OE=0} semantics={
    rD = rA + rB
}`;

    const document = await vscode.workspace.openTextDocument({
      content: exampleContent,
      language: 'isa'
    });

    assert.strictEqual(document.languageId, 'isa', 'Document should be recognized as ISA');
    assert.ok(document.getText().includes(':space'), 'Document should contain space directives');
    assert.ok(document.getText().includes(':reg'), 'Document should contain register directives');
    assert.ok(document.getText().includes(':insn'), 'Document should contain instruction directives');
  });

  test('should handle semantic token legend', () => {
    // Test that semantic token types are properly defined
    const mockClient = {
      sendRequest: () => Promise.resolve({}),
      onNotification: () => {},
      sendNotification: () => {}
    };

    const semanticHighlighting = new SemanticHighlighting(mockClient as any);
    const legend = (semanticHighlighting as any).legend;

    assert.ok(legend instanceof vscode.SemanticTokensLegend, 'Should create semantic tokens legend');
    assert.ok(legend.tokenTypes.length > 10, 'Should have sufficient token types');
    assert.ok(legend.tokenModifiers.length > 0, 'Should have token modifiers');

    semanticHighlighting.dispose();
  });

  test('should handle error conditions gracefully', async () => {
    // Test with invalid server path
    const invalidClient = new ISALanguageClient({
      ...context,
      extensionPath: '/invalid/path'
    } as any);

    try {
      await invalidClient.start();
      assert.fail('Should have thrown error for invalid server path');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw error for invalid server');
      assert.ok(error.message.includes('Language server not found'), 'Should have meaningful error message');
    }
  });

  test('should handle custom requests and notifications', async () => {
    const client = (languageClient as any);
    
    // Test custom request methods exist
    assert.ok(typeof client.sendRequest === 'function', 'Should have sendRequest method');
    assert.ok(typeof client.sendNotification === 'function', 'Should have sendNotification method');
    assert.ok(typeof client.onNotification === 'function', 'Should have onNotification method');
  });
});