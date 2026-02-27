const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesAgent',
    required: true,
  },
  commentText: {
    type: String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
