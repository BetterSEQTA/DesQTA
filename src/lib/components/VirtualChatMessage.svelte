<script lang="ts">
  import ChatMessage from './chat/ChatMessage.svelte';
  import type { Message } from './chat/types';

  interface Props {
    item: Message;
    index: number;
    isOwnMessage: boolean;
    showSenderName: boolean;
    onReply: (message: Message) => void;
  }

  let { item: message, index, isOwnMessage, showSenderName, onReply }: Props = $props();
</script>

<ChatMessage 
  {message}
  {isOwnMessage}
  {showSenderName}
  {onReply}
/> 