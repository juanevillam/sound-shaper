import { type ReactNode } from 'react';

import { Platform, StyleSheet, View } from 'react-native';

import { version as expoUiVersion } from '@expo/ui/package.json';
import {
  buildAboutSettingsSection,
  buildGeneralSettingsSections,
  legalUrl,
  SettingsScreen,
  type LegalPage,
  type SettingsAccountProfile,
} from '@portfolio/mobile-ui';
import { nativeApplicationVersion } from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { type TranslationKey, useI18n } from '@/i18n';
import { SUPPORTED_LOCALES } from '@/i18n/translations';
import { signOutFromGoogle } from '@/services/firebase/auth';
import { useAuthStore } from '@/store/auth';
import { useDevSettingsStore } from '@/store/devSettings';
import { useThemeStore } from '@/store/theme';
import { SUPPORTED_THEMES } from '@/styles/themes';

const APP_NAME = Constants.expoConfig?.name ?? '';

// In-app browser sheet (SFSafariViewController / Custom Tabs) — reading a policy
// shouldn't leave the app. utm_medium=settings splits this entry point from the
// welcome disclaimer in site analytics.
const openLegalPage = (page: LegalPage) =>
  WebBrowser.openBrowserAsync(legalUrl(APP_NAME, page, 'settings'));

/**
 * SETTINGS IS THE ONE SCREEN IN THE SHEET FAMILY THAT ANDROID ALSO RENDERS, so
 * its root is chosen per platform rather than being `SheetScreen` outright.
 *
 * On iOS this route presents as a full-height form sheet (see
 * `IOS_SHEET_SCREENS`), and a sheet is presented ABOVE the RN root — so the
 * app's toast, which lives at that root, draws BEHIND it. This screen fires
 * one (a failed sign-out), and it had never been seen. `SheetScreen` mounts
 * the `SnackbarOutlet` that moves the toast into this tree; every other sheet
 * in the app already had it and this was the one that was missed.
 *
 * On Android Settings is an ordinary pushed screen whose root toast works
 * fine, and mounting an outlet there would claim the toast into this screen
 * and hand it the SHEET's clearance instead of the app's. Android is frozen;
 * it keeps the plain View.
 */
function SettingsRoot({ children }: { children: ReactNode }) {
  return Platform.OS === 'ios' ? (
    <SheetScreen>{children}</SheetScreen>
  ) : (
    <View style={styles.root}>{children}</View>
  );
}

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  // mobile-ui's section builders declare `(key: string) => string` (they can't
  // know each app's key union); this adapter re-widens the typed translator for
  // them — the builders only ever ask for keys the tree really has.
  const translate = (key: string) => t(key as TranslationKey);
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const user = useAuthStore(s => s.user);
  const { colors, scheme, seedColor } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const devStateLabBar = useDevSettingsStore(s => s.stateLabBar);
  const setDevStateLabBar = useDevSettingsStore(s => s.setStateLabBar);

  // Identity display only — personal app, so no username line or editor.
  const profile: SettingsAccountProfile | undefined = user
    ? {
        displayName: user.displayName ?? t('settings.account.noName'),
        photoUrl: user.photoUrl,
      }
    : undefined;

  const signOut = async () => {
    try {
      await signOutFromGoogle();
    } catch {
      showSnackbar(t('snackbar.sign-out-failed'));
    }
  };

  return (
    <SettingsRoot>
      <SettingsScreen
        // Sign Out is the ONE session action every app has, so it lives here
        // rather than in the Account screen — that is what keeps this screen
        // identical across the portfolio: General, About, Legal, Sign Out.
        // Everything else account-shaped sits behind the Account entry.
        //
        // Only the sign-out fields on iOS: with no `profile` and no `navRows`,
        // the account SECTION renders nothing and only its trailing sign-out
        // card appears.
        {...(Platform.OS === 'ios'
          ? {
              account: {
                title: t('settings.account.title'),
                signOutLabel: t('settings.signOut'),
                signOutDialog: {
                  title: t('settings.signOutDialog.title'),
                  message: t('settings.signOutDialog.message'),
                  confirm: t('settings.signOutDialog.confirm'),
                  cancel: t('settings.signOutDialog.cancel'),
                },
                onSignOut: signOut,
              },
              /**
               * DEV-ONLY — gated on `__DEV__` itself, not just hidden: a
               * release build passes no prop and the section cannot exist.
               * Plain-English labels on purpose; dev chrome is exempt from the
               * translation pipeline (the same exemption the state lab's own
               * copy takes). The switch lives in `store/devSettings`, seeded
               * from `dev/flags.ts`. Matches Topper's Dev section.
               */
              ...(__DEV__
                ? {
                    devToggles: {
                      title: 'Dev',
                      rows: [
                        {
                          label: 'State Lab',
                          value: devStateLabBar,
                          onValueChange: setDevStateLabBar,
                        },
                      ],
                    },
                  }
                : {}),
            }
          : {
              account: {
                title: t('settings.account.title'),
                profile,
                // Deletion lives behind manage-account (the WhatsApp/Google
                // idiom).
                navRows: [
                  {
                    id: 'trophies',
                    label: t('settings.trophies'),
                    icon: 'trophy' as const,
                    onPress: () => router.push('/trophies'),
                  },
                  {
                    id: 'manage-account',
                    label: t('settings.manageAccount.title'),
                    icon: 'manage-accounts' as const,
                    onPress: () => router.push('/manage-account'),
                  },
                ],
                signOutLabel: t('settings.signOut'),
                signOutDialog: {
                  title: t('settings.signOutDialog.title'),
                  message: t('settings.signOutDialog.message'),
                  confirm: t('settings.signOutDialog.confirm'),
                  cancel: t('settings.signOutDialog.cancel'),
                },
                onSignOut: signOut,
              },
            })}
        sections={buildGeneralSettingsSections(translate, {
          locale,
          setLocale,
          supportedLocales: SUPPORTED_LOCALES,
          theme,
          setTheme,
          supportedThemes: SUPPORTED_THEMES,
        })}
        sectionsTitle={t('settings.general.title')}
        cancelLabel={t('settings.cancel')}
        about={buildAboutSettingsSection(
          translate,
          // The versionName of the installed binary — the ground truth for
          // "which build is on this device" (falls back for web/tests).
          nativeApplicationVersion ?? '0.0.0',
          expoUiVersion,
        )}
        // Stores require the privacy policy reachable INSIDE the app
        // (Apple 5.1.1(i) / Play User Data policy), not just pre-login.
        // Own card on iOS (Apple's grouping), still appended to About on
        // Android, which is frozen — see `SettingsLegalConfig`.
        legal={{
          title: t('settings.legal.title'),
          // Terms first, then Privacy — the App Store's Apple Account sheet's
          // order, matched across all three apps.
          rows: [
            {
              label: t('welcome.legal.terms'),
              onPress: () => openLegalPage('terms-and-conditions'),
            },
            {
              label: t('welcome.legal.privacy'),
              onPress: () => openLegalPage('privacy-policy'),
            },
          ],
        }}
        colorScheme={scheme}
        seedColor={seedColor}
        colors={colors}
      />
    </SettingsRoot>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
