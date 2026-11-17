import 'package:material_ui/material_ui.dart';

import '../theme/app_theme.dart';

/// To'q rangli, to'liq yumaloq asosiy tugma.
class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      width: double.infinity,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.ink,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.ink.withValues(alpha: 0.6),
          disabledForegroundColor: Colors.white,
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
                  if (icon != null) ...[
                    const SizedBox(width: 8),
                    Icon(icon, size: 20),
                  ],
                ],
              ),
      ),
    );
  }
}

/// Dumaloq ikonali tugma (oq yoki to'q).
class RoundIconButton extends StatelessWidget {
  const RoundIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    this.onPressed,
    this.dark = false,
    this.size = 48,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final bool dark;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: IconButton(
        onPressed: onPressed,
        tooltip: tooltip,
        icon: Icon(icon, size: size * 0.45),
        style: IconButton.styleFrom(
          backgroundColor: dark ? AppColors.ink : AppColors.surface,
          foregroundColor: dark ? Colors.white : AppColors.ink,
          disabledBackgroundColor: dark ? AppColors.ink : AppColors.surface,
          disabledForegroundColor: dark ? Colors.white : AppColors.ink,
          shape: const CircleBorder(),
        ),
      ),
    );
  }
}
