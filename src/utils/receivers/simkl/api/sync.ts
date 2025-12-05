import { axiosInstance } from '~/utils/axios/cache';
import type { IDs } from '~/utils/receiver/types/id';

import type { SimklUserSettings } from '../types/user-settings';
import { createSimklHeaders } from './headers';

export async function syncSimklMetaObject(
  ids: {
    ids: Partial<IDs>;
    count:
      | {
          season: number;
          episode: number;
        }
      | undefined;
  },
  userConfig: SimklUserSettings,
): Promise<void> {
  console.log('[SIMKL SYNC] Starting sync with ids:', JSON.stringify(ids));
  console.log('[SIMKL SYNC] Has auth:', !!userConfig.auth);
  
  if (!userConfig.auth) {
    console.error('[SIMKL SYNC] No auth token!');
    throw new Error('No user config! This should not happen!');
  }
  
  console.log('[SIMKL SYNC] Client ID present:', !!userConfig.auth.client_id);
  console.log('[SIMKL SYNC] Access token present:', !!userConfig.auth.access_token);
  
  let data: Record<string, any> = {
    title: undefined,
    ids: ids.ids,
  };

  if (ids.count) {
    data['seasons'] = [
      {
        number: ids.count.season,
        episodes: [
          {
            number: ids.count.episode,
          },
        ],
      },
    ];
    data = {
      shows: [data],
    };
  } else {
    data = {
      movies: [data],
    };
  }

  console.log('[SIMKL SYNC] Sending data:', JSON.stringify(data));

  try {
    const response = await axiosInstance(`https://api.simkl.com/sync/history`, {
      method: 'POST',
      headers: createSimklHeaders(userConfig.auth),
      data,
    });
    console.log('[SIMKL SYNC] Response:', JSON.stringify(response.data));
    return await response.data;
  } catch (e) {
    console.error('[SIMKL SYNC ERROR]', e);
    throw new Error('Failed to fetch data from Simkl API!');
  }
}
