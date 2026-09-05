const mongoose = require('mongoose');

const itemSchema = mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['lost', 'found'],
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    contact: {
      type: String,
      required: true,
    },
    image: {
      type: String, // Optional image URL
    },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'approved', 'reunited'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
