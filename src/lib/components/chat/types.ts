export interface Friend {
  id: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

export interface GroupMember {
  id: string;
  displayName?: string;
}

export interface Group {
  id: string;
  name: string;
  iconUrl?: string | null;
  members?: GroupMember[];
}

export interface MessageReply {
  id: string;
  content: string;
}

export interface Attachment {
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

export interface Message {
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

// Helper function to get full profile picture URL
export function getFullPfpUrl(pfpUrl: string | null | undefined): string | null {
  if (!pfpUrl) return null;
  
  // If it's already a full URL, return as is
  if (pfpUrl.startsWith('http://') || pfpUrl.startsWith('https://')) {
    return pfpUrl;
  }
  
  // If it's a relative path, prepend the base domain
  if (pfpUrl.startsWith('/api/files/public/')) {
    return `https://accounts.betterseqta.adenmgb.com${pfpUrl}`;
  }
  
  // Fallback to DiceBear if it's not a recognized format
  return pfpUrl;
} 