import React, { useRef, useState, useEffect } from "react";
import { getMessagePreview, formatMessageTime } from "./utils";
import OnlineStatusIndicator from "./OnlineStatusIndicator";

/**
 * Channel List component
 * Displays all channels with last message preview and unread indicators
 * Shows online status for users in channels
 */
const ChannelList = ({
  channels,
  selectedChannel,
  onSelectChannel,
  unreadCounts,
  isConnected,
  onCreateChannelClick,
  onRefreshChannels,
  isRefreshing,
  userStatuses = {},
  getUserStatus
}) => {
  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullThreshold = 60; // Pixels to pull down before triggering refresh
  
  // Refs for touch handling
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const isTouching = useRef(false);
  
  // Handle touch events for pull-to-refresh
  const onTouchStart = (e) => {
    // Only enable pull-to-refresh when we're at the top of the list
    const scrollTop = containerRef.current?.scrollTop || 0;
    if (scrollTop > 0) return;
    
    touchStartY.current = e.touches[0].clientY;
    isTouching.current = true;
  };
  
  const onTouchMove = (e) => {
    if (!isTouching.current) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    // Only allow pulling down, not up
    if (deltaY > 0) {
      // Use a resistance factor to make the pull feel more natural
      const resistance = 0.4;
      const distance = Math.min(deltaY * resistance, 100); // Cap at 100px
      setPullDistance(distance);
      setIsPulling(true);
      
      // Prevent default scrolling behavior
      e.preventDefault();
    }
  };
  
  const onTouchEnd = async () => {
    if (!isTouching.current) return;
    
    // If we've pulled far enough, trigger the refresh
    if (pullDistance >= pullThreshold && !isRefreshing) {
      // Keep showing the loading state
      setIsPulling(false);
      
      // Call the refresh function
      if (onRefreshChannels) {
        await onRefreshChannels();
      }
    } else {
      // Reset immediately if we didn't pull far enough
      setIsPulling(false);
      setPullDistance(0);
    }
    
    isTouching.current = false;
  };
  
  // Reset pull distance when refresh completes
  useEffect(() => {
    if (!isRefreshing && !isPulling) {
      setPullDistance(0);
    }
  }, [isRefreshing, isPulling]);
  // Sort channels by most recent activity
  const sortedChannels = [...channels].sort((a, b) => {
    const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
    const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
    return bTimestamp - aTimestamp; // Newest first
  });

  return (
    <div className="flex flex-col h-full p-4 relative">
      <div className="flex justify-between items-center mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search channels..."
            className="pl-9 pr-4 py-2 w-full text-xs bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-gray-700 focus:bg-white transition-all"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <button
          onClick={onCreateChannelClick}
          className="ml-2 bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 transition-colors"
          disabled={!isConnected}
          title={isConnected ? "Create New Channel" : "Connect to create channels"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-gray-700">Channel List</h3>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <div className="text-xs text-blue-600 flex items-center">
              <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing
            </div>
          )}
          <div className={`text-xs flex items-center ${isConnected ? "text-green-600" : "text-red-600"}`}>
            <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? "bg-green-600" : "bg-red-600"}`}></div>
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>
      
      {/* Pull-to-refresh indicator */}
      <div 
        className={`absolute left-0 right-0 top-0 flex justify-center transform transition-transform duration-300 ${isPulling || isRefreshing ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${isPulling || isRefreshing ? pullDistance : 0}px)` }}
      >
        <div className="bg-gray-100 rounded-full p-2 shadow-md">
          <svg 
            className={`w-5 h-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="overflow-y-auto flex-grow -mx-4 px-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {sortedChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500 text-xs">
              {isConnected ? "No channels yet. Create your first channel!" : "Connecting to chat server..."}
            </p>
            {isConnected && (
              <button 
                onClick={onCreateChannelClick}
                className="mt-3 px-3 py-1 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Create Channel
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedChannels.map((channel) => {
              const isSelected = selectedChannel?.url === channel.url;
              const lastMessage = channel.lastMessage;
              const lastMessageTime = lastMessage ? formatMessageTime(lastMessage.createdAt) : "";
              const unreadCount = unreadCounts[channel.url] || 0;
              
              return (
                <li
                  key={channel.url}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? "bg-gray-100 shadow-md" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => onSelectChannel(channel)}
                >
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center mr-3 relative ${
                      isSelected ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-800"
                    }`}>
                      {channel.name ? channel.name.charAt(0).toUpperCase() : "C"}
                      
                      {/* Enhanced online status indicator for 1:1 chats */}
                      {channel.members && channel.members.length === 2 && 
                        (() => {
                          // For 1:1 chats, if the other member is one of the channel members
                          const channelMembers = channel.members || [];
                          const otherMember = channelMembers.find(member => 
                            member.userId !== (channel.currentUser?.userId || '')
                          );
                          
                          if (otherMember) {
                            // Check online status property directly on the member object
                            const isOnline = otherMember.connectionStatus === 'online';
                            
                            return (
                              <div className="absolute -bottom-0.5 -right-0.5">
                                <OnlineStatusIndicator isOnline={isOnline} size="md" />
                              </div>
                            );
                          }
                          return null;
                        })()
                      }
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                          <span className="text-sm font-medium truncate text-gray-900">
                            {channel.name || `Channel ${channel.url.slice(-4)}`}
                          </span>
                          
                          {/* Display online status text for 1:1 chats */}
                          {channel.members && channel.members.length === 2 && 
                            (() => {
                              // For 1:1 chats, if the other member is one of the channel members
                              const channelMembers = channel.members || [];
                              const otherMember = channelMembers.find(member => 
                                member.userId !== (channel.currentUser?.userId || '')
                              );
                              
                              if (otherMember) {
                                const isOnline = otherMember.connectionStatus === 'online';
                                if (isOnline) {
                                  return (
                                    <div className="ml-2">
                                      <OnlineStatusIndicator isOnline={true} size="sm" showText={true} />
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()
                          }
                        </div>
                        {lastMessageTime && (
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{lastMessageTime}</span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500 truncate">
                          {lastMessage ? getMessagePreview(lastMessage) : "No messages yet"}
                        </span>
                        {unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 bg-gray-800 text-white text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChannelList;
