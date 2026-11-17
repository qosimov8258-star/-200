import 'package:material_ui/material_ui.dart';

/// Dizayn tokenlari. Yangi yil mavzusi (Faza 4) faqat shu faylni almashtiradi.
abstract final class AppColors {
  static const background = Color(0xFFF1F2F4);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1E1F22);
  static const muted = Color(0xFF8A8D93);
  static const line = Color(0xFFE6E7EA);
  static const chip = Color(0xFFF6F7F8);
  static const positive = Color(0xFF1C9A5B);
  static const negative = Color(0xFFD14343);
  static const gold = Color(0xFFE8B84A);

  static const heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF5B8FA8), Color(0xFFB8674A), Color(0xFF2A2320)],
    stops: [0, 0.6, 1],
  );
}

abstract final class AppRadius {
  static const card = 28.0;
  static const tile = 20.0;
  static const pill = 999.0;
}

abstract final class AppSpacing {
  static const page = 20.0;

  /// Suzuvchi pastki menyu ostida kontent yopilib qolmasligi uchun.
  static const navClearance = 120.0;
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.ink,
      brightness: Brightness.light,
      primary: AppColors.ink,
      onPrimary: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      error: AppColors.negative,
    ),
  );

  final text = base.textTheme.apply(
    bodyColor: AppColors.ink,
    displayColor: AppColors.ink,
  );

  return base.copyWith(
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
      titleLarge: text.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      bodyMedium: text.bodyMedium?.copyWith(height: 1.4),
      bodySmall: text.bodySmall?.copyWith(color: AppColors.muted),
      labelSmall: text.labelSmall?.copyWith(color: AppColors.muted),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
    ),
  );
}
