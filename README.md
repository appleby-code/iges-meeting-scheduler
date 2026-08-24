# Meeting Scheduler

Full-stack Doodle-like meeting scheduler application built with Express, SQLite, and Vanilla HTML/CSS/JS.

## Features

- **Poll Creation**: Create meeting polls with multiple time slots and custom options.
- **Participant Voting**: Invite participants to vote on their availability for proposed time slots.
- **Results Grid**: Real-time summary of participant responses and slot availability.
- **SQLite Storage**: Persistent local database storing polls, time slots, participants, and votes.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/appleby-code/iges-meeting-scheduler.git
   cd iges-meeting-scheduler
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   `http://localhost:3000`

## Project Structure

```
.
├── db/
│   ├── database.js      # SQLite database connection & setup
│   └── schema.sql       # Database table definitions
├── public/
│   ├── css/
│   │   └── styles.css   # Main stylesheet
│   ├── js/
│   │   └── app.js       # Client-side JavaScript logic
│   └── index.html       # Web application UI
├── package.json
├── README.md
└── server.js            # Express API server & static routes
```

## License

ISC
