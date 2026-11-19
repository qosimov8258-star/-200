/// 1234567 -> "1 234 567" (minglik ajratgich — bo'sh joy).
String formatCount(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// Ishorali ko'rinish: 120 -> "+120", -5 -> "-5", 0 -> "0".
String formatSigned(int value) =>
    value > 0 ? '+${formatCount(value)}' : formatCount(value);

String _two(int n) => n.toString().padLeft(2, '0');

/// "17.11"
String formatDayMonth(DateTime d) => '${_two(d.day)}.${_two(d.month)}';

/// "17.11.2026 09:00"
String formatDateTime(DateTime d) =>
    '${_two(d.day)}.${_two(d.month)}.${d.year} ${_two(d.hour)}:${_two(d.minute)}';
