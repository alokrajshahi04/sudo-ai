import { chromium } from "playwright";
import type { Job } from "../shared/types";
import { currentDrafts } from "../shared/launch-copy";
import { AppError, redact } from "./errors";

const W = 1080, H = 1350;
function xml(value: string) {
  return redact(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]!);
}
function wrapped(value: string, width: number, count: number): string[] {
  const rows: string[] = [];
  let row = "";
  for (const word of value.replace(/\s+/g," ").trim().split(" ")) {
    if (row && row.length + word.length + 1 > width) { rows.push(row); row = ""; }
    let rest = word;
    while (rest.length > width) { if (row) { rows.push(row); row = ""; } rows.push(rest.slice(0,width)); rest = rest.slice(width); }
    if (rest) row += (row ? " " : "") + rest;
  }
  if (row) rows.push(row);
  return rows.slice(0,count).map((r,i)=>i===count-1 && rows.length>count ? r.slice(0,-1)+"…" : r);
}
const text = (value:string,x:number,y:number,size:number,color="#edece6") => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${xml(value)}</text>`;
const block = (value:string,y:number,size:number,width:number,count:number,color="#edece6") => wrapped(value,width,count).map((r,i)=>text(r,76,y+i*size*1.35,size,color)).join("");

export function carouselSvgs(job: Job, screenshot?: Buffer): string[] {
  const angle = job.positioning?.angles[job.selectedAngle];
  if (!angle || !job.launchBrief) throw new AppError(409,"Choose a launch story and confirm your project brief first.");
  const drafts = currentDrafts(job);
  if (drafts && !drafts.reviewedAt) throw new AppError(409,"Review and save your launch copy before generating the carousel.");
  if (screenshot && (screenshot.length > 8_000_000 || !screenshot.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))
    throw new AppError(400,"Carousel screenshots must be a prepared PNG up to 8 MB.");
  const mode = job.launchMode === "prototype" ? "PROTOTYPE / FEEDBACK WELCOME" : job.site?.reachable ? "PUBLIC DEMO / TRY IT YOURSELF" : "SOURCE LAUNCH / EXPLORE THE REPO";
  const cta = job.site?.reachable ? job.site.finalUrl : job.inspection?.private ? "Ask the creator for project access" : job.repository;
  const summary = job.analysis?.summary || job.inspection?.description || "Explore the project source and share your feedback.";
  const limitations = job.positioning?.limitations?.slice(0,2).join(" ") || "Source inspected. Product interactions are not fully verified.";
  const bodies = [
    block(angle.title,400,70,21,5) + block(`For ${angle.audience}`,940,34,42,3,"#b3b8ae"),
    block("Who is this for?",400,64,22,3) + block(job.launchBrief.audience,650,40,36,4) + block(job.launchBrief.context || "A project shared for real people to try, inspect, and improve.",980,30,46,4,"#b3b8ae"),
    block("What the source shows",400,60,23,3) + block(summary,685,36,40,9,"#ced2c8"),
    block(screenshot ? "A real look at the project" : "Look closer. Check the source.",380,56,25,3) +
      (screenshot ? `<rect x="76" y="600" width="928" height="460" rx="12" fill="#141a15"/><image x="90" y="614" width="900" height="432" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${screenshot.toString("base64")}"/>${block(job.capture ? "Public-page capture / approved steps only" : "Creator-supplied screenshot / review the claims",1110,23,58,2,"#b3b8ae")}` : block(limitations,690,34,40,7,"#b3b8ae")),
    block("Give it a try.",400,70,21,3) + block(job.launchBrief.goal || "Share your feedback with the creator.",660,40,36,4) + block(cta,995,28,51,4,"#d9b083"),
  ];
  const labels = ["THE HOOK","THE PEOPLE","THE VALUE","THE PROOF","YOUR NEXT STEP"];
  return bodies.map((body,i)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="1080" height="1350" fill="#0d110e"/><g stroke="#1a251d">${Array.from({length:18},(_,n)=>`<path d="M${n*64} 0V1350"/>`).join("")}${Array.from({length:22},(_,n)=>`<path d="M0 ${n*64}H1080"/>`).join("")}</g><g font-family="DejaVu Sans, sans-serif"><rect x="76" y="85" width="10" height="40" fill="#f4553a"/>${text(wrapped(job.name,55,1)[0] || "Project",110,116,28,"#b8c1b4")}${text(`0${i+1} / ${labels[i]}`,76,253,25,"#f4553a")}${body}<path d="M76 1200H1004" stroke="#344135"/>${text(mode,76,1250,19,"#a1ad9b")}${text(`${i+1}/5`,940,1250,20,"#d9b083")}${text("sudo.launch_",76,1300,18,"#6f7e6b")}</g></svg>`);
}

export async function renderCarousel(job: Job, screenshot?: Buffer): Promise<Buffer[]> {
  const svgs = carouselSvgs(job,screenshot);
  let browser;
  try {
    browser = await chromium.launch({headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath()});
    const context = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,javaScriptEnabled:false,serviceWorkers:"block"});
    await context.route("**/*",route=>route.abort());
    const page = await context.newPage();
    const images: Buffer[] = [];
    for (const svg of svgs) {
      await page.setContent(`<html><head><style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}</style></head><body>${svg}</body></html>`,{timeout:10000,waitUntil:"load"});
      // setContent waits for embedded image decoding; no repository code executes.
      images.push(await page.screenshot({type:"png",timeout:10000}));
    }
    return images;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(409,"Carousel rendering failed. Check Chromium installation (npm run setup:browser) and retry.");
  } finally { await browser?.close(); }
}
