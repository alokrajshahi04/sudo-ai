import type { Express } from "express";
import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
import type { Job, Phase } from "../shared/types";
import { currentDrafts, selectedCopy } from "../shared/launch-copy";
import { carouselFingerprint, carouselIsCurrent } from "../shared/carousel";
import { launchEvidence } from "../shared/evidence";
import { launchCalendar } from "./calendar";
import { renderCarousel } from "./instagram";
import { AppError, redact } from "./errors";

export type MediaAssets = Partial<Record<Job["artifacts"][number]["type"], Buffer>>;
export const packLimit = 80_000_000;
const carouselTypes = ["carousel-1","carousel-2","carousel-3","carousel-4","carousel-5"] as const;
const mediaNames: Partial<Record<keyof MediaAssets,string>> = {
  video:"media/launch-video.mp4", poster:"media/cover.png", screenshot:"media/product-screenshot.png",
  recording:"media/product-recording.webm", narration:"media/narration.mp3", music:"media/music.mp3", captions:"media/captions.srt",
  "carousel-1":"instagram/slide-01.png", "carousel-2":"instagram/slide-02.png", "carousel-3":"instagram/slide-03.png", "carousel-4":"instagram/slide-04.png", "carousel-5":"instagram/slide-05.png",
};
export function jobReceipt(job: Job) {
  // Never export the server session owner even when passed an internal job object.
  const {owner: _owner,...publicJob} = job as Job & {owner?:string};
  return {
    schemaVersion:2, generatedAt:new Date().toISOString(), job:publicJob,
    actualExecution:{
      sourceInspected:!!job.inspection, sourceRevision:job.inspection?.revision || null,builtRevision:null,
      analysisModel:job.analysis ? {provider:job.analysis.provider,id:job.analysis.model} : null,
      model:job.positioning ? {provider:job.positioning.provider,id:job.positioning.model} : null,
      videoWorkflow:job.storyboard?.workflow || null, deploymentExecuted:false,
      research:job.research?.coverage || "Not run",httpCheck:job.site || null,interactionVerified:false,
      automaticCapture:!!job.capture,capture:job.capture || null,
      currentCopy:selectedCopy(job), approvedNarrationScript:job.narrationScript || null,
      carouselCurrent:carouselIsCurrent(job), copyReviewedAt:currentDrafts(job)?.reviewedAt || null,
    },
    evidence:launchEvidence(job),
    limitations:[
      "Source evidence and HTTP reachability do not prove all product interactions.",
      "The developer reviews and publishes posts. Calendar files create manual posting reminders.",
      "Generated media is included only when present; stale carousel or narration-derived media is omitted from the launch ZIP.",
      job.capture ? job.capture.coverage : "Uploaded visuals are supplied by the creator and are not independent verification.",
    ],
  };
}

export function buildLaunchKit(job: Job, assets: MediaAssets, options: {start?:Date} = {}) {
  const angle = job.positioning?.angles[job.selectedAngle];
  if (!angle) throw new AppError(409,"Choose a launch story before downloading your kit.");
  const copy = selectedCopy(job);
  const files: Record<string,Uint8Array> = {};
  const missing: string[] = [], stale: string[] = [];
  let size = 0;
  const add = (name:string,data:string|Buffer) => {
    const bytes = typeof data === "string" ? strToU8(redact(data)) : data;
    size += bytes.byteLength;
    if (size > packLimit) throw new AppError(413,"This launch kit exceeds 80 MB. Download large recordings separately from Product visuals.");
    files[name] = bytes;
  };
  add("posts/linkedin.txt",copy.linkedin);
  add("posts/x.txt",copy.x);
  add("instagram/caption.txt",copy.instagram);
  add("posts/narration-script.txt",copy.narration);
  add("receipt.json",JSON.stringify(jobReceipt(job),null,2));
  if (job.storyboard) add("storyboard.json",JSON.stringify(job.storyboard,null,2)); else missing.push("storyboard.json");
  const staleAudio = !!job.narrationScript && job.narrationScript.trim() !== copy.narration.trim();
  for (const [type,defaultName] of Object.entries(mediaNames) as [keyof MediaAssets,string][]) {
    const bytes = assets[type];
    const name = type === "recording" && bytes?.subarray(4,8).toString() === "ftyp" ? "media/product-recording.mp4" : defaultName;
    if (!bytes) { missing.push(name); continue; }
    if ((type.startsWith("carousel-") && !carouselIsCurrent(job)) || (staleAudio && ["narration","captions","video"].includes(type))) {
      stale.push(name); continue;
    }
    add(name,bytes);
  }
  if (options.start) add("launch-calendar.ics",launchCalendar(job,options.start)); else missing.push("launch-calendar.ics (choose a future launch date to include reminders)");
  if (job.launchStrategy) add("launch-strategy.json",JSON.stringify(job.launchStrategy,null,2));
  add("launch-kit.md",[
    `# ${job.name} — launch kit`,
    `Story: ${angle.title}`,`Repository: ${job.repository}`,
    `Mode: ${job.launchMode || "source"}`,`Audience: ${job.launchBrief?.audience || angle.audience}`,
    `Goal: ${job.launchBrief?.goal || "Find feedback"}`,
    currentDrafts(job)?.reviewedAt ? `Copy reviewed: ${currentDrafts(job)!.reviewedAt}` : "Copy status: draft — review before publishing.",
    "## How to use", "1. Read receipt.json and check claims against your actual project.",
    "2. Review the channel copy, carousel, and video before sharing.",
    "3. Upload slides in numeric order. Add instagram/caption.txt as the caption.",
    "4. Publish manually. Import an included calendar file for reminders only.",
    "## Limits", ...(job.positioning?.limitations || []),
    "Reachable links and repository inspection do not verify every runtime interaction.",
    ...(job.launchStrategy ? ["## Launch checklist",...job.launchStrategy.checklist.map(item=>`- [ ] ${item}`),"## Channel plan",...job.launchStrategy.channels.map(channel=>`- ${channel.name}: ${channel.purpose} (${channel.timing})`)] : []),
    "## LinkedIn",copy.linkedin,"## X",copy.x,"## Instagram",copy.instagram,
    "## Narration script",copy.narration,
  ].join("\n\n"));
  const manifest = {schemaVersion:1,generatedAt:new Date().toISOString(),files:[...Object.keys(files),"manifest.json"],missing,stale,sourceRevision:job.inspection?.revision || null,copyReviewedAt:currentDrafts(job)?.reviewedAt || null,carouselGeneratedAt:carouselIsCurrent(job)?job.carousel?.generatedAt:null,automaticPublication:false};
  add("manifest.json",JSON.stringify(manifest,null,2));
  return {files,manifest};
}

export interface PackHooks {
  getJob(id:string,owner:string):Job;
  publicJob(job:Job):Job;
  getMedia(id:string):MediaAssets|undefined;
  saveMedia(id:string,assets:MediaAssets):void;
  persist(job:Job):void;
  operation(job:Job,phase:Phase,work:()=>Promise<void>):void;
  capacity(bytes:Buffer,replaced?:Buffer):void;
  isBusy(id:string):boolean;
  carouselAvailable():boolean;
}
export function registerPackRoutes(app:Express,hooks:PackHooks) {
  let exporting = 0;
  app.get("/api/jobs/:id/pack.zip",(req,res)=>{
    const job = hooks.getJob(req.params.id,res.locals.owner);
    const query = z.object({start:z.string().datetime().optional()}).strict().parse(req.query);
    if (hooks.isBusy(job.id)) throw new AppError(409,"Wait for the current launch operation to finish before downloading the kit.");
    if (exporting >= 2) throw new AppError(429,"A launch kit is already being prepared. Retry shortly.");
    exporting++;
    try {
      const snapshot = structuredClone(hooks.publicJob(job));
      const {files} = buildLaunchKit(snapshot,{...hooks.getMedia(job.id)},query.start ? {start:new Date(query.start)} : {});
      // Stored entries avoid spending CPU recompressing PNG/MP4 media; bound total before allocating.
      const zip = Buffer.from(zipSync(files,{level:0}));
      res.type("application/zip").setHeader("Content-Disposition",'attachment; filename="sudo-launch-kit.zip"');
      res.send(zip);
    } finally { exporting--; }
  });
  app.post("/api/jobs/:id/carousel",(req,res)=>{
    const job = hooks.getJob(req.params.id,res.locals.owner);
    z.object({}).strict().parse(req.body);
    if (!hooks.carouselAvailable()) throw new AppError(409,"Carousel generation requires Chromium. Run npm run setup:browser and restart.");
    // Validate before acknowledging an asynchronous operation.
    if (!job.positioning?.angles[job.selectedAngle] || !job.launchBrief) throw new AppError(409,"Choose a launch story and confirm your brief first.");
    const drafts = currentDrafts(job);
    if (drafts && !drafts.reviewedAt) throw new AppError(409,"Review and save your launch copy before generating the carousel.");
    hooks.operation(job,"carousel",async()=>{
      const fingerprint = carouselFingerprint(job);
      const images = await renderCarousel(job,hooks.getMedia(job.id)?.screenshot);
      if (fingerprint !== carouselFingerprint(job)) throw new AppError(409,"Your story changed during carousel generation. Generate it again.");
      const assets = {...hooks.getMedia(job.id)};
      hooks.capacity(Buffer.concat(images),Buffer.concat(carouselTypes.map(type=>assets[type] || Buffer.alloc(0))));
      for (const [i,type] of carouselTypes.entries()) assets[type] = images[i];
      hooks.saveMedia(job.id,assets);
      job.carousel = {generatedAt:new Date().toISOString(),copyFingerprint:fingerprint,slideCount:5,format:"1080x1350"};
      job.artifacts = job.artifacts.filter(a=>!a.type.startsWith("carousel-"));
      for (const type of carouselTypes) job.artifacts.push({type,url:`/api/jobs/${job.id}/assets/${type}`,provenance:"Five-slide carousel composed from reviewed story, project brief and source-backed summary; sharing requires creator review."});
      hooks.persist(job);
    });
    res.status(202).json(hooks.publicJob(job));
  });
}
