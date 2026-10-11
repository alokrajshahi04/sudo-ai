import { useState } from "react";
import type { Job } from "../shared/types";
export default function CaptureControls({
  job,
  busy,
  available,
  recorderAvailable,
  format,
  onCapture,
  onScreenshot,
}: {
  job: Job;
  busy: boolean;
  available: boolean;
  recorderAvailable: boolean;
  format: "landscape" | "portrait";
  onCapture: (body: unknown) => void;
  onScreenshot: (file: File) => void;
}) {
  const [url, setUrl] = useState(
    job.site?.finalUrl || job.inspection?.homepage || "",
  );
  const [names, setNames] = useState("");
  const [scroll, setScroll] = useState(true);
  const [approved, setApproved] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const labels = names
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 4);
  const steps = [
    ...labels.map((name) => ({ action: "click", role: "button", name })),
    ...(scroll ? [{ action: "scroll", pixels: 500 }] : []),
  ];
  const screenshot = job.artifacts.find((a) => a.type === "screenshot");
  const recording = job.artifacts.find((a) => a.type === "recording");
  return (
    <section className="capture-controls" aria-label="Product visuals">
      <p>Choose a public demo recording or upload your own visuals below.</p>
      {url && recorderAvailable && (
        <div className="auto-capture">
          <strong>Record the project for me</strong>
          <p className="footnote">
            Chromium opens the repository’s public demo. A bounded model can
            choose up to four safe controls; it cannot log in, submit forms or
            make payments.
          </p>
          <p className="footnote">Demo: {url}</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoApproved}
              disabled={busy}
              onChange={(event) => setAutoApproved(event.target.checked)}
            />
            I approve public browser recording and model usage for the capture
            plan.
          </label>
          <button
            className="primary"
            disabled={busy || !autoApproved}
            onClick={() =>
              onCapture({
                url,
                automatic: true,
                steps: [],
                format,
                approved: true,
              })
            }
          >
            Auto-record product demo →
          </button>
        </div>
      )}
      <details className="capture-form">
        <summary>
          {url
            ? "Edit URL or set exact recording steps"
            : "Record from a deployed URL"}
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCapture({ url, steps, format, approved: true });
          }}
        >
          <label htmlFor="capture-url">Public demo URL</label>
          <input
            id="capture-url"
            type="url"
            required
            value={url}
            maxLength={1000}
            onChange={(e) => {
              setUrl(e.target.value);
              setApproved(false);
              setAutoApproved(false);
            }}
          />
          <label htmlFor="capture-buttons">
            Buttons to click{" "}
            <span className="dim">
              Optional · exact labels · one per line, up to 4
            </span>
          </label>
          <textarea
            id="capture-buttons"
            value={names}
            maxLength={320}
            rows={4}
            placeholder={"Start playing\nPlay locally"}
            onChange={(e) => {
              setNames(e.target.value);
              setApproved(false);
            }}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={scroll}
              onChange={(e) => {
                setScroll(e.target.checked);
                setApproved(false);
              }}
            />
            Scroll the page after opening it
          </label>
          <div className="capture-plan">
            <strong>Capture plan</strong>
            <ol>
              <li>Open the public page in a fresh browser.</li>
              {labels.map((n, i) => (
                <li key={i}>Click button: {n}</li>
              ))}
              {scroll && <li>Scroll down 500 pixels.</li>}
              <li>Hold the result and save recording + screenshot.</li>
            </ol>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I reviewed these steps and approve recording this public demo.
          </label>
          <button
            className="primary"
            disabled={busy || !recorderAvailable || !approved || !url}
          >
            Record deployed demo →
          </button>
          {!recorderAvailable && (
            <p className="footnote">
              Recording needs Chromium and Playwright’s encoder. Run npm run
              setup:browser; with an existing Chromium, run npx playwright
              install ffmpeg.
            </p>
          )}
        </form>
      </details>
      {job.capture && (
        <div className="capture-receipt">
          <strong>✓ Real footage captured</strong>
          <p>{job.capture.url}</p>
          <ul>
            {job.capture.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
          <p className="footnote">{job.capture.coverage}</p>
        </div>
      )}
      {recording && (
        <video
          className="capture-preview"
          src={recording.url}
          controls
          preload="metadata"
        />
      )}
      <label className="upload-control">
        Upload screenshot · PNG/JPEG, up to 8 MB
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy || !available}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onScreenshot(file);
            e.target.value = "";
          }}
        />
      </label>
      {screenshot && (
        <img
          className="screenshot-preview"
          src={screenshot.url}
          alt="Screenshot selected for your launch video"
        />
      )}
    </section>
  );
}
