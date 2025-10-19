// src/main.js - entry for Vite
import './style.css';

// Import libraries via ESM
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

// Re-export globals expected by existing code
window.echarts = echarts;
window.XLSX = XLSX;

// Existing script was in project root as script.js; to minimize churn,
// load it dynamically so current code paths continue to work.
import('../script.js').catch(err => console.error('Failed to load legacy script:', err));
