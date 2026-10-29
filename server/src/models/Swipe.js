import mongoose from 'mongoose';

const swipeSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    memberId: { type: String, required: true },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
    },
    action: { type: String, required: true, enum: ['like', 'reject'] },
  },
  { timestamps: true, bufferCommands: false },
);

swipeSchema.index({ groupId: 1, memberId: 1, hotelId: 1 }, { unique: true });

const Swipe = mongoose.model('Swipe', swipeSchema);

export default Swipe;
