<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { CloudUser } from '$lib/services/cloudAuthService';
  import { resolveCloudPfp } from '$lib/services/cloudPfpCache';
  import { getFullPfpUrl } from '$lib/services/cloudPfpUtils';

  interface Props {
    user: CloudUser | null | undefined;
    alt?: string;
    class?: string;
    fallbackSeed?: string;
  }

  let { user, alt = '', class: className = '', fallbackSeed }: Props = $props();

  let avatarSrc = $state<string | null>(null);
  let revokeOnCleanup = $state(false);
  let loading = $state(false);

  const fallbackUrl = $derived(
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${fallbackSeed ?? user?.id ?? 'user'}`,
  );

  async function loadAvatar(currentUser: CloudUser | null | undefined) {
    if (avatarSrc && revokeOnCleanup) {
      URL.revokeObjectURL(avatarSrc);
    }
    avatarSrc = null;
    revokeOnCleanup = false;

    if (!currentUser?.id || !currentUser.pfpUrl) return;

    loading = true;
    try {
      const resolved = await resolveCloudPfp(
        currentUser.id,
        currentUser.pfpUrl,
        currentUser.pfpHash ?? null,
      );
      if (resolved) {
        avatarSrc = resolved.src;
        revokeOnCleanup = resolved.fromCache;
        return;
      }

      avatarSrc = getFullPfpUrl(currentUser.pfpUrl);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void loadAvatar(user);
  });

  onDestroy(() => {
    if (avatarSrc && revokeOnCleanup) {
      URL.revokeObjectURL(avatarSrc);
    }
  });
</script>

{#if avatarSrc}
  <img src={avatarSrc} {alt} class={className} />
{:else if loading}
  <div
    class="{className} animate-pulse bg-zinc-300 dark:bg-zinc-700"
    aria-hidden="true">
  </div>
{:else}
  <img src={fallbackUrl} {alt} class={className} />
{/if}
