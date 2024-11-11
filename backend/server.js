const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { Pool } = require('pg');

app.use(bodyParser.json());

const pool = new Pool({
  user: 'postgres',          // Replace with your PostgreSQL username
  host: 'localhost',
  database: 'game_db',       // Replace with your actual database name
  password: 'Admin',         // Replace with your PostgreSQL password
  port: 5432,
});

// Start Match Endpoint
app.post('/api/match/start', async (req, res) => {
  try {
    const { team1, team2 } = req.body;
    if (!team1 || !team2 || team1 === team2) {
      return res.status(400).json({ message: "Select two different teams" });
    }

    // Random match duration and winning/losing team
    const duration = `00:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
    const winningTeam = Math.random() > 0.5 ? team1 : team2;
    const losingTeam = winningTeam === team1 ? team2 : team1;

    // Insert match result into the database
    const matchResult = await pool.query(
      `INSERT INTO Match (Match_Date, Duration, Winning_Team_ID, Losing_Team_ID)
       VALUES (CURRENT_DATE, $1, $2, $3) RETURNING Match_ID`,
      [duration, winningTeam, losingTeam]
    );

    const matchId = matchResult.rows[0].match_id;
    res.status(200).json({ message: `Match started between Team ${team1} and Team ${team2}`, matchId });
  } catch (error) {
    console.error("Error starting match:", error);
    res.status(500).json({ message: "An error occurred while starting the match" });
  }
});

// Player Stats Endpoint
app.get('/playerStats', async (req, res) => {
  const player = req.query.player;
  try {
    const stats = await pool.query(`
      SELECT COUNT(gs.Match_ID) AS matches, 
             SUM(gs.Kills) AS kills, 
             SUM(gs.Deaths) AS deaths, 
             SUM(gs.Assists) AS assists
      FROM Game_Stats gs
      JOIN Player p ON gs.Player_ID = p.Player_ID
      WHERE p.Player_Name = $1
      GROUP BY p.Player_Name`, 
      [player]);
    
    res.json(stats.rows[0] || { matches: 0, kills: 0, deaths: 0, assists: 0 });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ message: 'An error occurred while fetching player stats.' });
  }
});

// Player Rank Endpoint
app.get('/playerRank', async (req, res) => {
  const player = req.query.player;
  try {
    const rankInfo = await pool.query(`
      SELECT r.Rank_Name, p.Experience
      FROM Player p
      JOIN Rank r ON p.Rank_ID = r.Rank_ID
      WHERE p.Player_Name = $1`, 
      [player]);
    
    res.json(rankInfo.rows[0] || { rank: 'Unranked', experience: 0 });
  } catch (error) {
    console.error('Error fetching player rank:', error);
    res.status(500).json({ message: 'An error occurred while fetching player rank.' });
  }
});
app.listen(3000, () => console.log('Server running on http://localhost:3000'));