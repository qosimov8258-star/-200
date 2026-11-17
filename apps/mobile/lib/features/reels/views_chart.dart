import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme.dart';
import '../../widgets/format.dart';
import '../contest/models.dart';

/// Kunlik ko'rishlar ustunli diagrammasi. Oxirgi kun (bugun) ajratilgan.
class ViewsChart extends StatelessWidget {
  const ViewsChart({super.key, required this.gains});

  final List<DailyGain> gains;

  static const _barAreaHeight = 120.0;

  @override
  Widget build(BuildContext context) {
    final maxViews = gains.fold<int>(0, (m, g) => math.max(m, g.views));
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < gains.length; i++)
          Expanded(
            child: _Bar(
              gain: gains[i],
              fraction: maxViews <= 0
                  ? 0
                  : (gains[i].views / maxViews).clamp(0, 1).toDouble(),
              highlighted: i == gains.length - 1,
              maxHeight: _barAreaHeight,
            ),
          ),
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    required this.gain,
    required this.fraction,
    required this.highlighted,
    required this.maxHeight,
  });

  final DailyGain gain;
  final double fraction;
  final bool highlighted;
  final double maxHeight;

  String get _shortValue {
    final v = gain.views;
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 10000) return '${(v / 1000).round()}k';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}k';
    return '$v';
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${formatDayMonth(gain.day)}: ${formatCount(gain.views)}',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  _shortValue,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: highlighted ? AppColors.ink : AppColors.muted,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Container(
                height: math.max(6, maxHeight * fraction),
                decoration: BoxDecoration(
                  color: highlighted ? AppColors.ink : AppColors.line,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  formatDayMonth(gain.day),
                  style: const TextStyle(fontSize: 10, color: AppColors.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
