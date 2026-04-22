# Data Processing Agreement (DPA) — Template

> **⚠️ LEGAL DISCLAIMER — READ FIRST**
>
> This document is a **starting-point template**, not a completed legal agreement. It has **not** been reviewed by an attorney. Before using this template with any customer, you **must**:
>
> 1. Have a qualified attorney (ideally one with GDPR / data-privacy experience) review and adapt this template to your specific circumstances, jurisdiction, and customer base.
> 2. Verify the sub-processor list in **Annex 3** is current at the time of signing.
> 3. Confirm the security measures described in **Annex 2** accurately reflect your production controls — **do not promise measures you do not actually implement**.
> 4. Confirm compliance with any specific regulations that apply to the customer's industry (HIPAA, PCI-DSS, FERPA, etc.) — those may require additions beyond this template.
> 5. Re-version this document when any sub-processor, security control, or legal framework materially changes.
>
> Placeholders in the form `[[PLACEHOLDER]]` must be replaced per deal. Sections marked *"Attorney to confirm"* need explicit legal sign-off before use.

---

## Version history

| Version | Date | Changes |
|---|---|---|
| 0.1 (draft) | [[YYYY-MM-DD]] | Initial template — awaiting attorney review |

---

## Parties

This Data Processing Agreement ("**DPA**") forms part of the Master Services Agreement or equivalent service contract (the "**Agreement**") between:

- **[[CUSTOMER LEGAL NAME]]**, a [[JURISDICTION / ENTITY TYPE]] with its principal place of business at [[CUSTOMER ADDRESS]] (the "**Controller**"), and
- **[[YOUR LEGAL ENTITY NAME]]**, d/b/a ChronoShield API, with its principal place of business at [[YOUR ADDRESS]] (the "**Processor**"),

each a "**Party**" and together the "**Parties**."

This DPA takes effect on the later of: (a) the effective date of the Agreement, or (b) the date it is executed by both Parties (the "**DPA Effective Date**").

---

## 1. Definitions

Terms not defined in this DPA have the meaning given in the Agreement. The following definitions apply:

- **"Applicable Data Protection Laws"** means all data protection and privacy laws applicable to the processing of Personal Data under the Agreement, including (as applicable): the EU General Data Protection Regulation 2016/679 ("**GDPR**"); the UK GDPR and UK Data Protection Act 2018; the California Consumer Privacy Act, as amended by the California Privacy Rights Act ("**CCPA/CPRA**"); and any successor or equivalent legislation.
- **"Controller"**, **"Processor"**, **"Personal Data"**, **"Processing"**, **"Data Subject"**, **"Supervisory Authority"**, and **"Personal Data Breach"** have the meanings given in the GDPR.
- **"Services"** means the ChronoShield API services provided by the Processor under the Agreement.
- **"Sub-processor"** means any third party engaged by the Processor to process Personal Data on behalf of the Controller in the performance of the Services.
- **"Standard Contractual Clauses"** or **"SCCs"** means the standard contractual clauses approved by the European Commission Implementing Decision (EU) 2021/914 of 4 June 2021 for the transfer of personal data to third countries.

---

## 2. Subject matter, duration, and scope

### 2.1 Subject matter
The Processor processes Personal Data on behalf of the Controller solely to provide the Services, as described in **Annex 1**.

### 2.2 Duration
This DPA applies for the duration of the Agreement and remains in force for as long as the Processor processes any Personal Data on behalf of the Controller.

### 2.3 Role of the Parties
The Parties acknowledge that, in respect of the Personal Data processed under this DPA, the Controller acts as the data controller (or processor for its own customers, in which case the Processor acts as a sub-processor) and the Processor acts as the data processor.

### 2.4 Compliance with law
Each Party shall comply with its respective obligations under Applicable Data Protection Laws.

---

## 3. Details of processing

The subject matter, nature, purpose, categories of data, and categories of Data Subjects are set out in **Annex 1** and form an integral part of this DPA.

---

## 4. Controller's obligations

### 4.1 Lawful basis
The Controller represents and warrants that it has established a valid legal basis under Applicable Data Protection Laws for the processing of Personal Data by the Processor under the Agreement, including for any Personal Data that the Controller transmits to the Services.

### 4.2 Controller's instructions
The Controller is solely responsible for the accuracy, quality, and legality of the Personal Data submitted to the Services, the means by which the Controller acquired the Personal Data, and the Controller's instructions to the Processor regarding the processing of that Personal Data.

### 4.3 Data minimization
The Controller shall not submit to the Services any Personal Data that is not required for the Services to be performed. In particular, the Controller acknowledges that the Services are designed to process datetime values, timezone identifiers, and related metadata, and **shall not** submit any special categories of Personal Data (e.g. data concerning health, biometric data, data revealing racial or ethnic origin) unless a separate written addendum is agreed between the Parties.

---

## 5. Processor's obligations

### 5.1 Documented instructions
The Processor shall process Personal Data only on documented instructions from the Controller, including as set out in the Agreement and this DPA. If the Processor is required by Applicable Data Protection Laws to process Personal Data other than on the Controller's instructions, the Processor shall inform the Controller of that legal requirement before processing, unless prohibited by law.

### 5.2 Confidentiality
The Processor shall ensure that all personnel authorized to process Personal Data are subject to an obligation of confidentiality (whether contractual or statutory) of no less than reasonable duration.

### 5.3 Technical and organizational measures
The Processor shall implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, as described in **Annex 2**. The Processor may update these measures from time to time, provided that any update does not materially reduce the overall level of security.

### 5.4 Sub-processors
- **Authorization.** The Controller grants the Processor general authorization to engage the Sub-processors listed in **Annex 3** for the processing of Personal Data.
- **New Sub-processors.** Before engaging any new Sub-processor, the Processor shall notify the Controller in writing (including by email to the contact on file) at least **thirty (30) days** in advance, identifying the Sub-processor and the processing activity.
- **Objection.** The Controller may reasonably object to a new Sub-processor on data-protection grounds within fifteen (15) days of notification. The Parties shall discuss in good faith. If no resolution is reached, the Controller may terminate the affected portion of the Services with a pro-rata refund of any prepaid fees.
- **Flow-down.** The Processor shall impose on each Sub-processor, by written contract, data-protection obligations no less protective than those in this DPA.
- **Liability.** The Processor remains liable to the Controller for the performance of each Sub-processor's obligations.

### 5.5 Assistance to the Controller
Taking into account the nature of the processing, the Processor shall assist the Controller by appropriate technical and organizational measures, insofar as possible, with:

- (a) the fulfillment of the Controller's obligation to respond to requests from Data Subjects exercising their rights under Applicable Data Protection Laws (right of access, rectification, erasure, restriction, portability, and objection);
- (b) the Controller's obligations under Articles 32 to 36 of the GDPR (security, breach notification, data protection impact assessments, and prior consultation), taking into account the nature of processing and the information available to the Processor.

If the Processor receives a request directly from a Data Subject that relates to Personal Data processed on behalf of the Controller, the Processor shall promptly forward the request to the Controller and shall not respond to the Data Subject directly, except as instructed by the Controller or required by law.

### 5.6 Personal Data Breach notification
The Processor shall notify the Controller without undue delay, and in any event within **seventy-two (72) hours**, after becoming aware of a Personal Data Breach affecting Personal Data processed on behalf of the Controller. The notification shall include, to the extent known:

- (a) the nature of the Breach, including the categories and approximate number of Data Subjects and records concerned;
- (b) the likely consequences of the Breach;
- (c) the measures taken or proposed to address the Breach, including measures to mitigate possible adverse effects;
- (d) the contact details of a point of contact at the Processor.

The Processor shall cooperate with the Controller in the investigation, remediation, and notification of the Breach.

### 5.7 Return or deletion of Personal Data
On termination or expiry of the Agreement, or on the Controller's written request at any earlier time, the Processor shall, at the Controller's choice:

- (a) delete all Personal Data processed on behalf of the Controller, including copies in backup media (subject to the retention window described below); or
- (b) return all Personal Data to the Controller in a commonly used, machine-readable format.

Unless Applicable Data Protection Laws require longer retention, the Processor shall complete the chosen action within **thirty (30) days** of the request or termination. Personal Data contained in routine backups will be overwritten through standard backup rotation within **ninety (90) days**, after which no copy remains. On completion, the Processor shall provide written confirmation.

### 5.8 Audits and inspections
- **Information requests.** The Processor shall make available to the Controller, on reasonable request, all information necessary to demonstrate compliance with this DPA and Applicable Data Protection Laws.
- **Audits.** The Controller (or a mutually agreed independent third-party auditor bound by confidentiality) may, at the Controller's cost and no more than once per twelve (12) month period, conduct an audit of the Processor's compliance with this DPA. Audits shall be scheduled at least thirty (30) days in advance and conducted during normal business hours in a manner that does not unreasonably interfere with the Processor's operations.
- **Substitution by third-party reports.** The Parties agree that where the Processor has obtained an independent third-party audit report (e.g. SOC 2, ISO 27001), the Processor may satisfy this obligation by providing a copy of the most recent such report under confidentiality. [*Attorney to confirm acceptability per jurisdiction.*]

---

## 6. International data transfers

### 6.1 Transfer mechanism
Where the Processor transfers Personal Data originating in the European Economic Area ("**EEA**"), the United Kingdom, or Switzerland to a country not recognized by the European Commission (or equivalent authority) as providing an adequate level of protection, such transfer shall be subject to:

- (a) the **Standard Contractual Clauses** (Module 2: Controller to Processor; or Module 3: Processor to Sub-processor, as applicable), which are incorporated into this DPA by reference and deemed executed by the Parties on the DPA Effective Date; and
- (b) for UK transfers, the UK International Data Transfer Addendum to the SCCs, Version B1.0, as issued by the Information Commissioner's Office.

### 6.2 Supplementary measures
The Processor shall implement reasonable supplementary technical and organizational measures to ensure a level of protection essentially equivalent to that guaranteed within the EEA, as described in **Annex 2**.

### 6.3 Conflict
In the event of a conflict between this DPA and the SCCs, the SCCs shall prevail with respect to transfers of Personal Data from the EEA, UK, or Switzerland.

---

## 7. Liability

The liability of each Party under this DPA is subject to the limitations and exclusions of liability set out in the Agreement. **Nothing in this DPA limits any liability that cannot be limited under Applicable Data Protection Laws.** [*Attorney to review the liability-cap language to ensure alignment with your MSA and jurisdiction.*]

---

## 8. Term and termination

### 8.1 Term
This DPA takes effect on the DPA Effective Date and continues in force for the duration of the Agreement.

### 8.2 Survival
Sections 5.7 (Return or deletion), 5.8 (Audits) for twelve (12) months following termination, 7 (Liability), and this Section 8.2 survive termination of this DPA or the Agreement.

### 8.3 Conflict with the Agreement
In the event of a conflict between this DPA and the Agreement with respect to the processing of Personal Data, this DPA shall prevail.

---

## 9. Governing law and jurisdiction

This DPA shall be governed by the laws specified in the Agreement, except that any claim concerning the processing of Personal Data subject to the GDPR shall be governed by the laws of [[JURISDICTION]] to the extent required by applicable law. [*Attorney to confirm — this is one of the most jurisdiction-sensitive clauses in the DPA.*]

---

## 10. Miscellaneous

### 10.1 Entire agreement
This DPA and the Agreement constitute the entire agreement between the Parties concerning the processing of Personal Data and supersede any prior or contemporaneous understandings.

### 10.2 Amendments
Any amendment to this DPA must be in writing and signed by authorized representatives of both Parties.

### 10.3 Severability
If any provision of this DPA is held invalid or unenforceable, the remaining provisions shall continue in effect.

---

## Signatures

| For the Controller | For the Processor |
|---|---|
| Name: [[NAME]] | Name: [[NAME]] |
| Title: [[TITLE]] | Title: [[TITLE]] |
| Date: [[DATE]] | Date: [[DATE]] |
| Signature: ___________________ | Signature: ___________________ |

---

---

# ANNEX 1 — Details of Processing

## A. Subject matter and duration
The subject matter of the processing is the provision of the Services described in the Agreement. The duration of the processing is equal to the duration of the Agreement plus any post-termination retention period set out in **§5.7** of the DPA.

## B. Nature and purpose of the processing
The Processor processes Personal Data for the sole purpose of providing the Services to the Controller, including:

- Authenticating API requests via API key lookup
- Enforcing usage quotas and rate limits
- Logging request metadata for operational, security, and billing purposes
- Sending operational emails (welcome, password/key reset, billing, cancellation notifications)
- Responding to customer support requests

The Processor does **not** use Personal Data for any other purpose, including profiling, advertising, or onward sale.

## C. Categories of Personal Data processed

| Category | Source | Retention |
|---|---|---|
| Contact email address of the API key owner | Provided by the Controller at account creation | Duration of account + 30 days |
| Hashed API key | Generated by the Processor | Duration of account + 30 days |
| Request metadata: endpoint path, HTTP method, response status code, latency, timestamp, API key ID | Generated during Service use | **[[90 / 180 / 365]] days** *(attorney / customer to agree per contract)* |
| Caller IP address (where logged) | HTTP request metadata | **[[30 / 90]] days** *(per contract)* |
| Billing contact email, billing address, Stripe customer ID (Stripe-hosted, reference only) | Provided during paid-tier purchase | Duration of account + 7 years for tax/accounting records |

**Not processed**: passwords (none used), payment card numbers (handled exclusively by Stripe — the Processor never sees raw card data), biometric data, health data, government IDs, location data beyond IP-derived approximate region.

## D. Categories of Data Subjects
The Personal Data concerns the following categories of Data Subjects:

- Employees, contractors, and authorized representatives of the Controller who hold or use API keys
- End users of the Controller's applications, **only to the extent** the Controller voluntarily includes such Data Subjects' identifiers in the datetime or metadata fields sent to the API. The Controller is responsible for minimizing such inclusion.

## E. Special categories of Personal Data
**None processed.** Per DPA §4.3, the Controller shall not submit special categories of Personal Data to the Services.

---

# ANNEX 2 — Technical and Organizational Measures (TOMs)

> **⚠️ Attorney/founder must verify every item in this annex reflects current production controls. Do not promise measures you do not actually implement. Misrepresentation here can void liability caps.**

The Processor implements the following technical and organizational measures, as updated from time to time:

### A. Encryption

- **In transit.** All API traffic is served exclusively over HTTPS using TLS 1.2 or later. HTTP requests are redirected to HTTPS. HSTS is enforced with a one-year max-age.
- **At rest.** Application database (PostgreSQL) is hosted on [[Railway / other]] with disk-level encryption at rest provided by the infrastructure provider. Secrets (API keys for third-party services, reset-token signing keys) are stored as environment variables, never committed to source control.
- **API keys.** Customer-facing API keys are stored in the database as one-way cryptographic hashes; plaintext keys are shown to the user only at the moment of creation and are never recoverable from the database.

### B. Access control

- Administrative access to production infrastructure is limited to the founder and any explicitly authorized personnel, authenticated via the hosting provider's (Railway's) account system with multi-factor authentication enabled.
- Administrative API endpoints require a separate master API key distinct from any customer key; the master key is stored as an environment secret and never shared.
- Customer API key rotation is available on demand via the reset flow.

### C. Pseudonymization and data minimization

- Request logs store an `api_key_id` (an internal reference) rather than the plaintext key.
- IP addresses are stored only where operationally necessary (rate limiting, security) and may be truncated or deleted after the retention period in Annex 1.

### D. Integrity and availability

- Application runs on a redundant container orchestration platform ([[Railway]]) with automatic restarts on failure.
- Database is backed up automatically by the infrastructure provider on a daily cadence; point-in-time recovery is available within the provider's retention window.
- Health check endpoint is monitored externally at least every five minutes.

### E. Testing, evaluation, and validation

- Automated tests (unit and integration) run on every code change before deployment.
- Error monitoring is provided by Sentry; production errors are reviewed and triaged promptly.
- Third-party security testing (e.g. penetration testing) will be undertaken at least annually once the Processor has the resources to do so. *[Attorney/founder: remove this bullet if not yet true.]*

### F. Logging and audit

- Application request logs capture endpoint, method, status code, latency, API key identifier, and request ID. Logs are retained per Annex 1, §C.
- Administrative actions (key creation, revocation, rotation, tier change) are recorded.

### G. Incident response

- The Processor maintains an incident response process with a documented 72-hour customer notification window for Personal Data Breaches (see DPA §5.6).
- A security contact is publicly listed at `/.well-known/security.txt`.

### H. Supplier management

- Each sub-processor listed in Annex 3 is contractually bound (via its standard terms or a separate DPA) to data-protection obligations no less protective than those in this DPA.

### I. Business continuity

- Source code is mirrored in a version control system (GitHub) with access controls.
- Infrastructure can be redeployed from source code and database backups in the event of provider failure.

### J. Staff training

- Personnel with access to Personal Data are informed of their confidentiality obligations and of this DPA's requirements.

---

# ANNEX 3 — Authorized Sub-processors

> **Keep this list current. Notify customers ≥30 days before adding a new sub-processor per DPA §5.4.**

| Sub-processor | Purpose | Location of processing | Transfer mechanism |
|---|---|---|---|
| **Railway Corp.** | Application hosting, managed PostgreSQL database | United States | SCCs (for EEA/UK Personal Data) |
| **Stripe, Inc.** | Payment processing, subscription billing, invoicing | United States (+ local presences) | SCCs; Stripe's own DPA |
| **Resend, Inc.** | Transactional email delivery (welcome, reset, billing emails) | United States | SCCs |
| **Functional Software, Inc. (d/b/a Sentry)** | Application error and performance monitoring | United States | SCCs |
| **GitHub, Inc. (subsidiary of Microsoft Corp.)** | Source code hosting; issues; CI/CD metadata | United States | SCCs |
| [[Add Cloudflare, uptime monitor, etc. as applicable]] | | | |

**Last updated:** [[YYYY-MM-DD]]

---

*End of DPA template.*
