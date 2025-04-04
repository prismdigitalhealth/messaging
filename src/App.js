import "tailwindcss/tailwind.css";
import React, { useEffect, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule } from "@sendbird/chat/groupChannel";
import LoginView from "./Login";
import Chat from "./components/chat/Chat";

// Initialize Sendbird with your App ID
const APP_ID = "BFB0CED3-D43A-4C53-9C75-76549E1FFD78";
const sb = SendbirdChat.init({
  appId: APP_ID,
  modules: [new GroupChannelModule()],
  // Enable message cache to improve performance and persistence
  useMessageGrouping: true,
  // Critical options for reactions to work properly
  enableReactions: true,
  // Optimize reaction display with cache
  localCacheEncryption: false,
  // Ensure reactions are stored properly
  automaticMessageResendPolicy: 'AUTOMATIC',
  // This property is used in some SDK versions for persisting reactions
  useReactionsSummary: true,
  // Enable read receipts tracking
  enableReadReceipt: true,
  // Enable delivery receipts tracking
  enableDeliveryReceipt: true,
  // Ensures read receipts work properly in group channels
  enableChannelDashboard: true,
  // Make sure we log issues for debugging
  logLevel: 'debug'
});

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [connectionError, setConnectionError] = useState("");

  // Check for existing connection and handle reconnection
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        // In older SDK versions, we need to check currentUser
        if (sb.currentUser) {
          console.log("Found existing connection as:", sb.currentUser.userId);
          setUserId(sb.currentUser.userId);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error("Error checking connection status:", error);
        // Force disconnect any problematic connection
        try {
          await sb.disconnect();
        } catch (e) {
          console.warn("Error disconnecting problematic connection:", e);
        }
      }
    };
    
    checkConnectionStatus();
  }, []);

  const handleLoginSuccess = (userId, nickname = "") => {
    setUserId(userId);
    setNickname(nickname);
    setIsLoggedIn(true);
    setConnectionError("");
  };

  const handleConnectionError = (error) => {
    setConnectionError(error);
    setIsLoggedIn(false);
  };

  // If we have a connection error while in the message view, show login again
  useEffect(() => {
    if (connectionError && isLoggedIn) {
      setIsLoggedIn(false);
    }
  }, [connectionError, isLoggedIn]);

  return (
    <div>
      {isLoggedIn ? (
        <Chat 
          userId={userId}
          nickname={nickname}
          onConnectionError={handleConnectionError}
          sb={sb}
        />
      ) : (
        <LoginView 
          onLoginSuccess={handleLoginSuccess}
          initialError={connectionError} 
        />
      )}
    </div>
  );
};

export default App;