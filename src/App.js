import "tailwindcss/tailwind.css";
import React, { useEffect, useState, useRef } from "react";
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
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  // 1) Debug version of getMessageText
  const getMessageText = (msg) => {
    if (!msg) return "";
    
    // For system/loading messages
    if (msg._isSystemMessage || msg._isLoading) {
      return msg.message;
    }
    
    // For pending messages created locally
    if (msg._isPending && msg.message) {
      return msg.message;
    }
    
    // Check all possible locations where Sendbird might store the message text
    
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

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to Sendbird
  useEffect(() => {
    const connect = async () => {
      try {
        await sb.connect(userId);
        setIsConnected(true);
        console.log("Connected to Sendbird");
        const channels = await loadChannels();
        if (channels && channels.length > 0) {
          const firstChannel = channels[0];
          setSelectedChannel(firstChannel);
          loadMessages(firstChannel);
        }
      } catch (error) {
        console.error("Connection error:", error);
      }
    };
    connect();

    return () => {
      try {
        sb.disconnect();
        console.log("Disconnected from Sendbird");
      } catch (e) {
        console.error("Error disconnecting:", e);
      }
    };
  }, [userId]);

  // Channel event handlers
  useEffect(() => {
    if (!selectedChannel || !isConnected) return;

    const onMessageReceived = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
      setChannels((prevChannels) =>
        prevChannels.map((ch) =>
          ch.url === channel.url ? { ...ch, lastMessage: message } : ch
        )
      );
    };

    const onMessageUpdated = (channel, message) => {
      if (selectedChannel.url === channel.url) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.messageId === message.messageId ? message : msg
          )
        );
      }
    };

    const onMessageDeleted = (channel, messageId) => {
      if (selectedChannel.url === channel.url) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageId !== messageId)
        );
      }
    };

    const onChannelChanged = (channel) => {
      setChannels((prevChannels) =>
        prevChannels.map((ch) => (ch.url === channel.url ? channel : ch))
      );
      if (selectedChannel.url === channel.url) {
        setSelectedChannel(channel);
      }
    };

    const channelHandlerId = `channel_handler_${Date.now()}`;
    selectedChannel.addMessageReceivedHandler?.(channelHandlerId, onMessageReceived);
    selectedChannel.addMessageUpdatedHandler?.(channelHandlerId, onMessageUpdated);
    selectedChannel.addMessageDeletedHandler?.(channelHandlerId, onMessageDeleted);
    selectedChannel.addChannelChangedHandler?.(channelHandlerId, onChannelChanged);

    return () => {
      try {
        selectedChannel.removeMessageReceivedHandler?.(channelHandlerId);
        selectedChannel.removeMessageUpdatedHandler?.(channelHandlerId);
        selectedChannel.removeMessageDeletedHandler?.(channelHandlerId);
        selectedChannel.removeChannelChangedHandler?.(channelHandlerId);
      } catch (e) {
        console.error("Error removing channel handlers:", e);
      }
    };
  }, [selectedChannel, isConnected]);

  const loadChannels = async () => {
    try {
      const channelListQuery = sb.groupChannel.createMyGroupChannelListQuery();
      channelListQuery.limit = 20;
      channelListQuery.includeEmpty = true;
      const fetchedChannels = await channelListQuery.next();
      const sortedChannels = fetchedChannels.sort((a, b) => {
        const aTimestamp = a.lastMessage?.createdAt || a.createdAt || 0;
        const bTimestamp = b.lastMessage?.createdAt || b.createdAt || 0;
        return bTimestamp - aTimestamp;
      });
      setChannels(sortedChannels);
      return sortedChannels;
    } catch (error) {
      console.error("Channel list error:", error);
      return [];
    }
  };

  const joinChannel = async (channelUrl) => {
    try {
      const channel = await sb.groupChannel.getChannel(channelUrl);
      if (channel.isSuper && typeof channel.enter === "function") {
        try {
          await channel.enter();
        } catch (enterError) {
          console.error("Channel enter error:", enterError);
        }
      }
      setSelectedChannel(channel);
      loadMessages(channel);
    } catch (error) {
      console.error("Channel join error:", error);
    }
  };

  const loadMessages = async (channel) => {
    if (!channel) return;
    setMessages([
      { _isLoading: true, messageId: "loading-indicator", message: "Loading messages..." },
    ]);
    try {
      if (channel.isSuper && typeof channel.enter === "function") {
        try {
          await channel.enter();
        } catch (enterError) {
          console.error("Channel enter error:", enterError);
        }
      }
      const messageListQuery = channel.createPreviousMessageListQuery();
      messageListQuery.limit = 50;
      if ("reverse" in messageListQuery) {
        messageListQuery.reverse = true;
      }
      const fetchedMessages = await messageListQuery.load();
      if (fetchedMessages.length === 0) {
        setMessages([{
          messageId: "welcome-msg",
          message: `Welcome to ${channel.name || "this channel"}! Send your first message to start the conversation.`,
          createdAt: Date.now(),
          sender: { userId: "system" },
          _isSystemMessage: true,
        }]);
      } else {
        setMessages(fetchedMessages);
      }
    } catch (error) {
      console.error("Message load error:", error);
      setMessages([{
        messageId: "error-msg",
        message: `Failed to load messages: ${error.message}`,
        createdAt: Date.now(),
        sender: { userId: "system" },
        _isSystemMessage: true,
      }]);
    }
  };

  const sendMessage = async () => {
    if (!selectedChannel || newMessage.trim() === "") return;
    
    // Store the original message text
    const messageText = newMessage.trim();
    const currentTimestamp = Date.now();
    
    // Create a pending message
    const pendingMessage = {
      messageId: currentTimestamp.toString(),
      message: messageText,
      sender: { userId },
      createdAt: currentTimestamp,
      _isPending: true,
      messageType: "user",
    };
    
    setMessages((prevMessages) => [...prevMessages, pendingMessage]);
    setNewMessage("");
    
    try {
      const params = { 
        message: messageText,
        // Adding data as a fallback to ensure the message text is preserved
        data: JSON.stringify({ text: messageText })
      };
      
      const sentMessage = await selectedChannel.sendUserMessage(params);
      console.log("Sent message response:", sentMessage);
      
      // Extract the timestamp from Sendbird response, with fallbacks
      const sendBirdTimestamp = extractTimestamp(sentMessage);
      
      // Create a processed message that ensures the text and timestamp are preserved
      const processedSentMessage = {
        ...sentMessage,
        // Ensure the message text is preserved from our original input
        message: messageText,
        // Keep the sender information
        sender: sentMessage.sender || { userId },
        // Use Sendbird timestamp if available, otherwise fall back to our local timestamp
        createdAt: sendBirdTimestamp || currentTimestamp
      };
      
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ? 
            processedSentMessage : msg
        )
      );
    } catch (error) {
      console.error("Send message error:", error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._isPending && msg.messageId === pendingMessage.messageId ?
            { ...msg, _isFailed: true } : msg
        )
      );
    }
  };

  // Helper function to extract timestamp from Sendbird message
const extractTimestamp = (message) => {
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


  const retryFailedMessage = (failedMessage) => {
    setNewMessage(failedMessage.message);
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => msg.messageId !== failedMessage.messageId)
    );
  };

  // Group messages by sender/time
  const groupMessages = (messagesArray) => {
    const groups = [];
    let currentGroup = [];
    messagesArray.forEach((message, index) => {
      const prevMessage = index > 0 ? messagesArray[index - 1] : null;
      const timeGap = prevMessage ? (message.createdAt - prevMessage.createdAt) > 10 * 60 * 1000 : true;
      const senderChanged = prevMessage ? message.sender?.userId !== prevMessage.sender?.userId : true;
      if (senderChanged || timeGap) {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
          currentGroup = [];
        }
      }
      currentGroup.push(message);
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  };

// Enhanced formatMessageTime function with more robust handling
const formatMessageTime = (timestamp) => {
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


  const messageGroups = groupMessages(messages);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Channel List */}
      <div className="w-1/4 bg-gray-100 shadow-md flex flex-col p-4">
        <h2 className="text-2xl font-bold mb-4">Chats</h2>
        <div className={`text-xs mb-2 flex items-center ${isConnected ? "text-green-600" : "text-red-600"}`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? "bg-green-600" : "bg-red-600"}`}></div>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
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
                      {ch.lastMessage ? getMessageText(ch.lastMessage) : "Tap to start conversation"}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                    {(() => {
                      const timestamp = ch.lastMessage?.createdAt || ch.createdAt;
                      if (!timestamp) return "";
                      try {
                        return formatMessageTime(timestamp);
                      } catch (e) {
                        return "";
                      }
                    })()}
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
            <p className="font-semibold text-lg">
              {selectedChannel ? selectedChannel.name : "Select a conversation"}
            </p>
            <p className="text-xs text-gray-500">
              {selectedChannel ? `${selectedChannel.memberCount} members` : "No channel selected"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          {messageGroups.length > 0 ? (
            messageGroups.map((group, groupIndex) => {
              const isSentByMe = group[0].sender?.userId === userId;
              return (
                <div key={`group-${groupIndex}`} className="mb-6">
                  <div
                    className={`flex ${
                      group[0]._isSystemMessage || group[0]._isLoading
                        ? "justify-center"
                        : isSentByMe
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {!isSentByMe && !group[0]._isSystemMessage && !group[0]._isLoading && (
                      <div className="w-8 h-8 bg-gray-300 rounded-full self-end mb-1 mr-2"></div>
                    )}
                    <div className={`flex flex-col max-w-md ${isSentByMe ? "items-end" : "items-start"}`}>
                      {group.map((message, messageIndex) => {
                        const isLastInGroup = messageIndex === group.length - 1;
                        const isPending = message._isPending;
                        const isFailed = message._isFailed;
                        let bubbleStyle = "";
                        if (message._isSystemMessage) {
                          bubbleStyle =
                            "bg-gray-200 text-gray-700 text-center italic rounded-xl mx-auto";
                        } else if (message._isLoading) {
                          bubbleStyle =
                            "bg-gray-200 text-gray-700 text-center italic rounded-xl mx-auto animate-pulse";
                        } else if (isSentByMe) {
                          bubbleStyle = "bg-indigo-600 text-white";
                        } else {
                          bubbleStyle = "bg-gray-100 text-black";
                        }
                        if (isPending) {
                          bubbleStyle = isSentByMe ? "bg-indigo-400 text-white" : "bg-gray-100 text-black";
                        } else if (isFailed) {
                          bubbleStyle = "bg-red-100 text-red-600";
                        }
                        if (group.length === 1) {
                          bubbleStyle += isSentByMe
                            ? " rounded-2xl rounded-br-none"
                            : " rounded-2xl rounded-bl-none";
                        } else if (messageIndex === 0) {
                          bubbleStyle += isSentByMe
                            ? " rounded-2xl rounded-br-none rounded-tr-lg"
                            : " rounded-2xl rounded-bl-none rounded-tl-lg";
                        } else if (isLastInGroup) {
                          bubbleStyle += isSentByMe
                            ? " rounded-2xl rounded-tr-lg rounded-br-none"
                            : " rounded-2xl rounded-tl-lg rounded-bl-none";
                        } else {
                          bubbleStyle += isSentByMe
                            ? " rounded-2xl rounded-tr-lg rounded-br-none"
                            : " rounded-2xl rounded-tl-lg rounded-bl-none";
                        }

                        return (
                          <div key={message.messageId} className="my-0.5">
                            <div className={`relative px-4 py-2 text-sm shadow-sm ${bubbleStyle}`}>
                              <p>{getMessageText(message)}</p>
                            </div>
                            {isSentByMe && (
                              <div className="text-xs text-right mr-2">
                                {isFailed && (
                                  <div className="flex justify-end">
                                    <span className="text-red-500 mr-2">Failed to send</span>
                                    <button
                                      onClick={() => retryFailedMessage(message)}
                                      className="text-blue-500 hover:underline"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}
                                {isPending && <span className="text-gray-400">Sending...</span>}
                              </div>
                            )}
                            {isLastInGroup && (
                              <div
                                className={`text-xs text-gray-500 mt-1 ${
                                  isSentByMe ? "text-right mr-2" : "text-left ml-2"
                                }`}
                              >
                                {typeof message.createdAt !== "undefined"
                                  ? formatMessageTime(message.createdAt)
                                  : "Unknown time"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {isSentByMe && !group[0]._isSystemMessage && !group[0]._isLoading && (
                      <div className="w-8 h-8 bg-gray-300 rounded-full self-end mb-1 ml-2"></div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-400 text-center">No messages yet.</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedChannel && (
          <div className="p-4 bg-white border-t flex items-center">
            <input
              type="text"
              placeholder="Write your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              className="flex-1 border p-2 rounded-full bg-gray-100 text-black"
            />
            <button
              onClick={sendMessage}
              className={`ml-2 px-6 py-2 rounded-full font-bold transition-colors ${
                newMessage.trim() ? "bg-gray-900 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"
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