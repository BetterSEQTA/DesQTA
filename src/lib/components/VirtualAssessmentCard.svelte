<script lang="ts">
  import AssessmentCard from './AssessmentCard.svelte';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    item: Assessment;
    index: number;
    showSubject?: boolean;
  }

  let { item: assessment, index, showSubject = false }: Props = $props();
</script>

<AssessmentCard {assessment} {showSubject} /> 