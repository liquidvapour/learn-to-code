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
}>

export type MachineState = Readonly<{
  registers: Readonly<Record<Register, number>>
  memory: Uint8Array
  pc: number
  sp: number
  zf: boolean
}>

export type MachineEvent = Readonly<{
  kind: 'register-write'
  register: Register
  previous: number
  value: number
  source: 'immediate'
}> | Readonly<{
  kind: 'register-write'
  register: Register
  previous: number
  value: number
  source: 'addition'
  sourceRegister: Register
}>

export type StepResult = Readonly<{
  state: MachineState
  events: readonly MachineEvent[]
}>

export function createInitialState(): MachineState {
  return {
    registers: { R0: 0, R1: 0, R2: 0, R3: 0 },
    memory: new Uint8Array(256),
    pc: 0,
    sp: 256,
    zf: false,
  }
}

export function executeInstruction(state: MachineState, instruction: Instruction): StepResult {
  if (!['MOV', 'ADD'].includes(instruction.operation)) {
    throw new Error(`Unsupported instruction: ${instruction.operation}`)
  }

  if (!REGISTER_NAMES.includes(instruction.register)) {
    throw new RangeError(`Unknown register: ${instruction.register}`)
  }

  const previous = state.registers[instruction.register]

  if (instruction.operation === 'MOV') {
    if (!Number.isInteger(instruction.value) || instruction.value < 0 || instruction.value > 255) {
      throw new RangeError('MOV value must be an integer from 0 to 255')
    }

    return {
      state: {
        ...state,
        registers: { ...state.registers, [instruction.register]: instruction.value },
        pc: state.pc + 1,
      },
      events: [{
        kind: 'register-write',
        register: instruction.register,
        previous,
        value: instruction.value,
        source: 'immediate',
      }],
    }
  }

  if (!REGISTER_NAMES.includes(instruction.source)) {
    throw new RangeError(`Unknown register: ${instruction.source}`)
  }

  const value = (previous + state.registers[instruction.source]) & 0xff
  return {
    state: {
      ...state,
      registers: { ...state.registers, [instruction.register]: value },
      pc: state.pc + 1,
      zf: value === 0,
    },
    events: [{
      kind: 'register-write',
      register: instruction.register,
      previous,
      value,
      source: 'addition',
      sourceRegister: instruction.source,
    }],
  }
}
