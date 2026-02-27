const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Lead name is required'],
  },
  source: {
    type: String,
    required: [true, 'Lead source is required'],
    enum: ['Website', 'Referral', 'Cold Call', 'Advertisement', 'Email', 'Other'],
  },
  salesAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesAgent',
    required: true,
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed'],
    default: 'New',
  },
  tags: [String],
  timeToClose: {
    type: Number,
    required: true,
    min: 1,
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium',
  },
  closedAt: Date,
}, { timestamps: true });


leadSchema.pre('save', function () {
 {
    this.closedAt = new Date();
  }
});

module.exports = mongoose.model('Lead', leadSchema);
