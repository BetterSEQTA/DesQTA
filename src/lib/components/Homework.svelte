<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Card, AsyncWrapper } from '$lib/components/ui';

  interface HomeworkItem {
    meta: number;
    id: number;
    title: string;
    items: string[];
  }

  interface HomeworkResponse {
    payload: HomeworkItem[];
    status: string;
  }

  let homeworkData = $state<HomeworkResponse | null>(null);
  let homeworkError = $state<string | null>(null);
  let loadingHomework = $state(true);

  async function fetchHomeworkData() {
    try {
      loadingHomework = true;
      homeworkError = null;
      const response = await seqtaFetch('/seqta/student/dashlet/summary/homework', {
        method: 'POST',
        body: {},
        params: { majhvjju: '' },
      });
      homeworkData = JSON.parse(response);
    } catch (e: any) {
      console.error('Error details:', e);
      homeworkError = e.toString();
    } finally {
      loadingHomework = false;
    }
  }

  onMount(async () => {
    await fetchHomeworkData();
  });
</script>

<Card variant="elevated" padding="none">
  {#snippet header()}
    <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Homework</h3>
  {/snippet}

  <div class="p-6">
    <AsyncWrapper
      loading={loadingHomework}
      error={homeworkError}
      data={homeworkData?.payload}
      empty={!homeworkData?.payload || homeworkData.payload.length === 0}
      emptyTitle="No homework found"
      emptyMessage="You're all caught up!"
      emptyIcon="📚"
      componentName="Homework"
    >
      {#snippet children(homeworkItems)}
        <div class="flex flex-col gap-6">
          {#each homeworkItems as homework}
            <Card 
              variant="outlined" 
              padding="md"
              class="border-l-8 shadow-lg border-l-accent-500"
            >
              <h3 class="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                {homework.title}
              </h3>
              <div class="flex flex-col gap-3">
                {#each homework.items as item}
                  <div class="flex gap-2 items-start px-4 py-3 rounded-lg border backdrop-blur-sm border-slate-300 bg-slate-200/80 dark:bg-slate-700/50 dark:border-slate-600">
                    <span class="mt-1 text-xl accent-text">•</span>
                    <span class="text-slate-800 dark:text-slate-50">{item}</span>
                  </div>
                {/each}
              </div>
            </Card>
          {/each}
        </div>
      {/snippet}
    </AsyncWrapper>
  </div>
</Card> 