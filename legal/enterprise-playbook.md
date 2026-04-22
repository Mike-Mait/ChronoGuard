# ChronoShield Enterprise Playbook — Internal Operations

> **Internal document — not for customer distribution.** This is the operational runbook for handling enterprise deals end to end. Keep it in the repo so it's versioned; update it after every deal with lessons learned.

---

## 0. How to use this document

- **Ctrl-F is your friend.** Headings are verbose on purpose.
- **Templates are copy-paste-ready.** Replace bracketed placeholders like `[[Company]]` before sending.
- **SQL uses the real table name `api_keys`** — not `ApiKey`. Double-check every query before running against production.
- **Lessons-learned log is at the bottom** (§12). Add a bullet after every deal, win or lose.
- **Cross-reference**: the DPA template lives at [`legal/DPA-template.md`](./DPA-template.md). Send it with the MSA to every serious enterprise prospect.

---

## 1. First enterprise deal checklist (one-time setup)

Do these **before** your first qualified inquiry so you're not scrambling mid-deal.

- [ ] Attorney has reviewed `legal/DPA-template.md` and flagged `v1.0 — attorney-reviewed`
- [ ] Attorney has drafted a matching **Master Services Agreement (MSA)** — save as `legal/MSA-template.md` (do NOT commit the actual attorney-drafted version to a public repo if this is public; use a private location)
- [ ] E-signature tool account created (DocuSign / HelloSign / PandaDoc — pick one, $15–20/mo)
- [ ] Stripe test-mode invoice sent to yourself once, just to learn the UI
- [ ] `sales@chronoshieldapi.com` mailbox is actively monitored (same inbox as personal, or separate — either is fine)
- [ ] Google Calendar shared view for "Enterprise renewals" created (this is your renewal tracker until Stage 9 volume demands something fancier)
- [ ] Bank account can receive **ACH and wire** (Mercury or Wise Business — the ACH-receive feature is essential)
- [ ] You know the difference between an MSA, Order Form, and DPA and can explain it to a customer in one sentence each (see §8 if not)

---

## 2. Lifecycle overview — the 10-stage decision flow

```
┌─ Stage 1: Inquiry ──────────────► /api/contact, email, or ref
│        respond within 1 business day
│
├─ Stage 2: Discovery call (30 min)
│        qualify: volume, timeline, budget, compliance
│        ┌── disqualified → send free/pro upgrade link, close politely
│        └── qualified ────┐
│                          ▼
├─ Stage 3: Proposal & quote (1-page)
│        price, volume, term, SLA, payment terms
│        ┌── rejected ────► send revised OR close
│        └── accepted ────┐
│                          ▼
├─ Stage 4: Contract execution
│        send: Order Form + MSA + DPA
│        they sign → you counter-sign → save to legal/signed/[date]-[company]/
│
├─ Stage 5: Invoicing
│        Stripe Invoicing (recommended) OR wire invoice
│        first invoice due BEFORE provisioning
│
├─ Stage 6: Provisioning
│        SQL UPDATE on api_keys — see §5 SQL cookbook
│        confirm email to customer with new limits
│
├─ Stage 7: Onboarding
│        welcome email + optional 30-min integration call
│        offer Slack Connect if >$10K/yr
│
├─ Stage 8: Ongoing ops (monthly)
│        review usage, flag >80% users, check invoices paid
│
├─ Stage 9: Renewal (starts 90 days before term end)
│        90/60/30-day touchpoints
│        renew, upsell, downgrade, or churn
│
└─ Stage 10: Offboarding
         non-renewal OR non-payment OR customer-initiated cancel
         downgrade to free (not revoke, unless required)
         honor DPA §5.7 data deletion if requested
```

---

## 3. Stage-by-stage runbook

### Stage 1 — Inquiry

**Where they come from**:
- Landing page "Contact Sales" button → `/api/contact` → email to you
- Direct email to `sales@chronoshieldapi.com`
- Referrals (track in §11)

**Your SLA to yourself**: respond within **1 business day**. Even a 3-line "got it, let's schedule a call" reply preserves momentum. Silence is the #1 killer of enterprise deals at this stage.

**Information to extract** in the reply (or via a brief form):
- Company name + website
- Primary contact (name, role, email, phone optional)
- Expected request volume (per month)
- Use case (1–2 sentences)
- Target go-live date
- Any mandatory compliance (DPA, SOC 2, HIPAA, specific SCCs)
- Preferred billing cadence (monthly / annual / other)

**Email template: inquiry reply** → see §6, Template A.

### Stage 2 — Discovery call

**Length**: 30 minutes, video preferred. Calendly or manual scheduling both work.

**Goals of the call**:
1. Confirm they have a real use case (not tire-kicking)
2. Understand their volume and how it'll grow
3. Identify technical and business stakeholders
4. Surface any blockers (compliance, budget approval, existing vendor)
5. Set expectations on next steps and timing

**Script outline**:
- 2 min: Your intro + "what's ChronoShield, in 2 sentences"
- 5 min: Their current solution and what's painful
- 10 min: Their volume, use case, timeline
- 5 min: Compliance/legal requirements
- 5 min: Budget / decision process (don't skip — feels awkward, pays off)
- 3 min: Next steps and your commitment (e.g., "I'll send a quote by Thursday")

**Disqualification criteria** (be ruthless — bad deals are worse than no deals):
- Volume <50K req/mo → send them to Pro tier
- Budget <$300/mo when volume would justify $1K+ → not a fit
- Want a custom endpoint that's >1 week of work for <$2K/mo uplift → not a fit yet
- Refuse to sign an MSA → not a fit (don't do handshake enterprise deals)
- Timeline "ASAP, needs to be live tomorrow" + wants custom features → politely defer

**Follow-up**: send recap email within 24 hours. See §6, Template B.

### Stage 3 — Proposal & quote

**Deliverable**: one-page quote as a PDF or Google Doc link. Not a 15-slide deck.

**Minimum content**:

| Line item | Example |
|---|---|
| Plan name | ChronoShield Enterprise |
| Monthly request volume | 5,000,000 |
| Overage behavior | Hard cap (returns 429) |
| SLA | 99.9% monthly uptime |
| Support | Email within 1 business day; critical-incident response within 4 business hours |
| Term | 12 months, auto-renews with 30-day non-renewal notice |
| Price | $2,500/month OR $25,500/year (~15% annual discount) |
| Payment terms | ACH / wire / card; NET 30 from invoice date |
| Valid until | [[date +14 days]] |
| Notes | Custom endpoints and on-call support available as add-ons |

**Pricing anchors** (update as you learn):

| Monthly volume | Self-serve Pro tier? | Enterprise monthly range | Notes |
|---|---|---|---|
| <100K | Yes (Pro) | N/A — deflect to Pro | |
| 100K–500K | Borderline | $300–$800/mo | Deal is only worth it if they need DPA or specific SLA |
| 500K–5M | Enterprise | $1,000–$5,000/mo | Your bread and butter |
| 5M–50M | Enterprise | $5,000–$20,000/mo | Offer 10–20% annual discount |
| 50M+ | Enterprise + custom | $20,000+/mo | Open to custom infrastructure; talk to attorney re: custom SLA |

**Negotiation rules of thumb**:
- Always have a "yes, if..." response ready — never flat "no"
- Discount off the list price, never off the value
- If pressed on price, trade: longer term for lower price, or volume increase for lower per-request cost
- Never offer more than 20% off without a compelling reason — it trains the market that your list price is fake

**Email template: send the quote** → see §6, Template C.

### Stage 4 — Contract execution

**Documents, in the order they should flow**:

1. **Order Form** (1 page) — the *only* doc that changes per deal. References the MSA and DPA. This is the doc they actually sign.
2. **MSA** (8–15 pages) — attorney-drafted boilerplate. Rarely negotiated for <$25K/yr deals.
3. **DPA** (see `legal/DPA-template.md`) — send if they're EU, process EU user data, or are a US enterprise with standard DPA policy. Don't send if unnecessary — it adds friction for deals where it isn't required.

**Process**:
1. Send all three as a single e-signature envelope (DocuSign/HelloSign bundle).
2. They review (may take 1–4 weeks for bigger accounts — their legal team reviews the MSA).
3. They sign → you countersign → e-sign platform stores the executed version.
4. **Save a PDF copy in `legal/signed/[YYYY-MM-DD]-[company-slug]/`** (local, not committed to public repo — use `.gitignore`).
5. Update your tracker (§11).

**Red flags during legal review**:
- "Uncapped indemnification" → hard no; counter with 12 months of fees cap
- "Unlimited audit rights" → counter with "once per year, 30-day notice, at your cost"
- "We won't sign an MSA; use our paper" → OK if they're >$50K/yr and you have time; otherwise push back
- "We need you to delete data within 24 hours on request" → counter with 30 days (aligns with DPA template)

### Stage 5 — Invoicing

**Decision tree**:

```
Is the deal ≤$2K/mo AND they want to pay by card?
  └─ YES → Stripe recurring invoice (closest to self-serve)
  └─ NO ↓

Is the deal paid annually upfront?
  └─ YES → Stripe one-time invoice (once per year)
  └─ NO ↓

Is the deal >$10K/mo AND they want to pay by wire?
  └─ YES → PDF invoice, direct wire to Mercury/Wise
  └─ NO → Default: Stripe recurring invoice (ACH preferred to avoid card fees)
```

**Stripe Invoicing — step-by-step** (see §7 for the cheat sheet).

**Payment-before-provisioning rule**: for the **first** invoice, do not provision the enterprise tier until payment clears. No exceptions. Exception: you're doing a free 2-week pilot that was explicitly agreed in writing.

**Payment-timing expectations**:
- ACH: 3–5 business days to clear
- Card: instant
- Wire (domestic): same-day to 1 business day
- Wire (international): 2–5 business days
- If they claim payment was sent but you don't see it after expected window, ask for a confirmation/trace number — don't provision on "I promise it's coming"

### Stage 6 — Provisioning

See §5 SQL cookbook for the exact queries.

**Pre-flight checklist**:
- [ ] Payment confirmed received (Stripe shows paid, or wire landed in bank)
- [ ] Order Form, MSA, DPA all countersigned and filed
- [ ] Customer has created a free-tier account at https://chronoshieldapi.com and shared their email with you (the email is the join key for the SQL UPDATE)
- [ ] Agreed monthly limit confirmed in writing (not verbally)

**Steps**:
1. Run the UPDATE SQL from §5.1 in Railway's Postgres console.
2. Verify with the SELECT from §5.2 — confirm `tier='enterprise'`, `requests_limit`, `active=true`.
3. Send welcome email (§6, Template D).
4. Update tracker (§11) — record: customer, signed date, renewal date, monthly price, tier.

**If something goes wrong**: rollback query in §5.6. Never leave a half-provisioned row — it creates confusion about whether they paid or not.

### Stage 7 — Onboarding

Within 48 hours of provisioning:

**Welcome email** (§6, Template D) includes:
- Confirmation of their new limit and renewal date
- Link to API docs
- Link to Postman collection (if you have one)
- Your direct email as support contact
- Offer of a 30-min integration call

**For accounts >$10K/yr**: offer a Slack Connect shared channel. Cost: $0 if they have Slack. Huge retention benefit. Creates a direct feedback loop and makes expansion conversations natural.

**For accounts >$25K/yr**: schedule a quarterly business review (QBR) cadence from day one. 30 min per quarter.

### Stage 8 — Ongoing operations

**Monthly hygiene** (~15 min on the 1st of each month):

1. Run §5.3 — list all enterprise customers and usage %
2. For anyone at >80% of limit: email them (Template E) to discuss upgrade
3. For anyone at >95% of limit: follow up within 24h — they're about to hit the cap
4. Verify all invoices for the month are paid (Stripe dashboard)
5. For unpaid invoices >15 days past due: send reminder; >30 days: escalate (see §10)

**Quarterly** (for QBR accounts):
- 30-min call: usage report, roadmap preview, pain points, expansion opportunities
- Written summary emailed after

**Do not**:
- Suggest downgrade to customers who are under-using — they're happy, don't kick the hornet's nest
- Change limits, pricing, or terms mid-term without a signed amendment
- Share customer names in marketing without explicit written permission

### Stage 9 — Renewal

**Timeline** (12-month term):

| Days before term end | Action |
|---|---|
| 90 | Email customer: "Your term ends [date]. Want to renew at current terms, or has your usage changed?" |
| 60 | If no response: follow up. Loop in technical contact AND billing contact. |
| 45 | Send renewal Order Form (new term, updated pricing if applicable) |
| 30 | If not signed yet: escalation call |
| 14 | Last chance email; flag internal risk |
| 0 (term end) | If signed → new invoice auto-fires. If not signed → downgrade per Stage 10 |

**Pricing changes at renewal**:
- Industry norm: 3–7% annual increase ("cost of living / service expansion")
- If usage has grown >2×: propose a volume-adjusted tier, not just a price bump
- If usage is flat and they're happy: consider holding price to reward loyalty
- If usage has shrunk or they're grumbling: consider a 5–10% discount to retain — churn costs 3–5× more than a concession

**Email template: 90-day renewal ping** → §6, Template F.

### Stage 10 — Cancellation / offboarding

#### Path A: Customer-initiated (non-renewal or MSA-permitted cancellation)

1. Acknowledge within 24 hours in writing. Do **not** argue or try to save the deal yet — first acknowledge.
2. Then (within 48 hours): one polite "save" attempt — offer a call to understand what's not working. ~25% of "we're canceling" emails can be saved with a focused conversation. Don't push past one attempt.
3. Confirm end date in writing (per MSA — typically end of current paid period, no refund).
4. On end date: run §5.4 (downgrade to free — don't revoke unless requested).
5. If they requested data deletion per DPA §5.7: run §5.5 (full delete) within 30 days, then send written confirmation per Template G.
6. Update tracker (§11): mark as churned, record reason.

#### Path B: Non-payment

- NET 30 passes + 15-day grace period → send polite reminder
- +15 more days (60 total past due) → written warning email, pause new API requests (§5.7 — set `active=false` via admin endpoint)
- +30 more days (90 total past due) → formal termination notice per MSA, downgrade to free, write off the bad debt
- Document every step in case of dispute

#### Path C: AUP violation

- If severe (abuse, resale, clear breach) → immediate suspension (set `active=false`), then formal termination notice
- If minor (e.g., one-off misuse) → one warning, document it, give 14 days to remediate
- Always follow the MSA termination-for-cause process — don't improvise

---

## 4. Pricing reference

See anchors in Stage 3. Update this section after every 3 deals with what actually closed at what price.

**Pricing as of [[YYYY-MM-DD]]**:

| Tier | Volume | Monthly | Annual (paid upfront) | Notes |
|---|---|---|---|---|
| Free | 1,000 req/mo | $0 | — | Self-serve |
| Pro | 100,000 req/mo | $[[X]] | $[[Y]] | Self-serve via Stripe Checkout |
| Enterprise Starter | 500K–2M | $1,000–2,500 | −15% | Most common |
| Enterprise Growth | 2M–10M | $2,500–7,500 | −15% | Custom SLA optional |
| Enterprise Scale | 10M–50M | $7,500–20,000 | −20% | Dedicated support |
| Enterprise Custom | 50M+ | Custom | Custom | Talk to attorney first |

---

## 5. SQL cookbook

> **All queries run against the Railway Postgres `api_keys` table.** The table name is lowercase + underscores, **not** `ApiKey` (Prisma model name).
>
> **Always run the SELECT version first** (dry run) before the UPDATE/DELETE version.

### 5.1 Provision an enterprise customer

```sql
-- Upgrade an existing account to Enterprise tier
-- REPLACE placeholders before running:
--   'customer@example.com'  → customer's primary technical contact email
--   5000000                 → agreed monthly request limit
UPDATE api_keys
SET
  tier = 'enterprise',
  requests_limit = 5000000,
  requests_used = 0,
  reset_at = date_trunc('month', now()) + interval '1 month',
  active = true
WHERE email = 'customer@example.com'
RETURNING id, email, tier, requests_limit, reset_at, active;
```

**Expected output**: exactly one row returned. If zero rows, the customer hasn't created a free account yet — send them the landing page link and wait.

### 5.2 Verify enterprise provisioning

```sql
SELECT id, email, tier, requests_limit, requests_used, reset_at, active, created_at
FROM api_keys
WHERE email = 'customer@example.com';
```

### 5.3 Monthly enterprise usage report

```sql
SELECT
  email,
  tier,
  requests_used,
  requests_limit,
  ROUND(100.0 * requests_used / NULLIF(requests_limit, 0), 1) AS percent_used,
  reset_at,
  active
FROM api_keys
WHERE tier = 'enterprise'
ORDER BY percent_used DESC NULLS LAST;
```

### 5.4 Downgrade enterprise → free (cancellation, not deletion)

```sql
UPDATE api_keys
SET
  tier = 'free',
  requests_limit = 1000,
  reset_at = date_trunc('month', now()) + interval '1 month',
  active = true
WHERE email = 'customer@example.com'
RETURNING id, email, tier, requests_limit;
```

### 5.5 Data deletion per DPA §5.7

```sql
-- Step 1: delete request logs for this customer's keys
DELETE FROM request_logs
WHERE api_key_id IN (
  SELECT id FROM api_keys WHERE email = 'customer@example.com'
);

-- Step 2: delete the api_keys row itself
DELETE FROM api_keys
WHERE email = 'customer@example.com'
RETURNING id, email;
```

**After running, send the customer written confirmation per Template G. Note in your records that deletion completed on [date].**

### 5.6 Rollback a bad provisioning

```sql
-- If you provisioned the wrong customer or wrong limit, revert:
UPDATE api_keys
SET
  tier = 'free',                   -- or 'pro' if they were Pro before
  requests_limit = 1000,           -- or 100000 if they were Pro
  requests_used = 0
WHERE email = 'customer@example.com';
```

### 5.7 Suspend for non-payment (reversible)

```sql
-- Temporarily block API access without losing the account
UPDATE api_keys
SET active = false
WHERE email = 'customer@example.com';

-- To restore after payment:
UPDATE api_keys
SET active = true
WHERE email = 'customer@example.com';
```

### 5.8 Audit: list all non-free accounts

```sql
SELECT tier, COUNT(*) AS count
FROM api_keys
WHERE tier IN ('pro', 'enterprise') AND active = true
GROUP BY tier;
```

---

## 6. Email templates

### Template A — Inquiry acknowledgment (Stage 1)

```
Subject: Re: ChronoShield Enterprise inquiry

Hi [[Name]],

Thanks for reaching out — happy to walk you through what an Enterprise plan
looks like for [[Company]].

A few quick questions to make our call more useful:

1. Roughly how many datetime API calls per month do you expect at launch?
   And 6-12 months out?
2. What's the use case? (2-3 sentences is plenty)
3. When are you looking to go live?
4. Any specific compliance requirements? (DPA, SOC 2, data residency, etc.)

Once I have those, I'll send over a 30-min Calendly link and we can dig in.

Best,
[[Your name]]
ChronoShield API
```

### Template B — Discovery call recap (Stage 2)

```
Subject: Recap: ChronoShield + [[Company]] next steps

Hi [[Name]],

Thanks for the time today. Quick recap of what we discussed and the
next steps:

Your situation:
- [[1-sentence summary of their use case]]
- Target volume: [[X]]M requests/month at launch, [[Y]]M by EoY
- Timeline: [[specific date or range]]
- Compliance: [[DPA required / not required / TBD]]

Next steps:
1. I'll send a written quote by [[day]]
2. You'll loop in [[legal / procurement / security]] for review
3. Target signature: [[date]]
4. Target go-live: [[date]]

Anything I'm missing or got wrong above, let me know.

Best,
[[Your name]]
```

### Template C — Quote delivery (Stage 3)

```
Subject: ChronoShield Enterprise quote for [[Company]]

Hi [[Name]],

Attached is the quote we discussed. Key terms:

  Plan:     ChronoShield Enterprise
  Volume:   [[X]]M requests/month
  SLA:      99.9% monthly uptime
  Term:     12 months, auto-renews
  Price:    $[[M]]/month OR $[[A]]/year (paid upfront, ~15% discount)
  Payment:  ACH / wire / card, NET 30

Quote is valid through [[date +14 days]].

Once you're ready to move forward, I'll send the Order Form, MSA, and
DPA as an e-signature bundle. DPA review typically takes your legal team
1-3 weeks — worth starting in parallel if timing matters.

Happy to jump on another call if anything needs adjusting.

Best,
[[Your name]]
```

### Template D — Welcome / onboarding (Stage 7)

```
Subject: Welcome to ChronoShield Enterprise — [[Company]] is live

Hi [[Name]],

Your Enterprise tier is active. Details:

  Monthly limit:   [[X]] requests
  Billing cycle:   [[monthly / annual]]
  Next renewal:    [[date]]
  Your API key:    use your existing key (tier and limits updated; no new key needed)

Resources:
- API docs:              https://chronoshieldapi.com/docs
- Interactive playground: https://chronoshieldapi.com/docs/playground
- Status page:           https://chronoshieldapi.com/status
- Changelog:             https://github.com/Mike-Mait/ChronoShield-API/blob/master/CHANGELOG.md

Support:
- Email me directly at [[your email]] — 1 business day response SLA.
- For critical incidents during business hours, response within 4 hours.

Want to jump on a 30-min integration call this week? I'll answer any
questions and walk through anything useful. Reply with a time that works.

Thanks for choosing ChronoShield.

[[Your name]]
```

### Template E — Usage approaching limit (Stage 8)

```
Subject: Heads up — [[Company]] is at [[X]]% of monthly quota

Hi [[Name]],

Quick heads up: [[Company]] has used [[X]]% of the monthly ChronoShield
Enterprise quota as of today ([[usage]] of [[limit]] requests).

At current pace, you're on track to [[hit the cap around DATE / stay
comfortably under]]. If you're expecting to cross the cap, I can raise
the limit now and we'll prorate the difference at renewal — no
interruption to service.

Let me know what you'd prefer. If you'd rather ride it out this month
and discuss at renewal, that's fine too — requests over the cap will
return HTTP 429 until the monthly reset.

Best,
[[Your name]]
```

### Template F — 90-day renewal ping (Stage 9)

```
Subject: [[Company]] renewal — 90 days out

Hi [[Name]],

Your ChronoShield Enterprise term ends on [[date]]. I wanted to flag it
early so there's plenty of time.

Your current plan:
- Volume: [[X]] req/month
- Price: $[[Y]]/[[mo|yr]]
- Actual usage YTD: [[Z]]% of limit

A few ways this can go:

1. **Renew at current terms** — I send a new Order Form, you sign,
   invoice fires on [[renewal date]]. Fastest path if nothing's changed.

2. **Renew with adjusted volume** — if your usage has grown/shrunk,
   we move to a tier that fits. Let me know and I'll draft options.

3. **Not renewing** — just let me know by [[renewal date - 30 days]]
   per the MSA non-renewal notice. No hard feelings; happy to help
   with offboarding.

What makes sense?

Best,
[[Your name]]
```

### Template G — Data deletion confirmation (Stage 10, Path A)

```
Subject: Data deletion confirmation — [[Company]]

Hi [[Name]],

Per your request dated [[date]] and our obligations under §5.7 of the
DPA, I'm confirming that all Personal Data associated with [[Company]]'s
ChronoShield account has been deleted from our production systems.

Details:
- Account email: [[email]]
- Deletion completed: [[date, UTC]]
- Records deleted: API key records, request logs, billing metadata

Personal Data contained in routine backups will be overwritten through
standard backup rotation within the 90-day window specified in the DPA.
No further action on your part is required.

If you need a signed copy of this confirmation on letterhead for your
records, let me know.

Best,
[[Your name]]
```

### Template H — Past-due reminder (Stage 10, Path B)

```
Subject: Invoice #[[N]] — past due reminder

Hi [[Name]],

Invoice #[[N]] (dated [[date]], amount $[[X]]) is now [[Y]] days past
due. The payment link is still live: [[Stripe invoice URL]]

If payment is already in flight, no action needed — just reply with the
confirmation/trace number so I can match it up on my end. If there's an
issue on your side, let me know what's going on and we'll figure it out.

Per the MSA, continued non-payment past [[date]] will lead to service
suspension. I'd rather not go there, so let's get ahead of it.

Thanks,
[[Your name]]
```

---

## 7. Stripe Invoicing cheat sheet

**Where**: Stripe Dashboard → Invoices → "+ Create invoice"

### One-time invoice (annual prepay)

1. **Customer**: select existing or "+ New customer" (use the billing contact email, not the technical contact)
2. **Currency**: USD (unless customer negotiated otherwise)
3. **Line items**:
   - Description: "ChronoShield Enterprise — [[X]]M requests/month — 12-month term starting [[date]]"
   - Quantity: 1
   - Unit price: the full annual amount
4. **Payment methods**: enable ACH + card; consider wire (Stripe supports US wires)
5. **Payment terms**: NET 30 (or what's in the Order Form)
6. **Custom fields** (optional): "PO Number" if customer requires one
7. **Memo**: "Per signed Order Form dated [[date]]"
8. **Finalize** → Stripe generates hosted invoice URL + PDF and emails customer
9. Save the invoice URL in your tracker

### Recurring invoice (monthly)

Use Stripe **Subscriptions** instead of Invoices for monthly recurring:

1. Dashboard → Subscriptions → Create subscription
2. Customer: existing or new
3. Product: create a one-off "Enterprise — [[Company]]" product with the negotiated monthly price
4. Billing cycle: monthly
5. Payment method: ACH preferred (lower fees)
6. Add a note: "Per signed Order Form dated [[date]]"

### Gotchas

- **Don't use Stripe Subscriptions for annual** — use one-time invoices with a calendar reminder for renewal. Subscriptions auto-renew which conflicts with the MSA non-renewal notice process.
- **Always send the invoice from Stripe, not a PDF** — gives the customer a proper hosted payment page and auto-reconciliation.
- **For wire-only customers**: create a "one-time invoice" in Stripe with "Bank transfer" as the only payment method. Stripe will give the customer bank details on the hosted page. Alternative: send a PDF invoice from your own template with Mercury/Wise account details — cheaper but manual reconciliation.

---

## 8. Document explainer — MSA vs Order Form vs DPA

Prospects will ask. Here's the one-sentence version of each:

- **MSA (Master Services Agreement)**: "The long-form boilerplate that governs our entire business relationship — liability, IP, confidentiality, warranties. Signed once, lasts for years."
- **Order Form**: "A one-page addendum that says what you specifically bought — volume, price, term. Every renewal or upgrade gets a new Order Form; the MSA stays the same."
- **DPA (Data Processing Agreement)**: "A data-protection-specific addendum required by GDPR and similar laws. Describes what personal data we process, how we protect it, and your rights as the data controller."

**Signing order**: MSA + DPA + Order Form all in the same bundle, signed together. In renewal cycles, only the new Order Form needs signing (MSA and DPA persist).

---

## 9. Edge-case decision tree

| Scenario | Decision / action |
|---|---|
| **Customer wants to pay in a foreign currency** | USD only until you have 5+ enterprise deals. Currency conversion is their problem, not yours. |
| **Customer wants NET 60 instead of NET 30** | OK for deals >$25K/yr; not for smaller. Non-negotiable for first invoice (must be paid before provisioning). |
| **Customer wants a PO number on the invoice** | Yes — add as a custom field in Stripe. Harmless. |
| **Customer wants invoices sent to a specific email (not the signer)** | Yes — update the Stripe customer's billing email. |
| **Customer wants to split payment across two departments** | OK but annoying — issue two separate invoices to two different Stripe customers, each for their portion. |
| **Customer asks for a refund mid-term** | Default: no (per MSA). Exception: SLA breach that you can document. Case-by-case, involve attorney if >$5K. |
| **Customer wants to assign the contract to an acquirer** | Per MSA assignment clause (attorney drafted). Usually fine for same-industry acquirer; check with attorney for others. |
| **Customer's key is compromised** | Use `/api/admin/keys/rotate` endpoint. Notify customer within 24 hours per DPA §5.6 (even if it was their fault, the notification obligation still applies). |
| **Customer wants custom SLA (99.99% instead of 99.9%)** | Hard no for single-region Railway. Revisit when/if you're multi-region. |
| **Customer wants HIPAA BAA** | Not today — would require infrastructure changes and a separate compliance track. Send them Pro tier with a caveat that HIPAA isn't supported, or refuse the deal. |
| **Customer wants to pentest your API** | Yes with written scope, 30-day notice, and NDA. Standard practice. |
| **Customer wants a custom feature that's 1 week of work** | Only if annual contract is ≥$15K AND the feature is likely useful for other customers. Otherwise say "roadmap." |
| **Customer wants IP allowlisting** | Add an `allowed_ips` TEXT[] column and filter in the auth middleware. ~2 hours of work. Do it if asked. |
| **Customer asks for source code access** | No. Alternative: source code escrow via a third-party service (e.g., EscrowTech). Budget $1–3K/yr. |
| **Customer asks for uptime credits** | Align with MSA SLA language (typically: 10% credit for <99.9%, 25% for <99%). Cap at one month's fees. Attorney-drafted. |

---

## 10. Escalation & incident response

### Severity tiers

- **Sev 1** — full service outage, data breach, billing error affecting >1 customer. Response: immediate; acknowledge within 30 min; public status page update.
- **Sev 2** — partial outage, elevated error rate, single-customer billing dispute. Response: within 4 business hours.
- **Sev 3** — single-customer bug, minor degradation, feature request. Response: within 1 business day.

### Data breach process (also see DPA §5.6)

1. **Detection** — Sentry alert, customer report, or ops discovery
2. **Triage** (within 1 hour) — scope: what data, which customers, root cause
3. **Contain** (within 4 hours) — rotate compromised keys, revoke access, patch vulnerability
4. **Notify customers** (within 72 hours) — per DPA template, Template [[to draft]]
5. **Post-mortem** (within 14 days) — public write-up, remediation plan
6. **Regulatory notification** (if required) — consult attorney within 48 hours of detection

---

## 11. Deal tracker (Google Sheet / Notion DB schema)

Until you have ~15 enterprise customers, a Google Sheet is fine. Columns:

| Column | Notes |
|---|---|
| Company | |
| Primary contact name | |
| Primary contact email | |
| Billing contact email | Often different |
| Stage (1–10) | Match the lifecycle |
| Inquiry source | Landing / referral / cold outbound / etc. |
| Monthly volume negotiated | |
| Monthly price | |
| Annual contract value | |
| Billing cadence | Monthly / annual |
| Term start | |
| Term end | |
| Renewal reminder dates | 90/60/30 days before term end |
| MSA signed? | Y/N + date |
| DPA signed? | Y/N + date |
| Order Form signed? | Y/N + date |
| Stripe customer ID | |
| Notes | Free-text: quirks, preferences, anything useful |

When you get past ~15 customers, migrate to Notion, Airtable, or a simple CRM (HubSpot free tier). Don't build your own — waste of time.

---

## 12. Lessons learned log

*Add bullets after every deal — win or lose. This is where future-you thanks past-you.*

### 2026-MM-DD — [[Deal name]] — [[Won / Lost / Pending]]
- What went well:
- What went wrong:
- What I'd do differently:
- Pricing anchor observed: $[[X]] for [[volume]]

*(new entries at the top)*

---

## 13. Ship-as-MVP vs. build-later decision matrix

Resist the temptation to build tooling before you've felt the pain. Here's what's worth building when:

### Ship with first enterprise deal (already done or trivial)

- [x] Contact form → sales email (already in place)
- [x] Stripe Invoicing account (just exists in Stripe, free)
- [x] DPA template + MSA template (one-time attorney cost)
- [x] `tier = 'enterprise'` supported in code (works today, no migration)
- [x] Google Sheet tracker

### Build after 3–5 enterprise deals

- [ ] `enterprise_contracts` DB table (id, api_key_id, company_name, msa_signed_at, renewal_at, monthly_price_usd, annual_commit, notes)
- [ ] Admin endpoint `POST /api/admin/keys/set-tier` (takes email + tier + limit, does the UPDATE)
- [ ] Monthly usage report email automation
- [ ] Renewal reminder email automation (90/60/30 day)

### Build after 10+ enterprise deals

- [ ] Dedicated enterprise admin UI
- [ ] Per-customer usage dashboard (shared with customer)
- [ ] Custom feature flag system (per-customer `feature_flags` JSONB)
- [ ] IP allowlisting
- [ ] SLA reporting dashboard

### Build after 25+ or when customers demand it

- [ ] SOC 2 Type I → II (use Vanta or Drata, ~$15–25K/yr)
- [ ] SSO for customer admin panel
- [ ] Multi-region deployment
- [ ] Custom SLA tiers
- [ ] Source code escrow service

---

*End of playbook.*
