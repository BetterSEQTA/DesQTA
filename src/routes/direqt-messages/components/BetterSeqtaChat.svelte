<script lang="ts">
import { onMount } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { afterUpdate, tick } from 'svelte';
import ChatSidebar from '../../../lib/components/chat/ChatSidebar.svelte';
import CreateGroupModal from '../../../lib/components/chat/CreateGroupModal.svelte';
import ChatArea from '../../../lib/components/chat/ChatArea.svelte';
import type { Friend, Group, Message } from '../../../lib/components/chat/types.js';

interface Attachment {
  id?: string;
  filename?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  isPublic?: boolean;
  createdAt?: string;
  userId?: string;
  path?: string;
  updatedAt?: string;
}

let token: string | null = null;
let cloudUser: any = null;
let friends: Friend[] = [];
let friendsLoading = true;
let friendsError: string | null = null;
let selectedFriend: Friend | null = null;
let messages: Message[] = [];
let messagesLoading = false;
let messagesError: string | null = null;
let currentPage = 1;
let hasMoreMessages = true;
let loadingOlderMessages = false;
let newMessage = '';
let sending = false;

let groups: Group[] = [];
let groupsLoading = true;
let groupsError: string | null = null;
let selectedGroup: Group | null = null;
let creatingGroup = false;
let newGroupName = '';
let newGroupMembers: string[] = [];

let replyTo: Message | null = null;
let attachmentFile: File | null = null;
let attachmentPreview: string | null = null;
let uploadingAttachment = false;
let uploadedAttachment: Attachment | null = null;
let sendError: string | null = null;

async function fetchToken() {
  try {
    const res = await invoke<{ user: any, token: string }>('get_cloud_user');
    cloudUser = res.user;
    token = res?.token || null;
  } catch (e) {
    token = null;
    cloudUser = null;
  }
}

async function fetchFriends() {
  friendsLoading = true;
  friendsError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    friends = await invoke<Friend[]>('get_friends', { token });
  } catch (e) {
    friendsError = e instanceof Error ? e.message : String(e) || 'Failed to load friends.';
    friends = [];
  } finally {
    friendsLoading = false;
  }
}

async function fetchGroups() {
  groupsLoading = true;
  groupsError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    groups = await invoke<Group[]>('list_groups', { token });
  } catch (e) {
    groupsError = e instanceof Error ? e.message : String(e) || 'Failed to load groups.';
    groups = [];
  } finally {
    groupsLoading = false;
  }
}

async function createGroup() {
  if (!newGroupName.trim() || newGroupMembers.length === 0 || !token) return;
  creatingGroup = true;
  try {
    const group = await invoke<Group>('create_group', {
      token,
      name: newGroupName.trim(),
      member_ids: newGroupMembers,
    });
    groups = [...groups, group];
    selectedGroup = group;
    newGroupName = '';
    newGroupMembers = [];
  } catch (e) {
    // Optionally show error
  } finally {
    creatingGroup = false;
  }
}

async function uploadAttachmentFile(file: File): Promise<Attachment | null> {
  if (!token) return null;
  uploadingAttachment = true;
  try {
    // Create a temporary file path for the upload
    const tempPath = `${file.name}`;
    
    // Convert file to array buffer and save temporarily
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Use Tauri's file system API to write the file temporarily
    await invoke('write_temp_file', { 
      fileName: tempPath, 
      data: Array.from(uint8Array) 
    });
    
    // Upload the file
    const attachment = await invoke<Attachment>('upload_attachment', { 
      token, 
      filePath: tempPath 
    });
    
    // Clean up temporary file
    await invoke('delete_temp_file', { fileName: tempPath });
    
    return attachment;
  } catch (error) {
    console.error('File upload failed:', error);
    return null;
  } finally {
    uploadingAttachment = false;
  }
}

async function sendMessage() {
  if (!newMessage.trim() || (!selectedFriend && !selectedGroup) || !token) return;
  // Extra guard: if both are null, do not proceed
  if (!selectedFriend && !selectedGroup) {
    return;
  }
  sending = true;
  sendError = null;
  try {
    let attachmentId: string | undefined = undefined;
    if (attachmentFile) {
      const uploaded = await uploadAttachmentFile(attachmentFile);
      if (uploaded) {
        uploadedAttachment = uploaded;
        attachmentId = uploaded.id;
      }
    }
    // Only include receiver_id or group_id as required
    const args: Record<string, any> = {
      token,
      content: newMessage.trim(),
      replyToId: replyTo ? replyTo.id : undefined,
      attachmentId: attachmentId,
    };
    if (selectedFriend) args.receiverId = selectedFriend.id;
    if (selectedGroup) args.groupId = selectedGroup.id;
    // Do not send if neither is set
    if (!args.receiverId && !args.groupId) throw new Error('No recipient selected');
    const msg = await invoke<Message>('send_message', args);
    messages = [...messages, msg];
    newMessage = '';
    replyTo = null;
    attachmentFile = null;
    attachmentPreview = null;
    uploadedAttachment = null;
    
    // Refocus the input after all DOM updates are complete
    await tick();
    setTimeout(() => {
      // The input is now managed by ChatArea, so we don't need to focus it here.
      // If ChatArea needs to focus, it should handle it internally.
    }, 10);
  } catch (e) {
    sendError = e instanceof Error ? e.message : String(e) || 'Failed to send message';
    console.error('Failed to send message:', e);
  } finally {
    sending = false;
  }
}

function selectFriend(friend: Friend) {
  selectedFriend = friend;
  selectedGroup = null;
  fetchMessagesForFriend(friend);
}

async function fetchMessagesForFriend(friend: Friend, page: number = 1) {
  if (page === 1) {
  messagesLoading = true;
    currentPage = 1;
    hasMoreMessages = true;
  } else {
    loadingOlderMessages = true;
  }
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    const newMessages = await invoke<Message[]>('get_messages', { token, id: friend.id, page });
    if (page === 1) {
      messages = newMessages;
    } else {
      // Prepend older messages to the beginning of the array
      messages = [...newMessages, ...messages];
    }
    // If we got fewer than 25 messages (default page size), we've reached the end
    hasMoreMessages = newMessages.length >= 25;
    if (page > 1) {
      currentPage = page;
    }
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    if (page === 1) {
    messages = [];
    }
  } finally {
    if (page === 1) {
    messagesLoading = false;
    } else {
      loadingOlderMessages = false;
    }
  }
}

function selectGroup(group: Group) {
  selectedGroup = group;
  selectedFriend = null;
  fetchMessagesForGroup(group);
}

async function fetchMessagesForGroup(group: Group, page: number = 1) {
  if (page === 1) {
  messagesLoading = true;
    currentPage = 1;
    hasMoreMessages = true;
  } else {
    loadingOlderMessages = true;
  }
  messagesError = null;
  try {
    if (!token) await fetchToken();
    if (!token) throw new Error('Not logged in to BetterSEQTA Cloud.');
    const newMessages = await invoke<Message[]>('get_messages', { token, id: group.id, page });
    if (page === 1) {
      messages = newMessages;
    } else {
      // Prepend older messages to the beginning of the array
      messages = [...newMessages, ...messages];
    }
    // If we got fewer than 25 messages (default page size), we've reached the end
    hasMoreMessages = newMessages.length >= 25;
    if (page > 1) {
      currentPage = page;
    }
  } catch (e) {
    messagesError = e instanceof Error ? e.message : String(e) || 'Failed to load messages.';
    if (page === 1) {
    messages = [];
    }
  } finally {
    if (page === 1) {
    messagesLoading = false;
    } else {
      loadingOlderMessages = false;
    }
  }
}

function loadOlderMessages() {
  if (loadingOlderMessages || !hasMoreMessages) return;
  const nextPage = currentPage + 1;
  if (selectedFriend) {
    fetchMessagesForFriend(selectedFriend, nextPage);
  } else if (selectedGroup) {
    fetchMessagesForGroup(selectedGroup, nextPage);
  }
}

function handleReply(msg: Message) {
  replyTo = msg;
}

function cancelReply() {
  replyTo = null;
}

function handleAttachmentChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) {
    attachmentFile = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      attachmentPreview = ev.target?.result as string;
    };
    reader.readAsDataURL(files[0]);
  }
}

function removeAttachment() {
  attachmentFile = null;
  attachmentPreview = null;
}

onMount(() => {
  fetchToken().then(() => {
    fetchFriends();
    fetchGroups();
  });
});

afterUpdate(() => {
  // The input is now managed by ChatArea, so we don't need to focus it here.
  // If ChatArea needs to focus, it should handle it internally.
});
</script>

<div class="flex h-full w-full">
  <ChatSidebar 
    {cloudUser}
    {friends}
    {friendsLoading}
    {friendsError}
    {groups}
    {groupsLoading}
    {groupsError}
    {selectedFriend}
    {selectedGroup}
    {creatingGroup}
    onSelectFriend={selectFriend}
    onSelectGroup={selectGroup}
    onCreateGroup={() => creatingGroup = true}
  />

  <ChatArea 
    {selectedFriend}
    {selectedGroup}
    {cloudUser}
    {messages}
    {messagesLoading}
    {messagesError}
    {hasMoreMessages}
    {loadingOlderMessages}
    {newMessage}
    {sending}
    {uploadingAttachment}
    {replyTo}
    {attachmentFile}
    {attachmentPreview}
    {sendError}
    onLoadOlderMessages={loadOlderMessages}
    onSendMessage={sendMessage}
    onReply={handleReply}
    onCancelReply={cancelReply}
    onAttachmentChange={handleAttachmentChange}
    onRemoveAttachment={removeAttachment}
  />

  <CreateGroupModal 
    open={creatingGroup}
    {friends}
    {newGroupName}
    {newGroupMembers}
    {creatingGroup}
    onCreateGroup={createGroup}
    onClose={() => creatingGroup = false}
  />
</div>
