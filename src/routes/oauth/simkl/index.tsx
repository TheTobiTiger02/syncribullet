import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { server$, useNavigate } from '@builder.io/qwik-city';

import { preauthString } from '~/utils/auth/preauth';
import { SimklClientReceiver } from '~/utils/receivers/simkl/recevier-client';
import type { SimklPreAuth } from '~/utils/receivers/simkl/types/auth';

export const validateCode = server$(async function (
  code: string,
  client_id?: string,
) {
  if (!client_id) {
    client_id = this.env.get('PRIVATE_SIMKL_CLIENT_ID');
  }
  if (!client_id) {
    return;
  }
  try {
    const data = await fetch(
      `https://api.simkl.com/oauth/pin/${code}?client_id=${client_id}`,
    );
    return {
      ...(await data.json()),
      client_id,
    };
  } catch {
    return;
  }
});

export default component$(() => {
  const nav = useNavigate();
  const error = useSignal<string | null>(null);
  const status = useSignal<string>('Validating with SIMKL...');
  
  useVisibleTask$(async () => {
    try {
      const simklReceiver = new SimklClientReceiver();
      const preAuthId = preauthString(simklReceiver.receiverInfo.id);

      let parsedPreAuth: SimklPreAuth | null = null;
      try {
        const preAuth = window.localStorage.getItem(preAuthId);
        if (!preAuth) {
          throw new Error('No PreAuth for simkl. Please go back and try logging in again.');
        }
        parsedPreAuth = JSON.parse(preAuth);
      } catch (e) {
        console.error(e);
        error.value = 'No PreAuth data found. Please go back to /configure and try logging in again.';
        return;
      }

      if (!parsedPreAuth) {
        error.value = 'No PreAuth data found. Please go back to /configure and try logging in again.';
        return;
      }

      status.value = 'Exchanging code for access token...';
      
      let result = null;
      if (parsedPreAuth.client_id) {
        try {
          const response = await fetch(
            `https://api.simkl.com/oauth/pin/${parsedPreAuth.code}?client_id=${parsedPreAuth.client_id}`,
          );
          result = await response.json();
          console.log('SIMKL response:', result);
        } catch (e) {
          console.error(e);
          error.value = `Couldn't validate SIMKL pin. Client ID: ${parsedPreAuth.client_id}`;
          return;
        }
      } else {
        try {
          const response = await validateCode(parsedPreAuth.code);
          if (!response || response.error) {
            error.value = 'Failed to validate code with server. Response: ' + JSON.stringify(response);
            return;
          }
          result = response;
          parsedPreAuth.client_id = result.client_id;
        } catch (e) {
          console.error(e);
          error.value = `Couldn't validate SIMKL code. Please try again.`;
          return;
        }
      }

      if (!parsedPreAuth.client_id) {
        error.value = 'No Client ID found. Please make sure you entered a valid Client ID.';
        return;
      }

      if (!result) {
        error.value = 'No result from SIMKL API. Please try again.';
        return;
      }

      if (result.error) {
        error.value = `SIMKL API error: ${result.error}`;
        return;
      }

      if (!result.access_token) {
        error.value = 'No Access Token received from SIMKL. Response: ' + JSON.stringify(result);
        return;
      }

      status.value = 'Success! Saving credentials...';

      simklReceiver.mergeUserConfig({
        auth: {
          access_token: result.access_token,
          client_id: parsedPreAuth.client_id,
        },
      });

      window.localStorage.removeItem(preAuthId);
      
      status.value = 'Redirecting to configure page...';
      await nav('/configure');
    } catch (e) {
      console.error('Unexpected error:', e);
      error.value = `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
    }
  });
  
  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-background text-on-surface p-4">
      {error.value ? (
        <div class="flex flex-col items-center gap-4">
          <div class="text-red-500 text-xl">❌ Error</div>
          <div class="text-red-400 text-center max-w-md">{error.value}</div>
          <a 
            href="/configure" 
            class="mt-4 px-4 py-2 bg-primary/30 border border-outline rounded-full hover:bg-primary/50"
          >
            Go back to Configure
          </a>
        </div>
      ) : (
        <div class="flex flex-col items-center gap-4">
          <div class="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <div>{status.value}</div>
        </div>
      )}
    </div>
  );
});
