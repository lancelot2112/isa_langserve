# Enhanced Bus Range Specification

## Overview

This document describes the enhanced bus range primitive design for the ISA language specification. The new design provides cleaner syntax, better semantic clarity, and support for all required bus mapping attributes.

## Bus Range Primitive Syntax

### Basic Structure

```plaintext
:bus <bus_tag> addr=<bits> ranges={
    <space_tag>[;<device_offset>] <bus_range> [prio=<priority>] [redirect=<addr>] [descr="<description>"] [device=<device_tag>]
}
```

### Bus Range Formats

The `<bus_range>` can be specified in two formats:

1. **Range Format**: `<start>--<end>` - Specifies explicit start and end addresses
2. **Size Format**: `<start>_<size>` - Specifies start address and size

### Required Attributes

- **`space_tag`**: References a previously defined memory space from which alignment, address size, word size, and endianness are inherited
- **`bus_range`**: Defines the address range on the bus (using either `--` or `_` format)

### Optional Attributes

- **`device_offset`**: Specifies the starting offset within the target space (follows `;` after space_tag)
- **`prio=<priority>`**: Numeric priority for overlapping ranges (higher values take precedence)
- **`redirect=<addr>`**: Redirection address for address translation/forwarding
- **`descr="<description>"`**: Human-readable description of the bus range
- **`device=<device_tag>`**: Optional device tag reference (for future use)

## Semantic Meaning

### Address Translation Flow

```
Bus Address → Space Selection → Device Offset → Final Address
```

**Example**: `small_flash;0x1080 0x40000400_0x400`
- Bus addresses `0x40000400` to `0x400007FF` map to `small_flash` space
- Accesses start at device offset `0x1080` within the `small_flash` space
- Bus address `0x40000400` → `small_flash[0x1080]`
- Bus address `0x40000500` → `small_flash[0x1180]`

### Space Property Inheritance

Each bus range inherits properties from its referenced space:
- **Alignment**: Memory alignment requirements
- **Address size**: Device addressable range
- **Word size**: Basic word size for the space
- **Endianness**: Byte ordering for multi-byte accesses

## Examples

### Complete Bus Definition

```plaintext
:space small_flash addr=32 word=32 type=ro align=12 endian=big
:space large_flash addr=32 word=32 type=ro align=12 endian=big
:space ram addr=32 word=32 type=rw align=16 endian=big
:space etpu addr=16 word=24 type=memio align=16 endian=big

:bus sysbus addr=32 ranges={
    small_flash 0x0--0x3FFFF descr="Boot ROM"
    large_flash 0x800000_0x800000 descr="Application Flash"  
    ram 0x40000000_0x80000 descr="Main System RAM"
    small_flash;0x1080 0x40000400_0x400 prio=1 descr="Flash shadow in RAM"
    etpu 0xC3F80000_0x10000 descr="Enhanced Timer Processing Unit"
    ram 0x50000000_0x1000 redirect=0x40000000 descr="RAM alias/mirror"
}
```

### Range Format Comparison

```plaintext
# Equivalent range specifications
large_flash 0x800000--0xFFFFFF descr="Application Flash (range format)"
large_flash 0x800000_0x800000 descr="Application Flash (size format)"

# Both define the same 8MB address range from 0x800000 to 0xFFFFFF
```

### Priority Handling

```plaintext
:bus sysbus addr=32 ranges={
    ram 0x40000000_0x100000 descr="Main RAM block"
    small_flash;0x1000 0x40000400_0x800 prio=1 descr="Flash window in RAM space"
    special_device 0x40000600_0x100 prio=2 descr="High priority device overlay"
}
```

In this example:
- RAM covers `0x40000000` to `0x400FFFFF`
- Flash overlays `0x40000400` to `0x40000BFF` with higher priority
- Special device overlays `0x40000600` to `0x400006FF` with highest priority

## Validation Rules

### Range Validation

1. **Range format**: For `<start>--<end>`, validate `end >= start`
2. **Size format**: For `<start>_<size>`, validate `size > 0`
3. **Bus limits**: All ranges must fit within the bus address space defined by `addr=<bits>`
4. **Device offset**: Must fit within the target space size when specified

### Reference Validation

1. **Space existence**: `space_tag` must reference a previously defined memory space
2. **Priority conflicts**: Overlapping ranges should have different priorities
3. **Redirect addresses**: Must be valid addresses within the bus address space

### Semantic Validation

1. **Address alignment**: Bus ranges should respect target space alignment requirements
2. **Size compatibility**: Range sizes should be compatible with target space constraints
3. **Device offset bounds**: Device offsets must not exceed target space size

## Benefits Over Previous Design

### Improved Readability

- **Space-first syntax**: More intuitive reading flow
- **Clear range specification**: `--` and `_` operators make intent obvious
- **Semantic redirection**: `;` operator clearly indicates device offset

### Enhanced Functionality

- **Complete attribute support**: All required attributes are supported
- **Flexible range specification**: Choose the most natural format for each case
- **Priority-based overlaps**: Explicit priority handling for complex memory maps

### Better Maintainability

- **Visual organization**: Related space mappings group together
- **Descriptive capability**: Built-in description field for documentation
- **Future extensibility**: Device tag support for future enhancements

## Migration from Previous Syntax

### Old Syntax
```plaintext
0x40000400->small_flash buslen=0x400 offset=0x1080 prio=1
```

### New Syntax
```plaintext
small_flash;0x1080 0x40000400_0x400 prio=1 descr="Flash shadow"
```

The new syntax is more concise while providing the same functionality plus additional descriptive capability.
