import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/pill_button.dart';
import '../contest/contest_repository.dart';
import '../contest/providers.dart';
import 'auth_page.dart';

final _namePattern = RegExp(r"^[\p{L}'ʻʼ‘’\- ]{2,40}$", unicode: true);
const _maxAge = 100;

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _age = TextEditingController();
  String? _firstNameError;
  String? _lastNameError;
  String? _ageError;
  var _loading = false;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _age.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final minAge = ref.read(contestInfoProvider).value?.minAge;
    final firstName = _firstName.text.trim();
    final lastName = _lastName.text.trim();
    final age = int.tryParse(_age.text);

    setState(() {
      _firstNameError = _namePattern.hasMatch(firstName)
          ? null
          : l10n.nameInvalid;
      _lastNameError = _namePattern.hasMatch(lastName)
          ? null
          : l10n.nameInvalid;
      _ageError = switch (age) {
        null => l10n.ageInvalid,
        > _maxAge || < 1 => l10n.ageInvalid,
        _ when minAge != null && age < minAge => l10n.ageTooYoung(minAge),
        _ => null,
      };
    });
    if (_firstNameError != null ||
        _lastNameError != null ||
        _ageError != null ||
        age == null) {
      return;
    }

    FocusScope.of(context).unfocus();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) =>
          _ConfirmDialog(firstName: firstName, lastName: lastName, age: age),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      // Muvaffaqiyatli bo'lsa, router qoidalar ekraniga o'tkazadi.
      await ref
          .read(sessionProvider.notifier)
          .register(firstName: firstName, lastName: lastName, age: age);
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (e.reason == AuthFailure.underAge) _ageError = l10n.ageRejected;
      });
      if (e.reason != AuthFailure.underAge) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
      }
    } on Exception {
      if (!mounted) return;
      setState(() => _loading = false);
      messenger.showSnackBar(SnackBar(content: Text(l10n.genericError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // Minimal yoshni oldindan yuklab qo'yamiz.
    ref.watch(contestInfoProvider);

    return AuthPage(
      title: l10n.registerTitle,
      subtitle: l10n.registerSubtitle,
      showBack: false,
      children: [
        AppCard(
          color: AppColors.ink,
          radius: AppRadius.tile,
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lock_outline, color: Colors.white, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.registerWarning,
                  style: const TextStyle(color: Colors.white, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        AppTextField(
          controller: _firstName,
          label: l10n.fieldFirstName,
          error: _firstNameError,
          enabled: !_loading,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.givenName],
        ),
        const SizedBox(height: 14),
        AppTextField(
          controller: _lastName,
          label: l10n.fieldLastName,
          error: _lastNameError,
          enabled: !_loading,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.familyName],
        ),
        const SizedBox(height: 14),
        AppTextField(
          controller: _age,
          label: l10n.fieldAge,
          error: _ageError,
          enabled: !_loading,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(3),
          ],
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 24),
        PillButton(
          label: l10n.continueLabel,
          icon: Icons.arrow_forward,
          loading: _loading,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _ConfirmDialog extends StatelessWidget {
  const _ConfirmDialog({
    required this.firstName,
    required this.lastName,
    required this.age,
  });

  final String firstName;
  final String lastName;
  final int age;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      backgroundColor: AppColors.surface,
      title: Text(l10n.registerConfirmTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${l10n.fieldFirstName}: $firstName'),
          Text('${l10n.fieldLastName}: $lastName'),
          Text('${l10n.fieldAge}: $age'),
          const SizedBox(height: 12),
          Text(
            l10n.registerConfirmBody,
            style: const TextStyle(color: AppColors.muted),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.edit),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l10n.confirm),
        ),
      ],
    );
  }
}
