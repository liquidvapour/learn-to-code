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
- Keep source line numbers separate from instruction addresses, since blank lines may appear in the editor. Show the mapping clearly when jumps are introduced.
- Editing while paused returns the machine to its initial state and clears execution history. Explain this in the interface so a changed program is never mistaken for a continuation of the old one. Disable editing while running; Pause makes it available again.
- Step and Run use the same parser and execution rules. Reset keeps the learner's current text and restores the initial machine state. Offer a separate action to restore the sample program.
- Show which instructions are currently supported. An instruction planned for later should produce a helpful editor error rather than silently doing something different.

The first useful editing exercise is to change an immediate value and observe the register, then use `STORE` to see that decimal `65`, hex `41`, binary `0100 0001`, and ASCII `A` are views of one byte. The exact first instruction subset should include the operations needed for these examples and remain small.

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
- **Program addressing:** define instruction indexing, jump targets, program limits, and return-address representation.
- **Memory map:** decide which regions are initially available for ordinary data and the stack; reserve heap and device behaviour for a later milestone.
- **Faults:** define how invalid instructions, addresses, and illegal stack operations stop execution and explain the problem.

The later 32x32 display also needs an explicit memory budget: a one-bit-per-pixel display occupies 128 bytes, while two bit-packed Game of Life grids occupy the full 256 bytes before stack or other data. That milestone will need a deliberate memory or device-model decision.
