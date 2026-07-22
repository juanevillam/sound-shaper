import { useState } from 'react';

import { StyleSheet } from 'react-native';

import { Column, ListItem, Text } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import {
  DestructiveConfirmDialog,
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from '@portfolio/mobile-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deleteAccount } from '@/services/firebase/account';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';

// Account info + the deletion flow (the WhatsApp/Google idiom: deletion lives
// behind manage-account, never as a red CTA on the settings root).

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

  const [deleteVisible, setDeleteVisible] = useState(false);
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

  const listItemColors = {
    containerColor: colors.surfaceContainer,
    headlineColor: colors.onSurface,
    supportingContentColor: colors.onSurfaceMuted,
  };

  const confirmDelete = async () => {
    haptics.medium();
    setDeleting(true);

    try {
      // Stop playback first — the engine would keep streaming a deleted song.
      usePlayerStore.getState().reset();
      await deleteAccount();
      // Auth listener notices the signed-out state and resets the app.
    } catch (error: unknown) {
      setDeleting(false);
      setDeleteVisible(false);
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

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ThemedHost matchContents={{ vertical: true }} style={styles.host}>
          <Column
            verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
            modifiers={[
              fillMaxWidth(),
              padding(GROUP_SIDE_PADDING, 12, GROUP_SIDE_PADDING, 24),
            ]}
          >
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'labelLarge' }}
              modifiers={[padding(4, 0, 0, 6)]}
            >
              {t('settings.manageAccount.infoTitle')}
            </Text>

            {rows.map((row, index) => (
              <ListItem
                key={row.label}
                colors={listItemColors}
                modifiers={[
                  fillMaxWidth(),
                  clip(groupRowShape(index, rows.length)),
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

            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'labelLarge' }}
              modifiers={[padding(4, 18, 0, 6)]}
            >
              {t('settings.manageAccount.dangerTitle')}
            </Text>

            <ListItem
              colors={listItemColors}
              modifiers={[
                fillMaxWidth(),
                clip(groupRowShape(0, 1)),
                // The row itself opens the confirm.
                clickable(() => {
                  haptics.selection();
                  setDeleteVisible(true);
                }),
              ]}
            >
              <ListItem.HeadlineContent>
                <Text color={colors.danger}>
                  {t('settings.manageAccount.deleteAccount')}
                </Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text color={colors.onSurfaceMuted}>
                  {t('settings.manageAccount.deleteAccountHint')}
                </Text>
              </ListItem.SupportingContent>
            </ListItem>
          </Column>
        </ThemedHost>

        {deleteVisible && (
          <ThemedHost matchContents>
            <DestructiveConfirmDialog
              dialog={{
                title: t('settings.manageAccount.deleteDialog.title'),
                message: t('settings.manageAccount.deleteDialog.message'),
                confirm: t('settings.manageAccount.deleteDialog.confirm'),
                cancel: t('settings.manageAccount.deleteDialog.cancel'),
              }}
              colors={{ danger: colors.danger }}
              busy={deleting}
              onConfirm={confirmDelete}
              onDismiss={() => {
                if (!deleting) setDeleteVisible(false);
              }}
            />
          </ThemedHost>
        )}
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  host: { width: '100%' },
});
