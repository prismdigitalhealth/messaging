import React, { useState } from "react";

/**
 * Create Channel Modal
 * Modal for creating new channels with name and user IDs to invite
 */
const CreateChannelModal = ({ isOpen, onClose, onCreate }) => {
  const [channelName, setChannelName] = useState("");
  const [userIds, setUserIds] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    
    setIsCreating(true);
    
    try {
      await onCreate(channelName.trim(), userIds);
      
      // Reset form
      setChannelName("");
      setUserIds("");
      
      // Close modal
      onClose();
    } catch (error) {
      console.error("Error in create channel:", error);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleOverlayClick = (e) => {
    // Close if clicking the overlay (not the modal content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Create New Channel</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 mb-1">
              Channel Name (required)
            </label>
            <input
              type="text"
              id="channelName"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Enter channel name"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="userIds" className="block text-sm font-medium text-gray-700 mb-1">
              User IDs to Invite (optional)
            </label>
            <input
              type="text"
              id="userIds"
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Enter comma-separated user IDs"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple user IDs with commas
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={!channelName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                "Create Channel"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
