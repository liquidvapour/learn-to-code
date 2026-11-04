import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createInitialState, executeInstruction } from '../src/machine.ts'
import { parseProgram } from '../src/program.ts'

test('SOS beacon executes every instruction and records three flashes', () => {
  const source = readFileSync(new URL('../progs/beacon.txt', import.meta.url), 'utf8')
  const { program, errors } = parseProgram(source)
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const operations = new Set()
  const branches = []
  for (let steps = 0; steps < 100 && !state.halted; steps++) {
    const instruction = program[state.pc].instruction
    operations.add(instruction.operation)
    const result = executeInstruction(state, instruction, program.length)
    if (instruction.operation === 'JZ') branches.push(result.events[0].taken)
    state = result.state
  }
  assert.equal(state.halted, true)
  assert.deepEqual([...operations].sort(), ['ADD', 'CMP', 'HALT', 'JMP', 'JZ', 'LOAD', 'MOV', 'POP', 'PUSH', 'STORE', 'SUB'])
  assert.deepEqual(branches, [false, false, true])
  assert.equal(String.fromCharCode(...state.memory.slice(0, 3)), 'SOS')
  assert.equal(state.memory[3], 3)
  assert.equal(state.registers.R3, 3)
  assert.equal(state.sp, 256)
})

test('Fibonacci example calls and returns for each generated number', () => {
  const source = readFileSync(new URL('../progs/fibjmp.txt', import.meta.url), 'utf8')
  const { program, errors } = parseProgram(source)
  assert.deepEqual(errors, [])
  let state = createInitialState()
  let calls = 0
  let returns = 0
  for (let steps = 0; steps < 100 && !state.halted; steps++) {
    const instruction = program[state.pc].instruction
    if (instruction.operation === 'CALL') calls++
    if (instruction.operation === 'RET') returns++
    state = executeInstruction(state, instruction, program.length).state
  }
  assert.equal(state.halted, true)
  assert.equal(calls, 8)
  assert.equal(returns, 8)
  assert.equal(state.registers.R0, 55)
  assert.equal(state.registers.R1, 34)
  assert.equal(state.memory[0], 55)
  assert.equal(state.sp, 256)
})

test('nested-call example returns through both subroutines', () => {
  const source = readFileSync(new URL('../progs/nested-call.txt', import.meta.url), 'utf8')
  const { program, errors } = parseProgram(source)
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const path = []
  for (let steps = 0; steps < 20 && !state.halted; steps++) {
    path.push(state.pc)
    state = executeInstruction(state, program[state.pc].instruction, program.length).state
  }
  assert.deepEqual(path, [0, 1, 3, 5, 6, 4, 2])
  assert.equal(state.halted, true)
  assert.equal(state.registers.R0, 2)
  assert.equal(state.sp, 256)
})
