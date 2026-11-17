import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/pill_button.dart';
import '../contest/contest_repository.dart';
import '../contest/models.dart';
import '../contest/providers.dart';
import 'auth_page.dart';
import 'otp_boxes.dart';
import 'phone_format.dart';

const _codeLength = 6;
const _resendCooldown = 60;

/// Telegram ilovasining rangi (tugma ikonkasida).
const _telegramBlue = Color(0xFF2AABEE);

/// Tasdiqlash kodi ekrani. Kod SMS o'rniga Telegram bot orqali keladi:
/// foydalanuvchi botni ochadi, raqamini ulashadi va kelgan kodni shu yerga
/// kiritadi. Akkaunt ilovaning o'zida qoladi — Telegram faqat yetkazuvchi.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.challenge});

  final OtpChallenge challenge;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controller = TextEditingController();
  late OtpChallenge _challenge = widget.challenge;
  Timer? _timer;
  var _secondsLeft = _resendCooldown;
  String? _error;
  var _loading = false;

  String get _phone => _challenge.phone;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    _secondsLeft = _resendCooldown;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  Future<void> _openTelegram() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final url = _challenge.telegramUrl;
    if (url == null) {
      // Bot ulanmagan (test muhiti): kodni shu yerda ko'rsatamiz.
      final code = ref.read(contestRepositoryProvider).otpTestHint;
      if (code != null) {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.telegramNotConnected(code))),
        );
      }
      return;
    }
    try {
      final opened = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!opened) {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.telegramOpenFailed)),
        );
      }
    } on PlatformException {
      messenger.showSnackBar(SnackBar(content: Text(l10n.telegramOpenFailed)));
    }
  }

  Future<void> _verify() async {
    final l10n = AppLocalizations.of(context);
    final code = _controller.text;
    if (code.length != _codeLength || _loading) return;
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      // Muvaffaqiyatli bo'lsa, sessiya o'zgaradi va router o'zi yo'naltiradi.
      await ref.read(sessionProvider.notifier).verifyOtp(_phone, code);
    } on AuthException catch (e) {
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _loading = false;
        _error = e.reason == AuthFailure.invalidCode
            ? l10n.otpInvalid
            : l10n.genericError;
      });
    } on Exception {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = l10n.genericError;
      });
    }
  }

  Future<void> _resend() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(_startCooldown);
    try {
      // Yangi so'rov — yangi bir martalik havola.
      final challenge = await ref
          .read(sessionProvider.notifier)
          .requestOtp(_phone);
      if (!mounted) return;
      setState(() => _challenge = challenge);
    } on Exception {
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final testHint = ref.watch(contestRepositoryProvider).otpTestHint;
    return AuthPage(
      title: l10n.otpTitle,
      subtitle: l10n.otpSubtitle(formatPhone(_phone)),
      children: [
        AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Step(number: 1, text: l10n.otpStep1),
              _Step(number: 2, text: l10n.otpStep2),
              _Step(number: 3, text: l10n.otpStep3),
              const SizedBox(height: 10),
              _TelegramButton(
                label: l10n.openTelegram,
                onPressed: _loading ? null : _openTelegram,
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 8),
          child: Text(
            l10n.codeLabel,
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
        ),
        OtpBoxes(
          controller: _controller,
          length: _codeLength,
          hasError: _error != null,
          enabled: !_loading,
          onChanged: (value) {
            if (_error != null) setState(() => _error = null);
            if (value.length == _codeLength) _verify();
          },
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.negative, fontSize: 13),
            ),
          ),
        if (testHint != null) ...[
          const SizedBox(height: 10),
          Text(
            l10n.otpTestHint(testHint),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
        ],
        const SizedBox(height: 20),
        PillButton(label: l10n.confirm, loading: _loading, onPressed: _verify),
        const SizedBox(height: 4),
        TextButton(
          onPressed: _secondsLeft > 0 || _loading ? null : _resend,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.ink,
            minimumSize: const Size.fromHeight(48),
          ),
          child: Text(
            _secondsLeft > 0 ? l10n.otpResendIn(_secondsLeft) : l10n.otpResend,
          ),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.chip,
              shape: BoxShape.circle,
            ),
            child: Text(
              '$number',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                text,
                style: const TextStyle(fontSize: 14.5, height: 1.35),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TelegramButton extends StatelessWidget {
  const _TelegramButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          backgroundColor: AppColors.background,
          side: BorderSide.none,
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: const BoxDecoration(
                color: _telegramBlue,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.send_rounded,
                size: 15,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 10),
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 6),
            const Icon(
              Icons.open_in_new_rounded,
              size: 16,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}
