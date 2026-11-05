import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialState, executeInstruction } from '../src/machine.ts'

test('initial state has four zeroed registers and 256 zeroed bytes', () => {
  const state = createInitialState()

  assert.deepEqual(state.registers, { R0: 0, R1: 0, R2: 0, R3: 0 })
  assert.equal(state.memory.length, 256)
  assert.equal(state.memory.every((byte) => byte === 0), true)
  assert.equal(state.pc, 0)
  assert.equal(state.sp, 256)
  assert.equal(state.zf, false)
  assert.equal(state.halted, false)
})

test('MOV changes one register and advances the instruction index without changing the input', () => {
  const before = createInitialState()
  const instruction = { operation: 'MOV', register: 'R0', value: 65 }
  const first = executeInstruction(before, instruction)
  const second = executeInstruction(before, instruction)

  assert.deepEqual(first, second)
  assert.equal(before.registers.R0, 0)
  assert.equal(before.pc, 0)
  assert.equal(first.state.registers.R0, 65)
  assert.equal(first.state.registers.R1, 0)
  assert.equal(first.state.pc, 1)
  assert.equal(first.state.sp, before.sp)
  assert.equal(first.state.zf, before.zf)
  assert.deepEqual(first.state.memory, before.memory)
  assert.deepEqual(first.events, [{
    kind: 'register-write', register: 'R0', previous: 0, value: 65, source: 'immediate',
  }])
})

test('MOV accepts byte endpoints and rejects values outside a byte', () => {
  const state = createInitialState()

  assert.equal(executeInstruction(state, { operation: 'MOV', register: 'R0', value: 0 }).state.registers.R0, 0)
  assert.equal(executeInstruction(state, { operation: 'MOV', register: 'R3', value: 255 }).state.registers.R3, 255)

  for (const value of [-1, 256, 1.5, Number.NaN]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'MOV', register: 'R0', value }),
      /integer from 0 to 255/,
    )
  }
  assert.throws(
    () => executeInstruction(state, { operation: 'MOV', register: 'R4', value: 5 }),
    /Unknown register/,
  )
  assert.throws(
    () => executeInstruction(state, { operation: 'UNKNOWN', register: 'R0', value: 5 }),
    /Unsupported instruction/,
  )
})

test('ADD wraps at 8 bits and sets the zero flag from its result', () => {
  const state = createInitialState()
  const prepared = {
    ...state,
    registers: { ...state.registers, R0: 255, R1: 1 },
  }
  const result = executeInstruction(prepared, { operation: 'ADD', register: 'R0', source: 'R1' })

  assert.equal(result.state.registers.R0, 0)
  assert.equal(result.state.registers.R1, 1)
  assert.equal(result.state.zf, true)
  assert.equal(result.state.pc, 1)
  assert.equal(prepared.registers.R0, 255)
  assert.equal(prepared.zf, false)
  assert.deepEqual(result.events, [{
    kind: 'register-write', register: 'R0', previous: 255, value: 0,
    source: 'addition', sourceRegister: 'R1',
  }])

  const afterNonzero = executeInstruction(result.state, { operation: 'ADD', register: 'R0', source: 'R1' })
  assert.equal(afterNonzero.state.registers.R0, 1)
  assert.equal(afterNonzero.state.zf, false)
})

test('PUSH writes a register byte to memory and moves the stack pointer down', () => {
  const initial = createInitialState()
  const state = {
    ...initial,
    registers: { ...initial.registers, R0: 12, R1: 7 },
  }
  const first = executeInstruction(state, { operation: 'PUSH', register: 'R0' })
  const second = executeInstruction(first.state, { operation: 'PUSH', register: 'R1' })

  assert.equal(first.state.sp, 255)
  assert.equal(first.state.memory[255], 12)
  assert.equal(first.state.pc, 1)
  assert.equal(second.state.sp, 254)
  assert.equal(second.state.memory[254], 7)
  assert.equal(second.state.memory[255], 12)
  assert.equal(second.state.pc, 2)
  assert.equal(state.memory[255], 0)
  assert.equal(first.state.memory[254], 0)
  assert.deepEqual(first.events, [{
    kind: 'memory-write', address: 255, previous: 0, value: 12, sourceRegister: 'R0',
  }])
})

test('PUSH rejects a full stack without changing memory', () => {
  const initial = createInitialState()
  const full = { ...initial, sp: 0 }

  assert.throws(
    () => executeInstruction(full, { operation: 'PUSH', register: 'R0' }),
    /Stack overflow/,
  )
  assert.equal(full.sp, 0)
  assert.equal(full.memory[0], 0)
})

test('POP restores a pushed byte and preserves memory and flags', () => {
  for (const zf of [false, true]) {
    const initial = { ...createInitialState(), registers: { R0: 42, R1: 7, R2: 8, R3: 9 }, zf }
    const pushed = executeInstruction(initial, { operation: 'PUSH', register: 'R0' }).state
    const before = structuredClone(pushed)
    const result = executeInstruction(pushed, { operation: 'POP', register: 'R1' })
    assert.deepEqual(result.state, { ...pushed, registers: { ...pushed.registers, R1: 42 }, sp: 256, pc: 2 })
    assert.deepEqual(pushed, before)
    assert.equal(result.state.memory[255], 42)
    assert.deepEqual(result.events, [{ kind: 'register-write', register: 'R1', previous: 7, value: 42, source: 'stack', address: 255 }])
  }
})

test('POP reads the bottom of a full stack and rejects invalid operations without mutation', () => {
  const full = { ...createInitialState(), sp: 0 }
  full.memory[0] = 123
  const before = structuredClone(full)
  const result = executeInstruction(full, { operation: 'POP', register: 'R3' })
  assert.equal(result.state.registers.R3, 123)
  assert.equal(result.state.sp, 1)
  assert.deepEqual(full, before)
  assert.deepEqual(result.events[0], { kind: 'register-write', register: 'R3', previous: 0, value: 123, source: 'stack', address: 0 })

  const empty = createInitialState()
  const emptyBefore = structuredClone(empty)
  assert.throws(() => executeInstruction(empty, { operation: 'POP', register: 'R0' }), /Stack underflow.*POP/)
  assert.deepEqual(empty, emptyBefore)
  assert.throws(() => executeInstruction(full, { operation: 'POP', register: 'R4' }), /Unknown register: R4/)
  assert.deepEqual(full, before)
  const halted = { ...full, halted: true }
  assert.throws(() => executeInstruction(halted, { operation: 'POP', register: 'R0' }), /Machine is halted/)
  assert.deepEqual(halted, { ...before, halted: true })
})

test('STORE overwrites one addressed byte, preserves other state, and reports the write', () => {
  const initial = createInitialState()
  const state = {
    ...initial,
    registers: { ...initial.registers, R2: 65 },
    pc: 3,
    sp: 250,
    zf: true,
  }
  state.memory[42] = 9
  state.memory[43] = 17
  const instruction = { operation: 'STORE', register: 'R2', address: 42 }
  const result = executeInstruction(state, instruction)

  assert.deepEqual(result, executeInstruction(state, instruction))
  assert.notEqual(result.state.memory, state.memory)
  const expectedMemory = state.memory.slice()
  expectedMemory[42] = 65
  assert.deepEqual(result.state, { ...state, memory: expectedMemory, pc: 4 })
  assert.equal(state.memory[42], 9)
  assert.equal(state.pc, 3)
  assert.deepEqual(result.events, [{
    kind: 'memory-write', address: 42, previous: 9, value: 65, sourceRegister: 'R2',
  }])
})

test('STORE accepts address endpoints and rejects invalid addresses and registers', () => {
  const initial = createInitialState()
  const state = { ...initial, registers: { ...initial.registers, R0: 255 } }

  for (const address of [0, 255]) {
    const result = executeInstruction(state, { operation: 'STORE', register: 'R0', address })
    assert.equal(result.state.memory[address], 255)
    assert.equal(result.state.sp, 256)
  }
  for (const address of [-1, 256, 1.5, Number.NaN, Infinity]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'STORE', register: 'R0', address }),
      /STORE address must be an integer from 0 to 255/,
    )
  }
  assert.throws(
    () => executeInstruction(state, { operation: 'STORE', register: 'R4', address: 0 }),
    /Unknown register/,
  )
  assert.equal(state.memory.every((byte) => byte === 0), true)
  assert.equal(state.pc, 0)
})

test('LOAD reads one byte, preserves other state and its input, and reports the source', () => {
  for (const zf of [false, true]) {
    const state = {
      ...createInitialState(),
      registers: { R0: 11, R1: 22, R2: 65, R3: 44 },
      pc: 3,
      sp: 250,
      zf,
    }
    state.memory[42] = 9
    state.memory[43] = 17
    const before = structuredClone(state)
    const instruction = { operation: 'LOAD', register: 'R2', address: 42 }
    const result = executeInstruction(state, instruction)

    assert.deepEqual(result, executeInstruction(state, instruction))
    assert.deepEqual(result.state, {
      ...before,
      registers: { ...before.registers, R2: 9 },
      pc: 4,
    })
    assert.equal(result.state.memory, state.memory)
    assert.deepEqual(state, before)
    assert.deepEqual(result.events, [{
      kind: 'register-write', register: 'R2', previous: 65, value: 9, source: 'memory', address: 42,
    }])
  }
})

test('LOAD accepts address and byte endpoints, including occupied stack memory', () => {
  const state = {
    ...createInitialState(),
    registers: { R0: 12, R1: 23, R2: 34, R3: 45 },
    sp: 255,
    zf: true,
  }
  state.memory[255] = 255
  for (const address of [0, 255]) {
    for (const register of ['R0', 'R1', 'R2', 'R3']) {
      const result = executeInstruction(state, { operation: 'LOAD', register, address })
      assert.deepEqual(result.state, {
        ...state,
        registers: { ...state.registers, [register]: state.memory[address] },
        pc: 1,
      })
      assert.deepEqual(result.events, [{
        kind: 'register-write', register, previous: state.registers[register],
        value: state.memory[address], source: 'memory', address,
      }])
    }
  }
})

test('LOAD rejects invalid addresses and registers without changing state', () => {
  const state = createInitialState()
  state.memory[0] = 65
  const before = structuredClone(state)
  for (const address of [-1, 256, 1.5, Number.NaN, Infinity, -Infinity]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'LOAD', register: 'R0', address }),
      { name: 'RangeError', message: 'LOAD address must be an integer from 0 to 255' },
    )
    assert.deepEqual(state, before)
  }
  assert.throws(
    () => executeInstruction(state, { operation: 'LOAD', register: 'R4', address: 0 }),
    /Unknown register: R4/,
  )
  assert.deepEqual(state, before)
})

test('the five-instruction sample produces 12 on the stack and then halts', () => {
  const instructions = [
    { operation: 'MOV', register: 'R0', value: 5 },
    { operation: 'MOV', register: 'R1', value: 7 },
    { operation: 'ADD', register: 'R0', source: 'R1' },
    { operation: 'PUSH', register: 'R0' },
    { operation: 'HALT' },
  ]
  const initial = createInitialState()
  let current = initial
  let lastEvent

  for (const instruction of instructions) {
    const result = executeInstruction(current, instruction)
    current = result.state
    lastEvent = result.events[0]
  }

  assert.equal(current.registers.R0, 12)
  assert.equal(current.registers.R1, 7)
  assert.equal(current.memory[255], 12)
  assert.equal(current.sp, 255)
  assert.equal(current.pc, 5)
  assert.equal(current.halted, true)
  assert.deepEqual(lastEvent, { kind: 'halt' })
  assert.equal(initial.memory[255], 0)
  assert.throws(
    () => executeInstruction(current, { operation: 'MOV', register: 'R0', value: 1 }),
    /Machine is halted/,
  )
})


test('SUB wraps subtraction to a byte, updates ZF, and preserves unrelated state', () => {
  for (const [destination, source, expected] of [
    [12, 7, 5], [0, 1, 255], [0, 255, 1], [255, 0, 255], [255, 255, 0], [0, 0, 0],
  ]) {
    for (const zf of [false, true]) {
      const state = {
        ...createInitialState(),
        registers: { R0: destination, R1: source, R2: 42, R3: 17 },
        pc: 3,
        sp: 250,
        zf,
      }
      state.memory[250] = 65
      const before = structuredClone(state)
      const instruction = { operation: 'SUB', register: 'R0', source: 'R1' }
      const result = executeInstruction(state, instruction)

      assert.deepEqual(result, executeInstruction(state, instruction))
      assert.deepEqual(result.state, {
        ...before,
        registers: { ...before.registers, R0: expected },
        pc: 4,
        zf: expected === 0,
      })
      assert.equal(result.state.memory, state.memory)
      assert.deepEqual(state, before)
      assert.deepEqual(result.events, [{
        kind: 'register-write', register: 'R0', previous: destination, value: expected,
        source: 'subtraction', sourceRegister: 'R1',
      }])
    }
  }
})

test('SUB supports every register and subtracting a register from itself', () => {
  const state = { ...createInitialState(), registers: { R0: 1, R1: 7, R2: 128, R3: 255 } }
  for (const register of ['R0', 'R1', 'R2', 'R3']) {
    for (const source of ['R0', 'R1', 'R2', 'R3']) {
      const result = executeInstruction(state, { operation: 'SUB', register, source })
      const expected = (state.registers[register] - state.registers[source] + 256) % 256
      assert.deepEqual(result.state.registers, { ...state.registers, [register]: expected })
      assert.equal(result.state.zf, expected === 0)
    }
  }
})

test('SUB rejects invalid registers and halted execution without changing state', () => {
  const state = createInitialState()
  const before = structuredClone(state)
  for (const [register, source] of [['R4', 'R0'], ['R0', 'R4']]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'SUB', register, source }),
      /Unknown register: R4/,
    )
    assert.deepEqual(state, before)
  }
  assert.throws(
    () => executeInstruction({ ...state, halted: true }, { operation: 'SUB', register: 'R0', source: 'R1' }),
    /Machine is halted/,
  )
})


test('CMP sets ZF from equality, advances PC, and preserves other state and its input', () => {
  for (const [value, sourceValue] of [[0, 0], [255, 255], [0, 255], [255, 0], [12, 7], [7, 12]]) {
    for (const zf of [false, true]) {
      const state = {
        ...createInitialState(),
        registers: { R0: value, R1: sourceValue, R2: 42, R3: 17 },
        pc: 3,
        sp: 250,
        zf,
      }
      state.memory[250] = 65
      const before = structuredClone(state)
      const instruction = { operation: 'CMP', register: 'R0', source: 'R1' }
      const result = executeInstruction(state, instruction)

      assert.deepEqual(result, executeInstruction(state, instruction))
      assert.deepEqual(result.state, { ...before, pc: 4, zf: value === sourceValue })
      assert.equal(result.state.registers, state.registers)
      assert.equal(result.state.memory, state.memory)
      assert.deepEqual(state, before)
      assert.deepEqual(result.events, [{
        kind: 'comparison', register: 'R0', sourceRegister: 'R1',
        value, sourceValue, equal: value === sourceValue,
      }])
    }
  }
})

test('CMP supports every register pair, including comparing a register with itself', () => {
  const state = { ...createInitialState(), registers: { R0: 0, R1: 7, R2: 7, R3: 255 } }
  for (const register of ['R0', 'R1', 'R2', 'R3']) {
    for (const source of ['R0', 'R1', 'R2', 'R3']) {
      const result = executeInstruction(state, { operation: 'CMP', register, source })
      assert.deepEqual(result.state.registers, state.registers)
      assert.equal(result.state.zf, state.registers[register] === state.registers[source])
      assert.deepEqual(result.events, [{
        kind: 'comparison', register, sourceRegister: source,
        value: state.registers[register], sourceValue: state.registers[source],
        equal: state.registers[register] === state.registers[source],
      }])
    }
  }
})

test('CMP rejects invalid registers and halted execution without changing state', () => {
  const state = createInitialState()
  const before = structuredClone(state)
  for (const [register, source] of [['R4', 'R0'], ['R0', 'R4']]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'CMP', register, source }),
      { name: 'RangeError', message: 'Unknown register: R4' },
    )
    assert.deepEqual(state, before)
  }
  const halted = { ...state, halted: true }
  assert.throws(
    () => executeInstruction(halted, { operation: 'CMP', register: 'R0', source: 'R1' }),
    /Machine is halted/,
  )
  assert.deepEqual(halted, { ...before, halted: true })
})

test('JMP replaces PC for forward, backward, self, and endpoint targets while preserving data', () => {
  for (const zf of [false, true]) {
    for (const target of [0, 2, 4, 299]) {
      const state = {
        ...createInitialState(),
        registers: { R0: 12, R1: 7, R2: 65, R3: 255 },
        pc: 2,
        sp: 250,
        zf,
      }
      state.memory[250] = 65
      const before = structuredClone(state)
      const instruction = { operation: 'JMP', target }
      const result = executeInstruction(state, instruction, 300)

      assert.deepEqual(result, executeInstruction(state, instruction, 300))
      assert.deepEqual(result.state, { ...before, pc: target })
      assert.notEqual(result.state, state)
      assert.equal(result.state.registers, state.registers)
      assert.equal(result.state.memory, state.memory)
      assert.deepEqual(state, before)
      assert.deepEqual(result.events, [{
        kind: 'branch', operation: 'JMP', previousPc: 2, target, nextPc: target, taken: true,
      }])
    }
  }
})

test('JMP rejects invalid targets, including program end and empty programs, without changing state', () => {
  const state = { ...createInitialState(), zf: true }
  state.memory[0] = 65
  const before = structuredClone(state)
  for (const target of [-1, 4, 5, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '0', null, undefined]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'JMP', target }, 4),
      { name: 'RangeError', message: 'JMP target must be a safe integer identifying an instruction in the program' },
    )
    assert.deepEqual(state, before)
  }
  assert.throws(
    () => executeInstruction(state, { operation: 'JMP', target: 0 }, 0),
    /JMP target/,
  )
  assert.deepEqual(state, before)
})

test('JMP requires valid program-length context without changing state', () => {
  const state = createInitialState()
  const before = structuredClone(state)
  for (const programLength of [undefined, null, '4', -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 65536]) {
    assert.throws(
      () => executeInstruction(state, { operation: 'JMP', target: 0 }, programLength),
      { name: 'RangeError', message: 'JMP requires a program length from 0 to 65535' },
    )
    assert.deepEqual(state, before)
  }
})

test('JMP can repeatedly step a one-instruction self-loop but cannot execute while halted', () => {
  const initial = createInitialState()
  const instruction = { operation: 'JMP', target: 0 }
  const first = executeInstruction(initial, instruction, 1)
  const second = executeInstruction(first.state, instruction, 1)
  assert.deepEqual(second, first)
  assert.equal(second.state.halted, false)

  const halted = { ...initial, halted: true }
  assert.throws(() => executeInstruction(halted, instruction, 1), /Machine is halted/)
  assert.deepEqual(halted, { ...initial, halted: true })
})

test('following PC after JMP skips an instruction and reaches HALT', () => {
  const program = [
    { operation: 'JMP', target: 2 },
    { operation: 'MOV', register: 'R0', value: 99 },
    { operation: 'MOV', register: 'R1', value: 65 },
    { operation: 'HALT' },
  ]
  let state = createInitialState()
  for (let step = 0; step < 3; step++) {
    state = executeInstruction(state, program[state.pc], program.length).state
  }
  assert.equal(state.registers.R0, 0)
  assert.equal(state.registers.R1, 65)
  assert.equal(state.pc, program.length)
  assert.equal(state.halted, true)
})

test('JZ takes a branch only when ZF is set, preserving data and its input', () => {
  for (const zf of [false, true]) {
    for (const target of [0, 2, 3, 299]) {
      const state = { ...createInitialState(), registers: { R0: 8, R1: 13, R2: 21, R3: 34 }, pc: 2, sp: 250, zf }
      state.memory[250] = 65
      const before = structuredClone(state)
      const result = executeInstruction(state, { operation: 'JZ', target }, 300)
      const nextPc = zf ? target : 3
      assert.deepEqual(result.state, { ...before, pc: nextPc })
      assert.equal(result.state.registers, state.registers)
      assert.equal(result.state.memory, state.memory)
      assert.deepEqual(state, before)
      assert.deepEqual(result.events, [{
        kind: 'branch', operation: 'JZ', previousPc: 2, target, nextPc, taken: zf,
      }])
    }
  }
})

test('JZ validates targets and context even for untaken branches without changing state', () => {
  for (const zf of [false, true]) {
    const state = { ...createInitialState(), zf }
    const before = structuredClone(state)
    for (const target of [-1, 4, 5, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '0', null, undefined]) {
      assert.throws(() => executeInstruction(state, { operation: 'JZ', target }, 4), {
        name: 'RangeError', message: 'JZ target must be a safe integer identifying an instruction in the program',
      })
      assert.deepEqual(state, before)
    }
    for (const length of [undefined, null, '4', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => executeInstruction(state, { operation: 'JZ', target: 0 }, length), {
        name: 'RangeError', message: 'JZ requires a program length from 0 to 65535',
      })
      assert.deepEqual(state, before)
    }
    assert.throws(() => executeInstruction(state, { operation: 'JZ', target: 0 }, 0), /JZ target/)
    assert.deepEqual(state, before)
  }
})

test('a final JZ falls through without halting, or loops when ZF is set', () => {
  for (const zf of [false, true]) {
    const state = { ...createInitialState(), zf }
    const result = executeInstruction(state, { operation: 'JZ', target: 0 }, 1)
    assert.equal(result.state.pc, zf ? 0 : 1)
    assert.equal(result.state.halted, false)
    const halted = { ...state, halted: true }
    assert.throws(() => executeInstruction(halted, { operation: 'JZ', target: 0 }, 1), /Machine is halted/)
    assert.deepEqual(halted, { ...state, halted: true })
  }
})

test('CALL and RET encode return addresses and support nested calls', () => {
  const initial = { ...createInitialState(), pc: 255, zf: true, registers: { R0: 9, R1: 2, R2: 3, R3: 4 } }
  const first = executeInstruction(initial, { operation: 'CALL', target: 10 }, 300)
  assert.equal(first.state.sp, 254)
  assert.deepEqual([...first.state.memory.slice(254)], [0, 1])
  assert.deepEqual(first.events[0], { kind: 'stack-branch', operation: 'CALL', previousPc: 255, nextPc: 10, returnAddress: 256,
    stackBytes: [0, 1].map((value, i) => ({ address: 254 + i, value })) })
  const nested = executeInstruction(first.state, { operation: 'CALL', target: 20 }, 300)
  const inner = executeInstruction(nested.state, { operation: 'RET' }, 300)
  const outer = executeInstruction(inner.state, { operation: 'RET' }, 300)
  assert.equal(inner.state.pc, 11)
  assert.equal(outer.state.pc, 256)
  assert.equal(outer.state.sp, 256)
  assert.equal(outer.state.zf, true)
  assert.deepEqual(outer.state.registers, initial.registers)
  assert.equal(outer.state.memory, inner.state.memory)
  assert.equal(initial.memory.every(byte => byte === 0), true)
  assert.equal(outer.events[0].operation, 'RET')
  assert.deepEqual(outer.events[0].stackBytes, first.events[0].stackBytes)
})

test('CALL and RET accept exact boundaries and 16-bit return addresses', () => {
  const initial = createInitialState()
  const last = executeInstruction({ ...initial, pc: 299, sp: 2 }, { operation: 'CALL', target: 0 }, 300)
  assert.equal(last.state.sp, 0)
  const returned = executeInstruction(last.state, { operation: 'RET' }, 300)
  assert.equal(returned.state.pc, 300)
  assert.equal(returned.state.sp, 2)
  const max = executeInstruction({ ...initial, pc: 65534 }, { operation: 'CALL', target: 0 }, 65535)
  assert.equal(executeInstruction(max.state, { operation: 'RET' }, 65535).state.pc, 65535)
})

test('CALL and RET reject invalid context, addresses and stack capacity atomically', () => {
  const initial = createInitialState()
  const cases = [
    [initial, { operation: 'CALL', target: 0 }, undefined, /CALL.*program length/],
    [initial, { operation: 'RET' }, -1, /RET.*program length/],
    [initial, { operation: 'CALL', target: 2 }, 2, /CALL target/],
    [{ ...initial, pc: 2 }, { operation: 'CALL', target: 0 }, 2, /CALL PC/],
    [{ ...initial, sp: 1 }, { operation: 'CALL', target: 0 }, 2, /CALL stack overflow/],
    [{ ...initial, sp: 255 }, { operation: 'RET' }, 2, /RET stack underflow/],
  ]
  const invalid = { ...initial, sp: 254, memory: initial.memory.slice() }
  invalid.memory[254] = 3
  cases.push([invalid, { operation: 'RET' }, 2, /RET return address/])
  cases.push([initial, { operation: 'CALL', target: 0 }, 65536, /CALL.*program length/])
  cases.push([initial, { operation: 'RET' }, 65536, /RET.*program length/])
  for (const [state, instruction, length, error] of cases) {
    const before = structuredClone(state)
    assert.throws(() => executeInstruction(state, instruction, length), error)
    assert.deepEqual(state, before)
  }
  for (const instruction of [{ operation: 'CALL', target: 0 }, { operation: 'RET' }]) {
    assert.throws(() => executeInstruction({ ...initial, halted: true }, instruction, 1), /halted/)
  }
})

test('OUT appends bytes in order, retaining only the latest 64 without mutating snapshots', () => {
  let state = createInitialState()
  assert.deepEqual(state.output, [])
  const initial = state
  for (let value = 0; value < 65; value++) {
    state = executeInstruction(state, { operation: 'MOV', register: 'R0', value }).state
    const before = state
    const result = executeInstruction(before, { operation: 'OUT', register: 'R0' })
    assert.deepEqual(result.events, [{ kind: 'output', sourceRegister: 'R0', value }])
    assert.equal(result.state.pc, before.pc + 1)
    assert.strictEqual(result.state.registers, before.registers)
    assert.strictEqual(result.state.memory, before.memory)
    assert.equal(result.state.sp, before.sp)
    assert.equal(result.state.zf, before.zf)
    assert.equal(result.state.halted, before.halted)
    assert.equal(before.output.length, Math.min(value, 64))
    state = result.state
  }
  assert.deepEqual(initial.output, [])
  assert.deepEqual(state.output, Array.from({ length: 64 }, (_, i) => i + 1))
  const repeated = executeInstruction(state, { operation: 'OUT', register: 'R0' }).state
  assert.deepEqual(repeated.output.slice(-2), [64, 64])
  assert.equal(state.output[0], 1)
})

test('OUT rejects invalid registers and halted execution without changing state', () => {
  const state = createInitialState()
  assert.throws(() => executeInstruction(state, { operation: 'OUT', register: 'R4' }), /Unknown register/)
  assert.deepEqual(state.output, [])
  const halted = executeInstruction(state, { operation: 'HALT' }).state
  assert.throws(() => executeInstruction(halted, { operation: 'OUT', register: 'R0' }), /halted/)
  assert.deepEqual(halted.output, [])
})
