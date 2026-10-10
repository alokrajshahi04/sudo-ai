import { useEffect, useRef, useState } from "react";
import type { Job } from "../shared/types";
import { copyLimits, currentDrafts, selectedCopy, type LaunchCopy } from "../shared/launch-copy";
import { api } from "./api";
import "./DraftEditor.css";

const labels: Record<keyof LaunchCopy, string> = {
  linkedin: "LinkedIn post", x: "X post", instagram: "Instagram caption", narration: "Narration draft",
};
export default function DraftEditor({ job, busy, onJob, onNotice, onDirtyChange }: {
  job: Job; busy: boolean; onJob: (job: Job) => void; onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const storyKey = `${job.id}:${job.positioning?.generatedAt}:${job.selectedAngle}`;
  const [copy, setCopy] = useState<LaunchCopy>(() => selectedCopy(job));
  const [baseline, setBaseline] = useState<LaunchCopy>(() => selectedCopy(job));
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(currentDrafts(job)?.updatedAt || null);
  const previousKey = useRef(storyKey);
  const dirty = JSON.stringify(copy) !== JSON.stringify(baseline);
  const savedDraft = currentDrafts(job);
  const externalSave = (savedDraft?.updatedAt || null) !== expectedUpdatedAt;
  useEffect(() => { onDirtyChange(dirty || pending); }, [dirty, pending, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (previousKey.current === storyKey && dirty) return;
    previousKey.current = storyKey;
    const selected = selectedCopy(job);
    setCopy(selected);
    setBaseline(selected);
    setExpectedUpdatedAt(currentDrafts(job)?.updatedAt || null);
    setReviewed(false);
    setError("");
  }, [storyKey, savedDraft?.updatedAt, job.site?.finalUrl, job.site?.reachable]);

  const valid = (Object.keys(labels) as (keyof LaunchCopy)[]).every(key => {
    const length = copy[key].trim().length;
    return length >= (key === "narration" ? 10 : 1) && copy[key].length <= copyLimits[key];
  });
  async function update(revert: boolean) {
    setPending(true);
    setError("");
    try {
      const revision = { angleIndex: job.selectedAngle, positioningGeneratedAt: job.positioning!.generatedAt, expectedUpdatedAt };
      const next = await api<Job>(`/jobs/${job.id}/drafts${revert ? "/revert" : ""}`, revert ? revision : { ...revision, ...copy, reviewed: true });
      const nextCopy = selectedCopy(next);
      setCopy(nextCopy);
      setBaseline(nextCopy);
      setExpectedUpdatedAt(currentDrafts(next)?.updatedAt || null);
      setReviewed(false);
      onJob(next);
      onNotice(revert ? "Generated drafts restored. Review them before sharing." : "Reviewed edits saved. Downloads and calendar reminders now use this copy.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafts could not be saved.");
    } finally { setPending(false); }
  }
  function reload() {
    const nextCopy = selectedCopy(job);
    setCopy(nextCopy); setBaseline(nextCopy);
    setExpectedUpdatedAt(currentDrafts(job)?.updatedAt || null); setReviewed(false); setError("");
  }
  return <section className="draft-editor" aria-label="Editable launch drafts">
    <div className="draft-editor-heading">
      <div><h3>Make the words yours.</h3><p>Save your reviewed edits before downloading. Posts remain yours to publish.</p></div>
      <span className="footnote" role="status">{dirty ? "Unsaved edits" : savedDraft?.reviewedAt ? `Reviewed and saved · ${new Date(savedDraft.reviewedAt).toLocaleTimeString()}` : savedDraft ? "Saved edits · review required" : "Generated drafts · review required"}</span>
    </div>
    <div className="draft-editor-grid">{(Object.keys(labels) as (keyof LaunchCopy)[]).map(key => <article className="draft-card" key={key}>
      <div className="draft-card-head"><label htmlFor={`draft-${key}`}>{labels[key]}</label><span className={copy[key].length > copyLimits[key] ? "draft-over-limit" : "footnote"}>{copy[key].length}/{copyLimits[key]}</span></div>
      <textarea id={`draft-${key}`} value={copy[key]} rows={key === "x" ? 5 : 8} disabled={pending || busy} onChange={e => { setCopy(previous => ({...previous,[key]:e.target.value})); setReviewed(false); }} aria-describedby={key === "narration" ? "draft-narration-note" : undefined}/>
      <button className="text-button" onClick={async () => {try {await navigator.clipboard.writeText(copy[key]);onNotice(`${labels[key]} copied${dirty ? " from unsaved edits" : ""}.`);}catch {onNotice("Clipboard unavailable. Select the text to copy it.");}}}>Copy {labels[key]} →</button>
    </article>)}</div>
    <p id="draft-narration-note" className="footnote">Changing saved narration clears the old voice, captions and rendered video so they cannot contradict your script. Post edits preserve your video.</p>
    {externalSave && dirty && <p role="alert">Newer drafts were saved in another window. <button className="text-button" onClick={reload}>Load saved drafts →</button></p>}
    {error && <p role="alert" className="draft-save-error">{error}</p>}
    <label className="checkbox-label"><input type="checkbox" checked={reviewed} disabled={busy || pending} onChange={e => setReviewed(e.target.checked)}/>I reviewed the claims, links and wording in all four drafts.</label>
    <div className="draft-editor-actions">
      <button className="primary" disabled={busy || pending || !reviewed || !valid || externalSave} onClick={() => void update(false)}>{pending ? "Saving…" : "Save reviewed edits →"}</button>
      <button className="outline" disabled={busy || pending || !savedDraft || externalSave} onClick={() => void update(true)}>Revert to generated drafts</button>
      {dirty && <button className="text-button" disabled={pending} onClick={reload}>Discard unsaved edits</button>}
    </div>
  </section>;
}
