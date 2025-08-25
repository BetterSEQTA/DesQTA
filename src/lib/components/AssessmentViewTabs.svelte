<script lang="ts">
  import { Tabs } from '$lib/components/ui';
  import { ListBullet, Square3Stack3d, Calendar } from 'svelte-hero-icons';

  type ViewType = 'list' | 'board' | 'calendar';

  interface Props {
    selectedTab: ViewType;
    onTabChange: (tab: ViewType) => void;
  }

  let { selectedTab, onTabChange }: Props = $props();

  const tabs = [
    { id: 'list', label: 'List View', icon: ListBullet },
    { id: 'board', label: 'Board View', icon: Square3Stack3d },
    { id: 'calendar', label: 'Calendar View', icon: Calendar }
  ];
</script>

<Tabs
  {tabs}
  activeTab={selectedTab}
  variant="pills"
  onTabChange={(tabId) => onTabChange(tabId as ViewType)}
/> 