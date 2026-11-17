import 'package:flutter_test/flutter_test.dart';
import 'package:reels_tanlov/features/reels/reel_url.dart';

void main() {
  group('parseReelShortcode', () {
    test('accepts common Reel link shapes', () {
      const valid = {
        'https://www.instagram.com/reel/Cx1AbC_d-9/': 'Cx1AbC_d-9',
        'https://instagram.com/reels/Cx1AbC_d-9': 'Cx1AbC_d-9',
        'https://www.instagram.com/p/Cx1AbC_d-9/?igsh=abc': 'Cx1AbC_d-9',
        'https://www.instagram.com/someuser/reel/Cx1AbC_d-9/': 'Cx1AbC_d-9',
        '  https://m.instagram.com/reel/Cx1AbC_d-9  ': 'Cx1AbC_d-9',
      };
      valid.forEach((url, code) {
        expect(parseReelShortcode(url), code, reason: url);
      });
    });

    test('rejects everything else', () {
      const invalid = [
        '',
        'salom',
        'instagram.com/reel/Cx1AbC_d-9',
        'https://www.instagram.com/',
        'https://www.instagram.com/someuser/',
        'https://www.instagram.com/reel/',
        'https://www.instagram.com/reel/a b',
        'https://evil.com/reel/Cx1AbC_d-9',
        'https://instagram.com.evil.com/reel/Cx1AbC_d-9',
        'https://www.tiktok.com/@u/video/123456',
        'javascript:alert(1)',
      ];
      for (final url in invalid) {
        expect(parseReelShortcode(url), isNull, reason: url);
      }
    });

    test('canonical url drops tracking params', () {
      expect(
        canonicalReelUrl('Cx1AbC_d-9'),
        'https://www.instagram.com/reel/Cx1AbC_d-9/',
      );
    });
  });
}
