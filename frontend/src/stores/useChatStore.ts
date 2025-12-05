'use client';
import { ChatRoom, Message } from '@/interfaces/allInterface';
import { create } from 'zustand';

interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  page: number;
}

interface ChatStore {
  // Messages by roomId - using pages for pagination
  messages: Record<string, MessagePage[]>;
  
  // Chats list
  chats: ChatRoom[];
  chatsHasMore: boolean;
  chatsPage: number;
  
  // Typing indicators by roomId
  typingUsers: Record<string, Set<string>>;
  
  // Loading states
  loadingMessages: Record<string, boolean>;
  loadingChats: boolean;
  
  // Actions - Messages
  addMessage: (roomId: string, message: Message) => void;
  addMessages: (roomId: string, messages: Message[], page?: number, hasMore?: boolean) => void;
  prependMessages: (roomId: string, messages: Message[], hasMore?: boolean) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void;
  markMessagesAsRead: (roomId: string, userId: string) => void;
  setLoadingMessages: (roomId: string, loading: boolean) => void;
  
  // Actions - Chats
  setChats: (chats: ChatRoom[], hasMore: boolean, page: number) => void;
  addChats: (chats: ChatRoom[], hasMore: boolean, page: number) => void;
  updateChat: (chatId: string, updates: Partial<ChatRoom>) => void;
  updateChatLastMessage: (chatId: string, message: Message) => void;
  updateChatUnreadCount: (chatId: string, unreadCount: number) => void;
  setLoadingChats: (loading: boolean) => void;
  
  // Actions - Typing
  setTyping: (roomId: string, userId: string, isTyping: boolean) => void;
  clearTyping: (roomId: string, userId: string) => void;
  
  // Actions - Reset
  resetRoom: (roomId: string) => void;
  reset: () => void;
  
  // Getters
  getMessages: (roomId: string) => Message[];
  getChat: (chatId: string) => ChatRoom | undefined;
  isTyping: (roomId: string, userId: string) => boolean;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  messages: {},
  chats: [],
  chatsHasMore: false,
  chatsPage: 1,
  typingUsers: {},
  loadingMessages: {},
  loadingChats: false,

  // Messages Actions
  addMessage: (roomId, message) => {
    set((state) => {
      const existingPages = state.messages[roomId] || [];
      
      // Check if message already exists
      const messageExists = existingPages.some((page) =>
        page.messages.some((m) => m._id === message._id)
      );
      
      if (messageExists) return state;

      // If no pages exist, create first page
      if (existingPages.length === 0) {
        return {
          messages: {
            ...state.messages,
            [roomId]: [
              {
                messages: [message],
                hasMore: false,
                page: 1,
              },
            ],
          },
        };
      }

      // Add to first page (most recent messages)
      const updatedPages = existingPages.map((page, index) => {
        if (index === 0) {
          // Check if message already in this page
          const inPage = page.messages.some((m) => m._id === message._id);
          if (inPage) return page;
          
          return {
            ...page,
            messages: [message, ...page.messages],
          };
        }
        return page;
      });

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedPages,
        },
      };
    });
  },

  addMessages: (roomId, messages, page = 1, hasMore = false) => {
    set((state) => {
      const existingPages = state.messages[roomId] || [];
      
      // Filter out duplicates
      const existingIds = new Set(
        existingPages.flatMap((p) => p.messages.map((m) => m._id))
      );
      const newMessages = messages.filter((m) => !existingIds.has(m._id));

      if (newMessages.length === 0) return state;

      // Check if page already exists
      const pageExists = existingPages.some((p) => p.page === page);
      
      if (pageExists) {
        // Update existing page
        const updatedPages = existingPages.map((p) => {
          if (p.page === page) {
            // Merge messages, avoiding duplicates
            const mergedMessages = [...p.messages];
            newMessages.forEach((msg) => {
              if (!mergedMessages.some((m) => m._id === msg._id)) {
                mergedMessages.push(msg);
              }
            });
            return {
              ...p,
              messages: mergedMessages,
              hasMore,
            };
          }
          return p;
        });
        return {
          messages: {
            ...state.messages,
            [roomId]: updatedPages,
          },
        };
      }

      // Add new page
      const newPage: MessagePage = {
        messages: newMessages,
        hasMore,
        page,
      };

      // Sort pages by page number (ascending - page 1 is most recent)
      const allPages = [...existingPages, newPage].sort((a, b) => a.page - b.page);

      return {
        messages: {
          ...state.messages,
          [roomId]: allPages,
        },
      };
    });
  },

  prependMessages: (roomId, messages, hasMore = false) => {
    set((state) => {
      const existingPages = state.messages[roomId] || [];
      
      // Filter out duplicates
      const existingIds = new Set(
        existingPages.flatMap((p) => p.messages.map((m) => m._id))
      );
      const newMessages = messages.filter((m) => !existingIds.has(m._id));

      if (newMessages.length === 0) return state;

      if (existingPages.length === 0) {
        return {
          messages: {
            ...state.messages,
            [roomId]: [
              {
                messages: newMessages,
                hasMore,
                page: 1,
              },
            ],
          },
        };
      }

      // Prepend to first page
      const updatedPages = existingPages.map((page, index) => {
        if (index === 0) {
          return {
            ...page,
            messages: [...newMessages, ...page.messages],
            hasMore,
          };
        }
        return page;
      });

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedPages,
        },
      };
    });
  },

  updateMessage: (roomId, messageId, updates) => {
    set((state) => {
      const pages = state.messages[roomId];
      if (!pages) return state;

      const updatedPages = pages.map((page) => ({
        ...page,
        messages: page.messages.map((msg) =>
          msg._id === messageId ? { ...msg, ...updates } : msg
        ),
      }));

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedPages,
        },
      };
    });
  },

  markMessagesAsRead: (roomId, userId) => {
    set((state) => {
      const pages = state.messages[roomId];
      if (!pages) return state;

      const updatedPages = pages.map((page) => ({
        ...page,
        messages: page.messages.map((msg) => {
          // If current user joined, mark all as read
          // If other user read, mark only messages sent by current user as read
          // For now, we'll mark all as read when this is called
          return { ...msg, isRead: true };
        }),
      }));

      // Also update chat unread count
      const updatedChats = state.chats.map((chat) =>
        chat._id === roomId ? { ...chat, unreadCount: 0 } : chat
      );

      return {
        messages: {
          ...state.messages,
          [roomId]: updatedPages,
        },
        chats: updatedChats,
      };
    });
  },

  setLoadingMessages: (roomId, loading) => {
    set((state) => ({
      loadingMessages: {
        ...state.loadingMessages,
        [roomId]: loading,
      },
    }));
  },

  // Chats Actions
  setChats: (chats, hasMore, page) => {
    set({
      chats,
      chatsHasMore: hasMore,
      chatsPage: page,
    });
  },

  addChats: (newChats, hasMore, page) => {
    set((state) => {
      // Merge chats, avoiding duplicates
      const existingIds = new Set(state.chats.map((c) => c._id));
      const uniqueNewChats = newChats.filter((c) => !existingIds.has(c._id));

      return {
        chats: [...state.chats, ...uniqueNewChats],
        chatsHasMore: hasMore,
        chatsPage: page,
      };
    });
  },

  updateChat: (chatId, updates) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat._id === chatId ? { ...chat, ...updates } : chat
      ),
    }));
  },

  updateChatLastMessage: (chatId, message) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat._id === chatId
          ? {
              ...chat,
              messages: [message], // Keep only the most recent message
            }
          : chat
      ),
    }));
  },

  updateChatUnreadCount: (chatId, unreadCount) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat._id === chatId ? { ...chat, unreadCount } : chat
      ),
    }));
  },

  setLoadingChats: (loading) => {
    set({ loadingChats: loading });
  },

  // Typing Actions
  setTyping: (roomId, userId, isTyping) => {
    set((state) => {
      const typingSet = state.typingUsers[roomId] || new Set<string>();
      
      if (isTyping) {
        typingSet.add(userId);
      } else {
        typingSet.delete(userId);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: typingSet,
        },
      };
    });
  },

  clearTyping: (roomId, userId) => {
    set((state) => {
      const typingSet = state.typingUsers[roomId];
      if (!typingSet) return state;

      const newSet = new Set(typingSet);
      newSet.delete(userId);

      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: newSet,
        },
      };
    });
  },

  // Reset Actions
  resetRoom: (roomId) => {
    set((state) => {
      const { [roomId]: _, ...remainingMessages } = state.messages;
      const { [roomId]: __, ...remainingTyping } = state.typingUsers;
      return {
        messages: remainingMessages,
        typingUsers: remainingTyping,
      };
    });
  },

  reset: () => {
    set({
      messages: {},
      chats: [],
      chatsHasMore: false,
      chatsPage: 1,
      typingUsers: {},
      loadingMessages: {},
      loadingChats: false,
    });
  },

  // Getters
  getMessages: (roomId) => {
    const pages = get().messages[roomId] || [];
    // Sort pages by page number (ascending), then flatten
    return pages
      .sort((a, b) => a.page - b.page)
      .flatMap((page) => page.messages)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  getChat: (chatId) => {
    return get().chats.find((c) => c._id === chatId);
  },

  isTyping: (roomId, userId) => {
    const typingSet = get().typingUsers[roomId];
    return typingSet ? typingSet.has(userId) : false;
  },
}));

