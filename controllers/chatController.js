const db = require('../config/db');

// Get chat contacts (users they can chat with)
exports.getContacts = async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;

  try {
    let query = 'SELECT id, name, role, email, phone, avatar FROM users WHERE id != ? AND status = "active"';
    const params = [currentUserId];

    // Restrict contacts based on role for better privacy
    if (currentRole === 'student') {
      // Students can chat with their teachers
      query = `
        SELECT DISTINCT u.id, u.name, u.role, u.email, u.phone, u.avatar 
        FROM users u
        JOIN class_subjects cs ON cs.teacher_id = u.id
        JOIN students s ON s.class_id = cs.class_id AND s.section_id = cs.section_id
        WHERE s.user_id = ? AND u.status = "active"
      `;
      params.splice(0, 1, currentUserId);
    } else if (currentRole === 'parent') {
      // Parents can chat with their children's teachers
      query = `
        SELECT DISTINCT u.id, u.name, u.role, u.email, u.phone, u.avatar 
        FROM users u
        JOIN class_subjects cs ON cs.teacher_id = u.id
        JOIN students s ON s.class_id = cs.class_id AND s.section_id = cs.section_id
        JOIN parents p ON s.parent_id = p.id
        WHERE p.user_id = ? AND u.status = "active"
      `;
      params.splice(0, 1, currentUserId);
    }

    const [contacts] = await db.query(query, params);
    res.json({ contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching contacts' });
  }
};

// Get messages between current user and a contact
exports.getMessages = async (req, res) => {
  const { contactId } = req.params;
  const userId = req.user.id;

  try {
    // Mark messages as read
    await db.query(
      'UPDATE chats SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?',
      [contactId, userId]
    );

    // Fetch messages
    const [messages] = await db.query(
      `SELECT * FROM chats 
       WHERE (sender_id = ? AND receiver_id = ?) 
          OR (sender_id = ? AND receiver_id = ?) 
       ORDER BY id ASC`,
      [userId, contactId, contactId, userId]
    );

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  const { receiver_id, message } = req.body;
  const sender_id = req.user.id;

  if (!receiver_id || !message) {
    return res.status(400).json({ message: 'Receiver ID and message are required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO chats (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, FALSE)',
      [sender_id, receiver_id, message]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      chat: {
        id: result.insertId,
        sender_id,
        receiver_id,
        message,
        is_read: false,
        created_at: new Date()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error sending message' });
  }
};
