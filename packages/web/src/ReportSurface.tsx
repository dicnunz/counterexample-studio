import { useState } from "react";
import type { CaseRunReport, SearchTraceNode, SuiteRunReport } from "@counterexample-studio/core";
import { buildReplayCommand, formatDuration } from "./formatters";
import { preferredCase, reportFilename, serializeReport } from "./reportIO";

export interface ReportSession {
  readonly report: SuiteRunReport;
  readonly elapsedMs: number | null;
  readonly sourceLabel: string;
  readonly imported: boolean;
}

export function ReportSurface({ session, busy, onReplay }: {
  session: ReportSession;
  busy: boolean;
  onReplay: (entry: CaseRunReport, paths: { modulePath: string; propertyPath: string }) => void;
}) {
  const { report } = session;
  const [caseId, setCaseId] = useState(preferredCase(report).id);
  const entry = report.cases.find((item) => item.id === caseId) ?? preferredCase(report);
  const failures = report.cases.filter((item) => item.status === "fail").length;
  const failed = entry.status === "fail";
  function download() {
    const url = URL.createObjectURL(new Blob([serializeReport(report)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportFilename(report);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <article className="report-surface" aria-label="Run report">
    <div className="report-heading">
      <div>
        <div className="title-line"><h1>{entry.label}</h1><span className={`status status-${entry.status}`}>{failed ? "Failed" : "Passed"}</span></div>
        <p className="report-subtitle">{failed ? "Counterexample found." : `Passed all ${entry.numRuns} sampled runs. No counterexample found.`}</p>
        <p className="report-origin">{session.sourceLabel} · {session.elapsedMs === null ? new Date(report.generatedAt).toLocaleString() : formatDuration(session.elapsedMs)}</p>
      </div>
      <button className="button" type="button" onClick={download}>Export JSON</button>
    </div>
    <dl className="metrics">
      <Metric label="Seed" value={String(entry.seed)} />
      <Metric label={failed ? "Runs before failure" : "Sampled runs"} value={String(entry.numRuns)} />
      <Metric label={failed ? "Accepted shrinks" : "Sampling budget"} value={String(failed ? entry.numShrinks : entry.requestedRuns ?? entry.numRuns)} />
      <Metric label={failed ? "Shrink path" : "Result"} value={failed ? entry.counterexamplePath ?? "Unavailable" : "Property holds"} />
    </dl>
    <div className="suite-strip">
      <p><strong>{report.cases.length} {report.cases.length === 1 ? "property" : "properties"}</strong><span>{report.cases.length - failures} passed · {failures} failed</span></p>
      {report.cases.length > 1 ? <label className="case-picker"><span>Inspect property</span><select value={entry.id} onChange={(event) => setCaseId(event.currentTarget.value)}>{report.cases.map((item) => <option key={item.id} value={item.id}>{item.status === "fail" ? "FAIL" : "PASS"} · {item.label}</option>)}</select></label> : <span className="muted">{report.title}</span>}
    </div>
    <section className="evidence-section">
      <h2>{failed ? "Counterexample" : "Invariant satisfied"}</h2>
      <p className="invariant"><span className="sr-only">Invariant: </span><code>{entry.invariant}</code></p>
      {failed ? <div className="evidence-grid">
        <CodeFrame label="Failing input" value={entry.failingInput?.preview ?? "No failing input was recorded."} />
        <CodeFrame label="Expected" detail={entry.expected?.label} value={entry.expected?.value.preview ?? "No expected value was recorded."} />
        <CodeFrame label="Actual" detail={entry.actual?.label} value={entry.actual?.value.preview ?? "No actual value was recorded."} tone="fail" />
      </div> : <div className="success-note"><span className="success-check" aria-hidden="true">✓</span><div><strong>Run passed</strong><p>The property held for this sample and seed. A passing sample does not prove the property for every possible input.</p></div></div>}
    </section>
    <ReplaySection key={entry.id} entry={entry} imported={session.imported} busy={busy} onReplay={onReplay} />
    <ReportDetails key={`details-${entry.id}`} entry={entry} />
  </article>;
}

function ReplaySection({ entry, imported, busy, onReplay }: {
  entry: CaseRunReport; imported: boolean; busy: boolean;
  onReplay: (entry: CaseRunReport, paths: { modulePath: string; propertyPath: string }) => void;
}) {
  const [modulePath, setModulePath] = useState(entry.modulePath);
  const [propertyPath, setPropertyPath] = useState(entry.propertiesPath);
  const failed = entry.status === "fail";
  return <section className="replay-section">
    <div className="section-heading"><div><h2>{failed ? "Reproduce this failure" : "Repeat this sample"}</h2><p>{failed ? "Replay the saved seed, case, and shrink path against your local files." : "Run the same property again with its saved seed and sampling budget."}</p></div><button className="button button-primary" data-testid="rerun-button" type="button" disabled={busy || !modulePath.trim() || !propertyPath.trim()} onClick={() => onReplay(entry, { modulePath, propertyPath })}>{busy ? "Running…" : failed ? "Replay exact failure" : "Rerun same seed"}</button></div>
    <CopyableCode label="Copy command" value={buildReplayCommand(entry, { modulePath, propertyPath })} />
    {entry.requestedRuns === undefined && failed ? <p className="legacy-note">This older report does not record its sampling budget. Replay uses 100 runs; the saved seed and path are retained.</p> : null}
    <details className="source-disclosure"><summary>{imported ? "Review local files before replay" : "Change replay file paths"}</summary><p>Importing does not execute code. Replay runs these JS/TS files on the machine serving Studio. Relative paths resolve from the directory where Studio started.</p><div className="path-grid"><label className="field"><span>Replay target module</span><input value={modulePath} onChange={(event) => setModulePath(event.currentTarget.value)} /></label><label className="field"><span>Replay property definition</span><input value={propertyPath} onChange={(event) => setPropertyPath(event.currentTarget.value)} /></label></div></details>
  </section>;
}

function ReportDetails({ entry }: { entry: CaseRunReport }) {
  const tabs = entry.status === "fail" ? ["Shrink path", "Search trace", "Reproduction", "Sources"] : ["Search trace", "Sources"];
  const [tab, setTab] = useState(tabs[0]!);
  const trace = flattenTrace(entry.searchTrace);
  return <section className="details-section">
    <div className="detail-tabs" aria-label="Report details">{tabs.map((label) => <button type="button" key={label} aria-pressed={tab === label} className={tab === label ? "detail-tab selected" : "detail-tab"} onClick={() => setTab(label)}>{label}</button>)}</div>
    <div className="detail-content">
      {tab === "Shrink path" ? <><p className="detail-caption">Recorded failing candidates in execution order. The final row is the minimal witness.</p>{entry.shrinkTrace.length ? <div className="table-scroll"><table><thead><tr><th>Step</th><th>Description</th><th>Input</th><th>Actual</th></tr></thead><tbody>{entry.shrinkTrace.map((step, index) => <tr key={index}><td className="step-number">{index + 1}</td><td>{step.label}</td><td><code>{compact(step.input.preview)}</code></td><td><code>{compact(step.actual.value.preview)}</code></td></tr>)}</tbody></table></div> : <p className="empty-copy">No shrinking candidates were recorded for this run.</p>}</> : null}
      {tab === "Search trace" ? <><p className="detail-caption">{trace.length} recorded attempts. Search nodes contain generated inputs; actual outputs are only recorded for failing candidates.</p>{trace.length ? <div className="table-scroll"><table><thead><tr><th>Attempt</th><th>Outcome</th><th>Depth</th><th>Generated input</th></tr></thead><tbody>{trace.slice(0, 300).map((node, index) => <tr key={index}><td className="step-number">{index + 1}</td><td><span className={`trace-outcome outcome-${node.status}`}>{node.status}</span></td><td>{node.depth}</td><td><code>{compact(node.value.preview)}</code></td></tr>)}</tbody></table></div> : <p className="empty-copy">The engine recorded no search attempts.</p>}{trace.length > 300 ? <p className="detail-caption">Showing the first 300 attempts. Export JSON includes the complete trace.</p> : null}</> : null}
      {tab === "Reproduction" ? <><p className="detail-caption">The engine’s minimal reproduction snippet. Run TypeScript snippets through your usual TS runner.</p>{entry.reproductionSnippet ? <CopyableCode label="Copy snippet" value={entry.reproductionSnippet} /> : <p className="empty-copy">No reproduction snippet was recorded.</p>}</> : null}
      {tab === "Sources" ? <dl className="source-list"><Metric label="Target module" value={entry.modulePath} /><Metric label="Export" value={entry.functionName} /><Metric label="Property definition" value={entry.propertiesPath} /><Metric label="Property ID" value={entry.id} /><Metric label="Sampling budget" value={entry.requestedRuns === undefined ? "Not recorded" : String(entry.requestedRuns)} /></dl> : null}
    </div>
    {entry.notes.length ? <ul className="report-notes">{entry.notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : null}
  </section>;
}

function flattenTrace(nodes: readonly SearchTraceNode[], depth = 0): (SearchTraceNode & { depth: number })[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flattenTrace(node.children, depth + 1)]);
}

function compact(value: string): string { return value.replace(/\s+/g, " "); }

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function CodeFrame({ label, detail, value, tone }: { label: string; detail?: string | undefined; value: string; tone?: "fail" }) {
  return <div className={tone ? `code-frame code-${tone}` : "code-frame"}><div className="code-heading"><strong>{label}</strong>{detail ? <span>{detail}</span> : null}</div><pre>{value}</pre></div>;
}

export function CopyableCode({ label, value }: { label: string; value: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopyState("copied"); }
    catch { setCopyState("error"); }
  }
  return <div className="copyable"><pre>{value}</pre><button type="button" className="button" onClick={() => void copy()}>{copyState === "copied" ? "Copied" : label}</button>{copyState === "error" ? <p role="status" className="copy-error">Clipboard unavailable. Select and copy the text above.</p> : null}</div>;
}
