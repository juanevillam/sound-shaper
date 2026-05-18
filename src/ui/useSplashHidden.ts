import { useEffect, useState } from 'react';

let isHidden = false;
const listeners = new Set<(value: boolean) => void>();

const setSplashHidden = (value: boolean) => {
  isHidden = value;

  listeners.forEach(listener => listener(value));
};

const useSplashHidden = (): boolean => {
  const [value, setValue] = useState(isHidden);

  useEffect(() => {
    listeners.add(setValue);

    return () => {
      listeners.delete(setValue);
    };
  }, []);

  return value;
};

export { setSplashHidden, useSplashHidden };
