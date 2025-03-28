import React, { useState, useRef, useEffect } from 'react';

/**
 * Common emoji set for reactions
 * Each emoji has a key (used for Sendbird API) and the actual emoji character
 */
export const commonEmojis = [
  { key: 'heart', emoji: '❤️' },
  { key: 'thumbs_up', emoji: '👍' },
  { key: 'thumbs_down', emoji: '👎' },
  { key: 'joy', emoji: '😂' },
  { key: 'haha', emoji: '😆' },
  { key: 'exclamation', emoji: '❗' },
];

/**
 * EmojiReactions component
 * Displays emoji reactions for a message and allows adding/removing reactions
 * iMessage-style implementation with reactions above the message bubble
 */
const EmojiReactions = ({ 
  message, 
  currentUserId, 
  onAddReaction, 
  onRemoveReaction,
  isCurrentUserMessage,
  onDoubleClick
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [localMessage, setMessage] = useState(message);
  const emojiPickerRef = useRef(null);
  
  // Update local message state when the prop changes
  useEffect(() => {
    setMessage(message);
  }, [message]);
  
  // Close emoji picker when clicking outside and handle double-click event
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    
    // Handle custom event for toggling emoji picker on double-click
    const handleToggleEmojiPicker = () => {
      setShowEmojiPicker(prev => !prev);
    };
    
    // Get the message element
    const messageElement = document.getElementById(`message-${message.messageId}`);
    
    document.addEventListener('mousedown', handleClickOutside);
    if (messageElement) {
      messageElement.addEventListener('toggleEmojiPicker', handleToggleEmojiPicker);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (messageElement) {
        messageElement.removeEventListener('toggleEmojiPicker', handleToggleEmojiPicker);
      }
    };
  }, [message.messageId]);
  
  // Get existing reactions from the message
  const getReactions = () => {
    if (!message || !message.reactions) {
      console.log('No reactions found on message:', message.messageId);
      return [];
    }
    console.log('Found reactions on message:', message.messageId, message.reactions);
    return message.reactions;
  };
  
  // Check if current user has already reacted with a specific emoji
  const hasUserReacted = (emojiKey) => {
    const reactions = getReactions();
    const reaction = reactions.find(r => r.key === emojiKey);
    const hasReacted = reaction && reaction.userIds && reaction.userIds.includes(currentUserId);
    console.log(`Reaction check for ${emojiKey}: ${hasReacted ? 'User has reacted' : 'User has not reacted'}`);
    return hasReacted;
  };
  
  // Handle emoji click - toggle reaction
  const handleEmojiClick = (emojiKey) => {
    // Force immediate UI update for better feedback
    if (hasUserReacted(emojiKey)) {
      // First update local state immediately
      const updatedReactions = [...(message.reactions || [])];
      const index = updatedReactions.findIndex(r => r.key === emojiKey);
      
      if (index >= 0) {
        updatedReactions[index] = {
          ...updatedReactions[index],
          userIds: updatedReactions[index].userIds.filter(id => id !== currentUserId)
        };
        
        // If no users left, remove the reaction
        if (updatedReactions[index].userIds.length === 0) {
          updatedReactions.splice(index, 1);
        }
        
        // Create a message copy with updated reactions
        const updatedMessage = {
          ...message,
          reactions: updatedReactions
        };
        
        // Manually force update the rendered UI
        setMessage(updatedMessage);
      }
      
      // Then send to server
      onRemoveReaction(message, emojiKey);
    } else {
      // First update local state immediately
      const updatedReactions = [...(message.reactions || [])];
      const index = updatedReactions.findIndex(r => r.key === emojiKey);
      
      if (index >= 0) {
        // Add user to existing reaction
        if (!updatedReactions[index].userIds.includes(currentUserId)) {
          updatedReactions[index] = {
            ...updatedReactions[index],
            userIds: [...updatedReactions[index].userIds, currentUserId]
          };
        }
      } else {
        // Add new reaction
        updatedReactions.push({
          key: emojiKey,
          userIds: [currentUserId],
          updatedAt: Date.now()
        });
      }
      
      // Create a message copy with updated reactions
      const updatedMessage = {
        ...message,
        reactions: updatedReactions
      };
      
      // Then send to server
      onAddReaction(message, emojiKey);
    }
    
    setShowEmojiPicker(false);
  };
  
  // Get emoji character from key with improved fallback handling
  const getEmojiFromKey = (key) => {
    // First check our predefined list
    const emoji = commonEmojis.find(e => e.key === key);
    if (emoji) {
      console.log(`🎯 Found emoji for key '${key}':`, emoji.emoji);
      return emoji.emoji;
    }
    
    // Otherwise use a more comprehensive fallback map
    console.log(`⚠️ No emoji in commonEmojis for key: '${key}', using fallback`);
    
    // Comprehensive fallback map including all Sendbird default reaction keys
    const fallbackMap = {
      // Standard emoji keys
      'smile': '😊',
      'thumbsup': '👍',
      'thumbs_up': '👍',
      'heart': '❤️',
      'like': '👍',
      'love': '❤️',
      'haha': '😂',
      'joy': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😠',
      'thumbsdown': '👎',
      'thumbs_down': '👎',
      // Extra emojis for better coverage
      'clap': '👏',
      'fire': '🔥',
      'laughing': '😂',
      'partying': '🎉',
      'party': '🎉',
      'thinking': '🤔',
      'exclamation': '❗',
      'question': '❓',
      'check': '✅'
    };
    
    const fallbackEmoji = fallbackMap[key] || key;
    console.log(`🔄 Using fallback for '${key}':`, fallbackEmoji);
    return fallbackEmoji;
  };
  
  // Get all used emoji reactions for this message with improved debugging
  const getUsedReactions = () => {
    const reactions = getReactions();
    
    // Enhanced debugging information
    console.log(`🔍 [EmojiReactions:${message.messageId}] All reactions:`, reactions);
    console.log(`🔍 [EmojiReactions:${message.messageId}] Reactions direct access:`, message.reactions);
    console.log(`🔍 [EmojiReactions:${message.messageId}] Current user:`, currentUserId);
    
    if (reactions.length > 0) {
      // Debug each reaction in detail
      reactions.forEach(r => {
        const hasUserReacted = r.userIds && r.userIds.includes(currentUserId);
        console.log(`🔍 Reaction '${r.key}':`, { 
          userIds: r.userIds || [], 
          total: r.userIds?.length || 0,
          userReacted: hasUserReacted,
          emoji: getEmojiFromKey(r.key) 
        });
      });
    } else {
      console.log(`🔍 [EmojiReactions:${message.messageId}] No reactions found`);
    }
    
    // Process reactions according to Sendbird format
    const usedReactions = reactions
      // Only process reactions with valid userIds
      .filter(reaction => reaction.userIds && reaction.userIds.length > 0)
      .map(reaction => {
        // Check if current user has reacted with this emoji
        const hasReacted = reaction.userIds.includes(currentUserId);
        
        // Log detailed information for each processed reaction
        console.log(`✅ [EmojiReactions:${message.messageId}] Processing '${reaction.key}':`, {
          users: reaction.userIds,
          currentUser: currentUserId,
          isSelected: hasReacted,
          total: reaction.userIds.length,
          display: getEmojiFromKey(reaction.key)
        });
        
        return {
          key: reaction.key,
          emoji: getEmojiFromKey(reaction.key),
          count: reaction.userIds.length,
          hasReacted: hasReacted
        };
      });
      
    console.log(`📊 [EmojiReactions:${message.messageId}] Final reactions:`, usedReactions);
    return usedReactions;
  };
  
  const usedReactions = getUsedReactions();
  
  return (
    <div className="relative">
      {/* Existing reactions - displayed above the message bubble */}
      {usedReactions.length > 0 && (
        <div 
          className={`inline-flex gap-1.5 mt-1 ${isCurrentUserMessage ? 'justify-end' : 'justify-start'} overflow-visible`}
          style={{ 
            position: 'relative',
            zIndex: 20,
            marginLeft: isCurrentUserMessage ? 'auto' : '0',
            marginRight: isCurrentUserMessage ? '0' : 'auto',
            maxWidth: 'calc(100% - 5px)', /* Ensure reactions stay within message width */
            whiteSpace: 'nowrap', /* Prevent wrapping to new line */
            pointerEvents: 'auto' /* Ensure clicks register */
          }}
        >
          {usedReactions.map(reaction => {
            // Explicitly log whether this reaction has been selected by the current user
            console.log(`Rendering reaction ${reaction.key}: User selected: ${reaction.hasReacted}`);
            return (
              <button
                key={reaction.key}
                onClick={() => handleEmojiClick(reaction.key)}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs
                  ${reaction.hasReacted 
                    ? 'bg-white text-blue-600 font-bold shadow-md' 
                    : 'bg-white border border-gray-200 text-gray-600 shadow-sm'}`}
                style={{ position: 'relative', zIndex: 20 }}
              >
                <span>{reaction.emoji}</span>
                {reaction.count > 1 && <span className="ml-0.5 text-[10px]">{reaction.count}</span>}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Emoji picker - shown on double click */}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className={`fixed bg-black bg-opacity-80 rounded-full shadow-xl border border-gray-700 p-2`}
          style={{ 
            zIndex: 1000,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '40%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="flex space-x-1.5 p-1">
            {commonEmojis.map(({ key, emoji }) => (
              <button
                key={key}
                onClick={() => handleEmojiClick(key)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-lg 
                  hover:bg-gray-700 transition-colors duration-150
                  ${hasUserReacted(key) ? 'bg-blue-500 text-white' : 'text-white'}`}
                aria-label={`React with ${key}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiReactions;
