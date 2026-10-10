import type { Job } from "../../shared/types";
export function packJob(): Job {
  const phases = Object.fromEntries(["inspect","analyze","music","research","position","verify","recording","narrate","render","carousel"].map(p=>[p,{state:"idle"}])) as Job["phases"];
  return {
    id:"pack-test",name:"A useful project",repository:"https://github.com/owner/project",brief:"",createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),
    selectedAngle:0,modelPreference:"nebius",phases,artifacts:[],launchMode:"prototype",launchBrief:{audience:"Student developers",goal:"Find real testers",context:"An early prototype"},
    positioning:{generatedAt:"2026-10-10T05:00:00Z",provider:"nebius",model:"fixture",limitations:["Interactions still need testing"],angles:[{title:"A useful prototype",audience:"Student developers",rationale:"Source-supported",evidenceIds:["source-1"],linkedin:"Generated LinkedIn",x:"Generated X",narration:"Generated speech"}]},
    drafts:{linkedin:"Owner-edited LinkedIn",x:"Owner-edited X",instagram:"Owner-edited Instagram",narration:"Owner-approved speech",updatedAt:"2026-10-10T05:01:00Z",reviewedAt:"2026-10-10T05:01:00Z",angleIndex:0,positioningGeneratedAt:"2026-10-10T05:00:00Z"},
    analysis:{summary:"A source-backed prototype for sharing project notes.",suggestedBrief:{audience:"Students",goal:"Feedback",context:""},assumptions:[],evidenceIds:["source-1"],provider:"nebius",model:"fixture",generatedAt:"2026-10-10T04:59:00Z"},
  };
}
