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
    () => executeInstruction(state, { operation: 'SUB', register: 'R0', value: 5 }),
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
