import { useState } from 'react';

import { Alert } from 'react-native';

import { ManageAccountScreen } from '@portfolio/mobile-ui';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { deleteAccount } from '@/services/firebase/account';
import { signOutFromGoogle } from '@/services/firebase/auth';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { useProfileStore } from '@/store/profile';

// Thin adapter over the shared `ManageAccountScreen` (the package resolves its
// native SwiftUI `Form` twin — this screen used to hand-roll grouped rows out
// of RN views, which read as an imitation of the real control). No `privacy`
// section: this is a personal app with no social module. Only the delete
// confirmation is platform-specific — the system `Alert` rather than the
// Compose countdown dialog.

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
    <ManageAccountScreen
      colors={colors}
      info={{ title: t('settings.manageAccount.infoTitle'), rows: infoRows }}
      // Sign out lives at the bottom of the ACCOUNT screen, not in Settings:
      // this is where session and identity live now.
      signOut={{
        label: t('settings.signOut'),
        dialog: {
          title: t('settings.signOutDialog.title'),
          message: t('settings.signOutDialog.message'),
          confirm: t('settings.signOutDialog.confirm'),
          cancel: t('settings.signOutDialog.cancel'),
        },
        onSignOut: () => {
          void signOutFromGoogle().catch(() =>
            showSnackbar(t('snackbar.sign-out-failed')),
          );
        },
      }}
      danger={{
        title: t('settings.manageAccount.dangerTitle'),
        rowLabel: t('settings.manageAccount.deleteAccount'),
        icon: 'delete-forever',
        onPress: confirmDelete,
        disabled: deleting,
      }}
    />
  );
}
