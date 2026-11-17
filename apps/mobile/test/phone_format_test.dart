import 'package:flutter_test/flutter_test.dart';
import 'package:reels_tanlov/features/auth/phone_format.dart';

String _type(String input) => const UzPhoneInputFormatter()
    .formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: input))
    .text;

void main() {
  test('groups the national number while typing', () {
    expect(_type('9'), '9');
    expect(_type('901'), '90 1');
    expect(_type('901234'), '90 123 4');
    expect(_type('901234567'), '90 123 45 67');
  });

  test('ignores extra characters and strips a pasted country code', () {
    expect(_type('90-123-45-67'), '90 123 45 67');
    expect(_type('9012345678'), '90 123 45 67');
    expect(_type('+998 90 123 45 67'), '90 123 45 67');
    expect(_type('abc'), '');
  });

  test('formats a full number for display', () {
    expect(formatPhone('+998901234567'), '+998 90 123 45 67');
    expect(formatPhone('12345'), '12345');
  });
}
