-- =========================================================
-- VulnTrace Database - Complete Script
-- Part 1: DDL   Part 2: DML   Part 3: Advanced Features
-- Part 4: Demo queries
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced)
-- =========================================================

-- =========================================================
-- PART 1: DDL SECTION
-- =========================================================

DROP DATABASE IF EXISTS vulntrace;

CREATE DATABASE vulntrace
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vulntrace;

-- ---------- ROLE ----------
CREATE TABLE roles (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE
);

-- ---------- USER ----------
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- ---------- SEVERITY_LEVEL ----------
CREATE TABLE severity_levels (
    severity_id     INT AUTO_INCREMENT PRIMARY KEY,
    level_name      VARCHAR(50) NOT NULL UNIQUE,
    score           INT NOT NULL CHECK (score BETWEEN 1 AND 10)
);

-- ---------- PROJECT ----------
CREATE TABLE projects (
    project_id      INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    created_by      INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ---------- REPORT ----------
CREATE TABLE reports (
    report_id       INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    status          ENUM('Open', 'Triaged', 'In Progress', 'Fixed', 'Closed', 'Duplicate')
                    NOT NULL DEFAULT 'Open',
    project_id      INT NOT NULL,
    submitted_by    INT NOT NULL,
    assigned_to     INT,
    severity_id     INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id)   REFERENCES projects(project_id),
    FOREIGN KEY (submitted_by) REFERENCES users(user_id),
    FOREIGN KEY (assigned_to)  REFERENCES users(user_id),
    FOREIGN KEY (severity_id)  REFERENCES severity_levels(severity_id)
);

-- ---------- COMMENT (weak entity, owners = REPORT and USER) ----------
-- Two identifying relationships (has_comment and writes), so the key borrows
-- from both owners: the full key is (report_id, author_id, comment_id) and
-- comment_id is the partial key.
-- InnoDB needs an AUTO_INCREMENT column to lead some index, hence idx_comment_id.
CREATE TABLE comments (
    comment_id      INT AUTO_INCREMENT,
    report_id       INT NOT NULL,
    comment_text    TEXT NOT NULL,
    author_id       INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id, author_id, comment_id),
    KEY idx_comment_id (comment_id),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

-- ---------- STATUS_HISTORY (weak entity, owners = REPORT and USER) ----------
-- Two identifying relationships (has_history and changes), so the full key is
-- (report_id, changed_by, history_id) and history_id is the partial key.
CREATE TABLE status_history (
    history_id      INT AUTO_INCREMENT,
    report_id       INT NOT NULL,
    old_status      VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    changed_by      INT NOT NULL,
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id, changed_by, history_id),
    KEY idx_history_id (history_id),
    FOREIGN KEY (report_id)  REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id)
);

-- ---------- NOTIFICATION ----------
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    message         VARCHAR(255) NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ---------- REPORT_SIMILARITY ----------
-- MySQL does not allow a CHECK on columns that also carry a foreign key
-- with a referential action (ON DELETE CASCADE), so the pair-ordering rule
-- (report_id_1 < report_id_2) is enforced by a trigger instead.
CREATE TABLE report_similarity (
    report_id_1      INT NOT NULL,
    report_id_2      INT NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
    computed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id_1, report_id_2),
    FOREIGN KEY (report_id_1) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (report_id_2) REFERENCES reports(report_id) ON DELETE CASCADE
);

DELIMITER //
CREATE TRIGGER trg_similarity_order
BEFORE INSERT ON report_similarity
FOR EACH ROW
BEGIN
    IF NEW.report_id_1 >= NEW.report_id_2 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'report_id_1 must be smaller than report_id_2';
    END IF;
END//
DELIMITER ;

-- =========================================================
-- PART 2: DML SECTION
-- =========================================================

USE vulntrace;

-- ROLES
INSERT INTO roles(role_id, role_name)
VALUES
(1,'Reporter'),
(2,'Triager'),
(3,'Admin');

-- SEVERITY LEVELS
INSERT INTO severity_levels
(severity_id, level_name, score)
VALUES
(1,'Low',2),
(2,'Medium',5),
(3,'High',8),
(4,'Critical',10);

-- USERS
INSERT INTO users
(user_id,name,email,password_hash,role_id)
VALUES
(1,'Admin User','admin@vulntrace.com','$2b$10$demoHash1',3),
(2,'Meera Nair','meera@vulntrace.com','$2b$10$demoHash2',2),
(3,'Rohan Iyer','rohan@vulntrace.com','$2b$10$demoHash3',2),
(4,'Sneha Rao','sneha@vulntrace.com','$2b$10$demoHash4',1),
(5,'Karthik Menon','karthik@vulntrace.com','$2b$10$demoHash5',1),
(6,'Ananya Gupta','ananya@vulntrace.com','$2b$10$demoHash6',1);

-- PROJECTS
INSERT INTO projects
(project_id,name,description,created_by)
VALUES
(1,'Campus Portal','Student Portal',1),
(2,'Payment Gateway API','Payment Backend',1),
(3,'Student Mobile App','Android App',1);

-- REPORTS
INSERT INTO reports
(report_id,title,description,status,
project_id,submitted_by,assigned_to,severity_id)
VALUES
(1,'SQL Injection in Login','Login bypass possible','Closed',1,4,2,4),
(2,'Authentication Bypass','Similar SQL injection issue','Duplicate',1,5,2,4),
(3,'Stored XSS','Script executes in comments','In Progress',1,6,3,3),
(4,'API Key Exposure','API key visible in APK','In Progress',3,5,3,3),
(5,'Broken Access Control','View other student grades','Fixed',1,4,2,4),
(6,'Hardcoded Secret','Secret visible in app build','Duplicate',3,6,3,3),
(7,'No Rate Limiting','Unlimited login attempts','Closed',1,5,2,3),
(8,'Session Token Valid After Logout','Token remains active','Open',3,4,NULL,NULL),
(9,'Unsanitized Input Lets Attackers Skip Sign-In',
 'Special characters typed into the username box change the database query and skip authentication',
 'Open',1,6,NULL,NULL);

-- COMMENTS
INSERT INTO comments
(comment_id,comment_text,report_id,author_id)
VALUES
(1,'Issue reproduced',1,2),
(2,'Prepared statements implemented',1,2),
(3,'Duplicate of report #1',2,2),
(4,'Output encoding added',3,3),
(5,'Key removed from APK',4,3),
(6,'Ownership check added',5,2);

-- NOTIFICATIONS
INSERT INTO notifications
(notification_id,user_id,message)
VALUES
(1,2,'Report #1 assigned'),
(2,4,'Report #1 closed'),
(3,3,'Report #4 assigned'),
(4,5,'Report #2 duplicate');

-- REPORT SIMILARITY (pre-seeded example scores, not live vector search)
INSERT INTO report_similarity
(report_id_1,report_id_2,similarity_score)
VALUES
(1,2,0.91),
(4,6,0.89),
(1,7,0.76);

-- =========================================================
-- PART 3: ADVANCED DATABASE FEATURES
-- (created after the seed data so the seed does not fire them)
--
-- Summary: each feature below is built from 2 database objects.
--   Views              : report_summary, project_report_counts
--   Triggers           : trg_report_status_change, trg_notify_status_change
--   Stored procedures  : update_report_status, get_report_history
--   Transactions       : assign_report, resolve_duplicate
--                        (START TRANSACTION / COMMIT / ROLLBACK inside the code)
--   Full-text search   : ft_reports_title_description, ft_comments_text
--
-- Also in the script (integrity helper, created in Part 1):
--   trg_similarity_order keeps report_similarity pairs ordered, because
--   MySQL cannot put a CHECK on a foreign-key column with ON DELETE CASCADE.
-- =========================================================

-- ---------------------------------------------------------
-- 3.1 VIEWS
-- A view is a virtual table defined by a SELECT query.
-- ---------------------------------------------------------

-- VIEW 1: readable report summary.
-- LEFT JOIN keeps reports whose severity is still NULL.
CREATE OR REPLACE VIEW report_summary AS
SELECT
    r.report_id,
    r.title,
    p.name AS project_name,
    s.level_name AS severity_name,
    r.status,
    r.submitted_by,
    r.assigned_to
FROM reports r
JOIN projects p ON r.project_id = p.project_id
LEFT JOIN severity_levels s ON r.severity_id = s.severity_id;

-- VIEW 2: number of reports per project.
-- LEFT JOIN also lists projects that have zero reports.
CREATE OR REPLACE VIEW project_report_counts AS
SELECT
    p.project_id,
    p.name AS project_name,
    COUNT(r.report_id) AS total_reports
FROM projects p
LEFT JOIN reports r ON p.project_id = r.project_id
GROUP BY p.project_id, p.name;

-- ---------------------------------------------------------
-- 3.2 TRIGGERS
-- A trigger runs automatically when a table event occurs.
-- ---------------------------------------------------------

DELIMITER //

-- TRIGGER 1: record every status change in status_history.
-- @acting_user_id identifies who made the change; it is set by the
-- stored procedure below. If it is not set, fall back to the
-- assignee, then to the submitter, so changed_by is never NULL.
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
END//

-- TRIGGER 2: notify the people involved when a status changes.
-- The assignee is notified if there is one, and the submitter is
-- notified unless they are the same person.
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
END//

DELIMITER ;

-- ---------------------------------------------------------
-- 3.3 STORED PROCEDURES
-- A stored procedure is a named block of SQL run with CALL.
-- ---------------------------------------------------------

DELIMITER //

-- PROCEDURE 1: change a report's status and record who did it.
-- The EXIT HANDLER restores the session variable if an error occurs,
-- and RESIGNAL passes the error back to the caller.
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

    UPDATE reports
    SET status = p_new_status
    WHERE report_id = p_report_id;

    SET @acting_user_id = v_old_actor;
END//

-- PROCEDURE 2: show the status-change history of one report,
-- newest first.
CREATE PROCEDURE get_report_history(
    IN p_report_id INT
)
BEGIN
    SELECT history_id, report_id, old_status, new_status, changed_by, changed_at
    FROM status_history
    WHERE report_id = p_report_id
    ORDER BY changed_at DESC, history_id DESC;
END//

-- PROCEDURE 3: assign a report (uses a TRANSACTION).
-- Three steps must succeed or fail together:
--   1. assign the triager and set status to 'Triaged'
--      (the triggers also write status_history and notifications)
--   2. set the severity
--   3. add an audit comment
-- If any step fails, the handler issues ROLLBACK, which undoes every
-- step, including the rows the triggers inserted. Otherwise COMMIT
-- makes all of them permanent.
CREATE PROCEDURE assign_report(
    IN p_report_id      INT,
    IN p_triager_id     INT,
    IN p_severity_id    INT,
    IN p_acting_user_id INT
)
BEGIN
    DECLARE v_old_actor INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @acting_user_id = v_old_actor;
        RESIGNAL;
    END;

    SET v_old_actor = @acting_user_id;
    SET @acting_user_id = p_acting_user_id;

    -- Validation before any change is made.
    IF NOT EXISTS (SELECT 1 FROM reports WHERE report_id = p_report_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Report does not exist';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM users u
        JOIN roles ro ON u.role_id = ro.role_id
        WHERE u.user_id = p_triager_id AND ro.role_name = 'Triager'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assignee must be a Triager';
    END IF;

    START TRANSACTION;

        -- Step 1: assign and triage (fires the history and notification triggers)
        UPDATE reports
        SET assigned_to = p_triager_id,
            status = 'Triaged'
        WHERE report_id = p_report_id;

        -- Step 2: set severity (fails on an invalid severity_id)
        UPDATE reports
        SET severity_id = p_severity_id
        WHERE report_id = p_report_id;

        -- Step 3: audit comment
        INSERT INTO comments (report_id, comment_text, author_id)
        VALUES (p_report_id,
                CONCAT('Assigned to user #', p_triager_id,
                       ' with severity #', p_severity_id),
                p_acting_user_id);

    COMMIT;

    SET @acting_user_id = v_old_actor;
END//

-- PROCEDURE 4: mark a report as a duplicate of another (uses a TRANSACTION).
-- Three steps must succeed or fail together:
--   1. set the duplicate report's status to 'Duplicate'
--      (the triggers also write status_history and notifications)
--   2. record the pair and its score in report_similarity
--   3. add a comment pointing to the original report
-- If any step fails (for example an invalid score), ROLLBACK undoes all of it.
CREATE PROCEDURE resolve_duplicate(
    IN p_duplicate_id      INT,
    IN p_original_id       INT,
    IN p_similarity_score  DECIMAL(5,4),
    IN p_acting_user_id    INT
)
BEGIN
    DECLARE v_old_actor INT DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @acting_user_id = v_old_actor;
        RESIGNAL;
    END;

    SET v_old_actor = @acting_user_id;
    SET @acting_user_id = p_acting_user_id;

    -- Validation before any change is made.
    IF p_duplicate_id = p_original_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A report cannot be a duplicate of itself';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reports WHERE report_id = p_duplicate_id)
       OR NOT EXISTS (SELECT 1 FROM reports WHERE report_id = p_original_id) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Both reports must exist';
    END IF;

    START TRANSACTION;

        -- Step 1: mark as duplicate (fires the history and notification triggers)
        UPDATE reports
        SET status = 'Duplicate'
        WHERE report_id = p_duplicate_id;

        -- Step 2: store the similarity pair, smaller id first
        -- (fails on a score outside 0 to 1)
        INSERT INTO report_similarity (report_id_1, report_id_2, similarity_score)
        VALUES (LEAST(p_duplicate_id, p_original_id),
                GREATEST(p_duplicate_id, p_original_id),
                p_similarity_score)
        ON DUPLICATE KEY UPDATE
            similarity_score = p_similarity_score,
            computed_at = CURRENT_TIMESTAMP;

        -- Step 3: comment on the duplicate report
        INSERT INTO comments (report_id, comment_text, author_id)
        VALUES (p_duplicate_id,
                CONCAT('Duplicate of report #', p_original_id),
                p_acting_user_id);

    COMMIT;

    SET @acting_user_id = v_old_actor;
END//

DELIMITER ;

-- ---------------------------------------------------------
-- 3.4 FULL-TEXT SEARCH
-- A FULLTEXT index lets MATCH ... AGAINST search the words in a
-- text column, ranked by relevance.
-- ---------------------------------------------------------

-- FULLTEXT INDEX 1: search report titles and descriptions.
ALTER TABLE reports
    ADD FULLTEXT INDEX ft_reports_title_description (title, description);

-- FULLTEXT INDEX 2: search the discussion threads on reports.
ALTER TABLE comments
    ADD FULLTEXT INDEX ft_comments_text (comment_text);

-- =========================================================
-- PART 4: DEMO QUERIES
-- Read-only queries are live. Anything that changes data is
-- commented out: run those manually, one section at a time.
-- =========================================================

-- ---------- Basic data ----------
SHOW TABLES;
SELECT report_id, title, status FROM reports;

-- ---------- Views ----------
SELECT * FROM report_summary;
SELECT * FROM project_report_counts;

-- ---------- JOIN ----------
SELECT r.report_id, r.title, p.name AS project_name, r.status
FROM reports r
JOIN projects p ON r.project_id = p.project_id;

-- ---------- GROUP BY + aggregate + ORDER BY ----------
SELECT p.name AS project_name, r.status, COUNT(*) AS total_reports
FROM projects p
JOIN reports r ON p.project_id = r.project_id
GROUP BY p.name, r.status
ORDER BY p.name, total_reports DESC;

-- ---------- HAVING ----------
-- Projects that have at least 2 reports (Payment Gateway API has none).
SELECT p.name AS project_name, COUNT(r.report_id) AS total_reports
FROM projects p
LEFT JOIN reports r ON p.project_id = r.project_id
GROUP BY p.project_id, p.name
HAVING COUNT(r.report_id) >= 2
ORDER BY total_reports DESC;

-- ---------- SUBQUERY (IN) ----------
SELECT report_id, title
FROM reports
WHERE project_id IN (SELECT project_id FROM projects WHERE name = 'Campus Portal');

-- ---------- SUBQUERY (aggregate) ----------
-- Reports whose severity score is above the average severity score.
SELECT r.report_id, r.title, s.level_name, s.score
FROM reports r
JOIN severity_levels s ON r.severity_id = s.severity_id
WHERE s.score > (SELECT AVG(score) FROM severity_levels);

-- ---------- FULL-TEXT INDEX 1 (reports): natural language with relevance ----------
-- Finds reports about SQL injection, ranked by relevance. Note that report #9
-- (same problem, different words) is NOT found: keyword search matches words,
-- not meaning. That gap is why VulnTrace uses vector search (Qdrant) as well.
SELECT report_id, title,
       MATCH(title, description) AGAINST('SQL injection login' IN NATURAL LANGUAGE MODE) AS relevance
FROM reports
WHERE MATCH(title, description) AGAINST('SQL injection login' IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC;

-- ---------- FULL-TEXT INDEX 2 (comments): boolean mode with operators ----------
-- + means the word is required, - means it must not appear.
-- Comments that mention "added" but not "output".
SELECT comment_id, report_id, comment_text
FROM comments
WHERE MATCH(comment_text) AGAINST('+added -output' IN BOOLEAN MODE);

-- ---------- Similarity results (pre-seeded, not live vector search) ----------
SELECT * FROM report_similarity ORDER BY similarity_score DESC;

-- ---------- TRIGGER 1 + 2 (status history and notifications) ----------
-- Report #8 starts as Open.
-- SELECT * FROM status_history WHERE report_id = 8;
-- SET @acting_user_id = 2;
-- UPDATE reports SET status = 'Triaged' WHERE report_id = 8;
-- SET @acting_user_id = NULL;
-- SELECT * FROM status_history WHERE report_id = 8;
-- SELECT * FROM notifications ORDER BY notification_id DESC;

-- ---------- STORED PROCEDURES ----------
-- Report #3 is In Progress and assigned to user 3; user 2 makes the change.
-- CALL update_report_status(3, 'Fixed', 2);
-- SELECT * FROM reports WHERE report_id = 3;
-- CALL get_report_history(3);
-- SELECT * FROM notifications WHERE user_id IN (3, 6) ORDER BY notification_id DESC;

-- ---------- TRANSACTION INSIDE A PROCEDURE: assign_report ----------
-- Report #8 starts as Open, unassigned, with no severity.
-- Run the two FAILING calls first, then the successful one.
--
-- a) Fails: severity 99 does not exist. Step 1 already ran inside the
--    transaction, but the handler's ROLLBACK undoes it, including the
--    history and notification rows the triggers created.
-- CALL assign_report(8, 3, 99, 1);
-- SELECT report_id, status, assigned_to, severity_id FROM reports WHERE report_id = 8;   -- unchanged
-- SELECT * FROM status_history WHERE report_id = 8;                                      -- no new row
-- SELECT * FROM comments WHERE report_id = 8;                                            -- no new row
--
-- b) Fails: user 4 is a Reporter, not a Triager.
-- CALL assign_report(8, 4, 3, 1);
--
-- c) Succeeds: admin (user 1) assigns triager 3, severity High (3). COMMIT.
-- CALL assign_report(8, 3, 3, 1);
-- SELECT report_id, status, assigned_to, severity_id FROM reports WHERE report_id = 8;
-- SELECT * FROM status_history WHERE report_id = 8;
-- SELECT * FROM comments WHERE report_id = 8;
-- SELECT * FROM notifications ORDER BY notification_id DESC;
--
-- These demos change report #8. Re-run the whole script to reset the data.

-- ---------- TRANSACTION INSIDE A PROCEDURE: resolve_duplicate ----------
-- Report #9 starts as Open and is a reworded duplicate of report #1.
-- Run the failing call first, then the successful one.
--
-- a) Fails: a score of 1.5 breaks the 0-to-1 CHECK. Step 1 (status change)
--    had already run, but ROLLBACK undoes it, plus the trigger-created rows.
-- CALL resolve_duplicate(9, 1, 1.5, 2);
-- SELECT report_id, status FROM reports WHERE report_id = 9;               -- still Open
-- SELECT * FROM status_history WHERE report_id = 9;                        -- no row
-- SELECT * FROM comments WHERE report_id = 9;                              -- no row
-- SELECT * FROM report_similarity WHERE report_id_2 = 9;                   -- no row
--
-- b) Succeeds: triager 2 marks #9 as a duplicate of #1 with score 0.93. COMMIT.
-- CALL resolve_duplicate(9, 1, 0.93, 2);
-- SELECT report_id, status FROM reports WHERE report_id = 9;               -- Duplicate
-- SELECT * FROM status_history WHERE report_id = 9;
-- SELECT * FROM comments WHERE report_id = 9;
-- SELECT * FROM report_similarity WHERE report_id_2 = 9;
--
-- These demos change report #9. Re-run the whole script to reset the data.

-- ---------- TRANSACTION: MANUAL ROLLBACK ----------
-- The update, its history row, and its notifications are all undone.
-- START TRANSACTION;
-- CALL update_report_status(8, 'Closed', 2);
-- SELECT report_id, status FROM reports WHERE report_id = 8;
-- SELECT * FROM status_history WHERE report_id = 8;
-- ROLLBACK;
-- SELECT report_id, status FROM reports WHERE report_id = 8;
-- SELECT * FROM status_history WHERE report_id = 8;

-- ---------- TRANSACTION: COMMIT (optional) ----------
-- START TRANSACTION;
-- CALL update_report_status(8, 'Fixed', 2);
-- COMMIT;
-- SELECT report_id, status FROM reports WHERE report_id = 8;

-- ---------- SIMILARITY ORDER RULE ----------
-- This should FAIL with the trigger's error message:
-- INSERT INTO report_similarity (report_id_1, report_id_2, similarity_score)
-- VALUES (5, 3, 0.80);

-- ---------- Final checks ----------
-- SELECT * FROM status_history ORDER BY changed_at DESC;
-- SELECT * FROM notifications ORDER BY notification_id DESC;
