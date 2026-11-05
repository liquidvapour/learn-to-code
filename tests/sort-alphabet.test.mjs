import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createInitialState, executeInstruction } from '../src/machine.ts'
import { parseProgram } from '../src/program.ts'

test('alphabet example prints the shuffled and sorted memory contents', () => {
  const source = readFileSync(new URL('../progs/sort-alphabet.txt', import.meta.url), 'utf8')
  const { program, errors } = parseProgram(source)
  assert.deepEqual(errors, [])
  let state = createInitialState()
  for (let steps = 0; steps < 100000 && !state.halted; steps++) {
    state = executeInstruction(state, program[state.pc].instruction, program.length).state
  }
  assert.equal(state.halted, true)
  assert.equal(String.fromCharCode(...state.output), 'HCAONDFPBEKIGJLM\nABCDEFGHIJKLMNOP\n')
  assert.equal(String.fromCharCode(...state.memory.slice(0, 16)), 'ABCDEFGHIJKLMNOP')
  assert.equal(state.sp, 256)
})
