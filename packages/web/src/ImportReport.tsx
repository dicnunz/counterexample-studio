import { useEffect, useRef, useState } from "react";
import type { SuiteRunReport } from "@counterexample-studio/core";
import { MAX_REPORT_BYTES, parseReportJson } from "./reportIO";

export function ImportReport({ onImport, onClose }: { onImport: (report: SuiteRunReport, name: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  function importText(text: string, name: string) {
    try { onImport(parseReportJson(text), name); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read this report."); }
  }
  async function importFile(file: File) {
    setError("");
    if (file.size > MAX_REPORT_BYTES) { setError("This report exceeds 5 MB. Import a smaller CLI report."); return; }
    try { importText(await file.text(), file.name); }
    catch { setError("Could not read this file. Try choosing it again or paste its JSON below."); }
  }
  return <dialog ref={dialog} className="import-dialog" onCancel={onClose} aria-labelledby="import-title">
    <div className="dialog-heading"><h2 id="import-title">Import a report</h2><button className="button button-quiet" type="button" onClick={onClose} aria-label="Close import">Close</button></div>
    <p>Open a JSON report from the CLI or this workbench. Importing only reads the saved results; it never runs the module or commands.</p>
    <label className="file-input"><span>Choose JSON file <small>up to 5 MB</small></span><input type="file" accept=".json,application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} /></label>
    <form onSubmit={(event) => { event.preventDefault(); importText(json, "Pasted JSON report"); }}>
      <label className="field"><span>Or paste report JSON</span><textarea rows={9} value={json} onChange={(event) => setJson(event.currentTarget.value)} spellCheck={false} placeholder={'{ "title": "…", "cases": […] }'} /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><button className="button" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={!json.trim()}>Open report</button></div>
    </form>
  </dialog>;
}
