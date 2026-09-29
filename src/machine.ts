export const REGISTER_NAMES = ['R0', 'R1', 'R2', 'R3'] as const

export type Register = (typeof REGISTER_NAMES)[number]

export type Instruction = Readonly<{
  operation: 'MOV'
  register: Register
  value: number
}> | Readonly<{
  operation: 'ADD'
  register: Register
  source: Register
}> | Readonly<{
  operation: 'PUSH'
  register: Register
}> | Readonly<{
  operation: 'HALT'
}>

export type MachineState = Readonly<{
  registers: Readonly<Record<Register, number>>
  memory: Uint8Array
  pc: number
  sp: number
  zf: boolean
  halted: boolean
}>

type RegisterWriteSource = Readonly<{
  source: 'immediate'
}> | Readonly<{
  source: 'addition'
  sourceRegister: Register
}>

export type MachineEvent = Readonly<({
  kind: 'register-write'
  register: Register
  previous: number
  value: number
} & RegisterWriteSource)> | Readonly<{
  kind: 'memory-write'
  address: number
  previous: number
  value: number
  sourceRegister: Register
}> | Readonly<{
  kind: 'halt'
}>

export type StepResult = Readonly<{
  state: MachineState
  events: readonly MachineEvent[]
}>

function completeStep(state: MachineState, changes: Partial<MachineState>, event: MachineEvent): StepResult {
  return {
    state: { ...state, ...changes, pc: state.pc + 1 },
    events: [event],
  }
}

function writeRegister(
  state: MachineState,
  register: Register,
  value: number,
  source: RegisterWriteSource,
  changes: Partial<MachineState> = {},
): StepResult {
  return completeStep(
    state,
    { ...changes, registers: { ...state.registers, [register]: value } },
    { kind: 'register-write', register, previous: state.registers[register], value, ...source },
  )
}

export function createInitialState(): MachineState {
  return {
    registers: { R0: 0, R1: 0, R2: 0, R3: 0 },
    memory: new Uint8Array(256),
    pc: 0,
    sp: 256,
    zf: false,
    halted: false,
  }
}

export function executeInstruction(state: MachineState, instruction: Instruction): StepResult {
  if (state.halted) {
    throw new Error('Machine is halted; reset before stepping again')
  }

  if (!['MOV', 'ADD', 'PUSH', 'HALT'].includes(instruction.operation)) {
    throw new Error(`Unsupported instruction: ${instruction.operation}`)
  }

  if (instruction.operation === 'HALT') {
    return completeStep(state, { halted: true }, { kind: 'halt' })
  }

  if (!REGISTER_NAMES.includes(instruction.register)) {
    throw new RangeError(`Unknown register: ${instruction.register}`)
  }

  const previous = state.registers[instruction.register]

  if (instruction.operation === 'MOV') {
    if (!Number.isInteger(instruction.value) || instruction.value < 0 || instruction.value > 255) {
      throw new RangeError('MOV value must be an integer from 0 to 255')
    }

    return writeRegister(state, instruction.register, instruction.value, { source: 'immediate' })
  }

  if (instruction.operation === 'ADD') {
    if (!REGISTER_NAMES.includes(instruction.source)) {
      throw new RangeError(`Unknown register: ${instruction.source}`)
    }

    const value = (previous + state.registers[instruction.source]) & 0xff
    return writeRegister(
      state,
      instruction.register,
      value,
      { source: 'addition', sourceRegister: instruction.source },
      { zf: value === 0 },
    )
  }

  if (state.sp === 0) {
    throw new RangeError('Stack overflow: no memory remains for PUSH')
  }

  const address = state.sp - 1
  const memory = state.memory.slice()
  const oldByte = memory[address]
  memory[address] = previous

  return completeStep(
    state,
    { memory, sp: address },
    {
      kind: 'memory-write',
      address,
      previous: oldByte,
      value: previous,
      sourceRegister: instruction.register,
    },
  )
}
