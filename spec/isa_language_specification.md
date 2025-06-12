# .isa File Format Specification (Revised)

## 1. Introduction
This specification defines a series of files used to describe a full system of interacting cores, memories, and bus accesses.  The format is text-based and declarative and aims to be human-readable and parsable for use in emulators, disassemblers, and other CPU modeling tools.

## 2. File Types
The `.isa` file format is designed to describe the Instruction Set Architecture (ISA) of a processor. This includes definitions for memory spaces, register files, register fields, instruction fields, and instruction opcodes/formats.

`.isaext` files allow extensions to or additions to other `.isa` or `.isaext`.  This means that the file may use symbols that are defined in other files.  `.isaext` will need special consideration as far as linting and error reporting since it doesn't explicitly include the other files itself.

`.core` files include a base `.isa` and any number of `.isaext` plus can add extensions to the isa that are core specific.  These files should also be validated per the isa standard but include the context of the included files.  These files can define core specific logic and fields using the isa standard. Linting this file is where `.isaext` should be validated against the context of the other files included.

`.sys` files contain a list of `.core` files also using a sys file specific `:attach` command.  Other isa file contructs are also valid however each `.core` file creates its own context.  These files can define system specific logic and fields using the isa standard.

## 3. Validation and Error Handling
### 3.1 General Validation Rules

- All numeric literals must conform to the specified formats
- Field names and space tags must be unique within their scope
- Bit indices must be within the valid range for their container
- References to fields, spaces, and subfields must be to previously defined entities (special consideration for `.isaext` files)

### 3.2 Error Types

- **Syntax Errors**: Malformed directives, invalid numeric literals, missing required attributes, unclosed contexts and subcontexts
- **Semantic Errors**: References to undefined entities, bit indices out of range, conflicting definitions
- **Warning Conditions**: Overlapping field ranges, unused definitions

### 3.3 Error Reporting

The linter should provide clear error messages with:
- Line number and column position
- Description of the error
- Suggestion for correction when possible


## 4. Color Scheme and Highlighting

A color scheme settings file will be provided that allows configuring colors for various parts of the language. Default colors are specified throughout this document for specific parts of the syntax and can be customized.  Coloring should be context aware and use the tokenizer.

## 5. General Syntax

Linting and coloring should both utilize a common tokenization scheme and avoid regex pattern matching.

### 5.1 Simple Types

#### 5.1.1 **Numeric Literals**: A literal defining a number that must use one of these formats:
  - **Hexadecimal**: `0x` followed by valid hex digits (0-9, a-f, A-F)
  - **Binary**: `0b` followed by valid binary digits (0-1)
  - **Octal**: `0o` followed by valid octal digits (0-7)
  - **Decimal**: Plain decimal digits (0-9)

  Any detected numeric literal is highlighted (default: `tan with a hint of green`).

#### 5.1.2 **Comments**: Anything after a `#` character in any line is a comment and should be ignored for linting. Comments are highlighted (default: `green`).

#### 5.1.3 **Quoted Strings**: Values containing spaces or special characters should be enclosed in double quotes (e.g., `"User mode"`). Strings are highlighted (default: `orange`).

#### 5.1.4 **Single Word**: Can contain upper and lower case letters, numbers, hyphens, underscores, periods.

#### 5.1.5 **Bit Field**: Start with the `@` symbol and includes anything enclosed in the parenthesis just after `@(<bit_field>)`. For details see "Bit Specification Details".

##### 5.1.5.1 Bit Specification Details (`@(...)`)

Bit specifications are used in field definitions and instruction definitions. They define how a field maps to bits within a container (register or instruction word). The `containerSize` (from `:<space_tag> <field_tag> size=` or `:<space_tag> <instruction_tag> size=`) is the total width for bit numbering.

##### 5.1.5.2 Bit Numbering

- **Convention**: Assumed to be MSB 0 (Most Significant Bit is bit 0). Bit `N` refers to the Nth bit from the MSB.
- **Interpretation**: For a container of `W` bits (e.g., a 32-bit instruction), bit 0 is the MSB and bit `W-1` is the LSB.

##### 5.1.5.3 Syntax Forms

**Single Bit**:
- `@(<bit_index>)`: A single bit.
- Example: `AA?a @(30)` refers to bit 30.

**Bit Range**:
- `@(<start_bit>-<end_bit>)`: A contiguous range of bits, inclusive. `start_bit` is typically the more significant bit index.
- Example: `rA @(11-15)` refers to bits 11 through 15.
- Length of this segment is `end_bit - start_bit + 1`.

##### 5.1.5.4 Concatenation

**Multiple Segments**:
- `@(<spec1>|<spec2>|...)`: Multiple bit segments are extracted and concatenated in order to form the field's value.
- Example: `DCRN @(16-20|11-15)` takes bits 16-20, then appends bits 11-15.

**Literal Padding**:
- `@(<spec>|0b<binary_digits>)`: A bit segment is concatenated with literal binary digits.
- Example: `BD @(16-29|0b00)` takes bits 16-29 and appends `00` as the two least significant bits.

**Sign Extension**:
- `@(?<0 or 1>|<spec1>|<spec2>)` implies either 0 extending or sign extending.
- Example: `BX @(?1|16-29|0b00)` where bits 16-29 are set to 0x1FFF (bit16 being 1) will result in a value of 0xFFFFFFFC where the bits are sign extended to the left (assuming bit16 is the sign bit) and bits 00 are padded to the LSB.

##### 5.1.5.5 Field Value Interpretation

When concatenating, segments are shifted and ORed together to form the final field value. A field `@(S-E)` (where S is the MSB index, E is the LSB index of the field part) extracts bits from S to E.

### 5.2 Basic Language Constructs

#### 5.2.1 Contexts
- **Context Windows**: Each line starting with a `:<directive>` begins a new context window. Every line after the directive (until a new directive is declared) is within the context window. Directive context windows will never be nested.  The lines between two `:` directives should be able to be folded.

- **Subcontext Windows**: Subcontext windows can be opened up by:
  - An individual option tag `<optiontag>={muli-line optiontag context window}` using braces `{}`
  - Bit fields starting with the `@` tag `@(single line bitfield context window)` using `()`
  - Function declarations/calls `<functiontag><any number of spaces including 0>(multi-line function argument context window)` using `()`

  Each subcontext shall use the default linting and coloring rules unless explicitly overridden by requirements later in this document. Subcontext boundary characters `()` and `{}` shall be highlighted with a different color for each nesting level.

#### 5.2.2 Directives
- **Directives**: Directives start with a colon (`:`) followed by a directive keyword
  - **Basic Directives**: `:param` defines a parameter, `:space` defines a logical space, `:bus` defines a connection between spaces. Previously listed basic directives including the colon are highlighted (default: `blue gray`). Invalid directives will remain default text color.
  - **Space Directives**: Every `:space <space_tag>` defines a new `space declaration` directive which can be accessed by `:<space_tag>` anytime after a space is defined to declare named/typed `fields` or `instructions` within the space using `:<space_tag> <field_tag>` or `:<space_tag> <instruction_tag>`.

  `fields` and `instructions` will have their own unique linting requirements. Each `<space_tag>` shall get its own color. Space directives including the colon, field tags, and function tags, are highlighted according to the assigned color of the parent `<space_tag>`. Use of invalid tags and space directives (not previously defined in the file) shall remain the default text color and indicate an error.
  - **Core File Directives**: `:include` includes `.isa` and `.isaext` files that the core uses
  - **System File Directives**: `:attach` attaches cores to the system by referencing `:core` files

#### 5.2.3 References
- **Scoped Reference**: Each space contains a number of `field` or `instruction` declarations that are valid for reference by tag inside that space.  To change the scope to that space one can use the `space directive` indicating we are going to declare a field or instruction in that space.  
- **Context Reference**: Hierarchical references use the context operator (`;`) for all field and space indirection:
  - **Field-Subfield References**: `field;subfield` (e.g., `spr22;lsb`)
  - **Space Indirection**: `$space;field` or `$space;field;subfield` (e.g., `$reg;spr22;lsb`)
  - **Context Operator Semantics**: The semicolon (`;`) creates a left-to-right evaluation chain where each element is resolved within the context of the preceding element

#### 5.2.4 Context Reference Grammar

The context operator (`;`) provides a unified syntax for hierarchical references:

```
context_reference := base_context (';' context_element)*
base_context      := space_reference | identifier  
context_element   := identifier
space_reference   := '$' identifier
```

**Examples**:
- `spr22;lsb` - subfield `lsb` within field `spr22`
- `$reg;spr22` - field `spr22` within space `reg`
- `$reg;spr22;lsb` - subfield `lsb` within field `spr22` within space `reg`

**Tokenization**: The semicolon (`;`) is treated as a distinct operator token, allowing periods (`.`) to be used freely within identifier names without ambiguity.
 
## 6. Global Parameters (`:param`)

Defines global parameters for the ISA.

- **Syntax**: `:param <NAME>=<VALUE>`
- **Value Validation**:
  - `<VALUE>` must be either a **numeric literal** or a **single word**
- **Example**:
  ```plaintext
  :param ENDIAN=big
  :param REGISTER_SIZE=32
  :param CACHE_SIZE=0x8000
  :param FLAGS=0b1101
  :param BASE_ADDR=0o777
  ```
- **Default Parameters**:
  - `ENDIAN`: Specifies the default endianness (`big` or `little`)
  - `REGISTER_SIZE`: Specifies a default register size in bits (though individual registers or spaces can override this)

## 7. Logical Memory Spaces (`:space`)

Defines logical address spaces, such as RAM, register banks, or memory-mapped I/O.

- **Syntax**: `:space <space_tag> [addr=<bits>] [word=<bits>] [type=<SpaceType>] [align=<bytes>] [endian=<Endianness>]`
- **Attributes**:
  - `<space_tag>`: Unique name for the space (e.g., `ram`, `reg`). Each `<space_tag>` shall get its own assigned color.
  - `addr=<bits>`: **REQUIRED** - Size of addresses within this space in bits. Must be a valid numeric literal (1-128 bits recommended).
  - `word=<bits>`: **REQUIRED** - Natural word size for this space in bits. Must be a valid numeric literal (1-128 bits recommended).
  - `type=<SpaceType>`: **REQUIRED** - Type of the space. Valid values:
    - `rw`: General read/write memory space
    - `ro`: Read only memory space
    - `memio`: Memory-mapped I/O space
    - `register`: CPU register space
  - `align=<bytes>`: **OPTIONAL (default=16)** - Default alignment for accesses in this space in bytes. Must be a valid numeric literal.
  - `endian=<Endianness>`: **OPTIONAL (default=big if ENDIAN is not defined)** - Endianness for this space (`big` or `little`), overrides global `:param ENDIAN`.
- **Numeric Literal Validation**: All numeric values (`addr`, `word`, `align`) must be a valid **numeric literal**
- **Example**:
  ```plaintext
  :space ram addr=64 word=32 type=rw align=16 endian=big
  :space reg addr=0x20 word=0b1000000 type=register
  :space mmio addr=0o100 word=32 type=memio
  ```

## 8. Memory Mapped Connections Between Memory Spaces (`:bus`)

Addressing within a memory space typically always starts at 0x0 and ends at the size of the space. However this leads to overlaps between spaces. The bus allows setup of `bus address ranges` which point to different memory spaces.

- **Syntax**: `:bus <bus_tag> addr=<bits> ranges={ range definitions }`
- **Options**:
  - `bus_tag`: Defines the tag to access the bus by name, must be a **single_word**
  - `addr=<bits>`: Defines address size, must be a valid **numeric_literal**
  - `ranges={ range definitions }`: Defines a series of addresses mapping a named `<space_tag>`

- **Range Definitions**:
  - List of `[<bus_address>]->[<space_tag>] [prio=<numeric_literal>] [offset=<numeric_literal>] [buslen=<numeric_literal>]` definitions on separate lines
  - **REQUIRED** `bus_address` must be a valid **numeric_literal** and within the defined address size of the bus
  - **REQUIRED** `space_tag` must be a previously defined `space_tag`. Each tag should be colored per the previously assigned `space_tag` color
  - **OPTIONAL** `prio=<numeric_literal>`: must be a valid numeric_literal and defines relative priority on any overlapping ranges. A larger lower priority ranges could have holes punched in it with higher priority ranges taking over specific sub ranges
  - **OPTIONAL** `offset=<numeric_literal>`: must be a valid numeric_literal and defines the starting offset inside the space for this bus definition. If not provided will default to 0
  - **OPTIONAL** `buslen=<numeric_literal>`: must be a valid numeric_literal and defines the mapped range of the space on the bus address space

- **Example**:
  ```plaintext
  :space small_flash addr=32 word=32 type=ro align=12 endian=big
  :space large_flash addr=32 word=32 type=ro align=12 endian=big
  :space ram addr=32 word=32 type=rw align=16 endian=big
  :space etpu addr=16 word=24 type=memio align=16 endian=big

  :bus sysbus addr=32 ranges={
      0x0->small_flash buslen=0x40000
      0x800000->large_flash buslen=0x800000
      0x40000000->ram buslen=0x80000
      0x40000400->small_flash buslen=0x400 offset=0x1080 prio=1 # flash image in ram space
      0xC3F80000->etpu buslen=0x10000
  }
  ```

## 9. Declarations Inside a Memory Space

After defining a memory space, you can use the space name as a command to define `fields` or `instructions` within that space using the syntax `:<space_tag> <field_tag|instruction_tag>`.

### 9.1 Field Definition (`:<space_tag> <field_tag>`)

`field_tag` must be a `single_word` (e.g., `GPR`, `XER`, `CR`) and will be used as the `field_name` when `name` option is not provided. If `count` is provided and is >1 and the `name=` option is not provided then `field_name` shall be `<field_tag>%d` where the %d is replaced by the index of the field. `field_tag` needs to be colored the same as the encompassing `space_tag`.

#### 9.1.1 Syntax Forms

There are several ways to define fields:

**New Field Definition**:
```
:<space_tag> <field_tag> [offset=<numeric_literal>] [size=<bits>] [count=<number>] [reset=<value>] [name=<format>] [descr="<description>"] [subfields={list of subfield definitions}]
```

**New Field Options**:
- **OPTIONAL** `offset=<numeric_literal>`: Base offset within the memory space. Must be valid numeric literal that fits within an address of the defined space. If not provided shall start just after the previously defined field. Offsets can overlap previously defined field ranges however a warning shall be provided.
- **OPTIONAL** `size=<numeric_literal>`: Total size in bits. Must be > 0 and ≤ 512 bits. Must be valid numeric literal. Defaults to `word` size of the parent space.
- **OPTIONAL (default=1)** `count=<numeric_literal>`: Number of registers in the file (for register arrays). Must be valid numeric literal >=1. Default = 1.
- **OPTIONAL** `name=<format>`: Unquoted printf-style format for naming fields (e.g., `name=r%d` creates `r0`, `r1`, `r2`...) Creates a list of `field_name`s of the `field_tag` type offsetting each one from the `offset` by the `size` option times the index of the `field_name`. The `%d` is replaced with indices from 0 to count-1. `<format>` shall be colored the same as the encompassing `space_tag`.
- **OPTIONAL** `reset=<numeric_literal>`: Reset value (default 0 if not provided). Must be valid numeric literal. Default = 0.
- **OPTIONAL** `descr="<description>"`: Textual description.

**Redirect Definition**:
```
:<space_tag> <field_tag> [redirect=<context_reference>] [descr="<description>"] [subfields={list of subfield definitions}]
```

Redirects take on the offset and size of the other field_tag or subfield referenced in the redirect option_tag.

**Redirect Field Options**:
- **REQUIRED** `redirect=<context_reference>`: References a previously defined field using context operator syntax (e.g., `field;subfield` or `$space;field;subfield`). This creates a new `field_name` that maps to the same memory offset and bits.
- **OPTIONAL** `descr="<description>"`: Textual description.

**Appending Subfield Definitions**:
```
:<space_tag> <previously defined field_tag> [subfields={list of subfield definitions}]
```

Appending subfield definitions can happen any time after initial field_tag definition.

**Untagged Subfield Definitions**:
```
:<space_tag> [size=<numeric_literal>] [subfields={list of subfields}]
```

Subfields defined in untagged fields do not have a memory space and can be referenced elsewhere.

**Untagged Subfield Options**:
- **OPTIONAL** `size=<numeric_literal>`: Total size in bits. Must be > 0 and ≤ 512 bits. Must be valid numeric literal. Defaults to `word` size of the parent space.
- **REQUIRED** `subfields={list of subfields}` see Section 7.1.2 below

#### 9.1.2 Subfields

Each subfield definition shall occur within a `subfields={}` option tag context window. Only one subfield definition shall be on a line and following the following format:

**Syntax**: `<subfield_tag>[?<postfix>] @(<bit_spec>)[|<bit_spec>...] [op=<type>[.<subtype>][|<type>...]] [descr="<description>"]`

**Subfield Components**:
- **REQUIRED** `<subfield_tag>`: Unique name for the subfield (e.g., `AA`, `BD`, `rA`). `subfield_tag` shall be highlighted/colored the same as the encompassing `space_tag`.
- **OPTIONAL** `?<postfix>`: Optional single-character postfix (e.g., `?a`, `?l`). If present, `op` often includes `func`. This postfix can be appended to the `field_name` or `instruction_name` during disassembly (e.g., `b` + `LK?l` -> `bl`) if bit is set. Anything with a postfix needs to be a single bit.  The postfix portion including the ? is not part of the `<subfield_tag>`.
- **REQUIRED** `@(<bit_field>)`: Bit specification for the field within a field (see "Bit Specification Details" in Section 8).
  - Example: `DCRN @(16-20|11-15)` means bits 16-20 are concatenated with bits 11-15 to form the `DCRN` field.
- **OPTIONAL** `op=<type>[.<subtype>][|<type>...]`: Defines the operational type and properties of the field. Multiple types can be OR'd using `|`.
  - `imm`: Immediate values are right shifted (e.g., `@(16-19)`=0x0000F000 will be right shifted to display 0xF).
  - `ident`: Immediate value represents a field identifier (may be operation specific).
  - `<space_tag>`: Field accesses another space somehow
    - `<space_tag>.<field_tag>`: Field identifies or accesses another field in another space somehow. Example: this is an instruction that accesses registers in a register file GPR by id (value of 1 access GPR1, value of 5 accesses GPR5, etc.).
    - `<space_tag>.SPR`: Field by index into the SPR field_tag (example subtype).
  - `addr`: Field is an address.
  - `source`: Field is a source operand, mutually exclusive with `target`.
  - `target`: Field is a target operand, mutually exclusive with `source`.
  - `func`: Field is part of the functional opcode (distinguishes instructions).
- **OPTIONAL** `descr="<description>"`: Textual description of the field.

#### 9.1.3 Field Validation Rules

- **Simple Types**: All simple types must have a valid format and value according to the simple type.
- **Redirect Mutual Exclusivity**: `redirect` cannot be used with `offset`, `size`, `count`, `name`, or `reset`
- **Field Name Tracking**: Generated field_names (from name or field_tag if no name provided) are tracked for later redirect validation or access.
- **Size Limit**: `size` must be ≤ 512 bits and > 0 bits
- **Range Validation**: The start and end offset shall be tracked to check for overlaps. Redirects can overlap without warning but new fields shall generate a warning if they overlap.
- **Bitfield Numbering**: Bit indices shall be in the range 0..size-1 of the field definition with 0 being the most significant bit and size-1 being the least significant.

#### 9.1.4 Field Examples

```plaintext
:space reg addr=32 word=64 type=register

# Simple register definition
:reg PC size=64 offset=0x0 reset=0x0

# Register file with count and name
:reg GPR offset=0x100 size=64 count=32 name=r%d reset=0
# This creates: r0, r1, r2, ..., r31

# Register redirect (mutually exclusive with other options except description)
:reg SP redirect=r1
:reg SP2 redirect=r2 descr="Special Purpose 2"

# Declaring subfields
:reg XER offset=0x200 size=32 reset=0x0 subfields={
    SO @(0) descr="Summary Overflow"
    OV @(1) descr="Overflow"
    CA @(2) descr="Carry"
}

:space insn addr=32 word=32 type=rw

# Untagged subfield definitions for instructions
:insn subfields={
    AA?a @(30) op=func descr="Absolute Address flag, bit 30"
    BD @(16-29|0b00) op=imm descr="Displacement, bits 16-29, padded with 00b"
    rA @(11-15) op=reg.GPR descr="Register A, bits 11-15, is a GPR"
    opc6 @(0-5) op=func descr="Primary 6-bit opcode field, bits 0-5"
}

:insn size=16 subfields={
    AA16?a @(14) op=func # inline comment
    # error_bitidx @(20) # should provide error because maximum bit index is 15 in this space
}
```

### 9.2 Instruction Definition (`:<space_tag> <instruction_tag>`)

Defines individual machine instructions, their mnemonics, operand fields, and matching criteria (mask).

**Syntax**: `:<space_tag> <instruction_tag> (<field1>,<field2>,...) [mask={<MaskSpecification>}] [descr="<description>"] [semantics={ <SemanticsBlock> }]`

**Attributes**:
- `<instruction_tag>`: The assembly mnemonic for the instruction (e.g., `add`, `b`, `cmpi`).
- `(<field1>,<field2>,@(bit_field)...)`: Comma-separated list of fields (defined earlier in an untagged field definition of the same size) or anonymous bit fields that this instruction uses as operands for its operation.
- `mask={<MaskSpecification>}`: Defines the fixed bit patterns used to identify this instruction.
  - The specification is a set of `name=value` or `@(bit_range)=value` pairs separated by spaces or new lines.
  - `name` refers to a field defined in subfields.
  - `@(bit_field)` refers to an anonymous bit field (see "Bit Specification Details").
  - `value` can be binary (e.g., `0b011111`), decimal (e.g., `0`), or hexadecimal (e.g., `0x1F`). This indicates the expected immediate value of the bitfield and is used to match bit patterns to differentiate instructions when disassembling.
  - Multiple mask entries are effectively ANDed together. They can be on the same line separated by spaces, or on multiple lines within the `{}`.
- `descr="<description>"`: Textual description of the instruction.
- `semantics={ <SemanticsBlock> }`: (Future Use) A block intended for Register Transfer Language (RTL) or other semantic descriptions for emulation. Currently not fully parsed/utilized.

**Example**:
```plaintext
:space insn word=32 addr=32 type=rw align=16 endian=big
:space reg word=64 addr=32 type=register align=64 endian=big

:reg GPR count=32 name=r%d

:insn size=32 subfields={
    opc6 @(0-5) op=func
    rD @(6-10) op=target|reg.GPR
    rA @(11-15) op=source|reg.GPR
    rB @(16-20) op=source|reg.GPR
    OE?o @(21) op=func
    Rc?. @(31) op=func
}

:insn add (rD,rA,rB) mask={opc6=0b011111 OE=0 @(22-30)=0b100001010 Rc=0} descr="Add"
    semantics={ rD = rA+rB }
:insn addi (rD,rA,SIMM) mask={opc6=0b001110} descr="Add Immediate"
:insn b (LI,AA,LK) mask={opc6=0b010010} descr="Branch"
```

## 10. Core File Specifics (`.core`)
### 10.1 Include Directive (`:include`)
This file adds a command `:include` which will point to an `.isa` or `.isaext` file elsewhere in the filesystem and include their contexts in the root context per the isa standard.   Linting this file is where missing symbols in `.isaext` should or symbol conflicts should be validated.

## 11. System File Specifics (`.sys`)
### 11.1 Attach Directive (`:attach`)
`:attach <context-tag> <filepath>`

## 12. Glossary

- **Context Window**: A section of the file that begins with a directive and continues until the next directive
- **Space Tag**: A unique identifier for a memory space (e.g., `ram`, `reg`)
- **Field Tag**: A unique identifier for a field within a space
- **Subcontext**: A nested section within a context window, delimited by `{}` or `()`
- **Bit Field**: A specification of which bits within a container are used for a field
- **Numeric Literal**: A number specified in decimal, hexadecimal, binary, or octal format
