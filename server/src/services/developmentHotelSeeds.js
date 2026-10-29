const sampleSource = 'stayswipe_sample';
const sampleNotice = 'Fictional development sample; not a real hotel listing.';

export const developmentHotelRecords = Object.freeze([
  ['01', 'Bandra West', 19.0607, 72.8362, 'Mumbai'],
  ['02', 'Colaba', 18.9067, 72.8147, 'Mumbai'],
  ['03', 'Andheri West', 19.1364, 72.8277, 'Mumbai'],
  ['04', 'Powai', 19.1176, 72.906, 'Mumbai'],
  ['05', 'Juhu', 19.1075, 72.8263, 'Mumbai'],
  ['06', 'Fort', 18.9322, 72.8356, 'Mumbai'],
  ['07', 'Lower Parel', 19.0005, 72.8302, 'Mumbai'],
  ['08', 'Dadar', 19.0178, 72.8478, 'Mumbai'],
  ['09', 'Vashi', 19.0771, 72.9986, 'Navi Mumbai'],
  ['10', 'Nerul', 19.033, 73.0169, 'Navi Mumbai'],
  ['11', 'CBD Belapur', 19.0178, 73.0396, 'Navi Mumbai'],
  ['12', 'Kharghar', 19.0473, 73.0699, 'Navi Mumbai'],
  ['13', 'Airoli', 19.159, 72.9986, 'Navi Mumbai'],
  ['14', 'Sanpada', 19.0612, 73.0128, 'Navi Mumbai'],
  ['15', 'Seawoods', 19.0214, 73.0395, 'Navi Mumbai'],
  ['16', 'Kopar Khairane', 19.1036, 73.0093, 'Navi Mumbai'],
].map(([number, locality, latitude, longitude, city]) => ({
  name: `StaySwipe Demo Hotel ${number} (${locality})`,
  source: sampleSource,
  sourceId: `demo-hotel-${number}`,
  isSampleData: true,
  address: '',
  locality,
  city,
  region: 'Maharashtra',
  latitude,
  longitude,
  accommodationType: 'hotel',
  amenities: [],
  tags: { sampleNotice },
  imageUrls: [],
})));

export async function seedDevelopmentHotels(Hotel) {
  const operations = developmentHotelRecords.map(({ source, sourceId, ...record }) => ({
    updateOne: {
      filter: { source, sourceId },
      update: { $setOnInsert: { source, sourceId, ...record } },
      upsert: true,
    },
  }));
  const result = await Hotel.bulkWrite(operations, { ordered: true });

  return {
    records: operations.length,
    inserted: result.upsertedCount ?? 0,
    alreadyPresent: operations.length - (result.upsertedCount ?? 0),
  };
}
