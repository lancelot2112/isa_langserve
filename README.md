# ISA Language Server

A complete Language Server Protocol implementation for declarative Instruction Set Architecture definition files, providing VS Code integration with syntax highlighting, validation, and intelligent editing features.

## Overview

This project implements a comprehensive tooling solution for describing computer systems using a declarative text-based format. It supports multiple file types for different aspects of system architecture:

- **`.isa`** - Core Instruction Set Architecture definitions
- **`.isaext`** - Extensions to existing ISA definitions  
- **`.coredef`** - CPU core definitions that combine ISAs with core-specific features
- **`.sysdef`** - Complete system definitions that combine multiple cores and subsystems

## Features

### Language Server Protocol Support
- **Syntax Highlighting** - Context-aware semantic highlighting with customizable color schemes
- **Real-time Validation** - Comprehensive error checking and warnings
- **Code Folding** - Collapsible context windows and subcontexts
- **Hover Information** - Detailed information on symbols and constructs
- **Symbol Navigation** - Jump to definitions and find references

### Comprehensive Validation
- **Syntax Validation** - Malformed directives, invalid numeric literals, missing attributes
- **Semantic Analysis** - Undefined references, bit range validation, conflicting definitions
- **Cross-file Validation** - Proper validation of extensions and includes across file boundaries

## File Format Overview

### Basic Structure

All files use a context-based structure where directives (starting with `:`) define different sections:

```isa
# Global parameters
:param ENDIAN=big
:param REGISTER_SIZE=32

# Define memory spaces
:space reg addr=32 word=64 type=register
:space ram addr=64 word=32 type=rw

# Define registers in the register space
:reg GPR count=32 name=r%d reset=0
:reg PC size=64 offset=0x0

# Define instruction format
:space insn addr=32 word=32 type=rw
:insn subfields={
    opc6 @(0-5) op=func
    rD @(6-10) op=target|reg.GPR
    rA @(11-15) op=source|reg.GPR
}

# Define specific instructions
:insn add (rD,rA,rB) mask={opc6=0b011111} descr="Add two registers"
```

### Key Concepts

#### Memory Spaces
Define logical address spaces with specific properties:
- **Address size** - How many bits are used for addressing
- **Word size** - Natural word size for the space
- **Type** - `rw` (read/write), `ro` (read-only), `register`, `memio`
- **Alignment** - Default alignment requirements

#### Fields and Registers
Define data structures within memory spaces:
- **Simple fields** - Single registers or memory locations
- **Register files** - Arrays of registers with naming patterns
- **Aliases** - Alternative names for existing fields
- **Subfields** - Bit-level subdivisions of fields

#### Bit Field Specifications
Powerful bit manipulation syntax using `@(...)`:
- **Single bits**: `@(5)` - bit 5
- **Bit ranges**: `@(0-7)` - bits 0 through 7
- **Concatenation**: `@(0-3|8-11)` - bits 0-3 concatenated with bits 8-11
- **Literal padding**: `@(16-29|0b00)` - bits 16-29 with literal '00' appended
- **Sign extension**: `@(?1|16-29|0b00)` - sign-extended based on bit patterns

#### Instructions
Define machine instructions with their operands and matching patterns:
- **Operand fields** - Which bit fields contain operand information
- **Mask patterns** - Fixed bit patterns that identify the instruction
- **Semantic descriptions** - Optional behavioral descriptions

### Numeric Formats

The language supports multiple numeric formats:
- **Decimal**: `42`, `1024`
- **Hexadecimal**: `0xFF`, `0x1000`
- **Binary**: `0b1010`, `0b11110000`
- **Octal**: `0o777`, `0o123`

### Comments and Documentation

```isa
# Single-line comments start with #
:reg GPR count=32 name=r%d descr="General Purpose Registers"
```

## Example Files

The repository includes comprehensive examples:

- [`examples/valid-file.isa`](examples/valid-file.isa) - Complete ISA definition
- [`examples/bit-field.isa`](examples/bit-field.isa) - Bit field manipulation examples
- [`examples/alias.isa`](examples/alias.isa) - Register aliasing examples
- [`examples/valid-core1.coredef`](examples/valid-core1.coredef) - Core definition example
- [`examples/valid-sys.sysdef`](examples/valid-sys.sysdef) - System definition example

## Advanced Features

### Space Indirection
Reference fields across different memory spaces using the `$` operator:
```isa
$[space_tag]->[field_tag].[subfield_tag]
```

### Bus Definitions
Define memory mapping between different address spaces:
```isa
:bus sysbus addr=32 ranges={
    0x0->flash buslen=0x40000
    0x40000000->ram buslen=0x80000
    0xC3F80000->mmio buslen=0x10000
}
```

### Extension Files
Create modular extensions that build on base ISA definitions:
```isa
# In base.isa
:space reg addr=32 word=32 type=register
:reg GPR count=16 name=r%d

# In extension.isaext  
:reg FPR count=32 name=f%d descr="Floating Point Registers"
```

## Development

### Project Structure
```
├── client/          # VS Code extension (TypeScript)
├── server/          # Language server implementation (TypeScript) 
├── examples/        # Example ISA files
├── spec/           # Language specification
└── themes/         # Syntax highlighting themes
```

### Building
```bash
# Install dependencies
npm install

# Build both client and server
npm run build

# Run tests
npm test
```

### Testing
The project includes comprehensive test coverage:
- Unit tests for parsing and validation logic
- Integration tests using example files
- VS Code extension testing framework

## VS Code Extension

Install the extension to get full IDE support:
- Syntax highlighting with semantic colors
- Real-time error checking and warnings  
- Code folding for context windows
- Hover information and symbol navigation
- Intelligent autocompletion

## Contributing

1. Review the [language specification](spec/isa_language_specification.md)
2. Check existing [example files](examples/) for patterns
3. Add tests for new features
4. Follow the established code organization patterns

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Technical Details

### Language Server Protocol
Implements LSP 3.17.0 with full support for:
- Diagnostics (errors, warnings, hints)
- Semantic highlighting with token-based coloring
- Document symbols and workspace symbols
- Hover providers with detailed information
- Folding ranges for context windows

### Parser Architecture
- **Tokenizer** - Context-aware lexical analysis
- **Recursive descent parser** - Handles nested contexts and subcontexts
- **Symbol table** - Tracks definitions across scopes and files
- **Semantic analyzer** - Validates references and constraints
- **Diagnostic engine** - Generates helpful error messages

The tooling is designed for extensibility and can be adapted for other domain-specific languages with similar declarative patterns.