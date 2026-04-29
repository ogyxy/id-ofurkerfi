import { useEffect, useState } from "react";

const STORAGE_KEY = "ide.sidebar.collapsed";
const EVENT = "ide:sidebar-collapsed-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(false);

  useEffect(() => {
    setCollapsedState(read());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setCollapsedState(Boolean(detail));
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setCollapsed = (value: boolean) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: value }));
  };

  return [collapsed, setCollapsed];
}
