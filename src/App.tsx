const sampleProgram = `MOV R0, 5
MOV R1, 7
ADD R0, R1
PUSH R0
HALT`

function App() {
  return (
    <main className="page">
      <header className="page-header">
        <span className="eyebrow">A visual computer for learning</span>
        <h1>Tiny Machine</h1>
        <p>See what each instruction does to registers, memory, and the stack.</p>
      </header>

      <div className="workspace" aria-label="Tiny Machine workspace">
        <section className="panel" aria-labelledby="program-title">
          <h2 id="program-title">Program</h2>
          <p className="panel-note">The first editable program will live here.</p>
          <pre>{sampleProgram}</pre>
        </section>

        <section className="panel" aria-labelledby="machine-title">
          <h2 id="machine-title">Machine</h2>
          <p className="panel-note">Registers and execution controls are next.</p>
        </section>

        <section className="panel" aria-labelledby="memory-title">
          <h2 id="memory-title">Memory</h2>
          <p className="panel-note">A 256-byte hex explorer will appear here.</p>
        </section>
      </div>
    </main>
  )
}

export default App
