const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const ClassSubject = require('../models/ClassSubject');
const Timetable = require('../models/Timetable');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

// Get all classes
exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().sort({ name: 1 });
    
    // For each class, fetch its sections and student count
    const classesWithDetails = await Promise.all(
      classes.map(async (cls) => {
        const sections = await Section.find({ class: cls._id });
        const studentCount = await Student.countDocuments({ class: cls._id, status: 'active' });
        
        return {
          id: cls._id.toString(),
          name: cls.name,
          created_at: cls.created_at,
          sections: sections.map(sec => ({
            id: sec._id.toString(),
            class_id: sec.class.toString(),
            name: sec.name,
            room_no: sec.room_no,
            capacity: sec.capacity
          })),
          studentCount
        };
      })
    );

    res.json({ classes: classesWithDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching classes' });
  }
};

// Create class
exports.createClass = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Class name is required' });
  try {
    const updatedClass = await Class.findOneAndUpdate(
      { name: name.trim() },
      { name: name.trim() },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Class created successfully', classId: updatedClass._id.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating class' });
  }
};

// Get sections
exports.getSections = async (req, res) => {
  const { classId } = req.query;
  try {
    const filter = {};
    if (classId) {
      filter.class = classId;
    }
    
    const sections = await Section.find(filter).populate('class', 'name');
    
    const formattedSections = sections.map(sec => ({
      id: sec._id.toString(),
      class_id: sec.class ? sec.class._id.toString() : null,
      class_name: sec.class ? sec.class.name : '',
      name: sec.name,
      room_no: sec.room_no,
      capacity: sec.capacity
    }));

    res.json({ sections: formattedSections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching sections' });
  }
};

// Create section
exports.createSection = async (req, res) => {
  const { class_id, name, room_no, capacity } = req.body;
  if (!class_id || !name) return res.status(400).json({ message: 'Class ID and Section Name are required' });
  try {
    const newSection = new Section({
      class: class_id,
      name,
      room_no,
      capacity: capacity || 30
    });
    await newSection.save();
    res.status(201).json({ message: 'Section created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating section' });
  }
};

// Get subjects
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    const formattedSubjects = subjects.map(sub => ({
      id: sub._id.toString(),
      name: sub.name,
      code: sub.code,
      type: sub.type
    }));
    res.json({ subjects: formattedSubjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching subjects' });
  }
};

// Create subject
exports.createSubject = async (req, res) => {
  const { name, code, type } = req.body;
  if (!name || !code) return res.status(400).json({ message: 'Subject Name and Code are required' });
  try {
    const newSubject = new Subject({
      name,
      code,
      type: type || 'Theory'
    });
    await newSubject.save();
    res.status(201).json({ message: 'Subject created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating subject' });
  }
};

// Get class subjects (mappings)
exports.getClassSubjects = async (req, res) => {
  const { classId, sectionId } = req.query;
  try {
    const filter = {};
    if (classId) filter.class = classId;
    if (sectionId) filter.section = sectionId;

    const classSubjects = await ClassSubject.find(filter)
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('subject')
      .populate({
        path: 'teacher',
        populate: { path: 'user', select: 'name' }
      });

    const formattedClassSubjects = classSubjects.map(cs => ({
      id: cs._id.toString(),
      class_id: cs.class ? cs.class._id.toString() : null,
      section_id: cs.section ? cs.section._id.toString() : null,
      subject_id: cs.subject ? cs.subject._id.toString() : null,
      class_name: cs.class ? cs.class.name : '',
      section_name: cs.section ? cs.section.name : '',
      subject_name: cs.subject ? cs.subject.name : '',
      subject_code: cs.subject ? cs.subject.code : '',
      subject_type: cs.subject ? cs.subject.type : '',
      teacher_id: cs.teacher ? cs.teacher._id.toString() : null,
      teacher_name: cs.teacher && cs.teacher.user ? cs.teacher.user.name : 'Unassigned'
    }));

    res.json({ classSubjects: formattedClassSubjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching class subjects' });
  }
};

// Assign subject and teacher to class/section
exports.assignSubjectTeacher = async (req, res) => {
  const { class_id, section_id, subject_id, teacher_id } = req.body;
  if (!class_id || !section_id || !subject_id) {
    return res.status(400).json({ message: 'Class, Section, and Subject are required' });
  }

  try {
    await ClassSubject.findOneAndUpdate(
      { class: class_id, section: section_id, subject: subject_id },
      { teacher: teacher_id || null },
      { upsert: true, new: true }
    );
    res.json({ message: 'Subject and Teacher assigned to class/section successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error assigning subject/teacher' });
  }
};

// Get Timetable slots
exports.getTimetable = async (req, res) => {
  const { classId, sectionId } = req.query;
  if (!classId || !sectionId) {
    return res.status(400).json({ message: 'Class ID and Section ID are required' });
  }
  try {
    const timetable = await Timetable.find({ class: classId, section: sectionId })
      .populate('subject')
      .populate({
        path: 'teacher',
        populate: { path: 'user', select: 'name' }
      })
      .sort({ start_time: 1 });

    const formattedTimetable = timetable.map(t => ({
      id: t._id.toString(),
      class_id: t.class.toString(),
      section_id: t.section.toString(),
      subject_id: t.subject ? t.subject._id.toString() : null,
      teacher_id: t.teacher ? t.teacher._id.toString() : null,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
      room_no: t.room_no || '',
      subject_name: t.subject ? t.subject.name : '',
      teacher_name: t.teacher && t.teacher.user ? t.teacher.user.name : 'Unassigned'
    }));

    res.json({ timetable: formattedTimetable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching timetable' });
  }
};

// Create Timetable Slot
exports.createTimetableSlot = async (req, res) => {
  const { class_id, section_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_no } = req.body;
  if (!class_id || !section_id || !subject_id || !teacher_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const newSlot = new Timetable({
      class: class_id,
      section: section_id,
      subject: subject_id,
      teacher: teacher_id,
      day_of_week,
      start_time,
      end_time,
      room_no: room_no || ''
    });
    await newSlot.save();
    res.status(201).json({ message: 'Timetable slot created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error scheduling slot: ' + err.message });
  }
};
