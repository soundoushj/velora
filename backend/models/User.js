const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { config } = require('../config');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // unique index: also protects against two simultaneous registrations
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_REGEX, 'Email is not valid'],
    },
    // select:false => the hash is NEVER loaded unless a query explicitly asks for it.
    passwordHash: { type: String, select: false, default: null },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Second safety net: even if a hash were loaded by mistake it is stripped from JSON output.
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.googleId;
        return ret;
      },
    },
  }
);

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);
userSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
