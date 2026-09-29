# Tiny Machine Learning Environment

## Purpose

Build a small, visual computer that teaches learners what software is made of before hiding those ideas behind higher-level abstractions.

The core principle is:

> Make the machine visible, but make the machine small.

The project is intended to help learners build a mental model of execution, memory, data movement, control flow, functions, stack behaviour, heap allocation, and I/O before or alongside learning higher-level languages.

## Design principles

### Let the bones show

Do not hide the important machinery.

The learner should be able to see:

- instructions executing
- registers changing
- values moving through the machine
- memory reads and writes
- stack operations
- heap allocations
- function calls and returns
- input and output

### Subtractive design

Include only what is needed to teach the current concept.

The machine should be intentionally simpler than a real CPU. It is a teaching model, not an x86 or ARM emulator.

Every feature should earn its place.

### Deterministic core

The virtual machine should be small, explicit, and deterministic.

AI may help with explanations, exercises, or generated examples, but the execution model itself should remain deterministic and inspectable.

## Target experience

The learner can write or drag instructions into a program and execute them one step at a time.

The interface shows the machine state changing in real time.

Animations should make data movement spatially understandable. For example, a value can visibly move:

```text
Memory -> Register -> ALU -> Register -> Memory
```

The teaching interface should gradually become less necessary as the learner improves, eventually resembling a conventional debugger.

## Initial machine specification

### Data model

- 8-bit data values
- 256 bytes of memory
- 4 general-purpose registers: `R0`, `R1`, `R2`, `R3`
- `PC` Program Counter
- `SP` Stack Pointer
- `ZF` Zero Flag
- stack grows downward
- heap occupies a defined memory region
- optional memory-mapped devices

The exact memory layout should be visible to the learner.

## Instruction set

The first version should use a deliberately small instruction set.

| Instruction | Meaning |
| --- | --- |
| `MOV R0, 5` | Put an immediate value into a register |
| `LOAD R0, 42` | Copy memory address `42` into `R0` |
| `STORE R0, 42` | Copy `R0` into memory address `42` |
| `ADD R0, R1` | `R0 = R0 + R1` |
| `SUB R0, R1` | `R0 = R0 - R1` |
| `CMP R0, R1` | Compare values and set `ZF` |
| `JMP 20` | Jump to instruction `20` |
| `JZ 20` | Jump if `ZF` is set |
| `PUSH R0` | Push a register value onto the stack |
| `POP R0` | Pop the top stack value into a register |
| `CALL 20` | Push return address and jump |
| `RET` | Pop return address and jump back |
| `HALT` | Stop execution |

This is enough to teach variables, arithmetic, conditions, loops, stack behaviour, and functions.

Multiplication, division, strings, floating point, objects, and other features should not be included initially unless they are needed for a specific lesson.

## Input and output

The core machine should support a minimal input and output stream.

Additional hardware should be modular.

A useful early module would be a small display, such as 32x32 pixels, exposed through memory-mapped I/O.

Example:

```text
0x80 - 0xFF = display memory
```

Writing to display memory changes pixels on screen.

This teaches that hardware can be represented through memory addresses without requiring a complex device model.

## Visual interface

The main interface should make machine state visible at all times.

Suggested areas:

- source or instruction list
- current instruction marker
- registers
- stack
- heap
- memory
- flags
- input
- output
- optional devices
- execution controls

Core controls:

- step
- run
- pause
- reset
- step backward, if state snapshots make this practical

## Animation

Tweening should be used to show where values move.

Examples:

- `LOAD`: animate a value from memory into a register
- `STORE`: animate a value from a register into memory
- `ADD`: animate operands entering the ALU and the result returning to a register
- `PUSH`: animate a value moving from a register onto the stack
- `POP`: animate a value leaving the stack and entering a register
- `CALL`: show the return address being pushed before control moves
- `RET`: show the return address being popped before control returns

Animations should be optional and speed-adjustable.

Advanced learners should be able to reduce or disable them.

## Instruction icons

Each instruction should have a simple, consistent icon.

Suggested visual language:

| Instruction | Icon idea |
| --- | --- |
| `MOV` | arrow into register or box |
| `LOAD` | memory to chip |
| `STORE` | chip to memory |
| `ADD` | plus sign |
| `SUB` | minus sign |
| `CMP` | scales or comparison bars |
| `JMP` | curved arrow |
| `JZ` | conditional curved arrow |
| `PUSH` | down arrow onto stack |
| `POP` | up arrow from stack |
| `CALL` | arrow entering function or portal |
| `RET` | return arrow |
| `HALT` | stop square |

Icons should support recognition, not replace instruction names.

The interface may provide three presentation modes:

1. text only
2. icon plus text
3. draggable instruction blocks

## Icon atlas specification

Production icons should be created deterministically rather than relying on a generated sprite sheet.

Recommended atlas rules:

- each tile is exactly 64x64 pixels
- transparent background
- consistent internal safe area, for example 48x48 pixels
- icons optically centred
- consistent stroke weight and visual scale
- no text inside instruction icons
- fixed row and column layout
- machine-state icons use the same visual language as instruction icons

AI-generated images can be used as concept references, but final atlas assembly should use deterministic tooling.

## Higher-level language progression

The machine is not intended to keep learners at assembly level.

Its purpose is to give higher-level abstractions something concrete to sit on top of.

A possible progression:

```text
Tiny machine
    -> tiny assembly
    -> C
    -> higher-level language
```

For example, after learning explicit memory operations, the learner can see:

```c
int x = 5;
```

as a convenient abstraction over allocating storage and placing a value into it.

Later, when seeing:

```python
x = 5
```

the learner already understands that the runtime is doing more work on their behalf.

The aim is not to make learners expert C programmers before they progress. The aim is to give them a durable mental model of what higher-level languages abstract away.

## Educational positioning

The project should not primarily be positioned as "learn assembly" or "learn C".

A stronger framing is:

> Learn what software is made of.

The goal is to develop software engineers who can reason about execution, state, memory, interfaces, and trade-offs rather than only reproduce syntax or framework patterns.

This becomes particularly relevant in an AI-assisted development environment where generating code is increasingly easy, but judging what that code actually does remains important.

## Web implementation

The first implementation can be a browser application.

The virtual machine may be implemented in JavaScript or TypeScript while still exposing a much lower-level conceptual machine to the learner.

The implementation language is separate from the teaching model.

A high-level runtime can host a deliberately tiny and explicit virtual machine.

## First prototype

The first prototype should remain very small.

It only needs to prove that stepping through a few instructions while watching the machine change is useful and satisfying.

Example program:

```text
MOV R0, 5
MOV R1, 7
ADD R0, R1
PUSH R0
HALT
```

The prototype should show:

- the active instruction
- register values
- the stack
- a small memory view
- animated data movement
- step and reset controls

Do not build a full curriculum before validating this interaction.

## Milestone project: Conway's Game of Life

A longer-term goal should be to make Conway's Game of Life run on the tiny machine and render it on the optional 32x32 display module.

This is a useful milestone because it combines several concepts already taught by the machine:

- memory representation
- loops and conditionals
- addressing
- bit operations or bit packing
- application state versus device state
- rendering through a device interface
- optimisation driven by genuine constraints
- emergence from simple rules

A 32x32 Life grid contains 1,024 cells. Storing one byte per cell requires 1,024 bytes. Storing one bit per cell requires only 128 bytes. Two bit-packed grids for double buffering require 256 bytes.

The game grid should initially remain ordinary program state rather than being the display memory itself. A rendering routine maps the game grid into the display module's memory. This keeps the distinction between application state and device state visible.

The deliberately small memory model should make representation choices matter. The learner should encounter optimisation because the machine's constraints create a real reason to think about it, rather than because optimisation is presented as an abstract rule.

Game of Life also demonstrates a wider idea behind the project: complex behaviour can emerge from a very small set of rules.

## Later possibilities

Possible future additions include:

- drag-and-drop programming
- typed assembly editor
- C compilation or translation into the tiny instruction set
- side-by-side C and machine execution
- heap allocation exercises
- memory corruption exercises
- debugger-style breakpoints
- optional display module
- simple keyboard input
- user-created hardware modules
- lessons and challenges
- execution history
- reverse stepping
- higher-level language comparisons

These should be added only when they support a clear teaching objective.

## Working thesis

A beginner does not necessarily need a higher-level language first.

They may instead benefit from a simpler machine first.

The project should test whether making computation visible, spatial, and intentionally small gives learners a stronger foundation for understanding increasingly powerful abstractions.
