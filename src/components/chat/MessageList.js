import React, { useRef, useEffect } from "react";
import { getMessageText, formatMessageTime, groupMessages } from "./utils";

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
  retryFailedMessage
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
  
  // Scroll to bottom on initial load or when new messages arrive
  useEffect(() => {
    const shouldScrollToBottom = !isLoadingMoreMessages;
    if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoadingMoreMessages]);
  
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
                  <div className="bg-gray-100 px-4 py-1.5 rounded-full text-sm text-gray-600 shadow-sm border border-gray-200">
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
                    <div className="font-medium text-sm text-gray-700">
                      {isCurrentUser
                        ? "You"
                        : firstMessage.sender?.nickname || 
                          firstMessage.sender?.userId || 
                          "Unknown User"}
                    </div>
                    <div className="text-xs text-gray-400 ml-2">
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
                          className={`mb-1.5 last:mb-0 max-w-[80%] group relative`}
                        >
                          <div
                            className={`px-4 py-2.5 break-words ${
                              isCurrentUser
                                ? "bg-gray-800 text-white rounded-2xl rounded-tr-sm shadow-sm"
                                : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100"
                            } ${isPending ? "opacity-70" : ""}`}
                          >
                            {getMessageText(message)}
                            
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
              <h3 className="text-lg font-medium text-gray-800 mb-2">No Messages Yet</h3>
              <p className="text-gray-500 mb-4">Start the conversation by sending your first message!</p>
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
