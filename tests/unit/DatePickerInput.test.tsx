import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { DatePickerInput } from "../../src/components/DatePickerInput";

// Mock do DateTimePicker
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockDateTimePicker = ({ value, onChange }: any) => {
    return React.createElement(View, {
      testID: "mock-date-picker",
    });
  };

  return MockDateTimePicker;
});

// Mock do Modal do React Native
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockModal = ({ children, visible }: any) => {
    return visible ? React.createElement(View, {}, children) : null;
  };
  return MockModal;
});

describe("DatePickerInput", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render label correctly", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value={null}
          onChange={mockOnChange}
        />,
      );

      expect(getByText("Data Sugerida")).toBeTruthy();
    });

    it("should show placeholder when value is null", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value={null}
          onChange={mockOnChange}
          placeholder="Escolha uma data"
        />,
      );

      expect(getByText("Escolha uma data")).toBeTruthy();
    });

    it("should show default placeholder when not provided", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value={null}
          onChange={mockOnChange}
        />,
      );

      expect(getByText("Selecione uma data")).toBeTruthy();
    });

    it("should display formatted date when value is provided (numeric format)", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="2026-02-15"
          onChange={mockOnChange}
        />,
      );

      expect(getByText("2026-FEV-15")).toBeTruthy();
    });

    it("should display formatted date when value is provided (alpha format)", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="2026-MAR-20"
          onChange={mockOnChange}
        />,
      );

      expect(getByText("2026-MAR-20")).toBeTruthy();
    });

    it("should show placeholder for invalid date format", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="15/02/2026"
          onChange={mockOnChange}
        />,
      );

      expect(getByText("Selecione uma data")).toBeTruthy();
    });
  });

  describe("Disabled State", () => {
    it("should not open picker when disabled", () => {
      const { getByText, queryByTestId } = render(
        <DatePickerInput
          label="Data Sugerida"
          value={null}
          onChange={mockOnChange}
          disabled={true}
        />,
      );

      const button = getByText("Selecione uma data");
      fireEvent.press(button);

      // O picker não deve aparecer
      expect(queryByTestId("mock-date-picker")).toBeNull();
    });
  });

  describe("Interaction", () => {
    it("should display selected date in PT-BR format", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="2026-MAR-20"
          onChange={mockOnChange}
        />,
      );

      expect(getByText("2026-MAR-20")).toBeTruthy();
    });

    it("should convert numeric date to PT-BR on display", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="2026-01-10"
          onChange={mockOnChange}
        />,
      );

      // Verificar formato inicial convertido
      expect(getByText("2026-JAN-10")).toBeTruthy();
    });
  });

  describe("Date Format Conversion", () => {
    it("should convert numeric date to PT-BR format on display", () => {
      const testCases = [
        { input: "2026-01-15", expected: "2026-JAN-15" },
        { input: "2026-02-28", expected: "2026-FEV-28" },
        { input: "2026-03-10", expected: "2026-MAR-10" },
        { input: "2026-04-05", expected: "2026-ABR-05" },
        { input: "2026-05-20", expected: "2026-MAI-20" },
        { input: "2026-06-15", expected: "2026-JUN-15" },
        { input: "2026-07-04", expected: "2026-JUL-04" },
        { input: "2026-08-30", expected: "2026-AGO-30" },
        { input: "2026-09-12", expected: "2026-SET-12" },
        { input: "2026-10-31", expected: "2026-OUT-31" },
        { input: "2026-11-25", expected: "2026-NOV-25" },
        { input: "2026-12-25", expected: "2026-DEZ-25" },
      ];

      testCases.forEach(({ input, expected }) => {
        const { getByText } = render(
          <DatePickerInput
            label="Data"
            value={input}
            onChange={mockOnChange}
          />,
        );

        expect(getByText(expected)).toBeTruthy();
      });
    });

    it("should preserve PT-BR format when already in correct format", () => {
      const { getByText } = render(
        <DatePickerInput
          label="Data Sugerida"
          value="2026-DEZ-31"
          onChange={mockOnChange}
        />,
      );

      expect(getByText("2026-DEZ-31")).toBeTruthy();
    });
  });
});
