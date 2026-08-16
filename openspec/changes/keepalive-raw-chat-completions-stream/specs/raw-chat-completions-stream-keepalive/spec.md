## ADDED Requirements

### Requirement: Raw Chat Completions streams SHALL emit downstream keepalive while the upstream is silent

When `gateway.stream_keepalive_interval` is positive, the raw Chat Completions passthrough SHALL write an SSE comment (`:\n\n`) downstream once that interval elapses without upstream data, so reverse proxies in front of the gateway do not treat a long thinking pause as an idle connection.

#### Scenario: Long thinking pause keeps the connection alive
- **WHEN** a streaming raw Chat Completions request runs and the upstream sends no bytes for longer than the keepalive interval
- **THEN** the gateway SHALL write at least one SSE comment downstream before the upstream resumes
- **AND** the eventual upstream frames and `data: [DONE]` SHALL still reach the client unmodified

#### Scenario: Keepalive does not release buffered semantic frames
- **WHEN** a keepalive comment is written while the silent-refusal detector is still withholding buffered frames
- **THEN** only the SSE response headers and the comment SHALL be committed
- **AND** the buffered frames SHALL remain withheld until the detector releases them

#### Scenario: Keepalive does not commit attempt-specific upstream response headers
- **WHEN** a keepalive comment is the first thing written downstream for a request
- **THEN** only the stable SSE headers (`Content-Type`, `Cache-Control`, `Connection`, `X-Accel-Buffering`) and `200` SHALL be committed
- **AND** attempt-specific upstream response headers such as `x-request-id` SHALL NOT be committed, so a later account switch is not stuck with the failed attempt's headers
- **AND** a stream whose first downstream write is a semantic frame SHALL still pass the filtered upstream response headers through

#### Scenario: Keepalive waits for a frame boundary
- **WHEN** the upstream pauses longer than the keepalive interval after emitting part of a multi-line SSE frame (for example `event:` or a first `data:` line) but before its terminating blank line
- **THEN** no keepalive comment SHALL be written until that frame is terminated, because the comment's blank line would end the frame early
- **AND** the frame SHALL reach the client intact
- **AND** a pause that starts on a frame boundary SHALL still produce a keepalive comment

### Requirement: Keepalive SHALL NOT disable silent-refusal failover

A failover raised after only SSE comments were written SHALL be marked as safe to fail over after write, so adding keepalive does not remove the gateway's ability to switch accounts on a silent refusal.

#### Scenario: Silent refusal after keepalive still switches accounts
- **WHEN** the upstream stays silent long enough for a keepalive comment, then returns an empty completion with `finish_reason=stop` and no usage
- **THEN** the returned failover error SHALL report `SafeToFailoverAfterWrite`
- **AND** no semantic frame SHALL have been written to the client

#### Scenario: The Chat Completions failover gate honors the flag
- **WHEN** the Chat Completions handler receives a failover error whose `SafeToFailoverAfterWrite` is set and the response writer already grew because keepalive comments were written
- **THEN** the handler SHALL NOT treat the write as exhausting failover, and SHALL continue to the next account
- **AND** once the response is committed the handler SHALL emit any subsequent error in streaming form

### Requirement: Raw Chat Completions streams SHALL bound upstream read idleness

The passthrough SHALL stop waiting once the upstream produces no bytes for the resolved idle window, so keepalive cannot hold a hung upstream open indefinitely. Grok accounts SHALL use the shared Grok idle default; other upstreams SHALL use `gateway.stream_data_interval_timeout`, where `0` disables the bound.

#### Scenario: Hung upstream is released
- **WHEN** the upstream sends no bytes for longer than the resolved idle window
- **THEN** the passthrough SHALL stop and report a stream data interval timeout
- **AND** the usage collected so far SHALL still be returned for billing

#### Scenario: Partial usage from an idle timeout is recorded
- **WHEN** the Chat Completions handler receives a non-failover error together with a result that carries non-zero token counts
- **THEN** the handler SHALL submit that result for usage recording before returning, because the upstream already metered those tokens
- **AND** failover errors SHALL NOT be recorded this way, so a retry on another account cannot double-bill

#### Scenario: Both timers disabled keeps the original synchronous path
- **WHEN** keepalive interval and idle window are both non-positive
- **THEN** the passthrough SHALL read the upstream synchronously exactly as before, with no keepalive and no idle bound
