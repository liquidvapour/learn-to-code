# Tiny Machine instruction reference

Development reference for the complete initial instruction set, including instructions not yet implemented. The intended scope comes from [the product design](tiny-machine-design.md#instruction-set); implementation steps live in [plan.md](plan.md). The in-app [instruction reference](src/InstructionDocs.tsx) describes supported behaviour for learners.

The Implemented column indicates availability through both the machine core and source parser. For entries marked No, syntax and behaviour describe intent and may still have open decisions. Keep this document current when implementing an instruction.

## Machine and source conventions

- Four unsigned byte registers: `R0`, `R1`, `R2`, `R3`, initially zero.
- 256 memory bytes at addresses `0`–`255`, initially zero. Stack and ordinary data share this memory; no separate regions are enforced yet.
- `PC` starts at `0` and indexes instructions, excluding blank and comment-only source lines. Instructions are separate from data memory.
- `SP` starts at `256` (empty stack). The stack grows downward; after a push, `SP` points to the top byte.
- `ZF` starts false (`0`). Currently only `ADD` updates it.
- One instruction per line; blank lines are ignored. Instructions and register names are case-insensitive. Whitespace is flexible; two operands require a comma.
- Values and memory addresses in source use decimal integers from `0` to `255`. Hex literals and labels are not supported.
- A semicolon (`;`) starts a comment extending to the end of the line, with or without preceding whitespace. Comments may follow instructions or occupy a whole line. Comment-only lines do not produce instructions or advance `PC`. Original source text and line numbers are preserved for display and errors.
- The whole program must parse successfully before execution. Unsupported instructions are rejected, including the planned instructions below.
- Every supported instruction advances `PC` by one, including `HALT`. Reaching the end without `HALT` is reported as program completion by the interface.

## Complete instruction set

`destination` and `source` mean registers; `value` is an immediate byte; `address` is a memory address. For planned control flow, `target` means an instruction index, whose allowed range is still to be decided.

| Instruction | Implemented | Meaning | ZF effect |
| --- | --- | --- | --- |
| `MOV destination, value` | Yes | Replace a register with an immediate byte. | Preserved |
| `LOAD destination, address` | No | Copy a memory byte into a register. | Preserve, per current plan |
| `STORE source, address` | Yes | Copy a register byte into memory. | Preserved |
| `ADD destination, source` | Yes | Add register values into the destination, modulo 256. | Set if stored result is zero; otherwise cleared |
| `SUB destination, source` | No | Subtract source from destination. | Undecided |
| `CMP destination, source` | No | Compare two registers without changing them. | Intended to indicate equality; exact rule pending |
| `JMP target` | No | Jump unconditionally. | Undecided |
| `JZ target` | No | Jump when `ZF` is set. | Undecided |
| `PUSH source` | Yes | Decrement `SP`, then copy the register into memory at `SP`. | Preserved |
| `POP destination` | No | Copy the top stack byte into a register and remove it from the stack. | Undecided |
| `CALL target` | No | Push a return address and jump. | Undecided |
| `RET` | No | Pop a return address and jump back. | Undecided |
| `HALT` | Yes | Advance `PC` and set the halted state. | Preserved |

## Instruction details

### MOV

`MOV R0, 65` sets `R0` to `65`. Values outside `0`–`255` and non-integers are rejected. Memory, other registers, `SP`, and `ZF` are preserved.

### LOAD

`LOAD R0, 42`: Read memory address `42` into `R0`; preserve `SP` and `ZF`.

Open decisions and remaining work: Add address validation, a register-write event identifying the source address, parsing, tests, and read highlighting.

### STORE

```text
; Write the ASCII letter A into memory
MOV R2, 65 ; ASCII code for A
STORE R2, 0 ; Address zero
```

Memory address `0` holds decimal `65`, displayed as hex `41` and ASCII `A`. Addresses must be integers from `0` to `255`. Any byte can be written, including occupied stack bytes. Registers, `SP`, and `ZF` are preserved.

### ADD

```text
MOV R0, 255
MOV R1, 1
ADD R0, R1
```

`R0` becomes `0`, `R1` remains `1`, and `ZF` becomes `1`. A nonzero stored result clears `ZF`. The source register is preserved unless it is also the destination: `ADD R0, R0` doubles the original value with the same wrapping rule. Memory and `SP` are preserved.

### SUB

`SUB R0, R1`: Store `R0 - R1` in `R0`.

Open decisions and remaining work: Define 8-bit wraparound and whether the stored result updates `ZF`.

### CMP

`CMP R0, R1`: Compare values without modifying registers.

Open decisions and remaining work: Specify exactly when `ZF` is set and cleared.

### JMP

`JMP 20`: Set `PC` to instruction index `20`.

Open decisions and remaining work: Define valid targets, program limits, invalid-target faults, and source-line mapping.

### JZ

`JZ 20`: Jump to index `20` if `ZF = 1`; otherwise continue.

Open decisions and remaining work: Define target validation (including an untaken branch), fall-through behaviour, and flag preservation.

### PUSH

```text
MOV R0, 12
PUSH R0
```

From an empty stack, `SP` becomes `255` and memory at `255` becomes `12`. A second push writes at `254`. A push with `SP = 0` throws a stack-overflow error. Stack writes can overwrite ordinary data. Registers and `ZF` are preserved.

### POP

`POP R0`: Read the byte at `SP` into `R0`, then increase `SP`.

Open decisions and remaining work: Define empty-stack faults, whether the removed memory byte is cleared, flag effects, and execution events.

### CALL

`CALL 20`: Save the next instruction address on the stack, then jump to `20`.

Open decisions and remaining work: Define return-address width and encoding, valid targets, program limits, and overflow behaviour without partial writes.

### RET

`RET`: Restore a saved instruction address from the stack into `PC`.

Open decisions and remaining work: Define matching decoding, underflow and invalid-return faults, and stack changes.

### HALT

`HALT` takes no operands, advances `PC`, and sets `halted` to true. Registers, memory, `SP`, and `ZF` are preserved. The core rejects further execution while halted; the interface disables stepping until reset.

Control-flow instructions will need explicit rules for replacing the normal `PC + 1` behaviour. A return address may exceed one byte if programs are not limited; its representation must be decided before implementing `CALL` and `RET`.

## Implementation map

- [src/machine.ts](src/machine.ts): instruction types, state, validation, execution, and events. Memory-writing instructions copy memory so previous states remain intact.
- [src/program.ts](src/program.ts): source syntax, whole-program validation, source-line mapping, and sample program.
- [tests/machine.test.mjs](tests/machine.test.mjs): core behaviour checks.
- [tests](tests): parser and other automated checks.
- [src/App.tsx](src/App.tsx): execution controls, state display, and event presentation.
- [src/InstructionDocs.tsx](src/InstructionDocs.tsx): learner-facing documentation for supported instructions.

When adding support, update the core, parser, relevant tests, interface feedback, learner reference, the instruction set table, and the plan together as appropriate to the current reviewable step.

## Beyond the initial set

No instruction syntax is specified yet for input/output, heap allocation, device access, or bit operations. Memory-mapped devices and the Game of Life milestone remain broader design work. Multiplication, division, strings, floating point, and objects are outside the initial instruction scope.
