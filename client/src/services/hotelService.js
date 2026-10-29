import api from './api.js';

export async function getHotels(filters = {}, { signal } = {}) {
  const response = await api.get('/hotels', { params: filters, signal });
  return response.data;
}

export async function getHotel(hotelId, { signal } = {}) {
  const response = await api.get(`/hotels/${encodeURIComponent(hotelId)}`, { signal });
  return response.data;
}

export async function getHotelOffers(hotelId, params, { signal } = {}) {
  const response = await api.get(`/hotels/${encodeURIComponent(hotelId)}/offers`, {
    params,
    signal,
  });
  return response.data;
}
