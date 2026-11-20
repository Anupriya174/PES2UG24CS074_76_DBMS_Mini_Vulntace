# VulnTrace — Database & Backend API
### Author: Anupriya (PES2UG24CS074)

This document describes the database design, advanced SQL features, and backend
API layer of VulnTrace — a vulnerability tracking platform with AI-powered
duplicate detection.

---

## 1. Database Design

### 1.1 ER Model
The schema follows a normalized relational design with **8 tables**, 2 weak
entities, and an integrity-enforcement trigger.

```
roles ──< users ──< projects
                ├──< reports ──< comments        (weak entity)
                │          ├──< status_history   (weak entity)
                │          └──< report_similarity
                └──< notifications
```

### 1.2 Tables Created

| # | Table | Type | Key Design Decision |
|---|-------|------|---------------------|
| 1 | `roles` | Strong | Lookup table (Reporter, Triager, Admin) |
| 2 | `users` | Strong | `email UNIQUE`, FK → roles |
| 3 | `severity_levels` | Strong | `CHECK (score BETWEEN 1 AND 10)` |
| 4 | `projects` | Strong | `created_by` FK → users |
| 5 | `reports` | Strong | `ENUM` for status, FKs to projects, users, severity |
| 6 | `comments` | **Weak** | Composite PK `(report_id, author_id, comment_id)` — borrows key from both report and user (two identifying relationships) |
| 7 | `status_history` | **Weak** | Composite PK `(report_id, changed_by, history_id)` — same pattern |
| 8 | `notifications` | Strong | `ON DELETE CASCADE` from users |
| 9 | `report_similarity` | Associative | Composite PK `(report_id_1, report_id_2)`, pair-ordering enforced by trigger |

### 1.3 Referential Integrity — CASCADE Deletes

```sql
-- Deleting a report automatically removes its children:
FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE  -- comments
FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE  -- status_history
FOREIGN KEY (report_id_1) REFERENCES reports(report_id) ON DELETE CASCADE -- similarity
FOREIGN KEY (report_id_2) REFERENCES reports(report_id) ON DELETE CASCADE -- similarity

-- Deleting a user removes their notifications:
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
```

---

## 2. Views

### View 1: `report_summary`
Readable report listing with project name and severity label. Uses `LEFT JOIN`
to keep reports with no severity assigned yet.

```sql
CREATE OR REPLACE VIEW report_summary AS
SELECT
    r.report_id, r.title,
    p.name AS project_name,
    s.level_name AS severity_name,
    r.status, r.submitted_by, r.assigned_to
FROM reports r
JOIN projects p ON r.project_id = p.project_id
LEFT JOIN severity_levels s ON r.severity_id = s.severity_id;
```

### View 2: `project_report_counts`
Counts reports per project. `LEFT JOIN` ensures projects with zero reports still
appear.

```sql
CREATE OR REPLACE VIEW project_report_counts AS
SELECT
    p.project_id, p.name AS project_name,
    COUNT(r.report_id) AS total_reports
FROM projects p
LEFT JOIN reports r ON p.project_id = r.project_id
GROUP BY p.project_id, p.name;
```

---

## 3. Triggers

### Trigger 1: `trg_report_status_change`
Fires `AFTER UPDATE` on `reports`. Records every status change in
`status_history` for a full audit trail.

```sql
CREATE TRIGGER trg_report_status_change
AFTER UPDATE ON reports
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO status_history
            (report_id, old_status, new_status, changed_by)
        VALUES
            (NEW.report_id, OLD.status, NEW.status,
             COALESCE(@acting_user_id, NEW.assigned_to, NEW.submitted_by));
    END IF;
END;
```

### Trigger 2: `trg_notify_status_change`
Fires `AFTER UPDATE` on `reports`. Sends notifications to both the assignee and
the submitter when a status changes.

```sql
CREATE TRIGGER trg_notify_status_change
AFTER UPDATE ON reports
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        IF NEW.assigned_to IS NOT NULL THEN
            INSERT INTO notifications (user_id, message)
            VALUES (NEW.assigned_to,
                    CONCAT('Report #', NEW.report_id, ' status changed to ', NEW.status));
        END IF;
        IF NEW.assigned_to IS NULL OR NEW.submitted_by <> NEW.assigned_to THEN
            INSERT INTO notifications (user_id, message)
            VALUES (NEW.submitted_by,
                    CONCAT('Report #', NEW.report_id, ' status changed to ', NEW.status));
        END IF;
    END IF;
END;
```

### Trigger 3: `trg_similarity_order`
Fires `BEFORE INSERT` on `report_similarity`. Enforces `report_id_1 < report_id_2`
so each pair is stored only once.

```sql
CREATE TRIGGER trg_similarity_order
BEFORE INSERT ON report_similarity
FOR EACH ROW
BEGIN
    IF NEW.report_id_1 >= NEW.report_id_2 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'report_id_1 must be smaller than report_id_2';
    END IF;
END;
```

---

## 4. Stored Procedures

### Procedure 1: `update_report_status`
Changes a report's status. The trigger automatically logs it.

```sql
CREATE PROCEDURE update_report_status(
    IN p_report_id  INT,
    IN p_new_status VARCHAR(30),
    IN p_changed_by INT
)
BEGIN
    DECLARE v_old_actor INT DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET @acting_user_id = v_old_actor;
        RESIGNAL;
    END;

    SET v_old_actor = @acting_user_id;
    SET @acting_user_id = p_changed_by;

    UPDATE reports SET status = p_new_status WHERE report_id = p_report_id;

    SET @acting_user_id = v_old_actor;
END;
```

### Procedure 2: `get_report_history`
Returns the status-change history of a report, newest first.

```sql
CREATE PROCEDURE get_report_history(IN p_report_id INT)
BEGIN
    SELECT history_id, report_id, old_status, new_status, changed_by, changed_at
    FROM status_history
    WHERE report_id = p_report_id
    ORDER BY changed_at DESC, history_id DESC;
END;
```

### Procedure 3: `assign_report` *(uses TRANSACTION)*
Three steps that must succeed or fail together:
1. Assign the triager and set status to 'Triaged'
2. Set the severity
3. Add an audit comment

```sql
CREATE PROCEDURE assign_report(
    IN p_report_id INT, IN p_triager_id INT,
    IN p_severity_id INT, IN p_acting_user_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN ROLLBACK; RESIGNAL; END;

    -- Validation
    IF NOT EXISTS (SELECT 1 FROM reports WHERE report_id = p_report_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Report does not exist';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM users u JOIN roles ro ON u.role_id = ro.role_id
        WHERE u.user_id = p_triager_id AND ro.role_name = 'Triager'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assignee must be a Triager';
    END IF;

    START TRANSACTION;
        UPDATE reports SET assigned_to = p_triager_id, status = 'Triaged'
        WHERE report_id = p_report_id;

        UPDATE reports SET severity_id = p_severity_id
        WHERE report_id = p_report_id;

        INSERT INTO comments (report_id, comment_text, author_id)
        VALUES (p_report_id,
                CONCAT('Assigned to user #', p_triager_id,
                       ' with severity #', p_severity_id),
                p_acting_user_id);
    COMMIT;
END;
```

### Procedure 4: `resolve_duplicate` *(uses TRANSACTION)*
Marks a report as a duplicate and records the similarity score.

```sql
CREATE PROCEDURE resolve_duplicate(
    IN p_duplicate_id INT, IN p_original_id INT,
    IN p_similarity_score DECIMAL(5,4), IN p_acting_user_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN ROLLBACK; RESIGNAL; END;

    IF p_duplicate_id = p_original_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A report cannot be a duplicate of itself';
    END IF;

    START TRANSACTION;
        UPDATE reports SET status = 'Duplicate' WHERE report_id = p_duplicate_id;

        INSERT INTO report_similarity (report_id_1, report_id_2, similarity_score)
        VALUES (LEAST(p_duplicate_id, p_original_id),
                GREATEST(p_duplicate_id, p_original_id),
                p_similarity_score)
        ON DUPLICATE KEY UPDATE similarity_score = p_similarity_score,
                                computed_at = CURRENT_TIMESTAMP;

        INSERT INTO comments (report_id, comment_text, author_id)
        VALUES (p_duplicate_id,
                CONCAT('Duplicate of report #', p_original_id),
                p_acting_user_id);
    COMMIT;
END;
```

---

## 5. Backend API Routes

All routes use **parameterized queries** to prevent SQL injection.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Email + password login, returns JWT cookie |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `POST` | `/api/reports` | Create report + cache similarity scores |
| `POST` | `/api/reports/[id]/status` | Calls `update_report_status` procedure |
| `POST` | `/api/reports/[id]/assign` | Calls `assign_report` procedure |
| `POST` | `/api/reports/[id]/duplicate` | Calls `resolve_duplicate` procedure |
| `POST` | `/api/reports/[id]/comments` | Add comment (ownership check for Reporters) |
| `PATCH` | `/api/admin/users` | Change user role (Admin only) |
| `GET` | `/api/meta` | Fetch projects + severities for forms |

### Key Backend Libraries
- **`lib/db.js`** — MySQL connection pool using `mysql2/promise`
- **`lib/api.js`** — `authorize()` middleware, role check, error handler
- **`lib/auth.js`** — JWT-based session management (sign, verify, cookie handling)

---

## 6. Demo Queries

### 6.1 JOIN
```sql
SELECT r.report_id, r.title, p.name AS project_name, r.status
FROM reports r
JOIN projects p ON r.project_id = p.project_id;
```

### 6.2 GROUP BY + HAVING
```sql
SELECT p.name AS project_name, COUNT(r.report_id) AS total_reports
FROM projects p
LEFT JOIN reports r ON p.project_id = r.project_id
GROUP BY p.project_id, p.name
HAVING COUNT(r.report_id) >= 2
ORDER BY total_reports DESC;
```

### 6.3 Nested Query (Subquery with IN)
```sql
SELECT report_id, title
FROM reports
WHERE project_id IN (
    SELECT project_id FROM projects WHERE name = 'Campus Portal'
);
```

### 6.4 Nested Query (Subquery with Aggregate)
```sql
SELECT r.report_id, r.title, s.level_name, s.score
FROM reports r
JOIN severity_levels s ON r.severity_id = s.severity_id
WHERE s.score > (SELECT AVG(score) FROM severity_levels);
```

### 6.5 UPDATE Operation
```sql
UPDATE users SET role_id = ? WHERE user_id = ?;
```

### 6.6 DELETE (Cascading)
```sql
-- Deleting a report cascades to comments, history, and similarity
DELETE FROM reports WHERE report_id = 1;
```
