import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../theme/app_theme.dart';

/// Yumaloq, fonli matn maydoni; xato matni ostida ko'rsatiladi.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    this.label,
    this.hint,
    this.error,
    this.prefixText,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
    this.autofillHints,
    this.autofocus = false,
    this.enabled = true,
    this.fill = AppColors.surface,
    this.textAlign = TextAlign.start,
    this.style,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String? label;
  final String? hint;
  final String? error;
  final String? prefixText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final bool autofocus;
  final bool enabled;
  final Color fill;
  final TextAlign textAlign;
  final TextStyle? style;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null)
          Padding(
            padding: const EdgeInsets.only(left: 6, bottom: 6),
            child: Text(
              label!,
              style: const TextStyle(fontSize: 13, color: AppColors.muted),
            ),
          ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            border: Border.all(
              color: error == null ? Colors.transparent : AppColors.negative,
            ),
          ),
          child: TextField(
            controller: controller,
            enabled: enabled,
            autofocus: autofocus,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            textCapitalization: textCapitalization,
            inputFormatters: inputFormatters,
            autofillHints: autofillHints,
            autocorrect: false,
            enableSuggestions: false,
            textAlign: textAlign,
            style: style ?? const TextStyle(fontSize: 16),
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            decoration: InputDecoration(
              border: InputBorder.none,
              hintText: hint,
              hintStyle: const TextStyle(color: AppColors.muted),
              prefixText: prefixText,
              prefixStyle: const TextStyle(
                fontSize: 16,
                color: AppColors.ink,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(left: 6, top: 6),
            child: Text(
              error!,
              style: const TextStyle(color: AppColors.negative, fontSize: 13),
            ),
          ),
      ],
    );
  }
}
