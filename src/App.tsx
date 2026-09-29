import { useState } from 'react'
import {
  createInitialState,
  executeInstruction,
  MEMORY_SIZE,
  REGISTER_NAMES,
  type Instruction,
  type MachineEvent,
  type MachineState,
} from './machine'

const program: readonly { source: string; instruction: Instruction }[] = [
  { source: 'MOV R0, 5', instruction: { operation: 'MOV', register: 'R0', value: 5 } },
  { source: 'MOV R1, 7', instruction: { operation: 'MOV', register: 'R1', value: 7 } },
  { source: 'ADD R0, R1', instruction: { operation: 'ADD', register: 'R0', source: 'R1' } },
  { source: 'PUSH R0', instruction: { operation: 'PUSH', register: 'R0' } },
  { source: 'HALT', instruction: { operation: 'HALT' } },
]

type ExecutionView = {
  machine: MachineState
  lastEvent: MachineEvent | null
}

function hex(value: number, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function describeEvent(event: MachineEvent | null) {
  if (event === null) return 'Press Step to execute the highlighted instruction.'
  if (event.kind === 'halt') return 'HALT stopped execution. Reset to run again.'
  if (event.kind === 'memory-write') {
    return `${event.sourceRegister} → memory ${hex(event.address)}: ${event.value}`
  }
  return `${event.register}: ${event.previous} → ${event.value}`
}

function App() {
  const [execution, setExecution] = useState<ExecutionView>(() => ({
    machine: createInitialState(),
    lastEvent: null,
  }))

  const { machine, lastEvent } = execution
  const hasNextInstruction = !machine.halted && machine.pc < program.length
  const stackAddresses = Array.from({ length: MEMORY_SIZE - machine.sp }, (_, offset) => machine.sp + offset)

  function step() {
    setExecution((previous) => {
      const next = program[previous.machine.pc]
      if (!next) return previous

      const result = executeInstruction(previous.machine, next.instruction)
      return { machine: result.state, lastEvent: result.events[0] ?? null }
    })
  }

  function reset() {
    setExecution({ machine: createInitialState(), lastEvent: null })
  }

  return (
    <main className="page">
      <header className="page-header">
        <span className="eyebrow">A visual computer for learning</span>
        <h1>Tiny Machine</h1>
        <p>Step through a tiny program and watch the machine change.</p>
      </header>

      <div className="workspace" aria-label="Tiny Machine workspace">
        <section className="panel" aria-labelledby="program-title">
          <h2 id="program-title">Program</h2>
          <p className="panel-note">A fixed demo. Text editing comes later.</p>
          <ol className="program-list">
            {program.map((line, index) => (
              <li
                key={index}
                className={index === machine.pc ? 'program-line active' : 'program-line'}
                aria-current={index === machine.pc ? 'step' : undefined}
              >
                <span className="line-number">{index + 1}</span>
                <code>{line.source}</code>
                {index === machine.pc && <span className="next-marker">Next</span>}
              </li>
            ))}
          </ol>
          <div className="controls">
            <button type="button" onClick={step} disabled={!hasNextInstruction}>Step</button>
            <button type="button" className="secondary" onClick={reset}>Reset</button>
          </div>
          <p className="execution-status" aria-live="polite">
            {machine.halted
              ? 'Machine halted.'
              : hasNextInstruction ? `Next instruction: ${machine.pc}` : 'Program complete.'}
          </p>
        </section>

        <section className="panel" aria-labelledby="machine-title">
          <h2 id="machine-title">Machine</h2>
          <p className="panel-note">Registers hold one byte each.</p>
          <dl className="register-list">
            {REGISTER_NAMES.map((register) => (
              <div className="register" key={register}>
                <dt>{register}</dt>
                <dd>{machine.registers[register]}</dd>
              </div>
            ))}
          </dl>
          <p className="flag-value">Zero flag (ZF): <strong>{machine.zf ? '1' : '0'}</strong></p>
          <p className="step-explanation" aria-live="polite">
            {describeEvent(lastEvent)}
          </p>
        </section>

        <section className="panel" aria-labelledby="memory-title">
          <h2 id="memory-title">Memory</h2>
          <p className="panel-note">The stack stores bytes in machine memory. The full hex explorer comes next.</p>
          <p className="stack-pointer">SP: {hex(machine.sp)}{machine.sp === MEMORY_SIZE ? ' (empty)' : ''}</p>
          <h3>Stack <span>(top first)</span></h3>
          {stackAddresses.length === 0 ? (
            <p className="empty-stack">No values pushed yet.</p>
          ) : (
            <table className="stack-table">
              <thead><tr><th scope="col">Address</th><th scope="col">Hex</th><th scope="col">Dec</th></tr></thead>
              <tbody>
                {stackAddresses.map((address) => (
                  <tr key={address}>
                    <th scope="row">{hex(address)}</th>
                    <td>{hex(machine.memory[address])}</td>
                    <td>{machine.memory[address]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
