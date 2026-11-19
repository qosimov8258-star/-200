import 'dart:math' as math;
import 'dart:ui' show ImageFilter, lerpDouble;

import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../theme/app_theme.dart';

class GlassNavItem {
  const GlassNavItem({
    required this.key,
    required this.icon,
    required this.activeIcon,
    required this.label,
    this.semanticLabel,
    this.badge = 0,
  });

  final Key key;
  final IconData icon;
  final IconData activeIcon;
  final String label;

  /// Ekran o'quvchisi uchun to'liq nom (yorliq qisqartirilgan bo'lsa).
  final String? semanticLabel;

  /// O'qilmaganlar soni; 0 bo'lsa belgi ko'rsatilmaydi.
  final int badge;
}

/// iOS dagi "liquid glass" tab bar uslubidagi pastki menyu: xira shisha
/// kapsula va bo'limlar orasida oqadigan "linza". Linzani barmoq bilan
/// surish yoki bo'limga bosish mumkin: harakatda u tomchidek cho'ziladi,
/// to'xtaganda yig'ilib tebranadi; bosilganda kattalashadi.
///
/// Haqiqiy optik sinish (refraction) yo'q — u blur, yaltiroq hoshiya va
/// soya bilan taqlid qilingan.
class GlassNavBar extends StatefulWidget {
  const GlassNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelected,
  });

  final List<GlassNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelected;

  static const height = 66.0;
  static const _inset = 5.0;

  @override
  State<GlassNavBar> createState() => _GlassNavBarState();
}

class _GlassNavBarState extends State<GlassNavBar>
    with SingleTickerProviderStateMixin {
  // Tomchi fizikasi: linzaning old qirrasi (lead) nishonga tez yetadi, orqa
  // qirrasi (trail) kechikib ergashadi. Ular orasidagi masofa linzani
  // cho'zadi — harakatda tomchidek cho'zilib, to'xtaganda yig'ilib tebranadi.
  static const _leadStiffness = 520.0;
  static const _leadDamping = 30.0;
  static const _trailStiffness = 210.0;
  static const _trailDamping = 21.0;

  /// Tomchi eng ko'pi bilan bo'lim kengligining shuncha qismiga cho'ziladi.
  static const _maxStretchFactor = 1.05;

  late final Ticker _ticker = createTicker(_onTick);
  Duration _lastTick = Duration.zero;

  /// Barmoq ostidagi nuqta (menyu koordinatasida); null — tegilmayapti.
  double? _touchX;

  /// Barmoq surilyapti: old qirra barmoqqa kechikmasdan ergashadi.
  var _dragging = false;

  /// Tanlov ota vidjetga yetib borguncha linza shu bo'limda turadi.
  int? _pendingIndex;

  /// Linza chap chetining nishoni; null — hali joylashtirilmagan.
  double? _target;
  var _maxStretch = double.infinity;
  var _lead = 0.0;
  var _leadVelocity = 0.0;
  var _trail = 0.0;
  var _trailVelocity = 0.0;

  int get _index => _pendingIndex ?? widget.currentIndex;

  @override
  void didUpdateWidget(GlassNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex ||
        widget.currentIndex == _pendingIndex) {
      _pendingIndex = null;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  double _itemWidth(double barWidth) =>
      (barWidth - GlassNavBar._inset * 2) / widget.items.length;

  int _indexAt(double x, double barWidth) {
    final raw = ((x - GlassNavBar._inset) / _itemWidth(barWidth)).floor();
    return raw.clamp(0, widget.items.length - 1);
  }

  /// Nishonni yangilaydi va kerak bo'lsa fizikani ishga tushiradi.
  void _aimAt(double target) {
    if (_target == null) {
      // Birinchi chizishda linza joyida paydo bo'ladi, animatsiyasiz.
      _target = _lead = _trail = target;
      return;
    }
    _target = target;
    if (!_ticker.isActive && !_atRest) {
      _lastTick = Duration.zero;
      _ticker.start();
    }
  }

  bool get _atRest {
    final target = _target;
    if (target == null) return true;
    return (_lead - target).abs() < 0.2 &&
        (_trail - target).abs() < 0.2 &&
        _leadVelocity.abs() < 4 &&
        _trailVelocity.abs() < 4;
  }

  void _onTick(Duration elapsed) {
    final target = _target;
    if (target == null) return;
    // Kadr tushib qolsa ham prujina "portlab" ketmasligi uchun qadam cheklangan.
    final dt = ((elapsed - _lastTick).inMicroseconds / 1e6).clamp(0.0, 1 / 30);
    _lastTick = elapsed;

    setState(() {
      if (_dragging) {
        _leadVelocity = dt > 0 ? (target - _lead) / dt : 0;
        _lead = target;
      } else {
        final force =
            (target - _lead) * _leadStiffness - _leadVelocity * _leadDamping;
        _leadVelocity += force * dt;
        _lead += _leadVelocity * dt;
      }
      final trailForce =
          (_lead - _trail) * _trailStiffness - _trailVelocity * _trailDamping;
      _trailVelocity += trailForce * dt;
      _trail += _trailVelocity * dt;

      // Dum boshdan juda uzoqlashib ketmaydi — tomchi uzilmaydi.
      final maxStretch = _maxStretch;
      if ((_lead - _trail).abs() > maxStretch) {
        _trail = _lead + (_trail < _lead ? -maxStretch : maxStretch);
        _trailVelocity = _leadVelocity;
      }

      if (!_dragging && _atRest) {
        _lead = _trail = target;
        _leadVelocity = _trailVelocity = 0;
        _ticker.stop();
      }
    });
  }

  void _touch(double x, {required bool dragging}) {
    setState(() {
      _touchX = x;
      _dragging = dragging;
    });
  }

  void _release() {
    if (_touchX == null) return;
    setState(() {
      _touchX = null;
      _dragging = false;
    });
  }

  void _commit(double barWidth) {
    final x = _touchX;
    if (x == null) return;
    final index = _indexAt(x, barWidth);
    if (index != widget.currentIndex) HapticFeedback.selectionClick();
    setState(() {
      _pendingIndex = index;
      _touchX = null;
      _dragging = false;
    });
    widget.onSelected(index);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: GlassNavBar.height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final barWidth = constraints.maxWidth;
          final itemWidth = _itemWidth(barWidth);
          final touchX = _touchX;
          final pressed = touchX != null;

          const minLeft = GlassNavBar._inset;
          final maxLeft = barWidth - GlassNavBar._inset - itemWidth;
          _aimAt(
            pressed
                ? (touchX - itemWidth / 2).clamp(minLeft, maxLeft)
                : minLeft + _index * itemWidth,
          );

          _maxStretch = itemWidth * _maxStretchFactor;

          // Tomchi: bosh (lead) tomonda to'liq, dum (trail) tomonda ingichka.
          final headOnRight = _lead >= _trail;
          final stretch = (_lead - _trail).abs();
          final left = headOnRight ? _trail : _lead;
          final width = itemWidth + stretch;

          // Ikonkalar tomchi boshi ostidagi bo'limga qarab yonadi.
          final activeIndex = _indexAt(_lead + itemWidth / 2, barWidth);

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => _touch(d.localPosition.dx, dragging: false),
            onTapUp: (_) => _commit(barWidth),
            onTapCancel: _release,
            onHorizontalDragStart: (d) =>
                _touch(d.localPosition.dx, dragging: true),
            onHorizontalDragUpdate: (d) =>
                _touch(d.localPosition.dx, dragging: true),
            onHorizontalDragEnd: (_) => _commit(barWidth),
            onHorizontalDragCancel: _release,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                const Positioned.fill(child: _GlassCapsule()),
                TweenAnimationBuilder<double>(
                  tween: Tween(end: pressed ? 1 : 0),
                  duration: const Duration(milliseconds: 240),
                  curve: Curves.easeOutBack,
                  builder: (context, press, _) {
                    // Bosilganda linza har tomonga bir necha piksel shishadi.
                    final grow = 5 * press;
                    return Positioned(
                      left: left - grow,
                      top: GlassNavBar._inset - grow,
                      bottom: GlassNavBar._inset - grow,
                      width: width + grow * 2,
                      child: CustomPaint(
                        painter: _DropletPainter(
                          bodyWidth: itemWidth + grow * 2,
                          headOnRight: headOnRight,
                          taper: (stretch / _maxStretch).clamp(0.0, 1.0),
                          press: press.clamp(0.0, 1.0),
                        ),
                      ),
                    );
                  },
                ),
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: GlassNavBar._inset,
                    ),
                    child: Row(
                      children: [
                        for (var i = 0; i < widget.items.length; i++)
                          Expanded(
                            child: _NavItemView(
                              item: widget.items[i],
                              active: i == activeIndex,
                              selected: i == _index,
                              onActivate: () => widget.onSelected(i),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Xira shisha kapsula: orqa fon blur qilinadi, ustidan yarim shaffof oq
/// qatlam va yorug'lik tushgandek hoshiya chiziladi.
class _GlassCapsule extends StatelessWidget {
  const _GlassCapsule();

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadius.pill);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withValues(alpha: 0.14),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
          BoxShadow(
            color: AppColors.ink.withValues(alpha: 0.06),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: radius,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.white.withValues(alpha: 0.72),
                  Colors.white.withValues(alpha: 0.48),
                ],
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.85),
                width: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tanlangan bo'lim ustidagi "linza"ni tomchi shaklida chizadi.
///
/// Tinch holatda bu oddiy kapsula. Harakatda bosh qismi ([bodyWidth] kenglikda)
/// to'liq balandlikda qoladi, orqasidan ingichkalashib boruvchi dum cho'ziladi.
class _DropletPainter extends CustomPainter {
  const _DropletPainter({
    required this.bodyWidth,
    required this.headOnRight,
    required this.taper,
    required this.press,
  });

  /// Tomchi boshining (kapsulaning) kengligi.
  final double bodyWidth;
  final bool headOnRight;

  /// 0 — cho'zilmagan, 1 — eng ko'p cho'zilgan (dum eng ingichka).
  final double taper;

  /// 0 — tinch, 1 — bosilgan (tiniqroq va ko'tarilgan).
  final double press;

  static const _minTailRatio = 0.42;

  Path _shape(Size size) {
    final r = size.height / 2;
    final tailLength = size.width - bodyWidth;
    final tailRadius = r * (1 - (1 - _minTailRatio) * taper);
    // Bosh o'ngda deb chizamiz; chapda bo'lsa, tuval ko'zguda aks ettiriladi.
    final tailCenter = Offset(tailRadius, r);
    final bodyLeft = Offset(tailLength + r, r);
    final bodyRight = Offset(size.width - r, r);
    final distance = bodyLeft.dx - tailCenter.dx;

    if (tailLength < 0.5 || distance <= r - tailRadius) {
      return Path()..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(r)),
      );
    }

    // Ikki aylanaga tashqi urinma: phi — urinmaning gorizontdan og'ishi.
    final phi = math.asin(((r - tailRadius) / distance).clamp(-1.0, 1.0));
    Rect circle(Offset c, double radius) =>
        Rect.fromCircle(center: c, radius: radius);

    return Path()
      ..arcTo(circle(bodyLeft, r), -math.pi / 2 - phi, phi, true)
      ..arcTo(circle(bodyRight, r), -math.pi / 2, math.pi, false)
      ..arcTo(circle(bodyLeft, r), math.pi / 2, phi, false)
      ..arcTo(
        circle(tailCenter, tailRadius),
        math.pi / 2 + phi,
        math.pi - 2 * phi,
        false,
      )
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (!headOnRight) {
      canvas
        ..translate(size.width, 0)
        ..scale(-1, 1);
    }
    final path = _shape(size);
    final bounds = Offset.zero & size;

    canvas.drawPath(
      path.shift(Offset(0, lerpDouble(1, 6, press)!)),
      Paint()
        ..color = AppColors.ink.withValues(
          alpha: lerpDouble(0.07, 0.20, press)!,
        )
        ..maskFilter = MaskFilter.blur(
          BlurStyle.normal,
          lerpDouble(4, 12, press)!,
        ),
    );

    final top = Color.lerp(
      AppColors.ink.withValues(alpha: 0.05),
      Colors.white.withValues(alpha: 0.78),
      press,
    )!;
    final bottom = Color.lerp(
      AppColors.ink.withValues(alpha: 0.11),
      Colors.white.withValues(alpha: 0.34),
      press,
    )!;
    canvas.drawPath(
      path,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [top, bottom],
        ).createShader(bounds),
    );
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = lerpDouble(1, 1.5, press)!
        ..color = Colors.white.withValues(alpha: lerpDouble(0.9, 1, press)!),
    );
  }

  @override
  bool shouldRepaint(_DropletPainter old) =>
      old.bodyWidth != bodyWidth ||
      old.headOnRight != headOnRight ||
      old.taper != taper ||
      old.press != press;
}

class _NavItemView extends StatelessWidget {
  const _NavItemView({
    required this.item,
    required this.active,
    required this.selected,
    required this.onActivate,
  });

  final GlassNavItem item;

  /// Linza hozir shu bo'lim ustida (surish paytida tanlangandan farq qiladi).
  final bool active;
  final bool selected;
  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.ink : AppColors.ink.withValues(alpha: 0.5);
    return Semantics(
      key: item.key,
      container: true,
      button: true,
      selected: selected,
      label: item.semanticLabel ?? item.label,
      onTap: onActivate,
      child: ExcludeSemantics(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedScale(
              scale: active ? 1.08 : 1,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    active ? item.activeIcon : item.icon,
                    size: 25,
                    color: color,
                  ),
                  if (item.badge > 0)
                    Positioned(
                      top: -4,
                      right: -8,
                      child: Container(
                        key: const Key('nav-unread-badge'),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.negative,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        child: Text(
                          item.badge > 9 ? '9+' : '${item.badge}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            height: 1.1,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 220),
              style: TextStyle(
                fontSize: 10.5,
                height: 1.1,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
              child: Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
