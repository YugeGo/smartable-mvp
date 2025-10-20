import Papa from 'papaparse';

export function parseCsvToAoA(csvString) {
  if (!csvString || typeof csvString !== 'string' || csvString.trim() === '') return [];
  const res = Papa.parse(csvString, { delimiter: '', newline: '', skipEmptyLines: false });
  if (res.errors && res.errors.length > 0) console.warn('CSV parse errors:', res.errors.slice(0, 3));
  return Array.isArray(res.data) ? res.data : [];
}

export function unparseAoAToCsv(aoa) {
  if (!Array.isArray(aoa)) return '';
  try { return Papa.unparse(aoa, { newline: '\n' }); }
  catch (e) { console.warn('CSV unparse failed, fallback to join:', e); return aoa.map(row => (Array.isArray(row) ? row.join(',') : String(row ?? ''))).join('\n'); }
}
