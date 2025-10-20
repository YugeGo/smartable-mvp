let _echartsMod = null;
export async function getEcharts() {
  if (_echartsMod) return _echartsMod;
  const mod = await import('echarts');
  _echartsMod = mod?.default || mod;
  try { window.echarts = _echartsMod; } catch {}
  return _echartsMod;
}

let _xlsxMod = null;
export async function getXLSX() {
  if (_xlsxMod) return _xlsxMod;
  const mod = await import('xlsx');
  _xlsxMod = mod?.default || mod;
  try { window.XLSX = _xlsxMod; } catch {}
  return _xlsxMod;
}
