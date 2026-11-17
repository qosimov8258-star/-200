import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/login_prompt.dart';
import '../../widgets/page_header.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final items = ref.watch(notificationsProvider);
    final guest = ref.watch(sessionProvider) != SessionStage.active;
    final hasUnread = items.value?.any((n) => !n.read) ?? false;

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
          PageHeader(
            title: l10n.notificationsTitle,
            trailing: guest
                ? null
                : AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: hasUnread ? 1 : 0.4,
                    child: TextButton(
                      onPressed: hasUnread
                          ? () => ref
                                .read(notificationsProvider.notifier)
                                .markAllRead()
                          : null,
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.ink,
                        disabledForegroundColor: AppColors.ink,
                        backgroundColor: AppColors.surface,
                        disabledBackgroundColor: AppColors.surface,
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: Text(l10n.markAllRead),
                    ),
                  ),
          ),
          const SizedBox(height: 18),
          if (guest)
            const LoginPrompt()
          else
            AsyncView<List<AppNotification>>(
              value: items,
              onRetry: () => ref.invalidate(notificationsProvider),
              builder: (list) {
                if (list.isEmpty) {
                  return AppCard(
                    padding: const EdgeInsets.all(28),
                    child: Text(
                      l10n.notificationsEmpty,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  );
                }
                return Column(
                  children: [
                    for (final n in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _NotificationCard(
                          key: ValueKey('notification-${n.id}'),
                          notification: n,
                          onTap: () => ref
                              .read(notificationsProvider.notifier)
                              .markRead(n.id),
                        ),
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

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    super.key,
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final n = notification;
    final unread = !n.read;

    return Semantics(
      button: unread,
      label: unread ? l10n.unreadLabel : null,
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: unread ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: unread ? AppColors.negative : AppColors.line,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 250),
                        style: theme.textTheme.titleMedium!.copyWith(
                          fontWeight: unread
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: unread ? AppColors.ink : AppColors.muted,
                        ),
                        child: Text(n.title),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        n.body,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: unread ? AppColors.ink : AppColors.muted,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        formatDateTime(n.createdAt),
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
