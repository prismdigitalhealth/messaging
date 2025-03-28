import React, { useRef, useEffect } from "react";
import { getMessageText, formatMessageTime, groupMessages } from "./utils";
import EmojiReactions from "./EmojiReactions";

/**
 * Renders an appropriate file attachment preview based on the file type
 */
const FileAttachment = ({ message }) => {
  // First check for local URLs (for immediate display during upload)
  if (message._localUrls && message._localUrls.length > 0) {
    return (
      <div className="space-y-2">
        {message._localUrls.map((fileInfo, index) => {
          const isImage = fileInfo.type && fileInfo.type.startsWith("image/");
          const isVideo = fileInfo.type && fileInfo.type.startsWith("video/");
          
          if (isImage) {
            return (
              <div key={index} className="mb-2">
                <div className="relative group">
                  <img 
                    src={fileInfo.url} 
                    alt={fileInfo.name}
                    className="max-w-full rounded-lg shadow-sm max-h-60 object-contain" 
                  />
                  {message._isPending && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      Uploading...
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">{fileInfo.name}</div>
              </div>
            );
          } else if (isVideo) {
            return (
              <div key={index} className="mb-2">
                <div className="relative">
                  <video 
                    src={fileInfo.url} 
                    controls 
                    className="max-w-full rounded-lg shadow-sm max-h-60 border border-gray-200"
                  />
                  {message._isPending && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      Uploading...
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">{fileInfo.name}</div>
              </div>
            );
          } else {
            return (
              <div key={index} className="flex items-center p-2 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                <div className="mr-2 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-sm font-medium truncate">{fileInfo.name}</div>
                  <div className="text-xs text-gray-500">{Math.round(fileInfo.size / 1024)} KB</div>
                </div>
                {message._isPending && (
                  <div className="text-xs bg-gray-200 rounded px-1.5 py-0.5 ml-2">Uploading...</div>
                )}
              </div>
            );
          }
        })}
      </div>
    );
  }
  
  // Show loading indicator for messages that are currently uploading
  if (message._isUploading) {
    return (
      <div className="space-y-2">
        {message._files && message._files.map((file, index) => {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          
          // Create object URL for local preview
          const objectUrl = URL.createObjectURL(file);
          
          if (isImage) {
            return (
              <div key={index} className="mb-2">
                <div className="relative">
                  <div className="w-full h-[200px] rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img 
                      src={objectUrl} 
                      alt={file.name}
                      className="max-w-full max-h-[200px] object-contain opacity-60" 
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-30">
                      <svg className="animate-spin h-8 w-8 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <div className="text-white text-sm font-medium">Uploading photo...</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>{file.name}</span>
                  <span className="text-blue-500">{Math.round(file.size / 1024)} KB</span>
                </div>
              </div>
            );
          } else if (isVideo) {
            return (
              <div key={index} className="mb-2">
                <div className="relative rounded-lg overflow-hidden bg-gray-800">
                  <div className="w-full h-[180px] flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center text-white">
                      <svg className="animate-spin h-8 w-8 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <div className="text-sm font-medium">Uploading video...</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>{file.name}</span>
                  <span className="text-blue-500">{Math.round(file.size / 1024)} KB</span>
                </div>
              </div>
            );
          } else {
            return (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                <div className="mr-3 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</div>
                </div>
                <div className="ml-3 flex items-center">
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  }
  
  // Handle file messages with Sendbird's file URL structure
  // Check all possible places where Sendbird might store file URLs
  const getFileUrl = (message) => {
    // Direct URL property (most common)
    if (message.url) return message.url;
    
    // URL in message object (sometimes happens with Sendbird)
    if (message.message && message.message.url) return message.message.url;
    
    // URL in file property
    if (message.file && message.file.url) return message.file.url;
    
    // Thumbnails (if available and we're dealing with images)
    if (message.thumbnails && message.thumbnails.length > 0) return message.thumbnails[0].url;
    
    // Check for requiredMessageKeys structure
    if (message.messageParams && message.messageParams.file && message.messageParams.file.url) {
      return message.messageParams.file.url;
    }
    
    // Last resort: check messageParams directly
    if (message.messageParams && message.messageParams.url) return message.messageParams.url;
    
    return null;
  };
  
  // Try to get file URL from any possible location
  const fileUrl = getFileUrl(message);
  
  if (fileUrl) {
    console.log("Found file URL:", fileUrl); // Debugging
    const fileName = message.name || message.fileName || (message.messageParams && message.messageParams.fileName) || "File";
    const fileType = 
      message.type || 
      message.mimeType || 
      (message.messageParams && message.messageParams.mimeType) || 
      (fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "");
    
    // Function to determine if the file is an image based on mime type or file extension
    const isImage = () => {
      // Check all possible type fields
      if ((message.type && message.type.startsWith("image/")) ||
          (message.mimeType && message.mimeType.startsWith("image/")) ||
          (message.messageParams && message.messageParams.mimeType && 
           message.messageParams.mimeType.startsWith("image/"))) {
        return true;
      }
      
      // File extension check
      const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
      const ext = fileType.toLowerCase();
      if (imageExtensions.includes(ext)) return true;
      
      // Check URL for image extensions
      return imageExtensions.some(ext => fileUrl.toLowerCase().endsWith(`.${ext}`));
    };
    
    // Function to determine if the file is a video based on mime type or file extension
    const isVideo = () => {
      // Check all possible type fields
      if ((message.type && message.type.startsWith("video/")) ||
          (message.mimeType && message.mimeType.startsWith("video/")) ||
          (message.messageParams && message.messageParams.mimeType && 
           message.messageParams.mimeType.startsWith("video/"))) {
        return true;
      }
      
      // File extension check
      const videoExtensions = ["mp4", "webm", "ogg", "mov"];
      const ext = fileType.toLowerCase();
      if (videoExtensions.includes(ext)) return true;
      
      // Check URL for video extensions
      return videoExtensions.some(ext => fileUrl.toLowerCase().endsWith(`.${ext}`));
    };
    
    // Render based on file type
    if (isImage()) {
      return (
        <div className="mb-2">
          <div className="relative group cursor-pointer">
            <img 
              src={fileUrl} 
              alt={fileName}
              className="max-w-full rounded-lg shadow-sm max-h-60 object-contain hover:shadow-md transition-shadow" 
              onClick={() => window.open(fileUrl, "_blank")}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-full p-2 transform scale-0 group-hover:scale-100 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{fileName}</div>
        </div>
      );
    } else if (isVideo()) {
      return (
        <div className="mb-2">
          <video 
            src={fileUrl} 
            controls 
            className="max-w-full rounded max-h-48 border border-gray-200"
          />
          <div className="text-xs text-gray-500 mt-1">{fileName}</div>
        </div>
      );
    } else {
      // Generic file download link
      return (
        <div 
          className="flex items-center p-2 bg-gray-50 rounded border border-gray-200 mb-2 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => window.open(fileUrl, "_blank")}
        >
          <div className="mr-2 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-gray-500">{message.size ? `${Math.round(message.size / 1024)} KB` : "Download"}</div>
          </div>
        </div>
      );
    }
  }
  
  // For pending file uploads with local File objects (not yet sent to Sendbird)
  // This is now handled by the _localUrls property above, but keeping as a fallback
  if (message._files && message._files.length > 0 && !message._localUrls) {
    return (
      <div className="space-y-2">
        {message._files.map((file, index) => {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          
          // Create object URL for local preview
          const objectUrl = URL.createObjectURL(file);
          
          if (isImage) {
            return (
              <div key={index} className="mb-2">
                <div className="relative">
                  <img 
                    src={objectUrl} 
                    alt={file.name}
                    className="max-w-full rounded-lg shadow-sm max-h-60 object-contain" 
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{file.name}</div>
              </div>
            );
          } else if (isVideo) {
            return (
              <div key={index} className="mb-2">
                <div className="relative">
                  <video 
                    src={objectUrl} 
                    controls 
                    className="max-w-full rounded-lg shadow-sm max-h-60 border border-gray-200"
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    Uploading...
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{file.name}</div>
              </div>
            );
          } else {
            return (
              <div key={index} className="flex items-center p-2 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                <div className="mr-2 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</div>
                </div>
                <div className="text-xs bg-gray-200 rounded px-1.5 py-0.5 ml-2">Uploading...</div>
              </div>
            );
          }
        })}
      </div>
    );
  }
  
  // For multiple file messages from Sendbird
  if (message.fileInfoList && message.fileInfoList.length > 0) {
    return (
      <div className="space-y-2">
        {message.fileInfoList.map((fileInfo, index) => {
          const fileUrl = fileInfo.url;
          const fileName = fileInfo.fileName || "File";
          const isImage = fileInfo.mimeType && fileInfo.mimeType.startsWith("image/");
          const isVideo = fileInfo.mimeType && fileInfo.mimeType.startsWith("video/");
          
          if (isImage) {
            return (
              <div key={index} className="mb-2">
                <div className="relative group cursor-pointer">
                  <img 
                    src={fileUrl} 
                    alt={fileName}
                    className="max-w-full rounded-lg shadow-sm max-h-60 object-contain hover:shadow-md transition-shadow" 
                    onClick={() => window.open(fileUrl, "_blank")}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-full p-2 transform scale-0 group-hover:scale-100 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{fileName}</div>
              </div>
            );
          } else if (isVideo) {
            return (
              <div key={index} className="mb-2">
                <video 
                  src={fileUrl} 
                  controls 
                  className="max-w-full rounded max-h-48 border border-gray-200"
                />
                <div className="text-xs text-gray-500 mt-1">{fileName}</div>
              </div>
            );
          } else {
            return (
              <div 
                key={index}
                className="flex items-center p-2 bg-gray-50 rounded border border-gray-200 mb-2 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => window.open(fileUrl, "_blank")}
              >
                <div className="mr-2 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-medium truncate">{fileName}</div>
                  <div className="text-xs text-gray-500">{fileInfo.size ? `${Math.round(fileInfo.size / 1024)} KB` : "Download"}</div>
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  }
  
  // Fallback for any other type of file message
  return <div className="text-sm text-gray-600">File attachment</div>;
};

/**
 * Message List component
 * Displays messages in a chat with proper grouping and timestamps
 * Supports loading older messages when scrolling to the top
 */
const MessageList = ({
  messages,
  currentUserId,
  isLoadingMoreMessages,
  hasMoreMessages,
  onLoadMoreMessages,
  retryFailedMessage,
  onAddReaction,
  onRemoveReaction
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // Handles scroll to detect when to load more messages
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Check if scrolled near the top
    if (container.scrollTop < 50 && !isLoadingMoreMessages && hasMoreMessages) {
      onLoadMoreMessages();
    }
  };
  
  // Track message count and last message ID for smarter scrolling
  const previousMessagesLengthRef = useRef(messages.length);
  const previousLastMessageIdRef = useRef(messages.length > 0 ? messages[messages.length - 1]?.messageId : null);
  
  // Smarter scrolling that only scrolls on new messages, not on reaction changes
  useEffect(() => {
    // Get current message info
    const currentMessagesLength = messages.length;
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.messageId : null;
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const prevMessagesLength = previousMessagesLengthRef.current;
    const prevLastMessageId = previousLastMessageIdRef.current;
    
    // Determine if this is a new message or just a reaction update
    const isNewMessage = lastMessageId !== prevLastMessageId || currentMessagesLength > prevMessagesLength;
    const isMyMessage = lastMessage && lastMessage.sender?.userId === currentUserId;
    
    // Should we scroll to bottom?
    const shouldScrollToBottom = !isLoadingMoreMessages && isNewMessage;
    
    // Only scroll when there's an actual new message (not just a reaction update)
    if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: isMyMessage ? "auto" : "smooth" });
    }
    
    // Update refs for next comparison
    previousMessagesLengthRef.current = currentMessagesLength;
    previousLastMessageIdRef.current = lastMessageId;
  }, [messages, isLoadingMoreMessages, currentUserId]);
  
  // Group messages by sender/time
  const messageGroups = groupMessages(messages);

  return (
    <div 
      className="flex-grow overflow-y-auto bg-gray-50 flex flex-col"
      ref={messagesContainerRef}
      onScroll={handleScroll}
    >
      {/* Loading indicator for older messages */}
      {isLoadingMoreMessages && (
        <div className="flex justify-center pt-4 pb-2">
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <div className="w-4 h-4 rounded-full bg-gray-700 opacity-75 animate-pulse"></div>
            <div className="w-3 h-3 rounded-full bg-gray-600 opacity-75 animate-pulse animation-delay-150"></div>
            <div className="w-2 h-2 rounded-full bg-gray-500 opacity-75 animate-pulse animation-delay-300"></div>
            <span className="text-sm text-gray-600 ml-1">Loading messages</span>
          </div>
        </div>
      )}
      
      <div className="flex-grow px-4 py-6">
        {/* Message groups */}
        {messageGroups.map((group, groupIndex) => {
          const firstMessage = group[0];
          const isCurrentUser = firstMessage.sender?.userId === currentUserId;
          const isSystemMessage = firstMessage._isSystemMessage;
          
          // Skip rendering for loading indicator messages (now handled separately)
          if (firstMessage._isLoading) return null;
          
          return (
            <div key={`group-${groupIndex}`} className="mb-6 last:mb-2">
              {/* System messages */}
              {isSystemMessage ? (
                <div className="flex justify-center my-3">
                  <div className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600 shadow-sm border border-gray-200">
                    {getMessageText(firstMessage)}
                  </div>
                </div>
              ) : (
                <>
                  {/* Sender info and timestamp */}
                  <div className={`flex items-baseline mb-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    {!isCurrentUser && (
                      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-700 mr-2">
                        {(firstMessage.sender?.nickname || firstMessage.sender?.userId || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="font-medium text-xs text-gray-700">
                      {isCurrentUser
                        ? "You"
                        : firstMessage.sender?.nickname || 
                          firstMessage.sender?.userId || 
                          "Unknown User"}
                    </div>
                    <div className="text-[10px] text-gray-400 ml-2">
                      {formatMessageTime(firstMessage.createdAt)}
                    </div>
                  </div>
                  
                  {/* Message bubbles */}
                  <div 
                    className={`flex flex-col ${
                      isCurrentUser ? "items-end" : "items-start"
                    }`}
                  >
                    {group.map((message, messageIndex) => {
                      // Handle failed messages
                      const isFailed = message._isFailed;
                      const isPending = message._isPending;
                      
                      return (
                        <div
                          key={`message-${message.messageId || messageIndex}`}
                          className={`mb-3 last:mb-0 max-w-[80%] group relative pt-6`}
                        >
                          <div
                            className={`px-3 py-2 text-sm break-words overflow-hidden ${
                              isCurrentUser
                                ? "bg-gray-800 text-white rounded-2xl rounded-tr-sm shadow-sm"
                                : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100"
                            } ${isPending ? "opacity-70" : ""} relative z-10`}
                            onDoubleClick={() => {
                              // Only show emoji picker for non-pending, non-failed messages
                              if (!message._isPending && !message._isFailed && 
                                  !message._isSystemMessage && !message._isLoading) {
                                // Find the EmojiReactions component for this message and toggle its picker
                                const messageElement = document.getElementById(`message-${message.messageId}`);
                                if (messageElement) {
                                  // Create a custom event to toggle the emoji picker
                                  const event = new CustomEvent('toggleEmojiPicker');
                                  messageElement.dispatchEvent(event);
                                }
                              }
                            }}
                            id={`message-${message.messageId}`}
                          >
                            {/* Show uploading state directly for better visibility */}
                            {message._isUploading ? (
                              <div className="py-1">
                                <div className="w-full rounded-lg overflow-hidden bg-gray-100 relative">
                                  {/* Use local image URL if available for immediate preview */}
                                  {message._localImageUrl ? (
                                    <img 
                                      src={message._localImageUrl} 
                                      alt="Uploading"
                                      className="w-full max-h-60 object-contain opacity-70" 
                                    />
                                  ) : message._files && message._files[0]?.type.startsWith("image/") && (
                                    <img 
                                      src={URL.createObjectURL(message._files[0])} 
                                      alt="Uploading"
                                      className="w-full max-h-60 object-contain opacity-70" 
                                    />
                                  )}
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
                                    <svg className="animate-spin h-10 w-10 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <div className="text-white text-base font-medium">
                                      {message.uploadProgress ? `Uploading... ${message.uploadProgress}%` : 'Uploading...'}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                                  <span>{message.name || (message._files && message._files[0]?.name)}</span>
                                  <span className="text-blue-500">
                                    {message.size ? `${Math.round(message.size / 1024)} KB` : ''}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              /* Check if it's a file message */
                              (message.messageType === "file" || message.url || message._files || message.fileInfoList) ? (
                                <FileAttachment message={message} />
                              ) : (
                                /* Regular text message */
                                getMessageText(message)
                              )
                            )}
                            
                            {/* Show message text below file if both exist */}
                            {(message.messageType === "file" || message.url || message._files || message.fileInfoList) && 
                             message.message && message.message.trim() !== "" && (
                              <div className="mt-2 text-sm">{message.message}</div>
                            )}
                            
                            {/* Emoji reactions - positioned above the message bubble */}
                            {!message._isPending && !message._isFailed && !message._isSystemMessage && !message._isLoading && (
                              <EmojiReactions
                                message={message}
                                currentUserId={currentUserId}
                                onAddReaction={onAddReaction}
                                onRemoveReaction={onRemoveReaction}
                                isCurrentUserMessage={isCurrentUser}
                              />
                            )}
                            
                            {/* Pending indicator */}
                            {isPending && (
                              <span className="ml-2 inline-flex">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1 animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1 animate-bounce animation-delay-150"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-300"></span>
                              </span>
                            )}
                            

                          </div>
                          
                          {/* Failed message retry button */}
                          {isFailed && (
                            <div className="mt-1 flex items-center justify-end">
                              <div className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-md flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Failed</span>
                                <button
                                  onClick={() => retryFailedMessage(message)}
                                  className="ml-2 px-1.5 py-0.5 bg-red-100 rounded text-red-700 text-xs hover:bg-red-200 transition-colors"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
        
        {/* Empty state */}
        {messageGroups.length === 0 && !isLoadingMoreMessages && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-100 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-800 mb-2">No Messages Yet</h3>
              <p className="text-sm text-gray-500 mb-4">Start the conversation by sending your first message!</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Invisible element for scrolling to bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
