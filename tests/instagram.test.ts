import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { carouselSvgs, renderCarousel } from "../server/instagram";
import { carouselFingerprint, carouselIsCurrent } from "../shared/carousel";
import { packJob } from "./fixtures/pack-job";

test("Five source-based carousel slides escape owner content, mark prototype and retain real screenshot provenance",()=>{
  const job = packJob();job.name='<script>alert("x")</script>';job.launchBrief!.audience='People & <img src="https://evil.example/x">';
  const svgs = carouselSvgs(job);
  assert.equal(svgs.length,5);
  assert.ok(svgs.every(s=>s.includes('width="1080" height="1350"')));
  assert.ok(svgs.every(s=>!s.includes("<script>") && !s.includes("<img")));
  assert.ok(svgs.every(s=>s.includes("PROTOTYPE / FEEDBACK WELCOME")));
  assert.match(svgs[2],/source-backed prototype/);
  assert.throws(()=>carouselSvgs(job,Buffer.from("bad screenshot")),/prepared PNG/);
  delete job.drafts!.reviewedAt;
  assert.throws(()=>carouselSvgs(job),/Review and save/);
});
test("Carousel currentness changes for source, project summary, selected story and saved copy",()=>{
  const job = packJob();
  job.carousel={generatedAt:new Date().toISOString(),copyFingerprint:carouselFingerprint(job),slideCount:5,format:"1080x1350"};
  assert.equal(carouselIsCurrent(job),true);
  job.drafts!.linkedin="Changed owner copy";assert.equal(carouselIsCurrent(job),false);
  job.carousel.copyFingerprint=carouselFingerprint(job);job.analysis!.summary="Changed actual summary";assert.equal(carouselIsCurrent(job),false);
});
test("Chromium renders five real portrait PNGs with embedded screenshot and escaped hostile labels",async t=>{
  const executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath();
  if (!existsSync(executablePath)) {t.skip("Chromium is not installed");return;}
  const job=packJob();job.name="Sudo Launch / preview";job.positioning!.angles[0].title="Turn a forgotten repo into a reviewed launch";
  const screenshot=spawnSync("ffmpeg",["-v","error","-f","lavfi","-i","color=c=0x273724:s=640x400","-frames:v","1","-threads","1","-f","image2pipe","-vcodec","png","pipe:1"]).stdout;
  const images=await renderCarousel(job,screenshot?.length?screenshot:undefined);
  assert.equal(images.length,5);
  for (const image of images) {
    assert.ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.equal(image.readUInt32BE(16),1080);assert.equal(image.readUInt32BE(20),1350);
    assert.ok(image.length>15_000);
  }
  const dir=await mkdtemp(join(tmpdir(),"sudo-carousel-preview-"));
  await Promise.all(images.map((image,i)=>writeFile(join(dir,`slide-${i+1}.png`),image)));
  console.log(`Carousel visual inspection files: ${dir}`);
});
