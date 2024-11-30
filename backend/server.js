const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

// Enable CORS for all routes
app.use(cors());

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
    console.log("Request body:", req.body);

    if (!team1 || !team2 || team1 === team2) {
      return res.status(400).json({ message: "Select two different teams" });
    }

    // Generate random match duration
    const duration = `00:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
    console.log("Generated match duration:", duration);

    // Retrieve team IDs from the database
    const team1Result = await pool.query(`SELECT team_id FROM team WHERE team_name = $1`, [team1]);
    const team2Result = await pool.query(`SELECT team_id FROM team WHERE team_name = $1`, [team2]);

    if (team1Result.rows.length === 0 || team2Result.rows.length === 0) {
      return res.status(400).json({ message: "One or both teams not found" });
    }

    const teamId1 = team1Result.rows[0].team_id;
    const teamId2 = team2Result.rows[0].team_id;

    // Randomly select the winning and losing teams
    const winningTeam = Math.random() > 0.5 ? teamId1 : teamId2;
    const losingTeam = winningTeam === teamId1 ? teamId2 : teamId1;
    console.log("Winning team ID:", winningTeam);
    console.log("Losing team ID:", losingTeam);

    // Insert match result into the database
    const matchResult = await pool.query(
      `INSERT INTO Match (match_date, duration, winning_team_id, losing_team_id)
       VALUES (CURRENT_DATE, $1, $2, $3) RETURNING match_id`,
      [duration, winningTeam, losingTeam]
    );
    const matchId = matchResult.rows[0].match_id;
    console.log(matchId);
    console.log(matchId);
    console.log("Match successfully started with ID:", matchId);

    // Get players from team_players table for each team
    const playersTeam1 = await pool.query(`SELECT player_id FROM team_player WHERE team_id = $1`, [winningTeam]);
    const playersTeam2 = await pool.query(`SELECT player_id FROM team_player WHERE team_id = $1`, [losingTeam]);

    // Function to generate random stats
    const generateStats = () => {
      return {
        kills: Math.floor(Math.random() * 10),
        deaths: Math.floor(Math.random() * 10),
        assists: Math.floor(Math.random() * 10)
      };
    };
    
    // Insert stats for each player in team 1
    for (const player of playersTeam1.rows) {
      const stats = generateStats();
      await pool.query(
        `INSERT INTO game_stats (match_id, player_id, kills, deaths, assists) 
         VALUES ($1, $2, $3, $4, $5)`,
        [matchId, player.player_id, stats.kills, stats.deaths, stats.assists]
      );
    }

    // Insert stats for each player in team 2
    for (const player of playersTeam2.rows) {
      const stats = generateStats();
      await pool.query(
        `INSERT INTO game_stats (match_id, player_id, kills, deaths, assists) 
         VALUES ($1, $2, $3, $4, $5)`,
        [matchId, player.player_id, stats.kills, stats.deaths, stats.assists]
      );
    }

    res.status(200).json({ message: `Match started between Team ${team1} and Team ${team2}`, matchId });
  } catch (error) {
    console.error("Error starting match:", error);
    res.status(500).json({ message: "An error occurred while starting the match" });
  }
});

app.get('/teamRegion', async (req, res) => {
  const teamName = req.query.team;
  try {
    const result = await pool.query(
      `SELECT region FROM team WHERE team_name = $1`,
      [teamName]
    );
    if (result.rows.length >= 0) {
      res.json({ region: result.rows[0].region });
    } else {
      res.status(404).json({ message: 'Team not found' });
    }
  } catch (error) {
    console.error('Error fetching team region:', error);
    res.status(500).json({ message: 'An error occurred while fetching the team region.' });
  }
});

app.get('/get-kd-ratio', async (req, res) => {
  const { playerName } = req.query; // Assuming playerName is passed as a query parameter
  console.log(req.query);
  if (!playerName) {
      return res.status(400).send('Player name is required');
  }

  try {
    console.log(playerName);
      const result = await pool.query(
          'SELECT CalculateKDRatio($1) AS kd_ratio', [playerName]
      );
      console.log(result.rows[0].kd_ratio);
      res.json({ kd_ratio: result.rows[0].kd_ratio });
  } catch (err) {
      console.log("Error");
      console.error(err);
      res.status(500).send('Internal server error');
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
    console.log(player);
    const rankInfo = await pool.query(`
      SELECT r.rank_name, r.max_experience
      FROM Player p
      JOIN Rank r ON p.Rank_ID = r.Rank_ID
      WHERE p.Player_Name = $1;
    `, 
    [player]);
    
    if (rankInfo.rows.length !== 0) {
      res.json({ rank: rankInfo.rows[0].rank_name, max_experience: rankInfo.rows[0].max_experience });
    } else {
      res.json({ rank: 'Unranked' }); // Or you could omit this key entirely if you prefer
    }
  } catch (error) {
    console.error('Error fetching player rank:', error);
    res.status(500).json({ message: 'An error occurred while fetching player rank.' });
  }
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));
