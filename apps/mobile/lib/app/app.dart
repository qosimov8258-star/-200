import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/contest/models.dart';
import '../features/contest/providers.dart';
import '../l10n/app_localizations.dart';
import '../theme/app_theme.dart';
import 'router.dart';

class ReelsContestApp extends ConsumerStatefulWidget {
  const ReelsContestApp({super.key});

  @override
  ConsumerState<ReelsContestApp> createState() => _ReelsContestAppState();
}

class _ReelsContestAppState extends ConsumerState<ReelsContestApp> {
  late final ValueNotifier<SessionStage> _session;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _session = ValueNotifier(ref.read(sessionProvider));
    ref.listenManual(sessionProvider, (_, next) => _session.value = next);
    _router = buildRouter(_session);
  }

  @override
  void dispose() {
    _router.dispose();
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      theme: buildAppTheme(),
      routerConfig: _router,
      locale: const Locale('uz'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        ...GlobalMaterialLocalizations.delegates,
      ],
    );
  }
}
