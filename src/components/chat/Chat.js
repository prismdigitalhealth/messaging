import React, { useState, useEffect, useRef } from "react";
import ChannelList from "./ChannelList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import CreateChannelModal from "./CreateChannelModal";

// Import services
import * as ChannelService from "./services/ChannelService";
import * as MessageService from "./services/MessageService";

/**
 * Main Chat component that integrates all chat functionality
 * - Handles connection to Sendbird
 * - Manages channels and messages
 * - Coordinates between sub-components
 */
const Chat = ({ userId, nickname = "", onConnectionError, sb }) => {
  // Channel state
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({});
  
  // Message state
  const [messages, setMessages] = useState([]);
  const [previousMessageQuery, setPreviousMessageQuery] = useState(null);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState("");
  
  // UI state
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  // Refs
  const messagesContainerRef = useRef(null);
  const channelHandlerRef = useRef(null); // Ref to store channel handler across renders

  // Connect to Sendbird when component mounts or userId changes
  useEffect(() => {
    let isComponentMounted = true;
    let connectionTimeoutId = null;
    
    const initializeConnection = async () => {
      if (!userId) {
        if (isComponentMounted) {
          setError("No user ID provided. Please log in again.");
          setIsConnecting(false);
        }
        return;
      }
      
      setIsConnecting(true);
      
      // Set a connection timeout
      connectionTimeoutId = setTimeout(() => {
        if (isComponentMounted) {
          setIsConnected(false);
          setIsConnecting(false);
          setError("Connection timeout. Please refresh and try again.");
          if (onConnectionError) {
            onConnectionError("Connection timeout. Please refresh and try again.");
          }
        }
      }, 15000); // 15 second timeout
      
      try {
        // Connect to Sendbird using the service
        await ChannelService.connectToSendbird(sb, userId, nickname, (state) => {
          if (isComponentMounted) {
            if (state.isConnected !== undefined) setIsConnected(state.isConnected);
            if (state.isConnecting !== undefined) setIsConnecting(state.isConnecting);
          }
        });
        
        if (!isComponentMounted) return;
        
        // Clear timeout
        clearTimeout(connectionTimeoutId);
        connectionTimeoutId = null;
        
        // Set connection state
        setIsConnected(true);
        setIsConnecting(false);
        setError("");
        
        // Load channels after successful connection
        await loadInitialChannels();
      } catch (error) {
        console.error("Sendbird connection error:", error);
        
        if (!isComponentMounted) return;
        
        // Clear timeout if it exists
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
          connectionTimeoutId = null;
        }
        
        // Format error message
        let errorMessage = "Failed to connect to chat server.";
        
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
    
    initializeConnection();
    
    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
      }
      
      ChannelService.disconnectFromSendbird(sb);
    };
  }, [userId, nickname, onConnectionError, sb]);

  // Forward connection errors to parent component
  useEffect(() => {
    if (error && error.includes("Connection") && onConnectionError) {
      onConnectionError(error);
    }
  }, [error, onConnectionError]);

  /**
   * Load initial channels and select the first one
   */
  const loadInitialChannels = async () => {
    try {
      const sortedChannels = await ChannelService.loadChannels(sb, userId);
      
      // Update channel state
      setChannels(sortedChannels);
      
      // Update unread counts state
      const unreadCountsMap = {};
      sortedChannels.forEach(channel => {
        unreadCountsMap[channel.url] = channel.unreadMessageCount || 0;
      });
      setChannelUnreadCounts(unreadCountsMap);
      
      // Select the first channel if available
      if (sortedChannels && sortedChannels.length > 0) {
        const firstChannel = sortedChannels[0];
        setSelectedChannel(firstChannel);
        await loadChannelMessages(firstChannel);
      }
      
      return sortedChannels;
    } catch (error) {
      console.error("Error loading initial channels:", error);
      setError("Failed to load channels. Please try again.");
      return [];
    }
  };
  
  /**
   * Refresh the channel list
   */
  const refreshChannels = async () => {
    try {
      const sortedChannels = await ChannelService.loadChannels(sb, userId);
      setChannels(sortedChannels);
      
      // Update unread counts state
      const unreadCountsMap = {};
      sortedChannels.forEach(channel => {
        unreadCountsMap[channel.url] = channel.unreadMessageCount || 0;
      });
      setChannelUnreadCounts(unreadCountsMap);
      
      return sortedChannels;
    } catch (error) {
      console.error("Error refreshing channels:", error);
      return [];
    }
  };
  
  /**
   * Select a channel and load its messages
   */
  const selectChannel = async (channel) => {
    if (!channel || channel.url === selectedChannel?.url) return;
    
    try {
      const joinedChannel = await ChannelService.joinChannel(sb, userId, channel.url);
      
      // Update selected channel
      setSelectedChannel(joinedChannel);
      
      // Reset unread count for this channel
      setChannelUnreadCounts(prev => ({
        ...prev,
        [joinedChannel.url]: 0
      }));
      
      // Mark the channel as read
      await MessageService.markChannelAsRead(joinedChannel);
      
      // Load messages
      await loadChannelMessages(joinedChannel);
    } catch (error) {
      console.error("Error selecting channel:", error);
      setError("Failed to join channel. Please try again.");
    }
  };
  
  /**
   * Load messages for a channel
   */
  const loadChannelMessages = async (channel) => {
    if (!channel) return;
    
    // Set loading state
    setMessages([
      { _isLoading: true, messageId: "loading-indicator", message: "Loading messages..." }
    ]);
    
    try {
      // Load messages using the service
      const { messages: channelMessages, query } = await MessageService.loadMessages(channel);
      
      // Update state
      setMessages(channelMessages);
      setPreviousMessageQuery(query);
      setHasMoreMessages(true);
      setIsLoadingMoreMessages(false);
    } catch (error) {
      console.error("Error loading messages:", error);
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
      const { messages: oldMessages, hasMore } = await MessageService.loadMoreMessages(previousMessageQuery);
      
      if (oldMessages && oldMessages.length > 0) {
        console.log(`Loaded ${oldMessages.length} more older messages`);
        
        // Prepend old messages to the beginning of the current messages list
        setMessages(prevMessages => [
          ...oldMessages,
          ...prevMessages
        ]);
        
        // Update hasMore flag
        setHasMoreMessages(hasMore);
        
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
   * Send a message to the selected channel
   */
  const sendMessage = async (messageText) => {
    if (!selectedChannel || messageText.trim() === "") return;
    
    try {
      // Send message using the service
      const { pendingMessage, sentMessage, error: sendError } = 
        await MessageService.sendMessage(selectedChannel, messageText, userId);
      
      // Add pending message to the UI immediately
      setMessages((prevMessages) => [...prevMessages, pendingMessage]);
      
      // If there was an error, the pendingMessage will have _isFailed set
      if (pendingMessage._isFailed) {
        throw sendError || new Error("Failed to send message");
      }
      
      // Replace the pending message with the actual sent message
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ? 
            sentMessage : msg
        )
      );
      
    } catch (error) {
      console.error("Send message error:", error);
    }
  };
  
  /**
   * Retry sending a failed message
   */
  const retryFailedMessage = (failedMessage) => {
    if (!failedMessage.message) return;
    
    // Remove the failed message
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => msg.messageId !== failedMessage.messageId)
    );
    
    // Attempt to send the message again
    sendMessage(failedMessage.message);
  };
  
  /**
   * Create a new channel
   */
  const createNewChannel = async (channelName, userIdsInput) => {
    try {
      // Create channel using the service
      const groupChannel = await ChannelService.createGroupChannel(sb, userId, channelName, userIdsInput);
      
      // Update channel list
      await refreshChannels();
      
      // Select the new channel
      setSelectedChannel(groupChannel);
      await loadChannelMessages(groupChannel);
      
      return groupChannel;
    } catch (error) {
      console.error("Error creating channel:", error);
      setError(`Failed to create channel: ${error.message || "Unknown error"}`);
      throw error;
    }
  };
  
  // Set up channel event handlers when selectedChannel changes
  useEffect(() => {
    if (!selectedChannel || !isConnected || !sb) return;
    
    // Get handler ID from channel URL to ensure uniqueness
    const handlerId = `channel_handler_${selectedChannel.url.slice(-8)}`;
    
    // Message received handler
    const onMessageReceived = (channel, message) => {
      console.log("Message received:", message, "in channel:", channel.url);
      
      // Update unread count if message is in a different channel and not from the current user
      if (channel.url !== selectedChannel?.url && message.sender?.userId !== userId) {
        setChannelUnreadCounts(prev => ({
          ...prev,
          [channel.url]: (prev[channel.url] || 0) + 1
        }));
      }
      
      // If this is the currently selected channel, add the message to the UI
      if (selectedChannel?.url === channel.url) {
        // Add the message to the messages state
        setMessages((prevMessages) => [...prevMessages, message]);
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
    
    // Message updated handler
    const onMessageUpdated = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        // Update the message in the messages state
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.messageId === message.messageId ? message : msg
          )
        );
      }
    };
    
    // Message deleted handler
    const onMessageDeleted = (channel, messageId) => {
      if (selectedChannel.url === channel.url) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageId !== messageId)
        );
      }
    };
    
    // Channel changed handler
    const onChannelChanged = (channel) => {
      setChannels((prevChannels) =>
        prevChannels.map((ch) => (ch.url === channel.url ? channel : ch))
      );
      if (selectedChannel.url === channel.url) {
        setSelectedChannel(channel);
      }
    };
    
    // Set up channel handlers using the service - pass the selectedChannel directly
    const newHandlerId = ChannelService.setupChannelHandlers(selectedChannel, handlerId, {
      onMessageReceived,
      onMessageUpdated,
      onMessageDeleted,
      onChannelChanged
    });
    
    // Store the handler ID for cleanup
    channelHandlerRef.current = newHandlerId;
    
    // Clean up when the component unmounts or selectedChannel changes
    return () => {
      try {
        // Use the new removeChannelHandlers method from the service
        ChannelService.removeChannelHandlers(selectedChannel, newHandlerId);
      } catch (e) {
        console.error("Error removing channel handler:", e);
      }
    };
  }, [selectedChannel, isConnected, userId, sb]);
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Channel List */}
      <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold text-gray-800">Messages</h1>
        </div>
        
        {/* Categories */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Groups</h2>
            <button
              onClick={() => setIsCreatingChannel(true)}
              className="text-gray-500 hover:text-blue-500 transition-colors"
              disabled={!isConnected}
              title="Create New Channel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Main channel list */}
          <div className="flex-1 overflow-y-auto">
            <ChannelList
              channels={channels}
              selectedChannel={selectedChannel}
              onSelectChannel={selectChannel}
              unreadCounts={channelUnreadCounts}
              isConnected={isConnected}
              onCreateChannelClick={() => setIsCreatingChannel(true)}
            />
          </div>
          
          {/* Connect button (if not connected) */}
          {!isConnected && !isConnecting && (
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Channel Header */}
        {selectedChannel ? (
          <div className="bg-white py-3 px-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center mr-3">
                {selectedChannel.name ? selectedChannel.name.charAt(0).toUpperCase() : "C"}
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">{selectedChannel.name || `Channel ${selectedChannel.url.slice(-4)}`}</h2>
                <p className="text-xs text-gray-400">
                  Last seen {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button className="text-blue-500 p-2 rounded-full hover:bg-blue-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <button className="text-blue-500 p-2 rounded-full hover:bg-blue-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button className="text-gray-400 p-2 rounded-full hover:bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 border-b border-gray-200 shadow-sm">
            <div className="w-full text-center text-gray-400">
              {isConnected ? "Select a conversation" : "Connecting..."}
            </div>
          </div>
        )}
        
        {/* Messages Area */}
        {selectedChannel ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <MessageList
              messages={messages}
              currentUserId={userId}
              isLoadingMoreMessages={isLoadingMoreMessages}
              hasMoreMessages={hasMoreMessages}
              onLoadMoreMessages={loadMoreMessages}
              retryFailedMessage={retryFailedMessage}
              ref={messagesContainerRef}
            />
            <div className="border-t border-gray-100 bg-white p-3">
              <MessageInput
                onSendMessage={sendMessage}
                isDisabled={!isConnected || !selectedChannel}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <div className="text-center max-w-md p-8 rounded-lg">
              {isConnecting ? (
                <div className="flex flex-col items-center p-4">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Connecting to chat server...</p>
                </div>
              ) : error ? (
                <div className="p-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
                  <p className="font-bold text-lg mb-2">Connection Error</p>
                  <p>{error}</p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="p-8">
                  <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-700">No Conversation Selected</p>
                  <p className="text-gray-500 mt-2">Select an existing conversation or create a new one</p>
                  <button
                    onClick={() => setIsCreatingChannel(true)}
                    className="mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                  >
                    Start New Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={isCreatingChannel}
        onClose={() => setIsCreatingChannel(false)}
        onCreate={createNewChannel}
      />
    </div>
  );
};

export default Chat;
