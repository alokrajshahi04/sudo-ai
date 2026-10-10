# Sources and verification record

Prepared: 2026-10-10 (UTC).

## Source register

Only the event URL was supplied by the participant. The event listing was
successfully retrieved after network access was enabled, but detailed event
facts have not yet been extracted. The remaining links are reference destinations
for further research; their contents have not been retrieved.

| ID | Source | Purpose | Status |
| --- | --- | --- | --- |
| S1 | [Supplied MLH event listing](https://www.mlh.com/events/hacktoberfest-hack-day-amaravati-x-foss-srm-ap) | Event description, logistics, organizer identity, and registration links. | Initial fetches failed; retrieved with HTTP 200 on 2026-10-10 after network access was enabled. Detailed facts have not yet been extracted. |
| S2 | [Hacktoberfest official website](https://hacktoberfest.com/) | Identify the relevant edition and follow its current participation/rules links. | Not retrieved. |
| S3 | [Hacktoberfest participation reference](https://hacktoberfest.com/participation/) | Candidate location for qualification rules; confirm that the page exists and applies to the relevant edition. | Fetch attempted during continuation; hostname resolution failed. Current path and contents remain unverified. |
| S4 | [MLH code of conduct reference](https://mlh.io/code-of-conduct) | Check conduct expectations if the event listing adopts this policy. | Not retrieved; applicability to this event unverified. |
| S5 | [SRM University AP website](https://srmap.edu.in/) | Possible institutional corroboration if the listing identifies this institution as host. | Not retrieved; host relationship unverified. |

## Access limitation

A direct HTTPS fetch of S1 using `curl` failed with:

```text
curl: (6) Could not resolve host: www.mlh.com
```

The initial session had restricted network access, no available web-search/browser
tool, and no exposed MCP resources or resource templates containing source
material. This failure says nothing about whether the event page works elsewhere.

On continuation on 2026-10-10 (UTC), direct HTTPS fetches of both S1 and S3
were attempted again. Both failed with `curl: (6) Could not resolve host`
for their respective hostnames. No additional source content was obtained;
event logistics and current participation rules remain unverified.

Further diagnosis on 2026-10-10 confirmed that the execution sandbox sets
`CODEX_SANDBOX_NETWORK_DISABLED=1` and denies socket connections to both the
configured DNS server and a numeric public IP with `PermissionError: [Errno 1]
Operation not permitted`. The failure is attributable to session network
restrictions; these tests do not establish whether host-side WSL networking
works. See [network troubleshooting](../network-troubleshooting.md).

The participant subsequently enabled session network access on 2026-10-10.
GitHub and the event listing then returned HTTP 200, and Git remote inspection
and cloning succeeded. The access limitation is resolved.

## Completing the research

1. Obtain S1's page text or retrieve it when network access is available. Include registration and rules pages linked from it.
2. Establish the event date and year before applying global program rules.
3. Consult the official Hacktoberfest rules for that edition; archived rules may be needed if the listing describes a past event.
4. Follow organizer links from the listing for schedule changes and event-specific instructions.
5. Add each source's title, URL, access date, and relevant excerpt or factual summary. For pasted text, identify it as participant-provided rather than independently fetched.
6. Replace unknown fields in the event brief with attributed facts. Keep unresolved questions explicit.

## Evidence conventions

- **Participant-provided:** a statement or source supplied by the user.
- **Verified:** directly supported by inspected source content, with a source reference.
- **Inferred:** a conclusion drawn from limited evidence, such as the event title inferred from its URL.
- **General background:** contextual knowledge that does not establish this edition's rules.
- **Unverified:** information still needing a source.

There are currently no independently verified event-specific details.
