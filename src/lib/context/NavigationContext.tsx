"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type NavigationDirection = "left" | "right" | "none";

interface NavigationContextType {
  direction: NavigationDirection;
  setDirection: (dir: NavigationDirection) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [direction, setDirection] = useState<NavigationDirection>("none");

  return (
    <NavigationContext.Provider value={{ direction, setDirection }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}
