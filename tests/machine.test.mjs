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
