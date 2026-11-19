import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/login_prompt.dart';
import '../../widgets/page_header.dart';
import '../../widgets/pill_button.dart';
import '../contest/contest_repository.dart';
import '../contest/models.dart';
import '../contest/providers.dart';
import '../rating/rating_screen.dart' show RankDelta;
import 'reel_url.dart';
import 'views_chart.dart';

class MyReelScreen extends ConsumerWidget {
  const MyReelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final reel = ref.watch(myReelProvider);
    final guest = ref.watch(sessionProvider) != SessionStage.active;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: AppColors.ink,
        onRefresh: () async {
          ref.invalidate(myReelProvider);
          await ref.read(myReelProvider.future);
        },
        child: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            12,
            AppSpacing.page,
            AppSpacing.navClearance,
          ),
          children: [
            PageHeader(title: l10n.myReelTitle, subtitle: l10n.myReelSubtitle),
            const SizedBox(height: 18),
            if (guest)
              const LoginPrompt()
            else
              AsyncView<MyReel?>(
                value: reel,
                onRetry: () => ref.invalidate(myReelProvider),
                builder: (data) =>
                    data == null ? const _SubmitForm() : _ReelStats(reel: data),
              ),
          ],
        ),
      ),
    );
  }
}

class _SubmitForm extends ConsumerStatefulWidget {
  const _SubmitForm();

  @override
  ConsumerState<_SubmitForm> createState() => _SubmitFormState();
}

class _SubmitFormState extends ConsumerState<_SubmitForm> {
  final _controller = TextEditingController();
  String? _error;
  var _submitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text == null || text.isEmpty || !mounted) return;
    setState(() {
      _controller.text = text;
      _error = null;
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final url = _controller.text.trim();

    if (url.isEmpty) {
      setState(() => _error = l10n.linkEmpty);
      return;
    }
    if (parseReelShortcode(url) == null) {
      setState(() => _error = l10n.linkInvalid);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await ref.read(myReelProvider.notifier).submit(url);
      messenger.showSnackBar(SnackBar(content: Text(l10n.submitted)));
    } on ReelSubmitException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.reason == ReelSubmitFailure.invalidLink
            ? l10n.linkInvalid
            : l10n.submitFailed;
      });
    } on Exception {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = l10n.submitFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.submitHeading, style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                l10n.submitBody,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.muted,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.only(left: 18, right: 6),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  border: Border.all(
                    color: _error == null
                        ? Colors.transparent
                        : AppColors.negative,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        enabled: !_submitting,
                        keyboardType: TextInputType.url,
                        textInputAction: TextInputAction.send,
                        autocorrect: false,
                        enableSuggestions: false,
                        onSubmitted: (_) => _submit(),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                        decoration: InputDecoration(
                          border: InputBorder.none,
                          hintText: l10n.linkHint,
                          hintStyle: const TextStyle(color: AppColors.muted),
                        ),
                      ),
                    ),
                    RoundIconButton(
                      icon: Icons.content_paste,
                      tooltip: l10n.paste,
                      dark: true,
                      size: 44,
                      onPressed: _submitting ? null : _paste,
                    ),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.negative,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              PillButton(
                label: l10n.submit,
                icon: Icons.arrow_forward,
                loading: _submitting,
                onPressed: _submit,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.rulesHeading, style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
              for (final rule in [
                l10n.ruleBusiness,
                l10n.ruleTag,
                l10n.ruleOwn,
                l10n.ruleNoTarget,
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Icon(
                          Icons.check_circle_outline,
                          size: 18,
                          color: AppColors.ink,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(rule, style: theme.textTheme.bodyMedium),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReelStats extends StatelessWidget {
  const _ReelStats({required this.reel});

  final MyReel reel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final accepted = reel.status == ReelStatus.accepted;
    final gains = reel.dailyGains;
    final lastGains = gains.length > 7
        ? gains.sublist(gains.length - 7)
        : gains;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _LinkCard(reel: reel),
        const SizedBox(height: 16),
        if (!accepted)
          AppCard(
            child: Text(
              reel.status == ReelStatus.pending
                  ? l10n.pendingNote
                  : l10n.rejectedNote,
              style: theme.textTheme.bodyMedium,
            ),
          )
        else ...[
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  label: l10n.statTotalViews,
                  icon: Icons.visibility_outlined,
                  dark: true,
                  child: _StatValue(formatCount(reel.totalViews), dark: true),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  label: l10n.statToday,
                  icon: Icons.trending_up,
                  child: _StatValue(
                    formatSigned(reel.todayGain),
                    color: reel.todayGain > 0 ? AppColors.positive : null,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatTile(
                  label: l10n.statRank,
                  icon: Icons.emoji_events_outlined,
                  child: _StatValue(reel.rank == null ? '—' : '${reel.rank}'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatTile(
                  label: l10n.statRankChange,
                  icon: Icons.swap_vert,
                  child: reel.deltaRank == 0
                      ? Text(
                          l10n.noChange,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: AppColors.muted,
                          ),
                        )
                      : RankDelta(delta: reel.deltaRank, fontSize: 24),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (lastGains.isNotEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.chartTitle, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(l10n.chartSubtitle, style: theme.textTheme.bodySmall),
                  const SizedBox(height: 18),
                  ViewsChart(gains: lastGains),
                ],
              ),
            ),
          if (reel.lastSyncedAt != null) ...[
            const SizedBox(height: 12),
            Text(
              l10n.lastSynced(formatDateTime(reel.lastSyncedAt!)),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ],
    );
  }
}

class _LinkCard extends StatelessWidget {
  const _LinkCard({required this.reel});

  final MyReel reel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final (statusText, statusColor) = switch (reel.status) {
      ReelStatus.pending => (l10n.statusPending, AppColors.muted),
      ReelStatus.accepted => (l10n.statusAccepted, AppColors.positive),
      ReelStatus.rejected => (l10n.statusRejected, AppColors.negative),
    };

    return AppCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: AppColors.heroGradient,
              borderRadius: BorderRadius.circular(AppRadius.tile),
            ),
            child: const Icon(Icons.play_arrow_rounded, color: Colors.white),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(l10n.reelLinkLabel, style: theme.textTheme.bodySmall),
                    const SizedBox(width: 8),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        statusText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  reel.url.replaceFirst('https://www.', ''),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: l10n.copy,
            icon: const Icon(Icons.copy_rounded, size: 20),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              await Clipboard.setData(ClipboardData(text: reel.url));
              messenger.showSnackBar(SnackBar(content: Text(l10n.copied)));
            },
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.icon,
    required this.child,
    this.dark = false,
  });

  final String label;
  final IconData icon;
  final Widget child;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: dark ? AppColors.ink : AppColors.surface,
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        height: 92,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              size: 20,
              color: dark ? Colors.white70 : AppColors.muted,
            ),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: child,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: dark ? Colors.white70 : AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatValue extends StatelessWidget {
  const _StatValue(this.text, {this.dark = false, this.color});

  final String text;
  final bool dark;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
        color: color ?? (dark ? Colors.white : AppColors.ink),
      ),
    );
  }
}
