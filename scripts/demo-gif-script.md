# ChronoShield 30-second demo — recording script

A turn-key shot list for the homepage hero video / Product Hunt gallery / cold-pitch follow-up GIF. Sit down at your desk, follow the steps, ship it. ~30 seconds runtime.

## The narrative arc (memorize this)

A user enters an impossible time. The naive system stores it silently. ChronoShield catches it, the user is asked to confirm, and the correct UTC instant gets stored. Five beats. No filler.

## Setup (do this BEFORE pressing record)

### Tools
- **Recorder**: macOS — Kap (free, GIF-friendly). Windows — ScreenToGif (free). Linux — Peek.
- **Resolution**: 1280×720. Anything bigger looks fuzzy when embedded; smaller looks dated.
- **Frame rate**: 24 fps. Plenty for terminal/browser content; keeps file size reasonable.
- **Output**: Both `.mp4` (for landing page hero, Twitter, LinkedIn) and `.gif` (for GitHub README, dev.to embeds, email).

### Browser
- Use Chrome/Arc with a clean profile (no extensions visible in toolbar, no bookmarks bar).
- Zoom level 100%.
- Window size 1280×720 — most recorders have a "fit window to recording region" button.
- Light or dark theme — dark is more on-brand. If using dark, set OS to dark mode beforehand.

### Tabs to pre-load
1. `chronoshieldapi.com/docs/playground` — the Swagger UI playground
2. (Optional) A blank "fake calendar app" tab. Easiest: open `https://calendar.google.com` so the URL bar suggests "calendar." Don't actually use it; just have the visual.

### Pre-fill the playground request
In the Swagger UI, expand `POST /v1/datetime/validate`, click "Try it out," and pre-fill the body:

```json
{
  "local_datetime": "2026-03-08T02:30:00",
  "time_zone": "America/New_York"
}
```

Don't click Execute yet. You want to record the click.

### Terminal (optional, for the MCP variant — skip if doing the basic version)
A second tab/window with a terminal showing Claude Desktop configured with the MCP server. Have a chat ready that says "Schedule a reminder for 2:30 AM on March 8, 2026 in New York" — but don't send. You'll send during recording.

## The basic 30-second version (recommended for v1)

This is the version you ship first. Browser-only. No terminals, no Claude Desktop. Cleanest demo.

### Beat 1 — The set-up (0:00–0:05, 5 seconds)

**On screen:** Swagger UI playground, request body visible:
```json
{
  "local_datetime": "2026-03-08T02:30:00",
  "time_zone": "America/New_York"
}
```

**Text overlay (top-left, large):** *"User picks 2:30 AM on spring-forward day…"*

**Action:** Cursor hovers near the request body for a beat. Static frame.

### Beat 2 — Naive expectation (0:05–0:10, 5 seconds)

**On screen:** Same Swagger UI. Cursor moves toward the Execute button.

**Text overlay:** *"Most libraries silently store it. The meeting fires an hour late."*

**Action:** Cursor hovers over Execute, doesn't click yet. Tension.

### Beat 3 — The reveal (0:10–0:18, 8 seconds)

**On screen:** Cursor clicks Execute. Response panel populates with:
```json
{
  "status": "invalid",
  "reason_code": "DST_GAP",
  "message": "This time does not exist due to DST transition.",
  "suggested_fixes": [
    { "strategy": "next_valid_time", "local_datetime": "2026-03-08T03:00:00" },
    ...
  ]
}
```

**Text overlay (animate in):** *"DST_GAP — caught."*

**Action:** Brief pause on the response. The viewer's eye lands on `"reason_code": "DST_GAP"`.

### Beat 4 — The fix (0:18–0:25, 7 seconds)

**On screen:** Highlight (yellow box or zoom-in) the `suggested_fixes[0].local_datetime` value: `"2026-03-08T03:00:00"`.

**Text overlay:** *"Suggested fix: 3:00 AM. App asks the user to confirm."*

**Action:** Cursor circles or underlines the suggested time.

### Beat 5 — The close (0:25–0:30, 5 seconds)

**On screen:** Tab/window flip to a brand-marked closing card OR scroll back to the homepage hero. Show:
- ChronoShield logo
- One line of copy: *"Preflight datetime validation. Free tier — no card."*
- URL: `chronoshieldapi.com`

**Action:** Static for 3 seconds, then end.

## Voiceover script (optional, only for the MP4 — skip for GIF)

If you want narration, record a 25-second take in QuickTime / Audacity / phone voice memo. Read this:

> A user picks 2:30 AM on the second Sunday of March in New York for a meeting. That time doesn't exist — clocks jump from 2 to 3 AM. Most date libraries silently shift it. The meeting fires an hour late.
>
> ChronoShield returns DST_GAP with a suggested fix. Your app asks the user: "did you mean 3:00 AM?" They confirm, you store the correct UTC instant. No silent bug. No 4 AM phone call.
>
> ChronoShield API. Free tier, no card. chronoshieldapi.com.

Pace: 150 words per minute. Don't rush the "DST_GAP" pronunciation — say it clearly: "D-S-T gap."

## The MCP variant (record this second, after v1 is shipped)

Same arc, but the action is in Claude Desktop instead of Swagger UI. Higher-impact for AI-developer audiences (LocalLLaMA, ClaudeAI, MCP communities).

### Setup
- Claude Desktop running with `chronoshield-mcp` configured (see `mcp/README.md`).
- A chat already started, ready for the next user message.

### The recording

**Beat 1 (0:00–0:05):** Type slowly: *"Schedule a reminder for 2:30 AM on March 8, 2026 in New York."* Press Enter.

**Beat 2 (0:05–0:15):** Claude responds. Visible in the response: it calls the `validate_local_datetime` tool. Tool result shows in the UI with `DST_GAP`.

**Beat 3 (0:15–0:25):** Claude says (auto-generated, but predictable): *"That time doesn't exist on March 8 because of daylight saving time — clocks jump from 2:00 AM to 3:00 AM. Want me to use 3:00 AM instead?"*

**Beat 4 (0:25–0:30):** Closing card with `chronoshield-mcp` install snippet:
```json
{ "command": "npx", "args": ["-y", "chronoshield-mcp"], "env": { "CHRONOSHIELD_API_KEY": "..." } }
```

**Caption above the video for social posts:**
> "Watch Claude almost schedule a meeting at a time that doesn't exist — and then catch itself. (chronoshield-mcp on npm.)"

## Editing checklist

- [ ] Trim dead air at start and end
- [ ] Speed up any cursor movement that takes >2 seconds (1.5× is invisible to viewers)
- [ ] Color-grade brightness up 10% if recording feels dim
- [ ] Add the brand logo as a small watermark in bottom-right (so re-shares stay attributed)
- [ ] Export both `.mp4` (1280×720, h.264, ~2-3 MB) and `.gif` (1280×720, palette-optimized, ~3-5 MB)
- [ ] If GIF is over 5 MB, drop to 800×450 or 18 fps. Bigger files don't load on slow connections.

## Where to use the output

| Asset | File | Notes |
|---|---|---|
| Landing page hero | `.mp4`, autoplay+muted+loop | Above the fold. Replaces or complements current text hero. |
| Twitter/X post | `.mp4` | Native upload (better algo treatment than YouTube embed). |
| LinkedIn post | `.mp4` | Native upload. |
| Dev.to post (existing) | `.gif` | Add to your existing post as a "the bug in motion" callout. |
| Cold-pitch follow-ups (Cal.com etc.) | `.gif` link or Loom | Loom may be better for cold pitches because it tracks views. |
| GitHub README | `.gif` | At the very top, above the install snippet. |
| Product Hunt gallery | `.mp4` | Required: PH wants 16:9 video for the gallery. |

## Common mistakes to avoid

- **Recording too long.** 30 seconds is the cap. If you can't tell the story in 30, your story is unclear, not your time too short.
- **Showing the keyboard.** Nobody cares about your typing. Cut to the result.
- **Animated text overlays that are too fancy.** Plain white sans-serif on a subtle background is more credible than slick motion-graphics. The product is the substance, not the production.
- **Low-resolution recording.** 1280×720 minimum. Anything below looks like a 2018 SaaS demo.
- **Inconsistent timing.** Use a stopwatch on your phone while recording. Long pauses kill viewer retention.

## When to re-record

- After significant API/UI changes
- When you have a real customer story to feature ("How [Company] uses ChronoShield" — different script)
- For each major version bump (v1.5, v2.0)
- If the first version's analytics show <30% completion rate, the story isn't landing — re-edit before re-recording

---

That's it. Block 90 minutes on a calendar, do the setup, do 3 takes of the basic version, edit the best one, ship it the same afternoon. Don't let it become a multi-week project.
