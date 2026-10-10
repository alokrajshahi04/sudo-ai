import { expect, test } from "@playwright/test";
import type { Job } from "../../shared/types";

test("reviewed drafts survive polling and export waits for a saved version", async ({page},testInfo) => {
  const now = "2026-10-10T03:00:00.000Z";
  let job = {
    id:"editable-ui",name:"source-tool",repository:"https://github.com/example/source-tool",brief:"Find testers",
    launchBrief:{audience:"Developers",goal:"Find testers",context:""},createdAt:now,expiresAt:"2026-10-17T03:00:00.000Z",
    phases:Object.fromEntries(["inspect","analyze","music","research","position","verify","recording","narrate","render","carousel"].map(phase=>[phase,{state:phase==="inspect" ? "completed" : "idle"}])) as Job["phases"],
    selectedAngle:0,modelPreference:"nebius",artifacts:[],
    inspection:{revision:"a".repeat(40),branch:"main",profile:"library_cli",buildCommand:null,outputDirectory:null,files:["README.md"],blockers:[],warnings:[],homepage:null,description:"Developer tool",evidence:[]},
    positioning:{provider:"nebius",model:"fixture",generatedAt:now,limitations:[],angles:[{title:"Make source work clearer",audience:"Developers",rationale:"Source-backed",evidenceIds:[],linkedin:"Original LinkedIn draft",x:"Original X draft",narration:"Meet a source-backed developer project."}]},
    launchStrategy:{launchType:"showcase",angleTitle:"Make source work clearer",createdAt:now,checklist:[],channels:[]},
  } as Job;
  let saves = 0;
  await page.addInitScript(()=>localStorage.setItem("sudo-welcome-v1","seen"));
  await page.route("**/api/**", async route => {
    const path=new URL(route.request().url()).pathname;
    let data: unknown;
    if(path.endsWith("/capabilities"))data={mode:"local",models:[{provider:"nebius",model:"fixture",configured:true}],narration:false,render:false,promo:false,carousel:false,hostedCredentialEntry:false,research:"public",storage:{kind:"sqlite",retentionDays:7}};
    else if(path.endsWith("/jobs"))data=[job];
    else if(path.endsWith("/drafts")) {
      const body=route.request().postDataJSON();saves++;
      expect(body.reviewed).toBe(true);expect(body.expectedUpdatedAt).toBeNull();
      job={...job,drafts:{linkedin:body.linkedin,x:body.x,instagram:body.instagram,narration:body.narration,angleIndex:0,positioningGeneratedAt:now,updatedAt:"2026-10-10T04:00:00.000Z",reviewedAt:"2026-10-10T04:00:00.000Z"}};data=job;
    } else data=job;
    await route.fulfill({json:data});
  });
  await page.goto("/");
  const linkedin=page.getByLabel("LinkedIn post",{exact:true});
  await expect(linkedin).toHaveValue("Original LinkedIn draft");
  await linkedin.fill("My reviewed, personal project story.");
  const save=page.getByRole("button",{name:"Save reviewed edits →"});
  await expect(save).toBeDisabled();
  await expect(page.getByRole("button",{name:"Download complete ZIP ↓"})).toBeDisabled();
  // A normal job poll cannot overwrite text that is still being edited.
  await page.waitForTimeout(1700);
  await expect(linkedin).toHaveValue("My reviewed, personal project story.");
  await page.getByLabel("I reviewed the claims, links and wording in all four drafts.").check();
  await save.click();
  await expect(page.getByText(/Reviewed and saved/)).toBeVisible();
  expect(saves).toBe(1);
  await expect(page.getByRole("button",{name:"Download complete ZIP ↓"})).toBeEnabled();
  await page.reload();
  await expect(linkedin).toHaveValue("My reviewed, personal project story.");
  await linkedin.fill("a".repeat(2501));
  await page.getByLabel("I reviewed the claims, links and wording in all four drafts.").check();
  await expect(save).toBeDisabled();
  await page.getByRole("button",{name:"Discard unsaved edits"}).click();
  await expect(linkedin).toHaveValue("My reviewed, personal project story.");
  await page.screenshot({path:testInfo.outputPath("reviewed-drafts.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
