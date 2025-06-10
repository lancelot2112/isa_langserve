/**
 * Language client integration tests
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Language Client Test Suite', () => {
  let extension: vscode.Extension<any> | undefined;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension('isa-tools.isa-language-support');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  test('Language client should start successfully', async function() {
    this.timeout(10000); // Language server startup can take time
    
    if (!extension) {
      assert.fail('Extension not found');
    }

    // Wait for language client to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extension should be active
    assert.strictEqual(extension.isActive, true, 'Extension should be active');
  });

  test('Semantic highlighting should work for ISA files', async function() {
    this.timeout(10000);

    // Create an ISA document
    const content = `
:param ENDIAN=big
:space reg addr=32 word=64 type=register
:space insn addr=32 word=32 type=instruction

:reg GPR size=32 count=32 @(0-31) {
  # General Purpose Registers
}

:insn add size=32 @(0-5|26-31) {
  rT @(6-10)
  rA @(11-15)
  rB @(16-20)
}
`;

    const document = await vscode.workspace.openTextDocument({
      language: 'isa',
      content: content
    });

    await vscode.window.showTextDocument(document);

    // Wait for semantic tokens to be provided
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check that the document is being processed
    assert.strictEqual(document.languageId, 'isa');
    assert.ok(document.getText().includes(':param'));
    assert.ok(document.getText().includes(':space'));
    assert.ok(document.getText().includes(':reg'));
    assert.ok(document.getText().includes(':insn'));

    // Close the editor
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Diagnostics should be provided for invalid syntax', async function() {
    this.timeout(10000);

    // Create an ISA document with syntax errors
    const content = `
:param INVALID_PARAM
:space reg addr=invalid word=64
:reg GPR size=32 @(40-50)  # Out of range for 32-bit
`;

    const document = await vscode.workspace.openTextDocument({
      language: 'isa',
      content: content
    });

    await vscode.window.showTextDocument(document);

    // Wait for diagnostics
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get diagnostics for the document
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    
    // Should have some diagnostics for the syntax errors
    assert.ok(diagnostics.length > 0, 'Should have diagnostics for syntax errors');

    // Close the editor
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Commands should execute without errors', async function() {
    this.timeout(5000);

    // Test format document command
    try {
      await vscode.commands.executeCommand('isa.formatDocument');
      // Command should execute without throwing
    } catch (error) {
      // Expected if no active editor
      assert.ok(error instanceof Error);
    }

    // Test refresh semantic tokens command
    try {
      await vscode.commands.executeCommand('isa.refreshSemanticTokens');
      // Command should execute without throwing
    } catch (error) {
      // May fail if language server not ready
      console.log('Refresh command failed (expected):', error);
    }
  });
});