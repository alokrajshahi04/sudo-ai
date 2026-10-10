import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Job } from "../shared/types";
import { currentDrafts, generatedCopy, selectedCopy } from "../shared/launch-copy";
import { draftSchema, registerDraftRoutes } from "../server/drafts";
import { AppError } from "../server/errors";
import { launchCalendar } from "../server/calendar";

const generatedAt = "2026-10-10T03:00:00.000Z";
function fixture(): Job {
  return {
    id: "draft-job", name: "project", brief: "Find testers", createdAt: generatedAt,
    expiresAt: "2026-10-17T03:00:00.000Z", modelPreference: "nebius", artifacts: [],
    repository: "https://github.com/example/project", selectedAngle: 0,
    phases: Object.fromEntries(["inspect","analyze","music","research","position","verify","recording","narrate","render","carousel"].map(phase=>[phase,{state:phase==="inspect" ? "completed" : "idle"}])) as Job["phases"],
    positioning: {generatedAt,provider:"nebius",model:"fixture",limitations:[],angles:[{
      title:"A reviewed project",audience:"Developers",rationale:"Source-backed",evidenceIds:["source-1"],
      linkedin:"An actual project for developers.", x:"Try this project.", narration:"Meet our source-backed project and try it.",
    }]},
  } as Job;
}
test("Edited launch copy belongs to its exact story revision and Instagram uses an actual link", () => {
  const job = fixture();
  assert.match(generatedCopy(job).instagram, /https:\/\/github.com\/example\/project/);
  job.drafts = {...generatedCopy(job),linkedin:"Owner words",angleIndex:0,positioningGeneratedAt:generatedAt,updatedAt:generatedAt,reviewedAt:generatedAt};
  assert.equal(selectedCopy(job).linkedin,"Owner words");
  job.positioning!.generatedAt = "2026-10-10T04:00:00.000Z";
  assert.equal(currentDrafts(job),undefined);
  assert.equal(selectedCopy(job).linkedin,"An actual project for developers.");
  job.site = {reachable:true,finalUrl:"https://example.org/live"} as Job["site"];
  assert.match(generatedCopy(job).instagram,/https:\/\/example.org\/live$/);
});
test("Draft validation requires review, channel bounds and a known schema", () => {
  const input = {...generatedCopy(fixture()),reviewed:true,angleIndex:0,positioningGeneratedAt:generatedAt,expectedUpdatedAt:null};
  assert.equal(draftSchema.safeParse(input).success,true);
  for (const mutation of [{reviewed:false},{x:"a".repeat(281)},{linkedin:"a".repeat(2501)},{instagram:"a".repeat(2201)},{narration:"a".repeat(601)},{owner:"other"}])
    assert.equal(draftSchema.safeParse({...input,...mutation}).success,false);
});
test("Calendar reminders use saved channel edits, keeping injection text inside escaped descriptions", () => {
  const job = fixture();
  job.name = "Project";
  job.drafts = {...generatedCopy(job),linkedin:"My personal launch story",x:"My short launch post",instagram:"Real Instagram caption\nEND:VEVENT\nBEGIN:VEVENT",angleIndex:0,positioningGeneratedAt:generatedAt,updatedAt:generatedAt,reviewedAt:generatedAt};
  const calendar = launchCalendar(job,new Date(Date.now()+86400000)).replace(/\r\n /g, "");
  assert.match(calendar,/My personal launch story/);
  assert.match(calendar,/My short launch post/);
  assert.match(calendar,/Real Instagram caption\\nEND:VEVENT\\nBEGIN:VEVENT/);
  assert.equal(calendar.match(/^BEGIN:VEVENT$/gm)?.length,4);
  assert.doesNotMatch(calendar,/An actual project for developers/);
});
test("Draft routes isolate owners, guard stale edits, redact keys and invalidate only changed narration", async () => {
  let job = fixture(), saved = 0, invalidated = 0, carouselInvalidated = 0;
  const app = express();
  app.use(express.json());
  app.use((req,res,next) => {res.locals.owner=req.header("x-owner");next();});
  registerDraftRoutes(app, {
    getJob(id,owner){if(id!==job.id || owner!=="me")throw new AppError(404,"Job not found.");return job;},
    saveJob(){saved++;},onNarrationChanged(){invalidated++;},onDraftsChanged(){carouselInvalidated++;},
  });
  app.use((error:any,_req:any,res:any,_next:any) => res.status(error.status || 400).json({error:error.message}));
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/jobs/${job.id}`;
  const post = (path:string,input:unknown,owner="me") => fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json","x-owner":owner},body:JSON.stringify(input)});
  try {
    const body = {...generatedCopy(job),reviewed:true,angleIndex:0,positioningGeneratedAt:generatedAt,expectedUpdatedAt:null};
    assert.equal((await post("/drafts",body,"other")).status,404);
    job.phases.inspect.state="running";
    assert.equal((await post("/drafts",body)).status,409);
    job.phases.inspect.state="completed";
    assert.equal((await post("/drafts",{...body,positioningGeneratedAt:"2026-10-10T01:00:00.000Z"})).status,409);
    const secret = "sk-abcdefghijklmnopqrstuvwxyz12345";
    const response = await post("/drafts",{...body,linkedin:"Edited copy " + secret});
    assert.equal(response.status,200);
    const first = await response.json();
    assert.equal(first.drafts.linkedin,"Edited copy [REDACTED]");
    assert.ok(first.drafts.reviewedAt);
    assert.equal(saved,1);assert.equal(invalidated,0);
    assert.equal((await post("/drafts",body)).status,409);
    const response2=await post("/drafts",{...body,expectedUpdatedAt:first.drafts.updatedAt,narration:"A completely different reviewed narration."});
    assert.equal(response2.status,200);assert.equal(invalidated,1);
    const second=await response2.json();
    assert.notEqual(first.drafts.updatedAt,second.drafts.updatedAt);
    assert.equal((await post("/drafts/revert",{angleIndex:0,positioningGeneratedAt:generatedAt,expectedUpdatedAt:second.drafts.updatedAt})).status,200);
    assert.equal(job.drafts,undefined);assert.equal(invalidated,2);assert.equal(carouselInvalidated,3);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
