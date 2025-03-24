import "tailwindcss/tailwind.css";
import React, { useEffect, useState, useRef } from "react";

// Simple local storage for reactions
const localReactions = {};

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // Stores messageId for which emoji picker is shown
  const [messageReactions, setMessageReactions] = useState({});
  const messagesEndRef = useRef(null);
  
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
  
  // Common emoji options
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  
  // Initialize reactions when component mounts
  useEffect(() => {
    // Load any saved reactions from localStorage
    try {
      const savedReactions = localStorage.getItem('messageReactions');
      if (savedReactions) {
        setMessageReactions(JSON.parse(savedReactions));
      }
    } catch (error) {
      console.error('Error loading saved reactions:', error);
    }
  }, []);
  
  // Save reactions to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('messageReactions', JSON.stringify(messageReactions));
    } catch (error) {
      console.error('Error saving reactions:', error);
    }
  }, [messageReactions]);
  
  // Add or remove a reaction
  const addReaction = (messageId, emoji) => {
    setMessageReactions(prevReactions => {
      // Create a deep copy of the current reactions
      const newReactions = JSON.parse(JSON.stringify(prevReactions));
      
      // Initialize message reactions if not present
      if (!newReactions[messageId]) {
        newReactions[messageId] = {};
      }
      
      // Initialize emoji reactions if not present
      if (!newReactions[messageId][emoji]) {
        newReactions[messageId][emoji] = [];
      }
      
      // Check if user already reacted
      const userIndex = newReactions[messageId][emoji].indexOf(userId);
      
      if (userIndex > -1) {
        // Remove user's reaction
        newReactions[messageId][emoji].splice(userIndex, 1);
        
        // Remove emoji if no users left
        if (newReactions[messageId][emoji].length === 0) {
          delete newReactions[messageId][emoji];
        }
        
        // Remove message entry if no reactions left
        if (Object.keys(newReactions[messageId]).length === 0) {
          delete newReactions[messageId];
        }
      } else {
        // Add user's reaction
        newReactions[messageId][emoji].push(userId);
      }
      
      return newReactions;
    });
    
    // Close emoji picker after selecting
    setShowEmojiPicker(null);
  };

  // Channel event handlers
  useEffect(() => {
    if (!selectedChannel || !isConnected) return;

    const onMessageReceived = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        // No need to add reactions property to messages anymore
        setMessages((prevMessages) => [...prevMessages, message]);
      }
      setChannels((prevChannels) =>
        prevChannels.map((ch) =>
          ch.url === channel.url ? { ...ch, lastMessage: message } : ch
        )
      );
    };

    const onMessageUpdated = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        // Ensure reactions property is preserved
        const updatedMessage = {
          ...message,
          reactions: message.reactions || {}
        };
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.messageId === message.messageId ? updatedMessage : msg
          )
        );
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
      loadMessages(channel);
    } catch (error) {
      console.error("Channel join outer error:", error);
      setError("Failed to join channel. Please try again.");
    }
  };

  const loadMessages = async (channel) => {
    if (!channel) return;
    setMessages([
      { _isLoading: true, messageId: "loading-indicator", message: "Loading messages..." },
    ]);
    try {
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
      if (fetchedMessages.length === 0) {
        setMessages([{
          messageId: "welcome-msg",
          message: `Welcome to ${channel.name || "this channel"}! Send your first message to start the conversation.`,
          createdAt: Date.now(),
          sender: { userId: "system" },
          _isSystemMessage: true,
          reactions: {}
        }]);
      } else {
        // No need to add reactions property to messages anymore
        setMessages(fetchedMessages);
      }
    } catch (error) {
      console.error("Message load error:", error);
      setMessages([{
        messageId: "error-msg",
        message: `Failed to load messages: ${error.message}`,
        createdAt: Date.now(),
        sender: { userId: "system" },
        _isSystemMessage: true,
      }]);
    }
  };

  const sendMessage = async () => {
    if (!selectedChannel || newMessage.trim() === "") return;
    
    // Store the original message text
    const messageText = newMessage.trim();
    const currentTimestamp = Date.now();
    
    // Create a pending message
    const pendingMessage = {
      messageId: currentTimestamp.toString(),
      message: messageText,
      sender: { userId },
      createdAt: currentTimestamp,
      _isPending: true,
      messageType: "user",
    };
    
    setMessages((prevMessages) => [...prevMessages, pendingMessage]);
    setNewMessage("");
    
    try {
      const params = { 
        message: messageText,
        // Adding data with empty reactions object to ensure reactions can be added later
        data: JSON.stringify({ 
          text: messageText,
          reactions: {}
        })
      };
      
      const sentMessage = await selectedChannel.sendUserMessage(params);
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
        createdAt: sendBirdTimestamp || currentTimestamp
      };
      
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ? 
            processedSentMessage : msg
        )
      );
    } catch (error) {
      console.error("Send message error:", error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ?
            { ...msg, _isFailed: true } : msg
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
                  <div className="w-12 h-12 bg-gray-300 rounded-full mr-3"></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{ch.name || "(No channel name)"}</p>
                    <p className={`text-xs truncate ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                      {ch.lastMessage ? getMessageText(ch.lastMessage) : "Tap to start conversation"}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold ${isActive ? "text-gray-300" : "text-gray-500"}`}>
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
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
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
                                
                                {/* Emoji reaction button */}
                                {!message._isSystemMessage && !message._isLoading && (
                                  <button 
                                    onClick={() => setShowEmojiPicker(showEmojiPicker === message.messageId ? null : message.messageId)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                                  >
                                    <span className="text-xs">😀</span>
                                  </button>
                                )}
                                
                                {/* Emoji picker */}
                                {showEmojiPicker === message.messageId && (
                                  <div className="absolute top-0 right-0 transform -translate-y-full mt-2 bg-white rounded-lg shadow-lg p-2 z-10">
                                    <div className="flex space-x-2">
                                      {commonEmojis.map(emoji => (
                                        <button 
                                          key={emoji} 
                                          onClick={() => addReaction(message.messageId, emoji)}
                                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Display reactions */}
                                {messageReactions[message.messageId] && Object.keys(messageReactions[message.messageId]).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(messageReactions[message.messageId]).map(([emoji, users]) => (
                                      <button
                                        key={emoji}
                                        onClick={() => addReaction(message.messageId, emoji)}
                                        className={`flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-0.5 ${users.includes(userId) ? 'ring-1 ring-indigo-400' : ''}`}
                                      >
                                        <span>{emoji}</span>
                                        <span className="text-xs">{users.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
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
              placeholder="Write your message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                // Auto-resize the textarea
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1 p-2 focus:outline-none text-black resize-none overflow-hidden min-h-[40px] max-h-[150px]"
              rows="1"
              style={{ height: 'auto' }}
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