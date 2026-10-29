import api from './api.js';

export async function createGroup(details) {
  const response = await api.post('/groups', details);
  return response.data;
}

export async function joinGroup(token, displayName) {
  const response = await api.post('/groups/join', { token, displayName });
  return response.data;
}

export async function getGroup(groupId, { signal } = {}) {
  const response = await api.get(`/groups/${encodeURIComponent(groupId)}`, { signal });
  return response.data;
}

export async function updateReady(groupId, ready) {
  const response = await api.patch(`/groups/${encodeURIComponent(groupId)}/ready`, { ready });
  return response.data;
}

export async function rotateInvitation(groupId) {
  const response = await api.post(`/groups/${encodeURIComponent(groupId)}/invitation`);
  return response.data;
}

export async function revokeInvitation(groupId) {
  const response = await api.delete(`/groups/${encodeURIComponent(groupId)}/invitation`);
  return response.data;
}

export async function removeGroupMember(groupId, memberId) {
  const response = await api.delete(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
  );
  return response.data;
}

export async function submitGroupSwipe(groupId, hotelId, action) {
  const response = await api.post(`/groups/${encodeURIComponent(groupId)}/swipes`, {
    hotelId,
    action,
  });
  return response.data;
}

export async function getMyGroupSwipes(groupId, { signal } = {}) {
  const response = await api.get(`/groups/${encodeURIComponent(groupId)}/swipes/me`, { signal });
  return response.data;
}

export async function getGroupProgress(groupId, { signal } = {}) {
  const response = await api.get(`/groups/${encodeURIComponent(groupId)}/progress`, { signal });
  return response.data;
}

export async function getGroupMatches(groupId, { signal } = {}) {
  const response = await api.get(`/groups/${encodeURIComponent(groupId)}/matches`, { signal });
  return response.data;
}
