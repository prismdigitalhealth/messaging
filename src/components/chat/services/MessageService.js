/**
 * MessageService.js
 * Handles all message-related operations with Sendbird
 */
import { extractTimestamp } from '../utils';

/**
 * Load messages for a channel
 * @param {Object} channel - Sendbird channel object
 * @returns {Promise<Array>} - Array of messages
 */
export const loadMessages = async (channel) => {
  if (!channel) {
    throw new Error("No channel provided");
  }
  
  try {
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
    
    return {
      messages: mergedMessages.length === 0 ? 
        [{
          messageId: "welcome-msg",
          message: `Welcome to ${channel.name || "this channel"}! Send your first message to start the conversation.`,
          createdAt: Date.now(),
          sender: { userId: "system" },
          _isSystemMessage: true
        }] : mergedMessages,
      query: messageListQuery
    };
  } catch (error) {
    console.error("Message load error:", error);
    return {
      messages: [{
        messageId: "error-msg",
        message: `Failed to load messages: ${error.message}`,
        createdAt: Date.now(),
        sender: { userId: "system" },
        _isSystemMessage: true
      }],
      query: null
    };
  }
};

/**
 * Load more (older) messages
 * @param {Object} previousMessageQuery - Sendbird message query object
 * @returns {Promise<Array>} - Array of older messages
 */
export const loadMoreMessages = async (previousMessageQuery) => {
  if (!previousMessageQuery) {
    throw new Error("No message query provided");
  }
  
  try {
    // Load previous messages
    const oldMessages = await previousMessageQuery.load();
    
    return {
      messages: oldMessages,
      hasMore: oldMessages && oldMessages.length >= previousMessageQuery.limit
    };
  } catch (error) {
    console.error("Error loading more messages:", error);
    throw error;
  }
};

/**
 * Send a message to a channel
 * @param {Object} channel - Sendbird channel object
 * @param {string} messageText - Message text to send
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} - The sent message object
 */
export const sendMessage = async (channel, messageText, userId) => {
  if (!channel || messageText.trim() === "") {
    throw new Error("Channel and message text are required");
  }
  
  const currentTimestamp = Date.now();
  
  // Create a pending message to return immediately
  const pendingMessage = {
    messageId: `pending_${currentTimestamp}`,
    message: messageText,
    sender: { userId },
    createdAt: currentTimestamp,
    _isPending: true,
    messageType: "user",
  };
  
  try {
    // Prepare message parameters with metadata
    const params = { 
      message: messageText,
      data: JSON.stringify({ 
        text: messageText
      })
    };
    
    // Send the message to Sendbird
    const sentMessage = await channel.sendUserMessage(params);
    console.log("Sent message response:", sentMessage);
    
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
    
    // Save sent message to localStorage
    try {
      const channelMessagesKey = `messages_${channel.url}`;
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
    
    return {
      pendingMessage,
      sentMessage: processedSentMessage
    };
  } catch (error) {
    console.error("Send message error:", error);
    // Return the pending message with a failed flag
    return {
      pendingMessage: { 
        ...pendingMessage, 
        _isPending: false, 
        _isFailed: true 
      },
      error
    };
  }
};

/**
 * Mark a channel as read
 * @param {Object} channel - Sendbird channel object
 */
export const markChannelAsRead = async (channel) => {
  if (!channel) return;
  
  try {
    if (channel.markAsRead) {
      await channel.markAsRead();
    }
  } catch (error) {
    console.error("Error marking channel as read:", error);
  }
};
