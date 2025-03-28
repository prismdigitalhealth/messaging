/**
 * MessageService.js
 * Handles all message-related operations with Sendbird
 * - Includes file message support for images, videos, and other attachments
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
    
    // Create params object for message query with comprehensive settings for reactions
    let messageParams = {
      includeReactions: true,  // CRITICAL: Include all reactions
      includeParentMessageInfo: true, // Include parent message info for replies
      includeThreadInfo: true, // Include thread info if applicable
      includeMetaArray: true // Include message metadata
    };
    
    console.log('Message query params:', messageParams);
    
    // Create message query with parameters (using correct SDK method)
    let messageListQuery;
    
    try {
      // Proper approach for Sendbird SDK v4
      messageListQuery = channel.createPreviousMessageListQuery(messageParams);
      messageListQuery.limit = 50;
      
      // Double check that includeReactions is set (for SDK compatibility)
      if (messageListQuery.includeReactions !== undefined) {
        messageListQuery.includeReactions = true;
        console.log('Confirmed includeReactions is enabled on query');
      }
      
      // Also try additional methods if they exist
      if (messageListQuery.setIncludeReactions && typeof messageListQuery.setIncludeReactions === 'function') {
        messageListQuery.setIncludeReactions(true);
        console.log('Used setIncludeReactions method');
      }
      
      if ("reverse" in messageListQuery) {
        messageListQuery.reverse = true;
      }
    } catch (queryError) {
      console.error('Error creating sophisticated query:', queryError);
      // Fall back to basic approach
      messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.includeReactions = true;
      messageListQuery.limit = 50;
    }
    
    console.log('Loading messages with includeReactions parameter');
    const fetchedMessages = await messageListQuery.load();
    
    // Debug reactions for diagnostics - log comprehensive information
    const messagesWithReactions = fetchedMessages.filter(msg => msg.reactions && msg.reactions.length > 0);
    console.log(`Found ${messagesWithReactions.length} messages with reactions out of ${fetchedMessages.length} total`);
    
    // Log detailed information about each message with reactions
    messagesWithReactions.forEach(msg => {
      console.log(`Message ${msg.messageId} (${msg.message || 'no text'}) has reactions:`, 
        msg.reactions.map(r => `${r.key}:${r.userIds?.length || 0} users`).join(', '));
    });
    
    // Special debug: if we find no reactions but expect them, try direct access or fix
    if (messagesWithReactions.length === 0 && fetchedMessages.length > 0) {
      console.warn('⚠️ No messages with reactions found - possible SDK issue!');
      
      // Try to directly access reactions for diagnostic purposes
      try {
        const testMessage = fetchedMessages[0];
        console.log('Testing direct reaction access on message:', testMessage.messageId);
        
        // Check for direct reaction methods
        if (testMessage.getReactions && typeof testMessage.getReactions === 'function') {
          console.log('Using getReactions() method directly on message...');
          const directReactions = await testMessage.getReactions();
          console.log('Direct reactions result:', directReactions);
        }
      } catch (reactErr) {
        console.error('Direct reaction test failed:', reactErr);
      }
    }
    
    // Apply reactions from our two storage systems
    // 1. First check our new 'user_reactions' format (prioritize this)
    try {
      const storageKey = 'user_reactions';
      const storedReactions = localStorage.getItem(storageKey);
      
      if (storedReactions) {
        const userReactions = JSON.parse(storedReactions);
        console.log('Found stored user reactions for all users:', Object.keys(userReactions));
        
        // Get current user ID for prioritizing current user's reactions
        let currentUserId = null;
        try {
          const sb = window.sendbird || window.SendBird || (window.SBUGlobal && window.SBUGlobal.sbInstance);
          if (sb && sb.currentUser) {
            currentUserId = sb.currentUser.userId;
            console.log('Current user for reactions identified as:', currentUserId);
          }
        } catch (e) {}
        
        // Apply all reactions stored for all users
        Object.entries(userReactions).forEach(([userId, messageReactions]) => {
          // For each user's stored reactions
          Object.entries(messageReactions).forEach(([msgId, emojiKeys]) => {
            // Find the message if it exists in our fetched messages
            const message = fetchedMessages.find(msg => msg.messageId === msgId);
            if (message) {
              // Ensure message has reactions array
              if (!message.reactions) message.reactions = [];
              
              // Apply each emoji
              emojiKeys.forEach(emojiKey => {
                // Check if this reaction already exists
                let existingReaction = message.reactions.find(r => r.key === emojiKey);
                
                if (existingReaction) {
                  // Add user to existing reaction if not already there
                  if (!existingReaction.userIds.includes(userId)) {
                    existingReaction.userIds.push(userId);
                  }
                } else {
                  // Create new reaction with this user
                  message.reactions.push({
                    key: emojiKey,
                    userIds: [userId]
                  });
                }
              });
              
              console.log(`Applied ${emojiKeys.length} reactions from ${userId} to message ${msgId}`);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error applying user reactions from localStorage:', error);
    }
    
    // 2. Check legacy per-message reaction storage format (for backward compatibility)
    fetchedMessages.forEach(message => {
      try {
        const messageReactionsKey = `msg_reactions_${message.messageId}`;
        const savedReactionsJson = localStorage.getItem(messageReactionsKey);
        if (savedReactionsJson) {
          const savedReactions = JSON.parse(savedReactionsJson);
          if (savedReactions && savedReactions.length > 0) {
            // If no reactions exist yet, use the legacy ones
            if (!message.reactions || message.reactions.length === 0) {
              message.reactions = savedReactions;
              console.log(`Restored legacy reactions for message ${message.messageId}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error restoring legacy reactions for message ${message.messageId}:`, error);
      }
    });
    
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
    // Ensure reactions are included in the query
    previousMessageQuery.includeReactions = true;
    
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
  if (!channel || (!messageText || messageText.trim() === "")) {
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

/**
 * Send a file message to a channel
 * @param {Object} channel - Sendbird channel object
 * @param {Array<File>} files - Array of file objects to send
 * @param {string} messageText - Optional text message to include with the files
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} - The sent file message object
 */
/**
 * Add an emoji reaction to a message
 * @param {Object} message - Sendbird message object
 * @param {string} emojiKey - Key of the emoji to add
 * @returns {Promise<Object>} - The reaction event object
 */
// Helper function to store reaction in local storage
const saveReactionToLocalStorage = (userId, messageId, emojiKey, isAdd = true) => {
  try {
    // Get existing reactions or initialize new object
    const storageKey = 'user_reactions';
    let userReactions = {};
    const storedReactions = localStorage.getItem(storageKey);
    
    if (storedReactions) {
      userReactions = JSON.parse(storedReactions);
    }
    
    // Create userId and messageId entries if they don't exist
    if (!userReactions[userId]) {
      userReactions[userId] = {};
    }
    
    if (!userReactions[userId][messageId]) {
      userReactions[userId][messageId] = [];
    }
    
    // Add or remove the emoji reaction
    if (isAdd) {
      // Add if not already exists
      if (!userReactions[userId][messageId].includes(emojiKey)) {
        userReactions[userId][messageId].push(emojiKey);
      }
    } else {
      // Remove if exists
      userReactions[userId][messageId] = userReactions[userId][messageId]
        .filter(emoji => emoji !== emojiKey);
      
      // Clean up empty entries
      if (userReactions[userId][messageId].length === 0) {
        delete userReactions[userId][messageId];
      }
      
      if (Object.keys(userReactions[userId]).length === 0) {
        delete userReactions[userId];
      }
    }
    
    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(userReactions));
    console.log(`${isAdd ? 'Added' : 'Removed'} reaction ${emojiKey} for message ${messageId} in local storage`);
    return true;
  } catch (error) {
    console.error('Error saving reaction to local storage:', error);
    return false;
  }
};

export const addReaction = async (message, emojiKey) => {
  if (!message || !emojiKey) {
    throw new Error("Message and emoji key are required");
  }
  
  try {
    console.log(`Adding reaction '${emojiKey}' to message:`, message.messageId);
    
    // Get current user ID from Sendbird if possible
    let userId = null;
    try {
      // Try to get the Sendbird instance to find current user
      const sb = window.sendbird || window.SendBird || (window.SBUGlobal && window.SBUGlobal.sbInstance);
      if (sb) {
        userId = sb.currentUser?.userId;
      }
    } catch (e) {
      console.warn('Unable to get current userId:', e);
    }
    
    // 1. First, save to local storage for persistence regardless of Sendbird API result
    if (userId) {
      saveReactionToLocalStorage(userId, message.messageId, emojiKey, true);
    }
    
    // 2. Then try the standard Sendbird API approach
    const reactionEvent = await message.addReaction(emojiKey);
    console.log('REACTION EVENT DETAILS:', reactionEvent);
    
    // Apply the event to the message object if the method exists
    if (message.applyReactionEvent && typeof message.applyReactionEvent === 'function') {
      message.applyReactionEvent(reactionEvent);
    }
    
    // 3. Verify and log results
    if (message.reactions) {
      const reaction = message.reactions.find(r => r.key === emojiKey);
      console.log(`Reaction status: ${reaction ? 'Added to message' : 'Not found in message'}`);
    }
    
    return { reactionEvent, error: null, message };
  } catch (error) {
    console.error("Error adding reaction:", error);
    
    // Even if the Sendbird API fails, we still have local storage as backup
    return { reactionEvent: null, error, message };
  }
};

/**
 * Remove an emoji reaction from a message
 * @param {Object} message - Sendbird message object
 * @param {string} emojiKey - Key of the emoji to remove
 * @returns {Promise<Object>} - The reaction event object
 */
export const removeReaction = async (message, emojiKey) => {
  if (!message || !emojiKey) {
    throw new Error("Message and emoji key are required");
  }
  
  try {
    console.log(`Removing reaction '${emojiKey}' from message:`, message.messageId);
    
    // Get current user ID from Sendbird if possible
    let userId = null;
    try {
      // Try to get the Sendbird instance to find current user
      const sb = window.sendbird || window.SendBird || (window.SBUGlobal && window.SBUGlobal.sbInstance);
      if (sb) {
        userId = sb.currentUser?.userId;
      }
    } catch (e) {
      console.warn('Unable to get current userId:', e);
    }
    
    // 1. First, remove from local storage for persistence regardless of Sendbird API result
    if (userId) {
      saveReactionToLocalStorage(userId, message.messageId, emojiKey, false);
    }
    
    // 2. Then try the standard Sendbird API approach
    const reactionEvent = await message.deleteReaction(emojiKey);
    console.log('REACTION REMOVAL EVENT:', reactionEvent);
    
    // Apply the event to the message object if the method exists
    if (message.applyReactionEvent && typeof message.applyReactionEvent === 'function') {
      message.applyReactionEvent(reactionEvent);
    }
    
    // 3. Verify and log results
    if (message.reactions) {
      const stillExists = message.reactions.some(r => r.key === emojiKey && 
                           (r.userIds ? r.userIds.includes(reactionEvent.userId) : false));
      console.log(`Reaction removal status: ${stillExists ? 'Still exists (failed)' : 'Successfully removed'}`);
    }
    
    return { reactionEvent, error: null, message };
  } catch (error) {
    console.error("Error removing reaction:", error);
    
    // Even if the Sendbird API fails, we still have local storage as backup
    return { reactionEvent: null, error, message };
  }
};

export const sendFileMessage = async (channel, files, messageText = "", userId) => {
  if (!channel || !files || files.length === 0) {
    throw new Error("Channel and files are required");
  }
  
  const currentTimestamp = Date.now();
  
  // Create a pending message to return immediately
  const pendingMessage = {
    messageId: `pending_file_${currentTimestamp}`,
    message: messageText,
    sender: { userId },
    createdAt: currentTimestamp,
    _isPending: true,
    messageType: "file",
    name: files.length === 1 ? files[0].name : `${files.length} files`,
    fileType: files.length === 1 ? files[0].type : "multiple",
    size: files.reduce((total, file) => total + file.size, 0),
    _files: files
  };
  
  try {
    // We will return this reference to be updated as upload progresses
    let uploadProgress = 0;
    let sentMessage = null;
    
    // For a single file, use file message method (simplified for reliability)
    const file = files[0]; // Handle first file as primary (even if multiple)
    
    // Use promise-based approach for better control of the process
    await new Promise(async (resolve, reject) => {
      try {
        // Prepare params with the file
        const params = {
          file: file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          // For images, ensure we generate thumbnails for preview
          thumbnailSizes: file.type.startsWith('image/') ? [
            {maxWidth: 200, maxHeight: 200},
            {maxWidth: 400, maxHeight: 400}
          ] : [],
          message: messageText || ""
        };
        
        // Use the Promise-based sendFileMessage approach
        const fileMessageParams = channel.sendFileMessage(params);
        
        // Track upload progress
        if (fileMessageParams.onProgress) {
          fileMessageParams.onProgress((bytesSent, totalBytes) => {
            uploadProgress = Math.round((bytesSent / totalBytes) * 100);
            console.log(`File upload progress: ${uploadProgress}%`);
          });
        }
        
        // Handle upload completion
        fileMessageParams.onSucceeded((message) => {
          console.log("File upload completed successfully:", message);
          sentMessage = message;
          resolve(message);
        });
        
        // Handle upload failure
        fileMessageParams.onFailed((error) => {
          console.error("File upload failed:", error);
          reject(error);
        });
      } catch (err) {
        console.error("Error in file upload promise:", err);
        reject(err);
      }
    });
    
    console.log("File message sent, response:", sentMessage);
    
    // If we didn't get a message response, throw an error
    if (!sentMessage) {
      throw new Error("No message received from Sendbird after upload");
    }
    
    // Make sure the sent message has all required properties for display
    // This is critical for photos to display correctly
    const processedSentMessage = {
      ...sentMessage,
      // Ensure basic properties
      messageId: sentMessage.messageId,
      message: messageText || "",
      messageType: "file",
      name: sentMessage.name || files[0].name,
      url: sentMessage.url,  // Important for image display
      type: sentMessage.type || files[0].type,
      // Metadata
      sender: sentMessage.sender || { userId },
      createdAt: sentMessage.createdAt || currentTimestamp,
      // Status flags
      _isPending: false, 
      _isComplete: true
    };
    
    console.log("Processed message for return:", processedSentMessage);
    
    // Don't save to localStorage for now to simplify - rely on Sendbird
    
    return {
      pendingMessage,
      sentMessage: processedSentMessage
    };
  } catch (error) {
    console.error("Send file message error:", error);
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
