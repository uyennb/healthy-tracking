// @ts-ignore
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { DailyLog, UserProfile, Language } from '../types/health';
import { calculateSummary, formatWorkoutDurationHMS } from './dateUtils';
import { format, parseISO } from 'date-fns';

/**
 * Export health data to a professionally formatted Excel (.xlsx) report
 */
export async function exportHealthReportToExcel(
  logs: DailyLog[],
  profile?: UserProfile,
  language: Language = 'vi'
): Promise<void> {
  const isVi = language === 'vi';
  const summary = calculateSummary(logs || []);
  const now = new Date();
  const dateExportStr = format(now, 'yyyy-MM-dd');

  const WorkbookClass = (ExcelJS as any).Workbook || (ExcelJS as any).default?.Workbook || (ExcelJS as any).default || ExcelJS;
  const workbook = new WorkbookClass();
  workbook.creator = 'NutriFit Health Tracker';
  workbook.lastModifiedBy = 'NutriFit';
  workbook.created = now;
  workbook.modified = now;

  // ---------------------------------------------------------
  // SHEET 1: Health Summary
  // ---------------------------------------------------------
  const summarySheet = workbook.addWorksheet(isVi ? 'Health Summary' : 'Health Summary', {
    views: [{ showGridLines: true }],
  });

  // Sheet 1 Column widths
  summarySheet.columns = [
    { width: 5 },  // Margin column A
    { width: 34 }, // Column B - Indicator / Metric name
    { width: 22 }, // Column C - Value
    { width: 18 }, // Column D - Unit
    { width: 32 }, // Column E - Notes / Evaluation
  ];

  // Title Banner
  summarySheet.mergeCells('B2:E2');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = isVi ? 'BÁO CÁO THEO DÕI SỨC KHỎE & DINH DƯỠNG' : 'HEALTH & NUTRITION TRACKING REPORT';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Teal 700
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 40;

  // Subtitle / App branding
  summarySheet.mergeCells('B3:E3');
  const subCell = summarySheet.getCell('B3');
  subCell.value = isVi
    ? `NutriFit Tracker • Ngày xuất báo cáo: ${format(now, 'dd/MM/yyyy HH:mm')}`
    : `NutriFit Tracker • Exported: ${format(now, 'yyyy-MM-dd HH:mm')}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(3).height = 20;

  // Section 1: User Profile (if available)
  let currentRow = 5;
  summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
  const profHeader = summarySheet.getCell(`B${currentRow}`);
  profHeader.value = isVi ? '1. THÔNG TIN HỒ SƠ NGƯỜI DÙNG' : '1. USER PROFILE INFORMATION';
  profHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  profHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  summarySheet.getRow(currentRow).height = 24;
  currentRow++;

  const profileRows = [
    [isVi ? 'Họ và tên' : 'Full Name', profile?.name || 'Bảo Uyên', '', ''],
    [isVi ? 'Giới tính' : 'Gender', profile?.gender === 'female' ? (isVi ? 'Nữ' : 'Female') : (isVi ? 'Nam' : 'Male'), '', ''],
    [isVi ? 'Chiều cao' : 'Height', profile?.height || 162, 'cm', ''],
    [isVi ? 'Cân nặng' : 'Weight', profile?.weight || 54, 'kg', ''],
  ];

  profileRows.forEach(row => {
    const r = summarySheet.getRow(currentRow);
    r.getCell(2).value = row[0];
    r.getCell(3).value = row[1];
    r.getCell(4).value = row[2];
    r.getCell(5).value = row[3];
    r.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
    r.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
    currentRow++;
  });

  currentRow++; // blank line

  // Section 2: Overall Period Summary
  summarySheet.mergeCells(`B${currentRow}:E${currentRow}`);
  const statsHeader = summarySheet.getCell(`B${currentRow}`);
  statsHeader.value = isVi ? '2. TỔNG QUAN CHỈ SỐ SỨC KHỎE TRUNG BÌNH' : '2. AVERAGE HEALTH & FITNESS METRICS';
  statsHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  statsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  summarySheet.getRow(currentRow).height = 24;
  currentRow++;

  // Table Headers
  const tableHeaderRow = summarySheet.getRow(currentRow);
  tableHeaderRow.values = [
    '',
    isVi ? 'Chỉ Số Sức Khỏe' : 'Health Metric',
    isVi ? 'Giá Trị Trung Bình' : 'Average Value',
    isVi ? 'Đơn Vị' : 'Unit',
    isVi ? 'Đánh Giá / Trạng Thái' : 'Status / Evaluation',
  ];
  for (let c = 2; c <= 5; c++) {
    const cell = tableHeaderRow.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
  }
  tableHeaderRow.height = 26;
  currentRow++;

  const isDeficit = summary.avgDeficit <= 0;
  const balanceEval = isDeficit
    ? (isVi ? `Thâm hụt -${Math.abs(summary.avgDeficit)} kcal (Giảm cân/Siết mỡ)` : `Deficit -${Math.abs(summary.avgDeficit)} kcal (Fat loss)`)
    : (isVi ? `Dư thừa +${summary.avgDeficit} kcal (Tăng cân/Dư calo)` : `Surplus +${summary.avgDeficit} kcal (Weight gain)`);

  const summaryData = [
    {
      metric: isVi ? 'Số ngày ghi nhận dữ liệu' : 'Total Recorded Days',
      val: summary.totalDays,
      unit: isVi ? 'ngày' : 'days',
      eval: isVi ? `${summary.totalDays} ngày được theo dõi` : `${summary.totalDays} days tracked`,
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Calo Nạp Vào (Calorie Intake)' : 'Calorie Intake (Avg)',
      val: summary.avgCaloIn,
      unit: 'kcal / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Năng lượng hấp thụ hàng ngày' : 'Daily caloric intake',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Calo Tiêu Thụ (TDEE Out)' : 'Total Energy Expenditure (TDEE)',
      val: summary.avgCaloOut,
      unit: 'kcal / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Tổng năng lượng đốt hàng ngày' : 'Daily total energy burned',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Cân Bằng Năng Lượng (Net Deficit/Surplus)' : 'Calorie Balance (Net)',
      val: summary.avgDeficit,
      unit: 'kcal / ' + (isVi ? 'ngày' : 'day'),
      eval: balanceEval,
      numFormat: '+#,##0;-#,##0;0',
    },
    {
      metric: isVi ? 'Đạm (Protein) trung bình' : 'Average Protein',
      val: summary.avgProtein,
      unit: 'g / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Hỗ trợ duy trì & xây dựng cơ' : 'Muscle maintenance & recovery',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Tinh bột (Carbohydrates) trung bình' : 'Average Carbohydrates',
      val: summary.avgCarbs,
      unit: 'g / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Nguồn năng lượng chính' : 'Primary energy source',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Chất béo (Fats) trung bình' : 'Average Fats',
      val: summary.avgFats,
      unit: 'g / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Chất béo thiết yếu cho cơ thể' : 'Essential dietary lipids',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Chất xơ (Dietary Fiber) trung bình' : 'Average Dietary Fiber',
      val: summary.avgFiber,
      unit: 'g / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? 'Hỗ trợ hệ tiêu hóa khỏe mạnh' : 'Digestive health support',
      numFormat: '#,##0',
    },
    {
      metric: isVi ? 'Thời gian tập trung bình (Workout Avg)' : 'Average Workout Duration',
      val: formatWorkoutDurationHMS(summary.avgWorkoutDuration),
      unit: 'H:MM:SS',
      eval: isVi ? `Tổng: ${formatWorkoutDurationHMS(summary.totalWorkoutDuration)}` : `Total: ${formatWorkoutDurationHMS(summary.totalWorkoutDuration)}`,
      numFormat: undefined,
    },
    {
      metric: isVi ? 'Calo đốt bài tập (Exercise Burn)' : 'Exercise Calories Burned',
      val: summary.avgWorkoutCalo,
      unit: 'kcal / ' + (isVi ? 'ngày' : 'day'),
      eval: isVi ? `Tổng đốt: ${summary.totalWorkoutCalo.toLocaleString()} kcal` : `Total burned: ${summary.totalWorkoutCalo.toLocaleString()} kcal`,
      numFormat: '#,##0',
    },
  ];

  summaryData.forEach((item, idx) => {
    const r = summarySheet.getRow(currentRow);
    r.getCell(2).value = item.metric;
    r.getCell(3).value = item.val;
    r.getCell(4).value = item.unit;
    r.getCell(5).value = item.eval;

    const isEven = idx % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 2; c <= 5; c++) {
      const cell = r.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    r.getCell(2).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    r.getCell(3).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F766E' } };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    if (item.numFormat) {
      r.getCell(3).numFmt = item.numFormat;
    }
    r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(5).font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };

    r.height = 24;
    currentRow++;
  });

  // ---------------------------------------------------------
  // SHEET 2: Detailed Data
  // ---------------------------------------------------------
  const detailSheet = workbook.addWorksheet(isVi ? 'Detailed Data' : 'Detailed Data', {
    views: [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: 2, // Freeze top 2 rows (banner & table header)
        showGridLines: true,
      },
    ],
  });

  // Column definitions with sensible widths
  detailSheet.columns = [
    { key: 'date', width: 14 },
    { key: 'caloIn', width: 16 },
    { key: 'protein', width: 13 },
    { key: 'carbs', width: 13 },
    { key: 'fats', width: 13 },
    { key: 'fiber', width: 13 },
    { key: 'workout', width: 16 },
    { key: 'workoutCalo', width: 16 },
    { key: 'caloOut', width: 16 },
    { key: 'deficit', width: 16 },
    { key: 'note', width: 30 },
  ];

  // Top Banner Row
  detailSheet.mergeCells('A1:K1');
  const detailBanner = detailSheet.getCell('A1');
  detailBanner.value = isVi ? 'BẢNG DỮ LIỆU SỨC KHỎE CHI TIẾT THEO NGÀY' : 'DETAILED DAILY HEALTH & NUTRITION LOGS';
  detailBanner.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  detailBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  detailBanner.alignment = { vertical: 'middle', horizontal: 'center' };
  detailSheet.getRow(1).height = 30;

  // Table Headers
  const detailHeaderRow = detailSheet.getRow(2);
  detailHeaderRow.values = [
    isVi ? 'Ngày' : 'Date',
    isVi ? 'Calo-In (kcal)' : 'Calo-In (kcal)',
    isVi ? 'Protein (g)' : 'Protein (g)',
    isVi ? 'Carbs (g)' : 'Carbs (g)',
    isVi ? 'Fats (g)' : 'Fats (g)',
    isVi ? 'Fiber (g)' : 'Fiber (g)',
    isVi ? 'Workout' : 'Workout',
    isVi ? 'Calo Tập (kcal)' : 'Exercise Calo',
    isVi ? 'TDEE Out (kcal)' : 'TDEE Out (kcal)',
    isVi ? 'Net Deficit (kcal)' : 'Net Deficit (kcal)',
    isVi ? 'Ghi Chú' : 'Notes',
  ];

  for (let c = 1; c <= 11; c++) {
    const cell = detailHeaderRow.getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'center' : c === 11 ? 'left' : 'right' };
  }
  detailHeaderRow.height = 28;

  // Enable AutoFilter on header row
  detailSheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: 11 },
  };

  // Sort logs descending (newest first)
  const sortedLogs = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  sortedLogs.forEach((log, index) => {
    const deficit = log.caloIn - log.caloOut;
    const rowNum = index + 3;
    const row = detailSheet.getRow(rowNum);

    let dateFormatted = log.date;
    try {
      dateFormatted = format(parseISO(log.date), 'dd/MM/yyyy');
    } catch {}

    row.values = [
      dateFormatted,
      log.caloIn,
      log.protein,
      log.carbs,
      log.fats,
      log.fiber,
      formatWorkoutDurationHMS(log.workoutDuration),
      log.workoutCalo,
      log.caloOut,
      deficit,
      log.note || '',
    ];

    const isEven = index % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'center' : c === 11 ? 'left' : 'right' };
    }

    // Number formats
    row.getCell(2).numFmt = '#,##0'; // CaloIn
    row.getCell(3).numFmt = '#,##0'; // Protein
    row.getCell(4).numFmt = '#,##0'; // Carbs
    row.getCell(5).numFmt = '#,##0'; // Fats
    row.getCell(6).numFmt = '#,##0'; // Fiber
    row.getCell(8).numFmt = '#,##0'; // WorkoutCalo
    row.getCell(9).numFmt = '#,##0'; // CaloOut
    row.getCell(10).numFmt = '+#,##0;-#,##0;0'; // Deficit

    // Highlight specific key columns
    row.getCell(2).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF4338CA' } }; // Indigo
    row.getCell(7).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF7E22CE' } }; // Purple
    row.getCell(9).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFE11D48' } }; // Rose

    // Color code Net Deficit: negative (deficit) = emerald green, positive (surplus) = amber
    if (deficit <= 0) {
      row.getCell(10).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF047857' } }; // Emerald
    } else {
      row.getCell(10).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } }; // Amber
    }

    row.height = 22;
  });

  // Export to buffer & trigger browser download or mobile share
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = `Health_Tracking_Report_${dateExportStr}.xlsx`;

  // Try Web Share API with File if supported (e.g. iOS Safari / PWA / Android)
  if (typeof navigator !== 'undefined' && typeof window !== 'undefined') {
    try {
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        lastModified: Date.now(),
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        return;
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User cancelled share dialog
        return;
      }
      console.warn('Web Share API error, falling back to anchor download:', shareErr);
    }
  }

  // Fallback: Standard browser download via anchor
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Safe delayed cleanup - do NOT revoke immediately!
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(url);
    } catch {}
  }, 60000);
}
