const storageKey = 'stayswipe.recent-group';
const groupIdPattern = /^[a-f\d]{24}$/i;

export function readRecentGroup(storage) {
  try {
    const target = storage ?? globalThis.sessionStorage;
    const value = target.getItem(storageKey);
    if (!value) return null;

    const group = JSON.parse(value);
    if (
      typeof group?.id !== 'string' ||
      !groupIdPattern.test(group.id) ||
      typeof group.name !== 'string'
    ) {
      target.removeItem(storageKey);
      return null;
    }

    return { id: group.id, name: group.name };
  } catch {
    return null;
  }
}

export function writeRecentGroup(group, storage) {
  if (
    typeof group?.id !== 'string' ||
    !groupIdPattern.test(group.id) ||
    typeof group.name !== 'string'
  ) {
    return false;
  }

  try {
    const target = storage ?? globalThis.sessionStorage;
    target.setItem(storageKey, JSON.stringify({ id: group.id, name: group.name }));
    return true;
  } catch {
    return false;
  }
}
