import 'dart:io' show Platform;
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Platform facts the app needs, answered so that the web build survives them.
///
/// `dart:io` compiles for the web in this SDK, but its implementations throw
/// the moment they are called: `Platform.localeName` on a browser is an
/// `UnsupportedError`, not a locale. Asking `Platform` directly is therefore
/// safe to *write* and fatal to *run*, which is the worst combination — the
/// compiler stays quiet and the app dies at startup with a blank page.
///
/// Every call site asks here instead. On Android and iOS these forward to
/// `Platform` unchanged; on the web they read the browser.
bool get isWebPlatform => kIsWeb;

bool get isAndroidPlatform => !kIsWeb && Platform.isAndroid;

bool get isIOSPlatform => !kIsWeb && Platform.isIOS;

/// True on the two platforms that have a local filesystem, a keystore, and
/// notification support. Web has none of the three.
bool get isMobilePlatform => isAndroidPlatform || isIOSPlatform;

/// The device locale in `Platform.localeName` shape — `en_GB`, `de_DE`.
///
/// Callers parse this with [SupportedLanguage.fromCode], [OffCountry.fromLocale]
/// and [LocaleUnitDefaults.fromLocale], all of which expect the underscore
/// form, so the browser's `en-GB` is converted rather than passed through.
String get platformLocaleName {
  if (!kIsWeb) return Platform.localeName;
  final locale = PlatformDispatcher.instance.locale;
  final country = locale.countryCode;
  return country == null || country.isEmpty
      ? locale.languageCode
      : '${locale.languageCode}_$country';
}
