import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true },
    guestId: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    credentialHash: { type: String, required: true, select: false },
    joinedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    removedAt: { type: Date, default: null },
    ready: { type: Boolean, default: false },
    isCreator: { type: Boolean, default: false },
  },
  { _id: false },
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    creatorMemberId: { type: String, required: true },
    cities: { type: [String], required: true },
    localities: { type: [String], default: [] },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    budgetPerNight: { type: Number, required: true, min: 1, max: 10_000_000 },
    minimumRating: { type: Number, min: 1, max: 5, default: null },
    members: { type: [memberSchema], required: true },
    invitationTokenHash: { type: String, required: true, select: false },
    invitationStatus: { type: String, enum: ['active', 'revoked'], default: 'active' },
    invitationExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, bufferCommands: false },
);

groupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
groupSchema.index({ invitationTokenHash: 1 });
groupSchema.index({ 'members.credentialHash': 1 });

const Group = mongoose.model('Group', groupSchema);

export default Group;
