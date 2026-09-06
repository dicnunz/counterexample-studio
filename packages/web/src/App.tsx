import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseRunReport } from "@counterexample-studio/core";
import type { BundledExample } from "./model";
import { createStudioClient, defaultLocalPathDraft } from "./studioClient";
import type { EngineResult } from "./studioClient";
import { ReportSurface, CopyableCode } from "./ReportSurface";
import type { ReportSession } from "./ReportSurface";
import { ImportReport } from "./ImportReport";

const client = createStudioClient();

export function App() {
  const [mode, setMode] = useState<"bundled" | "local">("bundled");
  const [examples, setExamples] = useState<readonly BundledExample[]>([]);
  const [exampleId, setExampleId] = useState("");
  const [seed, setSeed] = useState("87492311");
  const [runs, setRuns] = useState("100");
  const [localDraft, setLocalDraft] = useState(defaultLocalPathDraft);
  const [session, setSession] = useState<ReportSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [runError, setRunError] = useState("");
  const [notice, setNotice] = useState("");
  const [showImport, setShowImport] = useState(false);
  const requestId = useRef(0);
  const autoRunStarted = useRef(false);
  const catalogRequest = useRef(0);
  const selected = examples.find((example) => example.id === exampleId);
  const pair = examples.find((example) => example.family === selected?.family && example.id !== exampleId);

  const execute = useCallback(async (task: () => Promise<EngineResult>, sourceLabel: string, previous?: CaseRunReport) => {
    autoRunStarted.current = true;
    const id = ++requestId.current;
    setBusy(true); setRunError(""); setNotice("");
    try {
      const result = await task();
      if (id !== requestId.current) return;
      setSession({ ...result, sourceLabel, imported: false });
      if (previous) {
        const current = result.report.cases.find((entry) => entry.id === previous.id);
        setNotice(current?.status === "pass"
          ? previous.status === "fail" ? "Replay passed. The saved failure no longer occurs with these files." : "Replay passed with the same seed and sampling budget."
          : JSON.stringify(current?.failingInput?.json) === JSON.stringify(previous.failingInput?.json)
            ? "Failure reproduced. The minimal witness matches the saved report."
            : "The property still fails, but the witness changed. Check whether the target or property definition changed.");
      }
    } catch (reason) {
      if (id === requestId.current) setRunError(reason instanceof Error ? reason.message : "The run could not complete.");
    } finally { if (id === requestId.current) setBusy(false); }
  }, []);

  const loadExamples = useCallback(async () => {
    const id = ++catalogRequest.current;
    setBooting(true); setCatalogError("");
    try {
      const next = await client.listBundledExamples();
      if (id !== catalogRequest.current) return;
      setExamples(next);
      const first = next[0];
      if (first) {
        setExampleId(first.id); setSeed(String(first.defaultSeed)); setRuns(String(first.defaultRuns));
        if (!autoRunStarted.current) {
          autoRunStarted.current = true;
          void execute(() => client.runBundledExample({ exampleId: first.id, seed: first.defaultSeed, runs: first.defaultRuns }), `Bundled · ${first.title}`);
        }
      }
    } catch (reason) { if (id === catalogRequest.current) setCatalogError(reason instanceof Error ? reason.message : "Could not load examples."); }
    finally { if (id === catalogRequest.current) setBooting(false); }
  }, [execute]);

  useEffect(() => {
    const catalogCounter = catalogRequest;
    const runCounter = requestId;
    void loadExamples();
    return () => { catalogCounter.current++; runCounter.current++; };
  }, [loadExamples]);

  function selectExample(id: string, autoRun = true, preserveSettings = false) {
    const example = examples.find((item) => item.id === id);
    if (!example) return;
    const settings = preserveSettings ? readSettings() : { seed: example.defaultSeed, runs: example.defaultRuns };
    if (!settings) return;
    setExampleId(id); setSeed(String(settings.seed)); setRuns(String(settings.runs));
    if (autoRun) void execute(() => client.runBundledExample({ exampleId: id, ...settings }), `Bundled · ${example.title}`);
  }

  function readSettings() {
    const seedValue = Number(seed), runsValue = Number(runs);
    if (!seed.trim() || !Number.isInteger(seedValue) || seedValue < -2147483648 || seedValue > 2147483647) { setRunError("Seed must be a whole number from -2147483648 to 2147483647."); return null; }
    if (!runs.trim() || !Number.isInteger(runsValue) || runsValue < 1 || runsValue > 10000) { setRunError("Runs must be a whole number from 1 to 10,000."); return null; }
    return { seed: seedValue, runs: runsValue };
  }

  function run() {
    const settings = readSettings();
    if (!settings) return;
    if (mode === "bundled" && selected) void execute(() => client.runBundledExample({ exampleId: selected.id, ...settings }), `Bundled · ${selected.title}`);
    if (mode === "local") void execute(() => client.runLocalPath({ ...localDraft, ...settings }), `Local files · ${localDraft.modulePath}`);
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Counterexample Studio home"><span className="brand-mark" aria-hidden="true">[ ]</span><span>Counterexample Studio</span></a><div className="topbar-actions"><span className="engine-label"><span aria-hidden="true" />Local engine</span><button type="button" className="button" onClick={() => setShowImport(true)}>Import JSON</button></div></header>
    <div className="workspace">
      <aside className="sidebar" aria-label="Run configuration">
        <div className="mode-switch" aria-label="Run source"><button type="button" aria-pressed={mode === "bundled"} className={mode === "bundled" ? "selected" : ""} onClick={() => setMode("bundled")}>Examples</button><button type="button" aria-pressed={mode === "local"} className={mode === "local" ? "selected" : ""} onClick={() => setMode("local")}>Local files</button></div>
        <form className="run-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
          <h2>Run configuration</h2>
          {mode === "bundled" ? <><label className="field"><span>Bundled example</span><select data-testid="example-picker" value={exampleId} onChange={(event) => selectExample(event.currentTarget.value)} disabled={booting || !examples.length}>{booting ? <option>Loading examples…</option> : examples.map((example) => <option key={example.id} value={example.id}>{example.title}</option>)}</select></label>{selected ? <p className="field-help">{selected.description}</p> : null}{catalogError ? <div className="catalog-error"><p role="alert">{catalogError}</p><button type="button" className="button" onClick={() => void loadExamples()}>Retry connection</button></div> : null}</> : <div className="local-fields"><label className="field"><span>Target module</span><input value={localDraft.modulePath} onChange={(event) => setLocalDraft({ ...localDraft, modulePath: event.currentTarget.value })} required /></label><label className="field"><span>Property definition</span><input value={localDraft.propertyPath} onChange={(event) => setLocalDraft({ ...localDraft, propertyPath: event.currentTarget.value })} required /></label><label className="field"><span>Export override <small>optional</small></span><input placeholder="Use property definitions" value={localDraft.exportName} onChange={(event) => setLocalDraft({ ...localDraft, exportName: event.currentTarget.value })} /></label><p className="field-help">Paths resolve from the directory where you started Studio.</p></div>}
          <div className="run-settings"><label className="field"><span>Seed</span><input inputMode="numeric" value={seed} onChange={(event) => setSeed(event.currentTarget.value)} /></label><label className="field"><span>Runs</span><input inputMode="numeric" value={runs} onChange={(event) => setRuns(event.currentTarget.value)} /></label></div>
          <button className="button button-primary run-button" data-testid="run-button" type="submit" disabled={busy || (mode === "bundled" && !selected)}>{busy ? "Running…" : "Run property tests"}</button>
          {mode === "bundled" && pair ? <button className="button pair-button" type="button" onClick={() => selectExample(pair.id, true, true)} disabled={busy}>Try {pair.version} version</button> : null}
        </form>
        {mode === "local" ? <details className="cli-preview"><summary>Matching CLI command</summary><CopyableCode label="Copy command" value={client.getLocalPreviewCommand({ ...localDraft, seed: Number(seed) || 0, runs: Number(runs) || 100 })} /></details> : null}
        <div className="sidebar-footnote"><p>Synchronous JS / TS</p><p>Everything runs on your machine.</p><a href="https://github.com/dicnunz/counterexample-studio#property-config" target="_blank" rel="noreferrer">Writing a property definition <span aria-hidden="true">↗</span></a></div>
      </aside>
      <main className="main-column" aria-busy={busy}>
        {runError ? <div className="error-banner" role="alert"><strong>Execution blocked</strong><p>{runError}</p><p>{session ? "The previous report is preserved below. Fix the issue, then retry the run or replay." : "Check your paths or local engine, then retry with the same seed."}</p><button className="button" type="button" onClick={() => setRunError("")}>Dismiss</button></div> : null}
        {notice ? <p className="notice-banner" role="status">{notice}</p> : null}
        {busy ? <p className="running-banner" role="status"><span className="spinner" aria-hidden="true" />Executing the local property engine…{session ? " Previous report shown below." : ""}</p> : null}
        {session ? <ReportSurface key={`${session.report.generatedAt}-${session.sourceLabel}`} session={session} busy={busy} onReplay={(entry, paths) => void execute(() => client.replayCase(entry, paths), `Replay · ${entry.label}`, entry)} /> : !busy ? <div className="empty-state"><h1>Find the input that breaks your assumptions.</h1><p>Run a bundled example, point Studio at your own files, or open an existing JSON report.</p><button className="button" type="button" onClick={() => setShowImport(true)}>Import a report</button></div> : null}
      </main>
    </div>
    {showImport ? <ImportReport onClose={() => setShowImport(false)} onImport={(report, name) => { autoRunStarted.current = true; requestId.current++; setBusy(false); setRunError(""); setNotice("Report imported. No code was executed."); setSession({ report, elapsedMs: null, sourceLabel: `Imported · ${name}`, imported: true }); }} /> : null}
  </div>;
}
