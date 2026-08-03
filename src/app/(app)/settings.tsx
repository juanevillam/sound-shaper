import { StyleSheet, View } from 'react-native';

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

import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { type TranslationKey, useI18n } from '@/i18n';
import { SUPPORTED_LOCALES } from '@/i18n/translations';
import { signOutFromGoogle } from '@/services/firebase/auth';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { SUPPORTED_THEMES } from '@/styles/themes';

const APP_NAME = Constants.expoConfig?.name ?? '';

// In-app browser sheet (SFSafariViewController / Custom Tabs) — reading a policy
// shouldn't leave the app. utm_medium=settings splits this entry point from the
// welcome disclaimer in site analytics.
const openLegalPage = (page: LegalPage) =>
  WebBrowser.openBrowserAsync(legalUrl(APP_NAME, page, 'settings'));

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
    <View style={styles.root}>
      <SettingsScreen
        account={{
          title: t('settings.account.title'),
          profile,
          // Deletion lives behind manage-account (the WhatsApp/Google idiom).
          navRows: [
            {
              id: 'trophies',
              label: t('settings.trophies'),
              icon: 'trophy',
              onPress: () => router.push('/trophies'),
            },
            {
              id: 'manage-account',
              label: t('settings.manageAccount.title'),
              icon: 'manage-accounts',
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
        }}
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
          rows: [
            {
              label: t('welcome.legal.privacy'),
              onPress: () => openLegalPage('privacy-policy'),
            },
            {
              label: t('welcome.legal.terms'),
              onPress: () => openLegalPage('terms-and-conditions'),
            },
          ],
        }}
        colorScheme={scheme}
        seedColor={seedColor}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
