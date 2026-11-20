# VulnTrace – Contributions

| Contributor | USN | Responsibility |
|-------------|-----|----------------|
| **Anupriya** | PES2UG24CS074 | Database design, SQL schema, stored procedures, triggers, transactions & backend API routes |
| **Anvii S Rai** | PES2UG24CS076 | Frontend UI, React components, embedding service (vector search) & full-text search integration |

---

## Anupriya — Database & Backend API

### Database Layer (`database/`)
- Designed the **ER model** and normalized relational schema (8 tables)
- Wrote complete DDL: `roles`, `users`, `projects`, `reports`, `comments`, `status_history`, `notifications`, `report_similarity`
- Implemented **weak entities** (`comments`, `status_history`) with composite primary keys
- Added **CHECK constraints**, **ENUM types**, and **foreign key cascades**

### Advanced SQL Features
- **Stored Procedures**: `update_report_status`, `get_report_history`, `assign_report`, `resolve_duplicate`
- **Triggers**: `trg_report_status_change` (audit log), `trg_notify_status_change` (auto-notifications), `trg_similarity_order` (pair validation)
- **Transactions**: ACID-compliant multi-step operations with `START TRANSACTION / COMMIT / ROLLBACK` inside procedures
- **Views**: `report_summary`, `project_report_counts`
- Wrote **demo queries**: JOINs, GROUP BY, HAVING, subqueries (IN, aggregate), full-text search

### Backend API (`web/app/api/`)
- `POST /api/reports` — create report + cache similarity scores
- `POST /api/reports/[id]/status` — calls `update_report_status` procedure
- `POST /api/reports/[id]/assign` — calls `assign_report` procedure (transactional)
- `POST /api/reports/[id]/duplicate` — calls `resolve_duplicate` procedure (transactional)
- `POST /api/reports/[id]/comments` — add comment with ownership check
- `PATCH /api/admin/users` — role management
- `POST /api/auth/login`, `POST /api/auth/logout` — session auth with JWT
- Shared utilities: `lib/db.js` (connection pool), `lib/api.js` (auth middleware, role checks), `lib/auth.js` (JWT sessions)

---

## Anvii S Rai — Frontend & Embedding Service

### Frontend UI (`web/app/`)
- **Dashboard** (`page.js`) — triage queue with status filters, severity sorting, and role-based views
- **Report Detail** (`reports/[id]/page.js`) — full report view with comments, status history timeline, and staff action panels
- **New Report** (`reports/new/page.js`) — submission form with project selector
- **Search** (`search/page.js`) — dual-engine search page (keyword + semantic results side by side)
- **Admin Panel** (`admin/page.js`) — reports by status/project charts, user role management, vector reindex control
- **Login Page** (`login/page.js`) — authentication form

### React Components (`web/app/components/`)
- `CommentForm.js` — inline comment submission
- `StaffActions.js` — assign triager, change status, mark duplicate (staff-only panel)
- `SimilarPanel.js` — live vector-search similar reports panel
- `ReindexButton.js` — trigger full Qdrant re-index from admin
- `UserRoleSelect.js` — inline role dropdown for admin user management
- `LogoutButton.js` — session logout

### Embedding / Vector Search Service (`embedding-service/`)
- Built the **Flask microservice** (`app.py`) for semantic duplicate detection
- Integrated **Sentence-Transformers** (`all-MiniLM-L6-v2`) for text → vector embeddings
- Connected to **Qdrant** vector database for similarity search
- Endpoints: `/embed` (vectorise text), `/search` (find similar), `/index` (store), `/reindex` (bulk re-index all reports from MySQL)
- `lib/embed.js` — Next.js client that calls the embedding service

### Search Integration
- `GET /api/search` — MySQL **FULLTEXT search** (keyword) + Qdrant **vector search** (semantic), results displayed side by side
- `GET /api/reports/[id]/similar` — live similar-report lookup for a specific report

### Infrastructure
- `docker-compose.yml` — orchestrates MySQL + Qdrant containers
- `middleware.js` — Next.js route protection
- CSS / layout / styling (`layout.js`, `globals.css`)
