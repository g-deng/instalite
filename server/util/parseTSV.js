// parseTSV.js
import fs from "fs";

/**
 * Reads a TSV file and returns an array of record objects.
 * The first line of the file should contain headers.
 *
 * @param {string} filePath - The path to the TSV file.
 * @returns {Array<Object>} - An array of records.
 */
export function parseTSVFile(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split("\n").filter((line) => line.trim() !== "");
  
  const headers = lines[0].split("\t").map((header) => header.trim());
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\t");
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ? values[index].trim() : "";
    });
    records.push(record);
  }
  
  return records;
}
