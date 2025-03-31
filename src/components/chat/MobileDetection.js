import { useState, useEffect } from "react";

/**
 * Custom hook to detect if the current device is mobile
 * @returns {boolean} True if the device is mobile
 */
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
};

/**
 * Custom hook for mobile sidebar control
 */
export const useMobileSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMobileDetection();

  const toggleSidebar = () => {
    setIsOpen(prev => !prev);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  return {
    isMobile,
    isOpen,
    toggleSidebar,
    closeSidebar
  };
};
