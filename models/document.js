// models/document.js

const mongoose = require('mongoose');

const documentScheme = new mongoose.Schema({
  longURL:{
    type: String,
  },
  value: {
    type: String,
    required: true,
  },
  expiryTimestamp: {
    type: Date,
    default: null,
  },
  shortID: {
    type: String,
    default: () => Math.random().toString(36).substr(2, 6), // Generate a random short ID
  },
  shortURL: String,
  mainURLAccessCount: {
    type: Number,
    default: -1,
  },
  customAlias:String,
});

module.exports = mongoose.model('document', documentScheme, 'objects');
