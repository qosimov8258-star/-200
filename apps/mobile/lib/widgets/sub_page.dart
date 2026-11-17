import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';
import 'pill_button.dart';

/// Orqaga tugmasi va sarlavhali sahifa qobig'i (pastki menyusiz ekranlar).
class SubPage extends StatelessWidget {
  const SubPage({
    super.key,
    required this.body,
    this.title,
    this.fallbackLocation,
    this.showBack = true,
    this.bottom,
  });

  final Widget body;
  final String? title;

  /// Orqaga qaytadigan sahifa bo'lmasa (masalan, havola orqali ochilganda).
  final String? fallbackLocation;
  final bool showBack;

  /// Pastga mahkamlangan qism (tugma yoki xabar yozish maydoni).
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final canGoBack = context.canPop() || fallbackLocation != null;
    return Scaffold(
      // Bo'sh joyga bosilganda klaviatura yopiladi (raqamli klaviaturada
      // "tayyor" tugmasi yo'q).
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  12,
                  AppSpacing.page,
                  8,
                ),
                child: Row(
                  children: [
                    if (showBack && canGoBack) ...[
                      RoundIconButton(
                        icon: Icons.chevron_left,
                        tooltip: l10n.back,
                        onPressed: () => context.canPop()
                            ? context.pop()
                            : context.go(fallbackLocation!),
                      ),
                      const SizedBox(width: 14),
                    ],
                    if (title != null)
                      Expanded(
                        child: Text(
                          title!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(child: body),
              ?bottom,
            ],
          ),
        ),
      ),
    );
  }
}
