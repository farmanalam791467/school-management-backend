const Notice = require('../models/Notice');
const User = require('../models/User');

// Get notices
exports.getNotices = async (req, res) => {
  const currentRole = req.user.role;
  try {
    const filter = {};

    // Filter by role
    if (['student', 'parent', 'teacher'].includes(currentRole)) {
      const audience = currentRole === 'parent' ? 'Parents' : currentRole === 'student' ? 'Students' : 'Teachers';
      filter.target_audience = { $in: ['All', audience] };
    } else if (['accountant', 'librarian', 'receptionist', 'hr', 'transport_manager', 'hostel_manager'].includes(currentRole)) {
      filter.target_audience = { $in: ['All', 'Staff'] };
    }

    const notices = await Notice.find(filter).populate('created_by', 'name').sort({ created_at: -1 });

    const formattedNotices = notices.map(n => ({
      id: n._id.toString(),
      title: n.title,
      content: n.description,
      target_audience: n.target_audience,
      created_by: n.created_by ? n.created_by._id.toString() : null,
      author_name: n.created_by ? n.created_by.name : 'Unknown',
      created_at: n.created_at
    }));

    res.json({ notices: formattedNotices });
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
    const newNotice = new Notice({
      title,
      description: content,
      target_audience: target_audience || 'All',
      created_by: req.user.id
    });
    await newNotice.save();
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
    await Notice.findByIdAndDelete(id);
    res.json({ message: 'Notice deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting notice' });
  }
};
