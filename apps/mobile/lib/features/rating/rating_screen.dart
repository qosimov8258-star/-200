import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/initials_avatar.dart';
import '../../widgets/page_header.dart';
import '../../widgets/pill_button.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

enum _RatingFilter { all, top10, nearMe }

class RatingScreen extends ConsumerStatefulWidget {
  const RatingScreen({super.key});

  @override
  ConsumerState<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends ConsumerState<RatingScreen> {
  var _filter = _RatingFilter.all;

  List<RatingEntry> _apply(List<RatingEntry> entries) {
    switch (_filter) {
      case _RatingFilter.all:
        return entries;
      case _RatingFilter.top10:
        return entries.take(10).toList();
      case _RatingFilter.nearMe:
        final me = entries.indexWhere((e) => e.isMe);
        if (me < 0) return const [];
        final start = (me - 3).clamp(0, entries.length);
        final end = (me + 4).clamp(0, entries.length);
        return entries.sublist(start, end);
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(contestInfoProvider);
    ref.invalidate(ratingProvider);
    await ref.read(ratingProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final profile = ref.watch(profileProvider).value;
    final contest = ref.watch(contestInfoProvider).value;
    final rating = ref.watch(ratingProvider);

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: AppColors.ink,
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            12,
            AppSpacing.page,
            AppSpacing.navClearance,
          ),
          children: [
            PageHeader(
              title: profile == null
                  ? l10n.appTitle
                  : l10n.greeting(profile.firstName),
              subtitle: l10n.welcome,
              trailing: profile == null
                  ? null
                  : InitialsAvatar(name: profile.fullName, dark: true),
            ),
            const SizedBox(height: 18),
            _CountdownPill(contest: contest),
            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    l10n.ratingTitle,
                    style: theme.textTheme.titleLarge,
                  ),
                ),
                if (contest != null)
                  Text(
                    l10n.participantsCount(formatCount(contest.participants)),
                    style: theme.textTheme.bodySmall,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _FilterChips(
              selected: _filter,
              onSelected: (f) => setState(() => _filter = f),
            ),
            const SizedBox(height: 16),
            AsyncView<List<RatingEntry>>(
              value: rating,
              onRetry: () => ref.invalidate(ratingProvider),
              builder: (entries) {
                if (entries.isEmpty) {
                  return _EmptyNote(text: l10n.ratingEmpty);
                }
                final me = entries.where((e) => e.isMe).firstOrNull;
                final visible = _apply(entries);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _LeaderCard(
                      leader: entries.first,
                      me: me,
                      onOpenMyReel: () => context.go(AppRoutes.myReel),
                    ),
                    const SizedBox(height: 16),
                    if (visible.isEmpty)
                      _EmptyNote(text: l10n.joinCta)
                    else
                      AppCard(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(
                          children: [
                            for (var i = 0; i < visible.length; i++) ...[
                              if (i > 0)
                                const Divider(
                                  height: 1,
                                  indent: 18,
                                  endIndent: 18,
                                  color: AppColors.line,
                                ),
                              _RatingRow(entry: visible[i]),
                            ],
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CountdownPill extends StatelessWidget {
  const _CountdownPill({required this.contest});

  final ContestInfo? contest;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final days = contest?.daysLeft(DateTime.now());
    final text = switch (days) {
      null => '…',
      0 => l10n.contestFinished,
      _ => l10n.daysLeft(days),
    };
    return Container(
      height: 60,
      padding: const EdgeInsets.only(left: 20, right: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
            ),
          ),
          RoundIconButton(
            icon: Icons.arrow_forward,
            tooltip: l10n.menuWinner,
            dark: true,
            onPressed: () => context.push(AppRoutes.winner),
          ),
        ],
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.selected, required this.onSelected});

  final _RatingFilter selected;
  final ValueChanged<_RatingFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final labels = {
      _RatingFilter.all: l10n.filterAll,
      _RatingFilter.top10: l10n.filterTop10,
      _RatingFilter.nearMe: l10n.filterNearMe,
    };
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final entry in labels.entries)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(entry.value),
                selected: entry.key == selected,
                onSelected: (_) => onSelected(entry.key),
                showCheckmark: false,
                shape: const StadiumBorder(),
                side: BorderSide.none,
                backgroundColor: AppColors.surface,
                selectedColor: AppColors.ink,
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 10,
                ),
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w500,
                  color: entry.key == selected ? Colors.white : AppColors.muted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Birinchi o'rin kartasi — dizayndagi katta rasmli karta o'rnida.
class _LeaderCard extends StatelessWidget {
  const _LeaderCard({
    required this.leader,
    required this.me,
    required this.onOpenMyReel,
  });

  final RatingEntry leader;
  final RatingEntry? me;
  final VoidCallback onOpenMyReel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      height: 300,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.topRight,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white54),
              ),
              child: const Icon(
                Icons.emoji_events_outlined,
                color: Colors.white,
                size: 22,
              ),
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.firstPlace,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  leader.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: Colors.white54),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.visibility_outlined,
                        size: 14,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        l10n.viewsCount(formatCount(leader.views)),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Material(
            color: Colors.white.withValues(alpha: 0.18),
            shape: const StadiumBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onOpenMyReel,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 5, 5, 5),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        me == null ? l10n.joinCta : l10n.myRankCta(me!.rank),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.chevron_right,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RatingRow extends StatelessWidget {
  const _RatingRow({required this.entry});

  final RatingEntry entry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 30,
            child: Text(
              '${entry.rank}',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: entry.rank <= 3 ? AppColors.ink : AppColors.muted,
              ),
            ),
          ),
          InitialsAvatar(name: entry.fullName, dark: entry.isMe),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        entry.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontSize: 15,
                        ),
                      ),
                    ),
                    if (entry.isMe) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.ink,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          l10n.you,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.viewsCount(formatCount(entry.views)),
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          RankDelta(delta: entry.deltaRank),
        ],
      ),
    );
  }
}

/// O'rin o'zgarishi: ▲ 3 / ▼ 2 / —
class RankDelta extends StatelessWidget {
  const RankDelta({super.key, required this.delta, this.fontSize = 13});

  final int delta;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    if (delta == 0) {
      return Text(
        '—',
        style: TextStyle(color: AppColors.muted, fontSize: fontSize),
      );
    }
    final up = delta > 0;
    final color = up ? AppColors.positive : AppColors.negative;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          up ? Icons.arrow_drop_up : Icons.arrow_drop_down,
          color: color,
          size: fontSize + 9,
        ),
        Text(
          '${delta.abs()}',
          style: TextStyle(
            color: color,
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _EmptyNote extends StatelessWidget {
  const _EmptyNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.muted),
      ),
    );
  }
}
