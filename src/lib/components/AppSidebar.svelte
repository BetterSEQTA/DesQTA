<script lang="ts">
  import { page } from '$app/stores';
  import { Icon } from 'svelte-hero-icons';
  import { XMark } from 'svelte-hero-icons';

  interface MenuItem {
    label: string;
    icon: any;
    path: string;
  }

  interface Props {
    sidebarOpen: boolean;
    menu: MenuItem[];
    onMenuItemClick?: () => void;
  }

  let { sidebarOpen, menu, onMenuItemClick }: Props = $props();

  function handleMenuItemClick() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }

  function handleCloseSidebar() {
    if (onMenuItemClick) {
      onMenuItemClick();
    }
  }
</script>

<aside
  class="overflow-hidden transition-all duration-300 ease-in-out fixed sm:relative z-30"
  class:w-full={sidebarOpen}
  class:w-0={!sidebarOpen}
  class:sm:w-64={sidebarOpen}
  class:sm:w-0={!sidebarOpen}
  style="background: var(--background-color);">
  <nav class="p-3 py-[1px] space-y-2 w-full sm:w-64 sm:min-w-64 h-screen sm:h-auto relative">
    <!-- Mobile Close Button -->
    <div class="flex justify-end sm:hidden mb-4">
      <button
        onclick={handleCloseSidebar}
        class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        aria-label="Close sidebar"
      >
        <Icon src={XMark} class="w-5 h-5" />
      </button>
    </div>

    <!-- Mobile Header -->
    <div class="sm:hidden mb-6">
      <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Menu</h2>
      <div class="w-12 h-1 bg-accent-500 rounded-full"></div>
    </div>

    {#each menu as item}
      <a
        href={item.path}
        onclick={handleMenuItemClick}
        class="flex gap-4 items-center text-md px-3 py-3 font-medium rounded-xl transition-all duration-200 hover:bg-accent-100 hover:text-slate-900 dark:hover:bg-accent-600 dark:hover:text-white focus:outline-none {(
          item.path === '/'
            ? $page.url.pathname === '/'
            : $page.url.pathname.startsWith(item.path)
        )
          ? 'bg-accent text-white'
          : 'text-slate-900 dark:text-slate-300'} playful">
        <Icon
          src={item.icon}
          class="w-6 h-6 {(
            item.path === '/'
              ? $page.url.pathname === '/'
              : $page.url.pathname.startsWith(item.path)
          )
            ? 'text-white'
            : 'text-slate-600 dark:text-slate-400'}" />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>
</aside>