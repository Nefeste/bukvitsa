// «Поделиться»: на телефоне — системный лист, на вебе — копирование в буфер (specs/2026-10-daily.md).
import { Platform, Share } from 'react-native';

/** true — текст скопирован в буфер (веб), false — открыт системный лист или не вышло. */
export async function shareOrCopy(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      await navigator.clipboard.writeText(message);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await Share.share({ message });
  } catch {
    // нет приложений для «Поделиться» — молча, игрок может повторить
  }
  return false;
}
