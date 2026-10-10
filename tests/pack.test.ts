import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Job, Phase } from "../shared/types";
import { unzipSync, strFromU8, zipSync } from "fflate";
import { buildLaunchKit, jobReceipt, registerPackRoutes, type MediaAssets } from "../server/launch-pack";
import { AppError } from "../server/errors";
import { carouselFingerprint } from "../shared/carousel";

import { packJob } from "./fixtures/pack-job";

test("Launch ZIP includes owner edits, fixed media names, absent-assets manifest and calendar reminders",()=>{
  const job = packJob();
  const {files,manifest} = buildLaunchKit(job,{video:Buffer.from("actual-video"),poster:Buffer.from("actual-cover")},{start:new Date(Date.now()+86400000)});
  const contents = unzipSync(zipSync(files,{level:0}));
  assert.equal(strFromU8(contents["posts/linkedin.txt"]),"Owner-edited LinkedIn");
  assert.equal(strFromU8(contents["instagram/caption.txt"]),"Owner-edited Instagram");
  assert.equal(strFromU8(contents["posts/narration-script.txt"]),"Owner-approved speech");
  assert.equal(strFromU8(contents["media/launch-video.mp4"]),"actual-video");
  assert.ok(manifest.missing.includes("media/captions.srt"));
  assert.ok(manifest.files.includes("manifest.json"));
  assert.match(strFromU8(contents["launch-calendar.ics"]),/Manual publishing reminder/);
  assert.match(strFromU8(contents["launch-calendar.ics"]),/Owner-edited Instagram/);
  assert.match(strFromU8(contents["launch-calendar.ics"]),/Owner-edited LinkedIn/);
  assert.ok(!Object.keys(contents).some(name=>name.startsWith("/") || name.includes("..")));
  assert.equal(manifest.automaticPublication,false);
});
test("Changing current copy omits stale narration-derived media and carousel while preserving actual screenshot",()=>{
  const job = packJob();
  job.narrationScript = "Old speech";
  job.carousel = {generatedAt:new Date().toISOString(),copyFingerprint:carouselFingerprint(job),slideCount:5,format:"1080x1350"};
  job.drafts!.instagram = "Updated caption";
  const {files,manifest} = buildLaunchKit(job,{narration:Buffer.from("old"),captions:Buffer.from("old subtitles"),video:Buffer.from("old video"),"carousel-1":Buffer.from("old slide"),screenshot:Buffer.from("actual screenshot")});
  assert.equal(files["media/narration.mp3"],undefined);
  assert.equal(files["media/launch-video.mp4"],undefined);
  assert.equal(files["instagram/slide-01.png"],undefined);
  assert.equal(strFromU8(files["media/product-screenshot.png"]),"actual screenshot");
  assert.equal(manifest.stale.length,4);
  const receipt = JSON.parse(strFromU8(files["receipt.json"]));
  assert.equal(receipt.actualExecution.approvedNarrationScript,"Old speech");
  assert.equal(receipt.actualExecution.currentCopy.narration,"Owner-approved speech");
});
test("Pack receipt strips server ownership and kit refuses oversized assets or missing story",()=>{
  const job = {...packJob(),owner:"never-export-session"};
  assert.equal((jobReceipt(job).job as any).owner,undefined);
  assert.throws(()=>buildLaunchKit(job,{recording:Buffer.alloc(80_000_000)}),/80 MB/);
  delete job.positioning;
  assert.throws(()=>buildLaunchKit(job,{}),/Choose a launch story/);
});
test("ZIP and carousel routes enforce session ownership, busy snapshot and reviewed draft gates",async()=>{
  const job = packJob();
  const app = express();app.use(express.json());app.use((req,res,next)=>{res.locals.owner=req.headers["x-owner"] || "";next();});
  let busy = false;
  registerPackRoutes(app,{
    getJob:(id,owner)=>{if (id!==job.id || owner!=="owner") throw new AppError(404,"Job not found");return job;},publicJob:j=>j,
    getMedia:()=>undefined,saveMedia:()=>{},persist:()=>{},capacity:()=>{},operation:(_j,_p:Phase,_work)=>{},isBusy:()=>busy,carouselAvailable:()=>true,
  });
  app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(err instanceof AppError?err.status:400).json({error:err instanceof Error?err.message:"Error"}));
  const server = app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}/api/jobs/${job.id}`;
  try {
    assert.equal((await fetch(base+"/pack.zip")).status,404);
    assert.equal((await fetch(base+"/pack.zip",{headers:{"x-owner":"owner"}})).status,200);
    busy=true;assert.equal((await fetch(base+"/pack.zip",{headers:{"x-owner":"owner"}})).status,409);busy=false;
    delete job.drafts!.reviewedAt;
    const response=await fetch(base+"/carousel",{method:"POST",headers:{"x-owner":"owner","content-type":"application/json"},body:"{}"});
    assert.equal(response.status,409);assert.match((await response.json()).error,/Review and save/);
  } finally {await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
});
