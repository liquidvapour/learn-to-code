# Tiny Machine: Technical Design

Status: design draft. This document records the proposed browser implementation and interface decisions before coding begins. The educational goals and initial instruction set live in [tiny-machine-design.md](tiny-machine-design.md).

## Core experience

The learner edits and steps through a small program and sees exactly what changes: the active instruction, registers, flags, memory, and stack. Animation explains where values came from and where they went.

The first prototype uses the example program from the original design:

```text
MOV R0, 5
MOV R1, 7
ADD R0, R1
PUSH R0
HALT
```

It should make this short execution understandable before we expand the instruction set or build lessons.

## Proposed technology

- **React** for the instruction list, machine panels, execution controls, and memory explorer.
- **TypeScript** for explicit instruction, state, and execution-event definitions.
- **Vite** for local development and production builds.
- **Motion** for animating HTML and SVG elements, including values moving between machine components.
- **HTML and CSS** for controls and memory cells, with an **SVG overlay** for connections and moving values where useful.

The initial application runs entirely in the browser. It does not require a backend or accounts.

These are proposed choices, not dependencies installed by this design work.

## Separate execution from presentation

The virtual machine is a small, deterministic TypeScript module with no dependency on React, animation, or the browser DOM.

Executing one instruction produces:

1. The next machine state.
2. A structured description of the operation, including relevant reads, writes, and control-flow changes.

For example, `LOAD R0, 42` records a read from address `0x2A` and a write to `R0`, with the value transferred. The interface uses those facts to highlight the source and destination and animate the transfer.

Animation must never decide the result of an instruction. The machine produces the result; the presentation explains it. Disabling animation produces exactly the same execution.

An execution controller coordinates stepping, running, pausing, and resetting. During animated playback it finishes presenting a step before starting the next. Reset cancels any pending presentation and restores the initial state.

Machine-state snapshots can support backward stepping later. Snapshots must own their memory data so later writes cannot alter earlier states.

## Machine state

The initial state includes:

- 256 bytes of memory, each holding a value from 0 to 255.
- Four 8-bit general-purpose registers: `R0`, `R1`, `R2`, and `R3`.
- A program counter (`PC`), stack pointer (`SP`), and zero flag (`ZF`).
- Execution status, such as ready, running, halted, or faulted.

The instruction list is initially displayed separately from data memory. Whether instructions will eventually be encoded as bytes in the same memory is an open design decision; the interface should not imply that they already are.

The stack view is another view of the same memory bytes, not a separate store. A stack write must be visible in both views.

## Page layout

The proposed desktop layout has three main areas:

| Area | Contents |
| --- | --- |
| Program | Text instruction editor, current-instruction marker, feedback, and execution controls |
| Machine | Registers, flags, ALU, and animated data movement |
| Memory | Hex explorer, selected-byte details, and a focused stack view |

The memory explorer should have enough width to read comfortably. On narrower screens, panels can stack vertically while retaining their selection and execution state.

Controls begin with **Step**, **Run/Pause**, and **Reset**. Animation speed and reduced-motion support belong in the presentation layer.

## Program editor

The first prototype includes a small text editor for the tiny assembly language. It opens with the sample program but lets the learner change instructions and run their own short programs. A more controlled editor, such as instruction forms or draggable blocks, can be explored after the text interaction has been tested.

- Use one instruction per line. Show line numbers and mark the instruction that will execute next.
- Accept consistent, forgiving whitespace and case for instruction names and registers. Display a compact syntax reference beside or beneath the editor.
- Parse and validate the whole program before execution. Show an error at its source line with a plain explanation, such as “R4 is not a register” or “256 is outside the allowed address range.” Never execute a partially valid program.
- A semicolon (`;`) starts a comment through the end of the line. Allow inline and comment-only lines; ignore comments during parsing while preserving original source text and line numbers for display and errors.
- Keep source line numbers separate from instruction addresses, since blank and comment-only lines may appear in the editor. Show the mapping clearly when jumps are introduced.
- Editing while paused returns the machine to its initial state and clears execution history. Explain this in the interface so a changed program is never mistaken for a continuation of the old one. Disable editing while running; Pause makes it available again.
- Step and Run use the same parser and execution rules. Reset keeps the learner's current text and restores the initial machine state. Offer a separate action to restore the sample program.
- Show which instructions are currently supported. An instruction planned for later should produce a helpful editor error rather than silently doing something different.

The first useful editing exercise is to change an immediate value and observe the register, then use `STORE` to see that decimal `65`, hex `41`, binary `0100 0001`, and ASCII `A` are views of one byte. The exact first instruction subset should include the operations needed for these examples and remain small.

## Control-flow contract: JMP and JZ

This contract guides control-flow implementation. Both `JMP` and `JZ` are supported.

- **Instruction addresses:** For a parsed program containing `N` instructions, targets are zero-based indices from `0` through `N - 1`. Blank and comment-only lines do not consume indices. Targets identify instructions, not source lines or data-memory bytes. Source operands are unsigned decimal integers; labels, signs, fractions, and hex literals are not supported.
- **Program size:** Instruction addresses and `PC` are not 8-bit values. Do not impose the data-memory limit of 256 on programs or branch targets. Programs contain at most 65,535 instructions, so the end address also fits in 16 bits. A target must refer to an instruction in the current program. Return addresses use the stack encoding defined below.
- **JMP:** Replace `PC` with the target, without adding one. Forward, backward, and self-jumps are valid. A self-jump consumes one Step and leaves the same instruction selected.
- **JZ:** Validate the target first, regardless of `ZF`. If `ZF` is `1`, replace `PC` with the target; otherwise advance `PC` by one. Read the flag without clearing or rewriting it.
- **Preserved state:** Both instructions preserve all registers, memory, `SP`, `ZF`, and the halted flag. The existing rule rejecting execution while halted still applies.
- **Program end:** `PC = N` means normal completion after fall-through, including an untaken final `JZ`. It disables further stepping without setting `halted`. `HALT` retains its current behaviour: advance `PC` and set `halted`. A jump to `N` is invalid because there is no instruction there; use `HALT` for an explicit stop. An empty program has no valid targets and cannot be stepped.
- **Validation:** After parsing all instructions, validate every branch against the final instruction count, including forward references and unreachable or untaken branches. Report errors at the branch's original source line and block the whole program. The core must also receive the program length and reject invalid targets with an instruction-specific `RangeError` before producing a result, leaving the input state untouched. Missing or invalid program-length context must reject branch execution. A full fault-state interface is deferred.
- **Feedback:** Display decimal instruction addresses alongside the existing source line numbers in Debug mode. A branch event records the operation, previous PC, target, next PC, and whether the branch was taken, so the interface can explain both taken and untaken branches. `JZ` feedback identifies the flag read; neither branch produces a flag-write cue. The next-instruction marker follows the resulting PC even for self-jumps.

For example, this source has four instructions even though it contains six source lines:

```text
; Instruction addresses ignore comments and blank lines
MOV R0, 2
MOV R1, 1

SUB R0, R1
JZ 2
```

Source line 5 has instruction address `2`, and source line 6 has address `3`. With `ZF = 0`, `JZ 2` falls through to `PC = 4` and completes. Changing the initial R0 value to `1` makes `ZF = 1`, so it jumps to instruction `2` without changing the flag. `JZ 4` would be rejected before execution regardless of the flag value.

Implementation checks should cover first/last targets, forward/backward/self-jumps, targets above 255 in longer programs, invalid numeric targets and missing context, both `JZ` outcomes, untaken invalid targets, last-instruction fall-through, state preservation, source-line mapping, and whole-program rejection.

## Stack contract: POP

`POP` is planned; this contract guides its implementation.

- **Operation:** `POP destination` reads the byte at `SP` into the destination register, then increments `SP` by one and advances `PC` by one. A full stack (`SP = 0`) can be popped; popping its last occupied byte leaves `SP = 256`.
- **Empty stack:** When `SP = 256`, reject the instruction with a `RangeError` identifying stack underflow and `POP`, before producing a result. Validate the destination register as well; invalid operands and underflow leave the input state untouched. The existing halted-state rejection applies.
- **Memory and flags:** Do not clear or otherwise change the popped memory byte. It is no longer occupied by the stack, but remains readable and may later be overwritten. Preserve `ZF`, all other registers, memory, and the halted flag.
- **Feedback:** Emit a register-write event identifying the stack as its source, the original address, destination, previous register value, and transferred byte. The interface can highlight the memory/stack read and register write, explain the transfer and `SP` increment, and clear the cues on the next step or reset. No memory-write or flag-write cue is produced.

## Stack contract: CALL and RET

`CALL` and `RET` are planned; this contract guides their implementation.

- **Address representation:** A return address occupies two bytes, unsigned little-endian: the least significant byte is at `SP`, and the most significant byte is at `SP + 1`. Address 256 is stored as `00 01` at increasing addresses. Each call consumes two stack bytes.
- **CALL:** `CALL target` validates the program length and target using the `JMP` rules, and requires the current `PC` to be an instruction index in the program. It saves `PC + 1` in the two bytes at `SP - 2` through `SP - 1`, sets `SP` to `SP - 2`, and replaces `PC` with the target. A call at the final instruction may save `N`; returning there completes the program normally. Source target validation includes unreachable calls and reports the original source line.
- **RET:** `RET` requires valid program-length context and two occupied stack bytes. It decodes the bytes beginning at `SP`, validates the decoded address as a safe integer in `0` through `N` inclusive, then adds two to `SP` and sets `PC` to that address. Address `N` completes normally. It does not clear the bytes. The stack has no frame tags: `RET` interprets whatever two bytes are on top, including bytes changed by `STORE` or other stack operations.
- **Faults:** A call with fewer than two free bytes raises a `RangeError` identifying `CALL` and stack overflow. A return with fewer than two occupied bytes raises a `RangeError` identifying `RET` and stack underflow. Invalid context, call target, current call PC, or decoded return address also raises an instruction-specific `RangeError`. Validate all conditions before producing a result; faults leave the input state untouched, without partial stack writes or changes to `SP`. The existing halted-state rejection applies.
- **Preserved state and feedback:** Both preserve registers, `ZF`, and the halted flag. `CALL` copies memory before writing; `RET` preserves memory. Execution events should identify the previous and next PC, return address, and two stack addresses and bytes, allowing the interface to explain the call or return and show the corresponding stack writes or reads. Neither instruction writes `ZF`.

Implementation checks should include nested calls, addresses above 255 and 16-bit boundaries, a final-instruction call returning to `N`, exact stack capacity boundaries, invalid and modified return bytes, missing context, preserved state, and atomic failure.

## Memory as a hex explorer

Memory is a first-class, inspectable part of the interface.

> Make representation visible, small, and explorable.

The core teaching point is:

> The bits are the same; the interpretation changes.

### Main memory grid

Show all 256 bytes in a conventional hex layout: 16 rows of 16 bytes. Each row has its starting address, columns identify hexadecimal offsets, and every byte uses exactly two hexadecimal digits.

For example, the first three cells of row `0x10` could appear as:

```text
Address   +0 +1 +2 ... +F    ASCII
0x10      41 FF 05 ...      A..
```

This is an abbreviated example; the actual row contains all 16 cells. The cell at row `0x10`, column `+2`, is address `0x12`.

- Row addresses use a `0x` prefix; byte cells omit it to keep the grid readable.
- Column headings run from `+0` to `+F`.
- Values use uppercase hex and a monospace font.
- An aligned ASCII column provides a character interpretation of each byte.
- Printable ASCII bytes (`0x20` through `0x7E`) use their character. Other bytes use a dot as a placeholder.
- A dot does not mean the byte contains a period. Selected-byte details distinguish an actual `0x2E` period from a placeholder. A selected space is explicitly labelled as a space.

### Selected-byte inspector

Clicking or keyboard-selecting a byte reveals its representations together:

```text
Address       0x10 (16)
Hex           0x41
Decimal       65
Binary        0100 0001
ASCII         A
```

The following compact table illustrates the relationship; it is not a second full-memory table:

| Address | Hex | Decimal | ASCII |
| --- | --- | --- | --- |
| `0x10` | `41` | 65 | A |
| `0x11` | `FF` | 255 | . (not printable ASCII) |
| `0x12` | `05` | 5 | . (not printable ASCII) |

These are interpretations of one stored byte, not separate stored values. Writing decimal `65` makes that byte appear as hex `41`, binary `0100 0001`, and ASCII `A`.

Decimal initially means unsigned decimal. A signed interpretation can be added when teaching signed numbers; character display initially means ASCII, not general Unicode text decoding.

### Execution feedback

- A memory read briefly marks the source cell.
- A memory write marks the destination and shows its previous and new values in the step explanation.
- The selected byte stays selected across execution steps so its representations can be watched as they change.
- Reading and writing the same value still produce visible activity, even if the byte does not change.
- Distinguish selection, reads, and writes using labels or outlines as well as colour.
- Selecting a character in the ASCII column selects the corresponding byte.

For a store of decimal `65`, the explanation could say: “Write 65 (0x41) to address 0x10.” The destination cell becomes `41`, and its character becomes `A`.

The hex grid remains visible even when nothing is executing. Hover explanations may help, but essential information must also be available through selection and keyboard focus.

### Memory regions and the stack

Use restrained region markings and a legend once the memory map is defined. Stack, heap, and device regions must correspond to real machine behaviour.

The stack panel should show addresses alongside byte values and link selection back to the hex grid. When `PUSH` writes a byte, both views highlight the same address. Show the stack pointer according to the agreed stack convention.

Do not imply a working heap allocator or memory-mapped display before those features exist.

### Editing memory

Direct byte editing is a possible later exploration feature. The initial prototype can keep memory read-only to the learner while instructions modify it.

If editing is introduced, edits should occur while execution is paused, explicitly identify the input base, and accept only valid byte values. The other representations should update immediately.

## First prototype scope

- Open with the five-instruction sample and let the learner edit and execute short text programs.
- Validate the source and show line-specific errors before execution.
- Show the active instruction and register values.
- Show the complete hex memory grid and selected-byte inspector.
- Show stack changes as writes to the same memory.
- Provide Step, Run/Pause, and Reset.
- Animate the key transfers, with a way to reduce or disable motion.

A small follow-up example using `STORE` can demonstrate decimal `65` becoming hex `41` and character `A` in memory.

## Decisions to resolve before implementation

- **Arithmetic:** confirm overflow behaviour for 8-bit results and which operations update `ZF`.
- **Stack:** define its memory region, initial `SP`, whether `SP` points at the top item or the next free byte, and underflow/overflow behaviour.
- **Memory map:** decide which regions are initially available for ordinary data and the stack; reserve heap and device behaviour for a later milestone.
- **Faults:** define how invalid instructions, addresses, and illegal stack operations stop execution and explain the problem.

The later 32x32 display also needs an explicit memory budget: a one-bit-per-pixel display occupies 128 bytes, while two bit-packed Game of Life grids occupy the full 256 bytes before stack or other data. That milestone will need a deliberate memory or device-model decision.
