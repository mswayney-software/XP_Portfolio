# Projects

## AI Email Triage Pipeline

*Applied AI Use Case · 2026*

An automated email-triage system that reads incoming customer email for a small
home-goods store, figures out what each message actually needs, and writes a
reply draft only for the ones that should get an automatic answer. The whole
thing runs in n8n calling the Claude API. There is an interactive demo of it on
this portfolio — open the "Email Triage" app on the desktop to step through the
real test set and watch each email get classified, routed, and drafted.

- Classifies each email with Claude Haiku 4.5 into structured JSON (category,
  urgency, intent summary, suggested action, a safety flag, and a confidence
  score), then routes it down one of three lanes: draft (Claude Sonnet 4.6
  writes a reply), review (held for a human), or ignore (junk, no action).
- Reached 93% routing accuracy (37/40) on a 40-email test set, up from a 78%
  baseline, by reading the specific emails it got wrong and tightening the rules.
- Key design decisions: drafts are never auto-sent (a human approves first);
  business rules override model confidence (billing and personal mail always go
  to a human); safety/health/privacy issues are caught by model comprehension
  rather than keyword lists; and validation is wrapped in try/catch so a bad
  model response can never crash the run or silently lose a message.
- Used a cheap model to sort and a stronger model to write, keeping the entire
  build-and-tuning cost to 44 cents in API spend.
- Technologies: n8n (self-hosted with Docker), Claude API (Haiku 4.5 for
  classification, Sonnet 4.6 for drafting), JavaScript for validation, routing,
  and scoring.

## Windows XP Interactive Portfolio

*Personal Project · 2024 – Present*

A fully interactive, browser-based Windows XP environment built with HTML, CSS,
and JavaScript, used as an alternative to a traditional portfolio website — this
is the very site you're on right now.

- Recreates the classic Windows XP experience: a login screen, draggable
  windows, a working file-system-style navigation, a taskbar with a live clock,
  and a Start menu.
- Designed as a desktop-style interface where visitors navigate applications,
  open files, and explore projects interactively.
- Built with AI-assisted development tools to accelerate learning, troubleshoot
  functionality, and refine the front-end design and user experience.
- Technologies: HTML, CSS, JavaScript (no framework — intentionally lightweight).

## Unified Restaurant OS Concept

*Applied AI Use Case · 2024*

An AI-assisted restaurant operating system concept designed to unify fragmented
hospitality tools and streamline front-of-house and kitchen workflows.

- Identified operational inefficiencies firsthand using Toast, JONAS, and other
  restaurant management platforms in high-volume environments.
- Proposed features including offline functionality, workflow consolidation, and
  AI-driven operational support to reduce system complexity and staff workload.
- This is the project Michael has been most focused on recently — an all-in-one
  app spanning scheduling, payroll, front-of-house → back-of-house continuity,
  seating, and HR.
