# Tiny Machine instruction reference

Development reference for the complete initial instruction set, including instructions not yet implemented. The intended scope comes from [the product design](tiny-machine-design.md#instruction-set); implementation steps live in [plan.md](plan.md). The in-app [instruction reference](src/InstructionDocs.tsx) describes supported behaviour for learners.

The Implemented column indicates availability through both the machine core and source parser. For entries marked No, syntax and behaviour describe intent and may still have open decisions. Keep this document current when implementing an instruction.

## Machine and source conventions

- Four unsigned byte registers: `R0`, `R1`, `R2`, `R3`, initially zero.
- 256 memory bytes at addresses `0`–`255`, initially zero. Stack and ordinary data share this memory; no separate regions are enforced yet.
- `PC` starts at `0` and indexes instructions, excluding blank and comment-only source lines. Instructions are separate from data memory.
- `SP` starts at `256` (empty stack). The stack grows downward; after a push, `SP` points to the top byte.
- `ZF` starts false (`0`). `ADD`, `SUB`, and `CMP` update it.
- One instruction per line; blank lines are ignored. Instructions and register names are case-insensitive. Whitespace is flexible; two operands require a comma.
- Values and memory addresses in source use decimal integers from `0` to `255`. Hex literals and labels are not supported.
- A semicolon (`;`) starts a comment extending to the end of the line, with or without preceding whitespace. Comments may follow instructions or occupy a whole line. Comment-only lines do not produce instructions or advance `PC`. Original source text and line numbers are preserved for display and errors.
- The whole program must parse successfully before execution. Unsupported instructions are rejected, including the planned instructions below.
- `JMP` and taken `JZ` replace `PC` with the target; untaken `JZ` and other supported instructions advance `PC` by one, including `HALT`. Reaching the end without `HALT` is reported as program completion by the interface.

## Complete instruction set

`destination` and `source` mean registers; `value` is an immediate byte; `address` is a memory address. For control flow, `target` means an instruction index, from `0` through `N - 1` for a program with `N` instructions; it is not limited to one byte.

| Instruction | Implemented | Meaning | ZF effect |
| --- | --- | --- | --- |
| `MOV destination, value` | Yes | Replace a register with an immediate byte. | Preserved |
| `LOAD destination, address` | Yes | Copy a memory byte into a register. | Preserved |
| `STORE source, address` | Yes | Copy a register byte into memory. | Preserved |
| `ADD destination, source` | Yes | Add register values into the destination, modulo 256. | Set if stored result is zero; otherwise cleared |
| `SUB destination, source` | Yes | Subtract source from destination, modulo 256. | Set if stored result is zero; otherwise cleared |
| `CMP destination, source` | Yes | Compare two registers without changing them. | Set if values are equal; otherwise cleared |
| `JMP target` | Yes | Jump unconditionally. | Preserved |
| `JZ target` | Yes | Jump when `ZF` is set. | Preserved |
| `PUSH source` | Yes | Decrement `SP`, then copy the register into memory at `SP`. | Preserved |
| `POP destination` | Yes | Copy the top stack byte into a register and remove it from the stack. | Preserved |
| `CALL target` | No | Push a return address and jump. | Undecided |
| `RET` | No | Pop a return address and jump back. | Undecided |
| `HALT` | Yes | Advance `PC` and set the halted state. | Preserved |

## Instruction details

### MOV

`MOV R0, 65` sets `R0` to `65`. Values outside `0`–`255` and non-integers are rejected. Memory, other registers, `SP`, and `ZF` are preserved.

### LOAD

```text
MOV R2, 65
STORE R2, 0
LOAD R3, 0 ; Read the stored byte back
```

`R3` becomes `65`. Memory, other registers, `SP`, and `ZF` are preserved, and `PC` advances by one. Addresses must be decimal integers from `0` to `255` in source; out-of-range and non-integer addresses are rejected. Any byte can be read, including occupied stack bytes, without removing it from the stack.

Execution emits a register-write event containing the destination register, its previous and new values, and the source memory address. The interface highlights the source memory cell as a read and the destination register as a write, and explains the transfer.

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

```text
MOV R0, 0
MOV R1, 1
SUB R0, R1
SUB R0, R0
HALT
```

The first `SUB` stores `0 - 1` modulo 256 in `R0`, producing `255` and clearing `ZF`. The second subtracts a register from itself, producing `0` and setting `ZF`. `R1` remains `1`. Each subtraction advances `PC` and preserves memory, `SP`, and other registers.

Both operands must be registers. Execution emits a subtraction register-write event; the interface explains the subtraction and highlights the source register as a read and the destination as a write.

### CMP

```text
MOV R0, 5
MOV R1, 5
CMP R0, R1
MOV R1, 7
CMP R0, R1
CMP R0, R0
HALT
```

The comparisons set `ZF` to `1` for equal values, clear it to `0` for unequal values, then set it to `1` for self-comparison. `R0` stays `5` and `R1` ends at `7`. Each comparison advances `PC` and preserves registers, memory, and `SP`.

Both operands must be registers. Execution emits a comparison event containing both register names, their values, and the equality result. The interface highlights both operands as reads and explains the comparison and resulting `ZF`.

### JMP

`JMP 20`: Set `PC` to instruction index `20`.

Replace `PC` with the target and preserve registers, memory, `SP`, `ZF`, and halted status. Targets must be safe integers identifying an existing instruction (`0`–`N - 1`), excluding blank and comment-only lines. Source uses unsigned decimal integers. Forward, backward, and self-jumps are valid; targets above 255 are valid in sufficiently long programs. Jumping to `N` is invalid.

After syntax validation succeeds, the parser validates targets against the complete program and blocks execution on any error, reporting the branch source line. Unreachable branches are validated too. The core requires a non-negative safe integer program length as the third argument to `executeInstruction` and rejects missing/invalid context or invalid targets with a `RangeError` before changing state. It emits a branch event containing the operation, previous PC, target, next PC, and taken status. Debug mode displays decimal instruction addresses labelled PC alongside source line numbers labelled Line; the Next marker follows the target and the explanation shows the previous and next PC. See the [control-flow contract](technical-design.md#control-flow-contract-jmp-and-jz) for validation, completion, and event details.

```text
MOV R0, 5
JMP 3
MOV R0, 99
HALT
```

This executes addresses 0, 1, and 3, skipping the write of 99. R0 remains 5, and HALT stops with PC = 4. `JMP 0` alone is a valid self-loop that consumes one Step each time.

### JZ

`JZ 20`: Jump to index `20` if `ZF = 1`; otherwise continue.

Apply the same target validation as `JMP`, even when `ZF = 0`. If `ZF = 1`, set `PC` to the target; otherwise set `PC` to the previous `PC + 1`. Preserve registers, memory, `SP`, `ZF`, and halted status. An untaken final branch reaches `PC = N` and completes without setting `halted`. Both taken and untaken branches emit a branch event with the operation, previous PC, target, next PC, and taken status. The interface explains the outcome and marks ZF as read; it does not produce a flag-write cue.

```text
MOV R0, 3
MOV R1, 1
SUB R0, R1
JZ 5
JMP 2
HALT
```

R0 counts down through 2, 1, and 0. The first two JZ steps fall through to JMP, which returns to SUB. The third jumps to HALT at index 5, stopping with PC = 6 and ZF = 1. JZ can also follow CMP to branch on register equality; CMP requires two register operands, not an immediate value.

### PUSH

```text
MOV R0, 12
PUSH R0
```

From an empty stack, `SP` becomes `255` and memory at `255` becomes `12`. A second push writes at `254`. A push with `SP = 0` throws a stack-overflow error. Stack writes can overwrite ordinary data. Registers and `ZF` are preserved.

### POP

```text
MOV R0, 12
PUSH R0
POP R1
```

`POP R1` reads the byte at `SP` into `R1`, increases `SP` by one, and advances `PC`. Here, R1 becomes 12 and SP returns to 256. Popping an empty stack (`SP = 256`) throws a stack-underflow error without changing state. The byte remains in memory but is no longer part of the stack. Other registers, memory, and `ZF` are preserved. The source memory address is highlighted as read and the destination register as written. See the [POP contract](technical-design.md#stack-contract-pop).

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
