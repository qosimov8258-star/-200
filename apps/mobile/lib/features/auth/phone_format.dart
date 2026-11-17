import 'package:flutter/services.dart';

const phonePrefix = '+998';
const phoneDigits = 9;

final _nonDigits = RegExp(r'\D');
final _e164 = RegExp(r'^\+998(\d{2})(\d{3})(\d{2})(\d{2})$');

/// Faqat raqamlarni qoldiradi.
String digitsOnly(String input) => input.replaceAll(_nonDigits, '');

/// "901234567" -> "90 123 45 67" (to'liq bo'lmasa — bor qismi).
String groupNationalNumber(String digits) {
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length && i < phoneDigits; i++) {
    if (i == 2 || i == 5 || i == 7) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// "+998901234567" -> "+998 90 123 45 67". Boshqa ko'rinishdagi qiymat
/// o'zgarishsiz qaytadi.
String formatPhone(String phone) {
  final match = _e164.firstMatch(phone);
  if (match == null) return phone;
  return '$phonePrefix ${match[1]} ${match[2]} ${match[3]} ${match[4]}';
}

/// Yozish paytida raqamni "90 123 45 67" ko'rinishida guruhlaydi.
class UzPhoneInputFormatter extends TextInputFormatter {
  const UzPhoneInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = digitsOnly(newValue.text);
    // To'liq raqam qo'yilganda (+998... yoki 998...) davlat kodini olib tashlaymiz.
    if (digits.length > phoneDigits && digits.startsWith('998')) {
      digits = digits.substring(3);
    }
    if (digits.length > phoneDigits) digits = digits.substring(0, phoneDigits);
    final text = groupNationalNumber(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
