import { createContext, useContext, useState, ReactNode } from 'react';

interface NotifCtx {
  fountain: boolean;   // active fairy OR uncollected mailbox items
  inventory: boolean;  // new materials collected since last visit
  fairyLog: boolean;   // new fairy discovered since last visit
  setFountain: (v: boolean) => void;
  setInventory: (v: boolean) => void;
  setFairyLog: (v: boolean) => void;
}

const NotifContext = createContext<NotifCtx>({
  fountain: false, inventory: false, fairyLog: false,
  setFountain: () => {}, setInventory: () => {}, setFairyLog: () => {},
});

export function NotifProvider({ children }: { children: ReactNode }) {
  const [fountain, setFountain] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [fairyLog, setFairyLog] = useState(false);
  return (
    <NotifContext.Provider value={{ fountain, inventory, fairyLog, setFountain, setInventory, setFairyLog }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotifs = () => useContext(NotifContext);
