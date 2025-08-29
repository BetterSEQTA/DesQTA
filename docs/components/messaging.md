# Messaging System Components

This document covers the comprehensive messaging system in DesQTA, including both SEQTA messaging and the BetterSEQTA Cloud messaging platform (DireQt), providing students with multiple communication channels.

## 🏗 Messaging System Architecture

The messaging system consists of two distinct platforms with their own components:

### SEQTA Messaging Components
- **Sidebar** - Folder navigation and RSS feeds
- **MessageList** - Message listing and selection
- **Message** - Individual message display with rich content
- **ComposeModal** - Message composition interface

### BetterSEQTA Cloud Messaging (DireQt)
- **BetterSeqtaChat** - Main cloud messaging interface
- **Friend/Group Management** - Contact and group organization
- **Real-time Messaging** - Live chat functionality
- **File Attachments** - Media sharing capabilities

## 📧 SEQTA Messaging System

The SEQTA messaging system provides traditional email-style communication within the school's learning management system.

### Message Data Structure

```typescript
export interface Message {
  id: number;           // Unique message identifier
  folder: string;       // Folder location (Inbox, Sent, etc.)
  sender: string;       // Sender's display name
  to: string;          // Recipient's display name
  subject: string;     // Message subject line
  preview: string;     // Message preview text
  body: string;        // Full message content (HTML)
  date: string;        // Timestamp string
  unread: boolean;     // Read status
  starred?: boolean;   // Star/favorite status
}
```

### Main Page Component (`+page.svelte`)

The main messaging page orchestrates the entire SEQTA messaging experience:

#### Dual Platform Support
```typescript
let selectedTab = $state('SEQTA'); // 'SEQTA' or 'BetterSEQTA'
let seqtaMessagesEnabled = $state<boolean | null>(null);
let seqtaLoadFailed = $state(false);
```

#### Message Loading Logic
```typescript
async function fetchMessages(folderLabel: string = 'inbox', rssname: string = '') {
  loading = true;
  error = null;
  seqtaLoadFailed = false;
  
  try {
    if (folderLabel === 'sent') {
      // Fetch both sent and outbox, then combine
      const [sentRes, outboxRes] = await Promise.all([
        seqtaFetch('/seqta/student/load/message?', {
          method: 'POST',
          body: {
            searchValue: '',
            sortBy: 'date',
            sortOrder: 'desc',
            action: 'list',
            label: 'sent',
            offset: 0,
            limit: 100,
            datetimeUntil: null,
          },
        }),
        seqtaFetch('/seqta/student/load/message?', {
          method: 'POST',
          body: {
            searchValue: '',
            sortBy: 'date',
            sortOrder: 'desc',
            action: 'list',
            label: 'outbox',
            offset: 0,
            limit: 100,
            datetimeUntil: null,
          },
        }),
      ]);
      
      // Process and combine results
      const sentMsgs = (sentData?.payload?.messages || []).map((msg: any) => ({
        id: msg.id,
        folder: 'Sent',
        sender: msg.sender,
        to: msg.participants?.[0]?.name || '',
        subject: msg.subject,
        preview: msg.subject + (msg.attachments ? ' (Attachment)' : ''),
        body: '',
        date: msg.date?.replace('T', ' ').slice(0, 16) || '',
        unread: !msg.read,
      }));
    }
  } catch (e) {
    error = 'Failed to load messages.';
    messages = [];
    seqtaLoadFailed = true;
  } finally {
    loading = false;
  }
}
```

#### Message Content Loading with Caching
```typescript
async function openMessage(msg: Message) {
  selectedMessage = msg;
  msg.unread = false;

  // Check cache first
  const cacheKey = `message_${msg.id}`;
  const cachedContent = cache.get<string>(cacheKey);

  if (cachedContent) {
    msg.body = cachedContent;
    return;
  }

  detailLoading = true;
  detailError = null;
  try {
    const response = await seqtaFetch('/seqta/student/load/message?', {
      method: 'POST',
      body: {
        action: 'message',
        id: msg.id,
      },
    });
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    if (data?.payload?.contents) {
      msg.body = data.payload.contents;
      // Cache the message content for 24 hours
      cache.set(cacheKey, msg.body, 1440); // 24 hours TTL
    }
  } catch (e) {
    detailError = 'Failed to load message.';
    msg.body = '';
  } finally {
    detailLoading = false;
  }
}
```

## 📁 Sidebar Component

The Sidebar provides navigation between message folders and RSS feeds.

### Interface

```typescript
interface Props {
  selectedFolder: any;              // Currently selected folder
  openFolder: (folder: any) => void; // Folder selection callback
  openCompose: () => void;          // Compose modal opener
}

interface Feed {
  url: string;                      // RSS feed URL
}
```

### Dynamic Folder Loading

```typescript
async function loadFolders() {
  // Default folder definitions
  let folders = [
    { name: 'Inbox', icon: Inbox, id: 'inbox' },
    { name: 'Sent', icon: PaperAirplane, id: 'sent' },
    { name: 'Starred', icon: Star, id: 'starred' },
    { name: 'Trash', icon: Trash, id: 'trash' },
  ];
  
  // Load RSS feeds from settings
  const feeds = await invoke<{ feeds: Feed[]; }>('get_settings');
  
  for (let item of feeds.feeds) {
    let title = await getRSS(item.url);
    folders.push({
      name: `RSS: ${title.channel.title}`,
      icon: Rss,
      id: `rss-${item.url}`,
    });
  }
  
  return folders;
}
```

### Features
- **Default Folders**: Inbox, Sent, Starred, Trash
- **RSS Integration**: Dynamic RSS feed folders
- **Visual Indicators**: Icons for each folder type
- **Active State**: Highlights currently selected folder

## 📋 MessageList Component

Displays a scrollable list of messages with interactive selection.

### Interface

```typescript
interface Props {
  selectedFolder: string;           // Current folder name
  messages: Message[];              // Array of messages
  loading: boolean;                 // Loading state
  error: string | null;             // Error message
  selectedMessage: Message | null;  // Currently selected message
  openMessage: (msg: Message) => void; // Message selection callback
}
```

### Message Display Features

#### Smart Date Formatting
```typescript
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if date is today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Check if date is yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // Check if date is within this year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Otherwise return full date
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
```

#### Attachment Detection
```typescript
function hasAttachment(preview: string): boolean {
  return preview.includes('(Attachment)');
}
```

### Visual Design

#### Message Cards
- **Unread Indicators**: Blue dot and accent border for unread messages
- **Selection State**: Border highlighting for selected messages
- **Attachment Icons**: Paperclip icon for messages with attachments
- **Hover Effects**: Subtle scaling and color changes

#### Layout Structure
```svelte
<button class="message-card">
  <!-- Top row: sender and date -->
  <div class="flex justify-between items-center w-full">
    <div class="flex gap-2 items-center">
      <span class="sender-name">{msg.sender}</span>
      {#if msg.unread}
        <span class="unread-indicator"></span>
      {/if}
    </div>
    <span class="date-badge">{formatDate(msg.date)}</span>
  </div>

  <!-- Middle row: subject -->
  <div class="subject-line">
    <span class="line-clamp-1">{msg.subject}</span>
    {#if hasAttachment(msg.preview)}
      <AttachmentIcon />
    {/if}
  </div>

  <!-- Bottom row: to and preview -->
  <div class="preview-line">
    <span>To: {msg.to}</span>
    <span>•</span>
    <span class="preview-text">{msg.preview}</span>
  </div>
</button>
```

## 📄 Message Component

Displays individual message content with rich HTML rendering and interactive features.

### Interface

```typescript
interface Props {
  selectedMessage: Message | null;    // Message to display
  selectedFolder: string;             // Current folder context
  detailLoading: boolean;             // Content loading state
  detailError: string | null;         // Loading error
  openCompose: () => void;            // Compose callback
  starMessage: (msg: Message) => Promise<void>;      // Star toggle
  deleteMessage: (msg: Message) => Promise<void>;    // Delete action
  restoreMessage: (msg: Message) => Promise<void>;   // Restore action
  starring: boolean;                  // Star operation state
  deleting: boolean;                  // Delete operation state
  restoring: boolean;                 // Restore operation state
}
```

### Rich Content Rendering

#### Secure HTML Display
```typescript
import DOMPurify from 'dompurify';

// Configure DOMPurify for safe link handling
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function updateIframeContent() {
  if (!selectedMessage || !iframe || !iframe.contentWindow) return;

  const sanitizedContent = DOMPurify.sanitize(selectedMessage.body);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        color: #f1f5f9;
        margin: 0;
        padding: 0 1px;
        background-color: transparent;
        line-height: 1.8;
        font-size: 15px;
      }

      a {
        color: #60a5fa;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }
      
      p {
        margin: 0 0 1.2em;
      }

      .forward {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background-color: rgba(0, 0, 0, 0.05);
        padding: 8px;
        border-radius: 8px;
        margin: 0;
      }
      
      blockquote {
        border-left: 3px solid #3b82f6;
        margin-left: 0;
        padding-left: 12px;
        color: rgba(241, 245, 249, 0.8);
      }
    </style>
  </head>
  <body>${sanitizedContent}</body>
</html>`;

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(adjustIframeHeight, 100);
}
```

#### Dynamic Height Adjustment
```typescript
function adjustIframeHeight() {
  if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;

  const height = iframe.contentDocument.body.scrollHeight;
  iframe.style.height = `${height + 32}px`;
}
```

### Action Buttons
- **Reply**: Opens compose modal with recipient pre-filled
- **Star/Unstar**: Toggle message favorite status
- **Delete**: Move message to trash
- **Restore**: Restore from trash (when in trash folder)

## ✍️ ComposeModal Component

Modal interface for composing new messages with recipient selection and rich text editing.

### Interface

```typescript
interface Props {
  showComposeModal: boolean;        // Modal visibility
  composeSubject: string;           // Subject line
  composeBody: string;              // Message content
  closeModal: () => void;           // Close callback
}

type Student = {
  campus: string;
  firstname: string;
  house: string;
  house_colour: string;
  id: number;
  rollgroup: string;
  'sub-school': string;
  surname: string;
  xx_display: string;
  year: string;
};

type Teacher = {
  id: number;
  firstname: string;
  surname: string;
  xx_display: string;
};

type Participant = {
  staff: boolean;
  id: number;
  name: string;
};
```

### Recipient Management

#### Dynamic Loading
```typescript
async function loadRecipients() {
  try {
    loadingStudents = true;
    loadingStaff = true;

    const [studentsRes, staffRes] = await Promise.all([
      seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'student' },
      }),
      seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'staff' },
      }),
    ]);

    const studentsData = typeof studentsRes === 'string' ? JSON.parse(studentsRes) : studentsRes;
    const staffData = typeof staffRes === 'string' ? JSON.parse(staffRes) : staffRes;

    students = studentsData.payload || [];
    staff = staffData.payload || [];
  } catch (err) {
    errorMessage = 'Failed to load recipients. Please try again.';
  } finally {
    loadingStudents = false;
    loadingStaff = false;
  }
}
```

#### Search and Selection
```typescript
const filteredStudents = $derived(
  students
    .filter(
      (s) =>
        s.xx_display.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        `${s.firstname} ${s.surname}`.toLowerCase().includes(studentSearchQuery.toLowerCase()),
    )
    .slice(0, 20),
);

function addRecipient(id: number, name: string, isStaff: boolean) {
  if (!selectedRecipients.some((r) => r.id === id && r.staff === isStaff)) {
    selectedRecipients = [...selectedRecipients, { id, staff: isStaff, name }];
  }

  // Clear search and close dropdown
  if (isStaff) {
    staffSearchQuery = '';
    showStaffDropdown = false;
  } else {
    studentSearchQuery = '';
    showStudentDropdown = false;
  }
}
```

### Message Sending

```typescript
async function sendMessage() {
  if (!composeSubject.trim() || !composeBody.trim() || selectedRecipients.length === 0) {
    return;
  }

  try {
    isSubmitting = true;
    const participants = selectedRecipients.map(({ staff, id }) =>
      staff ? { staff: true, id } : { student: true, id },
    );

    const response = await seqtaFetch('/seqta/student/save/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        subject: composeSubject,
        contents: composeBody,
        participants: participants,
        blind: useBCC,
        files: [],
      },
    });

    const responseData = typeof response === 'string' ? JSON.parse(response) : response;

    if (responseData && responseData.status === '200') {
      // Clear form and close modal
      selectedRecipients = [];
      composeSubject = '';
      composeBody = '';
      closeModal();
    } else {
      errorMessage = 'Failed to send message. Please try again.';
    }
  } catch (err) {
    errorMessage = 'An error occurred while sending the message.';
  } finally {
    isSubmitting = false;
  }
}
```

## 💬 BetterSEQTA Cloud Messaging (DireQt)

The BetterSeqtaChat component provides real-time messaging capabilities through the BetterSEQTA Cloud platform.

### Data Structures

#### User and Authentication
```typescript
interface Friend {
  id: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface Group {
  id: string;
  name: string;
  iconUrl?: string | null;
  members?: GroupMember[];
}

interface GroupMember {
  id: string;
  displayName?: string;
}
```

#### Messages and Attachments
```typescript
interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  read: boolean;
  createdAt: string;
  replyToId?: string;
  replyTo?: MessageReply;
  attachmentId?: string;
  attachment?: Attachment;
  sender?: Friend;
  receiver?: Friend;
}

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
```

### Authentication and Setup

```typescript
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
```

### Friend and Group Management

#### Loading Contacts
```typescript
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
```

#### Group Creation
```typescript
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
    // Handle error appropriately
  } finally {
    creatingGroup = false;
  }
}
```

### Real-Time Messaging

#### Message Loading with Pagination
```typescript
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
```

#### Message Sending with Attachments
```typescript
async function sendMessage() {
  if (!newMessage.trim() || (!selectedFriend && !selectedGroup) || !token) return;
  
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
    
    const args: Record<string, any> = {
      token,
      content: newMessage.trim(),
      replyToId: replyTo ? replyTo.id : undefined,
      attachmentId: attachmentId,
    };
    
    if (selectedFriend) args.receiverId = selectedFriend.id;
    if (selectedGroup) args.groupId = selectedGroup.id;
    
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
      if (messageInput) {
        messageInput.focus();
      }
    }, 10);
  } catch (e) {
    sendError = e instanceof Error ? e.message : String(e) || 'Failed to send message';
  } finally {
    sending = false;
  }
}
```

### File Attachment System

#### File Upload Handling
```typescript
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

async function uploadAttachmentFile(file: File): Promise<Attachment | null> {
  try {
    uploadingAttachment = true;
    const attachment = await invoke<Attachment>('upload_attachment', {
      token,
      file_path: file.path, // Tauri file path
      filename: file.name,
    });
    return attachment;
  } catch (e) {
    console.error('Failed to upload attachment:', e);
    return null;
  } finally {
    uploadingAttachment = false;
  }
}
```

#### Message Display with Media
```svelte
{#if msg.attachment}
  <div class="mt-2">
    {#if msg.attachment.mimeType?.startsWith('image/')}
      <img 
        src="https://accounts.betterseqta.adenmgb.com/api/files/public/{msg.attachment.storedName}" 
        alt={msg.attachment.filename} 
        class="max-w-xs rounded-lg" 
      />
    {:else}
      <a 
        href="https://accounts.betterseqta.adenmgb.com/api/files/public/{msg.attachment.storedName}" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="text-xs text-blue-500 underline">
        📎 {msg.attachment.filename || 'Download Attachment'}
      </a>
    {/if}
  </div>
{/if}
```

### Reply System

```typescript
function handleReply(msg: Message) {
  replyTo = msg;
}

function cancelReply() {
  replyTo = null;
}
```

Reply messages show the original content in a quoted format:

```svelte
{#if msg.replyTo}
  <div class="mb-1 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
    Replying to: {msg.replyTo.content}
  </div>
{/if}
```

## 🎨 Visual Design & User Experience

### Consistent Design Language

#### Color Scheme
- **Accent Colors**: Dynamic accent colors from theme system
- **Status Indicators**: 
  - Blue: Unread messages and active states
  - Green: Online status and success states
  - Red: Error states and destructive actions
  - Gray: Neutral states and disabled elements

#### Glass Morphism Effects
```css
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

.bg-white/40 {
  background-color: rgb(255 255 255 / 0.4);
}

.dark:bg-slate-900/40 {
  background-color: rgb(15 23 42 / 0.4);
}
```

### Responsive Design

#### Mobile Optimizations
- **Tab Navigation**: Switches between SEQTA and Cloud messaging
- **Collapsible Sidebar**: Friends list collapses on mobile
- **Touch-Friendly**: Large touch targets and swipe gestures
- **Modal Overlays**: Full-screen message details on mobile

#### Desktop Layout
- **Three-Pane Layout**: Sidebar, message list, message detail
- **Keyboard Navigation**: Full keyboard support for power users
- **Multi-Selection**: Bulk message operations
- **Drag & Drop**: File attachment support

### Animation & Transitions

#### Message Animations
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
```

#### Interactive Elements
- **Hover Effects**: Subtle scaling and color changes
- **Loading States**: Smooth spinner animations
- **State Transitions**: 200ms duration for consistency

## 🔧 Integration & API

### SEQTA API Endpoints

#### Message Operations
```typescript
// List messages
POST /seqta/student/load/message
{
  "searchValue": "",
  "sortBy": "date",
  "sortOrder": "desc",
  "action": "list",
  "label": "inbox",
  "offset": 0,
  "limit": 100
}

// Get message content
POST /seqta/student/load/message
{
  "action": "message",
  "id": messageId
}

// Send message
POST /seqta/student/save/message
{
  "subject": "Subject",
  "contents": "Message body",
  "participants": [
    { "staff": true, "id": 123 },
    { "student": true, "id": 456 }
  ],
  "blind": false,
  "files": []
}
```

#### Recipient Loading
```typescript
// Load students
POST /seqta/student/load/message/people
{ "mode": "student" }

// Load staff
POST /seqta/student/load/message/people
{ "mode": "staff" }
```

### BetterSEQTA Cloud API (Rust Integration)

#### Authentication
```rust
invoke('get_cloud_user') -> { user: User, token: string }
```

#### Friend Management
```rust
invoke('get_friends', { token }) -> Friend[]
```

#### Group Operations
```rust
invoke('list_groups', { token }) -> Group[]
invoke('create_group', { token, name, member_ids }) -> Group
```

#### Messaging
```rust
invoke('get_messages', { token, id, page }) -> Message[]
invoke('send_message', { token, content, receiverId?, groupId?, replyToId?, attachmentId? }) -> Message
```

#### File Handling
```rust
invoke('upload_attachment', { token, file_path, filename }) -> Attachment
```

## 🔒 Security & Privacy

### Content Sanitization
- **DOMPurify**: Sanitizes all HTML content before display
- **Safe Links**: All external links open in new tabs with `rel="noopener noreferrer"`
- **XSS Prevention**: All user input is properly escaped

### Data Protection
- **Token Management**: Secure token storage and refresh
- **Cache Encryption**: Sensitive data encrypted in cache
- **Network Security**: All API calls use HTTPS

### Privacy Features
- **Message Encryption**: End-to-end encryption for cloud messages
- **Data Retention**: Configurable message retention policies
- **User Controls**: Granular privacy settings

## 🚀 Performance Optimization

### Caching Strategy
- **Message Content**: 24-hour cache for message bodies
- **Contact Lists**: Cache student/staff lists for session
- **Media Files**: Progressive loading for attachments

### Memory Management
- **Pagination**: Messages loaded in chunks of 25
- **Lazy Loading**: Images loaded on demand
- **Cleanup**: Proper event listener and interval cleanup

### Network Optimization
- **Batch Operations**: Multiple API calls combined where possible
- **Compression**: Gzip compression for large payloads
- **Retry Logic**: Automatic retry for failed requests

## 🔧 Best Practices

### Component Usage
```svelte
<!-- Always handle loading states -->
{#if loading}
  <LoadingSpinner />
{:else if error}
  <ErrorMessage {error} />
{:else}
  <MessageList {messages} />
{/if}

<!-- Provide proper event handlers -->
<MessageList 
  {messages} 
  {selectedMessage}
  onMessageSelect={handleMessageSelect}
/>
```

### Error Handling
```typescript
try {
  const response = await seqtaFetch('/api/messages');
  messages = JSON.parse(response).payload;
} catch (error) {
  console.error('Failed to load messages:', error);
  showError = true;
  errorMessage = 'Unable to load messages. Please try again.';
}
```

### Accessibility
- **ARIA Labels**: Descriptive labels for all interactive elements
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper semantic HTML structure
- **Focus Management**: Logical focus order

## 🚀 Future Enhancements

### Planned Features
- **Push Notifications**: Real-time message notifications
- **Voice Messages**: Audio message support
- **Message Search**: Full-text search across all messages
- **Message Threading**: Conversation threading
- **Emoji Reactions**: Message reactions and emoji support

### Performance Improvements
- **Virtual Scrolling**: For large message lists
- **WebSocket Integration**: Real-time message updates
- **Offline Support**: Message queue for offline sending
- **Background Sync**: Sync messages when app regains focus

---

**Related Documentation:**
- [Layout Components](./layout.md) - Modal and navigation integration
- [Frontend Architecture](../frontend/README.md) - Overall application structure
- [Theme System](../frontend/theme-system.md) - Styling and theming
- [Backend Architecture](../backend/README.md) - Rust/Tauri integration 