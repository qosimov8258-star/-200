import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/sub_page.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

class WinnerScreen extends ConsumerWidget {
  const WinnerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final winner = ref.watch(winnerProvider);
    final contest = ref.watch(contestInfoProvider).value;

    return SubPage(
      title: l10n.winnerTitle,
      fallbackLocation: AppRoutes.rating,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          8,
          AppSpacing.page,
          24,
        ),
        children: [
          AsyncView<Winner?>(
            value: winner,
            onRetry: () => ref.invalidate(winnerProvider),
            builder: (data) => data == null
                ? _Pending(daysLeft: contest?.daysLeft(DateTime.now()))
                : _Announced(winner: data),
          ),
        ],
      ),
    );
  }
}

class _Pending extends StatelessWidget {
  const _Pending({required this.daysLeft});

  final int? daysLeft;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final days = daysLeft;
    return AppCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              color: AppColors.chip,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.hourglass_empty, color: AppColors.ink),
          ),
          const SizedBox(height: 18),
          Text(l10n.winnerPendingTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            l10n.winnerPendingBody,
            style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
          ),
          if (days != null && days > 0) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.ink,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                l10n.daysLeft(days),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Announced extends StatelessWidget {
  const _Announced({required this.winner});

  final Winner winner;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 360,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: AppColors.heroGradient,
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: AppColors.gold,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.emoji_events,
                  color: AppColors.ink,
                  size: 28,
                ),
              ),
              const Spacer(),
              Text(
                l10n.winnerCongrats,
                style: const TextStyle(color: Colors.white70, fontSize: 15),
              ),
              const SizedBox(height: 4),
              Text(
                winner.fullName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  height: 1.1,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  border: Border.all(color: Colors.white54),
                ),
                child: Text(
                  l10n.winnerPrize,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Row(
            children: [
              const Icon(Icons.visibility_outlined, color: AppColors.muted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.viewsCount(formatCount(winner.finalViews)),
                  style: theme.textTheme.titleLarge,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          l10n.winnerAnnouncedAt(formatDateTime(winner.announcedAt)),
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
