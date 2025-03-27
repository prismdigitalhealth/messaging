import React, { useState, useEffect, useRef, useCallback } from "react";
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
 * - Supports both event-based updates and manual refresh
 */
const Chat = ({ userId, nickname = "", onConnectionError, sb }) => {
  // Channel state
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({});
  const [isRefreshingChannels, setIsRefreshingChannels] = useState(false);
  
  // Message state
  const [messages, setMessages] = useState([]);
  const [previousMessageQuery, setPreviousMessageQuery] = useState(null);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFileSending, setIsFileSending] = useState(false);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState("");
  
  // UI state
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  // Refs
  const messagesContainerRef = useRef(null);
  const channelHandlerRef = useRef(null); // Ref to store channel handler across renders
  const reconnectionHandlerRef = useRef(null); // Ref to store reconnection handler ID

  // Connect to Sendbird when component mounts or userId changes
  useEffect(() => {
    let isComponentMounted = true;
    let connectionTimeoutId = null;
    let reconnectionHandlerId = null;
    
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
   * Simplified version to avoid React hook errors
   */
  const refreshChannels = async () => {
    if (isRefreshingChannels) {
      console.log("Already refreshing channels, skipping");
      return false;
    }
    
    try {
      setIsRefreshingChannels(true);
      console.log("Manually refreshing channels");
      
      // Use the basic loadChannels method to avoid dependency issues
      const refreshedChannels = await ChannelService.loadChannels(sb, userId);
      
      // Update state with refreshed channels
      setChannels(refreshedChannels);
      
      // Update unread counts
      const updatedUnreadCounts = {};
      refreshedChannels.forEach(channel => {
        updatedUnreadCounts[channel.url] = channel.unreadMessageCount || 0;
      });
      setChannelUnreadCounts(updatedUnreadCounts);
      
      console.log("Channels refreshed successfully:", refreshedChannels.length);
      return true;
    } catch (error) {
      console.error("Error refreshing channels:", error);
      setError("Failed to refresh channels");
      return false;
    } finally {
      setIsRefreshingChannels(false);
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
   * @param {string} messageText - Text message to send
   * @returns {Promise<void>}
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
      
      // Note: We're not manually refreshing channels here anymore.
      // Instead, we rely on Sendbird's event system via onMessageReceived handler
      // which will automatically update the channel list when the message is confirmed.
      
    } catch (error) {
      console.error("Send message error:", error);
    }
  };
  
  /**
   * Send a file message to the selected channel with clear loading indicator
   * @param {Array<File>} files - Files to send
   * @param {string} messageText - Optional text message to include with the files
   * @returns {Promise<void>}
   */
  const sendFileMessage = async (files, messageText = "") => {
    if (!selectedChannel || !files || files.length === 0) return;
    
    const file = files[0]; // Focus on the first file for simplicity
    const isImage = file.type.startsWith('image/');
    const currentTimestamp = Date.now();
    
    try {
      // 1. Create and show an uploading message right away
      const uploadingMessage = {
        messageId: `uploading_${currentTimestamp}`,
        message: messageText,
        sender: { userId },
        createdAt: currentTimestamp,
        _isPending: true,
        _isUploading: true,
        uploadProgress: 0,
        messageType: "file",
        name: file.name,
        type: file.type,
        size: file.size,
        // For images, create a local preview URL
        _localImageUrl: isImage ? URL.createObjectURL(file) : null,
        _files: [file]
      };
      
      // Show the uploading indicator immediately
      console.log("Adding uploading message to UI:", uploadingMessage);
      setMessages(prevMessages => [...prevMessages, uploadingMessage]);
      
      // 2. Send the file with Sendbird
      const params = {
        file: file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        thumbnailSizes: isImage ? [{maxWidth: 400, maxHeight: 400}] : [],
        message: messageText || ""
      };
      
      // 3. Use direct Sendbird API for simpler, more reliable approach
      const fileMessageParams = selectedChannel.sendFileMessage(params);
      
      // Track upload progress and update UI
      if (fileMessageParams.onProgress) {
        fileMessageParams.onProgress((bytesSent, totalBytes) => {
          const progress = Math.round((bytesSent / totalBytes) * 100);
          console.log(`Upload progress: ${progress}%`);
          
          // Update the progress in the message
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.messageId === uploadingMessage.messageId ? 
                {...msg, uploadProgress: progress} : msg
            )
          );
        });
      }
      
      // 4. Wait for upload to complete
      const sentMessage = await new Promise((resolve, reject) => {
        fileMessageParams
          .onSucceeded(message => {
            console.log("File upload succeeded:", message);
            resolve(message);
          })
          .onFailed((error) => {
            console.error("File upload failed:", error);
            reject(error);
          });
      });
      
      // 5. IMPORTANT: Fetch the complete message to ensure we have all properties
      let completeMessage = sentMessage;
      
      try {
        if (selectedChannel.getMessageById && sentMessage.messageId) {
          // This fetch is critical for photos to display correctly
          const fetchedMessage = await selectedChannel.getMessageById(sentMessage.messageId);
          if (fetchedMessage) {
            completeMessage = fetchedMessage;
            console.log("Retrieved complete message:", completeMessage);
            
            // CRITICAL: Debug and log all important file properties
            if (completeMessage.type && completeMessage.type.startsWith('image/')) {
              console.log("Image properties found:", {
                url: completeMessage.url,
                thumbnails: completeMessage.thumbnails,
                type: completeMessage.type,
                name: completeMessage.name
              });
            }
          }
        }
      } catch (error) {
        console.warn("Could not fetch complete message:", error);
      }
      
      // 6. CRITICAL: Extract and preserve ALL properties needed for file display
      // Sendbird stores file information in different places depending on the message structure
      // This careful extraction ensures images display properly without requiring a refresh
      const extractFileProperties = (msg) => {
        // Start with the Sendbird file URL which could be in multiple locations
        let fileUrl = msg.url;
        
        // Some messages store the URL in a requiredMessageKeys.file structure
        if (!fileUrl && msg.requiredMessageKeys && msg.requiredMessageKeys.file) {
          fileUrl = msg.requiredMessageKeys.file.url;
        }
        
        // Message object might contain the URL (happens with file messages)
        if (!fileUrl && msg.message && typeof msg.message === 'object' && msg.message.url) {
          fileUrl = msg.message.url;
        }
        
        // Handle the case where msg.message is a FileMessage object itself
        if (!fileUrl && msg.message && msg.message.url) {
          fileUrl = msg.message.url;
        }
        
        // For thumbnails, check all possible locations
        let thumbnails = msg.thumbnails || [];
        if (!thumbnails.length && msg.message && msg.message.thumbnails) {
          thumbnails = msg.message.thumbnails;
        }
        
        return {
          url: fileUrl,
          name: msg.name || msg.fileName || file.name,
          type: msg.type || msg.mimeType || file.type,
          thumbnails: thumbnails,
          size: msg.size || file.size
        };
      };
      
      // Extract all file properties from the complete message
      const fileProps = extractFileProperties(completeMessage);
      console.log("Extracted file properties:", fileProps);
      
      // Create a complete message with all necessary properties
      const finalMessage = {
        ...completeMessage,
        messageType: "file",
        _isComplete: true,
        _isUploading: false,
        message: messageText || "",
        // Explicitly add all file properties
        url: fileProps.url,
        name: fileProps.name,
        type: fileProps.type,
        thumbnails: fileProps.thumbnails,
        size: fileProps.size,
        // Add the raw file data for thumbnail generation
        _rawFile: file
      };
      
      // Debug
      console.log("Final message with all properties:", finalMessage);
      
      // 7. Add the message to the UI after cleaning up the uploading version
      setMessages(prevMessages => {
        // First remove the uploading message
        const filteredMessages = prevMessages.filter(msg => 
          msg.messageId !== uploadingMessage.messageId
        );
        
        // Then add the complete message
        return [...filteredMessages, finalMessage].sort((a, b) => 
          (a.createdAt || 0) - (b.createdAt || 0)
        );
      });
      
      // Clean up any object URLs we created
      if (uploadingMessage._localImageUrl) {
        URL.revokeObjectURL(uploadingMessage._localImageUrl);
      }
      
      // Refresh the channel list
      await refreshChannels();
      
    } catch (error) {
      console.error("Send file message error:", error);
      
      // Update UI to show the error
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.messageId === `uploading_${currentTimestamp}` ? 
            {...msg, _isUploading: false, _isFailed: true} : msg
        )
      );
    } finally {
      setIsFileSending(false);
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
  
  // Event handlers setup with minimal dependencies
  useEffect(() => {
    // Skip if required objects aren't available
    if (!selectedChannel || !sb) return;
    
    console.log("Setting up message handlers for channel:", selectedChannel.url);
    
    // Create all handlers without using component state directly
    // We'll use these functions to manually update state when events occur
    const handlers = {
      // Will be called when a new message arrives
      handleMessageReceived: (channel, message) => {
        console.log("Message received in channel:", channel.url, message);
        
        // Process the message to ensure it has all necessary properties
        // This is crucial for file messages
        const processedMessage = {
          ...message,
          // Ensure we have the message text
          message: message.message || "",
          // Handle file message properties
          ...(message.type && message.type.startsWith("FILE") && {
            messageType: "file",
            name: message.name || "File",
            url: message.url || "",
            fileType: message.type || "application/octet-stream",
            size: message.size || 0
          }),
          // Ensure user information is available
          sender: message.sender || { userId: message.sender?.userId || "unknown" }
        };
        
        // Update messages if in the current channel
        if (channel.url === selectedChannel.url) {
          // Check if we already have a pending or local version of this message
          setMessages(prev => {
            const existingMsgIndex = prev.findIndex(msg => 
              // Match by messageId if available
              (msg.messageId && msg.messageId === message.messageId) ||
              // For local pending file messages, match by name and timestamp if close
              (msg._isPending && 
               msg.messageType === "file" && 
               msg.name === message.name && 
               Math.abs(msg.createdAt - message.createdAt) < 60000)
            );
            
            if (existingMsgIndex >= 0) {
              // Replace existing message with server copy
              const updatedMessages = [...prev];
              updatedMessages[existingMsgIndex] = processedMessage;
              return updatedMessages;
            } else {
              // Add as new message
              return [...prev, processedMessage];
            }
          });
        }
        
        // Update unread count for other channels
        if (channel.url !== selectedChannel.url && message.sender?.userId !== userId) {
          setChannelUnreadCounts(prev => ({
            ...prev,
            [channel.url]: (prev[channel.url] || 0) + 1
          }));
        }
        
        // Update the channel list with the new message
        setChannels(prev => {
          // Find and update the channel with the new message
          const updated = prev.map(ch => 
            ch.url === channel.url ? {...ch, lastMessage: message} : ch
          );
          
          // Sort by latest activity
          return updated.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt || a.createdAt || 0;
            const bTime = b.lastMessage?.createdAt || b.createdAt || 0;
            return bTime - aTime;
          });
        });
      },
      
      // Called when a message is updated
      handleMessageUpdated: (channel, message) => {
        // Only update messages if in the current channel
        if (channel.url === selectedChannel.url) {
          setMessages(prev => 
            prev.map(msg => msg.messageId === message.messageId ? message : msg)
          );
        }
      },
      
      // Called when a message is deleted
      handleMessageDeleted: (channel, messageId) => {
        // Only update if in the current channel
        if (channel.url === selectedChannel.url) {
          setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
        }
      },
      
      // Called when a channel is updated
      handleChannelChanged: (channel) => {
        setChannels(prev => 
          prev.map(ch => ch.url === channel.url ? channel : ch)
        );
        
        // Update selected channel if it's the current one
        if (channel.url === selectedChannel.url) {
          setSelectedChannel(channel);
        }
      }
    };
    
    // Generate a unique handler ID
    const handlerId = `channel_${selectedChannel.url.slice(-8)}_${Date.now()}`;
    
    try {
      // Register handlers with the chat SDK
      selectedChannel.addMessageReceivedHandler(handlerId, handlers.handleMessageReceived);
      selectedChannel.addMessageUpdatedHandler(handlerId, handlers.handleMessageUpdated);
      selectedChannel.addMessageDeletedHandler(handlerId, handlers.handleMessageDeleted);
      selectedChannel.addChannelChangedHandler(handlerId, handlers.handleChannelChanged);
      
      // Add file message specific handlers
      // This is critical for photo attachments to appear immediately
      if (sb.GroupChannel.addFileMessageHandler) {
        // Handler for when file upload completes successfully
        sb.GroupChannel.addFileMessageHandler(handlerId, (channel, message) => {
          console.log("File message completed:", message);
          if (channel.url === selectedChannel.url) {
            // Process file message with correct metadata
            const processedMessage = {
              ...message,
              messageType: "file",
              // Ensure file metadata is present
              name: message.name || "File",
              url: message.url || "",
              fileType: message.type || "application/octet-stream",
              size: message.size || 0,
              _isPending: false
            };
            
            // Update message in UI - replace any pending version
            setMessages(prevMessages => {
              const msgIndex = prevMessages.findIndex(msg => 
                // Match by messageId if available
                (msg.messageId && msg.messageId === message.messageId) ||
                // For pending files, match by name and approximate timestamp
                (msg._isPending && 
                 msg.messageType === "file" && 
                 msg.name === message.name && 
                 Math.abs(msg.createdAt - message.createdAt) < 60000)
              );
              
              if (msgIndex >= 0) {
                // Replace the pending message with the completed one
                const updatedMessages = [...prevMessages];
                
                // Clean up any local ObjectURLs to prevent memory leaks
                if (updatedMessages[msgIndex]._localUrls) {
                  updatedMessages[msgIndex]._localUrls.forEach(item => {
                    if (item.url) URL.revokeObjectURL(item.url);
                  });
                }
                
                updatedMessages[msgIndex] = processedMessage;
                return updatedMessages;
              } else {
                // If no matching message found, add as new
                return [...prevMessages, processedMessage];
              }
            });
          }
        });
      }
      
      // Store for cleanup
      channelHandlerRef.current = handlerId;
      
      console.log("Event handlers registered with ID:", handlerId);
    } catch (error) {
      console.error("Failed to register handlers:", error);
    }
    
    // Clean up function
    return () => {
      if (selectedChannel && channelHandlerRef.current) {
        try {
          console.log("Removing channel handlers:", channelHandlerRef.current);
          selectedChannel.removeMessageReceivedHandler(channelHandlerRef.current);
          selectedChannel.removeMessageUpdatedHandler(channelHandlerRef.current);
          selectedChannel.removeMessageDeletedHandler(channelHandlerRef.current);
          selectedChannel.removeChannelChangedHandler(channelHandlerRef.current);
        } catch (e) {
          console.error("Error cleaning up channel handlers:", e);
        }
      }
    };
  }, [selectedChannel, userId]); // Minimal dependency array

  // IMPORTANT: Reconnection handler temporarily removed to fix React hook errors
  // We will re-implement this after the application is stable
  // END OF REMOVED CODE
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Channel List */}
      <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-800">Messages</h1>
        </div>
        
        {/* Channel list container */}
        <div className="flex-1 overflow-y-auto">
          <ChannelList
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={selectChannel}
            unreadCounts={channelUnreadCounts}
            isConnected={isConnected}
            onCreateChannelClick={() => setIsCreatingChannel(true)}
          />
          
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
                <h2 className="text-sm font-semibold text-gray-800">{selectedChannel.name || `Channel ${selectedChannel.url.slice(-4)}`}</h2>
                <p className="text-xs text-gray-400 text-[10px]">
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
                onSendFileMessage={sendFileMessage}
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
      
      {/* Simple Right Side Panel */}
      <div className="w-[300px] bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-800">Right Side Panel</h3>
        </div>
        <div className="flex-1 p-4">
          {/* Empty panel content */}
        </div>
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
