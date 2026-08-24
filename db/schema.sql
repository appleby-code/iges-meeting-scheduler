-- Meeting Scheduler Database Schema & Aggregation Views

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  organizer_name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'finalized', 'closed'
  finalized_slot_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_label TEXT,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guest_responses (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  availability TEXT NOT NULL CHECK(availability IN ('yes', 'maybe', 'no')),
  FOREIGN KEY (response_id) REFERENCES guest_responses(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
);

-- Aggregation View for calculating vote totals per poll option
DROP VIEW IF EXISTS v_poll_results;

CREATE VIEW v_poll_results AS
SELECT 
  po.poll_id,
  po.id AS option_id,
  po.start_time,
  po.end_time,
  po.slot_label,
  COALESCE(SUM(CASE WHEN v.availability = 'yes' THEN 1 ELSE 0 END), 0) AS yes_count,
  COALESCE(SUM(CASE WHEN v.availability = 'maybe' THEN 1 ELSE 0 END), 0) AS maybe_count,
  COALESCE(SUM(CASE WHEN v.availability = 'no' THEN 1 ELSE 0 END), 0) AS no_count,
  COUNT(v.id) AS total_votes
FROM poll_options po
LEFT JOIN votes v ON po.id = v.option_id
GROUP BY po.id, po.poll_id, po.start_time, po.end_time, po.slot_label;
