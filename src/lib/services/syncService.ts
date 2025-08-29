import { queueAll, queueDelete } from './idb';
import { flushSettingsQueue } from './settingsSync';
import { seqtaFetch } from '../../utils/netUtil';

export async function flushMessageDrafts(): Promise<void> {
  const items = await queueAll();
  for (const item of items) {
    if (item.type !== 'message_draft') continue;
    try {
      const payload = item.payload || {};
      const participants = (payload.recipients || []).map((r: any) =>
        r.staff ? { staff: true, id: r.id } : { student: true, id: r.id }
      );
      const res = await seqtaFetch('/seqta/student/save/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          subject: payload.subject,
          contents: payload.contents,
          participants,
          blind: !!payload.blind,
          files: payload.files || [],
        }
      });
      const json = typeof res === 'string' ? JSON.parse(res) : res;
      if (json && (json.status === '200' || json.status === 200)) {
        await queueDelete(item.id!);
      } else {
        // Stop on first failure to avoid spin
        break;
      }
    } catch {
      // Network/offline. Stop and retry later
      break;
    }
  }
}

export async function flushAll(): Promise<void> {
  await flushSettingsQueue();
  await flushMessageDrafts();
}

// Auto-flush when connection is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushAll().catch(() => {});
  });
}


