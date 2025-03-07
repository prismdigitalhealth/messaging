import React, { useEffect, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule } from "@sendbird/chat/groupChannel";

const APP_ID = "BFB0CED3-D43A-4C53-9C75-76549E1FFD78";
const sb = SendbirdChat.init({
  appId: APP_ID,
  modules: [new GroupChannelModule()],
});

const ChatApp = () => {
  const [userId] = useState("test_01");
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    sb.connect(userId)
      .then(() => loadChannels())
      .catch((error) => console.error("Connection error:", error));
  }, [userId]);

  const loadChannels = async () => {
    try {
      const channelListQuery = sb.groupChannel.createMyGroupChannelListQuery();
      channelListQuery.limit = 20;
      channelListQuery.includeEmpty = true;
      const fetchedChannels = await channelListQuery.next();
      setChannels(fetchedChannels);
    } catch (error) {
      console.error("Channel list error:", error);
    }
  };

  const joinChannel = async (channelUrl) => {
    try {
      const channel = await sb.groupChannel.getChannel(channelUrl);
      if (channel.isSuper) await channel.enter();
      setSelectedChannel(channel);
      loadMessages(channel);
    } catch (error) {
      console.error("Channel join error:", error);
    }
  };

  const loadMessages = async (channel) => {
    if (!channel) return;
    try {
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = 50;
      messageListQuery.reverse = true;
      const fetchedMessages = await messageListQuery.load();
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Message load error:", error);
    }
  };

  const sendMessage = async () => {
    if (selectedChannel && newMessage.trim() !== "") {
      try {
        const message = await selectedChannel.sendUserMessage({ message: newMessage });
        setMessages([...messages, message]);
        setNewMessage("");
      } catch (error) {
        console.error("Send message error:", error);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Channel List */}
      <div className="w-1/4 bg-gray-100 shadow-md flex flex-col p-4">
        <h2 className="text-2xl font-bold mb-4">Chats</h2>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {channels.length > 0 ? (
            channels.map((ch) => {
              const isActive = selectedChannel?.url === ch.url;
              return (
                <div
                  key={ch.url}
                  onClick={() => joinChannel(ch.url)}
                  className={`flex items-center p-3 rounded-xl shadow-lg cursor-pointer transition-all ${
                    isActive ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-100 hover:text-black"
                  }`}
                >
                  <div className="w-12 h-12 bg-gray-300 rounded-full mr-3"></div>

                  <div className="flex-1">
                    <p className="font-semibold text-sm">{ch.name || "(No channel name)"}</p>
                    <p className={`text-xs truncate ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                      {ch.lastMessage?.message || "Tap to start conversation"}
                    </p>
                  </div>

                  <p className={`text-xs font-semibold ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                    {new Date(ch.lastMessage?.createdAt || ch.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500 text-center">No channels found.</p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-3/4 flex flex-col h-full bg-white">
        <div className="p-4 bg-white border-b flex items-center">
          <div className="w-12 h-12 bg-gray-300 rounded-full mr-3"></div>
          <div>
            <p className="font-semibold text-lg">{selectedChannel ? selectedChannel.name : "Select a conversation"}</p>
            <p className="text-xs text-gray-500">Online</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          {messages.length > 0 ? (
            messages.map((msg, index) => {
              const isSentByMe = msg.sender?.userId === userId;
              const nextMessage = messages[index + 1];
              const isLastInGroup = !nextMessage || nextMessage.sender?.userId !== msg.sender?.userId;

              return (
                <div key={msg.messageId} className={`flex items-end ${isSentByMe ? "justify-end" : "justify-start"} mb-2`}>
                  {/* Profile Picture (Only for Last Message in Group) */}
                  {!isSentByMe && isLastInGroup && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full mr-2"></div>
                  )}

                  {/* Message Group */}
                  <div className="flex flex-col">
                    {/* Message Bubble */}
                    <div
                      className={`relative max-w-md px-5 py-3 text-sm shadow-md ${
                        isSentByMe
                          ? "bg-indigo-600 text-white rounded-2xl rounded-br-none"
                          : "bg-gray-100 text-black rounded-2xl rounded-bl-none"
                      }`}
                    >
                      <p>{msg.message || "[Attachment]"}</p>
                    </div>

                    {/* Timestamp (Only on last message in group) */}
                    {isLastInGroup && (
                      <span className="text-xs text-gray-500 mt-1 text-center">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>

                  {/* Profile Picture for Sent Messages */}
                  {isSentByMe && isLastInGroup && (
                    <div className="w-8 h-8 bg-gray-300 rounded-full ml-2"></div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 text-center">No messages yet.</p>
          )}
        </div>

        {/* Message Input */}
        {selectedChannel && (
          <div className="p-4 bg-white border-t flex items-center">
            <input
              type="text"
              placeholder="Write your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border p-2 rounded-full bg-gray-100 text-black"
            />
            <button
              onClick={sendMessage}
              className="ml-2 px-6 py-2 bg-gray-900 text-white rounded-full font-bold"
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
