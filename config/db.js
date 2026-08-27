const mongoose = require('mongoose');
require('dotenv').config();

// Enable Mongoose debugging in development
if (process.env.NODE_ENV !== 'production') {
  mongoose.set('debug', true);
}

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eskooly_clone';

console.log(`Connecting to MongoDB at: ${mongoURI.replace(/:([^@]+)@/, ':****@')}`);

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✔ Connected to MongoDB.');
  })
  .catch(err => {
    console.error('❌ Error connecting to MongoDB:');
    console.error(err);
  });

module.exports = mongoose;
