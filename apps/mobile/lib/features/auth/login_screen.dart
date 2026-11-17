import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/router.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/pill_button.dart';
import '../contest/contest_repository.dart';
import '../contest/providers.dart';
import 'auth_page.dart';
import 'phone_format.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _controller = TextEditingController();
  String? _error;
  var _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final digits = digitsOnly(_controller.text);
    if (digits.length != phoneDigits) {
      setState(() => _error = l10n.phoneInvalid);
      return;
    }
    final phone = '$phonePrefix$digits';
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final challenge = await ref
          .read(sessionProvider.notifier)
          .requestOtp(phone);
      if (!mounted) return;
      setState(() => _loading = false);
      context.push(AppRoutes.otp, extra: challenge);
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.reason == AuthFailure.invalidPhone
            ? l10n.phoneInvalid
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AuthPage(
      title: l10n.loginTitle,
      subtitle: l10n.loginSubtitle,
      children: [
        AppTextField(
          controller: _controller,
          prefixText: '$phonePrefix ',
          hint: l10n.phoneHint,
          error: _error,
          enabled: !_loading,
          autofocus: true,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.telephoneNumberNational],
          inputFormatters: const [UzPhoneInputFormatter()],
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        PillButton(
          label: l10n.sendCode,
          icon: Icons.arrow_forward,
          loading: _loading,
          onPressed: _submit,
        ),
      ],
    );
  }
}
