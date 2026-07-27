const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const { authorize } = require('../middleware/auth');

router.get('/books', libraryController.getBooks);
router.post('/books', authorize(['super_admin', 'school_admin', 'librarian']), libraryController.createBook);
router.post('/issue', authorize(['super_admin', 'school_admin', 'librarian']), libraryController.issueBook);
router.post('/return', authorize(['super_admin', 'school_admin', 'librarian']), libraryController.returnBook);
router.get('/issues', authorize(['super_admin', 'school_admin', 'librarian', 'student', 'teacher']), libraryController.getIssues);

module.exports = router;
