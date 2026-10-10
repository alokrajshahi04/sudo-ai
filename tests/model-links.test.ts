import test from "node:test";
import assert from "node:assert/strict";
import { generatePositioning, validatePositioning } from "../server/models";
import type { Job } from "../shared/types";

const repository = "https://github.com/alokrajshahi04/sudo-ai";
const sourceUrl = repository + "/blob/main/README.md";
const ids = new Set(["source-1"]);
const allowed = new Set([repository, sourceUrl]);
function output(x: string) {
  return {angles:[0,1].map(i=>({title:`Story ${i}`,audience:"Developers",rationale:"Source-backed",evidenceIds:["source-1"],linkedin:"A source-based launch draft.",x,narration:"Meet a source-backed project for developers."})),limitations:["Runtime interactions not verified."]};
}
test("Draft links accept only complete supplied GitHub URLs, while links remain optional", () => {
  for (const text of ["Try it: "+repository,"Try it: github.com/alokrajshahi04/sudo-ai.","Read [the source]("+sourceUrl+")", "Try this project; no link is needed."])
    assert.equal(validatePositioning(output(text),ids,allowed).angles[0].x,text);
  for (const field of ["linkedin","x","narration"] as const) {
    for (const text of ["Try github.com/","Try github.com/alokrajshahi0","Try "+repository.slice(0,-1),"Try github.com/someone/guessed-project"]) {
      const invalid=output("A valid short post.");
      invalid.angles[0][field]=text;
      assert.throws(()=>validatePositioning(invalid,ids,allowed),/unsupported or incomplete GitHub URL/);
    }
  }
});
test("A truncated X URL invokes one model repair with canonical URL context, without editing model copy", async () => {
  const originalFetch=globalThis.fetch,originalKey=process.env.NEBIUS_API_KEY,originalLog=console.info;
  process.env.NEBIUS_API_KEY="fixture-link-validation-key";
  console.info=()=>{};
  const job={repository,inspection:{profile:"library_cli",evidence:[{id:"source-1",kind:"source",title:"README",url:sourceUrl,excerpt:"A developer launch workflow",checkedAt:"2026-10-10T04:00:00.000Z"}]}} as Job;
  let calls=0, alwaysInvalid=false;
  const broken="github.com/alokrajshahi0";
  const truncated="x".repeat(280-broken.length-1)+" "+broken;
  assert.equal(truncated.length,280);
  const valid="Find out more: "+repository;
  globalThis.fetch=async(_url,init)=>{
    calls++;
    const body=JSON.parse(String(init?.body));
    const message=body.messages[1].content;
    const data=JSON.parse(message.split("UNTRUSTED_DATA_JSON:\n")[1]);
    assert.equal(data.canonicalRepository,repository);
    assert.ok(data.allowedGitHubUrls.includes(repository));
    assert.ok(data.allowedGitHubUrls.includes(sourceUrl));
    if(calls%2===0)assert.match(message,/exact, complete supplied GitHub URL/);
    return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(output(alwaysInvalid || calls%2===1 ? truncated : valid))}}]}));
  };
  try {
    const result=await generatePositioning(job,"nebius");
    assert.equal(calls,2);
    assert.equal(result.angles[0].x,valid);
    alwaysInvalid=true;
    await assert.rejects(generatePositioning(job,"nebius"),/after one repair attempt:.*complete supplied GitHub URL.*No fallback/);
    assert.equal(calls,4);
  } finally {
    globalThis.fetch=originalFetch;console.info=originalLog;
    if(originalKey===undefined)delete process.env.NEBIUS_API_KEY;else process.env.NEBIUS_API_KEY=originalKey;
  }
});
