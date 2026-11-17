import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme.dart';

/// Bir martalik kod uchun alohida katakchalar. Ichida bitta ko'rinmas matn
/// maydoni bor — SMS dan avtomatik to'ldirish va qo'yish (paste) ishlaydi.
class OtpBoxes extends StatefulWidget {
  const OtpBoxes({
    super.key,
    required this.controller,
    required this.length,
    required this.onChanged,
    this.hasError = false,
    this.enabled = true,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final int length;
  final ValueChanged<String> onChanged;
  final bool hasError;
  final bool enabled;
  final bool autofocus;

  @override
  State<OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<OtpBoxes> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
    _focusNode.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(OtpBoxes oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_rebuild);
      widget.controller.addListener(_rebuild);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    _focusNode.dispose();
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.controller.text;
    final activeIndex = code.length.clamp(0, widget.length - 1);

    return SizedBox(
      height: 64,
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: _Box(
                    char: i < code.length ? code[i] : null,
                    active: _focusNode.hasFocus && i == activeIndex,
                    hasError: widget.hasError,
                  ),
                ),
              ],
            ],
          ),
          // Ko'rinmas, lekin bosiladigan va klaviatura ochadigan maydon.
          Positioned.fill(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              enabled: widget.enabled,
              autofocus: widget.autofocus,
              showCursor: false,
              enableInteractiveSelection: false,
              keyboardType: TextInputType.number,
              autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(widget.length),
              ],
              style: const TextStyle(color: Colors.transparent, fontSize: 1),
              decoration: const InputDecoration(
                border: InputBorder.none,
                counterText: '',
              ),
              onChanged: widget.onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({
    required this.char,
    required this.active,
    required this.hasError,
  });

  final String? char;
  final bool active;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    final borderColor = hasError
        ? AppColors.negative
        : active
        ? AppColors.ink
        : Colors.transparent;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.tile),
        border: Border.all(color: borderColor, width: 1.5),
      ),
      child: ExcludeSemantics(
        child: Text(
          char ?? '',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
