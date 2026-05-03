import {
  parseInputDate,
  formatToYYYYMMMDD,
  isValidDateFormat,
  toIsoDateForWire,
} from "../../src/utils/date";

describe("Date Utils", () => {
  describe("isValidDateFormat", () => {
    it("should accept YYYY-MM-DD format", () => {
      expect(isValidDateFormat("2026-02-15")).toBe(true);
      expect(isValidDateFormat("2025-12-31")).toBe(true);
      expect(isValidDateFormat("2026-01-01")).toBe(true);
    });

    it("should accept YYYY-MMM-DD format with PT-BR months", () => {
      expect(isValidDateFormat("2026-JAN-15")).toBe(true);
      expect(isValidDateFormat("2026-FEV-15")).toBe(true);
      expect(isValidDateFormat("2026-MAR-15")).toBe(true);
      expect(isValidDateFormat("2026-ABR-15")).toBe(true);
      expect(isValidDateFormat("2026-MAI-15")).toBe(true);
      expect(isValidDateFormat("2026-JUN-15")).toBe(true);
      expect(isValidDateFormat("2026-JUL-15")).toBe(true);
      expect(isValidDateFormat("2026-AGO-15")).toBe(true);
      expect(isValidDateFormat("2026-SET-15")).toBe(true);
      expect(isValidDateFormat("2026-OUT-15")).toBe(true);
      expect(isValidDateFormat("2026-NOV-15")).toBe(true);
      expect(isValidDateFormat("2026-DEZ-15")).toBe(true);
    });

    it("should reject invalid formats", () => {
      expect(isValidDateFormat("15/02/2026")).toBe(false);
      expect(isValidDateFormat("02-15-2026")).toBe(false);
      expect(isValidDateFormat("2026/02/15")).toBe(false);
      expect(isValidDateFormat("2026-2-15")).toBe(false);
      expect(isValidDateFormat("2026-FEB-15")).toBe(false); // Inglês
      expect(isValidDateFormat("abc")).toBe(false);
      expect(isValidDateFormat("")).toBe(false);
    });
  });

  describe("parseInputDate", () => {
    it("should parse YYYY-MM-DD format correctly", () => {
      const date = parseInputDate("2026-02-15");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(1); // 0-indexed (fevereiro)
      expect(date?.getDate()).toBe(15);
    });

    it("should parse YYYY-MMM-DD format with PT-BR months", () => {
      const date = parseInputDate("2026-FEV-15");
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(1); // fevereiro
      expect(date?.getDate()).toBe(15);
    });

    it("should parse all PT-BR months correctly", () => {
      const months = [
        { abbr: "JAN", index: 0 },
        { abbr: "FEV", index: 1 },
        { abbr: "MAR", index: 2 },
        { abbr: "ABR", index: 3 },
        { abbr: "MAI", index: 4 },
        { abbr: "JUN", index: 5 },
        { abbr: "JUL", index: 6 },
        { abbr: "AGO", index: 7 },
        { abbr: "SET", index: 8 },
        { abbr: "OUT", index: 9 },
        { abbr: "NOV", index: 10 },
        { abbr: "DEZ", index: 11 },
      ];

      months.forEach(({ abbr, index }) => {
        const date = parseInputDate(`2026-${abbr}-15`);
        expect(date?.getMonth()).toBe(index);
      });
    });

    it("should return null for invalid formats", () => {
      expect(parseInputDate("15/02/2026")).toBeNull();
      expect(parseInputDate("abc")).toBeNull();
      expect(parseInputDate("")).toBeNull();
      expect(parseInputDate("2026-FEB-15")).toBeNull(); // Inglês
    });

    it("should return null for invalid month numbers", () => {
      expect(parseInputDate("2026-00-15")).toBeNull();
      expect(parseInputDate("2026-13-15")).toBeNull();
    });

    it("should return null for invalid day numbers", () => {
      expect(parseInputDate("2026-02-00")).toBeNull();
      expect(parseInputDate("2026-02-32")).toBeNull();
      expect(parseInputDate("2026-04-31")).toBeNull(); // Abril tem 30 dias
    });

    it("should validate leap year February correctly", () => {
      // 2024 é bissexto
      expect(parseInputDate("2024-02-29")).not.toBeNull();
      // 2026 não é bissexto
      expect(parseInputDate("2026-02-29")).toBeNull();
      expect(parseInputDate("2026-FEV-29")).toBeNull();
    });

    it("should validate days per month correctly", () => {
      // Fevereiro (não bissexto)
      expect(parseInputDate("2026-02-28")).not.toBeNull();
      expect(parseInputDate("2026-02-29")).toBeNull();
      
      // Abril (30 dias)
      expect(parseInputDate("2026-04-30")).not.toBeNull();
      expect(parseInputDate("2026-04-31")).toBeNull();
      
      // Dezembro (31 dias)
      expect(parseInputDate("2026-12-31")).not.toBeNull();
    });

    it("should return null for out of range years", () => {
      expect(parseInputDate("1899-01-01")).toBeNull();
      expect(parseInputDate("2101-01-01")).toBeNull();
    });
  });

  describe("formatToYYYYMMMDD", () => {
    it("should format date to YYYY-MMM-DD with PT-BR month", () => {
      const date = new Date(2026, 1, 15); // 15 de fevereiro de 2026
      expect(formatToYYYYMMMDD(date)).toBe("2026-FEV-15");
    });

    it("should pad single-digit days with zero", () => {
      const date = new Date(2026, 2, 5); // 5 de março de 2026
      expect(formatToYYYYMMMDD(date)).toBe("2026-MAR-05");
    });

    it("should format all 12 months correctly", () => {
      const expectedMonths = [
        "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
        "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
      ];

      expectedMonths.forEach((month, index) => {
        const date = new Date(2026, index, 15);
        expect(formatToYYYYMMMDD(date)).toBe(`2026-${month}-15`);
      });
    });

    it("should handle first and last day of year", () => {
      const firstDay = new Date(2026, 0, 1);
      const lastDay = new Date(2026, 11, 31);
      
      expect(formatToYYYYMMMDD(firstDay)).toBe("2026-JAN-01");
      expect(formatToYYYYMMMDD(lastDay)).toBe("2026-DEZ-31");
    });

    it("should handle leap year February 29", () => {
      const leapDay = new Date(2024, 1, 29);
      expect(formatToYYYYMMMDD(leapDay)).toBe("2024-FEV-29");
    });
  });

  describe("toIsoDateForWire", () => {
    it("converts pt-BR YYYY-MMM-DD to ISO YYYY-MM-DD for all 12 months", () => {
      const cases: [string, string][] = [
        ["2026-JAN-15", "2026-01-15"],
        ["2026-FEV-15", "2026-02-15"],
        ["2026-MAR-15", "2026-03-15"],
        ["2026-ABR-15", "2026-04-15"],
        ["2026-MAI-09", "2026-05-09"],
        ["2026-JUN-06", "2026-06-06"],
        ["2026-JUL-04", "2026-07-04"],
        ["2026-AGO-15", "2026-08-15"],
        ["2026-SET-12", "2026-09-12"],
        ["2026-OUT-10", "2026-10-10"],
        ["2026-NOV-07", "2026-11-07"],
        ["2026-DEZ-25", "2026-12-25"],
      ];
      for (const [input, expected] of cases) {
        expect(toIsoDateForWire(input)).toBe(expected);
      }
    });

    it("passes through ISO YYYY-MM-DD unchanged", () => {
      expect(toIsoDateForWire("2026-04-11")).toBe("2026-04-11");
      expect(toIsoDateForWire("2026-12-31")).toBe("2026-12-31");
    });

    it("strips time portion of full ISO timestamps", () => {
      expect(toIsoDateForWire("2026-04-11T00:00:00.000Z")).toBe("2026-04-11");
      expect(toIsoDateForWire("2026-05-30T15:30:00Z")).toBe("2026-05-30");
    });

    it("returns null for empty/null/undefined", () => {
      expect(toIsoDateForWire(null)).toBeNull();
      expect(toIsoDateForWire(undefined)).toBeNull();
      expect(toIsoDateForWire("")).toBeNull();
      expect(toIsoDateForWire("   ")).toBeNull();
    });

    it("returns null for unparseable input", () => {
      expect(toIsoDateForWire("not a date")).toBeNull();
      expect(toIsoDateForWire("2026-FEB-15")).toBeNull(); // English abbr not accepted
      expect(toIsoDateForWire("15/02/2026")).toBeNull();
      expect(toIsoDateForWire("2026-13-01")).toBeNull();
    });

    it("trims surrounding whitespace before parsing", () => {
      expect(toIsoDateForWire("  2026-MAI-09  ")).toBe("2026-05-09");
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain date integrity after parse and format", () => {
      const original = "2026-02-15";
      const parsed = parseInputDate(original);
      const formatted = parsed ? formatToYYYYMMMDD(parsed) : null;
      
      expect(formatted).toBe("2026-FEV-15");
    });

    it("should convert numeric format to month abbreviation", () => {
      const numericInput = "2026-03-25";
      const parsed = parseInputDate(numericInput);
      const formatted = parsed ? formatToYYYYMMMDD(parsed) : null;
      
      expect(formatted).toBe("2026-MAR-25");
    });

    it("should preserve abbreviated format", () => {
      const alphaInput = "2026-DEZ-31";
      const parsed = parseInputDate(alphaInput);
      const formatted = parsed ? formatToYYYYMMMDD(parsed) : null;
      
      expect(formatted).toBe("2026-DEZ-31");
    });
  });
});
