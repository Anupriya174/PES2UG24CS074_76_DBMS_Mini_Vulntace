# VulnTrace — Frontend & Embedding Service
### Author: Anvii S Rai (PES2UG24CS076)

This document describes the frontend user interface, React components, and the
AI-powered embedding/vector-search service of VulnTrace — a vulnerability
tracking platform with semantic duplicate detection.

---

## 1. Frontend Architecture

### 1.1 Technology Stack
- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: JavaScript (JSX)
- **Styling**: Custom CSS with severity-based color coding
- **Auth**: JWT cookie-based sessions with middleware protection

### 1.2 Route Protection
The `middleware.js` file intercepts every request and redirects unauthenticated
users to `/login`. Role-based access is enforced at the page level:
- **Reporters** see only their own reports
- **Triagers** see all reports and can triage/assign
- **Admins** get the full admin panel

---

## 2. Pages

### 2.1 Dashboard (`app/page.js`)
The main landing page after login. Dynamically adapts to the user's role:

**Features:**
- **Status filter bar** — clickable badges (All, Open, Triaged, In Progress, Fixed, Closed, Duplicate) with live counts
- **Sortable report table** — highest severity first, unrated reports last
- **Role-based view** — Reporters see "My reports", staff see "Triage queue"

**Key query used:**
```sql
SELECT r.report_id, r.title, r.status, r.created_at,
       p.name AS project, s.level_name AS severity, a.name AS assignee
FROM reports r
JOIN projects p ON p.project_id = r.project_id
LEFT JOIN severity_levels s ON s.severity_id = r.severity_id
LEFT JOIN users a ON a.user_id = r.assigned_to
ORDER BY s.score IS NULL, s.score DESC, r.created_at DESC
```

### 2.2 Report Detail (`app/reports/[id]/page.js`)
Full view of a single vulnerability report.

**Sections:**
- Report header with severity color band
- Description panel
- Metadata (project, reporter, assignee, date)
- Comments thread with inline submission form
- Staff action panel (assign, change status, mark duplicate)
- Similar reports panel (live vector search)
- Status history timeline

### 2.3 New Report (`app/reports/new/page.js`)
Submission form for reporters to file a new vulnerability.

**Fields:** Project (dropdown), Title, Description  
**On submit:** Creates report → runs vector search → caches similarity scores → shows similar reports warning to staff

### 2.4 Search (`app/search/page.js`)
Dual-engine search page — compares MySQL keyword search vs Qdrant semantic search side by side.

**Two result columns:**
| Keyword (MySQL FULLTEXT) | Semantic (Qdrant vectors) |
|--------------------------|---------------------------|
| Matches exact words | Matches meaning |
| Fast, built-in | Catches rephrasings |
| Misses synonyms | Needs embedding service running |

**MySQL full-text query used:**
```sql
SELECT report_id, title, status,
       MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
FROM reports
WHERE MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC LIMIT 10
```

### 2.5 Login (`app/login/page.js`)
Authentication form with email and password fields.

### 2.6 Admin Panel (`app/admin/page.js`)
Admin-only dashboard with:
- Reports-by-status summary table
- Reports-by-project summary (uses `project_report_counts` view)
- User management table with inline role-change dropdowns
- Vector index reindex button
- Recent status changes timeline

---

## 3. React Components

### 3.1 `CommentForm.js`
Client component for posting comments on a report.
- Text area with submit button
- Calls `POST /api/reports/[id]/comments`
- Reloads page on success to show the new comment

### 3.2 `StaffActions.js`
Staff-only action panel (Triager / Admin). Three sections:

| Action | What it does | API called |
|--------|-------------|------------|
| **Change status** | Dropdown of all statuses + "Update" button | `POST /api/reports/[id]/status` |
| **Assign** | Triager dropdown + severity dropdown + "Assign" button | `POST /api/reports/[id]/assign` |
| **Mark duplicate** | Report ID input + "Mark duplicate" button | `POST /api/reports/[id]/duplicate` |

### 3.3 `SimilarPanel.js`
Client component that fetches and displays **similar reports** using live vector
search.
- Calls `GET /api/reports/[id]/similar`
- Shows a ranked list with similarity scores and status badges
- Helps triagers identify duplicate reports

### 3.4 `ReindexButton.js`
Admin button that triggers a full re-index of all reports into Qdrant.
- Calls `POST /api/admin/reindex`
- Shows progress/error feedback
- Needed once after loading seed data

### 3.5 `UserRoleSelect.js`
Inline dropdown in the admin user table.
- Changes a user's role in real-time
- Calls `PATCH /api/admin/users`
- Disabled for the admin's own row (can't change your own role)

### 3.6 `LogoutButton.js`
Simple button that calls `POST /api/auth/logout` and redirects to login.

---

## 4. Embedding Service (`embedding-service/`)

### 4.1 Overview
A **Flask microservice** (`app.py`) that converts vulnerability report text into
vector embeddings and stores/searches them in Qdrant for semantic duplicate
detection.

### 4.2 Technology Stack
- **Framework**: Flask (Python)
- **ML Model**: `sentence-transformers/all-MiniLM-L6-v2` — produces 384-dimensional vectors
- **Vector DB**: Qdrant (runs in Docker)
- **Dependencies**: `requirements.txt` → flask, sentence-transformers, qdrant-client

### 4.3 How It Works

```
┌─────────────┐    text    ┌──────────────────┐   vector    ┌────────┐
│  Next.js    │ ─────────► │  Flask Service   │ ──────────► │ Qdrant │
│  Backend    │            │  (all-MiniLM)    │             │  (DB)  │
│             │ ◄───────── │                  │ ◄────────── │        │
└─────────────┘  results   └──────────────────┘   search    └────────┘
```

1. **Report submitted** → Next.js sends `title + description` to Flask
2. **Flask** encodes the text using Sentence-Transformers into a 384-dim vector
3. **Search** → Qdrant finds the top-5 nearest vectors (cosine similarity)
4. **Results** → returned to Next.js, which caches strong matches (≥0.5) in MySQL's `report_similarity` table

### 4.4 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/embed` | Convert text to a 384-dim vector |
| `POST` | `/search` | Find top-N similar reports by meaning |
| `POST` | `/index` | Store a report's vector in Qdrant |
| `POST` | `/reindex` | Fetch all reports from MySQL, re-embed and re-index all |

### 4.5 Next.js Client (`lib/embed.js`)
Helper module that calls the Flask service from the Next.js backend:
- `indexReport({ report_id, title, description })` — vectorise and store
- `searchSimilar(text, limit, excludeId)` — find similar reports

---

## 5. Full-Text Search Integration

Two **FULLTEXT indexes** enable keyword-based search directly in MySQL:

### Index 1: Report titles and descriptions
```sql
ALTER TABLE reports
    ADD FULLTEXT INDEX ft_reports_title_description (title, description);
```

### Index 2: Comment text
```sql
ALTER TABLE comments
    ADD FULLTEXT INDEX ft_comments_text (comment_text);
```

### Search modes used:
```sql
-- Natural Language Mode (ranked by relevance)
SELECT report_id, title,
       MATCH(title, description) AGAINST('SQL injection' IN NATURAL LANGUAGE MODE) AS relevance
FROM reports
WHERE MATCH(title, description) AGAINST('SQL injection' IN NATURAL LANGUAGE MODE);

-- Boolean Mode (required/excluded words)
SELECT comment_id, report_id, comment_text
FROM comments
WHERE MATCH(comment_text) AGAINST('+added -output' IN BOOLEAN MODE);
```

**Why both keyword AND vector search?**
> Report #1 ("SQL Injection in Login") and Report #9 ("Unsanitized Input Lets
> Attackers Skip Sign-In") describe the **same vulnerability** in different
> words. Keyword search only finds #1, but vector search catches both — this is
> the core value of VulnTrace's AI duplicate detection.

---

## 6. Infrastructure

### 6.1 Docker Compose (`docker-compose.yml`)
Orchestrates the supporting services:

```yaml
services:
  mysql:
    image: mysql:8
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: ...
      MYSQL_DATABASE: vulntrace

  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333"]
```

### 6.2 Layout & Styling (`app/layout.js`)
- Global navigation bar with role-aware links
- Responsive CSS with severity color coding:
  - 🔴 Critical — red
  - 🟠 High — orange
  - 🟡 Medium — yellow
  - 🟢 Low — green
- Status badges with distinct colors per state
