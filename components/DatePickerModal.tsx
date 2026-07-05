import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, radius, shadows, typography } from '@/constants/theme';

export default function DatePickerModal({
  visible,
  currentDateStr,
  onClose,
  onSelect,
}: {
  visible: boolean;
  currentDateStr: string;
  onClose: () => void;
  onSelect: (date: string) => void;
}) {
  const [baseDate, setBaseDate] = useState(() => {
    if (currentDateStr) {
      const parts = currentDateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date();
  });

  const [displayYear, setDisplayYear] = useState(baseDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(baseDate.getMonth());
  const [mode, setMode] = useState<'date' | 'month' | 'year'>('date');
  const [yearPageStart, setYearPageStart] = useState(() => {
    return baseDate.getFullYear() - (baseDate.getFullYear() % 12);
  });

  useEffect(() => {
    if (currentDateStr) {
      const parts = currentDateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        setBaseDate(d);
        setDisplayYear(d.getFullYear());
        setDisplayMonth(d.getMonth());
      }
    }
  }, [currentDateStr]);

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayIndex = new Date(displayYear, displayMonth, 1).getDay();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) daysArray.push(null);
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = new Date(displayYear, displayMonth).toLocaleString('default', { month: 'long' });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => {
                if (mode === 'date') handlePrevMonth();
                else if (mode === 'month') setDisplayYear(displayYear - 1);
                else if (mode === 'year') setYearPageStart(yearPageStart - 12);
              }} 
              style={styles.navBtn}
            >
              <ChevronLeft size={20} color={colors.text1} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                if (mode === 'date') {
                  setYearPageStart(displayYear - (displayYear % 12));
                  setMode('year');
                } else if (mode === 'month') {
                  setYearPageStart(displayYear - (displayYear % 12));
                  setMode('year');
                }
              }}
            >
              <Text style={styles.monthTitle}>
                {mode === 'date' && `${monthName} ${displayYear}`}
                {mode === 'month' && `${displayYear}`}
                {mode === 'year' && `${yearPageStart} - ${yearPageStart + 11}`}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                if (mode === 'date') handleNextMonth();
                else if (mode === 'month') setDisplayYear(displayYear + 1);
                else if (mode === 'year') setYearPageStart(yearPageStart + 12);
              }} 
              style={styles.navBtn}
            >
              <ChevronRight size={20} color={colors.text1} />
            </TouchableOpacity>
          </View>

          {mode === 'date' && (
            <>
              <View style={styles.weekdaysRow}>
                {weekdays.map(d => (
                  <Text key={d} style={styles.weekdayText}>{d}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {daysArray.map((day, idx) => {
                  if (day === null) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const isSelected = 
                    displayYear === baseDate.getFullYear() &&
                    displayMonth === baseDate.getMonth() &&
                    day === baseDate.getDate();

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[styles.dayCell, isSelected && styles.selectedDayCell]}
                      onPress={() => {
                        const selectedDate = new Date(displayYear, displayMonth, day);
                        const yy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        onSelect(`${yy}-${mm}-${dd}`);
                        onClose();
                      }}
                    >
                      <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {mode === 'month' && (
            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }).map((_, i) => {
                const mName = new Date(displayYear, i).toLocaleString('default', { month: 'short' });
                const isSelected = displayYear === baseDate.getFullYear() && i === baseDate.getMonth();
                return (
                  <TouchableOpacity
                    key={`month-${i}`}
                    style={[styles.monthYearCell, isSelected && styles.selectedDayCell]}
                    onPress={() => {
                      setDisplayMonth(i);
                      setMode('date');
                    }}
                  >
                    <Text style={[styles.monthYearText, isSelected && styles.selectedDayText]}>
                      {mName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {mode === 'year' && (
            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }).map((_, i) => {
                const y = yearPageStart + i;
                const isSelected = y === baseDate.getFullYear();
                return (
                  <TouchableOpacity
                    key={`year-${y}`}
                    style={[styles.monthYearCell, isSelected && styles.selectedDayCell]}
                    onPress={() => {
                      setDisplayYear(y);
                      setMode('month');
                    }}
                  >
                    <Text style={[styles.monthYearText, isSelected && styles.selectedDayText]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={styles.footer}>
             <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Cancel</Text>
             </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: 20, width: '85%', maxWidth: 360, ...shadows.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgTertiary, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { fontSize: 16, fontFamily: typography.bold, color: colors.text1 },
  weekdaysRow: { flexDirection: 'row', marginBottom: 10 },
  weekdayText: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: typography.semiBold, color: colors.text4 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm, marginVertical: 2 },
  selectedDayCell: { backgroundColor: colors.mint },
  dayText: { fontSize: 14, fontFamily: typography.medium, color: colors.text1 },
  selectedDayText: { color: colors.white, fontFamily: typography.bold },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthYearCell: { width: '30%', height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: radius.sm, marginVertical: 4 },
  monthYearText: { fontSize: 15, fontFamily: typography.semiBold, color: colors.text1 },
  footer: { marginTop: 16, alignItems: 'flex-end' },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  closeBtnText: { color: colors.text3, fontFamily: typography.semiBold, fontSize: 14 }
});
