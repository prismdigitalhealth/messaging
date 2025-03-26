/**
 * ChannelService.js
 * Handles all channel-related operations with Sendbird
 */

/**
 * Load channels from Sendbird
 * @param {Object} sb - Sendbird SDK instance
 * @param {string} userId - Current user ID
 * @returns {Promise<Array>} - Array of channels sorted by latest activity
 */
export const loadChannels = async (sb, userId) => {
  try {
    // Ensure connection is established before querying channels
    if (!sb.currentUser) {
      console.log("No current user, reconnecting...");
      try {
        await sb.connect(userId);
      } catch (connectError) {
        console.error("Reconnection error:", connectError);
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
          
          // Sort by latest activity
          const sortedChannels = fetchedChannels.sort((a, b) => {
            const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
            const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
            return bTimestamp - aTimestamp;
          });
          
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
    
    return await fetchChannelsWithRetry(3);
  } catch (error) {
    console.error("Channel list outer error:", error);
    return [];
  }
};

/**
 * Join a channel by its URL
 * @param {Object} sb - Sendbird SDK instance
 * @param {string} userId - Current user ID
 * @param {string} channelUrl - URL of the channel to join
 * @returns {Promise<Object>} - The channel that was joined
 */
export const joinChannel = async (sb, userId, channelUrl) => {
  // Ensure we're connected before joining channel
  if (!sb.currentUser) {
    try {
      await sb.connect(userId);
      console.log("Reconnected before joining channel");
    } catch (connectError) {
      console.error("Failed to reconnect before joining channel:", connectError);
      throw new Error("Connection error. Please refresh and try again.");
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
  
  return await attemptJoinChannel(3);
};

/**
 * Create a new group channel
 * @param {Object} sb - Sendbird SDK instance
 * @param {string} userId - Current user ID
 * @param {string} channelName - Name for the new channel
 * @param {string} userIdsInput - Comma-separated list of user IDs to invite
 * @returns {Promise<Object>} - The created channel
 */
export const createGroupChannel = async (sb, userId, channelName, userIdsInput) => {
  if (!channelName.trim()) {
    throw new Error("Channel name is required");
  }
  
  // Parse user IDs to invite (excluding the current user)
  const userIdsToAdd = userIdsInput
    .split(',')
    .map(id => id.trim())
    .filter(id => id !== "" && id !== userId);
  
  console.log("Users to invite:", userIdsToAdd);
  
  // Channel creation params
  const params = {
    name: channelName.trim(),
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
      console.log("Attempting to invite users:", userIdsToAdd);
      
      await groupChannel.inviteWithUserIds(userIdsToAdd);
      console.log("Users invited successfully:", userIdsToAdd);
    } catch (inviteError) {
      console.error("Error inviting users:", inviteError);
      // Continue anyway since the channel is created
    }
  }
  
  return groupChannel;
};

/**
 * Configure and register channel event handlers
 * @param {Object} channel - The selected channel object
 * @param {string} handlerId - Unique ID for this handler
 * @param {Object} callbacks - Object containing event callback functions
 * @returns {string} - The handler ID
 */
export const setupChannelHandlers = (channel, handlerId, callbacks) => {
  if (!channel) {
    console.warn("Cannot setup handlers for undefined channel");
    return null;
  }
  
  console.log("Setting up channel handlers for:", channel.url);
  
  // Generate a unique handler ID
  const newHandlerId = handlerId || `channel_handler_${Date.now()}`;
  
  // Register individual handlers directly on the channel
  if (callbacks.onMessageReceived && channel.addMessageReceivedHandler) {
    channel.addMessageReceivedHandler(newHandlerId, callbacks.onMessageReceived);
  }
  
  if (callbacks.onMessageUpdated && channel.addMessageUpdatedHandler) {
    channel.addMessageUpdatedHandler(newHandlerId, callbacks.onMessageUpdated);
  }
  
  if (callbacks.onMessageDeleted && channel.addMessageDeletedHandler) {
    channel.addMessageDeletedHandler(newHandlerId, callbacks.onMessageDeleted);
  }
  
  if (callbacks.onChannelChanged && channel.addChannelChangedHandler) {
    channel.addChannelChangedHandler(newHandlerId, callbacks.onChannelChanged);
  }
  
  console.log(`Channel handlers registered with ID: ${newHandlerId}`);
  return newHandlerId;
};

/**
 * Remove channel handlers
 * @param {Object} channel - The channel object
 * @param {string} handlerId - ID of the handler to remove
 */
export const removeChannelHandlers = (channel, handlerId) => {
  if (!channel || !handlerId) return;
  
  try {
    // Remove individual handlers
    if (channel.removeMessageReceivedHandler) {
      channel.removeMessageReceivedHandler(handlerId);
    }
    
    if (channel.removeMessageUpdatedHandler) {
      channel.removeMessageUpdatedHandler(handlerId);
    }
    
    if (channel.removeMessageDeletedHandler) {
      channel.removeMessageDeletedHandler(handlerId);
    }
    
    if (channel.removeChannelChangedHandler) {
      channel.removeChannelChangedHandler(handlerId);
    }
    
    console.log(`Removed channel handlers with ID: ${handlerId}`);
  } catch (e) {
    console.error("Error removing channel handlers:", e);
  }
};

/**
 * Refresh channel data - useful for manual refresh or after reconnection
 * @param {Object} sb - Sendbird SDK instance
 * @param {string} userId - Current user ID
 * @param {boolean} refreshUnreadCounts - Whether to also refresh unread counts
 * @returns {Promise<Array>} - Updated array of channels
 */
export const refreshChannels = async (sb, userId, refreshUnreadCounts = true) => {
  try {
    console.log("Manual refresh of channels initiated");
    
    // Ensure connection is established
    if (!sb.currentUser) {
      console.log("No current user during refresh, reconnecting...");
      try {
        await sb.connect(userId);
      } catch (connectError) {
        console.error("Reconnection error during refresh:", connectError);
        throw new Error("Failed to reconnect during refresh");
      }
    }
    
    // Fetch the latest channels
    const channelListQuery = sb.groupChannel.createMyGroupChannelListQuery();
    channelListQuery.limit = 20;
    channelListQuery.includeEmpty = true;
    const fetchedChannels = await channelListQuery.next();
    
    // Refresh each channel to get the latest data if specified
    if (refreshUnreadCounts && Array.isArray(fetchedChannels) && fetchedChannels.length > 0) {
      // Process in batches to avoid overloading
      const batchSize = 5;
      const batches = Math.ceil(fetchedChannels.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, fetchedChannels.length);
        const batch = fetchedChannels.slice(startIdx, endIdx);
        
        await Promise.all(
          batch.map(async (channel) => {
            try {
              // This updates all channel data including messages and unread counts
              await channel.refresh();
            } catch (refreshError) {
              console.error(`Error refreshing channel ${channel.url}:`, refreshError);
              // Continue with other channels even if one fails
            }
          })
        );
      }
    }
    
    // Sort by latest activity
    const sortedChannels = fetchedChannels.sort((a, b) => {
      const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
      const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
      return bTimestamp - aTimestamp;
    });
    
    return sortedChannels;
  } catch (error) {
    console.error("Channel refresh error:", error);
    throw error;
  }
};

/**
 * Connect to Sendbird
 * @param {Object} sb - Sendbird SDK instance
 * @param {string} userId - Current user ID
 * @param {string} nickname - User nickname (optional)
 * @param {Function} onProgress - Callback for connection progress events
 * @returns {Promise<Object>} - The connected user object
 */
export const connectToSendbird = async (sb, userId, nickname, onProgress) => {
  if (!userId) {
    throw new Error("No user ID provided");
  }
  
  onProgress && onProgress({ isConnecting: true });
  
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
  
  onProgress && onProgress({ isConnected: true, isConnecting: false });
  
  return user;
};

/**
 * Disconnect from Sendbird
 * @param {Object} sb - Sendbird SDK instance
 */
export const disconnectFromSendbird = async (sb) => {
  try {
    // Only disconnect if we're actually connected
    if (sb.currentUser) {
      await sb.disconnect();
      console.log("Disconnected from Sendbird");
    }
  } catch (e) {
    console.error("Error disconnecting:", e);
  }
};
