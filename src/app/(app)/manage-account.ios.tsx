import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { GROUP_SIDE_PADDING } from '@portfolio/mobile-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deleteAccount } from '@/services/firebase/account';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';

// iOS counterpart of `manage-account`. Same content and the same deletion
// flow; the Material list groups become iOS inset-grouped sections, and the
// destructive confirm is the system `Alert` rather than the shared Compose
// dialog — see [settings-screen-platform-idioms]: the idiom wins over parity.

const GROUP_RADIUS = 12;
const PRESSED_OPACITY = 0.55;

const formatMemberSince = (millis: number | null, locale: string) =>
  millis
    ? new Date(millis).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
      })
    : '—';

export default function ManageAccount() {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const user = useAuthStore(s => s.user);
  const profile = useProfileStore(s => s.profile);

  const [deleting, setDeleting] = useState(false);

  const rows = [
    {
      label: t('settings.manageAccount.name'),
      value: user?.displayName ?? '—',
    },
    { label: t('settings.manageAccount.email'), value: user?.email ?? '—' },
    {
      label: t('settings.manageAccount.memberSince'),
      value: formatMemberSince(profile?.createdAt ?? null, locale),
    },
  ];

  const runDelete = async () => {
    haptics.medium();
    setDeleting(true);

    try {
      // Stop playback first — the engine would keep streaming a deleted song.
      usePlayerStore.getState().reset();
      await deleteAccount();
      // Auth listener notices the signed-out state and resets the app.
    } catch (error: unknown) {
      setDeleting(false);
      const code = (error as { code?: string })?.code ?? '';
      showSnackbar(
        t(
          code === 'auth/requires-recent-login'
            ? 'snackbar.delete-account-reauth'
            : 'snackbar.delete-account-failed',
        ),
      );
    }
  };

  const confirmDelete = () => {
    if (deleting) return;

    haptics.selection();
    Alert.alert(
      t('settings.manageAccount.deleteDialog.title'),
      t('settings.manageAccount.deleteDialog.message'),
      [
        {
          text: t('settings.manageAccount.deleteDialog.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.manageAccount.deleteDialog.confirm'),
          style: 'destructive',
          onPress: runDelete,
        },
      ],
    );
  };

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text
            muted
            text="settings.manageAccount.infoTitle"
            variant="labelLarge"
            style={styles.sectionTitle}
          />

          <View
            style={[styles.group, { backgroundColor: colors.surfaceContainer }]}
          >
            {rows.map((row, index) => (
              <View key={row.label}>
                {index > 0 ? (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                ) : null}
                <View style={styles.row}>
                  <Text doNotTranslate text={row.label} variant="bodyLarge" />
                  <Text
                    doNotTranslate
                    muted
                    text={row.value}
                    variant="bodyMedium"
                  />
                </View>
              </View>
            ))}
          </View>

          <Text
            muted
            text="settings.manageAccount.dangerTitle"
            variant="labelLarge"
            style={styles.sectionTitle}
          />

          <Pressable
            accessibilityRole="button"
            disabled={deleting}
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.group,
              styles.row,
              styles.dangerRow,
              {
                backgroundColor: colors.surfaceContainer,
                opacity: pressed || deleting ? PRESSED_OPACITY : 1,
              },
            ]}
          >
            <View style={styles.dangerCopy}>
              <Text
                text="settings.manageAccount.deleteAccount"
                variant="bodyLarge"
                style={{ color: colors.danger }}
              />
              <Text
                muted
                text="settings.manageAccount.deleteAccountHint"
                variant="bodyMedium"
              />
            </View>
            {deleting ? (
              <ActivityIndicator color={colors.onSurfaceMuted} />
            ) : null}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingBottom: 24,
    paddingHorizontal: GROUP_SIDE_PADDING,
    paddingTop: 12,
  },
  dangerCopy: { flex: 1, gap: 2 },
  dangerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  group: { borderRadius: GROUP_RADIUS, overflow: 'hidden' },
  row: { gap: 2, paddingHorizontal: 16, paddingVertical: 12 },
  safeArea: { flex: 1 },
  sectionTitle: { paddingHorizontal: 6, paddingTop: 10 },
});
