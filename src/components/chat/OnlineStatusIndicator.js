import React, { useState, useEffect } from 'react';

/**
 * OnlineStatusIndicator component
 * Displays a visual indicator of a user's online status
 * - Shows a green dot for online users
 * - Shows a gray dot for offline users
 * - Includes animation effects for better visibility
 */
const OnlineStatusIndicator = ({ isOnline, showText = false, size = 'md', className = '' }) => {
  // Determine size class
  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'w-1.5 h-1.5';
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-3 h-3';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };
  
  // Text size class
  const getTextSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'text-[10px]';
      case 'sm':
        return 'text-xs';
      case 'md':
        return 'text-xs';
      case 'lg':
        return 'text-sm';
      default:
        return 'text-xs';
    }
  };
  
  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className={`${getSizeClass()} rounded-full border-2 border-white 
          ${isOnline 
            ? 'bg-green-500 animate-pulse' 
            : 'bg-gray-400'
          }`}
      ></div>
      
      {showText && (
        <span className={`ml-1 ${getTextSizeClass()} font-medium ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>
          {isOnline ? 'online' : 'offline'}
        </span>
      )}
    </div>
  );
};

/**
 * Example usage:
 * 
 * In a user profile:
 * <OnlineStatusIndicator isOnline={true} size="md" showText={true} />
 * 
 * In a chat list:
 * <OnlineStatusIndicator isOnline={user.isOnline} size="sm" />
 */

export default OnlineStatusIndicator;
