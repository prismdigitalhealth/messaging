import "tailwindcss/tailwind.css";
import React, { useEffect, useState, useRef } from "react";

// Chat application with message reactions

const MessageView = ({ userId, nickname = "", onConnectionError, sb }) => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [userIdsToInvite, setUserIdsToInvite] = useState("");
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [previousMessageQuery, setPreviousMessageQuery] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  // Placeholder state variables to prevent undefined errors
  const [messageReactions, setMessageReactions] = useState({});
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [availableEmojis, setAvailableEmojis] = useState([]);
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({});
  const defaultEmojis = ['👍', '❤️', '😂', '😮', '😢', '👎'];

  // Forward connection errors to parent component
  useEffect(() => {
    if (error && error.includes("Connection")) {
      if (onConnectionError) {
        onConnectionError(error);
      }
    }
  }, [error, onConnectionError]);
  
  // Handle Sendbird connection when component mounts or userId changes
  useEffect(() => {
    let isComponentMounted = true;
    let connectionTimeoutId = null;
    
    const connectToSendbird = async () => {
      if (!userId) {
        console.error("No user ID provided");
        if (isComponentMounted) {
          setError("No user ID provided. Please log in again.");
          setIsConnecting(false);
        }
        return;
      }
      
      setIsConnecting(true);
      
      // Set a connection timeout to prevent endless "connecting" state
      connectionTimeoutId = setTimeout(() => {
        if (isComponentMounted) {
          console.error("Connection timeout reached");
          setIsConnected(false);
          setIsConnecting(false);
          setError("Connection timeout. Please refresh and try again.");
          if (onConnectionError) {
            onConnectionError("Connection timeout. Please refresh and try again.");
          }
        }
      }, 15000); // 15 second timeout
      
      try {
        // Force disconnect any existing connection
        if (sb.currentUser) {
          try {
            await sb.disconnect();
            console.log("Disconnected existing user before login");
            // Small delay to ensure the disconnect completes
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (disconnectError) {
            console.warn("Error disconnecting existing user:", disconnectError);
            // Continue anyway
          }
        }
        
        console.log(`Connecting to Sendbird with userId: ${userId}`);
        
        // Connect to Sendbird
        const user = await sb.connect(userId);
        console.log("Successfully connected to Sendbird:", user);
        
        if (!isComponentMounted) return;
        
        // Clear timeout and update connection state
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
        
        // Update user's nickname if provided
        if (nickname) {
          try {
            await sb.updateCurrentUserInfo({
              nickname: nickname
            });
            console.log("Nickname updated successfully");
          } catch (nicknameError) {
            console.warn("Failed to update nickname:", nicknameError);
            // Continue anyway, nickname update is not critical
          }
        }
        
        setIsConnected(true);
        setIsConnecting(false);
        setError("");
        
        // Load channels after successful connection
        const channels = await loadChannels();
        if (isComponentMounted && channels && channels.length > 0) {
          const firstChannel = channels[0];
          setSelectedChannel(firstChannel);
          loadMessages(firstChannel);
        }
      } catch (error) {
        console.error("Sendbird connection error:", error);
        
        if (!isComponentMounted) return;
        
        // Clear timeout if it exists
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
          connectionTimeoutId = null;
        }
        
        let errorMessage = "Failed to connect to chat server.";
        
        // More specific error messages based on the error type
        if (error.code) {
          switch (error.code) {
            case 400101:
              errorMessage = "Invalid user ID format. Please try with a different ID.";
              break;
            case 400102:
              errorMessage = "User ID required. Please enter a valid user ID.";
              break;
            case 400201:
            case 400202:
              errorMessage = "Authentication failed. Access token is invalid or expired.";
              break;
            case 500901:
              errorMessage = "Connection failed due to a server issue. Please try again later.";
              break;
            case 800120:
              errorMessage = "Connection failed: API access issue. Please check your connectivity or try again later.";
              break;
            default:
              errorMessage = `Connection error (${error.code}): ${error.message || "Unknown error"}`;
          }
        } else if (error.message && error.message.includes("Failed to fetch")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setError(errorMessage);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (onConnectionError) {
          onConnectionError(errorMessage);
        }
      }
    };
    
    connectToSendbird();
    
    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
      }
      
      try {
        // Only disconnect if we're actually connected
        if (sb.currentUser) {
          sb.disconnect();
          console.log("Disconnected from Sendbird");
        }
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
    };
  }, [userId, nickname, onConnectionError, sb]);

  // Debug version of getMessageText
  const getMessageText = (msg) => {
    if (!msg) return "";
    
    // For system/loading messages
    if (msg._isSystemMessage || msg._isLoading) {
      return msg.message;
    }
    
    // For pending messages created locally
    if (msg._isPending && msg.message) {
      return msg.message;
    }
    
    // Check all possible locations where Sendbird might store the message text
    
    // Check standard properties
    if (msg.message && typeof msg.message === 'string' && msg.message.trim() !== "") {
      return msg.message;
    }
    
    // Check Sendbird v4 property (sometimes used)
    if (msg.plainBody && typeof msg.plainBody === 'string' && msg.plainBody.trim() !== "") {
      return msg.plainBody;
    }
    
    // Check message.mentionedMessageTemplate (seen in some Sendbird implementations)
    if (msg.mentionedMessageTemplate && typeof msg.mentionedMessageTemplate === 'string' && 
        msg.mentionedMessageTemplate.trim() !== "") {
      return msg.mentionedMessageTemplate;
    }
    
    // Check various other properties
    if (msg.text && msg.text.trim() !== "") return msg.text;
    if (msg.name && msg.name.trim() !== "") return msg.name;
    
    // Check data property which might contain the text
    if (msg.data) {
      try {
        // Try parsing it if it's a JSON string
        const dataObj = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        if (dataObj.text && dataObj.text.trim() !== "") return dataObj.text;
        if (dataObj.message && dataObj.message.trim() !== "") return dataObj.message;
      } catch (e) {
        // If it's not JSON but a regular string, check if it has content
        if (typeof msg.data === 'string' && msg.data.trim() !== "") {
          return msg.data;
        }
      }
    }
    
    console.log("[WARNING] Could not extract message text from:", msg);
    return "[Message content unavailable]";
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Auto-resize textarea when content changes
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content with min/max constraints
    const newHeight = Math.max(
      40, // min height (single line)
      Math.min(textarea.scrollHeight, 150) // max height 150px
    );
    textarea.style.height = `${newHeight}px`;
  };
  
  // Apply auto-resize when message content changes
  useEffect(() => {
    autoResizeTextarea();
  }, [newMessage]);
  
  // Initialize textarea height when component mounts or channel changes
  useEffect(() => {
    // Small delay to ensure the DOM is fully rendered
    const timer = setTimeout(() => {
      autoResizeTextarea();
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedChannel]);
  
  // Emoji functionality removed to simplify codebase
  
  // Emoji functionality removed to simplify codebase
  
  // Emoji reactions functionality
  
  // Emoji functionality has been removed
  
  // Toggle reaction on a message
  const toggleReaction = async (messageId, emoji) => {
    if (!selectedChannel || !sb || !messageId || !emoji) {
      console.error('Cannot toggle reaction: missing required parameters');
      return;
    }
    
    try {
      // Get the message object from the channel
      const message = await selectedChannel.getMessage(messageId);
      if (!message) {
        console.error(`Message not found: ${messageId}`);
        return;
      }
      
      // Check if the current user has already reacted with this emoji
      let hasReacted = false;
      
      // Check if we have reactions for this message in our state
      if (messageReactions[messageId] && messageReactions[messageId][emoji]) {
        hasReacted = messageReactions[messageId][emoji].includes(userId);
      }
      
      console.log(`User ${userId} has ${hasReacted ? 'already' : 'not'} reacted with ${emoji} to message ${messageId}`);
      
      // Toggle the reaction using Sendbird API
      if (hasReacted) {
        // Remove the reaction
        await selectedChannel.deleteReaction(message, emoji);
        console.log(`Removed reaction ${emoji} from message ${messageId}`);
        
        // Update local state
        setMessageReactions(prev => {
          const updatedReactions = {...prev};
          
          if (updatedReactions[messageId] && updatedReactions[messageId][emoji]) {
            // Filter out the current user from the users who reacted with this emoji
            updatedReactions[messageId][emoji] = updatedReactions[messageId][emoji].filter(id => id !== userId);
            
            // If no users left for this emoji, remove the emoji
            if (updatedReactions[messageId][emoji].length === 0) {
              delete updatedReactions[messageId][emoji];
            }
            
            // If no emojis left for this message, remove the message
            if (Object.keys(updatedReactions[messageId]).length === 0) {
              delete updatedReactions[messageId];
            }
          }
          
          return updatedReactions;
        });
      } else {
        // Add the reaction
        await selectedChannel.addReaction(message, emoji);
        console.log(`Added reaction ${emoji} to message ${messageId}`);
        
        // Update local state
        setMessageReactions(prev => {
          const updatedReactions = {...prev};
          
          // Initialize the message reactions if needed
          if (!updatedReactions[messageId]) {
            updatedReactions[messageId] = {};
          }
          
          // Initialize the emoji reactions if needed
          if (!updatedReactions[messageId][emoji]) {
            updatedReactions[messageId][emoji] = [];
          }
          
          // Add the current user to the users who reacted with this emoji
          if (!updatedReactions[messageId][emoji].includes(userId)) {
            updatedReactions[messageId][emoji] = [...updatedReactions[messageId][emoji], userId];
          }
          
          return updatedReactions;
        });
      }
    } catch (error) {
      console.error(`Error toggling reaction for message ${messageId}:`, error);
    } finally {
      // Close the reaction selector
      setSelectedMessageForReaction(null);
    }
  };

  // Channel event handlers
  useEffect(() => {
    if (!selectedChannel || !isConnected) return;

    const onMessageReceived = (channel, message) => {
      // Update unread count if message is in a different channel and not from the current user
      if (channel.url !== selectedChannel?.url && message.sender?.userId !== userId) {
        setChannelUnreadCounts(prev => ({
          ...prev,
          [channel.url]: (prev[channel.url] || 0) + 1
        }));
      }
      
      if (selectedChannel?.url === channel.url) {
        // Emoji functionality removed to simplify codebase
        
        // Add the message to the messages state
        const cleanMessage = {
          ...message
        };
        setMessages((prevMessages) => [...prevMessages, cleanMessage]);
        
        // Save received message to localStorage
        try {
          const channelMessagesKey = `messages_${channel.url}`;
          let savedMessages = [];
          
          const savedMessagesJson = localStorage.getItem(channelMessagesKey);
          if (savedMessagesJson) {
            savedMessages = JSON.parse(savedMessagesJson);
          }
          
          // Check if message already exists
          const messageExists = savedMessages.some(msg => msg.messageId === message.messageId);
          if (!messageExists) {
            savedMessages.push(message);
            
            // Sort messages by timestamp
            savedMessages.sort((a, b) => {
              const aTime = a.createdAt || 0;
              const bTime = b.createdAt || 0;
              return aTime - bTime;
            });
            
            localStorage.setItem(channelMessagesKey, JSON.stringify(savedMessages));
          }
        } catch (saveError) {
          console.error("Error saving received message to localStorage:", saveError);
        }
      }
      
      // Update channels and ensure they are sorted by most recent activity
      setChannels((prevChannels) => {
        const updatedChannels = prevChannels.map((ch) =>
          ch.url === channel.url ? { ...ch, lastMessage: message } : ch
        )
        // Re-sort channels by most recent message or creation date
        .sort((a, b) => {
          const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
          const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
          return bTimestamp - aTimestamp; // Descending order (newest first)
        });
        
        return updatedChannels;
      });
    };

    const onMessageUpdated = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        // Emoji functionality removed to simplify codebase
        
        // Update the message in the messages state
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.messageId === message.messageId ? message : msg
          )
        );
        
        // Also update the message in localStorage
        try {
          const channelMessagesKey = `messages_${channel.url}`;
          const savedMessagesJson = localStorage.getItem(channelMessagesKey);
          
          if (savedMessagesJson) {
            const savedMessages = JSON.parse(savedMessagesJson);
            const messageIndex = savedMessages.findIndex(msg => msg.messageId === message.messageId);
            
            if (messageIndex !== -1) {
              savedMessages[messageIndex] = message;
              localStorage.setItem(channelMessagesKey, JSON.stringify(savedMessages));
            }
          }
        } catch (error) {
          console.error('Error updating message in localStorage:', error);
        }
      }
    };

    const onMessageDeleted = (channel, messageId) => {
      if (selectedChannel.url === channel.url) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageId !== messageId)
        );
      }
    };

    const onChannelChanged = (channel) => {
      setChannels((prevChannels) =>
        prevChannels.map((ch) => (ch.url === channel.url ? channel : ch))
      );
      if (selectedChannel.url === channel.url) {
        setSelectedChannel(channel);
      }
    };

    const channelHandlerId = `channel_handler_${Date.now()}`;
    selectedChannel.addMessageReceivedHandler?.(channelHandlerId, onMessageReceived);
    selectedChannel.addMessageUpdatedHandler?.(channelHandlerId, onMessageUpdated);
    selectedChannel.addMessageDeletedHandler?.(channelHandlerId, onMessageDeleted);
    selectedChannel.addChannelChangedHandler?.(channelHandlerId, onChannelChanged);

    return () => {
      try {
        selectedChannel.removeMessageReceivedHandler?.(channelHandlerId);
        selectedChannel.removeMessageUpdatedHandler?.(channelHandlerId);
        selectedChannel.removeMessageDeletedHandler?.(channelHandlerId);
        selectedChannel.removeChannelChangedHandler?.(channelHandlerId);
      } catch (e) {
        console.error("Error removing channel handlers:", e);
      }
    };
  }, [selectedChannel, isConnected]);

  // Create a new group channel
  const createNewChannel = async () => {
    try {
      if (!newChannelName.trim()) {
        return;
      }
      
      // Parse user IDs to invite (excluding the current user)
      const userIdsToAdd = userIdsToInvite
        .split(',')
        .map(id => id.trim())
        .filter(id => id !== "" && id !== userId);
      
      console.log("Users to invite:", userIdsToAdd);
      
      // Channel creation params
      const params = {
        name: newChannelName.trim(),
        channelUrl: `group-${Date.now()}`,
        coverUrl: "", // Optional channel image
        isDistinct: false, // Allow multiple channels with same members
        operatorUserIds: [userId], // Current user as operator
        userIds: [userId], // Start with current user
      };
      
      // Create the channel
      const groupChannel = await sb.groupChannel.createChannel(params);
      console.log("Channel created:", groupChannel);
      
      // Invite additional users if specified
      if (userIdsToAdd.length > 0) {
        try {
          // The Sendbird SDK expects an array of UserIds for the invite method
          // According to Sendbird documentation, we need to pass an array of user IDs
          console.log("Attempting to invite users:", userIdsToAdd);
          
          // Convert to an array of objects with userId property if necessary
          // Some versions of Sendbird SDK expect this format instead of simple strings
          const inviteParams = {
            userIds: userIdsToAdd,
            // Add any additional parameters needed for invitations
          };
          
          await groupChannel.inviteWithUserIds(userIdsToAdd);
          console.log("Users invited successfully:", userIdsToAdd);
        } catch (inviteError) {
          console.error("Error inviting users:", inviteError);
          setError(`Channel created but failed to invite users: ${inviteError.message || "Invalid parameters."}`);
          // Continue anyway since the channel is created
        }
      }
      
      // Reset form and close modal
      setNewChannelName("");
      setUserIdsToInvite("");
      setIsCreatingChannel(false);
      
      // Update channel list and select the new channel
      const updatedChannels = await loadChannels();
      
      // Find the newly created channel in the updated list
      const newChannel = updatedChannels.find(ch => ch.url === groupChannel.url);
      if (newChannel) {
        setSelectedChannel(newChannel);
        loadMessages(newChannel);
      }
      
    } catch (error) {
      console.error("Error creating channel:", error);
      setError(`Failed to create channel: ${error.message || "Unknown error"}`);
    }
  };

  const loadChannels = async () => {
    try {
      // Ensure connection is established before querying channels
      if (!sb.currentUser) {
        console.log("No current user, reconnecting...");
        try {
          await sb.connect(userId);
          setIsConnected(true);
        } catch (connectError) {
          console.error("Reconnection error:", connectError);
          setIsConnected(false);
          return [];
        }
      }
      
      // Add error handling and retry logic for channel fetching
      const fetchChannelsWithRetry = async (maxRetries) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const channelListQuery = sb.groupChannel.createMyGroupChannelListQuery();
            channelListQuery.limit = 20;
            channelListQuery.includeEmpty = true;
            const fetchedChannels = await channelListQuery.next();
            
            if (!fetchedChannels || !Array.isArray(fetchedChannels)) {
              console.warn("Invalid channel data received, retrying...");
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
              continue;
            }
            
            // Get unread message counts and sort by latest activity
            const sortedChannels = fetchedChannels.sort((a, b) => {
              const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
              const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
              return bTimestamp - aTimestamp;
            });
            
            // Update unread counts state
            const unreadCountsMap = {};
            sortedChannels.forEach(channel => {
              unreadCountsMap[channel.url] = channel.unreadMessageCount || 0;
            });
            setChannelUnreadCounts(unreadCountsMap);
            
            return sortedChannels;
          } catch (error) {
            console.error(`Channel list error (attempt ${attempt + 1}/${maxRetries}):`, error);
            
            if (attempt >= maxRetries - 1) {
              console.error("Max retries reached, giving up on channel fetch");
              return [];
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
        return [];
      };
      
      const sortedChannels = await fetchChannelsWithRetry(3);
      setChannels(sortedChannels);
      return sortedChannels; 
    } catch (error) {
      console.error("Channel list outer error:", error);
      return [];
    }
  };

  const joinChannel = async (channelUrl) => {
    try {
      // Ensure we're connected before joining channel
      if (!sb.currentUser) {
        try {
          await sb.connect(userId);
          setIsConnected(true);
          console.log("Reconnected before joining channel");
        } catch (connectError) {
          console.error("Failed to reconnect before joining channel:", connectError);
          setError("Connection error. Please refresh and try again.");
          return;
        }
      }
      
      const attemptJoinChannel = async (maxRetries) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const channel = await sb.groupChannel.getChannel(channelUrl);
            
            if (channel.isSuper && typeof channel.enter === "function") {
              try {
                await channel.enter();
              } catch (enterError) {
                console.error("Channel enter error:", enterError);
                // Continue even if enter fails - it might still work for some channel types
              }
            }
            
            return channel; // Success, return the channel
          } catch (error) {
            console.error(`Channel join error (attempt ${attempt + 1}/${maxRetries}):`, error);
            
            if (attempt >= maxRetries - 1) {
              console.error("Max retries reached for joining channel");
              throw error; // Re-throw to be caught by outer try-catch
            }
            
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
        
        throw new Error("Failed to join channel after max retries");
      };
      
      const channel = await attemptJoinChannel(3);
      setSelectedChannel(channel);
      
      // Reset unread count for this channel
      setChannelUnreadCounts(prev => ({
        ...prev,
        [channel.url]: 0
      }));
      
      // Mark the channel as read in Sendbird
      try {
        if (channel.markAsRead) {
          await channel.markAsRead();
        }
      } catch (markAsReadError) {
        console.error("Error marking channel as read:", markAsReadError);
      }
      
      loadMessages(channel);
    } catch (error) {
      console.error("Channel join outer error:", error);
      setError("Failed to join channel. Please try again.");
    }
  };

  /**
   * Load more messages when scrolling to top
   */
  const loadMoreMessages = async () => {
    if (!selectedChannel || isLoadingMoreMessages || !hasMoreMessages || !previousMessageQuery) {
      return;
    }
    
    try {
      setIsLoadingMoreMessages(true);
      
      // Store current scroll height to maintain position after loading
      const container = messagesContainerRef.current;
      const oldScrollHeight = container ? container.scrollHeight : 0;
      
      // Load previous messages
      const oldMessages = await previousMessageQuery.load();
      
      if (oldMessages && oldMessages.length > 0) {
        console.log(`Loaded ${oldMessages.length} more older messages`);
        
        // Prepend old messages to the beginning of the current messages list
        setMessages(prevMessages => [
          ...oldMessages,
          ...prevMessages
        ]);
        
        // If fewer messages returned than the limit, there are no more messages
        if (oldMessages.length < previousMessageQuery.limit) {
          setHasMoreMessages(false);
        }
        
        // Restore scroll position after new messages are rendered
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - oldScrollHeight;
            container.scrollTop = scrollDiff > 0 ? scrollDiff : 0;
          }
        }, 100);
      } else {
        // No more messages to load
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  /**
   * Load messages from a channel
   */
  const loadMessages = async (channel) => {
    if (!channel) return;
    setMessages([
      { _isLoading: true, messageId: "loading-indicator", message: "Loading messages..." },
    ]);
    try {
      // Reset message loading state
      setHasMoreMessages(true);
      setIsLoadingMoreMessages(false);
      
      // First, try to load messages from localStorage
      let localMessages = [];
      try {
        const channelMessagesKey = `messages_${channel.url}`;
        const savedMessagesJson = localStorage.getItem(channelMessagesKey);
        if (savedMessagesJson) {
          localMessages = JSON.parse(savedMessagesJson);
          console.log(`Loaded ${localMessages.length} messages from localStorage for channel ${channel.url}`);
        }
      } catch (localStorageError) {
        console.error("Error loading messages from localStorage:", localStorageError);
      }
      
      // Then, fetch messages from Sendbird API
      if (channel.isSuper && typeof channel.enter === "function") {
        try {
          await channel.enter();
        } catch (enterError) {
          console.error("Channel enter error:", enterError);
        }
      }
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = 50;
      if ("reverse" in messageListQuery) {
        messageListQuery.reverse = true;
      }
      // Store the query for loading more messages later
      setPreviousMessageQuery(messageListQuery);
      const fetchedMessages = await messageListQuery.load();
      
      // Merge messages from localStorage and Sendbird API
      let mergedMessages = [...fetchedMessages];
      
      // Add local messages that aren't in the fetched messages
      if (localMessages.length > 0) {
        localMessages.forEach(localMsg => {
          const exists = mergedMessages.some(fetchedMsg => fetchedMsg.messageId === localMsg.messageId);
          if (!exists) {
            mergedMessages.push(localMsg);
          }
        });
        
        // Sort merged messages by timestamp
        mergedMessages.sort((a, b) => {
          const aTime = a.createdAt || 0;
          const bTime = b.createdAt || 0;
          return aTime - bTime;
        });
      }
      
      // Update localStorage with merged messages
      try {
        const channelMessagesKey = `messages_${channel.url}`;
        localStorage.setItem(channelMessagesKey, JSON.stringify(mergedMessages));
      } catch (saveError) {
        console.error("Error saving merged messages to localStorage:", saveError);
      }
      
      // All emoji functionality has been completely removed
      
      if (mergedMessages.length === 0) {
        setMessages([{
          messageId: "welcome-msg",
          message: `Welcome to ${channel.name || "this channel"}! Send your first message to start the conversation.`,
          createdAt: Date.now(),
          sender: { userId: "system" },
          _isSystemMessage: true
          // Process message
        }]);
      } else {
        // Set messages
        setMessages(mergedMessages);
      }
    } catch (error) {
      console.error("Message load error:", error);
      setMessages([{
        messageId: "error-msg",
        message: `Failed to load messages: ${error.message}`,
        createdAt: Date.now(),
        sender: { userId: "system" },
        _isSystemMessage: true
      }]);
    }
  };

  /**
   * Send a message to the selected channel and ensure it's saved
   */
  const sendMessage = async () => {
    if (!selectedChannel || newMessage.trim() === "") return;
    
    // Store the original message text
    const messageText = newMessage.trim();
    const currentTimestamp = Date.now();
    
    // Create a pending message to show immediately in the UI
    const pendingMessage = {
      messageId: `pending_${currentTimestamp}`,
      message: messageText,
      sender: { userId },
      createdAt: currentTimestamp,
      _isPending: true,
      messageType: "user",
    };
    
    // Emoji functionality removed to simplify codebase
    
    // Add pending message to the UI
    const cleanPendingMessage = {
      ...pendingMessage
    };
    setMessages((prevMessages) => [...prevMessages, cleanPendingMessage]);
    setNewMessage("");
    
    try {
      // Prepare message parameters with metadata
      const params = { 
        message: messageText,
        data: JSON.stringify({ 
          text: messageText
        })
      };
      
      // Send the message to Sendbird
      const sentMessage = await selectedChannel.sendUserMessage(params);
      console.log("Sent message response:", sentMessage);
      
      // Emoji functionality removed to simplify codebase
      
      // Extract the timestamp from Sendbird response, with fallbacks
      const sendBirdTimestamp = extractTimestamp(sentMessage);
      
      // Create a processed message that ensures the text and timestamp are preserved
      const processedSentMessage = {
        ...sentMessage,
        // Ensure the message text is preserved from our original input
        message: messageText,
        // Keep the sender information
        sender: sentMessage.sender || { userId },
        // Use Sendbird timestamp if available, otherwise fall back to our local timestamp
        createdAt: sendBirdTimestamp || currentTimestamp,
        // Add the data field if it's not already there
        data: sentMessage.data || JSON.stringify({
          text: messageText
        })
      };
      
      // Replace the pending message with the actual sent message
      const cleanProcessedMessage = {
        ...processedSentMessage
      };
      
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ? 
            cleanProcessedMessage : msg
        )
      );
      
      // Save sent message to localStorage
      try {
        const channelMessagesKey = `messages_${selectedChannel.url}`;
        let savedMessages = [];
        
        const savedMessagesJson = localStorage.getItem(channelMessagesKey);
        if (savedMessagesJson) {
          savedMessages = JSON.parse(savedMessagesJson);
        }
        
        // Check if message already exists
        const messageExists = savedMessages.some(msg => msg.messageId === sentMessage.messageId);
        if (!messageExists) {
          savedMessages.push(processedSentMessage);
          
          // Sort messages by timestamp
          savedMessages.sort((a, b) => {
            const aTime = a.createdAt || 0;
            const bTime = b.createdAt || 0;
            return aTime - bTime;
          });
          
          localStorage.setItem(channelMessagesKey, JSON.stringify(savedMessages));
        }
      } catch (saveError) {
        console.error("Error saving sent message to localStorage:", saveError);
      }
      
      // Verify the message was saved by checking the channel's latest messages
      setTimeout(async () => {
        try {
          // Check if the message appears in the channel's messages
          const messageListQuery = selectedChannel.createPreviousMessageListQuery();
          messageListQuery.limit = 5; // Just check the most recent messages
          const recentMessages = await messageListQuery.load();
          
          const messageSaved = recentMessages.some(msg => 
            msg.messageId === sentMessage.messageId ||
            (msg.message === messageText && Math.abs(extractTimestamp(msg) - currentTimestamp) < 60000)
          );
          
          if (!messageSaved) {
            console.warn("Message may not have been saved properly. Attempting to resend...");
            // The message might not have been saved properly
            // We could implement a resend mechanism here if needed
          }
        } catch (verifyError) {
          console.error("Error verifying message was saved:", verifyError);
        }
      }, 2000); // Wait 2 seconds before checking
      
    } catch (error) {
      console.error("Send message error:", error);
      // Mark the pending message as failed
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ?
            { ...msg, _isPending: false, _isFailed: true } : msg
        )
      );
    }
  };

  // Helper function to extract timestamp from Sendbird message
  const extractTimestamp = (message) => {
    if (!message) return null;
    
    // Check various properties where timestamp might be stored
    // Ordered by priority/likelihood
    
    // Standard timestamp property
    if (message.createdAt && !isNaN(message.createdAt)) {
      return message.createdAt;
    }
    
    // Sendbird v4 might use this
    if (message.created_at && !isNaN(message.created_at)) {
      return message.created_at;
    }
    
    // Check for timestamp property
    if (message.timestamp && !isNaN(message.timestamp)) {
      return message.timestamp;
    }
    
    // Other possible timestamp properties
    if (message.sentAt && !isNaN(message.sentAt)) {
      return message.sentAt;
    }
    
    if (message.messageCreatedAt && !isNaN(message.messageCreatedAt)) {
      return message.messageCreatedAt;
    }
    
    // Try to extract from message.message if it's a JSON string
    if (message.data) {
      try {
        const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
        if (data.timestamp && !isNaN(data.timestamp)) {
          return data.timestamp;
        }
      } catch (e) {
        // Parsing failed, continue with other checks
      }
    }
    
    // If no timestamp found
    return null;
  };

  const retryFailedMessage = (failedMessage) => {
    setNewMessage(failedMessage.message);
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => msg.messageId !== failedMessage.messageId)
    );
  };

  // Group messages by sender/time
  const groupMessages = (messagesArray) => {
    const groups = [];
    let currentGroup = [];
    messagesArray.forEach((message, index) => {
      const prevMessage = index > 0 ? messagesArray[index - 1] : null;
      const timeGap = prevMessage ? (message.createdAt - prevMessage.createdAt) > 10 * 60 * 1000 : true;
      const senderChanged = prevMessage ? message.sender?.userId !== prevMessage.sender?.userId : true;
      if (senderChanged || timeGap) {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
          currentGroup = [];
        }
      }
      currentGroup.push(message);
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  };

  // Enhanced formatMessageTime function with more robust handling
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "Unknown time";
    
    // Convert string timestamps to numbers
    if (typeof timestamp === "string") {
      // Try parsing as integer first
      let parsedTimestamp = parseInt(timestamp, 10);
      
      // If that fails, try as a date string
      if (isNaN(parsedTimestamp)) {
        const dateFromString = new Date(timestamp);
        if (dateFromString.toString() !== "Invalid Date") {
          parsedTimestamp = dateFromString.getTime();
        }
      }
      
      timestamp = parsedTimestamp;
    }
    
    // If timestamp is too small, it might be in seconds instead of milliseconds
    // Typical Unix timestamps after 2001 are > 1000000000000 in milliseconds
    if (timestamp > 0 && timestamp < 10000000000) {
      timestamp = timestamp * 1000; // Convert from seconds to milliseconds
    }
    
    if (isNaN(timestamp) || timestamp <= 0) return "Unknown time";
    
    try {
      const messageDate = new Date(timestamp);
      const today = new Date();
      
      if (messageDate.toString() === "Invalid Date") return "Unknown time";
      
      const isToday =
        messageDate.getDate() === today.getDate() &&
        messageDate.getMonth() === today.getMonth() &&
        messageDate.getFullYear() === today.getFullYear();
      
      if (isToday) {
        return messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        return (
          messageDate.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " " +
          messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      }
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Unknown time";
    }
  };

  const messageGroups = groupMessages(messages);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Channel List */}
      <div className="w-1/4 bg-gray-100 shadow-md flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Chats</h2>
          <button
            onClick={() => setIsCreatingChannel(true)}
            className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 focus:outline-none"
            disabled={!isConnected}
            title={isConnected ? "Create New Channel" : "Connect to create channels"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className={`text-xs mb-2 flex items-center ${isConnected ? "text-green-600" : "text-red-600"}`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? "bg-green-600" : "bg-red-600"}`}></div>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
        
        {/* Create Channel Modal */}
        {isCreatingChannel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Create New Channel</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Name *
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter channel name"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User IDs to Invite (comma separated)
                </label>
                <input
                  type="text"
                  value={userIdsToInvite}
                  onChange={(e) => setUserIdsToInvite(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. user1, user2, user3"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to create a channel just for yourself</p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsCreatingChannel(false);
                    setNewChannelName("");
                    setUserIdsToInvite("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewChannel}
                  disabled={!newChannelName.trim()}
                  className={`px-4 py-2 rounded-lg ${
                    newChannelName.trim() 
                      ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto space-y-3">
          {channels.length > 0 ? (
            channels.map((ch) => {
              const isActive = selectedChannel?.url === ch.url;
              return (
                <div
                  key={ch.url}
                  onClick={() => joinChannel(ch.url)}
                  className={`flex items-center p-3 rounded-xl shadow-lg cursor-pointer transition-all ${
                    isActive ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-100 hover:text-black"
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-gray-300 rounded-full mr-3 flex-shrink-0"></div>
                    {/* Unread indicator */}
                    {channelUnreadCounts[ch.url] > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {channelUnreadCounts[ch.url] > 99 ? '99+' : channelUnreadCounts[ch.url]}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-grow min-w-0 mr-2"> {/* Added min-w-0 to enable truncation and mr-2 for spacing */}
                    <p className="font-semibold text-sm mb-1">{ch.name || "(No channel name)"}</p>
                    <p className={`text-xs ${isActive ? "text-gray-300" : "text-gray-500"} truncate max-w-full`}>
                      {ch.lastMessage ? getMessageText(ch.lastMessage) : "Tap to start conversation"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right"> {/* Using flex-shrink-0 to prevent timestamp from shrinking */}
                    <p className={`text-xs font-semibold whitespace-nowrap ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                      {(() => {
                        const timestamp = ch.lastMessage?.createdAt || ch.createdAt;
                        if (!timestamp) return "";
                        try {
                          return formatMessageTime(timestamp);
                        } catch (e) {
                          return "";
                        }
                      })()}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 text-center">No channels found.</p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/4 flex flex-col h-full bg-white">
        <div className="p-4 bg-white border-b flex items-center">
          <div className="w-12 h-12 bg-gray-300 rounded-full mr-3"></div>
          <div>
            <p className="font-semibold text-lg">
              {selectedChannel ? selectedChannel.name : "Select a conversation"}
            </p>
            <p className="text-xs text-gray-500">
              {selectedChannel ? `${selectedChannel.memberCount} members` : "No channel selected"}
            </p>
          </div>
        </div>

        {/* Connection Status and Errors */}
        {isConnecting && (
          <div className="flex flex-1 justify-center items-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              <p className="text-gray-500">Connecting to chat server...</p>
            </div>
          </div>
        )}
        
        {!isConnecting && error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mx-4 mt-4">
            <span className="block sm:inline">{error}</span>
            <span 
              className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" 
              onClick={() => setError("")}
            >
              <span className="sr-only">Dismiss</span>
              <span className="text-red-500">×</span>
            </span>
          </div>
        )}
        
        {/* Messages */}
        {!isConnecting && !error && (
          <div 
              className="flex-1 p-8 overflow-y-auto space-y-6" 
              ref={messagesContainerRef}
              onScroll={(e) => {
                // Check if user has scrolled to the top (or very close to it)
                if (e.target.scrollTop < 50 && !isLoadingMoreMessages && hasMoreMessages) {
                  loadMoreMessages();
                }
              }}
            >
            {/* Loading indicator for older messages */}
            {isLoadingMoreMessages && (
              <div className="py-2 text-center">
                <div className="inline-block px-4 py-2 bg-gray-200 text-gray-700 text-xs italic rounded-xl animate-pulse">
                  Loading older messages...
                </div>
              </div>
            )}

            {/* No more messages indicator */}
            {!isLoadingMoreMessages && !hasMoreMessages && messages.length > 50 && (
              <div className="py-2 text-center">
                <div className="inline-block px-4 py-2 bg-gray-100 text-gray-500 text-xs italic rounded-xl">
                  No more messages to load
                </div>
              </div>
            )}
            
            {messageGroups.length > 0 ? (
              messageGroups.map((group, groupIndex) => {
                const isSentByMe = group[0].sender?.userId === userId;
                return (
                  <div key={`group-${groupIndex}`} className="mb-6">
                    <div
                      className={`flex ${
                        group[0]._isSystemMessage || group[0]._isLoading
                          ? "justify-center"
                          : isSentByMe
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {!isSentByMe && !group[0]._isSystemMessage && !group[0]._isLoading && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full self-end mb-1 mr-2"></div>
                      )}
                      <div className={`flex flex-col max-w-md ${isSentByMe ? "items-end" : "items-start"}`}>
                        {group.map((message, messageIndex) => {
                          const isLastInGroup = messageIndex === group.length - 1;
                          const isPending = message._isPending;
                          const isFailed = message._isFailed;
                          let bubbleStyle = "";
                          if (message._isSystemMessage) {
                            bubbleStyle =
                              "bg-gray-200 text-gray-700 text-center italic rounded-xl mx-auto";
                          } else if (message._isLoading) {
                            bubbleStyle =
                              "bg-gray-200 text-gray-700 text-center italic rounded-xl mx-auto animate-pulse";
                          } else if (isSentByMe) {
                            bubbleStyle = "bg-indigo-600 text-white";
                          } else {
                            bubbleStyle = "bg-gray-100 text-black";
                          }
                          if (isPending) {
                            bubbleStyle = isSentByMe ? "bg-indigo-400 text-white" : "bg-gray-100 text-black";
                          } else if (isFailed) {
                            bubbleStyle = "bg-red-100 text-red-600";
                          }
                          if (group.length === 1) {
                            bubbleStyle += isSentByMe
                              ? " rounded-2xl rounded-br-none"
                              : " rounded-2xl rounded-bl-none";
                          } else if (messageIndex === 0) {
                            bubbleStyle += isSentByMe
                              ? " rounded-2xl rounded-br-none rounded-tr-lg"
                              : " rounded-2xl rounded-bl-none rounded-tl-lg";
                          } else if (isLastInGroup) {
                            bubbleStyle += isSentByMe
                              ? " rounded-2xl rounded-tr-lg rounded-br-none"
                              : " rounded-2xl rounded-tl-lg rounded-bl-none";
                          } else {
                            bubbleStyle += isSentByMe
                              ? " rounded-2xl rounded-tr-lg rounded-br-none"
                              : " rounded-2xl rounded-tl-lg rounded-bl-none";
                          }

                          return (
                            <div key={message.messageId} className="my-0.5">
                              <div className={`relative px-4 py-2 text-sm shadow-sm ${bubbleStyle} group`}>
                                <p>{getMessageText(message)}</p>
                              </div>
                              {isSentByMe && (
                                <div className="text-xs text-right mr-2">
                                  {isFailed && (
                                    <div className="flex justify-end">
                                      <span className="text-red-500 mr-2">Failed to send</span>
                                      <button
                                        onClick={() => retryFailedMessage(message)}
                                        className="text-blue-500 hover:underline"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  )}
                                  {isPending && <span className="text-gray-400">Sending...</span>}
                                </div>
                              )}
                              {isLastInGroup && (
                                <div
                                  className={`text-xs text-gray-500 mt-1 ${
                                    isSentByMe ? "text-right mr-2" : "text-left ml-2"
                                  }`}
                                >
                                  {typeof message.createdAt !== "undefined"
                                    ? formatMessageTime(message.createdAt)
                                    : "Unknown time"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {isSentByMe && !group[0]._isSystemMessage && !group[0]._isLoading && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full self-end mb-1 ml-2"></div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-400 text-center">No messages yet.</p>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {!isConnecting && selectedChannel && (
          <div className="p-4 bg-white border-t flex items-start">
            <textarea
              ref={textareaRef}
              placeholder="Write your message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                // Auto-resize happens in the useEffect
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1 p-2 focus:outline-none text-black resize-none overflow-hidden min-h-[40px] max-h-[150px] transition-height duration-100"
              rows="1"
            />
            <button
              onClick={sendMessage}
              className={`ml-2 px-6 py-2 rounded-full font-bold transition-colors ${
                newMessage.trim() ? "bg-gray-900 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!newMessage.trim()}
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Right Side Panel */}
      <div className="w-1/4 bg-gray-50 border-l border-gray-200 flex flex-col">
        {/* Empty right side panel content */}
      </div>
    </div>
  );
};

export default MessageView;