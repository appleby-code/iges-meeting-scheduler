const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initDb, query, get, run } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meeting Scheduler Server Running' });
});

// 2. Create Poll
app.post('/api/polls', async (req, res) => {
  try {
    const { title, description, organizer_name, location, options } = req.body;

    if (!title || !organizer_name || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Title, organizer name, and at least one time option are required.' });
    }

    const pollId = uuidv4();
    await run(
      `INSERT INTO polls (id, title, description, organizer_name, location, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [pollId, title, description || '', organizer_name, location || '']
    );

    const optionRecords = [];
    for (const opt of options) {
      const optionId = uuidv4();
      const startTime = opt.start_time || opt.startTime;
      const endTime = opt.end_time || opt.endTime;
      const slotLabel = opt.slot_label || opt.slotLabel || `${startTime} - ${endTime}`;

      await run(
        `INSERT INTO poll_options (id, poll_id, start_time, end_time, slot_label) VALUES (?, ?, ?, ?, ?)`,
        [optionId, pollId, startTime, endTime, slotLabel]
      );

      optionRecords.push({ id: optionId, poll_id: pollId, start_time: startTime, end_time: endTime, slot_label: slotLabel });
    }

    const createdPoll = await get(`SELECT * FROM polls WHERE id = ?`, [pollId]);
    res.status(201).json({ poll: createdPoll, options: optionRecords });
  } catch (err) {
    console.error('Error creating poll:', err);
    res.status(500).json({ error: 'Internal server error creating poll.' });
  }
});

// 3. List All Polls
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await query(`SELECT * FROM polls ORDER BY created_at DESC`);
    res.json(polls);
  } catch (err) {
    console.error('Error fetching polls:', err);
    res.status(500).json({ error: 'Internal server error fetching polls.' });
  }
});

// 4. Get Poll Details & Results View
app.get('/api/polls/:id', async (req, res) => {
  try {
    const pollId = req.params.id;
    const poll = await get(`SELECT * FROM polls WHERE id = ?`, [pollId]);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Query aggregated option stats from SQLite view v_poll_results
    const optionsWithResults = await query(
      `SELECT * FROM v_poll_results WHERE poll_id = ? ORDER BY start_time ASC`,
      [pollId]
    );

    // Fetch guest responses and individual votes
    const guestResponses = await query(
      `SELECT * FROM guest_responses WHERE poll_id = ? ORDER BY created_at ASC`,
      [pollId]
    );

    const votes = await query(
      `SELECT v.*, gr.guest_name 
       FROM votes v 
       JOIN guest_responses gr ON v.response_id = gr.id 
       WHERE gr.poll_id = ?`,
      [pollId]
    );

    // Map votes into guest matrix: { [guest_name]: { [option_id]: availability } }
    const guestMatrix = {};
    guestResponses.forEach(gr => {
      guestMatrix[gr.guest_name] = { id: gr.id, name: gr.guest_name, choices: {} };
    });

    votes.forEach(v => {
      if (guestMatrix[v.guest_name]) {
        guestMatrix[v.guest_name].choices[v.option_id] = v.availability;
      }
    });

    res.json({
      poll,
      options: optionsWithResults,
      guestResponses,
      guestMatrix: Object.values(guestMatrix)
    });
  } catch (err) {
    console.error('Error fetching poll details:', err);
    res.status(500).json({ error: 'Internal server error fetching poll details.' });
  }
});

// 5. Submit Guest Availability Response
app.post('/api/polls/:id/responses', async (req, res) => {
  try {
    const pollId = req.params.id;
    const { guest_name, votes } = req.body; // votes is an object { option_id: 'yes' | 'maybe' | 'no' }

    if (!guest_name || !votes || typeof votes !== 'object') {
      return res.status(400).json({ error: 'Guest name and availability votes are required.' });
    }

    const poll = await get(`SELECT * FROM polls WHERE id = ?`, [pollId]);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    const responseId = uuidv4();
    await run(
      `INSERT INTO guest_responses (id, poll_id, guest_name) VALUES (?, ?, ?)`,
      [responseId, pollId, guest_name.trim()]
    );

    const optionIds = Object.keys(votes);
    for (const optId of optionIds) {
      const availability = votes[optId];
      if (['yes', 'maybe', 'no'].includes(availability)) {
        const voteId = uuidv4();
        await run(
          `INSERT INTO votes (id, response_id, option_id, availability) VALUES (?, ?, ?, ?)`,
          [voteId, responseId, optId, availability]
        );
      }
    }

    res.status(201).json({ message: 'Response recorded successfully.', responseId });
  } catch (err) {
    console.error('Error recording response:', err);
    res.status(500).json({ error: 'Internal server error recording response.' });
  }
});

// 6. Finalize Poll
app.post('/api/polls/:id/finalize', async (req, res) => {
  try {
    const pollId = req.params.id;
    const { finalized_slot_id } = req.body;

    if (!finalized_slot_id) {
      return res.status(400).json({ error: 'finalized_slot_id is required.' });
    }

    await run(
      `UPDATE polls SET status = 'finalized', finalized_slot_id = ? WHERE id = ?`,
      [finalized_slot_id, pollId]
    );

    res.json({ message: 'Poll finalized successfully.', finalized_slot_id });
  } catch (err) {
    console.error('Error finalizing poll:', err);
    res.status(500).json({ error: 'Internal server error finalizing poll.' });
  }
});

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize DB and start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
