import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    source: {
      type: String,
      required: true,
      enum: ['openstreetmap', 'stayswipe_sample'],
      immutable: true,
    },
    sourceId: { type: String, required: true, trim: true, immutable: true },
    isSampleData: { type: Boolean, default: false },
    address: { type: String, trim: true, maxlength: 400, default: '' },
    locality: { type: String, trim: true, maxlength: 100, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    region: { type: String, trim: true, maxlength: 100, default: '' },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accommodationType: { type: String, required: true, trim: true, maxlength: 60 },
    amenities: { type: [String], default: [] },
    tags: { type: Map, of: String, default: {} },
    imageUrls: { type: [String], default: [] },
    providerHotelIds: {
      type: new mongoose.Schema(
        {
          amadeus: {
            type: String,
            trim: true,
            minlength: 8,
            maxlength: 8,
            match: /^[A-Z0-9]{8}$/,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, bufferCommands: false },
);

hotelSchema.index({ source: 1, sourceId: 1 }, { unique: true });
hotelSchema.index({ city: 1, region: 1, locality: 1, accommodationType: 1 });

const Hotel = mongoose.model('Hotel', hotelSchema);

export default Hotel;
