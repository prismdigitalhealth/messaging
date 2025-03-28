/**
 * Utility functions for the chat components
 */

/**
 * Format a timestamp for display in messages
 * Handles various timestamp formats and edge cases
 */
export const formatMessageTime = (timestamp) => {
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

/**
 * Extract text content from a message
 * Handles different Sendbird message formats
 */
export const getMessageText = (msg) => {
  if (!msg) return "";
  
  // For system/loading messages
  if (msg._isSystemMessage || msg._isLoading) {
    return msg.message;
  }
  
  // For pending messages created locally
  if (msg._isPending && msg.message) {
    return msg.message;
  }
  
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

/**
 * Extract timestamp from a Sendbird message
 * Handles various timestamp formats from different Sendbird SDK versions
 */
export const extractTimestamp = (message) => {
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

/**
 * Group messages by sender for better visual display
 * Messages from the same sender will be grouped if they're within a short time period
 */
export const groupMessages = (messagesArray) => {
  const groups = [];
  let currentGroup = [];
  
  // Use a shorter time window (2 minutes) for same-user message grouping
  const TIME_WINDOW_MS = 2 * 60 * 1000; // 2 minutes in milliseconds
  
  messagesArray.forEach((message, index) => {
    // Skip system messages, they always get their own group
    if (message._isSystemMessage || message._isLoading) {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
      groups.push([message]);
      return;
    }
    
    const prevMessage = index > 0 ? messagesArray[index - 1] : null;
    
    // Consider messages as separate if from different senders or if time gap is too large
    const timeGap = prevMessage ? (message.createdAt - prevMessage.createdAt) > TIME_WINDOW_MS : true;
    const senderChanged = prevMessage ? 
      (message.sender?.userId !== prevMessage.sender?.userId) ||
      prevMessage._isSystemMessage || 
      prevMessage._isLoading : 
      true;
    
    if (senderChanged || timeGap) {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
    }
    
    currentGroup.push(message);
  });
  
  // Add the last group if it has messages
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
};

/**
 * Get a message preview for channel list display
 * Returns a shortened version of the message text
 */
export const getMessagePreview = (message, maxLength = 30) => {
  if (!message) return "";
  
  // Get the message text
  const text = getMessageText(message);
  
  // Truncate if needed
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};
