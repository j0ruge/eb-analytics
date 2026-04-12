import '@testing-library/jest-native/extend-expect';

// Global mock for AsyncStorage — pre-existing gap that broke
// DatePickerInput.test.tsx at module load since useThemePreference imports the
// real AsyncStorage. Addressed as part of spec 005 setup since new tests in 005
// also rely on this being mocked globally.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
