const db = require('../config/db');

// Get notices
exports.getNotices = async (req, res) => {
  const currentRole = req.user.role;
  try {
    let query = `
      SELECT n.*, u.name as author_name 
      FROM notices n
      JOIN users u ON n.created_by = u.id
    `;
    const params = [];

    // Filter by role
    if (['student', 'parent', 'teacher'].includes(currentRole)) {
      query += ' WHERE n.target_audience IN ("All", ?)';
      params.push(currentRole === 'parent' ? 'Parents' : currentRole === 'student' ? 'Students' : 'Teachers');
    } else if (['accountant', 'librarian', 'receptionist', 'hr', 'transport_manager', 'hostel_manager'].includes(currentRole)) {
      query += ' WHERE n.target_audience IN ("All", "Staff")';
    }

    query += ' ORDER BY n.id DESC';
    const [notices] = await db.query(query, params);
    res.json({ notices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching notices' });
  }
};

// Create a notice
exports.createNotice = async (req, res) => {
  const { title, content, target_audience } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required' });
  }

  try {
    await db.query(
      'INSERT INTO notices (title, content, target_audience, created_by) VALUES (?, ?, ?, ?)',
      [title, content, target_audience || 'All', req.user.id]
    );
    res.status(201).json({ message: 'Notice posted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error posting notice' });
  }
};

// Delete a notice
exports.deleteNotice = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM notices WHERE id = ?', [id]);
    res.json({ message: 'Notice deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting notice' });
  }
};
