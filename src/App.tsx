import { useEffect, useState } from 'react'
import InstructionDocs from './InstructionDocs'
import {
  createInitialState,
  executeInstruction,
  MEMORY_SIZE,
  REGISTER_NAMES,
  type MachineEvent,
  type MachineState,
} from './machine'

import { parseProgram, SAMPLE_SOURCE } from './program'

const BYTES_PER_ROW = 16
const memoryRows = Array.from({ length: MEMORY_SIZE / BYTES_PER_ROW }, (_, row) => row * BYTES_PER_ROW)

type ExecutionView = {
  machine: MachineState
  lastEvent: MachineEvent | null
}

function hex(value: number, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function asciiCharacter(value: number) {
  return value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
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
  const [showDocs, setShowDocs] = useState(() => window.location.hash === '#instructions')
  useEffect(() => {
    function navigate() {
      setShowDocs(window.location.hash === '#instructions')
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    document.title = showDocs ? 'Instruction reference · Tiny Machine' : 'Tiny Machine'
  }, [showDocs])
  const [source, setSource] = useState(SAMPLE_SOURCE)
  const [programMode, setProgramMode] = useState<'edit' | 'debug'>('edit')
  const { program, errors } = parseProgram(source)
  const [execution, setExecution] = useState<ExecutionView>(() => ({
    machine: createInitialState(),
    lastEvent: null,
  }))

  const { machine, lastEvent } = execution
  const hasNextInstruction = errors.length === 0 && !machine.halted && machine.pc < program.length
  const stackAddresses = Array.from({ length: MEMORY_SIZE - machine.sp }, (_, offset) => machine.sp + offset)

  function step() {
    setExecution((previous) => {
      if (errors.length || previous.machine.halted) return previous
      const next = program[previous.machine.pc]
      if (!next) return previous

      const result = executeInstruction(previous.machine, next.instruction)
      return { machine: result.state, lastEvent: result.events[0] ?? null }
    })
  }

  function reset() {
    setExecution({ machine: createInitialState(), lastEvent: null })
  }

  function editSource(value: string) {
    setSource(value)
    reset()
  }

  function debug() {
    if (errors.length > 0 || program.length === 0) return
    reset()
    setProgramMode('debug')
  }

  return (
    <main className="page">
      <header className="page-header">
        <span className="eyebrow">A visual computer for learning</span>
        <h1>{showDocs ? 'Instruction reference' : 'Tiny Machine'}</h1>
        <p>{showDocs ? 'Syntax, examples, and effects for every supported instruction.' : 'Step through a tiny program and watch the machine change.'}</p>
        <nav className="page-nav" aria-label="Main navigation">
          <a href="#machine" aria-current={!showDocs ? 'page' : undefined}>Machine</a>
          <a href="#instructions" aria-current={showDocs ? 'page' : undefined}>Instruction reference</a>
        </nav>
      </header>

      {showDocs && <InstructionDocs />}
      <div className="workspace" aria-label="Tiny Machine workspace" hidden={showDocs}>
        <section className="panel" aria-labelledby="program-title">
          <h2 id="program-title">Program</h2>
          {programMode === 'edit' ? (
            <>
              <p className="panel-note" id="editor-help">One instruction per line. Debug prepares your program for stepping.</p>
              <label className="editor-label" htmlFor="program-source">Program source</label>
              <textarea
                autoFocus
                id="program-source"
                className="program-editor"
                value={source}
                onChange={(event) => editSource(event.target.value)}
                rows={8}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-describedby="editor-help syntax-help program-errors"
                aria-invalid={errors.length > 0}
              />
              <p className="syntax-help" id="syntax-help">
                Syntax: <code>MOV R0, 5</code> · <code>ADD R0, R1</code> · <code>STORE R2, 0</code> · <code>PUSH R0</code> · <code>HALT</code>.
                {' '}Registers: R0–R3. MOV values and STORE addresses: decimal 0–255. Case and spacing are flexible; blank lines are skipped.
                {' '}<a href="#instructions">Full instruction reference</a>.
              </p>
              <p className="panel-note">The sample stores decimal 65 at address 0: look for hex 41 and ASCII A in the first memory row.</p>
              <div id="program-errors" className="program-errors" aria-live="polite">
                {errors.length > 0 && <ul>{errors.map((error) => (
                  <li key={error.lineNumber}>Line {error.lineNumber}: {error.message}</li>
                ))}</ul>}
              </div>
              <div className="controls">
                <button type="button" onClick={debug} disabled={errors.length > 0 || program.length === 0}>Debug</button>
                <button type="button" className="secondary" onClick={() => editSource(SAMPLE_SOURCE)}>Restore sample</button>
              </div>
              <p className="execution-status" aria-live="polite">
                {errors.length > 0 ? 'Fix the source errors before debugging.' : program.length === 0 ? 'Enter an instruction to begin.' : 'Ready to debug. Use Step to execute one instruction at a time.'}
              </p>
            </>
          ) : (
            <>
              <ol className="program-list" aria-label="Parsed instructions with source line numbers">
                {program.map((line, index) => (
                  <li
                    key={index}
                    className={hasNextInstruction && index === machine.pc ? 'program-line active' : 'program-line'}
                    aria-current={hasNextInstruction && index === machine.pc ? 'step' : undefined}
                  >
                    <span className="line-number">{line.lineNumber}</span>
                    <code>{line.source}</code>
                    {hasNextInstruction && index === machine.pc && <span className="next-marker">Next</span>}
                  </li>
                ))}
              </ol>
              <div className="controls">
                <button autoFocus type="button" onClick={step} disabled={!hasNextInstruction}>Step</button>
                <button type="button" className="secondary" onClick={reset}>Reset</button>
                <button type="button" className="secondary" onClick={() => setProgramMode('edit')}>Edit</button>
              </div>
              <p className="execution-status" aria-live="polite">
                {errors.length > 0 ? 'Fix the source errors before stepping.' : machine.halted
                  ? 'Machine halted.'
                  : hasNextInstruction ? `Next: line ${program[machine.pc].lineNumber} (PC ${machine.pc})` : program.length === 0 ? 'Enter an instruction to begin.' : 'Program complete.'}
              </p>
            </>
          )}
        </section>

        <div className="machine-state">
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

          <section className="panel" aria-labelledby="stack-title">
            <h2 id="stack-title">Stack</h2>
            <p className="panel-note">The stack grows toward lower addresses: 0xFF, 0xFE, 0xFD…</p>
            <p className="stack-usage" aria-live="polite">
              Stack: {stackAddresses.length} {stackAddresses.length === 1 ? 'byte' : 'bytes'} used · {machine.sp} bytes remaining
            </p>
            <p className="stack-pointer">SP: {hex(machine.sp)}{machine.sp === MEMORY_SIZE ? ' (empty; just past the end of memory)' : ' (top of stack)'}</p>
            <h3>Stack close-up <span>(top first)</span></h3>
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

          <section className="panel" aria-labelledby="memory-title">
            <h2 id="memory-title">Memory</h2>
            <p className="panel-note">All 256 memory bytes, shown in hexadecimal. The stack above is another view of this same memory.</p>
            <div className="memory-legend">
              <span><span className="legend-swatch stack-used" aria-hidden="true" /> Occupied stack</span>
              <span><span className="legend-swatch stack-top" aria-hidden="true" /> SP: top of stack</span>
            </div>
            <div className="memory-grid" role="region" aria-label="Memory hex grid" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Address</th>
                    {Array.from({ length: BYTES_PER_ROW }, (_, offset) => (
                      <th scope="col" key={offset}>+{offset.toString(16).toUpperCase()}</th>
                    ))}
                    <th scope="col">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {memoryRows.map((startAddress) => (
                    <tr key={startAddress}>
                      <th scope="row">{hex(startAddress)}</th>
                      {Array.from({ length: BYTES_PER_ROW }, (_, offset) => {
                        const address = startAddress + offset
                        const value = machine.memory[address]
                        const isStack = address >= machine.sp
                        const isTop = address === machine.sp
                        return (
                          <td
                            key={offset}
                            className={isStack ? `stack-used${isTop ? ' stack-top' : ''}` : undefined}
                            aria-label={`${hex(address)}: ${hex(value)}${isTop ? ', SP, top of stack' : isStack ? ', occupied stack' : ''}`}
                          >
                            {value.toString(16).toUpperCase().padStart(2, '0')}
                            {isTop && <span className="stack-top-label">SP</span>}
                          </td>
                        )
                      })}
                      <td className="ascii-view">
                        {Array.from({ length: BYTES_PER_ROW }, (_, offset) => asciiCharacter(machine.memory[startAddress + offset])).join('')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
