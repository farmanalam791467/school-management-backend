const Chat = require('../models/Chat');
const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const ClassSubject = require('../models/ClassSubject');

// Get chat contacts (users they can chat with)
exports.getContacts = async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;

  try {
    let contacts = [];

    if (currentRole === 'student') {
      // Students can chat with their teachers
      const student = await Student.findOne({ user: currentUserId });
      if (student) {
        const classSubjects = await ClassSubject.find({
          class: student.class,
          section: student.section
        }).populate({
          path: 'teacher',
          populate: { path: 'user', select: 'name email phone avatar role status' }
        });

        // Filter unique active teacher users
        const teacherUsersMap = {};
        classSubjects.forEach(cs => {
          if (cs.teacher && cs.teacher.user && cs.teacher.user.status === 'active') {
            teacherUsersMap[cs.teacher.user._id.toString()] = cs.teacher.user;
          }
        });
        contacts = Object.values(teacherUsersMap);
      }
    } else if (currentRole === 'parent') {
      // Parents can chat with their children's teachers
      const parent = await Parent.findOne({ user: currentUserId });
      if (parent) {
        const children = await Student.find({ parent: parent._id });
        const classIds = children.map(c => c.class);
        const sectionIds = children.map(c => c.section);

        const classSubjects = await ClassSubject.find({
          class: { $in: classIds },
          section: { $in: sectionIds }
        }).populate({
          path: 'teacher',
          populate: { path: 'user', select: 'name email phone avatar role status' }
        });

        const teacherUsersMap = {};
        classSubjects.forEach(cs => {
          if (cs.teacher && cs.teacher.user && cs.teacher.user.status === 'active') {
            teacherUsersMap[cs.teacher.user._id.toString()] = cs.teacher.user;
          }
        });
        contacts = Object.values(teacherUsersMap);
      }
    } else {
      // Staff, teachers, and admins can chat with any active user (except themselves)
      contacts = await User.find({
        _id: { $ne: currentUserId },
        status: 'active'
      }).select('name role email phone avatar status');
    }

    const formattedContacts = contacts.map(c => ({
      id: c._id.toString(),
      name: c.name,
      role: c.role,
      email: c.email || '',
      phone: c.phone || '',
      avatar: c.avatar || ''
    }));

    res.json({ contacts: formattedContacts });
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
    await Chat.updateMany(
      { sender: contactId, receiver: userId },
      { is_read: true }
    );

    // Fetch messages
    const messages = await Chat.find({
      $or: [
        { sender: userId, receiver: contactId },
        { sender: contactId, receiver: userId }
      ]
    }).sort({ created_at: 1 });

    const formattedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      sender_id: msg.sender.toString(),
      receiver_id: msg.receiver.toString(),
      message: msg.message,
      is_read: msg.is_read,
      created_at: msg.created_at
    }));

    res.json({ messages: formattedMessages });
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
    const newChat = new Chat({
      sender: sender_id,
      receiver: receiver_id,
      message,
      is_read: false
    });
    await newChat.save();

    res.status(201).json({
      message: 'Message sent successfully',
      chat: {
        id: newChat._id.toString(),
        sender_id,
        receiver_id,
        message,
        is_read: false,
        created_at: newChat.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error sending message' });
  }
};
