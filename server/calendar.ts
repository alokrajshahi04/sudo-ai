import type { Job } from "../shared/types";
import { AppError } from "./errors";
export function launchCalendar(job: Job, start: Date) {
  const angle = job.positioning?.angles[job.selectedAngle];
  if (!angle)
    throw new AppError(
      409,
      "Choose a launch story before preparing a calendar.",
    );
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now())
    throw new AppError(
      400,
      "Choose a future date and time for your first post.",
    );
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const fold = (line: string) => {
    let result = "",
      row = "";
    for (const c of line) {
      if (Buffer.byteLength(row + c) > 73) {
        result += row + "\r\n ";
        row = "";
      }
      row += c;
    }
    return result + row;
  };
  const posts = [
    { channel: "LinkedIn", offset: 0, text: angle.linkedin },
    { channel: "X", offset: 30 * 60_000, text: angle.x },
    {
      channel: "Instagram",
      offset: 24 * 3600_000,
      text: angle.title + "\n\n" + angle.linkedin,
    },
    {
      channel: "Feedback follow-up",
      offset: 3 * 24 * 3600_000,
      text: "Read actual feedback, share what you learned, and update your project. Do not invent results.",
    },
  ];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sudo Launch//Launch Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const [i, post] of posts.entries()) {
    const date = new Date(start.getTime() + post.offset);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${job.id}-${i}@sudo.launch`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(date)}`,
      `DTEND:${stamp(new Date(date.getTime() + 15 * 60_000))}`,
      `SUMMARY:${escape(`Review and share ${job.name} on ${post.channel}`)}`,
      `DESCRIPTION:${escape("Manual publishing reminder. Review all claims and attach your approved launch media.\n\n" + post.text + "\n\n" + job.repository)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Review your launch post",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
