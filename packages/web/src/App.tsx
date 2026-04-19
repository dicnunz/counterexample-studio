import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { formatDuration, formatInputTuple, formatJson, formatSeed } from "./formatters";
import type {
  BundledExample,
  LocalPathDraft,
  RunReport,
  ShrinkEntry,
  TraceEntry
} from "./model";
import { createDemoStudioClient, defaultLocalPathDraft } from "./studioClient";

const client = createDemoStudioClient();

export function App() {
  const [sourceMode, setSourceMode] = useState<"bundled" | "local">("bundled");
  const [examples, setExamples] = useState<readonly BundledExample[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState("");
  const [exampleQuery, setExampleQuery] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [runsInput, setRunsInput] = useState("");
  const [bundledReport, setBundledReport] = useState<RunReport | null>(null);
  const [localDraft, setLocalDraft] = useState<LocalPathDraft>(defaultLocalPathDraft);
  const [localReport, setLocalReport] = useState<RunReport | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isRunningBundled, setIsRunningBundled] = useState(false);
  const [isRunningLocal, setIsRunningLocal] = useState(false);
  const bundledRequestRef = useRef(0);
  const localRequestRef = useRef(0);
  const deferredQuery = useDeferredValue(exampleQuery);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const nextExamples = await client.listBundledExamples();

      if (disposed) {
        return;
      }

      setExamples(nextExamples);
      setIsBooting(false);

      const initialExample = nextExamples.find((example) => example.expectedOutcome === "fail") ?? nextExamples[0];

      if (!initialExample) {
        return;
      }

      setSelectedExampleId(initialExample.id);
      setSeedInput(String(initialExample.defaultSeed));
      setRunsInput(String(initialExample.defaultRuns));
      void runBundledExample(initialExample, initialExample.defaultSeed, initialExample.defaultRuns);
    })();

    return () => {
      disposed = true;
    };
  }, []);

  const selectedExample = examples.find((example) => example.id === selectedExampleId);
  const filteredExamples = examples.filter((example) => matchesExample(example, deferredQuery));
  const parsedSeed = parseSeed(seedInput, selectedExample?.defaultSeed ?? defaultLocalPathDraft.seed);
  const parsedRuns = parseRuns(runsInput, selectedExample?.defaultRuns ?? defaultLocalPathDraft.runs);
  const activeReport = sourceMode === "bundled" ? bundledReport : localReport;

  async function runBundledExample(example: BundledExample, seed: number, runs: number) {
    const requestId = ++bundledRequestRef.current;
    setIsRunningBundled(true);

    try {
      const nextReport = await client.runBundledExample({
        exampleId: example.id,
        seed,
        runs
      });

      if (requestId !== bundledRequestRef.current) {
        return;
      }

      setBundledReport(nextReport);
    } finally {
      if (requestId === bundledRequestRef.current) {
        setIsRunningBundled(false);
      }
    }
  }

  async function runLocalPath(draft: LocalPathDraft) {
    const requestId = ++localRequestRef.current;
    setIsRunningLocal(true);

    try {
      const nextReport = await client.runLocalPath(draft);

      if (requestId !== localRequestRef.current) {
        return;
      }

      setLocalReport(nextReport);
    } finally {
      if (requestId === localRequestRef.current) {
        setIsRunningLocal(false);
      }
    }
  }

  function handleExampleSelect(example: BundledExample) {
    setSelectedExampleId(example.id);
    setSeedInput(String(example.defaultSeed));
    setRunsInput(String(example.defaultRuns));
    void runBundledExample(example, example.defaultSeed, example.defaultRuns);
  }

  function handleExampleSelectById(nextExampleId: string) {
    const nextExample = examples.find((example) => example.id === nextExampleId);
    if (nextExample) {
      handleExampleSelect(nextExample);
    }
  }

  function handleBundledRun() {
    if (!selectedExample) {
      return;
    }

    setSeedInput(String(parsedSeed));
    setRunsInput(String(parsedRuns));
    void runBundledExample(selectedExample, parsedSeed, parsedRuns);
  }

  function handleLocalRun() {
    void runLocalPath(localDraft);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">Counterexample Studio</p>
          <h1>Counterexample Studio turns property runs into sharp, local counterexamples.</h1>
          <p className="lede">
            Run the real local engine from the browser and keep the exact seed, rerun command,
            shrink path, search trace, and invariant-versus-actual view visible while you debug.
          </p>
        </div>

        <div className="adapter-card">
          <p className="adapter-label">Execution engine</p>
          <strong>{client.adapterName}</strong>
          <p>
            Bundled examples and your own files both execute through the same localhost engine.
          </p>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="sidebar">
          <Panel
            eyebrow="Workspace"
            title="Run source"
            description="Switch between bundled walkthroughs and your own module plus property files."
          >
            <div className="mode-switch" role="tablist" aria-label="Run source">
              <button
                type="button"
                className={sourceMode === "bundled" ? "mode-tab is-active" : "mode-tab"}
                onClick={() => setSourceMode("bundled")}
              >
                Bundled examples
              </button>
              <button
                type="button"
                className={sourceMode === "local" ? "mode-tab is-active" : "mode-tab"}
                onClick={() => setSourceMode("local")}
              >
                Local paths
              </button>
            </div>
          </Panel>

          {sourceMode === "bundled" ? (
            <>
              <Panel
                eyebrow="Catalog"
                title="Bundled examples"
                description="Paired buggy and fixed algorithms for quick fail-versus-pass inspection."
              >
                <label className="field">
                  <span>Filter</span>
                  <input
                    value={exampleQuery}
                    onChange={(event) => setExampleQuery(event.currentTarget.value)}
                    placeholder="Search examples"
                  />
                </label>

                <label className="field">
                  <span>Bundled example</span>
                  <select
                    data-testid="example-picker"
                    value={selectedExampleId}
                    onChange={(event) => handleExampleSelectById(event.currentTarget.value)}
                  >
                    {filteredExamples.map((example) => (
                      <option key={example.id} value={example.id}>
                        {example.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="example-list" role="list">
                  {isBooting ? <LoadingState text="Loading bundled examples..." /> : null}

                  {!isBooting && filteredExamples.length === 0 ? (
                    <EmptyState
                      title="No examples match"
                      body="Try a family name like binary or angle."
                    />
                  ) : null}

                  {filteredExamples.map((example) => {
                    const isSelected = example.id === selectedExampleId;

                    return (
                      <button
                        key={example.id}
                        type="button"
                        className={isSelected ? "example-card is-selected" : "example-card"}
                        onClick={() => handleExampleSelect(example)}
                      >
                        <div className="example-card-topline">
                          <span className="family-chip">{example.family}</span>
                          <StatusBadge kind={example.expectedOutcome} />
                        </div>
                        <strong>{example.title}</strong>
                        <p>{example.description}</p>
                        <div className="tag-row">
                          <span className="soft-chip">{example.version}</span>
                          {example.tags.map((tag) => (
                            <span key={tag} className="soft-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                eyebrow="Controls"
                title="Bundled run controls"
                description="Seeds and run counts stay explicit so reruns are deterministic."
              >
                <div className="form-grid">
                  <label className="field">
                    <span>Seed</span>
                    <input
                      inputMode="numeric"
                      value={seedInput}
                      onChange={(event) => setSeedInput(event.currentTarget.value)}
                    />
                  </label>

                  <label className="field">
                    <span>Runs</span>
                    <input
                      inputMode="numeric"
                      value={runsInput}
                      onChange={(event) => setRunsInput(event.currentTarget.value)}
                    />
                  </label>
                </div>

                <div className="metric-strip">
                  <Metric label="Selected seed" value={formatSeed(parsedSeed)} />
                  <Metric label="Selected runs" value={String(parsedRuns)} />
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    data-testid="run-button"
                    onClick={handleBundledRun}
                    disabled={!selectedExample || isRunningBundled}
                  >
                    {isRunningBundled ? "Running bundled example..." : "Run bundled example"}
                  </button>

                  <button
                    type="button"
                    className="ghost-button"
                    data-testid="rerun-button"
                    onClick={handleBundledRun}
                    disabled={!selectedExample || isRunningBundled}
                  >
                    Rerun same seed
                  </button>
                </div>
              </Panel>
            </>
          ) : (
            <>
              <Panel
                eyebrow="Local execution"
                title="Run your own files"
                description="Point the workbench at a target module and property file, then run them through the same local engine."
              >
                <div className="stack">
                  <label className="field">
                    <span>Target module</span>
                    <input
                      value={localDraft.modulePath}
                      onChange={(event) =>
                        setLocalDraft({
                          ...localDraft,
                          modulePath: event.currentTarget.value
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Export name</span>
                    <input
                      value={localDraft.exportName}
                      onChange={(event) =>
                        setLocalDraft({
                          ...localDraft,
                          exportName: event.currentTarget.value
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Property definition</span>
                    <input
                      value={localDraft.propertyPath}
                      onChange={(event) =>
                        setLocalDraft({
                          ...localDraft,
                          propertyPath: event.currentTarget.value
                        })
                      }
                    />
                  </label>

                  <div className="form-grid">
                    <label className="field">
                      <span>Seed</span>
                      <input
                        inputMode="numeric"
                        value={String(localDraft.seed)}
                        onChange={(event) =>
                          setLocalDraft({
                            ...localDraft,
                            seed: parseSeed(event.currentTarget.value, localDraft.seed)
                          })
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Runs</span>
                      <input
                        inputMode="numeric"
                        value={String(localDraft.runs)}
                        onChange={(event) =>
                          setLocalDraft({
                            ...localDraft,
                            runs: parseRuns(event.currentTarget.value, localDraft.runs)
                          })
                        }
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleLocalRun}
                  disabled={isRunningLocal}
                >
                  {isRunningLocal ? "Running local files..." : "Run local files"}
                </button>
              </Panel>

              <Panel
                eyebrow="Preview"
                title="Matching CLI command"
                description="This is the exact CLI command the browser is mirroring."
              >
                <CodeBlock value={client.getLocalPreviewCommand(localDraft)} compact />
              </Panel>
            </>
          )}
        </aside>

        <main className="main-column">
          {sourceMode === "bundled" && selectedExample ? (
            <Panel
              eyebrow="Selected example"
              title={selectedExample.title}
              description={selectedExample.description}
              tone={selectedExample.expectedOutcome}
            >
              <div className="hero-grid">
                <div className="hero-copy-block">
                  <div className="tag-row">
                    <span className="family-chip">{selectedExample.family}</span>
                    <StatusBadge kind={selectedExample.expectedOutcome} />
                    <span className="soft-chip">{selectedExample.version}</span>
                  </div>

                  <p className="property-summary">
                    <strong>{selectedExample.property.name}</strong>
                    <span>{selectedExample.property.summary}</span>
                  </p>

                  <ul className="highlight-list">
                    {selectedExample.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </div>

                <div className="metric-grid">
                  <Metric label="Seed" value={formatSeed(parsedSeed)} />
                  <Metric label="Runs" value={String(parsedRuns)} />
                  <Metric label="Target export" value={selectedExample.target.exportName} />
                  <Metric label="Property source" value={selectedExample.target.propertyPath} />
                </div>
              </div>
            </Panel>
          ) : null}

          {sourceMode === "local" ? (
            <Panel
              eyebrow="Local execution"
              title="Live local paths"
              description="The browser mirrors the same deterministic inputs the CLI accepts."
            >
              <div className="metric-grid">
                <Metric label="Target module" value={localDraft.modulePath} />
                <Metric label="Export" value={localDraft.exportName} />
                <Metric label="Property file" value={localDraft.propertyPath} />
                <Metric label="Mode" value={client.localPathMode} />
              </div>
            </Panel>
          ) : null}

          {sourceMode === "bundled" && isRunningBundled ? (
            <Panel eyebrow="Run state" title="Refreshing deterministic report" tone="running">
              <LoadingState text="Recomputing the selected example with the current seed and run count..." />
            </Panel>
          ) : null}

          {sourceMode === "local" && isRunningLocal ? (
            <Panel eyebrow="Run state" title="Executing local paths" tone="running">
              <LoadingState text="Running the selected target and property file through the local engine..." />
            </Panel>
          ) : null}

          {activeReport ? <ReportSurface report={activeReport} /> : null}
        </main>
      </div>
    </div>
  );
}

function ReportSurface({ report }: { report: RunReport }) {
  return (
    <>
      <Panel
        eyebrow="Run report"
        title={report.kind === "fail" ? "Counterexample found" : report.kind === "pass" ? "Run passed" : "Execution blocked"}
        description={report.property.summary}
        tone={report.kind}
      >
        <div className="metric-grid">
          <Metric label="Engine" value={report.adapterName} />
          <Metric label="Seed" value={formatSeed(report.seed)} />
          <Metric label="Runs" value={String(report.runs)} />
          <Metric label="Elapsed" value={formatDuration(report.elapsedMs)} />
        </div>

        {report.kind === "fail" ? <FailureSummary report={report} /> : null}
        {report.kind === "pass" ? <PassSummary report={report} /> : null}
        {report.kind === "blocked" ? <BlockedSummary report={report} /> : null}
      </Panel>

      <div className="content-grid">
        {report.kind === "fail" ? (
          <Panel
            eyebrow="Failure"
            title="Minimal failing input"
            description="The smallest witness after shrink acceptance is kept verbatim."
            tone="fail"
          >
            <div className="comparison-grid">
              <CodeFrame
                label="Failing input"
                value={formatInputTuple(report.minimalInput)}
                emphasis="strong"
              />
              <div className="stack">
                <InfoBlock label="Invariant" value={report.property.invariantLabel} />
                <InfoBlock label="Expected" value={report.expectedLabel} />
                <CodeFrame
                  label="Actual result"
                  value={formatJson(report.actualResult)}
                  emphasis="danger"
                />
              </div>
            </div>
          </Panel>
        ) : null}

        {report.kind === "pass" ? (
          <Panel
            eyebrow="Pass state"
            title="Passed all sampled runs"
            description="A green run still keeps replay details visible."
            tone="pass"
          >
            <InfoBlock label="Invariant" value={report.property.invariantLabel} />
            <InfoBlock label="Summary" value={report.summary} />
          </Panel>
        ) : null}

        {report.kind === "blocked" ? (
          <Panel
            eyebrow="Blocked"
            title="Execution blocked"
            description="The local run could not produce a report yet. Fix the file path or property export and retry with the same seed."
            tone="blocked"
          >
            <InfoBlock label="Message" value={report.message} />
            <div className="stack">
              {report.nextSteps.map((step) => (
                <div key={step} className="bullet-row">
                  <span className="bullet" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel
          eyebrow="Replay"
          title="Deterministic rerun command"
          description="Use the same seed and run count to replay the exact report."
        >
          <CopyableCode label="Command" value={report.rerunCommand} />
        </Panel>

        <Panel
          eyebrow="Reproduction"
          title="Minimal reproduction snippet"
          description="This stays close to the failure surface instead of hiding behind a long report."
        >
          <CopyableCode label="Snippet" value={report.reproductionSnippet} multiline />
        </Panel>

        <Panel
          eyebrow="Search trace"
          title="Counterexample search"
          description="Search attempts and shrink decisions stay ordered and visible."
        >
          {report.trace.length === 0 ? (
            <EmptyState
              title="No trace entries"
              body="This report is blocked before execution, so there is no search data yet."
            />
          ) : (
            <TraceList trace={report.trace} />
          )}
        </Panel>

        {report.kind === "fail" ? (
          <Panel
            eyebrow="Shrink path"
            title="Accepted shrink path"
            description="Accepted shrink candidates show how the final witness was reached."
          >
            <ShrinkList shrinkPath={report.shrinkPath} />
          </Panel>
        ) : null}

        <Panel
          eyebrow="Sources"
          title="Target and property files"
          description="Keep the exact execution inputs visible."
        >
          <div className="stack">
            <InfoBlock label="Target module" value={report.target.modulePath} />
            <InfoBlock label="Export name" value={report.target.exportName} />
            <InfoBlock label="Property definition" value={report.target.propertyPath} />
          </div>
        </Panel>

        <Panel eyebrow="Notes" title="Report notes">
          <div className="stack">
            {report.notes.map((note) => (
              <div key={note} className="bullet-row">
                <span className="bullet" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function FailureSummary({ report }: { report: Extract<RunReport, { kind: "fail" }> }) {
  return (
    <div className="inline-callout tone-fail">
      <strong>{report.failureMessage}</strong>
      <div className="metric-strip">
        <Metric label="First failing run" value={String(report.discoveredAtRun)} />
        <Metric label="Accepted shrinks" value={String(report.shrinkCount)} />
        <Metric label="Invariant" value={report.property.invariantLabel} />
      </div>
    </div>
  );
}

function PassSummary({ report }: { report: Extract<RunReport, { kind: "pass" }> }) {
  return (
    <div className="inline-callout tone-pass">
      <strong>{report.summary}</strong>
      <div className="metric-strip">
        <Metric label="Invariant" value={report.property.invariantLabel} />
        <Metric label="Seed replay" value="Stable" />
      </div>
    </div>
  );
}

function BlockedSummary({ report }: { report: Extract<RunReport, { kind: "blocked" }> }) {
  return (
    <div className="inline-callout tone-blocked">
      <strong>{report.message}</strong>
      <div className="metric-strip">
        <Metric label="Run mode" value="Local files" />
        <Metric label="Next step" value="Fix path or export" />
      </div>
    </div>
  );
}

function TraceList({ trace }: { trace: readonly TraceEntry[] }) {
  return (
    <div className="trace-list">
      {trace.map((entry) => (
        <div key={entry.id} className="trace-row">
          <div className="trace-column">
            <span className={entry.phase === "search" ? "phase-pill" : "phase-pill is-shrink"}>
              {entry.phase}
            </span>
            <span className={outcomeClassName(entry.outcome)}>{entry.outcome}</span>
          </div>

          <div className="trace-main">
            <div className="trace-header">
              <strong>{entry.label}</strong>
              <span>size {entry.size}</span>
            </div>
            <p>{entry.note}</p>
            <div className="trace-code-grid">
              <CodeFrame label="Input" value={formatInputTuple(entry.input)} compact />
              {entry.actual === null ? null : <CodeFrame label="Actual" value={formatJson(entry.actual)} compact />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShrinkList({ shrinkPath }: { shrinkPath: readonly ShrinkEntry[] }) {
  return (
    <div className="shrink-list">
      {shrinkPath.map((entry) => (
        <div key={`${entry.step}-${entry.label}`} className="shrink-row">
          <div className="shrink-step">
            <span>{entry.step}</span>
            <span>{entry.accepted ? "accepted" : "rejected"}</span>
          </div>

          <div className="trace-main">
            <div className="trace-header">
              <strong>{entry.label}</strong>
              <span>{entry.accepted ? "kept" : "discarded"}</span>
            </div>
            <p>{entry.note}</p>
            <div className="trace-code-grid">
              <CodeFrame label="Candidate" value={formatInputTuple(entry.input)} compact />
              <CodeFrame label="Actual" value={formatJson(entry.actual)} compact />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  tone,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "fail" | "pass" | "blocked" | "running";
  children: ReactNode;
}) {
  return (
    <section className={tone ? `panel tone-${tone}` : "panel"}>
      <div className="panel-header">
        <div>
          {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="panel-description">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ kind }: { kind: "fail" | "pass" }) {
  return <span className={kind === "fail" ? "status-badge is-fail" : "status-badge is-pass"}>{kind}</span>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CodeFrame({
  label,
  value,
  compact,
  emphasis
}: {
  label: string;
  value: string;
  compact?: boolean;
  emphasis?: "strong" | "danger";
}) {
  const className = compact
    ? emphasis
      ? `code-frame is-compact is-${emphasis}`
      : "code-frame is-compact"
    : emphasis
      ? `code-frame is-${emphasis}`
      : "code-frame";

  return (
    <div className={className}>
      <span>{label}</span>
      <pre>{value}</pre>
    </div>
  );
}

function CopyableCode({
  label,
  value,
  multiline
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="copyable-code">
      <div className="copyable-header">
        <span>{label}</span>
        <CopyButton value={value} />
      </div>
      <pre className={multiline ? "code-block is-multiline" : "code-block"}>{value}</pre>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1200);
  }

  return (
    <button type="button" className="ghost-button" onClick={() => void handleCopy()}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ value, compact }: { value: string; compact?: boolean }) {
  return <pre className={compact ? "code-block" : "code-block is-multiline"}>{value}</pre>;
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="loading-state">
      <span className="loading-dot" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function matchesExample(example: BundledExample, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return [
    example.family,
    example.title,
    example.version,
    example.description,
    example.property.name,
    example.tags.join(" ")
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function parseSeed(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseRuns(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function outcomeClassName(outcome: TraceEntry["outcome"]) {
  switch (outcome) {
    case "pass":
      return "outcome-pill is-pass";
    case "counterexample":
      return "outcome-pill is-fail";
    case "accepted":
      return "outcome-pill is-accepted";
    case "rejected":
      return "outcome-pill is-rejected";
    default: {
      const exhaustiveCheck: never = outcome;
      return exhaustiveCheck;
    }
  }
}
