import { StyleSheet } from 'react-native';

import { Column, ListItem, Text } from '@expo/ui/jetpack-compose';
import {
  clip,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from '@portfolio/mobile-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

/**
 * Account management, pushed from Settings: the read-only facts of the
 * account (identity, email, member-since). The Delete-account flow (danger
 * zone) lands here in a later phase — this screen exists now so the account
 * surface matches the portfolio idiom (irreversible actions live one level
 * below Settings, never beside everyday rows).
 */
export default function ManageAccount() {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const user = useAuthStore(s => s.user);
  const profile = useProfileStore(s => s.profile);

  const infoColors = {
    containerColor: colors.surfaceContainer,
    contentColor: colors.onSurface,
    supportingContentColor: colors.onSurfaceMuted,
  };

  // Same label-over-value idiom as the About rows on the settings screen.
  const infoRows = [
    {
      label: t('settings.manageAccount.name'),
      value: user?.displayName ?? t('settings.account.noName'),
    },
    {
      label: t('settings.manageAccount.email'),
      value: user?.email ?? '—',
    },
    {
      label: t('settings.manageAccount.username'),
      value: profile?.username
        ? `@${profile.username}`
        : t('settings.manageAccount.usernameUnset'),
    },
    ...(profile?.createdAt
      ? [
          {
            label: t('settings.manageAccount.memberSince'),
            value: new Date(profile.createdAt).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
          <Column
            modifiers={[fillMaxWidth(), padding(0, 16, 0, 0)]}
            verticalArrangement={{ spacedBy: 8 }}
          >
            <Text
              color={colors.primary}
              style={{ typography: 'labelLarge' }}
              modifiers={[padding(16, 0, 16, 8)]}
            >
              {t('settings.manageAccount.infoTitle')}
            </Text>
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
              ]}
              verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
            >
              {infoRows.map((row, index) => (
                <ListItem
                  key={row.label}
                  colors={infoColors}
                  modifiers={[
                    fillMaxWidth(),
                    clip(groupRowShape(index, infoRows.length)),
                  ]}
                >
                  <ListItem.HeadlineContent>
                    <Text color={colors.onSurface}>{row.label}</Text>
                  </ListItem.HeadlineContent>
                  <ListItem.SupportingContent>
                    <Text color={colors.onSurfaceMuted}>{row.value}</Text>
                  </ListItem.SupportingContent>
                </ListItem>
              ))}
            </Column>
          </Column>
        </ThemedHost>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  host: { width: '100%' },
});
