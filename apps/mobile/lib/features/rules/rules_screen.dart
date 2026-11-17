import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/pill_button.dart';
import '../../widgets/sub_page.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

/// Tanlov qoidalari. [requireConsent] rejimida rozilik bermasdan davom etib
/// bo'lmaydi (ro'yxatdan o'tishdan keyingi qadam).
class RulesScreen extends ConsumerStatefulWidget {
  const RulesScreen({super.key, this.requireConsent = false});

  final bool requireConsent;

  @override
  ConsumerState<RulesScreen> createState() => _RulesScreenState();
}

class _RulesScreenState extends ConsumerState<RulesScreen> {
  var _agreed = false;
  var _loading = false;

  Future<void> _accept(int version) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _loading = true);
    try {
      await ref.read(sessionProvider.notifier).acceptRules(version);
    } on Exception {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final rules = ref.watch(rulesProvider);
    final version = rules.value?.version;

    return SubPage(
      title: l10n.rulesTitle,
      showBack: !widget.requireConsent,
      fallbackLocation: AppRoutes.rating,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          8,
          AppSpacing.page,
          24,
        ),
        children: [
          AsyncView<ContestRules>(
            value: rules,
            onRetry: () => ref.invalidate(rulesProvider),
            builder: (data) => AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < data.sections.length; i++) ...[
                    if (i > 0) const SizedBox(height: 18),
                    Text(
                      data.sections[i].title,
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      data.sections[i].body,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
      bottom: !widget.requireConsent
          ? null
          : Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                8,
                AppSpacing.page,
                12,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CheckboxListTile(
                    value: _agreed,
                    onChanged: version == null || _loading
                        ? null
                        : (v) => setState(() => _agreed = v ?? false),
                    title: Text(
                      l10n.rulesAgree,
                      style: const TextStyle(fontSize: 15),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.ink,
                  ),
                  const SizedBox(height: 4),
                  PillButton(
                    label: l10n.continueLabel,
                    icon: Icons.arrow_forward,
                    loading: _loading,
                    onPressed: _agreed && version != null
                        ? () => _accept(version)
                        : null,
                  ),
                ],
              ),
            ),
    );
  }
}
