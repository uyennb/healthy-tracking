import { DailyLog, UserProfile } from '../types/health';

const REST_ENDPOINT = 'https://api.restful-api.dev/objects';

export interface CloudSyncPayload {
  logs: DailyLog[];
  profile: UserProfile;
  updatedAt: string;
}

// Timeout helper using AbortController (5 seconds max)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Kết nối quá thời gian quy định (Timeout 5s)');
    }
    throw error;
  }
}

/**
 * Format a long REST ID into a user-friendly 8-character display code (e.g. A97D-8273)
 */
export function formatDisplayCode(id: string): string {
  if (!id) return '';
  const cleaned = id.replace(/[^a-zA-Z0-9]/g, '');
  if (cleaned.length >= 8) {
    const sub = cleaned.slice(-8).toUpperCase();
    return `${sub.slice(0, 4)}-${sub.slice(4)}`;
  }
  return id.toUpperCase();
}

/**
 * Create a new Cloud Sync Object on REST API
 */
export async function createCloudSyncObject(logs: DailyLog[], profile: UserProfile): Promise<{ id: string; displayCode: string } | null> {
  try {
    const res = await fetchWithTimeout(REST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'NutriFit_Sync_V1',
        data: {
          logs,
          profile,
          updatedAt: new Date().toISOString(),
        },
      }),
    }, 6000);

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.id) {
      return {
        id: json.id,
        displayCode: formatDisplayCode(json.id),
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to create Cloud Sync Object:', error);
    return null;
  }
}

/**
 * Push local data to Cloud REST endpoint
 */
export async function pushDataToCloud(
  cloudId: string,
  logs: DailyLog[],
  profile: UserProfile
): Promise<boolean> {
  if (!cloudId) return false;

  try {
    const res = await fetchWithTimeout(`${REST_ENDPOINT}/${cloudId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'NutriFit_Sync_V1',
        data: {
          logs,
          profile,
          updatedAt: new Date().toISOString(),
        },
      }),
    }, 6000);

    return res.ok;
  } catch (error) {
    console.error('Failed to push data to Cloud:', error);
    return false;
  }
}

/**
 * Fetch remote data from Cloud REST endpoint
 */
export async function fetchCloudData(cloudId: string): Promise<CloudSyncPayload | null> {
  if (!cloudId) return null;

  try {
    const res = await fetchWithTimeout(`${REST_ENDPOINT}/${cloudId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, 6000);

    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data && Array.isArray(json.data.logs)) {
      return json.data as CloudSyncPayload;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch Cloud data:', error);
    return null;
  }
}

/**
 * Subscribe to Cloud changes via polling every 4s
 */
export function subscribeToCloudSync(
  cloudId: string,
  onUpdate: (data: CloudSyncPayload) => void,
  pollIntervalMs = 4000
): () => void {
  if (!cloudId) return () => {};

  let lastUpdatedAt = '';

  const checkRemote = async () => {
    try {
      const data = await fetchCloudData(cloudId);
      if (data && data.updatedAt && data.updatedAt !== lastUpdatedAt) {
        lastUpdatedAt = data.updatedAt;
        onUpdate(data);
      }
    } catch {
      // Ignore intermittent polling errors silently
    }
  };

  // Immediate check
  checkRemote();

  const intervalId = setInterval(checkRemote, pollIntervalMs);
  return () => clearInterval(intervalId);
}
