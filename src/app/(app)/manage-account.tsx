import { useState } from 'react';

import {
  DestructiveConfirmDialog,
  ManageAccountScreen,
} from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useOwnProfile } from '@/hooks/useOwnProfile';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deleteAccount } from '@/services/firebase/account';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';

// Thin adapter over the shared `ManageAccountScreen`. This is a PERSONAL app —
// no social module — so it passes no `privacy` section (Topper's blocked-users
// push) and no username row; the shared screen simply omits them. Everything
// else is the same screen Topper renders.

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
  // The profile is fetched HERE rather than held live app-wide — this sheet
  // is its only reader. The store keeps it, so a second visit is instant.
  useOwnProfile();
  const profile = useProfileStore(s => s.profile);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const infoRows = [
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

  const confirmDelete = async () => {
    haptics.medium();
    setDeleting(true);

    try {
      // Stop playback first — the engine would keep streaming a deleted sound.
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
    <ManageAccountScreen
      colors={colors}
      info={{ title: t('settings.manageAccount.infoTitle'), rows: infoRows }}
      danger={{
        title: t('settings.manageAccount.dangerTitle'),
        rowLabel: t('settings.manageAccount.deleteAccount'),
        rowDescription: t('settings.manageAccount.deleteAccountHint'),
        icon: 'delete-forever',
        onPress: () => setDeleteVisible(true),
        disabled: deleting,
      }}
    >
      {/* Own Host — a dialog mounted beside the rows corrupts their clip
          shapes (same rule as SettingsScreen). */}
      {deleteVisible && (
        <ThemedHost matchContents>
          <DestructiveConfirmDialog
            dialog={{
              title: t('settings.manageAccount.deleteDialog.title'),
              message: t('settings.manageAccount.deleteDialog.message'),
              confirm: t('settings.manageAccount.deleteDialog.confirm'),
              cancel: t('settings.manageAccount.deleteDialog.cancel'),
            }}
            colors={{
              danger: colors.danger,
              primary: colors.primary,
              surfaceDialog: colors.surfaceDialog,
            }}
            busy={deleting}
            onConfirm={confirmDelete}
            onDismiss={() => {
              if (!deleting) setDeleteVisible(false);
            }}
          />
        </ThemedHost>
      )}
    </ManageAccountScreen>
  );
}
