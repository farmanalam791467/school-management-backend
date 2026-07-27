const db = require('../config/db');

// Get all events
exports.getEvents = async (req, res) => {
  try {
    const [events] = await db.query('SELECT * FROM events ORDER BY start_date ASC');
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching events' });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  const { title, description, start_date, end_date, type } = req.body;
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ message: 'Title, start date, and end date are required' });
  }

  try {
    await db.query(
      'INSERT INTO events (title, description, start_date, end_date, type) VALUES (?, ?, ?, ?, ?)',
      [title, description || '', start_date, end_date, type || 'Event']
    );
    res.status(201).json({ message: 'Event created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating event' });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM events WHERE id = ?', [id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting event' });
  }
};
