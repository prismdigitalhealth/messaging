import { useState, useEffect, useCallback } from 'react';

/**
 * UserPresence utility to track online status of users
 * - Maintains a cache of user online statuses
 * - Periodically refreshes statuses for active channels
 * - Provides hooks and components for displaying user status
 */

// Status refresh interval in milliseconds (10 seconds)
const PRESENCE_REFRESH_INTERVAL = 10000;

/**
 * useUserPresence hook
 * Tracks and periodically updates online status of users in the selected channel
 *
 * @param {Object} channel - The currently selected Sendbird channel
 * @param {Object} sb - Sendbird SDK instance
 * @returns {Object} - Object containing user presence data and helper functions
 */
export const useUserPresence = (channel, sb) => {
  const [userStatuses, setUserStatuses] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to refresh user presence status
  const refreshUserPresence = useCallback(async () => {
    if (!channel) return;
    
    try {
      setIsRefreshing(true);
      console.log('Refreshing user presence for channel:', channel.url);
      
      // First call channel.refresh() to get latest channel data including member statuses
      await channel.refresh();
      
      // Force refresh the member list to ensure we have the latest connection status
      if (channel.getMembers) {
        try {
          // Get the latest members list with updated connection status
          const memberListQuery = channel.createMemberListQuery();
          memberListQuery.limit = 30; // Increase if your channels have more members
          
          const updatedMembers = await memberListQuery.next();
          console.log('Updated member list:', updatedMembers);
          
          // Extract member status information
          const memberStatuses = {};
          
          // Update status for each member
          updatedMembers.forEach(member => {
            if (member && member.userId) {
              // Debug log to see the structure of member objects
              console.log(`Member ${member.userId} status:`, {
                connectionStatus: member.connectionStatus,
                online: member.isOnline,
                lastSeenAt: member.lastSeenAt
              });
              
              memberStatuses[member.userId] = {
                connectionStatus: member.connectionStatus || (member.isOnline ? 'online' : 'offline'),
                lastSeenAt: member.lastSeenAt || null,
                nickname: member.nickname || '',
                profileUrl: member.profileUrl || '',
              };
            }
          });
          
          // Update the state with new status information
          setUserStatuses(memberStatuses);
          console.log('Updated user statuses:', memberStatuses);
        } catch (memberError) {
          console.error('Error fetching member list:', memberError);
          
          // Fallback to using channel.members if the query fails
          const fallbackMembers = channel.members || [];
          const fallbackStatuses = {};
          
          fallbackMembers.forEach(member => {
            if (member && member.userId) {
              fallbackStatuses[member.userId] = {
                connectionStatus: member.connectionStatus || 'offline',
                lastSeenAt: member.lastSeenAt || null,
                nickname: member.nickname || '',
                profileUrl: member.profileUrl || '',
              };
            }
          });
          
          setUserStatuses(fallbackStatuses);
        }
      } else {
        // Fallback if getMembers is not available
        const members = channel.members || [];
        const memberStatuses = {};
        
        members.forEach(member => {
          if (member && member.userId) {
            memberStatuses[member.userId] = {
              connectionStatus: member.connectionStatus || 'offline',
              lastSeenAt: member.lastSeenAt || null,
              nickname: member.nickname || '',
              profileUrl: member.profileUrl || '',
            };
          }
        });
        
        setUserStatuses(memberStatuses);
      }
    } catch (error) {
      console.error('Error refreshing user presence:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [channel]);
  
  // Set up periodic refresh
  useEffect(() => {
    // Initial refresh
    if (channel) {
      refreshUserPresence();
    }
    
    // Set up interval for periodic refresh
    const intervalId = setInterval(refreshUserPresence, PRESENCE_REFRESH_INTERVAL);
    
    // Clean up on unmount or when channel changes
    return () => {
      clearInterval(intervalId);
    };
  }, [channel, refreshUserPresence]);
  
  // Get status for a specific user
  const getUserStatus = useCallback((userId) => {
    return userStatuses[userId] || { connectionStatus: 'offline' };
  }, [userStatuses]);
  
  // Format the "last seen" time
  const formatLastSeen = useCallback((timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeen.toLocaleDateString();
  }, []);
  
  return {
    userStatuses,
    isRefreshing,
    refreshUserPresence,
    getUserStatus,
    formatLastSeen
  };
};

/**
 * UserStatusIndicator component
 * Displays an indicator showing user's online status
 */
export const UserStatusIndicator = ({ status, size = 'sm', className = '' }) => {
  // Determine color based on status
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };
  
  // Determine size class
  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'w-1.5 h-1.5';
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-2.5 h-2.5';
      case 'lg':
        return 'w-3 h-3';
      default:
        return 'w-2 h-2';
    }
  };
  
  return (
    <div className={`rounded-full ${getStatusColor()} ${getSizeClass()} ${className}`}></div>
  );
};

export default useUserPresence;
