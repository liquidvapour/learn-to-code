# Tiny Machine plan

This is the living record of what exists and what comes next. The nearest steps are small enough to become individual, reviewable commits. Later milestones stay broad until we reach them; then we split them into similarly small steps. Update this file as work lands, and keep the first unchecked step current.

The product goals are in [tiny-machine-design.md](tiny-machine-design.md). The proposed behaviour and interface are in [technical-design.md](technical-design.md).

## Done

- [x] Capture the teaching goal, tiny instruction set, and prototype scope (`31f4f44`).
- [x] Record the technical design, including the hex memory explorer and editable text program (`31f4f44`).
- [x] Set the small-change and commit-as-you-go rule (`933e682`).
- [x] Scaffold a runnable React and TypeScript page with Program, Machine, and Memory areas (`38f0b2d`).
- [x] Set up fnm Node 24 and npm with a lockfile (`2ead793`).

## Next small steps

- [ ] **Machine core, first instruction:** define the initial state and a pure `MOV` step. Specify register bounds and how `PC` advances. Verify that repeated runs from the same state give the same result.
- [ ] **First visible step:** connect Step and Reset to that core. Show the active instruction and register values using a short `MOV` program. Keep the UI honest about which instructions work.
- [ ] **Hex explorer:** show all 256 bytes in 16 rows with address and offset headings. Let a learner select a byte and see its hex, unsigned decimal, binary, and ASCII interpretations.
- [ ] **First memory write:** add `STORE`, show the changed byte in the hex view, and explain a write such as decimal `65` becoming hex `41` and ASCII `A`.
- [ ] **Editable program:** replace the fixed program display with a text editor. Parse and validate the supported instructions before execution, with clear line-specific errors. Reset execution when source changes.
- [ ] **Complete the sample:** add `ADD`, `PUSH`, and `HALT` in small steps, with a stack view backed by the same memory. Run the five-instruction sample end to end.
- [ ] **Continuous execution:** add Run/Pause and a speed control while preserving the same step behaviour.
- [ ] **Movement cues:** use execution events to highlight reads and writes, then add optional motion that can be reduced or disabled.

## Later milestones

- Expand the instruction set with `LOAD`, `SUB`, `CMP`, jumps, calls, and returns. Resolve the memory map, overflow, flags, stack rules, addressing, and faults as each operation becomes relevant.
- Add short exercises and example programs that teach variables, control flow, and functions.
- Explore a more controlled instruction editor if learners need it after trying the text editor.
- Explore reverse stepping and a gradually more debugger-like interface.
- Design a memory-mapped display and revisit the memory budget before attempting Conway's Game of Life.

## Working rule

As each small step lands, mark it complete here in the same commit, add any decision we learned, and split the next broad item if it is now close enough to implement. The plan can change as the prototype teaches us what works.
