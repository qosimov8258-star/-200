import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/pill_button.dart';
import '../../widgets/sub_page.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

class SupportListScreen extends ConsumerWidget {
  const SupportListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final tickets = ref.watch(supportTicketsProvider);

    return SubPage(
      title: l10n.supportTitle,
      fallbackLocation: AppRoutes.profile,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          8,
          AppSpacing.page,
          16,
        ),
        children: [
          AsyncView<List<SupportTicket>>(
            value: tickets,
            onRetry: () => ref.invalidate(supportTicketsProvider),
            builder: (list) {
              if (list.isEmpty) {
                return AppCard(
                  padding: const EdgeInsets.all(28),
                  child: Text(
                    l10n.supportEmpty,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                );
              }
              return Column(
                children: [
                  for (final ticket in list)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _TicketCard(ticket: ticket),
                    ),
                ],
              );
            },
          ),
        ],
      ),
      bottom: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          8,
          AppSpacing.page,
          12,
        ),
        child: PillButton(
          label: l10n.supportNew,
          icon: Icons.add,
          onPressed: () => context.push(AppRoutes.supportNew),
        ),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.card),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(AppRoutes.supportTicket(ticket.id)),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TicketStatusChip(status: ticket.status),
                    const SizedBox(height: 8),
                    Text(
                      ticket.lastMessage,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatDateTime(ticket.updatedAt),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class TicketStatusChip extends StatelessWidget {
  const TicketStatusChip({super.key, required this.status});

  final TicketStatus status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (text, color) = switch (status) {
      TicketStatus.open => (l10n.ticketOpen, AppColors.ink),
      TicketStatus.inProgress => (l10n.ticketInProgress, AppColors.positive),
      TicketStatus.closed => (l10n.ticketClosed, AppColors.muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.chip,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
