import { Paths, File } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { lessonService } from './lessonService';

export const exportService = {
  async exportData(): Promise<boolean> {
    try {
      const completedLessons = await lessonService.getCompletedLessons();
      
      if (completedLessons.length === 0) {
        throw new Error('No completed lessons found to export.');
      }

      const fileName = `EBD_Export_${new Date().toISOString().split('T')[0]}.json`;
      const file = new File(Paths.cache, fileName);
      
      const payload = JSON.stringify(completedLessons, null, 2);
      
      // In SDK 54, File.write is synchronous
      file.write(payload);
      
      if (await isAvailableAsync()) {
        await shareAsync(file.uri);
        return true;
      } else {
        throw new Error('Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Export Error:', error);
      throw error;
    }
  }
};