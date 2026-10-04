import { useState } from 'react';

import {
  DestructiveConfirmDialog,
  ManageAccountScreen,
} from '@portfolio/mobile-ui';
import { router } from 'expo-router';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { isGuardedAccountRun } from '@/dev/deleteAccountGuard';
// DEV LAB — these imports and the picker below go with `src/dev`.
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useOwnProfile } from '@/hooks/useOwnProfile';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
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
  const hasSettled = useProfileStore(s => s.hasSettled);

  const deleteAccount = useDeleteAccount();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * DEV LAB — applied to the values the route already derives, so the branch
   * that renders is the real one. The iOS twin has read this since the lab
   * landed; this side passed no `loading` at all, so Member Since printed a
   * confident em dash while the profile was still in flight, where iOS stands
   * the shared bone.
   *
   * `deleting` PINS THE DIALOG rather than a scrim, because that is where this
   * platform does its blocking: iOS's `UIAlertController` cannot go busy, so
   * the overlay lives on its screen, while Android's confirm dialog is Compose
   * and holds its own busy state (AGENTS.md — same job, each in its own
   * language).
   */
  const accountLab = useUiStateLab(state => state.account);
  const lab = UI_STATE_LAB && accountLab !== 'live';

  const loading = lab ? accountLab === 'skeleton' : !hasSettled;
  // Pinnable because it cannot be reached by hand — see `AccountState`.
  const showDeleting = lab ? accountLab === 'deleting' : deleting;

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

  /**
   * The same pipeline as the iOS twin and as Topper on both platforms:
   * `useDeleteAccount` re-authenticates with Google FIRST, so the final Auth
   * delete never meets `auth/requires-recent-login` after the data is gone.
   * This screen used to call the bare service, which skipped that step and
   * told anyone with an older session to sign out and back in by hand.
   */
  const confirmDelete = async () => {
    // DEV GUARD — see `dev/deleteAccountGuard`; closes the dialog because it
    // holds its own busy state and would otherwise strand at "Deleting…".
    if (isGuardedAccountRun()) {
      setDeleteVisible(false);
      return;
    }

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

      // A dismissed Google sheet is someone changing their mind, not a
      // failure — nothing was touched, so nothing is said.
      if ((error as { message?: string })?.message === 'reauth-cancelled')
        return;

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
      info={{
        title: t('settings.manageAccount.infoTitle'),
        rows: infoRows,
        // The row SET is passed in full while this is true, so the count and
        // every label are settled from the first frame and only the unknown
        // values stand bones. Nothing moves on hand-off.
        loading,
      }}
      // Trophies lives here on BOTH platforms now (2026-09-08): Settings'
      // account banner is the one entry, and everything account-shaped sits
      // behind it — the arrangement iOS has had since the banner landed.
      // Untitled card — the label says what it is.
      sections={[
        {
          rows: [
            {
              id: 'trophies',
              label: t('trophies.title'),
              onPress: () => router.push('/trophies'),
            },
          ],
        },
      ]}
      danger={{
        rowLabel: t('settings.manageAccount.deleteAccount'),
        rowDescription: t('settings.manageAccount.deleteAccountHint'),
        onPress: () => setDeleteVisible(true),
        disabled: showDeleting,
      }}
    >
      {/* Own Host — a dialog mounted beside the rows corrupts their clip
          shapes (same rule as SettingsScreen). */}
      {(deleteVisible || showDeleting) && (
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
            busy={showDeleting}
            onConfirm={confirmDelete}
            onDismiss={() => {
              if (!showDeleting) setDeleteVisible(false);
            }}
          />
        </ThemedHost>
      )}
      {/* DEV LAB: state picker. Delete with `src/dev`. */}
      {UI_STATE_LAB ? <UiStateLabBar screen="account" /> : null}
    </ManageAccountScreen>
  );
}
