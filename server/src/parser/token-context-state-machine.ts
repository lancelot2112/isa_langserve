/**
 * Token Context State Machine for ISA Language Parser
 * Replaces string-based context detection with a robust state machine approach
 */

import { Token, TokenType } from './types';

export enum ContextState {
  UNKNOWN = 'unknown',
  FIELD_DEFINITION = 'field-definition',
  FIELD_OPTIONS = 'field-options', 
  INSTRUCTION_DEFINITION = 'instruction-definition',
  INSTRUCTION_OPERANDS = 'instruction-operands',
  INSTRUCTION_OPTIONS = 'instruction-options',
  MASK_DEFINITION = 'mask-definition',
  SUBFIELDS_DEFINITION = 'subfields-definition',
  SUBFIELD_OPTIONS = 'subfield-options',
  RANGES_DEFINITION = 'ranges-definition'
}

export enum TransitionTrigger {
  DIRECTIVE_TOKEN,      // :reg, :insn, etc.
  IDENTIFIER_TOKEN,     // field names, instruction names
  OPEN_PAREN,          // (
  CLOSE_PAREN,         // )
  OPEN_BRACE,          // {
  CLOSE_BRACE,         // }
  EQUALS_SIGN,         // =
  MASK_KEYWORD,        // 'mask'
  SUBFIELDS_KEYWORD,   // 'subfields'
  RANGES_KEYWORD,      // 'ranges'
  BIT_FIELD_TOKEN,     // @(...)
  NEWLINE_OR_END,
  COMMA,               // , separator
  UNKNOWN_TRIGGER
}

export interface ValidationContext {
  shouldValidateAsFieldOption: boolean;
  shouldValidateAsSubfieldOption: boolean;
  shouldValidateAsInstructionOption: boolean;
  context: string;
}

export class TokenContextStateMachine {
  private currentState: ContextState = ContextState.UNKNOWN;
  private stateStack: ContextState[] = [];
  private braceDepth: number = 0;
  private parenDepth: number = 0;
  private lastDirective: string | null = null;
  private tokenHistory: Token[] = [];
  private readonly maxHistorySize = 100;
  
  // Comprehensive state transition table
  private static readonly TRANSITION_TABLE: Map<string, ContextState> = new Map([
    // From UNKNOWN
    [`${ContextState.UNKNOWN}|${TransitionTrigger.DIRECTIVE_TOKEN}`, ContextState.FIELD_DEFINITION],
    
    // From FIELD_DEFINITION (after :reg, :space, etc.)
    [`${ContextState.FIELD_DEFINITION}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.FIELD_OPTIONS],
    [`${ContextState.FIELD_DEFINITION}|${TransitionTrigger.OPEN_PAREN}`, ContextState.INSTRUCTION_OPERANDS],
    
    // From FIELD_OPTIONS (after field/instruction name)  
    [`${ContextState.FIELD_OPTIONS}|${TransitionTrigger.OPEN_PAREN}`, ContextState.INSTRUCTION_OPERANDS],
    
    // From FIELD_OPTIONS (after field name)
    [`${ContextState.FIELD_OPTIONS}|${TransitionTrigger.MASK_KEYWORD}`, ContextState.MASK_DEFINITION],
    [`${ContextState.FIELD_OPTIONS}|${TransitionTrigger.SUBFIELDS_KEYWORD}`, ContextState.SUBFIELDS_DEFINITION], 
    [`${ContextState.FIELD_OPTIONS}|${TransitionTrigger.RANGES_KEYWORD}`, ContextState.RANGES_DEFINITION],
    [`${ContextState.FIELD_OPTIONS}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
    
    // From INSTRUCTION_OPERANDS (inside parentheses)
    [`${ContextState.INSTRUCTION_OPERANDS}|${TransitionTrigger.CLOSE_PAREN}`, ContextState.INSTRUCTION_OPTIONS],
    [`${ContextState.INSTRUCTION_OPERANDS}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.INSTRUCTION_OPERANDS], // stay in operands
    [`${ContextState.INSTRUCTION_OPERANDS}|${TransitionTrigger.COMMA}`, ContextState.INSTRUCTION_OPERANDS], // stay in operands
    
    // From INSTRUCTION_OPTIONS (after instruction operands)
    [`${ContextState.INSTRUCTION_OPTIONS}|${TransitionTrigger.MASK_KEYWORD}`, ContextState.MASK_DEFINITION],
    [`${ContextState.INSTRUCTION_OPTIONS}|${TransitionTrigger.SUBFIELDS_KEYWORD}`, ContextState.SUBFIELDS_DEFINITION],
    [`${ContextState.INSTRUCTION_OPTIONS}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
    
    // From MASK_DEFINITION (after mask=)
    [`${ContextState.MASK_DEFINITION}|${TransitionTrigger.OPEN_BRACE}`, ContextState.MASK_DEFINITION], // stay in mask
    [`${ContextState.MASK_DEFINITION}|${TransitionTrigger.CLOSE_BRACE}`, ContextState.INSTRUCTION_OPTIONS], // back to instruction options
    [`${ContextState.MASK_DEFINITION}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.MASK_DEFINITION], // stay in mask
    [`${ContextState.MASK_DEFINITION}|${TransitionTrigger.EQUALS_SIGN}`, ContextState.MASK_DEFINITION], // stay in mask
    [`${ContextState.MASK_DEFINITION}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
    
    // From SUBFIELDS_DEFINITION (after subfields=)
    [`${ContextState.SUBFIELDS_DEFINITION}|${TransitionTrigger.OPEN_BRACE}`, ContextState.SUBFIELDS_DEFINITION], // stay in subfields
    [`${ContextState.SUBFIELDS_DEFINITION}|${TransitionTrigger.CLOSE_BRACE}`, ContextState.FIELD_OPTIONS], // back to field options
    [`${ContextState.SUBFIELDS_DEFINITION}|${TransitionTrigger.BIT_FIELD_TOKEN}`, ContextState.SUBFIELD_OPTIONS], // enter subfield options
    [`${ContextState.SUBFIELDS_DEFINITION}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.SUBFIELDS_DEFINITION], // stay in subfields
    [`${ContextState.SUBFIELDS_DEFINITION}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
    
    // From SUBFIELD_OPTIONS (after @(...) in subfields)
    [`${ContextState.SUBFIELD_OPTIONS}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.SUBFIELD_OPTIONS], // stay in subfield options
    [`${ContextState.SUBFIELD_OPTIONS}|${TransitionTrigger.COMMA}`, ContextState.SUBFIELDS_DEFINITION], // back to subfields definition
    [`${ContextState.SUBFIELD_OPTIONS}|${TransitionTrigger.CLOSE_BRACE}`, ContextState.FIELD_OPTIONS], // exit subfields entirely
    [`${ContextState.SUBFIELD_OPTIONS}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
    
    // From RANGES_DEFINITION (after ranges=)
    [`${ContextState.RANGES_DEFINITION}|${TransitionTrigger.OPEN_BRACE}`, ContextState.RANGES_DEFINITION], // stay in ranges
    [`${ContextState.RANGES_DEFINITION}|${TransitionTrigger.CLOSE_BRACE}`, ContextState.FIELD_OPTIONS], // back to field options
    [`${ContextState.RANGES_DEFINITION}|${TransitionTrigger.IDENTIFIER_TOKEN}`, ContextState.RANGES_DEFINITION], // stay in ranges
    [`${ContextState.RANGES_DEFINITION}|${TransitionTrigger.NEWLINE_OR_END}`, ContextState.UNKNOWN],
  ]);
  
  /**
   * Process a token and update the state machine
   */
  public processToken(token: Token): ContextState {
    // Add to history
    this.tokenHistory.push(token);
    if (this.tokenHistory.length > this.maxHistorySize) {
      this.tokenHistory.shift();
    }
    
    // Get transition trigger from token
    const trigger = this.getTransitionTrigger(token);
    
    // Update depth counters first
    this.updateDepthCounters(token);
    
    // Perform state transition
    this.currentState = this.transition(this.currentState, trigger, token);
    
    // Track directive for context
    if (trigger === TransitionTrigger.DIRECTIVE_TOKEN) {
      this.lastDirective = token.text;
    }
    
    return this.currentState;
  }
  
  /**
   * Get current validation context
   */
  public getValidationContext(): ValidationContext {
    const shouldValidateAsFieldOption = this.shouldValidateAsFieldOption();
    const shouldValidateAsSubfieldOption = this.shouldValidateAsSubfieldOption(); 
    const shouldValidateAsInstructionOption = this.shouldValidateAsInstructionOption();
    
    return {
      shouldValidateAsFieldOption,
      shouldValidateAsSubfieldOption,
      shouldValidateAsInstructionOption,
      context: this.currentState
    };
  }
  
  /**
   * Reset state machine for new document analysis
   */
  public reset(): void {
    this.currentState = ContextState.UNKNOWN;
    this.stateStack = [];
    this.braceDepth = 0;
    this.parenDepth = 0;
    this.lastDirective = null;
    this.tokenHistory = [];
  }
  
  /**
   * Get current state for debugging
   */
  public getCurrentState(): ContextState {
    return this.currentState;
  }
  
  /**
   * Get current nesting depth for debugging
   */
  public getNestingDepth(): { braces: number; parens: number } {
    return { braces: this.braceDepth, parens: this.parenDepth };
  }
  
  // Private helper methods
  
  private getTransitionTrigger(token: Token): TransitionTrigger {
    switch (token.type) {
      case TokenType.DIRECTIVE:
      case TokenType.SPACE_DIRECTIVE:
        return TransitionTrigger.DIRECTIVE_TOKEN;
        
      case TokenType.SPACE_TAG:
      case TokenType.FIELD_TAG:
      case TokenType.SUBFIELD_TAG:
      case TokenType.INSTRUCTION_TAG:
        return TransitionTrigger.IDENTIFIER_TOKEN;
        
      case TokenType.BIT_FIELD:
        return TransitionTrigger.BIT_FIELD_TOKEN;
        
      case TokenType.EQUALS_SIGN:
        return TransitionTrigger.EQUALS_SIGN;
        
      default:
        // Check text-based triggers
        const text = token.text.trim();
        
        if (text === '(') return TransitionTrigger.OPEN_PAREN;
        if (text === ')') return TransitionTrigger.CLOSE_PAREN;
        if (text === '{') return TransitionTrigger.OPEN_BRACE;
        if (text === '}') return TransitionTrigger.CLOSE_BRACE;
        if (text === ',') return TransitionTrigger.COMMA;
        if (text === 'mask') return TransitionTrigger.MASK_KEYWORD;
        if (text === 'subfields') return TransitionTrigger.SUBFIELDS_KEYWORD;
        if (text === 'ranges') return TransitionTrigger.RANGES_KEYWORD;
        if (text === '\n' || text === '') return TransitionTrigger.NEWLINE_OR_END;
        
        // Generic identifier
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
          return TransitionTrigger.IDENTIFIER_TOKEN;
        }
        
        return TransitionTrigger.UNKNOWN_TRIGGER;
    }
  }
  
  private transition(from: ContextState, trigger: TransitionTrigger, _token: Token): ContextState {
    const key = `${from}|${trigger}`;
    const newState = TokenContextStateMachine.TRANSITION_TABLE.get(key);
    
    if (newState !== undefined) {
      return newState;
    }
    
    // Handle special cases and fallbacks
    
    // If we're in a nested context and hit end/newline, pop state if stack has items
    if (trigger === TransitionTrigger.NEWLINE_OR_END && this.stateStack.length > 0) {
      return this.popState();
    }
    
    // Handle closing brace/paren with stack management
    if (trigger === TransitionTrigger.CLOSE_BRACE || trigger === TransitionTrigger.CLOSE_PAREN) {
      if (this.stateStack.length > 0) {
        return this.popState();
      }
    }
    
    // Handle opening brace/paren with state preservation
    if (trigger === TransitionTrigger.OPEN_BRACE || trigger === TransitionTrigger.OPEN_PAREN) {
      this.pushState(from);
      return from; // Stay in current state but push to stack
    }
    
    // Default: stay in current state for unknown transitions
    return from;
  }
  
  private updateDepthCounters(token: Token): void {
    const text = token.text.trim();
    
    if (text === '{') {
      this.braceDepth++;
    } else if (text === '}') {
      this.braceDepth = Math.max(0, this.braceDepth - 1);
    } else if (text === '(') {
      this.parenDepth++;
    } else if (text === ')') {
      this.parenDepth = Math.max(0, this.parenDepth - 1);
    }
  }
  
  private pushState(state: ContextState): void {
    this.stateStack.push(state);
  }
  
  private popState(): ContextState {
    const previousState = this.stateStack.pop();
    return previousState || ContextState.UNKNOWN;
  }
  
  private shouldValidateAsFieldOption(): boolean {
    return this.currentState === ContextState.FIELD_OPTIONS;
  }
  
  private shouldValidateAsSubfieldOption(): boolean {
    return this.currentState === ContextState.SUBFIELD_OPTIONS;
  }
  
  private shouldValidateAsInstructionOption(): boolean {
    return this.currentState === ContextState.INSTRUCTION_OPTIONS;
  }
  
  /**
   * Get recent context for debugging (similar to old getRecentTokenContext)
   */
  public getRecentContext(maxTokens: number = 20): string {
    const recentTokens = this.tokenHistory.slice(-maxTokens);
    return recentTokens.map(t => t.text).join(' ');
  }
  
  /**
   * Check if currently in a specific context (for migration compatibility)
   */
  public isInContext(context: 'mask' | 'subfields' | 'operands'): boolean {
    switch (context) {
      case 'mask':
        return this.currentState === ContextState.MASK_DEFINITION;
      case 'subfields':
        return this.currentState === ContextState.SUBFIELDS_DEFINITION || 
               this.currentState === ContextState.SUBFIELD_OPTIONS;
      case 'operands':
        return this.currentState === ContextState.INSTRUCTION_OPERANDS;
      default:
        return false;
    }
  }
  
  /**
   * Get detailed state information for debugging
   */
  public getStateInfo(): {
    currentState: ContextState;
    stateStack: ContextState[];
    braceDepth: number;
    parenDepth: number;
    lastDirective: string | null;
    historyLength: number;
  } {
    return {
      currentState: this.currentState,
      stateStack: [...this.stateStack],
      braceDepth: this.braceDepth,
      parenDepth: this.parenDepth,
      lastDirective: this.lastDirective,
      historyLength: this.tokenHistory.length
    };
  }
}