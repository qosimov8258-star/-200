import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/async_view.dart';
import '../../widgets/format.dart';
import '../../widgets/pill_button.dart';
import '../../widgets/sub_page.dart';
import '../contest/models.dart';
import '../contest/providers.dart';

const _maxAttachmentMb = 5;

/// Murojaat yozishmasi. [ticketId] null bo'lsa — yangi murojaat: birinchi
/// xabar yuborilganda yaratiladi.
class SupportChatScreen extends ConsumerStatefulWidget {
  const SupportChatScreen({super.key, this.ticketId});

  final String? ticketId;

  @override
  ConsumerState<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends ConsumerState<SupportChatScreen> {
  final _controller = TextEditingController();
  late String? _ticketId = widget.ticketId;
  String? _attachmentPath;
  var _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 80,
      );
      if (file == null || !mounted) return;
      if (await file.length() > _maxAttachmentMb * 1024 * 1024) {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.attachTooLarge(_maxAttachmentMb))),
        );
        return;
      }
      setState(() => _attachmentPath = file.path);
    } on PlatformException {
      messenger.showSnackBar(SnackBar(content: Text(l10n.attachFailed)));
    }
  }

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final text = _controller.text.trim();
    final attachment = _attachmentPath;
    if ((text.isEmpty && attachment == null) || _sending) return;

    setState(() => _sending = true);
    final repo = ref.read(contestRepositoryProvider);
    try {
      var id = _ticketId;
      if (id == null) {
        final ticket = await repo.createTicket(
          text,
          attachmentPath: attachment,
        );
        id = ticket.id;
      } else {
        await repo.sendSupportMessage(id, text, attachmentPath: attachment);
      }
      ref.invalidate(supportMessagesProvider(id));
      ref.invalidate(supportTicketsProvider);
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _ticketId = id;
        _attachmentPath = null;
        _sending = false;
      });
    } on Exception {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    } on StateError {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(SnackBar(content: Text(l10n.ticketClosedNote)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final id = _ticketId;
    final AsyncValue<List<SupportMessage>> messages = id == null
        ? const AsyncData([])
        : ref.watch(supportMessagesProvider(id));
    final ticket = ref
        .watch(supportTicketsProvider)
        .value
        ?.where((t) => t.id == id)
        .firstOrNull;
    final closed = ticket?.status == TicketStatus.closed;

    return SubPage(
      title: id == null ? l10n.supportNew : l10n.supportTitle,
      fallbackLocation: AppRoutes.support,
      body: ListView(
        reverse: true,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          8,
          AppSpacing.page,
          8,
        ),
        children: [
          AsyncView<List<SupportMessage>>(
            value: messages,
            onRetry: () {
              if (id != null) ref.invalidate(supportMessagesProvider(id));
            },
            builder: (list) {
              if (list.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Text(
                    l10n.chatEmpty,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.muted),
                  ),
                );
              }
              return Column(
                children: [for (final m in list) _Bubble(message: m)],
              );
            },
          ),
        ],
      ),
      bottom: closed
          ? Padding(
              padding: const EdgeInsets.all(AppSpacing.page),
              child: Text(
                l10n.ticketClosedNote,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted),
              ),
            )
          : _Composer(
              controller: _controller,
              attachmentPath: _attachmentPath,
              sending: _sending,
              onPick: _pickImage,
              onRemoveAttachment: () => setState(() => _attachmentPath = null),
              onSend: _send,
            ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final SupportMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final mine = !message.fromSupport;
    final attachment = message.attachmentPath;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.76,
        ),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          decoration: BoxDecoration(
            color: mine ? AppColors.ink : AppColors.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(AppRadius.tile),
              topRight: const Radius.circular(AppRadius.tile),
              bottomLeft: Radius.circular(mine ? AppRadius.tile : 6),
              bottomRight: Radius.circular(mine ? 6 : AppRadius.tile),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!mine)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    l10n.supportAgent,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              if (attachment != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(
                      File(attachment),
                      height: 160,
                      fit: BoxFit.cover,
                      semanticLabel: l10n.attachmentLabel,
                      errorBuilder: (context, error, stackTrace) => const Icon(
                        Icons.broken_image_outlined,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ),
              if (message.text.isNotEmpty)
                Text(
                  message.text,
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.35,
                    color: mine ? Colors.white : AppColors.ink,
                  ),
                ),
              const SizedBox(height: 4),
              Text(
                formatDateTime(message.createdAt),
                style: TextStyle(
                  fontSize: 11,
                  color: mine ? Colors.white60 : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.attachmentPath,
    required this.sending,
    required this.onPick,
    required this.onRemoveAttachment,
    required this.onSend,
  });

  final TextEditingController controller;
  final String? attachmentPath;
  final bool sending;
  final VoidCallback onPick;
  final VoidCallback onRemoveAttachment;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final attachment = attachmentPath;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        6,
        AppSpacing.page,
        10,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (attachment != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.file(
                      File(attachment),
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                      semanticLabel: l10n.attachmentLabel,
                    ),
                  ),
                  Positioned(
                    top: -10,
                    right: -10,
                    child: RoundIconButton(
                      icon: Icons.close,
                      tooltip: l10n.removeAttachment,
                      dark: true,
                      size: 30,
                      onPressed: onRemoveAttachment,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              RoundIconButton(
                icon: Icons.image_outlined,
                tooltip: l10n.attach,
                onPressed: sending ? null : onPick,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: controller,
                    enabled: !sending,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: 2000,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      counterText: '',
                      hintText: l10n.messageHint,
                      hintStyle: const TextStyle(color: AppColors.muted),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              RoundIconButton(
                icon: Icons.arrow_upward,
                tooltip: l10n.send,
                dark: true,
                onPressed: sending ? null : onSend,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
