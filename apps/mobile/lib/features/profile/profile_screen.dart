import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/initials_avatar.dart';
import '../../widgets/login_prompt.dart';
import '../../widgets/page_header.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(sessionProvider.notifier).logout();
    } on Exception {
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    }
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(l10n.deleteConfirmTitle),
        content: Text(l10n.deleteConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.negative),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.delete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(sessionProvider.notifier).deleteAccount();
    } on Exception {
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final profile = ref.watch(profileProvider);

    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          12,
          AppSpacing.page,
          AppSpacing.navClearance,
        ),
        children: [
          PageHeader(title: l10n.profileTitle),
          const SizedBox(height: 18),
          AsyncView<Profile?>(
            value: profile,
            onRetry: () => ref.invalidate(profileProvider),
            builder: (p) {
              if (p == null) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const LoginPrompt(),
                    const SizedBox(height: 16),
                    _MenuCard(
                      items: [
                        _MenuItem(
                          icon: Icons.description_outlined,
                          label: l10n.menuRules,
                          onTap: () => context.push(AppRoutes.rules),
                        ),
                        _MenuItem(
                          icon: Icons.emoji_events_outlined,
                          label: l10n.menuWinner,
                          onTap: () => context.push(AppRoutes.winner),
                        ),
                      ],
                    ),
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppCard(
                    child: Row(
                      children: [
                        InitialsAvatar(name: p.fullName, size: 60, dark: true),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.fullName,
                                style: theme.textTheme.titleLarge,
                              ),
                              const SizedBox(height: 2),
                              Text(p.phone, style: theme.textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 6,
                    ),
                    child: Column(
                      children: [
                        _LockedField(
                          label: l10n.fieldFirstName,
                          value: p.firstName,
                        ),
                        const Divider(height: 1, color: AppColors.line),
                        _LockedField(
                          label: l10n.fieldLastName,
                          value: p.lastName,
                        ),
                        const Divider(height: 1, color: AppColors.line),
                        _LockedField(label: l10n.fieldAge, value: '${p.age}'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text(
                      l10n.profileLockedNote,
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _MenuCard(
                    items: [
                      _MenuItem(
                        icon: Icons.chat_bubble_outline,
                        label: l10n.menuSupport,
                        onTap: () => context.push(AppRoutes.support),
                      ),
                      _MenuItem(
                        icon: Icons.description_outlined,
                        label: l10n.menuRules,
                        onTap: () => context.push(AppRoutes.rules),
                      ),
                      _MenuItem(
                        icon: Icons.emoji_events_outlined,
                        label: l10n.menuWinner,
                        onTap: () => context.push(AppRoutes.winner),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _MenuCard(
                    items: [
                      _MenuItem(
                        icon: Icons.logout,
                        label: l10n.logout,
                        showChevron: false,
                        onTap: () => _logout(context, ref),
                      ),
                      _MenuItem(
                        icon: Icons.delete_outline,
                        label: l10n.deleteAccount,
                        color: AppColors.negative,
                        showChevron: false,
                        onTap: () => _deleteAccount(context, ref),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.ink,
    this.showChevron = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final bool showChevron;
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.items});

  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.card),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                indent: 18,
                endIndent: 18,
                color: AppColors.line,
              ),
            InkWell(
              onTap: items[i].onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 16,
                ),
                child: Row(
                  children: [
                    Icon(items[i].icon, size: 22, color: items[i].color),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        items[i].label,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: items[i].color,
                        ),
                      ),
                    ),
                    if (items[i].showChevron)
                      const Icon(Icons.chevron_right, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LockedField extends StatelessWidget {
  const _LockedField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.lock_outline, size: 16, color: AppColors.muted),
        ],
      ),
    );
  }
}
