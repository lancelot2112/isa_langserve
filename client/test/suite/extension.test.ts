/**
 * Extension activation and basic functionality tests
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start extension tests.');

  test('Extension should activate', async () => {
    // Get the extension
    const extension = vscode.extensions.getExtension('isa-tools.isa-language-support');
    
    if (extension) {
      // Activate the extension
      await extension.activate();
      assert.strictEqual(extension.isActive, true, 'Extension should be active');
    } else {
      assert.fail('Extension not found');
    }
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    
    const expectedCommands = [
      'isa.validateProject',
      'isa.formatDocument',
      'isa.refreshSemanticTokens',
      'isa.showColorAssignments',
      'isa.debugParser'
    ];

    for (const command of expectedCommands) {
      assert.ok(
        commands.includes(command),
        `Command '${command}' should be registered`
      );
    }
  });

  test('Language configurations should be registered', () => {
    const languages = vscode.languages.getLanguages();
    
    const expectedLanguages = ['isa', 'isaext', 'coredef', 'sysdef'];
    
    return languages.then(langs => {
      for (const lang of expectedLanguages) {
        assert.ok(
          langs.includes(lang),
          `Language '${lang}' should be registered`
        );
      }
    });
  });

  test('ISA file should be recognized', async () => {
    // Create a test ISA file
    const document = await vscode.workspace.openTextDocument({
      language: 'isa',
      content: ':param ENDIAN=big\n:space reg addr=32 word=64 type=register\n'
    });

    assert.strictEqual(document.languageId, 'isa', 'Document should be recognized as ISA');
    
    // Close the document
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Extension configuration should be available', () => {
    const config = vscode.workspace.getConfiguration('isaLanguage');
    
    // Check that configuration sections exist
    assert.ok(config.has('server.path'), 'server.path configuration should exist');
    assert.ok(config.has('validation.enabled'), 'validation.enabled configuration should exist');
    assert.ok(config.has('highlighting.useSemanticTokens'), 'highlighting.useSemanticTokens configuration should exist');
  });
});