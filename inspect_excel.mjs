import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/ezzin/Downloads/EtatsFinanciers_SCE_Societe_2026 (13).xlsx');
  
  wb.eachSheet((ws, id) => {
    console.log('=== SHEET ' + id + ': ' + ws.name + ' ===');
    ws.eachRow((row, rowNum) => {
      console.log('Row ' + rowNum + ': ' + JSON.stringify(row.values));
    });
    console.log('');
  });
}
main().catch(e => console.error('Error:', e.message, e.stack));
