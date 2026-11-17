import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';

/// Bosh sovrin (avtomobil) ko'rsatilgan katta karta: avtosalon taqdimoti
/// uslubida — yonib turgan podium, yuqoridan tushgan ikki projektor nuri va
/// podiumdagi xira aks.
///
/// Rasm `assets/images/hero_car.png` dan olinadi; fayl bo'lmasa, chizilgan
/// vaqtinchalik siluet ko'rsatiladi.
class PrizeCarHero extends StatefulWidget {
  const PrizeCarHero({super.key, required this.title, required this.body});

  static const carAsset = 'assets/images/hero_car.png';

  /// hero_car.png nisbati (896 x 443).
  static const carAspectRatio = 2.02;

  final String title;
  final String body;

  @override
  State<PrizeCarHero> createState() => _PrizeCarHeroState();
}

class _PrizeCarHeroState extends State<PrizeCarHero>
    with SingleTickerProviderStateMixin {
  // Bir martalik "sahna yoritilishi": nurlar yig'ilib, podium yonadi va
  // mashina joyiga o'tiradi. Doimiy aylanuvchi animatsiya yo'q.
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  late final Animation<double> _light = CurvedAnimation(
    parent: _intro,
    curve: Curves.easeOutCubic,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // "Harakatni kamaytirish" yoqilgan bo'lsa, sahna darhol tayyor holatda.
    if (MediaQuery.disableAnimationsOf(context)) {
      _intro.value = 1;
    } else if (_intro.status == AnimationStatus.dismissed) {
      _intro.forward();
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  /// Mashinaning karta ichidagi o'rni. Fon chizuvchi ham shundan foydalanadi,
  /// shuning uchun podium va nurlar har doim mashinaga to'g'ri keladi.
  static Rect _carRect(Size card) {
    final width = card.width * 0.93;
    final height = width / PrizeCarHero.carAspectRatio;
    final left = (card.width - width) / 2 + card.width * 0.01;
    // Yorliq va matn orasidagi bo'shliqda, biroz yuqoriroqda.
    final top = (card.height - height) * 0.37;
    return Rect.fromLTWH(left, top, width, height);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.card),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final car = _carRect(constraints.biggest);
          return AnimatedBuilder(
            animation: _light,
            builder: (context, _) {
              final t = _light.value;
              return Stack(
                fit: StackFit.expand,
                children: [
                  CustomPaint(
                    painter: _ShowroomPainter(car: car, light: t),
                  ),
                  // Podium yuzasidagi xira aks.
                  Positioned.fromRect(
                    rect: car.translate(0, car.height * 0.90),
                    child: ExcludeSemantics(
                      child: Opacity(
                        opacity: 0.16 * t,
                        child: ShaderMask(
                          blendMode: BlendMode.dstIn,
                          shaderCallback: (bounds) => const LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.white, Colors.transparent],
                            stops: [0, 0.55],
                          ).createShader(bounds),
                          child: Transform.flip(
                            flipY: true,
                            child: const _CarImage(),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned.fromRect(
                    rect: car.translate(0, (1 - t) * 14),
                    child: Opacity(
                      opacity: (0.35 + 0.65 * t).clamp(0.0, 1.0),
                      child: Semantics(
                        image: true,
                        label: l10n.prizeCar,
                        child: const _CarImage(),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _PrizeChip(
                          label: l10n.prizeLabel,
                          value: l10n.prizeCar,
                        ),
                        const Spacer(),
                        Text(
                          widget.title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            height: 1.1,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          widget.body,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 15,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _CarImage extends StatelessWidget {
  const _CarImage();

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      PrizeCarHero.carAsset,
      fit: BoxFit.contain,
      excludeFromSemantics: true,
      errorBuilder: (context, error, stackTrace) => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 6),
        child: CustomPaint(painter: _SedanPainter()),
      ),
    );
  }
}

/// Avtosalon sahnasi: tungi fon, ikki projektor nuri va yonib turgan podium.
class _ShowroomPainter extends CustomPainter {
  const _ShowroomPainter({required this.car, required this.light});

  final Rect car;

  /// 0 — sahna qorong'i, 1 — to'liq yoritilgan.
  final double light;

  static const _warm = Color(0xFFFFD9A8);
  static const _gold = Color(0xFFE8B84A);

  @override
  void paint(Canvas canvas, Size size) {
    final bounds = Offset.zero & size;
    canvas.drawRect(
      bounds,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0F1922), Color(0xFF1C2B38), Color(0xFF101114)],
          stops: [0, 0.5, 1],
        ).createShader(bounds),
    );

    // Podium: g'ildiraklar turgan chiziq atrofidagi yassi ellips.
    final center = Offset(car.center.dx, car.bottom - car.height * 0.07);
    final rx = car.width * 0.515;
    final ry = car.height * 0.20;
    final top = Rect.fromCenter(center: center, width: rx * 2, height: ry * 2);
    final thickness = ry * 0.34;

    _paintBeams(canvas, size, center, rx);

    // Podium atrofidagi polga tushgan iliq yorug'lik.
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(0, thickness),
        width: rx * 2.7,
        height: ry * 3.2,
      ),
      Paint()
        ..color = _warm.withValues(alpha: 0.16 * light)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, ry * 0.9),
    );

    // Podium yon devori va yuzasi.
    final side = Path()
      ..addOval(top.translate(0, thickness))
      ..addRect(
        Rect.fromLTRB(top.left, center.dy, top.right, center.dy + thickness),
      );
    canvas.drawPath(side, Paint()..color = const Color(0xFF0A0D10));
    canvas.drawOval(
      top,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Color.lerp(
              const Color(0xFF1A222B),
              const Color(0xFF4A5766),
              light,
            )!,
            const Color(0xFF151B22),
          ],
        ).createShader(top),
    );

    // Yonib turgan hoshiya: avval yog'du, keyin ingichka chiziq.
    canvas.drawOval(
      top,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = _gold.withValues(alpha: 0.75 * light)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
    );
    canvas.drawOval(
      top,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..shader = SweepGradient(
          colors: [
            _warm.withValues(alpha: 0.35 + 0.65 * light),
            Colors.white.withValues(alpha: 0.2 + 0.8 * light),
            _gold.withValues(alpha: 0.35 + 0.65 * light),
            Colors.white.withValues(alpha: 0.2 + 0.8 * light),
            _warm.withValues(alpha: 0.35 + 0.65 * light),
          ],
        ).createShader(top),
    );

    // Mashina ostidagi soya — u podiumga "o'tirgan"dek ko'rinadi.
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(0, -ry * 0.05),
        width: rx * 1.7,
        height: ry * 1.0,
      ),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.55)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, ry * 0.28),
    );
  }

  /// Yuqori burchaklardan podiumga tushuvchi ikki nur. Boshida ular kengroq
  /// va xira; sahna yorishgan sari podiumga yig'iladi.
  void _paintBeams(Canvas canvas, Size size, Offset target, double rx) {
    for (final side in const [-1.0, 1.0]) {
      final source = Offset(
        size.width / 2 + side * size.width * (0.40 + 0.22 * (1 - light)),
        -size.height * 0.04,
      );
      final spread = rx * (0.95 + 0.5 * (1 - light));
      final lamp = size.width * 0.035;
      final beam = Path()
        ..moveTo(source.dx - lamp, source.dy)
        ..lineTo(source.dx + lamp, source.dy)
        ..lineTo(target.dx + spread, target.dy)
        ..lineTo(target.dx - spread, target.dy)
        ..close();
      canvas.drawPath(
        beam,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.white.withValues(alpha: 0.30 * light),
              _warm.withValues(alpha: 0.05 * light),
            ],
          ).createShader(Rect.fromPoints(source, target))
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.width * 0.03),
      );
      // Projektorning o'zi — yuqoridagi yorqin nuqta.
      canvas.drawCircle(
        source.translate(0, size.height * 0.05),
        math.max(2, size.width * 0.012),
        Paint()
          ..color = Colors.white.withValues(alpha: 0.9 * light)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
    }
  }

  @override
  bool shouldRepaint(_ShowroomPainter old) =>
      old.car != car || old.light != light;
}

class _PrizeChip extends StatelessWidget {
  const _PrizeChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: const BoxDecoration(
              color: AppColors.gold,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.emoji_events,
              size: 18,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    height: 1.2,
                  ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Vaqtinchalik sedan silueti (haqiqiy rasm kelguncha). Aniq model emas.
class _SedanPainter extends CustomPainter {
  const _SedanPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // 400 x 150 shartli tuvalda chizib, mavjud joyga sig'diramiz.
    const w = 400.0, h = 150.0;
    final scale = (size.width / w) < (size.height / h)
        ? size.width / w
        : size.height / h;
    canvas
      ..translate((size.width - w * scale) / 2, (size.height - h * scale) / 2)
      ..scale(scale);

    const wheelY = 112.0, rearX = 88.0, frontX = 308.0, wheelR = 25.0;

    final body = Path()
      ..moveTo(14, 112)
      ..quadraticBezierTo(6, 108, 8, 92)
      ..quadraticBezierTo(10, 76, 30, 72)
      ..lineTo(78, 66)
      ..quadraticBezierTo(108, 40, 138, 34)
      ..quadraticBezierTo(180, 28, 222, 32)
      ..quadraticBezierTo(250, 38, 286, 66)
      ..quadraticBezierTo(340, 70, 372, 82)
      ..quadraticBezierTo(392, 90, 392, 104)
      ..quadraticBezierTo(392, 112, 384, 112)
      ..close();

    final arches = Path()
      ..addOval(
        Rect.fromCircle(
          center: const Offset(rearX, wheelY),
          radius: wheelR + 5,
        ),
      )
      ..addOval(
        Rect.fromCircle(
          center: const Offset(frontX, wheelY),
          radius: wheelR + 5,
        ),
      );
    final shell = Path.combine(PathOperation.difference, body, arches);

    canvas.drawPath(
      shell,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFFFFF), Color(0xFFE9ECEF), Color(0xFFAEB5BD)],
          stops: [0, 0.55, 1],
        ).createShader(const Rect.fromLTWH(0, 28, w, 84)),
    );

    // Oynalar.
    final glass = Paint()..color = const Color(0xFF1B2733);
    canvas.drawPath(
      Path()
        ..moveTo(96, 66)
        ..quadraticBezierTo(118, 46, 142, 41)
        ..lineTo(176, 38)
        ..lineTo(176, 66)
        ..close(),
      glass,
    );
    canvas.drawPath(
      Path()
        ..moveTo(184, 38)
        ..lineTo(218, 39)
        ..quadraticBezierTo(240, 44, 266, 66)
        ..lineTo(184, 66)
        ..close(),
      glass,
    );

    // Eshik chizig'i, tutqichlar va yon chiziq.
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = const Color(0x33000000);
    canvas.drawLine(const Offset(180, 38), const Offset(180, 104), line);
    canvas.drawLine(const Offset(30, 84), const Offset(372, 88), line);
    final handle = Paint()..color = const Color(0x55000000);
    canvas.drawRRect(
      RRect.fromLTRBR(150, 74, 168, 78, const Radius.circular(2)),
      handle,
    );
    canvas.drawRRect(
      RRect.fromLTRBR(240, 74, 258, 78, const Radius.circular(2)),
      handle,
    );

    // Chiroqlar.
    canvas.drawRRect(
      RRect.fromLTRBR(360, 80, 388, 90, const Radius.circular(5)),
      Paint()..color = const Color(0xFFFFE9B0),
    );
    canvas.drawRRect(
      RRect.fromLTRBR(9, 78, 26, 90, const Radius.circular(5)),
      Paint()..color = const Color(0xFFD64545),
    );

    // G'ildiraklar.
    for (final x in const [rearX, frontX]) {
      final c = Offset(x, wheelY);
      canvas.drawCircle(c, wheelR, Paint()..color = const Color(0xFF111214));
      canvas.drawCircle(
        c,
        wheelR * 0.62,
        Paint()..color = const Color(0xFFC9CED4),
      );
      canvas.drawCircle(
        c,
        wheelR * 0.2,
        Paint()..color = const Color(0xFF55595F),
      );
    }
  }

  @override
  bool shouldRepaint(_SedanPainter oldDelegate) => false;
}
