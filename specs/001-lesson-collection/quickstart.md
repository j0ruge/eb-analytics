# Quickstart: Lesson Collection Verification

## Prerequisites

1.  Repo cloned.
2.  `npm install` executed.
3.  Expo Go app installed on simulator or device.

## Running the Feature

1.  Start the app:
    ```bash
    npx expo start
    ```
2.  Open in Expo Go.

## Verification Steps

### 1. Create Lesson
- Tap **"Nova Aula"** on the Home Screen.
- **Verify**: Navigation to `/lesson/[id]` and `time_expected_start` is "09:00".

### 2. Test Persistence (The "Crash" Test)
- Tap `[+]` on "Attendance Start" (Set to 5).
- Tap "Capture Start Time".
- **Action**: Force quit the Expo Go app (Swipe up).
- **Action**: Relaunch app.
- Tap the lesson in the list.
- **Verify**: "Attendance Start" is 5 and Start Time is preserved.

### 3. Test Export
- Scroll to bottom, tap "Finalizar Aula" (Complete).
- Go to `/sync` (or via button).
- Tap "Export Data".
- **Verify**: Share sheet opens with a JSON file.
- **Verify**: JSON contains the data you entered.
