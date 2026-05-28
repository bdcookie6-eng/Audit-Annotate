# Audit-Annotate: Project Roadmap

**An AI-Powered Audit Intelligence Tool for CPA Firms**
Built with React + TypeScript, Python + FastAPI, and the Claude API

---

## Overview

Audit-Annotate is an internal tool designed for CPA audit teams. It accepts uploaded financial documents (balance sheets, income statements, cash flow statements) in PDF and Excel formats, runs them through Claude AI for analysis, and presents findings in a split-screen interface: an AI copilot chat on the left explaining every flag and answering questions, and the document on the right with color-coded inline annotations.

The tool is deployed to Render and connects to an existing company website via REST API.

---

## Competitive Landscape Summary

Research into seven leading audit technology platforms — DataSnipper, Suralink, AuditBoard, CaseWare, Workiva, Fieldguide, and TeamMate+ — revealed the following:

| Platform | Core Strength | Price Signal | Key Gap |
|---|---|---|---|
| DataSnipper | AI document extraction, DocuMine Q&A | ~$175/user/month | Excel-only, no cross-statement logic |
| Suralink | PBC request portal, client collaboration | Per-firm pricing | No AI analysis layer |
| AuditBoard | Risk management, SOX compliance workflows | Enterprise | Heavy implementation, not CPA-first |
| CaseWare | Workpaper management, XBRL tagging | Per-user | Legacy UX, complex onboarding |
| Workiva | SEC reporting, multi-source data linking | Enterprise | Not built for small/mid CPA firms |
| Fieldguide | Audit program management, AI drafting | $50–100/user/month | No document annotation |
| TeamMate+ | TeamMate analytics, risk-based auditing | Enterprise | No AI copilot |

**Key findings from research:**

1. The most painful daily problem for auditors is the "tick and tie" — verifying mathematical accuracy, confirming numbers are consistent across statements, comparing to prior year, and reconciling multiple document versions. No tool does this automatically with AI.
2. AI Document Q&A (like DataSnipper's DocuMine) is high-value and increasingly expected. Auditors want to ask plain-English questions about documents and get cited answers.
3. Annotation and evidence linking are core to every serious audit tool. Color-coded flags with a clear approve/dismiss/note workflow are the baseline expectation.
4. Anomaly detection (Benford's law analysis, duplicate invoices, round-number transactions) is the clearest competitive differentiator — most platforms promise it but few deliver it simply.
5. The tools auditors hate most are the ones that require heavy setup, complex onboarding, or force them into a new workflow. The winning tools fit inside the auditor's existing process.

---

## What We Are NOT Building (And Why)

Staying focused is as important as knowing what to build. The following features are explicitly out of scope for this tool:

| Feature | Why We're Skipping It |
|---|---|
| **Trial Balance Engine** | Trial balance management (importing GL data, adjusting journal entries, mapping to financial statements) is a deeply specialized product requiring years to build reliably. CaseWare and CCH Engagement own this space. Building a weak version would undermine trust. |
| **XBRL Tagging** | XBRL (the SEC-mandated data format for public company filings) requires a taxonomy database, mapping engine, and regulatory expertise. It is irrelevant for private company CPA audits, which is our target market. |
| **Excel Add-In** | Excel add-ins require separate distribution, Microsoft certification, update management, and version fragility. DataSnipper has already invested years in this. Our browser-based approach is easier to maintain and deploys instantly. |
| **Statistical Sampling Engine** | Statistical sampling (determining sample sizes, projecting errors to populations) requires actuarial-grade calculations and audit-standard compliance. This is a standalone product, not a feature. Tools like Caseware IDEA focus exclusively on this. |

Staying out of these areas allows the team to build the AI copilot, annotation layer, and tick-and-tie engine to a high quality standard instead of spreading effort across a much larger surface area.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | Fast build times, strong typing, industry-standard for modern web apps |
| **UI Components** | Tailwind CSS + shadcn/ui | Consistent design system, no heavy CSS framework overhead |
| **PDF Rendering** | react-pdf (PDF.js) | Renders PDFs natively in the browser without server round-trips |
| **Annotation Layer** | Custom canvas overlay on PDF.js | Full control over color-coded highlights, icons, and tooltip behavior |
| **Backend** | Python + FastAPI | Python is the standard for AI/ML integrations; FastAPI is fast, async, and self-documenting |
| **AI Engine** | Anthropic Claude API | Best-in-class document comprehension, long-context handling, streaming support |
| **File Parsing** | PyMuPDF (PDF), openpyxl / pandas (Excel) | Reliable, well-maintained libraries for extracting structured data from financial documents |
| **Database** | PostgreSQL (via SQLAlchemy) | Relational structure suits audit data (clients, engagements, documents, findings) |
| **Authentication** | JWT tokens + role-based access | Stateless, compatible with existing website integration |
| **Deployment** | Render (render.yaml config) | Simple deployment for both web service and database; no DevOps team required |
| **API Integration** | CORS-enabled REST API | Allows the existing company website to call Audit-Annotate endpoints directly |

---

## Roadmap

The project is organized into four phases totaling 14 weeks. Each phase produces a working, testable piece of the product — nothing is "in progress" at the end of a phase.

---

## Phase 1 — Foundation & Core Engine

**Weeks 1–3 | Goal: A working document intake and analysis system**

This phase builds the non-negotiable infrastructure: a place to upload documents, a pipeline that extracts financial data from them, and a core engine that runs the most important check in all of auditing — the tick and tie.

### Deliverables

#### 1.1 Project Scaffolding

Set up the full development environment:

- React + Vite + TypeScript frontend with Tailwind CSS
- Python FastAPI backend with project structure, environment configuration, and local development scripts
- PostgreSQL database schema (clients, engagements, documents, findings)
- Git repository structure with separate `frontend/` and `backend/` directories
- Local `.env` configuration for API keys and database connections

**Why it matters:** A clean, well-structured codebase prevents technical debt from accumulating during the faster-moving later phases. Setting up the database schema now avoids painful migrations later.

**Success criteria:** A developer can clone the repository, run two commands (one for frontend, one for backend), and see both services running locally with a working health-check endpoint.

---

#### 1.2 Document Upload System

Build a document ingestion pipeline that accepts financial documents and stores them reliably:

- Drag-and-drop file upload UI accepting PDF, Excel (.xlsx, .xls), and CSV formats
- File validation (type checking, size limits, corrupt file detection)
- Secure file storage (files stored server-side, associated with an engagement record)
- Upload progress indicator and error states in the UI
- Document list view showing all uploaded files for an engagement

**Why it matters:** Every other feature in the product depends on documents being ingested reliably. A broken or unreliable upload flow kills trust immediately.

**Success criteria:** An auditor can upload a 50-page PDF audit report and a 10-sheet Excel workbook, see both in the document list, and retrieve them without data loss.

---

#### 1.3 Claude-Powered Financial Data Extraction

Use the Claude API to parse uploaded documents and extract structured financial data:

- Detect the statement type (balance sheet, income statement, cash flow statement, notes)
- Extract all line items with their labels and dollar figures
- Identify the reporting period (year-end, quarter-end) and currency
- Detect whether figures are in thousands or millions
- Store extracted data in a structured format for downstream analysis

**Why it matters:** This is the foundational AI capability. Before Claude can flag anything, it needs to understand what the document contains. Accurate extraction is the difference between a useful tool and a liability.

**Success criteria:** Given a standard balance sheet PDF, Claude correctly extracts at least 95% of line items with correct labels and figures. Statement type detection is accurate for all three primary statement types.

---

#### 1.4 Tick-and-Tie Consistency Engine

Build the automated mathematical and cross-statement verification engine — the core differentiator of this product:

- **Footing checks:** Verify that every subtotal and total correctly sums from its components (e.g., Total Current Assets = sum of all current asset line items)
- **Cross-statement matching:** Verify that figures appearing in multiple statements are consistent (e.g., Net Income on the income statement matches the figure on the cash flow statement)
- **Prior year comparison:** When two years of data are present, flag lines where the change exceeds a configurable threshold (default: 10% change, or absolute change above a materiality level)
- **Version diff:** When two versions of the same document are uploaded (e.g., a draft and a revised draft), highlight every figure that changed between versions

Each check produces a structured finding: the field that failed, the expected value, the actual value, and a severity level (error, warning, or informational).

**Why it matters:** Research identifies the tick-and-tie as the single most painful daily task for auditors. It is tedious, error-prone when done manually, and causes embarrassment when mistakes reach the partner review or client. No AI tool currently automates this comprehensively.

**Success criteria:** The engine correctly identifies footing errors in a test balance sheet containing three intentional mistakes. Cross-statement mismatch detection works across a paired income statement and cash flow statement.

---

#### 1.5 Basic Split-Screen UI Shell

Build the skeleton of the primary interface that all future features will live inside:

- Left panel: placeholder for the AI copilot chat (Phase 2)
- Right panel: document viewer rendering the uploaded PDF using react-pdf
- Panel resize handle allowing the auditor to adjust the split
- Document navigation (page forward/back, zoom in/out)
- Finding sidebar showing a list of all findings from the tick-and-tie engine (no annotations yet — just a list)

**Why it matters:** Getting the UI structure right early prevents expensive rework in Phase 2. The split-screen layout is the defining UX pattern of the product and needs to feel natural before annotations and chat are layered on top.

**Success criteria:** An auditor can upload a document and see it rendered in the right panel. The finding sidebar lists all tick-and-tie results. The split can be resized without breaking the layout.

---

### Phase 1 Dependencies

| Dependency | Notes |
|---|---|
| Anthropic Claude API key | Required for extraction and analysis |
| PostgreSQL database | Can run locally for Phase 1; moves to Render in Phase 4 |
| Sample financial documents | Need 3–5 real or realistic test documents (balance sheet, income statement, cash flow) for development and testing |

---

## Phase 2 — Annotation & AI Copilot

**Weeks 4–6 | Goal: A fully interactive review experience with AI-powered explanations**

This phase transforms the tool from a report generator into an interactive audit assistant. The auditor can see exactly where issues are on the document, ask the AI questions, and process each finding through a structured workflow.

### Deliverables

#### 2.1 Full Annotation Layer

Overlay color-coded visual annotations directly on the rendered document:

- **Green highlight:** Verified — the figure has been checked and confirmed correct
- **Yellow highlight:** Warning — the figure requires attention (e.g., unusual change from prior year, figure appears in a different context elsewhere)
- **Red highlight:** Error — a definitive problem detected (e.g., footing failure, cross-statement mismatch)
- Annotation icons (small flag or dot) that auditors can click to open a finding detail panel
- Annotations are pinned to specific locations on the document (page number + coordinates), so they survive page scrolls and zoom changes

**Why it matters:** Every serious audit tool — DataSnipper, AuditBoard, CaseWare — uses color-coded annotation as the primary interface for communicating findings. Auditors are trained to read green/yellow/red. Skipping this would make the tool feel like a plain report rather than a working audit environment.

**Success criteria:** All findings from the tick-and-tie engine appear as correctly-placed, color-coded highlights on the document. Clicking a highlight opens a panel showing the finding detail.

---

#### 2.2 AI Copilot Panel with Streaming Chat

Build the left-panel AI copilot — the tool's most distinctive feature:

- When the auditor opens a document, the copilot automatically introduces the document and summarizes the top findings in plain language
- When the auditor clicks an annotation on the document, the copilot explains that specific finding — what the error is, why it matters, and what the auditor should do next
- The copilot uses Claude's streaming API so responses appear word-by-word (no waiting for the full response before text appears)
- The chat is threaded: each finding has its own conversation thread, and the auditor can also open a general chat about the full document
- The copilot cites specific line items and figures when explaining issues ("The Total Current Assets figure on line 14 sums to $4,821,000, but the individual components sum to $4,718,000 — a discrepancy of $103,000")

**Why it matters:** This is the feature that justifies the product's existence. DataSnipper's DocuMine charges $175/user/month specifically for AI Q&A on documents. An AI that can explain every finding in plain English — rather than just flagging it — dramatically reduces the time a junior auditor spends researching an issue and escalating to a senior.

**Success criteria:** The copilot's automatic summary correctly identifies and prioritizes the top 3 issues in a test document. When the auditor clicks a red annotation, the copilot explanation is accurate and includes the specific figures involved. Streaming works without visible loading delays.

---

#### 2.3 Document Q&A

Allow the auditor to ask any question about the document in plain English and receive a cited answer:

- Free-text input field in the copilot panel with a "Ask about this document" prompt
- Claude reads the full extracted document content and answers questions like "What was the change in accounts receivable from last year?" or "Does the cash balance on the balance sheet match the ending cash on the cash flow statement?"
- Answers include citations: the specific line item, figure, and page number that supports the answer
- Follow-up questions maintain context from the prior exchange (conversation memory within the session)

**Why it matters:** This is the feature auditors ask for most in demos of competitor products — the ability to interrogate a document without hunting through pages. It directly competes with DataSnipper's highest-priced feature and can be built natively with Claude's long-context capabilities.

**Success criteria:** Given a 30-page audit workpaper, the tool correctly answers 8 out of 10 test questions with accurate figures and valid citations. Follow-up questions in the same session correctly reference prior context.

---

#### 2.4 Approve / Dismiss / Note Workflow

Give auditors a structured way to process each finding:

- Every finding card has three action buttons: **Approve** (the auditor has reviewed and confirms the issue is real), **Dismiss** (the flag is a false positive or not material — requires a written reason), and **Add Note** (attach a free-text comment for the reviewer/partner)
- Finding status (open, approved, dismissed, noted) is visible on both the annotation and the finding sidebar
- Dismissed findings show the dismissal reason when hovered
- A progress indicator shows "X of Y findings reviewed" so the auditor knows when they are done
- All actions are logged with the auditor's name and timestamp

**Why it matters:** Audit is a process with sign-off requirements. A tool that flags issues but provides no structured way to document the response is incomplete. This workflow is the core of how AuditBoard and Fieldguide structure their review cycles. Without it, findings pile up with no clear resolution path.

**Success criteria:** An auditor can process all findings in a test document (approve, dismiss with reason, add note) and the status of each finding persists after page refresh. The progress indicator reflects the correct count.

---

#### 2.5 Export Annotated PDF Report

Generate a professional PDF export of the reviewed document with findings:

- Export button in the UI produces a PDF containing the original document plus an overlay of all annotations
- A findings summary page is prepended, listing all findings grouped by severity with their resolution status (approved, dismissed, noted)
- Dismissed findings are included with their dismissal reasons
- The export includes the engagement name, document name, auditor name, and export date/time in a header
- The export is formatted to look like a professional workpaper — not a raw debug output

**Why it matters:** The output of an audit engagement is paper — workpapers that document what was done and what was found. If the tool cannot produce a clean export, it cannot fit into an actual audit workflow. Every competing tool offers annotated PDF export as a core feature.

**Success criteria:** The exported PDF correctly renders all annotations in their correct positions on the original document pages. The findings summary page is accurate and legible. The export can be opened in Adobe Acrobat without formatting issues.

---

### Phase 2 Dependencies

| Dependency | Notes |
|---|---|
| Phase 1 complete | Annotation layer builds on the tick-and-tie findings and the PDF rendering shell |
| Claude API streaming | Requires `stream=True` in API calls and server-sent events (SSE) on the FastAPI backend |
| PDF export library | ReportLab or WeasyPrint for server-side PDF generation |

---

## Phase 3 — Advanced Audit Intelligence

**Weeks 7–10 | Goal: Features that go beyond what any audit tool offers today**

This phase adds the AI capabilities that turn Audit-Annotate from a good tool into a genuinely differentiated one. These features require the stable foundation from Phases 1 and 2 to function correctly.

### Deliverables

#### 3.1 Anomaly Detection Engine

Automatically scan financial data for patterns that warrant auditor attention:

- **Benford's Law analysis:** Financial figures that occur naturally follow a predictable distribution of leading digits. Significant deviations from this distribution in a set of transactions can indicate data manipulation or error. The tool runs this analysis on any set of line items provided (account balances, journal entries) and flags deviations with a visual chart.
- **Duplicate entry detection:** Flag transactions with identical amounts, dates, and vendor/account combinations that appear more than once
- **Round-number transaction flags:** Transactions with suspiciously round numbers (e.g., exactly $10,000, $50,000, $100,000) are flagged as potentially estimated rather than actual — a common indicator of management override
- **Weekend and holiday postings:** Flag journal entries posted on weekends or public holidays, which are unusual in normal business operations and sometimes indicate after-the-fact adjustments
- **End-of-period spikes:** Detect clusters of large transactions in the final days of a reporting period, which can indicate revenue manipulation or artificial deadline stuffing

Each anomaly type is configurable: the auditor can turn specific detectors on or off and adjust sensitivity thresholds.

**Why it matters:** Benford's Law and duplicate detection are well-established audit procedures. They are tedious to run manually but extremely effective at surfacing issues. TeamMate Analytics and Caseware IDEA offer these but require separate, expensive licenses and significant setup. Embedding them directly in the document review workflow is a meaningful differentiator.

**Success criteria:** Benford's Law analysis correctly flags a test dataset with intentionally skewed leading digits. Duplicate detection identifies all exact duplicates in a test transaction list. Weekend posting detection has zero false negatives on a test journal entry set.

---

#### 3.2 Workpaper Quality Checker

Automatically review a workpaper document for completeness and compliance with firm standards:

- Detects whether a tick mark legend is present (the key that explains what each annotation symbol means)
- Checks for required sign-offs and preparer/reviewer signatures
- Flags missing cross-references (e.g., a workpaper that references "Schedule A" but no Schedule A is attached)
- Identifies incomplete sections (headers with no content below them, blank required fields)
- Checks for outdated dates (e.g., a workpaper dated the prior year in a current-year engagement)

**Why it matters:** Partner review time is the most expensive time in a CPA firm. Partners should not be spending review time catching missing tick mark legends or unsigned workpapers — that is quality control that should happen before the file reaches them. Fieldguide offers a version of this, but it is tied to their proprietary workpaper format.

**Success criteria:** The quality checker correctly identifies all completeness issues in a test workpaper containing five intentional deficiencies (missing legend, missing sign-off, missing cross-ref, blank section, wrong date).

---

#### 3.3 Audit Report Drafting

Use Claude to draft the auditor's report and management letter based on the findings from the tool:

- After an engagement's findings are reviewed and processed, the auditor can click "Draft Report"
- Claude generates a draft auditor's report in the standard format (opinion paragraph, basis for opinion, key audit matters)
- Claude generates a draft management letter summarizing the internal control weaknesses and significant findings identified during the audit
- Drafts are editable in a rich text editor before export
- The draft clearly marks every section that requires auditor review and customization (Claude does not present these as final — it flags its own placeholder language)

**Why it matters:** Writing the auditor's report and management letter from scratch is time-consuming, particularly for junior staff. Fieldguide has invested heavily in this AI drafting capability and positions it as a major selling point. A well-drafted first cut — even one that requires editing — saves 30–60 minutes per engagement and reduces errors in boilerplate language.

**Success criteria:** Given a set of ten processed findings (mix of severity levels), Claude's draft management letter correctly reflects the actual findings with no hallucinated issues. The draft uses standard audit language and is editable without formatting issues.

---

#### 3.4 Multi-Document Cross-Referencing

Allow auditors to upload multiple documents to a single engagement and link figures across them:

- An engagement can contain multiple documents (e.g., the financial statements, the supporting schedules, the trial balance extract, the prior year financials)
- The tool automatically detects when the same figure appears in multiple documents and shows cross-reference links
- The auditor can manually create cross-reference links between a figure in one document and its source in another
- Cross-references appear as visual connectors in the annotation layer (clicking a cross-ref annotation navigates to the linked figure in the other document)
- Inconsistencies between linked figures are automatically flagged as errors

**Why it matters:** Real audit engagements involve many documents, not one. The core workflow in DataSnipper is built entirely around linking figures across documents. Without this, the tool can only analyze documents in isolation, which limits its usefulness for complex engagements.

**Success criteria:** The tool automatically detects that Net Income on the income statement matches a figure in the notes to financial statements. An auditor can manually create a cross-reference between two figures across two documents. A deliberate inconsistency between linked figures produces a red annotation error.

---

#### 3.5 Prior Year Baseline Comparison (Standalone)

Extend the prior year comparison from Phase 1's tick-and-tie into a full dedicated comparison view:

- Side-by-side view of current year and prior year figures for any statement
- Each line shows the dollar change and percentage change
- Lines exceeding the materiality threshold are color-coded (yellow for notable, red for significant)
- The auditor can add a comment explaining each significant change (this becomes part of the workpaper)
- The copilot can be asked to explain any prior year variance in the context of what it knows about the document

**Why it matters:** Prior year comparison is a required audit procedure. The Phase 1 version detects mismatches; this feature turns the comparison into a full analytical review tool that documents the auditor's explanations — a workpaper artifact, not just a flag.

**Success criteria:** Given current year and prior year balance sheets, the comparison view correctly calculates all variances. Lines above a configurable materiality threshold are correctly highlighted. Auditor comments on variances are saved and appear in the exported workpaper.

---

### Phase 3 Dependencies

| Dependency | Notes |
|---|---|
| Phase 2 complete | Anomaly detection findings use the annotation layer and copilot from Phase 2 |
| Sufficient test data | Benford's Law testing requires a realistic dataset of 100+ transactions |
| Expanded Claude context | Multi-document cross-referencing may require sending multiple document extracts in a single Claude prompt — test context limits early |

---

## Phase 4 — Integration & Scale

**Weeks 11–14 | Goal: Production-ready deployment with full authentication, multi-client support, and website integration**

This phase takes the working product from Phase 3 and makes it production-grade: secure, multi-user, multi-client, and connected to the existing company website.

### Deliverables

#### 4.1 REST API for Website Integration

Expose a clean, documented API so the existing company website can connect to Audit-Annotate:

- CORS configuration scoped to the company website's domain (no open CORS)
- API endpoints for: creating an engagement, uploading a document to an engagement, retrieving findings, and downloading the exported PDF
- Shared authentication via API tokens (the website sends a token with each request; the tool validates it)
- API documentation auto-generated by FastAPI (OpenAPI / Swagger UI)
- Rate limiting to prevent abuse

**Why it matters:** The product is not a standalone application — it needs to connect to the existing company website. Without a clean API boundary, the integration becomes a fragile one-off hack. A properly designed REST API also positions the tool for future third-party integrations.

**Success criteria:** The existing company website can successfully call the "create engagement" and "upload document" endpoints with a valid API token. The API documentation is accessible and accurate. An invalid token returns a 401 error, not a 500.

---

#### 4.2 User Authentication and Role-Based Access

Implement a three-role access system:

| Role | Permissions |
|---|---|
| **Auditor** | Create engagements, upload documents, view findings, process findings (approve/dismiss/note), add comments |
| **Reviewer / Partner** | All auditor permissions + view all engagements on the team, mark engagements as reviewed, view sign-off status |
| **Admin** | All permissions + manage users, configure firm-level settings (materiality thresholds, anomaly detector settings), view audit logs |

- Login via email and password (hashed with bcrypt, never stored in plaintext)
- JWT-based session management with configurable expiry
- All actions are logged with the performing user's identity and timestamp (audit log of the audit tool)
- Password reset via email link

**Why it matters:** Audit workpapers contain sensitive client financial data. Access control is not optional. Without role-based access, a junior auditor can see or modify partner-level findings, which is both a security problem and a workflow problem.

**Success criteria:** An auditor cannot access the admin settings panel. A reviewer can view all team engagements but cannot change admin configuration. All user actions appear correctly attributed in the audit log.

---

#### 4.3 Multi-Client / Multi-Engagement Management

Build the engagement management layer that allows the team to work on multiple clients simultaneously:

- Client directory: create and manage client records (name, entity type, fiscal year end, engagement type)
- Engagement list per client: each client can have multiple engagements (e.g., 2024 Audit, 2024 Tax, 2023 Audit)
- Engagement dashboard showing status, open findings count, and last activity for each engagement
- Team assignment: assign auditors and reviewers to specific engagements (users only see documents for their assigned engagements unless they are admin)
- Engagement archiving (completed engagements are archived, not deleted, preserving the workpaper record)

**Why it matters:** A real audit practice manages dozens of clients and multiple concurrent engagements. A tool that works for one document at a time but has no engagement structure becomes unusable at scale. This is the core workflow infrastructure that Suralink and AuditBoard are built on.

**Success criteria:** A user can create three separate client records, each with two engagements, upload documents to each, and confirm that documents do not bleed across engagement boundaries. Archiving an engagement removes it from the active list but preserves all its documents and findings.

---

#### 4.4 PBC Request Portal

Build a structured client document request system (Provided By Client — standard audit terminology):

- The auditor creates a PBC list: a structured checklist of documents requested from the client (e.g., "Bank statements for all accounts, January–December 2024," "Fixed asset schedule," "Accounts receivable aging report")
- Each PBC item has a description, due date, responsible party (client contact name), and status
- Status workflow: Not Started → Requested → Received → Reviewed
- When a document is uploaded to an engagement, the auditor can mark it as fulfilling a specific PBC request
- PBC list can be exported as a formatted PDF or Excel for sharing with the client

**Why it matters:** Suralink was built entirely around PBC request management and has captured significant market share because of it. The PBC process is a chronic pain point: requests get lost in email, clients don't know what's outstanding, and auditors spend time chasing documents instead of auditing them. A simple, built-in PBC portal solves this without requiring a separate tool.

**Success criteria:** An auditor can create a PBC list with 10 items, assign due dates, and mark three items as received. Uploading a document can be linked to a PBC item, changing its status to Received. Exporting the PBC list produces a correctly formatted PDF.

---

#### 4.5 Audit Program Generator

Use Claude to generate tailored audit test procedures based on the client's profile and risk areas:

- The auditor inputs a client profile: industry, entity type, significant accounts, prior year findings, and identified risk areas
- Claude generates a draft audit program: a checklist of specific test procedures appropriate for the engagement (e.g., "Confirm the top 10 accounts receivable balances totaling at least 70% of the balance" for a high-AR client)
- The audit program is editable and can be exported as a workpaper
- Completed test procedures can be checked off with sign-off attribution

**Why it matters:** Writing audit programs from scratch is time-consuming. Fieldguide's AI program generation is one of its most-cited differentiating features. A good audit program generator reduces engagement setup time from hours to minutes and ensures procedures are risk-appropriate rather than boilerplate.

**Success criteria:** Given a client profile describing a manufacturing company with high inventory and prior year inventory valuation findings, Claude generates an audit program that includes inventory-specific procedures. The generated program is editable and exportable.

---

#### 4.6 Render Deployment Configuration

Prepare the full production deployment configuration:

- `render.yaml` file defining the web service (FastAPI backend), static site (React frontend), and PostgreSQL database as code
- Environment variable configuration for production (API keys, database URL, CORS origins)
- Health check endpoints for Render's uptime monitoring
- Build scripts that compile the React frontend and serve it correctly from FastAPI in production
- Database migration scripts that run automatically on deploy (using Alembic)
- Basic deployment runbook: step-by-step instructions for the first deploy and for rolling back a bad deploy

**Why it matters:** The tool has no value if it cannot be deployed reliably. Render's infrastructure-as-code approach (`render.yaml`) ensures that the deployment configuration is version-controlled and reproducible, not a one-time manual setup that only one person knows how to repeat.

**Success criteria:** A fresh deploy from the main branch on Render results in a working application with no manual steps beyond setting environment variables. The health check endpoint returns 200. Database migrations run automatically without data loss.

---

### Phase 4 Dependencies

| Dependency | Notes |
|---|---|
| Phase 3 complete | All features must be stable before adding authentication and multi-tenancy on top |
| Render account | Production PostgreSQL and web service |
| Email provider | Required for password reset (SendGrid, Postmark, or AWS SES) |
| Company website contact | Need the website team to review the API integration spec before building |
| SSL certificate | Render provides this automatically via Let's Encrypt — no action required |

---

## Summary Timeline

| Phase | Weeks | Primary Output |
|---|---|---|
| Phase 1: Foundation & Core Engine | 1–3 | Document upload, Claude extraction, tick-and-tie engine, split-screen shell |
| Phase 2: Annotation & AI Copilot | 4–6 | Color-coded annotations, streaming AI copilot, document Q&A, workflow, PDF export |
| Phase 3: Advanced Audit Intelligence | 7–10 | Anomaly detection, workpaper QC, report drafting, multi-document, prior year view |
| Phase 4: Integration & Scale | 11–14 | Auth, multi-client, PBC portal, audit programs, REST API, Render deployment |

---

## Success Metrics (End of Phase 4)

| Metric | Target |
|---|---|
| Tick-and-tie accuracy | Correctly identifies 95%+ of footing and cross-statement errors in test documents |
| AI copilot explanation accuracy | Finding explanations reference the correct figures with no hallucinated data |
| Document Q&A citation accuracy | 85%+ of answers include a correct citation to the source line item |
| Anomaly detection false positive rate | Under 15% false positives on a clean test dataset |
| Workpaper QC completeness | Zero missed deficiencies on a test workpaper with 5 intentional issues |
| Export fidelity | Exported PDFs correctly position annotations on 100% of tested documents |
| Deployment reliability | Zero manual steps required for a clean Render deploy |

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Claude API extraction errors on unusual document formats | Medium | Build a human-review step for low-confidence extractions; test on diverse real documents early |
| PDF annotation positioning breaks on complex PDFs (scanned, rotated pages) | Medium | Use page-coordinate-based anchoring; flag scanned PDFs that require OCR pre-processing |
| Multi-document cross-referencing exceeds Claude context limits | Low | Extract only line-item data (not raw text) before sending to Claude; test context limits in Phase 3 sprint 1 |
| Prior year comparison fails when statement formats differ year-over-year | Medium | Use Claude to normalize line item labels before comparison; flag unmatched lines |
| PBC portal scope grows into a full client portal | Low | Keep PBC portal internal-only in Phase 4; resist adding client-facing login until Phase 4 is stable |

---

*Document last updated: May 2026*
*This roadmap is a living document and should be reviewed at the end of each phase.*
