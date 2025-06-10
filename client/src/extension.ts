/**
 * Main VS Code extension entry point for ISA Language Support
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { ISALanguageClient } from './language-client';
import { SemanticHighlighting } from './features/semantic-highlighting';
import { ISAHoverProvider } from './features/hover-provider';
import { ISAFoldingRangeProvider } from './features/folding-provider';
import { ISADocumentSymbolProvider } from './features/document-symbols';

let client: LanguageClient | undefined;
let semanticHighlighting: SemanticHighlighting | undefined;
let providers: vscode.Disposable[] = [];

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('ISA Language Support extension activated');

  try {
    // Initialize language client
    const languageClient = new ISALanguageClient(context);
    client = await languageClient.start();
    
    // Initialize semantic highlighting
    semanticHighlighting = new SemanticHighlighting(client);
    
    // Register language feature providers
    registerProviders(client, context);
    
    // Register commands
    registerCommands(context);
    
    // Set up status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(check) ISA";
    statusBarItem.tooltip = "ISA Language Server is active";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    console.log('ISA Language Support extension initialization complete');
  } catch (error) {
    console.error('Failed to activate ISA Language Support:', error);
    vscode.window.showErrorMessage(`Failed to start ISA Language Server: ${error}`);
  }
}

/**
 * Extension deactivation
 */
export async function deactivate(): Promise<void> {
  console.log('ISA Language Support extension deactivating');
  
  if (client) {
    await client.stop();
    client = undefined;
  }
  
  semanticHighlighting?.dispose();
  semanticHighlighting = undefined;
  
  // Dispose all providers
  providers.forEach(provider => provider.dispose());
  providers.length = 0;
  
  console.log('ISA Language Support extension deactivated');
}

/**
 * Register language feature providers
 */
function registerProviders(client: LanguageClient, context: vscode.ExtensionContext): void {
  console.log('Registering ISA language feature providers');
  
  try {
    // Register hover provider
    const hoverProvider = ISAHoverProvider.register(client);
    providers.push(hoverProvider);
    context.subscriptions.push(hoverProvider);
    console.log('Registered hover provider');
    
    // Register folding range provider
    const foldingProvider = ISAFoldingRangeProvider.register(client);
    providers.push(foldingProvider);
    context.subscriptions.push(foldingProvider);
    console.log('Registered folding range provider');
    
    // Register document symbol provider
    const symbolProvider = ISADocumentSymbolProvider.register(client);
    providers.push(symbolProvider);
    context.subscriptions.push(symbolProvider);
    console.log('Registered document symbol provider');
    
    console.log('All ISA language feature providers registered successfully');
  } catch (error) {
    console.error('Failed to register language feature providers:', error);
    vscode.window.showErrorMessage(`Failed to register ISA language features: ${error}`);
  }
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  const commands = [
    vscode.commands.registerCommand('isa.validateProject', async () => {
      if (!client) {
        vscode.window.showWarningMessage('Language server not available');
        return;
      }
      
      try {
        vscode.window.showInformationMessage('Validating ISA project...');
        // Send custom request to language server for project validation
        await client.sendRequest('workspace/executeCommand', {
          command: 'isa.validateProject',
          arguments: [vscode.workspace.workspaceFolders?.[0]?.uri.toString()]
        });
        vscode.window.showInformationMessage('Project validation complete');
      } catch (error) {
        vscode.window.showErrorMessage(`Project validation failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('isa.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      if (!client) {
        vscode.window.showWarningMessage('Language server not available');
        return;
      }

      try {
        await vscode.commands.executeCommand('editor.action.formatDocument');
      } catch (error) {
        vscode.window.showErrorMessage(`Document formatting failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('isa.refreshSemanticTokens', async () => {
      if (!semanticHighlighting) {
        vscode.window.showWarningMessage('Semantic highlighting not available');
        return;
      }

      try {
        await semanticHighlighting.refresh();
        vscode.window.showInformationMessage('Semantic tokens refreshed');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to refresh semantic tokens: ${error}`);
      }
    }),

    vscode.commands.registerCommand('isa.showColorAssignments', async () => {
      if (!client) {
        vscode.window.showWarningMessage('Language server not available');
        return;
      }

      try {
        const colorAssignments = await client.sendRequest('isa/getSpaceColorAssignments', {
          uri: vscode.window.activeTextEditor?.document.uri.toString()
        });
        
        const panel = vscode.window.createWebviewPanel(
          'isaColorAssignments',
          'ISA Space Tag Colors',
          vscode.ViewColumn.Two,
          { enableScripts: true }
        );
        
        panel.webview.html = generateColorAssignmentHTML(colorAssignments);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to get color assignments: ${error}`);
      }
    }),

    vscode.commands.registerCommand('isa.debugParser', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      if (!client) {
        vscode.window.showWarningMessage('Language server not available');
        return;
      }

      try {
        const debugInfo = await client.sendRequest('isa/debugParser', {
          textDocument: { uri: editor.document.uri.toString() },
          range: editor.selection
        });
        
        const panel = vscode.window.createWebviewPanel(
          'isaParserDebug',
          'ISA Parser Debug',
          vscode.ViewColumn.Two,
          { enableScripts: true }
        );
        
        panel.webview.html = generateParserDebugHTML(debugInfo);
      } catch (error) {
        vscode.window.showErrorMessage(`Parser debugging failed: ${error}`);
      }
    })
  ];

  commands.forEach(command => context.subscriptions.push(command));
}

/**
 * Generate HTML for color assignment display
 */
function generateColorAssignmentHTML(colorAssignments: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>ISA Space Tag Colors</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .color-assignment { margin: 10px 0; padding: 10px; border-left: 4px solid; }
            .space-tag { font-weight: bold; }
            .color-value { font-family: monospace; margin-left: 10px; }
        </style>
    </head>
    <body>
        <h2>Space Tag Color Assignments</h2>
        ${JSON.stringify(colorAssignments, null, 2)}
    </body>
    </html>
  `;
}

/**
 * Generate HTML for parser debug display
 */
function generateParserDebugHTML(debugInfo: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>ISA Parser Debug</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            pre { background: var(--vscode-textCodeBlock-background); padding: 10px; }
        </style>
    </head>
    <body>
        <h2>Parser Debug Information</h2>
        <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
    </body>
    </html>
  `;
}