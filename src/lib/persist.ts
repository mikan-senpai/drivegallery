/** Thin async key-value wrapper (non-secret preferences, flags). */
import AsyncStorage from '@react-native-async-storage/async-storage';

const persist = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export default persist;
