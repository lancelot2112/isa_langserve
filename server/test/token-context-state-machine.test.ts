/**
 * Tests for TokenContextStateMachine
 * Validates the state machine approach for context detection
 */

import { 
  TokenContextStateMachine, 
  ContextState 
} from '../src/parser/token-context-state-machine';
import { Token, TokenType } from '../src/parser/types';

describe('TokenContextStateMachine', () => {
  let stateMachine: TokenContextStateMachine;
  
  beforeEach(() => {
    stateMachine = new TokenContextStateMachine();
  });
  
  const createToken = (type: TokenType, text: string, line = 0, char = 0): Token => ({
    type,
    text,
    location: {
      start: { line, character: char },
      end: { line, character: char + text.length },
      range: {
        start: { line, character: char },
        end: { line, character: char + text.length },
      },
    },
  });
  
  describe('Basic State Transitions', () => {
    test('starts in UNKNOWN state', () => {
      expect(stateMachine.getCurrentState()).toBe(ContextState.UNKNOWN);
    });
    
    test('transitions from UNKNOWN to FIELD_DEFINITION on directive', () => {
      const directive = createToken(TokenType.DIRECTIVE, ':reg');
      stateMachine.processToken(directive);
      expect(stateMachine.getCurrentState()).toBe(ContextState.FIELD_DEFINITION);
    });
    
    test('transitions from FIELD_DEFINITION to FIELD_OPTIONS on identifier', () => {
      const directive = createToken(TokenType.DIRECTIVE, ':reg');
      const identifier = createToken(TokenType.FIELD_TAG, 'GPR');
      
      stateMachine.processToken(directive);
      stateMachine.processToken(identifier);
      
      expect(stateMachine.getCurrentState()).toBe(ContextState.FIELD_OPTIONS);
    });
    
    test('transitions to INSTRUCTION_OPERANDS on open parenthesis', () => {
      const directive = createToken(TokenType.DIRECTIVE, ':other');
      const identifier = createToken(TokenType.INSTRUCTION_TAG, 'testinsn');
      const openParen = createToken(TokenType.FIELD_REFERENCE, '(');
      
      stateMachine.processToken(directive);
      stateMachine.processToken(identifier);
      stateMachine.processToken(openParen);
      
      expect(stateMachine.getCurrentState()).toBe(ContextState.INSTRUCTION_OPERANDS);
    });
  });
  
  describe('Complex Context Scenarios', () => {
    test('handles instruction with operands and mask', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':other'),
        createToken(TokenType.INSTRUCTION_TAG, '32bitinsn'),
        createToken(TokenType.FIELD_REFERENCE, '('),
        createToken(TokenType.FIELD_REFERENCE, 'overlap'),
        createToken(TokenType.FIELD_REFERENCE, ','),
        createToken(TokenType.FIELD_REFERENCE, 'AA'),
        createToken(TokenType.FIELD_REFERENCE, ')'),
        createToken(TokenType.FIELD_REFERENCE, 'mask'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.FIELD_REFERENCE, '{'),
        createToken(TokenType.FIELD_REFERENCE, 'opcd5'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.NUMERIC_LITERAL, '0b110110'),
      ];
      
      const states: ContextState[] = [];
      for (const token of tokens) {
        const state = stateMachine.processToken(token);
        states.push(state);
      }
      
      // Verify key state transitions
      expect(states[0]).toBe(ContextState.FIELD_DEFINITION); // :other
      expect(states[1]).toBe(ContextState.FIELD_OPTIONS); // 32bitinsn  
      expect(states[2]).toBe(ContextState.INSTRUCTION_OPERANDS); // (
      expect(states[6]).toBe(ContextState.INSTRUCTION_OPTIONS); // )
      expect(states[9]).toBe(ContextState.MASK_DEFINITION); // {
      expect(states[10]).toBe(ContextState.MASK_DEFINITION); // opcd5
    });
    
    test('handles field with subfields', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_TAG, 'SPR'),
        createToken(TokenType.FIELD_REFERENCE, 'subfields'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.FIELD_REFERENCE, '{'),
        createToken(TokenType.SUBFIELD_TAG, 'lsb'),
        createToken(TokenType.BIT_FIELD, '@(0-7)'),
        createToken(TokenType.FIELD_REFERENCE, 'op'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.QUOTED_STRING, '"write"'),
        createToken(TokenType.FIELD_REFERENCE, '}'),
      ];
      
      const states: ContextState[] = [];
      for (const token of tokens) {
        const state = stateMachine.processToken(token);
        states.push(state);
      }
      
      // Verify subfields context transitions
      expect(states[0]).toBe(ContextState.FIELD_DEFINITION); // :reg
      expect(states[1]).toBe(ContextState.FIELD_OPTIONS); // SPR
      expect(states[4]).toBe(ContextState.SUBFIELDS_DEFINITION); // {
      expect(states[6]).toBe(ContextState.SUBFIELD_OPTIONS); // @(0-7)
      expect(states[10]).toBe(ContextState.FIELD_OPTIONS); // }
    });
  });
  
  describe('Validation Context', () => {
    test('provides correct field option validation context', () => {
      const directive = createToken(TokenType.DIRECTIVE, ':reg');
      const identifier = createToken(TokenType.FIELD_TAG, 'GPR');
      
      stateMachine.processToken(directive);
      stateMachine.processToken(identifier);
      
      const context = stateMachine.getValidationContext();
      expect(context.shouldValidateAsFieldOption).toBe(true);
      expect(context.shouldValidateAsSubfieldOption).toBe(false);
      expect(context.shouldValidateAsInstructionOption).toBe(false);
      expect(context.context).toBe(ContextState.FIELD_OPTIONS);
    });
    
    test('provides correct subfield option validation context', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_TAG, 'SPR'),
        createToken(TokenType.FIELD_REFERENCE, 'subfields'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.FIELD_REFERENCE, '{'),
        createToken(TokenType.SUBFIELD_TAG, 'lsb'),
        createToken(TokenType.BIT_FIELD, '@(0-7)'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const context = stateMachine.getValidationContext();
      expect(context.shouldValidateAsFieldOption).toBe(false);
      expect(context.shouldValidateAsSubfieldOption).toBe(true);
      expect(context.shouldValidateAsInstructionOption).toBe(false);
      expect(context.context).toBe(ContextState.SUBFIELD_OPTIONS);
    });
    
    test('provides correct instruction option validation context', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':other'),
        createToken(TokenType.INSTRUCTION_TAG, 'testinsn'),
        createToken(TokenType.FIELD_REFERENCE, '('),
        createToken(TokenType.FIELD_REFERENCE, 'operand'),
        createToken(TokenType.FIELD_REFERENCE, ')'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const context = stateMachine.getValidationContext();
      expect(context.shouldValidateAsFieldOption).toBe(false);
      expect(context.shouldValidateAsSubfieldOption).toBe(false);
      expect(context.shouldValidateAsInstructionOption).toBe(true);
      expect(context.context).toBe(ContextState.INSTRUCTION_OPTIONS);
    });
  });
  
  describe('Nesting and Depth Tracking', () => {
    test('tracks brace depth correctly', () => {
      const tokens = [
        createToken(TokenType.FIELD_REFERENCE, '{'),
        createToken(TokenType.FIELD_REFERENCE, '{'),
        createToken(TokenType.FIELD_REFERENCE, '}'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const depth = stateMachine.getNestingDepth();
      expect(depth.braces).toBe(1);
      expect(depth.parens).toBe(0);
    });
    
    test('tracks parentheses depth correctly', () => {
      const tokens = [
        createToken(TokenType.FIELD_REFERENCE, '('),
        createToken(TokenType.FIELD_REFERENCE, '('),
        createToken(TokenType.FIELD_REFERENCE, ')'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const depth = stateMachine.getNestingDepth();
      expect(depth.braces).toBe(0);
      expect(depth.parens).toBe(1);
    });
    
    test('handles nested structures correctly', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_TAG, 'SPR'),
        createToken(TokenType.FIELD_REFERENCE, 'subfields'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.FIELD_REFERENCE, '{'), // Open subfields
        createToken(TokenType.SUBFIELD_TAG, 'nested'),
        createToken(TokenType.FIELD_REFERENCE, '{'), // Nested brace
        createToken(TokenType.FIELD_REFERENCE, '}'), // Close nested brace
        createToken(TokenType.FIELD_REFERENCE, '}'), // Close subfields
      ];
      
      const states: ContextState[] = [];
      const depths: Array<{braces: number; parens: number}> = [];
      
      for (const token of tokens) {
        const state = stateMachine.processToken(token);
        states.push(state);
        depths.push(stateMachine.getNestingDepth());
      }
      
      // Verify depth tracking
      expect(depths[4]?.braces).toBe(1); // After first {
      expect(depths[6]?.braces).toBe(2); // After nested {
      expect(depths[7]?.braces).toBe(1); // After first }
      expect(depths[8]?.braces).toBe(0); // After final }
      
      // Verify we exit subfields context after final }
      expect(states[8]).toBe(ContextState.FIELD_OPTIONS);
    });
  });
  
  describe('Error Recovery and Edge Cases', () => {
    test('handles malformed syntax gracefully', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_REFERENCE, '}'), // Unexpected closing brace
        createToken(TokenType.FIELD_TAG, 'GPR'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      // Should not crash and maintain reasonable state
      const state = stateMachine.getCurrentState();
      expect(state).toBeDefined();
      
      const depth = stateMachine.getNestingDepth();
      expect(depth.braces).toBe(0); // Should not go negative
    });
    
    test('resets state correctly', () => {
      const directive = createToken(TokenType.DIRECTIVE, ':reg');
      const identifier = createToken(TokenType.FIELD_TAG, 'GPR');
      
      stateMachine.processToken(directive);
      stateMachine.processToken(identifier);
      
      expect(stateMachine.getCurrentState()).toBe(ContextState.FIELD_OPTIONS);
      
      stateMachine.reset();
      
      expect(stateMachine.getCurrentState()).toBe(ContextState.UNKNOWN);
      const depth = stateMachine.getNestingDepth();
      expect(depth.braces).toBe(0);
      expect(depth.parens).toBe(0);
    });
    
    test('handles multiline declarations', () => {
      // Simulate tokens that span multiple lines
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg', 0),
        createToken(TokenType.FIELD_TAG, 'SPR', 0),
        createToken(TokenType.FIELD_REFERENCE, 'subfields', 1), // Next line
        createToken(TokenType.FIELD_REFERENCE, '=', 1),
        createToken(TokenType.FIELD_REFERENCE, '{', 1),
        createToken(TokenType.SUBFIELD_TAG, 'lsb', 2), // Another line
        createToken(TokenType.BIT_FIELD, '@(0-7)', 2),
        createToken(TokenType.FIELD_REFERENCE, '}', 3), // Final line
      ];
      
      const states: ContextState[] = [];
      for (const token of tokens) {
        const state = stateMachine.processToken(token);
        states.push(state);
      }
      
      // Should handle multiline correctly
      expect(states[4]).toBe(ContextState.SUBFIELDS_DEFINITION); // {
      expect(states[6]).toBe(ContextState.SUBFIELD_OPTIONS); // @(0-7)
      expect(states[7]).toBe(ContextState.FIELD_OPTIONS); // }
    });
  });
  
  describe('Context Queries', () => {
    test('isInContext method works correctly', () => {
      // Test mask context
      const maskTokens = [
        createToken(TokenType.DIRECTIVE, ':other'),
        createToken(TokenType.INSTRUCTION_TAG, 'test'),
        createToken(TokenType.FIELD_REFERENCE, '('),
        createToken(TokenType.FIELD_REFERENCE, ')'),
        createToken(TokenType.FIELD_REFERENCE, 'mask'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.FIELD_REFERENCE, '{'),
      ];
      
      for (const token of maskTokens) {
        stateMachine.processToken(token);
      }
      
      expect(stateMachine.isInContext('mask')).toBe(true);
      expect(stateMachine.isInContext('subfields')).toBe(false);
      expect(stateMachine.isInContext('operands')).toBe(false);
    });
    
    test('getStateInfo provides comprehensive state information', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_TAG, 'GPR'),
        createToken(TokenType.FIELD_REFERENCE, '{'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const stateInfo = stateMachine.getStateInfo();
      expect(stateInfo.currentState).toBe(ContextState.FIELD_OPTIONS);
      expect(stateInfo.braceDepth).toBe(1);
      expect(stateInfo.parenDepth).toBe(0);
      expect(stateInfo.historyLength).toBe(3);
      expect(stateInfo.lastDirective).toBe(':reg');
    });
  });
  
  describe('Compatibility with Old System', () => {
    test('getRecentContext returns meaningful debug information', () => {
      const tokens = [
        createToken(TokenType.DIRECTIVE, ':reg'),
        createToken(TokenType.FIELD_TAG, 'GPR'),
        createToken(TokenType.FIELD_REFERENCE, 'size'),
        createToken(TokenType.FIELD_REFERENCE, '='),
        createToken(TokenType.NUMERIC_LITERAL, '32'),
      ];
      
      for (const token of tokens) {
        stateMachine.processToken(token);
      }
      
      const recentContext = stateMachine.getRecentContext(3);
      expect(recentContext).toContain('size');
      expect(recentContext).toContain('=');
      expect(recentContext).toContain('32');
    });
  });
});