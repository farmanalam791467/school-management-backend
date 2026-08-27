const Event = require('../models/Event');

// Get all events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ start_date: 1 });
    
    const formattedEvents = events.map(e => ({
      id: e._id.toString(),
      title: e.title,
      description: e.description || '',
      start_date: e.start_date,
      end_date: e.end_date,
      type: e.type || 'Event',
      created_by: e.created_by ? e.created_by.toString() : null
    }));

    res.json({ events: formattedEvents });
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
    const newEvent = new Event({
      title,
      description: description || '',
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      type: type || 'Event',
      created_by: req.user.id
    });
    await newEvent.save();
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
    await Event.findByIdAndDelete(id);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting event' });
  }
};
