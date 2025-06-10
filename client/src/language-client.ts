/**
 * Language client configuration and management for ISA Language Server
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  DocumentSelector
} from 'vscode-languageclient/node';

export class ISALanguageClient {
  private client: LanguageClient | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Start the language client and server
   */
  async start(): Promise<LanguageClient> {
    const serverOptions = this.createServerOptions();
    const clientOptions = this.createClientOptions();

    this.client = new LanguageClient(
      'isaLanguageServer',
      'ISA Language Server',
      serverOptions,
      clientOptions
    );

    // Handle server errors
    this.client.onDidChangeState((event) => {
      console.log(`Language server state changed: ${event.oldState} -> ${event.newState}`);
      if (event.newState === 2) { // Stopped
        console.log('ISA Language Server stopped');
        //vscode.window.showWarningMessage('ISA Language Server stopped unexpectedly');
      }
    });

    try {
      console.log('Starting ISA Language Server...');
      await this.client.start();
      console.log('ISA Language Server ready and started successfully');
      
      // Register for custom notifications from server after start
      this.client.onNotification('isa/spaceColorAssignment', (params: any) => {
        console.log('Received space color assignment:', params);
        // Update semantic token colors based on server assignment
      });
      
      this.client.onNotification('isa/diagnosticsUpdate', (params: any) => {
        console.log('Received diagnostics update:', params);
      });

      this.client.onNotification('isa/dynamicColorUpdate', (params: any) => {
        console.log('Received dynamic color update:', params);
      });

      this.client.onNotification('isa/symbolTableUpdate', (params: any) => {
        console.log('Received symbol table update:', params);
      });

      this.client.onNotification('isa/projectAnalysisComplete', (params: any) => {
        console.log('Project analysis complete:', params);
      });
      
      return this.client;
    } catch (error) {
      console.error('Failed to start ISA Language Client:', error);
      throw error;
    }
  }

  /**
   * Stop the language client
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = undefined;
    }
  }

  /**
   * Get the active language client
   */
  getClient(): LanguageClient | undefined {
    return this.client;
  }

  /**
   * Create server options for language server process
   */
  private createServerOptions(): ServerOptions {
    // Get server path from configuration or use default
    const config = vscode.workspace.getConfiguration('isaLanguage');
    const customServerPath = config.get<string>('server.path');
    
    let serverPath: string;
    
    if (customServerPath && customServerPath.trim() !== '') {
      serverPath = customServerPath;
    } else {
      // Use bundled server (relative to server folder)
      serverPath = path.join(this.context.extensionPath, '..', 'server', 'out', 'server.js');
    }

    console.log(`Using ISA Language Server at: ${serverPath}`);
    
    // Check if server file exists
    const fs = require('fs');
    if (!fs.existsSync(serverPath)) {
      throw new Error(`Language server not found at: ${serverPath}`);
    }

    // Server options for Node.js server
    const serverOptions: ServerOptions = {
      run: {
        module: serverPath,
        transport: TransportKind.ipc,
        options: {
          cwd: path.dirname(serverPath)
        }
      },
      debug: {
        module: serverPath,
        transport: TransportKind.ipc,
        options: {
          execArgv: ['--nolazy', '--inspect=6009'],
          cwd: path.dirname(serverPath)
        }
      }
    };

    return serverOptions;
  }

  /**
   * Create client options for language client
   */
  private createClientOptions(): LanguageClientOptions {
    // Document selector for ISA files
    const documentSelector: DocumentSelector = [
      { scheme: 'file', language: 'isa' },
      { scheme: 'file', language: 'isaext' },
      { scheme: 'file', language: 'coredef' },
      { scheme: 'file', language: 'sysdef' }
    ];

    const config = vscode.workspace.getConfiguration('isaLanguage');

    const clientOptions: LanguageClientOptions = {
      documentSelector,
      synchronize: {
        // Watch for changes to ISA-related files
        fileEvents: [
          vscode.workspace.createFileSystemWatcher('**/*.isa'),
          vscode.workspace.createFileSystemWatcher('**/*.isaext'),
          vscode.workspace.createFileSystemWatcher('**/*.coredef'),
          vscode.workspace.createFileSystemWatcher('**/*.sysdef')
        ],
        // Send configuration changes to server
        configurationSection: 'isaLanguage'
      },
      diagnosticCollectionName: 'isa',
      outputChannelName: 'ISA Language Server',
      traceOutputChannel: vscode.window.createOutputChannel('ISA Language Server Trace'),
      
      // Initialize options sent to server
      initializationOptions: {
        enableSemanticTokens: config.get('highlighting.useSemanticTokens', true),
        autoAssignColors: config.get('colorScheme.autoAssign', true),
        maxProblems: config.get('diagnostics.maxProblems', 100),
        validationEnabled: config.get('validation.enabled', true),
        enableHover: true,
        enableFolding: true,
        enableDocumentSymbols: true,
        enableCompletion: true,
        enableDefinition: true,
        enableReferences: true
      },

      // Middleware for customizing requests/responses
      middleware: {
        // Handle semantic tokens
        provideDocumentSemanticTokens: (document, token, next) => {
          console.log(`Providing semantic tokens for ${document.uri}`);
          return next(document, token);
        },
        
        // Handle completion requests
        provideCompletionItem: (document, position, context, token, next) => {
          console.log(`Providing completion at ${document.uri}:${position.line}:${position.character}`);
          return next(document, position, context, token);
        },
        
        // Handle hover requests
        provideHover: (document, position, token, next) => {
          console.log(`Providing hover at ${document.uri}:${position.line}:${position.character}`);
          return next(document, position, token);
        },

        // Handle folding range requests
        provideFoldingRanges: (document, context, token, next) => {
          console.log(`Providing folding ranges for ${document.uri}`);
          return next(document, context, token);
        },

        // Handle document symbol requests
        provideDocumentSymbols: (document, token, next) => {
          console.log(`Providing document symbols for ${document.uri}`);
          return next(document, token);
        },

        // Handle definition requests
        provideDefinition: (document, position, token, next) => {
          console.log(`Providing definition at ${document.uri}:${position.line}:${position.character}`);
          return next(document, position, token);
        },

        // Handle references requests
        provideReferences: (document, position, context, token, next) => {
          console.log(`Providing references at ${document.uri}:${position.line}:${position.character}`);
          return next(document, position, context, token);
        }
      },

      // Error handler
      errorHandler: {
        error: (error, message, count) => {
          console.error('ISA Language Server error:', error, message, count);
          return { action: 1 }; // Continue
        },
        closed: () => {
          console.log('ISA Language Server connection closed');
          return { action: 1 }; // Restart
        }
      }
    };

    return clientOptions;
  }

  /**
   * Send custom request to language server
   */
  async sendRequest<T>(method: string, params?: any): Promise<T> {
    if (!this.client) {
      throw new Error('Language client not initialized');
    }
    
    return this.client.sendRequest(method, params);
  }

  /**
   * Send notification to language server
   */
  sendNotification(method: string, params?: any): void {
    if (!this.client) {
      console.warn('Cannot send notification: Language client not initialized');
      return;
    }
    
    this.client.sendNotification(method, params);
  }

  /**
   * Register for notifications from language server
   */
  onNotification(method: string, handler: (params: any) => void): void {
    if (!this.client) {
      console.warn('Cannot register notification handler: Language client not initialized');
      return;
    }
    
    this.client.onNotification(method, handler);
  }
}