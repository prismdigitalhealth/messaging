import React, { useState, useRef, useEffect } from "react";

/**
 * Message input component with dynamic height adjustment and file attachments
 * - Auto-resizes textarea as user types
 * - Supports sending messages with Enter key (Shift+Enter for new line)
 * - Allows file attachments (images, videos, etc.)
 */
const MessageInput = ({ onSendMessage, onSendFileMessage, isDisabled }) => {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea when content changes
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content with min/max constraints
    // Starting at 100px as requested, and expanding as needed without scroll
    const newHeight = Math.max(
      100, // min height 100px as requested
      Math.min(textarea.scrollHeight, 500) // max height enough for ~1000 chars
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
    
    // If we have files selected, send those with the message
    if (selectedFiles.length > 0) {
      if (!isDisabled) {
        onSendFileMessage(selectedFiles, trimmedMessage);
        setSelectedFiles([]);
        setMessage("");
      }
      return;
    }
    
    // Otherwise just send a text message
    if (trimmedMessage && !isDisabled) {
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    // Reset file input
    e.target.value = "";
  };
  
  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const openFileSelector = () => {
    fileInputRef.current?.click();
    setIsAttachmentMenuOpen(false);
  };
  
  const toggleAttachmentMenu = () => {
    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
  };

  return (
    <div className="relative bg-white px-4 py-3">
      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group bg-gray-100 rounded p-1">
              {file.type.startsWith('image/') ? (
                <div className="relative w-16 h-16 overflow-hidden rounded">
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt={file.name}
                    className="w-full h-full object-cover" 
                  />
                </div>
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded">
                  <span className="text-xs text-gray-600 truncate px-1">{file.name.split('.').pop()}</span>
                </div>
              )}
              <button 
                onClick={() => handleRemoveFile(index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 text-center bg-black bg-opacity-50 text-white text-xs py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                {file.name.length > 10 ? file.name.substring(0, 8) + '...' : file.name}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Message input area */}
      <div className="flex items-center relative">
        {/* Attachment button at the right side of the message field */}
        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={toggleAttachmentMenu}
            disabled={isDisabled}
            className={`p-2 rounded-full transition-colors ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          {/* Hidden file input */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            multiple
            accept="image/*,video/*,audio/*,application/pdf"
          />
          
          {/* Attachment menu */}
          {isAttachmentMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button 
                onClick={openFileSelector}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Add Photos/Videos
              </button>
              <button 
                onClick={openFileSelector}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Add Document
              </button>
            </div>
          )}
        </div>
        
        <div className="flex-grow relative">
          <div className="relative w-full">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full py-4 pr-16 pl-4 border-0 focus:outline-none resize-none text-gray-700 placeholder-gray-500"
              disabled={isDisabled}
              maxLength={1000} // Cap at 1000 characters
              style={{
                minHeight: "100px", // Starting height of 100px
                maxHeight: "500px", // Enough for ~1000 chars
                overflowY: "hidden", // No scrolling as requested
                borderRadius: "8px",
                backgroundColor: "#f8f9fa"
              }}
            />
          </div>

          {/* Character count removed as requested */}
          
          {/* File count indicator */}
          {selectedFiles.length > 0 && (
            <div className="absolute left-2 bottom-2 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {selectedFiles.length}
            </div>
          )}
          
          {/* Send button positioned under the attachment button, moved up by 12 points */}
          <div className="absolute right-3 top-[52px] z-10">
            <button
              onClick={handleSend}
              disabled={!message.trim() || isDisabled}
              className={`p-2 rounded-full flex items-center justify-center focus:outline-none transition-all ${
                !message.trim() || isDisabled
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-blue-500 hover:bg-blue-50"
              }`}
              title="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ transform: 'rotate(90deg)' }} // 90 degrees clockwise rotation
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* No typing indicator */}
    </div>
  );
};

export default MessageInput;