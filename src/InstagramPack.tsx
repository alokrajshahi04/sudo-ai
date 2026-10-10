import { useState } from "react";
import type { Job } from "../shared/types";
import { currentDrafts, selectedCopy } from "../shared/launch-copy";
import { carouselIsCurrent } from "../shared/carousel";
import "./InstagramPack.css";

export default function InstagramPack({job,busy,available,onGenerate}:{job:Job;busy:boolean;available:boolean;onGenerate:()=>void}) {
  const [slide,setSlide] = useState(0);
  const [copied,setCopied] = useState(false);
  const current = carouselIsCurrent(job);
  const images = job.artifacts.filter(a=>a.type.startsWith("carousel-")).sort((a,b)=>a.type.localeCompare(b.type));
  const drafts = currentDrafts(job);
  const caption = selectedCopy(job).instagram;
  const phase = job.phases.carousel;
  return <section className="instagram-pack" aria-label="Instagram launch pack">
    <div className="instagram-pack-heading"><div><span className="eyebrow">INSTAGRAM / 4:5</span><h3>A launch worth swiping through.</h3><p>Five slides from your chosen story and actual project. No extra model call.</p></div><button className="primary" disabled={busy || !available || !!(drafts && !drafts.reviewedAt)} onClick={onGenerate}>{phase?.state === "running" ? "Composing slides…" : images.length ? "Refresh carousel →" : "Create five-slide carousel →"}</button></div>
    {!available && <p className="footnote">Rendering needs Chromium. Run npm run setup:browser and restart.</p>}
    {drafts && !drafts.reviewedAt && <p className="instagram-notice">Save and review your copy above before creating the carousel.</p>}
    {phase?.state === "failed" && <p className="error" role="alert">{phase.error}</p>}
    {images.length > 0 ? <>
      {!current && <p className="instagram-notice">Your project or launch copy changed. Refresh the carousel before sharing. Older slides are excluded from the ZIP.</p>}
      <div className="instagram-carousel"><div className="instagram-slide"><img src={images[Math.min(slide,images.length-1)].url+`?generated=${encodeURIComponent(job.carousel?.generatedAt || "")}`} alt={`${job.name} launch carousel slide ${slide+1} of ${images.length}`} /></div><div className="instagram-slide-panel"><p className="dim">REVIEW / {slide+1} OF {images.length}</p><h4>{["The hook","The people","The value","The proof","Your next step"][slide]}</h4><p>Read every slide before posting. A screenshot and reachable URL support a demo; they do not prove every feature works.</p><div className="instagram-slide-nav" aria-label="Carousel slides">{images.map((_,i)=><button key={i} aria-label={`View slide ${i+1}`} aria-pressed={slide===i} onClick={()=>setSlide(i)}>{String(i+1).padStart(2,"0")}</button>)}</div><a className="instagram-download" href={images[slide]?.url} download={`launch-slide-${slide+1}.png`}>Download this slide ↓</a><p className="footnote">All five current slides are included in your launch ZIP.</p></div></div>
    </> : <div className="instagram-empty"><span>01 HOOK → 02 PEOPLE → 03 VALUE → 04 PROOF → 05 NEXT STEP</span><p>Add a screenshot in Product visuals for a real product slide. Without one, slide four explains the source and review limits.</p></div>}
    <div className="instagram-caption"><div><h4>Your Instagram caption</h4><button onClick={async()=>{try {await navigator.clipboard.writeText(caption);setCopied(true);setTimeout(()=>setCopied(false),2000);} catch {setCopied(false);}}}>{copied ? "Copied ✓" : "Copy caption"}</button></div><p>{caption}</p><span className="footnote">Edit this in Launch copy above. Publishing is manual.</span></div>
  </section>;
}
