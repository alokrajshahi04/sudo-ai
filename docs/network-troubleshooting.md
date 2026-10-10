# Network access diagnosis

Diagnosed and resolved on 2026-10-10 (UTC).

## Initial failure

The initial Codex execution sandbox disabled network access. `curl` and Git
reported DNS failures because the resolver could not use the network. Changing
WSL DNS was not needed to resolve this restriction.

Observed evidence from the restricted session:

- `CODEX_SANDBOX_NETWORK_DISABLED=1`.
- DNS lookups for `github.com`, `www.mlh.com`, and `hacktoberfest.com` failed;
  `localhost` resolved from the hosts file.
- TCP socket connections to the configured DNS server (`10.255.255.254:53`)
  and a numeric public IP (`1.1.1.1:443`) both failed with
  `PermissionError: [Errno 1] Operation not permitted`.
- Network interface inspection also returned `Operation not permitted`.
- The sandbox's `/proc/net/route` contained no routes.

These results established a session permission restriction. They did not
establish a fault in campus DNS or host-side WSL networking.

## Resolution and verification

The participant changed the session permissions to enable network access.
Subsequent checks succeeded:

- GitHub returned HTTP 200.
- The supplied MLH event listing returned HTTP 200.
- `git ls-remote` and `git clone` reached the selected working repository.

The original network blocker is resolved. The local workspace has been
connected to the working repository while preserving its existing license and
initial commit.

If this recurs, check the session's network permissions before changing DNS.
Compare a request from the regular host terminal with the same request inside
Codex to distinguish host connectivity from sandbox restrictions.
