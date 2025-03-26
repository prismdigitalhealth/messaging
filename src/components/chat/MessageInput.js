import React, { useState, useRef, useEffect } from "react";

/**
 * Message input component with dynamic height adjustment
 * - Auto-resizes textarea as user types
 * - Supports sending messages with Enter key (Shift+Enter for new line)
 */
const MessageInput = ({ onSendMessage, isDisabled }) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea when content changes
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content with min/max constraints
    const newHeight = Math.max(
      40, // min height (single line)
      Math.min(textarea.scrollHeight, 150) // max height 150px
    );
    textarea.style.height = `${newHeight}px`;
  };

  // Apply auto-resize when message content changes
  useEffect(() => {
    autoResizeTextarea();
  }, [message]);

  // Initialize textarea height when component mounts
  useEffect(() => {
    // Small delay to ensure the DOM is fully rendered
    const timer = setTimeout(() => {
      autoResizeTextarea();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Send message on Enter (but not Shift+Enter)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isDisabled) {
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };

  return (
    <div className="relative bg-white px-4 py-3">
      {/* Message input area */}
      <div className="flex items-center">
        <div className="flex-grow relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full py-2 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-blue-300 resize-none text-gray-700 placeholder-gray-500"
            disabled={isDisabled}
            style={{
              minHeight: "40px",
              maxHeight: "150px",
              overflowY: message.length > 100 ? "auto" : "hidden"
            }}
          />

          {/* Character count indicator */}
          {message.length > 0 && (
            <div className="absolute right-14 bottom-2 text-xs text-gray-500">
              {message.length}
            </div>
          )}
          
          <button
            onClick={handleSend}
            disabled={!message.trim() || isDisabled}
            className={`absolute right-2 bottom-1 p-2 rounded-full flex items-center justify-center focus:outline-none transition-all ${
              !message.trim() || isDisabled
                ? "text-gray-300 cursor-not-allowed"
                : "text-blue-500 hover:bg-blue-50"
            }`}
            title="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* No typing indicator */}
    </div>
  );
};

export default MessageInput;