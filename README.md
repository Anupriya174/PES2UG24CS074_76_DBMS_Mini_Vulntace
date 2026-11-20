# VulnTrace

A vulnerability and bug tracker for security teams. Its main feature is that a new report is compared with every
earlier one **by meaning**, so "SQL injection in login" and "special characters in the username box skip sign-in" are
recognised as the same problem even though they share almost no words.

| Part | Technology | Port |
|---|---|---|
| Relational data (users, reports, comments, history) | MySQL 8 | 3306 |
| Vector search (report embeddings) | Qdrant | 6333 |
| Embedding service (`all-MiniLM-L6-v2`, 384 dimensions) | Python, FastAPI | 8001 |
| Web app and API | Next.js 14 | 3000 |

The MySQL `report_id` is used directly as the Qdrant point id, so no mapping table is needed.

## What you need installed

- Node.js 20.6 or newer
- Python 3.10 or newer
- Docker (for Qdrant, and optionally MySQL)
- MySQL 8.0.16 or newer, if you do not use the Docker MySQL

## Run it (about 10 minutes)

**1. Start Qdrant**

```
docker compose up -d qdrant
```

**2. Create the database.** Pick one.

- Your own MySQL: `mysql -u root -p < database/vulntrace_complete.sql`
- MySQL in Docker: `docker compose --profile db up -d` (listens on port **3307**, root password `root`)

**3. Start the embedding service** (the first start downloads the model, about 90 MB)

```
cd embedding-service
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --port 8001
```

**4. Start the web app**

```
cd web
cp .env.example .env.local         # then edit DB_USER, DB_PASSWORD (and DB_PORT=3307 for Docker MySQL)
npm install
npm run set-passwords              # gives the demo users a real password
npm run dev
```

Open http://localhost:3000.

**5. Index the seed reports once.** Log in as the admin, open **Admin**, click **Reindex all reports**.

## Demo users

The password for every user is `Password@123`.

| Email | Role | Can do |
|---|---|---|
| sneha@vulntrace.com, karthik@vulntrace.com, ananya@vulntrace.com | Reporter | Submit reports, see only their own, comment on them |
| meera@vulntrace.com, rohan@vulntrace.com | Triager | See every report, assign and triage, mark duplicates, search |
| admin@vulntrace.com | Admin | Everything above, plus users, statistics and reindexing |

Roles are enforced in the API routes and the pages, not just hidden in the menu.

## Where each database feature shows up in the app

| Screen | Database feature |
|---|---|
| Report detail, **Assign and triage** | Stored procedure `assign_report` (one transaction: assign, set severity, add a comment; rolls back on any error) |
| Report detail, **Mark duplicate** | Stored procedure `resolve_duplicate` (one transaction: status, similarity pair, comment) |
| Report detail, **Update status** | Stored procedure `update_report_status` |
| Report detail, **Status history** and notifications | Triggers `trg_report_status_change` and `trg_notify_status_change` |
| Admin, reports by project | View `project_report_counts` |
| Search | MySQL full-text index (keywords) next to Qdrant (meaning) |
| Report detail, **Similar reports** | Qdrant vector search; strong matches are cached in `report_similarity` |

## Suggested demo flow

1. Log in as `sneha@vulntrace.com` and submit: *"Typing quotes in the password box logs me in as anyone"*.
2. Log in as `meera@vulntrace.com`. Open the new report: the **Similar reports** panel lists the earlier SQL injection reports.
3. Click **Mark duplicate** on the best match. The status history gains a row, and the reporter gets a notification.
4. Open **Search** and describe a bug in words no report uses. The keyword column finds little or nothing; the semantic column finds the right reports. This is the argument for using a vector database.
5. Try **Assign and triage** with the wrong kind of user (a Reporter) to show the transaction rolling back.

## Project layout

```
database/vulntrace_complete.sql   schema, seed data, views, triggers, procedures, full-text indexes
embedding-service/app.py          FastAPI service: embeds text, talks to Qdrant
web/app/                          pages and API routes (Next.js App Router)
web/lib/                          database pool, session cookie, embedding client
docker-compose.yml                Qdrant (and optional MySQL)
```

## Troubleshooting

- **"The similarity service is not reachable"**: the embedding service is not running on port 8001, or Qdrant is not running.
- **Similar reports are empty for the seed data**: click **Reindex all reports** on the Admin page.
- **Cannot log in**: run `npm run set-passwords` (the seed data ships with placeholder hashes).
- **`--env-file` error**: upgrade Node to 20.6 or newer.
- **Port 3306 already in use when using Docker MySQL**: it is mapped to 3307 on purpose; set `DB_PORT=3307`.
