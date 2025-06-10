/**
 * Helper functions for testing server functionality
 * Exports internal functions for testing purposes
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { SemanticAnalyzer } from './analysis/semantic-analyzer';
import { ISALanguageServerConfig } from './parser/types';

// Export the default settings for testing
export const defaultSettings: ISALanguageServerConfig = {
  maxProblems: 100,
  enableValidation: true,
  colorScheme: {
    autoAssign: true,
    spaceColors: {},
  },
  includePaths: [],
};

// Create a testable version of the validation function
export async function validateTextDocumentForTesting(
  textDocument: TextDocument,
  settings: ISALanguageServerConfig,
  analyzer: SemanticAnalyzer
): Promise<Diagnostic[]> {
  if (!settings.enableValidation) {
    return [];
  }

  try {
    const result = analyzer.analyzeFile(textDocument);
    
    // Convert validation errors to LSP diagnostics
    const diagnostics: Diagnostic[] = result.errors.slice(0, settings.maxProblems).map(error => {
      const diagnostic: Diagnostic = {
        severity: error.severity === 'error' ? DiagnosticSeverity.Error :
                  error.severity === 'warning' ? DiagnosticSeverity.Warning :
                  DiagnosticSeverity.Information,
        range: error.location.range,
        message: error.message,
        source: 'isa-language-server',
      };
      
      if (error.code) {
        diagnostic.code = error.code;
      }
      
      return diagnostic;
    });

    return diagnostics;
  } catch (error) {
    // Log error and return empty diagnostics
    console.error(`Error validating document ${textDocument.uri}: ${error}`);
    return [];
  }
}

// Mock document settings function for testing
export async function getDocumentSettingsForTesting(
  _resource: string,
  customSettings?: Partial<ISALanguageServerConfig>
): Promise<ISALanguageServerConfig> {
  return { ...defaultSettings, ...customSettings };
}