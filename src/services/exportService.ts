import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { lessonService } from './lessonService';

export const exportService = {
  async exportData(): Promise<boolean> {
    try {
      const completedLessons = await lessonService.getCompletedLessons();
      
      if (completedLessons.length === 0) {
        throw new Error('No completed lessons found to export.');
      }

      const fileName = `EBD_Export_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      const payload = JSON.stringify(completedLessons, null, 2);
      
      await FileSystem.writeAsStringAsync(fileUri, payload);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
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
