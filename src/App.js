import './App.css';
import React, { useEffect, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule } from "@sendbird/chat/groupChannel";

const APP_ID = "BFB0CED3-D43A-4C53-9C75-76549E1FFD78"; // Replace with your Sendbird App ID
const sb = SendbirdChat.init({
  appId: APP_ID,
  modules: [new GroupChannelModule()],
});

const ChatApp = () => {
  const [userId] = useState("test_01"); // Static user for now
  const [channels, setChannels] = useState([]); // Stores available channels
  const [channel, setChannel] = useState(null); // Stores selected channel
  const [messages, setMessages] = useState([]); // Stores messages of active channel
  const [newMessage, setNewMessage] = useState(""); // User input message

  // Connect to Sendbird and load channels
  useEffect(() => {
    sb.connect(userId)
      .then((user) => {
        console.log("Connected as:", user.nickname || user.userId);
        loadChannels();
      })
      .catch((error) => console.error("Connection error:", error));
  }, [userId]);

  // Fetch available group channels
  const loadChannels = async () => {
    try {
      const channelListQuery = sb.groupChannel.createMyGroupChannelListQuery();
      channelListQuery.limit = 20;
      channelListQuery.includeEmpty = true;
      const channels = await channelListQuery.next();
      console.log("Loaded channels:", channels);
      setChannels(channels);
    } catch (error) {
      console.error("Channel list error:", error);
    }
  };

  // Join a channel when clicked
  const joinChannel = async (channelUrl) => {
    try {
      console.log("Joining channel:", channelUrl);
      const selectedChannel = await sb.groupChannel.getChannel(channelUrl);
      
      // Supergroup channels require entering
      if (selectedChannel.isSuper) {
        await selectedChannel.enter();
      }

      setChannel(selectedChannel); // Update state with new channel
      console.log("Updated channel state:", selectedChannel);

      loadMessages(selectedChannel);
    } catch (error) {
      console.error("Channel join error:", error);
    }
  };

  // React to channel state updates
  useEffect(() => {
    if (channel) {
      console.log("Channel state updated:", channel);
      loadMessages(channel);
    }
  }, [channel]);

  // Load messages when channel is selected
  const loadMessages = async (channel) => {
    if (!channel) return;
    try {
      console.log("Loading messages for:", channel.url);
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = 50;
      messageListQuery.reverse = true;
      const fetchedMessages = await messageListQuery.load();

      console.log("Fetched messages:", fetchedMessages);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Message load error:", error);
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (channel && newMessage.trim() !== "") {
      try {
        console.log("Sending message:", newMessage);
        const message = await channel.sendUserMessage({ message: newMessage });

        setMessages((prev) => [...prev, message]); // Append new message to UI
        setNewMessage(""); // Clear input field

        console.log("Message sent:", message);
      } catch (error) {
        console.error("Send message error:", error);
      }
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar - Group Channels */}
      <div className="w-1/4 bg-gray-100 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Group Channels</h2>
        {channels.length > 0 ? (
          channels.map((ch) => (
            <div
              key={ch.url}
              onClick={() => joinChannel(ch.url)}
              className={`p-2 cursor-pointer rounded ${
                channel?.url === ch.url ? "bg-blue-500 text-white" : "hover:bg-gray-200"
              }`}
            >
              {ch.name || "(No channel name)"}
            </div>
          ))
        ) : (
          <p className="text-gray-500">No channels found.</p>
        )}
      </div>

      {/* Chat Area */}
      <div className="w-3/4 flex flex-col h-full">
        {/* Channel Header */}
        <div className="p-4 bg-white shadow-md font-bold text-lg">
          {channel ? channel.name : "Select a channel"}
        </div>

        {/* Message List */}
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.messageId} className="mb-2">
                <strong>{msg.sender?.userId || "Unknown"}: </strong>
                {msg.message || "[Attachment]"}
              </div>
            ))
          ) : (
            <p className="text-gray-400">No messages yet.</p>
          )}
        </div>

        {/* Message Input */}
        {channel && (
          <div className="p-4 bg-white flex items-center border-t">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border p-2 mr-2"
            />
            <button
              onClick={sendMessage}
              className={`px-4 py-2 ${
                newMessage.trim() ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              disabled={!newMessage.trim()}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;