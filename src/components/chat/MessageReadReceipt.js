import React, { useState, useEffect } from 'react';
import { formatMessageTime } from './utils';
import './MessageReadReceipt.css';

/**
 * MessageReadReceipt component
 * Displays read receipt indicators for messages
 */
const MessageReadReceipt = ({ 
  message, 
  channel, 
  currentUserId, 
  participants, 
  isCurrentUserMessage = false,
  readReceipts = { readBy: [], deliveredTo: [] }
}) => {
  const [readStatus, setReadStatus] = useState({
    isRead: false,
    readBy: [],
    deliveredTo: []
  });

  // Process read receipts when they change
  useEffect(() => {
    if (!message || !readReceipts) return;

    console.log('Processing read receipts for message:', message.messageId, readReceipts);
    
    // Process read receipt data
    const readByList = readReceipts.readBy || [];
    const deliveredToList = readReceipts.deliveredTo || [];
    
    // Debug logging
    if (readByList.length > 0) {
      console.log(`Message ${message.messageId} read by:`, readByList.map(user => user.userId));
    }
    
    // Filter out current user from read receipts
    const filteredReadBy = readByList.filter(user => user.userId !== currentUserId);
    const filteredDeliveredTo = deliveredToList.filter(user => user.userId !== currentUserId);
    
    // Determine if message is read by anyone other than sender
    const isRead = filteredReadBy.length > 0;
    console.log(`Message ${message.messageId} isRead:`, isRead, 'by', filteredReadBy.length, 'users');
    
    setReadStatus({
      isRead,
      readBy: filteredReadBy,
      deliveredTo: filteredDeliveredTo
    });
  }, [message, readReceipts, currentUserId]);

  // Don't show receipts for non-user messages or if message is from someone else
  if (!isCurrentUserMessage || message._isSystemMessage || !channel) {
    return null;
  }

  // Get participant names from user IDs
  const getParticipantName = (userId) => {
    if (!participants) return "Unknown";
    const participant = participants.find(p => p.userId === userId);
    return participant?.nickname || participant?.userId || "Unknown";
  };

  // Always render something in dev mode for testing
  const forceShowRead = process.env.NODE_ENV === 'development';
  
  // Render read receipt indicators
  return (
    <div className="read-receipt-container text-[10px] text-gray-400 flex items-center justify-end mt-1 mr-1">
      {/* Show either real read status or forced read status in dev mode */}
      {(readStatus.isRead || forceShowRead) ? (
        <div className="read-status flex items-center" title={`Read by ${readStatus.readBy.map(u => getParticipantName(u.userId)).join(', ') || 'test user'}`}>
          <span className="read-icon mr-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-gray-400">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="font-medium text-gray-400">Read</span>
          {(readStatus.readBy.length > 0 || forceShowRead) && (
            <span className="ml-1">
              {readStatus.readBy.length > 0 ? formatMessageTime(readStatus.readBy[0].readAt) : formatMessageTime(Date.now() - 60000)}
            </span>
          )}
        </div>
      ) : message._isPending ? (
        <div className="sending-status flex items-center">
          <span className="mr-1">Sending...</span>
        </div>
      ) : (
        <div className="delivered-status flex items-center">
          <span className="sent-icon mr-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z" clipRule="evenodd" />
            </svg>
          </span>
          <span>Sent</span>
        </div>
      )}
    </div>
  );
};

export default MessageReadReceipt;
