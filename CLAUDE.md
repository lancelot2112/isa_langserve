# Overview
Contains a specification for a declarative technical language to describe Instruction Set Architectures `.isa` and `.isaext`, cores that run that ISA `.coredef` and systems that combine multiple cores and other subsystems `.sysdef`.  
- Technical requirements are in the [`spec\isa_language_specification.md`](..\spec\isa_language_specification.md)

## Example Focused Files (good and bad examples described in comments)
- Example file with focus on Alias [`examples\alias.isa`](examples\alias.isa)
- Example file with focus on Single Words [`examples\single-word.isa`](examples\single-word.isa)
- Example file with focus on Bit Fields [`examples\bit-field.isa`](examples\bit-field.isa)
- Example file with focus on unnamed field/subfields [`examples\unnamed-field.isa`](examples\unnamed-field.isa)

## Example System Definition Files
- Example valid .isa file [`examples\valid-file.isa`](examples\valid-file.isa)
- Example valid .isaext file [`examples\valid-extension.isaext`](examples\valid-extension.isaext)
- Example valid .coredef file [`examples\valid-core1.coredef`](examples\valid-core1.coredef)
- Another example valid .coredef file [`examples\valid-core2.coredef`](examples\valid-core2.coredef)
- Example valid .sysdef file [`examples\valid-sys.sysdef`](examples\valid-sys.sysdef)

## Key Features to Implement
- Language Server implementing the Language Server Protocol 3.17.0 for our files
- Visual Studio Extension implementing a language client extension to mediate between vscode and our language server

## Development Guidelines
- Document changes to the language spec first before any logic is written
- Isolate logical concerns into different files with descriptive names
- Add a brief description of the file scope to the top of each file
- Ensure proper cleanup of resources in the extension lifecycle
- When using npm prefer running `npm install <name>` instead of adding name and version directly into package.json

## Testing and validation
- Ensure comprehensive test coverage for all features
- Run all tests from a single command and generate an easy to read test report
- Use the example files as test cases and assert the specific cases mentioned in comments

## Structure
- `.\specs` Technical specification for the requested linting and highlighting
- `.\examples` Example files of the target language
- `.\server` Language server implementing the Language Server Protocol (JSON RPC 2.0)
- `.\client` Client that talks to the language server via (JSON RPC2.0) and mediates vscode and the language server. Use `.\server\CLIENT-GUIDE.md` to understand the server implementation details.