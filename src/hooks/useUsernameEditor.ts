import { type SettingsUsernameEditor } from '@portfolio/mobile-ui';

import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { claimUsername } from '@/services/firebase/users';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/i;

/**
 * The username editor config shared by the settings row and the profile
 * header's claim prompt, so both validate and claim through the same path.
 */
export const useUsernameEditor = (): SettingsUsernameEditor => {
  const { t } = useI18n();
  const user = useAuthStore(s => s.user);
  const firestoreProfile = useProfileStore(s => s.profile);
  const { showSnackbar } = useSnackbar();

  return {
    addPrompt: t('settings.username.addPrompt'),
    currentValue: firestoreProfile?.username
      ? `@${firestoreProfile.username}`
      : undefined,
    dialog: {
      title: t('settings.username.dialog.title'),
      fieldLabel: t('settings.username.dialog.fieldLabel'),
      confirm: t('settings.username.dialog.confirm'),
      cancel: t('settings.username.dialog.cancel'),
    },
    // Errors are thrown with an already-localized message so the dialog can
    // show them INLINE (under the field) — a snackbar would render behind the
    // Compose dialog's scrim. Success still snackbars: it fires as the dialog
    // closes, so it's visible.
    onSubmit: async next => {
      if (!user) throw new Error(t('snackbar.username-update-failed'));

      if (!USERNAME_PATTERN.test(next))
        throw new Error(t('snackbar.username-invalid'));

      try {
        await claimUsername({ uid: user.uid, username: next });
        showSnackbar(t('snackbar.username-updated'));
      } catch (error) {
        throw new Error(
          t(
            error instanceof Error && error.message === 'username-taken'
              ? 'snackbar.username-taken'
              : 'snackbar.username-update-failed',
          ),
        );
      }
    },
  };
};
