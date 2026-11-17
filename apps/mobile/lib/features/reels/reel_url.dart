const _instagramHosts = {
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
};
const _mediaSegments = {'reel', 'reels', 'p'};
final _shortcodePattern = RegExp(r'^[A-Za-z0-9_-]{5,}$');

/// Instagram Reel linkidan shortcode ni ajratadi; link yaroqsiz bo'lsa — null.
///
/// Qabul qilinadi: `https://www.instagram.com/reel/<code>/`,
/// `.../reels/<code>`, `.../p/<code>` va `.../<username>/reel/<code>`.
/// Yakuniy tekshiruv (video mavjudligi, egasi) baribir serverda qilinadi.
String? parseReelShortcode(String input) {
  final uri = Uri.tryParse(input.trim());
  if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http')) {
    return null;
  }
  if (!_instagramHosts.contains(uri.host.toLowerCase())) return null;

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final mediaIndex = segments.indexWhere(_mediaSegments.contains);
  if (mediaIndex < 0 || mediaIndex > 1 || mediaIndex + 1 >= segments.length) {
    return null;
  }
  final code = segments[mediaIndex + 1];
  return _shortcodePattern.hasMatch(code) ? code : null;
}

/// Kuzatuv parametrlarisiz, bir xil ko'rinishdagi link.
String canonicalReelUrl(String shortcode) =>
    'https://www.instagram.com/reel/$shortcode/';
