export const REGISTER_NAMES = ['R0', 'R1', 'R2', 'R3'] as const
export const MEMORY_SIZE = 256
const MAX_BYTE = 0xff

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
  operation: 'STORE' | 'LOAD'
  register: Register
  address: number
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
}> | Readonly<{
  source: 'memory'
  address: number
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

function readRegister(state: MachineState, register: Register): number {
  if (!REGISTER_NAMES.includes(register)) {
    throw new RangeError(`Unknown register: ${register}`)
  }
  return state.registers[register]
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
    { kind: 'register-write', register, previous: readRegister(state, register), value, ...source },
  )
}

function unsupportedInstruction(instruction: never): never {
  throw new Error(`Unsupported instruction: ${(instruction as { operation: string }).operation}`)
}

export function createInitialState(): MachineState {
  return {
    registers: { R0: 0, R1: 0, R2: 0, R3: 0 },
    memory: new Uint8Array(MEMORY_SIZE),
    pc: 0,
    sp: MEMORY_SIZE,
    zf: false,
    halted: false,
  }
}

const InstrictionMOV = 'MOV'
const InstrictionADD = 'ADD'

type MOVInstruction = Extract<Instruction, { operation: typeof InstrictionMOV }>
type ADDInstruction = Extract<Instruction, { operation: typeof InstrictionADD }>

function move(
  state: MachineState, 
  instruction: MOVInstruction
) {
  if (
    !Number.isInteger(instruction.value) || 
    instruction.value < 0 || 
    instruction.value > MAX_BYTE
  ) {
    throw new RangeError('MOV value must be an integer from 0 to 255')
  }
  return writeRegister(
    state, 
    instruction.register, 
    instruction.value, 
    { source: 'immediate' }
  )
}

function add(state: MachineState, instruction: ADDInstruction) {
  const value = (readRegister(state, instruction.register) + readRegister(state, instruction.source)) & MAX_BYTE
  return writeRegister(
    state,
    instruction.register,
    value,
    { source: 'addition', sourceRegister: instruction.source },
    { zf: value === 0 },
  )
}


export function executeInstruction(state: MachineState, instruction: Instruction): StepResult {
  if (state.halted) {
    throw new Error('Machine is halted; reset before stepping again')
  }

  switch (instruction.operation) {
    case InstrictionMOV: {
      return move(state, instruction)
    }
    case InstrictionADD: {
      return add(state, instruction)
    }
    case 'STORE': {
      const { address } = instruction
      if (!Number.isInteger(address) || address < 0 || address >= MEMORY_SIZE) {
        throw new RangeError('STORE address must be an integer from 0 to 255')
      }
      const value = readRegister(state, instruction.register)
      const memory = state.memory.slice()
      const previous = memory[address]
      memory[address] = value

      return completeStep(state, { memory }, {
        kind: 'memory-write',
        address,
        previous,
        value,
        sourceRegister: instruction.register,
      })
    }
    case 'LOAD':
      const { register, address } = instruction
      if (!Number.isInteger(address) || address < 0 || address >= MEMORY_SIZE) {
        throw new RangeError('STORE address must be an integer from 0 to 255')
      }
      const memory = state.memory.slice()
      const value = memory[address]
      return writeRegister(state, register, value, { source: 'memory', sourceRegister: register })
    case 'PUSH': {
      const value = readRegister(state, instruction.register)
      if (state.sp === 0) {
        throw new RangeError('Stack overflow: no memory remains for PUSH')
      }

      const address = state.sp - 1
      const memory = state.memory.slice()
      const previous = memory[address]
      memory[address] = value

      return completeStep(state, { memory, sp: address }, {
        kind: 'memory-write',
        address,
        previous,
        value,
        sourceRegister: instruction.register,
      })
    }

    case 'HALT':
      return completeStep(state, { halted: true }, { kind: 'halt' })
    default:
      return unsupportedInstruction(instruction)
  }
}
